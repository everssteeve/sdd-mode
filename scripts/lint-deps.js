#!/usr/bin/env node
// AIAD SDD Mode — Garde-fou zero-dep runtime.
//
// Le projet aiad-sdd vise un **cap stratégique** : zero dépendance runtime
// (uniquement `node:*` natif). Cette règle est ce qui rend `npx aiad-sdd` :
//   - rapide (aucun arbre de deps à installer),
//   - reproductible (pas de problème de versions transitives),
//   - sûr (surface d'attaque supply-chain minimale),
//   - léger (~250 ko tarball au lieu de plusieurs Mo).
//
// Ce script vérifie que `package.json#dependencies` reste **vide** et que
// `peerDependencies` ne contient rien de runtime obligatoire. devDependencies
// sont autorisés (mais surveillés via leur taille — voir #68).
//
// Si une dépendance runtime est introduite par erreur (typiquement par un
// `npm install foo` mal placé), ce script lève une erreur claire et bloque
// le `prepublishOnly` + la CI.
//
// Usage : node scripts/lint-deps.js
// Hook  : npm run lint:deps
//
// Documentation : https://aiad.ovh

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exit } from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RACINE = join(__dirname, '..');

// ─── Fonctions pures (testables) ────────────────────────────────────────────

/**
 * Évalue la conformité zero-dep d'un package.json donné.
 *
 * @param {object} pkg
 * @returns {{ ok: boolean, runtimeDeps: string[], peerDeps: string[], optionalDeps: string[], bundledDeps: string[] }}
 */
export function evaluerZeroDep(pkg) {
  const runtimeDeps = Object.keys(pkg.dependencies || {});
  const peerDeps = Object.keys(pkg.peerDependencies || {});
  const optionalDeps = Object.keys(pkg.optionalDependencies || {});
  const bundledDeps = Array.isArray(pkg.bundledDependencies) ? pkg.bundledDependencies
    : Array.isArray(pkg.bundleDependencies) ? pkg.bundleDependencies : [];

  // Cap : runtimeDeps + bundledDeps doivent être vides.
  // Les peerDependencies et optionalDependencies sont autorisées si elles
  // sont **explicitement** marquées optionnelles (peerDependenciesMeta),
  // mais pour simplifier on les interdit aussi par défaut.
  const ok =
    runtimeDeps.length === 0 &&
    bundledDeps.length === 0 &&
    peerDeps.length === 0 &&
    optionalDeps.length === 0;

  return { ok, runtimeDeps, peerDeps, optionalDeps, bundledDeps };
}

/**
 * Construit le rapport humain (multi-lignes) à partir d'une évaluation.
 */
export function formatRapport(eval_) {
  if (eval_.ok) return '✓ Zero-dep runtime préservé.';
  const lignes = ['✗ Cap zero-dep runtime VIOLÉ :'];
  if (eval_.runtimeDeps.length) {
    lignes.push(`  - dependencies (runtime) : ${eval_.runtimeDeps.join(', ')}`);
  }
  if (eval_.peerDeps.length) {
    lignes.push(`  - peerDependencies        : ${eval_.peerDeps.join(', ')}`);
  }
  if (eval_.optionalDeps.length) {
    lignes.push(`  - optionalDependencies    : ${eval_.optionalDeps.join(', ')}`);
  }
  if (eval_.bundledDeps.length) {
    lignes.push(`  - bundledDependencies     : ${eval_.bundledDeps.join(', ')}`);
  }
  lignes.push('');
  lignes.push('  Le projet aiad-sdd vise un cap zero-dep runtime — uniquement `node:*` natif.');
  lignes.push('  Si tu as réellement besoin d\'une dep, justifie l\'écart dans le PR et obtiens');
  lignes.push('  un accord du mainteneur AVANT de committer.');
  return lignes.join('\n');
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const pkgPath = join(RACINE, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const evalResult = evaluerZeroDep(pkg);
  const rapport = formatRapport(evalResult);

  if (evalResult.ok) {
    console.log(`  ${rapport}`);
    exit(0);
  } else {
    console.error(`\n${rapport}\n`);
    exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
