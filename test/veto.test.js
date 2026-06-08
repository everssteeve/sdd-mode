// Tests `lib/veto.js` — veto Tier 1 déterministe par diff (§3.1 levier 3).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  globVersRegex,
  matchGlob,
  agentsConcernes,
  calculerVeto,
  AGENTS_GATE,
  // alias EN
  globMatch,
  computeVeto,
} from '../lib/veto.js';

// ─── Matcher de glob ────────────────────────────────────────────────────────

test('globVersRegex — ** traverse les dossiers', () => {
  assert.ok(matchGlob('**/auth/**', 'src/auth/login.js'));
  assert.ok(matchGlob('**/auth/**', 'auth/x.js'));
  assert.ok(!matchGlob('**/auth/**', 'src/authentic/x.js'));
});

test('globVersRegex — * reste dans un segment', () => {
  assert.ok(matchGlob('**/*.vue', 'src/components/Btn.vue'));
  assert.ok(!matchGlob('**/*.vue', 'src/Btn.vue.bak'));
});

test('globVersRegex — ancrage strict (pas de match partiel)', () => {
  const re = globVersRegex('**/api/**');
  assert.equal(re.test('x/api/y'), true);
  assert.equal(re.test('zapix/api/y'), true); // **/ matche le préfixe entier
});

// ─── Déclenchement par agent ────────────────────────────────────────────────

test('agentsConcernes — RGPD sur zones de données', () => {
  assert.deepEqual(agentsConcernes('src/auth/login.js'), ['AIAD-RGPD']);
  assert.deepEqual(agentsConcernes('app/users/profile.js'), ['AIAD-RGPD']);
});

test('agentsConcernes — RGAA sur composants UI', () => {
  assert.deepEqual(agentsConcernes('src/components/Modal.tsx'), ['AIAD-RGAA']);
});

test('agentsConcernes — AI-ACT sur zones ML', () => {
  assert.deepEqual(agentsConcernes('src/ml/scoring.js'), ['AIAD-AI-ACT']);
});

test('agentsConcernes — RGESN exclu du gate (advisory)', () => {
  assert.ok(!AGENTS_GATE.includes('AIAD-RGESN'));
  assert.deepEqual(agentsConcernes('lib/util.js'), []); // zone neutre
});

// ─── Calcul du verdict ──────────────────────────────────────────────────────

function projet() {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-veto-'));
  return dir;
}

test('calculerVeto — VETO (JNSP) si zone réglementée sans @governance', () => {
  const dir = projet();
  try {
    mkdirSync(join(dir, 'src', 'auth'), { recursive: true });
    writeFileSync(join(dir, 'src', 'auth', 'login.js'), 'export function login() { return 1; }');
    const r = calculerVeto(dir, ['src/auth/login.js']);
    assert.equal(r.verdict, 'JNSP');
    assert.deepEqual(r.triggered, ['AIAD-RGPD']);
    assert.equal(r.violations.length, 1);
    assert.equal(r.violations[0].agent, 'AIAD-RGPD');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerVeto — PASS si annotation @governance présente', () => {
  const dir = projet();
  try {
    mkdirSync(join(dir, 'src', 'auth'), { recursive: true });
    writeFileSync(join(dir, 'src', 'auth', 'login.js'),
      '/**\n * @spec SPEC-001-1-auth\n * @governance AIAD-RGPD\n */\nexport function login() { return 1; }');
    const r = calculerVeto(dir, ['src/auth/login.js']);
    assert.equal(r.verdict, 'PASS');
    assert.equal(r.violations.length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerVeto — PASS si aucune zone Tier 1 touchée', () => {
  const dir = projet();
  try {
    mkdirSync(join(dir, 'lib'), { recursive: true });
    writeFileSync(join(dir, 'lib', 'util.js'), 'export const x = 1;');
    const r = calculerVeto(dir, ['lib/util.js']);
    assert.equal(r.verdict, 'PASS');
    assert.deepEqual(r.triggered, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerVeto — les tests ne portent pas le veto', () => {
  const dir = projet();
  try {
    mkdirSync(join(dir, 'src', 'auth'), { recursive: true });
    writeFileSync(join(dir, 'src', 'auth', 'login.test.js'), 'test("x", () => {});');
    const r = calculerVeto(dir, ['src/auth/login.test.js']);
    assert.equal(r.verdict, 'PASS');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerVeto — fichier illisible/absent = fail-closed (VETO)', () => {
  const dir = projet();
  try {
    // fichier déclaré modifié mais absent du FS → non annoté → violation
    const r = calculerVeto(dir, ['src/components/Ghost.tsx']);
    assert.equal(r.verdict, 'JNSP');
    assert.equal(r.violations[0].agent, 'AIAD-RGAA');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('alias EN', () => {
  assert.equal(globMatch, matchGlob);
  assert.equal(computeVeto, calculerVeto);
});
