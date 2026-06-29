// @spec SPEC-016-1-architecture-4-couches
// @intent INTENT-016
// @governance AIAD-RGAA

import { escape, lienSource } from '../ui/helpers.js';
import { statutBadge, sqsBadge, freshnessBadge } from '../ui/badges.js';
import { blocSanteGlobale } from '../sante-globale.js';
import { blocLeadership } from '../../leadership-metrics.js';
import { blocOutcomes } from '../outcomes.js';
import { blocBadgesReadme } from '../badges-block.js';
import { pmSection } from '../pm.js';
import { blocRituels } from '../rituels.js';
import { kpiSbom, kpiSovereignty, kpiHookStats, kpiViolations } from '../kpi-cards.js';

export function listerAlertes(donnees) {
  const alertes = [];
  // SQS faibles
  for (const s of donnees.specs) {
    const v = Number(s.sqs);
    if (!isNaN(v) && v < 4 && ['draft', 'review'].includes(s.statut)) {
      alertes.push({
        gravite: 'warn',
        titre: `SQS faible sur ${s.id}`,
        detail: `${v.toFixed(1)}/5 — ${s.titre}`,
        cible: `specs.html`,
        action: 'remédiation à appliquer avant Gate',
      });
    }
  }
  // Facts critiques ouverts (priorité 1) + facts major ouverts (priorité 2)
  for (const f of donnees.facts) {
    const ouvert = !['closed', 'resolu', 'résolu'].includes(f.statut);
    if (!ouvert) continue;
    if (f.gravite === 'critical') {
      alertes.push({
        gravite: 'bad',
        titre: `Fact critique ouvert — ${f.id}`,
        detail: f.titre,
        cible: 'drifts.html',
        action: 'investigation immédiate',
      });
    } else if (f.gravite === 'major') {
      alertes.push({
        gravite: 'warn',
        titre: `Fact majeur ouvert — ${f.id}`,
        detail: f.titre,
        cible: 'drifts.html',
        action: 'planifier remédiation',
      });
    }
  }
  // SPECs validées sans code (gap de traçabilité bloquant)
  for (const s of donnees.matrice.gaps.specsValideesNonImplementees) {
    alertes.push({
      gravite: 'warn',
      titre: `SPEC validée sans code — ${s.id}`,
      detail: `statut ${s.status} mais aucune annotation @spec dans le code`,
      cible: 'traceability.html',
      action: 'lancer /sdd exec ou annoter le code livré',
    });
  }
  // Drifts non résolus
  const driftsNonRes = donnees.metrics.agregats.drift.driftsDetectes - donnees.metrics.agregats.drift.driftsResolus;
  if (driftsNonRes > 0) {
    alertes.push({
      gravite: 'warn',
      titre: `${driftsNonRes} drift(s) détecté(s) non résolu(s)`,
      detail: 'Code modifié sans synchronisation SPEC',
      cible: 'metrics.html',
      action: 'lancer /sdd drift-check sur les zones concernées',
    });
  }
  // Intents zombie (active depuis > 30j)
  const auj = new Date();
  for (const i of donnees.intents) {
    if (i.statut !== 'active' || !i.date) continue;
    const age = (auj - new Date(i.date)) / (1000 * 60 * 60 * 24);
    if (age > 30) {
      alertes.push({
        gravite: 'warn',
        titre: `Intent zombie — ${i.id}`,
        detail: `actif depuis ${Math.round(age)}j sans clôture`,
        cible: 'intents.html',
        action: 'archiver ou relancer (cf. /aiad health)',
      });
    }
  }
  // Gouvernance manquante
  const manquants = donnees.gouvernance.filter((g) => !g.present);
  if (manquants.length) {
    alertes.push({
      gravite: 'bad',
      titre: `${manquants.length} agent(s) Tier 1 manquant(s)`,
      detail: manquants.map((g) => g.id).join(', '),
      cible: 'governance.html',
      action: 'lancer npx aiad-sdd gouvernance',
    });
  }
  // (#153 / #167) DPIA avec sections "(à compléter)" → action DPO requise.
  // Paliers : > 10 → bad ; > 0 → warn.
  const lastDpia = donnees.supplementaire?.dpia?.latest;
  if (lastDpia && lastDpia.aCompleter > 0) {
    const gravite = lastDpia.aCompleter > 10 ? 'bad' : 'warn';
    alertes.push({
      gravite,
      titre: `DPIA incomplet — ${lastDpia.aCompleter} section(s) à compléter`,
      detail: `${lastDpia.nom} (${lastDpia.sectionsCount} sections déclarées)${gravite === 'bad' ? ' — chantier DPO conséquent' : ''}`,
      cible: 'legal.html',
      action: gravite === 'bad'
        ? 'solliciter le DPO en priorité — planifier une session dédiée'
        : 'solliciter le DPO pour clôturer les sections marquées',
    });
  }
  // (#153 / #167) AI Act audit avec placeholders. Paliers : > 6 → bad ; > 0 → warn.
  const lastAct = donnees.supplementaire?.aiAct?.latest;
  if (lastAct && lastAct.aCompleter > 0) {
    const gravite = lastAct.aCompleter > 6 ? 'bad' : 'warn';
    alertes.push({
      gravite,
      titre: `AI Act Annexe IV — ${lastAct.aCompleter} section(s) à compléter`,
      detail: `${lastAct.nom} (${lastAct.sectionsCount}/8 sections déclarées)${gravite === 'bad' ? ' — risque conformité élevé' : ''}`,
      cible: 'legal.html',
      action: gravite === 'bad'
        ? 'compléter ce sprint — sinon mise sur le marché EU bloquée'
        : 'compléter les sections "(à compléter)" du rapport',
    });
  }
  // (#165) Combinaison à risque : AI Act incomplet ET pack EU sensible installé
  const packs = donnees.legalPacks || [];
  const packsEuRisque = packs.filter((p) => p.id === 'eu-platforms' || p.id === 'eu-financial').map((p) => p.id);
  if (lastAct && lastAct.aCompleter > 5 && packsEuRisque.length > 0) {
    alertes.push({
      gravite: 'bad',
      titre: `Risque conformité EU élevé — AI Act très incomplet (${lastAct.aCompleter} placeholders) avec exposition ${packsEuRisque.join('+')}`,
      detail: `Pack(s) EU installé(s) : ${packsEuRisque.join(', ')}. Le marché EU exige un dossier Annexe IV solide avant mise sur le marché.`,
      cible: 'legal.html',
      action: 'priorité 1 : compléter le rapport AI Act ce sprint',
    });
  }
  return alertes;
}

export function pageOverview(donnees) {
  const m = donnees.maturite;
  const fond = donnees.fondamentaux;
  const matrice = donnees.matrice;
  const totalGaps = matrice.gaps.intentsSansSpec.length
    + matrice.gaps.specsSansCode.length
    + matrice.gaps.specsValideesNonImplementees.length
    + matrice.gaps.specsOrphelinsSurCode.length
    + matrice.gaps.intentsOrphelinsSurCode.length
    + matrice.gaps.codeSansSpec.total
    + matrice.gaps.codeSansTests.length;
  const alertes = listerAlertes(donnees);

  const fondamentaux = fond.map((f) => `
    <tr>
      <td>${f.chemin ? lienSource(f.chemin) : `<code>${escape(f.nom)}</code>`}</td>
      <td>${f.present ? statutBadge(f.rempli ? 'rédigé' : 'template') : statutBadge('absent')}</td>
      <td>${f.titre ? escape(f.titre) : '<em class="muted">—</em>'}</td>
      <td class="muted">${f.tailleKo ? f.tailleKo + ' Ko' : '—'}</td>
    </tr>`).join('');

  const intentsActifs = donnees.intents.filter((i) => i.statut === 'active').length;
  const specsReady = donnees.specs.filter((s) => ['ready', 'in-progress', 'validation', 'done'].includes(s.statut)).length;
  const driftsOuverts = donnees.facts.filter((f) => f.statut !== 'closed' && f.statut !== 'resolu' && f.statut !== 'résolu').length;

  const gouvOk = donnees.gouvernance.filter((g) => g.present).length;
  const gouvAttendu = donnees.gouvernance.length;

  const recentChanges = donnees.changelog.entrees.slice(0, 5).map((e) => `
    <tr>
      <td class="muted">${escape(e.date)}</td>
      <td><strong>${escape(e.artefact)}</strong></td>
      <td>${escape(e.type)}</td>
      <td class="muted">${escape(e.auteur || '—')}</td>
    </tr>`).join('');

  // (#330) ID hyperlié vers le fichier SPEC (cohérent #327 sur specs.html).
  const recentSpecs = donnees.specs.slice(0, 5).map((s) => `
    <tr>
      <td>${s.file ? lienSource(s.file, s.id) : `<code>${escape(s.id)}</code>`}</td>
      <td>${escape(s.titre)}</td>
      <td>${statutBadge(s.statut)}</td>
      <td>${sqsBadge(s.sqs)}</td>
    </tr>`).join('');

  const matKpiCls = m.score >= 4 ? 'ok' : m.score >= 2 ? 'warn' : 'bad';
  const gapsKpiCls = totalGaps === 0 ? 'ok' : totalGaps <= 5 ? 'warn' : 'bad';

  // (#168) > 5 alertes : on affiche les 5 plus graves, le reste dans <details>.
  const POIDS = { bad: 0, warn: 1, info: 2 };
  const tri = [...alertes].sort((a, b) => (POIDS[a.gravite] ?? 9) - (POIDS[b.gravite] ?? 9));
  const visibles = tri.slice(0, 5);
  const repliees = tri.slice(5);
  const rdA = (a) => `<a href="${a.cible}" class="alerte alerte-${a.gravite}"><div class="alerte-titre">${escape(a.titre)}</div><div class="alerte-detail">${escape(a.detail)}</div><div class="alerte-action">→ ${escape(a.action)}</div></a>`;
  const blocAlertes = alertes.length === 0
    ? `<div class="alertes ok"><span class="alertes-icon">✓</span><div><strong>Aucune alerte</strong><div class="muted">Le projet ne remonte aucun signal d'attention.</div></div></div>`
    : `<div class="alertes-list">${visibles.map(rdA).join('')}</div>${repliees.length === 0 ? '' : `<details style="margin-top:.75rem"><summary><strong>+ ${repliees.length} autre(s) alerte(s)</strong> <span class="muted">priorité moindre</span></summary><div class="alertes-list" style="margin-top:.5rem">${repliees.map(rdA).join('')}</div></details>`}`;

  return `
${alertes.length > 0
  ? `<section><h2>Alertes <span class="count">${alertes.length} signal(s)</span></h2>${blocAlertes}</section>`
  : `<section><h2>Alertes</h2>${blocAlertes}</section>`}
<div class="kpis">
  <div class="kpi ${matKpiCls}">
    <div class="label">Maturité</div>
    <div class="value">${m.score}/5</div>
    <div class="delta">${escape(m.label)}</div>
  </div>
  <div class="kpi">
    <div class="label">Intents actifs</div>
    <div class="value">${intentsActifs}<span class="muted" style="font-size:1rem;font-weight:400;"> / ${donnees.intents.length}</span></div>
    <div class="delta">total</div>
  </div>
  <div class="kpi">
    <div class="label">SPECs prêtes+</div>
    <div class="value">${specsReady}<span class="muted" style="font-size:1rem;font-weight:400;"> / ${donnees.specs.length}</span></div>
    <div class="delta">ready / in-progress / done</div>
  </div>
  <div class="kpi ${gouvOk === gouvAttendu ? 'ok' : 'warn'}">
    <div class="label">Gouvernance Tier 1</div>
    <div class="value">${gouvOk}/${gouvAttendu}</div>
    <div class="delta">agents installés</div>
  </div>
  <div class="kpi ${gapsKpiCls}">
    <div class="label">Gaps traçabilité</div>
    <div class="value">${totalGaps}</div>
    <div class="delta">tous types confondus</div>
  </div>
  <div class="kpi ${driftsOuverts === 0 ? 'ok' : 'warn'}">
    <div class="label">Drifts ouverts</div>
    <div class="value">${driftsOuverts}</div>
    <div class="delta">sur ${donnees.facts.length} fact(s)</div>
  </div>
  ${kpiSbom(donnees)}
  ${kpiSovereignty(donnees)}
  ${kpiHookStats(donnees)}
  ${kpiViolations(donnees)}
</div>

${blocSanteGlobale(donnees)}
${blocLeadership(donnees)}
${blocOutcomes(donnees)}
${blocBadgesReadme(donnees)}
${pmSection(donnees)}${blocRituels(donnees)}

<section>
  <h2>Maturité du projet</h2>
  <div class="maturite ${m.cls}">
    <div class="label">${escape(m.label)}</div>
    <div class="barre"><div class="fill" style="width:${(m.score / m.total) * 100}%"></div></div>
    <div class="score">${m.score} / ${m.total}</div>
  </div>
  ${m.raisonPlafond ? `<p class="muted" style="margin-top:.5rem"><strong>Plafonné à ${m.plafond}/5</strong> — ${escape(m.raisonPlafond)}. <a href="https://aiad.ovh/docs/maturite" target="_blank" rel="noopener">Comment relever le score</a>.</p>` : ''}
</section>

<section>
  <h2>Artefacts fondamentaux</h2>
  <table>
    <thead><tr><th>Fichier</th><th>État</th><th>Titre</th><th>Taille</th></tr></thead>
    <tbody>${fondamentaux}</tbody>
  </table>
</section>

<div class="split">
  <section>
    <h2>SPECs récentes</h2>
    ${donnees.specs.length === 0
      ? `<div class="empty"><strong>Aucune SPEC pour le moment.</strong>Lance <code>/sdd spec</code> pour créer la première.</div>`
      : `<table>
          <thead><tr><th>ID</th><th>Titre</th><th>Statut</th><th>SQS</th></tr></thead>
          <tbody>${recentSpecs}</tbody>
        </table>`}
  </section>
  <section>
    <h2>Changelog récent</h2>
    ${donnees.changelog.entrees.length === 0
      ? `<div class="empty"><strong>Aucune entrée de changelog.</strong>Les changements d'artefacts seront tracés ici.</div>`
      : `<table>
          <thead><tr><th>Date</th><th>Artefact</th><th>Type</th><th>Auteur</th></tr></thead>
          <tbody>${recentChanges}</tbody>
        </table>`}
  </section>
</div>

<section>
  <h2>Actions rapides</h2>
  <div class="actions">
    <a href="intents.html">→ Voir les Intents</a>
    <a href="specs.html">→ Voir les SPECs</a>
    <a href="traceability.html">→ Matrice de traçabilité</a>
    <a href="metrics.html">→ Métriques DORA & Flow</a>
    <a href="governance.html">→ Gouvernance Tier 1</a>
    <a href="drifts.html">→ Drifts & Facts</a>
  </div>
</section>
`;
}
