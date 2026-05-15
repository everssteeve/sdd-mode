// Tests #315 — Auto-détection `--source-base` depuis `git remote.origin.url`.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { parserGitUrl, detecterSourceBase, parseGitUrl, detectSourceBase } from '../lib/dashboard/source-base.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-sb-')); }

// ─── parserGitUrl — formes SSH ──────────────────────────────────────────────

test('parserGitUrl — SSH github (git@github.com:org/repo.git)', () => {
  assert.equal(parserGitUrl('git@github.com:aiad-ovh/aiad-sdd.git'),
    'https://github.com/aiad-ovh/aiad-sdd/blob/HEAD');
});

// (#323) Branche personnalisée
test('#323 parserGitUrl — branche custom remplace HEAD (github)', () => {
  assert.equal(parserGitUrl('git@github.com:o/r.git', 'main'),
    'https://github.com/o/r/blob/main');
  assert.equal(parserGitUrl('git@github.com:o/r.git', 'develop'),
    'https://github.com/o/r/blob/develop');
});

test('#323 parserGitUrl — branche custom (gitlab → /-/blob/branch)', () => {
  assert.equal(parserGitUrl('git@gitlab.com:o/r.git', 'master'),
    'https://gitlab.com/o/r/-/blob/master');
});

test('#323 parserGitUrl — branche custom (bitbucket → /src/branch)', () => {
  assert.equal(parserGitUrl('git@bitbucket.org:o/r.git', 'release-2026'),
    'https://bitbucket.org/o/r/src/release-2026');
});

test('#323 parserGitUrl — branche vide/whitespace → fallback HEAD', () => {
  assert.equal(parserGitUrl('git@github.com:o/r.git', ''),
    'https://github.com/o/r/blob/HEAD');
  assert.equal(parserGitUrl('git@github.com:o/r.git', '   '),
    'https://github.com/o/r/blob/HEAD');
  assert.equal(parserGitUrl('git@github.com:o/r.git', null),
    'https://github.com/o/r/blob/HEAD');
});

test('parserGitUrl — SSH github sans .git', () => {
  assert.equal(parserGitUrl('git@github.com:aiad-ovh/aiad-sdd'),
    'https://github.com/aiad-ovh/aiad-sdd/blob/HEAD');
});

test('parserGitUrl — SSH gitlab → /-/blob/HEAD', () => {
  assert.equal(parserGitUrl('git@gitlab.com:org/group/repo.git'),
    'https://gitlab.com/org/group/repo/-/blob/HEAD');
});

test('parserGitUrl — SSH bitbucket → /src/HEAD', () => {
  assert.equal(parserGitUrl('git@bitbucket.org:team/repo.git'),
    'https://bitbucket.org/team/repo/src/HEAD');
});

// ─── parserGitUrl — formes HTTPS ────────────────────────────────────────────

test('parserGitUrl — HTTPS github', () => {
  assert.equal(parserGitUrl('https://github.com/aiad-ovh/aiad-sdd.git'),
    'https://github.com/aiad-ovh/aiad-sdd/blob/HEAD');
});

test('parserGitUrl — HTTPS github sans .git', () => {
  assert.equal(parserGitUrl('https://github.com/aiad-ovh/aiad-sdd'),
    'https://github.com/aiad-ovh/aiad-sdd/blob/HEAD');
});

test('parserGitUrl — HTTPS avec user-info (user@host)', () => {
  assert.equal(parserGitUrl('https://token@github.com/o/r.git'),
    'https://github.com/o/r/blob/HEAD');
});

test('parserGitUrl — HTTPS gitlab.com nested groups', () => {
  assert.equal(parserGitUrl('https://gitlab.com/group/sub/repo.git'),
    'https://gitlab.com/group/sub/repo/-/blob/HEAD');
});

// ─── Cas de non-reconnaissance ─────────────────────────────────────────────

test('parserGitUrl — host non-reconnu (gitea, codeberg, self-hosted) → null', () => {
  assert.equal(parserGitUrl('git@gitea.example.com:org/repo.git'), null);
  assert.equal(parserGitUrl('https://codeberg.org/org/repo.git'), null);
});

test('parserGitUrl — chaîne invalide / vide / null → null', () => {
  assert.equal(parserGitUrl(''), null);
  assert.equal(parserGitUrl(null), null);
  assert.equal(parserGitUrl('not-a-url'), null);
  assert.equal(parserGitUrl(undefined), null);
  assert.equal(parserGitUrl(42), null);
});

// ─── detecterSourceBase — intégration git ──────────────────────────────────

test('detecterSourceBase — projet sans .git → null', () => {
  const d = tmp();
  try {
    assert.equal(detecterSourceBase(d), null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('detecterSourceBase — projet git avec remote github → URL dérivée', () => {
  const d = tmp();
  try {
    spawnSync('git', ['init', '-q'], { cwd: d });
    spawnSync('git', ['remote', 'add', 'origin', 'git@github.com:aiad-ovh/test.git'], { cwd: d });
    assert.equal(detecterSourceBase(d), 'https://github.com/aiad-ovh/test/blob/HEAD');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// (#323) detecterSourceBase avec branche custom
test('#323 detecterSourceBase — branche `main` substituée à HEAD', () => {
  const d = tmp();
  try {
    spawnSync('git', ['init', '-q'], { cwd: d });
    spawnSync('git', ['remote', 'add', 'origin', 'git@github.com:org/repo.git'], { cwd: d });
    assert.equal(detecterSourceBase(d, 'main'), 'https://github.com/org/repo/blob/main');
    assert.equal(detecterSourceBase(d, 'develop'), 'https://github.com/org/repo/blob/develop');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('detecterSourceBase — projet git sans remote → null', () => {
  const d = tmp();
  try {
    spawnSync('git', ['init', '-q'], { cwd: d });
    assert.equal(detecterSourceBase(d), null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── Alias EN canoniques (#42) ──────────────────────────────────────────────

test('Alias EN canoniques exposés', () => {
  assert.equal(parseGitUrl, parserGitUrl);
  assert.equal(detectSourceBase, detecterSourceBase);
});
