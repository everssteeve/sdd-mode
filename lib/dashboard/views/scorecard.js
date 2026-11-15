// AIAD SDD Mode — Dashboard : affichage des métriques AIAD.
//
// Trois vues du même calcul (`aiad-metrics.js`) :
//   - `pageScorecard` : la page « Métriques AIAD » — toutes les métriques du
//     framework, par catégorie, avec cible, valeur, état et, quand une
//     métrique n'est pas mesurée, la façon de l'alimenter ;
//   - `blocSyntheseMetriques` : la synthèse par catégorie de la vue d'ensemble ;
//   - `blocMetriquesRole` : les métriques suivies par une responsabilité, dans
//     son cockpit.
//
// @intent INTENT-038
// @spec SPEC-038-1-metriques-aiad-dashboard
// @verified-by test/dashboard-aiad-metrics.test.js
// @governance AIAD-RGAA
//
// Documentation : https://aiad.ovh

import { escape } from '../ui/helpers.js';
import { CATEGORIES, calculerMetriquesAiad, syntheseCategories, signauxImmediats, etatRituels } from '../aiad-metrics.js';

const ETAT = {
  ok: ['badge-ok', 'dans la cible'],
  'hors-cible': ['badge-bad', 'hors cible'],
  mesure: ['badge-info', 'mesuré'],
  perimee: ['badge-warn', 'à rafraîchir'],
  'non-mesure': ['badge-muted', 'non mesuré'],
  'non-applicable': ['badge-muted', 'non applicable'],
  'hors-dashboard': ['badge-muted', 'hors dashboard'],
};
const FREQ = { hebdo: 'Hebdomadaire', mensuel: 'Mensuel', annuel: 'Annuel', feature: 'Par feature' };

/** Échappe puis rend les passages `entre accents graves` en <code>. */
const riche = (s) => escape(s).replace(/`([^`]+)`/g, '<code>$1</code>');

function calculer(donnees) {
  try { return calculerMetriquesAiad(donnees); } catch { return []; }
}

function ligne(m, { alimenter = true } = {}) {
  const [cls, libelle] = ETAT[m.etat] || ETAT['non-mesure'];
  const tendance = m.precedent !== null && m.precedent !== undefined && m.valeur !== null
    ? ` <span class="muted">(avant : ${escape(String(Math.round(m.precedent * 10) / 10).replace('.', ','))})</span>` : '';
  const aide = alimenter && (m.etat === 'non-mesure' || m.etat === 'hors-dashboard' || m.etat === 'perimee')
    ? `<div class="muted">${riche(m.alimenter)}</div>`
    : (alimenter && m.source ? `<div class="muted">source : ${escape(m.source)}</div>` : '');
  const ageTexte = m.etat === 'perimee' && m.age !== null ? ` <span class="muted">(il y a ${m.age} j)</span>` : '';
  return `<tr data-freq="${m.frequence}"><td><strong>${escape(m.label)}</strong>${aide}</td><td>${m.etat === 'non-mesure' || m.etat === 'hors-dashboard' || m.etat === 'non-applicable' ? '<span class="muted">—</span>' : `${escape(m.texte)}${tendance}${ageTexte}`}</td><td>${escape(m.cible)}</td><td><span class="badge ${cls}">${libelle}</span></td><td class="muted">${FREQ[m.frequence] || escape(m.frequence)}</td></tr>`;
}

function tableau(metriques, options) {
  return `<table><thead><tr><th>Métrique</th><th>Valeur</th><th>Cible</th><th>État</th><th>Fréquence</th></tr></thead><tbody>${metriques.map((m) => ligne(m, options)).join('')}</tbody></table>`;
}

/** Synthèse par catégorie, pour la vue d'ensemble. Chaîne vide si rien n'est calculable. */
export function blocSyntheseMetriques(donnees) {
  const resultats = calculer(donnees);
  if (resultats.length === 0) return '';
  const cartes = syntheseCategories(resultats).map((c) => `<a class="pipe-step" href="scorecard.html#${c.id}"><div class="pipe-label">${escape(c.titre)}</div><div class="pipe-n">${c.mesurees}<small> / ${c.total}</small></div><div class="pipe-hint">${c.mesurees === 0 ? 'non mesuré' : `${c.ok} dans la cible${c.horsCible ? ` · ${c.horsCible} hors cible` : ''}${c.perimees ? ` · ${c.perimees} à rafraîchir` : ''}`}</div></a>`).join('');
  return `<section>
  <h2>Métriques AIAD</h2>
  <p class="section-lede">Métriques mesurées sur celles que définit le framework, par catégorie. <a href="scorecard.html">Tout voir</a>.</p>
  <div class="pipeline">${cartes}</div>
</section>`;
}

/** Métriques suivies par une responsabilité, pour son cockpit. Chaîne vide si aucune. */
export function blocMetriquesRole(donnees, ongletId) {
  const cats = CATEGORIES.filter((c) => c.onglet === ongletId);
  if (cats.length === 0) return '';
  const resultats = calculer(donnees);
  const blocs = cats.map((c) => {
    const ms = resultats.filter((r) => r.cat === c.id);
    return ms.length ? `<h3>${escape(c.titre)} <span class="muted" style="font-weight:400">— ${escape(c.resume)}</span></h3>${tableau(ms, { alimenter: false })}` : '';
  }).filter(Boolean).join('');
  if (!blocs) return '';
  return `<section>
  <h2>Vos métriques AIAD</h2>
  ${blocs}
  <div class="actions"><a href="scorecard.html">→ Toutes les métriques, et comment les alimenter</a></div>
</section>`;
}

/** Page « Métriques AIAD ». */
export function pageScorecard(donnees) {
  const resultats = calculer(donnees);
  const synthese = syntheseCategories(resultats);
  const suivies = resultats.filter((r) => r.etat !== 'hors-dashboard' && r.etat !== 'non-applicable');
  const mesurees = suivies.filter((r) => r.etat !== 'non-mesure').length;
  const ok = suivies.filter((r) => r.etat === 'ok').length;
  const hors = suivies.filter((r) => r.etat === 'hors-cible').length;
  const signaux = (() => { try { return signauxImmediats(donnees); } catch { return []; } })();
  const perimees = suivies.filter((r) => r.etat === 'perimee').length;
  const rituels = (() => { try { return etatRituels(donnees); } catch { return []; } })();
  const ETAT_RITUEL = { 'a-jour': ['badge-ok', 'à jour'], 'en-retard': ['badge-bad', 'en retard'], jamais: ['badge-muted', 'jamais enregistré'] };
  const lignesRituels = rituels.map((r) => `<tr><td><strong>${escape(r.titre)}</strong><div class="muted"><code>${escape(r.commande)}</code></div></td><td>${escape(r.alimente)}</td><td>${r.dernier ? `${escape(r.dernier)} <span class="muted">(il y a ${r.joursDepuis} j)</span>` : '<span class="muted">—</span>'}</td><td class="muted">tous les ${r.cadence} j au plus</td><td><span class="badge ${ETAT_RITUEL[r.etat][0]}">${ETAT_RITUEL[r.etat][1]}</span></td></tr>`).join('');

  const sections = synthese.map((c) => `<section id="${c.id}">
  <h2>${escape(c.titre)} <span class="count">${c.mesurees} / ${c.total} mesurée(s)</span></h2>
  <p class="section-lede">${escape(c.resume)}</p>
  ${tableau(resultats.filter((r) => r.cat === c.id))}
</section>`).join('\n');

  return `<div class="kpis">
  <div class="kpi"><div class="label">Métriques suivies</div><div class="value">${suivies.length}</div><div class="delta">définies par le framework AIAD</div></div>
  <div class="kpi ${mesurees === 0 ? '' : (mesurees === suivies.length ? 'ok' : 'warn')}"><div class="label">Mesurées</div><div class="value">${mesurees}</div><div class="delta">${suivies.length - mesurees} sans donnée</div></div>
  <div class="kpi ${ok ? 'ok' : ''}"><div class="label">Dans la cible</div><div class="value">${ok}</div><div class="delta">parmi les métriques mesurées</div></div>
  <div class="kpi ${hors ? 'bad' : ''}"><div class="label">Hors cible</div><div class="value">${hors}</div><div class="delta">à regarder en rétrospective</div></div>
  <div class="kpi ${perimees ? 'warn' : ''}"><div class="label">À rafraîchir</div><div class="value">${perimees}</div><div class="delta">valeur déclarée trop ancienne</div></div>
</div>
<section>
  <h2>Signaux d'action immédiate</h2>
  ${signaux.length === 0
    ? `<div class="alertes ok"><span class="alertes-icon" aria-hidden="true">✓</span><div><strong>Aucun des trois signaux n'est déclenché</strong><div class="muted">Cycle Time qui double · score qualité des SPECs sous 3,5 / 5 · Change Failure Rate au-dessus de 15 %.</div></div></div>`
    : `<div class="alertes-list">${signaux.map((s) => `<div class="alerte alerte-bad"><div class="alerte-titre">${escape(s.titre)}</div><div class="alerte-detail">${escape(s.detail)}</div></div>`).join('')}</div>`}
</section>
<section id="rituels">
  <h2>Rituels qui alimentent les métriques</h2>
  <p class="section-lede">Les métriques déclarées n'existent que si le rituel est tenu et enregistré. Un rituel en retard laisse ses métriques se périmer.</p>
  <table><thead><tr><th>Rituel</th><th>Alimente</th><th>Dernier enregistrement</th><th>Cadence</th><th>État</th></tr></thead><tbody>${lignesRituels}</tbody></table>
</section>
<div class="actions" role="group" aria-label="Filtrer par fréquence" style="margin-bottom:1.25rem">
  <button type="button" class="lens-btn active" data-lens="">Toutes</button>
  <button type="button" class="lens-btn" data-lens="hebdo">Dashboard hebdomadaire</button>
  <button type="button" class="lens-btn" data-lens="mensuel">Dashboard mensuel</button>
</div>
${sections}
<section>
  <h2>Lire ces chiffres</h2>
  <p class="section-lede">Les métriques informent les décisions, elles ne les dictent pas. Une métrique « non mesurée » n'a pas de donnée : la ligne indique comment l'alimenter. Une métrique « non applicable » a été écartée par l'équipe, avec sa raison (<code>npx aiad-sdd metrics exclude</code>). Une métrique « à rafraîchir » a une valeur déclarée plus ancienne que deux périodes de sa fréquence. Les valeurs tirées de git sont des approximations : elles comptent les commits co-signés par un agent, fichiers générés compris. <code>npx aiad-sdd metrics check</code> échoue tant qu'une métrique ne remonte pas. Les valeurs d'équipe sont des moyennes déclarées en rétrospective, jamais individuelles ; le turnover et les jours de maladie ne sont pas collectés par le dashboard.</p>
</section>
<script>
(function () {
  var b = document.querySelectorAll('[data-lens]');
  b.forEach(function (x) { x.addEventListener('click', function () {
    var f = x.getAttribute('data-lens');
    b.forEach(function (y) { y.classList.toggle('active', y === x); });
    document.querySelectorAll('tr[data-freq]').forEach(function (r) { r.hidden = !!f && r.getAttribute('data-freq') !== f; });
  }); });
})();
</script>`;
}
