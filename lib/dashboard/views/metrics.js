// @spec SPEC-016-1-architecture-4-couches
// @intent INTENT-016
// @governance AIAD-RGAA

import { escape, lienSource } from '../ui/helpers.js';
import { sparkline } from '../ui/sparklines.js';
import { blocLeadership } from '../../leadership-metrics.js';
import { blocQueueQa } from '../qa.js';
// @spec SPEC-030-4-dashboard-eco
import { blocWidgetEco } from '../../eco-dashboard.js';

function formaterKv(data) {
  const e = Object.entries(data).slice(0, 6);
  return e.length === 0 ? '<em class="muted">—</em>' : e.map(([k, v]) => `<code>${escape(k)}: ${escape(String(v))}</code>`).join(' ');
}

export function pageMetrics(donnees) {
  const a = donnees.metrics.agregats;
  const cats = donnees.metrics.categories;

  const totalAvecMetrics = Object.values(cats).reduce((s, c) => s + c.fichiers.length, 0);
  // (#181) Même sans métriques persistées dans .aiad/metrics/, le bloc
  // Leadership EU/FR reste pertinent : il dérive de la matrice de
  // traçabilité et des Intents (calculs purs, pas d'historique). On l'affiche
  // donc en premier puis un message "Aucune autre métrique persistée".
  if (totalAvecMetrics === 0) {
    return `${blocLeadership(donnees)}
<div class="empty">
      <strong>Aucune autre donnée métrique persistée.</strong>
      Les commandes <code>/aiad standup</code>, <code>/aiad demo</code>, <code>/aiad retro</code>, <code>/aiad dora</code>, <code>/aiad flow</code> écrivent leurs métriques dans <code>.aiad/metrics/</code>. Une fois que tu as exécuté ces rituels, DORA et Flow apparaîtront ici.
      <div class="actions" style="justify-content:center;margin-top:1rem;">
        <a href="changelog.html">→ Changelog</a>
        <a href="traceability.html">→ Traçabilité</a>
      </div>
    </div>`;
  }

  function fmt(n, suffixe = '') {
    if (n == null || isNaN(n)) return '—';
    return Math.round(n * 10) / 10 + suffixe;
  }

  // Séries chronologiques pour sparklines (ordre ascendant)
  const seriesCycleTime = [...cats.deployments.fichiers]
    .sort((a, b) => a.mtime - b.mtime)
    .map((f) => Number(f.data.cycle_time_days))
    .filter((x) => !isNaN(x));
  const seriesSqs = [...cats.specs.fichiers]
    .sort((a, b) => a.mtime - b.mtime)
    .map((f) => Number(f.data.sqs_score))
    .filter((x) => !isNaN(x));
  const seriesWip = [...cats.standup.fichiers]
    .sort((a, b) => a.mtime - b.mtime)
    .map((f) => Number(f.data.wip))
    .filter((x) => !isNaN(x));
  const seriesDrift = [...cats.drift.fichiers]
    .sort((a, b) => a.mtime - b.mtime)
    .map((f) => Number(f.data.drifts_count))
    .filter((x) => !isNaN(x));

  // #136 — Honnêteté DORA : ne pas afficher des cadrans `—` quand aucun
  // déploiement n'a été enregistré. Bannière explicite + guide d'alimentation.
  const doraVide = a.deployments.total === 0;
  const dora = doraVide
    ? `<div class="empty">
        <strong>Données DORA absentes</strong>
        Aucun déploiement enregistré dans <code>.aiad/metrics/deployments/</code>. Pour activer les 4 indicateurs DORA (Deployment Frequency, Lead Time, Change Failure Rate, MTTR), exécute <code>/aiad dora</code> après chaque mise en production — ou écris directement un fichier <code>YYYY-MM-DD-deploy-NN.md</code> avec les clés <code>status: success|hotfix</code>, <code>cycle_time_days: N</code>, <code>lead_time_days: N</code>.
        <div class="actions" style="justify-content:center;margin-top:1rem;">
          <a href="https://aiad.ovh/docs/dora-format" target="_blank" rel="noopener">→ Format d'alimentation détaillé</a>
        </div>
      </div>`
    : `
    <div class="kpi"><div class="label">Déploiements</div><div class="value">${a.deployments.total}</div><div class="delta">${a.deployments.success} OK · ${a.deployments.hotfix} hotfix</div></div>
    <div class="kpi"><div class="label">Cycle Time moyen</div><div class="value">${fmt(a.deployments.cycleTimeMoyen, ' j')}</div><div class="spark-row">${sparkline(seriesCycleTime)}</div></div>
    <div class="kpi"><div class="label">Lead Time moyen</div><div class="value">${fmt(a.deployments.leadTimeMoyen, ' j')}</div></div>
    <div class="kpi ${a.deployments.hotfix / a.deployments.total < 0.05 ? 'ok' : 'warn'}">
      <div class="label">Change Failure Rate</div>
      <div class="value">${Math.round((a.deployments.hotfix / a.deployments.total) * 100) + '%'}</div>
    </div>
  `;
  const flowVide = a.standup.total === 0 && a.specs.total === 0 && a.drift.total === 0;
  const flow = flowVide
    ? `<div class="empty">
        <strong>Données Flow & Qualité absentes</strong>
        Aucun standup, score SQS ou drift enregistré dans <code>.aiad/metrics/</code>. Exécute <code>/aiad standup</code> (WIP, blockers du jour), <code>/sdd gate</code> (SQS), <code>/sdd drift-check</code> (drift count) pour alimenter ces indicateurs.
        <div class="actions" style="justify-content:center;margin-top:1rem;">
          <a href="https://aiad.ovh/docs/flow-format" target="_blank" rel="noopener">→ Format d'alimentation détaillé</a>
        </div>
      </div>`
    : `
    <div class="kpi"><div class="label">WIP moyen</div><div class="value">${fmt(a.standup.wipMoyen)}</div><div class="delta">${a.standup.total} standup(s)</div><div class="spark-row">${sparkline(seriesWip)}</div></div>
    <div class="kpi ${a.specs.sqsMoyen != null ? (a.specs.sqsMoyen >= 4 ? 'ok' : a.specs.sqsMoyen >= 3 ? 'warn' : 'bad') : ''}">
      <div class="label">SQS moyen</div>
      <div class="value">${fmt(a.specs.sqsMoyen, '/5')}</div>
      <div class="delta">${a.specs.total} spec(s) gate</div>
      <div class="spark-row">${sparkline(seriesSqs)}</div>
    </div>
    <div class="kpi"><div class="label">Gate au 1ᵉʳ passage</div><div class="value">${a.specs.total ? Math.round(a.specs.gateFirstPass / a.specs.total * 100) + '%' : '—'}</div></div>
    <div class="kpi ${a.drift.driftsDetectes === 0 ? 'ok' : 'warn'}">
      <div class="label">Drifts</div>
      <div class="value">${a.drift.driftsDetectes}</div>
      <div class="delta">${a.drift.driftsResolus} résolu(s)</div>
      <div class="spark-row">${sparkline(seriesDrift)}</div>
    </div>
  `;

  // (#349) Filename hyperlié vers la source. f.file capté par collect.js.
  const tableauCats = Object.values(cats).map((c) => {
    if (c.fichiers.length === 0) return '';
    const rows = c.fichiers.slice(0, 10).map((f) => `<tr>
      <td>${f.file ? lienSource(f.file, f.nom) : `<code>${escape(f.nom)}</code>`}</td>
      <td class="muted">${escape(new Date(f.mtime).toLocaleDateString('fr-FR'))}</td>
      <td>${formaterKv(f.data)}</td>
    </tr>`).join('');
    return `<section>
      <h2>${escape(c.categorie)} <span class="count">${c.fichiers.length} fichier(s) · ${escape(c.dir || '')}</span></h2>
      <table>
        <thead><tr><th>Fichier</th><th>Date</th><th>Métriques détectées</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
  }).filter(Boolean).join('');

  return `
${blocQueueQa(donnees)}
<section>
  <h2>DORA</h2>
  ${doraVide ? dora : `<div class="kpis">${dora}</div>`}
</section>
${blocLeadership(donnees)}
<section>
  <h2>Flow & Qualité</h2>
  ${flowVide ? flow : `<div class="kpis">${flow}</div>`}
</section>
<section>
  <h2>🌱 EcoLogits — Impact écologique</h2>
  ${blocWidgetEco(donnees.ecoMetrics)}
  <div class="actions" style="margin-top:0.75rem;"><a href="eco.html">→ Détail 30 sessions</a></div>
</section>
${tableauCats}
`;
}
