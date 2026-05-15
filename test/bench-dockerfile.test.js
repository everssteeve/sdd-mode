// Tests #179 — Structure du Dockerfile multi-stage du bench url-shortener.
// On ne builde pas l'image (Docker peut ne pas être dispo en CI Node), mais
// on valide les invariants structurels du Dockerfile et du compose prod.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BENCH = join(__dirname, '..', 'bench', 'scenario-autonomous-run', 'url-shortener');

test('Dockerfile — présent + multi-stage builder/runner', () => {
  const path = join(BENCH, 'Dockerfile');
  assert.ok(existsSync(path));
  const c = readFileSync(path, 'utf-8');
  assert.match(c, /FROM node:.*alpine AS builder/);
  assert.match(c, /FROM node:.*alpine AS runner/);
  assert.match(c, /COPY --from=builder/);
});

test('Dockerfile — user non-root + healthcheck applicatif', () => {
  const c = readFileSync(join(BENCH, 'Dockerfile'), 'utf-8');
  assert.match(c, /USER node/);
  assert.match(c, /HEALTHCHECK/);
  assert.match(c, /wget.*\/healthz/);
});

test('Dockerfile — copie ciblée src + node_modules (pas COPY .)', () => {
  const c = readFileSync(join(BENCH, 'Dockerfile'), 'utf-8');
  assert.match(c, /COPY .*src .*\/src/);
  // Pas de copie wildcard du contexte entier (vector d'inclusion accidentelle)
  assert.ok(!/^COPY \. /.test(c.split('\n').find((l) => l.trim().startsWith('COPY .')) || ''));
});

test('.dockerignore — exclut node_modules, dashboard, .git, tests', () => {
  const path = join(BENCH, '.dockerignore');
  assert.ok(existsSync(path));
  const c = readFileSync(path, 'utf-8');
  for (const motif of ['node_modules', 'dashboard', '.git', 'tests', '.env']) {
    assert.match(c, new RegExp(`^${motif.replace(/\./g, '\\.')}`, 'm'), `${motif} doit être ignoré`);
  }
});

test('docker-compose.prod.yml — référence le Dockerfile via build:', () => {
  const c = readFileSync(join(BENCH, 'docker-compose.prod.yml'), 'utf-8');
  assert.match(c, /build:/);
  assert.match(c, /dockerfile: Dockerfile/);
  assert.ok(!c.includes('npm install --no-audit'), 'plus de volume bind + npm install au runtime');
});
