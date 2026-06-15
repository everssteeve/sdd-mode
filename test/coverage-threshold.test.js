// Tests `scripts/coverage-threshold.js` — fonctions pures du gate de couverture
// et de génération du badge (SPEC-014-1 / INTENT-014).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  badgeColor,
  buildBadge,
  parseCoverage,
  echecsSeuils,
} from '../scripts/coverage-threshold.js';

// ─── badgeColor — palette shields.io (bornes) ────────────────────────────────

test('badgeColor — bornes de la palette shields.io', () => {
  assert.equal(badgeColor(100), 'brightgreen');
  assert.equal(badgeColor(90), 'brightgreen');
  assert.equal(badgeColor(89.99), 'green');
  assert.equal(badgeColor(80), 'green');
  assert.equal(badgeColor(79.9), 'yellowgreen');
  assert.equal(badgeColor(70), 'yellowgreen');
  assert.equal(badgeColor(69), 'yellow');
  assert.equal(badgeColor(60), 'yellow');
  assert.equal(badgeColor(59), 'orange');
  assert.equal(badgeColor(50), 'orange');
  assert.equal(badgeColor(49), 'red');
  assert.equal(badgeColor(0), 'red');
});

// ─── buildBadge — format endpoint shields.io ─────────────────────────────────

test('buildBadge — schéma endpoint shields.io valide', () => {
  const b = buildBadge(96.21);
  assert.equal(b.schemaVersion, 1);
  assert.equal(b.label, 'coverage');
  assert.equal(b.message, '96%'); // tronqué (Math.floor), pas arrondi
  assert.equal(b.color, 'brightgreen');
});

test('buildBadge — tronque vers le bas (pas d\'arrondi optimiste)', () => {
  assert.equal(buildBadge(89.99).message, '89%');
  assert.equal(buildBadge(89.99).color, 'green');
});

// ─── parseCoverage — extraction de la ligne agrégée ──────────────────────────

test('parseCoverage — extrait lines/branches/funcs de la ligne "all files"', () => {
  const out = 'ℹ all files | 96.21 | 83.68 | 94.15 |\n';
  assert.deepEqual(parseCoverage(out), { lines: 96.21, branches: 83.68, funcs: 94.15 });
});

test('parseCoverage — null si rapport agrégé absent', () => {
  assert.equal(parseCoverage('aucune ligne agrégée ici'), null);
});

// ─── echecsSeuils — détection des seuils non respectés ───────────────────────

const SEUILS = { lines: 75, branches: 70, funcs: 65 };

test('echecsSeuils — vide quand tout est conforme', () => {
  assert.deepEqual(echecsSeuils({ lines: 96, branches: 84, funcs: 94 }, SEUILS), []);
});

test('echecsSeuils — signale chaque métrique sous le seuil', () => {
  const e = echecsSeuils({ lines: 70, branches: 60, funcs: 50 }, SEUILS);
  assert.equal(e.length, 3);
  assert.match(e[0], /lines 70/);
  assert.match(e[1], /branches 60/);
  assert.match(e[2], /funcs 50/);
});

test('echecsSeuils — seuil atteint pile = conforme (>=)', () => {
  assert.deepEqual(echecsSeuils({ lines: 75, branches: 70, funcs: 65 }, SEUILS), []);
});
