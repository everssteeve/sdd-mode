// Tests #447 / #448 / #449 — Boucle 10 PM cockpit print/capture/flow :
//   - mode impression / PDF COMEX
//   - wizard de capture d'Intent
//   - cumulative flow diagram

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { blocPrintMode, printModeSection } from '../lib/dashboard/print-mode.js';

import {
  blocQuickCapture, quickCaptureSection, suggestNextIntentId,
} from '../lib/dashboard/quick-capture.js';

import {
  compterParStatut, calculerCumulativeFlow, blocCumulativeFlow,
  countByStatus, computeCumulativeFlow, cumulativeFlowSection,
} from '../lib/dashboard/cumulative-flow.js';

// ─── #447 — Print mode ──────────────────────────────────────────────────────

test('blocPrintMode — rend bouton + CSS @media print + script ?print=1', () => {
  const html = blocPrintMode({ projet: { nom: 'MonProjet' } });
  assert.ok(html.includes('Imprimer / PDF'));
  assert.ok(html.includes('@media print'));
  assert.ok(html.includes('pm-print-btn'));
  assert.ok(html.includes('window.print()'));
  assert.ok(html.includes("params.get('print')"));
  assert.ok(html.includes('aiad-print'));
  assert.ok(html.includes('MonProjet'));
});

test('blocPrintMode — masque TOC + sticky + boutons en print', () => {
  const html = blocPrintMode({});
  // CSS print masque les éléments interactifs
  assert.ok(html.match(/\.pm-toc[^{]*\{[^}]*display:\s*none/i));
  assert.ok(html.match(/\.pm-sticky-alerts[^{]*\{[^}]*display:\s*none/i));
  assert.ok(html.match(/\.csv-btn[^{]*\{[^}]*display:\s*none/i));
});

// ─── #448 — Quick capture ───────────────────────────────────────────────────

test('suggestNextIntentId — calcule prochain INTENT-NNN', () => {
  assert.equal(suggestNextIntentId({ intents: [] }), 'INTENT-001');
  assert.equal(suggestNextIntentId({ intents: [
    { id: 'INTENT-007' }, { id: 'INTENT-101-slug' },
  ]}), 'INTENT-102');
  assert.equal(suggestNextIntentId({ intents: [{ id: 'INTENT-999' }] }), 'INTENT-1000');
});

test('blocQuickCapture — formulaire 5 sections + boutons copier', () => {
  const html = blocQuickCapture({ intents: [{ id: 'INTENT-042' }] });
  assert.ok(html.includes('Capturer un nouvel Intent'));
  // 5 sections canoniques
  assert.ok(html.includes('POURQUOI MAINTENANT'));
  assert.ok(html.includes('POUR QUI'));
  assert.ok(html.includes('OBJECTIF'));
  assert.ok(html.includes('CONTRAINTES'));
  assert.ok(html.includes('CRITÈRE DE DRIFT'));
  // ID suggéré
  assert.ok(html.includes('INTENT-043'));
  // Tabs + onglets
  assert.ok(html.includes('data-tab="md"'));
  assert.ok(html.includes('data-tab="cli"'));
  // Boutons copier
  assert.ok(html.includes('Copier Markdown'));
  assert.ok(html.includes('Copier commande shell'));
  // Script génération
  assert.ok(html.includes('readVal'));
  assert.ok(html.includes('slugify'));
  assert.ok(html.includes('AIAD_INTENT_EOF'));
});

test('blocQuickCapture — Aliases EN sortis', () => {
  assert.equal(typeof quickCaptureSection, 'function');
});

// ─── #449 — Cumulative Flow Diagram ─────────────────────────────────────────

test('compterParStatut — compte chaque statut avec fallback unknown', () => {
  const snap = { data: { intents: [
    { statut: 'draft' }, { statut: 'active' }, { statut: 'active' },
    { statut: 'done' }, { statut: 'WAT' },
  ]}};
  const r = compterParStatut(snap);
  assert.equal(r.draft, 1);
  assert.equal(r.active, 2);
  assert.equal(r.done, 1);
  assert.equal(r.unknown, 1);
  assert.equal(r.archived, 0);
});

test('calculerCumulativeFlow — < 2 snapshots → vide', () => {
  const r = calculerCumulativeFlow('/tmp', {}, { lecteur: () => [] });
  assert.equal(r.snapshots, 0);
  assert.equal(r.points.length, 0);
});

test('calculerCumulativeFlow — points + statuts présents seulement', () => {
  const r = calculerCumulativeFlow('/tmp', {}, { lecteur: () => [
    { date: '2026-05-10', data: { intents: [{ statut: 'draft' }, { statut: 'draft' }] } },
    { date: '2026-05-15', data: { intents: [{ statut: 'draft' }, { statut: 'active' }] } },
  ]});
  assert.equal(r.snapshots, 2);
  assert.equal(r.points.length, 2);
  assert.deepEqual(r.statuts, ['draft', 'active']);
  assert.equal(r.points[0].par.draft, 2);
  assert.equal(r.points[1].par.active, 1);
});

test('blocCumulativeFlow — message minimum 2 si 1 snapshot', () => {
  const html = blocCumulativeFlow({ cumulativeFlow: { snapshots: 1, points: [], statuts: [] } });
  assert.ok(html.includes('minimum 2 requis'));
});

test('blocCumulativeFlow — SVG + légende + table avec polygones par statut', () => {
  const html = blocCumulativeFlow({ cumulativeFlow: {
    snapshots: 2,
    statuts: ['draft', 'active'],
    points: [
      { date: '2026-05-10', par: { draft: 3, active: 0, done: 0, archived: 0 } },
      { date: '2026-05-15', par: { draft: 1, active: 2, done: 0, archived: 0 } },
    ],
  }});
  assert.ok(html.includes('Cumulative Flow Diagram'));
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('polygon'));
  assert.ok(html.includes('cfd-legend'));
  assert.ok(html.includes('cfd-table'));
  // Couleurs draft + active
  assert.ok(html.includes('#fab005')); // draft
  assert.ok(html.includes('#4c6ef5')); // active
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof printModeSection, 'function');
  assert.equal(typeof quickCaptureSection, 'function');
  assert.equal(typeof countByStatus, 'function');
  assert.equal(typeof computeCumulativeFlow, 'function');
  assert.equal(typeof cumulativeFlowSection, 'function');
});
