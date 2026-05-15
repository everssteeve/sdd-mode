// Tests #453 / #454 / #455 — Boucle 12 PM cockpit deep-dive/progression :
//   - single-page Intent view (1 page HTML par Intent)
//   - burnup chart cumulatif
//   - backlog refinement detector

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  slugForFile, rendreLien, construirePageIntent, genererPagesIntents,
  blocIntentPagesIndex,
  slugForFilename, intentPageLink, buildIntentPage, generateIntentPages, intentPagesIndexSection,
} from '../lib/dashboard/intent-page.js';

import {
  pointsBurnup, estimerCompletion, calculerBurnupChart, blocBurnupChart,
  burnupPoints, estimateCompletion, computeBurnupChart, burnupChartSection,
} from '../lib/dashboard/burnup-chart.js';

import {
  detecterRaisons, calculerRefinement, blocRefinement, REFINEMENT_REASONS,
  detectReasons, computeRefinement, refinementSection,
} from '../lib/dashboard/refinement.js';

const days = (n) => n * 24 * 3600 * 1000;

// ─── #453 — Single-page Intent view ─────────────────────────────────────────

test('slugForFile — utilise basename .md sans extension', () => {
  assert.equal(slugForFile({ file: '.aiad/intents/INTENT-101-conversion.md' }), 'INTENT-101-conversion');
});

test('slugForFile — fallback id si pas de file', () => {
  assert.equal(slugForFile({ id: 'INTENT-042' }), 'INTENT-042');
});

test('rendreLien — produit intent-{slug}.html', () => {
  assert.equal(rendreLien({ id: 'INTENT-042' }), 'intent-INTENT-042.html');
  assert.equal(rendreLien({ file: '.aiad/intents/INTENT-101-slug.md' }), 'intent-INTENT-101-slug.html');
});

test('construirePageIntent — rend 5 sections + SPECs liées + risques + hypothèse + deps', () => {
  const intent = {
    id: 'INTENT-001',
    titre: 'Test',
    statut: 'active',
    priority: 'P0',
    sections: {
      pourquoi: 'Test pourquoi',
      objectif: 'Test objectif',
    },
    hypothesis: 'Si X alors Y',
    hypothesis_status: 'untested',
    tags: ['mobile', 'q3'],
  };
  const donnees = {
    intents: [intent],
    specs: [{ id: 'SPEC-001-1', parentIntent: 'INTENT-001', statut: 'done', titre: 'S1', sqs: 4.5 }],
    pm: { avancement: [{ id: 'INTENT-001', done: 1, total: 1, ratio: 1, enCours: 0 }] },
    risks: { intents: [{ id: 'INTENT-001', niveau: 'high', risques: [{ texte: 'RGPD' }] }] },
    intentDeps: { intents: [{ id: 'INTENT-001', bloquePar: [], bloque: [] }] },
  };
  const html = construirePageIntent(intent, donnees);
  assert.ok(html.includes('POURQUOI MAINTENANT'));
  assert.ok(html.includes('Test pourquoi'));
  assert.ok(html.includes('SPEC-001-1'));
  assert.ok(html.includes('Si X alors Y'));
  assert.ok(html.includes('untested'));
  assert.ok(html.includes('RGPD'));
  assert.ok(html.includes('#mobile'));
  assert.ok(html.includes('P0'));
});

test('genererPagesIntents — écrit 1 fichier par Intent', () => {
  const dir = join(tmpdir(), 'aiad-ipage-' + Math.random().toString(36).slice(2));
  mkdirSync(dir, { recursive: true });
  try {
    const layout = ({ titre, body }) => `<html><title>${titre}</title><body>${body}</body></html>`;
    const donnees = {
      intents: [
        { id: 'INTENT-A', titre: 'a', statut: 'active' },
        { id: 'INTENT-B', titre: 'b', statut: 'draft' },
      ],
      specs: [],
    };
    const fichiers = genererPagesIntents(donnees, { outDir: dir, layout });
    assert.equal(fichiers.length, 2);
    assert.ok(existsSync(join(dir, 'intent-INTENT-A.html')));
    assert.ok(existsSync(join(dir, 'intent-INTENT-B.html')));
    const html = readFileSync(join(dir, 'intent-INTENT-A.html'), 'utf-8');
    // Le layout reçoit `titre: "INTENT-A — a"` et `sous: "Vue détaillée Intent…"`.
    // Le test layout minimal n'utilise que titre, donc on cherche les deux.
    assert.ok(html.includes('INTENT-A'));
    assert.ok(html.includes('— a'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('blocIntentPagesIndex — empty si zéro intent', () => {
  assert.equal(blocIntentPagesIndex({ intents: [] }), '');
});

test('blocIntentPagesIndex — liens vers chaque page', () => {
  const html = blocIntentPagesIndex({ intents: [
    { id: 'INTENT-A', titre: 'a', file: '.aiad/intents/INTENT-A.md' },
    { id: 'INTENT-B', titre: 'b' },
  ]});
  assert.ok(html.includes('Pages détaillées Intent'));
  assert.ok(html.includes('intent-INTENT-A.html'));
  assert.ok(html.includes('intent-INTENT-B.html'));
});

// ─── #454 — Burnup chart ────────────────────────────────────────────────────

test('pointsBurnup — calcule scope total + done par snapshot', () => {
  const r = pointsBurnup([
    { date: '2026-05-10', data: { intents: [{ statut: 'draft' }, { statut: 'draft' }] } },
    { date: '2026-05-15', data: { intents: [{ statut: 'done' }, { statut: 'active' }] } },
  ]);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { date: '2026-05-10', total: 2, done: 0 });
  assert.deepEqual(r[1], { date: '2026-05-15', total: 2, done: 1 });
});

test('estimerCompletion — vélocité nette + ETA', () => {
  const points = [
    { date: '2026-05-08', total: 5, done: 0 },
    { date: '2026-05-15', total: 5, done: 1 }, // 1 livré en 7 j → 4 restants en ~28 j
  ];
  const e = estimerCompletion(points);
  assert.ok(e.date);
  assert.equal(e.restant, 4);
});

test('estimerCompletion — vélocité <= 0 → pas d\'ETA', () => {
  const points = [
    { date: '2026-05-08', total: 5, done: 1 },
    { date: '2026-05-15', total: 6, done: 1 }, // scope +1, done +0 → vélocité -1
  ];
  const e = estimerCompletion(points);
  assert.equal(e.date, null);
});

test('estimerCompletion — null si < 2 points', () => {
  assert.equal(estimerCompletion([{ date: 'x', total: 1, done: 0 }]), null);
});

test('calculerBurnupChart — orchestre lecteur + estimation', () => {
  const r = calculerBurnupChart('/tmp', {}, { lecteur: () => [
    { date: '2026-05-10', data: { intents: [{ statut: 'draft' }] } },
    { date: '2026-05-15', data: { intents: [{ statut: 'done' }] } },
  ]});
  assert.equal(r.snapshots, 2);
  assert.equal(r.points[1].done, 1);
  assert.ok(r.estimation);
});

test('blocBurnupChart — message minimum 2 si 1 snapshot', () => {
  assert.ok(blocBurnupChart({ burnupChart: { snapshots: 1, points: [], estimation: null } }).includes('minimum 2 requis'));
});

test('blocBurnupChart — rend SVG + 2 polylines + ETA', () => {
  const html = blocBurnupChart({ burnupChart: {
    snapshots: 2,
    points: [
      { date: '2026-05-08', total: 3, done: 0 },
      { date: '2026-05-15', total: 3, done: 1 },
    ],
    estimation: { date: '2026-07-01', restant: 2, vitesse: 0.1 },
  }});
  assert.ok(html.includes('Burnup chart'));
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('polyline'));
  assert.ok(html.includes('scope total'));
  assert.ok(html.includes('complete'));
  assert.ok(html.includes('2026-07-01'));
  assert.ok(html.includes('33 %'), 'pct = 1/3 = 33%');
});

// ─── #455 — Refinement detector ─────────────────────────────────────────────

test('detecterRaisons — active sans SPEC ≥ 7j → spec-missing', () => {
  const now = Date.now();
  const intent = { id: 'A', statut: 'active', mtime: now - days(10) };
  const ctx = { specsParIntentId: new Map([['A', []]]), depsById: new Map() };
  const r = detecterRaisons(intent, ctx, now);
  assert.ok(r.includes('spec-missing'));
});

test('detecterRaisons — objectif > 200 chars → objectif-lourd', () => {
  const intent = { id: 'A', statut: 'draft', sections: { objectif: 'x'.repeat(250) } };
  const ctx = { specsParIntentId: new Map(), depsById: new Map() };
  const r = detecterRaisons(intent, ctx, Date.now());
  assert.ok(r.includes('objectif-lourd'));
});

test('detecterRaisons — bloqué actif détecté', () => {
  const intent = { id: 'A', statut: 'active', mtime: Date.now() };
  const ctx = { specsParIntentId: new Map([['A', [{}]]]), depsById: new Map([['A', { bloqueActif: true }]]) };
  const r = detecterRaisons(intent, ctx, Date.now());
  assert.ok(r.includes('bloque-actif'));
});

test('detecterRaisons — active sans target → no-target', () => {
  const intent = { id: 'A', statut: 'active', mtime: Date.now() };
  const ctx = { specsParIntentId: new Map([['A', [{}]]]), depsById: new Map() };
  const r = detecterRaisons(intent, ctx, Date.now());
  assert.ok(r.includes('no-target'));
});

test('detecterRaisons — active sans owner ni sponsor → no-owner', () => {
  const intent = { id: 'A', statut: 'active', mtime: Date.now(), target: 'Q3-2026' };
  const ctx = { specsParIntentId: new Map([['A', [{}]]]), depsById: new Map() };
  const r = detecterRaisons(intent, ctx, Date.now());
  assert.ok(r.includes('no-owner'));
});

test('detecterRaisons — done/archived → rien à raffiner', () => {
  const intent = { id: 'A', statut: 'done', mtime: Date.now() - days(100) };
  const ctx = { specsParIntentId: new Map(), depsById: new Map() };
  const r = detecterRaisons(intent, ctx, Date.now());
  assert.equal(r.length, 0);
});

test('calculerRefinement — gravité agrégée pire d\'abord', () => {
  const now = Date.now();
  const d = { intents: [
    { id: 'A', statut: 'active', mtime: now - days(10), target: 'Q3', owner: 'X' }, // spec-missing high
    { id: 'B', statut: 'draft', mtime: now }, // no-owner low (statut draft sans owner/sponsor)
  ], specs: [], intentDeps: { intents: [] } };
  const r = calculerRefinement(d, { now });
  assert.equal(r.items[0].id, 'A', 'A en premier (gravité high)');
  assert.equal(r.totaux.high, 1);
});

test('blocRefinement — message "aucun signal" si zéro', () => {
  assert.ok(blocRefinement({ refinement: { items: [], totaux: { total: 0 } } }).includes('aucun signal'));
});

test('blocRefinement — rend cards avec badges gravité + actions', () => {
  const html = blocRefinement({ refinement: {
    items: [{
      id: 'INTENT-A', titre: 't', file: null, statut: 'active', pireGravite: 'high',
      raisons: [{ key: 'spec-missing', gravite: 'high', label: 'Sans SPEC', action: 'Lancer /sdd spec' }],
    }],
    totaux: { total: 1, high: 1, medium: 0, low: 0 },
  }});
  assert.ok(html.includes('À raffiner cette semaine'));
  assert.ok(html.includes('gravite-high'));
  assert.ok(html.includes('Haute'));
  assert.ok(html.includes('Sans SPEC'));
  assert.ok(html.includes('/sdd spec'));
});

test('REFINEMENT_REASONS — 5 raisons exposées', () => {
  assert.ok(REFINEMENT_REASONS['spec-missing']);
  assert.ok(REFINEMENT_REASONS['objectif-lourd']);
  assert.ok(REFINEMENT_REASONS['bloque-actif']);
  assert.ok(REFINEMENT_REASONS['no-target']);
  assert.ok(REFINEMENT_REASONS['no-owner']);
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof slugForFilename, 'function');
  assert.equal(typeof intentPageLink, 'function');
  assert.equal(typeof buildIntentPage, 'function');
  assert.equal(typeof generateIntentPages, 'function');
  assert.equal(typeof intentPagesIndexSection, 'function');
  assert.equal(typeof burnupPoints, 'function');
  assert.equal(typeof estimateCompletion, 'function');
  assert.equal(typeof computeBurnupChart, 'function');
  assert.equal(typeof burnupChartSection, 'function');
  assert.equal(typeof detectReasons, 'function');
  assert.equal(typeof computeRefinement, 'function');
  assert.equal(typeof refinementSection, 'function');
});
