// Tests #534 / #535 / #536 — Boucle 39 PM quarterly-retro-draft/prd-coverage-gaps/spec-annotation-coverage

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  calculerQuarterlyRetroDraft, blocQuarterlyRetroDraft,
  computeQuarterlyRetroDraft, quarterlyRetroDraftSection,
} from '../lib/dashboard/quarterly-retro-draft.js';

import {
  calculerPrdCoverageGaps, blocPrdCoverageGaps,
  computePrdCoverageGaps, prdCoverageGapsSection,
} from '../lib/dashboard/prd-coverage-gaps.js';

import {
  calculerSpecAnnotationCoverage, blocSpecAnnotationCoverage,
  computeSpecAnnotationCoverage, specAnnotationCoverageSection, REQUIRED_TAGS,
} from '../lib/dashboard/spec-annotation-coverage.js';

const DAY = 24 * 3600 * 1000;

// ─── #534 — Quarterly retro draft ───────────────────────────────────────────

test('calculerQuarterlyRetroDraft — assemble Markdown 5 sections', () => {
  const now = Date.UTC(2026, 4, 15);
  const r = calculerQuarterlyRetroDraft({
    intents: [{ id: 'A', statut: 'archived', mtime: now - 30 * DAY, titre: 'archive' }],
    specs: [{ id: 'SPEC-A', statut: 'done', mtime: now - 20 * DAY, titre: 'livré' }],
    velocityForecast: { rythmeMoyen: 1.5, reg: { slope: 0.1 }},
    throughputTrend: { cumul: { intake: 5, delivery: 3 }, nbSem: 6, direction: 'gonfle' },
    santeGlobale: { score: 75, niveau: 'bon' },
    hypothesisLifecycle: { totaux: { total: 3, validated: 1, invalidated: 0, partial: 1 }, tauxValidation: 33, stagnantes: 0 },
    risks: { intents: [{ id: 'INTENT-X', niveau: 'high', titre: 'risk' }]},
  }, { now });
  assert.match(r.trim, /^Q2-2026$/);
  assert.ok(r.texte.includes('# Rétrospective Q2-2026'));
  assert.ok(r.texte.includes('SPECs livrées (1)'));
  assert.ok(r.texte.includes('Intents archivés (1)'));
  assert.ok(r.texte.includes('1.5 SPECs/sem'));
  assert.ok(r.texte.includes('75/100'));
  assert.ok(r.texte.includes('Hypothèses'));
  assert.ok(r.texte.includes('Risques marquants'));
  assert.ok(r.texte.includes('INTENT-X'));
  assert.equal(r.meta.specsLivrees, 1);
});

test('calculerQuarterlyRetroDraft — empty avec messages contextuels', () => {
  const r = calculerQuarterlyRetroDraft({});
  assert.ok(r.texte.includes('Aucune livraison'));
  assert.ok(r.texte.includes('Aucune hypothèse'));
  assert.ok(r.texte.includes('Aucun risque'));
});

test('blocQuarterlyRetroDraft — rendu + copier', () => {
  const html = blocQuarterlyRetroDraft({ quarterlyRetroDraft: {
    trim: 'Q2-2026', texte: '# Rétro\n- foo',
    meta: { specsLivrees: 5, intentsArchives: 2, hypotheses: 3, risques: 1 },
  }});
  assert.ok(html.includes('Brouillon rétro trimestrielle'));
  assert.ok(html.includes('Q2-2026'));
  assert.ok(html.includes('data-qr-action="copy"'));
  assert.ok(html.includes('navigator.clipboard'));
});

// ─── #535 — PRD coverage gaps ───────────────────────────────────────────────

test('calculerPrdCoverageGaps — détecte outcomes sans intent', () => {
  const r = calculerPrdCoverageGaps({
    prdCoverage: { outcomes: [
      { titre: 'O1', intents: [{ id: 'A' }] },
      { titre: 'O2', intents: [] },
      { titre: 'O3' }, // no intents prop
    ]},
  });
  assert.equal(r.outcomesSansIntent.length, 2);
});

test('calculerPrdCoverageGaps — détecte personas sans intent', () => {
  const r = calculerPrdCoverageGaps({
    intents: [{ id: 'A', personas: ['PM EU'] }],
    prdCoverage: { personas: { personas: [{ nom: 'PM EU' }, { nom: 'Dev' }] }},
  });
  assert.equal(r.personasSansIntent.length, 1);
  assert.equal(r.personasSansIntent[0].nom, 'Dev');
});

test('calculerPrdCoverageGaps — détecte user stories sans intent', () => {
  const r = calculerPrdCoverageGaps({
    intents: [{ id: 'A', user_stories: ['US-001'] }],
    prdCoverage: { userStories: [{ id: 'US-001' }, { id: 'US-002' }]},
  });
  assert.equal(r.usSansIntent.length, 1);
});

test('blocPrdCoverageGaps — empty cible + couverture complète', () => {
  assert.ok(blocPrdCoverageGaps({ prdCoverageGaps: { totaux: { outcomesDeclares: 0, personasDeclares: 0, usDeclares: 0, total: 0 }}}).includes('aucune cible déclarée'));
  assert.ok(blocPrdCoverageGaps({ prdCoverageGaps: { totaux: { outcomesDeclares: 1, personasDeclares: 1, usDeclares: 0, total: 0 }, outcomesSansIntent: [], personasSansIntent: [], usSansIntent: [] }}).includes('couverture complète'));
});

test('blocPrdCoverageGaps — rendu avec gaps', () => {
  const html = blocPrdCoverageGaps({ prdCoverageGaps: {
    outcomesSansIntent: [{ titre: 'O orphan', target: 'Q2' }],
    personasSansIntent: [],
    usSansIntent: [],
    totaux: { outcomesDeclares: 2, outcomesSansIntent: 1, personasDeclares: 1, personasSansIntent: 0, usDeclares: 0, usSansIntent: 0, total: 1 },
  }});
  assert.ok(html.includes('Trous de couverture PRD'));
  assert.ok(html.includes('has-gap'));
  assert.ok(html.includes('O orphan'));
});

// ─── #536 — Spec annotation coverage ────────────────────────────────────────

test('calculerSpecAnnotationCoverage — compte 4 tags', () => {
  const r = calculerSpecAnnotationCoverage({
    specs: [
      { id: 'A', body: '@intent INTENT-001\n@spec SPEC-001-1-x\n@verified-by tests/x.test.js\n@governance AIAD-RGPD' },
      { id: 'B', body: '@spec SPEC-002-1-y' },
      { id: 'C', body: 'no tags' },
    ],
  });
  const a = r.items.find((i) => i.id === 'A');
  assert.equal(a.nbTags, 4);
  assert.equal(a.pct, 100);
  assert.equal(a.etat, 'complet');
  const b = r.items.find((i) => i.id === 'B');
  assert.equal(b.nbTags, 1);
  assert.equal(b.etat, 'debut');
  const c = r.items.find((i) => i.id === 'C');
  assert.equal(c.nbTags, 0);
  assert.equal(c.etat, 'vide');
});

test('calculerSpecAnnotationCoverage — totaux et tags', () => {
  const r = calculerSpecAnnotationCoverage({
    specs: [
      { id: 'A', body: '@intent X\n@spec Y' },
      { id: 'B', body: '@intent X\n@spec Y\n@verified-by z' },
    ],
  });
  assert.equal(r.totaux.total, 2);
  assert.equal(r.totaux.tags['@intent'], 2);
  assert.equal(r.totaux.tags['@verified-by'], 1);
  assert.equal(r.totaux.tags['@governance'], 0);
});

test('blocSpecAnnotationCoverage — empty + rendu', () => {
  assert.ok(blocSpecAnnotationCoverage({ specAnnotationCoverage: { items: [], totaux: { total: 0 }, seuilTags: REQUIRED_TAGS }}).includes('aucune SPEC'));
  const html = blocSpecAnnotationCoverage({ specAnnotationCoverage: {
    items: [{ id: 'A', titre: 't', file: null, statut: 'done', tags: { '@intent': 1, '@spec': 1, '@verified-by': 0, '@governance': 0 }, nbTags: 2, pct: 50, etat: 'partiel' }],
    totaux: { total: 1, complet: 0, avance: 0, partiel: 1, debut: 0, vide: 0, tags: { '@intent': 1, '@spec': 1, '@verified-by': 0, '@governance': 0 }, scoreMoyen: 50 },
    seuilTags: REQUIRED_TAGS,
  }});
  assert.ok(html.includes('Couverture annotations SPEC'));
  assert.ok(html.includes('e-partiel'));
  assert.ok(html.includes('@intent'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeQuarterlyRetroDraft, 'function');
  assert.equal(typeof quarterlyRetroDraftSection, 'function');
  assert.equal(typeof computePrdCoverageGaps, 'function');
  assert.equal(typeof prdCoverageGapsSection, 'function');
  assert.equal(typeof computeSpecAnnotationCoverage, 'function');
  assert.equal(typeof specAnnotationCoverageSection, 'function');
  assert.equal(REQUIRED_TAGS.length, 4);
});
