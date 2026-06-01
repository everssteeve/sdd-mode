// Tests #142 — Fil "Activité rituelle".

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { lireRituels, blocRituels, readRituels, ritualsBlock } from '../lib/dashboard/rituels.js';

function donnees({ standup = [], demo = [], retro = [], syncStrat = [], techReview = [] } = {}) {
  return {
    metrics: {
      categories: {
        standup: { fichiers: standup },
        demo: { fichiers: demo },
        retro: { fichiers: retro },
        'sync-strat': { fichiers: syncStrat },
        'tech-review': { fichiers: techReview },
      },
    },
  };
}

test('lireRituels — projet vierge → []', () => {
  assert.deepEqual(lireRituels(donnees()), []);
});

test('lireRituels — agrège les 4 sources et trie chronologique décroissant', () => {
  const d = donnees({
    standup: [{ mtime: 3000, nom: 's1.md', file: '.aiad/metrics/standup/s1.md', data: { wip: 3 } }],
    demo: [{ mtime: 5000, nom: 'd1.md', file: '.aiad/metrics/demo/d1.md', data: { specs_presentees: 4 } }],
    retro: [{ mtime: 1000, nom: 'r1.md', file: '.aiad/metrics/retro/r1.md', data: { lessons_learned: 2 } }],
  });
  const r = lireRituels(d);
  assert.equal(r.length, 3);
  // Tri descendant : 5000 > 3000 > 1000
  assert.deepEqual(r.map((x) => x.type), ['demo', 'standup', 'retro']);
});

test('lireRituels — limit configurable (défaut 5)', () => {
  const fichiers = Array.from({ length: 10 }, (_, i) => ({
    mtime: 1000 + i * 100, nom: `s${i}.md`, file: `s${i}.md`, data: { wip: i },
  }));
  const r = lireRituels(donnees({ standup: fichiers }));
  assert.equal(r.length, 5);
  // Plus récents (mtime 1900, 1800, 1700, 1600, 1500)
  assert.deepEqual(r.map((x) => x.date), [1900, 1800, 1700, 1600, 1500]);
});

test('lireRituels — résumé standup : WIP + blockers', () => {
  const r = lireRituels(donnees({ standup: [
    { mtime: 1000, nom: 's.md', file: 's.md', data: { wip: 5, blockers: 2 } },
  ] }));
  assert.match(r[0].resume, /5 SPEC\(s\) en cours.*2 blocker/);
});

test('lireRituels — résumé demo : specs présentées', () => {
  const r = lireRituels(donnees({ demo: [
    { mtime: 1000, nom: 'd.md', file: 'd.md', data: { specs_presentees: 3, feedback_count: 7 } },
  ] }));
  assert.match(r[0].resume, /3 SPEC\(s\) présentée.*7 feedback/);
});

test('lireRituels — résumé retro : lessons_learned', () => {
  const r = lireRituels(donnees({ retro: [
    { mtime: 1000, nom: 'r.md', file: 'r.md', data: { lessons_learned: 4 } },
  ] }));
  assert.match(r[0].resume, /4 LL/);
});

test('lireRituels — fallback "rituel enregistré" si pas de clé reconnue', () => {
  const r = lireRituels(donnees({ standup: [
    { mtime: 1000, nom: 's.md', file: 's.md', data: { auteur: 'X' } },
  ] }));
  assert.equal(r[0].resume, 'rituel enregistré');
});

test('blocRituels — pas de rituel → chaîne vide', () => {
  assert.equal(blocRituels(donnees()), '');
});

test('blocRituels — rendu HTML avec dates lisibles + titres', () => {
  const html = blocRituels(donnees({
    standup: [{ mtime: Date.UTC(2026, 4, 13), nom: 's.md', file: 's.md', data: { wip: 4 } }],
    demo: [{ mtime: Date.UTC(2026, 4, 11), nom: 'd.md', file: 'd.md', data: { specs_presentees: 5 } }],
  }));
  assert.match(html, /Activité rituelle/);
  assert.match(html, /2 dernier\(s\) rituel\(s\)/);
  assert.match(html, /Standup/);
  assert.match(html, /Demo/);
  assert.match(html, /13\/05/);
  assert.match(html, /4 SPEC\(s\) en cours/);
});

test('Alias EN canoniques exposés', () => {
  assert.equal(readRituels, lireRituels);
  assert.equal(ritualsBlock, blocRituels);
});

// ─── #217 Tech Review intégré au flux ───────────────────────────────────────

test('lireRituels — agrège tech-review aussi', () => {
  const items = lireRituels(donnees({
    techReview: [
      { mtime: Date.UTC(2026, 4, 9), nom: 'tr.md', file: 'tr.md', data: { adrs_proposes: 2, decisions: 3 } },
    ],
  }));
  assert.equal(items.length, 1);
  assert.equal(items[0].type, 'tech-review');
  assert.equal(items[0].titre, 'Tech Review');
  assert.match(items[0].resume, /2 ADR\(s\) proposé\(s\)/);
  assert.match(items[0].resume, /3 décision\(s\) technique\(s\)/);
});

test('lireRituels — tech-review trié chronologiquement avec les autres', () => {
  const items = lireRituels(donnees({
    standup: [{ mtime: Date.UTC(2026, 4, 13), nom: 's.md', file: 's.md', data: { wip: 4 } }],
    techReview: [{ mtime: Date.UTC(2026, 4, 14), nom: 'tr.md', file: 'tr.md', data: { adrs: 1 } }],
  }));
  assert.equal(items.length, 2);
  assert.equal(items[0].type, 'tech-review', 'plus récent en tête');
  assert.equal(items[1].type, 'standup');
});

test('lireRituels — résumé tech-review fallback si aucune clé', () => {
  const items = lireRituels(donnees({
    techReview: [{ mtime: Date.UTC(2026, 4, 9), nom: 'tr.md', file: 'tr.md', data: {} }],
  }));
  assert.equal(items[0].resume, 'rituel enregistré');
});

test('lireRituels — tech-review supporte alias EN drifts_discutes', () => {
  const items = lireRituels(donnees({
    techReview: [{ mtime: Date.UTC(2026, 4, 9), nom: 'tr.md', file: 'tr.md', data: { drifts_discutes: 5 } }],
  }));
  assert.match(items[0].resume, /5 drift\(s\) discuté\(s\)/);
});
