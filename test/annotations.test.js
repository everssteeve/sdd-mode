// Tests for the annotation parser used by sdd-trace.
//
// Parser de tags @intent / @spec / @verified-by / @governance dans tout
// fichier code. Couvre JSDoc, // et # commentaires.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parserAnnotations, ANNOTATION_REGEX } from '../lib/sdd-trace.js';

test('parserAnnotations — JSDoc avec @intent et @spec', () => {
  const src = `/**
 * @intent INTENT-042
 * @spec SPEC-042-1-flow-auth
 */
export function login() {}`;
  const r = parserAnnotations(src, 'src/auth.ts');
  assert.equal(r.intents.length, 1);
  assert.equal(r.intents[0].id, 'INTENT-042');
  assert.equal(r.intents[0].line, 2);
  assert.equal(r.specs.length, 1);
  assert.equal(r.specs[0].id, 'SPEC-042-1-flow-auth');
  assert.equal(r.specs[0].line, 3);
});

test('parserAnnotations — multi-spec (cardinalité 1..n)', () => {
  const src = `// @spec SPEC-001-1-a
// @spec SPEC-002-3-b
function f() {}`;
  const r = parserAnnotations(src, 'f.js');
  assert.equal(r.specs.length, 2);
  assert.deepEqual(r.specs.map((s) => s.id), ['SPEC-001-1-a', 'SPEC-002-3-b']);
});

test('parserAnnotations — Python docstring + hash comment', () => {
  const src = `"""
@spec SPEC-099-1-ingest
"""

# @verified-by tests/test_ingest.py
def ingest(): pass`;
  const r = parserAnnotations(src, 'ingest.py');
  assert.equal(r.specs.length, 1);
  assert.equal(r.specs[0].id, 'SPEC-099-1-ingest');
  assert.equal(r.verifiedBy.length, 1);
  assert.equal(r.verifiedBy[0].path, 'tests/test_ingest.py');
});

test('parserAnnotations — @governance liste séparée par virgules', () => {
  const src = `// @governance AIAD-RGPD,AIAD-AI-ACT
const x = 1;`;
  const r = parserAnnotations(src, 'x.ts');
  assert.equal(r.governance.length, 1);
  assert.deepEqual(r.governance[0].tags, ['AIAD-RGPD', 'AIAD-AI-ACT']);
});

test('parserAnnotations — fichier sans annotation retourne des listes vides', () => {
  const r = parserAnnotations('export const x = 1;\n', 'x.ts');
  assert.equal(r.intents.length, 0);
  assert.equal(r.specs.length, 0);
  assert.equal(r.verifiedBy.length, 0);
  assert.equal(r.governance.length, 0);
});

test('parserAnnotations — plusieurs tags sur la même ligne', () => {
  const src = `// @intent INTENT-001 @spec SPEC-001-1-x`;
  const r = parserAnnotations(src, 'x.ts');
  assert.equal(r.intents.length, 1);
  assert.equal(r.specs.length, 1);
  assert.equal(r.intents[0].line, 1);
  assert.equal(r.specs[0].line, 1);
});

test('ANNOTATION_REGEX — exposition publique pour interop tooling', () => {
  assert.ok(ANNOTATION_REGEX.intent instanceof RegExp);
  assert.ok(ANNOTATION_REGEX.spec instanceof RegExp);
  assert.ok(ANNOTATION_REGEX.verifiedBy instanceof RegExp);
  assert.ok(ANNOTATION_REGEX.governance instanceof RegExp);
});
