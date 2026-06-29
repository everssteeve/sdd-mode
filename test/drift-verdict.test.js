// Tests `lib/drift-verdict.js` — verdict Drift Lock déterministe (§3.3/§3.4b).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  compterGapsBloquants,
  listerGaps,
  calculerVerdictDrift,
  // alias EN
  countBlockingGaps,
  computeDriftVerdict,
} from '../lib/drift-verdict.js';

/** Fabrique un modèle de matrice minimal. */
function modele({ codeFiles = 0, annotatedCodeFiles = 0, gaps = {} } = {}) {
  return {
    summary: { codeFiles, annotatedCodeFiles },
    gaps: {
      specsValideesNonImplementees: [],
      specsOrphelinsSurCode: [],
      intentsOrphelinsSurCode: [],
      codeSansSpec: { bloquant: 0, non_bloquant: 0, total: 0, items: [] },
      ...gaps,
    },
  };
}

test('PASS — code annoté, aucun gap bloquant', () => {
  const m = modele({ codeFiles: 3, annotatedCodeFiles: 3 });
  const r = calculerVerdictDrift(m);
  assert.equal(r.verdict, 'PASS');
  assert.equal(r.coverage, 1);
});

test('JNSP — code présent mais aucune annotation (indécidable, fail-closed)', () => {
  const m = modele({ codeFiles: 5, annotatedCodeFiles: 0 });
  const r = calculerVerdictDrift(m);
  assert.equal(r.verdict, 'JNSP');
  assert.equal(r.coverage, 0);
});

test('FAIL — gap bloquant (SPEC validée non implémentée)', () => {
  const m = modele({
    codeFiles: 2, annotatedCodeFiles: 1,
    gaps: { specsValideesNonImplementees: [{ id: 'SPEC-001-1-auth', status: 'done' }] },
  });
  const r = calculerVerdictDrift(m);
  assert.equal(r.verdict, 'FAIL');
  assert.ok(r.gaps.some((g) => g.kind === 'spec_validated_not_implemented' && g.blocking === true));
});

test('FAIL prime — orphelins code (SPEC + Intent)', () => {
  const m = modele({
    codeFiles: 4, annotatedCodeFiles: 4,
    gaps: {
      specsOrphelinsSurCode: [{ id: 'SPEC-099-1-x', file: 'lib/x.js', line: 12 }],
      intentsOrphelinsSurCode: [{ id: 'INTENT-099', file: 'lib/x.js', line: 3 }],
    },
  });
  assert.equal(compterGapsBloquants(m), 2);
  assert.equal(calculerVerdictDrift(m).verdict, 'FAIL');
});

test('coverage = 1 quand aucun fichier de code', () => {
  assert.equal(calculerVerdictDrift(modele({ codeFiles: 0 })).coverage, 1);
  assert.equal(calculerVerdictDrift(modele({ codeFiles: 0 })).verdict, 'PASS');
});

test('listerGaps — code sans @spec marqué non bloquant', () => {
  const m = modele({
    codeFiles: 2, annotatedCodeFiles: 1,
    gaps: { codeSansSpec: { bloquant: 0, non_bloquant: 1, total: 1, items: [{ path: 'lib/y.js', severity: 'non-bloquant' }] } },
  });
  const gaps = listerGaps(m);
  const ySpec = gaps.find((g) => g.ref === 'lib/y.js');
  assert.equal(ySpec.kind, 'code_without_spec');
  assert.equal(ySpec.blocking, false);
});

test('alias EN', () => {
  assert.equal(countBlockingGaps, compterGapsBloquants);
  assert.equal(computeDriftVerdict, calculerVerdictDrift);
});
