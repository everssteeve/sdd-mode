// Tests #172 — Structure du script start-bench.sh
// On ne lance pas le serveur (effets de bord système), on valide les
// invariants : présence, executable, et signaux clés.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', 'bench', 'scenario-autonomous-run', 'url-shortener', 'scripts', 'start-bench.sh');

test('start-bench.sh — présent + executable', () => {
  assert.ok(existsSync(SCRIPT));
  const mode = statSync(SCRIPT).mode;
  // bit owner-execute (0o100) doit être à 1
  assert.ok((mode & 0o100) === 0o100, `script non executable (mode ${mode.toString(8)})`);
});

test('start-bench.sh — kill PID file + fallback port :3091', () => {
  const c = readFileSync(SCRIPT, 'utf-8');
  assert.match(c, /PID_FILE=.*\.tinrly\.pid/);
  assert.match(c, /kill -0/);
  assert.match(c, /lsof.*iTCP:.*PORT/);
});

test('start-bench.sh — utilise tsx watch + attend /healthz', () => {
  const c = readFileSync(SCRIPT, 'utf-8');
  assert.match(c, /tsx.*--watch.*src\/server\.ts/);
  assert.match(c, /HEALTH_URL.*\/healthz/);
  assert.match(c, /wait_for_health/);
});

test('start-bench.sh — 3 modes : start (défaut), stop, --fg', () => {
  const c = readFileSync(SCRIPT, 'utf-8');
  assert.match(c, /case "\$\{1:-start\}" in/);
  assert.match(c, /\bstop\)/);
  assert.match(c, /--fg\|fg\)/);
});

test('start-bench.sh — idempotence : stop_existing avant chaque start', () => {
  const c = readFileSync(SCRIPT, 'utf-8');
  // Compte occurrences de stop_existing dans le case
  const occurrences = (c.match(/stop_existing/g) || []).length;
  assert.ok(occurrences >= 3, `stop_existing doit être appelé au moins 3x (def + start + fg + stop), trouvé ${occurrences}`);
});
