/**
 * Tests for scripts/validate-data-schema.js
 *
 * @spec SPEC-016-3
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const SCRIPT = new URL('../scripts/validate-data-schema.js', import.meta.url).pathname;

function tmp() {
  return mkdtempSync(join(tmpdir(), 'aiad-validate-'));
}

const VALID_DATA = {
  _meta: {
    schema: 'aiad-sdd-dashboard',
    schema_version: '2.0',
    version: '1.18.0',
    generated: '2026-06-22T00:00:00.000Z',
    slim: true,
  },
  _schema: {
    url: 'https://aiad.ovh/schema/data-v2.schema.json',
    local: 'lib/dashboard/schema/data-v2.schema.json',
  },
  projet: { nom: 'test' },
  intents: [],
  specs: [],
};

function run(dataPath) {
  return spawnSync(process.execPath, [SCRIPT, dataPath], { encoding: 'utf-8' });
}

test('validate-data-schema — exit 0 sur data.json valide', () => {
  const dir = tmp();
  try {
    const p = join(dir, 'data.json');
    writeFileSync(p, JSON.stringify(VALID_DATA));
    const r = run(p);
    assert.equal(r.status, 0, `stdout: ${r.stdout}\nstderr: ${r.stderr}`);
    assert.match(r.stdout, /is valid/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('validate-data-schema — exit 1 si _meta absent', () => {
  const dir = tmp();
  try {
    const { _meta: _, ...rest } = VALID_DATA;
    const p = join(dir, 'data.json');
    writeFileSync(p, JSON.stringify(rest));
    const r = run(p);
    assert.equal(r.status, 1, `stdout: ${r.stdout}\nstderr: ${r.stderr}`);
    assert.match(r.stderr, /_meta/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('validate-data-schema — exit 1 si intents non-array', () => {
  const dir = tmp();
  try {
    const p = join(dir, 'data.json');
    writeFileSync(p, JSON.stringify({ ...VALID_DATA, intents: 'not-an-array' }));
    const r = run(p);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /intents/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('validate-data-schema — exit 1 si specs non-array', () => {
  const dir = tmp();
  try {
    const p = join(dir, 'data.json');
    writeFileSync(p, JSON.stringify({ ...VALID_DATA, specs: 42 }));
    const r = run(p);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /specs/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('validate-data-schema — exit 1 si schema_version absent', () => {
  const dir = tmp();
  try {
    const data = { ...VALID_DATA, _meta: { ...VALID_DATA._meta } };
    delete data._meta.schema_version;
    const p = join(dir, 'data.json');
    writeFileSync(p, JSON.stringify(data));
    const r = run(p);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /schema_version/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('validate-data-schema — exit 1 si fichier illisible', () => {
  const r = run('/nonexistent/path/data.json');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Cannot read/);
});
