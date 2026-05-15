// Tests #459 / #460 / #461 — Boucle 14 PM cockpit confidence/journal/markdown :
//   - confidence tracker
//   - PM journal (lecture)
//   - markdown render léger (anti-XSS + sécurisé)

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  bandeConfidence, calculerConfidenceTracker, blocConfidenceTracker,
  readConfidencePct, confidenceBand, computeConfidenceTracker, confidenceTrackerSection,
} from '../lib/dashboard/confidence-tracker.js';

import {
  lireJournalEntries, blocPmJournal,
  readJournalEntries, pmJournalSection,
} from '../lib/dashboard/pm-journal.js';

import {
  rendreLigneInline, rendreMarkdown, rendreSectionIntent,
  renderInlineLine, renderMarkdown, renderIntentSection,
} from '../lib/dashboard/markdown-light.js';

function tmpProjet() {
  const dir = join(tmpdir(), 'aiad-pm-v14-' + Math.random().toString(36).slice(2));
  mkdirSync(join(dir, '.aiad'), { recursive: true });
  return dir;
}

// ─── #459 — Confidence tracker ──────────────────────────────────────────────

test('bandeConfidence — 4 paliers + inconnu', () => {
  assert.equal(bandeConfidence(90), 'solide');
  assert.equal(bandeConfidence(80), 'solide');
  assert.equal(bandeConfidence(60), 'raisonnable');
  assert.equal(bandeConfidence(30), 'faible');
  assert.equal(bandeConfidence(10), 'tres-faible');
  assert.equal(bandeConfidence(null), 'inconnu');
});

test('calculerConfidenceTracker — confidence numérique 0-100', () => {
  const r = calculerConfidenceTracker({
    intents: [
      { id: 'A', titre: 't', statut: 'active', confidence: 85 },
      { id: 'B', titre: 't', statut: 'active', confidence: 35 },
    ],
    hypotheses: { hypotheses: [] },
  });
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].pct, 35, 'pari risqué (faible + active) d\'abord');
  assert.equal(r.items[0].bande, 'faible');
  assert.equal(r.items[1].pct, 85);
});

test('calculerConfidenceTracker — confidence fraction 0-1 convertie', () => {
  const r = calculerConfidenceTracker({
    intents: [{ id: 'A', statut: 'draft', confidence: 0.75 }],
    hypotheses: { hypotheses: [] },
  });
  assert.equal(r.items[0].pct, 75);
});

test('calculerConfidenceTracker — confidence_level mapped to pct', () => {
  const r = calculerConfidenceTracker({
    intents: [
      { id: 'A', statut: 'active', confidence_level: 'high' },
      { id: 'B', statut: 'active', confidence_level: 'low' },
    ],
    hypotheses: { hypotheses: [] },
  });
  const a = r.items.find((i) => i.id === 'A');
  const b = r.items.find((i) => i.id === 'B');
  assert.equal(a.pct, 90);
  assert.equal(b.pct, 30);
});

test('calculerConfidenceTracker — hypothèse réutilisée si déjà calculée (#440)', () => {
  const r = calculerConfidenceTracker({
    intents: [{ id: 'A', statut: 'active', confidence: 50 }],
    hypotheses: { hypotheses: [{ id: 'A', hypothese: 'Si X alors Y', statut: 'untested' }] },
  });
  assert.equal(r.items[0].hypothese, 'Si X alors Y');
  assert.equal(r.items[0].hypStatut, 'untested');
});

test('calculerConfidenceTracker — totaux paris risqués', () => {
  const r = calculerConfidenceTracker({
    intents: [
      { id: 'A', statut: 'active', confidence: 15 }, // tres-faible + active → pari
      { id: 'B', statut: 'active', confidence: 30 }, // faible + active → pari
      { id: 'C', statut: 'active', confidence: 85 }, // solide
      { id: 'D', statut: 'draft', confidence: 20 }, // pas active → pas compté pari
    ],
    hypotheses: { hypotheses: [] },
  });
  assert.equal(r.totaux.paris, 2);
  assert.equal(r.totaux.solides, 1);
});

test('blocConfidenceTracker — empty si zéro item', () => {
  assert.ok(blocConfidenceTracker({ confidenceTracker: { items: [], totaux: { total: 0 } } }).includes('aucune confidence'));
});

test('blocConfidenceTracker — rend cards avec barres + badges', () => {
  const html = blocConfidenceTracker({ confidenceTracker: {
    items: [{ id: 'INTENT-A', titre: 't', file: null, statut: 'active', pct: 35, bande: 'faible', hypothese: 'Si X' }],
    totaux: { total: 1, paris: 1, solides: 0 },
  }});
  assert.ok(html.includes('Confidence tracker'));
  assert.ok(html.includes('bande-faible'));
  assert.ok(html.includes('conf-bar-fill'));
  assert.ok(html.includes('35 %'));
  assert.ok(html.includes('Si X'));
});

// ─── #460 — PM journal ──────────────────────────────────────────────────────

test('lireJournalEntries — vide si pas de dossier', () => {
  const dir = tmpProjet();
  try {
    const r = lireJournalEntries(dir);
    assert.equal(r.entries.length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireJournalEntries — tri par date desc + compte items', () => {
  const dir = tmpProjet();
  try {
    mkdirSync(join(dir, '.aiad', 'metrics', 'pm-journal'), { recursive: true });
    writeFileSync(join(dir, '.aiad', 'metrics', 'pm-journal', '2026-05-14.md'),
      '# 2026-05-14\n- Item A\n- Item B\n* Item C\n');
    writeFileSync(join(dir, '.aiad', 'metrics', 'pm-journal', '2026-05-15.md'),
      '# 2026-05-15\n- Item D\n');
    writeFileSync(join(dir, '.aiad', 'metrics', 'pm-journal', 'README.md'), 'ignored');
    const r = lireJournalEntries(dir);
    assert.equal(r.entries.length, 2);
    assert.equal(r.entries[0].date, '2026-05-15', 'desc');
    assert.equal(r.entries[0].items, 1);
    assert.equal(r.entries[1].items, 3);
    assert.equal(r.totalEntries, 4);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireJournalEntries — limite respectée', () => {
  const dir = tmpProjet();
  try {
    mkdirSync(join(dir, '.aiad', 'metrics', 'pm-journal'), { recursive: true });
    for (let d = 1; d <= 10; d++) {
      writeFileSync(join(dir, '.aiad', 'metrics', 'pm-journal', `2026-05-${String(d).padStart(2, '0')}.md`),
        `# day ${d}\n- entry\n`);
    }
    const r = lireJournalEntries(dir, { limite: 3 });
    assert.equal(r.entries.length, 3);
    assert.equal(r.totalJours, 10);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('blocPmJournal — empty + commande capture', () => {
  const html = blocPmJournal({ pmJournal: { entries: [], totalEntries: 0, totalJours: 0, fichier: null } });
  assert.ok(html.includes('aucune entrée'));
  // La commande est escape-HTMLée : `>>` devient `&gt;&gt;` dans le <pre>.
  assert.ok(html.includes('mkdir -p .aiad/metrics/pm-journal'));
  assert.ok(html.includes('cat &gt;&gt;'));
});

test('blocPmJournal — rend items + commande capture', () => {
  const html = blocPmJournal({ pmJournal: {
    entries: [{ date: '2026-05-15', fichier: null, contenu: '# 2026-05-15\n- Décision X', items: 1, mtime: 0 }],
    totalEntries: 1, totalJours: 1, fichier: '.aiad/metrics/pm-journal',
  }});
  assert.ok(html.includes('Journal PM'));
  assert.ok(html.includes('journal-item'));
  assert.ok(html.includes('2026-05-15'));
  assert.ok(html.includes('Décision X'));
  assert.ok(html.includes('cat &gt;&gt;'));
});

// ─── #461 — Markdown render léger ───────────────────────────────────────────

test('rendreMarkdown — gras + italic + code inline', () => {
  const r = rendreMarkdown('Texte **gras** et *italic* et `code`');
  assert.ok(r.includes('<strong>gras</strong>'));
  assert.ok(r.includes('<em>italic</em>'));
  assert.ok(r.includes('<code>code</code>'));
});

test('rendreMarkdown — listes ul et ol', () => {
  const ul = rendreMarkdown('- Item A\n- Item B');
  assert.ok(ul.includes('<ul><li>Item A</li><li>Item B</li></ul>'));
  const ol = rendreMarkdown('1. Premier\n2. Second');
  assert.ok(ol.includes('<ol><li>Premier</li><li>Second</li></ol>'));
});

test('rendreMarkdown — paragraphes séparés par lignes vides', () => {
  const r = rendreMarkdown('Para A\n\nPara B');
  assert.ok(r.includes('<p>Para A</p>'));
  assert.ok(r.includes('<p>Para B</p>'));
});

test('rendreMarkdown — liens https/http/mailto/anchor', () => {
  const r = rendreMarkdown('[lien](https://example.com) et [mail](mailto:a@b.com) et [anc](#section)');
  assert.ok(r.includes('href="https://example.com"'));
  assert.ok(r.includes('href="mailto:a@b.com"'));
  assert.ok(r.includes('href="#section"'));
});

test('rendreMarkdown — refs AIAD wrappées en <code>', () => {
  const r = rendreMarkdown('Voir INTENT-101 et SPEC-101-1 et KR-1.2');
  assert.ok(r.includes('<code>INTENT-101</code>'));
  assert.ok(r.includes('<code>SPEC-101-1</code>'));
  assert.ok(r.includes('<code>KR-1.2</code>'));
});

test('rendreMarkdown — anti-XSS strict : balises HTML échappées', () => {
  const r = rendreMarkdown('<script>alert(1)</script> et **gras**');
  assert.ok(!r.includes('<script>'), 'script tag échappé');
  assert.ok(r.includes('&lt;script&gt;'));
  assert.ok(r.includes('<strong>gras</strong>'));
});

test('rendreMarkdown — javascript: URL refusée (anti-XSS)', () => {
  const r = rendreMarkdown('[mauvais](javascript:alert(1))');
  // Ne doit pas créer de href javascript:
  assert.ok(!r.includes('href="javascript:'));
  assert.ok(!r.includes("href='javascript:"));
});

test('rendreSectionIntent — fallback <pre> si pas de markdown', () => {
  // Une string sans aucun signal markdown ressort en paragraphe (pas pre).
  const r = rendreSectionIntent('Simple texte plain');
  assert.ok(r.includes('md-light') || r.includes('<pre>'));
  assert.ok(r.includes('Simple texte plain'));
});

test('rendreSectionIntent — vide → ""', () => {
  assert.equal(rendreSectionIntent(''), '');
  assert.equal(rendreSectionIntent(null), '');
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof readConfidencePct, 'function');
  assert.equal(typeof confidenceBand, 'function');
  assert.equal(typeof computeConfidenceTracker, 'function');
  assert.equal(typeof confidenceTrackerSection, 'function');
  assert.equal(typeof readJournalEntries, 'function');
  assert.equal(typeof pmJournalSection, 'function');
  assert.equal(typeof renderInlineLine, 'function');
  assert.equal(typeof renderMarkdown, 'function');
  assert.equal(typeof renderIntentSection, 'function');
});
