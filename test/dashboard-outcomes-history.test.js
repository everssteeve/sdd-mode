// Tests #210 — Timeline historique des outcomes (sparkline SVG).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  lireHistorique, indexerParCritere, bucketsHebdomadaires, calculerTimelines, renduTimelines,
  readHistory, indexByCriterion, weeklyBuckets, computeTimelines, renderTimelines,
} from '../lib/dashboard/outcomes-history.js';

function tmpProjet() {
  return mkdtempSync(join(tmpdir(), 'aiad-outhist-'));
}

function ecrireSnapshot(racine, date, mesures) {
  const dir = join(racine, '.aiad', 'metrics', 'outcomes');
  mkdirSync(dir, { recursive: true });
  const rows = mesures.map((m) => `| ${m.critere} | ${m.actuel} |`).join('\n');
  writeFileSync(join(dir, `${date}.md`), `| Critère | Actuel |\n|---------|--------|\n${rows}\n`);
}

test('lireHistorique — sans dossier → []', () => {
  assert.deepEqual(lireHistorique(tmpProjet()), []);
});

test('lireHistorique — tri chronologique ascendant', () => {
  const racine = tmpProjet();
  try {
    ecrireSnapshot(racine, '2026-05-01', [{ critere: 'C1', actuel: '50' }]);
    ecrireSnapshot(racine, '2026-04-01', [{ critere: 'C1', actuel: '80' }]);
    ecrireSnapshot(racine, '2026-05-13', [{ critere: 'C1', actuel: '40' }]);
    const h = lireHistorique(racine);
    assert.equal(h.length, 3);
    assert.deepEqual(h.map((s) => s.date), ['2026-04-01', '2026-05-01', '2026-05-13']);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lireHistorique — fichier sans pattern date ignoré', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'metrics', 'outcomes');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'random.md'), '| Critère | Actuel |\n|---|---|\n| C1 | 10 |');
    writeFileSync(join(dir, '2026-05-13.md'), '| Critère | Actuel |\n|---|---|\n| C1 | 20 |');
    const h = lireHistorique(racine);
    assert.equal(h.length, 1);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lireHistorique — parse num via parserValeur', () => {
  const racine = tmpProjet();
  try {
    ecrireSnapshot(racine, '2026-05-13', [
      { critere: 'Latence', actuel: '42 ms' },
      { critere: 'Erreur', actuel: '0,5 %' },
    ]);
    const h = lireHistorique(racine);
    assert.equal(h[0].mesures[0].num, 42);
    assert.equal(h[0].mesures[1].num, 0.5);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('indexerParCritere — group by critère, points triés chrono via historique pré-trié', () => {
  const historique = [
    { date: '2026-04-01', mesures: [{ critere: 'Latence', actuel: '80 ms', num: 80 }, { critere: 'Erreur', actuel: '2%', num: 2 }] },
    { date: '2026-05-01', mesures: [{ critere: 'Latence', actuel: '60 ms', num: 60 }] },
    { date: '2026-05-13', mesures: [{ critere: 'Latence', actuel: '42 ms', num: 42 }, { critere: 'Erreur', actuel: '0.5%', num: 0.5 }] },
  ];
  const idx = indexerParCritere(historique);
  assert.equal(idx.size, 2);
  assert.equal(idx.get('latence').points.length, 3);
  assert.equal(idx.get('latence').points[0].num, 80);
  assert.equal(idx.get('latence').points[2].num, 42);
  assert.equal(idx.get('erreur').points.length, 2);
});

test('bucketsHebdomadaires — 12 buckets vides quand pas de points', () => {
  const r = bucketsHebdomadaires([], { weeks: 12, now: Date.parse('2026-05-13T12:00:00Z') });
  assert.equal(r.length, 12);
  for (const b of r) {
    assert.equal(b.num, null);
    assert.equal(b.samples, 0);
  }
});

test('bucketsHebdomadaires — dispatch points dans leur semaine UTC', () => {
  const now = Date.parse('2026-05-13T12:00:00Z');
  const points = [
    { date: '2026-04-22', actuel: '80', num: 80 }, // -3 sem
    { date: '2026-04-29', actuel: '60', num: 60 }, // -2 sem
    { date: '2026-05-06', actuel: '50', num: 50 }, // -1 sem
    { date: '2026-05-13', actuel: '42', num: 42 }, // current
  ];
  const r = bucketsHebdomadaires(points, { weeks: 4, now });
  assert.equal(r.length, 4);
  assert.deepEqual(r.map((b) => b.num), [80, 60, 50, 42]);
});

test('bucketsHebdomadaires — multiple points/semaine → dernier prend', () => {
  const now = Date.parse('2026-05-13T12:00:00Z');
  const points = [
    { date: '2026-05-11', actuel: '50', num: 50 },
    { date: '2026-05-12', actuel: '45', num: 45 },
    { date: '2026-05-13', actuel: '42', num: 42 },
  ];
  const r = bucketsHebdomadaires(points, { weeks: 1, now });
  assert.equal(r[0].num, 42);
  assert.equal(r[0].samples, 3);
});

test('calculerTimelines — sans historique → snapshots=0, timelines vides', () => {
  const r = calculerTimelines(tmpProjet(), [{ critere: 'C1', cible: '< 50' }]);
  assert.equal(r.snapshots, 0);
  assert.deepEqual(r.timelines, []);
});

test('calculerTimelines — produit 1 timeline par critère numérique matché', () => {
  const racine = tmpProjet();
  try {
    ecrireSnapshot(racine, '2026-04-22', [{ critere: 'Latence', actuel: '80 ms' }]);
    ecrireSnapshot(racine, '2026-05-13', [{ critere: 'Latence', actuel: '42 ms' }]);
    const criteres = [
      { critere: 'Latence', cible: '< 50 ms' },
      { critere: 'Non mesuré', cible: '100' },
    ];
    const r = calculerTimelines(racine, criteres, { now: Date.parse('2026-05-13T12:00:00Z'), weeks: 4 });
    assert.equal(r.snapshots, 2);
    assert.equal(r.timelines.length, 1);
    assert.equal(r.timelines[0].critere, 'Latence');
    assert.equal(r.timelines[0].cibleNum, 50);
    assert.equal(r.timelines[0].direction, 'lower');
    assert.equal(r.timelines[0].pointsTotal, 2);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerTimelines — cible non-numérique → exclue', () => {
  const racine = tmpProjet();
  try {
    ecrireSnapshot(racine, '2026-05-13', [{ critere: 'DPIA', actuel: 'validée' }]);
    const r = calculerTimelines(racine, [{ critere: 'DPIA', cible: 'DPIA validée' }]);
    assert.equal(r.timelines.length, 0, 'cible texte non timelineable');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('renduTimelines — vide → string vide', () => {
  assert.equal(renduTimelines({ timelines: [] }), '');
  assert.equal(renduTimelines(null), '');
});

test('renduTimelines — SVG inline avec polyline + ligne pointillée cible', () => {
  const html = renduTimelines({
    snapshots: 4,
    timelines: [{
      critere: 'Latence p95',
      cible: '< 50 ms',
      cibleNum: 50,
      direction: 'lower',
      pointsTotal: 4,
      buckets: [
        { semaine: '2026-04-22', num: 80, actuel: '80 ms', samples: 1 },
        { semaine: '2026-04-29', num: 60, actuel: '60 ms', samples: 1 },
        { semaine: '2026-05-06', num: 50, actuel: '50 ms', samples: 1 },
        { semaine: '2026-05-13', num: 42, actuel: '42 ms', samples: 1 },
      ],
    }],
  });
  assert.match(html, /<svg/);
  assert.match(html, /<polyline/);
  assert.match(html, /stroke-dasharray="3,3"/, 'ligne pointillée pour la cible');
  assert.match(html, /Latence p95/);
  assert.match(html, /cible <code>&lt; 50 ms<\/code>/);
  assert.match(html, /4 mesure\(s\)/);
});

test('renduTimelines — couleur cercle selon état (lower is better)', () => {
  const html = renduTimelines({
    snapshots: 2,
    timelines: [{
      critere: 'Latence',
      cible: '< 50',
      cibleNum: 50,
      direction: 'lower',
      pointsTotal: 2,
      buckets: [
        { semaine: '2026-05-06', num: 40, actuel: '40', samples: 1 }, // ok → vert
        { semaine: '2026-05-13', num: 120, actuel: '120', samples: 1 }, // bad → rouge
      ],
    }],
  });
  assert.match(html, /fill="#2b8a3e"/, 'cercle vert pour ok');
  assert.match(html, /fill="#c92a2a"/, 'cercle rouge pour bad');
});

test('renduTimelines — gaps (bucket sans donnée) gère segments brisés', () => {
  const html = renduTimelines({
    snapshots: 2,
    timelines: [{
      critere: 'X',
      cible: '< 50',
      cibleNum: 50,
      direction: 'lower',
      pointsTotal: 2,
      buckets: [
        { semaine: '2026-04-22', num: 80, actuel: '80', samples: 1 },
        { semaine: '2026-04-29', num: null, actuel: null, samples: 0 },
        { semaine: '2026-05-06', num: null, actuel: null, samples: 0 },
        { semaine: '2026-05-13', num: 42, actuel: '42', samples: 1 },
      ],
    }],
  });
  // 2 segments distincts attendus (avant gap, après gap) — mais ici les 2
  // segments n'ont qu'1 point chacun, donc 0 polyline (≥ 2 points requis).
  // Au moins les 2 cercles doivent être présents.
  assert.match(html, /<circle/);
});

test('Alias EN canoniques', () => {
  assert.equal(readHistory, lireHistorique);
  assert.equal(indexByCriterion, indexerParCritere);
  assert.equal(weeklyBuckets, bucketsHebdomadaires);
  assert.equal(computeTimelines, calculerTimelines);
  assert.equal(renderTimelines, renduTimelines);
});
