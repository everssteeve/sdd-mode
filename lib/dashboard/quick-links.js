// AIAD SDD Mode — Dashboard : quick links hub PM (#467).
//
// Permet au PM de lancer ses outils externes (Notion, Slack, Jira,
// Calendar, Figma…) depuis pm.html. Lit `.aiad/pm-links.yml` (format
// libre) ou frontmatter `quick_links:` du PRD.
//
// Format `.aiad/pm-links.yml` :
//   - label: Notion roadmap
//     url: https://notion.so/...
//     icone: 📒
//   - label: Slack #product
//     url: https://slack.com/...
//     icone: 💬
//
// Allowlist URL strict (https/http/mailto) — protège contre XSS.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseFrontmatter } from '../frontmatter.js';
import { lireFichier } from './collect.js';

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

function urlSafe(url) {
  if (typeof url !== 'string') return null;
  const trim = url.trim();
  if (SAFE_URL.test(trim)) return trim;
  return null;
}

// Parser minimal YAML list of objects — sans dep. Accepte aussi un array
// dans le frontmatter du PRD.
function parserListeYamlInline(contenu) {
  const liens = [];
  const lignes = contenu.split(/\r?\n/);
  let courant = null;
  for (const l of lignes) {
    if (/^\s*$/.test(l)) continue;
    if (/^\s*#/.test(l)) continue; // commentaire YAML
    const debutItem = l.match(/^\s*-\s+(.*)$/);
    if (debutItem) {
      if (courant) liens.push(courant);
      courant = {};
      const reste = debutItem[1];
      if (reste) {
        // Forme inline : `- label: X, url: Y` ou `- key: val`
        const m = reste.match(/^([a-zA-Z_]+)\s*:\s*(.+)$/);
        if (m) courant[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, '');
      }
      continue;
    }
    const m = l.match(/^\s+([a-zA-Z_]+)\s*:\s*(.+)$/);
    if (m && courant) courant[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  if (courant && Object.keys(courant).length > 0) liens.push(courant);
  return liens;
}

export function lireQuickLinks(racineProjet) {
  // (a) Fichier dédié `.aiad/pm-links.yml`
  const fichier = join(racineProjet, '.aiad', 'pm-links.yml');
  if (existsSync(fichier)) {
    const contenu = lireFichier(fichier);
    if (contenu) {
      const liens = parserListeYamlInline(contenu);
      return {
        source: relative(racineProjet, fichier),
        liens: liens.map(normaliserLien).filter(Boolean),
      };
    }
  }
  // (b) Frontmatter PRD `quick_links: [...]`
  const prd = lireFichier(join(racineProjet, '.aiad', 'PRD.md'));
  if (prd) {
    const { data } = parseFrontmatter(prd);
    const cand = data.quick_links || data.quickLinks || data.links;
    if (Array.isArray(cand)) {
      return {
        source: '.aiad/PRD.md (frontmatter)',
        liens: cand.map(normaliserLien).filter(Boolean),
      };
    }
  }
  return { source: null, liens: [] };
}

function normaliserLien(item) {
  if (!item) return null;
  const label = item.label || item.titre || item.name || item.nom;
  const url = urlSafe(item.url || item.href || item.lien);
  if (!label || !url) return null;
  return {
    label: String(label).trim(),
    url,
    icone: item.icone || item.icon || item.emoji || '🔗',
    description: item.description || item.desc || '',
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const QL_CSS = `<style>
.ql-grid { display: grid; gap: .5rem; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin: .5rem 0; }
.ql-link {
  display: flex; align-items: center; gap: .55rem;
  padding: .55rem .7rem; background: var(--card-bg, #fff);
  border: 1px solid var(--border, #ddd); border-radius: .4rem;
  text-decoration: none; color: inherit; font-size: .85rem;
  transition: background .15s, border-color .15s;
}
.ql-link:hover { background: rgba(76,110,245,.06); border-color: rgba(76,110,245,.3); }
.ql-icone { font-size: 1.2rem; line-height: 1; flex-shrink: 0; }
.ql-content { flex: 1; min-width: 0; }
.ql-label { font-weight: 500; }
.ql-desc { font-size: .72rem; color: var(--muted, #777); margin-top: .1rem; }
@media print { .ql-link { background: #fff !important; border: 1px solid #888; } }
</style>`;

export function blocQuickLinks(donnees) {
  const q = donnees?.quickLinks;
  if (!q) return '';
  if (q.liens.length === 0) {
    return `<section>
      <h2>Liens rapides <span class="count">aucun lien configuré</span></h2>
      <p class="muted" style="font-size:.85rem">Configurer dans <code>.aiad/pm-links.yml</code> (1 lien par item) ou frontmatter PRD <code>quick_links: [...]</code>. URLs limitées à http/https/mailto pour la sécurité.</p>
    </section>`;
  }
  const cards = q.liens.map((l) => {
    const desc = l.description ? `<div class="ql-desc">${escape(l.description)}</div>` : '';
    return `<a class="ql-link" href="${escape(l.url)}" target="_blank" rel="noopener" title="${escape(l.label)}">
      <span class="ql-icone" aria-hidden="true">${escape(l.icone)}</span>
      <div class="ql-content">
        <div class="ql-label">${escape(l.label)}</div>
        ${desc}
      </div>
    </a>`;
  }).join('');
  return `${QL_CSS}<section>
    <h2>Liens rapides <span class="count">${q.liens.length} lien(s) · source : <code>${escape(q.source || '')}</code></span></h2>
    <p class="muted" style="font-size:.85rem">Outils externes du PM (Notion / Slack / Jira / Calendar / Figma / etc.) — ouverts dans un nouvel onglet. Edit via <code>${escape(q.source || '.aiad/pm-links.yml')}</code>.</p>
    <div class="ql-grid">${cards}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  lireQuickLinks as readQuickLinks,
  blocQuickLinks as quickLinksSection,
};
