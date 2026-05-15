// Tests #498 / #499 / #500 — Boucle 27 PM hypothesis-lifecycle/roadmap-timeline/pm-scorecard

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  classerHypotheses, calculerHypothesisLifecycle, blocHypothesisLifecycle,
  classifyHypotheses, computeHypothesisLifecycle, hypothesisLifecycleSection,
} from '../lib/dashboard/hypothesis-lifecycle.js';

import {
  parseTargetDate, calculerRoadmapTimeline, blocRoadmapTimeline,
  parseDeadline, computeRoadmapTimeline, roadmapTimelineSection,
} from '../lib/dashboard/roadmap-timeline.js';

import {
  calculerPmScorecard, blocPmScorecard,
  computePmScorecard, pmScorecardSection,
} from '../lib/dashboard/pm-scorecard.js';

const DAY = 24 * 3600 * 1000;

// ─── #498 — Hypothesis lifecycle ────────────────────────────────────────────

test('classerHypotheses — exclut Intents sans hypothesis', () => {
  const r = classerHypotheses([
    { id: 'A', hypothesis: 'h1', hypothesis_status: 'validated' },
    { id: 'B' },
    { id: 'C', hypothesis: 'h2', hypothesis_status: 'unknown-value' },
  ]);
  assert.equal(r.length, 2);
  assert.equal(r[0].etat, 'validated');
  assert.equal(r[1].etat, 'untested'); // fallback
});

test('classerHypotheses — alias FR + EN normalisés', () => {
  const r = classerHypotheses([
    { id: 'A', hypothesis: 'h', hypothesis_status: 'non-teste' },
    { id: 'B', hypothesis: 'h', hypothesis_status: 'in-progress' },
    { id: 'C', hypothesis: 'h', hypothesis_status: 'refuted' },
  ]);
  assert.equal(r[0].etat, 'untested');
  assert.equal(r[1].etat, 'testing');
  assert.equal(r[2].etat, 'invalidated');
});

test('calculerHypothesisLifecycle — totaux + taux + stagnation', () => {
  const now = Date.now();
  const r = calculerHypothesisLifecycle({
    intents: [
      { id: 'A', hypothesis: 'h', hypothesis_status: 'validated', mtime: now - 5 * DAY },
      { id: 'B', hypothesis: 'h', hypothesis_status: 'invalidated', mtime: now - 10 * DAY },
      { id: 'C', hypothesis: 'h', hypothesis_status: 'untested', mtime: now - 60 * DAY }, // stagne
      { id: 'D', hypothesis: 'h', hypothesis_status: 'testing', mtime: now }, // récent → pas stagne
    ],
  }, { now });
  assert.equal(r.totaux.total, 4);
  assert.equal(r.totaux.validated, 1);
  assert.equal(r.totaux.invalidated, 1);
  assert.equal(r.tauxValidation, 25);
  assert.equal(r.stagnantes, 1);
  assert.ok(r.meanTtrJours >= 5);
});

test('blocHypothesisLifecycle — empty + rendu + warning stagnation', () => {
  assert.ok(blocHypothesisLifecycle({ hypothesisLifecycle: { totaux: { total: 0 }}}).includes('aucune hypothèse'));
  const html = blocHypothesisLifecycle({ hypothesisLifecycle: {
    items: [],
    totaux: { total: 5, untested: 2, testing: 1, validated: 1, invalidated: 1, partial: 0 },
    tauxValidation: 20, stagnantes: 2, meanTtrJours: 15, stagnantesSample: [],
  }});
  assert.ok(html.includes('Cycle de vie'));
  assert.ok(html.includes('20%'));
  assert.ok(html.includes('hypothèse(s) stagnent'));
});

// ─── #499 — Roadmap timeline ────────────────────────────────────────────────

test('parseTargetDate — ISO YYYY-MM-DD', () => {
  const t = parseTargetDate('2026-06-15');
  assert.ok(t > 0);
});

test('parseTargetDate — Q-YYYY → fin trimestre', () => {
  const t = parseTargetDate('Q2-2026');
  // Q2-2026 → fin juin 2026
  const d = new Date(t);
  assert.equal(d.getUTCFullYear(), 2026);
  assert.equal(d.getUTCMonth(), 5); // juin (0-indexed)
});

test('parseTargetDate — empty + invalide → null', () => {
  assert.equal(parseTargetDate(null), null);
  assert.equal(parseTargetDate(''), null);
  assert.equal(parseTargetDate('not-a-date'), null);
});

test('calculerRoadmapTimeline — classifie retard / urgent / proche / distant', () => {
  const now = Date.UTC(2026, 4, 15);
  const r = calculerRoadmapTimeline({
    intents: [
      { id: 'A', target_date: '2026-05-01', statut: 'active', mtime: now - 60 * DAY }, // retard
      { id: 'B', target_date: '2026-05-30', statut: 'active', mtime: now }, // urgent
      { id: 'C', target_date: '2026-07-15', statut: 'active', mtime: now }, // proche (~60j)
      { id: 'D', target_date: '2026-12-01', statut: 'active', mtime: now }, // distant
      { id: 'E', target_date: '2026-12-01', statut: 'archived', mtime: now }, // exclu
      { id: 'F', statut: 'active', mtime: now }, // pas de target_date, exclu
    ],
  }, { now });
  assert.equal(r.items.length, 4);
  assert.equal(r.totaux.retard, 1);
  assert.equal(r.totaux.urgent, 1);
  assert.equal(r.totaux.proche, 1);
  assert.equal(r.totaux.distant, 1);
  // Tri par échéance asc
  assert.equal(r.items[0].id, 'A');
});

test('blocRoadmapTimeline — empty + rendu SVG', () => {
  assert.ok(blocRoadmapTimeline({ roadmapTimeline: { items: [], totaux: {} }}).includes('aucun target_date'));
  const now = Date.UTC(2026, 4, 15);
  const html = blocRoadmapTimeline({ roadmapTimeline: {
    items: [{
      id: 'INTENT-A', titre: 't', file: null, statut: 'active', priority: 'P0',
      debut: now - 30 * DAY, echeance: now + 15 * DAY, proximite: 'urgent', target: '2026-05-30',
    }],
    plage: { min: now - 60 * DAY, max: now + 60 * DAY },
    now,
    totaux: { total: 1, retard: 0, urgent: 1, proche: 0, distant: 0 },
  }});
  assert.ok(html.includes('Roadmap timeline'));
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('rt-gantt'));
});

// ─── #500 — PM Scorecard ────────────────────────────────────────────────────

function avecArboMetrics(struct = {}, options = {}) {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-loop27-'));
  mkdirSync(join(racine, '.aiad', 'metrics'), { recursive: true });
  for (const [chemin, contenu] of Object.entries(struct)) {
    const cible = join(racine, chemin);
    mkdirSync(join(cible, '..'), { recursive: true });
    writeFileSync(cible, contenu);
    if (options.agedDays && options.agedDays[chemin] != null) {
      const t = (Date.now() - options.agedDays[chemin] * DAY) / 1000;
      utimesSync(cible, t, t);
    }
  }
  return racine;
}

test('calculerPmScorecard — KPIs avec delta vs période précédente', () => {
  const now = Date.now();
  const racine = avecArboMetrics({
    '.aiad/metrics/pm-journal/2026-05-15.md': 'récent',
    '.aiad/metrics/pm-journal/old.md': 'ancien',
  }, { agedDays: { '.aiad/metrics/pm-journal/2026-05-15.md': 5, '.aiad/metrics/pm-journal/old.md': 45 } });
  const r = calculerPmScorecard(racine, {
    intents: [
      { id: 'A', mtime: now - 5 * DAY }, // courant
      { id: 'B', mtime: now - 45 * DAY }, // précédent
    ],
    specs: [
      { id: 'S1', statut: 'done', mtime: now - 3 * DAY },
      { id: 'S2', statut: 'in-progress', mtime: now - 3 * DAY }, // exclu
    ],
  }, { now });
  const intents = r.kpis.find((k) => k.cle === 'intents-crees');
  assert.equal(intents.courant, 1);
  assert.equal(intents.precedent, 1);
  const specs = r.kpis.find((k) => k.cle === 'specs-livrees');
  assert.equal(specs.courant, 1);
  const journal = r.kpis.find((k) => k.cle === 'journal');
  assert.equal(journal.courant, 1);
  assert.equal(journal.precedent, 1);
  rmSync(racine, { recursive: true, force: true });
});

test('blocPmScorecard — rendu KPIs + banner globalité', () => {
  const now = Date.now();
  const html = blocPmScorecard({ pmScorecard: {
    kpis: [
      { cle: 'intents-crees', label: 'Intents capturés', icone: '💡', courant: 3, precedent: 1, delta: 2, direction: 'up' },
      { cle: 'specs-livrees', label: 'SPECs livrées', icone: '🚀', courant: 5, precedent: 7, delta: -2, direction: 'down' },
    ],
    fenetre: { debut: now - 30 * DAY, fin: now },
    fenetrePrecedente: { debut: now - 60 * DAY, fin: now - 30 * DAY },
    totalActivite: 8,
    totalPrecedent: 8,
    directionGlobale: 'flat',
  }});
  assert.ok(html.includes('Scorecard PM'));
  assert.ok(html.includes('d-up'));
  assert.ok(html.includes('d-down'));
  assert.ok(html.includes('+2'));
  assert.ok(html.includes('-2'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof classifyHypotheses, 'function');
  assert.equal(typeof computeHypothesisLifecycle, 'function');
  assert.equal(typeof hypothesisLifecycleSection, 'function');
  assert.equal(typeof parseDeadline, 'function');
  assert.equal(typeof computeRoadmapTimeline, 'function');
  assert.equal(typeof roadmapTimelineSection, 'function');
  assert.equal(typeof computePmScorecard, 'function');
  assert.equal(typeof pmScorecardSection, 'function');
});
