// Tests #180 — Validation E2E du docker-compose.prod.yml via test-compose-prod.sh.
//
// Par défaut : tests structurels (script présent + invariants) — toujours
// exécutés. Le test intégration (qui builde l'image et lance les containers)
// n'est exécuté que si DOCKER_E2E=1 (opt-in : trop lent pour la CI normale).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', 'bench', 'scenario-autonomous-run', 'url-shortener', 'scripts', 'test-compose-prod.sh');

test('test-compose-prod.sh — présent + executable', () => {
  assert.ok(existsSync(SCRIPT));
  const mode = statSync(SCRIPT).mode;
  assert.ok((mode & 0o100) === 0o100, `script non executable (mode ${mode.toString(8)})`);
});

test('test-compose-prod.sh — orchestre up/wait/down avec cleanup trap', () => {
  const c = readFileSync(SCRIPT, 'utf-8');
  // (#186) project name dédié pour isoler les volumes du dev
  assert.match(c, /docker compose -p tinrly-test-prod -f docker-compose\.yml -f docker-compose\.prod\.yml/);
  assert.match(c, /trap cleanup EXIT/);
  assert.match(c, /up -d/);
  assert.match(c, /down -v/);
});

test('test-compose-prod.sh — down+restore le compose dev autour du test (#186)', () => {
  const c = readFileSync(SCRIPT, 'utf-8');
  // Détection du dev avant le test
  assert.match(c, /DEV_WAS_UP/);
  // down du dev (libère les noms de containers) sans -v (volumes préservés)
  assert.match(c, /Down temporaire du compose dev/);
  // Restore après cleanup
  assert.match(c, /Restore du compose dev/);
});

test('test-compose-prod.sh — attend /healthz puis check ?deep=true', () => {
  const c = readFileSync(SCRIPT, 'utf-8');
  assert.match(c, /HEALTH_URL.*\/healthz/);
  assert.match(c, /\?deep=true/);
  assert.match(c, /MODE.*deep/);
  assert.match(c, /WRITABLE/);
});

test('test-compose-prod.sh — option --no-build pour réutiliser image', () => {
  const c = readFileSync(SCRIPT, 'utf-8');
  assert.match(c, /--no-build/);
  assert.match(c, /BUILD_FLAG/);
});

// Test intégration opt-in — exécution réelle du build + compose up.
// Coûteux (build npm install ≥ 1 min). Activé via DOCKER_E2E=1.
test('test-compose-prod.sh — run réel (opt-in DOCKER_E2E=1)', { skip: process.env.DOCKER_E2E !== '1' }, () => {
  const r = spawnSync('bash', [SCRIPT, '--no-build'], { encoding: 'utf-8', timeout: 120_000 });
  assert.equal(r.status, 0, `script failed:\nSTDOUT:\n${r.stdout}\nSTDERR:\n${r.stderr}`);
  assert.match(r.stdout, /✓ Test E2E compose prod réussi/);
});
