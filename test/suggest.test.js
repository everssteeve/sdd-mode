// Tests `lib/suggest.js` — Levenshtein + suggestions "did you mean…"
// + intégration CLI (commande inconnue, flag inconnu).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  levenshtein,
  suggererProches,
  indiceVoulaisTuDire,
  findClosest,
  didYouMean,
} from '../lib/suggest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, '..', 'bin', 'aiad-sdd.js');

// ─── levenshtein ────────────────────────────────────────────────────────────

test('levenshtein — distance 0 sur égalité', () => {
  assert.equal(levenshtein('foo', 'foo'), 0);
  assert.equal(levenshtein('', ''), 0);
});

test('levenshtein — chaînes vides', () => {
  assert.equal(levenshtein('', 'abc'), 3);
  assert.equal(levenshtein('abc', ''), 3);
});

test('levenshtein — substitution simple', () => {
  assert.equal(levenshtein('cat', 'cot'), 1);
  assert.equal(levenshtein('cat', 'dog'), 3);
});

test('levenshtein — insertion / suppression', () => {
  assert.equal(levenshtein('abc', 'abcd'), 1);
  assert.equal(levenshtein('abcd', 'abc'), 1);
});

test('levenshtein — exemples classiques', () => {
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(levenshtein('saturday', 'sunday'), 3);
  assert.equal(levenshtein('flaw', 'lawn'), 2);
});

test('levenshtein — symétrique', () => {
  for (const [a, b] of [['foo', 'bar'], ['init', 'inti'], ['', 'x'], ['abcdef', 'fedcba']]) {
    assert.equal(levenshtein(a, b), levenshtein(b, a), `${a}/${b} non symétrique`);
  }
});

// ─── suggererProches ────────────────────────────────────────────────────────

test('suggererProches — typo simple → match exact', () => {
  const cmds = ['status', 'doctor', 'init', 'update'];
  assert.deepEqual(suggererProches('statu', cmds), ['status']);
  assert.deepEqual(suggererProches('docotr', cmds), ['doctor']);
  assert.deepEqual(suggererProches('iint', cmds), ['init']);
});

test('suggererProches — saisie identique → la même chaîne', () => {
  assert.deepEqual(suggererProches('status', ['status', 'init']), ['status']);
});

test('suggererProches — saisie totalement éloignée → []', () => {
  const cmds = ['status', 'doctor', 'init'];
  assert.deepEqual(suggererProches('zzzzzzz', cmds), []);
});

test('suggererProches — max contrôle le nombre de retours', () => {
  const cmds = ['init', 'inti', 'inta', 'lint', 'tint'];
  const r = suggererProches('init', cmds, { max: 3 });
  assert.equal(r.length, 3);
  assert.equal(r[0], 'init');
});

test('suggererProches — saisie vide / liste vide → []', () => {
  assert.deepEqual(suggererProches('', ['x']), []);
  assert.deepEqual(suggererProches('x', []), []);
  assert.deepEqual(suggererProches(null, ['x']), []);
});

test('suggererProches — seuil custom respecté', () => {
  const cmds = ['status'];
  // Distance(stt, status) = 3 ; seuil par défaut pour 'stt' (len 3) = max(2, 1) = 2 → exclus
  assert.deepEqual(suggererProches('stt', cmds), []);
  // Avec seuil 4 → inclus
  assert.deepEqual(suggererProches('stt', cmds, { seuil: 4 }), ['status']);
});

test('suggererProches — tri par distance puis alpha', () => {
  // alfb(d=1), beta(d=3), cota(d=3) → 'alfb' premier, puis 'beta' < 'cota' alpha
  const r = suggererProches('alfa', ['cota', 'alfb', 'beta'], { max: 3, seuil: 5 });
  assert.deepEqual(r, ['alfb', 'beta', 'cota']);
});

// ─── indiceVoulaisTuDire ────────────────────────────────────────────────────

test('indiceVoulaisTuDire — 1 suggestion → message simple', () => {
  const r = indiceVoulaisTuDire('docotr', ['doctor', 'init']);
  assert.match(r, /Voulais-tu dire `doctor` \?/);
});

test('indiceVoulaisTuDire — 2 suggestions → joint avec "ou"', () => {
  const cmds = ['init', 'inti', 'inta'];
  const r = indiceVoulaisTuDire('iint', cmds, { max: 2 });
  // init (d=1) puis inta/inti (d=2)
  assert.match(r, /Voulais-tu dire `init` ou `\w+` \?/);
});

test('indiceVoulaisTuDire — aucune suggestion → chaîne vide', () => {
  assert.equal(indiceVoulaisTuDire('xyzlmnop', ['status']), '');
});

test('indiceVoulaisTuDire — préfixe custom', () => {
  const r = indiceVoulaisTuDire('rutnime', ['runtime'], { prefix: 'Voulais-tu écrire' });
  assert.match(r, /Voulais-tu écrire `runtime` \?/);
});

// ─── alias EN ───────────────────────────────────────────────────────────────

test('alias EN — findClosest / didYouMean exportés', () => {
  assert.equal(findClosest, suggererProches);
  assert.equal(didYouMean, indiceVoulaisTuDire);
});

// ─── intégration CLI ────────────────────────────────────────────────────────

function run(args) {
  return spawnSync('node', [BIN, ...args], { encoding: 'utf-8' });
}

test('CLI — commande proche d\'une commande valide → suggestion + exit 1', () => {
  const r = run(['statu']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Commande inconnue : "statu"/);
  assert.match(r.stderr, /Voulais-tu dire `status` \?/);
});

test('CLI — commande très éloignée → pas de suggestion + exit 1', () => {
  const r = run(['zzzzzz']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Commande inconnue/);
  // Pas de suggestion pour zzzzzz
  assert.ok(!/Voulais-tu dire/.test(r.stderr), 'suggestion non attendue');
});

test('CLI — flag inconnu proche d\'un flag valide → suggestion préfixée --', () => {
  const r = run(['init', '--intercative']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Voulais-tu écrire `--interactive` \?/);
});

test('CLI — flag inconnu sans match proche → message Node sans suggestion', () => {
  const r = run(['init', '--xyzqwerty']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown option/);
  assert.ok(!/Voulais-tu écrire/.test(r.stderr), 'suggestion non attendue');
});
