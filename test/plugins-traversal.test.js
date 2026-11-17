// @intent INTENT-039
// @spec SPEC-039-2-controle-humain
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cheminPluginLocal, desinstallerLocal, installerLocal } from '../lib/plugins.js';

test('CA-004 — plugin uninstall : un identifiant qui sort de .aiad/plugins/ est refusé, rien n\'est supprimé', () => {
  const base = mkdtempSync(join(tmpdir(), 'aiad-plug-'));
  try {
    const projet = join(base, 'projet');
    const victime = join(base, 'victime');
    mkdirSync(join(projet, '.aiad', 'plugins'), { recursive: true });
    mkdirSync(victime);
    writeFileSync(join(victime, 'important.txt'), 'à garder');
    for (const id of ['../../../victime', '..', '../victime', '/etc', 'a/b', 'a\\b', '', '.', '..hidden/..']) {
      assert.throws(() => desinstallerLocal(projet, id), /invalide/, `id accepté à tort : ${JSON.stringify(id)}`);
    }
    assert.ok(existsSync(join(victime, 'important.txt')));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('CA-004 — plugin install : --id ne peut pas écrire hors de .aiad/plugins/', () => {
  const base = mkdtempSync(join(tmpdir(), 'aiad-plug-'));
  try {
    const projet = join(base, 'projet');
    const source = join(base, 'source');
    mkdirSync(projet);
    mkdirSync(source);
    writeFileSync(join(source, 'aiad-plugin.json'), JSON.stringify({ aiadPluginVersion: 1, name: 'demo', version: '1.0.0' }));
    assert.throws(() => installerLocal(projet, source, { id: '../../ailleurs' }), /invalide/);
    assert.equal(existsSync(join(base, 'ailleurs')), false);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('cheminPluginLocal — identifiant ordinaire résolu sous .aiad/plugins/', () => {
  assert.equal(cheminPluginLocal('/tmp/p', 'mon-plugin'), join('/tmp/p', '.aiad', 'plugins', 'mon-plugin'));
});
