// Tests pour #232 — Bloc "Badges README" sur dashboard/index.html

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blocBadgesReadme, snippetMarkdown,
  readmeBadgesBlock, markdownSnippet,
} from '../lib/dashboard/badges-block.js';

test('snippetMarkdown — défaut "dashboard/"', () => {
  const s = snippetMarkdown();
  assert.match(s, /!\[Santé AIAD SDD\]\(dashboard\/badge\.svg\)/);
  assert.match(s, /!\[Maturité AIAD\]\(dashboard\/badge-maturite\.svg\)/);
  assert.match(s, /!\[Violations Tier 1\]\(dashboard\/badge-violations\.svg\)/);
});

test('snippetMarkdown — baseUrl custom (publication Pages)', () => {
  const s = snippetMarkdown('https://example.com/badges/');
  assert.match(s, /https:\/\/example\.com\/badges\/badge\.svg/);
});

test('blocBadgesReadme — données absentes → chaîne vide (fail-safe)', () => {
  assert.equal(blocBadgesReadme(null), '');
  assert.equal(blocBadgesReadme({}), '');
});

test('blocBadgesReadme — santé présente → bloc HTML complet', () => {
  const donnees = { santeGlobale: { score: 75, niveau: 'sain' } };
  const html = blocBadgesReadme(donnees);
  assert.match(html, /<section class="badges-readme"/);
  assert.match(html, /Badges README/);
  assert.match(html, /badge\.svg/);
  assert.match(html, /badge-maturite\.svg/);
  assert.match(html, /badge-violations\.svg/);
  assert.match(html, /<details>/);
  assert.match(html, /Voir le snippet Markdown/);
});

test('blocBadgesReadme — alt text accessibles sur <img>', () => {
  const donnees = { santeGlobale: { score: 80, niveau: 'sain' } };
  const html = blocBadgesReadme(donnees);
  assert.match(html, /alt="Santé AIAD SDD"/);
  assert.match(html, /alt="Maturité AIAD"/);
  assert.match(html, /alt="Violations Tier 1"/);
});

test('blocBadgesReadme — loading="lazy" pour perf', () => {
  const donnees = { santeGlobale: { score: 80, niveau: 'sain' } };
  const html = blocBadgesReadme(donnees);
  assert.match(html, /loading="lazy"/);
});

test('blocBadgesReadme — baseUrl custom dans <img>', () => {
  const donnees = { santeGlobale: { score: 80 } };
  const html = blocBadgesReadme(donnees, { baseUrl: 'assets/' });
  assert.match(html, /src="assets\/badge\.svg"/);
});

test('blocBadgesReadme — escape XML strict (anti-XSS)', () => {
  const donnees = { santeGlobale: { score: 80 } };
  // baseUrl avec caractère HTML — doit être échappé
  const html = blocBadgesReadme(donnees, { baseUrl: '"><script>' });
  assert.doesNotMatch(html, /<script>/);
});

test('Alias EN canoniques', () => {
  assert.equal(readmeBadgesBlock, blocBadgesReadme);
  assert.equal(markdownSnippet, snippetMarkdown);
});
