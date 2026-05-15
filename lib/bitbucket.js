// AIAD SDD Mode — Connecteur Bitbucket Cloud + Server (item #113).
//
// **Cap stratégique** : couvrir Bitbucket Cloud (api.bitbucket.org) ET
// Bitbucket Server / Data Center (self-hosted, anciennement Stash) au
// même niveau que GitLab (#95) et Azure DevOps (#96). De nombreuses
// banques européennes et institutions sont sur Bitbucket Server pour
// raisons réglementaires (cloud non européen exclu).
//
// **2 cas d'usage couverts** :
//   1. **PR comments** — `aiad-sdd bitbucket pr --id <prId>` poste un
//      commentaire (Cloud) ou une "PR activity comment" (Server) avec
//      le rapport `aiad-sdd review`.
//   2. **Issues from Intent** — `aiad-sdd bitbucket issue --intent <id>`
//      crée une issue Bitbucket Cloud (rappel : `bug|task|enhancement|
//      proposal` + priority). Bitbucket Server n'a pas d'API Issues
//      native — on retombe sur Jira intégré (lien généré).
//
// **Wiki** : Bitbucket Cloud a déprécié son wiki en 2020. Pour la
// documentation, utiliser Confluence (#97 — connecteur officiel Atlassian)
// qui s'intègre nativement avec Bitbucket.
//
// **Zero-dep** : `fetch` natif Node ≥18 / Bun ≥1.2.
//
// **Sécurité** :
//   - Cloud : App password (recommandé) → `BITBUCKET_USERNAME` +
//     `BITBUCKET_APP_PASSWORD`. Workspace via `BITBUCKET_WORKSPACE`.
//   - Server : Personal Access Token Bearer → `BITBUCKET_SERVER_URL` +
//     `BITBUCKET_TOKEN`. Project + repo via `BITBUCKET_PROJECT` /
//     `BITBUCKET_REPO`.
//
// Documentation : https://aiad.ovh/bitbucket
// Référence API Cloud : https://developer.atlassian.com/cloud/bitbucket/rest/
// Référence API Server : https://developer.atlassian.com/server/bitbucket/rest/

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';
import { review } from './review.js';

const CLOUD_DEFAULT_URL = 'https://api.bitbucket.org/2.0';
const TIMEOUT_MS = 15000;
const KINDS_VALIDES = ['bug', 'enhancement', 'proposal', 'task'];
const PRIORITES_VALIDES = ['trivial', 'minor', 'major', 'critical', 'blocker'];

// ─── Config ────────────────────────────────────────────────────────────────

/**
 * Détermine le type de déploiement (cloud vs server) selon les variables
 * d'environnement ou options.
 *
 * @param {{ cloud?: boolean, server?: boolean, serverUrl?: string }} [options]
 */
function detecterMode(options = {}) {
  if (options.cloud) return 'cloud';
  if (options.server || options.serverUrl || process.env.BITBUCKET_SERVER_URL) return 'server';
  return 'cloud';
}

/**
 * Lit la configuration Bitbucket.
 *
 * Variables d'env :
 *   BITBUCKET_USERNAME       (Cloud — username pour App password)
 *   BITBUCKET_APP_PASSWORD   (Cloud — Basic auth)
 *   BITBUCKET_WORKSPACE      (Cloud — workspace, ex. "monorga")
 *   BITBUCKET_REPO           (slug ou nom du repo)
 *   BITBUCKET_SERVER_URL     (Server — base URL https://bitbucket.corp.fr)
 *   BITBUCKET_PROJECT        (Server — projectKey)
 *   BITBUCKET_TOKEN          (Bearer token — Server PAT 8.x+)
 */
export function chargerConfig(options = {}) {
  const mode = detecterMode(options);
  if (mode === 'cloud') {
    return {
      mode: 'cloud',
      url: CLOUD_DEFAULT_URL,
      username: options.username || process.env.BITBUCKET_USERNAME || '',
      appPassword: options.appPassword || options.token || process.env.BITBUCKET_APP_PASSWORD || '',
      workspace: options.workspace || process.env.BITBUCKET_WORKSPACE || '',
      repo: options.repo || process.env.BITBUCKET_REPO || '',
    };
  }
  const serverUrl = (options.serverUrl || process.env.BITBUCKET_SERVER_URL || '').replace(/\/+$/, '');
  return {
    mode: 'server',
    url: serverUrl ? `${serverUrl}/rest/api/1.0` : '',
    token: options.token || process.env.BITBUCKET_TOKEN || '',
    project: options.project || process.env.BITBUCKET_PROJECT || '',
    repo: options.repo || process.env.BITBUCKET_REPO || '',
  };
}

function exigerAuth(c) {
  if (c.mode === 'cloud') {
    if (!c.username) throw new Error('BITBUCKET_USERNAME absent (Cloud).');
    if (!c.appPassword) {
      throw new Error(
        'BITBUCKET_APP_PASSWORD absent. Génère un App password :\n'
        + '  https://bitbucket.org/account/settings/app-passwords/\n'
        + '  scopes minimaux : pullrequest:write, issue:write\n'
        + '  export BITBUCKET_APP_PASSWORD="<password>"',
      );
    }
    if (!c.workspace) throw new Error('BITBUCKET_WORKSPACE absent (Cloud).');
  } else {
    if (!c.url) throw new Error('BITBUCKET_SERVER_URL absent (Server).');
    if (!c.token) throw new Error('BITBUCKET_TOKEN absent (Server PAT).');
    if (!c.project) throw new Error('BITBUCKET_PROJECT absent (Server projectKey).');
  }
  if (!c.repo) throw new Error('BITBUCKET_REPO absent (slug ou nom du repo).');
}

// ─── HTTP minimal ───────────────────────────────────────────────────────────

function authHeader(c) {
  if (c.mode === 'cloud') {
    return 'Basic ' + Buffer.from(`${c.username}:${c.appPassword}`, 'utf-8').toString('base64');
  }
  return 'Bearer ' + c.token;
}

/**
 * @param {object} config
 * @param {{ method?: string, path: string, body?: object }} req
 * @param {Function} [fetchFn]
 */
export async function appelerBitbucket(config, req, fetchFn) {
  exigerAuth(config);
  const fn = fetchFn || globalThis.fetch;
  if (typeof fn !== 'function') {
    throw new Error('fetch natif indisponible. Node ≥ 18 ou Bun ≥ 1.2 requis.');
  }
  const url = `${config.url}${req.path}`;
  const init = {
    method: req.method || 'GET',
    headers: {
      Authorization: authHeader(config),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  };
  if (req.body !== undefined) init.body = JSON.stringify(req.body);

  const res = await fn(url, init);
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; }
  catch { body = text; }
  if (!res.ok) {
    const msg = body && (body.error || body.message)
      ? JSON.stringify(body.error || body.message)
      : text;
    throw new Error(`Bitbucket API ${res.status} ${req.method || 'GET'} ${req.path} : ${msg}`);
  }
  return { status: res.status, body };
}

// ─── PR comments ───────────────────────────────────────────────────────────

/**
 * Crée un commentaire sur une Pull Request.
 *
 * @param {object} config
 * @param {{ prId: number|string, body: string }} input
 * @param {Function} [fetchFn]
 */
export async function commenterPr(config, input, fetchFn) {
  if (!input.prId) throw new Error('prId requis (numéro de Pull Request).');
  if (typeof input.body !== 'string' || input.body.length === 0) {
    throw new Error('body de commentaire requis (string non vide).');
  }
  let path; let payload;
  if (config.mode === 'cloud') {
    path = `/repositories/${encodeURIComponent(config.workspace)}/${encodeURIComponent(config.repo)}/pullrequests/${input.prId}/comments`;
    payload = { content: { raw: input.body } };
  } else {
    path = `/projects/${encodeURIComponent(config.project)}/repos/${encodeURIComponent(config.repo)}/pull-requests/${input.prId}/comments`;
    payload = { text: input.body };
  }
  const r = await appelerBitbucket(config, { method: 'POST', path, body: payload }, fetchFn);
  return r.body;
}

/**
 * Pipeline `aiad-sdd bitbucket pr --id <prId>` : génère review + commente.
 */
export async function reviewPr(racine, options = {}) {
  if (!options.prId) throw new Error('--id <prId> requis.');
  if (!options.branch) throw new Error('--branch <ref> requis pour le diff.');
  const config = chargerConfig(options);
  const captureLog = console.log;
  console.log = () => {};
  let r;
  try {
    r = await review(racine, options.branch);
  } finally {
    console.log = captureLog;
  }
  const corps = [
    '## AIAD SDD — Review automatisée',
    '',
    `Diff Intents/SPECs vs \`${options.branch}\` — généré par \`aiad-sdd review\`.`,
    '',
    r.rapport || '_(aucun changement Intent/SPEC détecté)_',
    '',
    '---',
    '_Posté automatiquement par `aiad-sdd bitbucket pr`. Source : https://aiad.ovh._',
  ].join('\n');

  if (options.dryRun) return { dryRun: true, body: corps };
  return commenterPr(config, { prId: options.prId, body: corps }, options.fetchFn);
}

// ─── Issues ────────────────────────────────────────────────────────────────

/**
 * Crée une issue (Bitbucket Cloud uniquement — Server n'a pas d'API native).
 *
 * @param {object} config
 * @param {{ title: string, content?: string, kind?: string, priority?: string }} input
 * @param {Function} [fetchFn]
 */
export async function creerIssue(config, input, fetchFn) {
  if (config.mode !== 'cloud') {
    throw new Error(
      'Bitbucket Server n\'a pas d\'API Issues native (utiliser Jira intégré).\n'
      + '  Bitbucket Cloud uniquement pour cette commande.',
    );
  }
  if (!input.title) throw new Error('title requis.');
  const kind = input.kind || 'task';
  if (!KINDS_VALIDES.includes(kind)) {
    throw new Error(`Kind "${kind}" invalide. Valides : ${KINDS_VALIDES.join(', ')}.`);
  }
  const priority = input.priority || 'minor';
  if (!PRIORITES_VALIDES.includes(priority)) {
    throw new Error(`Priority "${priority}" invalide. Valides : ${PRIORITES_VALIDES.join(', ')}.`);
  }
  const path = `/repositories/${encodeURIComponent(config.workspace)}/${encodeURIComponent(config.repo)}/issues`;
  const payload = {
    title: input.title,
    content: { raw: input.content || '', markup: 'markdown' },
    kind,
    priority,
  };
  const r = await appelerBitbucket(config, { method: 'POST', path, body: payload }, fetchFn);
  return r.body;
}

/**
 * Convertit un fichier Intent en payload Issue Bitbucket.
 */
export function intentVersIssue(racine, intentId) {
  if (!/^INT-\d+/i.test(intentId)) {
    throw new Error(`intentId invalide : "${intentId}". Format attendu : INT-NNN.`);
  }
  const dir = join(racine, '.aiad', 'intents');
  if (!existsSync(dir)) throw new Error(`.aiad/intents/ introuvable.`);
  const list = readdirSync(dir);
  const idUp = intentId.toUpperCase();
  const fichier = list.find((f) => f.toUpperCase().startsWith(idUp));
  if (!fichier) throw new Error(`Intent ${intentId} introuvable dans ${dir}.`);
  const contenu = readFileSync(join(dir, fichier), 'utf-8');
  const { data, body } = parseFrontmatter(contenu);
  const title = data.title || data.titre || `[${intentId}] Intent`;
  const content = [
    body.trim(),
    '',
    '---',
    `*Issue créée depuis l'Intent \`${intentId}\` par \`aiad-sdd bitbucket issue\`.*`,
    `*Source : \`.aiad/intents/${fichier}\`*`,
  ].join('\n');
  return { title, content, kind: 'task', priority: 'minor' };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  chargerConfig as loadConfig,
  appelerBitbucket as callBitbucket,
  commenterPr as commentPr,
  reviewPr as reviewPullRequest,
  creerIssue as createIssue,
  intentVersIssue as intentToIssue,
};

export const CONSTANTS = {
  CLOUD_DEFAULT_URL,
  TIMEOUT_MS,
  KINDS_VALIDES,
  PRIORITES_VALIDES,
};
