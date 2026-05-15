// Tests `lib/reflect.js` — rétrospective via Ollama local (item #101).
// fetch est injecté pour ne JAMAIS appeler Ollama réel.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  listerArtefactsRecents, lireDrifts, lireMetriquesHook,
  collecterSprint, construirePromptReflect, parserAxes, reflect,
  CONSTANTS,
  // alias EN
  listRecentArtifacts, readDrifts, readHookMetrics,
  collectSprint, buildReflectPrompt, parseAxes, reflectSprint,
} from '../lib/reflect.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-reflect-')); }

/** Crée un fichier puis force son mtime à `when` (Date). */
function ecrireAvecMtime(path, contenu, when) {
  writeFileSync(path, contenu, 'utf-8');
  if (when) utimesSync(path, when, when);
}

function silent(fn) {
  return async (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return await fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

function fakeOllamaFetch(reponse) {
  return async (_url, _init) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ response: reponse }),
    json: async () => ({ response: reponse }),
  });
}

// ─── listerArtefactsRecents ────────────────────────────────────────────────

test('listerArtefactsRecents — dossier absent → []', () => {
  const d = tmp();
  try {
    assert.deepEqual(listerArtefactsRecents(d, 'intents', new Date(0)), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerArtefactsRecents — filtre _index.md et spec-ears-template', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', '_index.md'), '# x');
    writeFileSync(join(d, '.aiad', 'specs', 'spec-ears-template.md'), '# tpl');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'), '---\ntitle: T\n---\nB');
    const r = listerArtefactsRecents(d, 'specs', new Date(0));
    assert.equal(r.length, 1);
    assert.equal(r[0].id, 'SPEC-001-1-x');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerArtefactsRecents — filtre par mtime', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    const ancien = new Date('2020-01-01T00:00:00Z');
    const recent = new Date();
    ecrireAvecMtime(join(d, '.aiad', 'intents', 'INT-001.md'),
      '---\ntitle: Old\n---\nB', ancien);
    ecrireAvecMtime(join(d, '.aiad', 'intents', 'INT-002.md'),
      '---\ntitle: New\n---\nB', recent);
    const since = new Date('2024-01-01T00:00:00Z');
    const r = listerArtefactsRecents(d, 'intents', since);
    assert.equal(r.length, 1);
    assert.equal(r[0].id, 'INT-002');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerArtefactsRecents — tri par mtime ascendant', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    ecrireAvecMtime(join(d, '.aiad', 'intents', 'A.md'), 'a',
      new Date('2026-05-01T00:00:00Z'));
    ecrireAvecMtime(join(d, '.aiad', 'intents', 'B.md'), 'b',
      new Date('2026-05-05T00:00:00Z'));
    ecrireAvecMtime(join(d, '.aiad', 'intents', 'C.md'), 'c',
      new Date('2026-05-03T00:00:00Z'));
    const r = listerArtefactsRecents(d, 'intents', new Date(0));
    assert.deepEqual(r.map((x) => x.id), ['A', 'C', 'B']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── lireDrifts / lireMetriquesHook ────────────────────────────────────────

test('lireDrifts — fichier absent → []', () => {
  const d = tmp();
  try {
    assert.deepEqual(lireDrifts(d), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireDrifts — extrait gaps de matrix.json', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'metrics', 'traceability'), { recursive: true });
    writeFileSync(
      join(d, '.aiad', 'metrics', 'traceability', 'matrix.json'),
      JSON.stringify({ gaps: [{ kind: 'spec_orphan', message: 'm1' }, 'gap2'] }),
    );
    const r = lireDrifts(d);
    assert.equal(r.length, 2);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireMetriquesHook — fichier absent → null', () => {
  const d = tmp();
  try { assert.equal(lireMetriquesHook(d), null); }
  finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireMetriquesHook — calcule p50/p95/ratioFail', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'metrics'), { recursive: true });
    const lignes = [
      { durationMs: 100, exitCode: 0 },
      { durationMs: 200, exitCode: 0 },
      { durationMs: 150, exitCode: 1 },
      { durationMs: 1000, exitCode: 0 },
    ].map((e) => JSON.stringify(e)).join('\n') + '\n';
    writeFileSync(join(d, '.aiad', 'metrics', 'hook-runs.jsonl'), lignes);
    const r = lireMetriquesHook(d);
    assert.equal(r.total, 4);
    assert.ok(r.p50 >= 100 && r.p50 <= 200);
    assert.equal(r.p95, 1000);
    assert.equal(r.ratioFail, 0.25);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── collecterSprint ───────────────────────────────────────────────────────

test('collecterSprint — projet vide → tout vide', () => {
  const d = tmp();
  try {
    const r = collecterSprint(d, { jours: 1 });
    assert.equal(r.intents.length, 0);
    assert.equal(r.specs.length, 0);
    assert.equal(r.facts.length, 0);
    assert.deepEqual(r.drifts, []);
    assert.equal(r.hookMetrics, null);
    assert.match(r.since, /^\d{4}-/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('collecterSprint — fenêtre par défaut = 7 jours', () => {
  const d = tmp();
  try {
    const r = collecterSprint(d);
    const since = new Date(r.since);
    const diff = Date.now() - since.getTime();
    // ~7 jours en ms (avec marge)
    assert.ok(diff >= 6.5 * 24 * 3600 * 1000);
    assert.ok(diff <= 7.5 * 24 * 3600 * 1000);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('collecterSprint — since explicite override jours', () => {
  const d = tmp();
  try {
    const since = new Date('2026-01-01T00:00:00Z');
    const r = collecterSprint(d, { since });
    assert.equal(r.since, since.toISOString());
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── construirePromptReflect ───────────────────────────────────────────────

test('construirePromptReflect — inclut Intent/SPEC IDs et instruction JSON', () => {
  const sprint = {
    since: '2026-05-01T00:00:00Z',
    intents: [{ id: 'INT-001', mtime: new Date('2026-05-02T00:00:00Z'),
      frontmatter: { title: 'Mon Intent' }, body: 'Body intent.' }],
    specs: [{ id: 'SPEC-001-1-x', mtime: new Date('2026-05-03T00:00:00Z'),
      frontmatter: { title: 'Ma SPEC' }, body: '' }],
    facts: [],
    drifts: [],
    hookMetrics: null,
  };
  const p = construirePromptReflect(sprint);
  assert.match(p, /INT-001/);
  assert.match(p, /SPEC-001-1-x/);
  assert.match(p, /Mon Intent/);
  assert.match(p, /STRICTEMENT au format JSON/);
  assert.match(p, /"axes"/);
  assert.match(p, /haute\|moyenne\|basse/);
});

test('construirePromptReflect — drifts et hookMetrics inclus', () => {
  const sprint = {
    since: '2026-05-01T00:00:00Z',
    intents: [], specs: [], facts: [],
    drifts: ['Missing SPEC for INT-007'],
    hookMetrics: { total: 100, p50: 200, p95: 1500, ratioFail: 0.05 },
  };
  const p = construirePromptReflect(sprint);
  assert.match(p, /Drifts détectés/);
  assert.match(p, /Missing SPEC for INT-007/);
  assert.match(p, /Métriques du hook/);
  assert.match(p, /p95=1500/);
});

test('construirePromptReflect — facts inclus', () => {
  const sprint = {
    since: '2026-05-01T00:00:00Z',
    intents: [], specs: [],
    facts: [{ id: 'FACT-001', frontmatter: { title: 'Bug paiement' }, body: '' }],
    drifts: [], hookMetrics: null,
  };
  const p = construirePromptReflect(sprint);
  assert.match(p, /Facts journalisés/);
  assert.match(p, /FACT-001/);
});

// ─── parserAxes ────────────────────────────────────────────────────────────

test('parserAxes — JSON valide → tableau d\'axes normalisés', () => {
  const brut = JSON.stringify({
    axes: [
      { titre: 'A', observation: 'O', recommandation: 'R', priorite: 'haute' },
      { title: 'B', observation: 'O2', recommendation: 'R2', priorite: 'basse' },
    ],
  });
  const r = parserAxes(brut);
  assert.equal(r.length, 2);
  assert.equal(r[0].titre, 'A');
  assert.equal(r[0].priorite, 'haute');
  assert.equal(r[1].titre, 'B'); // alias title
  assert.equal(r[1].recommandation, 'R2'); // alias recommendation
});

test('parserAxes — préambule avant JSON → ignoré', () => {
  const brut = 'Voici la rétrospective :\n\n' + JSON.stringify({
    axes: [{ titre: 'X', observation: 'o', recommandation: 'r', priorite: 'haute' }],
  });
  const r = parserAxes(brut);
  assert.equal(r.length, 1);
});

test('parserAxes — priorité invalide → moyenne par défaut', () => {
  const brut = JSON.stringify({
    axes: [{ titre: 'X', observation: 'o', recommandation: 'r', priorite: 'wat' }],
  });
  const r = parserAxes(brut);
  assert.equal(r[0].priorite, 'moyenne');
});

test('parserAxes — plafond 5 axes', () => {
  const axes = Array.from({ length: 10 }, (_, i) => ({
    titre: 'A' + i, observation: 'o', recommandation: 'r', priorite: 'moyenne',
  }));
  const r = parserAxes(JSON.stringify({ axes }));
  assert.equal(r.length, 5);
});

test('parserAxes — JSON invalide → throw', () => {
  assert.throws(() => parserAxes('pas de JSON ici'), /sans JSON détectable/);
  assert.throws(() => parserAxes('{ broken'), /sans `\}`|JSON.*invalide/);
});

test('parserAxes — pas de champ axes → throw', () => {
  assert.throws(() => parserAxes(JSON.stringify({ foo: 1 })), /`axes` manquant/);
});

// ─── reflect (pipeline complet) ────────────────────────────────────────────

test('reflect — projet vide → axes [] avec raison', silent(async () => {
  const d = tmp();
  try {
    const r = await reflect(d, { fetch: () => { throw new Error('Ne devrait pas appeler Ollama'); } });
    assert.deepEqual(r.axes, []);
    assert.equal(r.raison, 'aucun artefact');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('reflect — projet avec Intent → appel Ollama mocké → axes parsés', silent(async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    ecrireAvecMtime(join(d, '.aiad', 'intents', 'INT-001.md'),
      '---\ntitle: Test Intent\n---\nBody', new Date());
    const fakeReponse = JSON.stringify({
      axes: [
        { titre: 'Améliorer SPECs', observation: 'INT-001 sans SPEC', recommandation: 'Rédiger SPEC-001', priorite: 'haute' },
      ],
    });
    const r = await reflect(d, { fetch: fakeOllamaFetch(fakeReponse) });
    assert.equal(r.axes.length, 1);
    assert.equal(r.axes[0].priorite, 'haute');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('reflect --json → JSON exploitable sur stdout', async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    ecrireAvecMtime(join(d, '.aiad', 'intents', 'INT-001.md'),
      '---\ntitle: T\n---\nB', new Date());
    const fakeReponse = JSON.stringify({
      axes: [{ titre: 'A', observation: 'o', recommandation: 'r', priorite: 'moyenne' }],
    });
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try {
      await reflect(d, { fetch: fakeOllamaFetch(fakeReponse), json: true });
    } finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.axes.length, 1);
    assert.match(parsed.since, /^\d{4}-/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(listRecentArtifacts, listerArtefactsRecents);
  assert.equal(readDrifts, lireDrifts);
  assert.equal(readHookMetrics, lireMetriquesHook);
  assert.equal(collectSprint, collecterSprint);
  assert.equal(buildReflectPrompt, construirePromptReflect);
  assert.equal(parseAxes, parserAxes);
  assert.equal(reflectSprint, reflect);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.FENETRE_DEFAUT_JOURS, 7);
});
