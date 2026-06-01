#!/usr/bin/env node
// AIAD SDD Mode — Bench performance `sdd-trace` sur projets synthétiques.
//
// Génère un repo de N fichiers code (~30 % annotés `@spec`), exécute
// `construireMatrice` plusieurs fois, et imprime les statistiques (médiane,
// p95, max). Permet de mesurer la performance sur monorepos sans avoir
// besoin d'un vrai repo de 100k fichiers.
//
// Usage :
//   node scripts/bench-trace.js              # défaut 5000 fichiers, 5 runs
//   node scripts/bench-trace.js --files 50000 --runs 3
//   node scripts/bench-trace.js --files 100000 --runs 1
//
// Documentation : https://aiad.ovh

import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { construireMatrice } from '../lib/sdd-trace.js';

function getArg(name, defaut) {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return defaut;
  return parseInt(process.argv[idx + 1], 10);
}

const NB_FICHIERS = getArg('--files', 5000);
const NB_RUNS = getArg('--runs', 5);

console.log(`Bench trace : ${NB_FICHIERS} fichiers code, ${NB_RUNS} runs.\n`);

// 1. Génération du projet synthétique
const t0 = performance.now();
const dir = mkdtempSync(join(tmpdir(), 'aiad-bench-'));
mkdirSync(join(dir, '.aiad', 'intents'), { recursive: true });
mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
mkdirSync(join(dir, 'src'), { recursive: true });

writeFileSync(join(dir, '.aiad', 'intents', 'INTENT-001.md'),
  '---\nstatus: active\n---\n# Bench\n');
writeFileSync(join(dir, '.aiad', 'specs', 'SPEC-001-1-bench.md'),
  '---\nparent_intent: INTENT-001\nstatus: ready\n---\n# Bench\n');

// Distribue dans 100 sous-dossiers pour ne pas exploser readdir
const PAR_DOSSIER = 100;
const NB_DOSSIERS = Math.ceil(NB_FICHIERS / PAR_DOSSIER);
let totalCrees = 0;
for (let i = 0; i < NB_DOSSIERS; i++) {
  const sub = join(dir, 'src', `pkg${i}`);
  mkdirSync(sub, { recursive: true });
  for (let j = 0; j < PAR_DOSSIER && totalCrees < NB_FICHIERS; j++) {
    const annoter = totalCrees % 3 === 0; // ~33 % annotés
    const contenu = annoter
      ? `// @spec SPEC-001-1-bench\nexport function f${totalCrees}() {}\n`
      : `export function f${totalCrees}() {}\n`;
    writeFileSync(join(sub, `f${j}.ts`), contenu);
    totalCrees++;
  }
}

const tGen = performance.now() - t0;
console.log(`Génération projet (${totalCrees} fichiers) : ${tGen.toFixed(0)} ms\n`);

// 2. Runs de bench
try {
  const durees = [];
  for (let i = 0; i < NB_RUNS; i++) {
    const t1 = performance.now();
    const m = construireMatrice(dir);
    const dt = performance.now() - t1;
    durees.push(dt);
    console.log(`  Run ${i + 1}/${NB_RUNS} : ${dt.toFixed(0)} ms — ${m.summary.codeFiles} fichiers, ${m.summary.annotatedCodeFiles} annotés`);
  }

  // Stats
  durees.sort((a, b) => a - b);
  const median = durees[Math.floor(durees.length / 2)];
  const p95 = durees[Math.min(durees.length - 1, Math.floor(durees.length * 0.95))];
  const max = durees[durees.length - 1];
  const min = durees[0];

  console.log(`\nStatistiques (ms) :`);
  console.log(`  min    : ${min.toFixed(0)}`);
  console.log(`  median : ${median.toFixed(0)}`);
  console.log(`  p95    : ${p95.toFixed(0)}`);
  console.log(`  max    : ${max.toFixed(0)}`);

  // Verdict cible : < 10 s pour 100k fichiers (item #43 backlog)
  const facteur = 100000 / NB_FICHIERS;
  const projectionMax100k = max * facteur;
  console.log(`\nProjection 100k fichiers (extrapolation linéaire max × ${facteur.toFixed(1)}) : ${(projectionMax100k / 1000).toFixed(1)} s`);
  if (projectionMax100k <= 10000) {
    console.log(`✓ Cible <10 s pour 100k fichiers tenue.`);
  } else {
    console.log(`✗ Au-delà de la cible 10 s pour 100k fichiers — paralléliser via Worker recommandé.`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
