// @spec SPEC-016-1-architecture-4-couches
// @intent INTENT-016
// @governance AIAD-RGAA

import { escape, lienSource } from '../ui/helpers.js';
import { statutBadge } from '../ui/badges.js';
import { distributionBar } from '../ui/sparklines.js';
import { pmTopBanner, detailIntentHtml, indexerContextePm, tagsIntent, searchBlobIntent } from '../pm.js';
import { badgePriorite, clePriorite } from '../intent-priority.js';

export function pageIntents(donnees) {
  if (donnees.intents.length === 0) {
    return `<div class="empty">
      <strong>Aucun Intent Statement.</strong>
      Le cycle SDD commence par un Intent : lance <code>/sdd intent</code> dans Claude Code pour capturer le POURQUOI d'une nouvelle fonctionnalité.
    </div>`;
  }
  // (#231) Contexte PM + helpers — externalisés dans pm.js pour respecter
  // le budget LOC de render.js.
  const ctxPm = indexerContextePm(donnees);
  const rows = donnees.intents.map((i) => {
    // Match court (#231) si la map en a, sinon fallback legacy. Couvre
    // l'ancien cas (parent_intent = id long exact) et le nouveau (parent_intent
    // court ↔ Intent ID long, vu sur le bench).
    const viaCourt = ctxPm.specsParIntentId.get(i.id);
    const viaLegacy = donnees.specsParIntent?.get(i.id);
    const specsLies = (viaCourt && viaCourt.length ? viaCourt : viaLegacy) || [];
    const specsCell = specsLies.length
      ? specsLies.map((s) => s.file ? lienSource(s.file, s.id) : `<code>${escape(s.id)}</code>`).join(' ')
      : '<em class="muted">aucune</em>';
    const av = ctxPm.avancementById.get(i.id);
    const tags = tagsIntent(i, specsLies, ctxPm);
    const detail = detailIntentHtml(i, av);
    // (#425) data-search-blob = corpus Intent body pour filtre full-text.
    return `<tr data-tags="${escape(tags.join(' '))}" data-statut="${escape(i.statut)}" data-search-blob="${escape(searchBlobIntent(i))}">
      <td>${i.file ? lienSource(i.file, i.id) : `<code>${escape(i.id)}</code>`}</td>
      <td><strong>${escape(i.titre)}</strong>
        <details class="intents-row-details"><summary>Voir détail Intent (POURQUOI / OBJECTIF / …)</summary>
          <div class="intents-details">${detail.sections}</div>
        </details></td>
      <td data-sort="${clePriorite(i)}">${badgePriorite(i)}</td>
      <td data-sort="${escape(i.statut)}">${statutBadge(i.statut)}</td>
      <td>${specsCell}</td>
      <td data-sort="${av?.ratio ?? -1}">${detail.progress}</td>
      <td class="muted">${escape(i.auteur || '—')}</td>
      <td class="muted" data-sort="${escape(i.date || '')}">${escape(i.date || '—')}</td>
    </tr>`;
  }).join('');

  const parStatut = {};
  for (const i of donnees.intents) {
    parStatut[i.statut] = (parStatut[i.statut] || 0) + 1;
  }
  const distParts = [
    { label: 'active', value: parStatut.active || 0, cls: 'seg-ok' },
    { label: 'in-progress', value: parStatut['in-progress'] || 0, cls: 'seg-info' },
    { label: 'draft', value: parStatut.draft || 0, cls: 'seg-warn' },
    { label: 'done', value: parStatut.done || 0, cls: 'seg-muted' },
    { label: 'archived', value: parStatut.archived || 0, cls: 'seg-muted' },
  ];

  const kpis = ['active', 'draft', 'done', 'archived'].map((s) => `
    <div class="kpi">
      <div class="label">${s}</div>
      <div class="value">${parStatut[s] || 0}</div>
    </div>`).join('');

  return `
${pmTopBanner(donnees)}
<div class="kpis">${kpis}</div>

<section>
  <h2>Répartition par statut</h2>
  <div class="card">${distributionBar(distParts)}</div>
</section>

<section>
  <h2>Catalogue <span class="count">${donnees.intents.length} intent(s)</span></h2>
  <div class="pm-filter-chips" data-pm-filter-target="tIntents" role="toolbar" aria-label="Filtres rapides PM">
    <button type="button" data-pm-filter="*" aria-pressed="true">Tous</button>
    <button type="button" data-pm-filter="zombie" aria-pressed="false">Zombies</button>
    <button type="button" data-pm-filter="draft-vieux" aria-pressed="false">Drafts &gt;14j</button>
    <button type="button" data-pm-filter="sans-spec" aria-pressed="false">Sans SPEC</button>
    <button type="button" data-pm-filter="sans-livraison" aria-pressed="false">Sans livraison</button>
  </div>
  <div class="filter"><input type="search" id="qIntents" data-filter-target="tIntents" placeholder="Filtrer par ID, titre, statut, auteur…"/></div>
  <table id="tIntents" data-sortable="true">
    <thead><tr><th>ID</th><th>Titre</th><th>Prio</th><th>Statut</th><th>SPECs liées</th><th>Avancement</th><th>Auteur</th><th>Date</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>
`;
}
