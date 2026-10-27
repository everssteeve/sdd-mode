// @spec SPEC-016-1-architecture-4-couches
// @intent INTENT-016
// @governance AIAD-RGAA

import { escape, lienSource } from '../ui/helpers.js';

// Budget RGESN (SPEC-016-4) : la page ne grossit pas avec l'historique.
export const CHANGELOG_MAX_ENTREES = 20;

export function pageChangelog(donnees) {
  if (donnees.changelog.entrees.length === 0) {
    return `<div class="empty">
      <strong>Aucune entrée dans le changelog des artefacts.</strong>
      Le fichier <code>.aiad/CHANGELOG-ARTEFACTS.md</code> trace les mises à jour significatives des artefacts SDD Mode. Il est rempli au fil de l'eau lors des commandes <code>/sdd</code> et <code>/aiad</code>.
    </div>`;
  }
  const total = donnees.changelog.entrees.length;
  const recentes = [...donnees.changelog.entrees]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, CHANGELOG_MAX_ENTREES);
  const rows = recentes.map((e) => `<tr>
    <td class="muted">${escape(e.date)}</td>
    <td><strong>${escape(e.artefact)}</strong></td>
    <td>${escape(e.type)}</td>
    <td class="muted">${escape(e.auteur || '—')}</td>
    <td>${escape((e.raison || '').slice(0, 120))}${e.raison && e.raison.length > 120 ? '…' : ''}</td>
  </tr>`).join('');

  return `
<div class="kpis">
  <div class="kpi"><div class="label">Entrées</div><div class="value">${total}</div></div>
</div>
<section>
  <h2>Historique <span class="count">source : ${donnees.changelog.file ? lienSource(donnees.changelog.file) : '<code>—</code>'}</span></h2>
  <div class="filter"><input type="search" id="qCl" data-filter-target="tCl" placeholder="Filtrer par date, artefact, raison…"/></div>
  <table id="tCl" data-sortable="true" data-a11y-caption="Changelog des artefacts SDD">
    <thead><tr><th>Date</th><th>Artefact</th><th>Type</th><th>Auteur</th><th>Raison</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${total > recentes.length ? `<p class="muted">${recentes.length} entrées les plus récentes sur ${total} — historique complet dans la source.</p>` : ''}
</section>
`;
}
