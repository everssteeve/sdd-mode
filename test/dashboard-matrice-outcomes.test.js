// @spec SPEC-018-1-matrice-outcomes-intents
// @intent INTENT-018

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  calculerMatriceOutcomesIntents,
  blocMatriceOutcomesIntents,
} from '../lib/dashboard/outcome-attribution.js';

// Fixture : 2 outcomes, 3 Intents (dont 1 sans correspondance)
const INTENTS = [
  { id: 'INTENT-001', titre: 'Améliorer la onboarding', statut: 'done', outcomes: ['Performance'] },
  { id: 'INTENT-002', titre: 'Réduire la latence', statut: 'active', outcomes: ['Performance', 'Fiabilité'] },
  { id: 'INTENT-003', titre: 'Intent sans outcome', statut: 'in-progress' /* pas de champ outcomes */ },
];

const ATTRIBUTION = {
  items: [
    { titre: 'Performance', ratio: 0.5, specsLivrees: 1, specsTotal: 2 },
    { titre: 'Fiabilité', ratio: null, specsLivrees: 0, specsTotal: 0 },
  ],
  totaux: { outcomes: 2, avecContribution: 1, sansContribution: 1, totalSpecsLivrees: 1 },
};

const DONNEES_BASE = { intents: INTENTS, outcomeAttribution: ATTRIBUTION };

// ─── calculerMatriceOutcomesIntents ─────────────────────────────────────────

test('retourne un item par outcome présent dans outcomeAttribution', () => {
  const r = calculerMatriceOutcomesIntents(DONNEES_BASE);
  assert.equal(r.length, 2);
  assert.ok(r.find((i) => i.outcomeTitre === 'Performance'));
  assert.ok(r.find((i) => i.outcomeTitre === 'Fiabilité'));
});

test('intentsContributeurs correct pour "Performance"', () => {
  const r = calculerMatriceOutcomesIntents(DONNEES_BASE);
  const perf = r.find((i) => i.outcomeTitre === 'Performance');
  assert.equal(perf.intentsContributeurs.length, 2);
  const ids = perf.intentsContributeurs.map((i) => i.id);
  assert.ok(ids.includes('INTENT-001'));
  assert.ok(ids.includes('INTENT-002'));
});

test('intentsActifs et intentsTermines corrects', () => {
  const r = calculerMatriceOutcomesIntents(DONNEES_BASE);
  const perf = r.find((i) => i.outcomeTitre === 'Performance');
  // INTENT-001 done → terminés=1 ; INTENT-002 active → actifs=1
  assert.equal(perf.intentsActifs, 1);
  assert.equal(perf.intentsTermines, 1);
});

test('Intent sans champ outcomes absent de tous les contributeurs', () => {
  const r = calculerMatriceOutcomesIntents(DONNEES_BASE);
  for (const item of r) {
    const ids = item.intentsContributeurs.map((i) => i.id);
    assert.ok(!ids.includes('INTENT-003'), 'INTENT-003 ne doit pas apparaître');
  }
});

test('outcome sans Intent contributeur présent (cellule vide, pas de crash)', () => {
  const donnees = {
    intents: [],
    outcomeAttribution: ATTRIBUTION,
  };
  const r = calculerMatriceOutcomesIntents(donnees);
  assert.equal(r.length, 2);
  for (const item of r) {
    assert.equal(item.intentsContributeurs.length, 0);
    assert.equal(item.intentsActifs, 0);
    assert.equal(item.intentsTermines, 0);
  }
});

test('retourne [] si outcomeAttribution absent', () => {
  assert.deepEqual(calculerMatriceOutcomesIntents({}), []);
  assert.deepEqual(calculerMatriceOutcomesIntents(null), []);
});

// ─── blocMatriceOutcomesIntents ──────────────────────────────────────────────

test('blocMatriceOutcomesIntents — affiche "Aucun outcome" si tableau vide', () => {
  const html = blocMatriceOutcomesIntents({ matriceOutcomesIntents: [] });
  assert.ok(html.includes('Aucun outcome'));
});

test('blocMatriceOutcomesIntents — tableau HTML AA-conforme', () => {
  const donnees = {
    ...DONNEES_BASE,
    matriceOutcomesIntents: calculerMatriceOutcomesIntents(DONNEES_BASE),
  };
  const html = blocMatriceOutcomesIntents(donnees);
  assert.ok(html.includes('<table>'), 'doit contenir <table>');
  assert.ok(html.includes('<caption>'), 'doit contenir <caption>');
  assert.ok(html.includes('<thead>'), 'doit contenir <thead>');
  assert.ok(html.includes('scope="col"'), 'doit avoir th scope="col"');
  assert.ok(html.includes('<tbody>'), 'doit contenir <tbody>');
  // Pas d'info codée par couleur seule : les compteurs sont en texte
  assert.ok(html.includes('INTENT-001'), 'doit lister les Intents');
});
