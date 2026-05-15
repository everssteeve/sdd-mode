// Tests sortie SARIF v2.1.0 — vérifie la conformité au schéma minimal et
// le mapping des gaps en `results` avec niveaux corrects.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rendreSarif } from '../lib/sarif.js';
import { construireMatrice, trace } from '../lib/sdd-trace.js';

function silencer(fn) {
  return async (...args) => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { process.stdout.write = orig; }
  };
}

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-sarif-'));
  mkdirSync(join(dir, '.aiad', 'intents'), { recursive: true });
  mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
  mkdirSync(join(dir, 'src'), { recursive: true });
  return dir;
}

test('rendreSarif — structure SARIF v2.1.0 minimale', () => {
  const d = fixture();
  try {
    const modele = construireMatrice(d);
    const sarif = rendreSarif(modele);
    assert.equal(sarif.version, '2.1.0');
    assert.equal(sarif.$schema, 'https://json.schemastore.org/sarif-2.1.0.json');
    assert.equal(sarif.runs.length, 1);
    assert.equal(sarif.runs[0].tool.driver.name, 'aiad-sdd-trace');
    assert.match(sarif.runs[0].tool.driver.version, /^\d+\.\d+\.\d+/);
    assert.ok(Array.isArray(sarif.runs[0].tool.driver.rules));
    assert.equal(sarif.runs[0].tool.driver.rules.length, 6);
    assert.ok(Array.isArray(sarif.runs[0].results));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('rendreSarif — Intent sans SPEC → AIAD-TRACE-001 warning', () => {
  const d = fixture();
  try {
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-100.md'),
      '---\nstatus: active\n---\n\n# Mon intent\n');
    const modele = construireMatrice(d);
    const sarif = rendreSarif(modele);
    const r = sarif.runs[0].results.find((x) => x.ruleId === 'AIAD-TRACE-001');
    assert.ok(r, 'résultat AIAD-TRACE-001 absent');
    assert.equal(r.level, 'warning');
    assert.match(r.message.text, /INTENT-100/);
    assert.equal(r.locations[0].physicalLocation.artifactLocation.uri, '.aiad/intents/INTENT-100.md');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('rendreSarif — SPEC orpheline référencée → AIAD-TRACE-003 error', () => {
  const d = fixture();
  try {
    writeFileSync(join(d, 'src', 'rogue.ts'),
      '// @spec SPEC-999-1-fantome\nexport const x = 1;');
    const modele = construireMatrice(d);
    const sarif = rendreSarif(modele);
    const r = sarif.runs[0].results.find((x) => x.ruleId === 'AIAD-TRACE-003');
    assert.ok(r);
    assert.equal(r.level, 'error');
    assert.match(r.message.text, /SPEC-999-1-fantome/);
    assert.equal(r.locations[0].physicalLocation.artifactLocation.uri, 'src/rogue.ts');
    assert.equal(r.locations[0].physicalLocation.region.startLine, 1);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('rendreSarif — SPEC validée sans code → AIAD-TRACE-002 error', () => {
  const d = fixture();
  try {
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-101.md'),
      '---\nstatus: active\n---\n\n# Intent\n');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-101-1-vide.md'),
      '---\nparent_intent: INTENT-101\nstatus: ready\n---\n\n# Spec sans code\n');
    const modele = construireMatrice(d);
    const sarif = rendreSarif(modele);
    const r = sarif.runs[0].results.find((x) => x.ruleId === 'AIAD-TRACE-002');
    assert.ok(r);
    assert.equal(r.level, 'error');
    assert.match(r.message.text, /SPEC-101-1-vide/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('rendreSarif — JSON sérialisable et stable', () => {
  const modele = construireMatrice(mkdtempSync(join(tmpdir(), 'aiad-empty-')));
  const sarif = rendreSarif(modele);
  // Round-trip stringify/parse
  const reparse = JSON.parse(JSON.stringify(sarif));
  assert.deepEqual(reparse, sarif);
});

test('trace --format sarif — produit trace.sarif valide', silencer(async () => {
  const d = fixture();
  try {
    writeFileSync(join(d, 'src', 'a.ts'), '// @spec SPEC-FANTOME-1\nexport {};');
    await trace(d, { formats: ['sarif'], quiet: true });
    const sarifPath = join(d, '.aiad', 'metrics', 'traceability', 'trace.sarif');
    assert.ok(existsSync(sarifPath), 'trace.sarif manquant');
    const sarif = JSON.parse(readFileSync(sarifPath, 'utf-8'));
    assert.equal(sarif.version, '2.1.0');
    assert.ok(sarif.runs[0].results.some((r) => r.ruleId === 'AIAD-TRACE-003'));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('trace par défaut — inclut sarif dans formats', silencer(async () => {
  const d = fixture();
  try {
    await trace(d, { quiet: true });
    const out = join(d, '.aiad', 'metrics', 'traceability');
    assert.ok(existsSync(join(out, 'trace.md')));
    assert.ok(existsSync(join(out, 'trace.json')));
    assert.ok(existsSync(join(out, 'trace.html')));
    assert.ok(existsSync(join(out, 'trace.sarif')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));
