// Tests #219 — Timeline historique santé projet.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  snapshotSante, lireHistorique, pruneHistorique, bucketsHebdomadaires, calculerEvolution, renduTimeline,
  snapshotHealth, readHistory, pruneHistory, weeklyBuckets, computeEvolution, renderTimeline,
} from '../lib/dashboard/sante-globale-history.js';

function tmpProjet() {
  return mkdtempSync(join(tmpdir(), 'aiad-sante-hist-'));
}

function fakeSante(score = 75, niveau = 'sain') {
  return {
    score, niveau,
    breakdown: [
      { id: 'maturite', points: 20, max: 20, disponible: true },
      { id: 'governance', points: 15, max: 20, disponible: true },
    ],
  };
}

test('snapshotSante — écrit .aiad/metrics/sante-globale/YYYY-MM-DD.json', () => {
  const racine = tmpProjet();
  try {
    const r = snapshotSante(racine, fakeSante(80, 'sain'), { date: '2026-05-13' });
    assert.equal(r.score, 80);
    const f = join(racine, '.aiad', 'metrics', 'sante-globale', '2026-05-13.json');
    assert.ok(existsSync(f));
    const lu = JSON.parse(readFileSync(f, 'utf-8'));
    assert.equal(lu.niveau, 'sain');
    assert.equal(lu.composantes.length, 2);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('snapshotSante — score=null skip (rien à snapshotter)', () => {
  const racine = tmpProjet();
  try {
    const r = snapshotSante(racine, { score: null });
    assert.equal(r, null);
    assert.equal(existsSync(join(racine, '.aiad', 'metrics', 'sante-globale')), false);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('snapshotSante — dryRun ne crée pas le fichier', () => {
  const racine = tmpProjet();
  try {
    snapshotSante(racine, fakeSante(80), { date: '2026-05-13', dryRun: true });
    assert.equal(existsSync(join(racine, '.aiad', 'metrics', 'sante-globale', '2026-05-13.json')), false);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('snapshotSante — idempotent même jour (réécrit)', () => {
  const racine = tmpProjet();
  try {
    snapshotSante(racine, fakeSante(70), { date: '2026-05-13' });
    snapshotSante(racine, fakeSante(85), { date: '2026-05-13' });
    const lu = JSON.parse(readFileSync(join(racine, '.aiad', 'metrics', 'sante-globale', '2026-05-13.json'), 'utf-8'));
    assert.equal(lu.score, 85);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lireHistorique — tri chrono ascendant', () => {
  const racine = tmpProjet();
  try {
    snapshotSante(racine, fakeSante(60), { date: '2026-04-01' });
    snapshotSante(racine, fakeSante(75), { date: '2026-05-13' });
    snapshotSante(racine, fakeSante(80), { date: '2026-04-15' });
    const h = lireHistorique(racine);
    assert.equal(h.length, 3);
    assert.deepEqual(h.map((s) => s.date), ['2026-04-01', '2026-04-15', '2026-05-13']);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lireHistorique — fichier hors pattern ignoré', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'sante-globale');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'random.json'), '{"score":50}');
    writeFileSync(join(dir, '2026-05-13.json'), '{"score":80,"niveau":"sain"}');
    const h = lireHistorique(racine);
    assert.equal(h.length, 1);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('pruneHistorique — retention 30j supprime les vieux', () => {
  const racine = tmpProjet();
  try {
    snapshotSante(racine, fakeSante(50), { date: '2026-02-01' });
    snapshotSante(racine, fakeSante(80), { date: '2026-05-13' });
    const r = pruneHistorique(racine, { retentionJours: 30, now: Date.parse('2026-05-13T00:00:00Z') });
    assert.deepEqual(r.pruned, ['2026-02-01']);
    assert.equal(r.kept, 1);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('bucketsHebdomadaires — vide → 12 buckets null', () => {
  const r = bucketsHebdomadaires([], { weeks: 12, now: Date.parse('2026-05-13T12:00:00Z') });
  assert.equal(r.length, 12);
  for (const b of r) {
    assert.equal(b.score, null);
  }
});

test('bucketsHebdomadaires — dispatch points UTC', () => {
  const now = Date.parse('2026-05-13T12:00:00Z');
  const historique = [
    { date: '2026-04-22', score: 60, niveau: 'attention' },
    { date: '2026-04-29', score: 70, niveau: 'sain' },
    { date: '2026-05-06', score: 75, niveau: 'sain' },
    { date: '2026-05-13', score: 85, niveau: 'excellent' },
  ];
  const r = bucketsHebdomadaires(historique, { weeks: 4, now });
  assert.deepEqual(r.map((b) => b.score), [60, 70, 75, 85]);
});

test('calculerEvolution — snapshot + lecture + tendance up', () => {
  const racine = tmpProjet();
  try {
    snapshotSante(racine, fakeSante(60), { date: '2026-04-22' });
    snapshotSante(racine, fakeSante(70), { date: '2026-04-29' });
    snapshotSante(racine, fakeSante(80), { date: '2026-05-06' });
    const r = calculerEvolution(racine, fakeSante(85), {
      date: '2026-05-13', now: Date.parse('2026-05-13T12:00:00Z'), weeks: 4,
    });
    assert.equal(r.snapshots, 4);
    assert.equal(r.tendance.sens, 'up');
    assert.ok(r.tendance.delta >= 20);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerEvolution — tendance flat si écart < 5', () => {
  const racine = tmpProjet();
  try {
    snapshotSante(racine, fakeSante(75), { date: '2026-04-22' });
    const r = calculerEvolution(racine, fakeSante(77), {
      date: '2026-05-13', now: Date.parse('2026-05-13T12:00:00Z'), weeks: 4,
    });
    assert.equal(r.tendance.sens, 'flat');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerEvolution — tendance down', () => {
  const racine = tmpProjet();
  try {
    snapshotSante(racine, fakeSante(90), { date: '2026-04-22' });
    const r = calculerEvolution(racine, fakeSante(60), {
      date: '2026-05-13', now: Date.parse('2026-05-13T12:00:00Z'), weeks: 4,
    });
    assert.equal(r.tendance.sens, 'down');
    assert.ok(r.tendance.delta <= -20);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('renduTimeline — vide → chaîne vide', () => {
  assert.equal(renduTimeline({ buckets: [] }), '');
  assert.equal(renduTimeline(null), '');
});

test('renduTimeline — SVG avec polyline + 3 lignes seuil + cercles', () => {
  const html = renduTimeline({
    snapshots: 3,
    buckets: [
      { semaine: '2026-04-29', score: 65, niveau: 'attention', samples: 1 },
      { semaine: '2026-05-06', score: 78, niveau: 'sain', samples: 1 },
      { semaine: '2026-05-13', score: 90, niveau: 'excellent', samples: 1 },
    ],
    tendance: { sens: 'up', delta: 25 },
  });
  assert.match(html, /<svg/);
  assert.match(html, /<polyline/);
  // 3 lignes de seuil (dashed)
  const dashedCount = (html.match(/stroke-dasharray="2,3"/g) || []).length;
  assert.equal(dashedCount, 3);
  // 3 cercles (1 par bucket avec score)
  const circleCount = (html.match(/<circle/g) || []).length;
  assert.equal(circleCount, 3);
  // Badge tendance up
  assert.match(html, /\+25 sur 3 sem/);
});

test('renduTimeline — gap (bucket null) ignoré pour cercles', () => {
  const html = renduTimeline({
    snapshots: 2,
    buckets: [
      { semaine: '2026-04-29', score: 65, samples: 1 },
      { semaine: '2026-05-06', score: null, samples: 0 },
      { semaine: '2026-05-13', score: 80, samples: 1 },
    ],
    tendance: { sens: 'up', delta: 15 },
  });
  const circleCount = (html.match(/<circle/g) || []).length;
  assert.equal(circleCount, 2, 'gap au milieu : 2 cercles seulement');
});

test('Alias EN canoniques', () => {
  assert.equal(snapshotHealth, snapshotSante);
  assert.equal(readHistory, lireHistorique);
  assert.equal(pruneHistory, pruneHistorique);
  assert.equal(weeklyBuckets, bucketsHebdomadaires);
  assert.equal(computeEvolution, calculerEvolution);
  assert.equal(renderTimeline, renduTimeline);
});
