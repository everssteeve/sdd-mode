// Tests — SPEC-030-2-hook-stop
// Couverture des 7 critères d'acceptation.
//
// @spec SPEC-030-2-hook-stop
// @verified-by test/eco-hook.test.js

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { spawnSync } from 'node:child_process';

import { buildEntry, persistEntry, run } from '../lib/eco-hook.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'eco-hook-test-'));
}

// CA-1 — session avec usage → co2g > 0, event: "session-stop"
test('CA-1 — session avec tokens → co2g > 0 et event session-stop', async () => {
  const entry = await buildEntry({
    payload: {
      session_id: 'test-ca1',
      stop_hook_active: true,
      usage: { input_tokens: 12000, output_tokens: 3500 },
    },
    env: { CLAUDE_MODEL: 'claude-sonnet-4-6' },
  });
  assert.equal(entry.event, 'session-stop');
  assert.ok(entry.ecoMetrics.co2g > 0, `co2g doit être > 0, got ${entry.ecoMetrics.co2g}`);
  assert.equal(entry.ecoMetrics.method, 'estimated');
  assert.equal(entry.sessionId, 'test-ca1');
  assert.equal(entry.ecoMetrics.totalTokens, 15500);
});

// CA-2 — co2Label constant anti-greenwashing
test('CA-2 — co2Label vaut "estimation indicative (non certifiée)"', async () => {
  const entry = await buildEntry({
    payload: { usage: { input_tokens: 1000, output_tokens: 500 } },
    env: { CLAUDE_MODEL: 'claude-sonnet-4-6' },
  });
  assert.equal(entry.ecoMetrics.co2Label, 'estimation indicative (non certifiée)');
});

// CA-3 — stdin non-JSON → exit 0, pas de crash, pas de ligne erronée
test('CA-3 — payload stdin non-JSON → exit 0 silencieux', () => {
  const result = spawnSync(process.execPath, [join(ROOT, 'lib', 'eco-hook.js')], {
    input: 'not-json-at-all',
    env: { ...process.env, CLAUDE_MODEL: 'claude-sonnet-4-6' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `exit code doit être 0, got ${result.status}`);
  assert.equal(result.stdout, '', 'stdout doit être vide');
});

// CA-4 — CLAUDE_MODEL absent → model: 'unknown', method: 'unknown', co2g: null — ligne persistée
test('CA-4 — CLAUDE_MODEL absent → model unknown, co2g null, ligne persistée', async () => {
  const tmpDir = makeTempDir();
  try {
    const stdin = Readable.from([
      '{"session_id":"ca4","usage":{"input_tokens":1000,"output_tokens":500}}',
    ]);
    await run({ stdin, metricsDir: tmpDir, env: {} });
    const raw = readFileSync(join(tmpDir, 'hook-runs.jsonl'), 'utf8').trim().split('\n');
    const entry = JSON.parse(raw[raw.length - 1]);
    assert.equal(entry.model, 'unknown');
    assert.equal(entry.ecoMetrics.method, 'unknown');
    assert.equal(entry.ecoMetrics.co2g, null);
    assert.equal(entry.event, 'session-stop');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// CA-5 — répertoire metrics absent → créé automatiquement, ligne persistée
test('CA-5 — répertoire metrics absent → créé automatiquement, ligne persistée', async () => {
  const tmpBase = makeTempDir();
  const metricsDir = join(tmpBase, 'deeply', 'nested', 'metrics');
  try {
    const stdin = Readable.from([
      '{"session_id":"ca5","usage":{"input_tokens":500,"output_tokens":200}}',
    ]);
    await run({ stdin, metricsDir, env: { CLAUDE_MODEL: 'claude-haiku-4-5' } });
    assert.ok(existsSync(join(metricsDir, 'hook-runs.jsonl')), 'hook-runs.jsonl doit avoir été créé');
    const entry = JSON.parse(readFileSync(join(metricsDir, 'hook-runs.jsonl'), 'utf8').trim());
    assert.equal(entry.event, 'session-stop');
    assert.ok(entry.ts, 'ts doit être défini');
  } finally {
    rmSync(tmpBase, { recursive: true, force: true });
  }
});

// CA-6 — settings.json référence eco-hook.js sous hooks.Stop
test('CA-6 — .claude/settings.json contient hooks.Stop → eco-hook.js', () => {
  const settings = JSON.parse(
    readFileSync(join(ROOT, '.claude', 'settings.json'), 'utf8')
  );
  const stopEntries = settings.hooks?.Stop ?? [];
  const allCommands = stopEntries.flatMap((e) => e.hooks ?? []).map((h) => h.command ?? '');
  const hasEcoHook = allCommands.some((cmd) => cmd.includes('eco-hook.js'));
  assert.ok(hasEcoHook, `settings.json doit référencer eco-hook.js dans hooks.Stop\nCommandes trouvées : ${allCommands.join(', ')}`);
});

// CA-7 — zéro dépendance de production ajoutée
test('CA-7 — eco-hook.js n\'importe aucun module externe (node:* uniquement)', () => {
  const src = readFileSync(join(ROOT, 'lib', 'eco-hook.js'), 'utf8');
  // Toute ligne import ... from 'X' où X n'est pas node: ou . ou ..
  const externalImports = src
    .split('\n')
    .filter((l) => /^import .+ from '/.test(l))
    .filter((l) => !/from '(node:|\.\.?\/|\.\/)/.test(l));
  assert.deepEqual(externalImports, [], `imports externes détectés : ${externalImports.join(', ')}`);
});
