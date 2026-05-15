// Tests #531 / #532 / #533 — Boucle 38 PM risk-transparency/cumulative-achievements/standup-script

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  calculerRiskTransparency, blocRiskTransparency,
  computeRiskTransparency, riskTransparencySection,
} from '../lib/dashboard/risk-transparency.js';

import {
  calculerCumulativeAchievements, blocCumulativeAchievements,
  computeCumulativeAchievements, cumulativeAchievementsSection,
} from '../lib/dashboard/cumulative-achievements.js';

import {
  calculerStandupScript, blocStandupScript,
  computeStandupScript, standupScriptSection,
} from '../lib/dashboard/standup-script.js';

const DAY = 24 * 3600 * 1000;

// ─── #531 — Risk transparency ───────────────────────────────────────────────

test('calculerRiskTransparency — couvert si mitigation OU accepté', () => {
  const r = calculerRiskTransparency({
    intents: [
      { id: 'A', risks_mitigation: ['plan A'] },
      { id: 'B' },
      { id: 'C' },
    ],
    risks: { intents: [
      { id: 'A', niveau: 'critical' }, // couvert (mitigation)
      { id: 'B', niveau: 'high' }, // accepté
      { id: 'C', niveau: 'critical' }, // découvert
    ]},
    acceptedRisks: { items: [{ id: 'B' }] },
  });
  assert.equal(r.totaux.total, 3);
  assert.equal(r.totaux.couverts, 2);
  assert.equal(r.totaux.score, 67);
  assert.equal(r.totaux.etat, 'partiel');
  // Tri : découverts d'abord
  assert.equal(r.items[0].couvert, false);
});

test('calculerRiskTransparency — score 100 → parfait', () => {
  const r = calculerRiskTransparency({
    intents: [{ id: 'A', mitigation: 'plan' }],
    risks: { intents: [{ id: 'A', niveau: 'critical' }]},
  });
  assert.equal(r.totaux.score, 100);
  assert.equal(r.totaux.etat, 'parfait');
});

test('calculerRiskTransparency — sans-data si zéro risque élevé', () => {
  const r = calculerRiskTransparency({});
  assert.equal(r.totaux.etat, 'sans-data');
});

test('blocRiskTransparency — empty + card + rows', () => {
  assert.ok(blocRiskTransparency({ riskTransparency: { items: [], totaux: { etat: 'sans-data', total: 0 }}}).includes('aucun risque élevé'));
  const html = blocRiskTransparency({ riskTransparency: {
    items: [{ id: 'A', titre: 't', file: null, niveau: 'critical', mitigation: ['plan A'], accepte: false, couvert: true }],
    totaux: { total: 1, couverts: 1, decouverts: 0, avecMitigation: 1, acceptes: 0, score: 100, etat: 'parfait' },
  }});
  assert.ok(html.includes('Transparence du registre'));
  assert.ok(html.includes('e-parfait'));
  assert.ok(html.includes('100%'));
});

// ─── #532 — Cumulative achievements ─────────────────────────────────────────

test('calculerCumulativeAchievements — compteurs et vitesse', () => {
  const now = Date.now();
  const r = calculerCumulativeAchievements({
    intents: [
      { id: 'A', statut: 'active', mtime: now - 90 * DAY },
      { id: 'B', statut: 'done', mtime: now - 30 * DAY },
      { id: 'C', statut: 'draft', mtime: now - 5 * DAY },
    ],
    specs: [
      { statut: 'done', mtime: now - 60 * DAY },
      { statut: 'done', mtime: now - 30 * DAY },
      { statut: 'in-progress', mtime: now },
    ],
  }, { now });
  assert.equal(r.intentsTotal, 3);
  assert.equal(r.specsTotal, 3);
  assert.equal(r.specsLivrees, 2);
  assert.equal(r.intentsLivres, 1);
  assert.equal(r.intentsDraft, 1);
  assert.equal(r.tauxLivrSpec, 67);
  assert.ok(r.ageMois >= 3);
});

test('calculerCumulativeAchievements — empty si pas d\'artefacts', () => {
  const r = calculerCumulativeAchievements({});
  assert.equal(r.intentsTotal, 0);
  assert.equal(r.specsTotal, 0);
});

test('blocCumulativeAchievements — empty + rendu stats', () => {
  assert.ok(blocCumulativeAchievements({ cumulativeAchievements: { intentsTotal: 0, specsTotal: 0 }}).includes('aucun artefact'));
  const html = blocCumulativeAchievements({ cumulativeAchievements: {
    intentsTotal: 3, intentsActifs: 1, intentsLivres: 1, intentsDraft: 1,
    specsTotal: 3, specsLivrees: 2, specsEnCours: 1,
    ageMois: 3, ageJours: 90, debut: Date.now() - 90 * DAY,
    tauxLivrSpec: 67, vitesseSpecsParMois: 0.7,
  }});
  assert.ok(html.includes('Cumul des achievements'));
  assert.ok(html.includes('2 SPECs livrées'));
});

// ─── #533 — Standup script ──────────────────────────────────────────────────

test('calculerStandupScript — agrège hier + priorités + blockers', () => {
  const now = Date.now();
  const r = calculerStandupScript({
    specs: [
      { id: 'SPEC-A', statut: 'done', mtime: now - 12 * 3600 * 1000, titre: 'livré hier' },
      { id: 'SPEC-B', statut: 'review', mtime: now },
    ],
    intents: [
      { id: 'INTENT-1', priority: 'P0', statut: 'active', titre: 'top' },
    ],
    pm: { zombies: [{ id: 'INTENT-2', anciennete: 35 }]},
    riskTransparency: { items: [{ id: 'INTENT-3', niveau: 'critical', couvert: false }]},
  }, { now });
  assert.ok(r.texte.includes('SPEC-A'));
  assert.ok(r.texte.includes('INTENT-1'));
  assert.ok(r.texte.includes('Zombie'));
  assert.ok(r.texte.includes('Risque critical'));
  assert.ok(r.texte.includes('SPEC-B'));
});

test('calculerStandupScript — empty signal si rien', () => {
  const r = calculerStandupScript({});
  assert.ok(r.texte.includes('Aucun signal'));
});

test('blocStandupScript — rendu + script copier', () => {
  const html = blocStandupScript({ standupScript: {
    texte: '# Standup\n- foo',
    sections: { hierCount: 1, priorites: 1, blockers: 0, decisions: 0 },
  }});
  assert.ok(html.includes('Script standup auto'));
  assert.ok(html.includes('data-ss-action="copy"'));
  assert.ok(html.includes('navigator.clipboard'));
  assert.ok(html.includes('Standup'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeRiskTransparency, 'function');
  assert.equal(typeof riskTransparencySection, 'function');
  assert.equal(typeof computeCumulativeAchievements, 'function');
  assert.equal(typeof cumulativeAchievementsSection, 'function');
  assert.equal(typeof computeStandupScript, 'function');
  assert.equal(typeof standupScriptSection, 'function');
});
