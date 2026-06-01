// AIAD SDD Mode — Mode air-gapped strict (item #112).
//
// **Cap stratégique** : pour les environnements DevSecOps haute sécurité
// (défense, secret médical, OIV/OSE NIS2, réseaux classifiés), AIAD doit
// pouvoir **garantir techniquement** qu'aucune donnée projet ne sort de
// la machine. C'est le rôle de `AIAD_OFFLINE=1` ou `.aiad/config.yml`
// avec `offline: true` — toute requête HTTP sortante non-locale est
// bloquée avec une erreur explicite ET journalisée dans
// `.aiad/audit/offline-attempts.jsonl` (audit trail pour les SOC).
//
// **Hôtes considérés comme locaux** (autorisés en mode offline) :
//   - `localhost`, `127.0.0.1`, `::1`, `0.0.0.0`
//   - réseaux RFC 1918 : `10.x`, `172.16-31.x`, `192.168.x`
//   - réseaux IPv6 ULA : `fc00::/7`, `fd00::/8`
//   - domaines `.local` (mDNS), `.internal`, `.localhost`
//   - explicitement listés dans `AIAD_OFFLINE_ALLOWLIST` (CSV)
//
// **Hooks AIAD impactés** : webhooks (#98), telemetry (#23), score/reflect/
// negotiate/refactor-spec (Ollama via #64), gitlab (#95), azure (#96),
// confluence (#97), provenance Sigstore (#90 commande cosign).
//
// **Activation transparente** : le bin AIAD wrappe `globalThis.fetch`
// au démarrage si `AIAD_OFFLINE=1` est positionné. Les modules qui
// utilisent un `fetch` injecté pour tests ne sont pas impactés
// (l'injection reste prioritaire).
//
// Documentation : https://aiad.ovh/offline

import { existsSync, readFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { C, logHeader } from './term.js';

const LOG_PATH = '.aiad/audit/offline-attempts.jsonl';

// ─── Détection mode offline ────────────────────────────────────────────────

/**
 * `true` si AIAD_OFFLINE=1 / true / yes / on, ou si .aiad/config.yml
 * contient `offline: true`.
 *
 * @param {string} [racine] — pour la lecture config (cwd par défaut)
 */
export function estOffline(racine) {
  const env = (process.env.AIAD_OFFLINE || '').toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(env)) return true;
  if (env === '0' || env === 'false' || env === 'off') return false;
  const r = racine || process.cwd();
  const configPath = join(r, '.aiad', 'config.yml');
  if (!existsSync(configPath)) return false;
  try {
    const c = readFileSync(configPath, 'utf-8');
    const m = c.match(/^\s*offline\s*:\s*(true|yes|on|1)\s*$/im);
    return Boolean(m);
  } catch { return false; }
}

// ─── Allowlist ─────────────────────────────────────────────────────────────

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]']);
const TLD_INTERNES = ['.local', '.internal', '.localhost', '.intra', '.lan'];

/**
 * Détermine si une URL pointe vers un hôte local / réseau privé.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function urlEstLocale(url) {
  if (typeof url !== 'string' || url.length === 0) return false;
  let parsed;
  try { parsed = new URL(url); }
  catch { return false; }
  const host = parsed.hostname.toLowerCase();

  // Hôtes explicitement locaux
  if (LOCAL_HOSTS.has(host)) return true;

  // TLD internes
  for (const tld of TLD_INTERNES) {
    if (host === tld.slice(1) || host.endsWith(tld)) return true;
  }

  // IPv4 RFC 1918
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1], 10), parseInt(ipv4[2], 10)];
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
  }

  // IPv6 ULA fc00::/7 et fd00::/8 (préfixe 'fc'/'fd' simplifié)
  if (/^\[?(fc|fd)[0-9a-f]{0,2}:/i.test(host)) return true;

  // Allowlist user
  const allow = (process.env.AIAD_OFFLINE_ALLOWLIST || '').split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const a of allow) {
    if (host === a || host.endsWith('.' + a)) return true;
  }

  return false;
}

// ─── Journalisation ────────────────────────────────────────────────────────

/**
 * Append une tentative bloquée au log audit.
 */
export function loggerTentative(racine, evt) {
  try {
    const path = join(racine, LOG_PATH);
    if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
    const ligne = JSON.stringify({
      ts: new Date().toISOString(),
      ...evt,
    }) + '\n';
    appendFileSync(path, ligne, 'utf-8');
  } catch { /* ne casse jamais le pipeline */ }
}

/**
 * Lit toutes les tentatives bloquées.
 */
export function lireLog(racine) {
  const path = join(racine, LOG_PATH);
  if (!existsSync(path)) return [];
  const lignes = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  const out = [];
  for (const l of lignes) {
    try { out.push(JSON.parse(l)); } catch { /* corrompu */ }
  }
  return out;
}

// ─── Garde fetch ───────────────────────────────────────────────────────────

/**
 * Évalue une URL et lève une erreur si bloquée en mode offline.
 *
 * @param {string} url
 * @param {{ racine?: string, contexte?: string }} [options]
 * @returns {void}
 * @throws {Error}
 */
export function verifierUrl(url, options = {}) {
  const racine = options.racine || process.cwd();
  if (!estOffline(racine)) return;
  if (urlEstLocale(url)) return;
  loggerTentative(racine, {
    url,
    contexte: options.contexte || 'fetch',
    bloque: true,
  });
  throw new Error(
    `AIAD_OFFLINE=1 — requête HTTP bloquée vers "${url}" (contexte: ${options.contexte || 'fetch'}).\n`
    + '  Pour autoriser : retirer AIAD_OFFLINE ou whitelister via AIAD_OFFLINE_ALLOWLIST="host1,host2".',
  );
}

/**
 * Wrappe un fetch (typiquement `globalThis.fetch`) avec garde offline.
 *
 * Retourne une nouvelle fonction fetch qui bloque les URLs non-locales
 * en mode offline. Idéal pour patching global au démarrage du CLI.
 *
 * @param {Function} originalFetch
 * @param {{ racine?: string }} [options]
 * @returns {Function}
 */
export function wrapperFetch(originalFetch, options = {}) {
  if (typeof originalFetch !== 'function') {
    throw new Error('fetch original requis (fonction).');
  }
  const racine = options.racine || process.cwd();
  return async function fetchOfflineGuarded(input, init) {
    const url = typeof input === 'string' ? input
      : (input && input.url) || String(input);
    verifierUrl(url, { racine, contexte: 'fetch' });
    return originalFetch(input, init);
  };
}

/**
 * Installe le wrapper sur globalThis.fetch (idempotent — ne wrappe qu'une fois).
 */
export function installerGarde(racine) {
  if (!estOffline(racine)) return false;
  if (typeof globalThis.fetch !== 'function') return false;
  if (globalThis.fetch.__aiadOfflineWrapped) return true;
  const original = globalThis.fetch.bind(globalThis);
  const wrapped = wrapperFetch(original, { racine });
  wrapped.__aiadOfflineWrapped = true;
  globalThis.fetch = wrapped;
  return true;
}

// ─── CLI ────────────────────────────────────────────────────────────────────

/**
 * Affiche le statut offline + dernières tentatives.
 */
export function status(racine, options = {}) {
  const offline = estOffline(racine);
  const log = lireLog(racine);
  if (options.json) {
    process.stdout.write(JSON.stringify({
      offline,
      env: process.env.AIAD_OFFLINE || null,
      allowlist: (process.env.AIAD_OFFLINE_ALLOWLIST || '').split(',').filter(Boolean),
      attempts: log.length,
      recent: log.slice(-10),
    }, null, 2) + '\n');
    return { offline, attempts: log.length };
  }
  logHeader(
    'AIAD SDD — Mode air-gapped',
    offline ? `${C.vert}● ACTIF${C.reset} — toutes requêtes HTTP non-locales bloquées` : `${C.gris}○ INACTIF${C.reset} — requêtes autorisées`,
  );
  if (offline) {
    const allow = (process.env.AIAD_OFFLINE_ALLOWLIST || '').split(',').filter(Boolean);
    if (allow.length > 0) {
      console.log(`  Allowlist : ${allow.join(', ')}`);
    }
    console.log(`  Tentatives bloquées : ${log.length}`);
    if (log.length > 0) {
      console.log(`  ${C.gras}Dernières tentatives :${C.reset}`);
      for (const e of log.slice(-5)) {
        console.log(`    ${C.rouge}✗${C.reset} ${e.ts.slice(0, 19).replace('T', ' ')}  ${e.url}  ${C.gris}[${e.contexte}]${C.reset}`);
      }
    }
  } else {
    console.log(`  Active via :`);
    console.log(`    export AIAD_OFFLINE=1`);
    console.log(`    ou .aiad/config.yml: offline: true`);
  }
  console.log('');
  return { offline, attempts: log.length };
}

/**
 * Affiche le log des tentatives bloquées.
 */
export function afficherLog(racine, options = {}) {
  const log = lireLog(racine);
  if (options.json) {
    process.stdout.write(JSON.stringify({ total: log.length, attempts: log }, null, 2) + '\n');
    return log;
  }
  logHeader('AIAD SDD — Tentatives bloquées', `${log.length} entrée(s) dans ${LOG_PATH}`);
  if (log.length === 0) {
    console.log(`  ${C.gris}~ Aucune tentative loguée.${C.reset}\n`);
    return log;
  }
  for (const e of log) {
    console.log(`  ${C.rouge}✗${C.reset} ${e.ts.slice(0, 19).replace('T', ' ')}  ${e.url}  ${C.gris}[${e.contexte}]${C.reset}`);
  }
  console.log('');
  return log;
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  estOffline as isOffline,
  urlEstLocale as urlIsLocal,
  verifierUrl as verifyUrl,
  wrapperFetch as wrapFetch,
  installerGarde as installGuard,
  lireLog as readLog,
  loggerTentative as logAttempt,
  status as showStatus,
  afficherLog as showLog,
};

export const CONSTANTS = {
  LOG_PATH,
  LOCAL_HOSTS: [...LOCAL_HOSTS],
  TLD_INTERNES,
};
