// Tests sortie JSON pour status, bench, doctor — alimentent CI / dashboards
// externes / intégrations Slack/Linear via une surface stable et testable.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { init } from '../lib/init.js';
import { collecterStatus, showStatus } from '../lib/status.js';
import { bench } from '../lib/coldstart.js';

// (#222) Mock console.* au lieu de process.stdout.write — préserve le canal
// TAP/JSON du test runner en mode --test-isolation=process.
function silencer(fn) {
  return async (...args) => {
    const origLog = console.log;
    const origErr = console.error;
    console.log = () => {};
    console.error = () => {};
    try { return await fn(...args); }
    finally { console.log = origLog; console.error = origErr; }
  };
}

function captureStdout(fn) {
  const orig = process.stdout.write.bind(process.stdout);
  let buf = '';
  process.stdout.write = (chunk) => { buf += chunk; return true; };
  try { return Promise.resolve(fn()).then((r) => ({ stdout: buf, result: r })); }
  finally { process.stdout.write = orig; }
}

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-json-')); }

test('status — collecterStatus est pure et JSON-sérialisable', silencer(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    const data = collecterStatus(dir);
    assert.equal(data.initialise, true);
    assert.equal(typeof data.cycle.intents, 'number');
    assert.equal(typeof data.cycle.specs, 'number');
    assert.equal(typeof data.maturite.score, 'number');
    assert.ok(['Non initialisé', 'Démarrage', 'Cadrage', 'Opérationnel', 'Actif', 'Complet'].includes(data.maturite.label));
    // Doit pouvoir être sérialisé sans perte
    const round = JSON.parse(JSON.stringify(data));
    assert.deepEqual(round, data);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('status — projet vierge → initialise=false', () => {
  const dir = tmp();
  try {
    const data = collecterStatus(dir);
    assert.equal(data.initialise, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('status --json — émet du JSON pur sur stdout', async () => {
  const dir = tmp();
  try {
    await silencer(() => init(dir, {}))();
    const { stdout, result } = await captureStdout(() => showStatus(dir, { json: true }));
    const parsed = JSON.parse(stdout);
    assert.deepEqual(parsed.cycle, result.cycle);
    assert.equal(parsed.initialise, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('bench --json — émet le rapport complet sur stdout', async () => {
  const dir = tmp();
  try {
    await silencer(() => init(dir, {}))();
    const { stdout, result } = await captureStdout(() => bench(dir, { json: true }));
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.avantBytes, result.avantBytes);
    assert.equal(parsed.apresBytes, result.apresBytes);
    assert.equal(typeof parsed.reductionFinalePct, 'number');
    assert.ok(parsed.routers.count >= 1);
    assert.ok(parsed.subSdd.count >= 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('bench mode humain — n\'émet pas de JSON sur stdout (préserve compat)', async () => {
  const dir = tmp();
  try {
    await silencer(() => init(dir, {}))();
    const { stdout } = await captureStdout(() => bench(dir));
    // Le rendu humain commence par un saut de ligne, pas par '{'
    assert.ok(!stdout.trim().startsWith('{'));
    assert.match(stdout, /Cold-start/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
