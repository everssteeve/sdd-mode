// Intégration bout-en-bout du cycle SDD (§3.4 « Intent → Research → SPEC →
// Gate → Exec → Validate → Drift Lock »), qui chaîne les modules réellement
// déterministes plutôt que de les tester isolément comme le fait le reste de
// la suite. Objectif : prouver que la composition se comporte comme le PRD
// le décrit — jamais de saut d'étape, verdicts PASS/CONDITIONAL/FAIL/JNSP
// systématiquement mappés au bon exit code, et un blocage à une étape
// empêche mécaniquement l'étape suivante de démarrer.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import {
  construireGraphe, appliquerVerdict, peutDemarrer, prochaineEtape, cycleComplet,
} from '../../lib/cycle-graph.js';
import { calculerVerdictResearch, parserResearch } from '../../lib/research.js';
import { codeSortie, normaliserVerdict } from '../../lib/verdict.js';
import { calculerMiniGate } from '../../lib/mini-gate.js';
import { parserPlan } from '../../lib/exec-status.js';
import { influenceVerdict } from '../../lib/cross-model.js';
import { calculerVerdictDrift } from '../../lib/drift-verdict.js';

function projetTemp() {
  return mkdtempSync(join(tmpdir(), 'aiad-full-cycle-'));
}

function research(md) { return calculerVerdictResearch(parserResearch(md)); }

function minigatePhase(dir, plan, tests = []) {
  mkdirSync(join(dir, '.aiad', 'exec'), { recursive: true });
  writeFileSync(join(dir, '.aiad', 'exec', 'EXEC-SPEC-099-1-plan.md'), plan);
  for (const t of tests) {
    mkdirSync(join(dir, dirname(t)), { recursive: true });
    writeFileSync(join(dir, t), 'test("x", () => {});');
  }
  return parserPlan(plan).phases[0];
}

function driftModel({ codeFiles, annotatedCodeFiles }) {
  return {
    summary: { codeFiles, annotatedCodeFiles },
    gaps: {
      specsValideesNonImplementees: [], specsOrphelinsSurCode: [], intentsOrphelinsSurCode: [],
      codeSansSpec: { bloquant: 0, non_bloquant: 0, total: 0, items: [] },
    },
  };
}

// SQS n'a pas de fonction lib dédiée (scoring délégué à l'agent via le skill
// `sqs-scoring`) — mais le seuil d'ouverture (§3.4, SQS ≥ 4/5) et le mapping
// verdict canonique, eux, sont mécaniques. On modélise ce fragment déterministe
// exactement comme /sdd gate le fait derrière l'agent.
function gateVerdictFromSqs(sqs) {
  if (sqs == null) return 'JNSP';
  if (sqs >= 4) return 'PASS';
  return 'FAIL';
}

test('cycle complet — chemin nominal : RESEARCH → GATE → EXEC → VALIDATE → DRIFT-LOCK, jamais de saut', () => {
  const dir = projetTemp();
  try {
    let g = construireGraphe('INTENT-099');
    assert.equal(cycleComplet(g), false);

    // RESEARCH — verdict GO déterministe calculé par le module réel.
    const researchMd = [
      '# RESEARCH-099 — Test cycle (← INTENT-099)', '',
      '## Discovery', '- lib/x.js:10',
      '## Risques & inconnues',
      '## Verdict : GO (confidence: 90 %)',
    ].join('\n');
    const rv = research(researchMd);
    assert.equal(rv.verdict, 'PASS'); // décision humaine GO → verdict canonique PASS
    assert.equal(codeSortie(normaliserVerdict('PASS')), 0);
    ({ graphe: g } = appliquerVerdict(g, 'RESEARCH', 'PASS'));
    assert.equal(g.etapes[1].status, 'done');

    // SPEC n'a pas de verdict machine propre (rédaction humaine/agent) — on
    // avance l'étape comme le ferait /sdd spec une fois le document produit.
    ({ graphe: g } = appliquerVerdict(g, 'SPEC', 'PASS'));

    // GATE — seuil SQS ≥ 4/5 mappé sur le contrat canonique.
    const gateVerdict = gateVerdictFromSqs(4);
    assert.equal(gateVerdict, 'PASS');
    ({ graphe: g } = appliquerVerdict(g, 'GATE', gateVerdict));
    assert.equal(prochaineEtape(g).name, 'EXEC');

    // EXEC — mini-gate réel sur une tranche livrée avec ses tests.
    const phase = minigatePhase(
      dir,
      '## Phase 1 — Cœur  [~]\n- Tests : test/x.test.js',
      ['test/x.test.js'],
    );
    const mg = calculerMiniGate(phase, dir);
    assert.equal(mg.verdict, 'PASS');
    ({ graphe: g } = appliquerVerdict(g, 'EXEC', mg.verdict));

    // VALIDATE — cross-model review additive-only : aucun finding non résolu.
    const merged = influenceVerdict('PASS', []);
    assert.equal(merged.verdict, 'PASS');
    ({ graphe: g } = appliquerVerdict(g, 'VALIDATE', merged.verdict));

    // DRIFT-LOCK — traçabilité complète, aucun gap bloquant.
    const dv = calculerVerdictDrift(driftModel({ codeFiles: 2, annotatedCodeFiles: 2 }));
    assert.equal(dv.verdict, 'PASS');
    ({ graphe: g } = appliquerVerdict(g, 'DRIFT-LOCK', dv.verdict));

    assert.equal(cycleComplet(g), true);
    assert.equal(prochaineEtape(g), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('cycle — GATE fermée (SQS ≤ 3) bloque EXEC : le graphe refuse de sauter l\'étape', () => {
  let g = construireGraphe('INTENT-100');
  ({ graphe: g } = appliquerVerdict(g, 'RESEARCH', 'PASS'));
  ({ graphe: g } = appliquerVerdict(g, 'SPEC', 'PASS'));

  const verdict = gateVerdictFromSqs(2); // SQS 2/5 → FERMÉE
  assert.equal(verdict, 'FAIL');
  assert.equal(codeSortie(normaliserVerdict('FAIL')), 1);
  ({ graphe: g } = appliquerVerdict(g, 'GATE', verdict));
  assert.equal(g.etapes[3].status, 'blocked');

  // EXEC ne peut pas démarrer tant que GATE n'est pas `done`.
  assert.equal(peutDemarrer(g, 'EXEC'), false);
  const attempt = appliquerVerdict(g, 'EXEC', 'PASS');
  assert.equal(attempt.applique, false);
  assert.match(attempt.raison, /GATE non terminée/);
});

test('cycle — RESEARCH indécidable (JNSP) fail-closed : aucune étape suivante ne s\'ouvre', () => {
  let g = construireGraphe('INTENT-101');
  const researchMd = '# RESEARCH-101 — Sans discovery (← INTENT-101)\n\n## Discovery\n\n## Risques & inconnues\n';
  const rv = research(researchMd);
  // Discovery vide → le module réel doit refuser un GO/NO-GO tranché.
  assert.equal(rv.verdict, 'JNSP');
  assert.equal(codeSortie(normaliserVerdict('JNSP')), 2);

  ({ graphe: g } = appliquerVerdict(g, 'RESEARCH', rv.verdict));
  assert.equal(g.etapes[1].status, 'blocked');
  assert.equal(peutDemarrer(g, 'SPEC'), false);
  // prochaineEtape renvoie l'étape bloquée elle-même (à débloquer), jamais SPEC.
  const next = prochaineEtape(g);
  assert.equal(next.name, 'RESEARCH');
  assert.equal(next.status, 'blocked');
});

test('cycle — DRIFT-LOCK JNSP (aucune annotation @spec) bloque la clôture même après VALIDATE PASS', () => {
  let g = construireGraphe('INTENT-102');
  for (const etape of ['RESEARCH', 'SPEC', 'GATE', 'EXEC', 'VALIDATE']) {
    ({ graphe: g } = appliquerVerdict(g, etape, 'PASS'));
  }
  assert.equal(prochaineEtape(g).name, 'DRIFT-LOCK');

  const dv = calculerVerdictDrift(driftModel({ codeFiles: 5, annotatedCodeFiles: 0 }));
  assert.equal(dv.verdict, 'JNSP'); // INCONNU ≠ OK — jamais dégradé en PASS
  ({ graphe: g } = appliquerVerdict(g, 'DRIFT-LOCK', dv.verdict));
  assert.equal(cycleComplet(g), false);
  assert.equal(g.etapes[6].status, 'blocked');
});
