// @spec SPEC-016-1-architecture-4-couches
// @spec SPEC-017-4-pages-detail-spec
// @intent INTENT-016
// @intent INTENT-017
// @governance AIAD-RGAA

import { escape, lienSource } from '../ui/helpers.js';
import { badge, statutBadge, sqsBadge } from '../ui/badges.js';
import { distributionBar } from '../ui/sparklines.js';
import { blocSpecPagesIndex } from '../spec-page.js';

export function pageSpecs(donnees) {
  if (donnees.specs.length === 0) {
    return `<div class="empty">
      <strong>Aucune SPEC.</strong>
      Une fois un Intent capturé, lance <code>/sdd spec</code> (ou <code>/sdd spec --ears</code> pour la variante stricte) pour produire la spécification technique.
    </div>`;
  }
  // (#327) SPEC ID + Intent parent hyperliés vers fichiers sources.
  const intentsById = new Map(donnees.intents.map((i) => [i.id, i]));
  const rows = donnees.specs.map((s) => {
    const sqsNum = Number(s.sqs);
    const parent = s.parentIntent ? intentsById.get(s.parentIntent) : null;
    const cellParent = s.parentIntent
      ? (parent?.file ? lienSource(parent.file, s.parentIntent) : `<code>${escape(s.parentIntent)}</code>`)
      : '<em class="muted">—</em>';
    return `<tr>
    <td>${s.file ? lienSource(s.file, s.id) : `<code>${escape(s.id)}</code>`}</td>
    <td>
      <div class="row-cluster">
        <strong>${escape(s.titre)}</strong>
      </div>
    </td>
    <td>${cellParent}</td>
    <td data-sort="${escape(s.format)}">${badge(s.format, s.format === 'ears' ? 'badge-info' : 'badge-muted')}</td>
    <td data-sort="${isNaN(sqsNum) ? '' : sqsNum}">${sqsBadge(s.sqs)}</td>
    <td data-sort="${escape(s.statut)}">${statutBadge(s.statut)}</td>
    <td class="muted" data-sort="${escape(s.date || '')}">${escape(s.date || '—')}</td>
  </tr>`;
  }).join('');

  const parStatut = {};
  for (const s of donnees.specs) parStatut[s.statut] = (parStatut[s.statut] || 0) + 1;
  const earsCount = donnees.specs.filter((s) => s.format === 'ears').length;
  const sqsValeurs = donnees.specs.map((s) => Number(s.sqs)).filter((x) => !isNaN(x));
  const sqsMoy = sqsValeurs.length ? sqsValeurs.reduce((a, b) => a + b, 0) / sqsValeurs.length : null;

  const distSpec = [
    { label: 'done', value: parStatut.done || 0, cls: 'seg-ok' },
    { label: 'in-progress', value: parStatut['in-progress'] || 0, cls: 'seg-info' },
    { label: 'validation', value: parStatut.validation || 0, cls: 'seg-info' },
    { label: 'ready', value: parStatut.ready || 0, cls: 'seg-info' },
    { label: 'review', value: parStatut.review || 0, cls: 'seg-warn' },
    { label: 'draft', value: parStatut.draft || 0, cls: 'seg-warn' },
    { label: 'archived', value: parStatut.archived || 0, cls: 'seg-muted' },
  ];

  const sqsCls = sqsMoy == null ? '' : sqsMoy >= 4 ? 'ok' : sqsMoy >= 3 ? 'warn' : 'bad';

  const kpis = `
    <div class="kpi"><div class="label">Total</div><div class="value">${donnees.specs.length}</div></div>
    <div class="kpi ${sqsCls}"><div class="label">SQS moyen</div><div class="value">${sqsMoy != null ? sqsMoy.toFixed(1) + '/5' : '—'}</div></div>
    <div class="kpi"><div class="label">Done</div><div class="value">${parStatut.done || 0}</div></div>
    <div class="kpi"><div class="label">In progress</div><div class="value">${parStatut['in-progress'] || 0}</div></div>
    <div class="kpi"><div class="label">Draft / Review</div><div class="value">${(parStatut.draft || 0) + (parStatut.review || 0)}</div></div>
    <div class="kpi"><div class="label">Format EARS</div><div class="value">${earsCount}</div></div>
  `;

  return `
<div class="kpis">${kpis}</div>

<section>
  <h2>Répartition par statut</h2>
  <div class="card">${distributionBar(distSpec)}</div>
</section>

<section>
  <h2>Catalogue <span class="count">${donnees.specs.length} spec(s)</span></h2>
  <div class="filter"><input type="search" id="qSpecs" data-filter-target="tSpecs" placeholder="Filtrer par ID, titre, intent, format…"/></div>
  <table id="tSpecs" data-sortable="true" data-a11y-caption="SPECs techniques du projet">
    <thead><tr><th>ID</th><th>Titre</th><th>Intent parent</th><th>Format</th><th>SQS</th><th>Statut</th><th>Date</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>

${blocSpecPagesIndex(donnees)}
`;
}
