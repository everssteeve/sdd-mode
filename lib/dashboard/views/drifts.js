// @spec SPEC-016-1-architecture-4-couches
// @intent INTENT-016
// @governance AIAD-RGAA

import { escape, lienSource } from '../ui/helpers.js';
import { badge, statutBadge } from '../ui/badges.js';

export function pageDrifts(donnees) {
  const facts = donnees.facts;
  if (facts.length === 0) {
    return `<div class="empty">
      <strong>Aucun drift / fact capturé.</strong>
      <code>/sdd fact</code> capture les écarts livré ↔ désiré. <code>/sdd drift-check</code> détecte les divergences code ↔ SPEC. Si vous travaillez en SDD strict, l'absence de fact peut être saine — ou indiquer que le rituel n'est pas encore activé.
    </div>`;
  }
  // (#327) FACT ID hyperlié vers le fichier source.
  const rows = facts.map((f) => `<tr>
    <td>${f.file ? lienSource(f.file, f.id) : `<code>${escape(f.id)}</code>`}</td>
    <td>
      <div class="row-cluster">
        <strong>${escape(f.titre)}</strong>
      </div>
    </td>
    <td data-sort="${f.gravite === 'critical' ? '3' : f.gravite === 'major' ? '2' : '1'}">${badge(f.gravite || '—', f.gravite === 'critical' ? 'badge-bad' : f.gravite === 'major' ? 'badge-warn' : 'badge-muted')}</td>
    <td data-sort="${escape(f.statut)}">${statutBadge(f.statut)}</td>
    <td class="muted" data-sort="${escape(f.date || '')}">${escape(f.date || '—')}</td>
    <td class="muted" title="${escape(f.cause || '')}">${escape((f.cause || '').slice(0, 80))}${f.cause && f.cause.length > 80 ? '…' : ''}</td>
  </tr>`).join('');

  const parStatut = {};
  for (const f of facts) parStatut[f.statut] = (parStatut[f.statut] || 0) + 1;

  return `
<div class="kpis">
  <div class="kpi"><div class="label">Total facts</div><div class="value">${facts.length}</div></div>
  <div class="kpi ${(parStatut.open || 0) === 0 ? 'ok' : 'warn'}"><div class="label">Ouverts</div><div class="value">${parStatut.open || 0}</div></div>
  <div class="kpi"><div class="label">Résolus</div><div class="value">${(parStatut.closed || 0) + (parStatut.resolu || 0) + (parStatut['résolu'] || 0)}</div></div>
</div>

<section>
  <h2>Drifts & Facts capturés</h2>
  <div class="filter"><input type="search" id="qFacts" data-filter-target="tFacts" placeholder="Filtrer par titre, statut, cause…"/></div>
  <table id="tFacts" data-sortable="true">
    <thead><tr><th>ID</th><th>Titre</th><th>Gravité</th><th>Statut</th><th>Date</th><th>Cause</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>
`;
}
