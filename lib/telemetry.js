// AIAD SDD Mode — Télémétrie opt-in anonymisée.
//
// Conformité RGPD stricte (ART. 6 §1 a — consentement explicite) :
//   - **Désactivée par défaut**. L'utilisateur active explicitement via
//     `aiad-sdd telemetry opt-in`.
//   - **Anonymisée** : UUID local généré sur la machine, jamais associé à
//     l'identité utilisateur, ne traverse pas plusieurs commandes.
//   - **Donnée minimale** : nom de commande, version package, runtime
//     ciblé. Aucun chemin de projet, aucune IP côté client (le serveur
//     reçoit l'IP mais s'engage à ne pas la logger), aucun identifiant
//     personnel.
//   - **Fail-safe** : si l'envoi échoue, la commande continue. La
//     télémétrie ne dégrade jamais l'UX.
//   - **Réversible** : `aiad-sdd telemetry opt-out` désactive et supprime
//     l'UUID local.
//
// État stocké dans `~/.aiad-sdd/telemetry.json` :
//   { optIn: boolean, anonymousId: "uuid-v4", since: "ISO-8601" }
//
// Endpoint configurable via env `AIAD_TELEMETRY_URL`. Sans endpoint
// configuré, opt-in = trace locale uniquement (file `~/.aiad-sdd/events.jsonl`)
// — utile en self-hosted ou pour analyse locale.
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { C, log, logHeader } from './term.js';

const STATE_DIR = join(homedir(), '.aiad-sdd');
const STATE_FILE = join(STATE_DIR, 'telemetry.json');
const LOCAL_LOG = join(STATE_DIR, 'events.jsonl');

const DEFAULT_STATE = { optIn: false, anonymousId: null, since: null };

function ensureStateDir() {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
}

export function readState() {
  if (!existsSync(STATE_FILE)) return { ...DEFAULT_STATE };
  try {
    const data = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    return { ...DEFAULT_STATE, ...data };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeState(state) {
  ensureStateDir();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

export function isOptedIn() {
  return readState().optIn === true;
}

export function getAnonymousId() {
  return readState().anonymousId;
}

export async function optIn() {
  const current = readState();
  const next = {
    optIn: true,
    anonymousId: current.anonymousId || randomUUID(),
    since: new Date().toISOString(),
  };
  writeState(next);

  logHeader('Télémétrie AIAD — opt-in', 'Merci de contribuer aux décisions produit.');
  log(`${C.vert}✓${C.reset}`, `Activée. ID anonyme local : ${C.gris}${next.anonymousId}${C.reset}`);
  console.log(`
${C.gras}  Données collectées${C.reset} : nom de commande, version, runtime ciblé. Pas de chemin projet, pas d'IP, pas d'identifiant personnel.
${C.gras}  Endpoint${C.reset} : ${process.env.AIAD_TELEMETRY_URL || `${C.gris}aucun configuré → trace locale uniquement (${LOCAL_LOG})${C.reset}`}
${C.gras}  Réversible${C.reset} : ${C.cyan}aiad-sdd telemetry opt-out${C.reset}

${C.gris}  Conformité RGPD : Article 6 §1 a (consentement explicite). Tu peux retirer ton consentement à tout moment.${C.reset}
`);
  return next;
}

export async function optOut() {
  if (!existsSync(STATE_FILE)) {
    logHeader('Télémétrie AIAD — opt-out', 'Aucun état préalable trouvé.');
    return DEFAULT_STATE;
  }
  // Supprime l'état + le log local — RGPD : droit à l'effacement.
  try { unlinkSync(STATE_FILE); } catch { /* ignore */ }
  try { unlinkSync(LOCAL_LOG); } catch { /* ignore */ }
  logHeader('Télémétrie AIAD — opt-out', 'État local supprimé (UUID anonyme + log).');
  log(`${C.vert}✓${C.reset}`, 'Tu peux ré-activer à tout moment via `aiad-sdd telemetry opt-in`.');
  console.log('');
  return DEFAULT_STATE;
}

export async function showStatus(options = {}) {
  const { json = false } = options;
  const state = readState();
  if (json) {
    process.stdout.write(JSON.stringify({
      ...state,
      endpoint: process.env.AIAD_TELEMETRY_URL || null,
      localLog: state.optIn ? LOCAL_LOG : null,
    }, null, 2) + '\n');
    return state;
  }
  logHeader('Télémétrie AIAD — état', state.optIn ? 'Activée' : 'Désactivée (défaut)');
  if (state.optIn) {
    log(`${C.vert}✓${C.reset}`, `Opt-in depuis ${C.gris}${state.since}${C.reset}`);
    log(' ', `ID anonyme : ${C.gris}${state.anonymousId}${C.reset}`);
    log(' ', `Endpoint : ${process.env.AIAD_TELEMETRY_URL || `${C.gris}local uniquement (${LOCAL_LOG})${C.reset}`}`);
    console.log(`\n  ${C.gris}Désactiver : ${C.reset}${C.cyan}aiad-sdd telemetry opt-out${C.reset}\n`);
  } else {
    log(`${C.gris}-${C.reset}`, 'Aucune donnée envoyée. Aucun ID local stocké.');
    console.log(`\n  ${C.gris}Activer : ${C.reset}${C.cyan}aiad-sdd telemetry opt-in${C.reset}\n`);
  }
  return state;
}

/**
 * Enregistre un événement de télémétrie. Silencieux si opt-out.
 * Fail-safe : ne lève jamais — la télémétrie ne casse pas la commande.
 *
 * @param {string} event — nom court (ex: 'command_run')
 * @param {Record<string, unknown>} payload — données minimales
 */
export function track(event, payload = {}) {
  try {
    const state = readState();
    if (!state.optIn) return;

    const record = {
      event,
      anonymousId: state.anonymousId,
      timestamp: new Date().toISOString(),
      ...payload,
    };

    // 1. Trace locale toujours (utile en self-hosted / debug local).
    ensureStateDir();
    appendFileSync(LOCAL_LOG, JSON.stringify(record) + '\n', 'utf-8');

    // 2. Envoi remote si endpoint configuré. fire-and-forget pour ne pas
    //    bloquer la commande utilisateur.
    const url = process.env.AIAD_TELEMETRY_URL;
    if (url) {
      // fetch est natif depuis Node 18. AbortController limite le délai.
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 1500);
      fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(record),
        signal: ctrl.signal,
      }).catch(() => { /* fail-safe : on ignore tout, même les erreurs réseau */ });
    }
  } catch {
    // Garde silencieuse absolue — un bug télémétrie ne doit jamais remonter.
  }
}

// ─── Agrégat d'usage per-command (lecture locale, opt-in) ───────────────────
//
// @intent INTENT-015
// @spec SPEC-015-1-telemetrie-usage
// @verified-by test/telemetry-usage.test.js
// @governance AIAD-RGPD
//
// Lit le log local déjà collecté (`events.jsonl`) et le résume par commande.
// Aucune nouvelle collecte, aucun accès réseau : c'est une vue en lecture des
// données déjà consenties (RGPD — pas de re-collecte, pas de PII).

// Part cumulée (en %) sous laquelle la queue des commandes est classée
// « longue-traîne ». Sobriété : seuil fixe, pas de configuration superflue.
const LONGUE_TRAINE_SEUIL_PCT = 20;

/**
 * Lit les événements `command_run` du log local.
 * Fail-safe : ignore les lignes JSON invalides ou sans `command`. Renvoie `[]`
 * si la télémétrie est désactivée ou si le fichier n'existe pas encore.
 *
 * @returns {Array<{ command: string, timestamp: string }>}
 */
export function readEvents() {
  if (!isOptedIn()) return [];
  if (!existsSync(LOCAL_LOG)) return [];
  let brut;
  try {
    brut = readFileSync(LOCAL_LOG, 'utf-8');
  } catch {
    return [];
  }
  const events = [];
  for (const ligne of brut.split('\n')) {
    const t = ligne.trim();
    if (!t) continue;
    let rec;
    try {
      rec = JSON.parse(t);
    } catch {
      continue; // CA-006 : ligne corrompue ignorée, on continue.
    }
    if (!rec || rec.event !== 'command_run') continue;
    if (typeof rec.command !== 'string' || rec.command.length === 0) continue;
    events.push({ command: rec.command, timestamp: rec.timestamp || null });
  }
  return events;
}

/**
 * Agrège une liste d'événements en classement per-command.
 * Tri décroissant par count, tie-break alphabétique déterministe (CA-007).
 * Classe « longue-traîne » la queue cumulant ≤ 20 % (CA-004), « core » sinon.
 *
 * @param {Array<{ command: string, timestamp: string }>} events
 * @returns {{
 *   total: number, since: string|null, until: string|null,
 *   commands: Array<{ rank: number, command: string, count: number,
 *                     share: number, class: 'core'|'longue-traîne' }>
 * }}
 */
export function aggregateUsage(events = []) {
  const total = events.length;
  const counts = new Map();
  let since = null;
  let until = null;
  for (const e of events) {
    counts.set(e.command, (counts.get(e.command) || 0) + 1);
    if (e.timestamp) {
      if (since === null || e.timestamp < since) since = e.timestamp;
      if (until === null || e.timestamp > until) until = e.timestamp;
    }
  }

  // Tri décroissant par count, puis alphabétique (déterministe).
  const tries = [...counts.entries()].sort((a, b) =>
    b[1] - a[1] || a[0].localeCompare(b[0]),
  );

  // Classification longue-traîne : suffixe maximal dont la part cumulée ≤ seuil.
  const classes = new Array(tries.length).fill('core');
  let cumQueue = 0;
  for (let i = tries.length - 1; i >= 0; i--) {
    const partPct = total === 0 ? 0 : (tries[i][1] / total) * 100;
    if (cumQueue + partPct <= LONGUE_TRAINE_SEUIL_PCT) {
      classes[i] = 'longue-traîne';
      cumQueue += partPct;
    } else {
      break;
    }
  }

  const commands = tries.map(([command, count], i) => ({
    rank: i + 1,
    command,
    count,
    share: total === 0 ? 0 : Math.round((count / total) * 1000) / 10,
    class: classes[i],
  }));

  return { total, since, until, commands };
}

/**
 * Rendu de l'agrégat d'usage — texte (défaut) ou JSON (`--json`).
 * Exit code 0 sur rendu réussi, y compris jeu de données vide (CA-005/CA-008).
 *
 * @param {{ json?: boolean }} [options]
 */
export async function showUsage(options = {}) {
  const { json = false } = options;
  const events = readEvents();
  const agg = aggregateUsage(events);

  if (json) {
    // CA-003 : exactement un objet JSON sur stdout, rien d'autre.
    process.stdout.write(JSON.stringify(agg, null, 2) + '\n');
    return agg;
  }

  if (agg.total === 0) {
    // CA-005 : opt-out / log absent / vide → message clair, exit 0.
    logHeader('Usage des commandes', 'Aucune donnée d\'usage disponible');
    if (!isOptedIn()) {
      log(`${C.gris}-${C.reset}`, `Télémétrie désactivée. Activer : ${C.cyan}aiad-sdd telemetry opt-in${C.reset}`);
    } else {
      log(`${C.gris}-${C.reset}`, 'Aucun événement collecté pour le moment.');
    }
    console.log('');
    return agg;
  }

  logHeader('Usage des commandes', `${agg.total} exécution(s) tracée(s) localement`);
  for (const c of agg.commands) {
    const tag = c.class === 'longue-traîne'
      ? `${C.jaune}longue-traîne${C.reset}`
      : `${C.vert}core${C.reset}`;
    log(
      `${C.gris}#${c.rank}${C.reset}`,
      `${c.command.padEnd(20)} ${String(c.count).padStart(5)}  ${String(c.share).padStart(5)}%  ${tag}`,
    );
  }
  const fenetre = agg.since && agg.until
    ? `${C.gris}fenêtre : ${agg.since} → ${agg.until}${C.reset}`
    : '';
  console.log(`\n  ${C.gris}Total : ${agg.total} événement(s).${C.reset} ${fenetre}\n`);
  return agg;
}
