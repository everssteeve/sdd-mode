#!/usr/bin/env node
// AIAD SDD Mode — Vérification du seuil de couverture.
//
// Lance `node --test --experimental-test-coverage` et parse la sortie
// pour vérifier que la couverture branches reste ≥ seuil. Zero-dep — pas
// besoin de `c8` ni d'un autre outil. Le seuil par défaut (60 %) est
// volontairement conservateur ; on le relève au fil des itérations.
//
// Usage :
//   node scripts/coverage-threshold.js              # seuils défaut
//   node scripts/coverage-threshold.js --branches 80
//
// Documentation : https://aiad.ovh

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
function getArg(nom, defaut) {
  const i = args.indexOf(nom);
  if (i === -1) return defaut;
  return parseFloat(args[i + 1]);
}

// Seuils v1.14.0 (baseline mesurée : lines 80% / branches 75% / funcs 68%).
// Volontairement légèrement sous la baseline pour absorber les variations
// inter-version. À relever progressivement au fil des itérations.
const SEUILS = {
  lines: getArg('--lines', 75),
  branches: getArg('--branches', 70),
  funcs: getArg('--funcs', 65),
};

console.log(`Vérification couverture (seuils : lines ≥ ${SEUILS.lines}%, branches ≥ ${SEUILS.branches}%, funcs ≥ ${SEUILS.funcs}%)`);

const child = spawn('node', [
  '--test',
  '--experimental-test-coverage',
  '--test-reporter=spec',
  "--test-coverage-include=lib/**/*.js",
  // Glob simple expansé par le shell (shell:true) : compatible Node 18,
  // dont `node --test` n'expanse pas les globs (support ajouté en Node 21).
  // Tous les fichiers de tests sont à plat dans test/.
  'test/*.test.js',
], { cwd: ROOT, shell: true });

let stdout = '';
child.stdout.on('data', (chunk) => {
  stdout += chunk.toString();
  process.stdout.write(chunk);
});
child.stderr.on('data', (chunk) => process.stderr.write(chunk));

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`\n  ✗ Tests échoués — couverture non vérifiée.`);
    process.exit(code);
  }
  // Parse la ligne "all files | XX.XX | YY.YY | ZZ.ZZ".
  const allFiles = stdout.match(/all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
  if (!allFiles) {
    console.error('\n  ✗ Sortie de coverage non reconnue (rapport agrégé manquant).');
    process.exit(1);
  }
  const [, lines, branches, funcs] = allFiles.map((x) => parseFloat(x));
  console.log(`\n  Mesure : lines ${lines.toFixed(2)}% · branches ${branches.toFixed(2)}% · funcs ${funcs.toFixed(2)}%`);
  const echecs = [];
  if (lines < SEUILS.lines) echecs.push(`lines ${lines.toFixed(2)}% < ${SEUILS.lines}%`);
  if (branches < SEUILS.branches) echecs.push(`branches ${branches.toFixed(2)}% < ${SEUILS.branches}%`);
  if (funcs < SEUILS.funcs) echecs.push(`funcs ${funcs.toFixed(2)}% < ${SEUILS.funcs}%`);
  if (echecs.length) {
    console.error(`\n  ✗ Couverture insuffisante :`);
    for (const e of echecs) console.error(`    - ${e}`);
    process.exit(1);
  }
  console.log(`\n  ✓ Couverture conforme aux seuils.`);
});
