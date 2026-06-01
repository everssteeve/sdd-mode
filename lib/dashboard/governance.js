// AIAD SDD Mode — Dashboard : page Gouvernance Tier 1.
//
// Extrait de render.js dans son propre module (cohérence avec pm.js, qa.js,
// adrs.js, legal.js, onboarding.js, learnings.js, audit-trail.js — chaque
// page persona a sa propre unité). Maintient render.js sous la limite 850
// LOC effectives.

import { escape, statutBadge, lienSource } from './render.js';
import { blocLearnings } from './learnings.js';
import { blocAuditTrail } from './audit-trail.js';
import { blocViolations } from './violations.js';

export function pageGovernance(donnees) {
  // (#334) Agent ID hyperlié vers le fichier .md de l'agent quand présent.
  // Auditeur Tier 1 / DPO : 1 clic depuis governance.html → contenu agent.
  const rows = donnees.gouvernance.map((g) => `<tr>
    <td><strong>${g.file ? lienSource(g.file, g.id) : escape(g.id)}</strong></td>
    <td>${g.present ? statutBadge('présent') : statutBadge('absent')}</td>
    <td>${escape(g.referentiel)}</td>
    <td>${escape(g.declenche)}</td>
    <td class="muted">${g.tailleKo ? g.tailleKo + ' Ko' : '—'}</td>
  </tr>`).join('');

  const presents = donnees.gouvernance.filter((g) => g.present).length;
  const total = donnees.gouvernance.length;

  return `
<div class="kpis">
  <div class="kpi ${presents === total ? 'ok' : 'warn'}">
    <div class="label">Couverture Tier 1</div>
    <div class="value">${presents}/${total}</div>
    <div class="delta">${presents === total ? 'tous les agents installés' : 'agents manquants'}</div>
  </div>
</div>

<section>
  <h2>Agents de gouvernance</h2>
  <div class="card">
    <p class="muted">Les agents de gouvernance ont un <strong>droit de veto</strong>. En cas de conflit entre une SPEC et un agent de gouvernance, l'agent de gouvernance prévaut.</p>
  </div>
  <div class="filter"><input type="search" id="qGov" data-filter-target="tGov" placeholder="Filtrer par agent, référentiel, déclencheur…" autocomplete="off"/></div>
  <table id="tGov" data-sortable="true">
    <thead><tr><th>Agent</th><th>État</th><th>Référentiel</th><th>Déclenché quand…</th><th>Taille</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>

<section>
  <h2>Hiérarchie de priorité</h2>
  <div class="card">
    <ol>
      <li><strong>Art. 5 AI Act</strong> (interdictions) — priorité absolue</li>
      <li><strong>RGPD + Art. 9</strong> — base légale requise si données sensibles</li>
      <li><strong>AI Act haut risque</strong> — obligations procédurales</li>
      <li><strong>RGAA</strong> — accessibilité des interfaces (y compris AI Act : divulgation, supervision, recours)</li>
      <li><strong>RGESN</strong> — optimisation énergétique dans le respect des quatre ci-dessus</li>
    </ol>
  </div>
</section>
${blocViolations(donnees)}
${blocLearnings(donnees)}
${blocAuditTrail(donnees)}
`;
}

// Alias EN canoniques (#42)
export { pageGovernance as governancePage };
