// Tests pour #249 — Dashboard 404 page

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageNotFound, renderNotFound } from '../lib/dashboard/notfound.js';

test('pageNotFound — produit HTML stylisé avec 404 + nav', () => {
  const html = pageNotFound({ projet: { nom: 'demo' } });
  assert.match(html, /404/);
  assert.match(html, /Page introuvable/);
  // Lien retour à la vue d'ensemble
  assert.match(html, /href="index\.html"/);
  // Mentionne le nom du projet
  assert.match(html, /demo/);
});

test('pageNotFound — fallback "projet" si nom absent', () => {
  const html = pageNotFound({});
  assert.match(html, /projet/);
});

test('pageNotFound — escape XML (anti-XSS sur nom projet)', () => {
  const html = pageNotFound({ projet: { nom: '<script>alert(1)</script>' } });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('pageNotFound — bouton accent utilise CSS variable', () => {
  const html = pageNotFound({ projet: { nom: 'x' } });
  assert.match(html, /background:var\(--accent\)/);
});

test('Alias EN', () => {
  assert.equal(renderNotFound, pageNotFound);
});
