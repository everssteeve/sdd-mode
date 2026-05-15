// Tests #429 / #430 / #431 — Boucle 4 PM cockpit rituel/tactique :
//   - demo readiness checklist (préparer démo bi-hebdo)
//   - persona drill-down groupé
//   - target date countdown (échéances)

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  lastDemoMtime, intentsDemontrables, specsDemontrables,
  calculerDemoReadiness, blocDemoReadiness,
  lastDemoTime, computeDemoReadiness, demoReadinessSection,
} from '../lib/dashboard/demo-readiness.js';

import {
  calculerEtatPersona, calculerPersonaDrill, blocPersonaDrill,
  computePersonaState, computePersonaDrill, personaDrillSection,
} from '../lib/dashboard/persona-drill.js';

import {
  calculerJoursRestants, bucketEcheance, calculerEcheances, blocEcheances,
  computeDaysRemaining, deadlineBucket, computeDeadlines, deadlinesSection,
} from '../lib/dashboard/deadlines.js';

const days = (n) => n * 24 * 3600 * 1000;

function tmpProjet() {
  const dir = join(tmpdir(), 'aiad-pm-v4-' + Math.random().toString(36).slice(2));
  mkdirSync(join(dir, '.aiad'), { recursive: true });
  return dir;
}

// ─── #429 — Demo readiness ──────────────────────────────────────────────────

test('lastDemoMtime — null si dossier absent', () => {
  const dir = tmpProjet();
  try {
    assert.equal(lastDemoMtime(dir), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lastDemoMtime — max mtime des .md du dossier', () => {
  const dir = tmpProjet();
  try {
    mkdirSync(join(dir, '.aiad', 'metrics', 'demo'), { recursive: true });
    writeFileSync(join(dir, '.aiad', 'metrics', 'demo', '2026-04-01.md'), 'X');
    writeFileSync(join(dir, '.aiad', 'metrics', 'demo', '2026-05-01.md'), 'X');
    const ts = lastDemoMtime(dir);
    assert.ok(ts > 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('intentsDemontrables — Intents done/archived APRÈS lastDemo', () => {
  const now = Date.now();
  const donnees = { intents: [
    { id: 'A', statut: 'done', mtime: now - days(5), titre: 'récent done' },
    { id: 'B', statut: 'done', mtime: now - days(30), titre: 'vieux done' },
    { id: 'C', statut: 'archived', mtime: now - days(2), titre: 'récent archived' },
    { id: 'D', statut: 'active', mtime: now - days(1), titre: 'pas done' },
  ]};
  const lastDemo = now - days(10);
  const out = intentsDemontrables(donnees, lastDemo);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((x) => x.id).sort(), ['A', 'C']);
});

test('intentsDemontrables — sans lastDemo → tous les done/archived', () => {
  const donnees = { intents: [
    { id: 'A', statut: 'done', mtime: 1000 },
    { id: 'B', statut: 'draft', mtime: 2000 },
  ]};
  const out = intentsDemontrables(donnees, null);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'A');
});

test('specsDemontrables — done APRÈS lastDemo (#137 logique réutilisée)', () => {
  const donnees = { specs: [
    { id: 'S1', statut: 'done', mtime: 200 },
    { id: 'S2', statut: 'done', mtime: 50 },
  ]};
  const out = specsDemontrables(donnees, 100);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'S1');
});

test('calculerDemoReadiness — façade complète', () => {
  const dir = tmpProjet();
  try {
    const donnees = { intents: [{ id: 'A', statut: 'done', mtime: 1000 }], specs: [{ id: 'S1', statut: 'done', mtime: 1000 }] };
    const r = calculerDemoReadiness(dir, donnees);
    assert.equal(r.total, 2);
    assert.equal(r.lastDemo, null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('blocDemoReadiness — empty state si total=0', () => {
  const html = blocDemoReadiness({ demoReadiness: { intents: [], specs: [], total: 0, lastDemo: null } });
  assert.ok(html.includes('rien de neuf'));
});

test('blocDemoReadiness — rendu checklist + script Markdown', () => {
  const html = blocDemoReadiness({
    projet: { nom: 'P' },
    demoReadiness: {
      lastDemo: Date.UTC(2026, 4, 1),
      intents: [{ id: 'INTENT-1', titre: 'X', statut: 'done', mtime: Date.UTC(2026, 4, 10) }],
      specs: [{ id: 'SPEC-1', titre: 'Y', statut: 'done', mtime: Date.UTC(2026, 4, 12) }],
      total: 2,
    },
  });
  assert.ok(html.includes('Préparer la prochaine démo'));
  assert.ok(html.includes('demo-checklist'));
  assert.ok(html.includes('INTENT-1'));
  assert.ok(html.includes('SPEC-1'));
  assert.ok(html.includes('Script Markdown'));
});

// ─── #430 — Persona drill-down ──────────────────────────────────────────────

test('calculerEtatPersona — orphelin si 0 intent', () => {
  const r = calculerEtatPersona({ nom: 'X', intents: [] }, [], new Map());
  assert.equal(r.etat, 'orphelin');
  assert.equal(r.totaux.total, 0);
});

test('calculerEtatPersona — sous-servi si que des drafts', () => {
  const persona = { nom: 'X', intents: [{ id: 'A' }] };
  const donneesIntents = [{ id: 'A', statut: 'draft', titre: 't' }];
  const r = calculerEtatPersona(persona, donneesIntents, new Map());
  assert.equal(r.etat, 'sous-servi');
});

test('calculerEtatPersona — couvert si 1 active + 1 done', () => {
  const persona = { nom: 'X', intents: [{ id: 'A' }, { id: 'B' }] };
  const donneesIntents = [
    { id: 'A', statut: 'active', titre: 't' },
    { id: 'B', statut: 'done', titre: 't' },
  ];
  const r = calculerEtatPersona(persona, donneesIntents, new Map());
  assert.equal(r.etat, 'couvert');
});

test('calculerEtatPersona — saturé si ≥ 3 actifs', () => {
  const persona = { nom: 'X', intents: ['A', 'B', 'C', 'D'].map((id) => ({ id })) };
  const donneesIntents = ['A', 'B', 'C', 'D'].map((id) => ({ id, statut: 'active', titre: 't' }));
  const r = calculerEtatPersona(persona, donneesIntents, new Map());
  assert.equal(r.etat, 'sature');
});

test('calculerEtatPersona — avancement réutilisé via map', () => {
  const persona = { nom: 'X', intents: [{ id: 'A' }] };
  const donneesIntents = [{ id: 'A', statut: 'active', titre: 't' }];
  const map = new Map([['A', { done: 1, total: 2, ratio: 0.5 }]]);
  const r = calculerEtatPersona(persona, donneesIntents, map);
  assert.equal(r.intents.active[0].done, 1);
  assert.equal(r.intents.active[0].ratio, 0.5);
});

test('calculerPersonaDrill — mappe les personas du prdCoverage', () => {
  const donnees = {
    prdCoverage: { personas: [
      { nom: 'A', besoin: 'b', intents: [{ id: 'X' }] },
      { nom: 'B', intents: [] },
    ]},
    intents: [{ id: 'X', statut: 'active', titre: 't' }],
    pm: { avancement: [{ id: 'X', done: 0, total: 1, ratio: 0 }] },
  };
  const d = calculerPersonaDrill(donnees);
  assert.equal(d.length, 2);
  assert.equal(d[0].etat, 'couvert');
  assert.equal(d[1].etat, 'orphelin');
});

test('blocPersonaDrill — empty si drill vide', () => {
  assert.equal(blocPersonaDrill({ personaDrill: [] }), '');
});

test('blocPersonaDrill — rend cartes + buckets + badges', () => {
  const html = blocPersonaDrill({ personaDrill: [{
    nom: 'A', besoin: 'b', etat: 'couvert',
    intents: { draft: [], active: [{ id: 'X', titre: 'T', done: 0, total: 0, statut: 'active', file: null }], done: [], archived: [], unknown: [] },
    totaux: { total: 1, actifs: 1, livres: 0 },
  }]});
  assert.ok(html.includes('Drill-down par persona'));
  assert.ok(html.includes('persona-card'));
  assert.ok(html.includes('etat-couvert'));
  assert.ok(html.includes('Couvert'));
  assert.ok(html.includes('Actifs (1)'));
});

// ─── #431 — Échéances ───────────────────────────────────────────────────────

test('calculerJoursRestants — target_date ISO prime', () => {
  const now = Date.UTC(2026, 4, 15);
  const j = calculerJoursRestants({ target_date: '2026-05-25' }, { now });
  assert.equal(j, 10);
});

test('calculerJoursRestants — fallback fin de quarter', () => {
  const now = Date.UTC(2026, 4, 15);
  // Q2-2026 → fin juin (30/06)
  const j = calculerJoursRestants({ target: 'Q2-2026' }, { now });
  assert.ok(j >= 45 && j <= 47, `expected ~46, got ${j}`);
});

test('calculerJoursRestants — sans cible → null', () => {
  assert.equal(calculerJoursRestants({}), null);
  assert.equal(calculerJoursRestants(null), null);
});

test('bucketEcheance — done/archived → livre', () => {
  assert.equal(bucketEcheance({ statut: 'done' }, 5), 'livre');
  assert.equal(bucketEcheance({ statut: 'archived' }, -5), 'livre');
});

test('bucketEcheance — paliers retard/urgent/proche/planifie', () => {
  assert.equal(bucketEcheance({ statut: 'active' }, -5), 'retard');
  assert.equal(bucketEcheance({ statut: 'active' }, 0), 'urgent');
  assert.equal(bucketEcheance({ statut: 'active' }, 14), 'urgent');
  assert.equal(bucketEcheance({ statut: 'active' }, 15), 'proche');
  assert.equal(bucketEcheance({ statut: 'active' }, 30), 'proche');
  assert.equal(bucketEcheance({ statut: 'active' }, 31), 'planifie');
});

test('bucketEcheance — sans-cible si joursRestants null', () => {
  assert.equal(bucketEcheance({ statut: 'active' }, null), 'sans-cible');
});

test('calculerEcheances — buckets remplis + totaux', () => {
  const now = Date.UTC(2026, 4, 15);
  const donnees = { intents: [
    { id: 'A', statut: 'active', target_date: '2026-05-25', titre: 't' }, // J-10 → urgent
    { id: 'B', statut: 'active', target_date: '2026-05-10', titre: 't' }, // J+5 → retard
    { id: 'C', statut: 'active', target_date: '2026-06-20', titre: 't' }, // J-36 → proche? non, 36 > 30 → planifie
    { id: 'D', statut: 'done', target_date: '2026-04-01', titre: 't' }, // livré
    { id: 'E', statut: 'draft', titre: 't' }, // sans-cible
  ]};
  const r = calculerEcheances(donnees, { now });
  assert.equal(r.totaux.retard, 1);
  assert.equal(r.totaux.urgent, 1);
  assert.equal(r.totaux.planifie, 1);
  assert.equal(r.totaux.livre, 1);
  assert.equal(r.totaux.sansCible, 1);
});

test('blocEcheances — message neutre si aucune action critique mais cibles présentes', () => {
  const html = blocEcheances({ deadlines: {
    buckets: { retard: [], urgent: [], proche: [], planifie: [{ id: 'X' }], 'sans-cible': [], livre: [] },
    totaux: { retard: 0, urgent: 0, proche: 0, planifie: 1, sansCible: 0, livre: 0 },
  }});
  assert.ok(html.includes('Échéances Intent'));
  assert.ok(html.includes('Aucune échéance critique'));
});

test('blocEcheances — rendu sections par bucket actionnable', () => {
  const html = blocEcheances({ deadlines: {
    buckets: {
      retard: [{ id: 'INTENT-A', titre: 'T', joursRestants: -5, statut: 'active', target_date: '2026-05-10' }],
      urgent: [{ id: 'INTENT-B', titre: 'T2', joursRestants: 7, statut: 'active', target_date: '2026-05-22' }],
      proche: [], planifie: [], 'sans-cible': [], livre: [],
    },
    totaux: { retard: 1, urgent: 1, proche: 0, planifie: 0, sansCible: 0, livre: 0 },
  }});
  assert.ok(html.includes('1 en retard'));
  assert.ok(html.includes('En retard'));
  assert.ok(html.includes('Urgent — ≤ 14 jours'));
  assert.ok(html.includes('J+5 en retard'));
  assert.ok(html.includes('J-7'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — toutes les variantes EN exportées', () => {
  assert.equal(typeof lastDemoTime, 'function');
  assert.equal(typeof computeDemoReadiness, 'function');
  assert.equal(typeof demoReadinessSection, 'function');
  assert.equal(typeof computePersonaState, 'function');
  assert.equal(typeof computePersonaDrill, 'function');
  assert.equal(typeof personaDrillSection, 'function');
  assert.equal(typeof computeDaysRemaining, 'function');
  assert.equal(typeof deadlineBucket, 'function');
  assert.equal(typeof computeDeadlines, 'function');
  assert.equal(typeof deadlinesSection, 'function');
});
