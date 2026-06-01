// Tests #477 / #478 / #479 — Boucle 20 PM cockpit theme/leaderboard/forecast

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { blocPmThemeSwitcher, pmThemeSwitcher } from '../lib/dashboard/pm-theme.js';

import {
  calculerScoreOutcome, calculerOutcomeLeaderboard, blocOutcomeLeaderboard,
  computeOutcomeScore, computeOutcomeLeaderboard, outcomeLeaderboardSection,
} from '../lib/dashboard/outcome-leaderboard.js';

import {
  calculerVelocityForecast, blocVelocityForecast,
  computeVelocityForecast, velocityForecastSection,
} from '../lib/dashboard/velocity-forecast.js';

const days = (n) => n * 24 * 3600 * 1000;

// ─── #477 — Theme switcher PM ───────────────────────────────────────────────

test('blocPmThemeSwitcher — select + 3 options + script localStorage', () => {
  const html = blocPmThemeSwitcher();
  assert.ok(html.includes('id="pm-theme-select"'));
  assert.ok(html.includes('value="default"'));
  assert.ok(html.includes('value="pm-warm"'));
  assert.ok(html.includes('value="pm-focus"'));
  assert.ok(html.includes('aiad-pm-theme'));
  assert.ok(html.includes('localStorage'));
});

test('blocPmThemeSwitcher — CSS overrides via body.pm-theme-{nom}', () => {
  const html = blocPmThemeSwitcher();
  assert.ok(html.includes('body.pm-theme-pm-warm'));
  assert.ok(html.includes('body.pm-theme-pm-focus'));
  // PM Warm change l'accent
  assert.ok(html.includes('--accent: #e8590c'));
});

// ─── #478 — Outcome leaderboard ─────────────────────────────────────────────

test('calculerScoreOutcome — base = outcomes × poids priorité', () => {
  const r = calculerScoreOutcome(
    { id: 'A', priority: 'P0', statut: 'draft' },
    [{ intents: [{ id: 'A' }] }, { intents: [{ id: 'A' }] }],
    new Map()
  );
  assert.equal(r.outcomesServis, 2);
  assert.equal(r.poidsPrio, 5);
  assert.equal(r.base, 10);
  assert.equal(r.bonus, 0); // draft pas active, pas de spec done
});

test('calculerScoreOutcome — bonus +1 si SPEC done + +0.5 si active', () => {
  const specsParIntent = new Map([['A', [{ statut: 'done' }]]]);
  const r = calculerScoreOutcome(
    { id: 'A', priority: 'P1', statut: 'active' },
    [{ intents: [{ id: 'A' }] }],
    specsParIntent
  );
  assert.equal(r.base, 3);
  assert.equal(r.bonus, 1.5);
  assert.equal(r.score, 4.5);
});

test('calculerScoreOutcome — poids défaut 1 si priorité inconnue', () => {
  const r = calculerScoreOutcome(
    { id: 'A', priority: 'X', statut: 'draft' },
    [{ intents: [{ id: 'A' }] }],
    new Map()
  );
  assert.equal(r.poidsPrio, 1);
});

test('calculerOutcomeLeaderboard — exclut Intents sans contribution + tri desc', () => {
  const r = calculerOutcomeLeaderboard({
    intents: [
      { id: 'A', titre: 'a', statut: 'active', priority: 'P0' },
      { id: 'B', titre: 'b', statut: 'draft' }, // pas dans outcome → exclu
      { id: 'C', titre: 'c', statut: 'active', priority: 'P2' },
    ],
    prdCoverage: { outcomes: [
      { intents: [{ id: 'A' }, { id: 'C' }] },
    ]},
    specs: [],
  });
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].id, 'A'); // P0 → score plus haut
  assert.equal(r.items[1].id, 'C');
});

test('blocOutcomeLeaderboard — empty + rendu avec médailles', () => {
  assert.ok(blocOutcomeLeaderboard({ outcomeLeaderboard: { items: [], totaux: { total: 0 } } }).includes('aucun Intent'));
  const html = blocOutcomeLeaderboard({ outcomeLeaderboard: {
    items: [
      { id: 'INTENT-A', titre: 't', file: null, statut: 'active', priority: 'P0', score: 10, outcomesServis: 2, poidsPrio: 5, bonus: 0 },
      { id: 'INTENT-B', titre: 't', file: null, statut: 'draft', priority: 'P1', score: 3, outcomesServis: 1, poidsPrio: 3, bonus: 0 },
    ],
    totaux: { total: 2 },
  }});
  assert.ok(html.includes('Outcome leaderboard'));
  assert.ok(html.includes('🥇'));
  assert.ok(html.includes('🥈'));
  assert.ok(html.includes('INTENT-A'));
  assert.ok(html.includes('lb-bar-fill'));
});

// ─── #479 — Velocity forecast ───────────────────────────────────────────────

test('calculerVelocityForecast — message si donnée insuffisante', () => {
  const r = calculerVelocityForecast({ specs: [] }, { now: Date.UTC(2026, 4, 15) });
  assert.ok(r.message);
  assert.equal(r.forecast.length, 0);
});

test('calculerVelocityForecast — extrapolation linéaire correcte', () => {
  // 6 semaines, 1 SPEC done/semaine constant → slope 0
  const now = Date.UTC(2026, 4, 15);
  const specs = [];
  for (let w = 0; w < 6; w++) {
    specs.push({ statut: 'done', mtime: now - (w * 7 + 3) * 24 * 3600 * 1000 });
  }
  const r = calculerVelocityForecast({ specs }, { now, fenetreSem: 6, horizonSem: 4 });
  assert.equal(r.points.length, 6);
  assert.equal(r.forecast.length, 4);
  assert.equal(r.rythmeMoyen, 1);
  // slope ~= 0 (rythme constant)
  assert.ok(Math.abs(r.reg.slope) < 0.5);
});

test('calculerVelocityForecast — détecte accélération (slope > 0)', () => {
  const now = Date.UTC(2026, 4, 15);
  const specs = [];
  // Semaine la plus ancienne (S-5) → 0 SPECs, ..., semaine courante (S0) → 5 SPECs.
  for (let w = 0; w <= 5; w++) {
    for (let i = 0; i < w; i++) {
      // Mtime placé dans la semaine w-jours-passés.
      specs.push({ statut: 'done', mtime: now - (5 - w) * 7 * 24 * 3600 * 1000 - 3 * 24 * 3600 * 1000 });
    }
  }
  const r = calculerVelocityForecast({ specs }, { now, fenetreSem: 6, horizonSem: 3 });
  // 0 + 1 + 2 + 3 + 4 + 5 = 15 SPECs sur 6 sem → slope > 0
  assert.ok(r.reg.slope > 0, 'slope strictement > 0 attendu');
  // Projection 3 sem en avant : ~6/7/8 SPECs → > rythme moyen actuel
  const dernierForecast = r.forecast[r.forecast.length - 1];
  assert.ok(dernierForecast.y > r.rythmeMoyen);
});

test('calculerVelocityForecast — restant + etaSemaines', () => {
  const now = Date.UTC(2026, 4, 15);
  const specs = [
    { statut: 'done', mtime: now - 4 * 24 * 3600 * 1000 },
    { statut: 'done', mtime: now - 11 * 24 * 3600 * 1000 },
    { statut: 'done', mtime: now - 18 * 24 * 3600 * 1000 },
    { statut: 'in-progress', mtime: now },
    { statut: 'draft', mtime: now },
    { statut: 'ready', mtime: now },
  ];
  const r = calculerVelocityForecast({ specs }, { now });
  assert.equal(r.restant, 3);
  assert.ok(r.etaSemaines != null);
});

test('blocVelocityForecast — empty message si donnée insuffisante', () => {
  const html = blocVelocityForecast({ velocityForecast: { message: 'Donnée insuffisante', points: [], forecast: [] } });
  assert.ok(html.includes('Velocity forecast'));
  assert.ok(html.includes('Donnée insuffisante'));
});

test('blocVelocityForecast — rendu SVG + meta + warning ETA si > 26 sem', () => {
  const html = blocVelocityForecast({ velocityForecast: {
    points: [{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 3 }],
    forecast: [{ semaineIdx: 3, y: 4, yMin: 3, yMax: 5 }],
    reg: { slope: 1, intercept: 1, stdErr: 0.5 },
    rythmeMoyen: 2,
    projectionHorizon: 4,
    horizonSem: 1,
    fenetreSem: 3,
    restant: 60,
    etaSemaines: 30,
  }});
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('polyline'));
  assert.ok(html.includes('Rythme moyen'));
  assert.ok(html.includes('30 semaines'));
  assert.ok(html.includes('ETA pour livrer le backlog actuel')); // warning
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof pmThemeSwitcher, 'function');
  assert.equal(typeof computeOutcomeScore, 'function');
  assert.equal(typeof computeOutcomeLeaderboard, 'function');
  assert.equal(typeof outcomeLeaderboardSection, 'function');
  assert.equal(typeof computeVelocityForecast, 'function');
  assert.equal(typeof velocityForecastSection, 'function');
});
