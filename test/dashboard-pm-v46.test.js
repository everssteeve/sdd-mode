// Tests #555 / #556 / #557 — Boucle 46 PM sponsor-scorecard/outcome-north-star/activity-feed

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  calculerSponsorScorecard, blocSponsorScorecard,
  computeSponsorScorecard, sponsorScorecardSection,
} from '../lib/dashboard/sponsor-scorecard.js';

import {
  calculerOutcomeNorthStar, blocOutcomeNorthStar,
  computeOutcomeNorthStar, outcomeNorthStarSection,
} from '../lib/dashboard/outcome-north-star.js';

import {
  calculerActivityFeed, blocActivityFeed,
  computeActivityFeed, activityFeedSection,
} from '../lib/dashboard/activity-feed.js';

const DAY = 24 * 3600 * 1000;

// ─── #555 — Sponsor scorecard ───────────────────────────────────────────────

test('calculerSponsorScorecard — score 5/5 si toutes dimensions ok', () => {
  const now = Date.now();
  const r = calculerSponsorScorecard({
    intents: [{ id: 'A', sponsor: 'Sales' }],
    specs: [{ parentIntent: 'A', statut: 'done', mtime: now }],
    stakeholderComms: { items: [{ id: 'A', derniereComm: now - 3 * DAY }]},
    riskTransparency: { items: [] },
    pm: { zombies: [] },
  }, { now });
  const sales = r.items.find((i) => i.sponsor === 'Sales');
  assert.equal(sales.score, 5);
  assert.equal(sales.etat, 'excellent');
});

test('calculerSponsorScorecard — score faible si aucune dimension', () => {
  const r = calculerSponsorScorecard({
    intents: [{ id: 'A', sponsor: 'Sales' }],
    specs: [], stakeholderComms: { items: [] },
    pm: { zombies: [{ id: 'A' }]},
  });
  const sales = r.items.find((i) => i.sponsor === 'Sales');
  assert.ok(sales.score < 3);
});

test('calculerSponsorScorecard — empty si pas de sponsor', () => {
  const r = calculerSponsorScorecard({ intents: [{ id: 'A' }]});
  assert.equal(r.items.length, 0);
});

test('blocSponsorScorecard — empty + rendu', () => {
  assert.ok(blocSponsorScorecard({ sponsorScorecard: { items: [], totaux: {}}}).includes('aucun sponsor'));
  const html = blocSponsorScorecard({ sponsorScorecard: {
    items: [{ sponsor: 'S1', nbIntents: 3, score: 5, etat: 'excellent', checks: { throughput: true, commsRecente: true, couvertureRisque: true, pasZombie: true, reviewOk: true }}],
    totaux: { sponsors: 1, excellent: 1, faible: 0, scoreMoyen: 5 },
  }});
  assert.ok(html.includes('Scorecard sponsors'));
  assert.ok(html.includes('r-excellent'));
});

// ─── #556 — Outcome North Star ──────────────────────────────────────────────

test('calculerOutcomeNorthStar — message si pas de NS', () => {
  const r = calculerOutcomeNorthStar({});
  assert.ok(r.message);
});

test('calculerOutcomeNorthStar — score Jaccard par outcome', () => {
  const r = calculerOutcomeNorthStar({
    northStar: 'Devenir le raccourcisseur URL européen de référence',
    prdCoverage: { outcomes: [
      { titre: 'Latence p95 redirect URL européen', intents: [] },
      { titre: 'Bug auth mobile', intents: [] },
    ]},
  });
  const aligned = r.items.find((i) => i.titre.includes('Latence'));
  const isole = r.items.find((i) => i.titre.includes('Bug'));
  assert.ok(aligned.score > isole.score);
});

test('blocOutcomeNorthStar — message + rendu', () => {
  assert.ok(blocOutcomeNorthStar({ outcomeNorthStar: { message: 'pas NS', items: [] }}).includes('pas NS'));
  const html = blocOutcomeNorthStar({ outcomeNorthStar: {
    items: [{ titre: 'O1', target: null, nbIntents: 2, score: 0.3, etat: 'aligne' }],
    totaux: { total: 1, aligne: 1, partiel: 0, isole: 0, scoreMoyen: 0.3 },
    northStar: 'mon NS', message: null,
  }});
  assert.ok(html.includes('Outcome ↔ North Star'));
  assert.ok(html.includes('r-aligne'));
});

// ─── #557 — Activity feed ───────────────────────────────────────────────────

function avecActivity(struct) {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-af-'));
  for (const [chemin, contenu] of Object.entries(struct)) {
    const cible = join(racine, chemin);
    mkdirSync(join(cible, '..'), { recursive: true });
    writeFileSync(cible, contenu);
  }
  return racine;
}

test('calculerActivityFeed — agrège events 7j', () => {
  const now = Date.now();
  const racine = avecActivity({
    '.aiad/metrics/pm-journal/2026-05-15.md': 'journal',
    '.aiad/facts/F.md': 'fact',
  });
  const r = calculerActivityFeed(racine, {
    intents: [{ id: 'A', mtime: now - 2 * DAY }],
    specs: [{ id: 'S', mtime: now - 1 * DAY }],
  }, { now });
  assert.ok(r.totaux.intents >= 1);
  assert.ok(r.totaux.specs >= 1);
  rmSync(racine, { recursive: true, force: true });
});

test('calculerActivityFeed — exclut > 7j', () => {
  const now = Date.now();
  const racine = mkdtempSync(join(tmpdir(), 'aiad-af-old-'));
  const r = calculerActivityFeed(racine, {
    intents: [{ id: 'A', mtime: now - 15 * DAY }],
  }, { now });
  assert.equal(r.totaux.intents, 0);
  rmSync(racine, { recursive: true, force: true });
});

test('blocActivityFeed — empty + rendu', () => {
  assert.ok(blocActivityFeed({ activityFeed: { events: [], totaux: { total: 0 }}}).includes('aucune activité'));
  const html = blocActivityFeed({ activityFeed: {
    events: [{ type: 'intent', id: 'A', titre: 't', statut: 'active', mtime: Date.now() - 2 * DAY }],
    totaux: { total: 1, intents: 1, specs: 0, journal: 0, facts: 0, demos: 0 },
  }});
  assert.ok(html.includes('Feed activité 7j'));
  assert.ok(html.includes('t-intent'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeSponsorScorecard, 'function');
  assert.equal(typeof sponsorScorecardSection, 'function');
  assert.equal(typeof computeOutcomeNorthStar, 'function');
  assert.equal(typeof outcomeNorthStarSection, 'function');
  assert.equal(typeof computeActivityFeed, 'function');
  assert.equal(typeof activityFeedSection, 'function');
});
