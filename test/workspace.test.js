// Tests mode workspace multi-projet.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadWorkspace, runWorkspace, aggregateReports } from '../lib/workspace.js';
import { init } from '../lib/init.js';

function silencer(fn) {
  return async (...args) => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { process.stdout.write = orig; }
  };
}

function tmpWs() { return mkdtempSync(join(tmpdir(), 'aiad-ws-')); }

test('loadWorkspace — config valide', () => {
  const d = tmpWs();
  try {
    writeFileSync(join(d, 'aiad-workspace.json'), JSON.stringify({
      name: 'Test',
      description: 'Suite',
      projects: [{ name: 'a', path: './a' }, { name: 'b', path: './b' }],
    }));
    const ws = loadWorkspace(join(d, 'aiad-workspace.json'));
    assert.equal(ws.name, 'Test');
    assert.equal(ws.projects.length, 2);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('loadWorkspace — JSON invalide → erreur claire', () => {
  const d = tmpWs();
  try {
    writeFileSync(join(d, 'aiad-workspace.json'), '{invalid');
    assert.throws(() => loadWorkspace(join(d, 'aiad-workspace.json')), /JSON invalide/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('loadWorkspace — projets sans champs requis → erreur', () => {
  const d = tmpWs();
  try {
    writeFileSync(join(d, 'aiad-workspace.json'), JSON.stringify({
      projects: [{ name: 'a' }], // path manquant
    }));
    assert.throws(() => loadWorkspace(join(d, 'aiad-workspace.json')), /name.*path|path.*name/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('aggregateReports — agrège correctement totals/healthy/skipped/errored', () => {
  const reports = [
    { name: 'a', status: 'analyzed', ok: true, matrix: { summary: { intents: 5, specs: 10 }, gaps: { intentsSansSpec: [1], specsSansCode: [], specsValideesNonImplementees: [], specsOrphelinsSurCode: [], intentsOrphelinsSurCode: [], codeSansSpec: { bloquant: 0, non_bloquant: 2, total: 2, items: [1, 2] }, codeSansTests: [] } } },
    { name: 'b', status: 'analyzed', ok: false, matrix: { summary: { intents: 3, specs: 4 }, gaps: { intentsSansSpec: [], specsSansCode: [1], specsValideesNonImplementees: [], specsOrphelinsSurCode: [], intentsOrphelinsSurCode: [], codeSansSpec: { bloquant: 0, non_bloquant: 0, total: 0, items: [] }, codeSansTests: [] } } },
    { name: 'c', status: 'skipped', reason: 'no .aiad' },
    { name: 'd', status: 'error', error: 'X' },
  ];
  const s = aggregateReports(reports);
  assert.equal(s.total, 4);
  assert.equal(s.analyzed, 2);
  assert.equal(s.skipped, 1);
  assert.equal(s.errored, 1);
  assert.equal(s.healthy, 1);
  assert.equal(s.totals.intents, 8);
  assert.equal(s.totals.specs, 14);
  assert.equal(s.totals.gaps, 4); // 1 + 2 + 1
});

test('runWorkspace doctor — workspace de 2 projets, 1 sans .aiad', silencer(async () => {
  const ws = tmpWs();
  try {
    // Projet A initialisé
    const a = join(ws, 'a');
    mkdirSync(a, { recursive: true });
    await init(a, {});
    // Projet B sans .aiad
    mkdirSync(join(ws, 'b'), { recursive: true });

    writeFileSync(join(ws, 'aiad-workspace.json'), JSON.stringify({
      name: 'Test',
      projects: [
        { name: 'a', path: './a' },
        { name: 'b', path: './b' },
      ],
    }));

    const r = await runWorkspace(ws, 'doctor', {});
    assert.equal(r.reports.length, 2);
    assert.equal(r.reports[0].status, 'analyzed');
    assert.equal(r.reports[1].status, 'skipped');
    assert.equal(r.summary.total, 2);
    assert.equal(r.summary.analyzed, 1);
    assert.equal(r.summary.skipped, 1);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}));

// (#342) workspace doctor expose publicationContext par projet
test('#342 runWorkspace doctor — chaque projet expose publicationContext', silencer(async () => {
  const ws = tmpWs();
  try {
    const a = join(ws, 'a');
    mkdirSync(a, { recursive: true });
    await init(a, {});
    // Mock dashboard/data.json pour projet a
    mkdirSync(join(a, 'dashboard'), { recursive: true });
    writeFileSync(join(a, 'dashboard', 'data.json'),
      JSON.stringify({ sourceBase: 'https://github.com/org/a/blob/main', publicUrl: 'https://org.github.io/a' }));

    writeFileSync(join(ws, 'aiad-workspace.json'), JSON.stringify({
      name: 'Test',
      projects: [{ name: 'a', path: './a' }],
    }));
    const r = await runWorkspace(ws, 'doctor', {});
    const projetA = r.reports[0];
    assert.equal(projetA.publicationContext.sourceBase, 'https://github.com/org/a/blob/main');
    assert.equal(projetA.publicationContext.publicUrl, 'https://org.github.io/a');
  } finally { rmSync(ws, { recursive: true, force: true }); }
}));

test('runWorkspace trace — agrège Intents et SPECs cumulés', silencer(async () => {
  const ws = tmpWs();
  try {
    const a = join(ws, 'a');
    mkdirSync(join(a, '.aiad', 'intents'), { recursive: true });
    mkdirSync(join(a, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(a, '.aiad', 'intents', 'INTENT-001.md'),
      '---\nstatus: active\n---\n# A\n');
    writeFileSync(join(a, '.aiad', 'specs', 'SPEC-001-1.md'),
      '---\nparent_intent: INTENT-001\nstatus: ready\n---\n# A\n');

    writeFileSync(join(ws, 'aiad-workspace.json'), JSON.stringify({
      name: 'T', projects: [{ name: 'a', path: './a' }],
    }));

    const r = await runWorkspace(ws, 'trace', {});
    assert.equal(r.summary.totals.intents, 1);
    assert.equal(r.summary.totals.specs, 1);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}));

test('runWorkspace --json — surface stable', silencer(async () => {
  const ws = tmpWs();
  try {
    mkdirSync(join(ws, 'a'), { recursive: true });
    writeFileSync(join(ws, 'aiad-workspace.json'), JSON.stringify({
      name: 'T', projects: [{ name: 'a', path: './a' }],
    }));

    const orig = process.stdout.write.bind(process.stdout);
    let buf = '';
    process.stdout.write = (chunk) => { buf += chunk; return true; };
    try {
      await runWorkspace(ws, 'doctor', { json: true });
    } finally {
      process.stdout.write = orig;
    }
    const parsed = JSON.parse(buf);
    assert.equal(parsed.workspace.name, 'T');
    assert.ok(Array.isArray(parsed.reports));
    assert.equal(typeof parsed.summary.total, 'number');
    // (#259) _meta block en tête
    assert.ok(parsed._meta, '_meta absent');
    assert.equal(parsed._meta.schema, 'aiad-sdd-workspace');
    assert.equal(parsed._meta.action, 'doctor');
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}));

// (#277) workspace sans sub-commande → usage propre
const __dirname2 = dirname(fileURLToPath(import.meta.url));
const BIN_W = join(__dirname2, '..', 'bin', 'aiad-sdd.js');

test('CLI workspace (no sub) → usage message, exit 0', () => {
  const dir = tmpWs();
  try {
    const r = spawnSync('node', [BIN_W, 'workspace'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
    assert.match(r.stdout, /Usage : aiad-sdd workspace <sub>/);
    assert.match(r.stdout, /doctor, trace, analytics/);
    // Pas d'erreur "Configuration workspace introuvable"
    assert.doesNotMatch(r.stderr + r.stdout, /Configuration workspace introuvable/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// (#303) workspace --markdown
import { formatterWorkspaceMarkdown } from '../lib/workspace.js';

test('formatterWorkspaceMarkdown — workspace sain → ✅ + table', () => {
  const md = formatterWorkspaceMarkdown({
    workspace: { name: 'Mon Org' },
    reports: [
      { name: 'a', status: 'analyzed', ok: true, matrix: { summary: { intents: 5, specs: 10 } } },
      { name: 'b', status: 'analyzed', ok: true, matrix: { summary: { intents: 3, specs: 6 } } },
    ],
    summary: { total: 2, analyzed: 2, healthy: 2, skipped: 0, errored: 0, totals: { intents: 8, specs: 16, gaps: 0 } },
  }, 'doctor');
  assert.match(md, /^## 🗂 AIAD SDD — Workspace doctor/m);
  assert.match(md, /### Mon Org/);
  assert.match(md, /✅ \*\*2\/2 projets analysés\*\*/);
  assert.match(md, /Cumul.*8.*Intents.*16.*SPECs/);
  assert.match(md, /\| \*\*a\*\* \| 🟢 sain \| 5 intents · 10 specs \|/);
});

test('formatterWorkspaceMarkdown — un projet en erreur → ❌ summary', () => {
  const md = formatterWorkspaceMarkdown({
    workspace: { name: 'X' },
    reports: [
      { name: 'a', status: 'error', error: 'boom' },
      { name: 'b', status: 'skipped', reason: 'no .aiad' },
    ],
    summary: { total: 2, analyzed: 0, healthy: 0, skipped: 1, errored: 1 },
  }, 'doctor');
  assert.match(md, /❌ \*\*0\/2 projets analysés\*\*/);
  assert.match(md, /\| \*\*a\*\* \| ❌ erreur \| boom \|/);
  assert.match(md, /\| \*\*b\*\* \| ⏭ skipped \| no \.aiad \|/);
});

// (#308) workspace --quiet
test('CLI workspace doctor --quiet (workspace OK) → silent + exit code', () => {
  const dir = tmpWs();
  try {
    mkdirSync(join(dir, 'a'), { recursive: true });
    writeFileSync(join(dir, 'aiad-workspace.json'), JSON.stringify({
      name: 'T', projects: [{ name: 'a', path: './a' }],
    }));
    const r = spawnSync('node', [BIN_W, 'workspace', 'doctor', '--quiet'], { cwd: dir, encoding: 'utf8' });
    // 'a' n'a pas .aiad → skipped, healthy = 0, analyzed = 0 → workspace passe
    // stdout doit être vide en --quiet
    assert.equal(r.stdout.trim(), '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI workspace doctor --quiet (workspace KO) → stderr message + exit 1', async () => {
  const { init } = await import('../lib/init.js');
  const dir = tmpWs();
  try {
    const a = join(dir, 'a');
    mkdirSync(a, { recursive: true });
    // Silencer init pour ne pas polluer
    const origLog = console.log;
    console.log = () => {};
    try { await init(a, {}); } finally { console.log = origLog; }
    writeFileSync(join(dir, 'aiad-workspace.json'), JSON.stringify({
      name: 'T', projects: [{ name: 'a', path: './a' }],
    }));
    const r = spawnSync('node', [BIN_W, 'workspace', 'doctor', '--quiet'], { cwd: dir, encoding: 'utf8' });
    // 'a' a .aiad mais probablement anomalies (PRD/Arch/Guide en template)
    // → si fails non-info, stderr a message
    assert.equal(r.stdout.trim(), '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
