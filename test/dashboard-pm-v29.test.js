// Tests #504 / #505 / #506 — Boucle 29 PM ttfs/customer-voice-wall/quarterly-delivery

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  calculerTimeToFirstSpec, blocTimeToFirstSpec,
  computeTimeToFirstSpec, timeToFirstSpecSection,
} from '../lib/dashboard/time-to-first-spec.js';

import {
  selectionnerCitations, calculerCustomerVoiceWall, blocCustomerVoiceWall,
  selectQuotes, computeCustomerVoiceWall, customerVoiceWallSection,
} from '../lib/dashboard/customer-voice-wall.js';

import {
  calculerQuarterlyDelivery, blocQuarterlyDelivery,
  computeQuarterlyDelivery, quarterlyDeliverySection,
} from '../lib/dashboard/quarterly-delivery.js';

const DAY = 24 * 3600 * 1000;

// ─── #504 — Time-to-first-SPEC ──────────────────────────────────────────────

test('calculerTimeToFirstSpec — TTFS = mtime SPEC première - mtime Intent', () => {
  const now = Date.now();
  const r = calculerTimeToFirstSpec({
    intents: [
      { id: 'INTENT-A', titre: 'a', statut: 'active', mtime: now - 30 * DAY },
    ],
    specs: [
      { id: 'SPEC-A-1', parentIntent: 'INTENT-A', statut: 'in-progress', mtime: now - 25 * DAY },
      { id: 'SPEC-A-2', parentIntent: 'INTENT-A', statut: 'in-progress', mtime: now - 20 * DAY },
    ],
  });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].ttfsJours, 5); // 30 - 25 = 5
  assert.equal(r.items[0].premiereSpec.id, 'SPEC-A-1'); // mtime min
  assert.equal(r.items[0].etat, 'rapide');
});

test('calculerTimeToFirstSpec — non-décomposé si aucune SPEC', () => {
  const r = calculerTimeToFirstSpec({
    intents: [{ id: 'A', titre: 't', statut: 'active', mtime: Date.now() }],
    specs: [],
  });
  assert.equal(r.items[0].etat, 'non-decompose');
  assert.equal(r.items[0].ttfsJours, null);
});

test('calculerTimeToFirstSpec — classes lent/très-lent selon seuils', () => {
  const now = Date.now();
  const r = calculerTimeToFirstSpec({
    intents: [
      { id: 'A', mtime: now - 100 * DAY },
      { id: 'B', mtime: now - 100 * DAY },
    ],
    specs: [
      { parentIntent: 'A', statut: 'done', mtime: now - 70 * DAY }, // 30j ttfs → lent
      { parentIntent: 'B', statut: 'done', mtime: now - 30 * DAY }, // 70j ttfs → très-lent
    ],
  });
  const a = r.items.find((i) => i.id === 'A');
  const b = r.items.find((i) => i.id === 'B');
  assert.equal(a.etat, 'lent');
  assert.equal(b.etat, 'tres-lent');
});

test('calculerTimeToFirstSpec — exclut archived + tri non-décomposé en tête', () => {
  const now = Date.now();
  const r = calculerTimeToFirstSpec({
    intents: [
      { id: 'A', statut: 'archived', mtime: now }, // exclu
      { id: 'B', statut: 'active', mtime: now }, // non-décomposé
      { id: 'C', statut: 'active', mtime: now - 10 * DAY },
    ],
    specs: [{ parentIntent: 'C', statut: 'done', mtime: now - 5 * DAY }],
  });
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].id, 'B'); // non-décomposé en tête
});

test('blocTimeToFirstSpec — empty + stats + rows', () => {
  assert.ok(blocTimeToFirstSpec({ timeToFirstSpec: { items: [], totaux: {}, ttfsMoyen: null }}).includes('aucun Intent'));
  const html = blocTimeToFirstSpec({ timeToFirstSpec: {
    items: [{
      id: 'INTENT-A', titre: 't', file: null, statut: 'active',
      mtime: Date.now() - 30 * DAY, premiereSpec: { id: 'SPEC-1', mtime: Date.now() - 20 * DAY },
      ttfsJours: 10, etat: 'normal',
    }],
    totaux: { total: 1, rapide: 0, normal: 1, lent: 0, tresLent: 0, nonDecompose: 0 },
    ttfsMoyen: 10,
  }});
  assert.ok(html.includes('Time-to-first-SPEC'));
  assert.ok(html.includes('e-normal'));
  assert.ok(html.includes('TTFS moyen'));
});

// ─── #505 — Customer voice wall ─────────────────────────────────────────────

test('selectionnerCitations — priorise négatif puis question puis positif', () => {
  const items = [
    { fichier: 'f1', sentiment: 'positif' },
    { fichier: 'f2', sentiment: 'negatif' },
    { fichier: 'f3', sentiment: 'question' },
    { fichier: 'f4', sentiment: 'negatif' },
    { fichier: 'f5', sentiment: 'neutre' },
  ];
  const r = selectionnerCitations(items);
  assert.equal(r[0].sentiment, 'negatif');
  assert.ok(r.some((c) => c.sentiment === 'question'));
});

test('selectionnerCitations — dédup par fichier + max', () => {
  const items = [{ fichier: 'f1', sentiment: 'negatif' }, { fichier: 'f1', sentiment: 'negatif' }];
  const r = selectionnerCitations(items, { max: 3 });
  assert.equal(r.length, 1);
});

test('selectionnerCitations — empty array → []', () => {
  assert.deepEqual(selectionnerCitations([]), []);
});

test('calculerCustomerVoiceWall — nettoie + tronque l\'extrait', () => {
  const r = calculerCustomerVoiceWall({
    customerFeedback: { items: [
      { fichier: 'f', sentiment: 'negatif', extrait: 'multi\nline\ntexte avec    espaces' },
    ]},
  });
  assert.equal(r.citations.length, 1);
  assert.ok(!r.citations[0].citation.includes('\n'));
  assert.ok(!r.citations[0].citation.includes('   '));
});

test('blocCustomerVoiceWall — empty + rendu cards', () => {
  assert.ok(blocCustomerVoiceWall({ customerVoiceWall: { citations: [], totaux: {} }}).includes('aucun feedback impactant'));
  const html = blocCustomerVoiceWall({ customerVoiceWall: {
    citations: [{
      fichier: 'f.md', sentiment: 'negatif', author: 'Alice', source: 'utilisateur',
      intent: 'INTENT-101', date: Date.now(), citation: 'Bug grave sur le paiement.',
    }],
    totalSource: 1,
    totaux: { affiches: 1, negatifs: 1, questions: 0, positifs: 0 },
  }});
  assert.ok(html.includes('Mur de la voix client'));
  assert.ok(html.includes('s-negatif'));
  assert.ok(html.includes('Alice'));
  assert.ok(html.includes('INTENT-101'));
});

// ─── #506 — Quarterly delivery ──────────────────────────────────────────────

test('calculerQuarterlyDelivery — buckets par trimestre + écart', () => {
  const tsQ2 = Date.UTC(2026, 4, 15); // mai 2026 → Q2-2026
  const tsQ3 = Date.UTC(2026, 7, 15); // août 2026 → Q3-2026
  const r = calculerQuarterlyDelivery({
    intents: [
      { id: 'A', target_date: '2026-05-25', statut: 'active' }, // Q2
      { id: 'B', target: 'Q2-2026', statut: 'active' }, // Q2
      { id: 'C', target: 'Q3-2026', statut: 'active' }, // Q3
    ],
    specs: [
      { id: 'S1', statut: 'done', mtime: tsQ2 },
      { id: 'S2', statut: 'done', mtime: tsQ2 },
      { id: 'S3', statut: 'done', mtime: tsQ3 },
      { id: 'S4', statut: 'in-progress', mtime: tsQ2 }, // exclu
    ],
  });
  const q2 = r.items.find((b) => b.trim === 'Q2-2026');
  assert.equal(q2.planifie, 2);
  assert.equal(q2.livre, 2);
  assert.equal(q2.ecart, 0);
  const q3 = r.items.find((b) => b.trim === 'Q3-2026');
  assert.equal(q3.planifie, 1);
  assert.equal(q3.livre, 1);
});

test('calculerQuarterlyDelivery — exclut archived', () => {
  const r = calculerQuarterlyDelivery({
    intents: [
      { id: 'A', target: 'Q1-2026', statut: 'archived' }, // exclu
      { id: 'B', target: 'Q1-2026', statut: 'active' },
    ],
    specs: [],
  });
  const q1 = r.items.find((b) => b.trim === 'Q1-2026');
  assert.equal(q1.planifie, 1);
});

test('calculerQuarterlyDelivery — totaux globaux', () => {
  const r = calculerQuarterlyDelivery({
    intents: [
      { id: 'A', target: 'Q1-2026', statut: 'active' },
      { id: 'B', target: 'Q2-2026', statut: 'active' },
    ],
    specs: [
      { statut: 'done', mtime: Date.UTC(2026, 0, 15) }, // Q1
      { statut: 'done', mtime: Date.UTC(2026, 0, 20) }, // Q1
    ],
  });
  assert.equal(r.totaux.totalPlanifie, 2);
  assert.equal(r.totaux.totalLivre, 2);
});

test('blocQuarterlyDelivery — empty + table rows', () => {
  assert.ok(blocQuarterlyDelivery({ quarterlyDelivery: { items: [], totaux: {} }}).includes('aucun trimestre'));
  const html = blocQuarterlyDelivery({ quarterlyDelivery: {
    items: [{ trim: 'Q2-2026', planifie: 2, livre: 1, ecart: -1, ratio: 0.5, intentsPlanifies: [], specsLivrees: [] }],
    totaux: { trimestres: 1, totalPlanifie: 2, totalLivre: 1, couvertures: 0, deficits: 1 },
  }});
  assert.ok(html.includes('Livraison par trimestre'));
  assert.ok(html.includes('Q2-2026'));
  assert.ok(html.includes('qd-ecart negatif'));
  assert.ok(html.includes('50%'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeTimeToFirstSpec, 'function');
  assert.equal(typeof timeToFirstSpecSection, 'function');
  assert.equal(typeof selectQuotes, 'function');
  assert.equal(typeof computeCustomerVoiceWall, 'function');
  assert.equal(typeof customerVoiceWallSection, 'function');
  assert.equal(typeof computeQuarterlyDelivery, 'function');
  assert.equal(typeof quarterlyDeliverySection, 'function');
});
