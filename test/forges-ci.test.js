// Tests structurels des templates CI multi-forges (GitLab, Bitbucket, Drone).
// Vérifie que chaque template appelle la même séquence de commandes et
// respecte les conventions de la forge cible.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FORGES = join(__dirname, '..', 'templates', 'forges');

function lire(nom) {
  const p = join(FORGES, nom);
  assert.ok(existsSync(p), `${nom} absent`);
  return readFileSync(p, 'utf-8');
}

test('GitLab CI — fichier valide avec stages et jobs aiad:*', () => {
  const c = lire('.gitlab-ci.aiad.yml');
  assert.match(c, /^variables:/m);
  assert.match(c, /^aiad:trace:/m);
  assert.match(c, /^aiad:emit-rules-check:/m);
  assert.match(c, /^aiad:docs-check:/m);
  assert.match(c, /^aiad:update-check:/m);
  assert.match(c, /^aiad:dashboard:/m);
  assert.match(c, /image:\s*node:\${NODE_VERSION}/);
  // SARIF intégré dans le Security Dashboard
  assert.match(c, /sast:\s*\.aiad\/metrics\/traceability\/trace\.sarif/);
  // AIAD_NO_COLOR
  assert.match(c, /AIAD_NO_COLOR:/);
});

test('Bitbucket Pipelines — anchors YAML sur les 4 vérifs + parallèle', () => {
  const c = lire('bitbucket-pipelines.aiad.yml');
  assert.match(c, /^image:\s*node:22/m);
  for (const anchor of ['&aiad-trace', '&aiad-emit-rules-check', '&aiad-docs-check', '&aiad-update-check']) {
    assert.ok(c.includes(anchor), `anchor ${anchor} manquant`);
  }
  assert.match(c, /parallel:/);
  assert.match(c, /pull-requests:/);
});

test('Drone CI — pipeline avec 5 steps node:22', () => {
  const c = lire('.drone.aiad.yml');
  assert.match(c, /kind:\s*pipeline/);
  assert.match(c, /type:\s*docker/);
  for (const step of ['aiad-update-check', 'aiad-emit-rules-check', 'aiad-docs-check', 'aiad-trace', 'aiad-dashboard']) {
    assert.ok(c.includes(`name: ${step}`), `step ${step} manquant`);
  }
  // Tous utilisent node:22
  const nbNode22 = (c.match(/image:\s*node:22/g) || []).length;
  assert.ok(nbNode22 >= 5, `attendu ≥ 5 image node:22, eu ${nbNode22}`);
});

test('Cohérence inter-forges — 4 vérifications canoniques partout', () => {
  const fichiers = [
    '.gitlab-ci.aiad.yml',
    'bitbucket-pipelines.aiad.yml',
    '.drone.aiad.yml',
  ];
  const verifs = ['update --check', 'emit-rules --check', 'docs --check', 'trace --fail-on-gap'];
  for (const f of fichiers) {
    const c = lire(f);
    for (const v of verifs) {
      assert.ok(c.includes(`aiad-sdd ${v}`), `${f} : commande "${v}" manquante`);
    }
  }
});

test('Templates forges — utilisent npx -y (pas d\'install global)', () => {
  for (const f of ['.gitlab-ci.aiad.yml', 'bitbucket-pipelines.aiad.yml', '.drone.aiad.yml']) {
    const c = lire(f);
    assert.match(c, /npx -y aiad-sdd/);
    assert.ok(!/npm install -g aiad-sdd/.test(c), `${f} : install global détecté`);
  }
});

test('Templates forges — inclus dans le tarball npm (templates/ whitelist)', async () => {
  const root = join(__dirname, '..');
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: root, encoding: 'utf-8' });
  assert.equal(r.status, 0);
  const j = JSON.parse(r.stdout);
  const files = (j[0]?.files || []).map((f) => f.path);
  for (const f of ['templates/forges/.gitlab-ci.aiad.yml',
                   'templates/forges/bitbucket-pipelines.aiad.yml',
                   'templates/forges/.drone.aiad.yml']) {
    assert.ok(files.includes(f), `${f} absent du tarball`);
  }
});
