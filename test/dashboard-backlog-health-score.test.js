// Tests `lib/dashboard/backlog-health-score.js` — score composite /100 sur
// 10 dimensions (#561). Détecté sans aucun test par le système de couverture
// SDD Mode (scripts/sdd-mode-coverage.js) : le module n'est importé nulle
// part ailleurs dans la codebase (ni lib/dashboard/render.js, ni pm.js) — il
// n'est donc pas non plus câblé dans le dashboard généré. Ce test couvre le
// comportement documenté de l'export public ; le câblage (ou le retrait s'il
// est jugé obsolète) reste une décision produit distincte, hors périmètre
// d'un test de non-régression.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { calculerBacklogHealthScore, blocBacklogHealthScore, computeBacklogHealthScore, backlogHealthScoreSection } from '../lib/dashboard/backlog-health-score.js';

test('calculerBacklogHealthScore — aucune donnée → 0/100, état critique', () => {
  const r = calculerBacklogHealthScore({});
  assert.equal(r.score, 0);
  assert.equal(r.etat, 'critique');
  assert.equal(r.checks.length, 10);
  assert.ok(r.checks.every((c) => !c.ok));
});

test('calculerBacklogHealthScore — 10/10 dimensions au vert → 100/100, excellent', () => {
  const donnees = {
    backlogFreshness: { totaux: { frais: 8, tiede: 1, stale: 1, abandonne: 0 } },
    backlogHygiene: { totaux: { total: 2 } },
    outcomeCompletion: { totaux: { pctMoyen: 60 } },
    riskTransparency: { totaux: { score: 80 } },
    decisionVelocity: { inertie: false },
    hypothesisLifecycle: { stagnantes: 0 },
    specAnnotationCoverage: { totaux: { scoreMoyen: 55 } },
    velocitySla: { etat: 'tenu' },
    intentMaturity: { items: [{ score: 75 }, { score: 85 }] },
    goalAlignment: { items: [{}, {}], totaux: { aligne: 2 } },
  };
  const r = calculerBacklogHealthScore(donnees);
  assert.equal(r.score, 100);
  assert.equal(r.etat, 'excellent');
  assert.ok(r.checks.every((c) => c.ok === true));
});

test('calculerBacklogHealthScore — seuils d\'état (critique < 20 ≤ faible)', () => {
  const base = { backlogFreshness: { totaux: { frais: 8, tiede: 1, stale: 1, abandonne: 0 } } }; // 1 dimension ok = 10
  assert.equal(calculerBacklogHealthScore(base).etat, 'critique');
  const deux = { ...base, backlogHygiene: { totaux: { total: 1 } } }; // 2 dimensions ok = 20
  assert.equal(calculerBacklogHealthScore(deux).etat, 'faible');
});

test('computeBacklogHealthScore — alias EN identique à la fonction FR', () => {
  assert.equal(computeBacklogHealthScore, calculerBacklogHealthScore);
});

test('blocBacklogHealthScore — pas de données → bloc vide (dégradation silencieuse)', () => {
  assert.equal(blocBacklogHealthScore({}), '');
});

test('blocBacklogHealthScore — rend le score, l\'état et les 10 checks', () => {
  const donnees = { backlogHealthScore: { score: 70, etat: 'bon', checks: [{ id: 'freshness', label: 'Freshness ≥ 50 % frais', ok: true }, { id: 'hygiene', label: 'Hygiene total ≤ 3', ok: false }] } };
  const html = blocBacklogHealthScore(donnees);
  assert.match(html, /70\/100/);
  assert.match(html, /Bon \(60-79\)/);
  assert.match(html, /Freshness ≥ 50 % frais/);
  assert.match(html, /class="bh-icon ok"/);
  assert.match(html, /class="bh-icon ko"/);
});

test('blocBacklogHealthScore — échappe le HTML des labels (anti-XSS)', () => {
  const donnees = { backlogHealthScore: { score: 10, etat: 'critique', checks: [{ id: 'x', label: '<script>alert(1)</script>', ok: false }] } };
  const html = blocBacklogHealthScore(donnees);
  assert.doesNotMatch(html, /<script>alert/);
});

test('backlogHealthScoreSection — alias EN identique à la fonction FR', () => {
  assert.equal(backlogHealthScoreSection, blocBacklogHealthScore);
});
