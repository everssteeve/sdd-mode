// Tests #150 — Enregistrement déploiement DORA.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { recordDeployment, recordDeploy, listerTagsGit, importDeploysFromGit } from '../lib/dora-record.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, '..', 'bin', 'aiad-sdd.js');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-dora-')); }

test('recordDeployment — status invalide → erreur explicite', () => {
  const d = tmp();
  try {
    assert.throws(
      () => recordDeployment(d, { status: 'broken' }),
      /status invalide/,
    );
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('recordDeployment — date malformée → erreur', () => {
  const d = tmp();
  try {
    assert.throws(
      () => recordDeployment(d, { status: 'success', date: '13/05/2026' }),
      /date invalide/,
    );
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('recordDeployment — écrit YYYY-MM-DD-deploy-NN.md avec champs DORA', () => {
  const d = tmp();
  try {
    const r = recordDeployment(d, {
      status: 'success',
      cycleTimeDays: 4.5,
      leadTimeDays: 8,
      version: 'v1.2.0',
      commit: 'abc1234',
      date: '2026-05-13',
    });
    assert.match(r.nom, /^2026-05-13-deploy-01\.md$/);
    const contenu = readFileSync(r.file, 'utf-8');
    assert.match(contenu, /- status: success/);
    assert.match(contenu, /- cycle_time_days: 4\.5/);
    assert.match(contenu, /- lead_time_days: 8/);
    assert.match(contenu, /- version: v1\.2\.0/);
    assert.match(contenu, /- commit: abc1234/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('recordDeployment — numérotation séquentielle (deploy-01, deploy-02…)', () => {
  const d = tmp();
  try {
    recordDeployment(d, { status: 'success', date: '2026-05-13' });
    recordDeployment(d, { status: 'hotfix', date: '2026-05-13' });
    const r3 = recordDeployment(d, { status: 'success', date: '2026-05-13' });
    assert.match(r3.nom, /^2026-05-13-deploy-03\.md$/);
    const fichiers = readdirSync(join(d, '.aiad', 'metrics', 'deployments')).sort();
    assert.deepEqual(fichiers, [
      '2026-05-13-deploy-01.md',
      '2026-05-13-deploy-02.md',
      '2026-05-13-deploy-03.md',
    ]);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('recordDeployment — champs optionnels omis → fichier minimaliste', () => {
  const d = tmp();
  try {
    const r = recordDeployment(d, { status: 'hotfix', date: '2026-05-13' });
    const contenu = readFileSync(r.file, 'utf-8');
    assert.match(contenu, /- status: hotfix/);
    assert.ok(!contenu.includes('cycle_time_days'));
    assert.ok(!contenu.includes('lead_time_days'));
    assert.ok(!contenu.includes('version'));
    assert.ok(!contenu.includes('commit'));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('recordDeploy — alias EN exposé', () => {
  assert.equal(recordDeploy, recordDeployment);
});

// ─── CLI ─────────────────────────────────────────────────────────────────────

test('cli `aiad-sdd dora --record --status=success` → écrit le fichier', () => {
  const d = tmp();
  try {
    const r = spawnSync('node', [BIN, 'dora', '--record', '--status=success', '--cycle=3', '--lead=7'], { cwd: d, encoding: 'utf-8' });
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.match(r.stdout, /Déploiement enregistré/);
    const fichiers = readdirSync(join(d, '.aiad', 'metrics', 'deployments'));
    assert.equal(fichiers.length, 1);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('cli `aiad-sdd dora` sans --record ni --import-git → exit 1 avec usage', () => {
  const d = tmp();
  try {
    const r = spawnSync('node', [BIN, 'dora'], { cwd: d, encoding: 'utf-8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Usage :/);
    assert.match(r.stderr, /--record/);
    assert.match(r.stderr, /--import-git/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('cli `aiad-sdd dora --record --status=unknown` → exit 1 + erreur', () => {
  const d = tmp();
  try {
    const r = spawnSync('node', [BIN, 'dora', '--record', '--status=unknown'], { cwd: d, encoding: 'utf-8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /status invalide/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('cli `aiad-sdd dora --record --status=success --json` → JSON', () => {
  const d = tmp();
  try {
    const r = spawnSync('node', [BIN, 'dora', '--record', '--status=success', '--json'], { cwd: d, encoding: 'utf-8' });
    assert.equal(r.status, 0);
    const data = JSON.parse(r.stdout);
    assert.equal(data.status, 'success');
    assert.match(data.nom, /\d{4}-\d{2}-\d{2}-deploy-01\.md/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── #185 dora --import-git ──────────────────────────────────────────────────

function setupGitRepo(dir) {
  spawnSync('git', ['init', '-q', '--initial-branch=main'], { cwd: dir });
  spawnSync('git', ['config', 'user.email', 'test@aiad.ovh'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
}

function commitAndTag(dir, tagName, env = {}) {
  // Crée un commit vide puis tag — utilise --allow-empty pour éviter de
  // toucher au filesystem.
  spawnSync('git', ['commit', '--allow-empty', '-m', `Release ${tagName}`], {
    cwd: dir, env: { ...process.env, ...env },
  });
  spawnSync('git', ['tag', tagName], { cwd: dir });
}

test('listerTagsGit — repo sans tag → []', () => {
  const d = tmp();
  try {
    setupGitRepo(d);
    assert.deepEqual(listerTagsGit(d), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerTagsGit — pas un repo Git → []', () => {
  const d = tmp();
  try {
    assert.deepEqual(listerTagsGit(d), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerTagsGit — N tags renvoyés ordonnés par creatordate', () => {
  const d = tmp();
  try {
    setupGitRepo(d);
    // GIT_COMMITTER_DATE permet de fixer l'horodatage pour les tests
    commitAndTag(d, 'v1.0.0', { GIT_AUTHOR_DATE: '2026-04-01T10:00:00', GIT_COMMITTER_DATE: '2026-04-01T10:00:00' });
    commitAndTag(d, 'v1.0.1-hotfix', { GIT_AUTHOR_DATE: '2026-04-02T10:00:00', GIT_COMMITTER_DATE: '2026-04-02T10:00:00' });
    commitAndTag(d, 'v1.1.0', { GIT_AUTHOR_DATE: '2026-04-10T10:00:00', GIT_COMMITTER_DATE: '2026-04-10T10:00:00' });
    const tags = listerTagsGit(d);
    assert.equal(tags.length, 3);
    assert.equal(tags[0].name, 'v1.0.0');
    assert.equal(tags[2].name, 'v1.1.0');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerTagsGit — filtre --since exclut tags antérieurs', () => {
  const d = tmp();
  try {
    setupGitRepo(d);
    commitAndTag(d, 'v0.1', { GIT_AUTHOR_DATE: '2026-03-01T10:00:00', GIT_COMMITTER_DATE: '2026-03-01T10:00:00' });
    commitAndTag(d, 'v0.2', { GIT_AUTHOR_DATE: '2026-04-15T10:00:00', GIT_COMMITTER_DATE: '2026-04-15T10:00:00' });
    const tags = listerTagsGit(d, { since: '2026-04-01' });
    assert.equal(tags.length, 1);
    assert.equal(tags[0].name, 'v0.2');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('importDeploysFromGit — détecte status=hotfix sur tag contenant "hotfix"', () => {
  const d = tmp();
  try {
    setupGitRepo(d);
    commitAndTag(d, 'v1.0.0', { GIT_AUTHOR_DATE: '2026-04-01T10:00:00', GIT_COMMITTER_DATE: '2026-04-01T10:00:00' });
    commitAndTag(d, 'v1.0.1-hotfix', { GIT_AUTHOR_DATE: '2026-04-03T10:00:00', GIT_COMMITTER_DATE: '2026-04-03T10:00:00' });
    const imported = importDeploysFromGit(d);
    assert.equal(imported.length, 2);
    assert.equal(imported[0].status, 'success');
    assert.equal(imported[1].status, 'hotfix');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('importDeploysFromGit — cycle_time_days calculé entre tags consécutifs', () => {
  const d = tmp();
  try {
    setupGitRepo(d);
    commitAndTag(d, 'v1.0', { GIT_AUTHOR_DATE: '2026-04-01T10:00:00', GIT_COMMITTER_DATE: '2026-04-01T10:00:00' });
    commitAndTag(d, 'v1.1', { GIT_AUTHOR_DATE: '2026-04-08T10:00:00', GIT_COMMITTER_DATE: '2026-04-08T10:00:00' });
    importDeploysFromGit(d);
    // Vérifie le 2e fichier généré (v1.1) contient cycle_time_days: 7
    const fs = readFileSync(join(d, '.aiad', 'metrics', 'deployments', readdirSync(join(d, '.aiad', 'metrics', 'deployments')).sort()[1]), 'utf-8');
    assert.match(fs, /cycle_time_days: 7/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('cli `aiad-sdd dora --import-git` sans repo → message amical', () => {
  const d = tmp();
  try {
    const r = spawnSync('node', [BIN, 'dora', '--import-git'], { cwd: d, encoding: 'utf-8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Aucun tag Git/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('cli `aiad-sdd dora --import-git` avec tags → liste imports', () => {
  const d = tmp();
  try {
    setupGitRepo(d);
    commitAndTag(d, 'v1.0', { GIT_AUTHOR_DATE: '2026-04-01T10:00:00', GIT_COMMITTER_DATE: '2026-04-01T10:00:00' });
    commitAndTag(d, 'v1.1-hotfix', { GIT_AUTHOR_DATE: '2026-04-02T10:00:00', GIT_COMMITTER_DATE: '2026-04-02T10:00:00' });
    const r = spawnSync('node', [BIN, 'dora', '--import-git'], { cwd: d, encoding: 'utf-8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /2 déploiement\(s\) importé/);
    assert.match(r.stdout, /tag v1\.0/);
    assert.match(r.stdout, /tag v1\.1-hotfix/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
