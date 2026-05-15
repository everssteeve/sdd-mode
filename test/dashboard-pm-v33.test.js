// Tests #516 / #517 / #518 — Boucle 33 PM backlog-pyramid/spec-cross-intent/blocker-reminders

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  calculerBacklogPyramid, blocBacklogPyramid,
  computeBacklogPyramid, backlogPyramidSection, PYRAMID_BUCKETS,
} from '../lib/dashboard/backlog-pyramid.js';

import {
  calculerSpecCrossIntent, blocSpecCrossIntent,
  computeSpecCrossIntent, specCrossIntentSection,
} from '../lib/dashboard/spec-cross-intent.js';

import {
  calculerBlockerReminders, blocBlockerReminders,
  computeBlockerReminders, blockerRemindersSection,
} from '../lib/dashboard/blocker-reminders.js';

const DAY = 24 * 3600 * 1000;

// ─── #516 — Backlog pyramid ─────────────────────────────────────────────────

test('calculerBacklogPyramid — répartit dans buckets selon âge', () => {
  const now = Date.now();
  const r = calculerBacklogPyramid({
    intents: [
      { id: 'A', statut: 'active', mtime: now - 5 * DAY }, // neuf
      { id: 'B', statut: 'active', mtime: now - 20 * DAY }, // recent
      { id: 'C', statut: 'active', mtime: now - 60 * DAY }, // mature
      { id: 'D', statut: 'active', mtime: now - 100 * DAY }, // ancien
      { id: 'E', statut: 'active', mtime: now - 200 * DAY }, // heritage
      { id: 'F', statut: 'done', mtime: now }, // exclu
    ],
  }, { now });
  assert.equal(r.total, 5);
  assert.equal(r.buckets.find((b) => b.cle === 'neuf').count, 1);
  assert.equal(r.buckets.find((b) => b.cle === 'recent').count, 1);
  assert.equal(r.buckets.find((b) => b.cle === 'mature').count, 1);
  assert.equal(r.buckets.find((b) => b.cle === 'ancien').count, 1);
  assert.equal(r.buckets.find((b) => b.cle === 'heritage').count, 1);
});

test('calculerBacklogPyramid — empty si rien', () => {
  const r = calculerBacklogPyramid({ intents: [] });
  assert.equal(r.total, 0);
});

test('blocBacklogPyramid — empty + rendu segments', () => {
  assert.ok(blocBacklogPyramid({ backlogPyramid: { total: 0, buckets: [], ageMoyen: 0 }}).includes('aucun Intent actif'));
  const html = blocBacklogPyramid({ backlogPyramid: {
    buckets: PYRAMID_BUCKETS.map((b) => ({ ...b, items: [], count: b.cle === 'neuf' ? 3 : 0 })),
    total: 3, ageMoyen: 5,
  }});
  assert.ok(html.includes("Pyramide d'âge backlog"));
  assert.ok(html.includes('bp-bar-seg'));
});

// ─── #517 — SPEC cross-intent ───────────────────────────────────────────────

test('calculerSpecCrossIntent — détecte SPECs avec ≥ 2 intents', () => {
  const r = calculerSpecCrossIntent({
    intents: [{ id: 'INTENT-101' }, { id: 'INTENT-102' }],
    specs: [
      { id: 'SPEC-A', parentIntent: 'INTENT-101', intents: ['INTENT-102'] }, // 2 intents
      { id: 'SPEC-B', parentIntent: 'INTENT-101' }, // 1 intent
    ],
  });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].id, 'SPEC-A');
  assert.equal(r.items[0].nbIntents, 2);
  assert.ok(r.items[0].intentsAdditionnels.includes('INTENT-102'));
});

test('calculerSpecCrossIntent — ignore refs vers Intents inexistants', () => {
  const r = calculerSpecCrossIntent({
    intents: [{ id: 'INTENT-101' }],
    specs: [{ id: 'SPEC-A', parentIntent: 'INTENT-101', intents: ['INTENT-999'] }],
  });
  assert.equal(r.items.length, 0); // un seul Intent valide → pas croisé
});

test('blocSpecCrossIntent — empty clean + rendu cards', () => {
  assert.ok(blocSpecCrossIntent({ specCrossIntent: { items: [], totaux: { specs: 0, totalSpecs: 0 }}}).includes('aucune SPEC croisée'));
  const html = blocSpecCrossIntent({ specCrossIntent: {
    items: [{
      id: 'SPEC-A', titre: 't', file: null, statut: 'done',
      parent: 'INTENT-101', intentsAdditionnels: ['INTENT-102'],
      nbIntents: 2, refs: ['INTENT-101', 'INTENT-102'],
    }],
    totaux: { specs: 1, totalSpecs: 2, maxIntentsCroises: 2 },
  }});
  assert.ok(html.includes('SPECs transverses'));
  assert.ok(html.includes('SPEC-A'));
  assert.ok(html.includes('parent INTENT-101'));
  assert.ok(html.includes('INTENT-102'));
});

// ─── #518 — Blocker reminders ───────────────────────────────────────────────

test('calculerBlockerReminders — génère snippet sponsor silencieux', () => {
  const r = calculerBlockerReminders({
    stakeholderComms: { items: [
      { id: 'INTENT-A', titre: 't', sponsor: 'Sales', etat: 'silencieux', jours: 45, statut: 'active' },
      { id: 'INTENT-B', titre: 't2', sponsor: 'Marketing', etat: 'recent', jours: 3 },
    ]},
  });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].type, 'sponsor-silent');
  assert.ok(r.items[0].corps.includes('Sales'));
});

test('calculerBlockerReminders — relance pour SPEC bloquée', () => {
  const r = calculerBlockerReminders({
    reviewQueue: { items: [
      { id: 'SPEC-A', titre: 't', statut: 'review', etat: 'bloque', ageJours: 25, parentIntent: 'INTENT-A' },
    ]},
  });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].type, 'spec-stuck');
});

test('calculerBlockerReminders — relance pour risque non-accepté', () => {
  const r = calculerBlockerReminders({
    risks: { intents: [
      { id: 'INTENT-A', niveau: 'critical', risques: [{ texte: 'bug critique' }] },
    ]},
    intents: [{ id: 'INTENT-A', titre: 'X', owner: 'Alice' }],
    acceptedRisks: { items: [] },
  });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].type, 'risque-ouvert');
  assert.ok(r.items[0].corps.includes('Alice'));
});

test('calculerBlockerReminders — risque accepté exclu', () => {
  const r = calculerBlockerReminders({
    risks: { intents: [{ id: 'INTENT-A', niveau: 'critical', risques: [{ texte: 'x' }]}]},
    acceptedRisks: { items: [{ id: 'INTENT-A' }] },
    intents: [{ id: 'INTENT-A' }],
  });
  assert.equal(r.items.length, 0);
});

test('blocBlockerReminders — empty + rendu cartes + script copier', () => {
  assert.ok(blocBlockerReminders({ blockerReminders: { items: [], totaux: { total: 0 }}}).includes('aucun blocker'));
  const html = blocBlockerReminders({ blockerReminders: {
    items: [{
      type: 'sponsor-silent', cible: 'sponsor', sujet: 'Sync',
      corps: 'Bonjour, message.', intent: 'INTENT-A',
    }],
    totaux: { total: 1, sponsorSilent: 1, specStuck: 0, risqueOuvert: 0 },
  }});
  assert.ok(html.includes('Relances blockers'));
  assert.ok(html.includes('t-sponsor-silent'));
  assert.ok(html.includes('data-br-action="copy"'));
  assert.ok(html.includes('navigator.clipboard'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeBacklogPyramid, 'function');
  assert.equal(typeof backlogPyramidSection, 'function');
  assert.ok(Array.isArray(PYRAMID_BUCKETS));
  assert.equal(typeof computeSpecCrossIntent, 'function');
  assert.equal(typeof specCrossIntentSection, 'function');
  assert.equal(typeof computeBlockerReminders, 'function');
  assert.equal(typeof blockerRemindersSection, 'function');
});
