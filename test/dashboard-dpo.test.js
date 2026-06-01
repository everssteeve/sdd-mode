// Tests #205 — Page DPO (DPIA + inventaire RGPD + coverage + angles morts).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  calculerDpo, pageDpo,
  computeDpo, dpoPage,
} from '../lib/dashboard/dpo.js';

function donnees(opts = {}) {
  return {
    specs: opts.specs || [],
    supplementaire: opts.supplementaire || { dpia: { total: 0, fichiers: [], latest: null } },
  };
}

function codeInline(path, opts = {}) {
  return {
    path,
    isTest: false,
    annotated: true,
    annotations: {
      intents: [],
      specs: (opts.specs || []).map((id) => ({ id, line: 1 })),
      verifiedBy: [],
      governance: (opts.governance || []).map((tags) => ({ tags: tags.split(','), line: 5 })),
    },
  };
}

test('calculerDpo — projet vide → totaux 0', () => {
  const r = calculerDpo(null, donnees(), { codeScan: [] });
  assert.equal(r.dpia.total, 0);
  assert.equal(r.specsRgpd.total, 0);
  assert.equal(r.fichiersRgpd.total, 0);
  assert.equal(r.coverage.ratio, null);
});

test('calculerDpo — DPIA propagée depuis supplementaire', () => {
  const r = calculerDpo(null, donnees({
    supplementaire: { dpia: { total: 2, latest: { date: '2026-05-13', complete: true }, fichiers: [
      { nom: 'DPIA-2026-05-13', file: '.aiad/metrics/rgpd/DPIA-2026-05-13.md', date: '2026-05-13', complete: true, aCompleter: 0 },
      { nom: 'DPIA-2026-04-01', file: '.aiad/metrics/rgpd/DPIA-2026-04-01.md', date: '2026-04-01', complete: false, aCompleter: 3 },
    ] } },
  }), { codeScan: [] });
  assert.equal(r.dpia.total, 2);
  assert.equal(r.dpia.latest.date, '2026-05-13');
  assert.equal(r.dpia.fichiers.length, 2);
  assert.equal(r.dpia.fichiers[0].complete, true);
});

test('calculerDpo — SPECs déclarant AIAD-RGPD listées', () => {
  const r = calculerDpo(null, donnees({
    specs: [
      { id: 'SPEC-001-1', governance: 'AIAD-RGPD', statut: 'ready' },
      { id: 'SPEC-002-1', governance: 'AIAD-AI-ACT', statut: 'ready' },
      { id: 'SPEC-003-1', governance: 'AIAD-RGPD,AIAD-RGAA', statut: 'done' },
    ],
  }), { codeScan: [] });
  assert.equal(r.specsRgpd.total, 2);
  const ids = r.specsRgpd.entrees.map((s) => s.id).sort();
  assert.deepEqual(ids, ['SPEC-001-1', 'SPEC-003-1']);
});

test('calculerDpo — fichiers code annotés @governance AIAD-RGPD comptés', () => {
  const r = calculerDpo(null, donnees(), { codeScan: [
    codeInline('src/auth.ts', { specs: ['SPEC-001-1'], governance: ['AIAD-RGPD'] }),
    codeInline('src/logger.ts', { specs: ['SPEC-002-1'], governance: ['AIAD-RGESN'] }),
    codeInline('src/user.ts', { specs: ['SPEC-001-1'], governance: ['AIAD-RGPD,AIAD-AI-ACT'] }),
  ] });
  assert.equal(r.fichiersRgpd.total, 2);
  const paths = r.fichiersRgpd.entrees.map((f) => f.path).sort();
  assert.deepEqual(paths, ['src/auth.ts', 'src/user.ts']);
});

test('calculerDpo — coverage : SPEC RGPD avec code annoté → couverte', () => {
  const r = calculerDpo(null, donnees({
    specs: [{ id: 'SPEC-001-1', governance: 'AIAD-RGPD', statut: 'ready' }],
  }), { codeScan: [
    codeInline('src/auth.ts', { specs: ['SPEC-001-1'], governance: ['AIAD-RGPD'] }),
  ] });
  assert.equal(r.coverage.couvertes, 1);
  assert.equal(r.coverage.nonCouvertes, 0);
  assert.equal(r.coverage.ratio, 1);
});

test('calculerDpo — coverage : SPEC RGPD active sans code → non couverte', () => {
  const r = calculerDpo(null, donnees({
    specs: [{ id: 'SPEC-001-1', governance: 'AIAD-RGPD', statut: 'in-progress' }],
  }), { codeScan: [
    codeInline('src/auth.ts', { specs: ['SPEC-001-1'], governance: [] }),
  ] });
  assert.equal(r.coverage.couvertes, 0);
  assert.equal(r.coverage.nonCouvertes, 1);
  assert.equal(r.coverage.ratio, 0);
});

test('calculerDpo — SPEC RGPD en draft → ignorée dans nonCouvertes', () => {
  const r = calculerDpo(null, donnees({
    specs: [{ id: 'SPEC-X', governance: 'AIAD-RGPD', statut: 'draft' }],
  }), { codeScan: [] });
  assert.equal(r.coverage.nonCouvertes, 0);
  assert.equal(r.coverage.ratio, null, 'aucune SPEC active → ratio null');
});

test('calculerDpo — ratio partiel (50%)', () => {
  const r = calculerDpo(null, donnees({
    specs: [
      { id: 'SPEC-001-1', governance: 'AIAD-RGPD', statut: 'ready' },
      { id: 'SPEC-002-1', governance: 'AIAD-RGPD', statut: 'done' },
    ],
  }), { codeScan: [
    codeInline('src/a.ts', { specs: ['SPEC-001-1'], governance: ['AIAD-RGPD'] }),
  ] });
  assert.equal(r.coverage.couvertes, 1);
  assert.equal(r.coverage.nonCouvertes, 1);
  assert.equal(r.coverage.ratio, 0.5);
});

test('pageDpo — sans données → empty state', () => {
  const html = pageDpo({});
  assert.match(html, /Données DPO non collectées/);
});

test('pageDpo — projet vide : DPIA section "Aucune DPIA générée"', () => {
  const html = pageDpo({ dpo: {
    dpia: { total: 0, fichiers: [], latest: null },
    specsRgpd: { total: 0, entrees: [] },
    fichiersRgpd: { total: 0, entrees: [] },
    coverage: { ratio: null, couvertes: 0, nonCouvertes: 0, entreesNonCouvertes: [] },
  } });
  assert.match(html, /Aucune DPIA générée/);
  assert.match(html, /Inventaire RGPD/);
  assert.match(html, />0</);
});

test('pageDpo — coverage 100% → badge vert', () => {
  const html = pageDpo({ dpo: {
    dpia: { total: 0, fichiers: [], latest: null },
    specsRgpd: { total: 2, entrees: [
      { id: 'SPEC-001-1', file: '.aiad/specs/SPEC-001-1.md', statut: 'ready' },
      { id: 'SPEC-002-1', file: '.aiad/specs/SPEC-002-1.md', statut: 'done' },
    ] },
    fichiersRgpd: { total: 3, entrees: [{ path: 'src/a.ts' }, { path: 'src/b.ts' }, { path: 'src/c.ts' }] },
    coverage: { ratio: 1.0, couvertes: 2, nonCouvertes: 0, entreesNonCouvertes: [] },
  } });
  assert.match(html, /badge-ok">100%/);
  assert.match(html, /src\/a\.ts/);
  assert.match(html, /SPEC-001-1/);
});

// (#350) SPEC IDs hyperliés dans les 2 tables dpo (cohérence pattern catalogues)
test('#350 pageDpo — SPEC ID cell hyperliée vers fichier (specsRgpd + angles morts)', () => {
  const html = pageDpo({ dpo: {
    dpia: { total: 0, fichiers: [], latest: null },
    specsRgpd: { total: 1, entrees: [{ id: 'SPEC-007-1', file: '.aiad/specs/SPEC-007-1.md', statut: 'ready' }] },
    fichiersRgpd: { total: 0, entrees: [] },
    coverage: { ratio: 0, couvertes: 0, nonCouvertes: 1, entreesNonCouvertes: [{ id: 'SPEC-007-1', file: '.aiad/specs/SPEC-007-1.md', statut: 'ready' }] },
  } });
  // SPEC-007-1 doit apparaître comme <a> au moins 1 fois (dans les 2 tables)
  const matches = html.match(/<a[^>]+href="\.\.\/\.aiad\/specs\/SPEC-007-1\.md"[^>]*>SPEC-007-1<\/a>/g);
  assert.ok(matches && matches.length >= 2, `attendu ≥ 2 occurrences, reçu : ${matches?.length || 0}`);
});

test('pageDpo — angles morts rendus si nonCouvertes > 0', () => {
  const html = pageDpo({ dpo: {
    dpia: { total: 0, fichiers: [], latest: null },
    specsRgpd: { total: 1, entrees: [{ id: 'SPEC-Z', file: '.aiad/specs/SPEC-Z.md', statut: 'ready' }] },
    fichiersRgpd: { total: 0, entrees: [] },
    coverage: { ratio: 0, couvertes: 0, nonCouvertes: 1, entreesNonCouvertes: [{ id: 'SPEC-Z', file: '.aiad/specs/SPEC-Z.md', statut: 'ready', fichiersCount: 0 }] },
  } });
  assert.match(html, /Angles morts RGPD/);
  assert.match(html, /1 SPEC\(s\) RGPD non couverte/);
  assert.match(html, /badge-bad">0%/);
});

test('pageDpo — DPIA latest complète → badge "complète"', () => {
  const html = pageDpo({ dpo: {
    dpia: { total: 1, latest: { date: '2026-05-13', complete: true, aCompleter: 0 }, fichiers: [{ nom: 'DPIA-2026-05-13', file: '.aiad/metrics/rgpd/DPIA-2026-05-13.md', date: '2026-05-13', complete: true, aCompleter: 0 }] },
    specsRgpd: { total: 0, entrees: [] },
    fichiersRgpd: { total: 0, entrees: [] },
    coverage: { ratio: null, couvertes: 0, nonCouvertes: 0, entreesNonCouvertes: [] },
  } });
  assert.match(html, /DPIA-2026-05-13/);
  assert.match(html, /badge-ok">complète/);
});

test('Alias EN canoniques', () => {
  assert.equal(computeDpo, calculerDpo);
  assert.equal(dpoPage, pageDpo);
});
