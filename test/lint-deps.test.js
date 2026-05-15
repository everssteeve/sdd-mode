// Tests `scripts/lint-deps.js` — garde-fou zero-dep runtime.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { evaluerZeroDep, formatRapport } from '../scripts/lint-deps.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', 'scripts', 'lint-deps.js');

// ─── evaluerZeroDep ─────────────────────────────────────────────────────────

test('evaluerZeroDep — package vide → ok', () => {
  const r = evaluerZeroDep({});
  assert.equal(r.ok, true);
  assert.deepEqual(r.runtimeDeps, []);
  assert.deepEqual(r.peerDeps, []);
});

test('evaluerZeroDep — uniquement devDependencies → ok', () => {
  const r = evaluerZeroDep({ devDependencies: { vitest: '^1.0.0', typescript: '^5.0.0' } });
  assert.equal(r.ok, true);
});

test('evaluerZeroDep — dependencies non vide → !ok', () => {
  const r = evaluerZeroDep({ dependencies: { lodash: '^4.0.0' } });
  assert.equal(r.ok, false);
  assert.deepEqual(r.runtimeDeps, ['lodash']);
});

test('evaluerZeroDep — peerDependencies non vide → !ok', () => {
  const r = evaluerZeroDep({ peerDependencies: { react: '^18' } });
  assert.equal(r.ok, false);
  assert.deepEqual(r.peerDeps, ['react']);
});

test('evaluerZeroDep — optionalDependencies non vide → !ok', () => {
  const r = evaluerZeroDep({ optionalDependencies: { fsevents: '^2' } });
  assert.equal(r.ok, false);
  assert.deepEqual(r.optionalDeps, ['fsevents']);
});

test('evaluerZeroDep — bundledDependencies non vide → !ok', () => {
  const r = evaluerZeroDep({ bundledDependencies: ['embedded-lib'] });
  assert.equal(r.ok, false);
  assert.deepEqual(r.bundledDeps, ['embedded-lib']);
});

test('evaluerZeroDep — supporte aussi bundleDependencies (alias npm)', () => {
  const r = evaluerZeroDep({ bundleDependencies: ['embedded-lib'] });
  assert.equal(r.ok, false);
  assert.deepEqual(r.bundledDeps, ['embedded-lib']);
});

test('evaluerZeroDep — agrège plusieurs catégories d\'erreur', () => {
  const r = evaluerZeroDep({
    dependencies: { a: '1' },
    peerDependencies: { b: '2' },
    optionalDependencies: { c: '3' },
  });
  assert.equal(r.ok, false);
  assert.equal(r.runtimeDeps.length, 1);
  assert.equal(r.peerDeps.length, 1);
  assert.equal(r.optionalDeps.length, 1);
});

// ─── formatRapport ──────────────────────────────────────────────────────────

test('formatRapport — ok → message court positif', () => {
  const r = formatRapport({ ok: true, runtimeDeps: [], peerDeps: [], optionalDeps: [], bundledDeps: [] });
  assert.match(r, /✓.*Zero-dep runtime préservé/);
});

test('formatRapport — !ok dependencies → liste les deps en cause', () => {
  const r = formatRapport({
    ok: false, runtimeDeps: ['lodash', 'axios'],
    peerDeps: [], optionalDeps: [], bundledDeps: [],
  });
  assert.match(r, /VIOLÉ/);
  assert.match(r, /lodash, axios/);
  assert.match(r, /cap zero-dep/i);
});

test('formatRapport — guide explicitement le contributeur', () => {
  const r = formatRapport({
    ok: false, runtimeDeps: ['x'], peerDeps: [], optionalDeps: [], bundledDeps: [],
  });
  assert.match(r, /justifie l'écart dans le PR/);
  assert.match(r, /accord du mainteneur/);
});

// ─── CLI ────────────────────────────────────────────────────────────────────

test('CLI — exit 0 sur le repo réel (zero-dep préservé)', () => {
  const r = spawnSync('node', [SCRIPT], { encoding: 'utf-8' });
  assert.equal(r.status, 0, `stderr=${r.stderr}\nstdout=${r.stdout}`);
  assert.match(r.stdout, /Zero-dep runtime préservé/);
});

// ─── Méta : aucune dependency runtime dans le repo ──────────────────────────

test('package.json — dependencies est vide ou absent', async () => {
  const { readFileSync } = await import('node:fs');
  const pkgPath = join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  // Cap stratégique : ne JAMAIS introduire de runtime dep.
  assert.ok(
    !pkg.dependencies || Object.keys(pkg.dependencies).length === 0,
    `Dependencies runtime non vides : ${JSON.stringify(pkg.dependencies)}`,
  );
  assert.ok(!pkg.peerDependencies || Object.keys(pkg.peerDependencies).length === 0);
  assert.ok(!pkg.optionalDependencies || Object.keys(pkg.optionalDependencies).length === 0);
});
