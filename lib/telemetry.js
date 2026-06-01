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
