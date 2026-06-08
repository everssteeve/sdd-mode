// Tests `lib/mini-gate.js` — verdict mini-gate par tranche (§3.6).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parserPlan } from '../lib/exec-status.js';
import {
  calculerMiniGate,
  emitMiniGate,
  calculerMiniGatePlan,
  // alias EN
  computeMiniGate,
} from '../lib/mini-gate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(readFileSync(join(__dirname, '..', '.aiad', 'schema', 'verdicts', 'minigate.schema.json'), 'utf-8'));

// Projet temp avec des fichiers de test « livrés ».
function projet(plan, tests = []) {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-mg-'));
  mkdirSync(join(dir, '.aiad', 'exec'), { recursive: true });
  if (plan) writeFileSync(join(dir, '.aiad', 'exec', 'EXEC-SPEC-004-1-plan.md'), plan);
  for (const t of tests) {
    mkdirSync(join(dir, dirname(t)), { recursive: true });
    writeFileSync(join(dir, t), 'test("x", () => {});');
  }
  return dir;
}

function phase(md) { return parserPlan(md).phases[0]; }

// ─── Verdicts par tranche ───────────────────────────────────────────────────

test('calculerMiniGate — tranche bloquée [!] → FAIL', () => {
  const dir = projet(null);
  try {
    const r = computeMiniGate(phase('## Phase 1 — A  [!]\n- Tests : test/a.test.js'), dir);
    assert.equal(r.verdict, 'FAIL');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerMiniGate — aucune tranche de test → FAIL (anti code horizontal)', () => {
  const dir = projet(null);
  try {
    const r = calculerMiniGate(phase('## Phase 1 — A  [~]\n- Objectif : coder'), dir);
    assert.equal(r.verdict, 'FAIL');
    assert.match(r.raisons.join(' '), /horizontal/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerMiniGate — tests déclarés mais non livrés → FAIL', () => {
  const dir = projet(null);
  try {
    const r = calculerMiniGate(phase('## Phase 1 — A  [~]\n- Tests : test/ghost.test.js'), dir);
    assert.equal(r.verdict, 'FAIL');
    assert.match(r.raisons.join(' '), /non livrés/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerMiniGate — tests livrés, aucune dette → PASS', () => {
  const dir = projet(null, ['test/a.test.js']);
  try {
    const r = calculerMiniGate(phase('## Phase 1 — A  [~]\n- Tests : test/a.test.js'), dir);
    assert.equal(r.verdict, 'PASS');
    assert.equal(r.evidence[0].present, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerMiniGate — tests livrés + dette → CONDITIONAL', () => {
  const dir = projet(null, ['test/a.test.js']);
  try {
    const r = calculerMiniGate(phase('## Phase 1 — A  [~]\n- Tests : test/a.test.js\n- Conditions :\n  - dette à lever'), dir);
    assert.equal(r.verdict, 'CONDITIONAL');
    assert.deepEqual(r.conditions, ['dette à lever']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerMiniGate — runner rouge → FAIL même si tests livrés', () => {
  const dir = projet(null, ['test/a.test.js']);
  try {
    const r = calculerMiniGate(phase('## Phase 1 — A  [~]\n- Tests : test/a.test.js'), dir, { runner: () => ({ ok: false, output: '1 failing' }) });
    assert.equal(r.verdict, 'FAIL');
    assert.match(r.raisons.join(' '), /rouges/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerMiniGate — runner vert + dette → CONDITIONAL', () => {
  const dir = projet(null, ['test/a.test.js']);
  try {
    const r = calculerMiniGate(phase('## Phase 1 — A  [~]\n- Tests : test/a.test.js\n- Conditions :\n  - x'), dir, { runner: () => ({ ok: true }) });
    assert.equal(r.verdict, 'CONDITIONAL');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerMiniGate — hors-scope [-] → PASS (non gatée)', () => {
  const dir = projet(null);
  try {
    assert.equal(calculerMiniGate(phase('## Phase 1 — A  [-]'), dir).verdict, 'PASS');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerMiniGate — tranche absente → JNSP', () => {
  assert.equal(calculerMiniGate(null, '/tmp').verdict, 'JNSP');
});

// ─── Émission + schéma ──────────────────────────────────────────────────────

test('emitMiniGate — PASS exit 0 + enveloppe valide vs schéma', () => {
  const PLAN = '## Phase 1 — A  [~]\n- Tests : test/a.test.js';
  const dir = projet(PLAN, ['test/a.test.js']);
  try {
    let out = '';
    const r = emitMiniGate(dir, 'SPEC-004-1', 1, { json: true, schema: SCHEMA, stream: { write: (s) => { out += s; } } });
    assert.equal(r.code, 0);
    assert.equal(r.valide, true);
    assert.equal(JSON.parse(out).verdict, 'PASS');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('emitMiniGate — CONDITIONAL porte des conditions non vides (contrat)', () => {
  const PLAN = '## Phase 1 — A  [~]\n- Tests : test/a.test.js\n- Conditions :\n  - dette';
  const dir = projet(PLAN, ['test/a.test.js']);
  try {
    const r = emitMiniGate(dir, 'SPEC-004-1', 1, { schema: SCHEMA, stream: { write: () => {} } });
    assert.equal(r.code, 0);
    assert.equal(r.verdict, 'CONDITIONAL');
    assert.ok(r.enveloppe.conditions.length > 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('emitMiniGate — plan absent → JNSP (exit 2)', () => {
  const dir = projet(null);
  try {
    const r = emitMiniGate(dir, 'SPEC-999', 1, { schema: SCHEMA, stream: { write: () => {} } });
    assert.equal(r.code, 2);
    assert.equal(r.verdict, 'JNSP');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ─── Agrégat de plan ────────────────────────────────────────────────────────

test('calculerMiniGatePlan — FAIL prime, hors-scope ignorée', () => {
  const dir = projet(null, ['test/a.test.js']);
  try {
    const plan = parserPlan('## Phase 1 — A  [x]\n- Tests : test/a.test.js\n## Phase 2 — B  [ ]\n- Objectif : sans test\n## Phase 3 — C  [-]');
    const r = calculerMiniGatePlan(plan, dir);
    assert.equal(r.verdict, 'FAIL'); // phase 2 sans test
    assert.equal(r.parTranche.length, 2); // hors-scope exclue
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerMiniGatePlan — CONDITIONAL si dette sans FAIL', () => {
  const dir = projet(null, ['test/a.test.js', 'test/b.test.js']);
  try {
    const plan = parserPlan('## Phase 1 — A  [x]\n- Tests : test/a.test.js\n## Phase 2 — B  [~]\n- Tests : test/b.test.js\n- Conditions :\n  - dette');
    const r = calculerMiniGatePlan(plan, dir);
    assert.equal(r.verdict, 'CONDITIONAL');
    assert.deepEqual(r.conditions, ['dette']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
