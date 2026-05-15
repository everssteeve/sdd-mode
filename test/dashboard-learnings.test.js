// Tests #200 — Lessons Learned + Human Learnings counter.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  compterLearnings, blocLearnings,
  countLearnings, learningsSection,
} from '../lib/dashboard/learnings.js';

function tmpProjet() {
  return mkdtempSync(join(tmpdir(), 'aiad-learnings-'));
}

function ecrireGuide(racine, contenu) {
  mkdirSync(join(racine, '.aiad'), { recursive: true });
  writeFileSync(join(racine, '.aiad', 'AGENT-GUIDE.md'), contenu, 'utf-8');
}

test('compterLearnings — sans AGENT-GUIDE.md → totaux à 0', () => {
  const r = compterLearnings(tmpProjet());
  assert.equal(r.fichier, null);
  assert.equal(r.lessonsLearned.total, 0);
  assert.equal(r.humanLearnings.total, 0);
});

test('compterLearnings — sections placeholders (vide à l\'init) → 0', () => {
  const racine = tmpProjet();
  try {
    ecrireGuide(racine, `# AGENT-GUIDE

## Lessons Learned

> Alimentée par /aiad retro.

_(vide à l'init)_

## Human Learnings

> Écarts intention ↔ livraison.

_(vide à l'init)_
`);
    const r = compterLearnings(racine);
    assert.equal(r.lessonsLearned.total, 0);
    assert.equal(r.humanLearnings.total, 0);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('compterLearnings — détecte entrées listes à puces', () => {
  const racine = tmpProjet();
  try {
    ecrireGuide(racine, `## Lessons Learned

> description

- LL-001 : ne pas mock la DB
- LL-002 : utiliser pnpm
- LL-003 : préférer fastify
- ll-004 : sans préfixe ok

## Human Learnings

- Steve veut éviter les abstractions prématurées
- Bug fix doit pas inclure refactor
`);
    const r = compterLearnings(racine);
    assert.equal(r.lessonsLearned.total, 4);
    assert.equal(r.humanLearnings.total, 2);
    assert.match(r.lessonsLearned.entrees[0].texte, /ne pas mock/);
    assert.equal(r.lessonsLearned.entrees[0].ligne >= 3, true);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('compterLearnings — supporte listes numérotées', () => {
  const racine = tmpProjet();
  try {
    ecrireGuide(racine, `## Lessons Learned

1. première leçon
2. deuxième leçon
3. troisième leçon

## Human Learnings

_(vide à l'init)_
`);
    const r = compterLearnings(racine);
    assert.equal(r.lessonsLearned.total, 3);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('compterLearnings — ignore blockquotes et titres H3', () => {
  const racine = tmpProjet();
  try {
    ecrireGuide(racine, `## Lessons Learned

> Description en blockquote (à ignorer)
> Suite blockquote

### Sous-section ignorée

- vraie entrée 1
- vraie entrée 2

## Human Learnings

> Autre description
`);
    const r = compterLearnings(racine);
    assert.equal(r.lessonsLearned.total, 2);
    assert.equal(r.humanLearnings.total, 0);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('compterLearnings — arrête à la section H2 suivante', () => {
  const racine = tmpProjet();
  try {
    ecrireGuide(racine, `## Lessons Learned

- LL-1
- LL-2

## Gouvernance

- regle 1 (NE PAS COMPTER comme LL)
- regle 2

## Human Learnings

- HL-1
`);
    const r = compterLearnings(racine);
    assert.equal(r.lessonsLearned.total, 2, 'arrêt avant Gouvernance');
    assert.equal(r.humanLearnings.total, 1);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('compterLearnings — case-insensitive sur le titre', () => {
  const racine = tmpProjet();
  try {
    ecrireGuide(racine, `## LESSONS LEARNED

- a
- b

## human learnings

- c
`);
    const r = compterLearnings(racine);
    assert.equal(r.lessonsLearned.total, 2);
    assert.equal(r.humanLearnings.total, 1);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('compterLearnings — exposing fichier en chemin relatif', () => {
  const racine = tmpProjet();
  try {
    ecrireGuide(racine, `## Lessons Learned\n\n- LL-1\n`);
    const r = compterLearnings(racine);
    assert.equal(r.fichier, '.aiad/AGENT-GUIDE.md');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('compterLearnings — entrées plafonnées à 30 max', () => {
  const racine = tmpProjet();
  try {
    let body = '## Lessons Learned\n\n';
    for (let i = 0; i < 50; i++) body += `- entrée ${i}\n`;
    ecrireGuide(racine, body);
    const r = compterLearnings(racine);
    assert.equal(r.lessonsLearned.total, 50, 'total complet');
    assert.equal(r.lessonsLearned.entrees.length, 30, 'plafond entrees=30');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('blocLearnings — sans learnings → chaîne vide', () => {
  assert.equal(blocLearnings({}), '');
  assert.equal(blocLearnings({ learnings: null }), '');
});

test('blocLearnings — fichier absent et 0 entrées → omis', () => {
  const html = blocLearnings({ learnings: {
    fichier: null,
    lessonsLearned: { total: 0, entrees: [] },
    humanLearnings: { total: 0, entrees: [] },
  } });
  assert.equal(html, '');
});

test('blocLearnings — fichier présent, 0 entrées → section avec KPI à 0', () => {
  const html = blocLearnings({ learnings: {
    fichier: '.aiad/AGENT-GUIDE.md',
    lessonsLearned: { total: 0, entrees: [] },
    humanLearnings: { total: 0, entrees: [] },
  } });
  assert.match(html, /Lessons Learned & Human Learnings/);
  assert.match(html, /AGENT-GUIDE\.md/);
  assert.match(html, /Aucune entrée capturée/);
});

test('blocLearnings — avec entrées → 2 tables + 2 KPIs', () => {
  const html = blocLearnings({ learnings: {
    fichier: '.aiad/AGENT-GUIDE.md',
    lessonsLearned: { total: 2, entrees: [
      { ligne: 5, texte: 'leçon 1' },
      { ligne: 6, texte: 'leçon 2' },
    ] },
    humanLearnings: { total: 1, entrees: [{ ligne: 12, texte: 'écart 1' }] },
  } });
  assert.match(html, /leçon 1/);
  assert.match(html, /L5/);
  assert.match(html, /écart 1/);
  assert.match(html, />2</);
  assert.match(html, />1</);
  assert.match(html, /alimentées par.*\/aiad retro/);
  assert.match(html, /\/aiad intention/);
});

test('Alias EN canoniques', () => {
  assert.equal(countLearnings, compterLearnings);
  assert.equal(learningsSection, blocLearnings);
});

// (#325) Intro "Source : <code>FILE</code>" → hyperlien
test('#325 blocLearnings — intro "Source" devient un <a> vers AGENT-GUIDE.md', () => {
  const html = blocLearnings({ learnings: {
    fichier: '.aiad/AGENT-GUIDE.md',
    lessonsLearned: { total: 0, entrees: [] },
    humanLearnings: { total: 0, entrees: [] },
  } });
  assert.match(html, /Source : <a[^>]+href="\.\.\/\.aiad\/AGENT-GUIDE\.md"[^>]*>\.aiad\/AGENT-GUIDE\.md<\/a>/);
});

// (#311) Ligne hyperliée vers AGENT-GUIDE.md#LNN
test('#311 blocLearnings — colonne Ligne devient <a href="…AGENT-GUIDE.md#L5">L5</a>', () => {
  const html = blocLearnings({ learnings: {
    fichier: '.aiad/AGENT-GUIDE.md',
    lessonsLearned: { total: 1, entrees: [{ ligne: 5, texte: 'leçon X' }] },
    humanLearnings: { total: 1, entrees: [{ ligne: 12, texte: 'écart Y' }] },
  } });
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/AGENT-GUIDE\.md#L5"[^>]*>L5<\/a>/);
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/AGENT-GUIDE\.md#L12"[^>]*>L12<\/a>/);
});
