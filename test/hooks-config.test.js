// Tests `lib/hooks-config.js` — toggles de hooks par environnement (§3.13).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  TOGGLES,
  HOOKS_GOUVERNANCE,
  chargerConfig,
  hookDesactive,
  etatHooks,
  // alias EN
  hookDisabled,
  hooksState,
} from '../lib/hooks-config.js';

function projet(config = null, local = null) {
  const d = mkdtempSync(join(tmpdir(), 'hooks-cfg-'));
  mkdirSync(join(d, '.aiad'), { recursive: true });
  if (config) writeFileSync(join(d, '.aiad', 'hooks-config.json'), JSON.stringify(config));
  if (local) writeFileSync(join(d, '.aiad', 'hooks-config.local.json'), JSON.stringify(local));
  return d;
}

// ─── Chargement & précédence ────────────────────────────────────────────────

test('chargerConfig — local override le partagé', () => {
  const d = projet({ disableStopHook: false }, { disableStopHook: true });
  assert.equal(chargerConfig(d).disableStopHook, true);
  rmSync(d, { recursive: true, force: true });
});

test('chargerConfig — absent → {}', () => {
  assert.deepEqual(chargerConfig('/nope-xyz'), {});
});

// ─── hookDesactive ──────────────────────────────────────────────────────────

test('hookDesactive — disableStopHook coupe drift-lock', () => {
  const d = projet({ disableStopHook: true });
  assert.equal(hookDesactive(d, 'drift-lock'), true);
  assert.equal(hookDisabled(d, 'discovery-gate'), false);
  rmSync(d, { recursive: true, force: true });
});

test('hookDesactive — toggle granulaire', () => {
  const d = projet({ disableSkillUsageHook: true });
  assert.equal(hookDesactive(d, 'skill-usage'), true);
  rmSync(d, { recursive: true, force: true });
});

test('hookDesactive — défaut fail-safe (rien désactivé)', () => {
  const d = projet();
  for (const h of ['drift-lock', 'jnsp-scan', 'discovery-gate', 'skill-usage']) {
    assert.equal(hookDesactive(d, h), false);
  }
  rmSync(d, { recursive: true, force: true });
});

// ─── Protection gouvernance ─────────────────────────────────────────────────

test('hookDesactive — veto PROTÉGÉ même si disablePreToolUseHook=true', () => {
  const d = projet({ disablePreToolUseHook: true });
  // disablePreToolUseHook coupe jnsp-scan/skill-usage mais PAS veto.
  assert.equal(hookDesactive(d, 'jnsp-scan'), true);
  assert.equal(hookDesactive(d, 'veto'), false);
  rmSync(d, { recursive: true, force: true });
});

test('hookDesactive — veto désactivable seulement via allowDisableGovernance', () => {
  const d = projet({ disablePreToolUseHook: true, allowDisableGovernance: true });
  // Avec l'échappatoire explicite, le toggle PreToolUse s'applique aussi à... veto ?
  // veto n'est pas dans la map TOGGLES → reste non ciblé ; l'échappatoire lève
  // seulement la protection, mais aucun toggle ne le vise → reste actif.
  assert.equal(hookDesactive(d, 'veto'), false);
  rmSync(d, { recursive: true, force: true });
});

test('HOOKS_GOUVERNANCE contient veto', () => {
  assert.ok(HOOKS_GOUVERNANCE.has('veto'));
});

// ─── etatHooks ──────────────────────────────────────────────────────────────

test('etatHooks — liste l\'état + flag protégé', () => {
  const d = projet({ disableDriftLockHook: true });
  const etat = hooksState(d);
  const veto = etat.find((e) => e.hook === 'veto');
  const drift = etat.find((e) => e.hook === 'drift-lock');
  assert.equal(veto.protege, true);
  assert.equal(veto.desactive, false);
  assert.equal(drift.desactive, true);
  rmSync(d, { recursive: true, force: true });
});

test('TOGGLES — disablePreToolUseHook n\'inclut PAS veto', () => {
  assert.ok(!TOGGLES.disablePreToolUseHook.includes('veto'));
  assert.ok(TOGGLES.disablePreToolUseHook.includes('jnsp-scan'));
});
