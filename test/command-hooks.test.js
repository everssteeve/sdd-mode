// Tests `lib/command-hooks.js` — hooks utilisateur before/after (item #120).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  hooksDisponibles, chargerHooks, executerBefore, executerAfter, templateHook,
  CONSTANTS,
  // alias EN
  hooksAvailable, loadHooks, runBefore, runAfter, hookTemplate,
} from '../lib/command-hooks.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-ch-')); }

function ecrireHook(racine, contenu) {
  const dir = join(racine, '.aiad', 'hooks');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'aiad-hooks.js'), contenu);
}

// ─── hooksDisponibles ─────────────────────────────────────────────────────

test('hooksDisponibles — fichier absent → false', () => {
  const d = tmp();
  try {
    assert.equal(hooksDisponibles(d), false);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('hooksDisponibles — fichier présent → true', () => {
  const d = tmp();
  try {
    ecrireHook(d, 'export async function beforeCommand() {}');
    assert.equal(hooksDisponibles(d), true);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('hooksDisponibles — AIAD_COMMAND_HOOKS_DISABLED=1 → false', () => {
  const d = tmp();
  process.env.AIAD_COMMAND_HOOKS_DISABLED = '1';
  try {
    ecrireHook(d, 'export async function beforeCommand() {}');
    assert.equal(hooksDisponibles(d), false);
  } finally {
    delete process.env.AIAD_COMMAND_HOOKS_DISABLED;
    rmSync(d, { recursive: true, force: true });
  }
});

// ─── chargerHooks ─────────────────────────────────────────────────────────

test('chargerHooks — fichier absent → null', async () => {
  const d = tmp();
  try {
    assert.equal(await chargerHooks(d), null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerHooks — module ESM valide → { beforeCommand, afterCommand }', async () => {
  const d = tmp();
  try {
    ecrireHook(d, [
      'export async function beforeCommand(ctx) { return ctx; }',
      'export async function afterCommand(ctx) { return ctx; }',
    ].join('\n'));
    const h = await chargerHooks(d);
    assert.ok(h);
    assert.equal(typeof h.beforeCommand, 'function');
    assert.equal(typeof h.afterCommand, 'function');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerHooks — seul beforeCommand exporté → afterCommand null', async () => {
  const d = tmp();
  try {
    ecrireHook(d, 'export async function beforeCommand() {}');
    const h = await chargerHooks(d);
    assert.equal(typeof h.beforeCommand, 'function');
    assert.equal(h.afterCommand, null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerHooks — syntaxe invalide → throw avec contexte', async () => {
  const d = tmp();
  try {
    ecrireHook(d, 'export const broken = (');
    await assert.rejects(() => chargerHooks(d), /Hook .aiad\/hooks\/aiad-hooks\.js/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── executerBefore ───────────────────────────────────────────────────────

test('executerBefore — hook absent → noop silencieux', async () => {
  const d = tmp();
  try {
    await executerBefore(d, { command: 'init' });
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('executerBefore — reçoit ctx correctement structuré', async () => {
  const d = tmp();
  try {
    ecrireHook(d, [
      'export async function beforeCommand(ctx) {',
      '  globalThis.__aiad_before_ctx = ctx;',
      '}',
    ].join('\n'));
    await executerBefore(d, { command: 'trace', args: { json: true }, env: { CI: '1' } });
    const ctx = globalThis.__aiad_before_ctx;
    assert.equal(ctx.command, 'trace');
    assert.equal(ctx.args.json, true);
    assert.equal(ctx.env.CI, '1');
    assert.equal(ctx.racine, d);
  } finally {
    delete globalThis.__aiad_before_ctx;
    rmSync(d, { recursive: true, force: true });
  }
});

test('executerBefore — throw propagé (policy enforcement)', async () => {
  const d = tmp();
  try {
    ecrireHook(d, [
      'export async function beforeCommand(ctx) {',
      '  if (ctx.command === "archive") throw new Error("Policy : archive interdit");',
      '}',
    ].join('\n'));
    await assert.rejects(
      () => executerBefore(d, { command: 'archive' }),
      /Policy : archive interdit/,
    );
    // Autres commandes passent
    await executerBefore(d, { command: 'init' });
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── executerAfter ────────────────────────────────────────────────────────

test('executerAfter — hook absent → called=false', async () => {
  const d = tmp();
  try {
    const r = await executerAfter(d, { command: 'init', exitCode: 0 });
    assert.equal(r.called, false);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('executerAfter — reçoit exitCode + durationMs', async () => {
  const d = tmp();
  try {
    ecrireHook(d, [
      'export async function afterCommand(ctx) {',
      '  globalThis.__aiad_after_ctx = ctx;',
      '}',
    ].join('\n'));
    await executerAfter(d, { command: 'trace', exitCode: 1, durationMs: 123 });
    const ctx = globalThis.__aiad_after_ctx;
    assert.equal(ctx.command, 'trace');
    assert.equal(ctx.exitCode, 1);
    assert.equal(ctx.durationMs, 123);
  } finally {
    delete globalThis.__aiad_after_ctx;
    rmSync(d, { recursive: true, force: true });
  }
});

test('executerAfter — exception swallowée (best-effort) → error renvoyé', async () => {
  const d = tmp();
  try {
    ecrireHook(d, [
      'export async function afterCommand() {',
      '  throw new Error("post-fail");',
      '}',
    ].join('\n'));
    const r = await executerAfter(d, { command: 'init', exitCode: 0 });
    assert.equal(r.called, true);
    assert.ok(r.error);
    assert.match(r.error.message, /post-fail/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('executerAfter — défauts exitCode=0 et durationMs=0', async () => {
  const d = tmp();
  try {
    ecrireHook(d, [
      'export async function afterCommand(ctx) { globalThis.__a = ctx; }',
    ].join('\n'));
    await executerAfter(d, { command: 'x' });
    assert.equal(globalThis.__a.exitCode, 0);
    assert.equal(globalThis.__a.durationMs, 0);
  } finally {
    delete globalThis.__a;
    rmSync(d, { recursive: true, force: true });
  }
});

// ─── templateHook ─────────────────────────────────────────────────────────

test('templateHook — fichier ESM valide et exemple block-archive', () => {
  const t = templateHook();
  assert.match(t, /export async function beforeCommand/);
  assert.match(t, /export async function afterCommand/);
  assert.match(t, /Politique équipe/i);
  assert.match(t, /Documentation : https:\/\/aiad\.ovh/);
});

// ─── Cache ESM : avec import() dynamique le module peut être caché ────

test('cache ESM — modification du fichier prise en compte sur nouveau racine', async () => {
  // Note : ESM import() cache par URL. On utilise des racines différentes
  // pour éviter le cache (URLs différentes).
  const d1 = tmp();
  const d2 = tmp();
  try {
    ecrireHook(d1, 'export async function beforeCommand() { globalThis.__v = "v1"; }');
    ecrireHook(d2, 'export async function beforeCommand() { globalThis.__v = "v2"; }');
    await executerBefore(d1, { command: 'x' });
    assert.equal(globalThis.__v, 'v1');
    await executerBefore(d2, { command: 'x' });
    assert.equal(globalThis.__v, 'v2');
  } finally {
    delete globalThis.__v;
    rmSync(d1, { recursive: true, force: true });
    rmSync(d2, { recursive: true, force: true });
  }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(hooksAvailable, hooksDisponibles);
  assert.equal(loadHooks, chargerHooks);
  assert.equal(runBefore, executerBefore);
  assert.equal(runAfter, executerAfter);
  assert.equal(hookTemplate, templateHook);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.HOOK_PATH, '.aiad/hooks/aiad-hooks.js');
});
