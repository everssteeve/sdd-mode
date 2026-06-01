// Tests pour #244 — CSP meta tag dashboard

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  THEME_DETECT_SCRIPT, hashSha256Base64, constructCsp, metaCsp,
  sha256Base64, buildCsp, buildMetaCsp,
} from '../lib/dashboard/csp.js';

test('THEME_DETECT_SCRIPT — script inline non vide', () => {
  assert.ok(THEME_DETECT_SCRIPT.length > 50);
  assert.match(THEME_DETECT_SCRIPT, /localStorage\.getItem\('aiad-dashboard-theme'\)/);
  assert.match(THEME_DETECT_SCRIPT, /data-theme/);
});

test('hashSha256Base64 — RFC 4648 base64 valide', () => {
  const h = hashSha256Base64('test');
  // SHA-256("test") en base64
  const reference = createHash('sha256').update('test').digest('base64');
  assert.equal(h, reference);
});

test('constructCsp — contient default-src self', () => {
  const csp = constructCsp();
  assert.match(csp, /default-src 'self'/);
});

test('constructCsp — script-src "self" + unsafe-inline + CDN D3 (#246)', () => {
  const csp = constructCsp();
  // unsafe-inline sans hash (sinon unsafe-inline est ignoré par CSP spec)
  assert.match(csp, /script-src 'self' 'unsafe-inline' https:\/\/cdn\.jsdelivr\.net/);
  // CDN D3 autorisé pour graph.html
  assert.match(csp, /https:\/\/cdn\.jsdelivr\.net/);
});

test('constructCsp — extraHashes ajoutent des hashes (override unsafe-inline si présent)', () => {
  const csp = constructCsp({ extraHashes: ['abc123'] });
  assert.match(csp, /'sha256-abc123'/);
});

test('constructCsp — frame-ancestors ABSENT (ignoré via meta, doit aller au header HTTP)', () => {
  const csp = constructCsp();
  assert.doesNotMatch(csp, /frame-ancestors/);
});

test('constructCsp — style-src autorise unsafe-inline (legitimate dynamic widths)', () => {
  const csp = constructCsp();
  assert.match(csp, /style-src 'self' 'unsafe-inline'/);
});

test('constructCsp — img-src autorise data: (favicon, SVG)', () => {
  const csp = constructCsp();
  assert.match(csp, /img-src 'self' data:/);
});

test('constructCsp — manifest-src self (PWA)', () => {
  const csp = constructCsp();
  assert.match(csp, /manifest-src 'self'/);
});

test('constructCsp — multi extraHashes ajoutés', () => {
  const csp = constructCsp({ extraHashes: ['abc123', 'def456'] });
  assert.match(csp, /'sha256-abc123'/);
  assert.match(csp, /'sha256-def456'/);
});

test('metaCsp — rend <meta http-equiv="Content-Security-Policy">', () => {
  const html = metaCsp();
  assert.match(html, /^<meta http-equiv="Content-Security-Policy" content="/);
  assert.match(html, /default-src 'self'/);
  assert.match(html, /\/>$/);
});

test('Alias EN', () => {
  assert.equal(sha256Base64, hashSha256Base64);
  assert.equal(buildCsp, constructCsp);
  assert.equal(buildMetaCsp, metaCsp);
});
