// Tests #543 / #544 / #545 — Boucle 42 PM acceptance-criteria/action-items/okr-progress

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  extraireCriteres, calculerAcceptanceCriteria, blocAcceptanceCriteria,
  extractCriteria, computeAcceptanceCriteria, acceptanceCriteriaSection,
} from '../lib/dashboard/acceptance-criteria.js';

import {
  extraireActions, calculerActionItems, blocActionItems,
  extractActions, computeActionItems, actionItemsSection,
} from '../lib/dashboard/action-items.js';

import {
  calculerOkrProgress, blocOkrProgress,
  computeOkrProgress, okrProgressSection,
} from '../lib/dashboard/okr-progress.js';

// ─── #543 — Acceptance criteria ─────────────────────────────────────────────

test('extraireCriteres — bullets sous ## Critères d\'acceptation', () => {
  const md = `# Spec\n\n## Critères d'acceptation\n- critère 1\n- critère 2\n\n## Autre\n- pas un critère`;
  const r = extraireCriteres(md);
  assert.equal(r.sectionAC.length, 2);
});

test('extraireCriteres — EARS WHEN/SHALL', () => {
  const md = `WHEN user clicks then system SHALL display\nrandom text\nIF cart empty THEN system SHALL show empty`;
  const r = extraireCriteres(md);
  assert.equal(r.ears.length, 2);
});

test('extraireCriteres — checkboxes faits/non-faits', () => {
  const md = `- [ ] todo 1\n- [x] done 1\n- [X] done 2`;
  const r = extraireCriteres(md);
  assert.equal(r.checkboxes.total, 3);
  assert.equal(r.checkboxes.faits, 2);
});

test('calculerAcceptanceCriteria — agrège tous patterns', () => {
  const r = calculerAcceptanceCriteria({
    specs: [
      { id: 'A', body: '## Critères d\'acceptation\n- AC 1\n\nWHEN x THEN SHALL y\n- [ ] todo\n- [x] done' },
      { id: 'B', body: 'pas de critère' },
    ],
  });
  // A : sectionAC inclut bullets de la section (incluant les checkboxes après EARS), EARS 1, checkboxes 2
  const a = r.items.find((i) => i.id === 'A');
  assert.ok(a.sectionAC >= 1);
  assert.equal(a.ears, 1);
  assert.equal(a.checkboxes.total, 2);
  assert.equal(a.progression, 50);
});

test('blocAcceptanceCriteria — empty + rendu rows', () => {
  assert.ok(blocAcceptanceCriteria({ acceptanceCriteria: { items: [], totaux: { specsAvecAC: 0, totalSpecs: 0 }}}).includes('aucun critère'));
  const html = blocAcceptanceCriteria({ acceptanceCriteria: {
    items: [{ id: 'A', titre: 't', file: null, statut: 'done', sectionAC: 2, ears: 1, checkboxes: { total: 3, faits: 2 }, total: 6, progression: 67 }],
    totaux: { specsAvecAC: 1, totalSpecs: 1, sansAC: 0, totalCriteres: 6, totalEars: 1, totalCheckboxes: 3, checkboxesFaits: 2 },
  }});
  assert.ok(html.includes('Critères d\'acceptation'));
  assert.ok(html.includes('67%'));
});

// ─── #544 — Action items ────────────────────────────────────────────────────

test('extraireActions — parse checkboxes avec source + intent ref', () => {
  const r = extraireActions('- [ ] Action 1 INTENT-101\n- [x] Action 2', 'journal', 'f.md', Date.now());
  assert.equal(r.length, 2);
  assert.equal(r[0].fait, false);
  assert.equal(r[0].intent, 'INTENT-101');
  assert.equal(r[1].fait, true);
});

function avecRepo(struct) {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-ai-'));
  for (const [chemin, contenu] of Object.entries(struct)) {
    const cible = join(racine, chemin);
    mkdirSync(join(cible, '..'), { recursive: true });
    writeFileSync(cible, contenu);
  }
  return racine;
}

test('calculerActionItems — lit pm-journal + facts + retro', () => {
  const racine = avecRepo({
    '.aiad/metrics/pm-journal/2026-05-15.md': '- [ ] todo j\n- [x] done j',
    '.aiad/facts/FACT-001.md': '- [ ] todo fact',
    '.aiad/metrics/retro/2026-05-10.md': '- [ ] todo retro',
  });
  const r = calculerActionItems(racine);
  assert.equal(r.totaux.total, 4);
  assert.equal(r.totaux.nonFaits, 3);
  assert.equal(r.totaux.faits, 1);
  rmSync(racine, { recursive: true, force: true });
});

test('blocActionItems — empty + rendu rows + non-faits', () => {
  assert.ok(blocActionItems({ actionItems: { items: [], totaux: { total: 0 }, nonFaits: [], faits: [] }}).includes('aucun'));
  const html = blocActionItems({ actionItems: {
    items: [{ description: 'todo', fait: false, source: 'journal', fichier: 'f.md', date: Date.now(), intent: 'INTENT-101' }],
    nonFaits: [{ description: 'todo', fait: false, source: 'journal', fichier: 'f.md', date: Date.now(), intent: 'INTENT-101' }],
    faits: [],
    totaux: { total: 1, nonFaits: 1, faits: 0, tauxCompletion: 0 },
  }});
  assert.ok(html.includes('Action items journaux'));
  assert.ok(html.includes('INTENT-101'));
  assert.ok(html.includes('s-journal'));
});

// ─── #545 — OKR progress ────────────────────────────────────────────────────

test('calculerOkrProgress — calcule % par KR', () => {
  const r = calculerOkrProgress({
    okrMapping: { objectifs: [
      { id: 'O1', description: 'Obj 1', keyResults: [
        { id: 'KR-1.1', description: 'KR 1.1', intents: [{ id: 'INTENT-A' }] },
        { id: 'KR-1.2', description: 'KR 1.2', intents: [] },
      ]},
    ]},
    specs: [
      { parentIntent: 'INTENT-A', statut: 'done' },
      { parentIntent: 'INTENT-A', statut: 'in-progress' },
    ],
  });
  const obj = r.objectifs[0];
  assert.equal(obj.krs.length, 2);
  const kr11 = obj.krs.find((k) => k.id === 'KR-1.1');
  assert.equal(kr11.pct, 50);
  assert.equal(kr11.etat, 'risque');
  const kr12 = obj.krs.find((k) => k.id === 'KR-1.2');
  assert.equal(kr12.etat, 'sans-data');
});

test('calculerOkrProgress — message si pas d\'OKR', () => {
  const r = calculerOkrProgress({});
  assert.ok(r.message);
});

test('blocOkrProgress — empty + rendu cards + KR colorés', () => {
  assert.ok(blocOkrProgress({ okrProgress: { message: 'no okr', objectifs: [] }}).includes('no okr'));
  const html = blocOkrProgress({ okrProgress: {
    objectifs: [{
      id: 'O1', description: 'desc',
      krs: [{ id: 'KR-1.1', description: 'kr1', nbIntents: 1, totalSpecs: 2, livreesSpecs: 2, pct: 100, etat: 'atteint' }],
      pctMoyen: 100,
    }],
    totaux: { nbObjectifs: 1, nbKr: 1, krAtteints: 1, krEnPeril: 0 },
  }});
  assert.ok(html.includes('Progression OKR'));
  assert.ok(html.includes('e-atteint'));
  assert.ok(html.includes('100%'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof extractCriteria, 'function');
  assert.equal(typeof computeAcceptanceCriteria, 'function');
  assert.equal(typeof acceptanceCriteriaSection, 'function');
  assert.equal(typeof extractActions, 'function');
  assert.equal(typeof computeActionItems, 'function');
  assert.equal(typeof actionItemsSection, 'function');
  assert.equal(typeof computeOkrProgress, 'function');
  assert.equal(typeof okrProgressSection, 'function');
});
