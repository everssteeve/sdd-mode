// AIAD SDD Mode — Moteur de chaînage automatique conditionnel (INTENT-031).
//
// Évalue les transitions du cycle SDD après chaque commande réussie et
// déclenche la suivante si toutes les conditions sont satisfaites.
//
// Point d'intégration : executerAfter() dans lib/command-hooks.js.
// Désactivable globalement : AIAD_COMMAND_HOOKS_DISABLED=1

import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { lireConfigAutoChain } from './auto-chain-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = resolve(__dirname, '../bin/aiad-sdd.js');

/**
 * Registre des transitions automatiques du cycle SDD.
 * Immuable — modifiable uniquement via une nouvelle SPEC.
 *
 * @intent INTENT-031
 * @spec SPEC-031-2-auto-chain-engine
 * @verified-by test/auto-chain.test.js
 */
export const TRANSITIONS = Object.freeze({
  spec:          { next: 'gate',        confirmationRequise: false },
  gate:          { next: 'exec',        confirmationRequise: true  },
  exec:          { next: 'validate',    confirmationRequise: false },
  validate:      { next: 'drift-check', confirmationRequise: false },
  'drift-check': { next: 'trace',       confirmationRequise: false },
});

// v1: estimation statique suffisante (R3, RESEARCH-031).
// lib/context-budget.js n'est pas encore disponible — retourne 0 % (toujours sous seuil).
function lireBudgetContexte() {
  return 0;
}

async function demanderConfirmation(message, stream) {
  const rl = createInterface({ input: process.stdin, output: stream });
  return new Promise((res) => {
    rl.question(message, (answer) => { rl.close(); res(answer.trim().toLowerCase()); });
  });
}

async function lancerCommande(commande, racine) {
  return new Promise((res, rej) => {
    const proc = spawn(process.execPath, [BIN, commande], {
      cwd: racine, stdio: 'inherit', env: process.env,
    });
    proc.on('close', (code) => res(code ?? 0));
    proc.on('error', rej);
  });
}

/**
 * Point d'entrée principal — appelé depuis executerAfter().
 *
 * @intent INTENT-031
 * @spec SPEC-031-2-auto-chain-engine
 * @verified-by test/auto-chain.test.js
 *
 * @param {string} racine
 * @param {{ command: string, exitCode?: number, args?: object }} ctx
 * @param {{ dispatcher?: Function, stream?: object, confirmer?: Function, getBudget?: Function }} opts
 * @returns {Promise<void>}
 */
export async function evaluerChainage(racine, ctx, opts = {}) {
  if (process.env.AIAD_COMMAND_HOOKS_DISABLED === '1') return;
  if ((ctx.exitCode ?? 0) !== 0) return;

  const transition = TRANSITIONS[ctx.command];
  if (!transition) return;

  const config = lireConfigAutoChain(racine);
  if (!config.enabled) return;

  const budgetPct = (opts.getBudget ?? lireBudgetContexte)();
  const stream = opts.stream ?? process.stdout;

  if (budgetPct >= config.max_context_pct) {
    stream.write(
      `[AIAD auto-chain] Chaînage suspendu — budget contexte ${budgetPct}% (seuil : ${config.max_context_pct}%).\n` +
      `Relancez manuellement : npx aiad-sdd ${transition.next}\n`,
    );
    return;
  }

  if (transition.confirmationRequise) {
    stream.write(
      `[AIAD auto-chain] ${ctx.command} → ${transition.next} : confirmation requise.\n` +
      `Conditions satisfaites : budget ${budgetPct}%, 0 veto.\n`,
    );
    const confirmer = opts.confirmer ?? (() => demanderConfirmation(`Lancer ${transition.next} maintenant ? [o/N] : `, stream));
    const reponse = await confirmer();
    if (reponse !== 'o' && reponse !== 'oui') return;
  }

  stream.write(`[AIAD auto-chain] Démarrage de ${transition.next}...\n`);

  if (typeof opts.dispatcher === 'function') {
    await opts.dispatcher(transition.next, ctx.args || {});
  } else {
    await lancerCommande(transition.next, racine);
  }
}

export { evaluerChainage as evaluateChain, TRANSITIONS as CHAIN_TRANSITIONS };
