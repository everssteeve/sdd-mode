// Tests `scripts/mutation-batch.js` — fonctions pures de batch.
// Le runner complet n'est pas testé ici (ferait du mutation testing
// récursif sur ses propres tests, lent).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireConfig, agregerScores } from '../scripts/mutation-batch.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-mut-batch-')); }

// ─── lireConfig ─────────────────────────────────────────────────────────────

test('lireConfig — fichier absent → defaults (threshold 70, modules vide)', () => {
  const d = tmp();
  try {
    const c = lireConfig(d);
    assert.equal(c.threshold, 70);
    assert.deepEqual(c.modules, []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireConfig — JSON valide chargé', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, '.aiad-mutation.json'), JSON.stringify({
      threshold: 80,
      modules: [
        { source: 'lib/a.js', test: 'test/a.test.js' },
        { source: 'lib/b.js', test: 'test/b.test.js' },
      ],
    }));
    const c = lireConfig(d);
    assert.equal(c.threshold, 80);
    assert.equal(c.modules.length, 2);
    assert.equal(c.modules[0].source, 'lib/a.js');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireConfig — JSON invalide → defaults silent', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, '.aiad-mutation.json'), '{ corrupted');
    const c = lireConfig(d);
    assert.equal(c.threshold, 70);
    assert.deepEqual(c.modules, []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireConfig — modules non-array → []', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, '.aiad-mutation.json'), JSON.stringify({ modules: 'pas un tableau' }));
    const c = lireConfig(d);
    assert.deepEqual(c.modules, []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireConfig — threshold non-number → fallback 70', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, '.aiad-mutation.json'), JSON.stringify({ threshold: 'haut', modules: [] }));
    const c = lireConfig(d);
    assert.equal(c.threshold, 70);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── agregerScores ──────────────────────────────────────────────────────────

test('agregerScores — résultats vides → score 0', () => {
  const r = agregerScores([]);
  assert.deepEqual(r, { killed: 0, total: 0, score: 0 });
});

test('agregerScores — un seul module', () => {
  const r = agregerScores([{ killed: 14, total: 16 }]);
  assert.equal(r.killed, 14);
  assert.equal(r.total, 16);
  assert.equal(r.score, 87.5);
});

test('agregerScores — score pondéré (par mutations)', () => {
  // Module A : 10 mutations, 9 tuées (90%)
  // Module B : 100 mutations, 70 tuées (70%)
  // Pondéré : 79/110 = 71.8%
  const r = agregerScores([
    { killed: 9, total: 10 },
    { killed: 70, total: 100 },
  ]);
  assert.equal(r.killed, 79);
  assert.equal(r.total, 110);
  assert.ok(Math.abs(r.score - 71.818) < 0.01);
});

test('agregerScores — total 0 → score 0 (pas de division par zéro)', () => {
  const r = agregerScores([{ killed: 0, total: 0 }, { killed: 0, total: 0 }]);
  assert.equal(r.score, 0);
});

test('agregerScores — module skipped (total: 0) → exclu du calcul', () => {
  const r = agregerScores([
    { killed: 10, total: 10 }, // 100%
    { killed: 0, total: 0 },   // skipped
  ]);
  assert.equal(r.score, 100);
});

// ─── Configuration réelle .aiad-mutation.json ──────────────────────────────

test('Méta — .aiad-mutation.json existe et liste 5 modules clés', () => {
  const racine = join(__dirname, '..');
  const c = lireConfig(racine);
  assert.equal(c.modules.length, 5, `attendu 5 modules, vu ${c.modules.length}`);
  assert.ok(c.threshold >= 70, `seuil trop bas : ${c.threshold}`);
  // Chaque module doit avoir source + test valides
  for (const m of c.modules) {
    assert.equal(typeof m.source, 'string');
    assert.equal(typeof m.test, 'string');
    assert.ok(m.source.startsWith('lib/') || m.source.startsWith('scripts/'));
    assert.ok(m.test.startsWith('test/'));
  }
});

// Note : pas de test CLI ici — le batch réel mute des fichiers du projet
// pendant son exécution, ce qui interfère avec d'autres tests parallèles.
// La validation CLI se fait via le job CI dédié `mutation.yml` (nightly).
