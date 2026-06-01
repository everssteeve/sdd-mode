// Tests pour #241 — Dashboard PWA web manifest

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  genererManifest, manifestJson,
  generateManifest, manifestJsonString,
} from '../lib/dashboard/manifest.js';

test('genererManifest — projet nommé produit manifest valide', () => {
  const m = genererManifest({ projet: { nom: 'demo-app' } });
  assert.equal(m.name, 'demo-app — AIAD SDD Dashboard');
  assert.equal(m.short_name, 'demo-app');
  assert.equal(m.start_url, './index.html');
  assert.equal(m.display, 'standalone');
  assert.equal(m.theme_color, '#2563eb');
  assert.equal(m.background_color, '#f7f8fa');
  assert.equal(m.lang, 'fr');
  assert.ok(Array.isArray(m.icons));
  assert.equal(m.icons[0].src, 'favicon.svg');
  assert.equal(m.icons[0].type, 'image/svg+xml');
});

test('genererManifest — short_name tronqué à 12 chars', () => {
  const m = genererManifest({ projet: { nom: 'this-is-a-very-long-project-name' } });
  assert.ok(m.short_name.length <= 12, `short_name trop long : ${m.short_name}`);
  assert.equal(m.short_name, 'this-is-a-ve');
});

test('genererManifest — sans projet → fallback "AIAD SDD"', () => {
  const m = genererManifest({});
  assert.match(m.name, /AIAD SDD/);
  assert.equal(m.short_name, 'AIAD SDD');
});

test('genererManifest — publicUrl → start_url absolu', () => {
  const m = genererManifest({ projet: { nom: 'x' }, publicUrl: 'https://aiad.ovh/d' });
  assert.equal(m.start_url, 'https://aiad.ovh/d/index.html');
});

test('genererManifest — publicUrl trailing slash strippé', () => {
  const m = genererManifest({ projet: { nom: 'x' }, publicUrl: 'https://aiad.ovh/d/' });
  assert.equal(m.start_url, 'https://aiad.ovh/d/index.html');
});

test('genererManifest — categories canoniques PWA', () => {
  const m = genererManifest({ projet: { nom: 'x' } });
  assert.deepEqual(m.categories, ['productivity', 'business', 'developer-tools']);
});

test('manifestJson — JSON valide sérialisable', () => {
  const json = manifestJson({ projet: { nom: 'demo' } });
  const parsed = JSON.parse(json);
  assert.equal(parsed.name, 'demo — AIAD SDD Dashboard');
});

test('Alias EN canoniques', () => {
  assert.equal(generateManifest, genererManifest);
  assert.equal(manifestJsonString, manifestJson);
});
