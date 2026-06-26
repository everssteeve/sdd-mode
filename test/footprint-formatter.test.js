// Tests — SPEC-021-2-restitution-empreinte-context — Phase 1 (formaterEmpreinte)
//
// @spec SPEC-021-2-restitution-empreinte-context
// @intent INTENT-021
// @verified-by test/footprint-formatter.test.js
// @governance AIAD-RGPD

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { formaterEmpreinte } from '../lib/empreinte-artefact.js';

// CA-007 — tri tokens décroissants
test('formaterEmpreinte::sort-tokens — tri par tokens décroissants', () => {
  const empreinte = {
    parSpec: {
      'SPEC-021-1': { tokens: 5000, sessions: 2 },
      'SPEC-020-2': { tokens: 8000, sessions: 1 },
      'SPEC-019-1': { tokens: 3000, sessions: 1 },
    },
    parIntent: {},
    nonAttribues: { tokens: 0, sessions: 0 },
  };
  const out = formaterEmpreinte(empreinte);
  const lines = out.split('\n').filter(l => l.includes('tok') && l.includes('SPEC-'));
  assert.ok(lines[0].includes('SPEC-020-2'), 'premier = 8000');
  assert.ok(lines[1].includes('SPEC-021-1'), 'deuxième = 5000');
  assert.ok(lines[2].includes('SPEC-019-1'), 'troisième = 3000');
});

// CA-008 — départage à égalité par specId croissant
test('formaterEmpreinte::stable-tiebreak — égalité → tri par specId croissant', () => {
  const empreinte = {
    parSpec: {
      'SPEC-021-2': { tokens: 5000, sessions: 1 },
      'SPEC-021-1': { tokens: 5000, sessions: 1 },
    },
    parIntent: {},
    nonAttribues: { tokens: 0, sessions: 0 },
  };
  const out = formaterEmpreinte(empreinte);
  const lines = out.split('\n').filter(l => l.includes('tok') && l.includes('SPEC-'));
  assert.ok(lines[0].includes('SPEC-021-1'), 'SPEC-021-1 < SPEC-021-2 alphabétiquement');
});

// CA-009 — token count affiché
test('formaterEmpreinte::reports-tokens — affiche le nombre de tokens', () => {
  const empreinte = {
    parSpec: { 'SPEC-021-1': { tokens: 12400, sessions: 3 } },
    parIntent: {},
    nonAttribues: { tokens: 0, sessions: 0 },
  };
  const out = formaterEmpreinte(empreinte);
  assert.ok(out.includes('12400'), 'valeur tokens présente');
  assert.ok(out.includes('3 session'), 'nombre de sessions affiché');
});

// CA-010 — pas de valeur €
test('formaterEmpreinte::no-euro-cost — pas de coût monétaire affiché', () => {
  const empreinte = {
    parSpec: { 'SPEC-021-1': { tokens: 12400, sessions: 3 } },
    parIntent: {},
    nonAttribues: { tokens: 0, sessions: 0 },
  };
  const out = formaterEmpreinte(empreinte);
  assert.ok(!out.includes('€'), 'aucun symbole €');
  assert.ok(!out.includes('EUR'), 'aucun EUR');
  assert.ok(!out.includes('cost'), 'aucun "cost"');
});

// CA-005 — avertissement couverture si nonAttribues > 50 %
test('formaterEmpreinte::coverage-warning — avertissement si nonAttribues > 50%', () => {
  const empreinte = {
    parSpec: { 'SPEC-021-1': { tokens: 4000, sessions: 1 } },
    parIntent: {},
    nonAttribues: { tokens: 6000, sessions: 2 }, // 60% non attribués
  };
  const out = formaterEmpreinte(empreinte);
  assert.ok(out.includes('50 %') || out.includes('50%'), 'avertissement couverture présent');
});

// CA-005 négatif — pas d'avertissement si nonAttribues ≤ 50 %
test("formaterEmpreinte::no-coverage-warning — pas d'avertissement si couverture OK", () => {
  const empreinte = {
    parSpec: { 'SPEC-021-1': { tokens: 6000, sessions: 2 } },
    parIntent: {},
    nonAttribues: { tokens: 4000, sessions: 1 }, // 40% non attribués
  };
  const out = formaterEmpreinte(empreinte);
  assert.ok(!out.includes('50 %') && !out.includes('50%'), 'pas d\'avertissement');
});

// CA-002 — ciblage d'un artefact présent
test('formaterEmpreinte::targeted — ciblage artefact présent', () => {
  const empreinte = {
    parSpec: {
      'SPEC-021-1': { tokens: 12400, sessions: 3 },
      'SPEC-020-2': { tokens: 8100, sessions: 2 },
    },
    parIntent: {},
    nonAttribues: { tokens: 0, sessions: 0 },
  };
  const out = formaterEmpreinte(empreinte, { cible: 'SPEC-021-1' });
  assert.ok(out.includes('SPEC-021-1'), 'artefact ciblé présent');
  assert.ok(out.includes('12400'), 'tokens corrects');
  assert.ok(!out.includes('SPEC-020-2'), 'autre spec absente');
});

// CA-002 — ciblage d'un artefact absent → 0 token + message
test('formaterEmpreinte::targeted-absent — artefact non mesuré → 0 tok', () => {
  const empreinte = {
    parSpec: {},
    parIntent: {},
    nonAttribues: { tokens: 0, sessions: 0 },
  };
  const out = formaterEmpreinte(empreinte, { cible: 'SPEC-099-1' });
  assert.ok(out.includes('0 tok') || out.includes('non encore mesuré'), 'message artefact absent');
});

// Agrégat vide — pas d'erreur
test('formaterEmpreinte::empty — pas de plantage sur empreinte vide', () => {
  const empreinte = {
    parSpec: {},
    parIntent: {},
    nonAttribues: { tokens: 0, sessions: 0 },
  };
  assert.doesNotThrow(() => formaterEmpreinte(empreinte));
  const out = formaterEmpreinte(empreinte);
  assert.ok(typeof out === 'string');
});
