// Tests `lib/trace-worker.js` + `scanCodeAsync` — scan parallèle Worker threads.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traiterChunk } from '../lib/trace-worker.js';
import { scanCode, scanCodeAsync } from '../lib/sdd-trace.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-worker-')); }

function fixture(d, n) {
  mkdirSync(join(d, 'src'), { recursive: true });
  for (let i = 0; i < n; i++) {
    const ann = i % 3 === 0
      ? `// @spec SPEC-${String(i).padStart(3, '0')}-1-feature\n`
      : '';
    writeFileSync(join(d, `src/f${i}.ts`), `${ann}export const v${i} = ${i};\n`);
  }
}

// ─── traiterChunk (fonction pure utilisée par les workers) ──────────────────

test('traiterChunk — chunk vide → entries vides + cacheUpdates vide', () => {
  const r = traiterChunk('/tmp', [], {});
  assert.deepEqual(r.entries, []);
  assert.deepEqual(r.cacheUpdates, {});
});

test('traiterChunk — parse les fichiers réels du chunk', () => {
  const d = tmp();
  try {
    fixture(d, 5);
    const chunk = ['src/f0.ts', 'src/f1.ts', 'src/f2.ts'];
    const r = traiterChunk(d, chunk, {});
    assert.equal(r.entries.length, 3);
    // f0 (i % 3 === 0) → annoté
    const f0 = r.entries.find((e) => e.path === 'src/f0.ts');
    assert.equal(f0.annotated, true);
    // f1 → non annoté
    const f1 = r.entries.find((e) => e.path === 'src/f1.ts');
    assert.equal(f1.annotated, false);
    // cacheUpdates contient une entrée par fichier
    assert.equal(Object.keys(r.cacheUpdates).length, 3);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('traiterChunk — réutilise l\'entrée cache fraîche (mtime + size match)', () => {
  const d = tmp();
  try {
    fixture(d, 3);
    const chunk = ['src/f0.ts'];
    // Premier passage : remplit le cache implicite via traiterChunk
    const r1 = traiterChunk(d, chunk, {});
    const cacheEntry = r1.cacheUpdates['src/f0.ts'];
    // Deuxième passage avec ce cache → entry doit être réutilisée
    const r2 = traiterChunk(d, chunk, { 'src/f0.ts': cacheEntry });
    assert.equal(r2.entries[0].annotated, r1.entries[0].annotated);
    // Les deux annotations doivent être identiques structurellement
    assert.deepEqual(r2.entries[0].annotations, r1.entries[0].annotations);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('traiterChunk — fichier inexistant → ignoré silencieusement', () => {
  const d = tmp();
  try {
    fixture(d, 1);
    const chunk = ['src/f0.ts', 'src/inexistant.ts'];
    const r = traiterChunk(d, chunk, {});
    assert.equal(r.entries.length, 1, 'fichier inexistant non ignoré');
    assert.equal(r.entries[0].path, 'src/f0.ts');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('traiterChunk — invalide cache si mtime change', () => {
  const d = tmp();
  try {
    fixture(d, 2);
    const chunk = ['src/f0.ts'];
    const cacheBidon = {
      'src/f0.ts': {
        mtimeMs: 0, size: 0, // valeurs impossibles → cache invalide
        isTest: false, annotated: false, annotations: { intents: [], specs: [], verifiedBy: [], governance: [] },
      },
    };
    const r = traiterChunk(d, chunk, cacheBidon);
    // f0 (i=0, ann %3=0) → re-parsé, doit être annoté
    assert.equal(r.entries[0].annotated, true, 'cache obsolète aurait dû être invalidé');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── scanCodeAsync ──────────────────────────────────────────────────────────

test('scanCodeAsync — sous le seuil → équivalent à scanCode synchrone', async () => {
  const d = tmp();
  try {
    fixture(d, 10);
    const sync = scanCode(d, { useCache: false });
    rmSync(join(d, '.aiad'), { recursive: true, force: true }); // nettoyer pour comparaison
    const async_ = await scanCodeAsync(d, { parallelThreshold: 100, useCache: false });
    assert.equal(async_.length, sync.length);
    // Comparer sur les paths triés
    const ps = sync.map((e) => e.path).sort();
    const pa = async_.map((e) => e.path).sort();
    assert.deepEqual(pa, ps);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('scanCodeAsync — au-dessus du seuil → utilise les Workers', async () => {
  const d = tmp();
  try {
    // 30 fichiers, seuil bas pour déclencher le parallélisme.
    fixture(d, 30);
    const r = await scanCodeAsync(d, { parallelThreshold: 5, maxWorkers: 4, useCache: false });
    assert.ok(r.length >= 30);
    // Vérifie qu'au moins quelques entrées sont annotées (≈10 sur 30)
    const annotes = r.filter((e) => e.annotated).length;
    assert.ok(annotes > 0, 'aucune annotation détectée par les workers');
    // Pas de doublons (la fusion des chunks ne doit pas dupliquer)
    const paths = new Set(r.map((e) => e.path));
    assert.equal(paths.size, r.length, 'doublons après fusion des chunks');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('scanCodeAsync — résultat équivalent au mode synchrone (au-dessus du seuil)', async () => {
  const d1 = tmp();
  const d2 = tmp();
  try {
    fixture(d1, 25);
    fixture(d2, 25);
    const sync = scanCode(d1, { useCache: false });
    const async_ = await scanCodeAsync(d2, { parallelThreshold: 5, maxWorkers: 4, useCache: false });
    assert.equal(async_.length, sync.length);
    // Trie + compare les annotations
    const sortByPath = (a, b) => a.path.localeCompare(b.path);
    const s = [...sync].sort(sortByPath);
    const a = [...async_].sort(sortByPath);
    for (let i = 0; i < s.length; i++) {
      assert.equal(a[i].path, s[i].path);
      assert.equal(a[i].annotated, s[i].annotated);
      assert.deepEqual(a[i].annotations, s[i].annotations);
    }
  } finally {
    rmSync(d1, { recursive: true, force: true });
    rmSync(d2, { recursive: true, force: true });
  }
});

test('scanCodeAsync — maxWorkers: 1 force le mode séquentiel', async () => {
  const d = tmp();
  try {
    fixture(d, 30);
    const r = await scanCodeAsync(d, { parallelThreshold: 1, maxWorkers: 1, useCache: false });
    assert.equal(r.length, 30);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('scanCodeAsync — réécrit le cache via fusion des cacheUpdates', async () => {
  const d = tmp();
  try {
    fixture(d, 20);
    await scanCodeAsync(d, { parallelThreshold: 5, maxWorkers: 3 });
    assert.ok(existsSync(join(d, '.aiad/.cache/trace.json')));
  } finally { rmSync(d, { recursive: true, force: true }); }
});
