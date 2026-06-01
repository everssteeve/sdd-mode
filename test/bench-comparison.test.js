// Tests `scripts/bench-comparison.js` — fonctions pures.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  statistiques,
  formatStat,
  genererTableauComparatif,
  genererDocument,
} from '../scripts/bench-comparison.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMPARISON_PATH = join(__dirname, '..', 'bench', 'comparison.md');

// ─── statistiques ───────────────────────────────────────────────────────────

test('statistiques — tableau vide → tout à zéro + runs=0', () => {
  const r = statistiques([]);
  assert.deepEqual(r, { min: 0, median: 0, p95: 0, max: 0, mean: 0, runs: 0 });
});

test('statistiques — un seul run', () => {
  const r = statistiques([42]);
  assert.equal(r.min, 42);
  assert.equal(r.median, 42);
  assert.equal(r.max, 42);
  assert.equal(r.mean, 42);
  assert.equal(r.runs, 1);
});

test('statistiques — N pair → médiane = moyenne des deux centraux', () => {
  // Trié : [1, 2, 3, 4] → médiane = (2+3)/2 = 2.5
  const r = statistiques([4, 1, 3, 2]);
  assert.equal(r.median, 2.5);
  assert.equal(r.min, 1);
  assert.equal(r.max, 4);
});

test('statistiques — N impair → médiane = élément central', () => {
  const r = statistiques([5, 1, 3, 2, 4]); // tri : [1,2,3,4,5]
  assert.equal(r.median, 3);
});

test('statistiques — p95 sur 10 runs', () => {
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = statistiques(data);
  // ceil(10 * 0.95) - 1 = 9 → element à l'index 9 = 10
  assert.equal(r.p95, 10);
});

test('statistiques — p95 sur 5 runs', () => {
  const data = [1, 2, 3, 4, 5];
  const r = statistiques(data);
  // ceil(5 * 0.95) - 1 = ceil(4.75) - 1 = 5 - 1 = 4 → element à l'index 4 = 5
  assert.equal(r.p95, 5);
});

test('statistiques — mean correct', () => {
  const r = statistiques([1, 2, 3, 4, 5]);
  assert.equal(r.mean, 3);
});

test('statistiques — input non-array → fallback zéros', () => {
  const r = statistiques(undefined);
  assert.equal(r.runs, 0);
});

test('statistiques — préserve l\'ordre par tri (immutable)', () => {
  const orig = [5, 1, 3];
  const copie = [...orig];
  statistiques(orig);
  assert.deepEqual(orig, copie, 'tableau original muté');
});

// ─── formatStat ─────────────────────────────────────────────────────────────

test('formatStat — produit min / median / p95 / max + runs', () => {
  const stat = { min: 1.0, median: 2.0, p95: 3.0, max: 4.0, mean: 2.5, runs: 5 };
  const r = formatStat(stat);
  assert.match(r, /1\.0 ms \/ 2\.0 ms \/ 3\.0 ms \/ 4\.0 ms \(5 runs\)/);
});

test('formatStat — suffix custom', () => {
  const stat = { min: 100, median: 200, p95: 300, max: 400, mean: 250, runs: 3 };
  assert.match(formatStat(stat, 's'), /100\.0 s/);
});

// ─── genererTableauComparatif ───────────────────────────────────────────────

test('genererTableauComparatif — entête + 4 lignes (cold/init/trace/doctor)', () => {
  const stat = { min: 1, median: 2, p95: 3, max: 4, mean: 2.5, runs: 5 };
  const r = genererTableauComparatif({
    coldStart: { stat },
    init: { stat },
    trace: { stat },
    doctor: { stat },
  });
  // Markdown table header
  assert.match(r, /\| Métrique \|/);
  assert.match(r, /\| AIAD SDD \(mesuré\) \|/);
  // 4 métriques
  assert.match(r, /Cold-start CLI/);
  assert.match(r, /Init projet/);
  assert.match(r, /Scan trace/);
  assert.match(r, /Doctor/);
  // Colonnes concurrents documentées
  assert.match(r, /Spec Kit \(documenté\)/);
  assert.match(r, /Kiro \(documenté\)/);
});

test('genererTableauComparatif — mesure absente → tiret', () => {
  const r = genererTableauComparatif({}); // aucune mesure
  // Toutes les cellules AIAD doivent être —
  const lignes = r.split('\n').filter((l) => l.startsWith('|') && !l.includes('---'));
  // Première ligne = en-tête, les suivantes contiennent —
  assert.ok(lignes.slice(1).every((l) => l.includes('—')));
});

// ─── genererDocument ────────────────────────────────────────────────────────

test('genererDocument — frontmatter Jekyll + sections principales', () => {
  const stat = { min: 1, median: 2, p95: 3, max: 4, mean: 2.5, runs: 5 };
  const doc = genererDocument(
    {
      coldStart: { stat }, init: { stat }, trace: { stat }, doctor: { stat },
    },
    { date: '2026-05-10', version: '1.14.0', node: 'v22.0.0', platform: 'darwin arm64' },
  );
  assert.match(doc, /^---\nlayout: default\ntitle: Benchmarks comparatifs\n---/);
  assert.match(doc, /AIAD SDD v1\.14\.0\*?\*? au 2026-05-10/);
  assert.match(doc, /Node v22\.0\.0/);
  assert.match(doc, /## Synthèse/);
  assert.match(doc, /## Caractéristiques différenciantes/);
  assert.match(doc, /## Méthodologie/);
  // Capacités différenciantes (contrôle de quelques lignes critiques)
  assert.match(doc, /Zero-dep runtime/);
  assert.match(doc, /Drift Lock pre-commit hook/);
  assert.match(doc, /Audit AI Act/);
  assert.match(doc, /SBOM CycloneDX/);
});

test('genererDocument — défauts sur date/version/node/platform', () => {
  const stat = { min: 1, median: 2, p95: 3, max: 4, mean: 2.5, runs: 1 };
  const doc = genererDocument({ coldStart: { stat } }, {});
  // Date par défaut = aujourd'hui (YYYY-MM-DD)
  assert.match(doc, /\d{4}-\d{2}-\d{2}/);
});

// ─── Document publié ────────────────────────────────────────────────────────

test('bench/comparison.md — fichier généré et présent', () => {
  assert.ok(existsSync(COMPARISON_PATH), 'bench/comparison.md absent — relance scripts/bench-comparison.js');
  const c = readFileSync(COMPARISON_PATH, 'utf-8');
  assert.match(c, /# Benchmarks comparatifs/);
  assert.match(c, /## Caractéristiques différenciantes/);
});
