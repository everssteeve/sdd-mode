// Tests #438 / #439 / #440 — Boucle 7 PM cockpit lean product :
//   - cycle time (lead time Intent capture → done)
//   - risk register (frontmatter + heuristique CONTRAINTES)
//   - hypothesis tracking (frontmatter + section body)

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  dateCapture, dateLivraison, quantile, calculerCycleTime, blocCycleTime,
  captureDate, deliveryDate, percentile, computeCycleTime, cycleTimeSection,
} from '../lib/dashboard/cycle-time.js';

import {
  calculerRisques, blocRisks, MOTS_CLES_RISQUES,
  computeRisks, risksSection, RISK_KEYWORDS,
} from '../lib/dashboard/risks.js';

import {
  calculerHypotheses, blocHypotheses,
  computeHypotheses, hypothesesSection,
} from '../lib/dashboard/hypotheses.js';

// ─── #438 — Cycle time ───────────────────────────────────────────────────────

test('quantile — p50 médiane simple', () => {
  assert.equal(quantile([10, 20, 30], 0.5), 20);
  assert.equal(quantile([10, 20, 30, 40], 0.5), 25);
});

test('quantile — p95 interpolation linéaire', () => {
  const r = quantile([10, 20, 30, 40, 50], 0.95);
  assert.ok(r >= 48 && r <= 50);
});

test('quantile — null si vide', () => {
  assert.equal(quantile([], 0.5), null);
});

test('dateCapture — plus ancien snapshot où l\'Intent apparaît', () => {
  const intent = { id: 'INTENT-A', mtime: Date.UTC(2026, 4, 15) };
  const snapshots = [
    { date: '2026-05-01', data: { intents: [{ id: 'INTENT-A', statut: 'draft' }] } },
    { date: '2026-05-08', data: { intents: [{ id: 'INTENT-A', statut: 'active' }] } },
  ];
  assert.equal(dateCapture(intent, snapshots), Date.UTC(2026, 4, 1));
});

test('dateCapture — fallback frontmatter date puis mtime', () => {
  const intent1 = { id: 'X', date: '2026-04-01', mtime: 999 };
  assert.equal(dateCapture(intent1, []), Date.parse('2026-04-01'));
  const intent2 = { id: 'X', mtime: 12345 };
  assert.equal(dateCapture(intent2, []), 12345);
  const intent3 = { id: 'X' };
  assert.equal(dateCapture(intent3, []), null);
});

test('dateLivraison — null si statut non livré', () => {
  assert.equal(dateLivraison({ statut: 'active', mtime: 1 }, []), null);
});

test('dateLivraison — premier snapshot livré + fallback mtime', () => {
  const intent = { id: 'A', statut: 'done', mtime: 999 };
  const snapshots = [
    { date: '2026-05-01', data: { intents: [{ id: 'A', statut: 'active' }] } },
    { date: '2026-05-15', data: { intents: [{ id: 'A', statut: 'done' }] } },
  ];
  assert.equal(dateLivraison(intent, snapshots), Date.UTC(2026, 4, 15));
  // Sans snapshots → mtime fallback
  assert.equal(dateLivraison({ id: 'X', statut: 'done', mtime: 12345 }, []), 12345);
});

test('calculerCycleTime — stats agrégées + plus lents', () => {
  const snapshots = [
    { date: '2026-04-01', data: { intents: [{ id: 'A', statut: 'draft' }] } },
    { date: '2026-05-15', data: { intents: [{ id: 'A', statut: 'done' }, { id: 'B', statut: 'done' }] } },
  ];
  const donnees = { intents: [
    { id: 'A', titre: 't', statut: 'done', mtime: Date.UTC(2026, 4, 15) },
    { id: 'B', titre: 't', statut: 'done', date: '2026-05-10', mtime: Date.UTC(2026, 4, 12) },
  ]};
  const c = calculerCycleTime(donnees, snapshots);
  assert.ok(c.stats, 'stats calculées');
  assert.equal(c.stats.n, 2);
  assert.ok(c.plusLents.length === 2);
});

test('calculerCycleTime — sans intent livré → stats null', () => {
  const donnees = { intents: [{ id: 'A', statut: 'draft', mtime: 1 }] };
  const c = calculerCycleTime(donnees, []);
  assert.equal(c.stats, null);
});

test('blocCycleTime — empty si pas de stats', () => {
  const html = blocCycleTime({ cycleTime: { stats: null, enCours: [], plusLents: [], ageEnCours: [] } });
  assert.ok(html.includes('aucun Intent livré'));
});

test('blocCycleTime — rend KPI grid + 2 tables', () => {
  const html = blocCycleTime({ cycleTime: {
    stats: { n: 3, p50: 12, p95: 35, moyenne: 18, min: 5, max: 40 },
    plusLents: [{ id: 'INTENT-X', titre: 't', file: null, leadJours: 40 }],
    ageEnCours: [{ id: 'INTENT-Y', titre: 't', file: null, ageJours: 22, statut: 'active' }],
  }});
  assert.ok(html.includes('Vitesse de livraison'));
  assert.ok(html.includes('p50'));
  assert.ok(html.includes('p95'));
  assert.ok(html.includes('INTENT-X'));
  assert.ok(html.includes('40 j'));
  assert.ok(html.includes('22 j (active)'));
});

// ─── #439 — Risk register ────────────────────────────────────────────────────

test('calculerRisques — frontmatter risks array + niveau explicite', () => {
  const d = { intents: [{ id: 'A', titre: 't', statut: 'active', risks: ['RGPD', 'Dep Stripe'], risk_level: 'high' }] };
  const r = calculerRisques(d);
  assert.equal(r.intents.length, 1);
  assert.equal(r.intents[0].niveau, 'high');
  assert.equal(r.intents[0].risques.length, 2);
  assert.equal(r.intents[0].risques[0].source, 'frontmatter');
});

test('calculerRisques — heuristique CONTRAINTES → catégories détectées', () => {
  const d = { intents: [{
    id: 'A', titre: 't', statut: 'active',
    sections: { contraintes: 'RGPD et dépendance externe sur fournisseur Stripe' },
  }]};
  const r = calculerRisques(d);
  assert.equal(r.intents.length, 1);
  const cats = r.intents[0].risques.map((x) => x.categorie);
  assert.ok(cats.includes('Réglementaire'));
  assert.ok(cats.includes('Dépendance'));
});

test('calculerRisques — niveau global = pire des niveaux', () => {
  const d = { intents: [{
    id: 'A', statut: 'active',
    sections: { contraintes: 'RGPD et performance' }, // RGPD high, perf low
  }]};
  const r = calculerRisques(d);
  assert.equal(r.intents[0].niveau, 'high');
});

test('calculerRisques — sans risque → exclu de la liste', () => {
  const d = { intents: [{ id: 'A', statut: 'active', sections: { contraintes: 'aucun blocage particulier' } }] };
  const r = calculerRisques(d);
  assert.equal(r.intents.length, 0);
});

test('calculerRisques — tri par niveau pire d\'abord', () => {
  const d = { intents: [
    { id: 'A', statut: 'active', risk_level: 'low' },
    { id: 'B', statut: 'active', risk_level: 'high' },
    { id: 'C', statut: 'active', risk_level: 'medium' },
  ]};
  const r = calculerRisques(d);
  assert.deepEqual(r.intents.map((i) => i.id), ['B', 'C', 'A']);
});

test('blocRisks — empty state si zéro intent', () => {
  const html = blocRisks({ risks: { intents: [], totaux: {} } });
  assert.ok(html.includes('aucun risque détecté'));
});

test('blocRisks — rend cards + badge niveau', () => {
  const html = blocRisks({ risks: {
    intents: [{ id: 'INTENT-A', titre: 't', statut: 'active', niveau: 'high', file: null,
      risques: [{ texte: 'RGPD', source: 'frontmatter', niveau: 'high' }] }],
    totaux: { intentsAvecRisques: 1, critical: 0, high: 1, medium: 0, low: 0, unknown: 0 },
  }});
  assert.ok(html.includes('Registre des risques'));
  assert.ok(html.includes('niveau-high'));
  assert.ok(html.includes('Élevé'));
  assert.ok(html.includes('INTENT-A'));
});

test('MOTS_CLES_RISQUES — alias EN RISK_KEYWORDS', () => {
  assert.equal(MOTS_CLES_RISQUES, RISK_KEYWORDS);
  assert.ok(MOTS_CLES_RISQUES.some((m) => m.mot === 'rgpd'));
});

// ─── #440 — Hypothesis tracking ──────────────────────────────────────────────

test('calculerHypotheses — frontmatter hypothesis string', () => {
  const d = { intents: [{
    id: 'A', titre: 't', statut: 'active',
    hypothesis: 'Si X alors Y',
    hypothesis_status: 'untested',
  }]};
  const r = calculerHypotheses(d);
  assert.equal(r.hypotheses.length, 1);
  assert.equal(r.hypotheses[0].hypothese, 'Si X alors Y');
  assert.equal(r.hypotheses[0].statut, 'untested');
  assert.equal(r.hypotheses[0].source, 'frontmatter');
});

test('calculerHypotheses — alias FR validé/invalidé/partielle', () => {
  const tests = [
    { hypothesis_status: 'validé', exp: 'validated' },
    { hypothesis_status: 'invalidé', exp: 'invalidated' },
    { hypothesis_status: 'partielle', exp: 'partial' },
  ];
  for (const t of tests) {
    const d = { intents: [{ id: 'X', hypothesis: 'h', ...t }] };
    const r = calculerHypotheses(d);
    assert.equal(r.hypotheses[0].statut, t.exp);
  }
});

test('calculerHypotheses — sans hypothesis → exclu', () => {
  const r = calculerHypotheses({ intents: [{ id: 'A', statut: 'active' }] });
  assert.equal(r.hypotheses.length, 0);
});

test('calculerHypotheses — tri invalidated < partial < untested < validated', () => {
  const d = { intents: [
    { id: 'A', hypothesis: 'h', hypothesis_status: 'validated' },
    { id: 'B', hypothesis: 'h', hypothesis_status: 'invalidated' },
    { id: 'C', hypothesis: 'h', hypothesis_status: 'untested' },
    { id: 'D', hypothesis: 'h', hypothesis_status: 'partial' },
  ]};
  const r = calculerHypotheses(d);
  assert.deepEqual(r.hypotheses.map((h) => h.id), ['B', 'D', 'C', 'A']);
});

test('calculerHypotheses — totaux par statut', () => {
  const d = { intents: [
    { id: 'A', hypothesis: 'h', hypothesis_status: 'validated' },
    { id: 'B', hypothesis: 'h', hypothesis_status: 'untested' },
    { id: 'C', hypothesis: 'h', hypothesis_status: 'untested' },
  ]};
  const r = calculerHypotheses(d);
  assert.equal(r.totaux.total, 3);
  assert.equal(r.totaux.validated, 1);
  assert.equal(r.totaux.untested, 2);
});

test('blocHypotheses — empty state si zéro', () => {
  const html = blocHypotheses({ hypotheses: { hypotheses: [], totaux: { total: 0 } } });
  assert.ok(html.includes('aucune déclarée'));
});

test('blocHypotheses — rend cards avec badges colorés', () => {
  const html = blocHypotheses({ hypotheses: {
    hypotheses: [
      { id: 'INTENT-A', titre: 't', file: null, hypothese: 'Si X alors Y', source: 'frontmatter', statut: 'invalidated', statutIntent: 'active' },
      { id: 'INTENT-B', titre: 't', file: null, hypothese: 'autre', source: 'body', statut: 'validated', statutIntent: 'done' },
    ],
    totaux: { total: 2, validated: 1, invalidated: 1, untested: 0, partial: 0 },
  }});
  assert.ok(html.includes('Hypothèses produit'));
  assert.ok(html.includes('Validée'));
  assert.ok(html.includes('Invalidée'));
  assert.ok(html.includes('Si X alors Y'));
  assert.ok(html.includes('statut-invalidated'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof captureDate, 'function');
  assert.equal(typeof deliveryDate, 'function');
  assert.equal(typeof percentile, 'function');
  assert.equal(typeof computeCycleTime, 'function');
  assert.equal(typeof cycleTimeSection, 'function');
  assert.equal(typeof computeRisks, 'function');
  assert.equal(typeof risksSection, 'function');
  assert.equal(typeof computeHypotheses, 'function');
  assert.equal(typeof hypothesesSection, 'function');
});
