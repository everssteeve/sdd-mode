// Tests du hook Stop `drift-lock` (templates/.aiad/hooks/drift-lock.js).
//
// @spec SPEC-036-3-drift-lock-cli-absente

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', '.aiad', 'hooks', 'drift-lock.js');

/** Projet avec `.aiad/` et, si `cli` est fourni, une fausse CLI locale. */
function projet(cli) {
  const d = mkdtempSync(join(tmpdir(), 'aiad-driftlock-'));
  mkdirSync(join(d, '.aiad'), { recursive: true });
  if (cli) {
    const bin = join(d, 'node_modules', '.bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'aiad-sdd'), `#!/bin/sh\n${cli}\n`);
    chmodSync(join(bin, 'aiad-sdd'), 0o755);
  }
  return d;
}

function lancer(d, env = {}) {
  // PATH réduit au répertoire de node : `npx --no-install aiad-sdd` échoue vite, hors réseau.
  return spawnSync(process.execPath, [HOOK], {
    cwd: d,
    encoding: 'utf-8',
    input: '{"hook_event_name":"Stop"}',
    env: { PATH: dirname(process.execPath), HOME: d, CLAUDE_PROJECT_DIR: d, npm_config_offline: 'true', ...env },
  });
}

describe('hook drift-lock', () => {
  test('CA-001 — CLI introuvable : ne bloque pas, prévient l\'humain', () => {
    const d = projet();
    try {
      const r = lancer(d);
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.decision, undefined);
      assert.match(out.systemMessage, /Drift Lock non vérifié/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-002 — CLI qui échoue sans verdict : ne bloque pas', () => {
    const d = projet('echo "boom" >&2; exit 1');
    try {
      const r = lancer(d);
      assert.equal(r.status, 0);
      assert.match(JSON.parse(r.stdout).systemMessage, /non vérifié/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-003 — verdict FAIL avec gap bloquant : bloque (exit 2) en listant le gap', () => {
    const d = projet(`echo '{"verdict":"FAIL","gaps":[{"kind":"code_without_spec","ref":"src/a.js","file":"src/a.js","blocking":true}]}'; exit 1`);
    try {
      const r = lancer(d);
      assert.equal(r.status, 2);
      const out = JSON.parse(r.stdout);
      assert.equal(out.decision, 'block');
      assert.match(out.reason, /1 gap\(s\) bloquant\(s\)/);
      assert.match(out.reason, /src\/a\.js/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-004 — verdict JNSP : bloque (fail-closed inchangé)', () => {
    const d = projet(`echo '{"verdict":"JNSP","gaps":[]}'; exit 2`);
    try {
      const r = lancer(d);
      assert.equal(r.status, 2);
      assert.match(JSON.parse(r.stdout).reason, /INDÉCIDABLE/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-005 — verdict PASS, projet sans .aiad, AIAD_HOOK_SILENT : clôture autorisée sans sortie', () => {
    const d = projet(`echo '{"verdict":"PASS","gaps":[]}'; exit 0`);
    const vide = mkdtempSync(join(tmpdir(), 'aiad-driftlock-'));
    try {
      for (const r of [lancer(d), lancer(vide), lancer(projet(), { AIAD_HOOK_SILENT: '1' })]) {
        assert.equal(r.status, 0);
        assert.equal(r.stdout, '');
      }
    } finally { rmSync(d, { recursive: true, force: true }); rmSync(vide, { recursive: true, force: true }); }
  });
});
