// @spec SPEC-016-1-architecture-4-couches
// @intent INTENT-016
// @governance AIAD-RGAA

import { escape, lienSource } from '../ui/helpers.js';

export function pageChangelog(donnees) {
  if (donnees.changelog.entrees.length === 0) {
    return `<div class="empty">
      <strong>Aucune entrée dans le changelog des artefacts.</strong>
      Le fichier <code>.aiad/CHANGELOG-ARTEFACTS.md</code> trace les mises à jour significatives des artefacts SDD Mode. Il est rempli au fil de l'eau lors des commandes <code>/sdd</code> et <code>/aiad</code>.
    </div>`;
  }
  const rows = donnees.changelog.entrees.map((e) => `<tr>
    <td class="muted">${escape(e.date)}</td>
    <td><strong>${escape(e.artefact)}</strong></td>
    <td>${escape(e.type)}</td>
    <td class="muted">${escape(e.auteur || '—')}</td>
    <td>${escape((e.raison || '').slice(0, 120))}${e.raison && e.raison.length > 120 ? '…' : ''}</td>
    <td class="muted">${escape((e.impact || '').slice(0, 80))}${e.impact && e.impact.length > 80 ? '…' : ''}</td>
  </tr>`).join('');

  return `
<div class="kpis">
  <div class="kpi"><div class="label">Entrées</div><div class="value">${donnees.changelog.entrees.length}</div></div>
</div>
<section>
  <h2>Historique <span class="count">source : ${donnees.changelog.file ? lienSource(donnees.changelog.file) : '<code>—</code>'}</span></h2>
  <div class="filter"><input type="search" id="qCl" data-filter-target="tCl" placeholder="Filtrer par date, artefact, raison…"/></div>
  <table id="tCl" data-sortable="true">
    <thead><tr><th>Date</th><th>Artefact</th><th>Type</th><th>Auteur</th><th>Raison</th><th>Impact</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>
`;
}
