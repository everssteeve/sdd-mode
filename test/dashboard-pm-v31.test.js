// Tests #510 / #511 / #512 — Boucle 31 PM state-transitions/orphan-deps/demo-agenda

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  lireSnapshotsPm, calculerStateTransitions, blocStateTransitions,
  readPmSnapshots, computeStateTransitions, stateTransitionsSection,
} from '../lib/dashboard/state-transitions.js';

import {
  calculerOrphanDeps, blocOrphanDeps,
  computeOrphanDeps, orphanDepsSection,
} from '../lib/dashboard/orphan-deps.js';

import {
  calculerDemoAgenda, blocDemoAgenda,
  computeDemoAgenda, demoAgendaSection,
} from '../lib/dashboard/demo-agenda.js';

function avecSnapshots(snaps) {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-loop31-'));
  const rep = join(racine, '.aiad', 'metrics', 'pm-snapshots');
  mkdirSync(rep, { recursive: true });
  for (const [date, data] of Object.entries(snaps)) {
    writeFileSync(join(rep, `${date}.json`), JSON.stringify({ date, ...data }));
  }
  return racine;
}

// ─── #510 — State transitions ───────────────────────────────────────────────

test('lireSnapshotsPm — vide si répertoire absent', () => {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-empty-'));
  assert.deepEqual(lireSnapshotsPm(racine), []);
  rmSync(racine, { recursive: true, force: true });
});

test('lireSnapshotsPm — lit + ordonne par date', () => {
  const racine = avecSnapshots({
    '2026-05-10': { intents: [{ id: 'A', statut: 'draft' }] },
    '2026-05-15': { intents: [{ id: 'A', statut: 'active' }] },
    '2026-05-12': { intents: [{ id: 'A', statut: 'active' }] },
  });
  const s = lireSnapshotsPm(racine);
  assert.equal(s.length, 3);
  assert.equal(s[0].date, '2026-05-10');
  assert.equal(s[2].date, '2026-05-15');
  rmSync(racine, { recursive: true, force: true });
});

test('calculerStateTransitions — détecte transition draft→active', () => {
  const racine = avecSnapshots({
    '2026-05-10': { intents: [{ id: 'A', statut: 'draft' }] },
    '2026-05-15': { intents: [{ id: 'A', statut: 'active' }] },
  });
  const r = calculerStateTransitions(racine, { intents: [{ id: 'A', titre: 't', statut: 'active' }] });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].transitions.length, 1);
  assert.equal(r.items[0].transitions[0].de, 'draft');
  assert.equal(r.items[0].transitions[0].vers, 'active');
  assert.equal(r.items[0].regressions, 0);
  rmSync(racine, { recursive: true, force: true });
});

test('calculerStateTransitions — détecte régression done→active', () => {
  const racine = avecSnapshots({
    '2026-05-10': { intents: [{ id: 'A', statut: 'done' }] },
    '2026-05-15': { intents: [{ id: 'A', statut: 'active' }] },
  });
  const r = calculerStateTransitions(racine, { intents: [] });
  assert.equal(r.items[0].regressions, 1);
  assert.equal(r.totaux.avecRegression, 1);
  rmSync(racine, { recursive: true, force: true });
});

test('calculerStateTransitions — message si < 2 snapshots', () => {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-empty-snaps-'));
  const r = calculerStateTransitions(racine, {});
  assert.ok(r.message);
  assert.equal(r.items.length, 0);
  rmSync(racine, { recursive: true, force: true });
});

test('blocStateTransitions — message + cards', () => {
  assert.ok(blocStateTransitions({ stateTransitions: { items: [], message: 'aucun snapshot', snapshots: 0 }}).includes('aucun snapshot'));
  const html = blocStateTransitions({ stateTransitions: {
    items: [{
      id: 'INTENT-A', titre: 't', file: null, statutCourant: 'active', regressions: 1, nbEtats: 3,
      etats: [
        { statut: 'draft', date: '2026-05-10' },
        { statut: 'done', date: '2026-05-12' },
        { statut: 'active', date: '2026-05-15' },
      ],
      transitions: [
        { de: 'draft', vers: 'done', date: '2026-05-12', regression: false },
        { de: 'done', vers: 'active', date: '2026-05-15', regression: true },
      ],
    }],
    snapshots: 3, totaux: { intents: 1, avecRegression: 1, transitions: 2 },
    message: null,
  }});
  assert.ok(html.includes("Transitions d'état Intent"));
  assert.ok(html.includes('has-reg'));
  assert.ok(html.includes('régression'));
});

// ─── #511 — Orphan deps ─────────────────────────────────────────────────────

test('calculerOrphanDeps — détecte référence vers Intent inexistant', () => {
  const r = calculerOrphanDeps({
    intents: [
      { id: 'INTENT-101', depends_on: ['INTENT-999'] },
      { id: 'INTENT-102', depends_on: ['INTENT-101'] }, // OK
    ],
  });
  assert.equal(r.orphelins.length, 1);
  assert.equal(r.orphelins[0].ref, 'INTENT-999');
  assert.equal(r.selfLoops.length, 0);
});

test('calculerOrphanDeps — détecte self-loop', () => {
  const r = calculerOrphanDeps({
    intents: [{ id: 'INTENT-101', depends_on: ['INTENT-101'] }],
  });
  assert.equal(r.selfLoops.length, 1);
  assert.equal(r.orphelins.length, 0);
});

test('calculerOrphanDeps — accepte blocked_by + alias EN', () => {
  const r = calculerOrphanDeps({
    intents: [
      { id: 'A', blocked_by: ['NON-EXISTANT'] },
      { id: 'B', dependsOn: 'INTENT-INEXIST' },
    ],
  });
  assert.equal(r.orphelins.length, 2);
});

test('calculerOrphanDeps — empty si graphe propre', () => {
  const r = calculerOrphanDeps({
    intents: [
      { id: 'A' },
      { id: 'B', depends_on: ['A'] },
    ],
  });
  assert.equal(r.totaux.total, 0);
});

test('blocOrphanDeps — empty clean + rendu rows', () => {
  assert.ok(blocOrphanDeps({ orphanDeps: { totaux: { total: 0 }}}).includes('graphe propre'));
  const html = blocOrphanDeps({ orphanDeps: {
    orphelins: [{ id: 'A', titre: 't', file: null, ref: 'INEXIST' }],
    selfLoops: [{ id: 'B', titre: 't2', file: null, ref: 'B' }],
    totaux: { total: 2, orphelins: 1, selfLoops: 1, intentsConcernes: 2 },
  }});
  assert.ok(html.includes('Dépendances orphelines'));
  assert.ok(html.includes('INEXIST'));
  assert.ok(html.includes('t-orphelin'));
  assert.ok(html.includes('t-self'));
});

// ─── #512 — Demo agenda ─────────────────────────────────────────────────────

test('calculerDemoAgenda — empty si aucune SPEC non démontrée', () => {
  const r = calculerDemoAgenda({ pm: { specsNonDemontrees: [] }});
  assert.ok(r.message);
});

test('calculerDemoAgenda — groupe par Intent + tri priorité', () => {
  const r = calculerDemoAgenda({
    intents: [
      { id: 'INTENT-101', priority: 'P0', titre: 'top' },
      { id: 'INTENT-102', priority: 'P2', titre: 'mid' },
    ],
    pm: { specsNonDemontrees: [
      { id: 'SPEC-102-1-x', titre: 'mid spec', mtime: 1 },
      { id: 'SPEC-101-1-x', titre: 'top spec', mtime: 1 },
    ]},
  });
  assert.equal(r.items.length, 2);
  // P0 d'abord
  assert.equal(r.items[0].intentId, 'INTENT-101');
  assert.equal(r.items[0].specsAdmis.length, 1);
});

test('calculerDemoAgenda — coupe SPECs hors durée cible', () => {
  // 10 SPECs sous 1 Intent + cible 10 min → 2 intro + 3×2 specs = 8min, donc 2 admises + 8 coupées
  const specs = [];
  for (let i = 1; i <= 10; i++) specs.push({ id: `SPEC-101-${i}-x`, titre: `s${i}`, mtime: i });
  const r = calculerDemoAgenda({
    intents: [{ id: 'INTENT-101', priority: 'P0' }],
    pm: { specsNonDemontrees: specs },
  }, { dureeCible: 10 });
  const total = r.items[0].specsAdmis.length;
  assert.ok(total < 10);
  assert.ok(r.coupes > 0);
});

test('blocDemoAgenda — empty + rendu groupes', () => {
  assert.ok(blocDemoAgenda({ demoAgenda: { message: 'aucune SPEC' }}).includes('aucune SPEC'));
  const html = blocDemoAgenda({ demoAgenda: {
    items: [{
      intentId: 'INTENT-101', intentTitre: 't', priority: 'P0', intentFile: null,
      dureeIntro: 2, duree: 5,
      specsAdmis: [{ id: 'SPEC-101-1', titre: 's1', file: null, mtime: 1 }],
      specsCoupees: [],
    }],
    temps: 5, coupes: 0, dureeCible: 30, totauxSpecsDispo: 1,
  }});
  assert.ok(html.includes('Agenda demo auto'));
  assert.ok(html.includes('p-P0'));
  assert.ok(html.includes('SPEC-101-1'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof readPmSnapshots, 'function');
  assert.equal(typeof computeStateTransitions, 'function');
  assert.equal(typeof stateTransitionsSection, 'function');
  assert.equal(typeof computeOrphanDeps, 'function');
  assert.equal(typeof orphanDepsSection, 'function');
  assert.equal(typeof computeDemoAgenda, 'function');
  assert.equal(typeof demoAgendaSection, 'function');
});
