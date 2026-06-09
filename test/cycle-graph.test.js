// Tests `lib/cycle-graph.js` — cycle SDD comme graphe de Tasks (§3.9).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ETAPES,
  MARQUEURS,
  construireGraphe,
  peutDemarrer,
  appliquerVerdict,
  prochaineEtape,
  cycleComplet,
  rendreGraphe,
  cheminGraphe,
  chargerGraphe,
  sauverGraphe,
  // alias EN
  buildGraph,
  applyVerdict,
  nextStep,
} from '../lib/cycle-graph.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'cycle-')); }

// ─── Construction ───────────────────────────────────────────────────────────

test('construireGraphe — 7 étapes, INTENT done, chaînage blockedBy', () => {
  const g = construireGraphe('INTENT-042');
  assert.equal(g.intent, 'INTENT-042');
  assert.equal(g.etapes.length, 7);
  assert.deepEqual(g.etapes.map((e) => e.name), ETAPES);
  assert.equal(g.etapes[0].status, 'done'); // INTENT
  assert.equal(g.etapes[1].status, 'todo'); // RESEARCH
  assert.equal(g.etapes[1].blockedBy, 'INTENT');
  assert.equal(g.etapes[6].blockedBy, 'VALIDATE');
});

// ─── Règle de blocage ───────────────────────────────────────────────────────

test('peutDemarrer — RESEARCH peut démarrer (INTENT done), SPEC non (RESEARCH todo)', () => {
  const g = construireGraphe('INTENT-001');
  assert.equal(peutDemarrer(g, 'RESEARCH'), true);
  assert.equal(peutDemarrer(g, 'SPEC'), false);
});

test('appliquerVerdict — interdit de sauter une étape (EXEC sans GATE done)', () => {
  const g = construireGraphe('INTENT-001');
  const r = applyVerdict(g, 'EXEC', 'PASS');
  assert.equal(r.applique, false);
  assert.ok(/non terminée/.test(r.raison));
  // EXEC est marquée blocked, pas done.
  assert.equal(r.graphe.etapes.find((e) => e.name === 'EXEC').status, 'blocked');
});

// ─── Transitions ────────────────────────────────────────────────────────────

test('appliquerVerdict — PASS fait avancer l\'étape', () => {
  let g = construireGraphe('INTENT-001');
  g = applyVerdict(g, 'RESEARCH', 'PASS').graphe;
  assert.equal(g.etapes[1].status, 'done');
  assert.equal(peutDemarrer(g, 'SPEC'), true);
});

test('appliquerVerdict — CONDITIONAL passe done avec note', () => {
  let g = construireGraphe('INTENT-001');
  const r = appliquerVerdict(g, 'RESEARCH', 'CONDITIONAL');
  assert.equal(r.applique, true);
  assert.equal(r.graphe.etapes[1].status, 'done');
  assert.ok(/CONDITIONAL/.test(r.graphe.etapes[1].note));
});

test('appliquerVerdict — FAIL / JNSP bloquent l\'étape', () => {
  let g = construireGraphe('INTENT-001');
  const f = appliquerVerdict(g, 'RESEARCH', 'FAIL');
  assert.equal(f.graphe.etapes[1].status, 'blocked');
  const j = appliquerVerdict(g, 'RESEARCH', 'JNSP');
  assert.equal(j.graphe.etapes[1].status, 'blocked');
  assert.ok(/humaine/.test(j.graphe.etapes[1].note));
});

test('appliquerVerdict — verdict ou étape inconnus → non appliqué', () => {
  const g = construireGraphe('INTENT-001');
  assert.equal(appliquerVerdict(g, 'RESEARCH', 'BOGUS').applique, false);
  assert.equal(appliquerVerdict(g, 'NOPE', 'PASS').applique, false);
});

// ─── Resume ─────────────────────────────────────────────────────────────────

test('prochaineEtape — première actionnable non-done', () => {
  let g = construireGraphe('INTENT-001');
  assert.equal(prochaineEtape(g).name, 'RESEARCH');
  g = applyVerdict(g, 'RESEARCH', 'PASS').graphe;
  assert.equal(nextStep(g).name, 'SPEC');
});

test('prochaineEtape — signale l\'étape bloquée actionnable (resume §4.3)', () => {
  let g = construireGraphe('INTENT-001');
  g = appliquerVerdict(g, 'RESEARCH', 'FAIL').graphe;
  const n = prochaineEtape(g);
  assert.equal(n.name, 'RESEARCH');
  assert.equal(n.status, 'blocked');
  assert.ok(/non franchie/.test(n.note));
});

test('cycleComplet — tout done', () => {
  let g = construireGraphe('INTENT-001');
  for (const e of ['RESEARCH', 'SPEC', 'GATE', 'EXEC', 'VALIDATE', 'DRIFT-LOCK']) {
    g = applyVerdict(g, e, 'PASS').graphe;
  }
  assert.equal(cycleComplet(g), true);
  assert.equal(prochaineEtape(g), null);
});

// ─── Rendu ──────────────────────────────────────────────────────────────────

test('rendreGraphe — marqueurs cohérents', () => {
  let g = construireGraphe('INTENT-001');
  g = applyVerdict(g, 'RESEARCH', 'FAIL').graphe;
  const out = rendreGraphe(g);
  assert.ok(out.includes(`[${MARQUEURS.done}] INTENT`));
  assert.ok(out.includes(`[${MARQUEURS.blocked}] RESEARCH`));
  assert.ok(out.includes(`[${MARQUEURS.todo}] SPEC`));
});

// ─── Persistance (crash-recoverable) ────────────────────────────────────────

test('sauverGraphe / chargerGraphe — round-trip', () => {
  const d = tmp();
  try {
    const g = construireGraphe('INTENT-009');
    const p = sauverGraphe(d, g);
    assert.ok(existsSync(p));
    assert.equal(p, cheminGraphe(d, 'INTENT-009'));
    const relu = chargerGraphe(d, 'INTENT-009');
    assert.deepEqual(relu, g);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerGraphe — absent → null', () => {
  assert.equal(chargerGraphe('/nope-xyz', 'INTENT-000'), null);
});

test('buildGraph alias EN', () => {
  assert.equal(buildGraph, construireGraphe);
});
