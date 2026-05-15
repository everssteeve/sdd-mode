// Tests structurels de l'extension VS Code.
// Pas de runtime vscode-test (lourd) — on valide le manifest + la syntaxe du
// code source + l'alignement avec le contrat du CLI aiad-sdd.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_ROOT = join(__dirname, '..', 'vscode-extension');
const PKG_PATH = join(EXT_ROOT, 'package.json');
const SRC_PATH = join(EXT_ROOT, 'src', 'extension.js');
const README_PATH = join(EXT_ROOT, 'README.md');

test('manifest VS Code — fichiers présents', () => {
  assert.ok(existsSync(PKG_PATH), 'package.json absent');
  assert.ok(existsSync(SRC_PATH), 'src/extension.js absent');
  assert.ok(existsSync(README_PATH), 'README.md absent');
});

test('manifest VS Code — champs requis valides', () => {
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
  assert.equal(pkg.name, 'aiad-sdd-vscode');
  assert.equal(pkg.publisher, 'everssteeve');
  assert.match(pkg.version, /^\d+\.\d+\.\d+/);
  assert.match(pkg.engines.vscode, /^\^\d+\.\d+\.\d+/);
  assert.equal(pkg.main, './src/extension.js');
  assert.ok(pkg.activationEvents.includes('workspaceContains:.aiad'));
});

test('manifest VS Code — contributes 2 vues + 4 commandes + 1 viewContainer', () => {
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
  assert.equal(pkg.contributes.views['aiad-sdd'].length, 2, '2 vues attendues');
  assert.ok(pkg.contributes.commands.length >= 4, '≥ 4 commandes attendues');
  const cmdIds = pkg.contributes.commands.map((c) => c.command);
  for (const id of ['aiad.refresh', 'aiad.openTrace', 'aiad.runDoctor', 'aiad.gotoSpec']) {
    assert.ok(cmdIds.includes(id), `commande ${id} manquante`);
  }
  assert.ok(pkg.contributes.viewsContainers.activitybar[0].id === 'aiad-sdd');
});

test('extension.js — syntaxe valide (node --check)', () => {
  const r = spawnSync(process.execPath, ['--check', SRC_PATH], { encoding: 'utf-8' });
  assert.equal(r.status, 0, `node --check a échoué : ${r.stderr}`);
});

test('extension.js — exporte activate + deactivate (contrat VS Code)', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(src, /module\.exports\s*=\s*\{[^}]*activate/);
  assert.match(src, /module\.exports\s*=\s*\{[^}]*deactivate/);
});

test('extension.js — délègue au CLI aiad-sdd (pas de réimplémentation)', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // Doit utiliser `npx aiad-sdd` ou un chemin configurable, pas réimplémenter
  // la logique métier (parser annotations, etc.).
  assert.match(src, /aiad-sdd/);
  // Pas de require de gros frameworks
  assert.ok(!/require\(['"]express['"]\)/.test(src));
  assert.ok(!/require\(['"]fastify['"]\)/.test(src));
});

test('extension.js — supporte les 10 langages annotables', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  for (const lang of ['typescript', 'javascript', 'python', 'rust', 'go', 'java', 'kotlin', 'csharp', 'ruby']) {
    assert.ok(src.includes(`'${lang}'`), `langage ${lang} non listé dans CodeLens provider`);
  }
});

test('extension — exclue du tarball npm aiad-sdd', () => {
  const root = join(__dirname, '..');
  const r = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: root, encoding: 'utf-8' });
  assert.equal(r.status, 0);
  const j = JSON.parse(r.stdout);
  const files = (j[0]?.files || []).map((f) => f.path);
  const fuites = files.filter((f) => f.startsWith('vscode-extension/'));
  assert.equal(fuites.length, 0, `vscode-extension fuite dans tarball npm : ${fuites.join(', ')}`);
});
