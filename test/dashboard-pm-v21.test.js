// Tests #480 / #481 / #482 — Boucle 21 PM cockpit tabs/md-export/ai-act

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  blocCockpitTabs, SECTION_TO_TABS,
  cockpitTabsSection, SLUG_TO_TABS,
} from '../lib/dashboard/cockpit-tabs.js';

import {
  blocPmMdExport, pmCockpitToMarkdown,
  pmMdExportSection, pmCockpitMarkdown,
} from '../lib/dashboard/pm-md-export.js';

import {
  analyserIntentIa, calculerAiActCompliance, blocAiActCompliance,
  analyseIntentAi, computeAiActCompliance, aiActComplianceSection,
  AI_KEYWORDS,
} from '../lib/dashboard/ai-act-compliance.js';
const KEYWORDS_AI = AI_KEYWORDS;

// ─── #480 — Cockpit tabs ─────────────────────────────────────────────────────

test('blocCockpitTabs — tabs container + 5 onglets + localStorage', () => {
  const html = blocCockpitTabs();
  assert.ok(html.includes('class="pm-cockpit-tabs"'));
  assert.ok(html.includes('data-tab="all"'));
  assert.ok(html.includes('data-tab="tactique"'));
  assert.ok(html.includes('data-tab="strategique"'));
  assert.ok(html.includes('data-tab="communication"'));
  assert.ok(html.includes('data-tab="rituels"'));
  assert.ok(html.includes('aiad-pm-tab'));
  assert.ok(html.includes('localStorage'));
});

test('SECTION_TO_TABS — couvre sections h2 majeures', () => {
  assert.ok(Object.keys(SECTION_TO_TABS).length >= 5);
  // Au moins quelques slugs courants doivent exister
  const slugs = Object.keys(SECTION_TO_TABS);
  assert.ok(slugs.some((s) => /risque/i.test(s) || /risk/i.test(s)));
});

// ─── #481 — PM Markdown export ───────────────────────────────────────────────

test('pmCockpitToMarkdown — sections + titre + counts', () => {
  const md = pmCockpitToMarkdown({
    projet: { nom: 'test-proj' },
    pm: {
      zombies: [],
      draftsAnciens: [],
      specsNonDemontrees: [],
      funnel: { idea: 1, validated: 2, inDelivery: 3, done: 4, archived: 0 },
      avancement: [],
    },
    deadlines: { items: [] },
    intents: [],
    specs: [],
    santeGlobale: { score: 80, total: 100, niveau: 'bon' },
  });
  assert.ok(md.includes('# Cockpit PM'));
  assert.ok(md.includes('## État général'));
  assert.ok(md.includes('Santé projet'));
});

test('pmCockpitToMarkdown — Top 5 priorités via intents tri priority', () => {
  const md = pmCockpitToMarkdown({
    pm: { zombies: [], draftsAnciens: [], specsNonDemontrees: [], funnel: {}, avancement: [] },
    intents: [
      { id: 'A', titre: 't1', priority: 'P0', statut: 'active' },
      { id: 'B', titre: 't2', priority: 'P1', statut: 'draft' },
      { id: 'D', titre: 't-done', priority: 'P0', statut: 'done' }, // exclu
    ],
  });
  assert.ok(md.includes('Top 5'));
  assert.ok(md.includes('P0'));
  assert.ok(md.includes('t1'));
  assert.ok(!md.includes('t-done'), 'done exclu du pipeline');
});

test('blocPmMdExport — bouton download + JS Blob', () => {
  const html = blocPmMdExport({ pm: { zombies: [], draftsAnciens: [], specsNonDemontrees: [], funnel: {} } });
  assert.ok(html.includes('Export Markdown complet') || html.includes('pm-export'));
  assert.ok(html.includes('Blob') || html.includes('download'));
});

// ─── #482 — AI Act compliance ────────────────────────────────────────────────

test('analyserIntentIa — frontmatter ai_risk prioritaire', () => {
  const r = analyserIntentIa({ id: 'A', titre: 'sans keyword', ai_risk: 'high' });
  assert.equal(r.isAi, true);
  assert.equal(r.niveau, 'high');
  assert.equal(r.source, 'frontmatter');
});

test('analyserIntentIa — frontmatter invalide → heuristique', () => {
  const r = analyserIntentIa({ id: 'A', titre: 'chatbot support', ai_risk: 'inconnu' });
  assert.equal(r.isAi, true);
  assert.equal(r.source, 'heuristique');
  assert.equal(r.niveau, 'limited');
});

test('analyserIntentIa — heuristique détecte chatbot/llm/biométrie', () => {
  const r1 = analyserIntentIa({ id: 'A', titre: 'Chatbot pour le support' });
  assert.equal(r1.isAi, true);
  assert.equal(r1.niveau, 'limited');

  const r2 = analyserIntentIa({ id: 'B', titre: 'Reconnaissance faciale entrée bâtiment' });
  assert.equal(r2.isAi, true);
  assert.equal(r2.niveau, 'high');

  const r3 = analyserIntentIa({ id: 'C', titre: 'Recommandation produit homepage' });
  assert.equal(r3.isAi, true);
  assert.equal(r3.niveau, 'minimal');
});

test('analyserIntentIa — pire niveau retenu (multi-keywords)', () => {
  const r = analyserIntentIa({
    id: 'A',
    titre: 'chatbot avec biometric login',
  });
  assert.equal(r.niveau, 'high'); // biometric > chatbot
});

test('analyserIntentIa — non-IA → isAi false', () => {
  const r = analyserIntentIa({ id: 'A', titre: 'Checkout SEPA Stripe' });
  assert.equal(r.isAi, false);
  assert.equal(r.niveau, null);
});

test('calculerAiActCompliance — totaux + tri par niveau', () => {
  const r = calculerAiActCompliance({
    intents: [
      { id: 'A', titre: 'chatbot', statut: 'active' },
      { id: 'B', titre: 'recrutement IA', statut: 'draft' },
      { id: 'C', titre: 'machine learning vague', statut: 'active' },
      { id: 'D', titre: 'pas IA', statut: 'active' },
    ],
  });
  assert.equal(r.items.length, 3);
  assert.equal(r.totaux.high, 1);
  assert.equal(r.totaux.limited, 1);
  assert.equal(r.totaux.minimal, 1);
  // Tri pire d'abord
  assert.equal(r.items[0].niveau, 'high');
});

test('blocAiActCompliance — empty + rendu cartes + warning', () => {
  assert.ok(blocAiActCompliance({ aiActCompliance: { items: [], totaux: { total: 0 } } }).includes('aucun Intent IA'));
  const html = blocAiActCompliance({ aiActCompliance: {
    items: [{
      id: 'INTENT-A', titre: 'chatbot', file: null, statut: 'active',
      isAi: true, niveau: 'high', source: 'heuristique', keywords: ['chatbot'], categories: ['Annexe III — Biométrie'],
    }],
    totaux: { total: 1, unacceptable: 0, high: 1, limited: 0, minimal: 0, explicite: 0, heuristique: 1 },
  }});
  assert.ok(html.includes('Conformité EU AI Act'));
  assert.ok(html.includes('aiact-card niveau-high'));
  assert.ok(html.includes('INTENT-A'));
  assert.ok(html.includes('⚠ Risque AI Act'));
});

test('KEYWORDS_AI — couvre 4 niveaux AI Act', () => {
  const niveaux = new Set(KEYWORDS_AI.map((k) => k.niveau));
  assert.ok(niveaux.has('unacceptable'));
  assert.ok(niveaux.has('high'));
  assert.ok(niveaux.has('limited'));
  assert.ok(niveaux.has('minimal'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof cockpitTabsSection, 'function');
  assert.equal(SLUG_TO_TABS, SECTION_TO_TABS);
  assert.equal(typeof pmMdExportSection, 'function');
  assert.equal(typeof pmCockpitMarkdown, 'function');
  assert.equal(typeof analyseIntentAi, 'function');
  assert.equal(typeof computeAiActCompliance, 'function');
  assert.equal(typeof aiActComplianceSection, 'function');
  assert.ok(Array.isArray(AI_KEYWORDS));
});
