// @spec SPEC-016-2-design-system-rgaa
// @intent INTENT-016
// @governance AIAD-RGAA

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { CSS, APP_JS } from '../lib/dashboard/assets.js';

// CA-004 — :focus-visible ≥ 3px sur tous les éléments interactifs
test('CSS focus-visible — outline 3px (CA-004)', () => {
  assert.ok(CSS.includes(':focus-visible'), 'CSS doit contenir :focus-visible');
  assert.ok(CSS.includes('3px solid'), ':focus-visible doit déclarer outline 3px solid');
  assert.ok(CSS.includes('select:focus-visible'), 'select doit être couvert');
  assert.ok(CSS.includes('[tabindex]:focus-visible'), '[tabindex] doit être couvert');
});

// CA-005 — @media prefers-reduced-motion
test('CSS prefers-reduced-motion — transition/animation désactivés (CA-005)', () => {
  assert.ok(CSS.includes('@media (prefers-reduced-motion: reduce)'), 'doit contenir @media prefers-reduced-motion: reduce');
  assert.ok(CSS.includes('transition: none !important'), 'doit désactiver les transitions');
  assert.ok(CSS.includes('animation: none !important'), 'doit désactiver les animations');
});

// CA-002 — bindFilter injecte aria-label depuis placeholder
test('APP_JS bindFilter — logique aria-label depuis placeholder (CA-002)', () => {
  assert.ok(APP_JS.includes("input.getAttribute('aria-label')"), 'doit tester aria-label existant');
  assert.ok(APP_JS.includes("input.setAttribute('aria-label'"), 'doit injecter aria-label');
  assert.ok(APP_JS.includes("getAttribute('placeholder')"), 'doit utiliser placeholder comme source');
});

// CA-003b — bindSortable et initA11yTables injectent scope="col"
test('APP_JS bindSortable — injecte scope="col" sur les th (CA-003b)', () => {
  assert.ok(APP_JS.includes("setAttribute('scope', 'col')"), 'doit injecter scope=col sur les th');
});

// CA-003 — initA11yTables injecte <caption>
test('APP_JS initA11yTables — injecte <caption> si absente (CA-003)', () => {
  assert.ok(APP_JS.includes('initA11yTables'), 'fonction initA11yTables doit exister');
  assert.ok(APP_JS.includes("createElement('caption')"), 'doit créer un élément caption');
  assert.ok(APP_JS.includes("'data-a11y-caption'"), 'doit lire data-a11y-caption pour la légende');
});
