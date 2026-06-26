// Tests — SPEC-021-2-restitution-empreinte-context — Phase 2 (CLI footprint)
//
// @spec SPEC-021-2-restitution-empreinte-context
// @intent INTENT-021
// @verified-by test/footprint-cli.test.js
// @governance AIAD-RGPD

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const BIN = new URL('../bin/aiad-sdd.js', import.meta.url).pathname;

function runFootprint(args = [], cwd = process.cwd()) {
  return spawnSync(process.execPath, [BIN, 'footprint', ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

function tmpRepo(entries = []) {
  const dir = mkdtempSync(join(tmpdir(), 'footprint-cli-'));
  const metricsDir = join(dir, '.aiad', 'metrics');
  mkdirSync(metricsDir, { recursive: true });
  if (entries.length > 0) {
    const jsonl = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
    writeFileSync(join(metricsDir, 'hook-runs.jsonl'), jsonl, 'utf8');
  }
  return dir;
}

// CA-003 — absent → message explicite
test('footprint-cli::empty-message — hook-runs.jsonl absent → message explicite', () => {
  const dir = mkdtempSync(join(tmpdir(), 'footprint-empty-'));
  const r = runFootprint([], dir);
  assert.equal(r.status, 0, 'exit 0');
  assert.ok(r.stdout.includes('aucune empreinte mesurée'), 'message absent présent');
  rmSync(dir, { recursive: true });
});

// CA-004 — absent → exit 0
test('footprint-cli::empty-exit — hook-runs.jsonl absent → exit 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'footprint-exit-'));
  const r = runFootprint([], dir);
  assert.equal(r.status, 0, 'exit 0 même sans données');
  rmSync(dir, { recursive: true });
});

// CA-001 — agrégat tous artefacts
test('footprint-cli::aggregate — affiche les tokens par specId', () => {
  const dir = tmpRepo([
    { ts: '2026-06-25T10:00:00Z', event: 'session-stop', sessionId: 's1', model: 'claude-sonnet-4-6', ecoMetrics: { totalTokens: 5000, co2g: 0, method: 'estimated' }, specId: 'SPEC-021-1' },
    { ts: '2026-06-25T11:00:00Z', event: 'session-stop', sessionId: 's2', model: 'claude-sonnet-4-6', ecoMetrics: { totalTokens: 3000, co2g: 0, method: 'estimated' }, specId: 'SPEC-020-2' },
  ]);
  const r = runFootprint([], dir);
  assert.equal(r.status, 0, 'exit 0');
  assert.ok(r.stdout.includes('SPEC-021-1'), 'SPEC-021-1 présent');
  assert.ok(r.stdout.includes('SPEC-020-2'), 'SPEC-020-2 présent');
  rmSync(dir, { recursive: true });
});

// CA-002 — ciblage d'un artefact
test('footprint-cli::targeted — ciblage SPEC-021-1', () => {
  const dir = tmpRepo([
    { ts: '2026-06-25T10:00:00Z', event: 'session-stop', sessionId: 's1', model: 'claude-sonnet-4-6', ecoMetrics: { totalTokens: 5000, co2g: 0, method: 'estimated' }, specId: 'SPEC-021-1' },
    { ts: '2026-06-25T11:00:00Z', event: 'session-stop', sessionId: 's2', model: 'claude-sonnet-4-6', ecoMetrics: { totalTokens: 3000, co2g: 0, method: 'estimated' }, specId: 'SPEC-020-2' },
  ]);
  const r = runFootprint(['SPEC-021-1'], dir);
  assert.equal(r.status, 0, 'exit 0');
  assert.ok(r.stdout.includes('SPEC-021-1'), 'artefact ciblé affiché');
  assert.ok(!r.stdout.includes('SPEC-020-2'), 'autre artefact absent');
  rmSync(dir, { recursive: true });
});

// CA-003 — fichier vide → message explicite
test('footprint-cli::empty-file-message — fichier vide → aucune empreinte', () => {
  const dir = mkdtempSync(join(tmpdir(), 'footprint-empty-file-'));
  mkdirSync(join(dir, '.aiad', 'metrics'), { recursive: true });
  writeFileSync(join(dir, '.aiad', 'metrics', 'hook-runs.jsonl'), '', 'utf8');
  const r = runFootprint([], dir);
  assert.equal(r.status, 0, 'exit 0');
  assert.ok(r.stdout.includes('aucune empreinte mesurée'), 'message vide');
  rmSync(dir, { recursive: true });
});
