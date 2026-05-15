// Tests #450 / #451 / #452 — Boucle 11 PM cockpit OKR/discovery/tags :
//   - alignement OKR (objectifs + key results ↔ Intents)
//   - discovery board (dual-track Agile)
//   - tag cloud transversal

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  lireRefsOkr, lireFichierOkr, calculerOkrMapping, blocOkrMapping,
  readOkrRefs, readOkrFile, computeOkrMapping, okrMappingSection,
} from '../lib/dashboard/okr-mapping.js';

import {
  classifierIntent, calculerDiscoveryBoard, blocDiscoveryBoard,
  classifyIntent, computeDiscoveryBoard, discoveryBoardSection,
} from '../lib/dashboard/discovery-board.js';

import {
  lireTagsIntent, calculerTagCloud, blocTagCloud,
  readIntentTags, computeTagCloud, tagCloudSection,
} from '../lib/dashboard/tag-cloud.js';

function tmpProjet() {
  const dir = join(tmpdir(), 'aiad-pm-v11-' + Math.random().toString(36).slice(2));
  mkdirSync(join(dir, '.aiad'), { recursive: true });
  return dir;
}

// ─── #450 — OKR mapping ─────────────────────────────────────────────────────

test('lireRefsOkr — frontmatter okr string', () => {
  assert.deepEqual(lireRefsOkr({ okr: 'KR-1.2' }), ['KR-1.2']);
});

test('lireRefsOkr — array okrs', () => {
  assert.deepEqual(lireRefsOkr({ okrs: ['KR-1.1', 'KR-1.3'] }).sort(), ['KR-1.1', 'KR-1.3']);
});

test('lireRefsOkr — fallback scan corpus si pas de frontmatter', () => {
  const i = { sections: { objectif: 'Servir KR-2.1 et booster O-3' } };
  const refs = lireRefsOkr(i);
  assert.ok(refs.includes('KR-2.1'));
  assert.ok(refs.includes('O-3'));
});

test('lireRefsOkr — frontmatter prime sur corpus', () => {
  const i = { okr: 'KR-1', sections: { objectif: 'mention de KR-99' } };
  assert.deepEqual(lireRefsOkr(i), ['KR-1']);
});

test('lireFichierOkr — parse objectifs + key results', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'OKR.md'), `# OKR Q3-2026
## O-1 — Leader EU
### KR-1.1 : 10k MAU
### KR-1.2 : Conversion > 70 %
## O-2 — Conformité
### KR-2.1 : Audit CNIL OK
`);
    const r = lireFichierOkr(dir);
    assert.equal(r.objectifs.length, 2);
    assert.equal(r.objectifs[0].id, 'O-1');
    assert.equal(r.objectifs[0].keyResults.length, 2);
    assert.equal(r.objectifs[0].keyResults[0].id, 'KR-1.1');
    assert.ok(r.objectifs[0].keyResults[0].description.includes('10k MAU'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireFichierOkr — absent → vide', () => {
  const dir = tmpProjet();
  try {
    const r = lireFichierOkr(dir);
    assert.equal(r.fichier, null);
    assert.equal(r.objectifs.length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerOkrMapping — KR rattachés + orphelines détectées', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'OKR.md'), `## O-1 — Leader
### KR-1.1 : Acquisition
### KR-1.2 : Rétention
`);
    const donnees = { intents: [
      { id: 'INTENT-A', titre: 'a', okr: 'KR-1.1' },
      { id: 'INTENT-B', titre: 'b', okr: 'KR-999' }, // orphelin
      { id: 'INTENT-C', titre: 'c' }, // pas d'OKR
    ]};
    const r = calculerOkrMapping(dir, donnees);
    assert.equal(r.totaux.objectifs, 1);
    assert.equal(r.totaux.keyResults, 2);
    const kr11 = r.objectifs[0].keyResults.find((k) => k.id === 'KR-1.1');
    assert.equal(kr11.intents.length, 1);
    assert.equal(kr11.intents[0].id, 'INTENT-A');
    const kr12 = r.objectifs[0].keyResults.find((k) => k.id === 'KR-1.2');
    assert.equal(kr12.intents.length, 0, 'KR sans Intent');
    assert.equal(r.orphelines.length, 1);
    assert.equal(r.orphelines[0].ref, 'KR-999');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('blocOkrMapping — empty si pas de fichier + pas d\'orphelin', () => {
  const html = blocOkrMapping({ okrMapping: { fichier: null, objectifs: [], orphelines: [], totaux: {} } });
  assert.equal(html, '');
});

test('blocOkrMapping — rend objectifs + KR + chips Intents + bannière orphelines', () => {
  const html = blocOkrMapping({ okrMapping: {
    fichier: '.aiad/OKR.md',
    objectifs: [{
      id: 'O-1', description: 'Test', intentsDirect: [],
      keyResults: [
        { id: 'KR-1.1', description: 'D1', intents: [{ id: 'INTENT-A', titre: 'a', file: null }] },
        { id: 'KR-1.2', description: 'D2', intents: [] },
      ],
    }],
    orphelines: [{ ref: 'KR-99', intents: [{ id: 'INTENT-X', titre: 'x', file: null }] }],
    totaux: { objectifs: 1, keyResults: 2, intentsAlignes: 1, intentsTotal: 2, orphelines: 1 },
  }});
  assert.ok(html.includes('Alignement OKR'));
  assert.ok(html.includes('O-1'));
  assert.ok(html.includes('KR-1.1'));
  assert.ok(html.includes('is-orphelin'));
  assert.ok(html.includes('aucun Intent rattaché'));
  assert.ok(html.includes('1 référence(s) OKR orpheline'));
  assert.ok(html.includes('KR-99'));
});

// ─── #451 — Discovery board ─────────────────────────────────────────────────

test('classifierIntent — kinds discovery reconnus + fallback delivery', () => {
  assert.equal(classifierIntent({ kind: 'discovery' }), 'discovery');
  assert.equal(classifierIntent({ kind: 'experiment' }), 'experiment');
  assert.equal(classifierIntent({ kind: 'spike' }), 'spike');
  assert.equal(classifierIntent({ track: 'research' }), 'research');
  assert.equal(classifierIntent({ kind: 'delivery' }), 'delivery');
  assert.equal(classifierIntent({}), 'delivery', 'pas de kind → delivery par défaut');
  assert.equal(classifierIntent({ kind: 'wat' }), 'delivery', 'inconnu → delivery safe');
});

test('calculerDiscoveryBoard — bucketise par kind', () => {
  const d = { intents: [
    { id: 'A', kind: 'discovery', statut: 'active' },
    { id: 'B', kind: 'experiment', statut: 'draft' },
    { id: 'C', statut: 'active' },
  ]};
  const r = calculerDiscoveryBoard(d);
  assert.equal(r.discovery.length, 1);
  assert.equal(r.experiment.length, 1);
  assert.equal(r.delivery.length, 1);
  assert.equal(r.totaux.discovery, 2);
  assert.equal(r.totaux.delivery, 1);
});

test('blocDiscoveryBoard — empty si zéro intent total', () => {
  assert.equal(blocDiscoveryBoard({ discoveryBoard: { discovery: [], experiment: [], spike: [], research: [], prototype: [], delivery: [], totaux: { discovery: 0, delivery: 0, total: 0 } } }), '');
});

test('blocDiscoveryBoard — message si tout en delivery', () => {
  const html = blocDiscoveryBoard({ discoveryBoard: {
    discovery: [], experiment: [], spike: [], research: [], prototype: [],
    delivery: [{ id: 'INTENT-A', titre: 't', statut: 'active', file: null }],
    totaux: { discovery: 0, delivery: 1, total: 1 },
  }});
  assert.ok(html.includes('Discovery board'));
  assert.ok(html.includes('tout est qualifié'));
  assert.ok(html.includes('INTENT-A'));
});

test('blocDiscoveryBoard — colonnes avec badge hypothesisStatus', () => {
  const html = blocDiscoveryBoard({ discoveryBoard: {
    discovery: [{ id: 'INTENT-A', titre: 't', statut: 'active', file: null, hypothesisStatus: 'untested' }],
    experiment: [{ id: 'INTENT-B', titre: 'b', statut: 'active', file: null, hypothesisStatus: 'validated' }],
    spike: [], research: [], prototype: [], delivery: [],
    totaux: { discovery: 2, delivery: 0, total: 2 },
  }});
  assert.ok(html.includes('is-discovery'));
  assert.ok(html.includes('is-experiment'));
  assert.ok(html.includes('untested'));
  assert.ok(html.includes('validated'));
});

// ─── #452 — Tag cloud ───────────────────────────────────────────────────────

test('lireTagsIntent — array + string CSV + normalisation lowercase + tirets', () => {
  assert.deepEqual(lireTagsIntent({ tags: ['Mobile', 'paiement'] }).sort(), ['mobile', 'paiement']);
  assert.deepEqual(lireTagsIntent({ tags: 'mobile, growth Q3' }).sort(), ['growth-q3', 'mobile']);
  assert.deepEqual(lireTagsIntent({ tags: '#auth, @urgent' }).sort(), ['auth', 'urgent']);
});

test('lireTagsIntent — alias labels / etiquettes', () => {
  assert.ok(lireTagsIntent({ labels: ['x'] }).includes('x'));
  assert.ok(lireTagsIntent({ etiquettes: 'y' }).includes('y'));
});

test('calculerTagCloud — tri par fréquence desc + alphabétique', () => {
  const d = { intents: [
    { id: 'A', tags: ['mobile', 'q3'] },
    { id: 'B', tags: ['mobile', 'paiement'] },
    { id: 'C', tags: ['mobile'] },
    { id: 'D', tags: ['q3'] },
  ]};
  const r = calculerTagCloud(d);
  assert.equal(r.tags[0].tag, 'mobile');
  assert.equal(r.tags[0].count, 3);
  assert.equal(r.tags[1].tag, 'q3');
  assert.equal(r.tags[1].count, 2);
  assert.equal(r.totaux.tagsUniques, 3);
  assert.equal(r.totaux.intentsAvecTag, 4);
});

test('calculerTagCloud — Intents sans tags → comptés en non-tagués', () => {
  const r = calculerTagCloud({ intents: [{ id: 'A', tags: ['x'] }, { id: 'B' }] });
  assert.equal(r.totaux.intentsAvecTag, 1);
  assert.equal(r.totaux.intentsTotal, 2);
});

test('blocTagCloud — empty si zéro tag', () => {
  const html = blocTagCloud({ tagCloud: { tags: [], totaux: { tagsUniques: 0 } } });
  assert.ok(html.includes('aucun tag déclaré'));
});

test('blocTagCloud — chips + tailles graduées + script drill-down', () => {
  const html = blocTagCloud({ tagCloud: {
    tags: [
      { tag: 'mobile', count: 4, intents: [{ id: 'INTENT-A', titre: 't', statut: 'active', file: null }] },
      { tag: 'q3', count: 1, intents: [{ id: 'INTENT-B', titre: 'b', statut: 'draft', file: null }] },
    ],
    totaux: { tagsUniques: 2, intentsAvecTag: 5, intentsTotal: 5 },
  }});
  assert.ok(html.includes('Tag cloud'));
  assert.ok(html.includes('#mobile'));
  assert.ok(html.includes('#q3'));
  assert.ok(html.includes('tag-chip-size-4'), 'taille max pour le tag le plus fréquent');
  assert.ok(html.includes('tag-data'), 'données JSON pour drill-down');
  assert.ok(html.includes('aria-pressed'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof readOkrRefs, 'function');
  assert.equal(typeof readOkrFile, 'function');
  assert.equal(typeof computeOkrMapping, 'function');
  assert.equal(typeof okrMappingSection, 'function');
  assert.equal(typeof classifyIntent, 'function');
  assert.equal(typeof computeDiscoveryBoard, 'function');
  assert.equal(typeof discoveryBoardSection, 'function');
  assert.equal(typeof readIntentTags, 'function');
  assert.equal(typeof computeTagCloud, 'function');
  assert.equal(typeof tagCloudSection, 'function');
});
