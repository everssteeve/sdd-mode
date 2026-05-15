// AIAD SDD Mode — Sandbox d'exécution du hook pre-commit (item #91).
//
// **Cap stratégique** : limiter le **blast radius** du hook pre-commit.
// Un hook qui bloque ou prend trop de temps casse le flow de l'équipe ;
// un hook qui modifie des fichiers hors scope ou émet des requêtes réseau
// est un risque supply-chain.
//
// **Garde-fous** :
//   1. **Timeout strict** : `AIAD_HOOK_TIMEOUT` (défaut 30s, plafond 120s)
//   2. **Scope fs** : seuls `.aiad/**` + staged files autorisés en écriture
//   3. **Network off** : `HTTPS_PROXY=`, `HTTP_PROXY=`, `NO_PROXY=*`
//   4. **Métriques** : append JSONL à `.aiad/metrics/hook-runs.jsonl`
//
// **Le hook bash écrit directement le JSONL** (zero-dep, pas d'invocation
// Node lors d'un commit). Ce module Node est utilisé pour :
//   - Analyser les métriques (`aiad-sdd hook-stats`)
//   - Détecter les anomalies (timeouts, p95 > seuil, fuites scope)
//   - Vérifier le scope post-exécution
//
// Documentation : https://aiad.ovh/hook-sandbox

import { existsSync, readFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildMeta } from './meta.js';
import { C, logHeader } from './term.js';

const METRICS_PATH = '.aiad/metrics/hook-runs.jsonl';
const TIMEOUT_DEFAUT_MS = 30000;
const TIMEOUT_PLAFOND_MS = 120000;
const SEUIL_P95_MS = 5000; // au-delà : warning santé

// ─── Configuration timeout ──────────────────────────────────────────────────

/**
 * Résout le timeout effectif depuis l'environnement.
 *
 * Format accepté : entier en secondes (ex: "30", "60"). Plafonné à 120s
 * pour éviter qu'une mauvaise config bloque indéfiniment le commit.
 *
 * @param {string|undefined} envValue
 * @returns {number} timeout en millisecondes
 */
export function resoudreTimeout(envValue) {
  if (envValue === undefined || envValue === null || envValue === '') {
    return TIMEOUT_DEFAUT_MS;
  }
  const n = parseInt(envValue, 10);
  if (Number.isNaN(n) || n <= 0) return TIMEOUT_DEFAUT_MS;
  const ms = n * 1000;
  return Math.min(ms, TIMEOUT_PLAFOND_MS);
}

// ─── Vérification scope ─────────────────────────────────────────────────────

/**
 * Détermine si un fichier modifié est dans le scope autorisé du hook.
 *
 * Scope autorisé :
 *   - tout chemin sous `.aiad/`
 *   - les fichiers stagés du commit (passés en `staged`)
 *
 * @param {string} fichier — chemin relatif depuis racine
 * @param {string[]} staged — fichiers stagés
 * @returns {boolean}
 */
export function dansScope(fichier, staged) {
  if (typeof fichier !== 'string' || fichier.length === 0) return false;
  if (fichier.startsWith('.aiad/') || fichier === '.aiad') return true;
  return Array.isArray(staged) && staged.includes(fichier);
}

/**
 * Compare deux listes de fichiers modifiés (avant/après hook) et retourne
 * la liste des modifications hors scope.
 *
 * @param {string[]} avant — fichiers modifiés selon git status avant hook
 * @param {string[]} apres — fichiers modifiés après hook
 * @param {string[]} staged
 * @returns {string[]} fichiers nouvellement modifiés et hors scope
 */
export function fuitesScope(avant, apres, staged) {
  const setAvant = new Set(avant);
  const nouveaux = apres.filter((f) => !setAvant.has(f));
  return nouveaux.filter((f) => !dansScope(f, staged));
}

// ─── Inventaire git ─────────────────────────────────────────────────────────

/**
 * Liste les fichiers modifiés / non-stagés / untracked via git status.
 *
 * @param {string} racine
 * @returns {string[]}
 */
export function gitStatusFichiers(racine) {
  const r = spawnSync('git', ['status', '--porcelain=v1'], {
    cwd: racine, encoding: 'utf-8',
  });
  if (r.status !== 0) return [];
  return r.stdout.split('\n')
    .filter((l) => l.length >= 4)
    .map((l) => l.slice(3).split(' -> ').pop().trim())
    .filter(Boolean);
}

// ─── Métriques JSONL ────────────────────────────────────────────────────────

/**
 * Construit un événement de métriques hook (utilisé par les tests Node ;
 * le hook bash écrit directement le JSONL avec un format identique).
 *
 * @param {{ startedAt: string, durationMs: number, exitCode: number, timedOut?: boolean, scopeLeaks?: string[], filesChanged?: number, hostname?: string }} input
 */
export function construireEvenementHook(input) {
  if (typeof input.startedAt !== 'string') {
    throw new Error('startedAt requis (ISO 8601).');
  }
  if (typeof input.durationMs !== 'number' || input.durationMs < 0) {
    throw new Error('durationMs requis (entier ≥ 0).');
  }
  if (typeof input.exitCode !== 'number') {
    throw new Error('exitCode requis (entier).');
  }
  return {
    startedAt: input.startedAt,
    durationMs: Math.round(input.durationMs),
    exitCode: input.exitCode,
    timedOut: Boolean(input.timedOut),
    scopeLeaks: Array.isArray(input.scopeLeaks) ? input.scopeLeaks : [],
    filesChanged: input.filesChanged ?? 0,
    hostname: input.hostname || null,
  };
}

/**
 * Append un événement métriques au log.
 */
export function loggerMetriques(racine, evt) {
  const path = join(racine, METRICS_PATH);
  if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(evt) + '\n', 'utf-8');
}

/**
 * Lit l'historique des exécutions hook.
 */
export function lireHistorique(racine) {
  const path = join(racine, METRICS_PATH);
  if (!existsSync(path)) return [];
  const out = [];
  for (const ligne of readFileSync(path, 'utf-8').split('\n').filter(Boolean)) {
    try { out.push(JSON.parse(ligne)); }
    catch { /* corrompu, ignoré */ }
  }
  return out;
}

// ─── Statistiques ───────────────────────────────────────────────────────────

/**
 * Calcule des stats sur l'historique : count, p50/p95 durations, ratio
 * exits non-zéro, ratio timeouts, fuites scope cumulées.
 */
export function calculerStats(events) {
  if (events.length === 0) {
    return { count: 0, p50: 0, p95: 0, max: 0, ratioFail: 0, timeouts: 0, scopeLeaks: 0, sante: 'inconnue' };
  }
  const durations = events.map((e) => e.durationMs).sort((a, b) => a - b);
  const p = (q) => durations[Math.min(durations.length - 1, Math.floor(durations.length * q))];
  const fails = events.filter((e) => e.exitCode !== 0).length;
  const timeouts = events.filter((e) => e.timedOut).length;
  const leaks = events.reduce((sum, e) => sum + (e.scopeLeaks?.length || 0), 0);
  const p95 = p(0.95);
  const sante = (timeouts > 0 || leaks > 0)
    ? 'critique'
    : (p95 > SEUIL_P95_MS || fails / events.length > 0.1)
    ? 'attention'
    : 'verte';
  return {
    count: events.length,
    p50: p(0.5),
    p95,
    max: durations[durations.length - 1],
    ratioFail: events.length > 0 ? fails / events.length : 0,
    timeouts,
    scopeLeaks: leaks,
    sante,
  };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

/**
 * Affiche les statistiques d'exécution du hook.
 */
export function afficherStats(racine, options = {}) {
  const events = lireHistorique(racine);
  const stats = calculerStats(events);

  if (options.json) {
    // (#266) _meta cohérent avec écosystème AIAD (#258).
    process.stdout.write(JSON.stringify({
      _meta: buildMeta({ schema: 'aiad-sdd-hook-stats' }),
      stats,
      recent: events.slice(-10),
    }, null, 2) + '\n');
    return stats;
  }

  logHeader(
    'AIAD SDD — Hook pre-commit · sandbox & santé',
    `${stats.count} exécution(s) enregistrées dans ${METRICS_PATH}`,
  );

  if (stats.count === 0) {
    console.log(`  ${C.gris}~ Aucune exécution. Le hook journalisera ses runs ici dès le prochain commit.${C.reset}\n`);
    return stats;
  }

  const couleurSante = stats.sante === 'verte' ? C.vert : stats.sante === 'attention' ? C.jaune : C.rouge;
  console.log(`  Santé        : ${couleurSante}${stats.sante.toUpperCase()}${C.reset}`);
  console.log(`  Latence p50  : ${stats.p50}ms`);
  console.log(`  Latence p95  : ${stats.p95}ms${stats.p95 > SEUIL_P95_MS ? ` ${C.jaune}(> ${SEUIL_P95_MS}ms recommandé)${C.reset}` : ''}`);
  console.log(`  Latence max  : ${stats.max}ms`);
  console.log(`  Ratio fail   : ${(stats.ratioFail * 100).toFixed(1)}%`);
  console.log(`  Timeouts     : ${stats.timeouts}${stats.timeouts > 0 ? ` ${C.rouge}⚠${C.reset}` : ''}`);
  console.log(`  Fuites scope : ${stats.scopeLeaks}${stats.scopeLeaks > 0 ? ` ${C.rouge}⚠${C.reset}` : ''}`);
  console.log('');

  if (stats.scopeLeaks > 0) {
    console.log(`  ${C.rouge}⚠ Le hook a modifié des fichiers hors .aiad/ + staged. Inspecte ${C.cyan}${METRICS_PATH}${C.reset}.`);
    console.log('');
  }

  return stats;
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  resoudreTimeout as resolveTimeout,
  dansScope as inScope,
  fuitesScope as scopeLeaks,
  gitStatusFichiers as gitStatusFiles,
  construireEvenementHook as buildHookEvent,
  loggerMetriques as logMetrics,
  lireHistorique as readHistory,
  calculerStats as computeStats,
  afficherStats as showStats,
};

export const CONSTANTS = {
  METRICS_PATH,
  TIMEOUT_DEFAUT_MS,
  TIMEOUT_PLAFOND_MS,
  SEUIL_P95_MS,
};
