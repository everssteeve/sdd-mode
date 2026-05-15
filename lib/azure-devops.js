// AIAD SDD Mode — Connecteur Azure DevOps natif (item #96).
//
// **Cap stratégique** : couvrir les grands comptes EU sur Azure DevOps
// au même niveau que GitLab (item #95) et GitHub. Beaucoup de groupes
// industriels et bancaires européens (Microsoft Partner Program) utilisent
// Azure DevOps comme forge unique : sans connecteur natif, AIAD est
// inadoptable.
//
// **3 cas d'usage couverts** :
//   1. **PR comments** — `aiad-sdd azure pr --id <prId>` poste un thread
//      sur une Pull Request avec le rapport `aiad-sdd review`.
//   2. **Work Items from Intent** — `aiad-sdd azure work-item --intent <id>`
//      crée un Work Item (User Story par défaut) avec titre + description
//      + tags AIAD.
//   3. **Wiki export** — `aiad-sdd azure wiki --intent <id>|--spec <id>`
//      publie une page wiki (PUT idempotent, path URL-encoded).
//
// **Zero-dep runtime** : `fetch` natif (Node ≥ 18 / Bun ≥ 1.2),
// authentification Basic avec PAT (username vide + token base64).
//
// **Sécurité** : token via `AZURE_DEVOPS_TOKEN` uniquement, jamais committé.
// L'erreur affichée si absent guide l'utilisateur vers les scopes minimaux.
//
// Documentation : https://aiad.ovh/azure-devops
// Référence API : https://learn.microsoft.com/en-us/rest/api/azure/devops/

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';
import { review } from './review.js';

const AZURE_DEFAULT_ORG_URL = 'https://dev.azure.com';
const AZURE_API_VERSION = '7.1';
const TIMEOUT_MS = 15000;
const WORK_ITEM_TYPES = ['UserStory', 'Bug', 'Task', 'Feature', 'Epic'];

// ─── Config ────────────────────────────────────────────────────────────────

/**
 * Lit la configuration Azure DevOps depuis env + arguments.
 *
 * Variables d'env reconnues :
 *   AZURE_DEVOPS_ORG       (organization, ex. "myorg")
 *   AZURE_DEVOPS_PROJECT   (project, ex. "MyProject")
 *   AZURE_DEVOPS_REPO      (repositoryId/name pour PR, optionnel)
 *   AZURE_DEVOPS_WIKI      (wiki identifier pour Wiki, optionnel)
 *   AZURE_DEVOPS_TOKEN     (Personal Access Token)
 *   AZURE_DEVOPS_URL       (override pour Azure DevOps Server on-premise)
 *
 * @param {{ org?: string, project?: string, repo?: string, wiki?: string, token?: string, url?: string }} [options]
 */
export function chargerConfig(options = {}) {
  const url = (options.url || process.env.AZURE_DEVOPS_URL || AZURE_DEFAULT_ORG_URL).replace(/\/+$/, '');
  return {
    url,
    org: options.org || process.env.AZURE_DEVOPS_ORG || '',
    project: options.project || process.env.AZURE_DEVOPS_PROJECT || '',
    repo: options.repo || process.env.AZURE_DEVOPS_REPO || '',
    wiki: options.wiki || process.env.AZURE_DEVOPS_WIKI || '',
    token: options.token || process.env.AZURE_DEVOPS_TOKEN || '',
  };
}

function exigerToken(c) {
  if (!c.token) {
    throw new Error(
      'AZURE_DEVOPS_TOKEN absent. Crée un Personal Access Token avec les scopes :\n'
      + '  - Code (Read & Write) pour les PR\n'
      + '  - Work Items (Read, Write, & Manage) pour les issues\n'
      + '  - Wiki (Read & Write) pour le wiki\n'
      + '  export AZURE_DEVOPS_TOKEN="<pat>"',
    );
  }
}

function exigerOrgProjet(c) {
  if (!c.org) throw new Error('AZURE_DEVOPS_ORG absent (organisation).');
  if (!c.project) throw new Error('AZURE_DEVOPS_PROJECT absent (projet).');
}

// ─── HTTP minimal ──────────────────────────────────────────────────────────

/**
 * Encode "username:token" en Base64 — Azure DevOps accepte un username vide.
 */
function authHeader(token) {
  return 'Basic ' + Buffer.from(':' + token, 'utf-8').toString('base64');
}

/**
 * Appelle l'API Azure DevOps. `req.path` est attendu **avec** le segment
 * organisation/projet quand pertinent (ex. "/_apis/git/repositories/...").
 *
 * @param {object} config
 * @param {{ method?: string, path: string, body?: object, contentType?: string }} req
 * @param {Function} [fetchFn]
 */
export async function appelerAzure(config, req, fetchFn) {
  exigerToken(config);
  const fn = fetchFn || globalThis.fetch;
  if (typeof fn !== 'function') {
    throw new Error('fetch natif indisponible. Node ≥ 18 ou Bun ≥ 1.2 requis.');
  }

  // Ajout api-version si absent
  const sep = req.path.includes('?') ? '&' : '?';
  const path = req.path.includes('api-version=')
    ? req.path
    : `${req.path}${sep}api-version=${AZURE_API_VERSION}`;

  const url = `${config.url}/${config.org}${path}`;
  const headers = {
    Authorization: authHeader(config.token),
    'Content-Type': req.contentType || 'application/json',
    Accept: 'application/json',
  };
  const init = {
    method: req.method || 'GET',
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  };
  if (req.body !== undefined) {
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }
  const res = await fn(url, init);
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; }
  catch { body = text; }
  if (!res.ok) {
    const msg = body && body.message ? body.message : text;
    throw new Error(`Azure DevOps API ${res.status} ${req.method || 'GET'} ${path} : ${msg}`);
  }
  return { status: res.status, body };
}

// ─── PR comments ────────────────────────────────────────────────────────────

/**
 * Crée un nouveau **thread** de commentaire sur une Pull Request.
 *
 * @param {object} config
 * @param {{ prId: number|string, body: string, status?: number }} input
 * @param {Function} [fetchFn]
 */
export async function commenterPr(config, input, fetchFn) {
  exigerOrgProjet(config);
  if (!config.repo) throw new Error('AZURE_DEVOPS_REPO absent (repositoryId ou nom).');
  if (!input.prId) throw new Error('prId requis (numéro de Pull Request).');
  if (typeof input.body !== 'string' || input.body.length === 0) {
    throw new Error('body de commentaire requis (string non vide).');
  }
  const path = `/${encodeURIComponent(config.project)}/_apis/git/repositories/${encodeURIComponent(config.repo)}/pullRequests/${input.prId}/threads`;
  const payload = {
    comments: [{ parentCommentId: 0, content: input.body, commentType: 1 }],
    // status: 1 = active, 4 = closed (informational)
    status: input.status || 1,
  };
  const r = await appelerAzure(config, { method: 'POST', path, body: payload }, fetchFn);
  return r.body;
}

/**
 * Pipeline `aiad-sdd azure pr --id <prId> --branch <ref>` :
 *   1. Génère le rapport `aiad-sdd review <branch>`
 *   2. Le poste comme nouveau thread sur la PR
 */
export async function reviewPr(racine, options = {}) {
  if (!options.prId) throw new Error('--id <prId> requis.');
  if (!options.branch) throw new Error('--branch <ref> requis pour le diff.');
  const config = chargerConfig({
    org: options.org, project: options.project, repo: options.repo, token: options.token,
  });
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
    '_Posté automatiquement par `aiad-sdd azure pr`. Source : https://aiad.ovh._',
  ].join('\n');

  if (options.dryRun) return { dryRun: true, body: corps };
  return commenterPr(config, { prId: options.prId, body: corps }, options.fetchFn);
}

// ─── Work Items ─────────────────────────────────────────────────────────────

/**
 * Crée un Work Item (UserStory par défaut) via JSON Patch.
 *
 * @param {object} config
 * @param {{ type?: string, title: string, description?: string, tags?: string[] }} input
 * @param {Function} [fetchFn]
 */
export async function creerWorkItem(config, input, fetchFn) {
  exigerOrgProjet(config);
  if (!input.title) throw new Error('title requis.');
  const type = input.type || 'UserStory';
  if (!WORK_ITEM_TYPES.includes(type)) {
    throw new Error(`Type Work Item inconnu : "${type}". Valides : ${WORK_ITEM_TYPES.join(', ')}.`);
  }
  const patch = [
    { op: 'add', path: '/fields/System.Title', value: input.title },
  ];
  if (input.description) {
    patch.push({ op: 'add', path: '/fields/System.Description', value: input.description });
  }
  if (Array.isArray(input.tags) && input.tags.length > 0) {
    patch.push({ op: 'add', path: '/fields/System.Tags', value: input.tags.join('; ') });
  }
  const path = `/${encodeURIComponent(config.project)}/_apis/wit/workitems/$${type}`;
  const r = await appelerAzure(config, {
    method: 'POST',
    path,
    body: patch,
    contentType: 'application/json-patch+json',
  }, fetchFn);
  return r.body;
}

/**
 * Convertit un Intent .aiad/intents/INT-NNN-*.md en payload Work Item.
 */
export function intentVersWorkItem(racine, intentId) {
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
  const description = [
    body.trim(),
    '',
    '---',
    `<i>Work Item créé depuis l'Intent <code>${intentId}</code> par <code>aiad-sdd azure work-item</code>.</i>`,
    `<i>Source : <code>.aiad/intents/${fichier}</code></i>`,
  ].join('\n');
  const tags = ['aiad', `intent-${intentId.toLowerCase()}`];
  return { type: 'UserStory', title, description, tags };
}

// ─── Wiki ──────────────────────────────────────────────────────────────────

/**
 * PUT idempotent d'une page wiki Azure DevOps.
 *
 * @param {object} config
 * @param {{ path: string, content: string, version?: string }} input
 * @param {Function} [fetchFn]
 */
export async function publierWiki(config, input, fetchFn) {
  exigerOrgProjet(config);
  if (!config.wiki) throw new Error('AZURE_DEVOPS_WIKI absent (wiki identifier).');
  if (!input.path) throw new Error('path requis (chemin de la page, ex. "/AIAD/INT-001").');
  if (!input.content) throw new Error('content requis.');
  const apiPath = `/${encodeURIComponent(config.project)}/_apis/wiki/wikis/${encodeURIComponent(config.wiki)}/pages?path=${encodeURIComponent(input.path)}`;
  const r = await appelerAzure(config, {
    method: 'PUT',
    path: apiPath,
    body: { content: input.content },
  }, fetchFn);
  return { action: r.status === 200 ? 'updated' : 'created', body: r.body };
}

/**
 * Convertit un Intent ou une SPEC en page wiki.
 */
export function artefactVersWiki(racine, ref) {
  const sous = ref.kind === 'intent' ? 'intents' : 'specs';
  const dir = join(racine, '.aiad', sous);
  if (!existsSync(dir)) throw new Error(`.aiad/${sous}/ introuvable.`);
  const list = readdirSync(dir);
  const fichier = list.find((f) => f.toLowerCase().startsWith(ref.id.toLowerCase()));
  if (!fichier) throw new Error(`${ref.kind} ${ref.id} introuvable.`);
  const contenu = readFileSync(join(dir, fichier), 'utf-8');
  const { data, body } = parseFrontmatter(contenu);
  const title = data.title || data.titre || ref.id;
  // Path Azure : "/AIAD/intents/INT-007" — slashes représentent une hiérarchie
  const wikiPath = `/AIAD/${sous}/${ref.id.toUpperCase()}`;
  const content = [
    `# ${title}`,
    '',
    body.trim(),
    '',
    '---',
    `_Page synchronisée depuis \`.aiad/${sous}/${fichier}\` via \`aiad-sdd azure wiki\`._`,
  ].join('\n');
  return { path: wikiPath, content, title };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  chargerConfig as loadConfig,
  appelerAzure as callAzure,
  commenterPr as commentPr,
  reviewPr as reviewPullRequest,
  creerWorkItem as createWorkItem,
  intentVersWorkItem as intentToWorkItem,
  publierWiki as publishWiki,
  artefactVersWiki as artifactToWiki,
};

export const CONSTANTS = {
  AZURE_DEFAULT_ORG_URL,
  AZURE_API_VERSION,
  TIMEOUT_MS,
  WORK_ITEM_TYPES,
};
