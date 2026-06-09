// Tests `lib/proportionality.js` — proportionnalité « léger par défaut » (GF3, §4).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  POIDS,
  evaluerPoids,
  evaluerIntent,
  // alias EN
  assessWeight,
} from '../lib/proportionality.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'prop-')); }

// ─── Heuristique ────────────────────────────────────────────────────────────

test('evaluerPoids — domaine à risque (paiement) → heavy', () => {
  const r = evaluerPoids({ title: 'Intégrer le paiement Stripe au checkout', body: 'flux de carte bancaire' });
  assert.equal(r.weight, 'heavy');
  assert.equal(r.source, 'heuristique');
  assert.ok(r.signaux.length >= 1);
  assert.ok(/lourd/i.test(r.cheminRecommande));
});

test('evaluerPoids — sécurité / auth / RGPD → heavy', () => {
  assert.equal(evaluerPoids({ body: 'gestion du token d\'authentification' }).weight, 'heavy');
  assert.equal(evaluerPoids({ body: 'traitement de données personnelles RGPD' }).weight, 'heavy');
  assert.equal(assessWeight({ body: 'chiffrement des secrets' }).weight, 'heavy');
});

test('evaluerPoids — intention triviale/réversible → light', () => {
  const r = evaluerPoids({ title: 'Corriger une typo dans le libellé du bouton', body: 'changer la couleur' });
  assert.equal(r.weight, 'light');
  assert.ok(/court/i.test(r.cheminRecommande));
});

test('evaluerPoids — aucun signal → light par défaut', () => {
  const r = evaluerPoids({ title: 'Ajouter un endpoint de liste', body: 'pagination simple' });
  assert.equal(r.weight, 'light');
  assert.ok(/léger par défaut/i.test(r.raison));
});

// ─── Human Authorship (override) ────────────────────────────────────────────

test('evaluerPoids — weight déclaré prime sur l\'heuristique', () => {
  // Texte trivial mais l'humain force heavy.
  const r = evaluerPoids({ title: 'typo', body: 'couleur', frontmatter: { weight: 'heavy' } });
  assert.equal(r.weight, 'heavy');
  assert.equal(r.source, 'humain');
});

test('evaluerPoids — weight invalide ignoré → heuristique', () => {
  const r = evaluerPoids({ body: 'paiement stripe', frontmatter: { weight: 'bizarre' } });
  assert.equal(r.source, 'heuristique');
  assert.equal(r.weight, 'heavy');
});

test('POIDS exposé', () => {
  assert.deepEqual(POIDS, ['light', 'heavy']);
});

// ─── Chargement Intent ──────────────────────────────────────────────────────

test('evaluerIntent — lit et évalue un Intent du projet', () => {
  const d = tmp();
  mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
  writeFileSync(join(d, '.aiad', 'intents', 'INTENT-042-paiement.md'), '---\ntitle: Paiement Stripe\n---\n\nIntégrer le paiement par carte bancaire.');
  const r = evaluerIntent(d, 'INTENT-042');
  assert.equal(r.intent, 'INTENT-042-paiement');
  assert.equal(r.weight, 'heavy');
  rmSync(d, { recursive: true, force: true });
});

test('evaluerIntent — introuvable → null', () => {
  const d = tmp();
  mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
  assert.equal(evaluerIntent(d, 'INTENT-999'), null);
  rmSync(d, { recursive: true, force: true });
});
