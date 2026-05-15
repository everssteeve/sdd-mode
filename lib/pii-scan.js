// AIAD SDD Mode — Détection PII (Personal Identifiable Information) (item #109).
//
// **Cap stratégique** : les Intents et SPECs versionnés finissent dans
// l'historique git public d'un projet. Si un développeur y colle par
// accident un IBAN client, un numéro de sécurité sociale, un token
// d'API actif ou un email personnel, **le secret reste exposé même
// après suppression** (git history). Le RGPD article 32 (sécurité du
// traitement) exige des mesures techniques contre ces fuites.
//
// **Patterns détectés** :
//   - **IBAN** — `[A-Z]{2}\d{2}[0-9A-Z]{11,30}` avec **vérification
//     checksum mod 97** pour réduire les faux positifs.
//   - **Email** — RFC 5322 simplifié (couvre 99 % des cas réels).
//   - **Téléphone FR/EU** — `+33`, `0[1-9]`, `+39`/`+34`/`+49` (FR/IT/ES/DE).
//   - **NIR français** (n° sécu) — 13 chiffres + clé 2 chiffres avec
//     **vérification de la clé** (97 − reste mod 97).
//   - **Carte bancaire** — 13–19 chiffres avec **algorithme de Luhn**.
//   - **Tokens & secrets** — `sk_live_`, `sk_test_`, `ghp_`, `gho_`,
//     `glpat-`, `AKIA…` (AWS Access Key), `xoxb-…` (Slack bot).
//
// **Modes d'enforcement** :
//   - `block` (défaut) : le hook pre-commit bloque le commit.
//   - `warn`  : affiche les findings sans bloquer.
//   - `off`   : désactivé entièrement.
//
// Configuration : `.aiad/config.yml` (clé `pii_scan: block|warn|off`) ou
// variable d'env `AIAD_PII_MODE`.
//
// Documentation : https://aiad.ovh/pii

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { C, logHeader } from './term.js';

// ─── Patterns ──────────────────────────────────────────────────────────────

/**
 * Liste des détecteurs PII. Chaque détecteur expose :
 *   - `id` — identifiant court (snake_case)
 *   - `label` — libellé humain
 *   - `severity` — 'critique' | 'eleve' | 'moyen'
 *   - `regex` — pattern à appliquer (global)
 *   - `verify?(match)` — validation supplémentaire (checksum, Luhn, etc.)
 */
export const DETECTEURS = [
  {
    id: 'iban',
    label: 'IBAN bancaire',
    severity: 'critique',
    regex: /\b([A-Z]{2}\d{2}[0-9A-Z]{11,30})\b/g,
    verify: verifierIban,
  },
  {
    id: 'card',
    label: 'Numéro de carte bancaire',
    severity: 'critique',
    regex: /\b(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/g,
    verify: (m) => verifierLuhn(m.replace(/[\s-]/g, '')),
  },
  {
    id: 'nir_fr',
    label: 'NIR / Numéro de sécu FR',
    severity: 'critique',
    regex: /\b([12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2})\b/g,
    verify: verifierNir,
  },
  {
    id: 'token_stripe_live',
    label: 'Token Stripe (live)',
    severity: 'critique',
    regex: /\b(sk_live_[A-Za-z0-9]{24,})\b/g,
  },
  {
    id: 'token_stripe_test',
    label: 'Token Stripe (test)',
    severity: 'eleve',
    regex: /\b(sk_test_[A-Za-z0-9]{24,})\b/g,
  },
  {
    id: 'token_github',
    label: 'Personal Access Token GitHub',
    severity: 'critique',
    regex: /\b(ghp_[A-Za-z0-9]{36,})\b/g,
  },
  {
    id: 'token_github_oauth',
    label: 'OAuth token GitHub',
    severity: 'critique',
    regex: /\b(gho_[A-Za-z0-9]{36,})\b/g,
  },
  {
    id: 'token_gitlab',
    label: 'GitLab Personal Access Token',
    severity: 'critique',
    regex: /\b(glpat-[A-Za-z0-9_-]{20,})\b/g,
  },
  {
    id: 'token_aws_access',
    label: 'AWS Access Key',
    severity: 'critique',
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
  },
  {
    id: 'token_slack',
    label: 'Slack token (xoxb)',
    severity: 'critique',
    regex: /\b(xoxb-[A-Za-z0-9-]{20,})\b/g,
  },
  {
    id: 'token_openai',
    label: 'OpenAI API key',
    severity: 'critique',
    regex: /\b(sk-(?:proj-)?[A-Za-z0-9_-]{20,})\b/g,
  },
  {
    id: 'phone_fr',
    label: 'Téléphone FR',
    severity: 'moyen',
    regex: /(?<![\w+])(?:(?:\+33|0033)\s?[1-9](?:\s?\d{2}){4}|0[1-9](?:[\s.-]?\d{2}){4})\b/g,
  },
  {
    id: 'phone_eu',
    label: 'Téléphone EU (IT/ES/DE/BE)',
    severity: 'moyen',
    regex: /(?<![\w+])\+(?:39|34|49|32)\s?\d(?:[\s.-]?\d){7,11}\b/g,
  },
  {
    id: 'email',
    label: 'Adresse e-mail',
    severity: 'moyen',
    regex: /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g,
  },
];

// ─── Helpers de vérification ───────────────────────────────────────────────

/**
 * Vérifie un IBAN via l'algorithme mod 97 (ISO 13616).
 *
 * @param {string} iban
 * @returns {boolean}
 */
export function verifierIban(iban) {
  const s = String(iban).replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[0-9A-Z]+$/.test(s)) return false;
  if (s.length < 15 || s.length > 34) return false;
  const reorg = s.slice(4) + s.slice(0, 4);
  // Convertit chaque lettre en sa position (A=10, B=11, ..., Z=35)
  let numerique = '';
  for (const ch of reorg) {
    if (ch >= '0' && ch <= '9') numerique += ch;
    else numerique += String(ch.charCodeAt(0) - 55);
  }
  // mod 97 sur grand nombre via slicing successif
  let reste = 0;
  for (let i = 0; i < numerique.length; i += 7) {
    reste = parseInt(String(reste) + numerique.slice(i, i + 7), 10) % 97;
  }
  return reste === 1;
}

/**
 * Vérifie le NIR français (numéro de sécurité sociale).
 * Format : SYYMMP PCCC OOO KK
 *   - S : sexe (1 ou 2)
 *   - YY : année naissance
 *   - MM : mois naissance (01-12, 20-22, 30-32, 99 pour né hors métropole avant 1963)
 *   - PP : département de naissance (01-99, 2A/2B → 19/18)
 *   - CCC : commune
 *   - OOO : ordre
 *   - KK : clé = 97 − (NIR mod 97)
 *
 * @param {string} nir
 * @returns {boolean}
 */
export function verifierNir(nir) {
  const s = String(nir).replace(/\s+/g, '');
  if (!/^[12]\d{12}\d{2}$/.test(s)) return false;
  const corps = parseInt(s.slice(0, 13), 10);
  const cleAttendue = 97 - (corps % 97);
  const cleVue = parseInt(s.slice(13), 10);
  return cleAttendue === cleVue;
}

/**
 * Vérifie un numéro de carte via l'algorithme de Luhn.
 *
 * @param {string} num — chiffres uniquement
 * @returns {boolean}
 */
export function verifierLuhn(num) {
  const s = String(num).replace(/\D/g, '');
  if (s.length < 13 || s.length > 19) return false;
  let somme = 0;
  let double = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let d = parseInt(s[i], 10);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    somme += d;
    double = !double;
  }
  return somme % 10 === 0;
}

// ─── Scan ──────────────────────────────────────────────────────────────────

/**
 * Scanne un texte et retourne les findings.
 *
 * @param {string} contenu
 * @returns {{ kind: string, label: string, severity: string, match: string, ligne: number, colonne: number }[]}
 */
export function scannerContenu(contenu) {
  if (typeof contenu !== 'string' || contenu.length === 0) return [];
  const lignes = contenu.split('\n');
  const findings = [];
  for (const det of DETECTEURS) {
    det.regex.lastIndex = 0;
    let m;
    while ((m = det.regex.exec(contenu)) !== null) {
      const value = m[1] || m[0];
      if (typeof det.verify === 'function' && !det.verify(value)) continue;
      const offset = m.index;
      // Localise la ligne/colonne
      let ligne = 1; let colonne = 1;
      for (let i = 0; i < offset; i++) {
        if (contenu[i] === '\n') { ligne++; colonne = 1; }
        else colonne++;
      }
      findings.push({
        kind: det.id,
        label: det.label,
        severity: det.severity,
        match: value,
        ligne,
        colonne,
      });
    }
  }
  return findings;
}

/**
 * Scanne un fichier sur disque.
 */
export function scannerFichier(path) {
  if (!existsSync(path)) return [];
  return scannerContenu(readFileSync(path, 'utf-8'));
}

/**
 * Liste les fichiers stagés (Added/Copied/Modified/Renamed) restreints à
 * `.aiad/intents/` et `.aiad/specs/`.
 */
export function listerFichiersStages(racine) {
  const r = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    cwd: racine, encoding: 'utf-8',
  });
  if (r.status !== 0) return [];
  return r.stdout.split('\n')
    .filter(Boolean)
    .filter((f) => /^\.aiad\/(intents|specs)\//.test(f));
}

/**
 * Scanne les artefacts stagés et retourne les findings agrégés.
 *
 * @param {string} racine
 * @returns {{ files: number, findings: object[], byFile: Record<string, object[]> }}
 */
export function scannerStages(racine) {
  const fichiers = listerFichiersStages(racine);
  const byFile = {};
  let total = 0;
  for (const f of fichiers) {
    const findings = scannerFichier(join(racine, f));
    if (findings.length > 0) {
      byFile[f] = findings;
      total += findings.length;
    }
  }
  return { files: fichiers.length, findings: total, byFile };
}

// ─── Mode (config) ─────────────────────────────────────────────────────────

const MODES_VALIDES = ['block', 'warn', 'off'];

/**
 * Résout le mode d'enforcement depuis `.aiad/config.yml` ou env.
 *
 * @param {string} racine
 * @returns {'block'|'warn'|'off'}
 */
export function resoudreMode(racine) {
  const env = process.env.AIAD_PII_MODE;
  if (env && MODES_VALIDES.includes(env.toLowerCase())) return env.toLowerCase();
  const configPath = join(racine, '.aiad', 'config.yml');
  if (!existsSync(configPath)) return 'block';
  try {
    const contenu = readFileSync(configPath, 'utf-8');
    const m = contenu.match(/^\s*pii_scan\s*:\s*(['"]?)(block|warn|off)\1/im);
    if (m) return m[2].toLowerCase();
  } catch { /* ignore */ }
  return 'block';
}

// ─── Pipeline CLI ──────────────────────────────────────────────────────────

/**
 * Affiche un rapport humain ou JSON.
 *
 * @param {string} racine
 * @param {{ path?: string, staged?: boolean, json?: boolean, mode?: string }} options
 */
export function piiScan(racine, options = {}) {
  const mode = options.mode || resoudreMode(racine);

  let report;
  if (options.path) {
    const findings = scannerFichier(join(racine, options.path));
    report = {
      files: 1,
      findings: findings.length,
      byFile: findings.length > 0 ? { [options.path]: findings } : {},
    };
  } else if (options.staged) {
    report = scannerStages(racine);
  } else {
    report = { files: 0, findings: 0, byFile: {} };
  }

  if (options.json) {
    process.stdout.write(JSON.stringify({ mode, ...report }, null, 2) + '\n');
    return { mode, ...report };
  }

  logHeader(
    'AIAD SDD — PII scan',
    `${report.findings} finding(s) dans ${report.files} fichier(s) (mode: ${mode})`,
  );

  if (report.findings === 0) {
    console.log(`  ${C.vert}✓${C.reset} Aucune PII détectée.\n`);
    return { mode, ...report };
  }

  for (const [fichier, findings] of Object.entries(report.byFile)) {
    console.log(`\n  ${C.cyan}${fichier}${C.reset}`);
    for (const f of findings) {
      const couleur = f.severity === 'critique' ? C.rouge
        : f.severity === 'eleve' ? C.jaune
        : C.gris;
      const masque = f.match.length > 8
        ? f.match.slice(0, 4) + '…' + f.match.slice(-2)
        : '••••';
      console.log(`    ${couleur}● ${f.severity.toUpperCase().padEnd(9)}${C.reset} L${f.ligne}:${f.colonne}  ${f.label}  ${C.gris}(${masque})${C.reset}`);
    }
  }

  if (mode === 'block') {
    console.error(`\n  ${C.rouge}✗${C.reset} Mode block : ${report.findings} PII détectée(s). Corrige avant de commiter.`);
    console.error(`    Bypass ponctuel : export AIAD_PII_MODE=warn (déconseillé)\n`);
  } else if (mode === 'warn') {
    console.log(`\n  ${C.jaune}⚠${C.reset} Mode warn : commit autorisé mais ces données sont visibles.\n`);
  }

  return { mode, ...report };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  verifierIban as verifyIban,
  verifierNir as verifyNir,
  verifierLuhn as verifyLuhn,
  scannerContenu as scanContent,
  scannerFichier as scanFile,
  listerFichiersStages as listStagedFiles,
  scannerStages as scanStaged,
  resoudreMode as resolveMode,
  piiScan as scan,
};

export const CONSTANTS = {
  MODES_VALIDES,
};
