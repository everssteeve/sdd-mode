/**
 * @spec SPEC-017-1-page-aujourdhui
 * @intent INTENT-017
 * @verified-by test/dashboard-today.test.js
 * @governance AIAD-RGAA
 */

import { escape } from '../ui/helpers.js';
import { topPriorites } from '../intent-priority.js';

export function construirePageAujourdhui(donnees) {
  const prio = topPriorites(donnees?.intents || [], 3);
  const sectionPrio = prio.length === 0
    ? '<p>Aucun bloquant aujourd\'hui.</p>'
    : `<ul>${prio.map(i => `<li><strong>${escape(i.id)}</strong> — ${escape(i.titre || '')}</li>`).join('')}</ul>`;

  const echeances = [
    ...(donnees?.deadlines?.buckets?.retard || []),
    ...(donnees?.deadlines?.buckets?.urgent || []),
  ].filter(d => typeof d.joursRestants === 'number' && d.joursRestants <= 7);
  const sectionEcheances = echeances.length === 0
    ? '<p>Aucune échéance imminente.</p>'
    : `<ul>${echeances.map(d => `<li><strong>${escape(d.id)}</strong> — dans ${d.joursRestants}j</li>`).join('')}</ul>`;

  const risques = (donnees?.riskTransparency?.items || []).filter(i => !i.couvert).slice(0, 3);
  const sectionRisques = risques.length === 0
    ? '<p>Aucun risque découvert non couvert.</p>'
    : `<ul>${risques.map(r => `<li><strong>${escape(r.id)}</strong> — ${escape(r.titre || '')} <em class="muted">[${escape(r.niveau || '')}]</em></li>`).join('')}</ul>`;

  const texteStandup = donnees?.standupScript?.texte;
  const sectionStandup = (!texteStandup || texteStandup.trim() === '')
    ? '<p>Script non disponible — relance le dashboard.</p>'
    : `<pre class="standup-script">${escape(texteStandup)}</pre>`;

  return `<section aria-label="Priorités du jour">
  <h2>Priorités du jour</h2>
  ${sectionPrio}
</section>
<section aria-label="Échéances proches">
  <h2>Échéances proches</h2>
  ${sectionEcheances}
</section>
<section aria-label="Risques découverts">
  <h2>Risques découverts</h2>
  ${sectionRisques}
</section>
<section aria-label="Script standup">
  <h2>Script standup</h2>
  ${sectionStandup}
</section>`;
}

export function pageAujourdhui(donnees, { layout }) {
  const date = (donnees?.projet?.genere || new Date().toISOString()).slice(0, 10);
  return layout({
    slug: 'today',
    titre: "Aujourd'hui",
    sous: date,
    donnees,
    body: construirePageAujourdhui(donnees),
  });
}
