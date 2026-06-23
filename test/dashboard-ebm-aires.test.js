// Tests SPEC-018-2 — Aires EBM + Investment Balance.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  calculerEbmAires,
  calculerInvestmentBalance,
  blocEbmAires,
  blocInvestmentBalance,
} from '../lib/dashboard/ebm-aires.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDonnees(overrides = {}) {
  return {
    intents: [],
    outcomeAttribution: { items: [], totaux: {} },
    discoveryDeliveryBalance: { pcts: { discovery: 25, delivery: 65, enabler: 10, inconnu: 0 } },
    ...overrides,
  };
}

// ─── calculerEbmAires — Current Value ────────────────────────────────────────

test('CV — aucun outcome défini → jnsp=true', () => {
  const d = makeDonnees({ outcomeAttribution: { items: [], totaux: {} } });
  const r = calculerEbmAires(d);
  assert.equal(r.currentValue.jnsp, true);
  assert.equal(r.currentValue.valeur, null);
});

test('CV — outcomes sans ratio (ratio null) → jnsp=true', () => {
  const items = [{ ratio: null }, { ratio: null }];
  const d = makeDonnees({ outcomeAttribution: { items, totaux: {} } });
  const r = calculerEbmAires(d);
  assert.equal(r.currentValue.jnsp, true);
});

test('CV — 2 outcomes >= 0.8 sur 3 mesurés → valeur=0.67', () => {
  const items = [
    { ratio: 0.9 },
    { ratio: 0.8 },
    { ratio: 0.3 },
  ];
  const d = makeDonnees({ outcomeAttribution: { items, totaux: {} } });
  const r = calculerEbmAires(d);
  assert.equal(r.currentValue.jnsp, false);
  assert.ok(r.currentValue.valeur > 0.6 && r.currentValue.valeur < 0.7, `CV=${r.currentValue.valeur}`);
});

// ─── calculerEbmAires — Unrealized Value ─────────────────────────────────────

test('UV — 1 outcome entre 0 et 0.8 sur 3 mesurés → valeur=0.33', () => {
  const items = [
    { ratio: 0.9 },
    { ratio: 0.8 },
    { ratio: 0.3 },
  ];
  const d = makeDonnees({ outcomeAttribution: { items, totaux: {} } });
  const r = calculerEbmAires(d);
  assert.equal(r.unrealizedValue.jnsp, false);
  assert.ok(r.unrealizedValue.valeur > 0.3 && r.unrealizedValue.valeur < 0.4, `UV=${r.unrealizedValue.valeur}`);
});

// ─── calculerEbmAires — Time-to-Market ───────────────────────────────────────

test('T2M — aucun Intent actif → valeur=0, pas de crash', () => {
  const d = makeDonnees({ intents: [] });
  const r = calculerEbmAires(d);
  assert.equal(r.timeToMarket.valeur, 0);
  assert.equal(r.timeToMarket.jnsp, true);
});

test('T2M — 2 delivery actifs sur 5 intents → valeur=0.4', () => {
  const intents = [
    { id: 'INTENT-001', statut: 'active', kind: 'delivery' },
    { id: 'INTENT-002', statut: 'in-progress', kind: 'delivery' },
    { id: 'INTENT-003', statut: 'done', kind: 'delivery' },
    { id: 'INTENT-004', statut: 'active', kind: 'discovery' },
    { id: 'INTENT-005', statut: 'draft', kind: 'enabler' },
  ];
  const d = makeDonnees({ intents });
  const r = calculerEbmAires(d);
  assert.equal(r.timeToMarket.valeur, 0.4);
});

// ─── calculerEbmAires — Ability to Innovate ──────────────────────────────────

test('A2I — discoveryDeliveryBalance absent → jnsp=true', () => {
  const d = makeDonnees({ discoveryDeliveryBalance: null });
  const r = calculerEbmAires(d);
  assert.equal(r.abilityToInnovate.jnsp, true);
  assert.equal(r.abilityToInnovate.valeur, null);
});

test('A2I — pcts.discovery=30 → valeur=0.3', () => {
  const d = makeDonnees({ discoveryDeliveryBalance: { pcts: { discovery: 30 } } });
  const r = calculerEbmAires(d);
  assert.equal(r.abilityToInnovate.jnsp, false);
  assert.equal(r.abilityToInnovate.valeur, 0.3);
});

// ─── calculerInvestmentBalance — jeu de 6 intents (§3 C3) ───────────────────

test('IB — 2 delivery, 2 enabler, 1 conformité, 1 inconnu → buckets corrects', () => {
  const intents = [
    { id: 'I-001', statut: 'active', kind: 'delivery' },
    { id: 'I-002', statut: 'active', kind: 'delivery' },
    { id: 'I-003', statut: 'active', kind: 'enabler' },
    { id: 'I-004', statut: 'active', kind: 'enabler' },
    { id: 'I-005', statut: 'active', kind: 'delivery', governance: 'AIAD-RGPD' },
    { id: 'I-006', statut: 'active' },
  ];
  const d = makeDonnees({ intents });
  const ib = calculerInvestmentBalance(d);
  assert.equal(ib.total, 6);
  assert.equal(ib.buckets.features, 2);
  assert.equal(ib.buckets.enabler, 2);
  assert.equal(ib.buckets.conformite, 1);
  assert.equal(ib.buckets.inconnu, 1);
  assert.equal(ib.pcts.features + ib.pcts.enabler + ib.pcts.conformite + ib.pcts.inconnu, 100);
});

test('IB — intents archivés exclus du calcul', () => {
  const intents = [
    { id: 'I-001', statut: 'active', kind: 'delivery' },
    { id: 'I-002', statut: 'archived', kind: 'delivery' },
  ];
  const d = makeDonnees({ intents });
  const ib = calculerInvestmentBalance(d);
  assert.equal(ib.total, 1);
  assert.equal(ib.buckets.features, 1);
});

test('IB — tous archivés → total=0, sante=critique', () => {
  const intents = [{ id: 'I-001', statut: 'archived', kind: 'delivery' }];
  const d = makeDonnees({ intents });
  const ib = calculerInvestmentBalance(d);
  assert.equal(ib.total, 0);
  assert.equal(ib.sante, 'critique');
});

test('IB — division par zéro → pcts tous à 0, pas de NaN', () => {
  const d = makeDonnees({ intents: [] });
  const ib = calculerInvestmentBalance(d);
  for (const v of Object.values(ib.pcts)) {
    assert.ok(!Number.isNaN(v), `NaN détecté dans pcts`);
    assert.equal(v, 0);
  }
});

test('IB — tag conformité dans .tags array → bucket conformite', () => {
  const intents = [{ id: 'I-001', statut: 'active', kind: 'delivery', tags: ['rgaa', 'dashboard'] }];
  const d = makeDonnees({ intents });
  const ib = calculerInvestmentBalance(d);
  assert.equal(ib.buckets.conformite, 1);
  assert.equal(ib.buckets.features, 0);
});

// ─── Rendu HTML — assertions accessibilité ───────────────────────────────────

test('blocEbmAires — JNSP : label textuel présent, aria-label non vide', () => {
  const donnees = {
    ebmAires: {
      currentValue: { valeur: null, label: 'Aucun outcome', jnsp: true },
      unrealizedValue: { valeur: null, label: 'Aucun outcome', jnsp: true },
      timeToMarket: { valeur: 0, label: '0/0', jnsp: true },
      abilityToInnovate: { valeur: null, label: 'absent', jnsp: true },
    },
  };
  const html = blocEbmAires(donnees);
  assert.ok(html.includes('JNSP'), 'indicateur JNSP absent');
  assert.ok(html.includes('aria-label='), 'aria-label absent');
  assert.ok(!html.includes('aria-label=""'), 'aria-label vide détecté');
});

test('blocEbmAires — valeurs numériques : aria-label contient le pourcentage', () => {
  const donnees = {
    ebmAires: {
      currentValue: { valeur: 0.75, label: '3/4', jnsp: false },
      unrealizedValue: { valeur: 0.25, label: '1/4', jnsp: false },
      timeToMarket: { valeur: 0.4, label: '2/5', jnsp: false },
      abilityToInnovate: { valeur: 0.3, label: '30%', jnsp: false },
    },
  };
  const html = blocEbmAires(donnees);
  assert.ok(html.includes('75 %'), 'CV 75% absent');
  assert.ok(html.includes('aria-label='), 'aria-label absent');
});

test('blocInvestmentBalance — santé critique : indicateur textuel, pas couleur seule', () => {
  const donnees = {
    investmentBalance: { buckets: { features: 0, enabler: 0, conformite: 0, inconnu: 0 }, pcts: { features: 0, enabler: 0, conformite: 0, inconnu: 0 }, total: 0, sante: 'critique' },
  };
  const html = blocInvestmentBalance(donnees);
  assert.ok(html.includes('Critique'), 'texte "Critique" absent');
  assert.ok(html.includes('ib-sante-critique'), 'classe CSS sante critique absente');
  assert.ok(html.includes('aria-label='), 'aria-label absent');
});

test('blocInvestmentBalance — aria-label sur segments de barre colorée', () => {
  const donnees = {
    investmentBalance: {
      buckets: { features: 4, enabler: 2, conformite: 0, inconnu: 0 },
      pcts: { features: 67, enabler: 33, conformite: 0, inconnu: 0 },
      total: 6,
      sante: 'ok',
    },
  };
  const html = blocInvestmentBalance(donnees);
  assert.ok(html.includes('aria-label="Features'), 'aria-label segment features absent');
  assert.ok(html.includes('aria-label="Enabler'), 'aria-label segment enabler absent');
});
