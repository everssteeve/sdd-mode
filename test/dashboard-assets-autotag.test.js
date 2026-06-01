// Test #182 — Comportement de la fonction autoTagIds à partir du bundle JS.
// On extrait la fonction de `APP_JS` et on simule un DOM minimal pour valider
// son contrat sur des cas représentatifs (matches valides, faux positifs).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { APP_JS } from '../lib/dashboard/assets.js';

// Extracteur minimaliste : la fonction autoTagIds est définie dans le bundle.
// On reconstruit son corps via une regex pour le re-évaluer dans un sandbox.
function extraireFonction(nom) {
  const re = new RegExp(`function ${nom}\\s*\\(\\)\\s*\\{[\\s\\S]+?\\n\\}`);
  const m = APP_JS.match(re);
  if (!m) throw new Error(`fonction ${nom} introuvable dans APP_JS`);
  return m[0];
}

function fakeDocument(codes) {
  return {
    querySelectorAll(selector) {
      if (selector !== 'code') return [];
      return codes;
    },
  };
}

function makeCode(text) {
  const attrs = {};
  const classes = new Set();
  return {
    textContent: text,
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k); },
    getAttribute(k) { return attrs[k]; },
    setAttribute(k, v) { attrs[k] = v; },
    classList: { add(c) { classes.add(c); }, has(c) { return classes.has(c); } },
    _attrs: attrs,
    _classes: classes,
  };
}

test('autoTagIds — tag les IDs valides Intent/SPEC/ADR/FACT', () => {
  const c1 = makeCode('INTENT-013');
  const c2 = makeCode('SPEC-013-1-healthz');
  const c3 = makeCode('ADR-001');
  const c4 = makeCode('FACT-2026-05-13');
  const c5 = makeCode('package.json'); // pas un ID → ignoré
  const c6 = makeCode('random.code'); // pas un ID → ignoré
  const doc = fakeDocument([c1, c2, c3, c4, c5, c6]);
  const fn = new Function('document', extraireFonction('autoTagIds') + '\n; autoTagIds();');
  fn(doc);

  for (const c of [c1, c2, c3, c4]) {
    assert.equal(c._attrs['data-copy'], c.textContent);
    assert.equal(c._attrs['role'], 'button');
    assert.equal(c._attrs['tabindex'], '0');
    assert.ok(c._classes.has('id-copyable'), 'classe id-copyable absente');
    assert.match(c._attrs['title'], /Cliquer pour copier/);
  }
  for (const c of [c5, c6]) {
    assert.equal(c._attrs['data-copy'], undefined, `${c.textContent} ne doit pas être taggé`);
    assert.ok(!c._classes.has('id-copyable'));
  }
});

test('autoTagIds — n\'écrase pas un data-copy déjà posé', () => {
  const c = makeCode('SPEC-001');
  c._attrs['data-copy'] = 'value-personnalisée';
  const doc = fakeDocument([c]);
  const fn = new Function('document', extraireFonction('autoTagIds') + '\n; autoTagIds();');
  fn(doc);
  assert.equal(c._attrs['data-copy'], 'value-personnalisée');
});

test('autoTagIds — tolère espaces autour du texte', () => {
  const c = makeCode('  SPEC-007-2-domain-routing  ');
  const doc = fakeDocument([c]);
  const fn = new Function('document', extraireFonction('autoTagIds') + '\n; autoTagIds();');
  fn(doc);
  // Le pattern regex applique trim avant test
  assert.equal(c._attrs['data-copy'], 'SPEC-007-2-domain-routing');
});

test('autoTagIds — refuse les ID-like cassés (SPECabc, INTENT_001)', () => {
  for (const txt of ['SPECabc', 'INTENT_001', 'spec-001', 'specstuff', 'INTENT-', '-001']) {
    const c = makeCode(txt);
    const doc = fakeDocument([c]);
    const fn = new Function('document', extraireFonction('autoTagIds') + '\n; autoTagIds();');
    fn(doc);
    assert.equal(c._attrs['data-copy'], undefined, `'${txt}' ne doit pas être taggé`);
  }
});
