// Tests #432 / #433 / #434 — Boucle 5 PM cockpit communication/temps :
//   - brief PM Markdown export
//   - diff "what changed this week" (snapshot persisté)
//   - intent dependencies (depends_on / blocked_by + cycles)

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  genererBriefPm, blocBriefPm,
  generatePmBrief, pmBriefSection,
} from '../lib/dashboard/brief-pm.js';

import {
  ecrireSnapshot, lireSnapshots, snapshotReference, diffSnapshots,
  calculerPmDiff, blocPmDiff,
  writeSnapshot, readSnapshots, referenceSnapshot, diffSnaps, computePmDiff, pmDiffSection,
} from '../lib/dashboard/pm-diff.js';

import {
  construireGrapheDeps, detecterCycles, calculerDeps, blocIntentDeps,
  buildDependencyGraph, detectCycles, computeIntentDependencies, intentDependenciesSection,
} from '../lib/dashboard/intent-deps.js';

function tmpProjet() {
  const dir = join(tmpdir(), 'aiad-pm-v5-' + Math.random().toString(36).slice(2));
  mkdirSync(join(dir, '.aiad'), { recursive: true });
  return dir;
}

// ─── #432 — Brief PM ─────────────────────────────────────────────────────────

test('genererBriefPm — Markdown structuré avec titre + état + sections', () => {
  const md = genererBriefPm({
    projet: { nom: 'TestProjet' },
    santeGlobale: { score: 75, total: 100, niveau: 'sain' },
    maturite: { score: 4, total: 5, label: 'Actif' },
    intents: [{ id: 'A', statut: 'active' }, { id: 'B', statut: 'draft' }],
    specs: [{ id: 'S1' }],
  });
  assert.ok(md.startsWith('# Brief PM — TestProjet'));
  assert.ok(md.includes('## État général'));
  assert.ok(md.includes('Santé projet : **75/100**'));
  assert.ok(md.includes('Maturité SDD : **4/5**'));
  assert.ok(md.includes('1 actif(s)'));
});

test('genererBriefPm — section Alertes si pm signals', () => {
  const md = genererBriefPm({
    pm: { zombies: [{ id: 'Z1' }], draftsAnciens: [], specsNonDemontrees: [{ id: 'S1' }] },
  });
  assert.ok(md.includes('## Alertes PM'));
  assert.ok(md.includes('1 Intent(s) zombie'));
  assert.ok(md.includes('1 SPEC(s) done non démontrées'));
});

test('genererBriefPm — top priorités triées P0 puis P1', () => {
  const md = genererBriefPm({
    intents: [
      { id: 'A', titre: 'a', statut: 'active', priority: 'P2' },
      { id: 'B', titre: 'b', statut: 'active', priority: 'P0' },
      { id: 'C', titre: 'c', statut: 'done', priority: 'P0' }, // exclu : done
    ],
  });
  const idxB = md.indexOf('B');
  const idxA = md.indexOf('A');
  assert.ok(idxB > 0 && idxA > 0 && idxB < idxA, 'B (P0) doit apparaître avant A (P2)');
  // C est done → exclu du pipeline. "- C" en sous-chaîne pourrait matcher
  // "- Catalogue" → on cherche le pattern exact "- C [" ou "- C —".
  assert.ok(!md.match(/- C\s+[—\[]/), 'C est done, exclu du pipeline');
});

test('genererBriefPm — section Échéances et Démo si dispo', () => {
  const md = genererBriefPm({
    deadlines: { totaux: { retard: 1, urgent: 0 }, buckets: {
      retard: [{ id: 'X', titre: 'x', joursRestants: -3 }],
      urgent: [], proche: [], planifie: [], 'sans-cible': [], livre: [],
    }},
    demoReadiness: { total: 1, intents: [{ id: 'INTENT-Z', titre: 'z' }], specs: [], lastDemo: null },
  });
  assert.ok(md.includes('Échéances actionnables'));
  assert.ok(md.includes('J+3 en retard'));
  assert.ok(md.includes('Démo à préparer'));
});

test('blocBriefPm — rend <pre> avec user-select:all', () => {
  const html = blocBriefPm({ projet: { nom: 'X' } });
  assert.ok(html.includes('Brief PM exportable'));
  assert.ok(html.includes('class="brief-pm-pre"'));
  assert.ok(html.includes('# Brief PM'));
});

// ─── #433 — PM diff ──────────────────────────────────────────────────────────

test('ecrireSnapshot — écrit JSON dans .aiad/metrics/pm-snapshots/', () => {
  const dir = tmpProjet();
  try {
    const r = ecrireSnapshot(dir, { intents: [{ id: 'A', statut: 'active' }], specs: [] }, { date: '2026-05-01' });
    assert.ok(r.ecrit);
    const f = join(dir, '.aiad', 'metrics', 'pm-snapshots', '2026-05-01.json');
    assert.ok(existsSync(f));
    const data = JSON.parse(readFileSync(f, 'utf-8'));
    assert.equal(data.intents[0].id, 'A');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('ecrireSnapshot — dryRun n\'écrit pas', () => {
  const dir = tmpProjet();
  try {
    const r = ecrireSnapshot(dir, { intents: [] }, { date: '2026-05-01', dryRun: true });
    assert.equal(r.ecrit, false);
    const f = join(dir, '.aiad', 'metrics', 'pm-snapshots', '2026-05-01.json');
    assert.equal(existsSync(f), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireSnapshots — tri chrono asc + ignore fichiers non YYYY-MM-DD', () => {
  const dir = tmpProjet();
  try {
    mkdirSync(join(dir, '.aiad', 'metrics', 'pm-snapshots'), { recursive: true });
    writeFileSync(join(dir, '.aiad', 'metrics', 'pm-snapshots', '2026-05-01.json'), '{"date":"2026-05-01","intents":[],"specs":[]}');
    writeFileSync(join(dir, '.aiad', 'metrics', 'pm-snapshots', '2026-04-20.json'), '{"date":"2026-04-20","intents":[],"specs":[]}');
    writeFileSync(join(dir, '.aiad', 'metrics', 'pm-snapshots', 'README.md'), 'ignored');
    const ss = lireSnapshots(dir);
    assert.equal(ss.length, 2);
    assert.equal(ss[0].date, '2026-04-20');
    assert.equal(ss[1].date, '2026-05-01');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('snapshotReference — choisit le snapshot le plus proche de J-7', () => {
  const now = Date.UTC(2026, 4, 15);
  const snapshots = [
    { date: '2026-05-15', data: {} },
    { date: '2026-05-08', data: {} }, // J-7
    { date: '2026-05-13', data: {} }, // J-2
  ];
  const ref = snapshotReference(snapshots, { now });
  assert.equal(ref.date, '2026-05-08');
});

test('snapshotReference — null si pas assez de snapshots', () => {
  assert.equal(snapshotReference([], {}), null);
  assert.equal(snapshotReference([{ date: '2026-05-15' }], {}), null);
});

test('diffSnapshots — détecte nouveaux + transitions', () => {
  const avant = { data: {
    intents: [{ id: 'A', statut: 'draft' }, { id: 'B', statut: 'active' }],
    specs: [{ id: 'S1', statut: 'in-progress', parentIntent: 'A' }],
  }};
  const apres = { data: {
    intents: [{ id: 'A', statut: 'active' }, { id: 'B', statut: 'done' }, { id: 'C', statut: 'draft' }],
    specs: [{ id: 'S1', statut: 'done', parentIntent: 'A' }, { id: 'S2', statut: 'ready', parentIntent: 'C' }],
  }};
  const d = diffSnapshots(avant, apres);
  assert.equal(d.intents.nouveaux.length, 1, 'C est nouveau');
  assert.equal(d.intents.nouveaux[0].id, 'C');
  assert.equal(d.intents.transitions.length, 2, 'A et B ont transitionné');
  assert.equal(d.intents.passesActifs.length, 1);
  assert.equal(d.intents.passesActifs[0].id, 'A');
  assert.equal(d.intents.passesDone.length, 1);
  assert.equal(d.intents.passesDone[0].id, 'B');
  assert.equal(d.specs.nouvelles.length, 1);
  assert.equal(d.specs.passesDone.length, 1);
  assert.equal(d.specs.passesDone[0].id, 'S1');
});

test('calculerPmDiff — écrit snapshot + retourne diff vs reference', () => {
  const dir = tmpProjet();
  try {
    // Snapshot ancien à J-7
    const dir7 = join(dir, '.aiad', 'metrics', 'pm-snapshots');
    mkdirSync(dir7, { recursive: true });
    const dateAncienne = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    writeFileSync(join(dir7, `${dateAncienne}.json`), JSON.stringify({
      date: dateAncienne,
      intents: [{ id: 'A', statut: 'draft' }],
      specs: [],
    }));
    const r = calculerPmDiff(dir, { intents: [{ id: 'A', statut: 'active' }, { id: 'B', statut: 'draft' }], specs: [] });
    assert.ok(r.reference, 'référence trouvée');
    assert.ok(r.courant, 'snapshot courant');
    assert.equal(r.diff.intents.transitions.length, 1);
    assert.equal(r.diff.intents.nouveaux.length, 1);
    assert.equal(r.totalChangements, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('blocPmDiff — "snapshot initial posé" si pas de référence', () => {
  const html = blocPmDiff({ pmDiff: { reference: null, courant: { date: '2026-05-15' }, totalChangements: 0 } });
  assert.ok(html.includes('snapshot initial posé'));
});

test('blocPmDiff — message "aucun changement" si reference + total=0', () => {
  const html = blocPmDiff({ pmDiff: {
    reference: { date: '2026-05-08' }, courant: { date: '2026-05-15' },
    diff: { intents: { nouveaux: [], transitions: [], passesActifs: [], passesDone: [], passesArchive: [] }, specs: { nouvelles: [], transitions: [], passesDone: [] } },
    totalChangements: 0,
  }});
  assert.ok(html.includes('aucun changement'));
});

test('blocPmDiff — rendu sections nouveaux/transitions', () => {
  const html = blocPmDiff({ pmDiff: {
    reference: { date: '2026-05-08' }, courant: { date: '2026-05-15' },
    diff: {
      intents: {
        nouveaux: [{ id: 'INTENT-C', statut: 'draft' }],
        transitions: [{ id: 'INTENT-A', de: 'draft', vers: 'active' }],
        passesActifs: [{ id: 'INTENT-A', de: 'draft' }], passesDone: [], passesArchive: [],
      },
      specs: { nouvelles: [], transitions: [{ id: 'SPEC-X', de: 'ready', vers: 'done' }], passesDone: [] },
    },
    totalChangements: 3,
  }});
  assert.ok(html.includes('3 changement(s)'));
  assert.ok(html.includes('Intents capturés'));
  assert.ok(html.includes('INTENT-C'));
  assert.ok(html.includes('Transitions Intent'));
  assert.ok(html.includes('draft → active'));
  assert.ok(html.includes('Transitions SPEC'));
});

// ─── #434 — Intent dependencies ─────────────────────────────────────────────

test('construireGrapheDeps — depends_on lu + maps inverses', () => {
  const intents = [
    { id: 'INTENT-A', depends_on: ['INTENT-B'] },
    { id: 'INTENT-B' },
    { id: 'INTENT-C', blocked_by: 'INTENT-B' },
  ];
  const g = construireGrapheDeps(intents);
  assert.deepEqual(g.bloquePar.get('INTENT-A'), ['INTENT-B']);
  assert.deepEqual(g.bloquePar.get('INTENT-C'), ['INTENT-B']);
  assert.deepEqual(g.bloque.get('INTENT-B').sort(), ['INTENT-A', 'INTENT-C']);
});

test('construireGrapheDeps — matching court INTENT-NNN ↔ ID long', () => {
  const intents = [
    { id: 'INTENT-101-long-slug', depends_on: ['INTENT-102'] },
    { id: 'INTENT-102-other-slug' },
  ];
  const g = construireGrapheDeps(intents);
  assert.deepEqual(g.bloquePar.get('INTENT-101-long-slug'), ['INTENT-102-other-slug']);
});

test('construireGrapheDeps — auto-dépendance ignorée', () => {
  const intents = [{ id: 'INTENT-A', depends_on: ['INTENT-A'] }];
  const g = construireGrapheDeps(intents);
  assert.deepEqual(g.bloquePar.get('INTENT-A'), []);
});

test('detecterCycles — chaîne A→B→A détectée', () => {
  const intents = [
    { id: 'INTENT-A', depends_on: ['INTENT-B'] },
    { id: 'INTENT-B', depends_on: ['INTENT-A'] },
  ];
  const g = construireGrapheDeps(intents);
  const cycles = detecterCycles(intents, g);
  assert.ok(cycles.length >= 1);
  assert.ok(cycles[0].includes('INTENT-A'));
  assert.ok(cycles[0].includes('INTENT-B'));
});

test('calculerDeps — bloqueActif true si dépendance non livrée', () => {
  const donnees = { intents: [
    { id: 'INTENT-A', statut: 'active', depends_on: ['INTENT-B'] },
    { id: 'INTENT-B', statut: 'active' }, // pas done → bloque
    { id: 'INTENT-C', statut: 'active', depends_on: ['INTENT-D'] },
    { id: 'INTENT-D', statut: 'done' }, // done → libère C
  ]};
  const d = calculerDeps(donnees);
  const a = d.intents.find((i) => i.id === 'INTENT-A');
  const c = d.intents.find((i) => i.id === 'INTENT-C');
  assert.equal(a.bloqueActif, true);
  assert.equal(c.bloqueActif, false);
  // 4 Intents ont au moins 1 lien (A↔B et C↔D), tous comptés via avecDeps.
  assert.equal(d.totaux.avecDeps, 4);
  assert.equal(d.totaux.bloquesActifs, 1, 'seul A est bloqué actif (B non livré)');
});

test('blocIntentDeps — empty si pas de deps', () => {
  assert.equal(blocIntentDeps({ intentDeps: { intents: [], avecDeps: [], cycles: [], totaux: { avecDeps: 0, cycles: 0 } } }), '');
});

test('blocIntentDeps — cartes + bannière cycle', () => {
  const html = blocIntentDeps({ intentDeps: {
    intents: [],
    avecDeps: [{ id: 'INTENT-A', titre: 't', statut: 'active', file: null, bloquePar: [{ id: 'INTENT-B', titre: 'b', statut: 'draft', livre: false }], bloque: [], bloqueActif: true }],
    cycles: [['INTENT-X', 'INTENT-Y', 'INTENT-X']],
    totaux: { avecDeps: 1, bloquesActifs: 1, cycles: 1 },
  }});
  assert.ok(html.includes('Dépendances Intent'));
  assert.ok(html.includes('1 cycle(s) détecté(s)'));
  assert.ok(html.includes('INTENT-A'));
  assert.ok(html.includes('Bloqué par'));
  assert.ok(html.includes('is-bloque'));
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — toutes les variantes EN', () => {
  assert.equal(typeof generatePmBrief, 'function');
  assert.equal(typeof pmBriefSection, 'function');
  assert.equal(typeof writeSnapshot, 'function');
  assert.equal(typeof readSnapshots, 'function');
  assert.equal(typeof referenceSnapshot, 'function');
  assert.equal(typeof diffSnaps, 'function');
  assert.equal(typeof computePmDiff, 'function');
  assert.equal(typeof pmDiffSection, 'function');
  assert.equal(typeof buildDependencyGraph, 'function');
  assert.equal(typeof detectCycles, 'function');
  assert.equal(typeof computeIntentDependencies, 'function');
  assert.equal(typeof intentDependenciesSection, 'function');
});
