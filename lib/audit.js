// AIAD SDD Mode — Audit trail crypto-signé des changements d'artefacts.
//
// **Cas d'usage** : pour les organisations EU soumises à AI Act / RGPD /
// CRA, pouvoir prouver à un régulateur **qui a modifié quoi quand** sur
// les Intents et SPECs. L'audit trail est append-only, signé HMAC-SHA256,
// et chaque entrée intègre le hash de la précédente (chaîne d'intégrité
// type "blockchain-light" sans blockchain).
//
// **Format** : `.aiad/audit/audit.jsonl` (un événement JSON par ligne).
// Schéma d'événement :
//   {
//     "ts": "2026-05-10T12:34:56.789Z",
//     "actor": "alice@example.com",       (depuis git config user.email)
//     "action": "modified" | "created" | "deleted" | "imported",
//     "artifact": ".aiad/specs/SPEC-001-1-x.md",
//     "hashAvant": "sha256:...",          (null si created)
//     "hashApres": "sha256:...",          (null si deleted)
//     "hashChain": "sha256:...",          (hash du précédent + cet event)
//     "sig": "hmac-sha256:..."            (HMAC sur tout l'event sauf sig)
//   }
//
// **Vérification de chaîne** : `verifierChaine` détecte tout tampering
// (modification d'un événement passé ou suppression d'une ligne).
//
// **Configuration** : `AIAD_AUDIT_SECRET` (env, ≥ 16 chars). Si absent,
// le module fonctionne en mode "warning" (logs lisibles mais sans
// vérifiabilité crypto — utile en dev). En prod, secret obligatoire pour
// la signature.
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHmac, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { C, logHeader } from './term.js';

const HASH_GENESIS = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';

// ─── Helpers crypto ─────────────────────────────────────────────────────────

export function sha256(contenu) {
  return 'sha256:' + createHash('sha256').update(String(contenu)).digest('hex');
}

export function hmacSign(message, secret) {
  return 'hmac-sha256:' + createHmac('sha256', secret).update(message).digest('hex');
}

// ─── Lecture / écriture ─────────────────────────────────────────────────────

function auditPath(racine) {
  return join(racine, '.aiad', 'audit', 'audit.jsonl');
}

/**
 * Lit toutes les entrées du log audit.
 *
 * @param {string} racine
 * @returns {object[]} liste des événements (peut être vide)
 */
export function lireLog(racine) {
  const path = auditPath(racine);
  if (!existsSync(path)) return [];
  const lignes = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  const out = [];
  for (const l of lignes) {
    try { out.push(JSON.parse(l)); }
    catch { /* ligne corrompue, ignore */ }
  }
  return out;
}

/**
 * Récupère l'auteur depuis git config (fallback "anonyme").
 */
function detecterActeur(racine) {
  try {
    const r = spawnSync('git', ['config', 'user.email'], { cwd: racine, encoding: 'utf-8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  } catch { /* ignore */ }
  return 'anonyme';
}

// ─── Fonctions pures (testables) ────────────────────────────────────────────

/**
 * Construit un événement d'audit (sans signature).
 *
 * @param {{ action: string, artifact: string, hashAvant?: string|null, hashApres?: string|null, actor?: string, ts?: string, hashChainPrecedent?: string }} input
 * @returns {object}
 */
export function construireEvenement(input) {
  if (!['created', 'modified', 'deleted', 'imported', 'archived'].includes(input.action)) {
    throw new Error(`Action inconnue : "${input.action}". Valides : created, modified, deleted, imported, archived.`);
  }
  if (typeof input.artifact !== 'string' || input.artifact.length === 0) {
    throw new Error('artifact requis (chemin relatif).');
  }
  const event = {
    ts: input.ts || new Date().toISOString(),
    actor: input.actor || 'anonyme',
    action: input.action,
    artifact: input.artifact,
    hashAvant: input.hashAvant ?? null,
    hashApres: input.hashApres ?? null,
  };
  // Calcul du hash de chaîne : hash(précédent + event sans hashChain ni sig)
  const baseEvent = JSON.stringify(event);
  event.hashChain = sha256((input.hashChainPrecedent || HASH_GENESIS) + baseEvent);
  return event;
}

/**
 * Signe un événement en place (ajoute le champ `sig`).
 *
 * @param {object} event
 * @param {string} secret
 * @returns {object} l'événement avec sig
 */
export function signerEvenement(event, secret) {
  if (typeof secret !== 'string' || secret.length < 16) {
    throw new Error('secret HMAC requis (≥ 16 caractères).');
  }
  const message = JSON.stringify({ ...event, sig: undefined });
  event.sig = hmacSign(message, secret);
  return event;
}

/**
 * Vérifie la signature d'un événement.
 */
export function verifierSignature(event, secret) {
  if (!event || !event.sig) return { valid: false, raison: 'sig absente' };
  const sigAttendue = hmacSign(JSON.stringify({ ...event, sig: undefined }), secret);
  return event.sig === sigAttendue
    ? { valid: true }
    : { valid: false, raison: 'signature ne match pas' };
}

/**
 * Vérifie l'intégrité de la chaîne complète :
 *   1. Chaque hashChain doit correspondre à hash(précédent + event sans hashChain ni sig).
 *   2. Chaque sig doit être valide (si secret fourni).
 *
 * @param {object[]} events
 * @param {string} [secret]
 * @returns {{ valid: boolean, raisons: string[], indexCassures: number[] }}
 */
export function verifierChaine(events, secret) {
  const raisons = [];
  const indexCassures = [];
  let prev = HASH_GENESIS;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const baseEvent = JSON.stringify({ ...e, hashChain: undefined, sig: undefined });
    const expected = sha256(prev + baseEvent);
    if (e.hashChain !== expected) {
      raisons.push(`L${i + 1} : hashChain invalide (attendu ${expected.slice(0, 24)}..., vu ${(e.hashChain || '').slice(0, 24)}...)`);
      indexCassures.push(i);
    }
    if (secret) {
      const v = verifierSignature(e, secret);
      if (!v.valid) {
        raisons.push(`L${i + 1} : ${v.raison}`);
        if (!indexCassures.includes(i)) indexCassures.push(i);
      }
    }
    prev = e.hashChain;
  }
  return { valid: raisons.length === 0, raisons, indexCassures };
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Append un événement signé au log audit.
 *
 * @param {string} racine
 * @param {{ action: string, artifact: string, hashAvant?: string|null, hashApres?: string|null, actor?: string }} input
 * @param {{ secret?: string, dryRun?: boolean }} [options]
 * @returns {object} l'événement écrit
 */
export function appendEvenement(racine, input, options = {}) {
  const secret = options.secret || process.env.AIAD_AUDIT_SECRET;
  const events = lireLog(racine);
  const dernier = events[events.length - 1];
  const hashChainPrecedent = dernier ? dernier.hashChain : HASH_GENESIS;

  const event = construireEvenement({
    ...input,
    actor: input.actor || detecterActeur(racine),
    hashChainPrecedent,
  });

  if (secret && secret.length >= 16) {
    signerEvenement(event, secret);
  } else {
    event.sig = null; // mode warning : pas de signature
  }

  if (!options.dryRun) {
    const path = auditPath(racine);
    if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(event) + '\n', 'utf-8');
  }
  return event;
}

/**
 * Calcule le hash actuel d'un fichier artefact (utile pour `appendEvenement`).
 */
export function hashFichier(racine, cheminRelatif) {
  const abs = join(racine, cheminRelatif);
  if (!existsSync(abs)) return null;
  return sha256(readFileSync(abs, 'utf-8'));
}

/**
 * Affiche le log d'audit.
 *
 * @param {string} racine
 * @param {{ json?: boolean, secret?: string }} [options]
 */
export function afficherLog(racine, options = {}) {
  const events = lireLog(racine);
  if (options.json) {
    process.stdout.write(JSON.stringify({
      total: events.length,
      events,
    }, null, 2) + '\n');
    return events;
  }
  logHeader(
    'AIAD SDD — Audit trail',
    `${events.length} événement(s) dans .aiad/audit/audit.jsonl`,
  );
  if (events.length === 0) {
    console.log(`  ${C.gris}~ Log vide. Premier événement à créer via aiad-sdd audit append.${C.reset}\n`);
    return events;
  }
  for (const e of events) {
    const sym = e.action === 'created' ? '+'
      : e.action === 'modified' ? '↑'
      : e.action === 'deleted' ? '-'
      : e.action === 'archived' ? '⊠'
      : '↪';
    console.log(`  ${C.cyan}${sym}${C.reset} ${e.ts.slice(0, 19).replace('T', ' ')}  ${C.gris}${e.actor}${C.reset}  ${e.artifact}`);
    if (e.sig === null) {
      console.log(`    ${C.jaune}⚠ non signé (AIAD_AUDIT_SECRET absent au moment de l'append)${C.reset}`);
    }
  }
  console.log('');
  return events;
}

/**
 * Vérifie l'intégrité de la chaîne et affiche le résultat.
 */
export function verifier(racine, options = {}) {
  const events = lireLog(racine);
  const secret = options.secret || process.env.AIAD_AUDIT_SECRET;
  const r = verifierChaine(events, secret);
  if (options.json) {
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    return r;
  }
  logHeader('AIAD SDD — Vérification audit trail', `${events.length} événement(s)`);
  if (r.valid) {
    console.log(`  ${C.vert}✓${C.reset} Chaîne intègre. ${secret ? 'Signatures valides.' : C.jaune + 'Mode non-signé (AIAD_AUDIT_SECRET absent).' + C.reset}\n`);
  } else {
    console.error(`  ${C.rouge}✗${C.reset} Chaîne corrompue : ${r.raisons.length} anomalie(s).`);
    for (const raison of r.raisons.slice(0, 10)) {
      console.error(`    ${C.rouge}-${C.reset} ${raison}`);
    }
    if (r.raisons.length > 10) console.error(`    ${C.gris}(+${r.raisons.length - 10} autres)${C.reset}`);
    console.error('');
  }
  return r;
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  construireEvenement as buildEvent,
  signerEvenement as signEvent,
  verifierSignature as verifySignature,
  verifierChaine as verifyChain,
  appendEvenement as appendEvent,
  lireLog as readLog,
  hashFichier as hashFile,
  afficherLog as showLog,
  verifier as verify,
};
