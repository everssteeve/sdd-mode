#!/usr/bin/env node
// AIAD SDD Mode — Lint des claims chiffrés (empirisme enforced).
//
// Garde-fou anti-régression de SPEC-014-2 : tout claim chiffré qui pilote une
// décision doit rester sourcé, dérivé, ou assumé explicitement. Concrètement :
//   1. toute mention du seuil 50K (context rot) doit porter sa requalification
//      « heuristique de sobriété assumée » (FACT-001) — jamais un 50K nu ;
//   2. tout claim externe (−41,7 % R2Code / −96 % AWS Strands) doit citer sa
//      source datée dans le fichier où il apparaît.
//
// Zéro-dep — lecture de fichiers + regex. Exit 1 si une violation est trouvée.
//
// Usage : node scripts/lint-claims.js
// Documentation : https://aiad.ovh
//
// @intent INTENT-014
// @spec SPEC-014-2-sourcing-claims
// @verified-by test/lint-claims.test.js

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Fichiers où le seuil 50K est cité comme garde-fou de budget de contexte.
export const FICHIERS_50K = [
  '.claude/sdd/gate.md',
  '.claude/sdd/exec.md',
  '.claude/sdd/split.md',
  '.claude/skills/context-budget/SKILL.md',
];

// Claims externes : motif du chiffre + jeton de source attendu dans le fichier.
export const CLAIMS_EXTERNES = [
  { nom: '−41,7 % (R2Code)', chiffre: /41[.,]7\s*%/, source: /R2Code/ },
  { nom: '−96 % (AWS Strands)', chiffre: /96\s*%/, source: /Strands/ },
];

export const FICHIERS_CLAIMS = [
  'frameworkAIAD.md',
  'templates/frameworkAIAD.md',
  'templates/SDDMode.md',
  'docs/archive/SDDMode.md',
];

const RE_50K = /\b50\s?000\b|\b50\s?k\b/i;
const RE_QUALIF = /heuristique (de sobriété )?assumée/i;

// ─── Fonctions pures (exportées, testables) ──────────────────────────────────

// Une mention 50K est qualifiée si la ligne — ou la ligne suivante, pour absorber
// un retour à la ligne — porte la formulation « heuristique (de sobriété) assumée ».
export function mentions50KNonQualifiees(contenu) {
  const lignes = contenu.split('\n');
  const violations = [];
  for (let i = 0; i < lignes.length; i++) {
    if (!RE_50K.test(lignes[i])) continue;
    const contexte = lignes[i] + ' ' + (lignes[i + 1] || '');
    if (!RE_QUALIF.test(contexte)) violations.push({ ligne: i + 1, texte: lignes[i].trim() });
  }
  return violations;
}

// Un claim est non sourcé si son chiffre apparaît mais que le jeton de source
// est absent du fichier.
export function claimsNonSources(contenu, claims = CLAIMS_EXTERNES) {
  return claims
    .filter((c) => c.chiffre.test(contenu) && !c.source.test(contenu))
    .map((c) => c.nom);
}

// ─── Exécution principale (guardée) ──────────────────────────────────────────

function main() {
  const erreurs = [];

  for (const rel of FICHIERS_50K) {
    let contenu;
    try {
      contenu = readFileSync(join(ROOT, rel), 'utf8');
    } catch {
      continue; // fichier absent dans ce profil → non bloquant
    }
    for (const v of mentions50KNonQualifiees(contenu)) {
      erreurs.push(`${rel}:${v.ligne} — seuil 50K nu (sans requalification) : « ${v.texte} »`);
    }
  }

  for (const rel of FICHIERS_CLAIMS) {
    let contenu;
    try {
      contenu = readFileSync(join(ROOT, rel), 'utf8');
    } catch {
      continue;
    }
    for (const nom of claimsNonSources(contenu)) {
      erreurs.push(`${rel} — claim « ${nom} » présent sans sa source datée`);
    }
  }

  if (erreurs.length) {
    console.error('  ✗ Claims non sourcés / non requalifiés :');
    for (const e of erreurs) console.error(`    - ${e}`);
    process.exit(1);
  }
  console.log('  ✓ Claims chiffrés conformes (50K requalifié, sources externes présentes).');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
