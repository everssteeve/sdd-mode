// Tests #528 / #529 / #530 — Boucle 37 PM done-timeline/prd-sections-coverage/outcome-completion

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  calculerDoneTimeline, blocDoneTimeline,
  computeDoneTimeline, doneTimelineSection,
} from '../lib/dashboard/done-timeline.js';

import {
  parserSectionsPrd, classerSection, calculerPrdSectionsCoverage, blocPrdSectionsCoverage,
  parsePrdSections, classifySection, computePrdSectionsCoverage, prdSectionsCoverageSection,
} from '../lib/dashboard/prd-sections-coverage.js';

import {
  calculerOutcomeCompletion, blocOutcomeCompletion,
  computeOutcomeCompletion, outcomeCompletionSection,
} from '../lib/dashboard/outcome-completion.js';

const DAY = 24 * 3600 * 1000;

// ─── #528 — Done timeline ────────────────────────────────────────────────────

test('calculerDoneTimeline — groupe par mois sur fenêtre N mois', () => {
  const now = Date.UTC(2026, 4, 15);
  const r = calculerDoneTimeline({
    intents: [{ id: 'A', statut: 'done', mtime: Date.UTC(2026, 4, 1) }],
    specs: [{ id: 'S', statut: 'done', mtime: Date.UTC(2026, 3, 15) }],
  }, { now, moisMax: 3 });
  assert.equal(r.items.length, 3);
  const mai = r.items.find((b) => b.cle === '2026-05');
  assert.equal(mai.intents.length, 1);
  const avr = r.items.find((b) => b.cle === '2026-04');
  assert.equal(avr.specs.length, 1);
});

test('calculerDoneTimeline — empty si rien', () => {
  const r = calculerDoneTimeline({});
  assert.equal(r.totaux.totalSpecs, 0);
  assert.equal(r.totaux.totalIntents, 0);
});

test('calculerDoneTimeline — exclut hors-fenêtre', () => {
  const now = Date.UTC(2026, 4, 15);
  const r = calculerDoneTimeline({
    specs: [{ statut: 'done', mtime: Date.UTC(2025, 0, 1) }], // > 6 mois
  }, { now, moisMax: 6 });
  assert.equal(r.totaux.totalSpecs, 0);
});

test('blocDoneTimeline — rendu empty + items', () => {
  assert.ok(blocDoneTimeline({ doneTimeline: { items: [{ label: 'janv. 2026', specs: [], intents: [] }], totaux: { moisAffiches: 1, totalSpecs: 0, totalIntents: 0 }}}).includes('aucun livrable'));
  const html = blocDoneTimeline({ doneTimeline: {
    items: [{ cle: '2026-05', label: 'mai 2026', intents: [{ id: 'A', titre: 't' }], specs: [{ id: 'S', titre: 's' }]}],
    totaux: { moisAffiches: 1, totalSpecs: 1, totalIntents: 1, moisPlusActif: 'mai 2026' },
  }});
  assert.ok(html.includes('Timeline des livraisons'));
  assert.ok(html.includes('dt-bar'));
});

// ─── #529 — PRD sections coverage ───────────────────────────────────────────

test('parserSectionsPrd — détecte sections h2', () => {
  const md = `## 1. Contexte\nfoo bar\n\n## 2. North Star\nmots ` + 'mot '.repeat(50);
  const s = parserSectionsPrd(md);
  assert.equal(s.length, 2);
  assert.match(s[0].titre, /Contexte/);
  assert.ok(s[1].mots >= 50);
});

test('parserSectionsPrd — strip frontmatter', () => {
  const md = `---\nfoo: bar\n---\n## Test\nblabla`;
  const s = parserSectionsPrd(md);
  assert.equal(s.length, 1);
});

test('classerSection — états selon nb mots', () => {
  assert.equal(classerSection({ mots: 0 }), 'vide');
  assert.equal(classerSection({ mots: 10 }), 'squelette');
  assert.equal(classerSection({ mots: 100 }), 'leger');
  assert.equal(classerSection({ mots: 500 }), 'fourni');
});

test('calculerPrdSectionsCoverage — fichier absent → message', () => {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-no-prd-'));
  const r = calculerPrdSectionsCoverage(racine);
  assert.equal(r.present, false);
  assert.ok(r.message);
  rmSync(racine, { recursive: true, force: true });
});

test('calculerPrdSectionsCoverage — détecte sections canoniques', () => {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-prd-'));
  mkdirSync(join(racine, '.aiad'), { recursive: true });
  writeFileSync(join(racine, '.aiad', 'PRD.md'), '## 1. Contexte\nfoo\n## 2. North Star\nbar\n## Autre');
  const r = calculerPrdSectionsCoverage(racine);
  assert.equal(r.present, true);
  assert.equal(r.sections.length, 3);
  const contexte = r.canoniques.find((c) => c.label === 'Contexte');
  assert.equal(contexte.present, true);
  rmSync(racine, { recursive: true, force: true });
});

test('blocPrdSectionsCoverage — rendu canoniques + sections', () => {
  assert.ok(blocPrdSectionsCoverage({ prdSectionsCoverage: { present: false, message: 'absent' }}).includes('absent'));
  const html = blocPrdSectionsCoverage({ prdSectionsCoverage: {
    present: true,
    sections: [{ titre: 'Contexte', mots: 100, etat: 'leger' }],
    canoniques: [
      { label: 'Contexte', numero: 1, present: true, mots: 100, etat: 'leger' },
      { label: 'North Star', numero: 2, present: false },
    ],
    totaux: { sections: 1, vides: 0, squelettes: 0, legers: 1, fournis: 0, canoniquesPresents: 1, canoniquesAbsents: 1 },
  }});
  assert.ok(html.includes('Couverture sections PRD'));
  assert.ok(html.includes('present'));
  assert.ok(html.includes('absent'));
});

// ─── #530 — Outcome completion ──────────────────────────────────────────────

test('calculerOutcomeCompletion — calcule % par outcome', () => {
  const r = calculerOutcomeCompletion({
    prdCoverage: { outcomes: [
      { titre: 'O1', intents: [{ id: 'A' }, { id: 'B' }] },
      { titre: 'O2', intents: [{ id: 'C' }] },
    ]},
    specs: [
      { parentIntent: 'A', statut: 'done' },
      { parentIntent: 'A', statut: 'in-progress' },
      { parentIntent: 'B', statut: 'done' },
      { parentIntent: 'C', statut: 'done' },
      { parentIntent: 'C', statut: 'in-progress' },
    ],
  });
  const o1 = r.items.find((i) => i.titre === 'O1');
  // O1 : 2 livrées sur 3 specs = 67%
  assert.equal(o1.pct, 67);
  assert.equal(o1.etat, 'avance');
  const o2 = r.items.find((i) => i.titre === 'O2');
  // O2 : 1 livrée sur 2 specs = 50%
  assert.equal(o2.pct, 50);
  assert.equal(o2.etat, 'progresse');
});

test('calculerOutcomeCompletion — sans-data si aucune SPEC', () => {
  const r = calculerOutcomeCompletion({
    prdCoverage: { outcomes: [{ titre: 'O', intents: [] }]},
  });
  assert.equal(r.items[0].etat, 'sans-data');
  assert.equal(r.items[0].pct, null);
});

test('calculerOutcomeCompletion — empty si pas d\'outcomes', () => {
  const r = calculerOutcomeCompletion({});
  assert.equal(r.items.length, 0);
});

test('blocOutcomeCompletion — empty + rendu rows', () => {
  assert.ok(blocOutcomeCompletion({ outcomeCompletion: { items: [], totaux: {}}}).includes('aucun outcome'));
  const html = blocOutcomeCompletion({ outcomeCompletion: {
    items: [{ titre: 'O1', target: null, nbIntents: 2, totalSpecs: 3, livreesSpecs: 2, pct: 67, etat: 'avance' }],
    totaux: { outcomes: 1, complet: 0, avance: 1, progresse: 0, debut: 0, sansData: 0, pctMoyen: 67 },
  }});
  assert.ok(html.includes('Complétion des outcomes'));
  assert.ok(html.includes('e-avance'));
  assert.ok(html.includes('67%'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof computeDoneTimeline, 'function');
  assert.equal(typeof doneTimelineSection, 'function');
  assert.equal(typeof parsePrdSections, 'function');
  assert.equal(typeof classifySection, 'function');
  assert.equal(typeof computePrdSectionsCoverage, 'function');
  assert.equal(typeof prdSectionsCoverageSection, 'function');
  assert.equal(typeof computeOutcomeCompletion, 'function');
  assert.equal(typeof outcomeCompletionSection, 'function');
});
