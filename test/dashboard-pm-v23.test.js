// Tests #486 / #487 / #488 — Boucle 23 PM intent-maturity/narrative/sprint-planner

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  scorerIntent, calculerIntentMaturity, blocIntentMaturity,
  scoreIntent, computeIntentMaturity, intentMaturitySection,
  CANONICAL_SECTIONS,
} from '../lib/dashboard/intent-maturity.js';

import {
  genererNarratif, blocStrategicNarrative,
  generateNarrative, strategicNarrativeSection,
} from '../lib/dashboard/strategic-narrative.js';

import {
  scorerCandidat, calculerSprintPlanner, blocSprintPlanner,
  scoreCandidate, computeSprintPlanner, sprintPlannerSection,
} from '../lib/dashboard/sprint-planner.js';

// ─── #486 — Intent maturity ─────────────────────────────────────────────────

test('scorerIntent — intent vide → incomplete 0/100', () => {
  const r = scorerIntent({ id: 'A' });
  assert.equal(r.score, 0);
  assert.equal(r.etat, 'incomplete');
  assert.equal(r.cellules.length, 5);
  assert.ok(r.cellules.every((c) => c.etat === 'absent'));
});

test('scorerIntent — 5 sections matures → complete 100/100', () => {
  const longText = 'a'.repeat(100);
  const r = scorerIntent({ sections: {
    pourquoi: longText, pourQui: longText, objectif: longText,
    contraintes: longText, critereDrift: longText,
  }});
  assert.equal(r.score, 100);
  assert.equal(r.etat, 'complete');
});

test('scorerIntent — placeholder bracketé → absent', () => {
  const r = scorerIntent({ sections: {
    pourquoi: '[à compléter]',
    pourQui: '[TBD]',
  }});
  // Tous les placeholder bracketés sont strippés → absent
  assert.equal(r.cellules.find((c) => c.cle === 'pourquoi').etat, 'absent');
});

test('scorerIntent — section courte → squelette 10/20', () => {
  const r = scorerIntent({ sections: { pourquoi: 'court' }}); // < 50 chars
  assert.equal(r.cellules.find((c) => c.cle === 'pourquoi').etat, 'squelette');
  assert.equal(r.cellules.find((c) => c.cle === 'pourquoi').points, 10);
});

test('calculerIntentMaturity — exclut archived + tri par état', () => {
  const long = 'a'.repeat(100);
  const r = calculerIntentMaturity({
    intents: [
      { id: 'A', titre: 'a', statut: 'active', sections: {
        pourquoi: long, pourQui: long, objectif: long, contraintes: long, critereDrift: long,
      }}, // complete
      { id: 'B', titre: 'b', statut: 'active' }, // incomplete
      { id: 'C', titre: 'c', statut: 'archived', sections: {} }, // exclu
    ],
  });
  assert.equal(r.items.length, 2);
  // Tri : incomplete d'abord
  assert.equal(r.items[0].id, 'B');
  assert.equal(r.items[1].id, 'A');
  assert.equal(r.totaux.complete, 1);
  assert.equal(r.totaux.incomplete, 1);
});

test('blocIntentMaturity — empty + cellules colorées', () => {
  assert.ok(blocIntentMaturity({ intentMaturity: { items: [], totaux: { total: 0, complete: 0, structured: 0, skeleton: 0, incomplete: 0 }, sections: CANONICAL_SECTIONS }}).includes('aucun Intent à scorer'));
  const html = blocIntentMaturity({ intentMaturity: {
    items: [{
      id: 'INTENT-A', titre: 't', file: null, statut: 'active',
      score: 60, etat: 'structured',
      cellules: [
        { cle: 'pourquoi', label: 'POURQUOI MAINTENANT', etat: 'mature', points: 20, chars: 100 },
        { cle: 'pourQui', label: 'POUR QUI', etat: 'mature', points: 20, chars: 100 },
        { cle: 'objectif', label: 'OBJECTIF', etat: 'mature', points: 20, chars: 100 },
        { cle: 'contraintes', label: 'CONTRAINTES', etat: 'absent', points: 0, chars: 0 },
        { cle: 'critereDrift', label: 'CRITÈRE DE DRIFT', etat: 'absent', points: 0, chars: 0 },
      ],
    }],
    totaux: { total: 1, complete: 0, structured: 1, skeleton: 0, incomplete: 0 },
    sections: CANONICAL_SECTIONS,
  }});
  assert.ok(html.includes('Maturité documentaire'));
  assert.ok(html.includes('im-cell s-mature'));
  assert.ok(html.includes('im-cell s-absent'));
  assert.ok(html.includes('lvl-structured'));
});

// ─── #487 — Strategic narrative ─────────────────────────────────────────────

test('genererNarratif — projet vide → 1 phrase counts seulement', () => {
  const n = genererNarratif({});
  assert.equal(n.phrases.length, 1);
  assert.ok(n.texte.includes('0 Intent(s) actif(s)'));
});

test('genererNarratif — assemble counts + top + risque + velocity + santé', () => {
  const n = genererNarratif({
    projet: { nom: 'demo' },
    intents: [
      { id: 'A', titre: 'top thing', statut: 'active', priority: 'P0' },
      { id: 'B', titre: 'minor', statut: 'active', priority: 'P3' },
    ],
    pm: { funnel: { inDelivery: 1 }, avancement: [{ id: 'A', done: 1, total: 2 }] },
    risks: { intents: [{ id: 'R', niveau: 'critical', titre: 'urgent', risques: [{ texte: 'big problem' }] }] },
    velocityForecast: { rythmeMoyen: 1.5, horizonSem: 4, projectionHorizon: 6, reg: { slope: 0.1 }, etaSemaines: 3 },
    healthTimeline: {
      nbPoints: 3,
      tendance: { direction: 'up', delta: 5 },
      points: [{ date: '2026-05-15', score: 80, niveau: 'sain' }],
    },
    santeGlobale: { score: 80, niveau: 'sain' },
  });
  assert.ok(n.texte.includes('demo'));
  assert.ok(n.texte.includes('Top priorité'));
  assert.ok(n.texte.includes('Risque majeur'));
  assert.ok(n.texte.includes('Vélocité'));
  assert.ok(n.texte.includes('Santé'));
  assert.equal(n.meta.intentsActifs, 2);
  assert.equal(n.meta.risquesEleves, 1);
  assert.equal(n.meta.healthScore, 80);
  assert.equal(n.meta.healthTrend, 'up');
});

test('genererNarratif — AI Act mentionné si high+unacceptable > 0', () => {
  const n = genererNarratif({
    intents: [],
    aiActCompliance: { totaux: { unacceptable: 0, high: 2 } },
  });
  assert.ok(n.texte.includes('AI Act'));
  assert.ok(n.texte.includes('DPO'));
});

test('blocStrategicNarrative — rendu narratif + bouton copier + meta', () => {
  const html = blocStrategicNarrative({ strategicNarrative: {
    texte: '**demo** — état 2026-05-15 : 1 actif',
    phrases: ['**demo** — état 2026-05-15 : 1 actif'],
    meta: { intentsActifs: 1, risquesEleves: 0, healthScore: 80, healthTrend: 'up', veloMoyen: 1.5 },
  }});
  assert.ok(html.includes('Narratif stratégique'));
  assert.ok(html.includes('sn-copy-btn'));
  assert.ok(html.includes('sn-raw-text'));
  // **markdown** rendu en <strong>
  assert.ok(html.includes('<strong>demo</strong>'));
});

test('blocStrategicNarrative — empty si zéro phrases', () => {
  const html = blocStrategicNarrative({ strategicNarrative: { phrases: [], texte: '', meta: {} } });
  assert.ok(html.includes('données insuffisantes'));
});

// ─── #488 — Sprint planner ──────────────────────────────────────────────────

test('scorerCandidat — P0 ready < P0 partial < P1 ready (priorité prime)', () => {
  const a = scorerCandidat({ priority: 'P0' }, { etat: 'ready' });
  const b = scorerCandidat({ priority: 'P0' }, { etat: 'partial' });
  const c = scorerCandidat({ priority: 'P1' }, { etat: 'ready' });
  assert.ok(a.score < b.score);
  assert.ok(b.score < c.score);
});

test('calculerSprintPlanner — bucket commit prend P0/P1 ready dans la capacité', () => {
  const r = calculerSprintPlanner({
    intents: [
      { id: 'INTENT-A', titre: 'a', statut: 'active', priority: 'P0' },
      { id: 'INTENT-B', titre: 'b', statut: 'active', priority: 'P0' },
      { id: 'INTENT-C', titre: 'c', statut: 'active', priority: 'P3' },
    ],
    sqsReadiness: { items: [
      { id: 'INTENT-A', etat: 'ready' },
      { id: 'INTENT-B', etat: 'ready' },
      { id: 'INTENT-C', etat: 'no-spec' },
    ]},
    capacityPlanner: { buckets: [{ label: 'Q2', capacite: 5, charge: 3, etat: 'courant' }], capaciteSource: 'frontmatter' },
  });
  assert.equal(r.capacite.restant, 2);
  assert.ok(r.commit.length >= 2);
  assert.equal(r.commit[0].id, 'INTENT-A');
  // INTENT-C est en defer (P3 + no-spec)
  assert.ok(r.defer.some((d) => d.id === 'INTENT-C'));
});

test('calculerSprintPlanner — exclut done/archived', () => {
  const r = calculerSprintPlanner({
    intents: [
      { id: 'A', statut: 'active', priority: 'P0' },
      { id: 'B', statut: 'done', priority: 'P0' }, // exclu
      { id: 'C', statut: 'archived' }, // exclu
    ],
    sqsReadiness: { items: [{ id: 'A', etat: 'ready' }] },
  });
  const all = [...r.commit, ...r.stretch, ...r.defer];
  assert.equal(all.length, 1);
  assert.equal(all[0].id, 'A');
});

test('calculerSprintPlanner — fallback capacité défaut si pas de planner', () => {
  const r = calculerSprintPlanner({ intents: [], sqsReadiness: { items: [] }});
  assert.ok(r.capacite.capacite > 0);
  assert.ok(r.capacite.source.includes('défaut'));
});

test('blocSprintPlanner — rendu 3 buckets', () => {
  const html = blocSprintPlanner({ sprintPlanner: {
    commit: [{
      id: 'INTENT-A', titre: 't', file: null, statut: 'active', priority: 'P0',
      readiness: { etat: 'ready', score: { min: 4, avg: 4.4, scored: 2 } },
      poids: 0, bonus: 0, score: 0,
    }],
    stretch: [],
    defer: [],
    capacite: { capacite: 5, charge: 3, restant: 2, label: 'Q2', source: 'test' },
    seuilCommit: 2,
  }});
  assert.ok(html.includes('Sprint planner'));
  assert.ok(html.includes('b-commit'));
  assert.ok(html.includes('b-stretch'));
  assert.ok(html.includes('b-defer'));
  assert.ok(html.includes('INTENT-A'));
  assert.ok(html.includes('r-ready'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof scoreIntent, 'function');
  assert.equal(typeof computeIntentMaturity, 'function');
  assert.equal(typeof intentMaturitySection, 'function');
  assert.ok(Array.isArray(CANONICAL_SECTIONS));
  assert.equal(typeof generateNarrative, 'function');
  assert.equal(typeof strategicNarrativeSection, 'function');
  assert.equal(typeof scoreCandidate, 'function');
  assert.equal(typeof computeSprintPlanner, 'function');
  assert.equal(typeof sprintPlannerSection, 'function');
});
