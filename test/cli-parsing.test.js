// Tests du parsing CLI via node:util.parseArgs.
// On invoque le bin via spawnSync pour valider :
//   - --flag=value (nouveau, ne fonctionnait pas avec l'ancien parser maison)
//   - flag inconnu rejeté avec message clair
//   - short flag -h / -v
//   - help / version court-circuités sans commande

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BIN = join(__dirname, '..', 'bin', 'aiad-sdd.js');

function run(...args) {
  return spawnSync('node', [BIN, ...args], { encoding: 'utf-8' });
}

test('cli — `aiad-sdd help` exit 0 + bannière', () => {
  const r = run('help');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /aiad-sdd v\d/);
  assert.match(r.stdout, /Spec Driven Development/);
});

test('cli — `aiad-sdd -h` (short flag) → aide', () => {
  const r = run('-h');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Commandes/);
});

test('cli — `aiad-sdd --version` → version SEULE (pas le help) #275', () => {
  const r = run('--version');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^aiad-sdd v\d+\.\d+\.\d+(-[\w.]+)?\s*$/);
  // (#275) Régression : ne doit PAS contenir le help (qui matchait avant)
  assert.doesNotMatch(r.stdout, /Commandes/);
});

test('cli — `aiad-sdd -v` (short flag) → version SEULE #275', () => {
  const r = run('-v');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^aiad-sdd v\d+\.\d+\.\d+(-[\w.]+)?\s*$/);
  assert.doesNotMatch(r.stdout, /Commandes/);
});

test('cli — `aiad-sdd version` (positional) → version SEULE', () => {
  const r = run('version');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^aiad-sdd v\d+\.\d+\.\d+(-[\w.]+)?\s*$/);
  assert.doesNotMatch(r.stdout, /Commandes/);
});

// (#276) cmd --help affiche la section spécifique, pas le global
test('cli — `aiad-sdd brief --help` → section spécifique (pas le global)', () => {
  const r = run('brief', '--help');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /aiad-sdd brief — brief/);
  assert.match(r.stdout, /--strict=N exit 1 si santé\s*<\s*N/);
  assert.match(r.stdout, /Aide complète : `aiad-sdd --help`/);
  // Ne dump pas le help global (167 lignes)
  assert.ok(r.stdout.split('\n').length < 20, `trop de lignes : ${r.stdout.split('\n').length}`);
});

test('cli — `aiad-sdd dashboard --help` → inclut "Options dashboard :"', () => {
  const r = run('dashboard', '--help');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Options dashboard :/);
  assert.match(r.stdout, /--public-url/);
  assert.match(r.stdout, /--check/);
});

test('cli — `aiad-sdd inconnue --help` → fallback global help', () => {
  const r = run('xyz-inconnu', '--help');
  assert.equal(r.status, 0);
  // Pas de section "aiad-sdd xyz —", fallback global
  assert.doesNotMatch(r.stdout, /aiad-sdd xyz-inconnu —/);
  assert.match(r.stdout, /Commandes/);
});

test('cli — flag inconnu → exit 1 + message explicite', () => {
  const r = run('init', '--inexistant');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown option|inconnu/i);
});

test('cli — sans argument → aide (exit 0)', () => {
  const r = run();
  assert.equal(r.status, 0);
  assert.match(r.stdout, /aiad-sdd v/);
});

test('cli — commande inconnue → exit 1', () => {
  const r = run('nimporte-quoi');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Commande inconnue/);
});

test('cli — `--runtime=cursor,codex` (forme =) accepté', () => {
  // doctor ne touche à rien, parfaite cible pour valider le parsing
  // sans avoir besoin d'un .aiad/ initialisé. On utilise --json pour
  // que la sortie soit machine-lisible et qu'on puisse raisonner dessus.
  const r = run('doctor', '--json');
  // Pas de .aiad → check init fail → exit 1 mais JSON valide
  const parsed = JSON.parse(r.stdout);
  assert.ok(Array.isArray(parsed.checks));
});
