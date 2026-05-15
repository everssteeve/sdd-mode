// AIAD SDD Mode — Dashboard : single-page Intent view (#453).
//
// Génère 1 fichier HTML autonome par Intent (`intent-INTENT-NNN-slug.html`)
// dans le dossier `dashboard/`. La page consolide tous les signaux PM
// d'un Intent en une seule vue (sections POURQUOI/POUR QUI/etc., SPECs
// liées avec statut, risques, hypothèse, dépendances, OKR, tags, etc.)
// pour un deep-dive du PM sans avoir à scanner pm.html.
//
// Aucun effet de bord côté façade pure (`construirePageIntent`). L'écriture
// fichiers est faite par `genererPagesIntents` qui retourne la liste.
//
// Documentation : https://aiad.ovh

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { escape, lienSource, statutBadge } from './render.js';
import { detailIntentHtml, indexerContextePm, searchBlobIntent } from './pm.js';
import { badgePriorite } from './intent-priority.js';
import { rendreSectionIntent } from './markdown-light.js';

// Slug d'URL pour le nom de fichier. Cohérent avec le pattern court
// `INTENT-NNN-slug` déjà utilisé dans les fichiers .md.
export function slugForFile(intent) {
  if (intent?.file) {
    // Réutilise le basename du .md (sans extension) pour l'URL.
    const m = intent.file.match(/([^/]+)\.md$/);
    if (m) return m[1];
  }
  return String(intent?.id || 'unknown');
}

function rendreLien(intent) {
  return `intent-${slugForFile(intent)}.html`;
}

export { rendreLien };

function blocSections(intent) {
  const s = intent?.sections;
  if (!s) return '<p class="muted">Sections POURQUOI / POUR QUI / OBJECTIF / CONTRAINTES / CRITÈRE DE DRIFT non détectées dans le corps de l\'Intent.</p>';
  const titres = {
    pourquoi: 'POURQUOI MAINTENANT',
    pourQui: 'POUR QUI',
    objectif: 'OBJECTIF',
    contraintes: 'CONTRAINTES',
    critereDrift: 'CRITÈRE DE DRIFT',
  };
  return Object.entries(titres).map(([k, label]) => {
    const v = s[k];
    // (#461) Markdown léger : transforme **gras**, *italic*, listes,
    // refs AIAD (INTENT-NNN/SPEC-NNN-N/etc.) en HTML lisible.
    return `<section><h3>${escape(label)}</h3>${v ? rendreSectionIntent(v) : '<p class="muted">— non renseigné</p>'}</section>`;
  }).join('');
}

function blocSpecsLiees(intent, specsLies, avancement) {
  if (!specsLies || specsLies.length === 0) {
    return '<p class="muted">Aucune SPEC liée. Lance <code>/sdd spec</code> dans Claude Code pour décomposer cet Intent.</p>';
  }
  const rows = specsLies.map((s) => {
    const idCell = s.file ? lienSource(s.file, s.id) : `<code>${escape(s.id)}</code>`;
    return `<tr>
      <td>${idCell}</td>
      <td>${escape(s.titre || '')}</td>
      <td>${statutBadge(s.statut)}</td>
      <td class="muted">${escape(s.sqs || '—')}</td>
    </tr>`;
  }).join('');
  const av = avancement ? `<p class="muted" style="font-size:.85rem">Avancement : <strong>${avancement.done}/${avancement.total}</strong> SPECs livrées (${Math.round((avancement.ratio || 0) * 100)} %), ${avancement.enCours} en cours.</p>` : '';
  return `${av}<table><thead><tr><th>ID</th><th>Titre</th><th>Statut</th><th>SQS</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function blocRisques(intent, risksData) {
  if (!risksData) return '';
  const item = risksData.intents.find((r) => r.id === intent.id);
  if (!item) return '<p class="muted">Aucun risque détecté (frontmatter <code>risks:</code> ni heuristique sur CONTRAINTES).</p>';
  const niveau = { critical: 'badge-bad', high: 'badge-bad', medium: 'badge-warn', low: 'badge-info' }[item.niveau] || 'badge-muted';
  const chips = item.risques.map((r) => `<span class="badge ${niveau}" style="font-size:.78rem">${escape(r.texte)}</span>`).join(' ');
  return `<p>Niveau global : <strong>${escape(item.niveau)}</strong></p><div>${chips}</div>`;
}

function blocHypothese(intent) {
  const hyp = intent.hypothesis || intent.hypothese || intent['hypothèse'];
  if (!hyp) return '<p class="muted">Aucune hypothèse déclarée (frontmatter <code>hypothesis:</code>).</p>';
  const statut = intent.hypothesis_status || intent.hypothesisStatus || 'untested';
  const cls = { validated: 'badge-ok', invalidated: 'badge-bad', partial: 'badge-info', untested: 'badge-warn' }[statut] || 'badge-muted';
  return `<p><span class="badge ${cls}">${escape(statut)}</span></p><pre>${escape(String(hyp))}</pre>`;
}

function blocDeps(intent, depsData) {
  if (!depsData) return '';
  const item = depsData.intents?.find((d) => d.id === intent.id);
  if (!item) return '<p class="muted">Aucune dépendance déclarée.</p>';
  const bp = item.bloquePar.map((b) => {
    const idCell = b.file ? lienSource(b.file, b.id) : `<code>${escape(b.id)}</code>`;
    return `${idCell} (${escape(b.statut || '?')})`;
  }).join(' · ') || '<em class="muted">aucune</em>';
  const bq = item.bloque.map((b) => {
    const idCell = b.file ? lienSource(b.file, b.id) : `<code>${escape(b.id)}</code>`;
    return `${idCell} (${escape(b.statut || '?')})`;
  }).join(' · ') || '<em class="muted">aucun</em>';
  return `<p><strong>Bloqué par</strong> : ${bp}</p><p><strong>Bloque</strong> : ${bq}</p>`;
}

function blocMeta(intent) {
  const lignes = [];
  if (intent.statut) lignes.push(`<tr><td><strong>Statut</strong></td><td>${statutBadge(intent.statut)}</td></tr>`);
  if (intent.priority || intent.rice || intent.wsjf) lignes.push(`<tr><td><strong>Priorité</strong></td><td>${badgePriorite(intent)}</td></tr>`);
  if (intent.owner || intent.pm) lignes.push(`<tr><td><strong>Owner</strong></td><td>${escape(intent.owner || intent.pm)}</td></tr>`);
  if (intent.sponsor) lignes.push(`<tr><td><strong>Sponsor</strong></td><td>${escape(intent.sponsor)}</td></tr>`);
  if (intent.target) lignes.push(`<tr><td><strong>Target</strong></td><td>${escape(intent.target)}</td></tr>`);
  if (intent.target_date) lignes.push(`<tr><td><strong>Target date</strong></td><td>${escape(intent.target_date)}</td></tr>`);
  if (intent.okr || intent.okrs) {
    const refs = [].concat(intent.okrs || [], intent.okr ? [intent.okr] : []);
    lignes.push(`<tr><td><strong>OKR</strong></td><td>${refs.map((r) => `<code>${escape(r)}</code>`).join(' ')}</td></tr>`);
  }
  if (intent.kind || intent.track) lignes.push(`<tr><td><strong>Kind</strong></td><td><code>${escape(intent.kind || intent.track)}</code></td></tr>`);
  if (intent.tags || intent.labels) {
    const tags = [].concat(intent.tags || intent.labels || []);
    lignes.push(`<tr><td><strong>Tags</strong></td><td>${tags.map((t) => `<span class="badge badge-info" style="font-size:.75rem">#${escape(t)}</span>`).join(' ')}</td></tr>`);
  }
  if (intent.date) lignes.push(`<tr><td><strong>Date</strong></td><td>${escape(intent.date)}</td></tr>`);
  if (intent.auteur) lignes.push(`<tr><td><strong>Auteur</strong></td><td>${escape(intent.auteur)}</td></tr>`);
  return `<table>${lignes.join('')}</table>`;
}

// Construit le body HTML d'une page Intent unique.
export function construirePageIntent(intent, donnees) {
  const ctxPm = indexerContextePm(donnees);
  const av = ctxPm.avancementById.get(intent.id);
  const specsLies = ctxPm.specsParIntentId.get(intent.id) || [];
  const fileLien = intent.file ? lienSource(intent.file, intent.id) : `<code>${escape(intent.id)}</code>`;
  return `<style>
    .ip-cols { display:grid; grid-template-columns: 1fr 280px; gap: 1.5rem; align-items: start; }
    @media (max-width: 900px) { .ip-cols { grid-template-columns: 1fr; } }
    .ip-meta table { width:100%; font-size:.85rem; }
    .ip-meta td { padding:.25rem .4rem; vertical-align:top; }
    .ip-meta td:first-child { width: 110px; color: var(--muted, #777); font-size:.78rem; }
    .ip-sections > section { margin-bottom: 1rem; padding: .6rem .8rem; background: rgba(127,127,127,.04); border-radius:.3rem; }
    .ip-sections h3 { font-size:.8rem; text-transform:uppercase; letter-spacing:.04em; color: var(--muted, #777); margin: 0 0 .35rem; }
    .ip-sections pre { margin:0; white-space:pre-wrap; font-family: inherit; font-size:.88rem; line-height:1.45; }
    .ip-actions { margin-top: 1rem; display:flex; gap:.5rem; flex-wrap:wrap; font-size:.85rem; }
    .ip-actions a { padding:.3rem .6rem; background:rgba(76,110,245,.1); color:#3a4cba; border-radius:.25rem; text-decoration:none; }
    .ip-actions a:hover { background:rgba(76,110,245,.18); }
  </style>
<div class="ip-cols">
  <div class="ip-sections">
    <h2>${fileLien} — ${escape(intent.titre || '')}</h2>
    ${blocSections(intent)}
    <section><h3>SPECs liées</h3>${blocSpecsLiees(intent, specsLies, av)}</section>
    <section><h3>Risques</h3>${blocRisques(intent, donnees.risks)}</section>
    <section><h3>Hypothèse</h3>${blocHypothese(intent)}</section>
    <section><h3>Dépendances</h3>${blocDeps(intent, donnees.intentDeps)}</section>
    <div class="ip-actions">
      <a href="pm.html">← Cockpit PM</a>
      <a href="intents.html">← Catalogue Intents</a>
      ${intent.file ? `<a href="${escape('../' + intent.file)}" target="_blank">Ouvrir le fichier .md</a>` : ''}
    </div>
  </div>
  <aside class="ip-meta">
    <h3 style="font-size:.78rem; text-transform:uppercase; letter-spacing:.04em; color: var(--muted, #777); margin: 0 0 .3rem">Métadonnées</h3>
    ${blocMeta(intent)}
  </aside>
</div>`;
}

// Génère les pages HTML. Retourne `[{file, intentId}, …]` pour le caller
// puisse les ajouter à sa liste `ecrits[]`.
export function genererPagesIntents(donnees, options) {
  const outDir = options.outDir;
  const layout = options.layout;
  const fichiers = [];
  for (const intent of donnees.intents || []) {
    const slug = slugForFile(intent);
    const fichier = `intent-${slug}.html`;
    const body = construirePageIntent(intent, donnees);
    const html = layout({
      slug: 'intent-detail',
      titre: `${intent.id} — ${intent.titre || ''}`,
      sous: 'Vue détaillée Intent — sections, SPECs, risques, hypothèse, dépendances',
      donnees,
      body,
    });
    const chemin = join(outDir, fichier);
    writeFileSync(chemin, html, 'utf-8');
    fichiers.push({ file: fichier, intentId: intent.id });
  }
  return fichiers;
}

// ─── Rendu du bloc lien sur pm.html ──────────────────────────────────────────

const IP_LIST_CSS = `<style>
.ip-list-links { display:grid; gap:.3rem; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); margin:.5rem 0; }
.ip-list-link { padding:.35rem .55rem; background:rgba(127,127,127,.05); border-radius:.25rem; font-size:.85rem; text-decoration:none; color:inherit; border:1px solid var(--border, #ddd); }
.ip-list-link:hover { background:rgba(76,110,245,.06); border-color:rgba(76,110,245,.3); }
</style>`;

export function blocIntentPagesIndex(donnees) {
  const intents = donnees?.intents || [];
  if (intents.length === 0) return '';
  const links = intents.map((i) => {
    return `<a class="ip-list-link" href="${rendreLien(i)}"><code>${escape(i.id)}</code> — ${escape(i.titre || '')}</a>`;
  }).join('');
  return `${IP_LIST_CSS}<section>
    <h2>Pages détaillées Intent <span class="count">${intents.length} pages générées</span></h2>
    <p class="muted" style="font-size:.85rem">Chaque Intent dispose de sa propre page HTML autonome avec ses 5 sections canoniques + SPECs + risques + hypothèse + dépendances + métadonnées (priorité, owner, sponsor, OKR, tags). Idéal pour deep-dive PM sans scanner pm.html.</p>
    <div class="ip-list-links">${links}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  slugForFile as slugForFilename,
  rendreLien as intentPageLink,
  construirePageIntent as buildIntentPage,
  genererPagesIntents as generateIntentPages,
  blocIntentPagesIndex as intentPagesIndexSection,
};
