// AIAD SDD Mode — Toggles de hooks par environnement (item §3.13 SPEC-A).
//
// **Cap stratégique** : le repo de référence (§2.5) active/désactive ses
// mécanismes par une **config plate de booléens** (`hooks-config.json` +
// `.local.json` gitignored). On transpose : activer/désactiver par
// environnement les hooks SDD sans toucher au code.
//
// **Garde-fou de sécurité (§3.1, §9)** : un toggle ne doit JAMAIS pouvoir
// désactiver silencieusement un **veto de gouvernance Tier 1** (fail-closed).
// `veto` est donc **protégé** : son toggle est ignoré sauf si la config déclare
// explicitement `allowDisableGovernance: true` — et `managed-settings.json`
// (niveau org) peut interdire jusqu'à cette échappatoire. Les autres hooks
// (drift-lock, jnsp, discovery-gate, skill-usage…) sont togglables librement.
//
// **Précédence** : `hooks-config.local.json` (gitignored, par machine) écrase
// `hooks-config.json` (versionné, partagé équipe).
//
// **Zero-dep**.
//
// @intent INTENT-011
// @spec SPEC-011-1-hooks-toggles
// @verified-by test/hooks-config.test.js
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Clé de toggle (booléen) → hooks (par nom de fichier sans extension) qu'elle coupe. */
export const TOGGLES = Object.freeze({
  // Par évènement harness.
  disableSessionStartHook: ['session-start'],
  disableUserPromptSubmitHook: ['discovery-gate'],
  disablePreToolUseHook: ['jnsp-scan', 'skill-usage'], // veto exclu (protégé)
  disableStopHook: ['drift-lock'],
  // Granulaire par hook.
  disableDiscoveryGateHook: ['discovery-gate'],
  disableJnspHook: ['jnsp-scan'],
  disableDriftLockHook: ['drift-lock'],
  disableSkillUsageHook: ['skill-usage'],
});

/** Hooks de gouvernance Tier 1 — non désactivables sauf échappatoire explicite. */
export const HOOKS_GOUVERNANCE = new Set(['veto']);

/**
 * Charge la config de toggles : `hooks-config.json` (partagé) écrasé par
 * `hooks-config.local.json` (gitignored). Retourne `{}` si rien.
 *
 * @param {string} racine
 * @returns {Record<string, boolean>}
 */
export function chargerConfig(racine) {
  let config = {};
  for (const nom of ['hooks-config.json', 'hooks-config.local.json']) {
    const p = join(racine, '.aiad', nom);
    if (!existsSync(p)) continue;
    try { config = { ...config, ...JSON.parse(readFileSync(p, 'utf-8')) }; } catch { /* config illisible → ignorée */ }
  }
  return config;
}

/**
 * Indique si un hook donné est désactivé par la config. Fail-safe : en cas de
 * doute (config illisible, clé absente) → **non désactivé** (le hook tourne).
 * Le veto de gouvernance est protégé (cf. en-tête).
 *
 * @param {string} racine
 * @param {string} nomHook — nom de fichier sans extension (ex. 'drift-lock')
 * @param {Record<string, boolean>} [configPreChargee] — pour les tests/perf
 * @returns {boolean}
 */
export function hookDesactive(racine, nomHook, configPreChargee = null) {
  const config = configPreChargee || chargerConfig(racine);

  // Gouvernance Tier 1 : protégé sauf échappatoire explicite.
  if (HOOKS_GOUVERNANCE.has(nomHook) && config.allowDisableGovernance !== true) {
    return false;
  }

  for (const [cle, hooks] of Object.entries(TOGGLES)) {
    if (config[cle] === true && hooks.includes(nomHook)) return true;
  }
  return false;
}

/**
 * Liste l'état de tous les hooks connus (pour `aiad-sdd hooks-config show`).
 *
 * @param {string} racine
 * @returns {{ hook: string, desactive: boolean, protege: boolean }[]}
 */
export function etatHooks(racine) {
  const config = chargerConfig(racine);
  const hooks = new Set(['veto']);
  for (const liste of Object.values(TOGGLES)) for (const h of liste) hooks.add(h);
  return [...hooks].sort().map((hook) => ({
    hook,
    desactive: hookDesactive(racine, hook, config),
    protege: HOOKS_GOUVERNANCE.has(hook),
  }));
}

// ─── Aliases EN ─────────────────────────────────────────────────────────────

export {
  chargerConfig as loadConfig,
  hookDesactive as hookDisabled,
  etatHooks as hooksState,
};
