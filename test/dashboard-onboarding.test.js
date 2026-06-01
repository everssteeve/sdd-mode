// Tests #141 — Page onboarding HTML par rôle.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { pageOnboarding, onboardingPage } from '../lib/dashboard/onboarding.js';

test('pageOnboarding — rendu pour les 5 rôles AIAD', () => {
  const html = pageOnboarding();
  for (const role of ['pm', 'pe', 'ae', 'qa', 'tl']) {
    assert.match(html, new RegExp(`data-role="${role}"`));
  }
});

test('pageOnboarding — chaque rôle a son intro + 4-5 widgets', () => {
  const html = pageOnboarding();
  // Apostrophes encodées par escape() → &#39; ; on relâche le motif autour.
  assert.match(html, /Tu portes l.{1,8}intention/);
  assert.match(html, /À valider cette semaine/);
  assert.match(html, /Tu orchestres l.{1,8}exécution/);
  assert.match(html, /Tu garantis que ce qui passe la Gate/);
  assert.match(html, /Tu prends les décisions techniques/);
});

test('pageOnboarding — glossaire AIAD inclus (intent, spec, sqs, gate, drift, jnsp)', () => {
  const html = pageOnboarding();
  for (const terme of ['Intent Statement', 'SQS', 'Execution Gate', 'Drift Lock', 'JNSP', 'SBOM', 'Tier 1']) {
    assert.match(html, new RegExp(terme.replace(/\s/g, '\\s'), 'i'));
  }
});

test('pageOnboarding — script JS persiste le choix de rôle via localStorage', () => {
  const html = pageOnboarding();
  assert.match(html, /localStorage\.setItem\('aiad-onboard-role'/);
  assert.match(html, /localStorage\.getItem\('aiad-onboard-role'/);
});

test('pageOnboarding — support du paramètre ?role=xxx dans l\'URL', () => {
  const html = pageOnboarding();
  assert.match(html, /URLSearchParams.*window\.location\.search/);
  assert.match(html, /url\.get\('role'\)/);
});

test('pageOnboarding — pas d\'appel réseau', () => {
  const html = pageOnboarding();
  assert.ok(!html.includes('fetch('), 'pas de fetch dans la page onboarding');
  assert.ok(!html.includes('XMLHttpRequest'), 'pas de XHR');
});

test('Alias EN canonique exposé', () => {
  assert.equal(onboardingPage, pageOnboarding);
});

// ─── #216 Annonce glossaire ─────────────────────────────────────────────────

test('pageOnboarding — annonce visuelle glossaire + lien notooltips', () => {
  const html = pageOnboarding();
  assert.match(html, /Tooltips automatiques sur le jargon AIAD/);
  assert.match(html, /soulignés en pointillés/);
  assert.match(html, /href="\?notooltips=1"/);
});