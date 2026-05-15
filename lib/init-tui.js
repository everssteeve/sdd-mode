// AIAD SDD Mode — TUI interactive pour `aiad-sdd init`.
//
// Réduit drastiquement le coût d'entrée pour un débutant : au lieu de
// connaître les flags `--minimal`, `--upgrade`, `--runtime`, `--pack`, etc.,
// l'utilisateur répond à 4 questions guidées en français et l'init se lance
// avec les bonnes options.
//
// **Zero-dep** : utilise `node:readline` natif (pas de prompts/inquirer).
//
// **Architecture testable** :
//   - Les choix possibles + parsing + validation sont des **fonctions pures**
//     exportées (`PROFILS`, `RUNTIMES`, `PACKS_GOUVERNANCE`, `parseChoixIndex`,
//     `construireOptionsInit`).
//   - `lancerTui(options)` orchestre les prompts via readline et retourne un
//     objet d'options consommable par `init()`.
//
// Documentation : https://aiad.ovh

import readline from 'node:readline';
import { stdin, stdout } from 'node:process';
import { C } from './term.js';

// ─── Catalogue des choix proposés ────────────────────────────────────────────

export const PROFILS = [
  { id: 'complet', label: 'Profil complet (recommandé)', description: '14 commandes /sdd + 16 /aiad + skills + gouvernance complète. Cible : équipes produit/ingénierie.' },
  { id: 'minimal', label: 'Profil minimal (lean)', description: '4 commandes essentielles (intent, spec, gate, drift-check). ≤ 1k tokens. Cible : projets perso ou onboarding.' },
];

export const RUNTIMES = [
  { id: 'claude-code', label: 'Claude Code (recommandé)', description: 'CLAUDE.md + commandes slash + skills.' },
  { id: 'cursor', label: 'Cursor', description: '.cursor/rules/ MDC.' },
  { id: 'codex', label: 'Codex', description: '.codex/AGENT.md.' },
  { id: 'copilot', label: 'GitHub Copilot', description: 'AGENTS.md.' },
  { id: 'gemini', label: 'Gemini', description: 'GEMINI.md.' },
  { id: 'tous', label: 'Tous les runtimes', description: 'AGENTS.md + CLAUDE.md + .cursor/ + .codex/ + GEMINI.md (sync via emit-rules).' },
];

export const PACKS_GOUVERNANCE = [
  { id: 'eu-baseline', label: 'EU Baseline (défaut, leader)', description: 'AI-ACT · RGPD · RGAA · RGESN · CRA — référentiel européen complet.' },
  { id: 'eu-financial', label: 'EU Financial (sectoriel)', description: 'DORA · PSD2 · MiCA · SFDR — banques, assurances, fintechs, CASP crypto.' },
  { id: 'us-baseline', label: 'US Baseline', description: 'SOC 2 · HIPAA · ADA · NIST AI RMF.' },
  { id: 'uk-baseline', label: 'UK Baseline', description: 'UK DPA · UK Equality · UK AI Principles · UK SECR.' },
  { id: 'aucun', label: 'Aucun pack de gouvernance', description: 'Pas d\'agents Tier 1 (déconseillé sur le marché EU).' },
];

// ─── Fonctions pures ────────────────────────────────────────────────────────

/**
 * Convertit la saisie utilisateur (Enter, "1", "2"…) en index de choix valide.
 *
 * @param {string} saisie — réponse brute de l'utilisateur (peut être vide)
 * @param {object[]} options — liste de choix
 * @param {number} defaut — index par défaut si saisie vide
 * @returns {number|null} index choisi, ou null si saisie invalide
 */
export function parseChoixIndex(saisie, options, defaut) {
  const trim = String(saisie || '').trim();
  if (trim === '') return defaut;
  const n = Number.parseInt(trim, 10);
  if (Number.isNaN(n) || n < 1 || n > options.length) return null;
  return n - 1;
}

/**
 * Convertit une saisie booléenne ("o", "y", "n", défaut → vrai).
 *
 * @param {string} saisie
 * @param {boolean} defaut
 * @returns {boolean}
 */
export function parseOuiNon(saisie, defaut) {
  const t = String(saisie || '').trim().toLowerCase();
  if (t === '') return defaut;
  if (['o', 'oui', 'y', 'yes', '1'].includes(t)) return true;
  if (['n', 'non', 'no', '0'].includes(t)) return false;
  return defaut;
}

/**
 * Construit l'objet d'options à passer à `init()` à partir des choix TUI.
 *
 * @param {{ profilId: string, runtimeId: string, packId: string, hooks: boolean, force?: boolean }} reponses
 * @returns {{ minimal: boolean, runtimes: string[], pack: string|null, sansGouvernance: boolean, withGitHooks: boolean, force: boolean }}
 */
export function construireOptionsInit(reponses) {
  const runtimes = reponses.runtimeId === 'tous'
    ? ['claude-code', 'cursor', 'codex', 'copilot', 'gemini']
    : [reponses.runtimeId];
  return {
    minimal: reponses.profilId === 'minimal',
    runtimes,
    pack: reponses.packId === 'aucun' ? null : reponses.packId,
    sansGouvernance: reponses.packId === 'aucun',
    withGitHooks: Boolean(reponses.hooks),
    force: Boolean(reponses.force),
  };
}

// ─── Helpers I/O ────────────────────────────────────────────────────────────

function afficherChoix(titre, options, defaut) {
  const out = [];
  out.push(`\n${C.gras}${titre}${C.reset}`);
  options.forEach((opt, i) => {
    const idx = i + 1;
    const tag = i === defaut ? `${C.cyan}(défaut)${C.reset}` : '';
    out.push(`  ${C.cyan}${idx}${C.reset}. ${opt.label} ${tag}`);
    out.push(`     ${C.gris}${opt.description}${C.reset}`);
  });
  return out.join('\n');
}

function poser(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (rep) => resolve(rep));
  });
}

/**
 * Boucle de prompt jusqu'à obtenir un choix valide.
 *
 * @param {readline.Interface} rl
 * @param {string} titre
 * @param {object[]} options
 * @param {number} defaut
 * @returns {Promise<object>} option choisie
 */
async function demanderChoix(rl, titre, options, defaut) {
  console.log(afficherChoix(titre, options, defaut));
  for (;;) {
    const saisie = await poser(rl, `\n  Choix [${defaut + 1}] > `);
    const idx = parseChoixIndex(saisie, options, defaut);
    if (idx !== null) return options[idx];
    console.log(`  ${C.rouge}Choix invalide.${C.reset} Entre un nombre entre 1 et ${options.length}.`);
  }
}

async function demanderOuiNon(rl, question, defaut) {
  const suffixe = defaut ? '[O/n]' : '[o/N]';
  for (;;) {
    const saisie = await poser(rl, `\n  ${question} ${suffixe} > `);
    const v = String(saisie || '').trim().toLowerCase();
    if (v === '') return defaut;
    if (['o', 'oui', 'y', 'yes', '1'].includes(v)) return true;
    if (['n', 'non', 'no', '0'].includes(v)) return false;
    console.log(`  ${C.rouge}Réponse invalide.${C.reset} Tape o/oui ou n/non.`);
  }
}

// ─── Entrée publique ────────────────────────────────────────────────────────

/**
 * Lance la TUI et retourne les options à passer à `init()`.
 * Si stdin n'est pas un TTY, on retourne directement les valeurs par défaut.
 *
 * @param {{ rl?: readline.Interface, force?: boolean }} [options]
 * @returns {Promise<object>} options consommables par `init()`
 */
export async function lancerTui(options = {}) {
  const rl = options.rl || readline.createInterface({ input: stdin, output: stdout });
  const fermerSoi = !options.rl;

  console.log(`
${C.gras}${C.cyan}  AIAD SDD — Initialisation guidée${C.reset}
${C.gris}  4 questions pour bootstrap ton projet en moins d'une minute.
  Appuie sur Entrée pour accepter le choix par défaut.${C.reset}`);

  try {
    const profil = await demanderChoix(rl, 'Quel profil veux-tu ?', PROFILS, 0);
    const runtime = await demanderChoix(rl, 'Quel runtime IA cibles-tu en priorité ?', RUNTIMES, 0);
    const pack = await demanderChoix(rl, 'Quelle juridiction / pack de gouvernance ?', PACKS_GOUVERNANCE, 0);
    const hooks = await demanderOuiNon(rl, 'Installer le hook Git pre-commit (Drift Lock) ?', true);

    const reponses = {
      profilId: profil.id,
      runtimeId: runtime.id,
      packId: pack.id,
      hooks,
      force: Boolean(options.force),
    };

    console.log(`
${C.gras}  Récapitulatif${C.reset}
    Profil      : ${C.cyan}${profil.label}${C.reset}
    Runtime IA  : ${C.cyan}${runtime.label}${C.reset}
    Gouvernance : ${C.cyan}${pack.label}${C.reset}
    Drift Lock  : ${C.cyan}${hooks ? 'oui' : 'non'}${C.reset}
`);

    const confirme = await demanderOuiNon(rl, 'Lancer l\'initialisation avec ces choix ?', true);
    if (!confirme) {
      console.log(`\n  ${C.jaune}Initialisation annulée.${C.reset}\n`);
      return { annule: true };
    }

    return { ...construireOptionsInit(reponses), reponses };
  } finally {
    if (fermerSoi) rl.close();
  }
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  PROFILS as PROFILES,
  RUNTIMES as RUNTIME_TARGETS,
  PACKS_GOUVERNANCE as GOVERNANCE_PACKS,
  parseChoixIndex as parseChoiceIndex,
  parseOuiNon as parseYesNo,
  construireOptionsInit as buildInitOptions,
  lancerTui as runTui,
};
