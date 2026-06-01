// AIAD SDD Mode — Storybook des commandes slash (zero-dep, page HTML statique).
//
// Génère une page de documentation interactive qui présente les ~30
// commandes slash (`/sdd init`, `/sdd intent`, `/aiad status`, …) avec :
//   - Frontmatter (description courte)
//   - Input attendu / Output produit
//   - Bloc "Fast path" expert
//   - Bloc "Mode guidé" pas-à-pas
//   - Lien vers la source `.claude/sdd/<cmd>.md` ou `.claude/aiad/<cmd>.md`
//
// **Cap zero-dep** : aucune dépendance Storybook réelle. Implémentation
// HTML statique avec recherche JS + filtres + thème dark/light cohérent
// avec le dashboard existant.
//
// **Cas d'usage** :
//   - Documentation interactive auto-générée
//   - Onboarding nouveau membre — voir toutes les commandes en 1 page
//   - Comparer les commandes /sdd vs /aiad
//
// Usage : `aiad-sdd storybook [--out path] [--dry-run]`
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncFile } from './fs-ops.js';
import { C, log, logHeader } from './term.js';
import { parseFrontmatter } from './frontmatter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

// ─── Collecte des commandes (templates/.claude/sdd + aiad) ──────────────────

/**
 * Liste les commandes slash trouvées dans un dossier templates.
 *
 * @param {string} racine — répertoire des sous-commandes (sdd/, aiad/)
 * @returns {{ id: string, namespace: string, path: string, frontmatter: object, body: string }[]}
 */
export function lireCommandesSlash(racine, namespace) {
  if (!existsSync(racine)) return [];
  const out = [];
  for (const nom of readdirSync(racine)) {
    if (!nom.endsWith('.md')) continue;
    const id = nom.replace(/\.md$/, '');
    if (id === 'README' || id.startsWith('_')) continue;
    const path = join(racine, nom);
    try {
      const contenu = readFileSync(path, 'utf-8');
      const { data, body } = parseFrontmatter(contenu);
      out.push({
        id,
        namespace,
        path,
        frontmatter: data,
        body: body || contenu,
      });
    } catch { /* ignore */ }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Collecte toutes les commandes (`/sdd` + `/aiad` + `/aiad-help`) depuis
 * les templates internes du paquet.
 */
export function collecterCommandes() {
  const dossiers = [
    { dir: join(TEMPLATES_DIR, '.claude', 'sdd'), ns: 'sdd' },
    { dir: join(TEMPLATES_DIR, '.claude', 'aiad'), ns: 'aiad' },
    { dir: join(TEMPLATES_DIR, '.claude', 'aiad-help'), ns: 'aiad-help' },
  ];
  const out = [];
  for (const { dir, ns } of dossiers) {
    out.push(...lireCommandesSlash(dir, ns));
  }
  return out;
}

// ─── Extraction des sections clés ───────────────────────────────────────────

/**
 * Extrait les sections "Fast path" et "Mode guidé" d'un body Markdown.
 *
 * @param {string} body
 * @returns {{ fastPath: string, modeGuide: string, regles: string }}
 */
export function extraireSections(body) {
  const m = String(body || '');
  const fastPathMatch = m.match(/##\s*🚀?\s*Fast path[^\n]*\n([\s\S]*?)(?=\n##\s|$)/);
  const modeGuideMatch = m.match(/##\s*📖?\s*Mode guidé[^\n]*\n([\s\S]*?)(?=\n##\s|$)/);
  const reglesMatch = m.match(/##\s*Règles\b[^\n]*\n([\s\S]*?)(?=\n##\s|$)/);
  return {
    fastPath: fastPathMatch ? fastPathMatch[1].trim() : '',
    modeGuide: modeGuideMatch ? modeGuideMatch[1].trim() : '',
    regles: reglesMatch ? reglesMatch[1].trim() : '',
  };
}

// ─── Helpers HTML ────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Rend une commande en card HTML.
 */
export function rendreCard(cmd) {
  const desc = cmd.frontmatter.description || '*(pas de description)*';
  const sections = extraireSections(cmd.body);
  const slashName = `/${cmd.namespace} ${cmd.id}`;
  const pathRel = cmd.path.replace(/^.*templates\//, 'templates/');

  return `<article class="cmd" data-namespace="${cmd.namespace}" data-id="${escapeHtml(cmd.id)}" data-search="${escapeHtml((cmd.id + ' ' + desc).toLowerCase())}">
  <header>
    <span class="ns ns-${cmd.namespace}">${cmd.namespace}</span>
    <code class="slash">${escapeHtml(slashName)}</code>
  </header>
  <p class="desc">${escapeHtml(desc)}</p>
  ${sections.fastPath ? `<details><summary>🚀 Fast path</summary><pre>${escapeHtml(sections.fastPath.slice(0, 600))}</pre></details>` : ''}
  ${sections.modeGuide ? `<details><summary>📖 Mode guidé</summary><pre>${escapeHtml(sections.modeGuide.slice(0, 600))}</pre></details>` : ''}
  ${sections.regles ? `<details><summary>⚖ Règles</summary><pre>${escapeHtml(sections.regles.slice(0, 400))}</pre></details>` : ''}
  <footer><code>${escapeHtml(pathRel)}</code></footer>
</article>`;
}

const CSS = `
* { box-sizing: border-box; }
body { font-family: -apple-system, system-ui, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; line-height: 1.5; }
header.page { padding: 1.5rem 2rem; background: #1e293b; border-bottom: 1px solid #334155; position: sticky; top: 0; z-index: 10; }
header.page h1 { margin: 0 0 0.5rem 0; font-size: 1.4rem; }
header.page p { margin: 0; color: #94a3b8; font-size: 0.9rem; }
.toolbar { padding: 1rem 2rem; background: #1e293b; border-bottom: 1px solid #334155; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
.toolbar input { flex: 1; min-width: 200px; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #e2e8f0; font-size: 0.9rem; }
.filters label { padding: 0.3rem 0.6rem; border-radius: 6px; cursor: pointer; user-select: none; font-size: 0.85rem; }
.filters input[type=checkbox] { margin-right: 0.3rem; }
main { padding: 2rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 1rem; }
.cmd { background: #1e293b; border-radius: 8px; padding: 1rem; border: 1px solid #334155; transition: border-color 0.15s; }
.cmd:hover { border-color: #64748b; }
.cmd header { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; }
.cmd .ns { font-size: 0.7rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 600; text-transform: uppercase; }
.ns-sdd { background: #3b82f6; color: white; }
.ns-aiad { background: #ec4899; color: white; }
.ns-aiad-help { background: #8b5cf6; color: white; }
.cmd .slash { background: #0f172a; padding: 0.25rem 0.5rem; border-radius: 4px; color: #e2e8f0; font-size: 0.85rem; }
.cmd .desc { color: #cbd5e1; font-size: 0.9rem; margin: 0.5rem 0; }
.cmd details { margin-top: 0.5rem; }
.cmd summary { cursor: pointer; font-size: 0.85rem; color: #94a3b8; padding: 0.25rem 0; }
.cmd summary:hover { color: #cbd5e1; }
.cmd pre { background: #0f172a; padding: 0.75rem; border-radius: 6px; overflow-x: auto; font-size: 0.78rem; max-height: 240px; white-space: pre-wrap; }
.cmd footer { margin-top: 0.75rem; font-size: 0.7rem; color: #64748b; border-top: 1px solid #334155; padding-top: 0.5rem; }
.cmd footer code { background: transparent; }
.empty { text-align: center; padding: 3rem; color: #94a3b8; }
.cmd.hidden { display: none; }
@media (prefers-color-scheme: light) {
  body { background: #f8fafc; color: #0f172a; }
  header.page, .toolbar, .cmd { background: white; border-color: #e2e8f0; }
  .toolbar input, .cmd pre { background: #f1f5f9; color: #0f172a; border-color: #cbd5e1; }
  .cmd .desc { color: #475569; }
  .cmd .slash { background: #e2e8f0; color: #0f172a; }
}
`;

const JS = `
(function() {
  const search = document.getElementById('search');
  const filters = document.querySelectorAll('.filters input[type=checkbox]');
  const cards = Array.from(document.querySelectorAll('.cmd'));
  const counter = document.getElementById('counter');

  const actifs = new Set(['sdd', 'aiad', 'aiad-help']);

  function refresh() {
    const q = (search.value || '').toLowerCase().trim();
    let visibles = 0;
    for (const card of cards) {
      const ns = card.dataset.namespace;
      const txt = card.dataset.search;
      const matchNs = actifs.has(ns);
      const matchSearch = !q || txt.includes(q);
      const visible = matchNs && matchSearch;
      card.classList.toggle('hidden', !visible);
      if (visible) visibles++;
    }
    if (counter) counter.textContent = visibles + ' commande(s)';
  }

  search.addEventListener('input', refresh);
  filters.forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) actifs.add(cb.dataset.ns);
      else actifs.delete(cb.dataset.ns);
      refresh();
    });
  });

  refresh();
})();
`;

/**
 * Construit la page HTML complète.
 *
 * @param {object[]} commandes
 * @returns {string} HTML
 */
export function genererHtml(commandes) {
  const counts = commandes.reduce((acc, c) => {
    acc[c.namespace] = (acc[c.namespace] || 0) + 1;
    return acc;
  }, {});
  const cards = commandes.map(rendreCard).join('\n');
  const total = commandes.length;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AIAD SDD — Storybook des commandes slash</title>
<style>${CSS}</style>
</head>
<body>
<header class="page">
  <h1>AIAD SDD — Storybook des commandes slash</h1>
  <p>Documentation interactive des ${total} commandes <code>/sdd</code>, <code>/aiad</code> et <code>/aiad-help</code>. Tape pour rechercher, filtre par namespace, déplie pour voir Fast path / Mode guidé / Règles.</p>
</header>
<div class="toolbar">
  <input type="search" id="search" placeholder="Rechercher (ex. trace, intent, gouvernance)…" autofocus>
  <div class="filters">
    <label><input type="checkbox" data-ns="sdd" checked> /sdd (${counts.sdd || 0})</label>
    <label><input type="checkbox" data-ns="aiad" checked> /aiad (${counts.aiad || 0})</label>
    <label><input type="checkbox" data-ns="aiad-help" checked> /aiad-help (${counts['aiad-help'] || 0})</label>
  </div>
  <span id="counter">${total} commande(s)</span>
</div>
<main>
  <div class="grid">${cards}</div>
  <p class="empty" style="display:none">Aucune commande ne correspond à la recherche.</p>
</main>
<script>${JS}</script>
</body>
</html>`;
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Génère le storybook HTML.
 *
 * @param {string} racine
 * @param {{ out?: string, dryRun?: boolean, json?: boolean }} [options]
 * @returns {Promise<{ path: string|null, count: number }>}
 */
export async function genererStorybook(racine, options = {}) {
  const { out, dryRun = false, json = false } = options;
  const commandes = collecterCommandes();

  if (json) {
    process.stdout.write(JSON.stringify({
      total: commandes.length,
      byNamespace: commandes.reduce((acc, c) => { acc[c.namespace] = (acc[c.namespace] || 0) + 1; return acc; }, {}),
      commands: commandes.map((c) => ({
        id: c.id,
        namespace: c.namespace,
        description: c.frontmatter.description || '',
      })),
    }, null, 2) + '\n');
    return { path: null, count: commandes.length };
  }

  const dest = out
    ? join(racine, out)
    : join(racine, 'dashboard', 'storybook.html');

  logHeader(
    'AIAD SDD — Storybook commandes slash',
    `${commandes.length} commandes (zero-dep, autonome)`,
  );

  if (commandes.length === 0) {
    console.log(`  ${C.jaune}~${C.reset} Aucune commande slash trouvée dans templates/.claude/.\n`);
    return { path: null, count: 0 };
  }

  if (!dryRun) {
    const parentDir = dirname(dest);
    if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
  }

  const html = genererHtml(commandes);
  const result = syncFile(dest, html, { dryRun });
  const sym = result === 'created' ? `${C.vert}+${C.reset}`
    : result === 'updated' ? `${C.cyan}↑${C.reset}`
    : `${C.vert}✓${C.reset}`;
  log(sym, `${dest.replace(racine + '/', '')}${dryRun ? ` ${C.gris}(dry-run)${C.reset}` : ''}`);

  console.log(`
${C.gras}  Synthèse${C.reset}
    Commandes /sdd        : ${C.cyan}${commandes.filter((c) => c.namespace === 'sdd').length}${C.reset}
    Commandes /aiad       : ${C.cyan}${commandes.filter((c) => c.namespace === 'aiad').length}${C.reset}
    Commandes /aiad-help  : ${C.cyan}${commandes.filter((c) => c.namespace === 'aiad-help').length}${C.reset}
    Total                 : ${C.cyan}${commandes.length}${C.reset}

${C.gris}  Ouvre le fichier dans un navigateur pour explorer les commandes interactives.${C.reset}
`);

  return { path: dest, count: commandes.length };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  lireCommandesSlash as listSlashCommands,
  collecterCommandes as collectCommands,
  extraireSections as extractSections,
  rendreCard as renderCard,
  genererHtml as buildHtml,
  genererStorybook as generateStorybook,
};
