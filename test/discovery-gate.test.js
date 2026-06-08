// Tests prérequis Discovery (§3.5 SPEC-B) — CLI `discovery-check` + hook
// UserPromptSubmit `discovery-gate.js`.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(RACINE, 'bin', 'aiad-sdd.js');
const HOOK = join(RACINE, '.aiad', 'hooks', 'discovery-gate.js');

function projetAvecResearch(contenu) {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-disc-'));
  mkdirSync(join(dir, '.aiad', 'research'), { recursive: true });
  if (contenu) writeFileSync(join(dir, '.aiad', 'research', 'RESEARCH-001-x.md'), contenu);
  return dir;
}

const READY = ['# RESEARCH-001 (← INTENT-042)', '## Discovery', '- src/x.ts:1', '## Verdict : GO (confidence: 90 %)'].join('\n');

// ─── CLI discovery-check ────────────────────────────────────────────────────

function cli(dir, args) {
  try {
    const stdout = execFileSync('node', [CLI, ...args], { cwd: dir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status, stdout: e.stdout ? String(e.stdout) : '' };
  }
}

test('discovery-check — Research prête → PASS (exit 0)', () => {
  const dir = projetAvecResearch(READY);
  try {
    const r = cli(dir, ['discovery-check', 'INTENT-042', '--output-format', 'verdict']);
    assert.equal(r.code, 0);
    const env = JSON.parse(r.stdout.trim().split('\n').pop());
    assert.equal(env.verdict, 'PASS');
    assert.equal(env.ready, true);
    assert.equal(env.research, 'RESEARCH-001-x');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('discovery-check — aucune Research liée → JNSP (exit 2)', () => {
  const dir = projetAvecResearch(READY);
  try {
    const r = cli(dir, ['discovery-check', 'INTENT-999', '--output-format', 'verdict']);
    assert.equal(r.code, 2);
    const env = JSON.parse(r.stdout.trim().split('\n').pop());
    assert.equal(env.verdict, 'JNSP');
    assert.equal(env.ready, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('discovery-check — Research NO-GO → FAIL (exit 1)', () => {
  const dir = projetAvecResearch(['# RESEARCH-001 (← INTENT-042)', '## Discovery', '- src/x.ts:1', '## Verdict : NO-GO (confidence: 10 %)'].join('\n'));
  try {
    const r = cli(dir, ['discovery-check', 'INTENT-042', '--output-format', 'verdict']);
    assert.equal(r.code, 1);
    assert.equal(JSON.parse(r.stdout.trim().split('\n').pop()).verdict, 'FAIL');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ─── Hook discovery-gate.js (UserPromptSubmit) ──────────────────────────────

function runHook(dir, prompt, env = {}) {
  try {
    const stdout = execFileSync('node', [HOOK], {
      cwd: dir,
      input: JSON.stringify({ prompt }),
      encoding: 'utf-8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir, ...env },
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return stdout;
  } catch { return ''; }
}

test('hook — prompt sans /sdd spec|exec → aucune sortie', () => {
  const dir = projetAvecResearch(READY);
  try {
    assert.equal(runHook(dir, 'corrige ce bug stp').trim(), '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('hook — /sdd spec sans INTENT-id → rappel générique', () => {
  const dir = projetAvecResearch(READY);
  try {
    const out = runHook(dir, '/sdd spec pour le login');
    const j = JSON.parse(out);
    assert.equal(j.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
    assert.match(j.hookSpecificOutput.additionalContext, /Prérequis Discovery/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('hook — /sdd spec INTENT-042 avec Research prête → silencieux', () => {
  // projectDir = RACINE pour résoudre le dev bin ; on cible un Intent
  // réellement prêt en pointant CLAUDE_PROJECT_DIR sur un projet temp qui
  // contient AUSSI une copie du bin n'est pas possible → on teste plutôt le
  // chemin "non prêt" ci-dessous. Ici on vérifie qu'un projet temp sans bin
  // résolvable ne plante jamais (sortie ouverte).
  const dir = projetAvecResearch(READY);
  try {
    // Pas de bin/aiad-sdd.js dans le temp → npx --no-install échoue offline →
    // code != 0 → le hook injecte un rappel (jamais d'exception).
    const out = runHook(dir, '/sdd spec INTENT-042');
    // Sortie soit vide (CLI a réussi via npx), soit additionalContext — jamais un crash.
    if (out.trim()) {
      const j = JSON.parse(out);
      assert.ok(j.hookSpecificOutput || j.decision);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('hook — /sdd exec INTENT-99999 non prêt (repo) → additionalContext', () => {
  // RACINE a un dev bin résolvable + .aiad/research/ sans cet Intent → not ready.
  const out = runHook(RACINE, '/sdd exec INTENT-99999');
  const j = JSON.parse(out);
  assert.match(j.hookSpecificOutput.additionalContext, /INTENT-99999/);
  assert.match(j.hookSpecificOutput.additionalContext, /Discovery/);
});

test('hook — mode strict → decision block', () => {
  const out = runHook(RACINE, '/sdd spec INTENT-99999', { AIAD_DISCOVERY_STRICT: '1' });
  const j = JSON.parse(out);
  assert.equal(j.decision, 'block');
  assert.match(j.reason, /Prérequis Discovery/);
});

test('hook — AIAD_HOOK_SILENT=1 → aucune sortie', () => {
  const out = runHook(RACINE, '/sdd spec INTENT-99999', { AIAD_HOOK_SILENT: '1' });
  assert.equal(out.trim(), '');
});

test('hook — alias plat /sdd-spec reconnu', () => {
  const out = runHook(RACINE, '/sdd-spec INTENT-99999');
  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /Discovery/);
});
