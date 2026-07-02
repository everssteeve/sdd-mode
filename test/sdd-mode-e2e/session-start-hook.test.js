// Tests `.aiad/hooks/session-start.js` — rappel de contexte à l'ouverture de
// session (PRD §4.4 / §4.8 / §5 « Context engineering » : injection ≤ 300 tokens).
// Absent de la suite avant ce système : le hook n'était vérifié par aucun test.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const HOOK = join(ROOT, '.aiad', 'hooks', 'session-start.js');

// Budget de sobriété revendiqué par le hook + PRD §5 (≤ 300 tokens injectés).
// Approximation zero-dep : ~4 caractères/token (convention utilisée ailleurs
// dans la codebase pour le budget de contexte, cf. lib/footprint.js).
const MAX_TOKENS = 300;
const CHARS_PER_TOKEN = 4;

function projetTemp() {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-session-start-'));
  mkdirSync(join(dir, '.aiad', 'intents'), { recursive: true });
  mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
  mkdirSync(join(dir, '.aiad', 'gouvernance'), { recursive: true });
  return dir;
}

function runHook(projectDir, env = {}) {
  return spawnSync('node', [HOOK], {
    encoding: 'utf-8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, ...env },
  });
}

function additionalContext(stdout) {
  if (!stdout.trim()) return '';
  const parsed = JSON.parse(stdout);
  return parsed.hookSpecificOutput.additionalContext;
}

test('session-start — sans .aiad/, ne produit rien (fail-open silencieux)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-session-start-empty-'));
  try {
    const r = runHook(dir);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('session-start — AIAD_HOOK_SILENT=1 court-circuite toute sortie', () => {
  const dir = projetTemp();
  try {
    const r = runHook(dir, { AIAD_HOOK_SILENT: '1' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('session-start — aucun Intent actif → suggestion `/sdd intent`', () => {
  const dir = projetTemp();
  try {
    writeFileSync(join(dir, '.aiad', 'intents', '_index.md'), '| ID | Titre | Auteur | Date | SPECs liées | Statut |\n|---|---|---|---|---|---|\n');
    const ctx = additionalContext(runHook(dir).stdout);
    assert.match(ctx, /\/sdd intent/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('session-start — Intent actif + gouvernance → rappel ciblé, sous le budget de tokens', () => {
  const dir = projetTemp();
  try {
    writeFileSync(
      join(dir, '.aiad', 'intents', '_index.md'),
      '| ID | Titre | Auteur | Date | SPECs liées | Statut |\n' +
      '|---|---|---|---|---|---|\n' +
      '| INTENT-099 | Test hook session-start | Steeve | 2026-07-02 | SPEC-099-1 | active |\n',
    );
    writeFileSync(join(dir, '.aiad', 'gouvernance', 'AIAD-RGPD.md'), '# RGPD');
    writeFileSync(join(dir, '.aiad', 'gouvernance', 'AIAD-AI-ACT.md'), '# AI-ACT');

    const r = runHook(dir);
    assert.equal(r.status, 0);
    const ctx = additionalContext(r.stdout);
    assert.match(ctx, /INTENT-099/);
    assert.match(ctx, /Gouvernance applicable/);
    assert.match(ctx, /JNSP/);
    const approxTokens = ctx.length / CHARS_PER_TOKEN;
    assert.ok(approxTokens <= MAX_TOKENS, `budget dépassé : ~${Math.round(approxTokens)} tokens (max ${MAX_TOKENS})`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('session-start — un hook qui plante ne bloque jamais la session (fail-open)', () => {
  const dir = projetTemp();
  try {
    // Fichier _index.md corrompu structurellement : ne doit jamais faire planter le process.
    writeFileSync(join(dir, '.aiad', 'intents', '_index.md'), Buffer.from([0xff, 0xfe, 0x00, 0x01]));
    const r = runHook(dir);
    assert.equal(r.status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
