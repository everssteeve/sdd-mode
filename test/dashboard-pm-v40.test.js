// Tests #537 / #538 / #539 — Boucle 40 PM portfolio-diversity/dow-heatmap/pr-template

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  entropieShannon, calculerPortfolioDiversity, blocPortfolioDiversity,
  shannonEntropy, computePortfolioDiversity, portfolioDiversitySection,
} from '../lib/dashboard/portfolio-diversity.js';

import {
  calculerDowHeatmap, blocDowHeatmap,
  computeDowHeatmap, dowHeatmapSection,
} from '../lib/dashboard/dow-heatmap.js';

import {
  calculerPrTemplate, blocPrTemplate,
  computePrTemplate, prTemplateSection,
} from '../lib/dashboard/pr-template.js';

const DAY = 24 * 3600 * 1000;

// ─── #537 — Portfolio diversity ─────────────────────────────────────────────

test('entropieShannon — équipartition → 1.0 normalisé', () => {
  const e = entropieShannon([5, 5]); // 50/50
  assert.equal(e.normalise, 1);
});

test('entropieShannon — mono-axe → 0', () => {
  const e = entropieShannon([10, 0, 0]);
  assert.equal(e.normalise, 0);
});

test('calculerPortfolioDiversity — calcule sur 3 dimensions', () => {
  const r = calculerPortfolioDiversity({
    intents: [
      { id: 'A', statut: 'active', tags: ['x', 'y'], owner: 'Alice', sponsor: 'Sales' },
      { id: 'B', statut: 'active', tags: ['x'], owner: 'Alice', sponsor: 'Marketing' },
      { id: 'C', statut: 'active', tags: ['z'], owner: 'Bob', sponsor: 'Sales' },
      { id: 'D', statut: 'done', tags: ['x'], owner: 'Alice', sponsor: 'Sales' }, // exclu
    ],
  });
  assert.equal(r.nbActifs, 3);
  assert.ok(r.dimensions.tags.normalise > 0);
  assert.ok(r.dimensions.owners.normalise > 0);
  assert.ok(r.dimensions.sponsors.normalise > 0);
});

test('calculerPortfolioDiversity — empty si zéro actif', () => {
  const r = calculerPortfolioDiversity({});
  assert.equal(r.nbActifs, 0);
});

test('blocPortfolioDiversity — empty + rendu cards', () => {
  assert.ok(blocPortfolioDiversity({ portfolioDiversity: { nbActifs: 0, dimensions: {} }}).includes('aucun Intent actif'));
  const html = blocPortfolioDiversity({ portfolioDiversity: {
    nbActifs: 3,
    dimensions: {
      tags: { normalise: 0.9, etat: 'uniforme', top: [{ valeur: 'x', count: 2 }], total: 2 },
      owners: { normalise: 0.3, etat: 'mono-axe', top: [{ valeur: 'Alice', count: 3 }], total: 1 },
      sponsors: { normalise: 0.65, etat: 'diversifie', top: [], total: 2 },
    },
  }});
  assert.ok(html.includes('Diversité du portefeuille'));
  assert.ok(html.includes('e-uniforme'));
  assert.ok(html.includes('e-mono-axe'));
});

// ─── #538 — DoW heatmap ─────────────────────────────────────────────────────

test('calculerDowHeatmap — distribue par jour de semaine', () => {
  const lundi = Date.UTC(2026, 4, 11); // lundi 2026-05-11
  const r = calculerDowHeatmap({
    intents: [{ mtime: lundi }],
    specs: [{ mtime: lundi }, { mtime: Date.UTC(2026, 4, 17) }], // dim
  }, { now: Date.UTC(2026, 4, 20), fenetreJours: 90 });
  assert.equal(r.buckets[0].total, 2); // lundi
  assert.equal(r.buckets[6].total, 1); // dimanche
});

test('calculerDowHeatmap — empty + fenêtre par défaut', () => {
  const r = calculerDowHeatmap({});
  assert.equal(r.total, 0);
  assert.equal(r.fenetreJours, 90);
});

test('blocDowHeatmap — empty + rendu cells + weekend alert', () => {
  assert.ok(blocDowHeatmap({ dowHeatmap: { total: 0, fenetreJours: 90, buckets: [], maxTotal: 1 }}).includes('aucune activité'));
  const html = blocDowHeatmap({ dowHeatmap: {
    buckets: [
      { jour: 'Lun', idx: 0, total: 0, intents: 0, specs: 0 },
      { jour: 'Mar', idx: 1, total: 0, intents: 0, specs: 0 },
      { jour: 'Mer', idx: 2, total: 1, intents: 1, specs: 0 },
      { jour: 'Jeu', idx: 3, total: 0, intents: 0, specs: 0 },
      { jour: 'Ven', idx: 4, total: 0, intents: 0, specs: 0 },
      { jour: 'Sam', idx: 5, total: 5, intents: 3, specs: 2 },
      { jour: 'Dim', idx: 6, total: 5, intents: 2, specs: 3 },
    ],
    total: 11, maxTotal: 5, weekend: 10, semaine: 1, fenetreJours: 90,
    pourcentageWeekend: 90, plusActif: 'Sam',
  }});
  assert.ok(html.includes('Heatmap activité par jour'));
  assert.ok(html.includes('weekend-heavy'));
  assert.ok(html.includes('Sam'));
});

// ─── #539 — PR template ─────────────────────────────────────────────────────

test('calculerPrTemplate — génère pour actifs avec SPECs', () => {
  const r = calculerPrTemplate({
    intents: [
      { id: 'INTENT-101', titre: 't', statut: 'active', governance: 'AIAD-RGPD', sections: { objectif: 'foo bar' }},
      { id: 'INTENT-102', statut: 'done' }, // exclu
      { id: 'INTENT-103', statut: 'active' }, // pas de SPEC
    ],
    specs: [
      { id: 'SPEC-101-1', parentIntent: 'INTENT-101', statut: 'in-progress' },
    ],
  });
  assert.equal(r.templates.length, 1);
  assert.equal(r.templates[0].id, 'INTENT-101');
  assert.ok(r.templates[0].texte.includes('@intent INTENT-101'));
  assert.ok(r.templates[0].texte.includes('SPEC-101-1'));
  assert.ok(r.templates[0].texte.includes('AIAD-RGPD'));
});

test('calculerPrTemplate — empty si aucun actif avec SPEC', () => {
  const r = calculerPrTemplate({});
  assert.equal(r.templates.length, 0);
});

test('blocPrTemplate — empty + rendu + script copier', () => {
  assert.ok(blocPrTemplate({ prTemplate: { templates: [], totaux: { total: 0, avecGouv: 0 }}}).includes('aucun Intent actif avec SPEC'));
  const html = blocPrTemplate({ prTemplate: {
    templates: [{ id: 'A', titre: 't', file: null, texte: '## Summary', gouvernances: ['AIAD-RGPD'], nbSpecs: 2 }],
    totaux: { total: 1, avecGouv: 1 },
  }});
  assert.ok(html.includes('Templates PR par Intent'));
  assert.ok(html.includes('has-gouv'));
  assert.ok(html.includes('data-pt-action="copy"'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof shannonEntropy, 'function');
  assert.equal(typeof computePortfolioDiversity, 'function');
  assert.equal(typeof portfolioDiversitySection, 'function');
  assert.equal(typeof computeDowHeatmap, 'function');
  assert.equal(typeof dowHeatmapSection, 'function');
  assert.equal(typeof computePrTemplate, 'function');
  assert.equal(typeof prTemplateSection, 'function');
});
