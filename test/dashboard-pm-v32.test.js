// Tests #513 / #514 / #515 — Boucle 32 PM spec-stuck/tag-clusters/cost-of-delay

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  calculerSpecStuck, blocSpecStuck,
  computeSpecStuck, specStuckSection, STUCK_THRESHOLDS,
} from '../lib/dashboard/spec-stuck.js';

import {
  calculerTagClusters, blocTagClusters,
  computeTagClusters, tagClustersSection,
} from '../lib/dashboard/tag-clusters.js';

import {
  calculerCostOfDelay, blocCostOfDelay,
  computeCostOfDelay, costOfDelaySection,
} from '../lib/dashboard/cost-of-delay.js';

const DAY = 24 * 3600 * 1000;

// ─── #513 — SPEC stuck ──────────────────────────────────────────────────────

test('calculerSpecStuck — détecte SPECs au-delà des seuils', () => {
  const now = Date.now();
  const r = calculerSpecStuck({
    specs: [
      { id: 'A', statut: 'draft', mtime: now - 60 * DAY }, // > 45j
      { id: 'B', statut: 'in-progress', mtime: now - 25 * DAY }, // > 21j
      { id: 'C', statut: 'in-progress', mtime: now - 10 * DAY }, // OK
      { id: 'D', statut: 'done', mtime: now - 100 * DAY }, // exclu (terminal)
    ],
  }, { now });
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].depassement > 0, true);
  // Tri par dépassement desc
  assert.equal(r.items[0].id, 'A'); // 60-45 = 15 vs B 25-21=4
});

test('calculerSpecStuck — seuils custom', () => {
  const now = Date.now();
  const r = calculerSpecStuck({
    specs: [{ id: 'A', statut: 'draft', mtime: now - 10 * DAY }],
  }, { now, seuils: { draft: 5 } });
  assert.equal(r.items.length, 1);
});

test('calculerSpecStuck — empty si pipeline fluide', () => {
  const r = calculerSpecStuck({
    specs: [{ id: 'A', statut: 'draft', mtime: Date.now() }],
  });
  assert.equal(r.items.length, 0);
});

test('blocSpecStuck — empty + rendu rows', () => {
  assert.ok(blocSpecStuck({ specStuck: { items: [], totaux: { total: 0, parStatut: {} }, seuils: STUCK_THRESHOLDS }}).includes('aucune SPEC stagnante'));
  const html = blocSpecStuck({ specStuck: {
    items: [{
      id: 'SPEC-A', titre: 't', file: null, statut: 'draft',
      parentIntent: 'INTENT-101', mtime: Date.now() - 60 * DAY,
      ageJours: 60, seuil: 45, depassement: 15,
    }],
    totaux: { total: 1, parStatut: { draft: 1 }},
    seuils: STUCK_THRESHOLDS,
  }});
  assert.ok(html.includes('SPECs bloquées'));
  assert.ok(html.includes('60j'));
  assert.ok(html.includes('+15j'));
});

// ─── #514 — Tag clusters ────────────────────────────────────────────────────

test('calculerTagClusters — détecte paires co-occurentes', () => {
  const r = calculerTagClusters({
    intents: [
      { id: 'A', tags: ['paiement', 'sepa', 'mobile'] },
      { id: 'B', tags: ['paiement', 'sepa'] },
      { id: 'C', tags: ['onboarding', 'mobile'] },
    ],
  }, { seuilMin: 2 });
  // paiement+sepa : 2 fois → cluster
  const cluster = r.clusters.find((c) => c.tags.includes('paiement') && c.tags.includes('sepa'));
  assert.ok(cluster);
  assert.equal(cluster.effectif, 2);
});

test('calculerTagClusters — exclut archived', () => {
  const r = calculerTagClusters({
    intents: [
      { id: 'A', tags: ['x', 'y'], statut: 'archived' },
      { id: 'B', tags: ['x', 'y'], statut: 'active' },
    ],
  }, { seuilMin: 1 });
  assert.ok(r.totaux.intents <= 1);
});

test('calculerTagClusters — topTags listé', () => {
  const r = calculerTagClusters({
    intents: [{ id: 'A', tags: ['paiement'] }, { id: 'B', tags: ['paiement', 'mobile'] }],
  });
  const top = r.topTags.find((t) => t.tag === 'paiement');
  assert.equal(top.count, 2);
});

test('blocTagClusters — empty + rendu clusters', () => {
  assert.ok(blocTagClusters({ tagClusters: { clusters: [], topTags: [], totaux: {} }}).includes('aucun cluster détecté'));
  const html = blocTagClusters({ tagClusters: {
    clusters: [{ tags: ['paiement', 'sepa'], effectif: 2, intents: [{ id: 'INTENT-101', titre: 't' }] }],
    topTags: [{ tag: 'paiement', count: 2 }],
    totaux: { intents: 2, tagsUniques: 2, clusters: 1 },
  }});
  assert.ok(html.includes('Clusters thématiques'));
  assert.ok(html.includes('#paiement'));
  assert.ok(html.includes('#sepa'));
});

// ─── #515 — Cost of delay ───────────────────────────────────────────────────

test('calculerCostOfDelay — score P0 retard > P3 distant', () => {
  const now = Date.UTC(2026, 4, 15);
  const r = calculerCostOfDelay({
    intents: [
      { id: 'A', priority: 'P0', statut: 'active', target_date: '2026-05-01' }, // retard
      { id: 'B', priority: 'P3', statut: 'active', target_date: '2027-01-01' }, // distant
    ],
  }, { now });
  assert.equal(r.items[0].id, 'A');
  assert.ok(r.items[0].cod > r.items[1].cod);
});

test('calculerCostOfDelay — multiplicateurs urgence corrects', () => {
  const now = Date.UTC(2026, 4, 15);
  const r = calculerCostOfDelay({
    intents: [
      { id: 'A', priority: 'P0', statut: 'active', target_date: '2026-05-01' }, // retard ×3
      { id: 'B', priority: 'P0', statut: 'active', target_date: '2026-05-30' }, // urgent ×2
    ],
  }, { now });
  const a = r.items.find((i) => i.id === 'A');
  const b = r.items.find((i) => i.id === 'B');
  assert.equal(a.urgenceClasse, 'retard');
  assert.equal(b.urgenceClasse, 'urgent');
  assert.ok(a.cod > b.cod);
});

test('calculerCostOfDelay — exclut done/archived', () => {
  const r = calculerCostOfDelay({
    intents: [
      { id: 'A', priority: 'P0', statut: 'active' },
      { id: 'B', priority: 'P0', statut: 'done' },
      { id: 'C', priority: 'P0', statut: 'archived' },
    ],
  });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].id, 'A');
});

test('calculerCostOfDelay — tier critical/élevé/standard', () => {
  const intents = [];
  for (let i = 0; i < 10; i++) intents.push({ id: 'I' + i, priority: 'P' + (i % 4), statut: 'active' });
  const r = calculerCostOfDelay({ intents });
  assert.equal(r.totaux.total, 10);
  // ~30 % critical / 30 % élevé / 40 % standard
  assert.ok(r.totaux.critical > 0);
  assert.ok(r.totaux.standard > 0);
});

test('blocCostOfDelay — empty + rendu rows colorées', () => {
  assert.ok(blocCostOfDelay({ costOfDelay: { items: [], totaux: {} }}).includes('aucun Intent actif'));
  const html = blocCostOfDelay({ costOfDelay: {
    items: [{
      id: 'INTENT-A', titre: 't', file: null, statut: 'active', priority: 'P0',
      poidsPrio: 50, target: null, urgenceClasse: 'retard', urgenceMult: 3, statutMult: 1.2,
      cod: 180, tier: 'critical',
    }],
    totaux: { total: 1, critical: 1, eleve: 0, standard: 0 },
    formule: 'poidsPrio × urgenceTarget × multStatut',
  }});
  assert.ok(html.includes('Cost-of-delay'));
  assert.ok(html.includes('t-critical'));
  assert.ok(html.includes('retard'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeSpecStuck, 'function');
  assert.equal(typeof specStuckSection, 'function');
  assert.ok(STUCK_THRESHOLDS.draft > 0);
  assert.equal(typeof computeTagClusters, 'function');
  assert.equal(typeof tagClustersSection, 'function');
  assert.equal(typeof computeCostOfDelay, 'function');
  assert.equal(typeof costOfDelaySection, 'function');
});
