// Tests de l'agrégat d'usage per-command (SPEC-015-1).
// @intent INTENT-015
// @spec SPEC-015-1-telemetrie-usage
//
// Conventions identiques à telemetry.test.js : isolation via process.env.HOME,
// re-import dynamique, silencer du stdout pour les rendus.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function silencer(fn) {
  return async (...args) => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { process.stdout.write = orig; }
  };
}

async function withFakeHome(fn) {
  const fake = mkdtempSync(join(tmpdir(), 'aiad-usage-'));
  const origHome = process.env.HOME;
  process.env.HOME = fake;
  try {
    const mod = await import(`../lib/telemetry.js?cache=${Math.random()}`);
    await fn(mod, fake);
  } finally {
    process.env.HOME = origHome;
    rmSync(fake, { recursive: true, force: true });
  }
}

// Active l'opt-in et pré-remplit events.jsonl avec des command_run.
function seed(home, commands) {
  const dir = join(home, '.aiad-sdd');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'telemetry.json'),
    JSON.stringify({ optIn: true, anonymousId: 'test-uuid', since: '2026-01-01T00:00:00.000Z' }) + '\n', 'utf-8');
  const log = join(dir, 'events.jsonl');
  let i = 0;
  for (const c of commands) {
    const ts = `2026-01-0${(i % 9) + 1}T00:00:00.000Z`;
    appendFileSync(log, JSON.stringify({ event: 'command_run', command: c, timestamp: ts, anonymousId: 'test-uuid' }) + '\n', 'utf-8');
    i++;
  }
  return log;
}

// CA-001 — agrégat per-command, tri décroissant.
test('aggregates per command', () => withFakeHome(async (m, home) => {
  seed(home, ['init', 'init', 'init', 'spec', 'spec', 'gate']);
  const agg = m.aggregateUsage(m.readEvents());
  assert.equal(agg.total, 6);
  assert.deepEqual(agg.commands.map((c) => c.command), ['init', 'spec', 'gate']);
  assert.equal(agg.commands[0].count, 3);
  assert.equal(agg.commands[0].rank, 1);
  assert.equal(agg.commands[0].share, 50);
}));

// CA-002 — aucune écriture, aucune collecte (lecture seule).
test('no network no write', () => withFakeHome(async (m, home) => {
  const log = seed(home, ['init', 'spec']);
  const { statSync } = await import('node:fs');
  const before = statSync(log).size;
  m.readEvents();
  m.aggregateUsage(m.readEvents());
  const after = statSync(log).size;
  assert.equal(before, after, 'le log local ne doit pas grossir (lecture seule)');
}));

// CA-003 — sortie JSON : exactement un objet, rien d'autre.
test('json shape', () => withFakeHome(async (m, home) => {
  seed(home, ['init', 'init', 'spec']);
  const orig = process.stdout.write.bind(process.stdout);
  let buf = '';
  process.stdout.write = (chunk) => { buf += chunk; return true; };
  try {
    await m.showUsage({ json: true });
  } finally {
    process.stdout.write = orig;
  }
  const parsed = JSON.parse(buf); // throw si ce n'est pas un seul objet JSON
  assert.equal(parsed.total, 3);
  assert.ok(Array.isArray(parsed.commands));
  assert.deepEqual(Object.keys(parsed).sort(), ['commands', 'since', 'total', 'until']);
  assert.deepEqual(Object.keys(parsed.commands[0]).sort(), ['class', 'command', 'count', 'rank', 'share']);
}));

// CA-004 — classification core / longue-traîne sur la queue ≤ 20 % cumulés.
test('long-tail classification', () => withFakeHome(async (m, home) => {
  // 'init' 80 % ; 'spec','gate','trace' = 3 commandes rares formant la queue.
  const cmds = [];
  for (let i = 0; i < 16; i++) cmds.push('init');
  cmds.push('spec', 'gate', 'trace', 'audit'); // 4 × 1 = 4/20 = 20 % cumulés
  seed(home, cmds);
  const agg = m.aggregateUsage(m.readEvents());
  const byCmd = Object.fromEntries(agg.commands.map((c) => [c.command, c.class]));
  assert.equal(byCmd.init, 'core');
  // La queue cumulant ≤ 20 % est classée longue-traîne.
  assert.equal(byCmd.audit, 'longue-traîne');
  assert.equal(byCmd.trace, 'longue-traîne');
}));

// CA-005 — opt-out / vide → message, pas d'objet, exit 0 implicite.
test('empty dataset message', silencer(() => withFakeHome(async (m) => {
  // Jamais opté-in → readEvents vide.
  const agg = await m.showUsage({ json: false });
  assert.equal(agg.total, 0);
  assert.deepEqual(agg.commands, []);
})));

// CA-005 (variante) — opted-in mais aucun événement → message « collecté », total 0.
test('empty dataset message — opted-in without events', silencer(() => withFakeHome(async (m, home) => {
  const dir = join(home, '.aiad-sdd');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'telemetry.json'),
    JSON.stringify({ optIn: true, anonymousId: 'test-uuid', since: '2026-01-01T00:00:00.000Z' }) + '\n', 'utf-8');
  // Pas de events.jsonl → readEvents() vide alors qu'on est opted-in.
  const agg = await m.showUsage({ json: false });
  assert.equal(agg.total, 0);
  assert.deepEqual(agg.commands, []);
})));

// CA-003 (variante) — JSON reste un objet stable même sur jeu vide.
test('json shape — empty dataset still emits one object', () => withFakeHome(async (m) => {
  const orig = process.stdout.write.bind(process.stdout);
  let buf = '';
  process.stdout.write = (chunk) => { buf += chunk; return true; };
  try {
    await m.showUsage({ json: true }); // jamais opté-in → vide
  } finally {
    process.stdout.write = orig;
  }
  const parsed = JSON.parse(buf);
  assert.equal(parsed.total, 0);
  assert.deepEqual(parsed.commands, []);
  assert.deepEqual(Object.keys(parsed).sort(), ['commands', 'since', 'total', 'until']);
}));

// CA-006 — lignes corrompues / sans command ignorées, le reste agrégé.
test('skips corrupt lines', () => withFakeHome(async (m, home) => {
  const log = seed(home, ['init', 'init']);
  appendFileSync(log, '{ ceci n est pas du json\n', 'utf-8');
  appendFileSync(log, JSON.stringify({ event: 'command_run', timestamp: '2026-01-01T00:00:00.000Z' }) + '\n', 'utf-8'); // pas de command
  appendFileSync(log, JSON.stringify({ event: 'other', command: 'spec' }) + '\n', 'utf-8'); // pas command_run
  appendFileSync(log, JSON.stringify({ event: 'command_run', command: 'gate', timestamp: '2026-01-02T00:00:00.000Z' }) + '\n', 'utf-8');
  const events = m.readEvents();
  assert.equal(events.length, 3); // 2× init + 1× gate, le reste ignoré
  const agg = m.aggregateUsage(events);
  assert.equal(agg.total, 3);
}));

// CA-007 — tie-break alphabétique déterministe sur count égal.
test('deterministic tie-break', () => withFakeHome(async (m, home) => {
  seed(home, ['zeta', 'alpha', 'mike']); // 1 chacun
  const agg = m.aggregateUsage(m.readEvents());
  assert.deepEqual(agg.commands.map((c) => c.command), ['alpha', 'mike', 'zeta']);
}));

// CA-008 — succès renvoie un agrégat (pas d'exception), y compris non-vide.
test('exits 0 on success', silencer(() => withFakeHome(async (m, home) => {
  seed(home, ['init', 'spec']);
  const agg = await m.showUsage({ json: false });
  assert.equal(agg.total, 2);
})));
