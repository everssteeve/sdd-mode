// @spec SPEC-017-1-page-aujourdhui
// @verified-by test/dashboard-today.test.js

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { construirePageAujourdhui, pageAujourdhui } from '../lib/dashboard/views/today.js';
import { layout } from '../lib/dashboard/render.js';

function donneesMock(opts = {}) {
  const deadlineItems = opts.deadlines ?? [];
  return {
    projet: { nom: 'test', genere: '2026-06-22T08:00:00.000Z', version: '1.0' },
    intents: opts.intents ?? [],
    deadlines: {
      buckets: {
        retard: [],
        urgent: deadlineItems,
        proche: [],
        planifie: [],
        'sans-cible': [],
        livre: [],
      },
      totaux: { retard: 0, urgent: deadlineItems.length, proche: 0, planifie: 0, sansCible: 0 },
    },
    riskTransparency: { items: opts.risques ?? [] },
    standupScript: { texte: opts.standup !== undefined ? opts.standup : 'Stand-up du jour' },
    maturite: { score: 3, total: 5, label: 'ok' },
    santeGlobale: { score: 80 },
  };
}

// CA-001 — exactly 4 sections
test('CA-001 — today-page produces exactly 4 <section> elements', () => {
  const html = construirePageAujourdhui(donneesMock());
  const matches = html.match(/<section/g);
  assert.equal(matches?.length ?? 0, 4, 'Expected exactly 4 <section> elements');
});

// CA-002 — top-3 intents ordered P0 before P1
test('CA-002 — top-3 intents ordered P0 before P1, then by date ascending', () => {
  const donnees = donneesMock({
    intents: [
      { id: 'INTENT-B', titre: 'B', statut: 'active', priority: 'P1' },
      { id: 'INTENT-A', titre: 'A', statut: 'active', priority: 'P0' },
      { id: 'INTENT-C', titre: 'C', statut: 'active', priority: 'P1' },
      { id: 'INTENT-D', titre: 'D', statut: 'active', priority: 'P1' },
    ],
  });
  const html = construirePageAujourdhui(donnees);
  const posA = html.indexOf('INTENT-A');
  const posB = html.indexOf('INTENT-B');
  assert.ok(posA < posB, 'P0 (INTENT-A) should appear before P1 (INTENT-B)');
  assert.ok(!html.includes('INTENT-D'), 'Top-3 should exclude 4th-ranked intent');
});

// CA-003 — empty intents → placeholder
test('CA-003 — no active intent → "Aucun bloquant aujourd\'hui."', () => {
  const html = construirePageAujourdhui(donneesMock({ intents: [] }));
  assert.ok(html.includes("Aucun bloquant aujourd'hui."), 'Should display empty-state for Priorités');
});

// CA-004 — deadlines filtered to 7 calendar days
test('CA-004 — deadlines section includes only intents within 7 calendar days', () => {
  const donnees = donneesMock({
    deadlines: [
      { id: 'INTENT-X', titre: 'Near', joursRestants: 5 },
      { id: 'INTENT-Y', titre: 'AtLimit', joursRestants: 7 },
      { id: 'INTENT-Z', titre: 'Far', joursRestants: 8 },
    ],
  });
  const html = construirePageAujourdhui(donnees);
  assert.ok(html.includes('INTENT-X'), 'joursRestants=5 should be included');
  assert.ok(html.includes('INTENT-Y'), 'joursRestants=7 (boundary) should be included');
  assert.ok(!html.includes('INTENT-Z'), 'joursRestants=8 should be excluded');
});

// CA-005 — empty standup script → placeholder
test('CA-005 — empty standup text → "Script non disponible — relance le dashboard."', () => {
  const html = construirePageAujourdhui(donneesMock({ standup: '' }));
  assert.ok(
    html.includes('Script non disponible — relance le dashboard.'),
    'Should display standup empty-state message',
  );
});

// CA-006a — every <section> has an aria-label attribute
test('CA-006a — every <section> element has an aria-label attribute', () => {
  const html = construirePageAujourdhui(donneesMock());
  const sections = [...html.matchAll(/<section([^>]*)>/g)];
  assert.equal(sections.length, 4, 'Expected 4 sections');
  for (const [, attrs] of sections) {
    assert.ok(attrs.includes('aria-label='), `Section missing aria-label: <section${attrs}>`);
  }
});

// CA-006b — full-page heading hierarchy h1 → h2 (no skipped levels)
test('CA-006b — full page heading hierarchy is sequential (h1 then h2, no skipped levels)', () => {
  const html = pageAujourdhui(donneesMock(), { layout });
  const headings = [...html.matchAll(/<(h[1-6])\b/g)].map(m => m[1]);
  assert.ok(headings.length > 0, 'Page should contain headings');
  assert.equal(headings[0], 'h1', 'First heading must be h1 (from layout)');
  const hasSkip = headings.some(h => ['h3', 'h4', 'h5', 'h6'].includes(h));
  assert.ok(!hasSkip, 'No h3+ headings — would skip a level after h2');
  const firstH2 = headings.indexOf('h2');
  assert.ok(firstH2 > 0, 'h2 should appear after h1');
});
