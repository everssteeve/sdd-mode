// Tests d'intégration du frontmatter dans les lecteurs Intent / SPEC.
// Vérifie la coexistence parfaite entre format frontmatter (préféré) et
// format prose legacy (fallback regex).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { lireIntents, lireSpecs } from '../lib/dashboard/collect.js';
import { construireMatrice } from '../lib/sdd-trace.js';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-fm-'));
  mkdirSync(join(dir, '.aiad', 'intents'), { recursive: true });
  mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
  return dir;
}

test('Intent en frontmatter — fields lus depuis le YAML', () => {
  const d = fixture();
  try {
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-100.md'), `---
title: Authentifier les utilisateurs
status: active
auteur: Alice
---

# Auth — vue détaillée

Corps Markdown.
`, 'utf-8');
    const r = lireIntents(d);
    assert.equal(r.length, 1);
    assert.equal(r[0].id, 'INTENT-100');
    assert.equal(r[0].titre, 'Authentifier les utilisateurs');
    assert.equal(r[0].statut, 'active');
    assert.equal(r[0].auteur, 'Alice');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('Intent en prose legacy — extraction regex toujours fonctionnelle', () => {
  const d = fixture();
  try {
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-101.md'), `# Mon Intent

**status** : active
**auteur** : Bob
`, 'utf-8');
    const r = lireIntents(d);
    assert.equal(r[0].titre, 'Mon Intent');
    assert.equal(r[0].statut, 'active');
    assert.equal(r[0].auteur, 'Bob');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('SPEC frontmatter — parent_intent prioritaire sur regex prose', () => {
  const d = fixture();
  try {
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-100-1-fm.md'), `---
title: Login flow
parent_intent: INTENT-100
status: ready
sqs: 4.5
format: EARS
---

# Body
`, 'utf-8');
    const r = lireSpecs(d);
    assert.equal(r[0].titre, 'Login flow');
    assert.equal(r[0].parentIntent, 'INTENT-100');
    assert.equal(r[0].statut, 'ready');
    assert.equal(r[0].sqs, '4.5');
    assert.equal(r[0].format, 'ears');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('SPEC mixte frontmatter + body — frontmatter gagne', () => {
  const d = fixture();
  try {
    // Frontmatter dit "ready" mais body dit "draft" → frontmatter gagne
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-100-2-mix.md'), `---
status: ready
parent_intent: INTENT-100
---

# Mixte

**Statut** : draft
**Intent parent** : INTENT-999
`, 'utf-8');
    const r = lireSpecs(d);
    assert.equal(r[0].statut, 'ready');
    assert.equal(r[0].parentIntent, 'INTENT-100');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('construireMatrice — frontmatter pris en compte par sdd-trace', () => {
  const d = fixture();
  try {
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-200.md'), `---
status: active
---

# Intent FM
`, 'utf-8');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-200-1.md'), `---
parent_intent: INTENT-200
status: ready
---

# Spec FM
`, 'utf-8');

    const m = construireMatrice(d);
    assert.equal(m.summary.intents, 1);
    assert.equal(m.summary.specs, 1);
    // Le forward doit lier INTENT-200 → SPEC-200-1
    assert.equal(m.forward.length, 1);
    assert.equal(m.forward[0].intent.id, 'INTENT-200');
    assert.equal(m.forward[0].specs.length, 1);
    assert.equal(m.forward[0].specs[0].spec.id, 'SPEC-200-1');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
