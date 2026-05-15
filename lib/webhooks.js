// AIAD SDD Mode — Webhooks sortants signés HMAC (item #98).
//
// **Cas d'usage** : permettre à un projet AIAD de notifier des systèmes
// tiers (Slack, Linear, Jira, observabilité, audit légal) lorsqu'un
// événement structurant survient :
//
//   - `intent.created`     — nouvel Intent ajouté à `.aiad/intents/`
//   - `spec.validated`     — SPEC qui passe la Gate (SQS ≥ 4/5)
//   - `governance.veto`    — un agent Tier 1 lève un veto
//   - `audit.violation`    — la chaîne d'audit (item #89) détecte un tampering
//
// **Format payload** : JSON minimaliste, vérifiable par signature HMAC
// SHA-256 (header `X-AIAD-Signature: sha256=<hex>` style GitHub Webhooks).
// L'horodatage et le `id` (UUID v4 zero-dep) sont posés à l'émission.
//
// **Configuration** : `.aiad/webhooks.json` — schéma simple :
//   {
//     "subscriptions": [
//       {
//         "url": "https://hooks.slack.com/...",
//         "events": ["governance.veto", "audit.violation"],
//         "secret": "$WEBHOOK_SECRET",       // env var ou chaîne directe
//         "headers": { "X-Custom": "..." }   // optionnel
//       }
//     ]
//   }
//
// **Sécurité** : tous les secrets supportent l'expansion `$ENV_VAR`.
// Échec gracieux (ne casse jamais le pipeline AIAD principal) ; les
// erreurs sont loguées dans `.aiad/metrics/webhooks-failures.jsonl`
// pour rejeu manuel.
//
// Documentation : https://aiad.ovh/webhooks

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHmac, randomBytes } from 'node:crypto';

const TIMEOUT_MS = 5000;
const MAX_RETRIES = 2;
const EVENTS_VALIDES = [
  'intent.created',
  'intent.updated',
  'intent.deleted',
  'spec.validated',
  'spec.created',
  'spec.updated',
  'governance.veto',
  'governance.warning',
  'audit.violation',
  'drift.detected',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Génère un UUID v4 zero-dep via crypto.randomBytes.
 */
export function uuidV4() {
  const b = randomBytes(16);
  // RFC 4122 §4.4 : version 4 + variant bits
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * Étend les références `$ENV_VAR` dans une chaîne de secret.
 * Renvoie la valeur littérale si pas de `$` initial.
 */
export function resoudreSecret(s) {
  if (typeof s !== 'string' || !s.startsWith('$')) return s || '';
  const nom = s.slice(1);
  return process.env[nom] || '';
}

/**
 * Calcule la signature HMAC d'un payload JSON.
 *
 * @param {string|object} payload
 * @param {string} secret
 * @returns {string} `sha256=<hex>`
 */
export function signerPayload(payload, secret) {
  if (!secret) throw new Error('Secret HMAC requis pour signer un webhook.');
  const corps = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return 'sha256=' + createHmac('sha256', secret).update(corps).digest('hex');
}

/**
 * Vérifie une signature HMAC (utile pour les tests d'un récepteur, ou
 * pour boucler des webhooks AIAD entre deux instances).
 */
export function verifierSignature(payload, secret, signature) {
  try {
    const attendu = signerPayload(payload, secret);
    return signature === attendu;
  } catch {
    return false;
  }
}

// ─── Configuration ──────────────────────────────────────────────────────────

const CONFIG_PATH = '.aiad/webhooks.json';

/**
 * Charge `.aiad/webhooks.json` s'il existe.
 *
 * @returns {{ subscriptions: object[] }}
 */
export function chargerConfig(racine) {
  const path = join(racine, CONFIG_PATH);
  if (!existsSync(path)) return { subscriptions: [] };
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    return {
      subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions : [],
    };
  } catch {
    return { subscriptions: [] };
  }
}

/**
 * Persiste la config (utile pour `aiad-sdd webhooks add`).
 */
export function sauverConfig(racine, config) {
  const path = join(racine, CONFIG_PATH);
  if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * Filtre les souscriptions abonnées à un type d'événement.
 *
 * Une souscription sans champ `events` (ou `events: ["*"]`) reçoit tous
 * les événements.
 */
export function souscriptionsPourEvent(subs, eventType) {
  return subs.filter((s) => {
    if (!Array.isArray(s.events) || s.events.length === 0) return true;
    if (s.events.includes('*')) return true;
    return s.events.includes(eventType);
  });
}

// ─── Construction d'événement ──────────────────────────────────────────────

/**
 * Construit un payload d'événement standard.
 *
 * @param {{ type: string, data?: object, source?: string }} input
 */
export function construireEvenement(input) {
  if (!input.type) throw new Error('type d\'événement requis.');
  if (!EVENTS_VALIDES.includes(input.type)) {
    throw new Error(`Type d'événement inconnu : "${input.type}". Valides : ${EVENTS_VALIDES.join(', ')}.`);
  }
  return {
    id: uuidV4(),
    type: input.type,
    occurredAt: new Date().toISOString(),
    source: input.source || 'aiad-sdd',
    data: input.data || {},
  };
}

// ─── Émission ───────────────────────────────────────────────────────────────

/**
 * Loggue un échec de webhook dans `.aiad/metrics/webhooks-failures.jsonl`.
 */
function loggerEchec(racine, payload, sub, raison) {
  try {
    const dir = join(racine, '.aiad', 'metrics');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(
      join(dir, 'webhooks-failures.jsonl'),
      JSON.stringify({
        ts: new Date().toISOString(),
        eventId: payload.id,
        eventType: payload.type,
        url: sub.url,
        raison: raison.message || String(raison),
      }) + '\n',
      'utf-8',
    );
  } catch { /* never break pipeline */ }
}

/**
 * Émet un événement vers une souscription donnée.
 *
 * @param {object} payload
 * @param {{ url: string, secret?: string, headers?: object }} sub
 * @param {Function} [fetchFn]
 * @returns {Promise<{ ok: boolean, status?: number, raison?: string }>}
 */
export async function emettreVersSouscription(payload, sub, fetchFn) {
  const fn = fetchFn || globalThis.fetch;
  if (typeof fn !== 'function') {
    return { ok: false, raison: 'fetch natif indisponible' };
  }
  if (!sub.url) return { ok: false, raison: 'url absente' };

  const corps = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'aiad-sdd-webhook/1',
    'X-AIAD-Event': payload.type,
    'X-AIAD-Delivery': payload.id,
    ...(sub.headers || {}),
  };
  const secret = resoudreSecret(sub.secret);
  if (secret) {
    headers['X-AIAD-Signature'] = signerPayload(corps, secret);
  }

  let lastErr = null;
  for (let tentative = 0; tentative <= MAX_RETRIES; tentative++) {
    try {
      const res = await fn(sub.url, {
        method: 'POST',
        headers,
        body: corps,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) return { ok: true, status: res.status };
      // 4xx → pas de retry (mauvaise auth, payload invalide)
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, status: res.status, raison: `HTTP ${res.status}` };
      }
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    // Backoff exponentiel : 100ms, 200ms
    if (tentative < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 100 * Math.pow(2, tentative)));
    }
  }
  return { ok: false, raison: lastErr ? lastErr.message : 'inconnu' };
}

/**
 * Émet un événement vers TOUTES les souscriptions abonnées.
 *
 * Toutes les erreurs sont loguées dans `.aiad/metrics/webhooks-failures.jsonl`
 * — l'émission ne lève jamais d'exception.
 *
 * @param {string} racine
 * @param {{ type: string, data?: object, source?: string }} input
 * @param {{ fetchFn?: Function, dryRun?: boolean }} [options]
 * @returns {Promise<{ event: object, deliveries: { url: string, ok: boolean, status?: number, raison?: string }[] }>}
 */
export async function emettre(racine, input, options = {}) {
  const event = construireEvenement(input);
  const config = chargerConfig(racine);
  const subs = souscriptionsPourEvent(config.subscriptions, event.type);

  const deliveries = [];
  for (const sub of subs) {
    if (options.dryRun) {
      deliveries.push({ url: sub.url, ok: true, dryRun: true });
      continue;
    }
    const r = await emettreVersSouscription(event, sub, options.fetchFn);
    deliveries.push({ url: sub.url, ...r });
    if (!r.ok) loggerEchec(racine, event, sub, { message: r.raison });
  }
  return { event, deliveries };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

/**
 * Liste les souscriptions du projet courant.
 */
export function listerSouscriptions(racine, options = {}) {
  const config = chargerConfig(racine);
  if (options.json) {
    process.stdout.write(JSON.stringify(config, null, 2) + '\n');
    return config;
  }
  const subs = config.subscriptions;
  if (subs.length === 0) {
    console.log(`\n  Aucune souscription dans ${CONFIG_PATH}.\n`);
    console.log('  Crée le fichier avec un objet { "subscriptions": [...] } pour activer les webhooks.\n');
    return config;
  }
  console.log(`\n  ${subs.length} souscription(s) :`);
  for (const s of subs) {
    const events = Array.isArray(s.events) && s.events.length > 0 ? s.events.join(', ') : '*';
    console.log(`  - ${s.url}   events=${events}${s.secret ? '  signed' : ''}`);
  }
  console.log('');
  return config;
}

/**
 * Émet un événement de test vers toutes les souscriptions.
 * Utile pour valider la configuration sans déclencher d'événement réel.
 */
export async function emettreTest(racine, options = {}) {
  return emettre(racine, {
    type: options.type || 'spec.validated',
    source: 'aiad-sdd webhooks test',
    data: { sample: true, message: 'Ceci est un événement de test AIAD.' },
  }, options);
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  uuidV4 as uuid,
  resoudreSecret as resolveSecret,
  signerPayload as signPayload,
  verifierSignature as verifySignature,
  chargerConfig as loadConfig,
  sauverConfig as saveConfig,
  souscriptionsPourEvent as subscriptionsForEvent,
  construireEvenement as buildEvent,
  emettreVersSouscription as deliverToSubscription,
  emettre as emit,
  listerSouscriptions as listSubscriptions,
  emettreTest as emitTest,
};

export const CONSTANTS = {
  CONFIG_PATH,
  TIMEOUT_MS,
  MAX_RETRIES,
  EVENTS_VALIDES,
};
