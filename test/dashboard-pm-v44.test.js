// Tests #549 / #550 / #551 — Boucle 44 PM newcomer-checklist/pending-decisions/stakeholder-map

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  calculerNewcomerChecklist, blocNewcomerChecklist,
  computeNewcomerChecklist, newcomerChecklistSection,
} from '../lib/dashboard/newcomer-checklist.js';

import {
  calculerPendingDecisions, blocPendingDecisions,
  computePendingDecisions, pendingDecisionsSection,
} from '../lib/dashboard/pending-decisions.js';

import {
  calculerStakeholderMap, blocStakeholderMap,
  computeStakeholderMap, stakeholderMapSection,
} from '../lib/dashboard/stakeholder-map.js';

const DAY = 24 * 3600 * 1000;

// ─── #549 — Newcomer checklist ──────────────────────────────────────────────

test('calculerNewcomerChecklist — inclut cadrage + Intents + SPECs', () => {
  const r = calculerNewcomerChecklist({
    intents: [
      { id: 'A', priority: 'P0', statut: 'active', titre: 'top' },
      { id: 'B', priority: 'P1', statut: 'active', titre: 'mid' },
      { id: 'C', priority: 'P0', statut: 'done', titre: 'exclu' },
    ],
    specs: [{ id: 'S1', titre: 's', statut: 'review' }],
  });
  assert.ok(r.items.length >= 5);
  assert.ok(r.items[0].type === 'cadrage');
  assert.ok(r.items.some((i) => i.type === 'intent'));
  assert.ok(r.items.some((i) => i.type === 'spec'));
  assert.ok(r.totalMinutes > 0);
});

test('calculerNewcomerChecklist — exclut Intents done', () => {
  const r = calculerNewcomerChecklist({
    intents: [{ id: 'A', statut: 'done', priority: 'P0' }],
  });
  assert.ok(!r.items.some((i) => i.type === 'intent' && i.label.includes('A')));
});

test('blocNewcomerChecklist — rendu liste ordonnée', () => {
  const html = blocNewcomerChecklist({ newcomerChecklist: {
    items: [{ ordre: 1, type: 'cadrage', label: 'Lire PRD', cible: '.aiad/PRD.md', minutes: 15, priorite: 'incontournable' }],
    totalMinutes: 15,
    totaux: { total: 1, incontournables: 1 },
  }});
  assert.ok(html.includes('Onboarding nouveau membre'));
  assert.ok(html.includes('t-cadrage'));
  assert.ok(html.includes('incontournable'));
});

// ─── #550 — Pending decisions ───────────────────────────────────────────────

test('calculerPendingDecisions — détecte SPECs review + drafts vieux', () => {
  const now = Date.now();
  const r = calculerPendingDecisions({
    specs: [
      { id: 'S1', statut: 'review', titre: 't', mtime: now - 20 * DAY },
      { id: 'S2', statut: 'in-progress' },
    ],
    intents: [
      { id: 'A', statut: 'draft', mtime: now - 30 * DAY, titre: 'old draft' },
      { id: 'B', statut: 'draft', mtime: now - 5 * DAY, titre: 'frais' },
    ],
  }, { now });
  // S1 spec-review + A intent-draft
  assert.equal(r.totaux.specReview, 1);
  assert.equal(r.totaux.intentDraft, 1);
});

test('calculerPendingDecisions — détecte hypothèses untested anciennes', () => {
  const now = Date.now();
  const r = calculerPendingDecisions({
    intents: [
      { id: 'A', hypothesis: 'h', hypothesis_status: 'untested', mtime: now - 100 * DAY },
      { id: 'B', hypothesis: 'h', hypothesis_status: 'untested', mtime: now - 5 * DAY }, // exclu (frais)
    ],
  }, { now });
  assert.equal(r.totaux.hypoUntested, 1);
});

test('calculerPendingDecisions — détecte risques non-couverts', () => {
  const r = calculerPendingDecisions({
    riskTransparency: { items: [
      { id: 'A', titre: 't', niveau: 'critical', couvert: false },
      { id: 'B', titre: 't', niveau: 'high', couvert: true }, // exclu
    ]},
  });
  assert.equal(r.totaux.risqueDecouvert, 1);
});

test('blocPendingDecisions — empty + rendu', () => {
  assert.ok(blocPendingDecisions({ pendingDecisions: { items: [], totaux: { total: 0 }}}).includes('file vide'));
  const html = blocPendingDecisions({ pendingDecisions: {
    items: [{ type: 'spec-review', id: 'A', titre: 't', file: null, action: 'Valider', ageJours: 15, urgence: 'urgent' }],
    totaux: { total: 1, specReview: 1, intentDraft: 0, hypoUntested: 0, risqueDecouvert: 0, urgent: 1 },
  }});
  assert.ok(html.includes('Décisions en attente'));
  assert.ok(html.includes('urgent'));
});

// ─── #551 — Stakeholder map ─────────────────────────────────────────────────

test('calculerStakeholderMap — regroupe sponsor + owner', () => {
  const r = calculerStakeholderMap({
    intents: [
      { id: 'A', sponsor: 'Sales', owner: 'Alice', statut: 'active' },
      { id: 'B', sponsor: 'Sales', owner: 'Alice', statut: 'active' },
      { id: 'C', sponsor: 'Marketing', statut: 'active' },
    ],
  });
  const sales = r.items.find((i) => i.nom === 'Sales');
  assert.equal(sales.asSponsor.length, 2);
  const alice = r.items.find((i) => i.nom === 'Alice');
  assert.equal(alice.asOwner.length, 2);
});

test('calculerStakeholderMap — détecte double rôle', () => {
  const r = calculerStakeholderMap({
    intents: [{ id: 'A', sponsor: 'Alice', owner: 'Alice', statut: 'active' }],
  });
  const a = r.items.find((i) => i.nom === 'Alice');
  assert.ok(a.asSponsor.length > 0 && a.asOwner.length > 0);
  assert.equal(r.totaux.doubleRole, 1);
});

test('blocStakeholderMap — empty + rendu cards', () => {
  assert.ok(blocStakeholderMap({ stakeholderMap: { items: [], totaux: {}}}).includes('aucun stakeholder'));
  const html = blocStakeholderMap({ stakeholderMap: {
    items: [{
      nom: 'Sales',
      asSponsor: [{ id: 'A', titre: 't', statut: 'active', priority: 'P0' }],
      asOwner: [],
      asPersona: [],
      nbTotal: 1,
    }],
    totaux: { stakeholders: 1, doubleRole: 0 },
  }});
  assert.ok(html.includes('Carte stakeholder'));
  assert.ok(html.includes('Sales'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeNewcomerChecklist, 'function');
  assert.equal(typeof newcomerChecklistSection, 'function');
  assert.equal(typeof computePendingDecisions, 'function');
  assert.equal(typeof pendingDecisionsSection, 'function');
  assert.equal(typeof computeStakeholderMap, 'function');
  assert.equal(typeof stakeholderMapSection, 'function');
});
