// Tests #426 / #427 / #428 — Boucle 3 PM cockpit stratégique :
//   - priorisation Intent (priority / RICE / WSJF / wave)
//   - roadmap timeline par trimestre
//   - Intent → Outcome mapping

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  lirePriorite, comparerPriorite, ordonner, topPriorites, badgePriorite,
  clePriorite, blocTopPriorites,
  readPriority, comparePriority, sortByPriority, topPriorities, priorityBadge,
} from '../lib/dashboard/intent-priority.js';

import {
  parseTarget, lireQuarterIntent, formatQuarter, cleQuarter,
  quartersAffiches, calculerRoadmap, blocRoadmap,
  parseTargetField, readIntentQuarter, computeRoadmap, roadmapSection,
} from '../lib/dashboard/roadmap.js';

import {
  intentSertOutcome, calculerCouverturePrd, blocCouverturePrd,
  intentServesOutcome,
} from '../lib/dashboard/prd-coverage.js';

// ─── #426 — Priorisation Intent ─────────────────────────────────────────────

test('lirePriorite — P0 priority détecté', () => {
  const p = lirePriorite({ priority: 'P0' });
  assert.equal(p.priority, 'P0');
  assert.equal(p.rawScheme, 'priority');
});

test('lirePriorite — case-insensitive p1 → P1', () => {
  assert.equal(lirePriorite({ priority: 'p1' }).priority, 'P1');
});

test('lirePriorite — RICE fallback si pas de priority', () => {
  const p = lirePriorite({ rice: 42 });
  assert.equal(p.priority, null);
  assert.equal(p.rice, 42);
  assert.equal(p.rawScheme, 'rice');
});

test('lirePriorite — invalide retourne null', () => {
  assert.equal(lirePriorite({ priority: 'high' }).priority, null);
  assert.equal(lirePriorite({}).rawScheme, null);
  assert.equal(lirePriorite(null).rawScheme, null);
});

test('comparerPriorite — P0 avant P1', () => {
  const a = { priority: 'P0', mtime: 1 };
  const b = { priority: 'P1', mtime: 2 };
  assert.ok(comparerPriorite(a, b) < 0);
});

test('comparerPriorite — RICE plus élevé d\'abord (priorité égale)', () => {
  const a = { rice: 100, mtime: 1 };
  const b = { rice: 50, mtime: 2 };
  assert.ok(comparerPriorite(a, b) < 0);
});

test('comparerPriorite — wave 1 avant wave 2', () => {
  const a = { wave: 1 };
  const b = { wave: 2 };
  assert.ok(comparerPriorite(a, b) < 0);
});

test('ordonner — trie + immutabilité (ne mute pas l\'entrée)', () => {
  const intents = [{ id: 'A', priority: 'P2' }, { id: 'B', priority: 'P0' }, { id: 'C' }];
  const sorted = ordonner(intents);
  assert.equal(sorted[0].id, 'B');
  assert.equal(sorted[1].id, 'A');
  assert.equal(intents[0].id, 'A', 'entrée non mutée');
});

test('topPriorites — exclut done/archived + slice N', () => {
  const intents = [
    { id: 'A', priority: 'P0', statut: 'active' },
    { id: 'B', priority: 'P0', statut: 'done' },
    { id: 'C', priority: 'P1', statut: 'draft' },
    { id: 'D', priority: 'P1', statut: 'archived' },
  ];
  const top = topPriorites(intents, 5);
  assert.equal(top.length, 2);
  assert.deepEqual(top.map((i) => i.id), ['A', 'C']);
});

test('badgePriorite — couleurs cohérentes', () => {
  assert.ok(badgePriorite({ priority: 'P0' }).includes('badge-bad'));
  assert.ok(badgePriorite({ priority: 'P1' }).includes('badge-warn'));
  assert.ok(badgePriorite({ priority: 'P2' }).includes('badge-info'));
  assert.ok(badgePriorite({ rice: 42 }).includes('RICE 42'));
  assert.ok(badgePriorite({ wave: 2 }).includes('V2'));
  assert.ok(badgePriorite({}).includes('—'));
});

test('clePriorite — P0 < P1 < ... < non-prioritized', () => {
  assert.ok(clePriorite({ priority: 'P0' }) < clePriorite({ priority: 'P1' }));
  assert.ok(clePriorite({ priority: 'P2' }) < clePriorite({ wave: 1 }));
  assert.ok(clePriorite({}) > clePriorite({ priority: 'P3' }));
});

test('blocTopPriorites — empty si pas d\'intents pipeline', () => {
  assert.equal(blocTopPriorites({ intents: [] }), '');
});

test('blocTopPriorites — table + badges rendus', () => {
  const html = blocTopPriorites({ intents: [
    { id: 'INTENT-A', titre: 'X', priority: 'P0', statut: 'active', file: 'a.md' },
    { id: 'INTENT-B', titre: 'Y', priority: 'P2', statut: 'draft' },
  ]});
  assert.ok(html.includes('Top priorités'));
  assert.ok(html.includes('INTENT-A'));
  assert.ok(html.includes('P0'));
});

// ─── #427 — Roadmap timeline ────────────────────────────────────────────────

test('parseTarget — "Q3-2026" reconnu', () => {
  assert.deepEqual(parseTarget('Q3-2026'), { year: 2026, quarter: 3 });
  assert.deepEqual(parseTarget('Q3 2026'), { year: 2026, quarter: 3 });
});

test('parseTarget — "2026-09-30" mois → quarter calculé', () => {
  assert.deepEqual(parseTarget('2026-09-30'), { year: 2026, quarter: 3 });
  assert.deepEqual(parseTarget('2026-04'), { year: 2026, quarter: 2 });
  assert.deepEqual(parseTarget('2026'), { year: 2026, quarter: 1 });
});

test('parseTarget — null/invalide', () => {
  assert.equal(parseTarget(null), null);
  assert.equal(parseTarget(''), null);
  assert.equal(parseTarget('plus tard'), null);
});

test('lireQuarterIntent — frontmatter target prime', () => {
  assert.deepEqual(lireQuarterIntent({ target: 'Q2-2026' }), { year: 2026, quarter: 2 });
  assert.deepEqual(lireQuarterIntent({ target_date: '2026-12-01' }), { year: 2026, quarter: 4 });
  assert.equal(lireQuarterIntent({}), null);
});

test('formatQuarter / cleQuarter — round-trip', () => {
  const q = { year: 2026, quarter: 3 };
  assert.equal(formatQuarter(q), 'Q3-2026');
  assert.equal(cleQuarter(q), 2026 * 4 + 2);
  assert.ok(cleQuarter({ year: 2026, quarter: 1 }) < cleQuarter({ year: 2026, quarter: 2 }));
  assert.ok(cleQuarter({ year: 2026, quarter: 4 }) < cleQuarter({ year: 2027, quarter: 1 }));
});

test('quartersAffiches — 1 behind + actuel + 3 ahead par défaut', () => {
  const now = Date.UTC(2026, 4, 15); // Q2-2026
  const qs = quartersAffiches({ now });
  assert.equal(qs.length, 5);
  assert.deepEqual(qs[0], { year: 2026, quarter: 1 });
  assert.deepEqual(qs[1], { year: 2026, quarter: 2 });
  assert.deepEqual(qs[4], { year: 2027, quarter: 1 });
});

test('calculerRoadmap — buckets + nonDates + estActuel flag', () => {
  const now = Date.UTC(2026, 4, 15);
  const donnees = { intents: [
    { id: 'A', titre: 't', target: 'Q2-2026', statut: 'active' },
    { id: 'B', titre: 't', target: 'Q3-2026', statut: 'draft' },
    { id: 'C', titre: 't', statut: 'active' }, // pas de target
  ]};
  const r = calculerRoadmap(donnees, { now });
  assert.equal(r.totaux.planifies, 2);
  assert.equal(r.totaux.nonDates, 1);
  assert.equal(r.nonDates[0].id, 'C');
  const actuel = r.buckets.find((b) => b.estActuel);
  assert.equal(actuel.intents.length, 1);
  assert.equal(actuel.intents[0].id, 'A');
});

test('blocRoadmap — vide si totaux à 0', () => {
  assert.equal(blocRoadmap({ roadmap: { buckets: [], nonDates: [], totaux: { total: 0 } } }), '');
});

test('blocRoadmap — rendu avec colonnes + cartes', () => {
  const html = blocRoadmap({ roadmap: {
    buckets: [
      { label: 'Q1-2026', cle: 0, intents: [{ id: 'A', titre: 'X', statut: 'active' }], estActuel: false, estPasse: true },
      { label: 'Q2-2026', cle: 1, intents: [], estActuel: true, estPasse: false },
    ],
    nonDates: [{ id: 'C' }],
    totaux: { planifies: 1, nonDates: 1, total: 2 },
  }});
  assert.ok(html.includes('Roadmap'));
  assert.ok(html.includes('Q1-2026'));
  assert.ok(html.includes('roadmap-col'));
  assert.ok(html.includes('is-actuel'));
  assert.ok(html.includes('is-passe'));
  assert.ok(html.includes('sans cible'));
});

// ─── #428 — Intent ↔ Outcome mapping ────────────────────────────────────────

test('intentSertOutcome — frontmatter outcomes explicite', () => {
  const intent = { titre: 'X', outcomes: ['Latence p95'] };
  assert.equal(intentSertOutcome(intent, { critere: 'Latence p95' }), true);
  assert.equal(intentSertOutcome(intent, { critere: 'Conversion' }), false);
});

test('intentSertOutcome — heuristique tokens significatifs (≥ 4 chars)', () => {
  const intent = { titre: 'Réduire latence', sections: { objectif: 'Améliorer la latence p95 redirect.' } };
  // "Latence p95" → tokens ["latence"] (p95 < 4 chars ignoré). "latence" présent → match
  assert.equal(intentSertOutcome(intent, { critere: 'Latence p95 redirect' }), true);
  assert.equal(intentSertOutcome(intent, { critere: 'Drop-off' }), false);
});

test('intentSertOutcome — match sur valeur cible', () => {
  const intent = { titre: 'X', sections: { objectif: 'Atteindre 50ms en p95.' } };
  assert.equal(intentSertOutcome(intent, { critere: 'Z', cible: '< 50 ms' }), true);
});

test('calculerCouverturePrd — outcomes inclus dans la sortie', async () => {
  const { mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const dir = join(tmpdir(), 'aiad-pm-v3-' + Math.random().toString(36).slice(2));
  mkdirSync(join(dir, '.aiad'), { recursive: true });
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), '# x\n## 3. Personas\n| P | B | R |\n|---|---|---|\n');
    const donnees = {
      intents: [{ id: 'INTENT-1', titre: 't', outcomes: ['Latence p95'], sections: {} }],
      outcomes: { criteres: [{ critere: 'Latence p95', baseline: '180', cible: '< 50ms' }] },
    };
    const c = calculerCouverturePrd(dir, donnees);
    assert.equal(c.outcomes.length, 1);
    assert.equal(c.outcomes[0].count, 1);
    assert.equal(c.totaux.outcomes, 1);
    assert.equal(c.totaux.outcomesCouverts, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('blocCouverturePrd — section Outcomes rendue si outcomes présents', () => {
  const html = blocCouverturePrd({ prdCoverage: {
    personas: [], userStories: [],
    outcomes: [{ critere: 'Latence p95', baseline: '180', cible: '< 50ms', count: 1, intents: [{ id: 'INTENT-1' }] }],
    totaux: { personas: 0, personasCouvertes: 0, userStories: 0, userStoriesCouvertes: 0, outcomes: 1, outcomesCouverts: 1 },
  }});
  assert.ok(html.includes('Outcomes → Intents'));
  assert.ok(html.includes('Latence p95'));
  assert.ok(html.includes('INTENT-1'));
  assert.ok(html.includes('1/1 outcomes'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — readPriority / computeRoadmap / intentServesOutcome / topPriorities', () => {
  assert.equal(typeof readPriority, 'function');
  assert.equal(typeof comparePriority, 'function');
  assert.equal(typeof sortByPriority, 'function');
  assert.equal(typeof topPriorities, 'function');
  assert.equal(typeof priorityBadge, 'function');
  assert.equal(typeof parseTargetField, 'function');
  assert.equal(typeof readIntentQuarter, 'function');
  assert.equal(typeof computeRoadmap, 'function');
  assert.equal(typeof roadmapSection, 'function');
  assert.equal(typeof intentServesOutcome, 'function');
});
