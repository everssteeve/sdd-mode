// Tests télémétrie opt-in RGPD-compliant.
// Conventions :
//   - Le module utilise `os.homedir()` pour stocker l'état → on isole via
//     `process.env.HOME` (Node `os.homedir()` lit cette variable sur Unix).
//   - Tests sérialisés via `process.env.HOME` distinct par test.
//   - `track()` est fail-safe → on vérifie qu'aucune erreur ne remonte.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
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
  const fake = mkdtempSync(join(tmpdir(), 'aiad-tel-'));
  const origHome = process.env.HOME;
  process.env.HOME = fake;
  try {
    // Re-import dynamique pour que le module recharge homedir() — pas
    // nécessaire ici car on lit homedir() à chaque appel ; mais on garde
    // l'isolation HOME stricte.
    const mod = await import(`../lib/telemetry.js?cache=${Math.random()}`);
    await fn(mod, fake);
  } finally {
    process.env.HOME = origHome;
    rmSync(fake, { recursive: true, force: true });
  }
}

test('readState — défaut désactivé (RGPD : opt-in explicite)', () => withFakeHome(async (m) => {
  const state = m.readState();
  assert.equal(state.optIn, false);
  assert.equal(state.anonymousId, null);
}));

test('isOptedIn — false par défaut', () => withFakeHome(async (m) => {
  assert.equal(m.isOptedIn(), false);
}));

test('optIn — génère UUID anonyme + active', silencer(() => withFakeHome(async (m, home) => {
  const r = await m.optIn();
  assert.equal(r.optIn, true);
  assert.match(r.anonymousId, /^[0-9a-f]{8}-[0-9a-f]{4}-/);
  assert.ok(existsSync(join(home, '.aiad-sdd', 'telemetry.json')));
})));

test('optOut — supprime état + log local (droit à l\'effacement)', silencer(() => withFakeHome(async (m, home) => {
  await m.optIn();
  const stateFile = join(home, '.aiad-sdd', 'telemetry.json');
  assert.ok(existsSync(stateFile));
  await m.optOut();
  assert.ok(!existsSync(stateFile));
  assert.ok(!existsSync(join(home, '.aiad-sdd', 'events.jsonl')));
})));

test('track — silencieux et sans effet de bord quand opt-out', () => withFakeHome(async (m, home) => {
  // Pas d'opt-in → aucun fichier ne doit être créé
  m.track('command_run', { command: 'init' });
  assert.ok(!existsSync(join(home, '.aiad-sdd', 'events.jsonl')));
}));

test('track — écrit JSONL local quand opt-in', silencer(() => withFakeHome(async (m, home) => {
  await m.optIn();
  m.track('command_run', { command: 'init', version: '1.14.0' });
  const log = join(home, '.aiad-sdd', 'events.jsonl');
  assert.ok(existsSync(log));
  const ligne = readFileSync(log, 'utf-8').trim();
  const entree = JSON.parse(ligne);
  assert.equal(entree.event, 'command_run');
  assert.equal(entree.command, 'init');
  assert.equal(entree.version, '1.14.0');
  assert.match(entree.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(entree.anonymousId, /^[0-9a-f]{8}-/);
})));

test('track — fail-safe : ne lève jamais même sur input invalide', () => withFakeHome(async (m) => {
  // Aucun de ces appels ne doit throw
  m.track();
  m.track(null);
  m.track('e', null);
  m.track('e', undefined);
  m.track(123, { foo: 'bar' });
  // Pas d'erreur = test passe
  assert.ok(true);
}));

test('readState — survit à un fichier corrompu (fallback défaut)', () => withFakeHome(async (m, home) => {
  const dir = join(home, '.aiad-sdd');
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'telemetry.json'), '{ corrupted', 'utf-8');
  const state = m.readState();
  assert.equal(state.optIn, false);
}));

test('showStatus --json — surface stable', silencer(() => withFakeHome(async (m) => {
  await m.optIn();
  const orig = process.stdout.write.bind(process.stdout);
  let buf = '';
  process.stdout.write = (chunk) => { buf += chunk; return true; };
  try {
    await m.showStatus({ json: true });
  } finally {
    process.stdout.write = orig;
  }
  const parsed = JSON.parse(buf);
  assert.equal(parsed.optIn, true);
  assert.equal(typeof parsed.anonymousId, 'string');
})));

test('aucune IP / chemin projet collecté dans le payload track', silencer(() => withFakeHome(async (m, home) => {
  await m.optIn();
  m.track('command_run', { command: 'init', version: '1.14.0', runtimes: ['cursor'] });
  const ligne = JSON.parse(readFileSync(join(home, '.aiad-sdd', 'events.jsonl'), 'utf-8').trim());
  // Champs autorisés
  assert.deepEqual(Object.keys(ligne).sort(), ['anonymousId', 'command', 'event', 'runtimes', 'timestamp', 'version']);
  // Valeurs : pas d'IP-like, pas de cwd-like
  for (const v of Object.values(ligne)) {
    const s = String(v);
    assert.ok(!/^\/Users\/|^\/home\/|^C:\\\\/.test(s), `chemin projet leak : ${s}`);
    assert.ok(!/\d+\.\d+\.\d+\.\d+/.test(s) || s === '1.14.0', `IP-like leak : ${s}`);
  }
})));
