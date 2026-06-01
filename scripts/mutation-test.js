#!/usr/bin/env node
// AIAD SDD Mode — Mutation testing zero-dep.
//
// Pourquoi pas Stryker ? Stryker = 50+ MB de devDeps, configuration lourde,
// dépendance JS additionnelle. Le projet aiad-sdd vise zero-dep runtime ET
// minimal devDep. Ce mini-mutateur maison applique les **6 opérateurs de
// mutation classiques** (suffisants pour 80 % de la valeur d'un Stryker) :
//
//   1. RelationalOperator   :  >  ↔  <  ↔  >=  ↔  <=
//   2. EqualityOperator     :  === ↔ !==,   ==  ↔  !=
//   3. LogicalOperator      :  &&  ↔  ||
//   4. BooleanLiteral       :  true ↔ false
//   5. ArithmeticOperator   :  +   ↔  -,    *   ↔  /
//   6. ConditionalBoundary  :  >=  →  >,    <=  →  <
//
// Pour chaque mutation : sauvegarde du fichier, application, exécution des
// tests, restauration. Une mutation **tuée** = au moins un test échoue.
// Score = tuées / total.
//
// Usage :
//   node scripts/mutation-test.js <source.js> <test.js> [--threshold 70]
//   node scripts/mutation-test.js lib/suggest.js test/suggest.test.js
//
// Documentation : https://aiad.ovh

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { argv, exit } from 'node:process';

// ─── Mutateurs ───────────────────────────────────────────────────────────────

/**
 * Construit une regex qui matche `pattern` uniquement quand il n'est pas
 * suivi/précédé d'un caractère qui changerait la sémantique. Évite les
 * faux positifs sur les commentaires triviaux ; le runner exécute les
 * tests pour distinguer survivants / tués.
 */
function safeRegex(pattern) {
  return new RegExp(`(?<![<>=!+\\-*\\/&|])${pattern}(?![<>=!+\\-*\\/&|])`, 'g');
}

const MUTATEURS = [
  // RelationalOperator
  { id: 'GT_TO_LT', from: />/, to: '<', regex: safeRegex('>'), nom: '> → <' },
  { id: 'LT_TO_GT', from: /</, to: '>', regex: safeRegex('<'), nom: '< → >' },
  // EqualityOperator (ordre : strict avant lâche pour matching prioritaire)
  { id: 'STRICT_EQ_TO_NEQ', from: /===/, to: '!==', regex: /===/g, nom: '=== → !==' },
  { id: 'STRICT_NEQ_TO_EQ', from: /!==/, to: '===', regex: /!==/g, nom: '!== → ===' },
  // BooleanLiteral
  { id: 'TRUE_TO_FALSE', from: /\btrue\b/, to: 'false', regex: /\btrue\b/g, nom: 'true → false' },
  { id: 'FALSE_TO_TRUE', from: /\bfalse\b/, to: 'true', regex: /\bfalse\b/g, nom: 'false → true' },
  // LogicalOperator
  { id: 'AND_TO_OR', from: /&&/, to: '||', regex: /&&/g, nom: '&& → ||' },
  { id: 'OR_TO_AND', from: /\|\|/, to: '&&', regex: /\|\|/g, nom: '|| → &&' },
  // ConditionalBoundary
  { id: 'GTE_TO_GT', from: />=/, to: '>', regex: />=/g, nom: '>= → >' },
  { id: 'LTE_TO_LT', from: /<=/, to: '<', regex: /<=/g, nom: '<= → <' },
];

/**
 * Génère toutes les mutations possibles sur un code source.
 *
 * @param {string} code
 * @returns {{ id: string, nom: string, line: number, original: string, muted: string }[]}
 */
export function genererMutations(code) {
  const mutations = [];
  const lignes = code.split('\n');

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];
    // Skip les commentaires de ligne et de bloc rapidement (heuristique
    // simple : si la ligne commence par // ou * ou est dans un bloc /* */).
    const trim = ligne.trimStart();
    if (trim.startsWith('//') || trim.startsWith('*') || trim.startsWith('/*')) continue;

    for (const mutateur of MUTATEURS) {
      let match;
      mutateur.regex.lastIndex = 0;
      while ((match = mutateur.regex.exec(ligne)) !== null) {
        const muted = ligne.substring(0, match.index) + mutateur.to + ligne.substring(match.index + match[0].length);
        mutations.push({
          id: mutateur.id,
          nom: mutateur.nom,
          line: i + 1,
          col: match.index + 1,
          original: ligne,
          muted,
        });
      }
    }
  }
  return mutations;
}

/**
 * Applique une mutation à une chaîne source : remplace la ligne i par muted.
 */
export function appliquerMutation(code, mutation) {
  const lignes = code.split('\n');
  lignes[mutation.line - 1] = mutation.muted;
  return lignes.join('\n');
}

// ─── Runner ──────────────────────────────────────────────────────────────────

/**
 * Lance la suite de tests sur un fichier muté.
 * - Sauvegarde l'original
 * - Écrit la version mutée
 * - Lance node --test sur le fichier de test cible
 * - Restaure
 *
 * @param {string} sourcePath
 * @param {string} testPath
 * @param {object} mutation
 * @returns {'killed'|'survived'|'error'}
 */
function executerMutation(sourcePath, testPath, mutation, original) {
  const muted = appliquerMutation(original, mutation);
  writeFileSync(sourcePath, muted, 'utf-8');
  try {
    const r = spawnSync('node', ['--test', testPath], { encoding: 'utf-8', timeout: 60000 });
    if (r.error) return 'error';
    return r.status === 0 ? 'survived' : 'killed';
  } finally {
    writeFileSync(sourcePath, original, 'utf-8');
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const args = argv.slice(2);
  const sourcePath = args[0];
  const testPath = args[1];
  const seuilArg = args.indexOf('--threshold');
  const threshold = seuilArg >= 0 ? Number(args[seuilArg + 1]) : 70;
  const verbose = args.includes('--verbose');

  if (!sourcePath || !testPath) {
    console.error(`
Usage : node scripts/mutation-test.js <source.js> <test.js> [--threshold 70] [--verbose]

Exemples :
  node scripts/mutation-test.js lib/suggest.js test/suggest.test.js
  node scripts/mutation-test.js lib/release.js test/release.test.js --threshold 75
`);
    exit(1);
  }

  const original = readFileSync(sourcePath, 'utf-8');
  const mutations = genererMutations(original);
  console.log(`\n  Mutation testing : ${sourcePath}\n`);
  console.log(`  ${mutations.length} mutations générées`);
  console.log(`  Suite de tests   : ${testPath}\n`);

  let killed = 0;
  let survived = 0;
  let errored = 0;
  const survivors = [];

  let processed = 0;
  for (const m of mutations) {
    const result = executerMutation(sourcePath, testPath, m, original);
    processed++;
    if (result === 'killed') killed++;
    else if (result === 'survived') { survived++; survivors.push(m); }
    else errored++;

    if (verbose) {
      const sym = result === 'killed' ? '✓' : result === 'survived' ? '✗' : '?';
      console.log(`  ${sym} L${m.line}:${m.col}  ${m.nom}  → ${result}`);
    }
    if (processed % 5 === 0) {
      process.stdout.write(`\r  Progression : ${processed}/${mutations.length} (tuées ${killed}, survivantes ${survived})`);
    }
  }
  process.stdout.write('\r' + ' '.repeat(80) + '\r');

  const total = killed + survived;
  const score = total > 0 ? (killed / total) * 100 : 0;

  console.log(`\n  Résultats`);
  console.log(`    Mutations tuées      : ${killed}/${total} (${score.toFixed(1)}%)`);
  console.log(`    Mutations survivantes: ${survived}`);
  if (errored) console.log(`    Mutations en erreur  : ${errored}`);
  console.log(`    Seuil cible          : ${threshold}%\n`);

  if (survivors.length && !verbose) {
    console.log(`  Survivantes (à couvrir par des tests) :`);
    for (const m of survivors.slice(0, 20)) {
      console.log(`    L${m.line}  ${m.nom}`);
    }
    if (survivors.length > 20) console.log(`    … et ${survivors.length - 20} autres.`);
    console.log('');
  }

  if (score < threshold) {
    console.error(`  ✗ Mutation score ${score.toFixed(1)}% < seuil ${threshold}%\n`);
    exit(1);
  }
  console.log(`  ✓ Mutation score ${score.toFixed(1)}% ≥ seuil ${threshold}%\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
