// Tests #501 / #502 / #503 — Boucle 28 PM intent-compare/sponsor-prep/backlog-hygiene

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  calculerIntentCompare, blocIntentCompare,
  computeIntentCompare, intentCompareSection,
} from '../lib/dashboard/intent-compare.js';

import {
  calculerSponsorPrep, blocSponsorPrep,
  computeSponsorPrep, sponsorPrepSection,
} from '../lib/dashboard/sponsor-prep.js';

import {
  jaccard, calculerBacklogHygiene, blocBacklogHygiene,
  jaccardSimilarity, computeBacklogHygiene, backlogHygieneSection,
} from '../lib/dashboard/backlog-hygiene.js';

const DAY = 24 * 3600 * 1000;

// ─── #501 — Intent compare ──────────────────────────────────────────────────

test('calculerIntentCompare — sélection top 3 priorité par défaut', () => {
  const r = calculerIntentCompare({
    intents: [
      { id: 'A', titre: 'a', statut: 'active', priority: 'P0' },
      { id: 'B', titre: 'b', statut: 'active', priority: 'P1' },
      { id: 'C', titre: 'c', statut: 'active', priority: 'P3' },
      { id: 'D', titre: 'd', statut: 'done', priority: 'P0' }, // exclu
      { id: 'E', titre: 'e', statut: 'active', priority: 'P0' },
    ],
  });
  assert.equal(r.colonnes.length, 3);
  // Tri priorité : 2 P0 puis P1
  assert.ok(['A', 'E'].includes(r.defautIds[0]));
});

test('calculerIntentCompare — exclut done/archived', () => {
  const r = calculerIntentCompare({
    intents: [
      { id: 'A', statut: 'done' },
      { id: 'B', statut: 'archived' },
    ],
  });
  assert.equal(r.colonnes.length, 0);
});

test('calculerIntentCompare — enrichit chaque colonne avec SQS+avancement+risque', () => {
  const r = calculerIntentCompare({
    intents: [{ id: 'A', titre: 't', statut: 'active', priority: 'P0' }],
    sqsReadiness: { items: [{ id: 'A', etat: 'ready', score: { min: 4.5, avg: 4.5, scored: 2 } }] },
    pm: { avancement: [{ id: 'A', done: 2, total: 3, enCours: 1 }] },
    risks: { intents: [{ id: 'A', niveau: 'high' }] },
  });
  const col = r.colonnes[0];
  assert.equal(col.sqs.etat, 'ready');
  assert.equal(col.avancement.done, 2);
  assert.equal(col.risque.niveau, 'high');
});

test('blocIntentCompare — empty + rendu + script hashchange', () => {
  assert.ok(blocIntentCompare({ intentCompare: { colonnes: [], totalIntentsDispo: 0, defautIds: [] }}).includes('aucun Intent actif'));
  const html = blocIntentCompare({ intentCompare: {
    colonnes: [{
      id: 'INTENT-A', titre: 't', file: null, priority: 'P0', statut: 'active',
      sponsor: 'X', owner: null, targetDate: null,
      hypothesis: null, hypothesisStatus: null,
      sqs: null, avancement: null, risque: null, deps: null,
    }],
    defautIds: ['INTENT-A'],
    totalIntentsDispo: 1,
  }});
  assert.ok(html.includes('Compare Intents'));
  assert.ok(html.includes('data-compare-id="INTENT-A"'));
  assert.ok(html.includes('hashchange'));
  assert.ok(html.includes('ic-input'));
});

// ─── #502 — Sponsor prep ────────────────────────────────────────────────────

test('calculerSponsorPrep — agrège par sponsor + risques + échéances', () => {
  const r = calculerSponsorPrep({
    intents: [
      { id: 'INTENT-101', sponsor: 'Sales', statut: 'active', priority: 'P0', titre: 'a' },
      { id: 'INTENT-102', sponsor: 'Sales', statut: 'done', titre: 'b' },
      { id: 'INTENT-103', sponsor: 'Marketing', statut: 'draft', titre: 'c' },
    ],
    specs: [
      { id: 'SPEC-101-1', parentIntent: 'INTENT-101', statut: 'done', mtime: Date.now() },
    ],
    risks: { intents: [{ id: 'INTENT-101', niveau: 'critical' }] },
    deadlines: { items: [{ id: 'INTENT-101', targetDate: '2026-06-15', proximite: 'urgent' }] },
    stakeholderComms: { items: [{ id: 'INTENT-101', derniereComm: Date.now() - 5 * DAY }] },
  });
  const sales = r.items.find((s) => s.sponsor === 'Sales');
  assert.equal(sales.actifs, 1);
  assert.equal(sales.livres, 1);
  assert.equal(sales.specsLivrees, 1);
  assert.equal(sales.risquesEleves.length, 1);
  assert.equal(sales.echeancesProches.length, 1);
  assert.ok(sales.dernierContact != null);
});

test('calculerSponsorPrep — multi-sponsor par Intent', () => {
  const r = calculerSponsorPrep({
    intents: [{ id: 'A', sponsor: ['S1', 'S2'], statut: 'active' }],
    specs: [], risks: { intents: [] }, deadlines: { items: [] },
  });
  assert.equal(r.items.length, 2);
});

test('blocSponsorPrep — empty + cards par sponsor', () => {
  assert.ok(blocSponsorPrep({ sponsorPrep: { items: [], totaux: {} }}).includes('aucun sponsor déclaré'));
  const html = blocSponsorPrep({ sponsorPrep: {
    items: [{
      sponsor: 'Direction Sales',
      intents: [{ id: 'INTENT-101', titre: 't', statut: 'active', priority: 'P0' }],
      actifs: 1, livres: 1, drafts: 0,
      specsLivrees: 2,
      dernierLivrable: { id: 'SPEC-A', mtime: Date.now() - 3 * DAY },
      risquesEleves: [{ id: 'INTENT-101', niveau: 'critical', titre: 't' }],
      echeancesProches: [],
      dernierContact: Date.now() - 7 * DAY,
    }],
    totaux: { sponsors: 1, actifs: 1, avecRisque: 1 },
  }});
  assert.ok(html.includes('Prep 1:1 sponsor'));
  assert.ok(html.includes('Direction Sales'));
  assert.ok(html.includes('has-risk'));
});

// ─── #503 — Backlog hygiene ─────────────────────────────────────────────────

test('jaccard — calcule similarité correcte', () => {
  assert.equal(jaccard(['a', 'b', 'c'], ['a', 'b', 'c']), 1);
  assert.equal(jaccard(['a', 'b'], ['c', 'd']), 0);
  // a/b/c vs a/b/d = 2/4
  assert.equal(jaccard(['a', 'b', 'c'], ['a', 'b', 'd']), 0.5);
  assert.equal(jaccard([], ['a']), 0);
});

test('calculerBacklogHygiene — détecte les 4 buckets', () => {
  const now = Date.now();
  const r = calculerBacklogHygiene({
    intents: [
      // Draft vieux > 90j
      { id: 'A', statut: 'draft', mtime: now - 120 * DAY, titre: 'ancien draft' },
      // Active sans SPEC > 60j
      { id: 'B', statut: 'active', mtime: now - 80 * DAY, titre: 'active orphelin' },
      // Done très vieux > 180j
      { id: 'C', statut: 'done', mtime: now - 200 * DAY, titre: 'archive me' },
      // Récent ok
      { id: 'D', statut: 'active', mtime: now - 5 * DAY, titre: 'récent' },
      // Doublons potentiels
      { id: 'X', statut: 'active', mtime: now, titre: 'améliorer conversion paiement checkout SEPA' },
      { id: 'Y', statut: 'active', mtime: now, titre: 'améliorer conversion paiement checkout' },
    ],
    specs: [{ id: 'S1', parentIntent: 'D', statut: 'in-progress' }],
  }, { now });
  assert.equal(r.draftsVieux.length, 1);
  assert.equal(r.activeSansSpec.length, 1); // B exclu pas Y (Y a tokens proche de X)
  assert.equal(r.doneTresVieux.length, 1);
  assert.ok(r.doublons.length >= 1);
  assert.equal(r.doublons[0].a, 'X');
});

test('calculerBacklogHygiene — empty si backlog propre', () => {
  const r = calculerBacklogHygiene({
    intents: [{ id: 'A', statut: 'active', mtime: Date.now() - 5 * DAY }],
    specs: [{ parentIntent: 'A', statut: 'done', mtime: Date.now() }],
  });
  assert.equal(r.totaux.total, 0);
});

test('blocBacklogHygiene — empty + cards 4 buckets', () => {
  const empty = blocBacklogHygiene({ backlogHygiene: {
    draftsVieux: [], activeSansSpec: [], doneTresVieux: [], doublons: [],
    totaux: { total: 0 },
  }});
  assert.ok(empty.includes('Backlog propre'));
  const html = blocBacklogHygiene({ backlogHygiene: {
    draftsVieux: [{ id: 'A', titre: 't', age: 100, file: null }],
    activeSansSpec: [],
    doneTresVieux: [],
    doublons: [{ a: 'A', b: 'B', titreA: 't1', titreB: 't2', similarite: 0.75 }],
    totaux: { draftsVieux: 1, activeSansSpec: 0, doneTresVieux: 0, doublonsCandidats: 1, total: 2 },
  }});
  assert.ok(html.includes('Hygiène backlog'));
  assert.ok(html.includes('Drafts vieux'));
  assert.ok(html.includes('has-todo'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeIntentCompare, 'function');
  assert.equal(typeof intentCompareSection, 'function');
  assert.equal(typeof computeSponsorPrep, 'function');
  assert.equal(typeof sponsorPrepSection, 'function');
  assert.equal(typeof jaccardSimilarity, 'function');
  assert.equal(typeof computeBacklogHygiene, 'function');
  assert.equal(typeof backlogHygieneSection, 'function');
});
