// Tests pour #237 — Favicon dashboard

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAVICON_SVG } from '../lib/dashboard/favicon.js';

test('FAVICON_SVG — est un SVG valide', () => {
  assert.match(FAVICON_SVG, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(FAVICON_SVG, /viewBox="0 0 32 32"/);
  assert.match(FAVICON_SVG, /<\/svg>/);
});

test('FAVICON_SVG — contient lettre A blanche sur fond accent', () => {
  // Lettre A centrée
  assert.match(FAVICON_SVG, /text-anchor="middle"/);
  assert.match(FAVICON_SVG, />A</);
  // Fond accent bleu
  assert.match(FAVICON_SVG, /fill="#2563eb"/);
  // Texte blanc
  assert.match(FAVICON_SVG, /fill="#ffffff"/);
});

test('FAVICON_SVG — zero deps réseau (pas de src/href externe)', () => {
  // L'attribut xmlns SVG est légitime (URN spec W3C), on exclut juste
  // les références ressource (src=/href= http(s)).
  assert.doesNotMatch(FAVICON_SVG, /(src|href)\s*=\s*["']https?:\/\//);
});

test('FAVICON_SVG — petit (< 500 octets) pour onglets', () => {
  assert.ok(FAVICON_SVG.length < 500, `taille ${FAVICON_SVG.length} > 500`);
});
