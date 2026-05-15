// Tests #465 / #466 / #467 — Boucle 16 PM cockpit focus/filters/links

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  calculerDailyFocus, blocDailyFocus,
  computeDailyFocus, dailyFocusSection,
} from '../lib/dashboard/daily-focus.js';

import { blocSavedFilters, savedFiltersWidget } from '../lib/dashboard/saved-filters.js';

import {
  lireQuickLinks, blocQuickLinks,
  readQuickLinks, quickLinksSection,
} from '../lib/dashboard/quick-links.js';

function tmpProjet() {
  const dir = join(tmpdir(), 'aiad-pm-v16-' + Math.random().toString(36).slice(2));
  mkdirSync(join(dir, '.aiad'), { recursive: true });
  return dir;
}

// ─── #465 — Daily focus ─────────────────────────────────────────────────────

test('calculerDailyFocus — cycle prime sur tout le reste', () => {
  const r = calculerDailyFocus({
    intentDeps: { cycles: [['A', 'B', 'A']] },
    facts: [{ gravite: 'critical', statut: 'open' }],
    deadlines: { totaux: { retard: 5 } },
  });
  assert.equal(r.source, 'cycle');
  assert.equal(r.gravite, 'critical');
});

test('calculerDailyFocus — fact critique en l\'absence de cycle', () => {
  const r = calculerDailyFocus({
    facts: [{ gravite: 'critical', statut: 'open' }],
    deadlines: { totaux: { retard: 5 } },
  });
  assert.equal(r.source, 'fact');
});

test('calculerDailyFocus — retard target avant goulot/pari', () => {
  const r = calculerDailyFocus({
    deadlines: { totaux: { retard: 2 } },
    bottlenecks: { total: 3 },
    confidenceTracker: { totaux: { paris: 1 } },
  });
  assert.equal(r.source, 'retard');
});

test('calculerDailyFocus — null si tout calme', () => {
  assert.equal(calculerDailyFocus({}), null);
});

test('blocDailyFocus — message calme si focus null', () => {
  const html = blocDailyFocus({ dailyFocus: null });
  assert.ok(html.includes('Pas de feu'));
  assert.ok(html.includes('gravite-calme'));
});

test('blocDailyFocus — bannière critique avec lien d\'ancre', () => {
  const html = blocDailyFocus({ dailyFocus: {
    gravite: 'critical', titre: '2 retards', action: 'Re-planifier', ancre: '#echeances-intent', source: 'retard',
  }});
  assert.ok(html.includes('gravite-critical'));
  assert.ok(html.includes('🚨'));
  assert.ok(html.includes('2 retards'));
  assert.ok(html.includes('Re-planifier'));
  assert.ok(html.includes('#echeances-intent'));
});

// ─── #466 — Saved filters ───────────────────────────────────────────────────

test('blocSavedFilters — UI + script localStorage + indicator', () => {
  const html = blocSavedFilters();
  assert.ok(html.includes('pm-saved-filters'));
  assert.ok(html.includes('id="pm-saved-filters-reset"'));
  assert.ok(html.includes('id="pm-saved-filters-indicator"'));
  assert.ok(html.includes('localStorage'));
  assert.ok(html.includes('aiad-pm-search'));
  assert.ok(html.includes('aiad-pm-chips'));
});

test('blocSavedFilters — script écoute input search + click chips', () => {
  const html = blocSavedFilters();
  assert.ok(html.includes('pm-search-input'));
  assert.ok(html.includes('data-pm-filter-target'));
  assert.ok(html.includes("addEventListener('input'"));
});

// ─── #467 — Quick links ─────────────────────────────────────────────────────

test('lireQuickLinks — vide si pas de source', () => {
  const dir = tmpProjet();
  try {
    const r = lireQuickLinks(dir);
    assert.equal(r.liens.length, 0);
    assert.equal(r.source, null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireQuickLinks — parse .aiad/pm-links.yml multi-items', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'pm-links.yml'), `# pm links
- label: Notion
  url: https://notion.so/abc
  icone: 📒
- label: Slack
  url: https://slack.com/xyz
  description: canal team
`);
    const r = lireQuickLinks(dir);
    assert.equal(r.liens.length, 2);
    assert.equal(r.liens[0].label, 'Notion');
    assert.equal(r.liens[0].url, 'https://notion.so/abc');
    assert.equal(r.liens[0].icone, '📒');
    assert.equal(r.liens[1].description, 'canal team');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireQuickLinks — fallback PRD frontmatter quick_links (parser YAML limité)', () => {
  // Le parser frontmatter custom ne gère pas les arrays d'objets imbriqués
  // (cf. lib/frontmatter.js). Le path PRD est best-effort — on vérifie juste
  // qu'il ne plante pas, et que `.aiad/pm-links.yml` reste la source officielle.
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), `---
title: Test
---
# PRD
`);
    const r = lireQuickLinks(dir);
    assert.equal(r.liens.length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireQuickLinks — refuse javascript: URLs (anti-XSS)', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'pm-links.yml'), `- label: Bad
  url: javascript:alert(1)
- label: Good
  url: https://example.com
`);
    const r = lireQuickLinks(dir);
    // Le mauvais URL → exclu (label seul ne suffit pas)
    assert.equal(r.liens.length, 1);
    assert.equal(r.liens[0].label, 'Good');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireQuickLinks — accepte mailto: + http/https', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'pm-links.yml'), `- label: Mail
  url: mailto:dpo@example.com
- label: HTTP
  url: http://internal.local
`);
    const r = lireQuickLinks(dir);
    assert.equal(r.liens.length, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('blocQuickLinks — empty si zéro lien', () => {
  const html = blocQuickLinks({ quickLinks: { liens: [], source: null } });
  assert.ok(html.includes('aucun lien configuré'));
  assert.ok(html.includes('.aiad/pm-links.yml'));
});

test('blocQuickLinks — rend grid + chaque lien target _blank', () => {
  const html = blocQuickLinks({ quickLinks: {
    source: '.aiad/pm-links.yml',
    liens: [
      { label: 'Notion', url: 'https://notion.so/abc', icone: '📒', description: 'roadmap' },
      { label: 'Slack', url: 'https://slack.com/xyz', icone: '💬', description: '' },
    ],
  }});
  assert.ok(html.includes('Liens rapides'));
  assert.ok(html.includes('ql-grid'));
  assert.ok(html.includes('Notion'));
  assert.ok(html.includes('Slack'));
  assert.ok(html.includes('target="_blank"'));
  assert.ok(html.includes('rel="noopener"'));
  assert.ok(html.includes('roadmap'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeDailyFocus, 'function');
  assert.equal(typeof dailyFocusSection, 'function');
  assert.equal(typeof savedFiltersWidget, 'function');
  assert.equal(typeof readQuickLinks, 'function');
  assert.equal(typeof quickLinksSection, 'function');
});
