// AIAD SDD Mode — Connecteur GitLab natif (item #95).
//
// **Cap stratégique** : éviter de dépendre exclusivement de GitHub.
// Beaucoup d'organisations EU (banques, administrations, opérateurs
// publics) imposent **GitLab self-hosted** ou GitLab.com pour des
// raisons de souveraineté. AIAD doit s'intégrer sans friction :
//
//   - **MR comments** — `aiad-sdd gitlab review --mr <iid>` poste un
//     commentaire structuré sur la Merge Request avec le rapport
//     `aiad-sdd review`.
//   - **Issues from Intent** — `aiad-sdd gitlab issue --intent <id>`
//     crée une issue avec le titre + body de l'Intent + lien vers la SPEC.
//   - **Wiki export** — `aiad-sdd gitlab wiki --intent <id>|--spec <id>`
//     publie/met à jour la page wiki correspondante (idempotent).
//
// **Zero-dep runtime** : utilise `fetch` natif (Node ≥ 18 / Bun ≥ 1.2).
// Aucune dépendance externe (pas de `@gitlab/cli`, pas d'`axios`).
//
// **Sécurité** : le token est lu **uniquement** depuis `GITLAB_TOKEN`
// ou passé en option par le CLI. Jamais committé. Erreur explicite si
// absent.
//
// Documentation : https://aiad.ovh/gitlab
// Référence API : https://docs.gitlab.com/ee/api/

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';
import { review } from './review.js';

const GITLAB_DEFAULT_URL = 'https://gitlab.com';
const TIMEOUT_MS = 15000;

// ─── Config ─────────────────────────────────────────────────────────────────

/**
 * Lit la configuration GitLab depuis env + arguments.
 *
 * Ordre de priorité :
 *   1. options explicites
 *   2. variables d'environnement (GITLAB_URL, GITLAB_TOKEN, GITLAB_PROJECT)
 *   3. défauts
 *
 * @param {{ url?: string, token?: string, projectId?: string|number }} [options]
 */
export function chargerConfig(options = {}) {
  const url = options.url || process.env.GITLAB_URL || GITLAB_DEFAULT_URL;
  const token = options.token || process.env.GITLAB_TOKEN || '';
  const projectId = options.projectId || process.env.GITLAB_PROJECT || '';
  return {
    url: url.replace(/\/+$/, ''),
    token,
    projectId: String(projectId),
  };
}

/**
 * Vérifie qu'un token est présent. Lève une erreur explicite sinon.
 */
function exigerToken(config) {
  if (!config.token) {
    throw new Error(
      'GITLAB_TOKEN absent. Définir un Personal Access Token avec scope `api` :\n'
      + '  export GITLAB_TOKEN="glpat-xxxx"\n'
      + 'ou passer --token à la ligne de commande.',
    );
  }
}

function exigerProjet(config) {
  if (!config.projectId) {
    throw new Error(
      'projectId GitLab absent. Définir GITLAB_PROJECT (id numérique ou path encodé) :\n'
      + '  export GITLAB_PROJECT="123"  ou  GITLAB_PROJECT="group%2Fproject"\n'
      + 'ou passer --project à la ligne de commande.',
    );
  }
}

// ─── HTTP minimal ──────────────────────────────────────────────────────────

/**
 * Effectue un appel GitLab API v4 et retourne `{ status, body }`.
 *
 * Le `fetch` peut être injecté pour les tests (3e arg).
 *
 * @param {object} config
 * @param {{ method?: string, path: string, body?: object }} req
 * @param {Function} [fetchFn]
 */
export async function appelerGitLab(config, req, fetchFn) {
  exigerToken(config);
  const fn = fetchFn || globalThis.fetch;
  if (typeof fn !== 'function') {
    throw new Error('fetch natif indisponible. Node ≥ 18 ou Bun ≥ 1.2 requis.');
  }
  const url = `${config.url}/api/v4${req.path}`;
  const headers = {
    'PRIVATE-TOKEN': config.token,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const init = {
    method: req.method || 'GET',
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  };
  if (req.body !== undefined) init.body = JSON.stringify(req.body);

  const res = await fn(url, init);
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; }
  catch { body = text; }
  if (!res.ok) {
    const msg = body && body.message ? JSON.stringify(body.message) : text;
    throw new Error(`GitLab API ${res.status} ${req.method || 'GET'} ${req.path} : ${msg}`);
  }
  return { status: res.status, body };
}

// ─── Cas d'usage : commenter une MR ────────────────────────────────────────

/**
 * Poste un commentaire (note) sur une Merge Request.
 *
 * @param {object} config
 * @param {{ mrIid: number|string, body: string }} input
 * @param {Function} [fetchFn]
 */
export async function commenterMr(config, input, fetchFn) {
  exigerProjet(config);
  if (!input.mrIid) throw new Error('mrIid requis (numéro de Merge Request).');
  if (typeof input.body !== 'string' || input.body.length === 0) {
    throw new Error('body de commentaire requis (string non vide).');
  }
  const path = `/projects/${encodeURIComponent(config.projectId)}/merge_requests/${input.mrIid}/notes`;
  const r = await appelerGitLab(config, { method: 'POST', path, body: { body: input.body } }, fetchFn);
  return r.body;
}

/**
 * Pipeline `aiad-sdd gitlab review --mr <iid>` :
 *   1. Génère le rapport `aiad-sdd review <branch>` (depuis lib/review.js)
 *   2. L'envoie en commentaire MR avec un en-tête signalétique AIAD
 *
 * @param {string} racine
 * @param {{ mrIid: number|string, branch: string, projectId?: string, token?: string, dryRun?: boolean, fetchFn?: Function }} options
 */
export async function reviewMr(racine, options = {}) {
  if (!options.mrIid) throw new Error('--mr <iid> requis.');
  if (!options.branch) throw new Error('--branch <ref> requis pour le diff.');
  const config = chargerConfig({
    url: options.url, token: options.token, projectId: options.projectId,
  });

  // Génère le rapport Markdown (sans écriture disque, sans console).
  // Capture le stdout pour éviter le bruit en mode CLI.
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
    '_Posté automatiquement par `aiad-sdd gitlab review`. Source : https://aiad.ovh._',
  ].join('\n');

  if (options.dryRun) {
    return { dryRun: true, body: corps };
  }
  return commenterMr(config, { mrIid: options.mrIid, body: corps }, options.fetchFn);
}

// ─── Cas d'usage : créer une issue depuis un Intent ────────────────────────

/**
 * Crée une issue GitLab à partir d'un fichier Intent (.aiad/intents/INT-NNN.md).
 *
 * @param {object} config
 * @param {{ title: string, description: string, labels?: string[] }} input
 * @param {Function} [fetchFn]
 */
export async function creerIssue(config, input, fetchFn) {
  exigerProjet(config);
  if (!input.title) throw new Error('title requis.');
  const body = {
    title: input.title,
    description: input.description || '',
    labels: Array.isArray(input.labels) ? input.labels.join(',') : (input.labels || ''),
  };
  const path = `/projects/${encodeURIComponent(config.projectId)}/issues`;
  const r = await appelerGitLab(config, { method: 'POST', path, body }, fetchFn);
  return r.body;
}

/**
 * Convertit un fichier Intent en payload Issue GitLab.
 *
 * @param {string} racine
 * @param {string} intentId — ex. "INT-042"
 */
export function intentVersIssue(racine, intentId) {
  if (!/^(INTENT|INT)-\d+/i.test(intentId)) {
    throw new Error(`intentId invalide : "${intentId}". Format attendu : INT-NNN ou INTENT-NNN.`);
  }
  const dir = join(racine, '.aiad', 'intents');
  if (!existsSync(dir)) throw new Error(`.aiad/intents/ introuvable.`);
  const list = readdirSync(dir);
  const idUp = intentId.toUpperCase();
  const fichier = list.find((f) => f.toUpperCase().startsWith(idUp));
  if (!fichier) throw new Error(`Intent ${intentId} introuvable dans ${dir}.`);
  const contenu = readFileSync(join(dir, fichier), 'utf-8');
  const { data, body } = parseFrontmatter(contenu);
  const titre = data.title || data.titre || `[${intentId}] Intent`;
  const description = [
    body.trim(),
    '',
    '---',
    `_Issue créée depuis l'Intent \`${intentId}\` par \`aiad-sdd gitlab issue\`._`,
    `_Fichier source : \`.aiad/intents/${fichier}\`._`,
  ].join('\n');
  const labels = ['aiad-intent', `intent:${intentId.toLowerCase()}`];
  return { title: titre, description, labels };
}

// ─── Cas d'usage : export Wiki ─────────────────────────────────────────────

/**
 * Crée ou met à jour une page wiki GitLab.
 *
 * Idempotent : essaie d'abord PUT (slug existant), retombe sur POST si 404.
 */
export async function publierWiki(config, input, fetchFn) {
  exigerProjet(config);
  if (!input.slug) throw new Error('slug requis (ex: "intents/INT-042").');
  if (!input.title) throw new Error('title requis.');
  if (!input.content) throw new Error('content requis (Markdown).');
  const baseDir = `/projects/${encodeURIComponent(config.projectId)}/wikis`;
  const payload = { title: input.title, content: input.content, format: 'markdown' };

  // Essai PUT (page existe). Si 404 → POST.
  try {
    const r = await appelerGitLab(config, {
      method: 'PUT',
      path: `${baseDir}/${encodeURIComponent(input.slug)}`,
      body: payload,
    }, fetchFn);
    return { action: 'updated', body: r.body };
  } catch (err) {
    if (!/^GitLab API 404/.test(err.message)) throw err;
    const r = await appelerGitLab(config, {
      method: 'POST',
      path: baseDir,
      body: { ...payload, slug: input.slug },
    }, fetchFn);
    return { action: 'created', body: r.body };
  }
}

/**
 * Convertit un Intent ou une SPEC en page wiki.
 *
 * @param {string} racine
 * @param {{ kind: 'intent'|'spec', id: string }} ref
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
  const slug = `${sous}/${ref.id.toUpperCase()}`;
  const content = [
    body.trim(),
    '',
    '---',
    `_Page synchronisée depuis \`.aiad/${sous}/${fichier}\` via \`aiad-sdd gitlab wiki\`._`,
  ].join('\n');
  return { slug, title, content };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  chargerConfig as loadConfig,
  appelerGitLab as callGitLab,
  commenterMr as commentMr,
  reviewMr as reviewMergeRequest,
  creerIssue as createIssue,
  intentVersIssue as intentToIssue,
  publierWiki as publishWiki,
  artefactVersWiki as artifactToWiki,
};

export const CONSTANTS = {
  GITLAB_DEFAULT_URL,
  TIMEOUT_MS,
};
