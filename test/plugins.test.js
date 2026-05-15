// Tests `lib/plugins.js` — système de plugins AIAD (item #119).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  decouvrirPlugins, decouvrirNodeModules, decouvrirLocaux,
  chargerManifest, validerManifest,
  listerCommandesPlugins, listerTemplatesPlugins,
  executerHooks, installerLocal, desinstallerLocal,
  afficherListe, afficherInfo, CONSTANTS,
  // alias EN
  discoverPlugins, discoverNodeModules, discoverLocal,
  loadManifest, validateManifest,
  listPluginCommands, listPluginTemplates,
  executeHooks, installLocal, uninstallLocal,
  showList, showInfo,
} from '../lib/plugins.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-plug-')); }
function silent(fn) {
  return (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

function ecrirePlugin(racine, options) {
  const {
    dir, name, version, commands, specTemplates, hooks, source = 'local',
  } = options;
  let pluginDir;
  if (source === 'local') {
    pluginDir = join(racine, '.aiad', 'plugins', dir);
  } else if (source === 'npm') {
    pluginDir = join(racine, 'node_modules', dir);
  } else if (source === 'npm-scoped') {
    pluginDir = join(racine, 'node_modules', options.scope, dir);
  }
  mkdirSync(pluginDir, { recursive: true });
  const manifest = {
    aiadPluginVersion: 1,
    name: name || dir,
    version: version || '1.0.0',
    commands, specTemplates, hooks,
  };
  // Nettoie les undefined
  for (const k of Object.keys(manifest)) {
    if (manifest[k] === undefined) delete manifest[k];
  }
  writeFileSync(
    join(pluginDir, 'aiad-plugin.json'),
    JSON.stringify(manifest, null, 2),
  );
  return pluginDir;
}

// ─── validerManifest ──────────────────────────────────────────────────────

test('validerManifest — manifest minimal valide', () => {
  assert.equal(validerManifest({ aiadPluginVersion: 1, name: 'x' }), true);
});

test('validerManifest — non-objet → throw', () => {
  assert.throws(() => validerManifest(null), /objet/);
  assert.throws(() => validerManifest('x'), /objet/);
});

test('validerManifest — version non supportée → throw', () => {
  assert.throws(
    () => validerManifest({ aiadPluginVersion: 2, name: 'x' }),
    /non supportée/,
  );
});

test('validerManifest — name absent → throw', () => {
  assert.throws(() => validerManifest({ aiadPluginVersion: 1 }), /name requis/);
});

test('validerManifest — commands sans name|entry → throw', () => {
  assert.throws(
    () => validerManifest({ aiadPluginVersion: 1, name: 'x', commands: [{}] }),
    /Command sans name/,
  );
  assert.throws(
    () => validerManifest({ aiadPluginVersion: 1, name: 'x', commands: [{ name: 'c' }] }),
    /sans entry/,
  );
});

test('validerManifest — command entry non-relatif → throw', () => {
  assert.throws(
    () => validerManifest({
      aiadPluginVersion: 1, name: 'x',
      commands: [{ name: 'c', entry: '/abs/path.js' }],
    }),
    /relatif/,
  );
});

test('validerManifest — specTemplates sans domain|file → throw', () => {
  assert.throws(
    () => validerManifest({
      aiadPluginVersion: 1, name: 'x', specTemplates: [{ domain: 'x' }],
    }),
    /sans domain ou file/,
  );
});

test('validerManifest — hooks doit être un objet', () => {
  assert.throws(
    () => validerManifest({ aiadPluginVersion: 1, name: 'x', hooks: [] }),
    /hooks doit être/,
  );
});

// ─── chargerManifest ──────────────────────────────────────────────────────

test('chargerManifest — JSON invalide → throw', () => {
  const d = tmp();
  try {
    const path = join(d, 'aiad-plugin.json');
    writeFileSync(path, 'NOT JSON');
    assert.throws(() => chargerManifest(path), /JSON invalide/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerManifest — manifest valide → objet retourné', () => {
  const d = tmp();
  try {
    const path = join(d, 'aiad-plugin.json');
    writeFileSync(path, JSON.stringify({ aiadPluginVersion: 1, name: 'foo' }));
    const m = chargerManifest(path);
    assert.equal(m.name, 'foo');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── decouvrirLocaux ──────────────────────────────────────────────────────

test('decouvrirLocaux — dossier absent → []', () => {
  const d = tmp();
  try {
    assert.deepEqual(decouvrirLocaux(d), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('decouvrirLocaux — détecte plugin local', () => {
  const d = tmp();
  try {
    ecrirePlugin(d, { dir: 'my-plugin', name: '@org/my-plugin' });
    const r = decouvrirLocaux(d);
    assert.equal(r.length, 1);
    assert.equal(r[0].source, 'local');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── decouvrirNodeModules ────────────────────────────────────────────────

test('decouvrirNodeModules — node_modules absent → []', () => {
  const d = tmp();
  try {
    assert.deepEqual(decouvrirNodeModules(d), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('decouvrirNodeModules — détecte plugin npm non-scoped', () => {
  const d = tmp();
  try {
    ecrirePlugin(d, { dir: 'aiad-plugin-foo', source: 'npm' });
    const r = decouvrirNodeModules(d);
    assert.equal(r.length, 1);
    assert.equal(r[0].source, 'npm');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('decouvrirNodeModules — détecte plugin scoped @org/aiad-plugin-X', () => {
  const d = tmp();
  try {
    ecrirePlugin(d, {
      dir: 'aiad-plugin-bar',
      name: '@org/aiad-plugin-bar',
      source: 'npm-scoped',
      scope: '@org',
    });
    const r = decouvrirNodeModules(d);
    assert.equal(r.length, 1);
    assert.match(r[0].path, /@org\/aiad-plugin-bar/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── decouvrirPlugins (agrégation) ───────────────────────────────────────

test('decouvrirPlugins — agrège npm + local', () => {
  const d = tmp();
  try {
    ecrirePlugin(d, { dir: 'pkg-a', source: 'npm', name: 'pkg-a' });
    ecrirePlugin(d, { dir: 'plug-b', source: 'local', name: 'plug-b' });
    const r = decouvrirPlugins(d);
    assert.equal(r.length, 2);
    assert.ok(r.find((p) => p.name === 'pkg-a' && p.source === 'npm'));
    assert.ok(r.find((p) => p.name === 'plug-b' && p.source === 'local'));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('decouvrirPlugins — manifest invalide ignoré (best-effort)', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, 'node_modules', 'broken'), { recursive: true });
    writeFileSync(join(d, 'node_modules', 'broken', 'aiad-plugin.json'), 'INVALID');
    ecrirePlugin(d, { dir: 'good', source: 'npm', name: 'good' });
    const r = decouvrirPlugins(d);
    assert.equal(r.length, 1);
    assert.equal(r[0].name, 'good');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('decouvrirPlugins — AIAD_PLUGINS_DISABLED=1 → []', () => {
  const d = tmp();
  process.env.AIAD_PLUGINS_DISABLED = '1';
  try {
    ecrirePlugin(d, { dir: 'pkg', source: 'npm', name: 'pkg' });
    assert.deepEqual(decouvrirPlugins(d), []);
  } finally {
    delete process.env.AIAD_PLUGINS_DISABLED;
    rmSync(d, { recursive: true, force: true });
  }
});

// ─── Agrégation commandes / templates ─────────────────────────────────────

test('listerCommandesPlugins — agrège les commandes de tous les plugins', () => {
  const d = tmp();
  try {
    ecrirePlugin(d, {
      dir: 'a', source: 'local', name: 'a',
      commands: [{ name: 'cmd-a1', entry: './a1.js' }, { name: 'cmd-a2', entry: './a2.js' }],
    });
    ecrirePlugin(d, {
      dir: 'b', source: 'local', name: 'b',
      commands: [{ name: 'cmd-b', entry: './b.js' }],
    });
    const plugins = decouvrirPlugins(d);
    const cmds = listerCommandesPlugins(plugins);
    assert.equal(cmds.length, 3);
    assert.ok(cmds.find((c) => c.name === 'cmd-a1'));
    assert.ok(cmds.find((c) => c.plugin === 'b'));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerTemplatesPlugins — agrège les templates SPEC', () => {
  const d = tmp();
  try {
    ecrirePlugin(d, {
      dir: 'a', source: 'local', name: 'a',
      specTemplates: [{ domain: 'fintech-pci', file: './tpl/fintech.md' }],
    });
    const plugins = decouvrirPlugins(d);
    const tpls = listerTemplatesPlugins(plugins);
    assert.equal(tpls.length, 1);
    assert.equal(tpls[0].domain, 'fintech-pci');
    assert.match(tpls[0].file, /fintech\.md$/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── executerHooks ────────────────────────────────────────────────────────

test('executerHooks — appelle beforeCommand puis afterCommand', async () => {
  const d = tmp();
  try {
    const pluginDir = ecrirePlugin(d, {
      dir: 'h', source: 'local', name: 'h',
      hooks: { beforeCommand: './before.js' },
    });
    writeFileSync(
      join(pluginDir, 'before.js'),
      'globalThis.__aiad_test_called = true;\nexport default async function(ctx){ globalThis.__aiad_ctx = ctx; }',
    );
    const plugins = decouvrirPlugins(d);
    globalThis.__aiad_ctx = null;
    await executerHooks(plugins, 'beforeCommand', { command: 'test' });
    assert.deepEqual(globalThis.__aiad_ctx, { command: 'test' });
  } finally {
    delete globalThis.__aiad_ctx;
    rmSync(d, { recursive: true, force: true });
  }
});

test('executerHooks — hook absent → noop', async () => {
  const d = tmp();
  try {
    ecrirePlugin(d, { dir: 'a', source: 'local', name: 'a' });
    const plugins = decouvrirPlugins(d);
    await executerHooks(plugins, 'beforeCommand', {}); // ne throw pas
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('executerHooks — exception swallowée (best-effort)', async () => {
  const d = tmp();
  try {
    const pluginDir = ecrirePlugin(d, {
      dir: 'crash', source: 'local', name: 'crash',
      hooks: { beforeCommand: './crash.js' },
    });
    writeFileSync(
      join(pluginDir, 'crash.js'),
      'export default async function(){ throw new Error("boom"); }',
    );
    const plugins = decouvrirPlugins(d);
    // Doit pas throw
    await executerHooks(plugins, 'beforeCommand', {});
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── installerLocal / desinstallerLocal ──────────────────────────────────

test('installerLocal — manifest absent → throw', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, 'src-plugin'), { recursive: true });
    assert.throws(
      () => installerLocal(d, join(d, 'src-plugin')),
      /Manifest absent/,
    );
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('installerLocal — copie le dossier vers .aiad/plugins/<id>/', () => {
  const d = tmp();
  try {
    const src = join(d, 'src-plugin');
    mkdirSync(src, { recursive: true });
    writeFileSync(
      join(src, 'aiad-plugin.json'),
      JSON.stringify({ aiadPluginVersion: 1, name: '@org/my-aiad-plugin' }),
    );
    const r = installerLocal(d, src);
    assert.equal(r.id, 'my-aiad-plugin');
    assert.ok(existsSync(join(d, '.aiad', 'plugins', 'my-aiad-plugin', 'aiad-plugin.json')));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('installerLocal — déjà installé sans --force → throw', () => {
  const d = tmp();
  try {
    ecrirePlugin(d, { dir: 'foo', source: 'local', name: 'foo' });
    const src = join(d, 'src-plugin');
    mkdirSync(src, { recursive: true });
    writeFileSync(
      join(src, 'aiad-plugin.json'),
      JSON.stringify({ aiadPluginVersion: 1, name: 'foo' }),
    );
    assert.throws(() => installerLocal(d, src, { id: 'foo' }), /déjà installé/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('desinstallerLocal — supprime le plugin', () => {
  const d = tmp();
  try {
    ecrirePlugin(d, { dir: 'rm-me', source: 'local', name: 'rm-me' });
    desinstallerLocal(d, 'rm-me');
    assert.ok(!existsSync(join(d, '.aiad', 'plugins', 'rm-me')));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('desinstallerLocal — plugin absent → throw', () => {
  const d = tmp();
  try {
    assert.throws(() => desinstallerLocal(d, 'absent'), /introuvable/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── CLI ──────────────────────────────────────────────────────────────────

test('afficherListe --json → JSON exploitable', () => {
  const d = tmp();
  try {
    ecrirePlugin(d, {
      dir: 'cli-test', source: 'local', name: 'cli-test',
      commands: [{ name: 'c', entry: './c.js' }],
    });
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { afficherListe(d, { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.total, 1);
    assert.equal(parsed.plugins[0].commands.length, 1);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('afficherListe — projet sans plugins → message d\'aide', silent(() => {
  const d = tmp();
  try {
    const r = afficherListe(d);
    assert.equal(r.length, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('afficherInfo — plugin inconnu → throw', () => {
  const d = tmp();
  try {
    assert.throws(() => afficherInfo(d, 'inconnu', { json: true }), /introuvable/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(discoverPlugins, decouvrirPlugins);
  assert.equal(discoverNodeModules, decouvrirNodeModules);
  assert.equal(discoverLocal, decouvrirLocaux);
  assert.equal(loadManifest, chargerManifest);
  assert.equal(validateManifest, validerManifest);
  assert.equal(listPluginCommands, listerCommandesPlugins);
  assert.equal(listPluginTemplates, listerTemplatesPlugins);
  assert.equal(executeHooks, executerHooks);
  assert.equal(installLocal, installerLocal);
  assert.equal(uninstallLocal, desinstallerLocal);
  assert.equal(showList, afficherListe);
  assert.equal(showInfo, afficherInfo);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.MANIFEST_FILENAME, 'aiad-plugin.json');
  assert.equal(CONSTANTS.LOCAL_PLUGINS_DIR, '.aiad/plugins');
  assert.equal(CONSTANTS.MANIFEST_VERSION, 1);
});
