// Tests `lib/exec-status.js` — plan d'exécution phasé + statut (§3.6).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  STATUTS,
  statutDepuisMarqueur,
  parserPlan,
  progression,
  prochaineTranche,
  rendreStatut,
  chargerPlan,
  // alias EN
  parsePlan,
  nextSlice,
} from '../lib/exec-status.js';

const PLAN = `# EXEC-SPEC-004-1 — Plan phasé

## Phase 1 — Parser  [x]
- Objectif : parser les phases
- Fichiers : lib/exec-status.js
- Tests : test/exec-status.test.js
- Done : 20 tests verts

## Phase 2 — Mini-gate  [~]
- Objectif : verdict par tranche
- Tests : test/mini-gate.test.js
- Conditions :
  - dette: runner à câbler

## Phase 3 — CLI  [ ]
- Objectif : dispatch

## Phase 4 — legacy  [-]
- Objectif : hors-scope
`;

// ─── Marqueurs ──────────────────────────────────────────────────────────────

test('statutDepuisMarqueur — les 5 marqueurs', () => {
  assert.equal(statutDepuisMarqueur('x').key, 'done');
  assert.equal(statutDepuisMarqueur('~').key, 'in-progress');
  assert.equal(statutDepuisMarqueur('!').key, 'blocked');
  assert.equal(statutDepuisMarqueur('-').key, 'out-of-scope');
  assert.equal(statutDepuisMarqueur(' ').key, 'todo');
  assert.equal(statutDepuisMarqueur('').key, 'todo');
  assert.equal(Object.keys(STATUTS).length, 5);
});

// ─── Parsing ────────────────────────────────────────────────────────────────

test('parserPlan — extrait phases, statut et champs', () => {
  const m = parsePlan(PLAN);
  assert.equal(m.phases.length, 4);
  assert.equal(m.phases[0].num, 1);
  assert.equal(m.phases[0].titre, 'Parser');
  assert.equal(m.phases[0].statut.key, 'done');
  assert.deepEqual(m.phases[0].tests, ['test/exec-status.test.js']);
  assert.deepEqual(m.phases[0].fichiers, ['lib/exec-status.js']);
  assert.deepEqual(m.phases[1].conditions, ['dette: runner à câbler']);
  assert.equal(m.phases[3].statut.key, 'out-of-scope');
});

test('parserPlan — summary cohérent', () => {
  const m = parserPlan(PLAN);
  assert.deepEqual(m.summary, { total: 4, done: 1, inProgress: 1, blocked: 0, todo: 1, outOfScope: 1 });
});

test('parserPlan — supporte la forme checklist `- [m] Phase N`', () => {
  const m = parserPlan('- [x] Phase 1 — A\n- [~] Phase 2 — B');
  assert.equal(m.phases.length, 2);
  assert.equal(m.phases[0].statut.key, 'done');
  assert.equal(m.phases[1].statut.key, 'in-progress');
});

test('parserPlan — phase sans marqueur → todo', () => {
  const m = parserPlan('## Phase 1 — Sans marqueur');
  assert.equal(m.phases[0].statut.key, 'todo');
});

// ─── Progression & reprise ──────────────────────────────────────────────────

test('progression — exclut les tranches hors-scope', () => {
  const p = progression(parserPlan(PLAN));
  assert.equal(p.comptables, 3); // 4 - 1 hors-scope
  assert.equal(p.done, 1);
  assert.ok(Math.abs(p.ratio - 1 / 3) < 1e-9);
});

test('prochaineTranche — priorité in-progress > blocked > todo', () => {
  assert.equal(nextSlice(parserPlan(PLAN)).num, 2); // [~]
  const bloque = parserPlan('## Phase 1 — A  [x]\n## Phase 2 — B  [!]\n## Phase 3 — C  [ ]');
  assert.equal(prochaineTranche(bloque).num, 2); // [!] avant [ ]
  const todo = parserPlan('## Phase 1 — A  [x]\n## Phase 2 — B  [ ]');
  assert.equal(prochaineTranche(todo).num, 2);
});

test('prochaineTranche — tout validé → null', () => {
  assert.equal(prochaineTranche(parserPlan('## Phase 1 — A  [x]\n## Phase 2 — B  [-]')), null);
});

test('rendreStatut — contient symboles et progression', () => {
  const out = rendreStatut(parserPlan(PLAN));
  assert.match(out, /\[x\] Phase 1/);
  assert.match(out, /\[~\] Phase 2/);
  assert.match(out, /Progression : 1\/3/);
});

// ─── Chargement ─────────────────────────────────────────────────────────────

test('chargerPlan — localise par id de SPEC', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-exec-'));
  try {
    mkdirSync(join(dir, '.aiad', 'exec'), { recursive: true });
    writeFileSync(join(dir, '.aiad', 'exec', 'EXEC-SPEC-004-1-plan.md'), PLAN);
    assert.ok(chargerPlan(dir, 'SPEC-004-1'));
    assert.ok(chargerPlan(dir, 'spec-004-1'));
    assert.equal(chargerPlan(dir, 'SPEC-999'), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
