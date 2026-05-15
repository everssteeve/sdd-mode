// Tests pour #238 — Meta share tags dashboard

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  metaDescription, metaShareTags,
  buildMetaDescription, buildMetaShareTags,
} from '../lib/dashboard/meta-share.js';

const DONNEES_COMPLETES = {
  projet: { nom: 'demo-app' },
  maturite: { score: 5, total: 5 },
  santeGlobale: { score: 92, niveau: 'excellent' },
};

const DONNEES_MINIMALES = {
  projet: { nom: 'x' },
};

test('metaDescription — projet complet inclut santé + maturité', () => {
  const d = metaDescription(DONNEES_COMPLETES, 'Vue d\'ensemble', 'index');
  assert.match(d, /Vue d'ensemble/);
  assert.match(d, /index/);
  assert.match(d, /demo-app/);
  assert.match(d, /Santé 92\/100/);
  assert.match(d, /Maturité 5\/5/);
});

test('metaDescription — projet minimal sans santé ni maturité', () => {
  const d = metaDescription(DONNEES_MINIMALES, 'Vue', 'sous');
  assert.match(d, /Vue/);
  assert.match(d, /x/);
  assert.doesNotMatch(d, /Santé/);
  assert.doesNotMatch(d, /Maturité/);
});

test('metaDescription — projet sans nom → fallback "projet"', () => {
  const d = metaDescription({ projet: {} }, 'T', 's');
  assert.match(d, /projet/);
});

test('metaDescription — tronquée à 200 chars max (OG/Twitter limit)', () => {
  const titreLong = 'A'.repeat(300);
  const d = metaDescription(DONNEES_COMPLETES, titreLong, 'sous');
  assert.ok(d.length <= 200, `description trop longue : ${d.length}`);
  assert.match(d, /…$/);
});

test('metaShareTags — produit les 10 balises attendues', () => {
  const html = metaShareTags(DONNEES_COMPLETES, 'Vue d\'ensemble', 'index');
  // description SEO
  assert.match(html, /<meta name="description"/);
  // generator AIAD
  assert.match(html, /<meta name="generator" content="AIAD SDD Mode"/);
  // theme-color mobile
  assert.match(html, /<meta name="theme-color" content="#2563eb"/);
  // Open Graph (4 balises)
  assert.match(html, /property="og:type" content="website"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /property="og:description"/);
  assert.match(html, /property="og:image" content="badge\.svg"/);
  // Twitter Cards (3 balises)
  assert.match(html, /name="twitter:card" content="summary"/);
  assert.match(html, /name="twitter:title"/);
  assert.match(html, /name="twitter:description"/);
});

test('metaShareTags — echappe HTML (anti-XSS sur nom projet)', () => {
  const donnees = {
    projet: { nom: '<script>alert(1)</script>' },
    santeGlobale: { score: 50 },
  };
  const html = metaShareTags(donnees, 'T', 's');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('metaShareTags — themeColor custom respecté', () => {
  const html = metaShareTags(DONNEES_MINIMALES, 'T', 's', { themeColor: '#ff0000' });
  assert.match(html, /content="#ff0000"/);
});

// (#240) og:url + og:image absolute

test('metaShareTags — og:url et og:image relatifs sans publicUrl', () => {
  const html = metaShareTags(DONNEES_COMPLETES, 'Vue', 'index');
  assert.match(html, /property="og:url" content="index\.html"/);
  assert.match(html, /property="og:image" content="badge\.svg"/);
});

test('metaShareTags — og:url et og:image absolus si donnees.publicUrl set', () => {
  const d = { ...DONNEES_COMPLETES, publicUrl: 'https://aiad.ovh/d' };
  const html = metaShareTags(d, 'Vue', 'index');
  assert.match(html, /property="og:url" content="https:\/\/aiad\.ovh\/d\/index\.html"/);
  assert.match(html, /property="og:image" content="https:\/\/aiad\.ovh\/d\/badge\.svg"/);
});

test('metaShareTags — pageFile détermine og:url', () => {
  const d = { ...DONNEES_COMPLETES, publicUrl: 'https://x.com' };
  const html = metaShareTags(d, 'QA', null, { pageFile: 'qa.html' });
  assert.match(html, /property="og:url" content="https:\/\/x\.com\/qa\.html"/);
});

test('metaShareTags — trailing slash strippé sur publicUrl', () => {
  const d = { ...DONNEES_COMPLETES, publicUrl: 'https://x.com/d/' };
  const html = metaShareTags(d, 'V', null);
  assert.match(html, /og:url" content="https:\/\/x\.com\/d\/index\.html"/);
  assert.doesNotMatch(html, /com\/d\/\/index/);
});

test('Alias EN', () => {
  assert.equal(buildMetaDescription, metaDescription);
  assert.equal(buildMetaShareTags, metaShareTags);
});
