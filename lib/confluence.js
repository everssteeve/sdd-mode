// AIAD SDD Mode — Connecteur Confluence (item #97).
//
// **Cas d'usage** : `aiad-sdd export confluence` publie l'arborescence
// `.aiad/intents/` + `.aiad/specs/` dans un espace Confluence Cloud,
// avec une page parent "AIAD" et des sous-pages par Intent et par SPEC,
// liens hypertextes croisés inclus.
//
// **Public cible** : grandes organisations EU (banques, assurances,
// administrations) où Confluence reste la documentation de référence —
// AIAD doit pouvoir l'alimenter automatiquement plutôt que d'être un
// silo parallèle.
//
// **Zero-dep** : `fetch` natif (Node ≥ 18 / Bun ≥ 1.2), conversion
// Markdown → Confluence Storage Format (XHTML simplifié) maison,
// pas de dépendance `markdown-it` ou `confluence-cli`.
//
// **Sécurité** : token via `CONFLUENCE_TOKEN` (Atlassian API token),
// jamais committé. L'erreur explicite si absent.
//
// Documentation : https://aiad.ovh/confluence
// Référence API v2 : https://developer.atlassian.com/cloud/confluence/rest/v2/

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';

const TIMEOUT_MS = 15000;

// ─── Config ────────────────────────────────────────────────────────────────

/**
 * Lit la configuration Confluence depuis env + arguments.
 *
 * Variables d'env :
 *   CONFLUENCE_DOMAIN  → "monorga" (pour https://monorga.atlassian.net)
 *   CONFLUENCE_EMAIL   → e-mail Atlassian (Basic auth username)
 *   CONFLUENCE_TOKEN   → API token (Basic auth password)
 *   CONFLUENCE_SPACE   → spaceId (numérique) OU spaceKey (alphanumérique)
 *
 * @param {{ domain?: string, email?: string, token?: string, spaceId?: string, spaceKey?: string, url?: string }} [options]
 */
export function chargerConfig(options = {}) {
  const domain = options.domain || process.env.CONFLUENCE_DOMAIN || '';
  const url = options.url
    || process.env.CONFLUENCE_URL
    || (domain ? `https://${domain}.atlassian.net/wiki` : '');
  return {
    url: url.replace(/\/+$/, ''),
    domain,
    email: options.email || process.env.CONFLUENCE_EMAIL || '',
    token: options.token || process.env.CONFLUENCE_TOKEN || '',
    spaceId: options.spaceId || process.env.CONFLUENCE_SPACE_ID || '',
    spaceKey: options.spaceKey || process.env.CONFLUENCE_SPACE || '',
  };
}

function exigerAuth(c) {
  if (!c.url) {
    throw new Error('CONFLUENCE_DOMAIN absent (ex: "monorga" pour https://monorga.atlassian.net).');
  }
  if (!c.email) throw new Error('CONFLUENCE_EMAIL absent (e-mail Atlassian).');
  if (!c.token) {
    throw new Error(
      'CONFLUENCE_TOKEN absent. Génère un Atlassian API token :\n'
      + '  https://id.atlassian.com/manage-profile/security/api-tokens\n'
      + '  export CONFLUENCE_TOKEN="<token>"',
    );
  }
}

function exigerEspace(c) {
  if (!c.spaceId && !c.spaceKey) {
    throw new Error('CONFLUENCE_SPACE_ID ou CONFLUENCE_SPACE (key) absent.');
  }
}

// ─── HTTP minimal ───────────────────────────────────────────────────────────

function authHeader(email, token) {
  return 'Basic ' + Buffer.from(`${email}:${token}`, 'utf-8').toString('base64');
}

/**
 * Appelle l'API Confluence Cloud v2.
 *
 * @param {object} config
 * @param {{ method?: string, path: string, body?: object, query?: object }} req
 * @param {Function} [fetchFn]
 */
export async function appelerConfluence(config, req, fetchFn) {
  exigerAuth(config);
  const fn = fetchFn || globalThis.fetch;
  if (typeof fn !== 'function') {
    throw new Error('fetch natif indisponible. Node ≥ 18 ou Bun ≥ 1.2 requis.');
  }
  let url = `${config.url}${req.path}`;
  if (req.query) {
    const qs = Object.entries(req.query)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  const init = {
    method: req.method || 'GET',
    headers: {
      Authorization: authHeader(config.email, config.token),
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
    const msg = body && body.message ? body.message : text;
    throw new Error(`Confluence API ${res.status} ${req.method || 'GET'} ${req.path} : ${msg}`);
  }
  return { status: res.status, body };
}

// ─── Markdown → Confluence Storage Format ──────────────────────────────────

/**
 * Échappe les caractères XML/HTML dangereux pour insertion dans
 * Confluence Storage Format (XHTML strict).
 */
export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convertit du Markdown simple en Confluence Storage Format (XHTML).
 *
 * Couvre :
 *   - Titres `#`, `##`, `###`, `####`
 *   - Listes `- ` non ordonnées (un seul niveau)
 *   - Code blocks ``` → macro Confluence `code`
 *   - Code inline `code` → `<code>`
 *   - Liens `[text](url)` → `<a href>`
 *   - Gras `**text**` → `<strong>`
 *   - Italique `*text*` → `<em>` (n'attrape pas la fin de gras)
 *   - Horizontal rule `---` → `<hr/>`
 *   - Paragraphes vides séparateurs
 *
 * Ne gère PAS : tableaux, images, listes ordonnées (out-of-scope MVP).
 *
 * @param {string} markdown
 * @returns {string} XHTML compatible Confluence storage format
 */
export function markdownVersStorage(markdown) {
  if (!markdown) return '';
  const lignes = String(markdown).split('\n');
  const out = [];
  let inCode = false;
  let codeBuffer = [];
  let codeLang = '';
  let inList = false;

  const flushList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  // Inline transformations applied to a single line of plain text
  function inlineTransforms(s) {
    let t = escapeXml(s);
    // code inline `code` (avant gras pour éviter conflit)
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    // gras **text**
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // italique *text* — uniquement si non collé à un autre *
    t = t.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
    // liens [texte](url) — l'URL est déjà escape-XML mais on la déprotège du `&amp;`
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
      const hrefClean = href.replace(/&amp;/g, '&');
      return `<a href="${escapeXml(hrefClean)}">${label}</a>`;
    });
    return t;
  }

  for (const raw of lignes) {
    // Code block fences
    const fence = raw.match(/^```(\w*)\s*$/);
    if (fence) {
      if (inCode) {
        // Fin du bloc → macro Confluence
        out.push(`<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">${escapeXml(codeLang || 'text')}</ac:parameter><ac:plain-text-body><![CDATA[${codeBuffer.join('\n')}]]></ac:plain-text-body></ac:structured-macro>`);
        codeBuffer = [];
        codeLang = '';
        inCode = false;
      } else {
        flushList();
        inCode = true;
        codeLang = fence[1] || '';
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(raw);
      continue;
    }

    const trimmed = raw.trim();
    if (trimmed === '') {
      flushList();
      out.push('');
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      flushList();
      out.push('<hr/>');
      continue;
    }

    // Headings (ordre : H4 → H1 pour ne pas confondre)
    const h = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (h) {
      flushList();
      const level = h[1].length;
      out.push(`<h${level}>${inlineTransforms(h[2])}</h${level}>`);
      continue;
    }

    // Liste non ordonnée
    const li = trimmed.match(/^[-*]\s+(.+)$/);
    if (li) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inlineTransforms(li[1])}</li>`);
      continue;
    }

    // Paragraphe normal
    flushList();
    out.push(`<p>${inlineTransforms(trimmed)}</p>`);
  }

  // Cleanup final
  if (inCode) {
    out.push(`<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">${escapeXml(codeLang || 'text')}</ac:parameter><ac:plain-text-body><![CDATA[${codeBuffer.join('\n')}]]></ac:plain-text-body></ac:structured-macro>`);
  }
  flushList();
  return out.filter((l) => l !== '').join('\n');
}

// ─── Recherche / création / mise à jour ────────────────────────────────────

/**
 * Cherche une page par titre dans un espace.
 *
 * @returns {Promise<object|null>} la page trouvée (id, version) ou null
 */
export async function trouverPage(config, { spaceId, title }, fetchFn) {
  const r = await appelerConfluence(config, {
    method: 'GET',
    path: '/api/v2/pages',
    query: { 'space-id': spaceId, title, limit: 1 },
  }, fetchFn);
  const results = (r.body && Array.isArray(r.body.results)) ? r.body.results : [];
  return results[0] || null;
}

/**
 * Crée une page (si absente) ou la met à jour (si présente).
 *
 * Idempotent par titre dans un espace.
 *
 * @param {object} config
 * @param {{ title: string, content: string, parentId?: string|null }} input
 * @param {Function} [fetchFn]
 * @returns {Promise<{ action: 'created'|'updated', page: object }>}
 */
export async function publierPage(config, input, fetchFn) {
  exigerEspace(config);
  if (!input.title) throw new Error('title requis.');
  if (typeof input.content !== 'string') throw new Error('content requis.');

  // Confluence v2 prend `spaceId` (numérique). Si seule la spaceKey est
  // fournie, on la résout via /api/v2/spaces?keys=KEY.
  let spaceId = config.spaceId;
  if (!spaceId && config.spaceKey) {
    const sr = await appelerConfluence(config, {
      method: 'GET',
      path: '/api/v2/spaces',
      query: { keys: config.spaceKey, limit: 1 },
    }, fetchFn);
    const found = sr.body?.results?.[0];
    if (!found) throw new Error(`Confluence space "${config.spaceKey}" introuvable.`);
    spaceId = String(found.id);
  }

  const existing = await trouverPage(config, { spaceId, title: input.title }, fetchFn);
  if (existing) {
    const next = (existing.version?.number || 1) + 1;
    const r = await appelerConfluence(config, {
      method: 'PUT',
      path: `/api/v2/pages/${existing.id}`,
      body: {
        id: existing.id,
        status: 'current',
        title: input.title,
        version: { number: next },
        body: { representation: 'storage', value: input.content },
      },
    }, fetchFn);
    return { action: 'updated', page: r.body };
  }

  const create = await appelerConfluence(config, {
    method: 'POST',
    path: '/api/v2/pages',
    body: {
      spaceId,
      status: 'current',
      title: input.title,
      parentId: input.parentId || null,
      body: { representation: 'storage', value: input.content },
    },
  }, fetchFn);
  return { action: 'created', page: create.body };
}

// ─── Pipeline export ───────────────────────────────────────────────────────

/**
 * Liste les fichiers Markdown du dossier .aiad/<sous>/ avec leur titre,
 * id (basename sans .md) et contenu.
 */
function lireArtefacts(racine, sous) {
  const dir = join(racine, '.aiad', sous);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_') && !f.startsWith('spec-ears-template'))
    .map((f) => {
      const path = join(dir, f);
      const contenu = readFileSync(path, 'utf-8');
      const { data, body } = parseFrontmatter(contenu);
      const id = f.replace(/\.md$/, '');
      return {
        id,
        title: data.title || data.titre || id,
        body,
        path,
        spec: data.spec || null,
        intent: data.intent || null,
      };
    });
}

/**
 * Pipeline complet : pour chaque Intent, crée une page ; pour chaque
 * SPEC, crée une sous-page liée à son Intent (si frontmatter `intent: ...`)
 * ou directement sous la page racine "AIAD".
 *
 * @param {string} racine
 * @param {{ pageRoot?: string, dryRun?: boolean, fetchFn?: Function }} options
 * @returns {Promise<{ pages: { kind: string, title: string, action: string }[] }>}
 */
export async function exporterArborescence(racine, options = {}) {
  const config = chargerConfig(options);
  const titreRoot = options.pageRoot || 'AIAD — Intents & SPECs';
  const intents = lireArtefacts(racine, 'intents');
  const specs = lireArtefacts(racine, 'specs');

  const pages = [];

  // 1) Page racine "AIAD"
  const rootContent = markdownVersStorage([
    `# ${titreRoot}`,
    '',
    'Page synchronisée automatiquement par `aiad-sdd export confluence`.',
    '',
    `Total : **${intents.length}** Intent(s) et **${specs.length}** SPEC(s).`,
    '',
    '---',
    '',
    'Documentation : https://aiad.ovh',
  ].join('\n'));

  let rootPageId = null;
  if (options.dryRun) {
    pages.push({ kind: 'root', title: titreRoot, action: 'dry-run' });
  } else {
    const r = await publierPage(config, { title: titreRoot, content: rootContent }, options.fetchFn);
    pages.push({ kind: 'root', title: titreRoot, action: r.action });
    rootPageId = r.page?.id;
  }

  // 2) Pages Intent
  const intentPageIds = new Map();
  for (const it of intents) {
    const md = [
      `# ${it.title}`,
      '',
      it.body.trim(),
      '',
      '---',
      '',
      `_Synchronisé depuis \`.aiad/intents/${it.id}.md\` via \`aiad-sdd export confluence\`._`,
    ].join('\n');
    const content = markdownVersStorage(md);
    const title = `[${it.id}] ${it.title}`;
    if (options.dryRun) {
      pages.push({ kind: 'intent', title, action: 'dry-run' });
      intentPageIds.set(it.id, null);
    } else {
      const r = await publierPage(config, { title, content, parentId: rootPageId }, options.fetchFn);
      pages.push({ kind: 'intent', title, action: r.action });
      intentPageIds.set(it.id, r.page?.id);
    }
  }

  // 3) Pages SPEC (sous l'Intent référencé ou sous la racine)
  for (const sp of specs) {
    const md = [
      `# ${sp.title}`,
      '',
      sp.body.trim(),
      '',
      '---',
      '',
      `_Synchronisé depuis \`.aiad/specs/${sp.id}.md\` via \`aiad-sdd export confluence\`._`,
    ].join('\n');
    const content = markdownVersStorage(md);
    const title = `[${sp.id}] ${sp.title}`;
    const intentId = sp.intent;
    const parentId = (intentId && intentPageIds.has(intentId))
      ? intentPageIds.get(intentId)
      : rootPageId;
    if (options.dryRun) {
      pages.push({ kind: 'spec', title, action: 'dry-run' });
    } else {
      const r = await publierPage(config, { title, content, parentId }, options.fetchFn);
      pages.push({ kind: 'spec', title, action: r.action });
    }
  }

  return { pages, total: pages.length };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  chargerConfig as loadConfig,
  appelerConfluence as callConfluence,
  markdownVersStorage as markdownToStorage,
  trouverPage as findPage,
  publierPage as publishPage,
  exporterArborescence as exportTree,
};

export const CONSTANTS = {
  TIMEOUT_MS,
};
