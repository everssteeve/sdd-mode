// Tests `sdd-trace --watch`. Tests directement le watcher (sans appeler
// `trace({ watch: true })` qui bloque le process via une promesse infinie).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { trace, demarrerWatch } from '../lib/sdd-trace.js';

function silencer(fn) {
  return async (...args) => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { process.stdout.write = orig; }
  };
}

function pause(ms) { return new Promise((r) => setTimeout(r, ms)); }

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-tw-'));
  mkdirSync(join(dir, '.aiad', 'intents'), { recursive: true });
  mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
  writeFileSync(join(dir, '.aiad', 'intents', 'INTENT-001.md'),
    '---\nstatus: active\n---\n# I\n');
  writeFileSync(join(dir, '.aiad', 'specs', 'SPEC-001-1.md'),
    '---\nparent_intent: INTENT-001\nstatus: ready\n---\n# Spec\n');
  return dir;
}

test('trace — sans --watch, génère md/json/html/sarif', silencer(async () => {
  const d = fixture();
  try {
    await trace(d, { quiet: true });
    const out = join(d, '.aiad', 'metrics', 'traceability');
    assert.ok(existsSync(join(out, 'trace.md')));
    assert.ok(existsSync(join(out, 'trace.json')));
    assert.ok(existsSync(join(out, 'trace.html')));
    assert.ok(existsSync(join(out, 'trace.sarif')));
    // (#261) trace.json contient _meta cohérent avec dashboard/doctor/status/workspace
    const tj = JSON.parse(readFileSync(join(out, 'trace.json'), 'utf-8'));
    assert.equal(tj._meta.schema, 'aiad-sdd-trace');
    assert.match(tj._meta.version, /^\d+\.\d+\.\d+/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('demarrerWatch — déclenche onChange après modification d\'une SPEC', async () => {
  const d = fixture();
  let appels = 0;
  const stop = demarrerWatch(d, () => { appels++; }, { debounceMs: 100 });
  try {
    await pause(50);
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-2-new.md'),
      '---\nstatus: ready\n---\n# Nouveau\n');
    await pause(300);
    assert.ok(appels >= 1, `attendu ≥ 1 appel, eu ${appels}`);
  } finally {
    stop();
    rmSync(d, { recursive: true, force: true });
  }
});

test('demarrerWatch — déclenche aussi sur fichier code (extension reconnue)', async () => {
  const d = fixture();
  mkdirSync(join(d, 'src'), { recursive: true });
  let appels = 0;
  const stop = demarrerWatch(d, () => { appels++; }, { debounceMs: 100 });
  try {
    await pause(50);
    writeFileSync(join(d, 'src', 'lib.rs'), '// @spec SPEC-001-1\npub fn x() {}\n');
    await pause(300);
    assert.ok(appels >= 1, `attendu ≥ 1 appel, eu ${appels}`);
  } finally {
    stop();
    rmSync(d, { recursive: true, force: true });
  }
});

test('demarrerWatch — close() arrête le déclenchement', async () => {
  const d = fixture();
  let appels = 0;
  const stop = demarrerWatch(d, () => { appels++; }, { debounceMs: 50 });
  await pause(30);
  stop();
  writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-3.md'), '#');
  await pause(200);
  assert.equal(appels, 0);
  rmSync(d, { recursive: true, force: true });
});
