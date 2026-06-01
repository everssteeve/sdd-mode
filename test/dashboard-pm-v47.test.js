// Tests #558 / #559 / #560 — Boucle 47 PM initiative-cards/spec-lifecycle-time/quick-filters

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  calculerInitiativeCards, blocInitiativeCards,
  computeInitiativeCards, initiativeCardsSection,
} from '../lib/dashboard/initiative-cards.js';

import {
  calculerSpecLifecycleTime, blocSpecLifecycleTime,
  computeSpecLifecycleTime, specLifecycleTimeSection,
} from '../lib/dashboard/spec-lifecycle-time.js';

import {
  calculerQuickFilters, blocQuickFilters,
  computeQuickFilters, quickFiltersSection,
} from '../lib/dashboard/quick-filters.js';

// ─── #558 — Initiative cards ────────────────────────────────────────────────

test('calculerInitiativeCards — groupe par tag + tri Intents desc', () => {
  const r = calculerInitiativeCards({
    intents: [
      { id: 'A', tags: ['paiement', 'sepa'], statut: 'active' },
      { id: 'B', tags: ['paiement'], statut: 'active' },
      { id: 'C', tags: ['onboarding'], statut: 'active' },
    ],
    specs: [
      { id: 'S1', parentIntent: 'A', statut: 'done' },
      { id: 'S2', parentIntent: 'A', statut: 'in-progress' },
    ],
  });
  // paiement : 2 intents → top
  assert.equal(r.items[0].tag, 'paiement');
  assert.equal(r.items[0].nbIntents, 2);
  // ratio = 1/2 = 50%
  assert.equal(r.items[0].ratio, 50);
});

test('calculerInitiativeCards — exclut archived + empty', () => {
  const r = calculerInitiativeCards({
    intents: [{ id: 'A', tags: ['x'], statut: 'archived' }],
  });
  assert.equal(r.items.length, 0);
});

test('blocInitiativeCards — empty + rendu', () => {
  assert.ok(blocInitiativeCards({ initiativeCards: { items: [], totaux: {}}}).includes('aucune initiative'));
  const html = blocInitiativeCards({ initiativeCards: {
    items: [{ tag: 'paiement', nbIntents: 2, nbSpecs: 3, livreesSpecs: 2, ratio: 67, lastMtime: Date.now(), intentsSample: [{ id: 'A' }]}],
    totaux: { total: 1, affiches: 1 },
  }});
  assert.ok(html.includes("Cartes d'initiatives"));
  assert.ok(html.includes('#paiement'));
  assert.ok(html.includes('67%'));
});

// ─── #559 — Spec lifecycle time ─────────────────────────────────────────────

function avecSnap(snaps) {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-sl-'));
  const rep = join(racine, '.aiad', 'metrics', 'pm-snapshots');
  mkdirSync(rep, { recursive: true });
  for (const [date, data] of Object.entries(snaps)) {
    writeFileSync(join(rep, `${date}.json`), JSON.stringify({ date, ...data }));
  }
  return racine;
}

test('calculerSpecLifecycleTime — message si < 2 snapshots', () => {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-sl-empty-'));
  assert.ok(calculerSpecLifecycleTime(racine).message);
  rmSync(racine, { recursive: true, force: true });
});

test('calculerSpecLifecycleTime — calcule durée par statut', () => {
  const racine = avecSnap({
    '2026-05-01': { specs: [{ id: 'S1', statut: 'draft' }] },
    '2026-05-08': { specs: [{ id: 'S1', statut: 'in-progress' }] },
    '2026-05-15': { specs: [{ id: 'S1', statut: 'done' }] },
  });
  const r = calculerSpecLifecycleTime(racine);
  const draft = r.items.find((i) => i.statut === 'draft');
  assert.ok(draft.median > 0);
  rmSync(racine, { recursive: true, force: true });
});

test('blocSpecLifecycleTime — message + rendu', () => {
  assert.ok(blocSpecLifecycleTime({ specLifecycleTime: { message: 'no snap', items: [] }}).includes('no snap'));
  const html = blocSpecLifecycleTime({ specLifecycleTime: {
    items: [{ statut: 'in-progress', median: 5, max: 12, nbObservations: 3 }],
    snapshots: 3, message: null,
  }});
  assert.ok(html.includes('Temps médian'));
  assert.ok(html.includes('s-in-progress'));
});

// ─── #560 — Quick filters ───────────────────────────────────────────────────

test('calculerQuickFilters — actif true', () => {
  const r = calculerQuickFilters();
  assert.equal(r.actif, true);
});

test('blocQuickFilters — rendu chips + script localStorage', () => {
  const html = blocQuickFilters();
  assert.ok(html.includes('Filtres rapides'));
  assert.ok(html.includes('data-filter="all"'));
  assert.ok(html.includes('data-filter="p0-actifs"'));
  assert.ok(html.includes('data-filter="zombies"'));
  assert.ok(html.includes('aiad-pm-quick-filter'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeInitiativeCards, 'function');
  assert.equal(typeof initiativeCardsSection, 'function');
  assert.equal(typeof computeSpecLifecycleTime, 'function');
  assert.equal(typeof specLifecycleTimeSection, 'function');
  assert.equal(typeof computeQuickFilters, 'function');
  assert.equal(typeof quickFiltersSection, 'function');
});
