// Test d'hygiène du tarball npm — invariant : aucun artefact dev / .DS_Store /
// .tgz / test/ / docs/ / CONTRIBUTING.md ne doit fuiter dans la publication.
//
// Ce test fait double-emploi avec le job CI `pack` mais l'avoir aussi en
// local évite une régression d'un PR contributeur qui élargirait
// `package.json#files` sans s'en rendre compte.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function pack() {
  const r = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: ROOT,
    encoding: 'utf-8',
  });
  assert.equal(r.status, 0, `npm pack a échoué : ${r.stderr}`);
  return JSON.parse(r.stdout);
}

test('npm pack — pas de .DS_Store / .tgz dans le tarball', () => {
  const j = pack();
  const files = (j[0]?.files || []).map((f) => f.path);
  assert.ok(!files.some((f) => f.endsWith('.DS_Store')), `.DS_Store présent : ${files.filter((f) => f.endsWith('.DS_Store')).join(', ')}`);
  assert.ok(!files.some((f) => f.endsWith('.tgz')), '.tgz présent dans le tarball');
});

test('npm pack — pas de test/ / docs/ / scripts/ / .github/ dans le tarball', () => {
  const j = pack();
  const files = (j[0]?.files || []).map((f) => f.path);
  for (const prefix of ['test/', 'docs/', 'scripts/', '.github/', '.playwright-mcp/']) {
    const fuites = files.filter((f) => f.startsWith(prefix));
    assert.ok(fuites.length === 0, `${prefix} fuite dans le tarball : ${fuites.join(', ')}`);
  }
});

test('npm pack — pas de CONTRIBUTING.md / productbacklog.md / SDDMode.md / SECURITY.md dans le tarball', () => {
  const j = pack();
  const files = (j[0]?.files || []).map((f) => f.path);
  for (const interdit of ['CONTRIBUTING.md', 'productbacklog.md', 'SDDMode.md', 'frameworkAIAD.md', 'SECURITY.md']) {
    assert.ok(!files.includes(interdit), `${interdit} fuite dans le tarball`);
  }
});

test('npm pack — README.md, LICENSE, bin/, lib/, templates/ présents', () => {
  const j = pack();
  const files = (j[0]?.files || []).map((f) => f.path);
  assert.ok(files.includes('README.md'));
  assert.ok(files.includes('LICENSE'));
  assert.ok(files.includes('package.json'));
  assert.ok(files.some((f) => f.startsWith('bin/')));
  assert.ok(files.some((f) => f.startsWith('lib/')));
  assert.ok(files.some((f) => f.startsWith('templates/')));
});
