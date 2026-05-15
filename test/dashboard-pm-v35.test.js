// Tests #522 / #523 / #524 — Boucle 35 PM discovery-to-delivery/owner-workload/reading-time

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  calculerDiscoveryToDelivery, blocDiscoveryToDelivery,
  computeDiscoveryToDelivery, discoveryToDeliverySection,
} from '../lib/dashboard/discovery-to-delivery.js';

import {
  calculerOwnerWorkload, blocOwnerWorkload,
  computeOwnerWorkload, ownerWorkloadSection,
} from '../lib/dashboard/owner-workload.js';

import {
  calculerReadingTime, blocReadingTime,
  computeReadingTime, readingTimeSection, READING_SPEED_WPM,
} from '../lib/dashboard/reading-time.js';

const DAY = 24 * 3600 * 1000;

// ─── #522 — Discovery → Delivery ────────────────────────────────────────────

test('calculerDiscoveryToDelivery — empty si pas de discovery livré', () => {
  const r = calculerDiscoveryToDelivery({
    intents: [{ id: 'A', kind: 'delivery', mtime: Date.now() }],
    specs: [{ parentIntent: 'A', statut: 'done', mtime: Date.now() }],
  });
  assert.equal(r.items.length, 0);
});

test('calculerDiscoveryToDelivery — calcule cycle pour discovery', () => {
  const now = Date.now();
  const r = calculerDiscoveryToDelivery({
    intents: [
      { id: 'A', kind: 'discovery', mtime: now - 30 * DAY },
      { id: 'B', kind: 'experiment', mtime: now - 100 * DAY },
    ],
    specs: [
      { id: 'SPEC-A-1', parentIntent: 'A', statut: 'done', mtime: now - 20 * DAY },
      { id: 'SPEC-B-1', parentIntent: 'B', statut: 'archived', mtime: now - 5 * DAY },
    ],
  });
  assert.equal(r.items.length, 2);
  const a = r.items.find((i) => i.id === 'A');
  assert.equal(a.cycleJours, 10);
  assert.equal(a.bucket, 'tres-court');
  const b = r.items.find((i) => i.id === 'B');
  assert.equal(b.cycleJours, 95);
  assert.equal(b.bucket, 'long');
  assert.ok(r.cycleMoyen > 0);
});

test('blocDiscoveryToDelivery — empty + rendu stats', () => {
  assert.ok(blocDiscoveryToDelivery({ discoveryToDelivery: { items: [], totaux: {}, cycleMoyen: null, cycleMedian: null }}).includes('aucun Intent discovery'));
  const html = blocDiscoveryToDelivery({ discoveryToDelivery: {
    items: [{
      id: 'A', titre: 't', file: null, kind: 'discovery',
      specLivree: { id: 'SPEC-A-1', mtime: Date.now() }, intentMtime: Date.now() - 10 * DAY,
      cycleJours: 10, bucket: 'tres-court',
    }],
    totaux: { total: 1, tresCourt: 1, court: 0, moyen: 0, long: 0, tresLong: 0 },
    cycleMoyen: 10, cycleMedian: 10,
  }});
  assert.ok(html.includes('Discovery → Delivery'));
  assert.ok(html.includes('b-tres-court'));
});

// ─── #523 — Owner workload ──────────────────────────────────────────────────

test('calculerOwnerWorkload — distribue par owner avec capacity', () => {
  const r = calculerOwnerWorkload({
    intents: [
      { id: 'A', owner: 'Alice', statut: 'active' },
      { id: 'B', owner: 'Alice', statut: 'in-progress' },
      { id: 'C', owner: 'Alice', statut: 'active' },
      { id: 'D', owner: 'Alice', statut: 'active', capacity: 3 },
      { id: 'E', owner: 'Bob', statut: 'active' },
    ],
  });
  const alice = r.items.find((i) => i.owner === 'Alice');
  assert.equal(alice.charge, 4);
  assert.equal(alice.capacite, 3); // depuis frontmatter
  // ratio 4/3 = 1.33 → surcharge
  assert.equal(alice.etat, 'surcharge');
  const bob = r.items.find((i) => i.owner === 'Bob');
  assert.equal(bob.charge, 1);
  assert.equal(bob.capacite, 3); // défaut
});

test('calculerOwnerWorkload — multi-owners par Intent', () => {
  const r = calculerOwnerWorkload({
    intents: [{ id: 'A', owner: ['Alice', 'Bob'], statut: 'active' }],
  });
  assert.equal(r.items.length, 2);
});

test('blocOwnerWorkload — empty + rendu rows', () => {
  assert.ok(blocOwnerWorkload({ ownerWorkload: { items: [], totaux: { owners: 0, capaciteDefaut: 3 }}}).includes('aucun owner déclaré'));
  const html = blocOwnerWorkload({ ownerWorkload: {
    items: [{
      owner: 'Alice', actifs: [{ id: 'A', titre: 't', statut: 'active' }],
      inactifs: [], capacity: null, capacite: 3, charge: 1, ratio: 0.33, etat: 'leger',
    }],
    totaux: { owners: 1, surcharges: 0, libres: 0, capaciteDefaut: 3 },
  }});
  assert.ok(html.includes('Charge par owner'));
  assert.ok(html.includes('e-leger'));
});

// ─── #524 — Reading time ────────────────────────────────────────────────────

test('calculerReadingTime — estime mots + minutes', () => {
  const longText = 'mot '.repeat(500); // 500 mots
  const r = calculerReadingTime({
    intents: [{ id: 'A', titre: 't', body: longText }],
    specs: [{ id: 'S', titre: 's', body: '' }],
  });
  const intentA = r.items.find((i) => i.id === 'A');
  assert.equal(intentA.mots, 500);
  // 500 / 220 ≈ 2.3 → 3 (Math.round + min 1)
  assert.ok(intentA.minutes >= 2);
});

test('calculerReadingTime — trop long si > 8 min', () => {
  const veryLong = 'mot '.repeat(2000); // 2000 mots → ~9 min
  const r = calculerReadingTime({
    intents: [{ id: 'X', body: veryLong }],
  });
  assert.equal(r.items[0].trop_long, true);
});

test('calculerReadingTime — utilise sections si pas de body', () => {
  const r = calculerReadingTime({
    intents: [{ id: 'A', sections: { pourquoi: 'mot '.repeat(100), objectif: 'mot '.repeat(100) }}],
  });
  // 200 mots
  assert.ok(r.items[0].mots >= 100);
});

test('calculerReadingTime — totaux + moyenne', () => {
  const r = calculerReadingTime({
    intents: [{ id: 'A', body: 'mot '.repeat(220) }, { id: 'B', body: 'mot '.repeat(440) }],
    specs: [],
  });
  assert.equal(r.totaux.intents, 2);
  assert.ok(r.totaux.totalMinutes >= 3);
  assert.ok(r.totaux.moyenneMinutes > 0);
});

test('blocReadingTime — rendu + trop-long highlight', () => {
  const html = blocReadingTime({ readingTime: {
    items: [{
      type: 'intent', id: 'INTENT-A', titre: 't', file: null, statut: 'active',
      mots: 2000, minutes: 9, trop_long: true,
    }],
    intents: [], specs: [],
    totaux: { total: 1, intents: 1, specs: 0, totalMinutes: 9, moyenneMinutes: 9, tropLongs: 1, vitesseMotsParMin: READING_SPEED_WPM },
  }});
  assert.ok(html.includes('Temps de lecture'));
  assert.ok(html.includes('trop-long'));
  assert.ok(html.includes('9 min'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeDiscoveryToDelivery, 'function');
  assert.equal(typeof discoveryToDeliverySection, 'function');
  assert.equal(typeof computeOwnerWorkload, 'function');
  assert.equal(typeof ownerWorkloadSection, 'function');
  assert.equal(typeof computeReadingTime, 'function');
  assert.equal(typeof readingTimeSection, 'function');
  assert.equal(READING_SPEED_WPM, 220);
});
