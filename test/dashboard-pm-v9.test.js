// Tests #444 / #445 / #446 — Boucle 9 PM cockpit export/notifs/activité :
//   - export CSV des Intents
//   - sticky alert bar + title counter
//   - activité récente (mtime desc)

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  genererCsvIntents, blocCsvIntents, CSV_COLUMNS,
  generateIntentsCsv, intentsCsvSection,
} from '../lib/dashboard/intents-csv.js';

import {
  calculerStickyAlerts, blocStickyAlerts,
  computeStickyAlerts, stickyAlertsSection,
} from '../lib/dashboard/sticky-alerts.js';

import {
  ageHumain, calculerActiviteRecente, blocActiviteRecente,
  humanAge, computeRecentActivity, recentActivitySection,
} from '../lib/dashboard/recent-activity.js';

// ─── #444 — CSV export ──────────────────────────────────────────────────────

test('genererCsvIntents — entête + ligne par Intent', () => {
  const d = { intents: [
    { id: 'INTENT-1', titre: 'X', statut: 'active', priority: 'P0' },
    { id: 'INTENT-2', titre: 'Y', statut: 'draft' },
  ]};
  const csv = genererCsvIntents(d);
  const lignes = csv.trim().split('\n');
  assert.equal(lignes.length, 3, 'header + 2 lignes');
  assert.ok(lignes[0].startsWith('id,titre,statut,priority'));
  assert.ok(lignes[1].includes('INTENT-1'));
  assert.ok(lignes[1].includes('active'));
  assert.ok(lignes[1].includes('P0'));
});

test('genererCsvIntents — escape RFC 4180 (virgule, guillemets, newline)', () => {
  const d = { intents: [
    { id: 'A', titre: 'Titre avec, virgule' },
    { id: 'B', titre: 'Titre avec "guillemets"' },
    { id: 'C', titre: 'Titre\navec newline' },
  ]};
  const csv = genererCsvIntents(d);
  assert.ok(csv.includes('"Titre avec, virgule"'));
  assert.ok(csv.includes('"Titre avec ""guillemets"""'));
  assert.ok(csv.includes('"Titre\navec newline"'));
});

test('genererCsvIntents — joinList sur arrays (personas, outcomes, depends_on)', () => {
  const d = { intents: [{
    id: 'A', titre: 't', statut: 'active',
    personas: ['Marketing EU', 'RSSI'],
    outcomes: ['Latence'],
    depends_on: ['INTENT-B', 'INTENT-C'],
  }]};
  const csv = genererCsvIntents(d);
  assert.ok(csv.includes('Marketing EU; RSSI'));
  assert.ok(csv.includes('Latence'));
  assert.ok(csv.includes('INTENT-B; INTENT-C'));
});

test('genererCsvIntents — avancement done/total depuis pm.avancement', () => {
  const d = {
    intents: [{ id: 'A', statut: 'active' }],
    pm: { avancement: [{ id: 'A', done: 2, total: 5 }] },
  };
  const csv = genererCsvIntents(d);
  assert.ok(csv.includes('2/5'));
});

test('genererCsvIntents — owners depuis ownership.owners', () => {
  const d = {
    intents: [{ id: 'A', statut: 'active' }],
    ownership: { owners: [
      { nom: 'Steeve', intents: [{ id: 'A' }] },
      { nom: '_unassigned', intents: [] },
    ]},
  };
  const csv = genererCsvIntents(d);
  assert.ok(csv.includes('Steeve'));
});

test('blocCsvIntents — empty si zéro intent', () => {
  assert.equal(blocCsvIntents({ intents: [] }), '');
});

test('blocCsvIntents — rend bouton + <pre> + script Blob download', () => {
  const html = blocCsvIntents({
    intents: [{ id: 'A', titre: 't', statut: 'active' }],
    projet: { nom: 'Mon Projet' },
  });
  assert.ok(html.includes('Export CSV des Intents'));
  assert.ok(html.includes('class="csv-pre"'));
  assert.ok(html.includes('csv-btn'));
  assert.ok(html.includes('intents-mon-projet'));
  assert.ok(html.includes('createObjectURL'));
});

test('CSV_COLUMNS — exposé pour consumers externes', () => {
  assert.ok(CSV_COLUMNS.includes('id'));
  assert.ok(CSV_COLUMNS.includes('owner'));
  assert.ok(CSV_COLUMNS.includes('avancement'));
  assert.ok(CSV_COLUMNS.includes('depends_on'));
});

// ─── #445 — Sticky alerts ────────────────────────────────────────────────────

test('calculerStickyAlerts — agrège retard/urgent/zombies/cycles/critiques', () => {
  const d = {
    intentDeps: { cycles: [['A', 'B', 'A']] },
    facts: [{ gravite: 'critical', statut: 'open' }],
    deadlines: { totaux: { retard: 1, urgent: 2 } },
    pm: { zombies: [{}], draftsAnciens: [{}, {}] },
  };
  const s = calculerStickyAlerts(d);
  assert.equal(s.total, 6);
  assert.equal(s.critiques, 3); // cycle + fact critical + retard
  assert.equal(s.alertes.length, 3, 'cap à 3 visibles');
  assert.equal(s.masquees, 3);
  // bad d'abord
  assert.equal(s.alertes[0].niveau, 'bad');
});

test('calculerStickyAlerts — vide quand tout est calme', () => {
  const s = calculerStickyAlerts({});
  assert.equal(s.total, 0);
  assert.equal(s.critiques, 0);
});

test('blocStickyAlerts — bandeau "calme" si zéro alerte', () => {
  const html = blocStickyAlerts({ stickyAlerts: { alertes: [], total: 0, masquees: 0, critiques: 0 } });
  assert.ok(html.includes('Pas d\'alerte PM prioritaire'));
  assert.ok(html.includes('calme'));
});

test('blocStickyAlerts — rend les alertes + script title prefix', () => {
  const html = blocStickyAlerts({ stickyAlerts: {
    alertes: [{ niveau: 'bad', texte: '1 cycle', ancre: '#x' }],
    total: 1, masquees: 0, critiques: 1,
  }});
  assert.ok(html.includes('pm-sticky-alerts'));
  assert.ok(html.includes('sa-niveau-bad'));
  assert.ok(html.includes('1 cycle'));
  assert.ok(html.includes('data-critiques="1"'));
  assert.ok(html.includes('document.title'));
});

test('blocStickyAlerts — affiche +N masquées si total > 3', () => {
  const html = blocStickyAlerts({ stickyAlerts: {
    alertes: [{ niveau: 'bad', texte: 'X', ancre: '#x' }],
    total: 5, masquees: 4, critiques: 1,
  }});
  assert.ok(html.includes('+4 autre(s)'));
});

// ─── #446 — Activité récente ────────────────────────────────────────────────

test('ageHumain — formats min/h/j', () => {
  assert.equal(ageHumain(30000), "à l'instant");
  assert.equal(ageHumain(5 * 60000), 'il y a 5 min');
  assert.equal(ageHumain(2 * 3600 * 1000), 'il y a 2 h');
  assert.equal(ageHumain(24 * 3600 * 1000), 'il y a 1 j');
  assert.equal(ageHumain(3 * 24 * 3600 * 1000), 'il y a 3 j');
  assert.equal(ageHumain(null), '—');
});

test('calculerActiviteRecente — tri mtime desc + limite + ages', () => {
  const now = Date.UTC(2026, 4, 15);
  const d = {
    intents: [
      { id: 'A', mtime: now - 86400000, statut: 'active', titre: 't' },
      { id: 'B', mtime: now - 3600000, statut: 'draft', titre: 't' },
    ],
    specs: [{ id: 'S1', mtime: now - 1000, statut: 'done', titre: 't' }],
    facts: [{ id: 'F1', mtime: now - 7 * 86400000, statut: 'open', gravite: 'major', titre: 't' }],
  };
  const r = calculerActiviteRecente(d, { now, limite: 10 });
  assert.equal(r.items.length, 4);
  // SPEC-S1 mtime le plus récent (il y a 1s)
  assert.equal(r.items[0].id, 'S1');
  assert.equal(r.items[1].id, 'B');
  assert.equal(r.items[3].id, 'F1');
  assert.equal(r.totaux.intents, 2);
  assert.equal(r.totaux.specs, 1);
  assert.equal(r.totaux.facts, 1);
});

test('calculerActiviteRecente — ignore items sans mtime', () => {
  const d = { intents: [{ id: 'A' }, { id: 'B', mtime: 1000, titre: 't' }] };
  const r = calculerActiviteRecente(d);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].id, 'B');
});

test('blocActiviteRecente — empty + rendu liste avec badges', () => {
  assert.ok(blocActiviteRecente({ recentActivity: { items: [], totaux: {} } }).includes('aucune'));
  const html = blocActiviteRecente({ recentActivity: {
    items: [{ type: 'Intent', id: 'INTENT-A', titre: 't', file: null, statut: 'active', mtime: Date.now() - 86400000, ageMs: 86400000, ageHumain: 'il y a 1 j' }],
    totaux: { intents: 1, specs: 0, facts: 0 },
  }});
  assert.ok(html.includes('Activité récente'));
  assert.ok(html.includes('Intent'));
  assert.ok(html.includes('INTENT-A'));
  assert.ok(html.includes('il y a 1 j'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof generateIntentsCsv, 'function');
  assert.equal(typeof intentsCsvSection, 'function');
  assert.equal(typeof computeStickyAlerts, 'function');
  assert.equal(typeof stickyAlertsSection, 'function');
  assert.equal(typeof humanAge, 'function');
  assert.equal(typeof computeRecentActivity, 'function');
  assert.equal(typeof recentActivitySection, 'function');
});
