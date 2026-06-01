// Tests #137 — Widget Product Manager "À valider cette semaine".

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  intentsZombies, intentsDraftsAnciens, lastDemoMtime, specsDoneNonDemontrees,
  calculerPm, pmSection,
  zombieIntents, oldDraftIntents, undemonstratedDoneSpecs, lastDemoTime, computePm,
} from '../lib/dashboard/pm.js';

const now = Date.now();
const days = (n) => 24 * 3600 * 1000 * n;

test('intentsZombies — active > 30j sans SPEC récente → flagué', () => {
  const d = {
    intents: [
      { id: 'INTENT-001', statut: 'active', mtime: now - days(45), titre: 'Vieux' },
      { id: 'INTENT-002', statut: 'active', mtime: now - days(45), titre: 'Avec SPEC récente' },
      { id: 'INTENT-003', statut: 'active', mtime: now - days(10), titre: 'Récent' },
      { id: 'INTENT-004', statut: 'draft', mtime: now - days(45), titre: 'Draft pas active' },
    ],
    specs: [
      { id: 'SPEC-002-1-x', parentIntent: 'INTENT-002', mtime: now - days(5) },
    ],
  };
  const r = intentsZombies(d);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'INTENT-001');
  assert.ok(r[0].anciennete >= 30);
});

test('intentsZombies — seuils personnalisables', () => {
  const d = {
    intents: [{ id: 'INTENT-001', statut: 'active', mtime: now - days(20) }],
    specs: [],
  };
  assert.equal(intentsZombies(d).length, 0, 'défaut 30j → ok');
  assert.equal(intentsZombies(d, { intentZombieJours: 14, intentDraftJours: 14 }).length, 1, 'seuil 14j → zombie');
});

test('intentsDraftsAnciens — draft > 14j → flagué', () => {
  const d = {
    intents: [
      { id: 'INTENT-001', statut: 'draft', mtime: now - days(20), titre: 'Vieux draft' },
      { id: 'INTENT-002', statut: 'draft', mtime: now - days(3), titre: 'Récent draft' },
      { id: 'INTENT-003', statut: 'active', mtime: now - days(20), titre: 'Pas draft' },
    ],
  };
  const r = intentsDraftsAnciens(d);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'INTENT-001');
});

test('lastDemoMtime — pas de demo → null', () => {
  assert.equal(lastDemoMtime({}), null);
  assert.equal(lastDemoMtime({ metrics: { categories: { demo: { fichiers: [] } } } }), null);
});

test('lastDemoMtime — retourne le max des mtimes', () => {
  const r = lastDemoMtime({
    metrics: { categories: { demo: { fichiers: [
      { mtime: 1000 }, { mtime: 5000 }, { mtime: 3000 },
    ] } } },
  });
  assert.equal(r, 5000);
});

test('specsDoneNonDemontrees — pas de demo → toutes les done listées', () => {
  const d = {
    specs: [
      { id: 'SPEC-001-x', statut: 'done', mtime: now - days(1) },
      { id: 'SPEC-002-x', statut: 'ready', mtime: now - days(1) },
    ],
    metrics: { categories: { demo: { fichiers: [] } } },
  };
  const r = specsDoneNonDemontrees(d);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'SPEC-001-x');
});

test('specsDoneNonDemontrees — demo postérieure → spec démontrée → exclue', () => {
  const d = {
    specs: [
      { id: 'SPEC-A', statut: 'done', mtime: now - days(5) },  // antérieure demo → démontrée
      { id: 'SPEC-B', statut: 'done', mtime: now - days(1) },  // postérieure demo → non démontrée
    ],
    metrics: { categories: { demo: { fichiers: [{ mtime: now - days(3) }] } } },
  };
  const r = specsDoneNonDemontrees(d);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'SPEC-B');
});

test('calculerPm — façade renvoie 5 clés', () => {
  const r = calculerPm({ intents: [], specs: [], metrics: { categories: { demo: { fichiers: [] } } } });
  assert.ok('zombies' in r);
  assert.ok('draftsAnciens' in r);
  assert.ok('specsNonDemontrees' in r);
  assert.ok('seuils' in r);
  assert.ok('lastDemoMtime' in r);
});

test('pmSection — sans alerte → badge "À jour"', () => {
  const html = pmSection({ pm: { zombies: [], draftsAnciens: [], specsNonDemontrees: [], seuils: { intentZombieJours: 30, intentDraftJours: 14 }, lastDemoMtime: null } });
  assert.match(html, /À valider cette semaine/);
  assert.match(html, /badge ok.>À jour</);
});

test('pmSection — avec alertes → badge action + tableau', () => {
  const html = pmSection({ pm: {
    zombies: [{ id: 'INTENT-001', titre: 'Vieux Intent', anciennete: 45 }],
    draftsAnciens: [],
    specsNonDemontrees: [{ id: 'SPEC-A', titre: 'Spec done', mtime: now - days(1) }],
    seuils: { intentZombieJours: 30, intentDraftJours: 14 },
    lastDemoMtime: now - days(7),
  } });
  assert.match(html, /2 action\(s\)/);
  assert.match(html, /INTENT-001/);
  assert.match(html, /SPEC-A/);
  assert.match(html, /Dernière demo/);
});

// (#159 / #335) Liens cliquables vers fichier source via lienSource() qui
// respecte --source-base (pattern uniformisé sur toute la dashboard).
test('pmSection — zombie avec file → ID encapsulé dans <a class="src-link"…>', () => {
  const html = pmSection({ pm: {
    zombies: [{ id: 'INTENT-001', titre: 'Z', anciennete: 45, file: '.aiad/intents/INTENT-001-foo.md' }],
    draftsAnciens: [],
    specsNonDemontrees: [],
    seuils: { intentZombieJours: 30, intentDraftJours: 14 },
    lastDemoMtime: null,
  } });
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/intents\/INTENT-001-foo\.md"[^>]*>INTENT-001<\/a>/);
});

test('pmSection — spec done non démontrée avec file → lien vers SPEC .md', () => {
  const html = pmSection({ pm: {
    zombies: [],
    draftsAnciens: [],
    specsNonDemontrees: [{ id: 'SPEC-013-1-x', titre: 'X', mtime: now - days(1), file: '.aiad/specs/SPEC-013-1-x.md' }],
    seuils: { intentZombieJours: 30, intentDraftJours: 14 },
    lastDemoMtime: null,
  } });
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/specs\/SPEC-013-1-x\.md"[^>]*>SPEC-013-1-x<\/a>/);
});

// (#335) pm idLien respecte --source-base
test('#335 pmSection — idLien respecte --source-base (préfixe absolu)', async () => {
  const { setSourceBase } = await import('../lib/dashboard/render.js');
  setSourceBase('https://github.com/o/r/blob/main');
  try {
    const html = pmSection({ pm: {
      zombies: [{ id: 'INTENT-001', titre: 'Z', anciennete: 45, file: '.aiad/intents/INTENT-001-foo.md' }],
      draftsAnciens: [],
      specsNonDemontrees: [],
      seuils: { intentZombieJours: 30, intentDraftJours: 14 },
      lastDemoMtime: null,
    } });
    assert.match(html, /href="https:\/\/github\.com\/o\/r\/blob\/main\/\.aiad\/intents\/INTENT-001-foo\.md"/);
  } finally { setSourceBase(''); }
});

test('pmSection — sans file → ID en <code> simple (pas de lien)', () => {
  const html = pmSection({ pm: {
    zombies: [{ id: 'INTENT-X', titre: 'no file', anciennete: 99 }],
    draftsAnciens: [],
    specsNonDemontrees: [],
    seuils: { intentZombieJours: 30, intentDraftJours: 14 },
    lastDemoMtime: null,
  } });
  // <code>INTENT-X</code> sans <a> autour
  assert.match(html, /<td><code>INTENT-X<\/code><\/td>/);
});

test('intentsZombies — entrées exposent désormais le champ `file` (#159)', () => {
  const d = {
    intents: [
      { id: 'INTENT-001', statut: 'active', mtime: now - days(45), titre: 'X', file: '.aiad/intents/INTENT-001.md' },
    ],
    specs: [],
  };
  const r = intentsZombies(d);
  assert.equal(r.length, 1);
  assert.equal(r[0].file, '.aiad/intents/INTENT-001.md');
});

// (#158) Utilisation de activated_at frontmatter
test('intentsZombies — préfère activated_at au mtime quand présent (#158)', () => {
  // mtime récent (édition cosmétique du fichier hier) mais activated_at très ancien
  const isoOld = new Date(now - days(60)).toISOString().slice(0, 10);
  const d = {
    intents: [
      { id: 'INTENT-001', statut: 'active', mtime: now - days(2), activatedAt: isoOld, titre: 'X' },
    ],
    specs: [],
  };
  const r = intentsZombies(d);
  assert.equal(r.length, 1, 'doit être détecté zombie via activated_at malgré mtime récent');
  assert.equal(r[0].activatedAt, isoOld);
  assert.equal(r[0].sourceAge, 'activated_at');
  assert.ok(r[0].anciennete >= 60);
});

test('intentsZombies — fallback mtime quand activated_at absent (#158)', () => {
  const d = {
    intents: [
      { id: 'INTENT-001', statut: 'active', mtime: now - days(45), titre: 'X' },
    ],
    specs: [],
  };
  const r = intentsZombies(d);
  assert.equal(r.length, 1);
  assert.equal(r[0].sourceAge, 'mtime');
  assert.equal(r[0].activatedAt, null);
});

test('intentsZombies — activated_at récent malgré mtime ancien → PAS zombie (#158)', () => {
  // Cas inverse : intent réactivé récemment (activated_at récent) mais fichier
  // hérité d'un ancien Intent. On ne doit PAS le flagger zombie.
  const isoRecent = new Date(now - days(10)).toISOString().slice(0, 10);
  const d = {
    intents: [
      { id: 'INTENT-001', statut: 'active', mtime: now - days(90), activatedAt: isoRecent, titre: 'X' },
    ],
    specs: [],
  };
  assert.equal(intentsZombies(d).length, 0, 'activated_at récent doit primer sur mtime ancien');
});

test('intentsZombies — activated_at malformé → fallback mtime', () => {
  const d = {
    intents: [
      { id: 'INTENT-001', statut: 'active', mtime: now - days(45), activatedAt: 'not-a-date', titre: 'X' },
    ],
    specs: [],
  };
  const r = intentsZombies(d);
  assert.equal(r.length, 1);
  assert.equal(r[0].sourceAge, 'mtime');
});

test('pmSection — sans pm dans donnees → renvoie chaîne vide', () => {
  assert.equal(pmSection({}), '');
  assert.equal(pmSection({ pm: null }), '');
});

test('Alias EN canoniques exposés', () => {
  assert.equal(typeof zombieIntents, 'function');
  assert.equal(typeof oldDraftIntents, 'function');
  assert.equal(typeof undemonstratedDoneSpecs, 'function');
  assert.equal(typeof lastDemoTime, 'function');
  assert.equal(typeof computePm, 'function');
});
