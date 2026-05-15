// Tests `lib/workspace-analytics.js` — analytics cross-org (item #123).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  analyserProjet, detecterPacks, agreger, analyserWorkspace,
  // alias EN
  analyzeProject, detectPacks, aggregate, analyzeWorkspace,
} from '../lib/workspace-analytics.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-wa-')); }

function silent(fn) {
  return async (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return await fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

/**
 * Crée un projet AIAD jouet dans `dir` avec les agents, intents, specs
 * et matrix souhaités.
 */
function setupProjet(dir, options = {}) {
  mkdirSync(dir, { recursive: true });
  const aiad = join(dir, '.aiad');
  mkdirSync(aiad, { recursive: true });
  if (options.agents) {
    const gov = join(aiad, 'gouvernance');
    mkdirSync(gov, { recursive: true });
    for (const a of options.agents) writeFileSync(join(gov, a), `# ${a}`);
  }
  if (options.intents) {
    const dir2 = join(aiad, 'intents');
    mkdirSync(dir2, { recursive: true });
    for (let i = 1; i <= options.intents; i++) {
      writeFileSync(join(dir2, `INT-${String(i).padStart(3, '0')}.md`), '# x');
    }
  }
  if (options.specs) {
    const dir2 = join(aiad, 'specs');
    mkdirSync(dir2, { recursive: true });
    for (let i = 1; i <= options.specs; i++) {
      writeFileSync(join(dir2, `SPEC-${String(i).padStart(3, '0')}-1-x.md`), '# x');
    }
  }
  if (options.gaps !== undefined) {
    const dir2 = join(aiad, 'metrics', 'traceability');
    mkdirSync(dir2, { recursive: true });
    writeFileSync(join(dir2, 'matrix.json'), JSON.stringify({
      gaps: Array.from({ length: options.gaps }, (_, i) => ({ kind: 'gap', i })),
    }));
  }
}

// ─── detecterPacks ────────────────────────────────────────────────────────

test('detecterPacks — eu-baseline détecté avec les 4 agents baseline', () => {
  const r = detecterPacks(['AIAD-AI-ACT.md', 'AIAD-RGPD.md', 'AIAD-RGAA.md', 'AIAD-RGESN.md']);
  assert.ok(r.includes('eu-baseline'));
});

test('detecterPacks — fr-anssi détecté avec un seul agent RGS', () => {
  const r = detecterPacks(['AIAD-RGS.md']);
  assert.ok(r.includes('fr-anssi'));
});

test('detecterPacks — apac-baseline détecté avec un agent JP/SG/AU', () => {
  const r = detecterPacks(['AIAD-JP-APPI.md']);
  assert.ok(r.includes('apac-baseline'));
});

test('detecterPacks — latam-baseline détecté', () => {
  const r = detecterPacks(['AIAD-BR-LGPD.md', 'AIAD-MX-LFPDPPP.md']);
  assert.ok(r.includes('latam-baseline'));
});

test('detecterPacks — aucun agent → []', () => {
  assert.deepEqual(detecterPacks([]), []);
});

test('detecterPacks — eu-financial via DORA', () => {
  assert.ok(detecterPacks(['AIAD-DORA.md']).includes('eu-financial'));
});

test('detecterPacks — combo multi-juridictions', () => {
  const r = detecterPacks([
    'AIAD-AI-ACT.md', 'AIAD-RGPD.md', 'AIAD-RGAA.md', 'AIAD-RGESN.md',
    'AIAD-RGS.md', 'AIAD-DORA.md',
  ]);
  assert.ok(r.includes('eu-baseline'));
  assert.ok(r.includes('fr-anssi'));
  assert.ok(r.includes('eu-financial'));
});

// ─── analyserProjet ──────────────────────────────────────────────────────

test('analyserProjet — sans .aiad/ → exists=false', async () => {
  const d = tmp();
  try {
    const r = await analyserProjet(d, 'no-aiad');
    assert.equal(r.exists, false);
    assert.equal(r.intents, 0);
    assert.equal(r.specs, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('analyserProjet — projet complet → métriques calculées', async () => {
  const d = tmp();
  try {
    setupProjet(d, {
      agents: ['AIAD-AI-ACT.md', 'AIAD-RGPD.md', 'AIAD-RGAA.md', 'AIAD-RGESN.md', 'AIAD-RGS.md'],
      intents: 5, specs: 7, gaps: 2,
    });
    const r = await analyserProjet(d, 'p');
    assert.equal(r.exists, true);
    assert.equal(r.intents, 5);
    assert.equal(r.specs, 7);
    assert.equal(r.driftCount, 2);
    assert.equal(r.velocite, 7 / 5);
    assert.ok(r.governance.packs.includes('eu-baseline'));
    assert.ok(r.governance.packs.includes('fr-anssi'));
    assert.ok(r.sovereignty);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('analyserProjet — projet sans intents → velocite null', async () => {
  const d = tmp();
  try {
    setupProjet(d, { agents: [], intents: 0, specs: 3 });
    const r = await analyserProjet(d, 'p');
    assert.equal(r.velocite, null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('analyserProjet — matrix invalide → driftCount=0 sans crash', async () => {
  const d = tmp();
  try {
    setupProjet(d, { intents: 1, specs: 1 });
    const dir = join(d, '.aiad', 'metrics', 'traceability');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'matrix.json'), 'NOT JSON');
    const r = await analyserProjet(d, 'p');
    assert.equal(r.driftCount, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── agreger ──────────────────────────────────────────────────────────────

test('agreger — workspace vide → analytics neutres', () => {
  const r = agreger([]);
  assert.equal(r.total, 0);
  assert.equal(r.available, 0);
  assert.equal(r.driftRate, 0);
  assert.deepEqual(r.topPacks, []);
});

test('agreger — uniquement projets sans .aiad → available=0', () => {
  const r = agreger([
    { name: 'a', path: '/a', exists: false, governance: { agents: [], packs: [] }, intents: 0, specs: 0, velocite: null, driftCount: 0 },
  ]);
  assert.equal(r.available, 0);
});

test('agreger — sovereignty min/max/moyenne/médiane', () => {
  const projets = [50, 70, 80, 90, 60].map((s, i) => ({
    name: `p${i}`, path: `/p${i}`, exists: true,
    sovereignty: { score: s, level: 'X' },
    governance: { agents: [], packs: [] },
    intents: 0, specs: 0, velocite: null, driftCount: 0,
  }));
  const r = agreger(projets);
  assert.equal(r.sovereignty.min, 50);
  assert.equal(r.sovereignty.max, 90);
  // moyenne = (50+60+70+80+90)/5 = 70
  assert.equal(r.sovereignty.moyenne, 70);
  // médiane sur tri ascendant = 70
  assert.equal(r.sovereignty.mediane, 70);
});

test('agreger — topPacks trié par fréquence (top 5)', () => {
  const projets = [
    { governance: { packs: ['eu-baseline', 'fr-anssi'], agents: [] } },
    { governance: { packs: ['eu-baseline'], agents: [] } },
    { governance: { packs: ['eu-baseline', 'de-bsi'], agents: [] } },
    { governance: { packs: ['fr-anssi'], agents: [] } },
  ].map((p, i) => ({
    name: `p${i}`, path: `/p${i}`, exists: true,
    sovereignty: null, ...p, intents: 0, specs: 0, velocite: null, driftCount: 0,
  }));
  const r = agreger(projets);
  assert.equal(r.topPacks[0].id, 'eu-baseline');
  assert.equal(r.topPacks[0].count, 3);
  assert.equal(r.topPacks[1].id, 'fr-anssi');
  assert.equal(r.topPacks[1].count, 2);
});

test('agreger — vélocité moyenne pondère par projets-avec-intents', () => {
  const projets = [
    { intents: 5, specs: 5, velocite: 1.0, governance: { agents: [], packs: [] } },
    { intents: 2, specs: 4, velocite: 2.0, governance: { agents: [], packs: [] } },
    { intents: 0, specs: 0, velocite: null, governance: { agents: [], packs: [] } },
  ].map((p, i) => ({
    name: `p${i}`, path: `/p${i}`, exists: true,
    sovereignty: null, driftCount: 0, ...p,
  }));
  const r = agreger(projets);
  assert.equal(r.velocite.moyenne, 1.5);
  assert.equal(r.velocite.projetsAvecIntents, 2);
});

test('agreger — driftRate = projets avec drifts / total available', () => {
  const projets = [
    { driftCount: 0, governance: { agents: [], packs: [] } },
    { driftCount: 3, governance: { agents: [], packs: [] } },
    { driftCount: 1, governance: { agents: [], packs: [] } },
    { driftCount: 0, governance: { agents: [], packs: [] } },
  ].map((p, i) => ({
    name: `p${i}`, path: `/p${i}`, exists: true,
    sovereignty: null, intents: 0, specs: 0, velocite: null, ...p,
  }));
  const r = agreger(projets);
  assert.equal(r.driftRate, 0.5);
});

test('agreger — juridictionsCouvertes via packs', () => {
  const projets = [
    { governance: { packs: ['eu-baseline', 'fr-anssi'], agents: [] } },
    { governance: { packs: ['de-bsi'], agents: [] } },
    { governance: { packs: ['apac-baseline'], agents: [] } },
  ].map((p, i) => ({
    name: `p${i}`, path: `/p${i}`, exists: true,
    sovereignty: null, ...p, intents: 0, specs: 0, velocite: null, driftCount: 0,
  }));
  const r = agreger(projets);
  for (const j of ['eu', 'fr', 'de', 'jp', 'sg', 'au']) {
    assert.ok(r.juridictionsCouvertes.includes(j), `${j} absent`);
  }
});

test('agreger — topAgents trié par fréquence', () => {
  const projets = [
    { governance: { agents: ['AIAD-RGPD.md', 'AIAD-AI-ACT.md'], packs: [] } },
    { governance: { agents: ['AIAD-RGPD.md'], packs: [] } },
    { governance: { agents: ['AIAD-RGPD.md', 'AIAD-CRA.md'], packs: [] } },
  ].map((p, i) => ({
    name: `p${i}`, path: `/p${i}`, exists: true,
    sovereignty: null, ...p, intents: 0, specs: 0, velocite: null, driftCount: 0,
  }));
  const r = agreger(projets);
  assert.equal(r.topAgents[0].id, 'AIAD-RGPD.md');
  assert.equal(r.topAgents[0].count, 3);
});

// ─── analyserWorkspace (pipeline) ────────────────────────────────────────

test('analyserWorkspace — workspace avec 3 projets analyse + agrège', silent(async () => {
  const d = tmp();
  try {
    // 3 projets jouets
    for (const name of ['p1', 'p2', 'p3']) {
      setupProjet(join(d, name), {
        agents: ['AIAD-AI-ACT.md', 'AIAD-RGPD.md', 'AIAD-RGAA.md', 'AIAD-RGESN.md'],
        intents: 2, specs: 2,
      });
    }
    writeFileSync(join(d, 'aiad-workspace.json'), JSON.stringify({
      name: 'ma-grande-org',
      projects: [
        { name: 'p1', path: 'p1' },
        { name: 'p2', path: 'p2' },
        { name: 'p3', path: 'p3' },
      ],
    }));
    const r = await analyserWorkspace(d);
    assert.equal(r.analytics.total, 3);
    assert.equal(r.analytics.available, 3);
    assert.ok(r.analytics.topPacks.find((p) => p.id === 'eu-baseline'));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('analyserWorkspace --json → sortie structurée', async () => {
  const d = tmp();
  try {
    setupProjet(join(d, 'p'), { agents: ['AIAD-RGPD.md'], intents: 1, specs: 1 });
    writeFileSync(join(d, 'aiad-workspace.json'), JSON.stringify({
      name: 'tiny', projects: [{ name: 'p', path: 'p' }],
    }));
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { await analyserWorkspace(d, { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.workspace.name, 'tiny');
    assert.equal(parsed.analytics.available, 1);
    assert.ok(Array.isArray(parsed.projets));
    // (#259) _meta cohérent avec runWorkspace
    assert.equal(parsed._meta.schema, 'aiad-sdd-workspace');
    assert.equal(parsed._meta.action, 'analytics');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(analyzeProject, analyserProjet);
  assert.equal(detectPacks, detecterPacks);
  assert.equal(aggregate, agreger);
  assert.equal(analyzeWorkspace, analyserWorkspace);
});
