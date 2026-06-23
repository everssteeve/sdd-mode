// AIAD SDD Mode — Dashboard : single-page SPEC view (SPEC-017-4).
//
// Génère 1 fichier HTML autonome par SPEC (`spec-{slug}.html`)
// dans le dossier `dashboard/`. La page consolide critères d'acceptation,
// interface/API, dépendances et DoOD en une vue drill-down depuis specs.html.
//
// Pattern : miroir de intent-page.js — ne pas dupliquer la logique layout.
//
// @spec SPEC-017-4-pages-detail-spec
// @intent INTENT-017
// @governance AIAD-RGAA
// @verified-by test/dashboard-spec-pages.test.js

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { escape, lienSource } from './ui/helpers.js';
import { statutBadge, sqsBadge, badge } from './ui/badges.js';
import { slugForFile } from './intent-page.js';

// Nom de fichier HTML pour une SPEC. Utilise le champ `slug` enrichi par
// collect.js, ou dérive depuis `id` en dernier recours.
export function slugForSpec(spec) {
  if (spec?.slug) return `spec-${spec.slug}.html`;
  const id = String(spec?.id || 'unknown');
  return `spec-${id.replace(/^SPEC-/i, '')}.html`;
}

// Lien `<a>` vers la page détail d'une SPEC.
export function rendreLienSpec(spec) {
  return `<a href="${slugForSpec(spec)}">${escape(spec?.id || '?')}</a>`;
}

// ─── Blocs de section ────────────────────────────────────────────────────────

function blocCriteres(spec) {
  const cas = spec.criteresAcceptation || [];
  if (cas.length === 0) {
    return '<p>Aucun critère d\'acceptation défini.</p>';
  }
  return cas.map((ca) => {
    const isEars = String(spec.format || '').toLowerCase() === 'ears';
    const patBadge = (isEars && ca.pattern)
      ? ` <span class="badge badge-info ca-pattern" style="font-size:.72rem">${escape(ca.pattern)}</span>`
      : '';
    return `<div class="ca-item">
      <p><strong>${escape(ca.id)}</strong>${ca.titre ? ` — ${escape(ca.titre)}` : ''}${patBadge}</p>
      ${ca.texte ? `<blockquote class="ca-texte">${escape(ca.texte)}</blockquote>` : ''}
    </div>`;
  }).join('\n');
}

function blocInterface(spec) {
  const iface = spec.interface_;
  if (!iface) return '<p class="muted">Non définie.</p>';
  return `<pre><code>${escape(iface)}</code></pre>`;
}

function blocDeps(spec) {
  const deps = spec.dependances || [];
  if (deps.length === 0) return '<p class="muted">Aucune dépendance déclarée.</p>';
  return `<ul>${deps.map((d) => `<li>${escape(d)}</li>`).join('')}</ul>`;
}

function blocDood(spec) {
  const items = spec.dood || [];
  if (items.length === 0) return '<p class="muted">Non définie.</p>';
  return `<ul class="dood-list">${items.map((item) => {
    const texte = typeof item === 'string' ? item : (item.texte || '');
    const checked = typeof item === 'object' && item.checked;
    return `<li>${checked ? '☑' : '☐'} ${escape(texte)}</li>`;
  }).join('')}</ul>`;
}

function blocMeta(spec, donnees) {
  const intentsById = new Map((donnees?.intents || []).map((i) => [i.id, i]));
  const parentId = spec.parentIntent;
  const intentObj = parentId ? intentsById.get(parentId) : null;
  let intentLien;
  if (parentId) {
    if (intentObj?.file) {
      intentLien = `<a href="intent-${slugForFile(intentObj)}.html">${escape(parentId)}</a>`;
    } else {
      intentLien = `<code>${escape(parentId)}</code>`;
    }
  } else {
    intentLien = '<em class="muted">—</em>';
  }
  const lignes = [
    `<tr><th scope="row">Statut</th><td>${statutBadge(spec.statut)}</td></tr>`,
    `<tr><th scope="row">SQS</th><td>${sqsBadge(spec.sqs)}</td></tr>`,
    `<tr><th scope="row">Format</th><td>${badge(spec.format || 'prose', String(spec.format || '') === 'ears' ? 'badge-info' : 'badge-muted')}</td></tr>`,
    `<tr><th scope="row">Intent parent</th><td>${intentLien}</td></tr>`,
    spec.auteur ? `<tr><th scope="row">Auteur</th><td>${escape(spec.auteur)}</td></tr>` : '',
    spec.date ? `<tr><th scope="row">Date</th><td>${escape(spec.date)}</td></tr>` : '',
  ].filter(Boolean);
  return `<table><caption class="sr-only">Métadonnées de la SPEC</caption>${lignes.join('')}</table>`;
}

// ─── Corps de page ───────────────────────────────────────────────────────────

// Construit le body HTML d'une page SPEC unique.
// Note : le `<h1>` est inclus dans le body (CA-008b). Quand ce body est
// wrappé par `layout()`, le page-header contient aussi le titre en h1 via
// la CSS `page-header h1` — pour les pages détail on masque ce doublon.
export function construirePageSpec(spec, donnees) {
  const specLien = spec.file ? lienSource(spec.file, spec.id) : `<code>${escape(spec.id)}</code>`;
  const contexte = spec.contexte || null;
  return `<style>
  .sp-cols { display:grid; grid-template-columns: 1fr 260px; gap: 1.5rem; align-items: start; }
  @media (max-width: 900px) { .sp-cols { grid-template-columns: 1fr; } }
  .sp-meta table { width:100%; font-size:.85rem; }
  .sp-meta td { padding:.25rem .4rem; vertical-align:top; }
  .sp-meta td:first-child { width: 110px; color: var(--muted, #777); font-size:.78rem; }
  .sp-sections > section { margin-bottom: 1rem; padding: .6rem .8rem; background: rgba(127,127,127,.04); border-radius:.3rem; }
  .sp-sections h3 { font-size:.8rem; text-transform:uppercase; letter-spacing:.04em; color: var(--muted, #777); margin: 0 0 .35rem; }
  .ca-item { margin-bottom:.75rem; padding:.5rem; background:rgba(127,127,127,.03); border-left:2px solid var(--border,#ddd); border-radius:.2rem; }
  .ca-texte { margin:.4rem 0 0; padding:.4rem .6rem; background:rgba(76,110,245,.04); border-left:3px solid rgba(76,110,245,.3); font-size:.88rem; font-family:monospace; white-space:pre-wrap; }
  .dood-list { list-style:none; padding:0; }
  .dood-list li { padding:.15rem 0; font-size:.88rem; }
  .sp-actions { margin-top: 1rem; display:flex; gap:.5rem; flex-wrap:wrap; font-size:.85rem; }
  .sp-actions a { padding:.3rem .6rem; background:rgba(76,110,245,.1); color:#3a4cba; border-radius:.25rem; text-decoration:none; }
  .sp-actions a:hover { background:rgba(76,110,245,.18); }
  /* Masque le doublon h1 du page-header pour les pages détail SPEC */
  body:has(.sp-cols) .page-header h1 { display:none; }
</style>
<div class="sp-cols">
  <div class="sp-sections">
    <h1>${specLien} — ${escape(spec.titre || '')}</h1>

    <section aria-label="Contexte">
      <h3>§1 — Contexte</h3>
      ${contexte ? `<p>${escape(contexte)}</p>` : '<p class="muted">Non renseigné.</p>'}
    </section>

    <section aria-label="Critères d'acceptation">
      <h3>§3 — Critères d'acceptation</h3>
      ${blocCriteres(spec)}
    </section>

    <section aria-label="Interface / API">
      <h3>§4 — Interface / API</h3>
      ${blocInterface(spec)}
    </section>

    <section aria-label="Dépendances">
      <h3>§5 — Dépendances</h3>
      ${blocDeps(spec)}
    </section>

    <section aria-label="Definition of Output Done">
      <h3>§7 — Definition of Output Done</h3>
      ${blocDood(spec)}
    </section>

    <div class="sp-actions">
      <a href="specs.html">← Retour à la liste des SPECs</a>
      ${spec.file ? `<a href="${escape('../' + spec.file)}" target="_blank" rel="noopener">Ouvrir le fichier .md</a>` : ''}
    </div>
  </div>
  <aside class="sp-meta">
    <h3 style="font-size:.78rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted,#777); margin:0 0 .3rem">Métadonnées</h3>
    ${blocMeta(spec, donnees)}
  </aside>
</div>`;
}

// ─── Génération ──────────────────────────────────────────────────────────────

// Génère les pages HTML pour toutes les SPECs de `donnees.specs`.
// Retourne la liste des noms de fichiers écrits.
export function genererPagesSpecs(donnees, options) {
  const outDir = options.outDir;
  const layout = options.layout;
  const fichiers = [];
  for (const spec of donnees.specs || []) {
    if (!spec.id) {
      console.warn(`[spec-page] SPEC sans id : ${spec.file || '(chemin inconnu)'}`);
      continue;
    }
    const fichier = slugForSpec(spec);
    const body = construirePageSpec(spec, donnees);
    const html = layout({
      slug: 'spec-detail',
      titre: `${spec.id} — ${spec.titre || ''}`,
      sous: 'Vue détaillée SPEC — critères, interface, dépendances, DoOD',
      donnees,
      body,
    });
    const chemin = join(outDir, fichier);
    writeFileSync(chemin, html, 'utf-8');
    fichiers.push(fichier);
  }
  return fichiers;
}

// ─── Index sur specs.html ────────────────────────────────────────────────────

const SP_LIST_CSS = `<style>
.sp-list-links { display:grid; gap:.3rem; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); margin:.5rem 0; }
.sp-list-link { padding:.35rem .55rem; background:rgba(127,127,127,.05); border-radius:.25rem; font-size:.85rem; text-decoration:none; color:inherit; border:1px solid var(--border,#ddd); }
.sp-list-link:hover { background:rgba(76,110,245,.06); border-color:rgba(76,110,245,.3); }
</style>`;

export function blocSpecPagesIndex(donnees) {
  const specs = (donnees?.specs || []).filter((s) => s.id);
  if (specs.length === 0) return '';
  const links = specs.map((s) => {
    const label = s.titre
      ? `Page détail de la SPEC ${escape(s.id)} : ${escape(s.titre)}`
      : `Page détail de la SPEC ${escape(s.id)}`;
    return `<a class="sp-list-link" href="${slugForSpec(s)}" aria-label="${label}"><code>${escape(s.id)}</code>${s.titre ? ` — ${escape(s.titre)}` : ''}</a>`;
  }).join('');
  return `${SP_LIST_CSS}<section aria-label="Pages détaillées SPEC">
  <h2>Pages détaillées SPEC <span class="count">${specs.length} pages générées</span></h2>
  <p class="muted" style="font-size:.85rem">Chaque SPEC dispose de sa propre page HTML avec ses critères d'acceptation, interface, dépendances et DoOD.</p>
  <div class="sp-list-links">${links}</div>
</section>`;
}
