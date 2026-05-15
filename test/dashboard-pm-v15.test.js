// Tests #462 / #463 / #464 — Boucle 15 PM cockpit onboarding/suggestions/heatmap

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  blocOnboardingTour, blocOnboardingTourReplay, TOUR_STEPS,
  onboardingTourOverlay, onboardingTourReplaySection,
} from '../lib/dashboard/onboarding-tour.js';

import {
  calculerSuggestions, blocSmartSuggestions,
  computeSmartSuggestions, smartSuggestionsSection,
} from '../lib/dashboard/smart-suggestions.js';

import {
  calculerActivityHeatmap, blocActivityHeatmap,
  computeActivityHeatmap, activityHeatmapSection,
} from '../lib/dashboard/activity-heatmap.js';

const days = (n) => n * 24 * 3600 * 1000;

// ─── #462 — Onboarding tour ─────────────────────────────────────────────────

test('blocOnboardingTour — overlay + script avec localStorage flag', () => {
  const html = blocOnboardingTour();
  assert.ok(html.includes('id="pm-tour-overlay"'));
  assert.ok(html.includes('aiad-pm-tour-seen'));
  assert.ok(html.includes('localStorage'));
  assert.ok(html.includes('addEventListener'));
});

test('blocOnboardingTour — 5 étapes JSON-encodées', () => {
  const html = blocOnboardingTour();
  assert.ok(html.includes('Bienvenue dans le Cockpit PM'));
  assert.ok(html.includes('Échéances Intent'));
  assert.ok(html.includes('Top priorités'));
  assert.ok(html.includes('Roadmap & Capacity'));
  assert.ok(html.includes('Brief PM'));
});

test('blocOnboardingTour — gère Esc pour fermer', () => {
  const html = blocOnboardingTour();
  assert.ok(html.includes("Escape"));
});

test('blocOnboardingTourReplay — bouton rejouer + section', () => {
  const html = blocOnboardingTourReplay();
  assert.ok(html.includes("Tour d'introduction PM"));
  assert.ok(html.includes('id="pm-tour-replay"'));
  assert.ok(html.includes('Rejouer le tour'));
});

test('TOUR_STEPS — 5 étapes définies', () => {
  assert.equal(TOUR_STEPS.length, 5);
  for (const e of TOUR_STEPS) {
    assert.ok(e.titre);
    assert.ok(e.desc);
  }
});

// ─── #463 — Smart suggestions ───────────────────────────────────────────────

test('calculerSuggestions — cluster OKR partagé', () => {
  const d = { intents: [
    { id: 'A', titre: 'X', statut: 'active', okr: 'KR-1.2' },
    { id: 'B', titre: 'Y', statut: 'draft', okr: 'KR-1.2' },
    { id: 'C', titre: 'Z', statut: 'active', okr: 'KR-1.3' },
  ]};
  const r = calculerSuggestions(d);
  const cluster = r.clusters.find((c) => c.type === 'okr' && c.cle === 'KR-1.2');
  assert.ok(cluster);
  assert.equal(cluster.intents.length, 2);
});

test('calculerSuggestions — cluster persona partagé', () => {
  const d = { intents: [
    { id: 'A', statut: 'active', personas: ['Marketing EU'] },
    { id: 'B', statut: 'draft', personas: ['Marketing EU'] },
    { id: 'C', statut: 'active', personas: ['RSSI'] },
  ]};
  const r = calculerSuggestions(d);
  const cluster = r.clusters.find((c) => c.type === 'persona' && c.cle === 'Marketing EU');
  assert.ok(cluster);
  assert.equal(cluster.intents.length, 2);
});

test('calculerSuggestions — cluster tag (≥ 3 Intents avec ≥ 2 tags communs)', () => {
  const d = { intents: [
    { id: 'A', statut: 'active', tags: ['mobile', 'q3', 'growth'] },
    { id: 'B', statut: 'draft', tags: ['mobile', 'q3', 'rgpd'] },
    { id: 'C', statut: 'active', tags: ['mobile', 'q3', 'paiement'] },
    { id: 'D', statut: 'draft', tags: ['mobile'] },
  ]};
  const r = calculerSuggestions(d);
  const cluster = r.clusters.find((c) => c.type === 'tag');
  assert.ok(cluster);
  assert.equal(cluster.intents.length, 3);
  assert.ok(cluster.cle.includes('mobile'));
  assert.ok(cluster.cle.includes('q3'));
});

test('calculerSuggestions — doublon potentiel via tokens significatifs', () => {
  const d = { intents: [
    { id: 'A', titre: 'Conversion checkout paiement mobile rapide', statut: 'active',
      sections: { objectif: 'Améliorer conversion checkout paiement mobile rapide SEPA' } },
    { id: 'B', titre: 'Mobile paiement rapide checkout conversion', statut: 'draft',
      sections: { objectif: 'Mobile paiement rapide checkout conversion mesure' } },
  ]};
  const r = calculerSuggestions(d);
  const cluster = r.clusters.find((c) => c.type === 'doublon');
  assert.ok(cluster);
  assert.equal(cluster.intents.length, 2);
});

test('calculerSuggestions — exclut done/archived', () => {
  const d = { intents: [
    { id: 'A', statut: 'done', okr: 'KR-1' },
    { id: 'B', statut: 'archived', okr: 'KR-1' },
  ]};
  const r = calculerSuggestions(d);
  assert.equal(r.clusters.length, 0);
});

test('calculerSuggestions — totaux par type', () => {
  const d = { intents: [
    { id: 'A', statut: 'active', okr: 'KR-1', personas: ['P1'] },
    { id: 'B', statut: 'active', okr: 'KR-1', personas: ['P1'] },
  ]};
  const r = calculerSuggestions(d);
  assert.equal(r.totaux.okr, 1);
  assert.equal(r.totaux.persona, 1);
  assert.equal(r.totaux.total, 2);
});

test('blocSmartSuggestions — empty si zéro cluster', () => {
  const html = blocSmartSuggestions({ smartSuggestions: { clusters: [], totaux: {} } });
  assert.ok(html.includes('aucune'));
});

test('blocSmartSuggestions — rend cards avec badges par type', () => {
  const html = blocSmartSuggestions({ smartSuggestions: {
    clusters: [
      { type: 'doublon', cle: 'paiement, mobile', intents: [{ id: 'A', titre: 't', file: null, statut: 'active' }, { id: 'B', titre: 't', file: null, statut: 'draft' }], action: 'fusion possible' },
      { type: 'okr', cle: 'KR-1.2', intents: [{ id: 'X', titre: 't', file: null, statut: 'active' }, { id: 'Y', titre: 't', file: null, statut: 'draft' }], action: 'revue conjointe' },
    ],
    totaux: { total: 2, doublon: 1, okr: 1, persona: 0, tag: 0 },
  }});
  assert.ok(html.includes('Suggestions de rapprochement'));
  assert.ok(html.includes('type-doublon'));
  assert.ok(html.includes('type-okr'));
  assert.ok(html.includes('paiement, mobile'));
  assert.ok(html.includes('KR-1.2'));
});

// ─── #464 — Activity heatmap ────────────────────────────────────────────────

test('calculerActivityHeatmap — compte par jour sur 60 derniers', () => {
  const now = Date.UTC(2026, 4, 15, 12, 0);
  const d = {
    intents: [
      { mtime: now }, // aujourd'hui
      { mtime: now - days(1) }, // hier
      { mtime: now - days(1) }, // hier (2e)
    ],
    specs: [{ mtime: now - days(5) }],
    facts: [{ mtime: now - days(100) }], // hors fenêtre
  };
  const r = calculerActivityHeatmap(d, { now, nbJours: 60 });
  assert.equal(r.nbJours, 60);
  assert.equal(r.jours.length, 60);
  assert.equal(r.total, 4, '3 intents + 1 spec dans la fenêtre');
  assert.equal(r.max, 2, 'hier = 2 modifications');
  assert.ok(r.streak >= 2, 'aujourd\'hui et hier actifs');
});

test('calculerActivityHeatmap — streak break sur 0 activité', () => {
  const now = Date.UTC(2026, 4, 15, 12, 0);
  const d = {
    intents: [
      { mtime: now - days(2) }, // avant-hier
    ],
  };
  const r = calculerActivityHeatmap(d, { now, nbJours: 60 });
  assert.equal(r.streak, 0, 'aujourd\'hui inactif → streak=0');
});

test('calculerActivityHeatmap — totaux activité 0', () => {
  const r = calculerActivityHeatmap({}, { now: Date.now(), nbJours: 30 });
  assert.equal(r.total, 0);
  assert.equal(r.joursActifs, 0);
  assert.equal(r.streak, 0);
  assert.equal(r.max, 0);
});

test('blocActivityHeatmap — message si zéro activité', () => {
  const html = blocActivityHeatmap({ activityHeatmap: { total: 0, nbJours: 60, jours: [] } });
  assert.ok(html.includes('aucune activité'));
});

test('blocActivityHeatmap — grille + légende + stats', () => {
  const now = Date.now();
  const r = calculerActivityHeatmap({
    intents: [{ mtime: now }, { mtime: now - days(2) }],
  }, { now, nbJours: 14 });
  const html = blocActivityHeatmap({ activityHeatmap: r });
  assert.ok(html.includes('Heatmap activité PM'));
  assert.ok(html.includes('heat-grid'));
  assert.ok(html.includes('heat-cell'));
  assert.ok(html.includes('Moins'));
  assert.ok(html.includes('Plus'));
  assert.ok(html.includes('streak'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof onboardingTourOverlay, 'function');
  assert.equal(typeof onboardingTourReplaySection, 'function');
  assert.equal(typeof computeSmartSuggestions, 'function');
  assert.equal(typeof smartSuggestionsSection, 'function');
  assert.equal(typeof computeActivityHeatmap, 'function');
  assert.equal(typeof activityHeatmapSection, 'function');
});
