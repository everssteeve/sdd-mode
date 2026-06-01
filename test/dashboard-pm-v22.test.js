// Tests #483 / #484 / #485 — Boucle 22 PM cockpit notif-center/sqs-readiness/health-timeline

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  calculerNotifications, blocNotificationCenter,
  computeNotifications, notificationCenterSection,
} from '../lib/dashboard/notification-center.js';

import {
  classerIntent, calculerSqsReadiness, blocSqsReadiness,
  classifyIntent, computeSqsReadiness, sqsReadinessSection,
} from '../lib/dashboard/sqs-readiness.js';

import {
  lireSnapshotsSante, calculerTendance, calculerHealthTimeline, blocHealthTimeline,
  readHealthSnapshots, computeTrend, computeHealthTimeline, healthTimelineSection,
} from '../lib/dashboard/health-timeline.js';

// ─── #483 — Notification center ──────────────────────────────────────────────

test('calculerNotifications — aggrège signaux + tri par niveau', () => {
  const n = calculerNotifications({
    pm: {
      zombies: [{ id: 'A' }],
      draftsAnciens: [{ id: 'B' }, { id: 'C' }],
    },
    deadlines: { totaux: { retard: 2 } },
    risks: { intents: [
      { id: 'R1', niveau: 'critical' },
      { id: 'R2', niveau: 'high' },
      { id: 'R3', niveau: 'medium' }, // exclu
    ]},
    aiActCompliance: { totaux: { unacceptable: 0, high: 1 } },
    backlogFreshness: { items: [
      { id: 'X', bande: 'abandonne' },
      { id: 'Y', bande: 'stale' }, // exclu
    ]},
  });
  assert.equal(n.total, 6);
  // Tri : critique d'abord
  assert.equal(n.items[0].niveau, 'critique');
  assert.equal(n.parNiveau.critique, 3); // retard + risques + ai-act
  assert.equal(n.parNiveau.eleve, 2); // zombie + abandon
  assert.equal(n.parNiveau.attention, 1); // drafts
});

test('calculerNotifications — empty si tout est calme', () => {
  const n = calculerNotifications({});
  assert.equal(n.total, 0);
  assert.equal(n.parNiveau.critique, 0);
});

test('blocNotificationCenter — empty state encourageant', () => {
  const html = blocNotificationCenter({ notifications: { items: [], total: 0, parNiveau: {} }});
  assert.ok(html.includes('PM zen'));
  assert.ok(html.includes('aucun signal urgent'));
});

test('blocNotificationCenter — cartes triées + anchors', () => {
  const html = blocNotificationCenter({ notifications: {
    items: [
      { niveau: 'critique', libelle: '2 retards', detail: 'détail', count: 2, anchor: '#echeances-intent' },
      { niveau: 'eleve', libelle: '1 zombie', detail: 'détail', count: 1, anchor: '#a-valider-cette-semaine' },
    ],
    total: 2,
    parNiveau: { critique: 1, eleve: 1, attention: 0 },
  }});
  assert.ok(html.includes('Centre de notifications'));
  assert.ok(html.includes('lvl-critique'));
  assert.ok(html.includes('lvl-eleve'));
  assert.ok(html.includes('href="#echeances-intent"'));
  assert.ok(html.includes('🔴'));
});

// ─── #484 — SQS readiness scorecard ──────────────────────────────────────────

test('classerIntent — no-spec si aucune SPEC liée', () => {
  const r = classerIntent([]);
  assert.equal(r.etat, 'no-spec');
  assert.equal(r.total, 0);
});

test('classerIntent — ready si toutes ≥ 4', () => {
  const r = classerIntent([{ sqs: 4.5 }, { sqs: 5 }, { sqs: 4 }]);
  assert.equal(r.etat, 'ready');
  assert.equal(r.score.min, 4);
  assert.equal(r.score.scored, 3);
});

test('classerIntent — partial si au moins 1 ≥ 4 et 1 < 4', () => {
  const r = classerIntent([{ sqs: 4.5 }, { sqs: 3 }]);
  assert.equal(r.etat, 'partial');
  assert.equal(r.score.min, 3);
});

test('classerIntent — needs-work si toutes < 4', () => {
  const r = classerIntent([{ sqs: 2 }, { sqs: 3 }]);
  assert.equal(r.etat, 'needs-work');
});

test('classerIntent — to-score si SPEC liées mais aucune SQS', () => {
  const r = classerIntent([{ id: 'x' }, { id: 'y' }]);
  assert.equal(r.etat, 'to-score');
  assert.equal(r.total, 2);
  assert.equal(r.score.scored, 0);
});

test('calculerSqsReadiness — exclut done/archived + tri needs-work en tête', () => {
  const r = calculerSqsReadiness({
    intents: [
      { id: 'INTENT-A', titre: 'a', statut: 'active' },
      { id: 'INTENT-B', titre: 'b', statut: 'active' },
      { id: 'INTENT-C', titre: 'c', statut: 'done' }, // exclu
    ],
    specs: [
      { id: 'SPEC-A-1', parentIntent: 'INTENT-A', sqs: 4.5 },
      { id: 'SPEC-A-2', parentIntent: 'INTENT-A', sqs: 4.2 },
      { id: 'SPEC-B-1', parentIntent: 'INTENT-B', sqs: 2 },
      { id: 'SPEC-B-2', parentIntent: 'INTENT-B', sqs: 3 },
    ],
  });
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].id, 'INTENT-B'); // needs-work en tête
  assert.equal(r.items[0].etat, 'needs-work');
  assert.equal(r.items[1].etat, 'ready');
  assert.equal(r.totaux.ready, 1);
  assert.equal(r.totaux.needsWork, 1);
});

test('calculerSqsReadiness — specsFaibles capturées', () => {
  const r = calculerSqsReadiness({
    intents: [{ id: 'INTENT-A', titre: 'a', statut: 'active' }],
    specs: [
      { id: 'SPEC-A-1', parentIntent: 'INTENT-A', sqs: 4.5, titre: 'forte' },
      { id: 'SPEC-A-2', parentIntent: 'INTENT-A', sqs: 2, titre: 'faible' },
    ],
  });
  assert.equal(r.items[0].specsFaibles.length, 1);
  assert.equal(r.items[0].specsFaibles[0].sqs, 2);
});

test('blocSqsReadiness — rendu avec badge + weak links', () => {
  const html = blocSqsReadiness({ sqsReadiness: {
    items: [{
      id: 'INTENT-A', titre: 't', file: null, statut: 'active', priority: 'P0',
      etat: 'partial', total: 2,
      score: { min: 2, avg: 3.3, scored: 2 },
      specsFaibles: [{ id: 'SPEC-A-2', sqs: 2, titre: 'x' }],
    }],
    totaux: { total: 1, ready: 0, partial: 1, needsWork: 0, toScore: 0, noSpec: 0 },
    seuil: 4,
  }});
  assert.ok(html.includes('SQS readiness scorecard'));
  assert.ok(html.includes('lvl-partial'));
  assert.ok(html.includes('row-partial'));
  assert.ok(html.includes('SPEC-A-2'));
  assert.ok(html.includes('2/5'));
});

// ─── #485 — Health timeline ──────────────────────────────────────────────────

function avecRepoSante(dates, scores) {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-health-'));
  const rep = join(racine, '.aiad', 'metrics', 'sante-globale');
  mkdirSync(rep, { recursive: true });
  dates.forEach((d, i) => {
    writeFileSync(join(rep, `${d}.json`), JSON.stringify({ date: d, score: scores[i], niveau: scores[i] >= 80 ? 'sain' : scores[i] >= 50 ? 'moyen' : 'critique' }));
  });
  return racine;
}

test('lireSnapshotsSante — vide si répertoire absent', () => {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-empty-'));
  assert.deepEqual(lireSnapshotsSante(racine), []);
  rmSync(racine, { recursive: true, force: true });
});

test('lireSnapshotsSante — lit + ordonne par date', () => {
  const racine = avecRepoSante(['2026-05-15', '2026-05-10', '2026-05-12'], [80, 50, 65]);
  const items = lireSnapshotsSante(racine);
  assert.equal(items.length, 3);
  assert.equal(items[0].date, '2026-05-10');
  assert.equal(items[0].score, 50);
  assert.equal(items[2].score, 80);
  rmSync(racine, { recursive: true, force: true });
});

test('calculerTendance — direction up si moitié récente > ancienne', () => {
  const t = calculerTendance([
    { score: 40 }, { score: 50 }, // ancienne
    { score: 70 }, { score: 80 }, // récente
  ]);
  assert.equal(t.direction, 'up');
  assert.ok(t.delta > 0);
});

test('calculerTendance — direction down', () => {
  const t = calculerTendance([
    { score: 80 }, { score: 85 },
    { score: 50 }, { score: 45 },
  ]);
  assert.equal(t.direction, 'down');
  assert.ok(t.delta < 0);
});

test('calculerTendance — flat si delta < 2', () => {
  const t = calculerTendance([{ score: 60 }, { score: 61 }]);
  assert.equal(t.direction, 'flat');
});

test('calculerTendance — unknown si moins de 2 points', () => {
  assert.equal(calculerTendance([]).direction, 'unknown');
  assert.equal(calculerTendance([{ score: 50 }]).direction, 'unknown');
});

test('calculerHealthTimeline — compose lecture + tendance', () => {
  const racine = avecRepoSante(['2026-05-10', '2026-05-12', '2026-05-15'], [50, 60, 80]);
  const t = calculerHealthTimeline(racine, {});
  assert.equal(t.nbPoints, 3);
  assert.equal(t.tendance.direction, 'up');
  rmSync(racine, { recursive: true, force: true });
});

test('blocHealthTimeline — empty si aucun snapshot', () => {
  const html = blocHealthTimeline({ healthTimeline: { points: [], tendance: { direction: 'unknown' }, nbPoints: 0 } });
  assert.ok(html.includes('Aucun fichier'));
});

test('blocHealthTimeline — 1 snapshot → message besoin d\'historique', () => {
  const html = blocHealthTimeline({ healthTimeline: {
    points: [{ date: '2026-05-15', score: 70, niveau: 'moyen' }],
    tendance: { direction: 'unknown' },
    nbPoints: 1,
  }});
  assert.ok(html.includes("besoin de plus d'historique") || html.includes('1 seul snapshot'));
  assert.ok(html.includes('70/100'));
});

test('blocHealthTimeline — sparkline + tendance up', () => {
  const html = blocHealthTimeline({ healthTimeline: {
    points: [
      { date: '2026-05-10', score: 50, niveau: 'moyen' },
      { date: '2026-05-12', score: 70, niveau: 'moyen' },
      { date: '2026-05-15', score: 85, niveau: 'sain' },
    ],
    tendance: { direction: 'up', delta: 17.5, base: 50 },
    nbPoints: 3,
  }});
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('polyline'));
  assert.ok(html.includes('ht-trend-up'));
  assert.ok(html.includes('amélioration'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeNotifications, 'function');
  assert.equal(typeof notificationCenterSection, 'function');
  assert.equal(typeof classifyIntent, 'function');
  assert.equal(typeof computeSqsReadiness, 'function');
  assert.equal(typeof sqsReadinessSection, 'function');
  assert.equal(typeof readHealthSnapshots, 'function');
  assert.equal(typeof computeTrend, 'function');
  assert.equal(typeof computeHealthTimeline, 'function');
  assert.equal(typeof healthTimelineSection, 'function');
});
