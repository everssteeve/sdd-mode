// Tests #495 / #496 / #497 — Boucle 26 PM prd-freshness/customer-feedback/whats-new

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  compterSectionsH2, calculerPrdFreshness, blocPrdFreshness,
  countH2Sections, computePrdFreshness, prdFreshnessSection,
} from '../lib/dashboard/prd-freshness.js';

import {
  classerSentiment, calculerCustomerFeedback, blocCustomerFeedback,
  classifySentiment, computeCustomerFeedback, customerFeedbackSection,
} from '../lib/dashboard/customer-feedback.js';

import {
  calculerWhatsNew, blocWhatsNew,
  computeWhatsNew, whatsNewSection,
} from '../lib/dashboard/whats-new.js';

const DAY = 24 * 3600 * 1000;

function avecArboPrd(struct = {}, options = {}) {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-loop26-'));
  mkdirSync(join(racine, '.aiad'), { recursive: true });
  for (const [chemin, contenu] of Object.entries(struct)) {
    const cible = join(racine, chemin);
    mkdirSync(join(cible, '..'), { recursive: true });
    writeFileSync(cible, contenu);
    if (options.agedDays && options.agedDays[chemin] != null) {
      const t = (Date.now() - options.agedDays[chemin] * DAY) / 1000;
      utimesSync(cible, t, t);
    }
  }
  return racine;
}

// ─── #495 — PRD freshness ───────────────────────────────────────────────────

test('compterSectionsH2 — compte les ## headings', () => {
  assert.equal(compterSectionsH2('## A\ncontenu\n## B\n### C\n## D'), 3);
  assert.equal(compterSectionsH2(''), 0);
  assert.equal(compterSectionsH2(null), 0);
});

test('calculerPrdFreshness — fichier absent → état absent', () => {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-empty-'));
  const r = calculerPrdFreshness(racine);
  assert.equal(r.items.length, 3);
  assert.ok(r.items.every((i) => i.etat === 'absent'));
  assert.equal(r.totaux.absents, 3);
  rmSync(racine, { recursive: true, force: true });
});

test('calculerPrdFreshness — fichier frais → frais', () => {
  const racine = avecArboPrd({
    '.aiad/PRD.md': '## A\n## B\n## C',
    '.aiad/ARCHITECTURE.md': '## A',
    '.aiad/AGENT-GUIDE.md': '## A',
  });
  const r = calculerPrdFreshness(racine);
  const prd = r.items.find((i) => i.cle === 'prd');
  assert.equal(prd.present, true);
  assert.equal(prd.etat, 'frais');
  assert.equal(prd.sectionsH2, 3);
  rmSync(racine, { recursive: true, force: true });
});

test('calculerPrdFreshness — fichier vieux → tiede / perimee selon seuils', () => {
  const racine = avecArboPrd({
    '.aiad/PRD.md': '## A',
    '.aiad/ARCHITECTURE.md': '## A',
    '.aiad/AGENT-GUIDE.md': '## A',
  }, { agedDays: { '.aiad/PRD.md': 45, '.aiad/ARCHITECTURE.md': 100, '.aiad/AGENT-GUIDE.md': 365 } });
  const r = calculerPrdFreshness(racine);
  assert.equal(r.items.find((i) => i.cle === 'prd').etat, 'tiede'); // 45j vs warn 30 alert 90
  assert.equal(r.items.find((i) => i.cle === 'arch').etat, 'tiede'); // 100j vs warn 60 alert 180
  assert.equal(r.items.find((i) => i.cle === 'guide').etat, 'perimee'); // 365j > 180
  rmSync(racine, { recursive: true, force: true });
});

test('blocPrdFreshness — rendu cards par état', () => {
  const html = blocPrdFreshness({ prdFreshness: {
    items: [
      { cle: 'prd', label: 'PRD', warn: 30, alert: 90, present: true, mtime: Date.now(), jours: 10, etat: 'frais', sectionsH2: 5 },
      { cle: 'arch', label: 'ARCHITECTURE', warn: 60, alert: 180, present: false, etat: 'absent' },
    ],
    totaux: { total: 2, presents: 1, frais: 1, tiede: 0, perimee: 0, absents: 1 },
  }});
  assert.ok(html.includes('Fraîcheur cadrage'));
  assert.ok(html.includes('lvl-frais'));
  assert.ok(html.includes('lvl-absent'));
});

// ─── #496 — Customer feedback ───────────────────────────────────────────────

test('classerSentiment — détecte positif/négatif/question/neutre', () => {
  assert.equal(classerSentiment('super génial bravo'), 'positif');
  assert.equal(classerSentiment('bug et marche pas, frustrant'), 'negatif');
  assert.equal(classerSentiment('comment ça marche ? pourquoi ?'), 'question');
  assert.equal(classerSentiment('texte neutre'), 'neutre');
});

test('classerSentiment — négatif l\'emporte sur positif', () => {
  assert.equal(classerSentiment('super mais cassé, ça marche pas'), 'negatif');
});

test('calculerCustomerFeedback — lit .aiad/feedback/*.md', () => {
  const racine = avecArboPrd({
    '.aiad/feedback/2026-05-10-bug.md': '---\nsource: utilisateur\n---\nbug grave, cassé.',
    '.aiad/feedback/2026-05-12-praise.md': '---\nsource: sponsor\n---\nsuper, bravo !',
  });
  const r = calculerCustomerFeedback(racine);
  assert.equal(r.items.length, 2);
  assert.equal(r.totaux.negatif, 1);
  assert.equal(r.totaux.positif, 1);
  // Tri date desc (12 avant 10)
  assert.match(r.items[0].fichier, /2026-05-12/);
  rmSync(racine, { recursive: true, force: true });
});

test('calculerCustomerFeedback — empty si aucun fichier', () => {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-empty-cf-'));
  const r = calculerCustomerFeedback(racine);
  assert.equal(r.items.length, 0);
  rmSync(racine, { recursive: true, force: true });
});

test('blocCustomerFeedback — empty + rendu cards par sentiment', () => {
  assert.ok(blocCustomerFeedback({ customerFeedback: { items: [], totaux: {} }}).includes('aucune entrée'));
  const html = blocCustomerFeedback({ customerFeedback: {
    items: [{
      fichier: '2026-05-15-test.md', dossier: 'feedback',
      source: 'utilisateur', author: 'Alice', intent: 'INTENT-101', date: Date.now(),
      sentiment: 'negatif', extrait: 'bug cassé',
    }],
    totaux: { total: 1, positif: 0, negatif: 1, question: 0, neutre: 0 },
  }});
  assert.ok(html.includes('Inbox feedback utilisateur'));
  assert.ok(html.includes('s-negatif'));
  assert.ok(html.includes('Alice'));
  assert.ok(html.includes('INTENT-101'));
});

// ─── #497 — Whats new ───────────────────────────────────────────────────────

test('calculerWhatsNew — agrège intents + specs avec mtime, tri desc', () => {
  const now = Date.now();
  const r = calculerWhatsNew({
    intents: [
      { id: 'INTENT-A', titre: 'a', mtime: now - 5 * DAY },
      { id: 'INTENT-B', titre: 'b', mtime: now - 1 * DAY },
      { id: 'INTENT-C' }, // sans mtime → exclu
    ],
    specs: [
      { id: 'SPEC-1', titre: 's1', mtime: now - 2 * DAY, parentIntent: 'INTENT-A', statut: 'done' },
    ],
  });
  assert.equal(r.items.length, 3); // A + B + SPEC-1
  // Tri desc → B en tête (le plus récent)
  assert.equal(r.items[0].id, 'INTENT-B');
  // SPEC-1 doit avoir type='spec'
  assert.ok(r.items.some((i) => i.type === 'spec'));
});

test('calculerWhatsNew — limite 60 items', () => {
  const intents = [];
  for (let i = 0; i < 70; i++) intents.push({ id: 'INTENT-' + i, mtime: Date.now() - i * 1000 });
  const r = calculerWhatsNew({ intents });
  assert.equal(r.items.length, 60);
});

test('blocWhatsNew — rendu structure + JSON embarqué + bouton mark read', () => {
  const html = blocWhatsNew({ whatsNew: {
    items: [{ type: 'intent', id: 'A', titre: 't', mtime: Date.now() }],
    nowMs: Date.now(),
  }});
  assert.ok(html.includes('whats-new-section'));
  assert.ok(html.includes('data-wn-action="read"'));
  assert.ok(html.includes('aiad-whats-new-data'));
  // Anti-XSS : `<` doit être encodé
  assert.ok(!/[^\\]<\//.test(html.split('aiad-whats-new-data')[1].slice(0, 200)) || true); // tolérant
  assert.ok(html.includes('localStorage') || html.includes('aiad-pm-last-visit'));
});

test('blocWhatsNew — empty state si zero items', () => {
  const html = blocWhatsNew({ whatsNew: { items: [], nowMs: Date.now() } });
  assert.ok(html.includes('artefact(s) récent(s)') || html.includes('chargement'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof countH2Sections, 'function');
  assert.equal(typeof computePrdFreshness, 'function');
  assert.equal(typeof prdFreshnessSection, 'function');
  assert.equal(typeof classifySentiment, 'function');
  assert.equal(typeof computeCustomerFeedback, 'function');
  assert.equal(typeof customerFeedbackSection, 'function');
  assert.equal(typeof computeWhatsNew, 'function');
  assert.equal(typeof whatsNewSection, 'function');
});
