// Tests #546 / #547 / #548 — Boucle 43 PM bus-factor/sentiment-trend/rituals-calendar

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  calculerBusFactor, blocBusFactor,
  computeBusFactor, busFactorSection,
} from '../lib/dashboard/bus-factor.js';

import {
  calculerSentimentTrend, blocSentimentTrend,
  computeSentimentTrend, sentimentTrendSection,
} from '../lib/dashboard/sentiment-trend.js';

import {
  calculerRitualsCalendar, blocRitualsCalendar,
  computeRitualsCalendar, ritualsCalendarSection, AIAD_RITUALS,
} from '../lib/dashboard/rituals-calendar.js';

const DAY = 24 * 3600 * 1000;

// ─── #546 — Bus factor ──────────────────────────────────────────────────────

test('calculerBusFactor — classe single-owner vs duo vs sain', () => {
  const r = calculerBusFactor({
    intents: [
      { id: 'A', statut: 'active', owner: 'Alice' },
      { id: 'B', statut: 'active', owner: ['Alice', 'Bob'] },
      { id: 'C', statut: 'active', owner: ['Alice', 'Bob', 'Carla'] },
      { id: 'D', statut: 'active' }, // pas d'owner
    ],
  });
  assert.equal(r.totaux.singleOwner, 1);
  assert.equal(r.totaux.duo, 1);
  assert.equal(r.totaux.sain, 1);
  assert.equal(r.totaux.pasDowner, 1);
});

test('calculerBusFactor — exclut done/archived', () => {
  const r = calculerBusFactor({
    intents: [
      { id: 'A', statut: 'done', owner: 'Alice' },
      { id: 'B', statut: 'active', owner: 'Alice' },
    ],
  });
  assert.equal(r.items.length, 1);
});

test('blocBusFactor — empty + rendu', () => {
  assert.ok(blocBusFactor({ busFactor: { items: [], totaux: {}}}).includes('aucun Intent actif'));
  const html = blocBusFactor({ busFactor: {
    items: [{ id: 'A', titre: 't', file: null, priority: 'P0', owners: ['Alice'], busFactor: 1, etat: 'single-owner' }],
    totaux: { total: 1, singleOwner: 1, pasDowner: 0, duo: 0, sain: 0, tauxSain: 0 },
  }});
  assert.ok(html.includes('Bus factor'));
  assert.ok(html.includes('r-single-owner'));
});

// ─── #547 — Sentiment trend ─────────────────────────────────────────────────

test('calculerSentimentTrend — distribue par semaine', () => {
  const now = Date.now();
  const r = calculerSentimentTrend({
    customerFeedback: { items: [
      { sentiment: 'positif', date: now - 3 * DAY },
      { sentiment: 'negatif', date: now - 3 * DAY },
      { sentiment: 'positif', date: now - 15 * DAY },
    ]},
  }, { now, nbSemaines: 4 });
  assert.equal(r.buckets.length, 4);
  const dernier = r.buckets[3];
  assert.equal(dernier.positif, 1);
  assert.equal(dernier.negatif, 1);
});

test('calculerSentimentTrend — détecte tendance ameliore/degrade', () => {
  const now = Date.now();
  // Plus de positifs récents
  const items = [];
  for (let i = 0; i < 5; i++) items.push({ sentiment: 'positif', date: now - i * DAY });
  for (let i = 0; i < 5; i++) items.push({ sentiment: 'negatif', date: now - 25 * DAY - i * DAY });
  const r = calculerSentimentTrend({ customerFeedback: { items }}, { now, nbSemaines: 6 });
  assert.equal(r.tendance, 'ameliore');
});

test('calculerSentimentTrend — empty si zéro feedback', () => {
  const r = calculerSentimentTrend({});
  assert.equal(r.totaux.total, 0);
});

test('blocSentimentTrend — empty + rendu', () => {
  assert.ok(blocSentimentTrend({ sentimentTrend: { totaux: { total: 0 }, nbSem: 8 }}).includes('aucun feedback'));
  const html = blocSentimentTrend({ sentimentTrend: {
    buckets: [{ positif: 2, negatif: 1, question: 0, total: 3 }],
    nbSem: 1,
    totaux: { total: 3, positif: 2, negatif: 1, question: 0 },
    tendance: 'ameliore', ratioAnc: 0, ratioRec: 1,
  }});
  assert.ok(html.includes('Évolution sentiment'));
  assert.ok(html.includes('<svg'));
});

// ─── #548 — Rituals calendar ────────────────────────────────────────────────

function avecRituels(struct) {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-rt-'));
  for (const [chemin, contenu] of Object.entries(struct)) {
    const cible = join(racine, chemin);
    mkdirSync(join(cible, '..'), { recursive: true });
    writeFileSync(cible, contenu);
  }
  return racine;
}

test('calculerRitualsCalendar — détecte états selon mtime', () => {
  const racine = avecRituels({
    '.aiad/metrics/standup/journal.md': 'recent',
  });
  const r = calculerRitualsCalendar(racine);
  const standup = r.items.find((i) => i.id === 'standup');
  assert.ok(standup.lastMtime != null);
  // mtime du fichier vient d'être créé, cadence 1j → prochain demain → planifie
  const intention = r.items.find((i) => i.id === 'intention');
  assert.equal(intention.etat, 'jamais'); // pas de dossier intention
  rmSync(racine, { recursive: true, force: true });
});

test('calculerRitualsCalendar — empty si aucun rituel', () => {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-norit-'));
  const r = calculerRitualsCalendar(racine);
  assert.equal(r.totaux.jamais, AIAD_RITUALS.length);
  rmSync(racine, { recursive: true, force: true });
});

test('blocRitualsCalendar — rendu cards', () => {
  const html = blocRitualsCalendar({ ritualsCalendar: {
    items: [{ id: 'standup', label: 'Standup', dossier: 'standup', cadenceJours: 1, emoji: '🔁',
      lastMtime: Date.now() - 2 * DAY, prochain: Date.now() - DAY, joursDepuis: 2, joursAvant: -1, etat: 'retard' }],
    totaux: { total: 1, retard: 1, imminent: 0, jamais: 0 },
  }});
  assert.ok(html.includes('Calendrier rituels'));
  assert.ok(html.includes('e-retard'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeBusFactor, 'function');
  assert.equal(typeof busFactorSection, 'function');
  assert.equal(typeof computeSentimentTrend, 'function');
  assert.equal(typeof sentimentTrendSection, 'function');
  assert.equal(typeof computeRitualsCalendar, 'function');
  assert.equal(typeof ritualsCalendarSection, 'function');
  assert.ok(Array.isArray(AIAD_RITUALS));
});
