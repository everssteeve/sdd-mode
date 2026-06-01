// Tests #135 — Page QA Quality Assurance.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  specsReadySansTests, coverageParSpec, auditRollup, earsLintStatus,
  testsAjoutesCetteSemaine, calculerQa,
  lireRunsHistory, calculerRegressions,
  lireCoverageReel,
  readySpecsWithoutTests, coveragePerSpec, computeQa,
} from '../lib/dashboard/qa.js';
import { pageQa } from '../lib/dashboard/qa.js';

function donneesAvecMatrice({ specs = [], code = [], tests = [] } = {}) {
  return {
    matrice: {
      forward: [
        {
          intent: { id: 'INTENT-001' },
          specs: specs.map((s, i) => ({
            spec: { id: `SPEC-00${i + 1}-x`, titre: `Spec ${i + 1}`, status: s.statut, statut: s.statut },
            code: code[i] || [],
            tests: tests[i] || [],
          })),
        },
      ],
    },
    metrics: { categories: { audit: { fichiers: [] } } },
    specs: [],
  };
}

test('specsReadySansTests — filtre ready/in-progress/validation/done sans tests', () => {
  const d = donneesAvecMatrice({
    specs: [{ statut: 'ready' }, { statut: 'draft' }, { statut: 'done' }],
    code: [[{ path: 'a.ts' }, { path: 'b.ts' }], [], [{ path: 'c.ts' }]],
    tests: [[], [], []],
  });
  const r = specsReadySansTests(d);
  assert.equal(r.length, 2);
  // 'done' classé avant 'ready' par priorité (statut)
  assert.equal(r[0].statut, 'done');
  assert.equal(r[0].codeLies, 1);
  assert.equal(r[1].statut, 'ready');
  assert.equal(r[1].codeLies, 2);
});

// (#336) Spec.file + parent intent.file exposés pour hyperlien render
test('#336 specsReadySansTests — expose file + parentIntentFile', () => {
  const d = {
    matrice: {
      forward: [{
        intent: { id: 'INTENT-001', file: '.aiad/intents/INTENT-001-auth.md' },
        specs: [{
          spec: { id: 'SPEC-001-1', titre: 'OIDC', file: '.aiad/specs/SPEC-001-1-oidc.md', status: 'ready', statut: 'ready' },
          code: [{ path: 'a.ts' }],
          tests: [],
        }],
      }],
    },
    metrics: { categories: { audit: { fichiers: [] } } },
    specs: [],
  };
  const r = specsReadySansTests(d);
  assert.equal(r.length, 1);
  assert.equal(r[0].file, '.aiad/specs/SPEC-001-1-oidc.md');
  assert.equal(r[0].parentIntentFile, '.aiad/intents/INTENT-001-auth.md');
});

test('#336 coverageParSpec + earsLintStatus exposent spec.file', () => {
  // coverageParSpec via matrice
  const dCov = {
    matrice: {
      forward: [{
        intent: { id: 'I1' },
        specs: [{ spec: { id: 'SPEC-X-1', titre: 'X', file: '.aiad/specs/SPEC-X-1.md' }, code: [{ path: 'a.ts' }], tests: [] }],
      }],
    },
  };
  const cov = coverageParSpec(dCov);
  assert.equal(cov[0].file, '.aiad/specs/SPEC-X-1.md');
  // ears via donnees.specs
  const dEars = { specs: [{ id: 'SPEC-X-1', titre: 'X', file: '.aiad/specs/SPEC-X-1.md', format: 'ears', sqs: 4.5 }] };
  const ears = earsLintStatus(dEars);
  assert.equal(ears.liste[0].file, '.aiad/specs/SPEC-X-1.md');
});

test('specsReadySansTests — exclut les SPECs avec ≥1 test', () => {
  const d = donneesAvecMatrice({
    specs: [{ statut: 'ready' }],
    code: [[{ path: 'a.ts' }]],
    tests: [[{ path: 't.test.ts' }]],
  });
  assert.equal(specsReadySansTests(d).length, 0);
});

test('coverageParSpec — bands vide/partiel/ok corrects', () => {
  const d = donneesAvecMatrice({
    specs: [{ statut: 'ready' }, { statut: 'ready' }, { statut: 'ready' }],
    code: [[{ path: 'a.ts' }, { path: 'b.ts' }], [{ path: 'c.ts' }, { path: 'd.ts' }, { path: 'e.ts' }], [{ path: 'f.ts' }]],
    tests: [[], [{ path: 't1.test.ts' }], [{ path: 't2.test.ts' }, { path: 't3.test.ts' }]],
  });
  const r = coverageParSpec(d);
  // Tri vide → partiel → ok
  assert.equal(r[0].band, 'vide');
  assert.equal(r[1].band, 'partiel');
  assert.equal(r[2].band, 'ok');
  assert.equal(r[2].ratio, 2);
});

test('coverageParSpec — code=0 → ratio=null, band=na', () => {
  const d = donneesAvecMatrice({
    specs: [{ statut: 'ready' }],
    code: [[]],
    tests: [[]],
  });
  const r = coverageParSpec(d);
  assert.equal(r[0].band, 'na');
  assert.equal(r[0].ratio, null);
});

test('auditRollup — compte VALIDÉ/CORRECTIONS/REJET', () => {
  const d = {
    metrics: {
      categories: {
        audit: {
          fichiers: [
            { data: { verdict: 'VALIDÉ' } },
            { data: { verdict: 'CORRECTIONS' } },
            { data: { verdict: 'REJET' } },
            { data: { verdict: 'VALIDÉ' } },
            { data: { verdict: 'PASS' } },     // alias
            { data: { verdict: 'WARN' } },     // alias
            { data: { verdict: 'FAIL' } },     // alias
            { data: { verdict: 'BIZARRE' } },  // AUTRE
            { data: {} },                       // AUTRE (verdict manquant)
          ],
        },
      },
    },
  };
  const r = auditRollup(d);
  assert.equal(r.VALIDÉ, 3);
  assert.equal(r.CORRECTIONS, 2);
  assert.equal(r.REJET, 2);
  assert.equal(r.AUTRE, 2);
  assert.equal(r.total, 9);
});

test('earsLintStatus — passant si SQS ≥ 4, à re-linter sinon', () => {
  const d = {
    specs: [
      { id: 'SPEC-1', titre: 'X', format: 'EARS', sqs: 5 },
      { id: 'SPEC-2', titre: 'Y', format: 'EARS', sqs: 3 },
      { id: 'SPEC-3', titre: 'Z', format: 'prose', sqs: 5 },    // ignoré
      { id: 'SPEC-4', titre: 'W', format: 'EARS', sqs: undefined },
    ],
  };
  const r = earsLintStatus(d);
  assert.equal(r.total, 3);
  assert.equal(r.passants, 1);
  assert.equal(r.aRelinter, 2);
});

test('testsAjoutesCetteSemaine — fallback sans matrice.testFiles', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-qa-tests-'));
  try {
    mkdirSync(join(dir, 'tests'), { recursive: true });
    writeFileSync(join(dir, 'tests', 'a.test.ts'), 'export {}\n', 'utf-8');
    writeFileSync(join(dir, 'tests', 'README.md'), 'docs', 'utf-8');
    const r = testsAjoutesCetteSemaine(dir, {});
    assert.equal(r.length, 1);
    assert.match(r[0].path, /a\.test\.ts$/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerQa — façade renvoie les 5 sous-vues', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-qa-'));
  try {
    const r = calculerQa(dir, { matrice: { forward: [] }, metrics: { categories: { audit: { fichiers: [] } } }, specs: [] });
    assert.ok('queueReadySansTests' in r);
    assert.ok('coverage' in r);
    assert.ok('audit' in r);
    assert.ok('ears' in r);
    assert.ok('testsRecents' in r);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('pageQa — rendu HTML inclut les 5 sections + KPI + filtres (#184)', () => {
  const donnees = {
    qa: {
      queueReadySansTests: [{ id: 'SPEC-001-x', titre: 'Auth', statut: 'ready', parentIntent: 'INTENT-001', codeLies: 3 }],
      coverage: [{ id: 'SPEC-001-x', titre: 'Auth', code: 3, tests: 0, ratio: 0, band: 'vide' }],
      audit: { VALIDÉ: 2, CORRECTIONS: 1, REJET: 0, AUTRE: 0, total: 3 },
      ears: { total: 2, passants: 1, aRelinter: 1, liste: [{ id: 'SPEC-001-x', titre: 'Auth', sqs: 3, passant: false }] },
      testsRecents: [{ path: 'tests/a.test.ts', mtime: Date.now() }],
    },
  };
  const html = pageQa(donnees);
  assert.match(html, /Queue QA/);
  assert.match(html, /Coverage par SPEC/);
  assert.match(html, /Rollup audit|Audits VALIDÉ/);
  assert.match(html, /EARS lint/);
  assert.match(html, /Tests ajoutés cette semaine/);
  assert.match(html, /Régressions détectées/);
  assert.match(html, /SPEC-001-x/);
  // (#184) Filtres câblés sur les 3 tables principales
  assert.match(html, /data-filter-target="tQaQueue"/);
  assert.match(html, /data-filter-target="tQaCoverage"/);
  assert.match(html, /data-filter-target="tQaEars"/);
  assert.match(html, /<table id="tQaQueue"/);
  assert.match(html, /<table id="tQaCoverage"/);
  assert.match(html, /<table id="tQaEars"/);
});

test('pageQa — pas de qa fourni → rendu safe avec sections vides', () => {
  const html = pageQa({});
  assert.match(html, /Aucune SPEC ready sans test/);
  assert.match(html, /Aucune SPEC annotée/);
});

test('Alias EN canoniques exposés', () => {
  assert.equal(typeof readySpecsWithoutTests, 'function');
  assert.equal(typeof coveragePerSpec, 'function');
  assert.equal(typeof computeQa, 'function');
});

// ─── #155 Régressions CI ─────────────────────────────────────────────────────

test('lireRunsHistory — pas de fichier → runs []', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-qa-runs-'));
  try {
    const r = lireRunsHistory(dir);
    assert.equal(r.runs.length, 0);
    assert.equal(r.fichier, null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireRunsHistory — parse jsonl, tri par ts ascendant, ignore lignes corrompues', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-qa-runs-'));
  try {
    mkdirSync(join(dir, '.aiad', 'metrics', 'tests'), { recursive: true });
    writeFileSync(join(dir, '.aiad', 'metrics', 'tests', 'runs.jsonl'),
      [
        '{"ts":3000,"sha":"c","total":100,"failingTests":["x"]}',
        '{"ts":1000,"sha":"a","total":100,"failingTests":[]}',
        'garbage line',
        '{"ts":2000,"sha":"b","total":100,"failingTests":["y"]}',
      ].join('\n'), 'utf-8');
    const r = lireRunsHistory(dir);
    assert.equal(r.runs.length, 3);
    assert.equal(r.runs[0].sha, 'a');
    assert.equal(r.runs[2].sha, 'c');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerRegressions — moins de 2 runs → total 0', () => {
  assert.equal(calculerRegressions({ runs: [] }).total, 0);
  assert.equal(calculerRegressions({ runs: [{ ts: 1, failingTests: ['x'] }] }).total, 0);
});

test('calculerRegressions — pass→fail détecté entre 2 runs', () => {
  const r = calculerRegressions({
    runs: [
      { ts: 1000, failingTests: ['old-fail.test'] },                    // précédent
      { ts: 2000, failingTests: ['old-fail.test', 'new-regression.test'] }, // dernier
    ],
  });
  assert.equal(r.total, 1);
  assert.deepEqual(r.regressions, ['new-regression.test']);
  assert.equal(r.dernierRun.ts, 2000);
});

test('calculerRegressions — test fixé entre runs ne compte pas', () => {
  const r = calculerRegressions({
    runs: [
      { ts: 1000, failingTests: ['was-failing.test'] },
      { ts: 2000, failingTests: [] }, // fixé
    ],
  });
  assert.equal(r.total, 0);
});

test('pageQa — pas d\'historique → message d\'invitation', () => {
  const html = pageQa({ qa: { ...{
    queueReadySansTests: [], coverage: [], audit: { total: 0 }, ears: { total: 0, aRelinter: 0, liste: [] }, testsRecents: [],
  }, regressions: { regressions: [], dernierRun: null, total: 0 } } });
  assert.match(html, /Aucun historique CI/);
  assert.match(html, /runs\.jsonl/);
});

test('pageQa — 0 régression au dernier run → badge OK avec sha', () => {
  const html = pageQa({ qa: {
    queueReadySansTests: [], coverage: [], audit: { total: 0 }, ears: { total: 0, aRelinter: 0, liste: [] }, testsRecents: [],
    regressions: { regressions: [], dernierRun: { ts: Date.now(), sha: 'abc1234', total: 100, passed: 100, failed: 0 }, total: 0 },
  } });
  assert.match(html, /Aucune régression au dernier run/);
  assert.match(html, /100\/100/);
  assert.match(html, /sha abc1234/);
});

// ─── #156 Coverage réel c8/istanbul ──────────────────────────────────────────

test('lireCoverageReel — fichier absent → null', () => {
  const d = mkdtempSync(join(tmpdir(), 'aiad-qa-cov-'));
  try {
    assert.equal(lireCoverageReel(d), null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireCoverageReel — JSON corrompu → null (fail-safe)', () => {
  const d = mkdtempSync(join(tmpdir(), 'aiad-qa-cov-'));
  try {
    mkdirSync(join(d, '.aiad', 'metrics', 'tests'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'metrics', 'tests', 'coverage-summary.json'), '{ broken', 'utf-8');
    assert.equal(lireCoverageReel(d), null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireCoverageReel — format json-summary correctement parsé', () => {
  const d = mkdtempSync(join(tmpdir(), 'aiad-qa-cov-'));
  try {
    mkdirSync(join(d, '.aiad', 'metrics', 'tests'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'metrics', 'tests', 'coverage-summary.json'), JSON.stringify({
      total: { lines: { pct: 87 } },
      'src/server.ts': { lines: { pct: 95 } },
      'src/routes/auth.ts': { lines: { pct: 70 } },
    }), 'utf-8');
    const r = lireCoverageReel(d);
    assert.equal(r.total, 87);
    assert.equal(r.files.get('src/server.ts'), 95);
    assert.equal(r.files.get('src/routes/auth.ts'), 70);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('coverageParSpec — coverage réel utilisé si dispo (#156)', () => {
  const cov = { files: new Map([['src/a.ts', 90], ['src/b.ts', 60]]) };
  const d = {
    matrice: {
      forward: [{
        intent: { id: 'INTENT-001' },
        specs: [{
          spec: { id: 'SPEC-001-x', titre: 'A', status: 'ready', statut: 'ready' },
          code: [{ path: 'src/a.ts' }, { path: 'src/b.ts' }],
          tests: [{ path: 'tests/a.test.ts' }],
        }],
      }],
    },
    specs: [], metrics: { categories: { audit: { fichiers: [] } } },
  };
  const r = coverageParSpec(d, { coverageReel: cov });
  assert.equal(r.length, 1);
  assert.equal(r[0].source, 'réel');
  assert.equal(r[0].pct, 75); // (90+60)/2
  assert.equal(r[0].band, 'partiel'); // 75% → 50-80 → partiel
});

test('coverageParSpec — fallback heuristique si coverage absent (#156)', () => {
  const d = {
    matrice: {
      forward: [{
        intent: { id: 'INTENT-001' },
        specs: [{
          spec: { id: 'SPEC-001-x', titre: 'A', status: 'ready', statut: 'ready' },
          code: [{ path: 'src/a.ts' }],
          tests: [{ path: 'tests/a.test.ts' }],
        }],
      }],
    },
    specs: [], metrics: { categories: { audit: { fichiers: [] } } },
  };
  const r = coverageParSpec(d);
  assert.equal(r[0].source, 'heuristique');
  assert.equal(r[0].pct, null);
  assert.equal(r[0].ratio, 1); // 1 test / 1 code
});

test('coverageParSpec — coverage fourni mais aucun match → fallback heuristique', () => {
  const cov = { files: new Map([['unknown.ts', 100]]) };
  const d = {
    matrice: {
      forward: [{
        intent: { id: 'INTENT-001' },
        specs: [{
          spec: { id: 'SPEC-X', titre: 'B', status: 'ready', statut: 'ready' },
          code: [{ path: 'src/never.ts' }],
          tests: [],
        }],
      }],
    },
    specs: [], metrics: { categories: { audit: { fichiers: [] } } },
  };
  const r = coverageParSpec(d, { coverageReel: cov });
  assert.equal(r[0].source, 'heuristique');
});

test('coverageParSpec — bands réelles : 80+ ok, 50-79 partiel, 1-49 faible, 0 vide', () => {
  const cov = { files: new Map([['a.ts', 90], ['b.ts', 65], ['c.ts', 30], ['d.ts', 0]]) };
  const mkSpec = (id, codePath) => ({
    spec: { id, titre: id, status: 'ready', statut: 'ready' },
    code: [{ path: codePath }],
    tests: [],
  });
  const d = {
    matrice: { forward: [{
      intent: { id: 'I' },
      specs: [mkSpec('A', 'a.ts'), mkSpec('B', 'b.ts'), mkSpec('C', 'c.ts'), mkSpec('D', 'd.ts')],
    }] },
    specs: [], metrics: { categories: { audit: { fichiers: [] } } },
  };
  const r = coverageParSpec(d, { coverageReel: cov });
  const byId = Object.fromEntries(r.map((x) => [x.id, x.band]));
  assert.equal(byId.A, 'ok');
  assert.equal(byId.B, 'partiel');
  assert.equal(byId.C, 'faible');
  assert.equal(byId.D, 'vide');
});

test('pageQa — N régressions → table rouge', () => {
  const html = pageQa({ qa: {
    queueReadySansTests: [], coverage: [], audit: { total: 0 }, ears: { total: 0, aRelinter: 0, liste: [] }, testsRecents: [],
    regressions: {
      regressions: ['tests/foo.test.ts', 'tests/bar.test.ts'],
      dernierRun: { ts: Date.now(), total: 100, passed: 98, failed: 2 },
      runPrecedent: { ts: Date.now() - 3600000, total: 100, passed: 100, failed: 0 },
      total: 2,
    },
  } });
  assert.match(html, /2 test\(s\) pass → fail/);
  assert.match(html, /tests\/foo\.test\.ts/);
  assert.match(html, /tests\/bar\.test\.ts/);
});
