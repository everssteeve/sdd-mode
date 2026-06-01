// Tests #492 / #493 / #494 — Boucle 25 PM outcome-attribution/dd-balance/velocity-by-sponsor

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  calculerOutcomeAttribution, blocOutcomeAttribution,
  computeOutcomeAttribution, outcomeAttributionSection,
} from '../lib/dashboard/outcome-attribution.js';

import {
  classifierIntent, calculerDiscoveryDeliveryBalance, blocDiscoveryDeliveryBalance,
  classifyIntent, computeDiscoveryDeliveryBalance, discoveryDeliveryBalanceSection,
  TARGET_RATIOS,
} from '../lib/dashboard/discovery-delivery-balance.js';

import {
  calculerVelocityBySponsor, blocVelocityBySponsor,
  computeVelocityBySponsor, velocityBySponsorSection,
} from '../lib/dashboard/velocity-by-sponsor.js';

const DAY = 24 * 3600 * 1000;

// ─── #492 — Outcome attribution ─────────────────────────────────────────────

test('calculerOutcomeAttribution — empty si aucun outcome', () => {
  const r = calculerOutcomeAttribution({});
  assert.equal(r.items.length, 0);
  assert.equal(r.totaux.outcomes, 0);
});

test('calculerOutcomeAttribution — agrège SPECs livrées par outcome', () => {
  const r = calculerOutcomeAttribution({
    prdCoverage: { outcomes: [
      { titre: 'Outcome 1', intents: [{ id: 'INTENT-101' }, { id: 'INTENT-102' }] },
      { titre: 'Outcome 2', intents: [{ id: 'INTENT-103' }] },
    ]},
    specs: [
      { id: 'SPEC-101-1', parentIntent: 'INTENT-101', statut: 'done', mtime: Date.now() },
      { id: 'SPEC-101-2', parentIntent: 'INTENT-101', statut: 'in-progress' }, // exclu
      { id: 'SPEC-102-1', parentIntent: 'INTENT-102', statut: 'archived', mtime: Date.now() },
      // INTENT-103 sans SPEC
    ],
  });
  assert.equal(r.items.length, 2);
  // Outcome 1 a 2 livrées sur 3 specs
  const o1 = r.items.find((i) => i.titre === 'Outcome 1');
  assert.equal(o1.specsLivrees, 2);
  assert.equal(o1.specsTotal, 3);
  assert.equal(o1.ratio, 0.67);
  // Outcome 2 sans livraison
  const o2 = r.items.find((i) => i.titre === 'Outcome 2');
  assert.equal(o2.specsLivrees, 0);
  assert.equal(o2.specsTotal, 0);
  assert.equal(r.totaux.avecContribution, 1);
  assert.equal(r.totaux.sansContribution, 1);
  assert.equal(r.totaux.totalSpecsLivrees, 2);
});

test('blocOutcomeAttribution — empty + cards', () => {
  assert.ok(blocOutcomeAttribution({ outcomeAttribution: { items: [], totaux: {} }}).includes('aucun outcome'));
  const html = blocOutcomeAttribution({ outcomeAttribution: {
    items: [{
      titre: 'O1', target: null, nbIntents: 2, specsLivrees: 2, specsTotal: 3, ratio: 0.67,
      specsAttribues: [{ id: 'SPEC-1', statut: 'done' }, { id: 'SPEC-2', statut: 'done' }],
    }],
    totaux: { outcomes: 1, avecContribution: 1, sansContribution: 0, totalSpecsLivrees: 2 },
  }});
  assert.ok(html.includes('Attribution outcomes'));
  assert.ok(html.includes('has-contrib'));
  assert.ok(html.includes('SPEC-1'));
});

// ─── #493 — Discovery vs delivery balance ───────────────────────────────────

test('classifierIntent — kind discovery → bucket discovery', () => {
  const r = classifierIntent({ kind: 'discovery' }, []);
  assert.equal(r.bucket, 'discovery');
  assert.equal(r.source, 'kind');
});

test('classifierIntent — kind experiment → discovery', () => {
  assert.equal(classifierIntent({ kind: 'experiment' }, []).bucket, 'discovery');
});

test('classifierIntent — kind delivery → delivery', () => {
  assert.equal(classifierIntent({ kind: 'delivery' }, []).bucket, 'delivery');
});

test('classifierIntent — heuristique : hypothèse non validée + draft → discovery', () => {
  const r = classifierIntent({ statut: 'draft', hypothesis: 'h', hypothesis_status: 'untested' }, []);
  assert.equal(r.bucket, 'discovery');
  assert.equal(r.source, 'heuristique-hypothese');
});

test('classifierIntent — heuristique : active + SPECs ≥ 1 → delivery', () => {
  const r = classifierIntent({ statut: 'active' }, [{ id: 'SPEC-1' }]);
  assert.equal(r.bucket, 'delivery');
  assert.equal(r.source, 'heuristique-specs');
});

test('classifierIntent — pas de signal → inconnu', () => {
  const r = classifierIntent({ statut: 'draft' }, []);
  assert.equal(r.bucket, 'inconnu');
});

test('calculerDiscoveryDeliveryBalance — buckets + pcts + santé', () => {
  const r = calculerDiscoveryDeliveryBalance({
    intents: [
      { id: 'A', kind: 'delivery', statut: 'active' },
      { id: 'B', kind: 'delivery', statut: 'active' },
      { id: 'C', kind: 'discovery', statut: 'active' },
      { id: 'D', kind: 'enabler', statut: 'active' },
    ],
    specs: [],
  });
  assert.equal(r.total, 4);
  assert.equal(r.buckets.delivery, 2);
  assert.equal(r.buckets.discovery, 1);
  assert.equal(r.buckets.enabler, 1);
  assert.equal(r.pcts.delivery, 50);
});

test('blocDiscoveryDeliveryBalance — empty + bar segments', () => {
  assert.ok(blocDiscoveryDeliveryBalance({ discoveryDeliveryBalance: { total: 0 }}).includes('aucun Intent'));
  const html = blocDiscoveryDeliveryBalance({ discoveryDeliveryBalance: {
    buckets: { discovery: 1, delivery: 2, enabler: 0, inconnu: 0 },
    pcts: { discovery: 33, delivery: 67, enabler: 0, inconnu: 0 },
    echantillons: { discovery: [], delivery: [], enabler: [], inconnu: [] },
    total: 3,
    sante: { delivery: { etat: 'sain', delta: 2 }, discovery: { etat: 'sain', delta: 8 }, enabler: { etat: 'tendu', delta: -10 } },
    cibles: TARGET_RATIOS,
  }});
  assert.ok(html.includes('Discovery / Delivery balance'));
  assert.ok(html.includes('b-delivery'));
  assert.ok(html.includes('b-discovery'));
});

// ─── #494 — Velocity by sponsor ─────────────────────────────────────────────

test('calculerVelocityBySponsor — agrège par sponsor + throughput', () => {
  const now = Date.now();
  const r = calculerVelocityBySponsor({
    intents: [
      { id: 'INTENT-101', sponsor: 'Sales', statut: 'active' },
      { id: 'INTENT-102', sponsor: 'Sales', statut: 'active' },
      { id: 'INTENT-103', sponsor: 'Marketing', statut: 'active' },
    ],
    specs: [
      { id: 'SPEC-101-1', parentIntent: 'INTENT-101', statut: 'done', mtime: now - 5 * DAY },
      { id: 'SPEC-101-2', parentIntent: 'INTENT-101', statut: 'in-progress', mtime: now },
      { id: 'SPEC-102-1', parentIntent: 'INTENT-102', statut: 'done', mtime: now - 10 * DAY },
      { id: 'SPEC-103-1', parentIntent: 'INTENT-103', statut: 'draft', mtime: now },
    ],
  }, { now });
  const sales = r.items.find((i) => i.sponsor === 'Sales');
  assert.equal(sales.nbIntents, 2);
  assert.equal(sales.nbLivrees, 2);
  assert.equal(sales.throughput, 1);
  assert.ok(sales.cycleTimeMoyen >= 0);
  const mkt = r.items.find((i) => i.sponsor === 'Marketing');
  assert.equal(mkt.nbLivrees, 0);
  // Tri : Sales d'abord
  assert.equal(r.items[0].sponsor, 'Sales');
});

test('calculerVelocityBySponsor — multi-sponsor par Intent', () => {
  const r = calculerVelocityBySponsor({
    intents: [{ id: 'INTENT-A', sponsor: ['Direction Sales', 'Direction Tech'] }],
    specs: [{ parentIntent: 'INTENT-A', statut: 'done', mtime: Date.now() }],
  });
  assert.equal(r.items.length, 2);
  assert.ok(r.items.every((i) => i.nbLivrees === 1));
});

test('calculerVelocityBySponsor — empty si aucun sponsor', () => {
  const r = calculerVelocityBySponsor({ intents: [{ id: 'A' }], specs: [] });
  assert.equal(r.items.length, 0);
  assert.equal(r.totaux.sponsors, 0);
});

test('blocVelocityBySponsor — empty + médailles', () => {
  assert.ok(blocVelocityBySponsor({ velocityBySponsor: { items: [], totaux: { sponsors: 0 }}}).includes('aucun sponsor'));
  const html = blocVelocityBySponsor({ velocityBySponsor: {
    items: [
      { sponsor: 'S1', nbIntents: 3, nbLivrees: 3, throughput: 1, cycleTimeMoyen: 5, intents: [] },
      { sponsor: 'S2', nbIntents: 2, nbLivrees: 1, throughput: 0.5, cycleTimeMoyen: 10, intents: [] },
    ],
    totaux: { sponsors: 2, sponsorAvecLivraison: 2, meilleurThroughput: 'S1' },
  }});
  assert.ok(html.includes('Vélocité par sponsor'));
  assert.ok(html.includes('🥇'));
  assert.ok(html.includes('S1'));
  assert.ok(html.includes('vs-bar-fill'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeOutcomeAttribution, 'function');
  assert.equal(typeof outcomeAttributionSection, 'function');
  assert.equal(typeof classifyIntent, 'function');
  assert.equal(typeof computeDiscoveryDeliveryBalance, 'function');
  assert.equal(typeof discoveryDeliveryBalanceSection, 'function');
  assert.ok(TARGET_RATIOS.delivery > 0);
  assert.equal(typeof computeVelocityBySponsor, 'function');
  assert.equal(typeof velocityBySponsorSection, 'function');
});
