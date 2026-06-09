// AIAD SDD Mode — Cycle SDD matérialisé en graphe de Tasks (item §3.9).
//
// **Cap stratégique** : « ne jamais sauter d'étape » du cycle SDD est
// aujourd'hui une **règle textuelle**. L'analyse (§2.2, §6.2) propose de la
// rendre **exécutoire** via les Tasks natives (graphe `blockedBy`, filesystem
// auditable + crash-recoverable, multi-session). On modélise
// `Intent → Research → SPEC → Gate → Exec → Validate → Drift-Lock` comme un
// graphe linéaire où une étape **bloquée** par la précédente non terminée ne
// peut pas démarrer.
//
// **Couche d'abstraction (cf. plan §9)** : l'API Tasks du harness peut évoluer
// et n'est pas disponible hors Claude Code. Ce module encapsule donc le graphe
// dans un **fallback fichier** (`.aiad/cycle/<intent>.json`), déterministe et
// testable. Dans Claude Code, le même graphe se projette sur les Tasks natives
// (`TaskCreate` + `addBlockedBy`) ; le fichier reste le miroir crash-recoverable
// lu par `/sdd resume`.
//
// **Transitions pilotées par verdicts (lien §3.4)** : une étape ne passe
// `done` que si le verdict déterministe associé est PASS/CONDITIONAL (exit 0) ;
// FAIL (exit 1) ou JNSP (exit 2) → `blocked`. Le modèle ne décide pas seul de
// l'avancement : c'est le verdict CLI qui fait foi.
//
// **Zero-dep**.
//
// @intent INTENT-008
// @spec SPEC-008-1-cycle-graph
// @verified-by test/cycle-graph.test.js
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

/** Étapes ordonnées du cycle SDD (un graphe linéaire `blockedBy`). */
export const ETAPES = ['INTENT', 'RESEARCH', 'SPEC', 'GATE', 'EXEC', 'VALIDATE', 'DRIFT-LOCK'];

/** Statut d'une étape → marqueur visuel (cohérent avec les tranches §3.6). */
export const MARQUEURS = Object.freeze({
  done: 'x',
  'in-progress': '~',
  blocked: '!',
  todo: ' ',
});

/** Verdict déterministe associé à chaque étape (pour documentation/CLI). */
export const VERDICT_COMMANDE = Object.freeze({
  RESEARCH: 'research',
  GATE: 'gate',
  VALIDATE: 'validate',
  'DRIFT-LOCK': 'trace --fail-on-gap',
});

// ─── Construction & sérialisation ───────────────────────────────────────────

/**
 * Construit le graphe de cycle d'un Intent. L'étape INTENT est `done` (l'Intent
 * existe = déclencheur) ; les suivantes sont `todo`, chacune bloquée par la
 * précédente. Pure : aucun horodatage (l'appelant CLI peut en ajouter).
 *
 * @param {string} intentId — INTENT-NNN
 * @returns {{ intent: string, etapes: { name: string, status: string, blockedBy: string|null, note: string|null }[] }}
 */
export function construireGraphe(intentId) {
  return {
    intent: String(intentId || '').toUpperCase(),
    etapes: ETAPES.map((name, i) => ({
      name,
      status: i === 0 ? 'done' : 'todo',
      blockedBy: i === 0 ? null : ETAPES[i - 1],
      note: null,
    })),
  };
}

/** Index d'une étape (insensible à la casse). */
function indexEtape(graphe, etape) {
  const up = String(etape || '').toUpperCase();
  return graphe.etapes.findIndex((e) => e.name === up);
}

// ─── Règle de blocage (ne jamais sauter d'étape) ────────────────────────────

/**
 * Vrai si une étape peut démarrer : sa dépendante directe est `done`.
 * IF l'étape N-1 n'est pas `done`, the system SHALL empêcher le démarrage de N.
 *
 * @param {object} graphe
 * @param {string} etape
 * @returns {boolean}
 */
export function peutDemarrer(graphe, etape) {
  const i = indexEtape(graphe, etape);
  if (i < 0) return false;
  if (i === 0) return true;
  const dep = graphe.etapes[i - 1];
  return dep.status === 'done';
}

// ─── Transition pilotée par verdict ─────────────────────────────────────────

/**
 * Applique un verdict déterministe à une étape et retourne un **nouveau** graphe
 * (immuable). PASS/CONDITIONAL → `done` (CONDITIONAL annoté). FAIL/JNSP →
 * `blocked`. Refuse fail-closed si l'étape ne peut pas démarrer (prédécesseur
 * non terminé) — on ne saute pas d'étape.
 *
 * @param {object} graphe
 * @param {string} etape
 * @param {'PASS'|'CONDITIONAL'|'FAIL'|'JNSP'} verdict
 * @param {{ note?: string }} [opts]
 * @returns {{ graphe: object, applique: boolean, raison: string }}
 */
export function appliquerVerdict(graphe, etape, verdict, { note = null } = {}) {
  const i = indexEtape(graphe, etape);
  if (i < 0) return { graphe, applique: false, raison: `Étape inconnue : ${etape}.` };
  const v = String(verdict || '').toUpperCase();

  if (!peutDemarrer(graphe, etape)) {
    const dep = graphe.etapes[i - 1];
    // L'étape reste bloquée tant que la précédente n'est pas done.
    const etapes = graphe.etapes.map((e, k) => (k === i ? { ...e, status: 'blocked', note: `Bloquée par ${dep.name} (non terminée).` } : e));
    return { graphe: { ...graphe, etapes }, applique: false, raison: `Étape ${dep.name} non terminée — ${etape} ne peut pas démarrer.` };
  }

  let status;
  let noteFinale = note;
  if (v === 'PASS') status = 'done';
  else if (v === 'CONDITIONAL') { status = 'done'; noteFinale = note || 'CONDITIONAL — conditions à lever avant la suite.'; }
  else if (v === 'FAIL') { status = 'blocked'; noteFinale = note || 'Verdict FAIL — étape non franchie.'; }
  else if (v === 'JNSP') { status = 'blocked'; noteFinale = note || 'Verdict JNSP — décision humaine requise.'; }
  else return { graphe, applique: false, raison: `Verdict inconnu : ${verdict}.` };

  const etapes = graphe.etapes.map((e, k) => (k === i ? { ...e, status, note: noteFinale } : e));
  return { graphe: { ...graphe, etapes }, applique: true, raison: `${etape} → ${status} (${v}).` };
}

// ─── Reprise (resume natif) ─────────────────────────────────────────────────

/**
 * Première étape actionnable : la première non-`done` dont la précédente est
 * `done`. Si elle est `blocked`, on la renvoie avec sa raison (à débloquer).
 *
 * @param {object} graphe
 * @returns {{ name: string, status: string, note: string|null }|null}
 */
export function prochaineEtape(graphe) {
  for (let i = 0; i < graphe.etapes.length; i++) {
    const e = graphe.etapes[i];
    if (e.status === 'done') continue;
    const depOk = i === 0 || graphe.etapes[i - 1].status === 'done';
    if (depOk) return { name: e.name, status: e.status, note: e.note };
    return null; // bloqué en amont — rien d'actionnable
  }
  return null; // tout est done
}

/** Vrai si toutes les étapes sont `done`. */
export function cycleComplet(graphe) {
  return graphe.etapes.every((e) => e.status === 'done');
}

// ─── Rendu visuel ───────────────────────────────────────────────────────────

/**
 * Rend le graphe en liste à marqueurs `[x]/[~]/[ ]/[!]`.
 *
 * @param {object} graphe
 * @returns {string}
 */
export function rendreGraphe(graphe) {
  const lignes = [`  Cycle ${graphe.intent}`];
  for (const e of graphe.etapes) {
    const mark = MARQUEURS[e.status] ?? '?';
    lignes.push(`    [${mark}] ${e.name}${e.note ? `  — ${e.note}` : ''}`);
  }
  return lignes.join('\n');
}

// ─── Persistance (fallback fichier crash-recoverable) ───────────────────────

/**
 * Chemin du fichier graphe d'un Intent.
 *
 * @param {string} racine
 * @param {string} intentId
 * @returns {string}
 */
export function cheminGraphe(racine, intentId) {
  return join(racine, '.aiad', 'cycle', `${String(intentId || '').toUpperCase()}.json`);
}

/**
 * Charge le graphe persistant d'un Intent (ou `null` si absent/illisible).
 *
 * @param {string} racine
 * @param {string} intentId
 * @returns {object|null}
 */
export function chargerGraphe(racine, intentId) {
  const p = cheminGraphe(racine, intentId);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
}

/**
 * Persiste un graphe (crée `.aiad/cycle/` au besoin).
 *
 * @param {string} racine
 * @param {object} graphe
 * @returns {string} chemin écrit
 */
export function sauverGraphe(racine, graphe) {
  const p = cheminGraphe(racine, graphe.intent);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(graphe, null, 2) + '\n', 'utf-8');
  return p;
}

// ─── Aliases EN ─────────────────────────────────────────────────────────────

export {
  construireGraphe as buildGraph,
  peutDemarrer as canStart,
  appliquerVerdict as applyVerdict,
  prochaineEtape as nextStep,
  cycleComplet as cycleComplete,
  rendreGraphe as renderGraph,
  cheminGraphe as graphPath,
  chargerGraphe as loadGraph,
  sauverGraphe as saveGraph,
};
