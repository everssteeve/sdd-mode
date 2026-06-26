// AIAD SDD Mode — Registre catégorisé des commandes CLI.
//
// @intent INTENT-015
// @spec SPEC-015-2-1-registre-commandes
// @verified-by test/commands-registry.test.js
// @governance AIAD-RGESN
//
// Source unique de vérité du tiering des commandes de premier niveau :
// `core` (noyau assumé), `extended` (longue traîne supportée), `experimental`
// (mécanismes internes/instables). Le tiering est posé à **dire d'expert,
// provisoire et révisable** (INTENT-015 condition C1 de RESEARCH-017) — il
// n'est PAS dérivé de la télémétrie (donnée d'usage polluée écartée, C-DATA).
//
// Anti-drift : `test/commands-registry.test.js` fige ce mapping contre un
// snapshot et vérifie la cohérence bidirectionnelle avec `COMMANDES_VALIDES`
// (`bin/aiad-sdd.js`). Ajouter / retirer / re-tierer une commande sans mettre
// à jour le snapshot fait échouer la suite — le critère de drift de l'intent
// devient exécutoire (condition C2).
//
// Sobriété (RGESN) : module statique, zéro dépendance, zéro I/O.
//
// Documentation : https://aiad.ovh

import { C, log, logHeader } from './term.js';

/** Tiers valides, dans l'ordre d'affichage. */
export const TIERS = Object.freeze(['core', 'extended', 'experimental']);

/** Statuts valides d'une commande. */
export const STATUSES = Object.freeze(['active', 'deprecated']);

/**
 * Registre : une entrée par commande de premier niveau.
 * `{ command, tier, category, status }`.
 */
export const COMMANDS_REGISTRY = Object.freeze([
  // ── core (noyau assumé) ───────────────────────────────────────────────
  { command: 'init', tier: 'core', category: 'cadrage', status: 'active' },
  { command: 'update', tier: 'core', category: 'administration', status: 'active' },
  { command: 'gouvernance', tier: 'core', category: 'gouvernance', status: 'active' },
  { command: 'guardrails', tier: 'core', category: 'gouvernance', status: 'active' },
  { command: 'hooks', tier: 'core', category: 'gouvernance', status: 'active' },
  { command: 'status', tier: 'core', category: 'observabilité', status: 'active' },
  { command: 'doctor', tier: 'core', category: 'administration', status: 'active' },
  { command: 'trace', tier: 'core', category: 'cycle-sdd', status: 'active' },
  { command: 'new', tier: 'core', category: 'cycle-sdd', status: 'active' },
  { command: 'import', tier: 'core', category: 'cycle-sdd', status: 'active' },
  { command: 'score', tier: 'core', category: 'cycle-sdd', status: 'active' },
  { command: 'template', tier: 'core', category: 'cycle-sdd', status: 'active' },
  { command: 'review', tier: 'core', category: 'qualité', status: 'active' },
  { command: 'export', tier: 'core', category: 'export-interop', status: 'active' },
  { command: 'audit', tier: 'core', category: 'qualité', status: 'active' },
  { command: 'dashboard', tier: 'core', category: 'métriques', status: 'active' },
  { command: 'emit-rules', tier: 'core', category: 'administration', status: 'active' },
  { command: 'telemetry', tier: 'core', category: 'observabilité', status: 'active' },
  { command: 'feedback', tier: 'core', category: 'observabilité', status: 'active' },
  { command: 'skills', tier: 'core', category: 'administration', status: 'active' },
  { command: 'commands', tier: 'core', category: 'administration', status: 'active' },
  { command: 'sbom', tier: 'core', category: 'sécurité-conformité', status: 'active' },
  { command: 'dpia', tier: 'core', category: 'sécurité-conformité', status: 'active' },
  { command: 'uninstall', tier: 'core', category: 'administration', status: 'active' },
  { command: 'help', tier: 'core', category: 'administration', status: 'active' },
  { command: 'version', tier: 'core', category: 'administration', status: 'active' },

  // ── extended (longue traîne supportée) ────────────────────────────────
  { command: 'repl', tier: 'extended', category: 'onboarding', status: 'active' },
  { command: 'migrate', tier: 'extended', category: 'administration', status: 'active' },
  { command: 'migrate-v2', tier: 'extended', category: 'administration', status: 'active' },
  { command: 'obsidian', tier: 'extended', category: 'export-interop', status: 'active' },
  { command: 'workspace', tier: 'extended', category: 'administration', status: 'active' },
  { command: 'ai-act', tier: 'extended', category: 'sécurité-conformité', status: 'active' },
  { command: 'verify-reproducibility', tier: 'extended', category: 'sécurité-conformité', status: 'active' },
  { command: 'docs', tier: 'extended', category: 'administration', status: 'active' },
  { command: 'bench', tier: 'extended', category: 'observabilité', status: 'active' },
  { command: 'suggest-annotations', tier: 'extended', category: 'cycle-sdd', status: 'active' },
  { command: 'suggest-tests', tier: 'extended', category: 'cycle-sdd', status: 'active' },
  { command: 'storybook', tier: 'extended', category: 'export-interop', status: 'active' },
  { command: 'cert', tier: 'extended', category: 'gouvernance', status: 'active' },
  { command: 'marketplace', tier: 'extended', category: 'export-interop', status: 'active' },
  { command: 'provenance', tier: 'extended', category: 'sécurité-conformité', status: 'active' },
  { command: 'hook-stats', tier: 'extended', category: 'observabilité', status: 'active' },
  { command: 'dinum', tier: 'extended', category: 'sécurité-conformité', status: 'active' },
  { command: 'sovereignty', tier: 'extended', category: 'sécurité-conformité', status: 'active' },
  { command: 'adrs', tier: 'extended', category: 'qualité', status: 'active' },
  { command: 'dora', tier: 'extended', category: 'métriques', status: 'active' },
  { command: 'self-update', tier: 'extended', category: 'administration', status: 'active' },
  { command: 'standup', tier: 'extended', category: 'métriques', status: 'active' },
  { command: 'brief', tier: 'extended', category: 'métriques', status: 'active' },
  { command: 'badge', tier: 'extended', category: 'observabilité', status: 'active' },
  { command: 'gitlab', tier: 'extended', category: 'intégration-vcs', status: 'active' },
  { command: 'azure', tier: 'extended', category: 'intégration-vcs', status: 'active' },
  { command: 'webhooks', tier: 'extended', category: 'intégration-vcs', status: 'active' },
  { command: 'reflect', tier: 'extended', category: 'qualité', status: 'active' },
  { command: 'negotiate', tier: 'extended', category: 'qualité', status: 'active' },
  { command: 'refactor-spec', tier: 'extended', category: 'qualité', status: 'active' },
  { command: 'spec-version', tier: 'extended', category: 'qualité', status: 'active' },
  { command: 'archive', tier: 'extended', category: 'administration', status: 'active' },
  { command: 'track', tier: 'extended', category: 'métriques', status: 'active' },
  { command: 'footprint', tier: 'extended', category: 'métriques', status: 'active' },
  { command: 'sla', tier: 'extended', category: 'métriques', status: 'active' },
  { command: 'completion', tier: 'extended', category: 'administration', status: 'active' },
  { command: 'tour', tier: 'extended', category: 'onboarding', status: 'active' },
  { command: 'pii-scan', tier: 'extended', category: 'sécurité-conformité', status: 'active' },
  { command: 'backup', tier: 'extended', category: 'administration', status: 'active' },
  { command: 'restore', tier: 'extended', category: 'administration', status: 'active' },
  { command: 'offline', tier: 'extended', category: 'administration', status: 'active' },
  { command: 'bitbucket', tier: 'extended', category: 'intégration-vcs', status: 'active' },
  { command: 'ci-template', tier: 'extended', category: 'intégration-vcs', status: 'active' },
  { command: 'github-app', tier: 'extended', category: 'intégration-vcs', status: 'active' },
  { command: 'anonymize', tier: 'extended', category: 'sécurité-conformité', status: 'active' },
  { command: 'plugin', tier: 'extended', category: 'administration', status: 'active' },
  { command: 'hooks-init', tier: 'extended', category: 'gouvernance', status: 'active' },
  { command: 'schema', tier: 'extended', category: 'administration', status: 'active' },
  { command: 'org', tier: 'extended', category: 'administration', status: 'active' },
  { command: 'rbac', tier: 'extended', category: 'sécurité-conformité', status: 'active' },
  { command: 'tutorial', tier: 'extended', category: 'onboarding', status: 'active' },

  // ── experimental (mécanismes internes / instables) ────────────────────
  { command: 'canary', tier: 'experimental', category: 'expérimental', status: 'active' },
  { command: 'memory', tier: 'experimental', category: 'expérimental', status: 'active' },
  { command: 'cycle', tier: 'experimental', category: 'expérimental', status: 'active' },
  { command: 'statusline', tier: 'experimental', category: 'observabilité', status: 'active' },
  { command: 'cross-model', tier: 'experimental', category: 'expérimental', status: 'active' },
  { command: 'hooks-config', tier: 'experimental', category: 'gouvernance', status: 'active' },
  { command: 'proportionality', tier: 'experimental', category: 'expérimental', status: 'active' },
  { command: 'sunset', tier: 'experimental', category: 'expérimental', status: 'active' },
]);

/** Tier d'une commande, ou `null` si absente du registre. */
export function tierOf(command) {
  const e = COMMANDS_REGISTRY.find((x) => x.command === command);
  return e ? e.tier : null;
}

/**
 * Entrées du registre, optionnellement filtrées par tier, triées par tier
 * (ordre TIERS) puis alphabétiquement.
 *
 * @param {string} [tier]
 * @returns {typeof COMMANDS_REGISTRY[number][]}
 */
export function listByTier(tier) {
  const base = tier ? COMMANDS_REGISTRY.filter((e) => e.tier === tier) : COMMANDS_REGISTRY.slice();
  return base.sort((a, b) =>
    TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.command.localeCompare(b.command),
  );
}

/** Modèle d'agrégat (rendu JSON stable). */
export function aggregateTiers(tier) {
  const commands = listByTier(tier);
  const tiers = { core: [], extended: [], experimental: [] };
  for (const e of commands) tiers[e.tier].push(e.command);
  return { total: commands.length, tiers, commands };
}

/**
 * Rendu de la commande `commands` — texte (défaut) ou JSON (`--json`).
 * Retourne `{ invalidTier: true }` si le filtre tier est hors énumération
 * (le dispatch transforme ça en exit 1).
 *
 * @param {{ tier?: string, json?: boolean }} [options]
 */
export function showCommands(options = {}) {
  const { tier, json = false } = options;

  if (tier && !TIERS.includes(tier)) {
    console.error(`\n  Tier inconnu : "${tier}". Tiers valides : ${TIERS.join(', ')}.\n`);
    return { invalidTier: true };
  }

  const agg = aggregateTiers(tier);

  if (json) {
    process.stdout.write(JSON.stringify(agg, null, 2) + '\n');
    return agg;
  }

  logHeader('Registre des commandes', tier ? `tier : ${tier}` : `${agg.total} commande(s) — core / extended / experimental`);
  for (const t of TIERS) {
    const entries = agg.commands.filter((e) => e.tier === t);
    if (entries.length === 0) continue;
    console.log(`\n${C.gras}  ${t}${C.reset} ${C.gris}(${entries.length})${C.reset}`);
    for (const e of entries) {
      let dep = '';
      if (e.status === 'deprecated') {
        const cible = e.deprecatedSince && e.removeIn ? ` ${e.deprecatedSince}→${e.removeIn}` : '';
        dep = ` ${C.jaune}[deprecated${cible}]${C.reset}`;
      }
      log(`${C.gris}·${C.reset}`, `${e.command.padEnd(24)} ${C.gris}${e.category}${C.reset}${dep}`);
    }
  }
  console.log('');
  return agg;
}
