// @intent INTENT-039
// @spec SPEC-039-3-diagnostics-vrais
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { diagnostiquer, etatHooksClaude } from '../lib/doctor.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(RACINE, 'bin', 'aiad-sdd.js');

function projetInstalle() {
  const base = mkdtempSync(join(tmpdir(), 'aiad-doc-'));
  const projet = join(base, 'p');
  mkdirSync(projet);
  const env = { ...process.env, HOME: join(base, 'home'), AIAD_OFFLINE: '1', NO_COLOR: '1' };
  spawnSync('git', ['init', '-q'], { cwd: projet });
  const r = spawnSync(process.execPath, [CLI, 'init'], { cwd: projet, env, encoding: 'utf-8' });
  assert.equal(r.status, 0, r.stderr);
  return { base, projet, env };
}

test('CA-001 — projet fraîchement installé : tous les garde-fous sont câblés', async () => {
  const { base, projet } = projetInstalle();
  try {
    const e = etatHooksClaude(projet);
    assert.equal(e.applicable, true);
    assert.deepEqual(e.nonCables, []);
    assert.deepEqual(e.scriptsAbsents, []);
    const check = (await diagnostiquer(projet)).checks.find((c) => c.id === 'hooks:claude-code');
    assert.equal(check.ok, true);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('CA-001 — hooks décâblés (état laissé par une 1.x sur un settings.json préexistant) : doctor en erreur', async () => {
  const { base, projet, env } = projetInstalle();
  try {
    writeFileSync(join(projet, '.claude', 'settings.json'), JSON.stringify({ permissions: { deny: ['Read(./.env)'] } }));
    const rapport = await diagnostiquer(projet);
    const check = rapport.checks.find((c) => c.id === 'hooks:claude-code');
    assert.equal(check.ok, false);
    assert.match(check.message, /veto\.js/);
    assert.match(check.message, /drift-lock\.js/);
    assert.equal(rapport.ok, false);
    const cli = spawnSync(process.execPath, [CLI, 'doctor'], { cwd: projet, env, encoding: 'utf-8' });
    assert.equal(cli.status, 1);
    assert.match(cli.stdout, /garde-fous inactifs/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('CA-001 — script supprimé, settings illisible, package.json des hooks absent : chacun est signalé', () => {
  const { base, projet } = projetInstalle();
  try {
    rmSync(join(projet, '.aiad', 'hooks', 'veto.js'));
    rmSync(join(projet, '.aiad', 'hooks', 'package.json'));
    let e = etatHooksClaude(projet);
    assert.deepEqual(e.scriptsAbsents, ['veto.js']);
    assert.equal(e.moduleType, false);
    writeFileSync(join(projet, '.claude', 'settings.json'), '{ cassé');
    e = etatHooksClaude(projet);
    assert.equal(e.illisible, true);
    assert.ok(e.nonCables.includes('drift-lock.js'));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('profil minimal (sans .aiad/hooks/) : contrôle non applicable', () => {
  const base = mkdtempSync(join(tmpdir(), 'aiad-doc-'));
  try {
    mkdirSync(join(base, '.aiad'));
    assert.equal(etatHooksClaude(base).applicable, false);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('le dépôt du paquet lui-même a ses garde-fous câblés', () => {
  const e = etatHooksClaude(RACINE);
  assert.deepEqual(e.nonCables, []);
  assert.deepEqual(e.scriptsAbsents, []);
  assert.equal(readFileSync(join(RACINE, '.aiad', 'hooks', 'package.json'), 'utf-8').includes('"module"'), true);
});
