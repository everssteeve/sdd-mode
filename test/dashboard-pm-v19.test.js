// Tests #474 / #475 / #476 — Boucle 19 PM cockpit goal-tree/ab-test/risk-burndown

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  lireNorthStar, calculerGoalTree, blocGoalTree,
  readNorthStar, computeGoalTree, goalTreeSection,
} from '../lib/dashboard/goal-tree.js';

import {
  calculerAbTestTracker, blocAbTestTracker,
  computeAbTestTracker, abTestTrackerSection,
} from '../lib/dashboard/ab-test-tracker.js';

import {
  calculerRiskBurndown, blocRiskBurndown,
  computeRiskBurndown, riskBurndownSection,
} from '../lib/dashboard/risk-burndown.js';

function tmpProjet() {
  const dir = join(tmpdir(), 'aiad-pm-v19-' + Math.random().toString(36).slice(2));
  mkdirSync(join(dir, '.aiad'), { recursive: true });
  return dir;
}

// ─── #474 — Goal tree ───────────────────────────────────────────────────────

test('lireNorthStar — extrait section §2 North Star', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), `# PRD
## 2. North Star / Product Goal
Devenir leader EU avec 10k MAU.

## 3. Personas
`);
    assert.equal(lireNorthStar(dir), 'Devenir leader EU avec 10k MAU.');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireNorthStar — null si absent', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), '# PRD\n## 1. X\n');
    assert.equal(lireNorthStar(dir), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireNorthStar — skip placeholder [...]', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), `## 2. North Star
[Une phrase : le changement mesurable]
`);
    assert.equal(lireNorthStar(dir), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerGoalTree — hiérarchie outcomes → intents → specs', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), `## 2. North Star
Devenir leader EU.
`);
    const d = {
      prdCoverage: { outcomes: [
        { critere: 'Latence', cible: '< 50ms', baseline: '180ms', etat: 'ok',
          intents: [{ id: 'INTENT-A' }] },
      ]},
      intents: [
        { id: 'INTENT-A', titre: 't', statut: 'active' },
        { id: 'INTENT-B', titre: 'orphelin', statut: 'draft' },
      ],
      specs: [
        { id: 'SPEC-A-1', parentIntent: 'INTENT-A', statut: 'done', titre: 'X' },
      ],
      specsParIntent: new Map(),
    };
    const r = calculerGoalTree(dir, d);
    assert.equal(r.northStar, 'Devenir leader EU.');
    assert.equal(r.outcomes.length, 1);
    assert.equal(r.outcomes[0].intents.length, 1);
    assert.equal(r.outcomes[0].intents[0].specs.length, 1);
    assert.equal(r.intentsOrphelins.length, 1);
    assert.equal(r.intentsOrphelins[0].id, 'INTENT-B');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('blocGoalTree — rend North Star + outcomes + intents + orphelins', () => {
  const html = blocGoalTree({ goalTree: {
    northStar: 'Devenir leader EU',
    outcomes: [{
      id: 'Latence', cible: '< 50ms', baseline: '180', etat: 'ok',
      intents: [{ id: 'INTENT-A', titre: 't', statut: 'active', file: null,
        specs: [{ id: 'SPEC-A-1', titre: 's', statut: 'done', file: null }] }],
    }],
    intentsOrphelins: [{ id: 'INTENT-X', titre: 'orphelin', statut: 'draft', file: null, specs: [] }],
    totaux: { outcomes: 1, intentsLies: 1, intentsOrphelins: 1 },
  }});
  assert.ok(html.includes('Arbre des objectifs'));
  assert.ok(html.includes('Devenir leader EU'));
  assert.ok(html.includes('Latence'));
  assert.ok(html.includes('INTENT-A'));
  assert.ok(html.includes('SPEC-A-1'));
  assert.ok(html.includes('1 Intent(s) sans outcome rattaché'));
  assert.ok(html.includes('INTENT-X'));
});

// ─── #475 — A/B test tracker ────────────────────────────────────────────────

test('calculerAbTestTracker — détecte experiment frontmatter', () => {
  const r = calculerAbTestTracker({
    intents: [{
      id: 'INTENT-A', titre: 't', statut: 'active',
      experiment: {
        hypothesis: 'Si X alors Y',
        metric: 'conv',
        variant_a: 'v1',
        variant_b: 'v2',
        status: 'running',
        sample_size: 5000,
      },
    }],
  });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].statut, 'running');
  assert.equal(r.items[0].hypothesis, 'Si X alors Y');
  assert.equal(r.items[0].sampleSize, 5000);
});

test('calculerAbTestTracker — détecte kind:experiment sans bloc explicite', () => {
  const r = calculerAbTestTracker({
    intents: [{ id: 'INTENT-A', titre: 't', statut: 'draft', kind: 'experiment' }],
  });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].statut, 'unknown');
});

test('calculerAbTestTracker — exclut intents sans signal experiment', () => {
  const r = calculerAbTestTracker({
    intents: [{ id: 'INTENT-A', titre: 't', statut: 'active' }],
  });
  assert.equal(r.items.length, 0);
});

test('calculerAbTestTracker — tri running > validés > inconcluants > invalidés', () => {
  const r = calculerAbTestTracker({
    intents: [
      { id: 'A', statut: 'active', experiment: { status: 'concluded-invalidated' } },
      { id: 'B', statut: 'active', experiment: { status: 'running' } },
      { id: 'C', statut: 'active', experiment: { status: 'concluded-validated' } },
    ],
  });
  assert.deepEqual(r.items.map((i) => i.id), ['B', 'C', 'A']);
  assert.equal(r.totaux.running, 1);
  assert.equal(r.totaux.valides, 1);
  assert.equal(r.totaux.invalides, 1);
});

test('calculerAbTestTracker — statut FR mappé', () => {
  const r = calculerAbTestTracker({
    intents: [
      { id: 'A', experiment: { status: 'validé' } },
      { id: 'B', experiment: { status: 'invalidé' } },
      { id: 'C', experiment: { status: 'en-cours' } },
    ],
  });
  assert.equal(r.items.find((i) => i.id === 'A').statut, 'concluded-validated');
  assert.equal(r.items.find((i) => i.id === 'B').statut, 'concluded-invalidated');
  assert.equal(r.items.find((i) => i.id === 'C').statut, 'running');
});

test('blocAbTestTracker — empty + rendu avec variant gagnant', () => {
  assert.ok(blocAbTestTracker({ abTestTracker: { items: [], totaux: {} } }).includes('aucun'));
  const html = blocAbTestTracker({ abTestTracker: {
    items: [{
      id: 'INTENT-A', titre: 't', file: null, intentStatut: 'active',
      hypothesis: 'X', metric: 'conv', variantA: 'v1', variantB: 'v2',
      statut: 'concluded-validated', winner: 'variant_b', resultSummary: '+14 %',
    }],
    totaux: { total: 1, running: 0, valides: 1, invalides: 0, inconcluants: 0 },
  }});
  assert.ok(html.includes('A/B tests'));
  assert.ok(html.includes('Validée'));
  assert.ok(html.includes('+14 %'));
  assert.ok(html.includes('class="ab-variant winner"'));
});

// ─── #476 — Risk burndown ───────────────────────────────────────────────────

test('calculerRiskBurndown — 0 risques → tendance unknown', () => {
  const r = calculerRiskBurndown('/tmp', {}, { lecteur: () => [] });
  assert.equal(r.totalRisques, 0);
  assert.equal(r.points.length, 0);
  assert.equal(r.tendance, 'unknown');
});

test('calculerRiskBurndown — < 2 snapshots → tendance unknown', () => {
  const r = calculerRiskBurndown('/tmp', {
    risks: { intents: [{ id: 'A', statut: 'active' }] },
  }, { lecteur: () => [{ date: '2026-05-15', data: { intents: [{ id: 'A', statut: 'active' }] } }] });
  assert.equal(r.totalRisques, 1);
  assert.equal(r.courantsOuverts, 1);
  assert.equal(r.snapshots, 1);
  assert.equal(r.tendance, 'unknown');
});

test('calculerRiskBurndown — tendance down (burndown bon)', () => {
  const snapshots = [
    { date: '2026-05-01', data: { intents: [{ id: 'A', statut: 'active' }, { id: 'B', statut: 'active' }, { id: 'C', statut: 'active' }] } },
    { date: '2026-05-05', data: { intents: [{ id: 'A', statut: 'active' }, { id: 'B', statut: 'done' }, { id: 'C', statut: 'active' }] } },
    { date: '2026-05-10', data: { intents: [{ id: 'A', statut: 'done' }, { id: 'B', statut: 'done' }, { id: 'C', statut: 'active' }] } },
    { date: '2026-05-15', data: { intents: [{ id: 'A', statut: 'done' }, { id: 'B', statut: 'done' }, { id: 'C', statut: 'done' }] } },
  ];
  const r = calculerRiskBurndown('/tmp', {
    risks: { intents: [{ id: 'A' }, { id: 'B' }, { id: 'C' }] },
  }, { lecteur: () => snapshots });
  assert.equal(r.totalRisques, 3);
  assert.deepEqual(r.points.map((p) => p.ouverts), [3, 2, 1, 0]);
  assert.equal(r.tendance, 'down');
});

test('calculerRiskBurndown — tendance up (accumulation)', () => {
  const snapshots = [
    { date: '2026-05-01', data: { intents: [] } },
    { date: '2026-05-08', data: { intents: [{ id: 'A', statut: 'active' }] } },
    { date: '2026-05-15', data: { intents: [{ id: 'A', statut: 'active' }, { id: 'B', statut: 'active' }] } },
  ];
  const r = calculerRiskBurndown('/tmp', {
    risks: { intents: [{ id: 'A' }, { id: 'B' }] },
  }, { lecteur: () => snapshots });
  assert.equal(r.tendance, 'up');
});

test('blocRiskBurndown — empty si zéro risque', () => {
  assert.ok(blocRiskBurndown({ riskBurndown: { totalRisques: 0, snapshots: 0, courantsOuverts: 0, points: [], tendance: 'unknown' } }).includes('aucun risque déclaré'));
});

test('blocRiskBurndown — message minimum 2 snapshots', () => {
  const html = blocRiskBurndown({ riskBurndown: { totalRisques: 2, snapshots: 1, courantsOuverts: 2, points: [], tendance: 'unknown' } });
  assert.ok(html.includes('minimum 2 requis'));
});

test('blocRiskBurndown — SVG + stats + label tendance', () => {
  const html = blocRiskBurndown({ riskBurndown: {
    totalRisques: 2, snapshots: 2, courantsOuverts: 1, tendance: 'down',
    points: [{ date: '2026-05-08', ouverts: 2 }, { date: '2026-05-15', ouverts: 1 }],
  }});
  assert.ok(html.includes('Risk burndown'));
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('polyline'));
  assert.ok(html.includes('Burndown — risques en baisse'));
  assert.ok(html.includes('rbd-tendance down'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof readNorthStar, 'function');
  assert.equal(typeof computeGoalTree, 'function');
  assert.equal(typeof goalTreeSection, 'function');
  assert.equal(typeof computeAbTestTracker, 'function');
  assert.equal(typeof abTestTrackerSection, 'function');
  assert.equal(typeof computeRiskBurndown, 'function');
  assert.equal(typeof riskBurndownSection, 'function');
});
