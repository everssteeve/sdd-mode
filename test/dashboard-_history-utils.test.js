// Tests #220 — Helpers communs pour modules history.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  lireRetention, ensureHistoryDir, lireHistorique, pruneHistorique, bucketsHebdomadaires,
  readRetention, ensureHistoryDirEN, readHistory, pruneHistory, weeklyBuckets,
} from '../lib/dashboard/_history-utils.js';

function tmpProjet() {
  return mkdtempSync(join(tmpdir(), 'aiad-hist-utils-'));
}

// ─── lireRetention ──────────────────────────────────────────────────────────

test('lireRetention — sans config.json → défaut 180j', () => {
  assert.equal(lireRetention(tmpProjet()), 180);
});

test('lireRetention — config.json#dashboard.retentionJours pris en compte', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'config.json'), JSON.stringify({ dashboard: { retentionJours: 60 } }));
    assert.equal(lireRetention(racine), 60);
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

test('lireRetention — JSON cassé → fallback 180j', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'config.json'), '{ not json');
    assert.equal(lireRetention(racine), 180);
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

// ─── ensureHistoryDir ───────────────────────────────────────────────────────

test('ensureHistoryDir — crée le dossier récursif si absent', () => {
  const racine = tmpProjet();
  try {
    const dir = ensureHistoryDir(racine, ['.aiad', 'metrics', 'demo']);
    assert.ok(existsSync(dir));
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

test('ensureHistoryDir — idempotent si déjà existant', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad', 'metrics', 'demo'), { recursive: true });
    const dir = ensureHistoryDir(racine, ['.aiad', 'metrics', 'demo']);
    assert.ok(existsSync(dir));
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

test('ensureHistoryDir — string OU array supporté', () => {
  const racine = tmpProjet();
  try {
    const dir = ensureHistoryDir(racine, '.aiad/metrics/x');
    assert.ok(existsSync(dir));
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

// ─── lireHistorique ─────────────────────────────────────────────────────────

test('lireHistorique — sans dossier → []', () => {
  assert.deepEqual(lireHistorique(tmpProjet(), '.aiad/metrics/x'), []);
});

test('lireHistorique — tri chrono asc + date injectée', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'demo');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2026-05-13.json'), '{"score":80}');
    writeFileSync(join(dir, '2026-04-01.json'), '{"score":60}');
    writeFileSync(join(dir, '2026-05-01.json'), '{"date":"2026-05-01","score":70}');
    const h = lireHistorique(racine, '.aiad/metrics/demo');
    assert.deepEqual(h.map((d) => d.date), ['2026-04-01', '2026-05-01', '2026-05-13']);
    // date injectée pour celui qui n'en avait pas
    assert.equal(h[0].date, '2026-04-01');
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

test('lireHistorique — fichier hors pattern YYYY-MM-DD.json ignoré', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'demo');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'random.json'), '{"score":50}');
    writeFileSync(join(dir, '2026-05-13.json'), '{"score":80}');
    const h = lireHistorique(racine, '.aiad/metrics/demo');
    assert.equal(h.length, 1);
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

test('lireHistorique — JSON cassé ignoré sans crash', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'demo');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2026-05-13.json'), '{ not json');
    writeFileSync(join(dir, '2026-05-12.json'), '{"score":50}');
    const h = lireHistorique(racine, '.aiad/metrics/demo');
    assert.equal(h.length, 1);
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

test('lireHistorique — array sousChemin équivalent à string', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'demo');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2026-05-13.json'), '{"score":80}');
    const h1 = lireHistorique(racine, '.aiad/metrics/demo');
    const h2 = lireHistorique(racine, ['.aiad', 'metrics', 'demo']);
    assert.deepEqual(h1, h2);
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

// ─── pruneHistorique ────────────────────────────────────────────────────────

test('pruneHistorique — sans dossier → {pruned:[], kept:0}', () => {
  const r = pruneHistorique(tmpProjet(), '.aiad/metrics/x');
  assert.deepEqual(r, { pruned: [], kept: 0 });
});

test('pruneHistorique — retentionJours=30 supprime les vieux', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'demo');
    mkdirSync(dir, { recursive: true });
    const now = Date.parse('2026-05-13T12:00:00Z');
    writeFileSync(join(dir, '2026-02-01.json'), '{}'); // 100j
    writeFileSync(join(dir, '2026-04-20.json'), '{}'); // 23j
    writeFileSync(join(dir, '2026-05-13.json'), '{}'); // 0j
    const r = pruneHistorique(racine, '.aiad/metrics/demo', { retentionJours: 30, now });
    assert.deepEqual(r.pruned, ['2026-02-01']);
    assert.equal(r.kept, 2);
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

test('pruneHistorique — before prend précédence', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'demo');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2026-04-01.json'), '{}');
    writeFileSync(join(dir, '2026-05-01.json'), '{}');
    const r = pruneHistorique(racine, '.aiad/metrics/demo', { before: '2026-04-15', retentionJours: 9999 });
    assert.deepEqual(r.pruned, ['2026-04-01']);
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

test('pruneHistorique — dryRun ne supprime pas', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'demo');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2025-01-01.json'), '{}');
    const r = pruneHistorique(racine, '.aiad/metrics/demo', { retentionJours: 30, now: Date.parse('2026-05-13T00:00:00Z'), dryRun: true });
    assert.deepEqual(r.pruned, ['2025-01-01']);
    assert.ok(existsSync(join(dir, '2025-01-01.json')));
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

// ─── bucketsHebdomadaires ────────────────────────────────────────────────────

test('bucketsHebdomadaires — vide → N buckets null', () => {
  const r = bucketsHebdomadaires([], { weeks: 4, now: Date.parse('2026-05-13T12:00:00Z') });
  assert.equal(r.length, 4);
  for (const b of r) {
    assert.equal(b.samples, 0);
    assert.equal(b.valeur, null);
  }
});

test('bucketsHebdomadaires — dispatch UTC + extract custom', () => {
  const now = Date.parse('2026-05-13T12:00:00Z');
  const points = [
    { date: '2026-04-22', score: 60, niveau: 'attention' },
    { date: '2026-04-29', score: 70, niveau: 'sain' },
    { date: '2026-05-06', score: 75, niveau: 'sain' },
    { date: '2026-05-13', score: 85, niveau: 'excellent' },
  ];
  const r = bucketsHebdomadaires(points, {
    weeks: 4, now,
    extract: (p) => ({ score: p.score, niveau: p.niveau }),
  });
  assert.deepEqual(r.map((b) => b.score), [60, 70, 75, 85]);
  assert.equal(r[3].niveau, 'excellent');
});

test('bucketsHebdomadaires — multi-points même semaine → dernier prend', () => {
  const now = Date.parse('2026-05-13T12:00:00Z');
  const points = [
    { date: '2026-05-11', score: 50 },
    { date: '2026-05-12', score: 70 },
    { date: '2026-05-13', score: 85 },
  ];
  const r = bucketsHebdomadaires(points, {
    weeks: 1, now, extract: (p) => ({ score: p.score }),
  });
  assert.equal(r[0].score, 85);
  assert.equal(r[0].samples, 3);
});

test('bucketsHebdomadaires — baseEntry mergé', () => {
  const r = bucketsHebdomadaires([], {
    weeks: 2, now: Date.parse('2026-05-13T12:00:00Z'),
    baseEntry: { num: null, actuel: null },
  });
  for (const b of r) {
    assert.equal(b.num, null);
    assert.equal(b.actuel, null);
  }
});

test('bucketsHebdomadaires — extract retourne primitive → champ "valeur"', () => {
  const points = [{ date: '2026-05-13', score: 80 }];
  const r = bucketsHebdomadaires(points, {
    weeks: 1, now: Date.parse('2026-05-13T12:00:00Z'),
    extract: (p) => p.score, // retourne 80 (number, pas object)
  });
  assert.equal(r[0].valeur, 80);
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN canoniques', () => {
  assert.equal(readRetention, lireRetention);
  assert.equal(ensureHistoryDirEN, ensureHistoryDir);
  assert.equal(readHistory, lireHistorique);
  assert.equal(pruneHistory, pruneHistorique);
  assert.equal(weeklyBuckets, bucketsHebdomadaires);
});
