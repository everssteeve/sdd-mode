// AIAD SDD Mode — Configuration org-level (item #122).
//
// **Cap stratégique** : dans une organisation avec 10+ projets AIAD, le
// risque de divergence est élevé : un projet oublie `AIAD-RGPD`, un autre
// passe en sovereignty Bronze. La **configuration org-level** impose des
// règles communes opposables, validables en CI par `aiad-sdd doctor`.
//
// **Schéma `.aiad/org.yml`** :
//   ```yaml
//   orgName: ACME Corporation
//   minSovereigntyScore: 70           # 0-100
//   requiredPacks:
//     - eu-baseline
//     - fr-anssi
//   requiredAgents:
//     - AIAD-RGPD
//     - AIAD-AI-ACT
//     - AIAD-CRA
//   owners:                            # responsables par type d'artefact
//     intents: equipe-produit
//     specs: equipe-tech
//   allowedRuntimes:                  # whitelist runtimes IA (anti-shadow IT)
//     - claude-code
//     - cursor
//   strict: true                       # exit 1 si non-conforme (sinon warn)
//   ```
//
// **Discovery** (ordre de priorité) :
//   1. Option `--org-config <path>` du CLI
//   2. Variable d'env `AIAD_ORG_CONFIG`
//   3. `.aiad/org.yml` dans le projet courant
//   4. Recherche **ascendante** dans les répertoires parents (monorepo)
//
// **Zero-dep** : parser YAML minimaliste maison (scalaires + listes +
// objets imbriqués 1 niveau). Pour les cas complexes, l'utilisateur peut
// migrer vers JSON équivalent (`.aiad/org.json` également supporté).
//
// Documentation : https://aiad.ovh/org-config

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { C, logHeader } from './term.js';

const CONFIG_NAME_YAML = 'org.yml';
const CONFIG_NAME_JSON = 'org.json';

// ─── Parser YAML minimaliste ──────────────────────────────────────────────

/**
 * Parse un sous-ensemble YAML : scalaires, listes simples,
 * objets imbriqués sur 1 niveau d'indentation.
 *
 * Supporté :
 *   - `key: value` (string, number, boolean)
 *   - `key: "with spaces"` (guillemets simples ou doubles)
 *   - `key:\n  - item1\n  - item2`
 *   - `key:\n  sub: value\n  sub2: value`
 *   - `# commentaire` (ligne entière ou trailing)
 *
 * NON supporté : ancres, merge keys, listes d'objets, multi-line strings.
 * Pour ces cas, utiliser `.aiad/org.json`.
 *
 * @param {string} text
 * @returns {object}
 */
export function parseYaml(text) {
  if (typeof text !== 'string') return {};
  const lignes = text.split('\n');
  const out = {};
  let i = 0;

  function parseScalaire(raw) {
    const s = raw.replace(/\s*#.*$/, '').trim();
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null' || s === '~' || s === '') return null;
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
    // Strings quotées
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1);
    }
    return s;
  }

  function indentationDe(ligne) {
    const m = ligne.match(/^( *)/);
    return m ? m[1].length : 0;
  }

  while (i < lignes.length) {
    const ligne = lignes[i];
    const trimmed = ligne.trim();
    if (trimmed === '' || trimmed.startsWith('#')) { i++; continue; }
    if (indentationDe(ligne) !== 0) { i++; continue; }

    // Top-level: key: value | key:
    const m = trimmed.match(/^([A-Za-z_][\w.-]*)\s*:\s*(.*)$/);
    if (!m) { i++; continue; }
    const key = m[1];
    const rest = m[2];

    if (rest !== '' && !rest.startsWith('#')) {
      // Scalar
      out[key] = parseScalaire(rest);
      i++; continue;
    }

    // Bloc enfant : liste ou objet
    i++;
    const enfants = [];
    while (i < lignes.length) {
      const e = lignes[i];
      if (e.trim() === '' || e.trim().startsWith('#')) { i++; continue; }
      const ind = indentationDe(e);
      if (ind === 0) break;
      enfants.push(e);
      i++;
    }
    if (enfants.length === 0) { out[key] = null; continue; }
    // Détecte liste vs objet
    const premier = enfants[0].trim();
    if (premier.startsWith('- ') || premier === '-') {
      out[key] = enfants
        .map((e) => e.trim())
        .filter((e) => e.startsWith('-'))
        .map((e) => parseScalaire(e.slice(1).trim()));
    } else {
      const subObj = {};
      for (const e of enfants) {
        const sm = e.trim().match(/^([A-Za-z_][\w.-]*)\s*:\s*(.*)$/);
        if (sm) subObj[sm[1]] = parseScalaire(sm[2]);
      }
      out[key] = subObj;
    }
  }
  return out;
}

// ─── Discovery ────────────────────────────────────────────────────────────

/**
 * Cherche un fichier `.aiad/org.yml|json` en remontant les parents.
 *
 * @param {string} racine
 * @returns {string|null}
 */
export function trouverConfig(racine) {
  let courant = resolve(racine);
  // Limite à 10 niveaux de remontée pour éviter une boucle filesystem
  for (let i = 0; i < 10; i++) {
    for (const nom of [CONFIG_NAME_YAML, CONFIG_NAME_JSON]) {
      const path = join(courant, '.aiad', nom);
      if (existsSync(path)) return path;
    }
    const parent = dirname(courant);
    if (parent === courant) break;
    courant = parent;
  }
  return null;
}

/**
 * Charge la configuration org effective.
 *
 * Priorité :
 *   1. `options.configPath` explicite
 *   2. `process.env.AIAD_ORG_CONFIG`
 *   3. recherche ascendante depuis `racine`
 *
 * @param {string} racine
 * @param {{ configPath?: string }} [options]
 * @returns {{ config: object|null, source: string|null }}
 */
export function chargerConfig(racine, options = {}) {
  const explicite = options.configPath || process.env.AIAD_ORG_CONFIG;
  let path = null;
  if (explicite) {
    path = resolve(racine, explicite);
    if (!existsSync(path)) return { config: null, source: null };
  } else {
    path = trouverConfig(racine);
    if (!path) return { config: null, source: null };
  }
  const contenu = readFileSync(path, 'utf-8');
  let config;
  if (path.endsWith('.json')) {
    try { config = JSON.parse(contenu); }
    catch (err) { throw new Error(`Org config JSON invalide : ${err.message}`); }
  } else {
    config = parseYaml(contenu);
  }
  return { config, source: path };
}

// ─── Validation ───────────────────────────────────────────────────────────

/**
 * Évalue la conformité d'un projet aux règles org.
 *
 * @param {{ governanceFiles: string[], sovereigntyScore: number, runtimes: string[] }} projetEtat
 * @param {object} orgConfig
 * @returns {{ valid: boolean, violations: { rule: string, message: string }[] }}
 */
export function verifierConformite(projetEtat, orgConfig) {
  const violations = [];
  if (!orgConfig) return { valid: true, violations: [] };

  // Packs requis : on vérifie via présence d'agents typiques de chaque pack
  const PACK_AGENTS_TYPES = {
    'eu-baseline': ['AIAD-AI-ACT.md', 'AIAD-RGPD.md', 'AIAD-RGAA.md', 'AIAD-RGESN.md'],
    'fr-anssi': ['AIAD-RGS.md', 'AIAD-PASSI.md', 'AIAD-SECNUMCLOUD.md', 'AIAD-HOMOLOGATION.md'],
    'eu-financial': ['AIAD-DORA.md', 'AIAD-PSD2.md'],
    'eu-platforms': ['AIAD-DSA.md'],
    'iso-standards': ['AIAD-ISO-42001.md'],
    'de-bsi': ['AIAD-BSI-IT-Grundschutz.md'],
    'es-aepd': ['AIAD-AEPD.md'],
    'ch-fadp': ['AIAD-CH-FADP.md'],
    'apac-baseline': ['AIAD-JP-APPI.md', 'AIAD-SG-PDPA.md', 'AIAD-AU-PRIVACY.md'],
    'latam-baseline': ['AIAD-BR-LGPD.md', 'AIAD-MX-LFPDPPP.md'],
  };
  for (const packId of orgConfig.requiredPacks || []) {
    const agentsTypes = PACK_AGENTS_TYPES[packId];
    if (!agentsTypes) {
      violations.push({ rule: 'requiredPacks', message: `Pack inconnu "${packId}" — vérifie la config org.` });
      continue;
    }
    const present = agentsTypes.some((a) => projetEtat.governanceFiles.includes(a));
    if (!present) {
      violations.push({
        rule: 'requiredPacks',
        message: `Pack obligatoire "${packId}" absent (aucun de ${agentsTypes.join(', ')} détecté).`,
      });
    }
  }

  // Agents Tier 1 spécifiquement requis
  for (const agent of orgConfig.requiredAgents || []) {
    const file = agent.endsWith('.md') ? agent : agent + '.md';
    if (!projetEtat.governanceFiles.includes(file)) {
      violations.push({ rule: 'requiredAgents', message: `Agent obligatoire "${agent}" absent.` });
    }
  }

  // Score souveraineté minimum
  if (typeof orgConfig.minSovereigntyScore === 'number') {
    if (projetEtat.sovereigntyScore < orgConfig.minSovereigntyScore) {
      violations.push({
        rule: 'minSovereigntyScore',
        message: `Sovereignty Score ${projetEtat.sovereigntyScore} < requis ${orgConfig.minSovereigntyScore}.`,
      });
    }
  }

  // Runtimes autorisés
  if (Array.isArray(orgConfig.allowedRuntimes) && orgConfig.allowedRuntimes.length > 0) {
    const allow = new Set(orgConfig.allowedRuntimes);
    for (const r of projetEtat.runtimes || []) {
      if (!allow.has(r)) {
        violations.push({
          rule: 'allowedRuntimes',
          message: `Runtime "${r}" non autorisé (whitelist : ${orgConfig.allowedRuntimes.join(', ')}).`,
        });
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

// ─── Pipeline CLI ──────────────────────────────────────────────────────────

/**
 * Affiche la config org effective.
 */
export function afficherConfig(racine, options = {}) {
  const { config, source } = chargerConfig(racine, options);
  if (options.json) {
    process.stdout.write(JSON.stringify({ source, config }, null, 2) + '\n');
    return { source, config };
  }
  logHeader(
    'AIAD SDD — Org config',
    source ? `Chargée depuis ${source}` : 'Aucune config org détectée',
  );
  if (!config) {
    console.log(`  ${C.gris}~ Crée .aiad/org.yml pour imposer des règles org-wide.${C.reset}\n`);
    return { source, config };
  }
  for (const [k, v] of Object.entries(config)) {
    const val = Array.isArray(v) ? v.join(', ')
      : (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v));
    console.log(`  ${C.cyan}${k.padEnd(22)}${C.reset} ${val}`);
  }
  console.log('');
  return { source, config };
}

/**
 * Génère un template `.aiad/org.yml` pour démarrer.
 */
export function templateConfig() {
  return [
    '# .aiad/org.yml — politiques organisationnelles AIAD',
    '# Documentation : https://aiad.ovh/org-config',
    '',
    'orgName: "Mon Organisation"',
    '',
    '# Score EU Sovereignty minimum requis (0-100). Bronze < 40, Silver < 70, Gold < 90.',
    'minSovereigntyScore: 70',
    '',
    '# Packs gouvernance obligatoires pour tous les projets.',
    'requiredPacks:',
    '  - eu-baseline',
    '  - fr-anssi',
    '',
    '# Agents Tier 1 obligatoires (en plus des packs).',
    'requiredAgents:',
    '  - AIAD-RGPD',
    '  - AIAD-AI-ACT',
    '  - AIAD-CRA',
    '',
    '# Whitelist des runtimes IA autorisés (anti-shadow IT).',
    'allowedRuntimes:',
    '  - claude-code',
    '  - cursor',
    '  - codex',
    '',
    '# Équipes responsables par type d\'artefact (informatif).',
    'owners:',
    '  intents: equipe-produit',
    '  specs: equipe-tech',
    '',
    '# Mode strict : exit 1 si non-conforme (sinon warn).',
    'strict: true',
  ].join('\n') + '\n';
}

/**
 * Vérification + impression du verdict.
 */
export function verifier(racine, projetEtat, options = {}) {
  const { config, source } = chargerConfig(racine, options);
  if (!config) {
    if (options.json) {
      process.stdout.write(JSON.stringify({ valid: true, raison: 'no-org-config' }, null, 2) + '\n');
    } else {
      console.log(`\n  ${C.gris}~ Aucune config org — vérification skipped.${C.reset}\n`);
    }
    return { valid: true, violations: [], source: null };
  }
  const r = verifierConformite(projetEtat, config);
  const strict = Boolean(config.strict);
  if (options.json) {
    process.stdout.write(JSON.stringify({
      source, strict, valid: r.valid, violations: r.violations,
    }, null, 2) + '\n');
    return { ...r, source, strict };
  }
  logHeader(
    'AIAD SDD — Conformité org',
    `${source}${strict ? ' · mode strict' : ' · mode warn'}`,
  );
  if (r.valid) {
    console.log(`  ${C.vert}✓${C.reset} Toutes les règles org respectées.\n`);
  } else {
    console.error(`  ${C.rouge}✗${C.reset} ${r.violations.length} violation(s) :`);
    for (const v of r.violations) {
      console.error(`    ${C.rouge}-${C.reset} [${v.rule}] ${v.message}`);
    }
    console.error('');
  }
  return { ...r, source, strict };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  parseYaml as parseYamlMinimal,
  trouverConfig as findConfig,
  chargerConfig as loadConfig,
  verifierConformite as checkCompliance,
  afficherConfig as showConfig,
  templateConfig as configTemplate,
  verifier as check,
};

export const CONSTANTS = {
  CONFIG_NAME_YAML,
  CONFIG_NAME_JSON,
};
