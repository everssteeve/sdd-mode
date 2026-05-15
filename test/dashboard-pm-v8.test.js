// Tests #441 / #442 / #443 — Boucle 8 PM cockpit ergonomie/décision :
//   - sommaire latéral sticky (TOC)
//   - matrice RICE / Impact × Effort (quadrant)
//   - journal de décisions (PRD §7 + facts)

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { wrapWithToc, wrapPmToc } from '../lib/dashboard/pm-toc.js';

import {
  scoreImpact, scoreEffort, quadrant,
  calculerRiceMatrix, blocRiceMatrix,
  impactScore, effortScore, quadrantOf, computeRiceMatrix, riceMatrixSection,
} from '../lib/dashboard/rice-matrix.js';

import {
  lireDecisionsPrd, calculerDecisionLog, blocDecisionLog,
  readPrdDecisions, computeDecisionLog, decisionLogSection,
} from '../lib/dashboard/decision-log.js';

function tmpProjet() {
  const dir = join(tmpdir(), 'aiad-pm-v8-' + Math.random().toString(36).slice(2));
  mkdirSync(join(dir, '.aiad'), { recursive: true });
  return dir;
}

// ─── #441 — TOC ─────────────────────────────────────────────────────────────

test('wrapWithToc — wrappe corps dans grille + injecte CSS + JS', () => {
  const html = wrapWithToc('<section><h2>Test</h2></section>');
  assert.ok(html.includes('pm-toc-wrapper'));
  assert.ok(html.includes('id="pm-toc"'));
  assert.ok(html.includes('<section><h2>Test</h2></section>'));
  assert.ok(html.includes('IntersectionObserver'));
  assert.ok(html.includes('aria-label="Sommaire'));
});

test('wrapWithToc — script slugifie les titres et tag les sections', () => {
  const html = wrapWithToc('');
  // Le script intègre la fonction slug + le walk DOM
  assert.ok(html.includes('function slug'));
  assert.ok(html.includes("normalize('NFD')"));
  assert.ok(html.includes("classList.add('active')"));
});

// ─── #442 — RICE matrix ─────────────────────────────────────────────────────

test('scoreImpact — priority P0=10, P1=7, P2=4, inconnu=0', () => {
  assert.equal(scoreImpact({ priority: 'P0' }), 10);
  assert.equal(scoreImpact({ priority: 'P1' }), 7);
  assert.equal(scoreImpact({ priority: 'P2' }), 4);
  assert.equal(scoreImpact({}), 0);
});

test('scoreImpact — RICE prime sur priority', () => {
  assert.equal(scoreImpact({ rice: 80, priority: 'P3' }), 8);
  assert.equal(scoreImpact({ rice: 200 }), 10, 'capé à 10');
});

test('scoreImpact — WSJF capé à 10', () => {
  assert.equal(scoreImpact({ wsjf: 7 }), 7);
  assert.equal(scoreImpact({ wsjf: 25 }), 10);
});

test('scoreEffort — base = SPECs × 2 + bonus contraintes', () => {
  assert.equal(scoreEffort({}, []), 1, 'plancher 1');
  assert.equal(scoreEffort({}, [{}, {}]), 4, '2 SPECs → 4');
  const e = scoreEffort({ sections: { contraintes: 'RGPD strict' } }, [{}]);
  assert.ok(e > 2, 'bonus RGPD ajouté');
});

test('quadrant — répartit 4 zones selon impact/effort', () => {
  assert.equal(quadrant(8, 2), 'quick-wins');
  assert.equal(quadrant(8, 7), 'big-bets');
  assert.equal(quadrant(2, 2), 'fill-ins');
  assert.equal(quadrant(2, 7), 'time-sinks');
});

test('calculerRiceMatrix — exclut done/archived, score + classifie', () => {
  const d = { intents: [
    { id: 'A', titre: 'a', statut: 'active', priority: 'P0' }, // impact 10
    { id: 'B', titre: 'b', statut: 'done', priority: 'P0' }, // exclu
    { id: 'C', titre: 'c', statut: 'draft', priority: 'P2' }, // impact 4
  ], specs: [
    { id: 'S1', parentIntent: 'A', statut: 'in-progress' },
  ]};
  const r = calculerRiceMatrix(d);
  assert.equal(r.points.length, 2);
  const a = r.points.find((p) => p.id === 'A');
  assert.equal(a.impact, 10);
  // A a 1 spec → effort 2 → quick-wins
  assert.equal(a.quadrant, 'quick-wins');
});

test('calculerRiceMatrix — exclut Intents sans aucun signal (impact=0 et effort=1)', () => {
  const d = { intents: [{ id: 'X', statut: 'draft' }], specs: [] };
  const r = calculerRiceMatrix(d);
  assert.equal(r.points.length, 0);
});

test('blocRiceMatrix — empty si zéro point', () => {
  const html = blocRiceMatrix({ riceMatrix: { points: [], totaux: {} } });
  assert.ok(html.includes('aucun Intent scorable'));
});

test('blocRiceMatrix — rend SVG + table + légende', () => {
  const html = blocRiceMatrix({ riceMatrix: {
    points: [
      { id: 'INTENT-A', titre: 't', file: null, statut: 'active', impact: 8, effort: 2, quadrant: 'quick-wins' },
      { id: 'INTENT-B', titre: 't', file: null, statut: 'active', impact: 3, effort: 8, quadrant: 'time-sinks' },
    ],
    totaux: { 'quick-wins': 1, 'big-bets': 0, 'fill-ins': 0, 'time-sinks': 1 },
  }});
  assert.ok(html.includes('Matrice Impact'));
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('Quick wins'));
  assert.ok(html.includes('Big bets'));
  assert.ok(html.includes('INTENT-A'));
  // Couleurs background distincts par quadrant
  assert.ok(html.includes('#2b8a3e')); // quick-wins
  assert.ok(html.includes('#c92a2a')); // time-sinks
});

// ─── #443 — Decision log ────────────────────────────────────────────────────

test('lireDecisionsPrd — parse table §7', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), `# X
## 7. Trade-offs et Décisions Clés

| Décision | Raison | Coût / Bénéfice |
|----------|--------|-----------------|
| Choix A | parce que X | +1 / -2 |
| Choix B | parce que Y | +3 / -1 |

## 8. Suite
`);
    const r = lireDecisionsPrd(dir);
    assert.equal(r.total, 2);
    assert.equal(r.decisions[0].decision, 'Choix A');
    assert.equal(r.decisions[0].raison, 'parce que X');
    assert.equal(r.decisions[1].tradeoff, '+3 / -1');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireDecisionsPrd — pas de section → vide', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), '# X\n\n## 1. Contexte\n\nrien.');
    const r = lireDecisionsPrd(dir);
    assert.equal(r.total, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireDecisionsPrd — variante EN "Key Decisions"', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), `# X
## Key Decisions

| Decision | Reason | Trade-off |
|----------|--------|-----------|
| A | r | t |
`);
    const r = lireDecisionsPrd(dir);
    assert.equal(r.total, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireDecisionsPrd — skip placeholders et headers', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), `# X
## 7. Trade-offs

| Décision | Raison | Coût |
|----------|--------|------|
| [D1] | [Pourquoi] | [Trade-off] |
| Vraie décision | vraie raison | vrai trade-off |
`);
    const r = lireDecisionsPrd(dir);
    assert.equal(r.total, 1);
    assert.equal(r.decisions[0].decision, 'Vraie décision');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerDecisionLog — orchestre PRD + facts + tri facts ouverts', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), `# X
## 7. Décisions
| A | B | C |
|---|---|---|
| Dec1 | r | t |
`);
    const donnees = { facts: [
      { id: 'FACT-1', titre: 't', gravite: 'minor', statut: 'closed' },
      { id: 'FACT-2', titre: 't', gravite: 'critical', statut: 'open' },
      { id: 'FACT-3', titre: 't', gravite: 'major', statut: 'open' },
    ]};
    const r = calculerDecisionLog(dir, donnees);
    assert.equal(r.totaux.decisionsPrd, 1);
    assert.equal(r.totaux.facts, 3);
    assert.equal(r.totaux.factsOuverts, 2);
    // Critical en premier, puis major, puis closed en queue
    assert.equal(r.facts[0].id, 'FACT-2');
    assert.equal(r.facts[1].id, 'FACT-3');
    assert.equal(r.facts[2].id, 'FACT-1');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('blocDecisionLog — empty si zéro décision + zéro fact', () => {
  const html = blocDecisionLog({ decisionLog: {
    prd: { decisions: [], fichier: null, total: 0 },
    facts: [],
    totaux: { decisionsPrd: 0, facts: 0, factsOuverts: 0 },
  }});
  assert.ok(html.includes('aucune décision tracée'));
});

test('blocDecisionLog — rend table décisions + fact cards', () => {
  const html = blocDecisionLog({ decisionLog: {
    prd: { fichier: '.aiad/PRD.md', total: 1, decisions: [{ decision: 'D1', raison: 'r', tradeoff: 't' }] },
    facts: [{ id: 'FACT-1', titre: 'X', gravite: 'major', statut: 'open', cause: 'C', file: null }],
    totaux: { decisionsPrd: 1, facts: 1, factsOuverts: 1 },
  }});
  assert.ok(html.includes('Décisions et facts'));
  assert.ok(html.includes('Décisions PRD'));
  assert.ok(html.includes('D1'));
  assert.ok(html.includes('FACT-1'));
  assert.ok(html.includes('Majeur'));
  assert.ok(html.includes('Cause : C'));
  assert.ok(html.includes('gravite-major'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof wrapPmToc, 'function');
  assert.equal(typeof impactScore, 'function');
  assert.equal(typeof effortScore, 'function');
  assert.equal(typeof quadrantOf, 'function');
  assert.equal(typeof computeRiceMatrix, 'function');
  assert.equal(typeof riceMatrixSection, 'function');
  assert.equal(typeof readPrdDecisions, 'function');
  assert.equal(typeof computeDecisionLog, 'function');
  assert.equal(typeof decisionLogSection, 'function');
});
