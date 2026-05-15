#!/usr/bin/env node
// AIAD SDD Mode — Mutation testing batch sur les modules clés.
//
// Étend `scripts/mutation-test.js` (#62) en exécutant le mutation testing
// sur **plusieurs paires (source, test)** définies dans une config, et
// agrège les scores en un rapport unique. Bloque la CI si le score moyen
// passe sous le seuil global.
//
// **Pourquoi ne pas muter tout `lib/` ?**
//   - Coût : ~10 min × 30 modules = 5 h de CI, ingérable.
//   - Bruit : les modules d'I/O (init.js, update.js) génèrent du bruit
//     car les tests n'isolent pas tous les chemins.
//   - On cible donc 5 **modules cœur de logique** déjà bien testés.
//
// Configuration : `.aiad-mutation.json` à la racine, format :
// {
//   "threshold": 70,
//   "modules": [
//     { "source": "lib/suggest.js", "test": "test/suggest.test.js" },
//     ...
//   ]
// }
//
// Usage :
//   node scripts/mutation-batch.js              # mode normal
//   node scripts/mutation-batch.js --json       # rapport JSON
//   node scripts/mutation-batch.js --threshold 75
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { exit, argv } from 'node:process';
import { genererMutations, appliquerMutation } from './mutation-test.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RACINE = join(__dirname, '..');

// ─── Fonctions pures (testables) ────────────────────────────────────────────

/**
 * Charge la configuration `.aiad-mutation.json`.
 *
 * @param {string} racine
 * @returns {{ threshold: number, modules: { source: string, test: string }[] }}
 */
export function lireConfig(racine) {
  const path = join(racine, '.aiad-mutation.json');
  if (!existsSync(path)) {
    return { threshold: 70, modules: [] };
  }
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    return {
      threshold: typeof data.threshold === 'number' ? data.threshold : 70,
      modules: Array.isArray(data.modules) ? data.modules : [],
    };
  } catch {
    return { threshold: 70, modules: [] };
  }
}

/**
 * Calcule le score moyen pondéré (par nombre de mutations) sur un tableau
 * de résultats par module.
 *
 * @param {{ killed: number, total: number }[]} resultats
 * @returns {{ killed: number, total: number, score: number }}
 */
export function agregerScores(resultats) {
  let killed = 0, total = 0;
  for (const r of resultats) {
    killed += r.killed;
    total += r.total;
  }
  return {
    killed,
    total,
    score: total === 0 ? 0 : (killed / total) * 100,
  };
}

// ─── Runner ──────────────────────────────────────────────────────────────────

/**
 * Vérifie que la suite de tests passe **avant** mutation (sinon les
 * résultats sont biaisés — toutes mutations seront "tuées" pour de
 * mauvaises raisons).
 */
function preVerifTests(testPath) {
  const r = spawnSync('node', ['--test', testPath], { encoding: 'utf-8', cwd: RACINE });
  return r.status === 0;
}

/**
 * Exécute le mutation testing sur un module et retourne les stats.
 *
 * @param {{ source: string, test: string }} module
 * @returns {{ source: string, test: string, killed: number, survived: number, errored: number, total: number, score: number, survivors: object[] }}
 */
function muterModule({ source, test }) {
  const sourcePath = join(RACINE, source);
  const testPath = join(RACINE, test);
  if (!existsSync(sourcePath) || !existsSync(testPath)) {
    return { source, test, killed: 0, survived: 0, errored: 0, total: 0, score: 0, survivors: [], skipped: 'fichier absent' };
  }

  // Pré-vérification : la suite doit passer en l'état.
  if (!preVerifTests(testPath)) {
    return { source, test, killed: 0, survived: 0, errored: 0, total: 0, score: 0, survivors: [], skipped: 'tests cassés en pré-vérif' };
  }

  const original = readFileSync(sourcePath, 'utf-8');
  const mutations = genererMutations(original);

  let killed = 0, survived = 0, errored = 0;
  const survivors = [];

  for (const m of mutations) {
    const muted = appliquerMutation(original, m);
    writeFileSync(sourcePath, muted, 'utf-8');
    try {
      const r = spawnSync('node', ['--test', testPath], { encoding: 'utf-8', cwd: RACINE, timeout: 60000 });
      if (r.error) errored++;
      else if (r.status === 0) { survived++; survivors.push({ line: m.line, col: m.col, nom: m.nom }); }
      else killed++;
    } finally {
      writeFileSync(sourcePath, original, 'utf-8');
    }
  }

  const total = killed + survived;
  const score = total === 0 ? 0 : (killed / total) * 100;
  return { source, test, killed, survived, errored, total, score, survivors };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseFlags(args) {
  const out = { json: false, threshold: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') out.json = true;
    else if (args[i] === '--threshold') out.threshold = Number(args[++i]);
  }
  return out;
}

function main() {
  const flags = parseFlags(argv.slice(2));
  const config = lireConfig(RACINE);
  const threshold = flags.threshold ?? config.threshold;

  if (config.modules.length === 0) {
    console.error('  Aucun module à muter. Définis .aiad-mutation.json à la racine.');
    exit(1);
  }

  const debut = Date.now();
  if (!flags.json) {
    console.log(`\n  AIAD SDD — Mutation testing batch`);
    console.log(`  ${config.modules.length} modules × seuil ${threshold}%\n`);
  }

  const resultats = [];
  for (const mod of config.modules) {
    if (!flags.json) process.stdout.write(`  Mute ${mod.source}…`);
    const r = muterModule(mod);
    resultats.push(r);
    if (!flags.json) {
      if (r.skipped) console.log(` ${r.skipped}`);
      else console.log(` ${r.killed}/${r.total} tuées (${r.score.toFixed(1)}%)`);
    }
  }

  const aggregat = agregerScores(resultats);
  const dureeMs = Date.now() - debut;

  if (flags.json) {
    process.stdout.write(JSON.stringify({
      threshold,
      duration_ms: dureeMs,
      aggregate: aggregat,
      ok: aggregat.score >= threshold,
      modules: resultats,
    }, null, 2) + '\n');
    if (aggregat.score < threshold) exit(1);
    return;
  }

  console.log(`\n  Synthèse`);
  console.log(`    Modules testés    : ${resultats.length}`);
  console.log(`    Mutations totales : ${aggregat.total}`);
  console.log(`    Tuées             : ${aggregat.killed}`);
  console.log(`    Score moyen       : ${aggregat.score.toFixed(1)}%`);
  console.log(`    Seuil             : ${threshold}%`);
  console.log(`    Durée             : ${(dureeMs / 1000).toFixed(1)} s\n`);

  if (aggregat.score < threshold) {
    console.error(`  ✗ Score moyen ${aggregat.score.toFixed(1)}% < seuil ${threshold}%\n`);
    for (const r of resultats) {
      if (!r.skipped && r.score < threshold && r.survivors.length) {
        console.error(`  ${r.source} (${r.score.toFixed(1)}%) — survivantes :`);
        for (const s of r.survivors.slice(0, 5)) {
          console.error(`    L${s.line}:${s.col}  ${s.nom}`);
        }
      }
    }
    exit(1);
  }

  console.log(`  ✓ Score moyen ${aggregat.score.toFixed(1)}% ≥ seuil ${threshold}%\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
