// Tests #435 / #436 / #437 — Boucle 6 PM cockpit ownership/bottlenecks :
//   - portefeuille par owner (Mes Intents)
//   - détection de goulots d'étranglement
//   - portefeuille par sponsor (préparation 1:1 / COMEX)

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  calculerOwnership, blocOwnership,
  computeOwnership, ownershipSection,
} from '../lib/dashboard/ownership.js';

import {
  calculerBottlenecks, blocBottlenecks, SEUILS_DEFAUT,
  computeBottlenecks, bottlenecksSection, DEFAULT_THRESHOLDS,
} from '../lib/dashboard/bottlenecks.js';

import {
  calculerSponsors, blocSponsors,
  computeSponsors, sponsorsSection,
} from '../lib/dashboard/sponsors.js';

const days = (n) => n * 24 * 3600 * 1000;

// ─── #435 — Ownership ────────────────────────────────────────────────────────

test('calculerOwnership — owner string simple', () => {
  const d = { intents: [
    { id: 'A', titre: 't', statut: 'active', owner: 'Steeve' },
    { id: 'B', titre: 't', statut: 'done', owner: 'Steeve' },
    { id: 'C', titre: 't', statut: 'draft', owner: 'Alice' },
  ]};
  const r = calculerOwnership(d);
  assert.equal(r.owners.length, 2);
  const steeve = r.owners.find((o) => o.nom === 'Steeve');
  assert.equal(steeve.totaux.total, 2);
  assert.equal(steeve.totaux.actifs, 1);
  assert.equal(steeve.totaux.livres, 1);
  assert.equal(r.totaux.ownersReels, 2);
  assert.equal(r.totaux.sansOwner, 0);
});

test('calculerOwnership — owners array + multi-owner', () => {
  const d = { intents: [
    { id: 'A', statut: 'active', owners: ['Steeve', 'Alice'] },
  ]};
  const r = calculerOwnership(d);
  assert.equal(r.owners.length, 2);
});

test('calculerOwnership — owner string "a, b" splitté', () => {
  const d = { intents: [{ id: 'A', statut: 'active', owner: 'Steeve, Alice' }] };
  const r = calculerOwnership(d);
  assert.equal(r.owners.length, 2);
});

test('calculerOwnership — sans owner → _unassigned', () => {
  const d = { intents: [
    { id: 'A', statut: 'active' },
    { id: 'B', statut: 'active', owner: 'Steeve' },
  ]};
  const r = calculerOwnership(d);
  assert.equal(r.totaux.ownersReels, 1);
  assert.equal(r.totaux.sansOwner, 1);
  // _unassigned est en queue
  assert.equal(r.owners[r.owners.length - 1].nom, '_unassigned');
});

test('calculerOwnership — alias pm/assignee reconnus', () => {
  const d = { intents: [
    { id: 'A', statut: 'active', pm: 'Steeve' },
    { id: 'B', statut: 'active', assignee: 'Alice' },
  ]};
  const r = calculerOwnership(d);
  assert.equal(r.totaux.ownersReels, 2);
});

test('blocOwnership — empty si aucun owner', () => {
  assert.equal(blocOwnership({ ownership: { owners: [], totaux: {} } }), '');
});

test('blocOwnership — rend cards + chips', () => {
  const html = blocOwnership({ ownership: {
    owners: [
      { nom: 'Steeve', intents: [{ id: 'INTENT-A', titre: 't', statut: 'active', file: 'a.md' }], totaux: { total: 1, actifs: 1, livres: 0 } },
      { nom: '_unassigned', intents: [{ id: 'INTENT-B', titre: 't', statut: 'draft', file: null }], totaux: { total: 1, actifs: 1, livres: 0 } },
    ],
    totaux: { ownersReels: 1, sansOwner: 1 },
  }});
  assert.ok(html.includes('Portefeuille par owner'));
  assert.ok(html.includes('Steeve'));
  assert.ok(html.includes('Sans owner'));
  assert.ok(html.includes('owner-card unassigned'));
  assert.ok(html.includes('INTENT-A'));
});

// ─── #436 — Bottlenecks ─────────────────────────────────────────────────────

test('calculerBottlenecks — pas de goulot si compteur < seuil', () => {
  const now = Date.now();
  const d = { intents: [
    { id: 'A', statut: 'draft', mtime: now - days(30) },
    { id: 'B', statut: 'draft', mtime: now - days(30) },
  ]};
  // Seuil draft = 5 → 2 items en draft n'atteint pas le seuil
  const r = calculerBottlenecks(d, { now });
  assert.equal(r.total, 0);
});

test('calculerBottlenecks — pas de goulot si compteur OK mais tous récents', () => {
  const now = Date.now();
  const d = { intents: Array.from({ length: 6 }, (_, i) => ({
    id: `INTENT-${i}`, statut: 'draft', mtime: now - days(2),
  }))};
  const r = calculerBottlenecks(d, { now });
  assert.equal(r.total, 0, 'count >= 5 mais tous < 14j → pas goulot');
});

test('calculerBottlenecks — goulot si compteur ≥ seuil ET au moins 1 vieux', () => {
  const now = Date.now();
  const d = { intents: Array.from({ length: 6 }, (_, i) => ({
    id: `INTENT-${i}`, statut: 'draft', mtime: now - days(i === 0 ? 30 : 2),
  }))};
  const r = calculerBottlenecks(d, { now });
  assert.equal(r.intents.length, 1);
  assert.equal(r.intents[0].statut, 'draft');
  assert.equal(r.intents[0].total, 6);
  assert.equal(r.intents[0].itemsAges.length, 1);
});

test('calculerBottlenecks — détecte specs en review depuis > 7j', () => {
  const now = Date.now();
  const d = { specs: Array.from({ length: 3 }, (_, i) => ({
    id: `SPEC-${i}`, statut: 'review', mtime: now - days(10),
  }))};
  const r = calculerBottlenecks(d, { now });
  assert.equal(r.specs.length, 1);
  assert.equal(r.specs[0].itemsAges.length, 3);
});

test('blocBottlenecks — message "aucun" si total=0', () => {
  const html = blocBottlenecks({ bottlenecks: { intents: [], specs: [], total: 0 } });
  assert.ok(html.includes('aucun'));
});

test('blocBottlenecks — rend cards par type', () => {
  const html = blocBottlenecks({ bottlenecks: {
    intents: [{ statut: 'draft', total: 6, seuilCount: 5, seuilAge: 14,
      itemsAges: [{ id: 'INTENT-X', titre: 't', file: null, ageJours: 30 }] }],
    specs: [],
    total: 1,
  }});
  assert.ok(html.includes('Goulots'));
  assert.ok(html.includes('Intents en draft'));
  assert.ok(html.includes('INTENT-X'));
  assert.ok(html.includes('30j'));
});

test('SEUILS_DEFAUT — alias EN DEFAULT_THRESHOLDS', () => {
  assert.equal(SEUILS_DEFAUT, DEFAULT_THRESHOLDS);
  assert.ok(SEUILS_DEFAUT.intent);
  assert.ok(SEUILS_DEFAUT.spec.review);
});

// ─── #437 — Sponsors ────────────────────────────────────────────────────────

test('calculerSponsors — sponsor string + comptage actifs/drafts/livres', () => {
  const d = { intents: [
    { id: 'A', titre: 't', statut: 'active', sponsor: 'DirMkt' },
    { id: 'B', titre: 't', statut: 'draft', sponsor: 'DirMkt' },
    { id: 'C', titre: 't', statut: 'done', sponsor: 'DirMkt' },
  ]};
  const r = calculerSponsors(d);
  assert.equal(r.sponsors.length, 1);
  const dm = r.sponsors[0];
  assert.equal(dm.totaux.total, 3);
  assert.equal(dm.totaux.actifs, 1);
  assert.equal(dm.totaux.drafts, 1);
  assert.equal(dm.totaux.livres, 1);
});

test('calculerSponsors — multi-sponsor via array', () => {
  const d = { intents: [{ id: 'A', statut: 'active', sponsors: ['DirA', 'DirB'] }] };
  const r = calculerSponsors(d);
  assert.equal(r.sponsors.length, 2);
});

test('calculerSponsors — sans sponsor → ignoré + compté en sansSponsor', () => {
  const d = { intents: [
    { id: 'A', statut: 'active' },
    { id: 'B', statut: 'active', sponsor: 'DirMkt' },
  ]};
  const r = calculerSponsors(d);
  assert.equal(r.sponsors.length, 1);
  assert.equal(r.totaux.sansSponsor, 1);
});

test('calculerSponsors — alias stakeholder/business_owner', () => {
  const d = { intents: [
    { id: 'A', statut: 'active', stakeholder: 'CFO' },
    { id: 'B', statut: 'active', business_owner: 'CMO' },
  ]};
  const r = calculerSponsors(d);
  assert.equal(r.sponsors.length, 2);
});

test('calculerSponsors — tri par total desc', () => {
  const d = { intents: [
    { id: 'A', statut: 'active', sponsor: 'DirA' },
    { id: 'B', statut: 'active', sponsor: 'DirB' },
    { id: 'C', statut: 'active', sponsor: 'DirA' },
  ]};
  const r = calculerSponsors(d);
  assert.equal(r.sponsors[0].nom, 'DirA');
  assert.equal(r.sponsors[0].totaux.total, 2);
});

test('blocSponsors — empty state si aucun sponsor déclaré', () => {
  const html = blocSponsors({ sponsors: { sponsors: [], totaux: { sponsors: 0, sansSponsor: 5 } } });
  assert.ok(html.includes('aucun sponsor déclaré'));
  assert.ok(html.includes('5 Intent(s)'));
});

test('blocSponsors — rend cards + stats colorées', () => {
  const html = blocSponsors({ sponsors: {
    sponsors: [{ nom: 'DirMkt', totaux: { total: 3, actifs: 1, drafts: 1, livres: 1 },
      intents: [{ id: 'INTENT-A', titre: 't', statut: 'active', file: null, priority: 'P0' }]
    }],
    totaux: { sponsors: 1, sansSponsor: 0 },
  }});
  assert.ok(html.includes('Portefeuille par sponsor'));
  assert.ok(html.includes('DirMkt'));
  assert.ok(html.includes('1 actif(s)'));
  assert.ok(html.includes('1 draft(s)'));
  assert.ok(html.includes('1 livré(s)'));
  assert.ok(html.includes('[P0]'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — toutes les variantes EN', () => {
  assert.equal(typeof computeOwnership, 'function');
  assert.equal(typeof ownershipSection, 'function');
  assert.equal(typeof computeBottlenecks, 'function');
  assert.equal(typeof bottlenecksSection, 'function');
  assert.equal(typeof computeSponsors, 'function');
  assert.equal(typeof sponsorsSection, 'function');
});
