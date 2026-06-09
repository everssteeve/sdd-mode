// AIAD SDD Mode — Hooks utilisateur before/after sur commandes (item #120).
//
// **Cap stratégique** : permettre à une organisation d'imposer des
// policies sur **toutes les commandes AIAD** sans toucher au code AIAD.
// Cas d'usage typiques :
//
//   - **Audit interne** — logger chaque commande exécutée dans un SIEM
//     (Splunk, Datadog, ELK) avec who/what/when.
//   - **Policy enforcement** — bloquer `archive` hors heures ouvrées,
//     forcer `--json` en CI, exiger une raison sur `restore`.
//   - **Métriques équipe** — compter les `gate` réussies par sprint.
//   - **Intégrations** — déclencher un webhook Slack après chaque
//     `publish` ou `cert badge`.
//
// **Différence avec #119 (plugins npm)** : ici, **un seul fichier ESM
// local** `.aiad/hooks/aiad-hooks.js`, sans manifeste, sans dépendance
// npm. Cible : policies internes au projet/à l'équipe.
//
// **Contrat ESM** :
//   ```js
//   export async function beforeCommand(ctx) { ... }
//   export async function afterCommand(ctx) { ... }
//   ```
//   `ctx` = `{ command, args, racine, env, exitCode? }`
//
//   - **Avant la commande** : si `beforeCommand` throw, la commande est
//     **bloquée** (policy enforce). L'exception est affichée à
//     l'utilisateur.
//   - **Après la commande** : `afterCommand` reçoit `ctx.exitCode`. Une
//     exception y est **swallow** (logging best-effort, ne casse pas
//     la sortie).
//
// **Sécurité** : un hook utilisateur peut exécuter du code arbitraire.
// AIAD documente le risque ; **l'utilisateur audite** le fichier.
// `AIAD_COMMAND_HOOKS_DISABLED=1` désactive le système.
//
// Documentation : https://aiad.ovh/command-hooks

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { importerEsm } from './esm-import.js';

const HOOK_PATH = '.aiad/hooks/aiad-hooks.js';

// ─── Détection / chargement ────────────────────────────────────────────────

/**
 * Renvoie `true` si un fichier de hooks existe ET que la fonctionnalité
 * n'est pas désactivée par env.
 *
 * @param {string} racine
 */
export function hooksDisponibles(racine) {
  if (process.env.AIAD_COMMAND_HOOKS_DISABLED === '1') return false;
  return existsSync(join(racine, HOOK_PATH));
}

/**
 * Charge le module de hooks en ESM dynamique.
 *
 * @param {string} racine
 * @returns {Promise<{ beforeCommand?: Function, afterCommand?: Function } | null>}
 */
export async function chargerHooks(racine) {
  if (!hooksDisponibles(racine)) return null;
  const path = join(racine, HOOK_PATH);
  try {
    // import() robuste : repli data: URL pour Node 18 / projets CommonJS.
    const mod = await importerEsm(path);
    return {
      beforeCommand: typeof mod.beforeCommand === 'function' ? mod.beforeCommand : null,
      afterCommand: typeof mod.afterCommand === 'function' ? mod.afterCommand : null,
    };
  } catch (err) {
    // Renvoie l'erreur de chargement pour que le bin puisse l'afficher
    throw new Error(`Hook ${HOOK_PATH} : ${err.message}`);
  }
}

// ─── Exécution ────────────────────────────────────────────────────────────

/**
 * Exécute `beforeCommand` si défini.
 *
 * Si le hook throw, l'exception est **propagée** (la commande est bloquée).
 *
 * @param {string} racine
 * @param {{ command: string, args?: object, env?: object }} ctx
 * @returns {Promise<void>}
 */
export async function executerBefore(racine, ctx) {
  const hooks = await chargerHooks(racine);
  if (!hooks || !hooks.beforeCommand) return;
  await hooks.beforeCommand({
    command: ctx.command,
    args: ctx.args || {},
    racine,
    env: ctx.env || {},
  });
}

/**
 * Exécute `afterCommand` si défini. Best-effort : exceptions swallowed.
 *
 * @param {string} racine
 * @param {{ command: string, args?: object, exitCode?: number, durationMs?: number }} ctx
 * @returns {Promise<{ called: boolean, error?: Error }>}
 */
export async function executerAfter(racine, ctx) {
  try {
    const hooks = await chargerHooks(racine);
    if (!hooks || !hooks.afterCommand) return { called: false };
    await hooks.afterCommand({
      command: ctx.command,
      args: ctx.args || {},
      racine,
      exitCode: ctx.exitCode ?? 0,
      durationMs: ctx.durationMs ?? 0,
    });
    return { called: true };
  } catch (err) {
    return { called: true, error: err };
  }
}

// ─── Helpers exposés ──────────────────────────────────────────────────────

/**
 * Renvoie un template de hook utilisateur pour démarrer.
 */
export function templateHook() {
  return [
    '// .aiad/hooks/aiad-hooks.js — hooks utilisateur AIAD',
    '//',
    '// Contrat ESM : exporte beforeCommand et/ou afterCommand.',
    '// ctx = { command, args, racine, env, exitCode? (after only) }',
    '//',
    '// Documentation : https://aiad.ovh/command-hooks',
    '',
    'export async function beforeCommand(ctx) {',
    '  // Exemple : bloquer "archive" en dehors des heures ouvrées',
    '  if (ctx.command === \'archive\') {',
    '    const heure = new Date().getHours();',
    '    if (heure < 9 || heure > 19) {',
    '      throw new Error(`Archivage interdit hors 9h-19h (politique équipe).`);',
    '    }',
    '  }',
    '}',
    '',
    'export async function afterCommand(ctx) {',
    '  // Exemple : logger les commandes échouées vers un SIEM',
    '  if (ctx.exitCode !== 0) {',
    '    console.error(`[AIAD-AUDIT] ${ctx.command} a échoué (exit ${ctx.exitCode}).`);',
    '  }',
    '}',
  ].join('\n') + '\n';
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  hooksDisponibles as hooksAvailable,
  chargerHooks as loadHooks,
  executerBefore as runBefore,
  executerAfter as runAfter,
  templateHook as hookTemplate,
};

export const CONSTANTS = {
  HOOK_PATH,
};
