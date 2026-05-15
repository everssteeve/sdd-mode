// Tests `scripts/mutation-test.js` — fonctions pures de mutation.
// Le runner complet (qui lance node --test) n'est pas testé ici (lent + récursif).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { genererMutations, appliquerMutation } from '../scripts/mutation-test.js';

// ─── genererMutations ───────────────────────────────────────────────────────

test('genererMutations — code sans opérateur mutable → 0 mutation', () => {
  const r = genererMutations('export const x = 1;\nfunction f() { return x; }\n');
  assert.deepEqual(r, []);
});

test('genererMutations — détecte === et !==', () => {
  const code = 'if (a === b) {}\nif (c !== d) {}\n';
  const r = genererMutations(code);
  const ids = r.map((m) => m.id);
  assert.ok(ids.includes('STRICT_EQ_TO_NEQ'));
  assert.ok(ids.includes('STRICT_NEQ_TO_EQ'));
});

test('genererMutations — détecte true/false', () => {
  const code = 'const a = true;\nconst b = false;\n';
  const r = genererMutations(code);
  const ids = r.map((m) => m.id);
  assert.ok(ids.includes('TRUE_TO_FALSE'));
  assert.ok(ids.includes('FALSE_TO_TRUE'));
});

test('genererMutations — détecte && et ||', () => {
  const code = 'if (a && b) {}\nif (c || d) {}\n';
  const r = genererMutations(code);
  const ids = r.map((m) => m.id);
  assert.ok(ids.includes('AND_TO_OR'));
  assert.ok(ids.includes('OR_TO_AND'));
});

test('genererMutations — détecte >= et <=', () => {
  const code = 'if (a >= b) {}\nif (c <= d) {}\n';
  const r = genererMutations(code);
  const ids = r.map((m) => m.id);
  assert.ok(ids.includes('GTE_TO_GT'));
  assert.ok(ids.includes('LTE_TO_LT'));
});

test('genererMutations — chaque mutation porte line + col + original + muted', () => {
  const code = 'const a = true;\n';
  const r = genererMutations(code);
  assert.ok(r.length >= 1);
  const m = r[0];
  assert.equal(m.line, 1);
  assert.equal(typeof m.col, 'number');
  assert.equal(m.original, 'const a = true;');
  assert.equal(m.muted, 'const a = false;');
});

test('genererMutations — saute les commentaires de ligne //', () => {
  const code = '// const a = true;\nconst b = false;\n';
  const r = genererMutations(code);
  const ids = r.map((m) => m.id);
  // Le commentaire ne génère PAS TRUE_TO_FALSE (il y est skippé)
  // Mais 'false' ligne 2 génère FALSE_TO_TRUE
  assert.ok(ids.includes('FALSE_TO_TRUE'));
  // Comptons les lignes affectées
  const lignes = new Set(r.map((m) => m.line));
  assert.ok(!lignes.has(1), 'ligne commentaire mutée');
  assert.ok(lignes.has(2));
});

test('genererMutations — saute les commentaires de bloc *', () => {
  const code = ' * if (a === b) explanation\nconst x = 1 === 1;\n';
  const r = genererMutations(code);
  const lignes = new Set(r.map((m) => m.line));
  assert.ok(!lignes.has(1), 'ligne commentaire bloc mutée');
  assert.ok(lignes.has(2));
});

test('genererMutations — multiple opérateurs sur la même ligne génèrent plusieurs mutations', () => {
  const code = 'if (a === b && c === d) {}\n';
  const r = genererMutations(code);
  // 2× STRICT_EQ_TO_NEQ + 1× AND_TO_OR
  const ids = r.map((m) => m.id);
  const eqs = ids.filter((id) => id === 'STRICT_EQ_TO_NEQ');
  assert.equal(eqs.length, 2, `attendu 2 STRICT_EQ_TO_NEQ, vu ${eqs.length}`);
  assert.ok(ids.includes('AND_TO_OR'));
});

test('genererMutations — préserve la position colonne distincte', () => {
  const code = 'a === b === c\n';
  const r = genererMutations(code).filter((m) => m.id === 'STRICT_EQ_TO_NEQ');
  assert.equal(r.length, 2);
  assert.notEqual(r[0].col, r[1].col);
});

// ─── appliquerMutation ──────────────────────────────────────────────────────

test('appliquerMutation — remplace uniquement la ligne ciblée', () => {
  const code = 'a\nb\nc\n';
  const mutation = { line: 2, muted: 'B' };
  const r = appliquerMutation(code, mutation);
  assert.equal(r, 'a\nB\nc\n');
});

test('appliquerMutation — préserve les autres lignes intactes', () => {
  const code = 'function f() {\n  if (a === b) return true;\n  return false;\n}\n';
  const mutation = { line: 2, muted: '  if (a !== b) return true;' };
  const r = appliquerMutation(code, mutation);
  assert.match(r, /if \(a !== b\)/);
  assert.match(r, /return false;/);
  assert.match(r, /^function f\(\) \{/);
});

test('appliquerMutation — round-trip avec genererMutations', () => {
  const code = 'const x = true;\n';
  const mutations = genererMutations(code);
  const m = mutations[0];
  const muted = appliquerMutation(code, m);
  assert.equal(muted, 'const x = false;\n');
});

// ─── Robustesse / régression ────────────────────────────────────────────────

test('genererMutations — ne génère pas de doublons sur la même position', () => {
  const code = 'const a = 1 === 2;\n';
  const r = genererMutations(code);
  // Une seule occurrence de === → une seule STRICT_EQ_TO_NEQ
  const eqs = r.filter((m) => m.id === 'STRICT_EQ_TO_NEQ');
  assert.equal(eqs.length, 1);
});

test('genererMutations — code vide → 0 mutation', () => {
  assert.deepEqual(genererMutations(''), []);
  assert.deepEqual(genererMutations('\n\n\n'), []);
});

test('genererMutations — code complet réaliste produit ≥ 1 mutation', () => {
  const code = `
function isAdult(age) {
  return age >= 18 && age < 120;
}
function isEqual(a, b) {
  return a === b;
}
const FLAG = true;
`;
  const r = genererMutations(code);
  assert.ok(r.length >= 4, `attendu ≥ 4 mutations, vu ${r.length}`);
});
