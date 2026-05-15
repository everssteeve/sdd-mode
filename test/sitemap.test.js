// Tests pour #239 — sitemap.xml + robots.txt

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  genererSitemap, genererRobots,
  generateSitemap, generateRobots,
} from '../lib/dashboard/sitemap.js';

const PAGES = [
  { slug: 'index', titre: 'Vue', file: 'index.html' },
  { slug: 'qa', titre: 'QA', file: 'qa.html' },
];

test('genererSitemap — XML conforme sitemaps.org', () => {
  const s = genererSitemap(PAGES, 'https://x.com/d', '2026-05-13');
  assert.match(s, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(s, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(s, /<loc>https:\/\/x\.com\/d\/index\.html<\/loc>/);
  assert.match(s, /<loc>https:\/\/x\.com\/d\/qa\.html<\/loc>/);
  assert.match(s, /<lastmod>2026-05-13<\/lastmod>/);
  assert.match(s, /<changefreq>weekly<\/changefreq>/);
});

test('genererSitemap — index a priority 1.0, autres 0.7', () => {
  const s = genererSitemap(PAGES, 'https://x.com/d', '2026-05-13');
  // Compte les occurrences distinctes
  const p10 = (s.match(/<priority>1\.0<\/priority>/g) || []).length;
  const p07 = (s.match(/<priority>0\.7<\/priority>/g) || []).length;
  assert.equal(p10, 1);
  assert.equal(p07, 1);
});

test('genererSitemap — baseUrl trailing slash strippé', () => {
  const s = genererSitemap(PAGES, 'https://x.com/d//', '2026-05-13');
  assert.match(s, /<loc>https:\/\/x\.com\/d\/index\.html<\/loc>/);
  assert.doesNotMatch(s, /\/\/index\.html/);
});

test('genererSitemap — baseUrl vide → URLs relatives', () => {
  const s = genererSitemap(PAGES, '', '2026-05-13');
  assert.match(s, /<loc>\/index\.html<\/loc>/);
});

test('genererSitemap — lastmod défaut = aujourd\'hui', () => {
  const s = genererSitemap(PAGES, 'https://x.com');
  const today = new Date().toISOString().slice(0, 10);
  assert.match(s, new RegExp(`<lastmod>${today}</lastmod>`));
});

test('genererSitemap — escape XML strict', () => {
  const pages = [{ file: 'a&b.html' }];
  const s = genererSitemap(pages, 'https://x.com');
  assert.match(s, /a&amp;b\.html/);
});

test('genererRobots — allow-all + sitemap absolute', () => {
  const r = genererRobots('https://x.com/d');
  assert.match(r, /User-agent: \*/);
  assert.match(r, /Allow: \//);
  assert.match(r, /Sitemap: https:\/\/x\.com\/d\/sitemap\.xml/);
});

test('genererRobots — baseUrl vide → sitemap relatif', () => {
  const r = genererRobots('');
  assert.match(r, /Sitemap: sitemap\.xml/);
});

test('Alias EN', () => {
  assert.equal(generateSitemap, genererSitemap);
  assert.equal(generateRobots, genererRobots);
});
