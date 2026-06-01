// Tests #519 / #520 / #521 — Boucle 34 PM persona-outcome-matrix/throughput-trend/risk-concentration

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  calculerPersonaOutcomeMatrix, blocPersonaOutcomeMatrix,
  computePersonaOutcomeMatrix, personaOutcomeMatrixSection,
} from '../lib/dashboard/persona-outcome-matrix.js';

import {
  calculerThroughputTrend, blocThroughputTrend,
  computeThroughputTrend, throughputTrendSection,
} from '../lib/dashboard/throughput-trend.js';

import {
  calculerRiskConcentration, blocRiskConcentration,
  computeRiskConcentration, riskConcentrationSection,
} from '../lib/dashboard/risk-concentration.js';

const DAY = 24 * 3600 * 1000;
const SEM = 7 * DAY;

// ─── #519 — Persona × Outcome matrix ────────────────────────────────────────

test('calculerPersonaOutcomeMatrix — empty si pas de personas ou outcomes', () => {
  const r = calculerPersonaOutcomeMatrix({});
  assert.equal(r.lignes.length, 0);
});

test('calculerPersonaOutcomeMatrix — croise persona × outcome', () => {
  const r = calculerPersonaOutcomeMatrix({
    intents: [
      { id: 'A', personas: ['PM EU'] },
      { id: 'B', personas: ['PM EU', 'Dev'] },
    ],
    prdCoverage: {
      personas: { personas: [{ nom: 'PM EU' }, { nom: 'Dev' }] },
      outcomes: [
        { titre: 'O1', intents: [{ id: 'A' }, { id: 'B' }] },
        { titre: 'O2', intents: [{ id: 'B' }] },
      ],
    },
  });
  // PM EU × O1 = 2 (A+B), PM EU × O2 = 1 (B), Dev × O1 = 1 (B), Dev × O2 = 1 (B)
  const pmEU = r.lignes.find((l) => l.personaNom === 'PM EU');
  assert.equal(pmEU.cellules[0].count, 2);
  assert.equal(pmEU.cellules[1].count, 1);
  assert.equal(r.totaux.personas, 2);
  assert.equal(r.totaux.outcomes, 2);
});

test('blocPersonaOutcomeMatrix — empty + rendu cellules', () => {
  assert.ok(blocPersonaOutcomeMatrix({ personaOutcomeMatrix: { lignes: [], outcomes: [], totaux: { personas: 0, outcomes: 0 }}}).includes('matrice vide'));
  const html = blocPersonaOutcomeMatrix({ personaOutcomeMatrix: {
    lignes: [{ personaNom: 'PM EU', total: 2, cellules: [
      { outcomeTitre: 'O1', count: 2, intents: ['A', 'B'] },
      { outcomeTitre: 'O2', count: 0, intents: [] },
    ]}],
    outcomes: [{ titre: 'O1' }, { titre: 'O2' }],
    totaux: { personas: 1, outcomes: 2, cellulesActives: 1, cellulesBlanches: 1, personasSansCouverture: 0 },
  }});
  assert.ok(html.includes('Matrice persona × outcome'));
  assert.ok(html.includes('c-2'));
  assert.ok(html.includes('c-0'));
});

// ─── #520 — Throughput trend ────────────────────────────────────────────────

test('calculerThroughputTrend — intake/delivery par semaine', () => {
  const now = Date.now();
  const r = calculerThroughputTrend({
    intents: [
      { id: 'A', mtime: now - 2 * DAY, statut: 'active' }, // intake S0
      { id: 'B', mtime: now - 3 * DAY, statut: 'done' }, // intake+delivery S0
      { id: 'C', mtime: now - 10 * DAY, statut: 'archived' }, // intake+delivery S-1
    ],
  }, { now, nbSemaines: 3 });
  assert.equal(r.buckets.length, 3);
  const s0 = r.buckets[2];
  assert.equal(s0.intake, 2);
  assert.equal(s0.delivery, 1); // B done
});

test('calculerThroughputTrend — direction gonfle/réduit/équilibre', () => {
  const now = Date.now();
  // Beaucoup d'intake récents, aucune delivery
  const intents = [];
  for (let i = 0; i < 5; i++) intents.push({ id: 'I' + i, mtime: now - i * DAY, statut: 'active' });
  const r = calculerThroughputTrend({ intents }, { now });
  assert.equal(r.direction, 'gonfle');
});

test('blocThroughputTrend — rendu SVG + warning si gonfle', () => {
  const html = blocThroughputTrend({ throughputTrend: {
    buckets: [{ intake: 5, delivery: 1 }, { intake: 4, delivery: 0 }, { intake: 3, delivery: 0 }],
    nbSem: 3,
    cumul: { intake: 12, delivery: 1 },
    dernieres3: { intake: 12, delivery: 1 },
    direction: 'gonfle',
  }});
  assert.ok(html.includes('Throughput backlog'));
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('Backlog en croissance'));
});

// ─── #521 — Risk concentration ──────────────────────────────────────────────

test('calculerRiskConcentration — groupe risques élevés par sponsor', () => {
  const r = calculerRiskConcentration({
    intents: [
      { id: 'A', sponsor: 'Sales', titre: 'a' },
      { id: 'B', sponsor: 'Sales', titre: 'b' },
      { id: 'C', sponsor: 'Marketing', titre: 'c' },
    ],
    risks: { intents: [
      { id: 'A', niveau: 'critical' },
      { id: 'B', niveau: 'high' },
      { id: 'C', niveau: 'medium' }, // exclu
    ]},
  });
  const sales = r.items.find((i) => i.sponsor === 'Sales');
  assert.equal(sales.critical, 1);
  assert.equal(sales.high, 1);
  assert.equal(sales.total, 2);
  assert.equal(r.items.length, 1); // Marketing exclu (medium pas pris)
  assert.equal(r.totaux.hotspot, 'Sales');
});

test('calculerRiskConcentration — (sans sponsor) si non déclaré', () => {
  const r = calculerRiskConcentration({
    intents: [{ id: 'A', titre: 'sans sponsor' }],
    risks: { intents: [{ id: 'A', niveau: 'critical' }]},
  });
  assert.equal(r.items[0].sponsor, '(sans sponsor)');
});

test('calculerRiskConcentration — empty si pas de risques élevés', () => {
  const r = calculerRiskConcentration({ intents: [], risks: { intents: [{ niveau: 'medium' }]}});
  assert.equal(r.items.length, 0);
});

test('blocRiskConcentration — empty + rendu rows colorées', () => {
  assert.ok(blocRiskConcentration({ riskConcentration: { items: [], totaux: {}}}).includes('aucun risque élevé'));
  const html = blocRiskConcentration({ riskConcentration: {
    items: [{ sponsor: 'Sales', critical: 1, high: 0, total: 1, intents: [{ id: 'INTENT-A', titre: 't', niveau: 'critical' }]}],
    totaux: { sponsors: 1, totalCritical: 1, totalHigh: 0, hotspot: 'Sales' },
  }});
  assert.ok(html.includes('Concentration des risques'));
  assert.ok(html.includes('has-critical'));
  assert.ok(html.includes('Sales'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computePersonaOutcomeMatrix, 'function');
  assert.equal(typeof personaOutcomeMatrixSection, 'function');
  assert.equal(typeof computeThroughputTrend, 'function');
  assert.equal(typeof throughputTrendSection, 'function');
  assert.equal(typeof computeRiskConcentration, 'function');
  assert.equal(typeof riskConcentrationSection, 'function');
});
