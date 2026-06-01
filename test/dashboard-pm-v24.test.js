// Tests #489 / #490 / #491 — Boucle 24 PM stakeholder-comms/decision-velocity/weekly-checklist

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  scannerMentionsJournal, calculerStakeholderComms, blocStakeholderComms,
  scanJournalMentions, computeStakeholderComms, stakeholderCommsSection,
} from '../lib/dashboard/stakeholder-comms.js';

import {
  compterDecisionsJournal, bucketsHebdo, calculerDecisionVelocity, blocDecisionVelocity,
  countJournalDecisions, weeklyBuckets, computeDecisionVelocity, decisionVelocitySection,
} from '../lib/dashboard/decision-velocity.js';

import {
  semaineIso, calculerWeeklyChecklist, blocWeeklyChecklist,
  isoWeek, computeWeeklyChecklist, weeklyChecklistSection, WEEKLY_TASKS,
} from '../lib/dashboard/pm-weekly-checklist.js';

const DAY = 24 * 3600 * 1000;

function avecRepo(struct) {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-loop24-'));
  const aiad = join(racine, '.aiad');
  mkdirSync(aiad, { recursive: true });
  for (const [chemin, contenu] of Object.entries(struct)) {
    const cible = join(racine, chemin);
    mkdirSync(join(cible, '..'), { recursive: true });
    writeFileSync(cible, contenu);
  }
  return racine;
}

// ─── #489 — Stakeholder comms ───────────────────────────────────────────────

test('scannerMentionsJournal — extrait mentions INTENT-NNN avec date du nom', () => {
  const racine = avecRepo({
    '.aiad/metrics/pm-journal/2026-05-10.md': '# 2026-05-10\nINTENT-101 avance.\nINTENT-102 en review.',
    '.aiad/metrics/pm-journal/2026-05-15.md': '# 2026-05-15\nINTENT-101 livré.',
  });
  const m = scannerMentionsJournal(racine);
  assert.equal(m.size, 2);
  // INTENT-101 mentionné dans les 2 → date plus récente
  assert.ok(m.get('INTENT-101') > m.get('INTENT-102'));
  rmSync(racine, { recursive: true, force: true });
});

test('calculerStakeholderComms — classe recent/tiède/silencieux', () => {
  const racine = avecRepo({
    '.aiad/metrics/pm-journal/2026-05-15.md': 'INTENT-101 mentionné',
  });
  const r = calculerStakeholderComms(racine, {
    intents: [
      { id: 'INTENT-101', titre: 'a', statut: 'active' },
      { id: 'INTENT-999', titre: 'silencieux', statut: 'active' },
    ],
  }, { now: Date.UTC(2026, 4, 18) }); // 2026-05-18, donc 3 jours après mention
  assert.equal(r.items.length, 2);
  // Silencieux d'abord (tri)
  assert.equal(r.items[0].id, 'INTENT-999');
  assert.equal(r.items[0].etat, 'silencieux');
  assert.equal(r.items[1].id, 'INTENT-101');
  assert.equal(r.items[1].etat, 'recent');
  rmSync(racine, { recursive: true, force: true });
});

test('blocStakeholderComms — rendu + empty', () => {
  assert.ok(blocStakeholderComms({ stakeholderComms: { items: [], totaux: {}, lastDemo: null }}).includes('aucun Intent'));
  const html = blocStakeholderComms({ stakeholderComms: {
    items: [{ id: 'INTENT-A', titre: 't', file: null, statut: 'active', sponsor: 'X', derniereComm: Date.now() - 40 * DAY, jours: 40, etat: 'silencieux' }],
    totaux: { total: 1, recent: 0, tiede: 0, silencieux: 1 },
    lastDemo: null, lastSync: null, mentions: 0,
  }});
  assert.ok(html.includes('Communication stakeholder'));
  assert.ok(html.includes('row-silencieux'));
  assert.ok(html.includes('silencieux'));
});

// ─── #490 — Decision velocity ───────────────────────────────────────────────

test('compterDecisionsJournal — bullets sous ## Décisions', () => {
  const md = `# 2026-05-15\n\n## Décisions\n- Décidé A\n- Décidé B\n\n## Notes\n- pas une décision\n`;
  assert.equal(compterDecisionsJournal(md), 2);
});

test('compterDecisionsJournal — alias EN "## Decisions"', () => {
  const md = `## Decisions\n- D1\n* D2\n`;
  assert.equal(compterDecisionsJournal(md), 2);
});

test('compterDecisionsJournal — empty si pas de section décisions', () => {
  assert.equal(compterDecisionsJournal('## Notes\n- foo'), 0);
});

test('bucketsHebdo — N buckets vide si zéro décision', () => {
  const b = bucketsHebdo([], { now: Date.UTC(2026, 4, 15), nbBuckets: 4 });
  assert.equal(b.length, 4);
  assert.equal(b.reduce((s, x) => s + x.count, 0), 0);
});

test('bucketsHebdo — réparti correctement par semaine', () => {
  const now = Date.UTC(2026, 4, 15);
  const decisions = [
    { ts: now - 2 * DAY },     // semaine courante
    { ts: now - 8 * DAY },     // -1 semaine
    { ts: now - 15 * DAY },    // -2 semaines
  ];
  const b = bucketsHebdo(decisions, { now, nbBuckets: 4 });
  // bucket[3] = courant, bucket[2] = -1, bucket[1] = -2
  assert.equal(b[3].count, 1);
  assert.equal(b[2].count, 1);
  assert.equal(b[1].count, 1);
});

test('calculerDecisionVelocity — compose lecture + tendance + inertie', () => {
  const racine = avecRepo({
    '.aiad/metrics/pm-journal/2026-05-15.md': '## Décisions\n- A\n- B\n',
    '.aiad/facts/FACT-001.md': 'fact 1',
  });
  const v = calculerDecisionVelocity(racine, {}, { now: Date.UTC(2026, 4, 17), nbBuckets: 4 });
  assert.equal(v.total, 3); // 2 journal + 1 fact
  assert.equal(v.nbJournal, 2);
  assert.equal(v.nbFacts, 1);
  rmSync(racine, { recursive: true, force: true });
});

test('blocDecisionVelocity — empty + inertie + rendu SVG', () => {
  assert.ok(blocDecisionVelocity({ decisionVelocity: { total: 0, buckets: [], moyenne: 0, slope: 0 }}).includes('aucune décision'));
  const html = blocDecisionVelocity({ decisionVelocity: {
    total: 5, moyenne: 1.25, slope: 0.6, tendance: 'acceleration', inertie: false,
    nbJournal: 4, nbFacts: 1,
    buckets: [
      { count: 0, decisions: [] }, { count: 1, decisions: [] },
      { count: 2, decisions: [] }, { count: 2, decisions: [] },
    ],
  }});
  assert.ok(html.includes('Vélocité décisionnelle'));
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('accélération'));
});

test('blocDecisionVelocity — inertie box si inertie=true', () => {
  const html = blocDecisionVelocity({ decisionVelocity: {
    total: 3, moyenne: 0.5, slope: -0.5, tendance: 'deceleration', inertie: true,
    nbJournal: 3, nbFacts: 0,
    buckets: [
      { count: 1, decisions: [] }, { count: 2, decisions: [] },
      { count: 0, decisions: [] }, { count: 0, decisions: [] },
    ],
  }});
  assert.ok(html.includes('Inertie décisionnelle'));
  assert.ok(html.includes('dv-inertie'));
});

// ─── #491 — PM weekly checklist ─────────────────────────────────────────────

test('semaineIso — format YYYY-WNN', () => {
  // 2026-05-15 (vendredi) → semaine 20 selon ISO-8601
  const s = semaineIso(new Date(Date.UTC(2026, 4, 15)));
  assert.match(s, /^\d{4}-W\d{2}$/);
});

test('semaineIso — différent pour deux semaines distantes', () => {
  const a = semaineIso(new Date(Date.UTC(2026, 4, 11))); // lundi
  const b = semaineIso(new Date(Date.UTC(2026, 4, 18))); // semaine suivante
  assert.notEqual(a, b);
});

test('calculerWeeklyChecklist — expose semaine + taches statiques', () => {
  const w = calculerWeeklyChecklist({ date: new Date(Date.UTC(2026, 4, 15)) });
  assert.match(w.semaine, /^\d{4}-W\d{2}$/);
  assert.ok(w.taches.length >= 5);
  assert.equal(w.taches[0].cadence, 'hebdo');
});

test('blocWeeklyChecklist — rendu + checkboxes + script localStorage', () => {
  const html = blocWeeklyChecklist({ weeklyChecklist: {
    semaine: '2026-W20',
    taches: [
      { id: 'tache-1', titre: 'Test 1', jour: 'Lundi', cadence: 'hebdo', anchor: '#a' },
      { id: 'tache-2', titre: 'Test 2', jour: 'Mensuel', cadence: 'mensuel', anchor: null },
    ],
  }});
  assert.ok(html.includes('Checklist hebdomadaire PM'));
  assert.ok(html.includes('data-semaine="2026-W20"'));
  assert.ok(html.includes('data-tache="tache-1"'));
  assert.ok(html.includes('aiad-pm-checklist-'));
  assert.ok(html.includes('localStorage'));
  assert.ok(html.includes('data-wc-action="reset"'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof scanJournalMentions, 'function');
  assert.equal(typeof computeStakeholderComms, 'function');
  assert.equal(typeof stakeholderCommsSection, 'function');
  assert.equal(typeof countJournalDecisions, 'function');
  assert.equal(typeof weeklyBuckets, 'function');
  assert.equal(typeof computeDecisionVelocity, 'function');
  assert.equal(typeof decisionVelocitySection, 'function');
  assert.equal(typeof isoWeek, 'function');
  assert.equal(typeof computeWeeklyChecklist, 'function');
  assert.equal(typeof weeklyChecklistSection, 'function');
  assert.ok(Array.isArray(WEEKLY_TASKS));
});
