// Test smoke pour bench — s'assure qu'il calcule sans planter sur un projet
// fraîchement initialisé.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { init } from '../lib/init.js';
import { bench } from '../lib/coldstart.js';

// (#222) Mock console.log/error/warn au lieu de process.stdout.write —
// préserve le canal de communication du test runner en mode
// `--test-isolation=process` (le runner publie ses résultats TAP/JSON sur
// stdout). Le code applicatif (term.js, console.log) passe par console.*,
// donc on intercepte la couche au-dessus.
function silencerStdout(fn) {
  return async (...args) => {
    const origLog = console.log;
    const origErr = console.error;
    const origWarn = console.warn;
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
    try { return await fn(...args); }
    finally {
      console.log = origLog;
      console.error = origErr;
      console.warn = origWarn;
    }
  };
}
test('bench — renvoie les métriques cold-start après init', silencerStdout(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-bench-'));
  try {
    await init(dir, {});
    const r = bench(dir);
    assert.ok(typeof r.avantBytes === 'number');
    assert.ok(typeof r.transitionBytes === 'number');
    assert.ok(typeof r.apresBytes === 'number');
    assert.ok(r.avantBytes > 0);
    assert.ok(r.apresBytes < r.avantBytes, 'la réduction post-router devrait être effective');
    assert.ok(r.reductionFinalePct >= 50, `réduction insuffisante : ${r.reductionFinalePct}%`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));
