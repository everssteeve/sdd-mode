// @spec SPEC-017-2-inbox-triage
// @verified-by test/dashboard-inbox.test.js

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { calculerInboxTriage, blocInboxTriage, pageInbox } from '../lib/dashboard/views/inbox.js';
import { layout } from '../lib/dashboard/render.js';

function donneesMock(opts = {}) {
  return {
    projet: { nom: 'test', genere: '2026-06-22T08:00:00.000Z', version: '1.0' },
    facts: opts.facts ?? [],
    drifts: opts.drifts ?? [],
    maturite: { score: 3, total: 5, label: 'ok' },
    santeGlobale: { score: 80 },
    intents: [],
    specs: [],
  };
}

// CA-001 — liste unifiée facts + drifts
test('CA-001 — calculerInboxTriage produces unified list with statut "new"', () => {
  const donnees = donneesMock({
    facts: [
      { id: 'FACT-001', titre: 'Drift A', statut: 'open' },
      { id: 'FACT-002', titre: 'Drift B', statut: 'closed' },
    ],
    drifts: [
      { id: 'DRIFT-001', titre: 'Code drift X' },
    ],
  });
  const { items } = calculerInboxTriage(donnees);
  assert.equal(items.length, 3, 'Should aggregate facts + drifts');
  assert.ok(items.every(i => i.statut === 'new'), 'All items should have statut "new"');
  assert.ok(items.every(i => i.id && i.type && i.titre), 'All items must have id, type, titre');
  const types = items.map(i => i.type);
  assert.ok(types.includes('fact'), 'Should include fact type');
  assert.ok(types.includes('drift'), 'Should include drift type');
});

// CA-002a — bouton Accept dans HTML
test('CA-002a — blocInboxTriage renders "Accepter" button with data-inbox-action="accept"', () => {
  const donnees = donneesMock({ facts: [{ id: 'FACT-001', titre: 'Test fact' }] });
  const html = blocInboxTriage(donnees);
  assert.ok(html.includes('data-inbox-action="accept"'), 'Should include accept action button');
});

// CA-002b — JS écrit localStorage accepted
test('CA-002b — client script writes "accepted" to localStorage on accept click', () => {
  const donnees = donneesMock({ facts: [{ id: 'FACT-001', titre: 'Test fact' }] });
  const html = blocInboxTriage(donnees);
  assert.ok(html.includes("'accepted'"), 'Client script should reference "accepted" value');
  assert.ok(html.includes("localStorage.setItem"), 'Client script should call localStorage.setItem');
});

// CA-003a — bouton Différer dans HTML
test('CA-003a — blocInboxTriage renders "Différer" button with data-inbox-action="defer"', () => {
  const donnees = donneesMock({ facts: [{ id: 'FACT-001', titre: 'Test fact' }] });
  const html = blocInboxTriage(donnees);
  assert.ok(html.includes('data-inbox-action="defer"'), 'Should include defer action button');
});

// CA-003b — JS écrit localStorage deferred
test('CA-003b — client script writes "deferred" to localStorage on defer click', () => {
  const donnees = donneesMock({ facts: [{ id: 'FACT-001', titre: 'Test fact' }] });
  const html = blocInboxTriage(donnees);
  assert.ok(html.includes("'deferred'"), 'Client script should reference "deferred" value');
});

// CA-004a — avertissement localStorage indisponible
test('CA-004a — blocInboxTriage includes aria-live warning element for localStorage failure', () => {
  const donnees = donneesMock({ facts: [{ id: 'FACT-001', titre: 'Test fact' }] });
  const html = blocInboxTriage(donnees);
  assert.ok(
    html.includes('aria-live="polite"') && html.includes('Actions de triage indisponibles'),
    'Should include aria-live polite warning for localStorage unavailability',
  );
});

// CA-004b — exception interceptée (try/catch dans le script)
test('CA-004b — client script wraps localStorage in try/catch (no uncaught exceptions)', () => {
  const donnees = donneesMock({ facts: [{ id: 'FACT-001', titre: 'Test fact' }] });
  const html = blocInboxTriage(donnees);
  assert.ok(html.includes('try {') || html.includes('try{'), 'Client script should use try/catch around localStorage');
  assert.ok(html.includes('catch'), 'Client script should have catch block');
});

// CA-005 — onglets de filtre
test('CA-005 — blocInboxTriage renders 4 filter tabs (Tout/Nouveau/Accepté/Différé)', () => {
  const donnees = donneesMock({ facts: [{ id: 'FACT-001', titre: 'Test fact' }] });
  const html = blocInboxTriage(donnees);
  assert.ok(html.includes('data-inbox-filter="all"'), 'Should have "Tout" tab');
  assert.ok(html.includes('data-inbox-filter="new"'), 'Should have "Nouveau" tab');
  assert.ok(html.includes('data-inbox-filter="accepted"'), 'Should have "Accepté" tab');
  assert.ok(html.includes('data-inbox-filter="deferred"'), 'Should have "Différé" tab');
});

// CA-006 — liste vide
test('CA-006 — blocInboxTriage shows empty-state when no facts or drifts', () => {
  const html = blocInboxTriage(donneesMock());
  assert.ok(
    html.includes('Aucun élément en attente de triage.'),
    'Should display empty-state message',
  );
  assert.ok(!html.includes('<table'), 'Should not render a table when empty');
});

// CA-007a/b — lecture et application localStorage au chargement
test('CA-007a/b — client script reads localStorage for each item on page load', () => {
  const donnees = donneesMock({ facts: [{ id: 'FACT-001', titre: 'Test fact' }] });
  const html = blocInboxTriage(donnees);
  assert.ok(
    html.includes('localStorage.getItem') || html.includes('lsGet'),
    'Client script should read localStorage on load',
  );
});

// CA-008 — accessibilité RGAA : caption, th scope, aria-label
test('CA-008 — inbox table has <caption>, <th scope="col">, and buttons with aria-label', () => {
  const donnees = donneesMock({
    facts: [{ id: 'FACT-001', titre: 'Test fact' }],
  });
  const html = blocInboxTriage(donnees);
  assert.ok(html.includes('<caption>'), 'Table must have <caption>');
  assert.ok(html.includes('scope="col"'), 'Table headers must have scope="col"');
  assert.ok(
    html.includes('aria-label="Accepter FACT-001"') || html.includes("aria-label='Accepter FACT-001'"),
    'Accept button must have aria-label with item ID',
  );
  assert.ok(
    html.includes('aria-label="Différer FACT-001"') || html.includes("aria-label='Différer FACT-001'"),
    'Defer button must have aria-label with item ID',
  );
});
