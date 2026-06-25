// Tests — SPEC-021-1-attribution-tokens-artefact — Phase 2 (collecterEmpreinteParArtefact)
//
// @spec SPEC-021-1-attribution-tokens-artefact
// @intent INTENT-021
// @verified-by test/empreinte-artefact.test.js
// @governance AIAD-RGPD

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import { collecterEmpreinteParArtefact } from '../lib/empreinte-artefact.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function makeProjectRoot(lignes = []) {
  const base = mkdtempSync(join(tmpdir(), 'empreinte-test-'));
  const metricsDir = join(base, '.aiad', 'metrics');
  mkdirSync(metricsDir, { recursive: true });
  if (lignes.length > 0) {
    writeFileSync(join(metricsDir, 'hook-runs.jsonl'), lignes.join('\n') + '\n', 'utf8');
  }
  return base;
}

// CA-004 — legacy-entries : entrées sans specId → nonAttribues
test('CA-004 (legacy-entries) — entrées héritées sans specId comptées dans nonAttribues', () => {
  const legacy = JSON.stringify({
    ts: '2026-06-01T10:00:00Z', event: 'session-stop', sessionId: 'legacy-1',
    model: 'claude-sonnet-4-6', ecoMetrics: { totalTokens: 5000 },
  });
  const root = makeProjectRoot([legacy]);
  try {
    const r = collecterEmpreinteParArtefact(root);
    assert.equal(r.nonAttribues.tokens, 5000);
    assert.equal(r.nonAttribues.sessions, 1);
    assert.deepEqual(r.parSpec, {});
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// CA-005 — legacy-no-throw : entrées sans specId → pas d'exception
test('CA-005 (legacy-no-throw) — entrées héritées → pas d\'exception', () => {
  const legacy = JSON.stringify({
    ts: '2026-06-01T10:00:00Z', event: 'session-stop', sessionId: 'legacy-2',
    model: 'claude-haiku-4-5', ecoMetrics: { totalTokens: 1000 },
  });
  const root = makeProjectRoot([legacy]);
  try {
    assert.doesNotThrow(() => collecterEmpreinteParArtefact(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// CA-006 — group-by-spec : agrégation par specId
test('CA-006 (group-by-spec) — tokens agrégés par specId', () => {
  const entries = [
    JSON.stringify({ ts: '2026-06-25T10:00:00Z', event: 'session-stop', sessionId: 's1', model: 'claude-sonnet-4-6', specId: 'SPEC-021-1', intentId: 'INTENT-021', ecoMetrics: { totalTokens: 3000 } }),
    JSON.stringify({ ts: '2026-06-25T11:00:00Z', event: 'session-stop', sessionId: 's2', model: 'claude-sonnet-4-6', specId: 'SPEC-021-1', intentId: 'INTENT-021', ecoMetrics: { totalTokens: 2000 } }),
    JSON.stringify({ ts: '2026-06-25T12:00:00Z', event: 'session-stop', sessionId: 's3', model: 'claude-haiku-4-5', specId: 'SPEC-021-2', intentId: 'INTENT-021', ecoMetrics: { totalTokens: 1500 } }),
    JSON.stringify({ ts: '2026-06-25T13:00:00Z', event: 'session-stop', sessionId: 's4', model: 'claude-haiku-4-5', ecoMetrics: { totalTokens: 500 } }),
  ];
  const root = makeProjectRoot(entries);
  try {
    const r = collecterEmpreinteParArtefact(root);
    assert.equal(r.parSpec['SPEC-021-1']?.tokens, 5000);
    assert.equal(r.parSpec['SPEC-021-1']?.sessions, 2);
    assert.equal(r.parSpec['SPEC-021-2']?.tokens, 1500);
    assert.equal(r.parSpec['SPEC-021-2']?.sessions, 1);
    assert.equal(r.parIntent['INTENT-021']?.tokens, 6500);
    assert.equal(r.parIntent['INTENT-021']?.sessions, 3);
    assert.equal(r.nonAttribues.tokens, 500);
    assert.equal(r.nonAttribues.sessions, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// CA-010 — local-only : aucun import réseau dans le module
test('CA-010 (local-only) — empreinte-artefact.js n\'importe aucun module réseau', () => {
  const src = readFileSync(join(ROOT, 'lib', 'empreinte-artefact.js'), 'utf8');
  const externalImports = src
    .split('\n')
    .filter((l) => /^import .+ from '/.test(l))
    .filter((l) => !/from '(node:|\.\.?\/|\.\/)/.test(l));
  assert.deepEqual(externalImports, [], `imports externes détectés : ${externalImports.join(', ')}`);
});

// CA-011 — no-network : aucun appel fetch/http pendant l'exécution
test('CA-011 (no-network) — collecterEmpreinteParArtefact n\'émet aucune requête réseau', async () => {
  const entries = [
    JSON.stringify({ ts: '2026-06-25T10:00:00Z', event: 'session-stop', sessionId: 'nn1', model: 'claude-sonnet-4-6', specId: 'SPEC-021-1', ecoMetrics: { totalTokens: 1000 } }),
  ];
  const root = makeProjectRoot(entries);
  const fetchCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (...args) => { fetchCalls.push(args); return Promise.resolve({}); };
  try {
    collecterEmpreinteParArtefact(root);
    assert.equal(fetchCalls.length, 0, 'aucun appel fetch attendu');
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(root, { recursive: true, force: true });
  }
});

// Bonus — fichier jsonl absent → structure vide retournée sans erreur
test('BONUS — jsonl absent → structure vide sans erreur', () => {
  const root = makeProjectRoot(); // pas de hook-runs.jsonl
  const r = collecterEmpreinteParArtefact(root);
  assert.deepEqual(r.parSpec, {});
  assert.deepEqual(r.parIntent, {});
  assert.equal(r.nonAttribues.tokens, 0);
  rmSync(root, { recursive: true, force: true });
});

// Bonus — ligne malformée → ignorée silencieusement
test('BONUS (malformed-line) — ligne malformée dans jsonl ignorée silencieusement', () => {
  const entries = [
    'not-valid-json{{{',
    JSON.stringify({ ts: '2026-06-25T10:00:00Z', event: 'session-stop', sessionId: 'ok1', model: 'claude-sonnet-4-6', specId: 'SPEC-021-1', ecoMetrics: { totalTokens: 800 } }),
  ];
  const root = makeProjectRoot(entries);
  try {
    const r = collecterEmpreinteParArtefact(root);
    assert.equal(r.parSpec['SPEC-021-1']?.tokens, 800);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
