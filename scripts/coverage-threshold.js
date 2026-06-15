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
//   node scripts/coverage-threshold.js --badge .aiad/metrics/coverage/badge.json
//
// Documentation : https://aiad.ovh
//
// @intent INTENT-014
// @spec SPEC-014-1-gates-bloquants-badge
// @verified-by test/coverage-threshold.test.js

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ─── Fonctions pures (exportées, testables sans spawn) ───────────────────────

// Palette shields.io standard, dérivée de la couverture lignes.
export function badgeColor(pct) {
  if (pct >= 90) return 'brightgreen';
  if (pct >= 80) return 'green';
  if (pct >= 70) return 'yellowgreen';
  if (pct >= 60) return 'yellow';
  if (pct >= 50) return 'orange';
  return 'red';
}

// Construit l'objet badge au format « endpoint » shields.io. Zéro-dep, committé,
// rendu par img.shields.io sans dépendance runtime ni action tierce (RGESN).
export function buildBadge(lines) {
  return {
    schemaVersion: 1,
    label: 'coverage',
    message: `${Math.floor(lines)}%`,
    color: badgeColor(lines),
  };
}

// Parse la ligne agrégée "all files | XX.XX | YY.YY | ZZ.ZZ". Renvoie null si
// le rapport agrégé est absent (sortie non reconnue).
export function parseCoverage(stdout) {
  const m = stdout.match(/all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
  if (!m) return null;
  const [, lines, branches, funcs] = m.map((x) => parseFloat(x));
  return { lines, branches, funcs };
}

// Liste des seuils non respectés (tableau de chaînes lisibles, vide si conforme).
export function echecsSeuils({ lines, branches, funcs }, seuils) {
  const echecs = [];
  if (lines < seuils.lines) echecs.push(`lines ${lines.toFixed(2)}% < ${seuils.lines}%`);
  if (branches < seuils.branches) echecs.push(`branches ${branches.toFixed(2)}% < ${seuils.branches}%`);
  if (funcs < seuils.funcs) echecs.push(`funcs ${funcs.toFixed(2)}% < ${seuils.funcs}%`);
  return echecs;
}

function writeBadge(badgePath, lines) {
  const badge = buildBadge(lines);
  const dest = join(ROOT, badgePath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, `${JSON.stringify(badge, null, 2)}\n`);
  console.log(`  Badge écrit : ${badgePath} (${badge.message}, ${badge.color})`);
}

// ─── Exécution principale (guardée : aucun spawn à l'import) ──────────────────

function main() {
  const args = process.argv.slice(2);
  const getArg = (nom, defaut) => {
    const i = args.indexOf(nom);
    return i === -1 ? defaut : parseFloat(args[i + 1]);
  };
  const badgePath = (() => {
    const i = args.indexOf('--badge');
    if (i === -1) return null;
    return args[i + 1] || '.aiad/metrics/coverage/badge.json';
  })();

  // Seuils v1.14.0 (baseline mesurée : lines 80% / branches 75% / funcs 68%).
  // Volontairement légèrement sous la baseline pour absorber les variations
  // inter-version. À relever progressivement au fil des itérations.
  const seuils = {
    lines: getArg('--lines', 75),
    branches: getArg('--branches', 70),
    funcs: getArg('--funcs', 65),
  };

  console.log(`Vérification couverture (seuils : lines ≥ ${seuils.lines}%, branches ≥ ${seuils.branches}%, funcs ≥ ${seuils.funcs}%)`);

  const child = spawn('node', [
    '--test',
    '--experimental-test-coverage',
    '--test-reporter=spec',
    '--test-coverage-include=lib/**/*.js',
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
    const cov = parseCoverage(stdout);
    if (!cov) {
      console.error('\n  ✗ Sortie de coverage non reconnue (rapport agrégé manquant).');
      process.exit(1);
    }
    console.log(`\n  Mesure : lines ${cov.lines.toFixed(2)}% · branches ${cov.branches.toFixed(2)}% · funcs ${cov.funcs.toFixed(2)}%`);
    if (badgePath) writeBadge(badgePath, cov.lines);
    const echecs = echecsSeuils(cov, seuils);
    if (echecs.length) {
      console.error(`\n  ✗ Couverture insuffisante :`);
      for (const e of echecs) console.error(`    - ${e}`);
      process.exit(1);
    }
    console.log(`\n  ✓ Couverture conforme aux seuils.`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
