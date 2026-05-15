// Tests du mini-parser frontmatter zero-dep.
// Doit rester fidèle à un sous-ensemble YAML attendu : scalaires typés,
// listes inline et multilignes, fallback safe quand pas de frontmatter.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseFrontmatter, stringifyFrontmatter } from '../lib/frontmatter.js';

test('parseFrontmatter — sans frontmatter → data vide, body intact', () => {
  const c = '# Titre\n\nCorps libre.';
  const { data, body } = parseFrontmatter(c);
  assert.deepEqual(data, {});
  assert.equal(body, c);
});

test('parseFrontmatter — scalaires typés (string/number/bool/null)', () => {
  const c = `---
status: ready
sqs: 4.2
attempts: 1
active: true
archived: false
note: ~
quoted: "valeur avec : deux-points"
---
corps`;
  const { data, body } = parseFrontmatter(c);
  assert.equal(data.status, 'ready');
  assert.equal(data.sqs, 4.2);
  assert.equal(data.attempts, 1);
  assert.equal(data.active, true);
  assert.equal(data.archived, false);
  assert.equal(data.note, null);
  assert.equal(data.quoted, 'valeur avec : deux-points');
  assert.equal(body, 'corps');
});

test('parseFrontmatter — liste inline', () => {
  const { data } = parseFrontmatter(`---
tags: [a, b, "c"]
nums: [1, 2, 3]
---
`);
  assert.deepEqual(data.tags, ['a', 'b', 'c']);
  assert.deepEqual(data.nums, [1, 2, 3]);
});

test('parseFrontmatter — liste multilignes', () => {
  const { data } = parseFrontmatter(`---
governance:
  - AIAD-RGPD
  - AIAD-RGAA
status: ready
---
body
`);
  assert.deepEqual(data.governance, ['AIAD-RGPD', 'AIAD-RGAA']);
  assert.equal(data.status, 'ready');
});

test('parseFrontmatter — fermeture manquante → data vide, body intact', () => {
  const c = `---
status: ready
pas de fermeture`;
  const { data, body } = parseFrontmatter(c);
  assert.deepEqual(data, {});
  assert.equal(body, c);
});

test('parseFrontmatter — commentaires YAML ignorés', () => {
  const { data } = parseFrontmatter(`---
# commentaire
status: ready
# autre
---
`);
  assert.equal(data.status, 'ready');
});

test('parseFrontmatter — clés avec underscore et tiret', () => {
  const { data } = parseFrontmatter(`---
parent_intent: INTENT-001
spec-id: SPEC-001-1-x
---
`);
  assert.equal(data.parent_intent, 'INTENT-001');
  assert.equal(data['spec-id'], 'SPEC-001-1-x');
});

test('parseFrontmatter — input non-string → fallback safe', () => {
  const { data, body } = parseFrontmatter(null);
  assert.deepEqual(data, {});
  assert.equal(body, '');
});

test('stringifyFrontmatter — round-trip parse → stringify → parse', () => {
  const initial = {
    status: 'ready',
    sqs: 4.2,
    active: true,
    governance: ['AIAD-RGPD', 'AIAD-RGAA'],
  };
  const yaml = stringifyFrontmatter(initial);
  const { data } = parseFrontmatter(yaml + 'corps');
  assert.deepEqual(data, initial);
});

test('stringifyFrontmatter — vide → chaîne vide', () => {
  assert.equal(stringifyFrontmatter({}), '');
  assert.equal(stringifyFrontmatter(null), '');
});
