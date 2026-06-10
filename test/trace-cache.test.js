// Tests `lib/trace-cache.js` + intégration `scanCode` cache incrémental.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync,
  utimesSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  cacheKey,
  readCache,
  writeCache,
  isFresh,
  loadCache,
  saveCache,
} from '../lib/trace-cache.js';
import { scanCode } from '../lib/sdd-trace.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-cache-')); }

// ─── cacheKey + isFresh ─────────────────────────────────────────────────────

test('cacheKey — combine mtime et size', () => {
  assert.equal(cacheKey({ mtimeMs: 100, size: 50 }), '100:50');
  assert.equal(cacheKey({ mtimeMs: 1.5, size: 0 }), '1.5:0');
});

test('isFresh — entry absente → false', () => {
  assert.equal(isFresh(undefined, { mtimeMs: 1, size: 1 }), false);
  assert.equal(isFresh(null, { mtimeMs: 1, size: 1 }), false);
});

test('isFresh — mtime + size identiques → true', () => {
  assert.equal(isFresh({ mtimeMs: 100, size: 50 }, { mtimeMs: 100, size: 50 }), true);
});

test('isFresh — mtime différent → false', () => {
  assert.equal(isFresh({ mtimeMs: 100, size: 50 }, { mtimeMs: 101, size: 50 }), false);
});

test('isFresh — size différent → false (même mtime)', () => {
  assert.equal(isFresh({ mtimeMs: 100, size: 50 }, { mtimeMs: 100, size: 51 }), false);
});

// ─── readCache + writeCache ─────────────────────────────────────────────────

test('readCache — fichier absent → cache vide structuré', () => {
  const d = tmp();
  try {
    const c = readCache(d);
    assert.equal(c.version, 2);
    assert.deepEqual(c.files, {});
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('readCache — JSON corrompu → fallback cache vide', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/.cache'), { recursive: true });
    writeFileSync(join(d, '.aiad/.cache/trace.json'), '{ corrupted');
    const c = readCache(d);
    assert.deepEqual(c.files, {});
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('readCache — version différente → cache ignoré', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/.cache'), { recursive: true });
    writeFileSync(join(d, '.aiad/.cache/trace.json'), JSON.stringify({
      version: 999,
      files: { 'a.ts': { mtimeMs: 1, size: 1 } },
    }));
    const c = readCache(d);
    assert.deepEqual(c.files, {});
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('writeCache — crée .aiad/.cache/ et persiste version + files', () => {
  const d = tmp();
  try {
    writeCache(d, {
      files: { 'src/a.ts': { mtimeMs: 100, size: 50, isTest: false, annotated: true, annotations: { intents: [], specs: [{ id: 'SPEC-001-1-x', line: 1 }], verifiedBy: [], governance: [] } } },
    });
    const path = join(d, '.aiad/.cache/trace.json');
    assert.ok(existsSync(path));
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    assert.equal(data.version, 2);
    assert.ok(data.files['src/a.ts']);
    assert.equal(data.files['src/a.ts'].mtimeMs, 100);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('writeCache — silent fail sur erreur (pas d\'exception levée)', () => {
  // Argument racine=null → join lèverait → writeCache doit catcher.
  assert.doesNotThrow(() => writeCache('/dev/null/inexistant-impossible-' + Math.random(), { files: {} }));
});

test('alias EN — loadCache / saveCache exportés', () => {
  assert.equal(loadCache, readCache);
  assert.equal(saveCache, writeCache);
});

// ─── Intégration scanCode + cache ───────────────────────────────────────────

function fixtureProjet(d) {
  mkdirSync(join(d, 'src'), { recursive: true });
  writeFileSync(join(d, 'src/a.ts'), '// @intent INTENT-001\n// @spec SPEC-001-1-foo\nexport const x = 1;\n');
  writeFileSync(join(d, 'src/b.ts'), '// @spec SPEC-001-1-foo\nexport const y = 2;\n');
  writeFileSync(join(d, 'src/c.ts'), 'export const z = 3;\n'); // sans annotation
}

test('scanCode — premier run (cache MISS) crée le fichier cache', () => {
  const d = tmp();
  try {
    fixtureProjet(d);
    assert.ok(!existsSync(join(d, '.aiad/.cache/trace.json')));
    const r = scanCode(d);
    assert.ok(r.length >= 3);
    assert.ok(existsSync(join(d, '.aiad/.cache/trace.json')));
    const cache = JSON.parse(readFileSync(join(d, '.aiad/.cache/trace.json'), 'utf-8'));
    assert.ok(cache.files['src/a.ts']);
    assert.ok(cache.files['src/a.ts'].annotated);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('scanCode — second run (cache HIT) produit le même résultat', () => {
  const d = tmp();
  try {
    fixtureProjet(d);
    const r1 = scanCode(d);
    const r2 = scanCode(d);
    assert.equal(r2.length, r1.length);
    // Annotations préservées via cache
    const a1 = r1.find((f) => f.path === 'src/a.ts');
    const a2 = r2.find((f) => f.path === 'src/a.ts');
    assert.equal(a1.annotated, a2.annotated);
    assert.equal(a1.annotations.specs[0].id, a2.annotations.specs[0].id);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('scanCode — invalidation du cache si mtime change', () => {
  const d = tmp();
  try {
    fixtureProjet(d);
    scanCode(d); // remplit le cache
    // Modifier a.ts → nouvelle annotation
    writeFileSync(join(d, 'src/a.ts'), '// @spec SPEC-002-1-bar\nexport const x = 99;\n');
    const r = scanCode(d);
    const a = r.find((f) => f.path === 'src/a.ts');
    assert.equal(a.annotations.specs[0].id, 'SPEC-002-1-bar', `attendu spec mise à jour, vu ${JSON.stringify(a.annotations.specs)}`);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('scanCode — useCache: false ignore le cache', () => {
  const d = tmp();
  try {
    fixtureProjet(d);
    scanCode(d); // remplit le cache
    // Corrompons le cache pour vérifier qu'il est ignoré
    writeFileSync(join(d, '.aiad/.cache/trace.json'), JSON.stringify({
      version: 1,
      files: {
        'src/a.ts': { mtimeMs: 9e9, size: 9e9, isTest: false, annotated: false, annotations: { intents: [], specs: [], verifiedBy: [], governance: [] } },
      },
    }));
    // Avec useCache: false, on doit re-parser → annotation vraie revient
    const r = scanCode(d, { useCache: false });
    const a = r.find((f) => f.path === 'src/a.ts');
    assert.equal(a.annotated, true, 'fichier devrait être annoté (cache ignoré)');
    assert.ok(a.annotations.specs.length > 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('scanCode — supprime entrées du cache pour fichiers disparus', () => {
  const d = tmp();
  try {
    fixtureProjet(d);
    scanCode(d);
    rmSync(join(d, 'src/c.ts'));
    scanCode(d);
    const cache = JSON.parse(readFileSync(join(d, '.aiad/.cache/trace.json'), 'utf-8'));
    assert.ok(!cache.files['src/c.ts'], 'fichier disparu encore en cache');
    assert.ok(cache.files['src/a.ts'], 'fichier toujours présent absent du cache');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('scanCode — gain de perf mesurable entre cold et warm sur N fichiers', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, 'src'), { recursive: true });
    // 200 fichiers, 50 % annotés
    for (let i = 0; i < 200; i++) {
      const ann = i % 2 === 0
        ? `// @spec SPEC-${String(i).padStart(3, '0')}-1-feature\n`
        : '';
      writeFileSync(join(d, `src/f${i}.ts`), `${ann}export const v${i} = ${i};\n`);
    }
    const t0 = Date.now();
    scanCode(d); // cold
    const cold = Date.now() - t0;
    const t1 = Date.now();
    scanCode(d); // warm
    const warm = Date.now() - t1;
    // Le warm doit être ≤ cold (au pire égal sur très petits N).
    assert.ok(warm <= cold + 5, `warm (${warm}ms) > cold (${cold}ms)`);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
