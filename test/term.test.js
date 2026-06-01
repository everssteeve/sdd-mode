// Tests pour lib/term.js — palette + log helpers + respect NO_COLOR.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { COLORS, C, colorsEnabled, log, logCreation, logSection, logHeader, logStats } from '../lib/term.js';

function captureStdout(fn) {
  const orig = process.stdout.write.bind(process.stdout);
  let buf = '';
  process.stdout.write = (chunk) => {
    buf += chunk;
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = orig;
  }
  return buf;
}

test('COLORS expose les codes attendus', () => {
  assert.equal(typeof COLORS.vert, 'string');
  assert.equal(typeof COLORS.reset, 'string');
  // Alias C est strict equal de COLORS (même objet)
  assert.equal(C, COLORS);
});

test('COLORS — gel (immutabilité)', () => {
  assert.ok(Object.isFrozen(COLORS));
});

test('colorsEnabled() — booléen', () => {
  assert.equal(typeof colorsEnabled(), 'boolean');
});

test('log() — préfixe deux espaces + symbole + message', () => {
  const out = captureStdout(() => log('+', 'hello'));
  assert.match(out, /^ {2}\+ hello\n/);
});

test('logCreation() — symbole + colorisation conditionnelle', () => {
  const out = captureStdout(() => logCreation('foo.md'));
  // Doit contenir le chemin et un + comme symbole
  assert.match(out, /\+/);
  assert.match(out, /foo\.md/);
});

test('logSection() — titre encadré de sauts de ligne', () => {
  const out = captureStdout(() => logSection('Ma section'));
  // Tolérant aux séquences ANSI insérées entre `\n` et le titre.
  assert.match(out, /Ma section/);
  assert.ok(out.startsWith('\n'), 'doit commencer par un saut de ligne');
});

test('logHeader() — titre + sous-titre optionnel', () => {
  const out1 = captureStdout(() => logHeader('Titre'));
  assert.match(out1, /Titre/);

  const out2 = captureStdout(() => logHeader('Titre', 'Sous'));
  assert.match(out2, /Titre/);
  assert.match(out2, /Sous/);
});

test('logStats() — accepte un objet partiel et imprime les 4 compteurs', () => {
  const out = captureStdout(() => logStats({ created: 3, updated: 1 }));
  assert.match(out, /3 créé/);
  assert.match(out, /1 synchronisé/);
  // Champs absents => 0
  assert.match(out, /0 inchangé/);
  assert.match(out, /0 préservé/);
});

test('logStats() — sans argument utilise les défauts (0)', () => {
  const out = captureStdout(() => logStats());
  assert.match(out, /0 créé/);
});
