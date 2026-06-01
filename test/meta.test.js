// Tests pour #258 — Helper _meta partagé

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMeta, buildMetaBlock, VERSION_AIAD, SCHEMA_ID } from '../lib/meta.js';

test('buildMeta — défaut produit schema/version/generated', () => {
  const m = buildMeta();
  assert.equal(m.schema, 'aiad-sdd');
  assert.match(m.version, /^\d+\.\d+\.\d+/);
  assert.match(m.generated, /^\d{4}-\d{2}-\d{2}T/);
});

test('buildMeta — schema custom override (sous-namespace)', () => {
  const m = buildMeta({ schema: 'aiad-sdd-dashboard' });
  assert.equal(m.schema, 'aiad-sdd-dashboard');
});

test('buildMeta — extra fields ajoutés (slim, etc.)', () => {
  const m = buildMeta({ slim: true });
  assert.equal(m.slim, true);
  assert.equal(m.schema, 'aiad-sdd');
});

test('buildMeta — generated override accepté', () => {
  const m = buildMeta({ generated: '2026-05-13T10:00:00.000Z' });
  assert.equal(m.generated, '2026-05-13T10:00:00.000Z');
});

test('VERSION_AIAD — sem-ver valide', () => {
  assert.match(VERSION_AIAD, /^\d+\.\d+\.\d+/);
});

test('SCHEMA_ID — constante stable', () => {
  assert.equal(SCHEMA_ID, 'aiad-sdd');
});

test('Alias buildMetaBlock', () => {
  assert.equal(buildMetaBlock, buildMeta);
});
