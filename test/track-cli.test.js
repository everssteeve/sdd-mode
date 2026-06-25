// Tests — SPEC-021-1-attribution-tokens-artefact — Phase 3 (CLI track set/clear)
//
// @spec SPEC-021-1-attribution-tokens-artefact
// @intent INTENT-021
// @verified-by test/track-cli.test.js
// @governance AIAD-RGPD

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, existsSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BIN = join(ROOT, 'bin', 'aiad-sdd.js');

function makeTempProjectDir() {
  const base = mkdtempSync(join(tmpdir(), 'track-cli-test-'));
  // Crée .aiad/metrics pour simuler un projet initialisé
  mkdirSync(join(base, '.aiad', 'metrics'), { recursive: true });
  return base;
}

function runCLI(args, cwd) {
  return spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    env: { ...process.env },
    encoding: 'utf8',
  });
}

// CA-007 — set-writes-state : `track set` écrit active-artifact.json
test('CA-007 (set-writes-state) — track set <SPEC-ID> écrit active-artifact.json', () => {
  const projectDir = makeTempProjectDir();
  try {
    const result = runCLI(['track', 'set', 'SPEC-021-1', '--intent', 'INTENT-021'], projectDir);
    assert.equal(result.status, 0, `exit code doit être 0\nstderr: ${result.stderr}`);
    const artifactPath = join(projectDir, '.aiad', 'metrics', 'active-artifact.json');
    assert.ok(existsSync(artifactPath), 'active-artifact.json doit avoir été créé');
    const data = JSON.parse(readFileSync(artifactPath, 'utf8'));
    assert.equal(data.specId, 'SPEC-021-1');
    assert.equal(data.intentId, 'INTENT-021');
    assert.ok(data.since, 'since doit être présent');
    // Vérifier que since est un ISO 8601 valide
    assert.ok(!isNaN(Date.parse(data.since)), `since doit être un ISO 8601 valide : ${data.since}`);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// CA-008 — clear-removes : `track clear` supprime active-artifact.json
test('CA-008 (clear-removes) — track clear supprime active-artifact.json', () => {
  const projectDir = makeTempProjectDir();
  const artifactPath = join(projectDir, '.aiad', 'metrics', 'active-artifact.json');
  writeFileSync(artifactPath, JSON.stringify({ specId: 'SPEC-021-1', since: '2026-06-25T10:00:00.000Z' }), 'utf8');
  try {
    const result = runCLI(['track', 'clear'], projectDir);
    assert.equal(result.status, 0, `exit code doit être 0\nstderr: ${result.stderr}`);
    assert.ok(!existsSync(artifactPath), 'active-artifact.json doit avoir été supprimé');
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// CA-009 — clear-idempotent : `track clear` sans fichier → exit 0
test('CA-009 (clear-idempotent) — track clear sans fichier → exit 0 idempotent', () => {
  const projectDir = makeTempProjectDir();
  const artifactPath = join(projectDir, '.aiad', 'metrics', 'active-artifact.json');
  // S'assurer que le fichier n'existe pas
  assert.ok(!existsSync(artifactPath), 'précondition : fichier absent');
  try {
    const result = runCLI(['track', 'clear'], projectDir);
    assert.equal(result.status, 0, `exit code doit être 0 même si fichier absent\nstderr: ${result.stderr}`);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// Bonus — set sans SPEC-ID → exit 1
test('BONUS (set-no-spec) — track set sans SPEC-ID → exit 1', () => {
  const projectDir = makeTempProjectDir();
  try {
    const result = runCLI(['track', 'set'], projectDir);
    assert.equal(result.status, 1, 'doit sortir en erreur sans SPEC-ID');
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// Bonus — set sans --intent → specId présent, intentId absent
test('BONUS (set-no-intent) — track set sans --intent → specId présent, intentId absent', () => {
  const projectDir = makeTempProjectDir();
  try {
    const result = runCLI(['track', 'set', 'SPEC-021-1'], projectDir);
    assert.equal(result.status, 0, `exit code doit être 0\nstderr: ${result.stderr}`);
    const data = JSON.parse(readFileSync(join(projectDir, '.aiad', 'metrics', 'active-artifact.json'), 'utf8'));
    assert.equal(data.specId, 'SPEC-021-1');
    assert.ok(!Object.hasOwn(data, 'intentId'), 'intentId ne doit pas être présent si non fourni');
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});
