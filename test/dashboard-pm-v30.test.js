// Tests #507 / #508 / #509 — Boucle 30 PM review-queue/accepted-risks/wins-wall

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  calculerReviewQueue, blocReviewQueue,
  computeReviewQueue, reviewQueueSection,
} from '../lib/dashboard/review-queue.js';

import {
  extraireAcceptes, calculerAcceptedRisks, blocAcceptedRisks,
  extractAccepted, computeAcceptedRisks, acceptedRisksSection,
} from '../lib/dashboard/accepted-risks.js';

import {
  calculerWinsWall, blocWinsWall,
  computeWinsWall, winsWallSection,
} from '../lib/dashboard/wins-wall.js';

const DAY = 24 * 3600 * 1000;

// ─── #507 — Review queue ────────────────────────────────────────────────────

test('calculerReviewQueue — empty si aucune SPEC review/validation', () => {
  const r = calculerReviewQueue({
    specs: [{ statut: 'in-progress' }, { statut: 'done' }],
  });
  assert.equal(r.items.length, 0);
});

test('calculerReviewQueue — classes frais/tiède/bloqué selon âge', () => {
  const now = Date.now();
  const r = calculerReviewQueue({
    specs: [
      { id: 'A', statut: 'review', mtime: now - 3 * DAY }, // frais
      { id: 'B', statut: 'validation', mtime: now - 10 * DAY }, // tiede
      { id: 'C', statut: 'review', mtime: now - 20 * DAY }, // bloqué
    ],
  }, { now });
  assert.equal(r.items.length, 3);
  assert.equal(r.totaux.frais, 1);
  assert.equal(r.totaux.tiede, 1);
  assert.equal(r.totaux.bloque, 1);
  // Tri âge desc → C (20j) en tête
  assert.equal(r.items[0].id, 'C');
});

test('blocReviewQueue — empty + rendu cards', () => {
  assert.ok(blocReviewQueue({ reviewQueue: { items: [], totaux: { total: 0 }}}).includes('file vide'));
  const html = blocReviewQueue({ reviewQueue: {
    items: [{
      id: 'SPEC-A', titre: 't', file: null, statut: 'review',
      parentIntent: 'INTENT-101', mtime: Date.now() - 20 * DAY, ageJours: 20, etat: 'bloque', sqs: 4.2,
    }],
    totaux: { total: 1, frais: 0, tiede: 0, bloque: 1 },
  }});
  assert.ok(html.includes('File de revue SPECs'));
  assert.ok(html.includes('r-bloque'));
  assert.ok(html.includes('SQS 4.2/5'));
});

// ─── #508 — Accepted risks ──────────────────────────────────────────────────

test('extraireAcceptes — frontmatter risks_accepted array', () => {
  const r = extraireAcceptes({ risks_accepted: ['risque A', 'risque B'] });
  assert.deepEqual(r.accepted, ['risque A', 'risque B']);
  assert.equal(r.tousAcceptes, false);
});

test('extraireAcceptes — alias EN + risk_status accepted', () => {
  const a = extraireAcceptes({ acceptedRisks: 'r1; r2' });
  assert.deepEqual(a.accepted, ['r1', 'r2']);
  const b = extraireAcceptes({ risk_status: 'accepted' });
  assert.equal(b.tousAcceptes, true);
  const c = extraireAcceptes({ riskStatus: 'all-accepted' });
  assert.equal(c.tousAcceptes, true);
});

test('extraireAcceptes — vide → liste vide + tousAcceptes false', () => {
  const r = extraireAcceptes({});
  assert.deepEqual(r.accepted, []);
  assert.equal(r.tousAcceptes, false);
});

test('calculerAcceptedRisks — exclut Intents sans acceptation + sans archived', () => {
  const r = calculerAcceptedRisks({
    intents: [
      { id: 'A', risks_accepted: ['r1'], statut: 'active' },
      { id: 'B', statut: 'active' }, // exclu pas d'acceptation
      { id: 'C', risks_accepted: ['r2'], statut: 'archived' }, // exclu archived
      { id: 'D', risk_status: 'accepted', statut: 'active' },
    ],
  });
  assert.equal(r.items.length, 2);
  assert.equal(r.totaux.intents, 2);
  assert.equal(r.totaux.risquesAcceptes, 1); // A
  assert.equal(r.totaux.tousAcceptes, 1); // D
});

test('blocAcceptedRisks — empty + rendu', () => {
  assert.ok(blocAcceptedRisks({ acceptedRisks: { items: [], totaux: { intents: 0 }}}).includes('aucun risque accepté'));
  const html = blocAcceptedRisks({ acceptedRisks: {
    items: [{
      id: 'INTENT-A', titre: 't', file: null, statut: 'active', sponsor: null,
      accepted: ['risque résiduel 1'], tousAcceptes: false, nbRisques: 1,
    }],
    totaux: { intents: 1, risquesAcceptes: 1, tousAcceptes: 0 },
  }});
  assert.ok(html.includes('Registre des risques acceptés'));
  assert.ok(html.includes('risque résiduel 1'));
});

// ─── #509 — Wins wall ───────────────────────────────────────────────────────

test('calculerWinsWall — fenêtre 30j + tri desc', () => {
  const now = Date.now();
  const r = calculerWinsWall({
    specs: [
      { id: 'SPEC-old', statut: 'done', mtime: now - 60 * DAY }, // exclu
      { id: 'SPEC-recent', statut: 'done', mtime: now - 5 * DAY }, // inclus
      { id: 'SPEC-archived', statut: 'archived', mtime: now - 2 * DAY }, // inclus
    ],
    intents: [
      { id: 'INTENT-A', statut: 'archived', mtime: now - 10 * DAY }, // inclus
    ],
  }, { now });
  assert.equal(r.items.length, 3);
  assert.equal(r.items[0].id, 'SPEC-archived'); // plus récent en tête
  assert.equal(r.totaux.specs, 2);
  assert.equal(r.totaux.intents, 1);
});

test('calculerWinsWall — exclut done sans mtime', () => {
  const r = calculerWinsWall({
    specs: [{ statut: 'done' }, { statut: 'done', mtime: Date.now() }],
  });
  assert.equal(r.items.length, 1);
});

test('blocWinsWall — empty si fenêtre vide', () => {
  assert.ok(blocWinsWall({ winsWall: { items: [], totaux: { total: 0, specs: 0, intents: 0 }}}).includes('aucun livrable'));
});

test('blocWinsWall — rendu cards + banner counts', () => {
  const html = blocWinsWall({ winsWall: {
    items: [
      { type: 'spec', id: 'SPEC-A', titre: 't', file: null, statut: 'done', parentIntent: 'INTENT-1', mtime: Date.now() - 2 * DAY },
      { type: 'intent', id: 'INTENT-B', titre: 'b', file: null, statut: 'archived', sponsor: 'X', mtime: Date.now() - 5 * DAY },
    ],
    totaux: { total: 2, specs: 1, intents: 1, now: Date.now() },
  }});
  assert.ok(html.includes('Wins récents'));
  assert.ok(html.includes('🚀'));
  assert.ok(html.includes('🎯'));
  assert.ok(html.includes('1 SPEC(s) livrée(s)'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeReviewQueue, 'function');
  assert.equal(typeof reviewQueueSection, 'function');
  assert.equal(typeof extractAccepted, 'function');
  assert.equal(typeof computeAcceptedRisks, 'function');
  assert.equal(typeof acceptedRisksSection, 'function');
  assert.equal(typeof computeWinsWall, 'function');
  assert.equal(typeof winsWallSection, 'function');
});
