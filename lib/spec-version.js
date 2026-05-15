// AIAD SDD Mode — Versioning sémantique des SPECs (item #104).
//
// **Cap stratégique** : industrialiser le cycle de vie des SPECs.
// Quand une SPEC évolue, les agents IA et les développeurs doivent
// savoir si le changement est **breaking** (refonte) ou **compatible**
// (ajout/clarification). Le frontmatter `version: MAJOR.MINOR.PATCH`
// rend ce contrat explicite, et `aiad-sdd spec-version check` détecte
// automatiquement les breaking changes entre deux états.
//
// **Convention semver appliquée aux SPECs** :
//   - **MAJOR** — un critère existant est **supprimé ou modifié**, ou
//     une signature API change (frontmatter `api: true`), ou un
//     `@governance` Tier 1 est retiré.
//   - **MINOR** — un critère est **ajouté** (compatible ascendant).
//   - **PATCH** — clarifications pures (typos, reformulations) sans
//     changement de critère.
//
// **Compat ascendante** : la convention impose **1 release MINOR
// minimum** entre une SPEC v1.x et une v2.x si du code applicatif
// référence v1.x — pour permettre l'implémentation transitoire
// (déprécation explicite, période de coexistence).
//
// Documentation : https://aiad.ovh/spec-version

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter.js';
import { C, logHeader } from './term.js';

const VERSION_DEFAUT = '1.0.0';

// ─── Parsing / comparaison semver ──────────────────────────────────────────

/**
 * Parse une version "MAJOR.MINOR.PATCH" stricte.
 *
 * @param {string} s
 * @returns {{ major: number, minor: number, patch: number }|null}
 */
export function parseVersion(s) {
  if (typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

/**
 * Compare deux versions :
 *   -1 si a < b, 0 si a === b, 1 si a > b.
 *
 * @param {string} a
 * @param {string} b
 */
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa) throw new Error(`Version invalide : "${a}".`);
  if (!pb) throw new Error(`Version invalide : "${b}".`);
  for (const k of ['major', 'minor', 'patch']) {
    if (pa[k] < pb[k]) return -1;
    if (pa[k] > pb[k]) return 1;
  }
  return 0;
}

/**
 * Incrémente une version selon `kind` (major|minor|patch).
 *
 * @param {string} current
 * @param {'major'|'minor'|'patch'} kind
 * @returns {string} nouvelle version
 */
export function bumpVersion(current, kind) {
  const v = parseVersion(current) || { major: 0, minor: 0, patch: 0 };
  if (kind === 'major') return `${v.major + 1}.0.0`;
  if (kind === 'minor') return `${v.major}.${v.minor + 1}.0`;
  if (kind === 'patch') return `${v.major}.${v.minor}.${v.patch + 1}`;
  throw new Error(`Type de bump inconnu : "${kind}". Valides : major, minor, patch.`);
}

// ─── Lecture / écriture SPEC ───────────────────────────────────────────────

/**
 * Lit la version courante d'une SPEC depuis son frontmatter.
 *
 * @returns {string} version (défaut "1.0.0" si absente)
 */
export function lireVersion(spec) {
  const v = spec.frontmatter && spec.frontmatter.version;
  if (typeof v === 'string' && parseVersion(v)) return v;
  return VERSION_DEFAUT;
}

/**
 * Charge une SPEC depuis `.aiad/specs/`.
 */
export function chargerSpec(racine, specId) {
  const dir = join(racine, '.aiad', 'specs');
  if (!existsSync(dir)) throw new Error(`.aiad/specs/ introuvable.`);
  const list = readdirSync(dir);
  const idUp = specId.toUpperCase();
  const fichier = list.find((f) => f.toUpperCase().startsWith(idUp));
  if (!fichier) throw new Error(`SPEC ${specId} introuvable.`);
  const path = join(dir, fichier);
  const contenu = readFileSync(path, 'utf-8');
  const { data, body } = parseFrontmatter(contenu);
  return {
    id: specId, path, fichier,
    frontmatter: data,
    body,
    version: typeof data.version === 'string' && parseVersion(data.version) ? data.version : VERSION_DEFAUT,
  };
}

/**
 * Lit une SPEC à un commit git donné (pour comparer ancien/nouveau).
 *
 * @returns {{ frontmatter: object, body: string }|null}
 */
export function lireSpecAuCommit(racine, fichierRel, ref) {
  const r = spawnSync('git', ['show', `${ref}:${fichierRel}`], {
    cwd: racine, encoding: 'utf-8',
  });
  if (r.status !== 0) return null;
  const { data, body } = parseFrontmatter(r.stdout);
  return { frontmatter: data, body };
}

// ─── Détection des breaking changes ────────────────────────────────────────

/**
 * Extrait les "critères" d'une SPEC pour les comparer entre versions.
 *
 * Heuristique : chaque ligne match d'un pattern EARS ou bullet AC-N est
 * un critère unique identifié par sa forme normalisée (lowercase, espaces
 * compactés) — la disparition d'un critère = breaking.
 */
export function extraireCriteres(body) {
  if (typeof body !== 'string') return [];
  const out = new Set();
  const patterns = [
    /^.*\b(WHEN|IF|WHILE|WHERE)\b[^.\n]*\b(THE SYSTEM SHALL|SHALL)\b[^.\n]*\.?$/gim,
    /^.*\b(QUAND|SI|TANT QUE|LORSQUE|OÙ)\b[^.\n]*\b(LE SYSTÈME DOIT|DOIT)\b[^.\n]*\.?$/gim,
    /^\s*-\s*\*\*AC-\d+\*\*[^\n]*$/gim,
    /^\s*-?\s*\*\*Critère\s+\d+\*\*[^\n]*$/gim,
  ];
  for (const re of patterns) {
    const matches = body.match(re);
    if (matches) {
      for (const m of matches) {
        const norm = m.replace(/\s+/g, ' ').trim().toLowerCase();
        out.add(norm);
      }
    }
  }
  return [...out];
}

/**
 * Compare deux versions d'une SPEC et identifie les breaking changes.
 *
 * Critères de détection breaking :
 *   - critère existant supprimé
 *   - critère existant modifié (≠ texte normalisé)
 *   - frontmatter `api: true → false`
 *   - tags `@governance` Tier 1 retirés
 *   - frontmatter `intent` changé
 *
 * Retourne aussi les changements compatibles (additions de critères).
 *
 * @param {{ frontmatter: object, body: string }} avant
 * @param {{ frontmatter: object, body: string }} apres
 */
export function detectBreaking(avant, apres) {
  const breaking = [];
  const additions = [];

  const cAvant = extraireCriteres(avant.body);
  const cApres = extraireCriteres(apres.body);
  const setAvant = new Set(cAvant);
  const setApres = new Set(cApres);

  for (const c of cAvant) {
    if (!setApres.has(c)) {
      breaking.push({ kind: 'criterion-removed', detail: c.slice(0, 120) });
    }
  }
  for (const c of cApres) {
    if (!setAvant.has(c)) {
      additions.push({ kind: 'criterion-added', detail: c.slice(0, 120) });
    }
  }

  // API toggle
  const apiAvant = Boolean(avant.frontmatter?.api);
  const apiApres = Boolean(apres.frontmatter?.api);
  if (apiAvant && !apiApres) {
    breaking.push({ kind: 'api-removed', detail: 'frontmatter `api: true` retiré' });
  }

  // intent changé
  if (avant.frontmatter?.intent && apres.frontmatter?.intent
      && avant.frontmatter.intent !== apres.frontmatter.intent) {
    breaking.push({
      kind: 'intent-changed',
      detail: `Intent parent : ${avant.frontmatter.intent} → ${apres.frontmatter.intent}`,
    });
  }

  // governance Tier 1 retiré
  const govAvant = String(avant.frontmatter?.governance || '').split(/[,\s]+/).filter(Boolean);
  const govApres = String(apres.frontmatter?.governance || '').split(/[,\s]+/).filter(Boolean);
  for (const g of govAvant) {
    if (!govApres.includes(g)) {
      breaking.push({ kind: 'governance-removed', detail: `@governance ${g}` });
    }
  }

  return {
    breaking,
    additions,
    needsBumpKind: breaking.length > 0 ? 'major' : (additions.length > 0 ? 'minor' : 'patch'),
  };
}

/**
 * Vérifie la cohérence du bump de version vs les changements détectés.
 *
 * @returns {{ valid: boolean, raison?: string, attendu?: string }}
 */
export function validerBump(versionAvant, versionApres, diff) {
  if (compareVersions(versionApres, versionAvant) <= 0) {
    return { valid: false, raison: 'la nouvelle version doit être > version précédente' };
  }
  const pa = parseVersion(versionAvant);
  const pn = parseVersion(versionApres);
  const bumpKind = pn.major > pa.major ? 'major'
    : pn.minor > pa.minor ? 'minor' : 'patch';
  if (diff.needsBumpKind === 'major' && bumpKind !== 'major') {
    return {
      valid: false,
      raison: `breaking changes détectés (${diff.breaking.length}) — bump MAJOR requis`,
      attendu: bumpVersion(versionAvant, 'major'),
    };
  }
  if (diff.needsBumpKind === 'minor' && bumpKind === 'patch') {
    return {
      valid: false,
      raison: `additions détectées (${diff.additions.length}) — bump MINOR requis`,
      attendu: bumpVersion(versionAvant, 'minor'),
    };
  }
  return { valid: true };
}

// ─── Pipeline ──────────────────────────────────────────────────────────────

/**
 * Bump la version d'une SPEC et réécrit son frontmatter.
 *
 * @param {string} racine
 * @param {string} specId
 * @param {'major'|'minor'|'patch'} kind
 * @param {{ dryRun?: boolean, json?: boolean }} [options]
 */
export function bumpSpec(racine, specId, kind, options = {}) {
  const spec = chargerSpec(racine, specId);
  const ancienne = spec.version;
  const nouvelle = bumpVersion(ancienne, kind);
  const fmUpdated = { ...spec.frontmatter, version: nouvelle };
  const contenuNouveau = stringifyFrontmatter(fmUpdated) + spec.body;
  if (!options.dryRun) writeFileSync(spec.path, contenuNouveau, 'utf-8');

  if (options.json) {
    process.stdout.write(JSON.stringify({
      spec: spec.id, ancienne, nouvelle, kind, dryRun: Boolean(options.dryRun),
    }, null, 2) + '\n');
  } else {
    logHeader(`AIAD SDD — Bump SPEC ${spec.id}`, `${ancienne} → ${nouvelle} (${kind})`);
    console.log(`  ${C.vert}✓${C.reset} ${options.dryRun ? '(dry-run, frontmatter non écrit)' : `Frontmatter mis à jour : ${C.cyan}${spec.fichier}${C.reset}`}\n`);
  }
  return { ancienne, nouvelle, kind };
}

/**
 * Vérifie la cohérence du versioning d'une SPEC vs son état git précédent.
 *
 * @param {string} racine
 * @param {string} specId
 * @param {{ ref?: string, json?: boolean }} [options]
 * @returns {Promise<{ versionAvant: string, versionApres: string, diff: object, validation: object }|null>}
 */
export function verifierVersion(racine, specId, options = {}) {
  const ref = options.ref || 'HEAD';
  const spec = chargerSpec(racine, specId);
  const cheminRel = `.aiad/specs/${spec.fichier}`;
  const ancien = lireSpecAuCommit(racine, cheminRel, ref);

  if (!ancien) {
    if (options.json) {
      process.stdout.write(JSON.stringify({ spec: spec.id, neuf: true }, null, 2) + '\n');
    } else {
      console.log(`\n  ${C.gris}~ SPEC ${spec.id} : nouveau fichier (pas d'ancienne version à ${ref}).${C.reset}\n`);
    }
    return { neuf: true };
  }

  const versionAvant = (ancien.frontmatter && ancien.frontmatter.version) || VERSION_DEFAUT;
  const versionApres = spec.version;
  const diff = detectBreaking(ancien, { frontmatter: spec.frontmatter, body: spec.body });
  const validation = (versionAvant === versionApres)
    ? { valid: false, raison: 'version inchangée malgré modifications', attendu: bumpVersion(versionAvant, diff.needsBumpKind) }
    : validerBump(versionAvant, versionApres, diff);

  if (options.json) {
    process.stdout.write(JSON.stringify({
      spec: spec.id, versionAvant, versionApres, diff, validation,
    }, null, 2) + '\n');
    return { versionAvant, versionApres, diff, validation };
  }

  logHeader(
    `AIAD SDD — Vérification version SPEC ${spec.id}`,
    `${versionAvant} → ${versionApres} (vs ${ref})`,
  );
  console.log(`  ${diff.breaking.length > 0 ? C.rouge : C.vert}● Breaking : ${diff.breaking.length}${C.reset}`);
  console.log(`  ${C.cyan}● Additions : ${diff.additions.length}${C.reset}`);
  if (diff.breaking.length > 0) {
    console.log('');
    for (const b of diff.breaking.slice(0, 10)) {
      console.log(`    ${C.rouge}-${C.reset} [${b.kind}] ${b.detail}`);
    }
  }
  console.log('');
  if (validation.valid) {
    console.log(`  ${C.vert}✓${C.reset} Version cohérente avec les changements (${diff.needsBumpKind} requis).\n`);
  } else {
    console.error(`  ${C.rouge}✗${C.reset} ${validation.raison}.${validation.attendu ? ` Attendu : ${validation.attendu}.` : ''}\n`);
  }
  return { versionAvant, versionApres, diff, validation };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  parseVersion as parseSemver,
  compareVersions as compareSemver,
  bumpVersion as bumpSemver,
  lireVersion as readVersion,
  chargerSpec as loadSpec,
  lireSpecAuCommit as readSpecAtCommit,
  extraireCriteres as extractCriteria,
  detectBreaking as detectBreakingChanges,
  validerBump as validateBump,
  bumpSpec as bumpSpecVersion,
  verifierVersion as verifyVersion,
};

export const CONSTANTS = {
  VERSION_DEFAUT,
};
