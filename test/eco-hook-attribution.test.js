// Tests — SPEC-021-1-attribution-tokens-artefact — Phase 1 (buildEntry attribution)
//
// @spec SPEC-021-1-attribution-tokens-artefact
// @intent INTENT-021
// @verified-by test/eco-hook-attribution.test.js
// @governance AIAD-RGPD

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { buildEntry } from '../lib/eco-hook.js';

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'eco-hook-attr-test-'));
}

// CA-001 — env-spec : AIAD_CURRENT_SPEC → specId dans l'entrée
test('CA-001 (env-spec) — AIAD_CURRENT_SPEC → specId persisté dans l\'entrée', async () => {
  const tmpDir = makeTempDir();
  try {
    const entry = await buildEntry({
      payload: { session_id: 'ca001', usage: { input_tokens: 1000, output_tokens: 500 } },
      env: { CLAUDE_MODEL: 'claude-sonnet-4-6', AIAD_CURRENT_SPEC: 'SPEC-021-1', AIAD_CURRENT_INTENT: 'INTENT-021' },
      metricsDir: tmpDir,
    });
    assert.equal(entry.specId, 'SPEC-021-1');
    assert.equal(entry.intentId, 'INTENT-021');
    assert.equal(entry.event, 'session-stop');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// CA-002 — file-fallback : pas d'env, fichier d'état → specId persisté
test('CA-002 (file-fallback) — fichier active-artifact.json → specId/intentId dans l\'entrée', async () => {
  const tmpDir = makeTempDir();
  try {
    writeFileSync(
      join(tmpDir, 'active-artifact.json'),
      JSON.stringify({ specId: 'SPEC-021-1', intentId: 'INTENT-021', since: '2026-06-25T14:30:00.000Z' }),
      'utf8'
    );
    const entry = await buildEntry({
      payload: { session_id: 'ca002', usage: { input_tokens: 500, output_tokens: 200 } },
      env: { CLAUDE_MODEL: 'claude-haiku-4-5' },
      metricsDir: tmpDir,
    });
    assert.equal(entry.specId, 'SPEC-021-1');
    assert.equal(entry.intentId, 'INTENT-021');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// CA-003 — no-attribution : ni env ni fichier → pas de specId/intentId
test('CA-003 (no-attribution) — aucune source → entrée sans specId ni intentId', async () => {
  const tmpDir = makeTempDir();
  try {
    const entry = await buildEntry({
      payload: { session_id: 'ca003', usage: { input_tokens: 100, output_tokens: 50 } },
      env: {},
      metricsDir: tmpDir,
    });
    assert.ok(!Object.hasOwn(entry, 'specId'), 'specId doit être absent');
    assert.ok(!Object.hasOwn(entry, 'intentId'), 'intentId doit être absent');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// CA-002 bonus — fichier d'état corrompu → fail-open, pas d'exception
test('CA-002 (file-corrupt) — fichier active-artifact.json corrompu → fail-open sans exception', async () => {
  const tmpDir = makeTempDir();
  try {
    writeFileSync(join(tmpDir, 'active-artifact.json'), 'not-json-at-all{{{', 'utf8');
    const entry = await buildEntry({
      payload: { session_id: 'ca002c', usage: { input_tokens: 100, output_tokens: 50 } },
      env: {},
      metricsDir: tmpDir,
    });
    assert.ok(!Object.hasOwn(entry, 'specId'), 'specId doit être absent sur fichier corrompu');
    assert.equal(entry.event, 'session-stop');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// CA-001 bonus — env prioritaire sur le fichier d'état
test('CA-001 (env-priority) — env AIAD_CURRENT_SPEC prime sur le fichier d\'état', async () => {
  const tmpDir = makeTempDir();
  try {
    writeFileSync(
      join(tmpDir, 'active-artifact.json'),
      JSON.stringify({ specId: 'SPEC-999-from-file', intentId: 'INTENT-999', since: '2026-06-01T00:00:00.000Z' }),
      'utf8'
    );
    const entry = await buildEntry({
      payload: { session_id: 'ca001p', usage: { input_tokens: 100, output_tokens: 50 } },
      env: { AIAD_CURRENT_SPEC: 'SPEC-021-1-from-env' },
      metricsDir: tmpDir,
    });
    assert.equal(entry.specId, 'SPEC-021-1-from-env', 'env doit primer sur le fichier');
    assert.equal(entry.intentId, 'INTENT-999', 'intentId du fichier doit être utilisé en fallback');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
