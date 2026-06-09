// Tests `lib/grill.js` — pattern « grill me » (GF4, §4).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  prochaineQuestion,
  grillComplet,
  rendreQuestion,
  // alias EN
  nextQuestion,
  grillComplete,
} from '../lib/grill.js';

const Q = [
  { id: 'objectif', question: 'Quel est l\'objectif mesurable ?', recommandation: 'Conversion +10 %', obligatoire: true },
  { id: 'risque', question: 'Domaine à risque ?', recommandation: 'Paiement → chemin lourd', obligatoire: true },
  { id: 'note', question: 'Note libre ?', obligatoire: false },
];

// ─── prochaineQuestion ──────────────────────────────────────────────────────

test('prochaineQuestion — première non répondue + recommandation', () => {
  const q = prochaineQuestion(Q, {});
  assert.equal(q.id, 'objectif');
  assert.equal(q.recommandation, 'Conversion +10 %');
  assert.equal(q.reste, 3);
});

test('prochaineQuestion — saute les répondues (une à la fois)', () => {
  const q = nextQuestion(Q, { objectif: 'oui' });
  assert.equal(q.id, 'risque');
  assert.equal(q.reste, 2);
});

test('prochaineQuestion — réponse vide compte comme non répondue', () => {
  const q = prochaineQuestion(Q, { objectif: '   ' });
  assert.equal(q.id, 'objectif');
});

test('prochaineQuestion — obligatoires tranchées + inclureOptionnelles=false → null', () => {
  const q = prochaineQuestion(Q, { objectif: 'a', risque: 'b' }, { inclureOptionnelles: false });
  assert.equal(q, null);
});

test('prochaineQuestion — optionnelle restante si incluse', () => {
  const q = prochaineQuestion(Q, { objectif: 'a', risque: 'b' });
  assert.equal(q.id, 'note');
  assert.equal(q.obligatoire, false);
});

// ─── grillComplet ───────────────────────────────────────────────────────────

test('grillComplet — vrai quand toutes les obligatoires sont répondues', () => {
  assert.equal(grillComplet(Q, { objectif: 'a', risque: 'b' }), true);
  assert.equal(grillComplete(Q, { objectif: 'a' }), false);
});

// ─── rendreQuestion ─────────────────────────────────────────────────────────

test('rendreQuestion — affiche question + recommandation + reste', () => {
  const out = rendreQuestion(prochaineQuestion(Q, {}));
  assert.ok(out.includes('Quel est l\'objectif'));
  assert.ok(out.includes('Recommandation'));
  assert.ok(out.includes('restante'));
});

test('rendreQuestion — null → message de complétude', () => {
  assert.ok(/tranchées/.test(rendreQuestion(null)));
});
