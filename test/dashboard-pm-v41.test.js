// Tests #540 / #541 / #542 — Boucle 41 PM velocity-by-tag/auto-archive/sprint-recap

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  calculerVelocityByTag, blocVelocityByTag,
  computeVelocityByTag, velocityByTagSection,
} from '../lib/dashboard/velocity-by-tag.js';

import {
  calculerAutoArchiveCandidates, blocAutoArchiveCandidates,
  computeAutoArchiveCandidates, autoArchiveCandidatesSection,
} from '../lib/dashboard/auto-archive-candidates.js';

import {
  calculerSprintRecap, blocSprintRecap,
  computeSprintRecap, sprintRecapSection,
} from '../lib/dashboard/sprint-recap.js';

const DAY = 24 * 3600 * 1000;

// ─── #540 — Velocity by tag ─────────────────────────────────────────────────

test('calculerVelocityByTag — compte SPECs livrées par tag', () => {
  const r = calculerVelocityByTag({
    intents: [
      { id: 'INTENT-A', tags: ['paiement', 'sepa'] },
      { id: 'INTENT-B', tags: ['onboarding'] },
    ],
    specs: [
      { id: 'S1', parentIntent: 'INTENT-A', statut: 'done' },
      { id: 'S2', parentIntent: 'INTENT-A', statut: 'done' },
      { id: 'S3', parentIntent: 'INTENT-B', statut: 'in-progress' }, // exclu
    ],
  });
  const paiement = r.items.find((i) => i.tag === 'paiement');
  assert.equal(paiement.livrees, 2);
  assert.equal(paiement.nbIntents, 1);
});

test('calculerVelocityByTag — empty si aucune livrée', () => {
  const r = calculerVelocityByTag({});
  assert.equal(r.items.length, 0);
});

test('blocVelocityByTag — empty + rendu rows', () => {
  assert.ok(blocVelocityByTag({ velocityByTag: { items: [], totaux: {}}}).includes('aucun tag livré'));
  const html = blocVelocityByTag({ velocityByTag: {
    items: [{ tag: 'paiement', livrees: 5, nbIntents: 2, moyParIntent: 2.5, specsEchantillon: [{ id: 'S1' }]}],
    totaux: { tags: 1, totalLivrees: 5, topTag: 'paiement' },
  }});
  assert.ok(html.includes('Vélocité par tag'));
  assert.ok(html.includes('#paiement'));
  assert.ok(html.includes('top'));
});

// ─── #541 — Auto-archive candidates ─────────────────────────────────────────

test('calculerAutoArchiveCandidates — done > 60j → done-vieux', () => {
  const now = Date.now();
  const r = calculerAutoArchiveCandidates({
    intents: [
      { id: 'A', statut: 'done', mtime: now - 90 * DAY },
      { id: 'B', statut: 'done', mtime: now - 30 * DAY }, // pas encore
    ],
  }, { now });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].raison, 'done-vieux');
});

test('calculerAutoArchiveCandidates — draft > 120j → draft-abandonné', () => {
  const r = calculerAutoArchiveCandidates({
    intents: [{ id: 'A', statut: 'draft', mtime: Date.now() - 200 * DAY }],
  });
  assert.equal(r.items[0].raison, 'draft-abandonne');
});

test('calculerAutoArchiveCandidates — active > 365j sans SPEC done → zombie', () => {
  const now = Date.now();
  const r = calculerAutoArchiveCandidates({
    intents: [
      { id: 'A', statut: 'active', mtime: now - 400 * DAY },
      { id: 'B', statut: 'active', mtime: now - 400 * DAY }, // exclu (a SPEC done)
    ],
    specs: [{ parentIntent: 'B', statut: 'done', mtime: now }],
  }, { now });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].id, 'A');
  assert.equal(r.items[0].raison, 'zombie-chronique');
});

test('calculerAutoArchiveCandidates — exclut archived', () => {
  const r = calculerAutoArchiveCandidates({
    intents: [{ id: 'A', statut: 'archived', mtime: Date.now() - 500 * DAY }],
  });
  assert.equal(r.items.length, 0);
});

test('blocAutoArchiveCandidates — empty + rendu rows', () => {
  assert.ok(blocAutoArchiveCandidates({ autoArchiveCandidates: { items: [], totaux: {}}}).includes('aucun candidat'));
  const html = blocAutoArchiveCandidates({ autoArchiveCandidates: {
    items: [{ id: 'A', titre: 't', file: null, statut: 'draft', age: 200, raison: 'draft-abandonne', motif: 'Draft 200j' }],
    totaux: { total: 1, doneVieux: 0, draftAbandonne: 1, zombieChronique: 0 },
  }});
  assert.ok(html.includes('Candidats archivage'));
  assert.ok(html.includes('r-draft-abandonne'));
});

// ─── #542 — Sprint recap ────────────────────────────────────────────────────

test('calculerSprintRecap — compte livrées vs ajoutées', () => {
  const now = Date.now();
  const debut = now - 14 * DAY;
  const r = calculerSprintRecap({
    specs: [
      { id: 'A', statut: 'done', mtime: now - 5 * DAY }, // livrée pendant
      { id: 'B', statut: 'in-progress', mtime: debut - 5 * DAY }, // existant au début
      { id: 'C', statut: 'in-progress', mtime: now - 3 * DAY }, // ajoutée
    ],
  }, { now });
  assert.equal(r.totaux.livrees, 1);
  assert.equal(r.totaux.ajoutees, 1);
  assert.equal(r.totaux.enCoursAuDebut, 1);
});

test('calculerSprintRecap — durée custom', () => {
  const r = calculerSprintRecap({}, { dureeJours: 7 });
  assert.equal(r.totaux.duree, 7);
});

test('blocSprintRecap — empty + rendu', () => {
  assert.ok(blocSprintRecap({ sprintRecap: { totaux: { livrees: 0, ajoutees: 0, enCoursAuDebut: 0, duree: 14 }, livreesSample: [], ajouteesSample: [], enCoursAuDebutSample: [] }}).includes('aucune activité'));
  const html = blocSprintRecap({ sprintRecap: {
    totaux: { livrees: 5, ajoutees: 2, enCoursAuDebut: 7, completionRatio: 71, duree: 14, debutSprint: Date.now() - 14 * DAY, finSprint: Date.now() },
    livreesSample: [{ id: 'S1', titre: 't', mtime: Date.now() }],
    ajouteesSample: [],
    enCoursAuDebutSample: [{ id: 'S2', titre: 't', statut: 'in-progress' }],
  }});
  assert.ok(html.includes('Recap sprint'));
  assert.ok(html.includes('5/7'));
  assert.ok(html.includes('71%'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeVelocityByTag, 'function');
  assert.equal(typeof velocityByTagSection, 'function');
  assert.equal(typeof computeAutoArchiveCandidates, 'function');
  assert.equal(typeof autoArchiveCandidatesSection, 'function');
  assert.equal(typeof computeSprintRecap, 'function');
  assert.equal(typeof sprintRecapSection, 'function');
});
