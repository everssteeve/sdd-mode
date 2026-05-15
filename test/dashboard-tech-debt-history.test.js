// Tests #198 — Snapshot + timeline dette technique 4 semaines.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  snapshotTechDebt, lireHistorique, bucketsHebdomadaires, calculerEvolution, renduTimeline, pruneHistorique,
  snapshotTechDebtEN, readHistory, weeklyBuckets, computeEvolution, renderTimeline, pruneHistory,
} from '../lib/dashboard/tech-debt-history.js';

function tmpProjet() {
  return mkdtempSync(join(tmpdir(), 'aiad-debthist-'));
}

function fakeDebt(jnsp = 3, grosses = 1, warning = 0, stale = 0) {
  return {
    seuilLoc: 200, seuilLocWarn: 100,
    jnsp: { total: jnsp, parAge: { stale, recent: jnsp - stale, medium: 0, unknown: 0 }, markers: [] },
    specsGrosses: { total: grosses, entrees: [] },
    specsWarning: { total: warning, entrees: [] },
  };
}

test('snapshotTechDebt — écrit .aiad/metrics/tech-debt/YYYY-MM-DD.json', () => {
  const racine = tmpProjet();
  try {
    const payload = snapshotTechDebt(racine, fakeDebt(5, 2, 3, 1), { date: '2026-05-13' });
    assert.equal(payload.jnsp, 5);
    assert.equal(payload.jnspStale, 1);
    assert.equal(payload.specsGrosses, 2);
    assert.equal(payload.specsWarning, 3);
    const f = join(racine, '.aiad', 'metrics', 'tech-debt', '2026-05-13.json');
    assert.ok(existsSync(f), 'fichier persisté');
    const lu = JSON.parse(readFileSync(f, 'utf-8'));
    assert.equal(lu.date, '2026-05-13');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('snapshotTechDebt — dryRun ne crée pas le fichier', () => {
  const racine = tmpProjet();
  try {
    snapshotTechDebt(racine, fakeDebt(), { date: '2026-05-13', dryRun: true });
    const f = join(racine, '.aiad', 'metrics', 'tech-debt', '2026-05-13.json');
    assert.equal(existsSync(f), false);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('snapshotTechDebt — idempotent même jour (réécrit)', () => {
  const racine = tmpProjet();
  try {
    snapshotTechDebt(racine, fakeDebt(1), { date: '2026-05-13' });
    snapshotTechDebt(racine, fakeDebt(5), { date: '2026-05-13' });
    const lu = JSON.parse(readFileSync(join(racine, '.aiad', 'metrics', 'tech-debt', '2026-05-13.json'), 'utf-8'));
    assert.equal(lu.jnsp, 5, 'dernier snapshot prend');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lireHistorique — sans dossier → []', () => {
  assert.deepEqual(lireHistorique(tmpProjet()), []);
});

test('lireHistorique — fichiers triés chronologiquement', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'tech-debt');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2026-04-15.json'), JSON.stringify({ jnsp: 5 }));
    writeFileSync(join(dir, '2026-05-13.json'), JSON.stringify({ jnsp: 3 }));
    writeFileSync(join(dir, '2026-04-01.json'), JSON.stringify({ jnsp: 7 }));
    writeFileSync(join(dir, 'bidon.txt'), 'noise');
    const h = lireHistorique(racine);
    assert.equal(h.length, 3);
    assert.deepEqual(h.map((x) => x.date), ['2026-04-01', '2026-04-15', '2026-05-13']);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lireHistorique — fichier corrompu ignoré sans crash', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'tech-debt');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2026-05-13.json'), '{ not json');
    writeFileSync(join(dir, '2026-05-12.json'), JSON.stringify({ jnsp: 1 }));
    const h = lireHistorique(racine);
    assert.equal(h.length, 1);
    assert.equal(h[0].jnsp, 1);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('bucketsHebdomadaires — 4 buckets vides quand historique vide', () => {
  const r = bucketsHebdomadaires([], { weeks: 4, now: Date.parse('2026-05-13T12:00:00Z') });
  assert.equal(r.length, 4);
  for (const b of r) {
    assert.equal(b.jnsp, null);
    assert.equal(b.samples, 0);
  }
});

test('bucketsHebdomadaires — dispatch chaque snapshot dans sa semaine', () => {
  // Semaine du lundi 11 mai 2026 (en UTC) → 11-17 mai.
  const now = Date.parse('2026-05-13T12:00:00Z');
  const historique = [
    { date: '2026-04-22', jnsp: 8 }, // -3 semaines
    { date: '2026-04-29', jnsp: 6 }, // -2 semaines
    { date: '2026-05-06', jnsp: 4 }, // -1 semaine
    { date: '2026-05-13', jnsp: 3 }, // semaine courante
  ];
  const r = bucketsHebdomadaires(historique, { weeks: 4, now });
  assert.equal(r.length, 4);
  assert.deepEqual(r.map((b) => b.jnsp), [8, 6, 4, 3]);
});

test('bucketsHebdomadaires — multiple snapshots semaine → dernier prend', () => {
  const now = Date.parse('2026-05-13T12:00:00Z');
  const historique = [
    { date: '2026-05-11', jnsp: 10 },
    { date: '2026-05-12', jnsp: 8 },
    { date: '2026-05-13', jnsp: 5 },
  ];
  const r = bucketsHebdomadaires(historique, { weeks: 1, now });
  assert.equal(r[0].jnsp, 5, 'dernier de la semaine');
  assert.equal(r[0].samples, 3);
});

test('calculerEvolution — persiste snapshot + retourne buckets + tendance', () => {
  const racine = tmpProjet();
  try {
    const now = Date.parse('2026-05-13T12:00:00Z');
    // Pré-seed historique
    const dir = join(racine, '.aiad', 'metrics', 'tech-debt');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2026-04-22.json'), JSON.stringify({ date: '2026-04-22', jnsp: 2 }));
    writeFileSync(join(dir, '2026-04-29.json'), JSON.stringify({ date: '2026-04-29', jnsp: 4 }));
    writeFileSync(join(dir, '2026-05-06.json'), JSON.stringify({ date: '2026-05-06', jnsp: 6 }));
    // Run = snapshot courant + buckets
    const r = calculerEvolution(racine, fakeDebt(8), { date: '2026-05-13', now, weeks: 4 });
    assert.equal(r.snapshots, 4); // 3 préexistants + 1 courant
    assert.deepEqual(r.buckets.map((b) => b.jnsp), [2, 4, 6, 8]);
    assert.equal(r.tendance.jnsp, 'up');
    assert.equal(r.tendance.delta, 6);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerEvolution — tendance down/flat/unknown', () => {
  const racine = tmpProjet();
  try {
    const now = Date.parse('2026-05-13T12:00:00Z');
    const dir = join(racine, '.aiad', 'metrics', 'tech-debt');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2026-04-22.json'), JSON.stringify({ date: '2026-04-22', jnsp: 10 }));
    writeFileSync(join(dir, '2026-05-06.json'), JSON.stringify({ date: '2026-05-06', jnsp: 5 }));
    const r1 = calculerEvolution(racine, fakeDebt(3), { date: '2026-05-13', now, weeks: 4 });
    assert.equal(r1.tendance.jnsp, 'down');
    assert.equal(r1.tendance.delta, -7);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerEvolution — un seul snapshot → tendance unknown', () => {
  const racine = tmpProjet();
  try {
    const r = calculerEvolution(racine, fakeDebt(3), { date: '2026-05-13', now: Date.parse('2026-05-13T00:00:00Z'), weeks: 4 });
    assert.equal(r.tendance.jnsp, 'unknown');
    assert.equal(r.tendance.delta, 0);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('renduTimeline — historique vide → string vide', () => {
  assert.equal(renduTimeline({ buckets: [] }), '');
  assert.equal(renduTimeline(null), '');
});

test('renduTimeline — SVG inline avec barres JNSP/SPECs + légende', () => {
  const html = renduTimeline({
    snapshots: 4,
    buckets: [
      { semaine: '2026-04-22', jnsp: 2, specsGrosses: 1, specsWarning: 0, samples: 1 },
      { semaine: '2026-04-29', jnsp: 4, specsGrosses: 1, specsWarning: 1, samples: 1 },
      { semaine: '2026-05-06', jnsp: 6, specsGrosses: 2, specsWarning: 1, samples: 1 },
      { semaine: '2026-05-13', jnsp: 8, specsGrosses: 3, specsWarning: 2, samples: 1 },
    ],
    tendance: { jnsp: 'up', delta: 6 },
  });
  assert.match(html, /<svg/);
  assert.match(html, /fill="#4c6ef5"/, 'série JNSP bleue');
  assert.match(html, /fill="#fa5252"/, 'série SPECs rouge');
  assert.match(html, /JNSP \+6 sur 4 semaines/);
  assert.match(html, /4 snapshot\(s\) total/);
  assert.match(html, /\.aiad\/metrics\/tech-debt\//);
});

test('renduTimeline — bucket vide rendu sans barre (skip)', () => {
  const html = renduTimeline({
    snapshots: 1,
    buckets: [
      { semaine: '2026-04-22', jnsp: null, specsGrosses: null, specsWarning: null, samples: 0 },
      { semaine: '2026-04-29', jnsp: null, specsGrosses: null, specsWarning: null, samples: 0 },
      { semaine: '2026-05-06', jnsp: null, specsGrosses: null, specsWarning: null, samples: 0 },
      { semaine: '2026-05-13', jnsp: 3, specsGrosses: 1, specsWarning: 0, samples: 1 },
    ],
    tendance: { jnsp: 'unknown', delta: 0 },
  });
  assert.match(html, /<svg/);
  assert.match(html, /Pas assez d'historique/);
});

test('Alias EN canoniques', () => {
  assert.equal(snapshotTechDebtEN, snapshotTechDebt);
  assert.equal(readHistory, lireHistorique);
  assert.equal(weeklyBuckets, bucketsHebdomadaires);
  assert.equal(computeEvolution, calculerEvolution);
  assert.equal(renderTimeline, renduTimeline);
  assert.equal(pruneHistory, pruneHistorique);
});

// ─── #199 Rétention + pruning ────────────────────────────────────────────────

test('pruneHistorique — sans dossier → {pruned:[], kept:0}', () => {
  const r = pruneHistorique(tmpProjet());
  assert.deepEqual(r, { pruned: [], kept: 0 });
});

test('pruneHistorique — retentionJours=30 supprime > 30j, garde le reste', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'tech-debt');
    mkdirSync(dir, { recursive: true });
    const now = Date.parse('2026-05-13T12:00:00Z');
    writeFileSync(join(dir, '2026-02-01.json'), JSON.stringify({ jnsp: 1 })); // 100j → supprimer
    writeFileSync(join(dir, '2026-04-01.json'), JSON.stringify({ jnsp: 2 })); // 42j → supprimer
    writeFileSync(join(dir, '2026-04-20.json'), JSON.stringify({ jnsp: 3 })); // 23j → garder
    writeFileSync(join(dir, '2026-05-13.json'), JSON.stringify({ jnsp: 4 })); // 0j → garder
    const r = pruneHistorique(racine, { retentionJours: 30, now });
    assert.deepEqual(r.pruned, ['2026-02-01', '2026-04-01']);
    assert.equal(r.kept, 2);
    assert.equal(existsSync(join(dir, '2026-02-01.json')), false);
    assert.equal(existsSync(join(dir, '2026-05-13.json')), true);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('pruneHistorique — before=YYYY-MM-DD prend précédence sur retentionJours', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'tech-debt');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2026-04-01.json'), '{}');
    writeFileSync(join(dir, '2026-04-15.json'), '{}');
    writeFileSync(join(dir, '2026-05-01.json'), '{}');
    const r = pruneHistorique(racine, { before: '2026-04-15', retentionJours: 9999 });
    // strict < 2026-04-15 → seul 2026-04-01 supprimé
    assert.deepEqual(r.pruned, ['2026-04-01']);
    assert.equal(r.kept, 2);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('pruneHistorique — dryRun ne supprime pas mais retourne la liste', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'tech-debt');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2025-01-01.json'), '{}');
    const r = pruneHistorique(racine, { retentionJours: 30, now: Date.parse('2026-05-13T00:00:00Z'), dryRun: true });
    assert.deepEqual(r.pruned, ['2025-01-01']);
    assert.equal(existsSync(join(dir, '2025-01-01.json')), true, 'fichier toujours présent');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('pruneHistorique — ignore les fichiers hors pattern YYYY-MM-DD.json', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'tech-debt');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'random.txt'), 'noise');
    writeFileSync(join(dir, '2025-01-01.json'), '{}');
    const r = pruneHistorique(racine, { retentionJours: 30, now: Date.parse('2026-05-13T00:00:00Z') });
    assert.deepEqual(r.pruned, ['2025-01-01']);
    assert.equal(existsSync(join(dir, 'random.txt')), true, 'non-snapshot ignoré');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerEvolution — auto-prune via config retentionJours', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'config.json'), JSON.stringify({ dashboard: { retentionJours: 14 } }));
    const dir = join(racine, '.aiad', 'metrics', 'tech-debt');
    mkdirSync(dir, { recursive: true });
    // 60j old → doit être pruné
    writeFileSync(join(dir, '2026-03-14.json'), JSON.stringify({ date: '2026-03-14', jnsp: 1 }));
    // 5j old → garder
    writeFileSync(join(dir, '2026-05-08.json'), JSON.stringify({ date: '2026-05-08', jnsp: 2 }));
    const now = Date.parse('2026-05-13T00:00:00Z');
    const r = calculerEvolution(racine, fakeDebt(3), { date: '2026-05-13', now, weeks: 4 });
    assert.deepEqual(r.prune.pruned, ['2026-03-14']);
    assert.equal(r.snapshots, 2, '2 fichiers restants après prune (2026-05-08 + 2026-05-13)');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerEvolution — retentionJours en option ignore la config', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'config.json'), JSON.stringify({ dashboard: { retentionJours: 9999 } }));
    const dir = join(racine, '.aiad', 'metrics', 'tech-debt');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2025-01-01.json'), JSON.stringify({ date: '2025-01-01' }));
    const now = Date.parse('2026-05-13T00:00:00Z');
    const r = calculerEvolution(racine, fakeDebt(), { date: '2026-05-13', now, weeks: 4, retentionJours: 7 });
    assert.deepEqual(r.prune.pruned, ['2025-01-01']);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerEvolution — skipPrune désactive le pruning', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'tech-debt');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2025-01-01.json'), JSON.stringify({ date: '2025-01-01' }));
    const r = calculerEvolution(racine, fakeDebt(), { date: '2026-05-13', now: Date.parse('2026-05-13T00:00:00Z'), weeks: 4, skipPrune: true });
    assert.deepEqual(r.prune.pruned, []);
    assert.ok(existsSync(join(dir, '2025-01-01.json')));
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerEvolution — config json cassé → fallback défaut 180j', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'config.json'), '{ not json');
    const dir = join(racine, '.aiad', 'metrics', 'tech-debt');
    mkdirSync(dir, { recursive: true });
    // 100j old → < 180 → garder
    writeFileSync(join(dir, '2026-02-02.json'), JSON.stringify({ date: '2026-02-02', jnsp: 1 }));
    const now = Date.parse('2026-05-13T00:00:00Z');
    const r = calculerEvolution(racine, fakeDebt(), { date: '2026-05-13', now, weeks: 4 });
    assert.deepEqual(r.prune.pruned, [], 'rien pruné avec défaut 180j');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});
