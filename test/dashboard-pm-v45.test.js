// Tests #552 / #553 / #554 — Boucle 45 PM section-visibility/quarterly-decisions/spec-quality-score

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  calculerSectionVisibility, blocSectionVisibility,
  computeSectionVisibility, sectionVisibilitySection,
} from '../lib/dashboard/section-visibility.js';

import {
  extraireDecisionsJournal, calculerQuarterlyDecisions, blocQuarterlyDecisions,
  extractJournalDecisions, computeQuarterlyDecisions, quarterlyDecisionsSection,
} from '../lib/dashboard/quarterly-decisions.js';

import {
  calculerSpecQualityScore, blocSpecQualityScore,
  computeSpecQualityScore, specQualityScoreSection,
} from '../lib/dashboard/spec-quality-score.js';

// ─── #552 — Section visibility ──────────────────────────────────────────────

test('calculerSectionVisibility — actif true', () => {
  const r = calculerSectionVisibility();
  assert.equal(r.actif, true);
});

test('blocSectionVisibility — rendu barre + JS localStorage', () => {
  const html = blocSectionVisibility();
  assert.ok(html.includes('Visibilité sections'));
  assert.ok(html.includes('data-sv-action="edit"'));
  assert.ok(html.includes('localStorage'));
  assert.ok(html.includes('aiad-pm-sections-hidden'));
});

// ─── #553 — Quarterly decisions ─────────────────────────────────────────────

test('extraireDecisionsJournal — extrait bullets sous ## Décisions', () => {
  const md = `# foo\n\n## Décisions\n- Décision A\n- Décision B\n\n## Notes\n- pas une décision`;
  assert.deepEqual(extraireDecisionsJournal(md), ['Décision A', 'Décision B']);
});

function avecRepo(struct) {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-qd-'));
  for (const [chemin, contenu] of Object.entries(struct)) {
    const cible = join(racine, chemin);
    mkdirSync(join(cible, '..'), { recursive: true });
    writeFileSync(cible, contenu);
  }
  return racine;
}

test('calculerQuarterlyDecisions — groupe par trimestre', () => {
  const racine = avecRepo({
    '.aiad/metrics/pm-journal/2026-05-10.md': '## Décisions\n- D1\n- D2',
    '.aiad/metrics/pm-journal/2026-02-15.md': '## Décisions\n- D3',
    '.aiad/facts/F-001.md': 'fact',
  });
  const r = calculerQuarterlyDecisions(racine);
  assert.ok(r.items.length >= 2); // Q1-2026 + Q2-2026
  assert.ok(r.totaux.totalDecisions >= 3);
  rmSync(racine, { recursive: true, force: true });
});

test('blocQuarterlyDecisions — empty + rendu', () => {
  assert.ok(blocQuarterlyDecisions({ quarterlyDecisions: { items: [], totaux: { trimestres: 0 }}}).includes('aucune décision'));
  const html = blocQuarterlyDecisions({ quarterlyDecisions: {
    items: [{ trim: 'Q2-2026', decisions: [{ texte: 'D1', fichier: 'f.md', ts: 1 }], facts: [{ fichier: 'F.md', ts: 2 }]}],
    totaux: { trimestres: 1, totalDecisions: 1, totalFacts: 1 },
  }});
  assert.ok(html.includes('Décisions & facts'));
  assert.ok(html.includes('Q2-2026'));
});

// ─── #554 — Spec quality score ──────────────────────────────────────────────

test('calculerSpecQualityScore — exclut done/archived', () => {
  const r = calculerSpecQualityScore({
    specs: [
      { id: 'A', statut: 'in-progress', sqs: 4.5 },
      { id: 'B', statut: 'done', sqs: 5 },
    ],
  });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].id, 'A');
});

test('calculerSpecQualityScore — score 5/5 si toutes checks', () => {
  const r = calculerSpecQualityScore({
    specs: [{ id: 'A', statut: 'in-progress', sqs: 4.5 }],
    specScope: { items: [{ id: 'A', taille: 'M' }]},
    acceptanceCriteria: { items: [{ id: 'A', total: 3 }]},
    specAnnotationCoverage: { items: [{ id: 'A', nbTags: 4 }]},
    specStuck: { items: [] }, // pas stuck → ok
  });
  assert.equal(r.items[0].score, 5);
  assert.equal(r.items[0].etat, 'excellent');
});

test('calculerSpecQualityScore — score faible si aucune dimension', () => {
  const r = calculerSpecQualityScore({
    specs: [{ id: 'A', statut: 'in-progress' }],
  });
  assert.equal(r.items[0].score, 1); // seul "stable" coché par défaut
  assert.equal(r.items[0].etat, 'faible');
});

test('blocSpecQualityScore — empty + rendu', () => {
  assert.ok(blocSpecQualityScore({ specQualityScore: { items: [], totaux: { total: 0 }}}).includes('aucune SPEC'));
  const html = blocSpecQualityScore({ specQualityScore: {
    items: [{ id: 'A', titre: 't', file: null, statut: 'in-progress', score: 5, etat: 'excellent', checks: {
      sqs: { ok: true, valeur: 4.5 }, taille: { ok: true, valeur: 'M' }, ac: { ok: true, valeur: 3 },
      anno: { ok: true, valeur: 4 }, stable: { ok: true, valeur: 'stable' },
    }}],
    totaux: { total: 1, excellent: 1, bon: 0, partiel: 0, faible: 0, scoreMoyen: 5 },
  }});
  assert.ok(html.includes('Score qualité SPEC'));
  assert.ok(html.includes('e-excellent'));
  assert.ok(html.includes('5/5'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeSectionVisibility, 'function');
  assert.equal(typeof sectionVisibilitySection, 'function');
  assert.equal(typeof extractJournalDecisions, 'function');
  assert.equal(typeof computeQuarterlyDecisions, 'function');
  assert.equal(typeof quarterlyDecisionsSection, 'function');
  assert.equal(typeof computeSpecQualityScore, 'function');
  assert.equal(typeof specQualityScoreSection, 'function');
});
