// Tests `lib/hook-sandbox.js` — sandbox + métriques pre-commit (item #91).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import {
  resoudreTimeout, dansScope, fuitesScope, gitStatusFichiers,
  construireEvenementHook, loggerMetriques, lireHistorique, calculerStats,
  afficherStats, CONSTANTS,
  // alias EN
  resolveTimeout, inScope, scopeLeaks, gitStatusFiles,
  buildHookEvent, logMetrics, readHistory, computeStats, showStats,
} from '../lib/hook-sandbox.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-sandbox-')); }
function silent(fn) {
  return (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

// ─── resoudreTimeout ───────────────────────────────────────────────────────

test('resoudreTimeout — env absent → 30s', () => {
  assert.equal(resoudreTimeout(undefined), 30000);
  assert.equal(resoudreTimeout(null), 30000);
  assert.equal(resoudreTimeout(''), 30000);
});

test('resoudreTimeout — valeur valide', () => {
  assert.equal(resoudreTimeout('60'), 60000);
  assert.equal(resoudreTimeout('45'), 45000);
});

test('resoudreTimeout — non-numérique → défaut', () => {
  assert.equal(resoudreTimeout('abc'), 30000);
  assert.equal(resoudreTimeout('-5'), 30000);
  assert.equal(resoudreTimeout('0'), 30000);
});

test('resoudreTimeout — plafonné à 120s', () => {
  assert.equal(resoudreTimeout('300'), 120000);
  assert.equal(resoudreTimeout('120'), 120000);
});

// ─── dansScope / fuitesScope ───────────────────────────────────────────────

test('dansScope — .aiad/** autorisé', () => {
  assert.equal(dansScope('.aiad/specs/x.md', []), true);
  assert.equal(dansScope('.aiad/audit/log.jsonl', []), true);
  assert.equal(dansScope('.aiad', []), true);
});

test('dansScope — staged file autorisé', () => {
  assert.equal(dansScope('src/auth.ts', ['src/auth.ts']), true);
  assert.equal(dansScope('src/auth.ts', ['other.ts']), false);
});

test('dansScope — chemin hors scope refusé', () => {
  assert.equal(dansScope('/etc/passwd', ['x']), false);
  assert.equal(dansScope('node_modules/foo.js', []), false);
});

test('dansScope — input vide refusé', () => {
  assert.equal(dansScope('', []), false);
  assert.equal(dansScope(null, []), false);
});

test('fuitesScope — pas de modif → []', () => {
  assert.deepEqual(fuitesScope(['a.ts'], ['a.ts'], []), []);
});

test('fuitesScope — modification dans .aiad → autorisée', () => {
  const r = fuitesScope([], ['.aiad/audit/log.jsonl'], []);
  assert.deepEqual(r, []);
});

test('fuitesScope — modification de fichier staged → autorisée', () => {
  const r = fuitesScope([], ['src/auth.ts'], ['src/auth.ts']);
  assert.deepEqual(r, []);
});

test('fuitesScope — modification hors scope détectée', () => {
  const r = fuitesScope([], ['/etc/passwd', 'src/leaked.ts'], ['src/auth.ts']);
  assert.deepEqual(r.sort(), ['/etc/passwd', 'src/leaked.ts'].sort());
});

// ─── construireEvenementHook ───────────────────────────────────────────────

test('construireEvenementHook — événement valide', () => {
  const evt = construireEvenementHook({
    startedAt: '2026-05-10T12:00:00Z',
    durationMs: 1500,
    exitCode: 0,
  });
  assert.equal(evt.startedAt, '2026-05-10T12:00:00Z');
  assert.equal(evt.durationMs, 1500);
  assert.equal(evt.exitCode, 0);
  assert.equal(evt.timedOut, false);
  assert.deepEqual(evt.scopeLeaks, []);
});

test('construireEvenementHook — durationMs arrondi', () => {
  const evt = construireEvenementHook({
    startedAt: '2026-05-10T12:00:00Z',
    durationMs: 1500.7,
    exitCode: 0,
  });
  assert.equal(evt.durationMs, 1501);
});

test('construireEvenementHook — startedAt manquant → throw', () => {
  assert.throws(
    () => construireEvenementHook({ durationMs: 1, exitCode: 0 }),
    /startedAt requis/,
  );
});

test('construireEvenementHook — durationMs négatif → throw', () => {
  assert.throws(
    () => construireEvenementHook({ startedAt: 'x', durationMs: -1, exitCode: 0 }),
    /durationMs requis/,
  );
});

test('construireEvenementHook — exitCode manquant → throw', () => {
  assert.throws(
    () => construireEvenementHook({ startedAt: 'x', durationMs: 1 }),
    /exitCode requis/,
  );
});

// ─── loggerMetriques + lireHistorique ──────────────────────────────────────

test('loggerMetriques + lireHistorique — round-trip', () => {
  const d = tmp();
  try {
    const evt = construireEvenementHook({
      startedAt: '2026-05-10T12:00:00Z',
      durationMs: 100,
      exitCode: 0,
    });
    loggerMetriques(d, evt);
    const events = lireHistorique(d);
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], evt);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireHistorique — fichier absent → []', () => {
  const d = tmp();
  try {
    assert.deepEqual(lireHistorique(d), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireHistorique — ligne corrompue ignorée', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'metrics'), { recursive: true });
    const path = join(d, '.aiad', 'metrics', 'hook-runs.jsonl');
    writeFileSync(path, '{"startedAt":"x","durationMs":1,"exitCode":0}\nNOT_JSON\n', 'utf-8');
    assert.equal(lireHistorique(d).length, 1);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── calculerStats ─────────────────────────────────────────────────────────

test('calculerStats — historique vide → count 0', () => {
  const s = calculerStats([]);
  assert.equal(s.count, 0);
  assert.equal(s.sante, 'inconnue');
});

test('calculerStats — 100 runs rapides → santé verte', () => {
  const events = Array.from({ length: 100 }, (_, i) => ({
    startedAt: '2026-05-10T12:00:00Z',
    durationMs: 50 + i,
    exitCode: 0,
    timedOut: false,
    scopeLeaks: [],
  }));
  const s = calculerStats(events);
  assert.equal(s.count, 100);
  assert.equal(s.sante, 'verte');
  assert.ok(s.p95 >= 90 && s.p95 <= 200);
  assert.equal(s.timeouts, 0);
});

test('calculerStats — un timeout → santé critique', () => {
  const events = [
    { durationMs: 100, exitCode: 0, timedOut: false, scopeLeaks: [] },
    { durationMs: 30000, exitCode: 124, timedOut: true, scopeLeaks: [] },
  ];
  const s = calculerStats(events);
  assert.equal(s.timeouts, 1);
  assert.equal(s.sante, 'critique');
});

test('calculerStats — fuite scope → santé critique', () => {
  const events = [
    { durationMs: 100, exitCode: 0, timedOut: false, scopeLeaks: ['/etc/leak'] },
  ];
  const s = calculerStats(events);
  assert.equal(s.scopeLeaks, 1);
  assert.equal(s.sante, 'critique');
});

test('calculerStats — p95 > seuil → santé attention', () => {
  const events = Array.from({ length: 20 }, () => ({
    durationMs: 6000,  // > 5000
    exitCode: 0, timedOut: false, scopeLeaks: [],
  }));
  const s = calculerStats(events);
  assert.equal(s.sante, 'attention');
});

test('calculerStats — ratio fail > 10% → santé attention', () => {
  const events = Array.from({ length: 10 }, (_, i) => ({
    durationMs: 100,
    exitCode: i < 2 ? 1 : 0,
    timedOut: false, scopeLeaks: [],
  }));
  const s = calculerStats(events);
  assert.equal(s.ratioFail, 0.2);
  assert.equal(s.sante, 'attention');
});

// ─── afficherStats ─────────────────────────────────────────────────────────

test('afficherStats — texte humain (smoke)', silent(() => {
  const d = tmp();
  try {
    loggerMetriques(d, construireEvenementHook({
      startedAt: '2026-05-10T12:00:00Z', durationMs: 100, exitCode: 0,
    }));
    const s = afficherStats(d);
    assert.equal(s.count, 1);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('afficherStats --json → JSON sur stdout', () => {
  const d = tmp();
  try {
    loggerMetriques(d, construireEvenementHook({
      startedAt: '2026-05-10T12:00:00Z', durationMs: 100, exitCode: 0,
    }));
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { afficherStats(d, { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.stats.count, 1);
    assert.ok(Array.isArray(parsed.recent));
    // (#266) _meta cohérent avec écosystème AIAD
    assert.equal(parsed._meta.schema, 'aiad-sdd-hook-stats');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── Intégration : le hook bash écrit bien le JSONL ─────────────────────

test('hook bash — exécution end-to-end écrit hook-runs.jsonl', () => {
  // Cas "pas de .aiad/" : sortie 0 immédiate, pas de logging.
  // Cas avec .aiad/ : on mock un repo git, on stage rien → exit 0, log écrit.
  const d = tmp();
  try {
    const repoOpts = { cwd: d, encoding: 'utf-8' };
    spawnSync('git', ['init', '-q'], repoOpts);
    spawnSync('git', ['config', 'user.email', 't@t.t'], repoOpts);
    spawnSync('git', ['config', 'user.name', 't'], repoOpts);
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], repoOpts);
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', '_index.md'), '# index');

    const hookSrc = join(process.cwd(), 'templates', '.aiad', 'hooks', 'pre-commit.sh');
    const hookDest = join(d, '.aiad', 'hooks', 'pre-commit.sh');
    mkdirSync(join(d, '.aiad', 'hooks'), { recursive: true });
    writeFileSync(hookDest, readFileSync(hookSrc, 'utf-8'), { mode: 0o755 });

    // Stage un fichier markdown (aucun code → exit 0)
    writeFileSync(join(d, 'doc.md'), '# doc');
    spawnSync('git', ['add', 'doc.md', '.aiad/specs/_index.md', '.aiad/hooks/pre-commit.sh'], repoOpts);

    // Lance le hook directement
    const r = spawnSync('bash', [hookDest], repoOpts);
    assert.equal(r.status, 0);

    // Le hook a logué dans .aiad/metrics/hook-runs.jsonl
    const metricsPath = join(d, '.aiad', 'metrics', 'hook-runs.jsonl');
    assert.ok(existsSync(metricsPath), 'hook-runs.jsonl devrait exister');
    const ligne = readFileSync(metricsPath, 'utf-8').trim();
    const evt = JSON.parse(ligne);
    assert.equal(evt.exitCode, 0);
    assert.equal(evt.timedOut, false);
    assert.ok(typeof evt.durationMs === 'number');
    assert.ok(evt.startedAt.match(/^\d{4}-\d{2}-\d{2}T/));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(resolveTimeout, resoudreTimeout);
  assert.equal(inScope, dansScope);
  assert.equal(scopeLeaks, fuitesScope);
  assert.equal(gitStatusFiles, gitStatusFichiers);
  assert.equal(buildHookEvent, construireEvenementHook);
  assert.equal(logMetrics, loggerMetriques);
  assert.equal(readHistory, lireHistorique);
  assert.equal(computeStats, calculerStats);
  assert.equal(showStats, afficherStats);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.METRICS_PATH, '.aiad/metrics/hook-runs.jsonl');
  assert.equal(CONSTANTS.TIMEOUT_DEFAUT_MS, 30000);
  assert.equal(CONSTANTS.TIMEOUT_PLAFOND_MS, 120000);
});
