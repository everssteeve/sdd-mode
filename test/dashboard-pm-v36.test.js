// Tests #525 / #526 / #527 — Boucle 36 PM spec-scope/goal-alignment/velocity-sla

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  calculerSpecScope, blocSpecScope,
  computeSpecScope, specScopeSection, SCOPE_THRESHOLDS,
} from '../lib/dashboard/spec-scope.js';

import {
  calculerGoalAlignment, blocGoalAlignment,
  computeGoalAlignment, goalAlignmentSection,
} from '../lib/dashboard/goal-alignment.js';

import {
  calculerVelocitySla, blocVelocitySla,
  computeVelocitySla, velocitySlaSection, DEFAULT_VELOCITY_TARGET,
} from '../lib/dashboard/velocity-sla.js';

// ─── #525 — Spec scope ─────────────────────────────────────────────────────

test('calculerSpecScope — classes T-shirt selon nb mots', () => {
  const r = calculerSpecScope({
    specs: [
      { id: 'A', body: 'mot '.repeat(50) }, // XS
      { id: 'B', body: 'mot '.repeat(200) }, // S
      { id: 'C', body: 'mot '.repeat(500) }, // M
      { id: 'D', body: 'mot '.repeat(1000) }, // L
      { id: 'E', body: 'mot '.repeat(2000) }, // XL
    ],
  });
  assert.equal(r.items.length, 5);
  const xs = r.items.find((i) => i.id === 'A');
  assert.equal(xs.taille, 'XS');
  const xl = r.items.find((i) => i.id === 'E');
  assert.equal(xl.taille, 'XL');
  assert.equal(xl.aDecouper, true);
  assert.equal(r.totaux.XS, 1);
  assert.equal(r.totaux.XL, 1);
  assert.equal(r.aDecouperCount, 1);
});

test('calculerSpecScope — empty si pas de specs', () => {
  const r = calculerSpecScope({});
  assert.equal(r.items.length, 0);
});

test('calculerSpecScope — compte sections h2/h3', () => {
  const r = calculerSpecScope({
    specs: [{ id: 'A', body: '## Titre 1\nblabla\n### Sub\nfoo\n## Titre 2' }],
  });
  assert.equal(r.items[0].sections, 3);
});

test('blocSpecScope — empty + rendu rows', () => {
  assert.ok(blocSpecScope({ specScope: { items: [], totaux: { total: 0 }}}).includes('aucune SPEC'));
  const html = blocSpecScope({ specScope: {
    items: [{
      id: 'SPEC-A', titre: 't', file: null, statut: 'done',
      parentIntent: 'INTENT-A', mots: 2000, sections: 5,
      taille: 'XL', aDecouper: true,
    }],
    totaux: { total: 1, XS: 0, S: 0, M: 0, L: 0, XL: 1 },
    motsMoyens: 2000, aDecouperCount: 1,
  }});
  assert.ok(html.includes('Taille SPEC'));
  assert.ok(html.includes('t-XL'));
  assert.ok(html.includes('à découper'));
});

// ─── #526 — Goal alignment ──────────────────────────────────────────────────

test('calculerGoalAlignment — message si pas de North Star', () => {
  const r = calculerGoalAlignment({});
  assert.ok(r.message);
});

test('calculerGoalAlignment — score Jaccard avec North Star', () => {
  const r = calculerGoalAlignment({
    northStar: 'Devenir le raccourcisseur URL européen de référence',
    intents: [
      { id: 'A', titre: 'raccourcir URL européen RGPD',
        sections: { pourquoi: 'raccourcisseur URL europe', objectif: 'devenir référence' } },
      { id: 'B', titre: 'corriger bug login',
        sections: { pourquoi: 'authentification', objectif: 'résoudre erreur 500' } },
    ],
  });
  const a = r.items.find((i) => i.id === 'A');
  const b = r.items.find((i) => i.id === 'B');
  assert.ok(a.score > b.score);
  assert.equal(a.etat, 'aligne');
  assert.equal(b.etat, 'isole');
});

test('calculerGoalAlignment — exclut archived', () => {
  const r = calculerGoalAlignment({
    northStar: 'foo',
    intents: [
      { id: 'A', titre: 'foo', statut: 'active' },
      { id: 'B', titre: 'foo', statut: 'archived' },
    ],
  });
  assert.equal(r.items.length, 1);
});

test('blocGoalAlignment — message + rendu', () => {
  assert.ok(blocGoalAlignment({ goalAlignment: { message: 'pas de NS', items: [] }}).includes('pas de NS'));
  const html = blocGoalAlignment({ goalAlignment: {
    items: [{ id: 'A', titre: 't', file: null, statut: 'active', score: 0.25, etat: 'aligne', tokensIntent: 10 }],
    totaux: { total: 1, aligne: 1, partiel: 0, isole: 0, scoreMoyen: 0.25 },
    northStar: 'mon north star',
    message: null,
  }});
  assert.ok(html.includes('Alignement Intent ↔ North Star'));
  assert.ok(html.includes('r-aligne'));
  assert.ok(html.includes('0.250'));
});

// ─── #527 — Velocity SLA ────────────────────────────────────────────────────

test('calculerVelocitySla — utilise target par défaut', () => {
  const r = calculerVelocitySla({ velocityForecast: { rythmeMoyen: 2.0 }});
  assert.equal(r.target, DEFAULT_VELOCITY_TARGET);
  assert.equal(r.actuel, 2.0);
});

test('calculerVelocitySla — classe ratio en tenu/proche/sous-rythme/critique', () => {
  // 2.0 / 1.5 = 1.33 → tenu (ratio >= 1.0)
  const r1 = calculerVelocitySla({ velocityForecast: { rythmeMoyen: 2.0 }});
  assert.equal(r1.etat, 'tenu');
  // 1.0 / 1.5 = 0.67 → sous-rythme (0.4-0.7)
  const r2 = calculerVelocitySla({ velocityForecast: { rythmeMoyen: 1.0 }});
  assert.equal(r2.etat, 'sous-rythme');
  // 0.5 / 1.5 = 0.33 → critique
  const r3 = calculerVelocitySla({ velocityForecast: { rythmeMoyen: 0.5 }});
  assert.equal(r3.etat, 'critique');
});

test('calculerVelocitySla — target custom via options', () => {
  const r = calculerVelocitySla({ velocityForecast: { rythmeMoyen: 1.0 }}, { targetVelocity: 2.0 });
  assert.equal(r.target, 2.0);
  assert.equal(r.ratio, 0.5);
});

test('calculerVelocitySla — message si rythmeMoyen indisponible', () => {
  const r = calculerVelocitySla({});
  assert.ok(r.message);
});

test('blocVelocitySla — message + card colorée', () => {
  assert.ok(blocVelocitySla({ velocitySla: { message: 'no data', target: 1.5 }}).includes('no data'));
  const html = blocVelocitySla({ velocitySla: {
    target: 1.5, actuel: 0.5, ratio: 0.33, ecart: -1.0, etat: 'critique', pct: 33,
  }});
  assert.ok(html.includes('Vélocité vs SLA'));
  assert.ok(html.includes('e-critique'));
  assert.ok(html.includes('33%'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeSpecScope, 'function');
  assert.equal(typeof specScopeSection, 'function');
  assert.ok(Array.isArray(SCOPE_THRESHOLDS));
  assert.equal(typeof computeGoalAlignment, 'function');
  assert.equal(typeof goalAlignmentSection, 'function');
  assert.equal(typeof computeVelocitySla, 'function');
  assert.equal(typeof velocitySlaSection, 'function');
  assert.ok(DEFAULT_VELOCITY_TARGET > 0);
});
