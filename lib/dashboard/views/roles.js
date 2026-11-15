// AIAD SDD Mode — Dashboard : cockpits par responsabilité.
//
// Un onglet par responsabilité AIAD. Ce module fournit :
//   - `resumeRoles(donnees)` : trois chiffres par rôle + ses alertes, pour les
//     cartes de la vue d'ensemble ;
//   - `blocAssistant(ongletId)` : la carte « votre assistant » (agent de rôle
//     et sous-agents, d'après le registre) ;
//   - `pagePe`, `pageAe`, `pageTl` : les cockpits des rôles qui n'en avaient pas.
// Les cockpits PM et QA existants reçoivent la carte assistant en tête.
//
// Chaque chiffre vient des données collectées ; une donnée absente s'affiche
// « — », jamais une valeur supposée.
//
// @intent INTENT-037
// @spec SPEC-037-1-dashboard-par-role
// @verified-by test/dashboard-roles.test.js
// @governance AIAD-RGAA
//
// Documentation : https://aiad.ovh

import { escape, lienSource } from '../ui/helpers.js';
import { statutBadge, sqsBadge, badge } from '../ui/badges.js';
import { distributionBar } from '../ui/sparklines.js';
import { ONGLETS_ROLE, ongletDuLien } from '../navigation.js';
import { listerAlertes } from './overview.js';
import { ROLE_AGENTS, SUB_AGENTS, GOVERNANCE_AGENTS } from '../../agents-registry.js';
import { validerEquipe } from '../../agents.js';
import { listerSkills } from '../../skills.js';
import { calculerPm } from '../pm.js';
import { calculerQa } from '../qa.js';
import { calculerTechDebt } from '../tech-debt.js';
import { extraireAdrs } from '../adrs.js';
import { calculerSre } from '../sre.js';
import { calculerViolations } from '../violations.js';

const FERMES = ['closed', 'resolu', 'résolu'];
const STATUTS_EN_COURS = ['draft', 'review', 'ready', 'in-progress', 'validation'];

/** Exécute `fn` ; `repli` si les données sont partielles (tests, projet neuf). */
function sur(fn, repli) {
  try { const v = fn(); return v === undefined ? repli : v; } catch { return repli; }
}
/** SPECs du projet, hors gabarits (`spec-template`, `spec-ears-template`). */
function specsReelles(donnees) {
  return sur(() => donnees.specs.filter((s) => !/template/i.test(String(s.id))), []);
}
const nb = (v) => (v === null || v === undefined || Number.isNaN(v) ? '—' : String(v));
const pct = (num, den) => (den > 0 ? `${Math.round((num / den) * 100)} %` : '—');

function alertesDe(donnees, ongletId) {
  return sur(() => listerAlertes(donnees).filter((a) => ongletDuLien(a.cible) === ongletId), []);
}

function blocAlertesRole(donnees, ongletId) {
  const alertes = alertesDe(donnees, ongletId);
  if (alertes.length === 0) {
    return `<section><h2>À traiter</h2><div class="alertes ok"><span class="alertes-icon" aria-hidden="true">✓</span><div><strong>Rien à signaler</strong><div class="muted">Aucun signal ne demande de décision sur ce périmètre.</div></div></div></section>`;
  }
  const poids = { bad: 0, warn: 1 };
  const tri = [...alertes].sort((a, b) => (poids[a.gravite] ?? 9) - (poids[b.gravite] ?? 9));
  return `<section><h2>À traiter <span class="count">${alertes.length}</span></h2>
  <div class="alertes-list">${tri.slice(0, 6).map((a) => `<a href="${a.cible}" class="alerte alerte-${a.gravite}"><div class="alerte-titre">${escape(a.titre)}</div><div class="alerte-detail">${escape(a.detail)}</div><div class="alerte-action">→ ${escape(a.action)}</div></a>`).join('')}</div>
  ${tri.length > 6 ? `<p class="muted">+ ${tri.length - 6} autre(s) signal(s) de priorité moindre.</p>` : ''}</section>`;
}

const kpi = (label, valeur, detail, cls = '') => `
  <div class="kpi ${cls}"><div class="label">${escape(label)}</div><div class="value">${escape(String(valeur))}</div><div class="delta">${escape(detail)}</div></div>`;

// ─── Carte « votre assistant » ───────────────────────────────────────────────

/**
 * Carte de l'agent de rôle d'un onglet : commande de lancement et sous-agents.
 * Chaîne vide pour la vue d'ensemble ou un onglet inconnu.
 */
export function blocAssistant(ongletId) {
  const onglet = ONGLETS_ROLE.find((o) => o.id === ongletId);
  const role = onglet && ROLE_AGENTS.find((r) => r.name === onglet.agent);
  if (!role) return '';
  const equipe = SUB_AGENTS.filter((s) => s.owner === role.name);
  return `<section class="assistant" aria-label="Assistant du ${escape(role.label)}">
  <div>
    <h2>Votre assistant : <code>${escape(role.name)}</code></h2>
    <p>Il prépare, délègue à ses ${equipe.length} sous-agents et rend compte. Les décisions restent les vôtres.</p>
  </div>
  <code class="assistant-cmd" data-copy="claude --agent ${escape(role.name)}" title="Copier la commande">claude --agent ${escape(role.name)}</code>
  <div class="assistant-team">${equipe.map((s) => `<span class="chip" title="${escape(s.mission)}"><code>${escape(s.name)}</code></span>`).join('')}</div>
</section>`;
}

// ─── Chiffres par rôle (cartes de la vue d'ensemble) ─────────────────────────

function chiffresPm(donnees) {
  const pm = sur(() => calculerPm(donnees), null);
  const actifs = sur(() => donnees.intents.filter((i) => i.statut === 'active').length, null);
  return [
    ['Intents actifs', nb(actifs)],
    ['En livraison', nb(pm?.funnel?.inDelivery)],
    ['Zombies', nb(pm ? pm.zombies.length : null)],
  ];
}

function chiffresPe(donnees) {
  const specs = specsReelles(donnees);
  const enCours = specs.filter((s) => STATUTS_EN_COURS.includes(s.statut)).length;
  const drifts = sur(() => donnees.facts.filter((f) => !FERMES.includes(f.statut)).length, null);
  const s = sur(() => donnees.matrice.summary, null);
  return [
    ['SPECs en cours', nb(enCours)],
    ['Code tracé', s ? pct(s.annotatedCodeFiles, s.codeFiles) : '—'],
    ['Facts ouverts', nb(drifts)],
  ];
}

function etatEquipe(donnees) {
  return sur(() => validerEquipe(donnees.projet.racine), null);
}

function chiffresAe(donnees) {
  const equipe = etatEquipe(donnees);
  const skills = sur(() => listerSkills(donnees.projet.racine).length, null);
  const gouv = sur(() => donnees.gouvernance, []);
  return [
    ['Agents conformes', equipe && equipe.installed ? `${equipe.valid}/${equipe.total}` : '—'],
    ['Skills', nb(skills)],
    ['Gouvernance', gouv.length ? `${gouv.filter((g) => g.present).length}/${gouv.length}` : '—'],
  ];
}

function chiffresQa(donnees) {
  const qa = sur(() => calculerQa(donnees.projet.racine, donnees), null);
  return [
    ['Sans tests', nb(qa ? qa.queueReadySansTests.length : null)],
    ['EARS conformes', qa && qa.ears.total > 0 ? `${qa.ears.passants}/${qa.ears.total}` : '—'],
    ['Régressions', nb(qa ? qa.regressions.total : null)],
  ];
}

function chiffresTl(donnees) {
  const adrs = sur(() => extraireAdrs(donnees.projet.racine).total, null);
  const dep = sur(() => donnees.metrics.agregats.deployments, null);
  const viol = sur(() => calculerViolations(donnees.projet.racine, donnees).total, null);
  return [
    ['ADR', nb(adrs)],
    ['Déploiements', nb(dep?.total)],
    ['Violations', nb(viol)],
  ];
}

const CHIFFRES = { pm: chiffresPm, pe: chiffresPe, ae: chiffresAe, qa: chiffresQa, tl: chiffresTl };

/**
 * Résumé de chaque rôle pour la vue d'ensemble.
 *
 * @returns {{ id: string, titre: string, court: string, agent: string, question: string, file: string, chiffres: [string, string][], alertes: { bad: number, warn: number } }[]}
 */
export function resumeRoles(donnees) {
  return ONGLETS_ROLE.map((o) => {
    const alertes = alertesDe(donnees, o.id);
    return {
      id: o.id,
      titre: o.titre,
      court: o.court,
      agent: o.agent,
      question: o.question,
      file: o.pages[0].file,
      chiffres: sur(() => CHIFFRES[o.id](donnees), []),
      alertes: {
        bad: alertes.filter((a) => a.gravite === 'bad').length,
        warn: alertes.filter((a) => a.gravite !== 'bad').length,
      },
    };
  });
}

// ─── Cockpit Product Engineer ────────────────────────────────────────────────

export function pagePe(donnees) {
  const specs = specsReelles(donnees);
  const parStatut = (st) => specs.filter((s) => s.statut === st).length;
  const sqs = specs.map((s) => Number(s.sqs)).filter((v) => !Number.isNaN(v));
  const sqsMoyen = sqs.length ? (sqs.reduce((a, b) => a + b, 0) / sqs.length).toFixed(1) : null;
  const aLaGate = parStatut('draft') + parStatut('review');
  const s = sur(() => donnees.matrice.summary, null);
  const gaps = sur(() => donnees.matrice.gaps, null);
  const gapsBloquants = gaps ? gaps.specsValideesNonImplementees.length + gaps.intentsSansSpec.length : null;
  const facts = sur(() => donnees.facts.filter((f) => !FERMES.includes(f.statut)), []);
  const enCours = specs.filter((sp) => STATUTS_EN_COURS.includes(sp.statut));

  const lignes = enCours.slice(0, 10).map((sp) => `
    <tr>
      <td>${sp.file ? lienSource(sp.file, sp.id) : `<code>${escape(sp.id)}</code>`}</td>
      <td>${escape(sp.titre)}</td>
      <td>${sp.parentIntent ? `<code>${escape(sp.parentIntent)}</code>` : '<span class="muted">—</span>'}</td>
      <td>${statutBadge(sp.statut)}</td>
      <td>${sqsBadge(sp.sqs)}</td>
    </tr>`).join('');

  return `${blocAssistant('pe')}
<div class="kpis">
  ${kpi('SPECs en cours', enCours.length, `sur ${specs.length} SPEC(s) non archivée(s)`)}
  ${kpi('À passer la Gate', aLaGate, 'draft ou en revue', aLaGate > 0 ? 'warn' : 'ok')}
  ${kpi('Gate ouverte', parStatut('ready'), 'prêtes pour /sdd exec')}
  ${kpi('SQS moyen', sqsMoyen === null ? '—' : `${sqsMoyen}/5`, sqs.length ? `${sqs.length} SPEC(s) notée(s)` : 'aucune SPEC notée', sqsMoyen === null ? '' : (sqsMoyen >= 4 ? 'ok' : 'warn'))}
  ${kpi('Code tracé', s ? pct(s.annotatedCodeFiles, s.codeFiles) : '—', s ? `${s.annotatedCodeFiles}/${s.codeFiles} fichiers annotés @spec` : 'matrice indisponible')}
  ${kpi('Facts ouverts', facts.length, 'écarts livré / désiré', facts.length === 0 ? 'ok' : 'warn')}
</div>
${blocAlertesRole(donnees, 'pe')}
<section>
  <h2>Où en sont les SPECs</h2>
  ${distributionBar([
    { label: 'draft', value: parStatut('draft'), cls: 'seg-muted' },
    { label: 'review', value: parStatut('review'), cls: 'seg-warn' },
    { label: 'ready', value: parStatut('ready'), cls: 'seg-info' },
    { label: 'in-progress', value: parStatut('in-progress'), cls: 'seg-info' },
    { label: 'validation', value: parStatut('validation'), cls: 'seg-warn' },
    { label: 'done', value: parStatut('done'), cls: 'seg-ok' },
  ])}
</section>
<section>
  <h2>SPECs en cours <span class="count">${enCours.length}</span></h2>
  ${enCours.length === 0
    ? `<div class="empty"><strong>Aucune SPEC en cours.</strong>Lancez <code>/sdd spec</code> depuis un Intent validé.</div>`
    : `<table><thead><tr><th>SPEC</th><th>Titre</th><th>Intent</th><th>Statut</th><th>SQS</th></tr></thead><tbody>${lignes}</tbody></table>`}
</section>
<section>
  <h2>Drift Lock</h2>
  <div class="kpis">
    ${kpi('Gaps bloquants', nb(gapsBloquants), 'SPEC validée sans code · Intent sans SPEC', gapsBloquants ? 'warn' : (gapsBloquants === 0 ? 'ok' : ''))}
    ${kpi('Code sans SPEC', nb(gaps ? gaps.codeSansSpec.total : null), 'fichiers applicatifs non annotés')}
    ${kpi('Code sans test lié', nb(gaps ? gaps.codeSansTests.length : null), 'annotation @verified-by absente')}
  </div>
  <div class="actions"><a href="traceability.html">→ Matrice de traçabilité</a><a href="kanban.html">→ Kanban des SPECs</a><a href="drifts.html">→ Drifts &amp; Facts</a></div>
</section>`;
}

// ─── Cockpit Agents Engineer ─────────────────────────────────────────────────

export function pageAe(donnees) {
  const equipe = etatEquipe(donnees);
  const installe = Boolean(equipe && equipe.installed);
  const skills = sur(() => listerSkills(donnees.projet.racine).length, null);
  const gouv = sur(() => donnees.gouvernance, []);
  const gouvOk = gouv.filter((g) => g.present).length;
  const hooks = sur(() => donnees.supplementaire.hookStats, null);
  const etat = new Map((equipe?.results || []).map((r) => [r.name, r]));

  const lignes = ROLE_AGENTS.map((r) => {
    const subs = SUB_AGENTS.filter((s) => s.owner === r.name);
    const tous = [r.name, ...subs.map((s) => s.name)];
    const ecarts = tous.filter((n) => etat.get(n) && !etat.get(n).ok);
    const statut = !installe ? badge('non installé', 'badge-muted')
      : ecarts.length === 0 ? badge('conforme', 'badge-ok') : badge(`${ecarts.length} écart(s)`, 'badge-bad');
    return `
    <tr>
      <td><code>${escape(r.name)}</code><div class="muted">${escape(r.label)}</div></td>
      <td>${subs.map((s) => `<span class="chip" title="${escape(s.mission)}"><code>${escape(s.name)}</code></span>`).join(' ')}</td>
      <td>${statut}${ecarts.length ? `<div class="muted">${ecarts.map(escape).join(', ')}</div>` : ''}</td>
    </tr>`;
  }).join('');

  const santeHooks = hooks?.available ? hooks.sante : null;
  return `${blocAssistant('ae')}
<div class="kpis">
  ${kpi('Agents conformes', installe ? `${equipe.valid}/${equipe.total}` : '—', installe ? 'registre vs .claude/agents/' : 'équipe non installée', installe ? (equipe.ok ? 'ok' : 'bad') : '')}
  ${kpi('Agents de rôle', ROLE_AGENTS.length, 'un assistant par responsabilité')}
  ${kpi('Sous-agents', SUB_AGENTS.length, 'un seul gestionnaire chacun')}
  ${kpi('Skills installées', nb(skills), '.claude/skills/')}
  ${kpi('Gouvernance Tier 1', gouv.length ? `${gouvOk}/${gouv.length}` : '—', 'agents à droit de veto', gouv.length && gouvOk === gouv.length ? 'ok' : (gouv.length ? 'warn' : ''))}
  ${kpi('Hooks', santeHooks || '—', hooks?.available ? `${hooks.count} exécution(s) mesurée(s)` : 'aucune mesure', santeHooks === 'ok' ? 'ok' : (santeHooks ? 'warn' : ''))}
</div>
${blocAlertesRole(donnees, 'ae')}
<section>
  <h2>L'équipe d'agents</h2>
  <p class="section-lede">Chaque sous-agent est lancé par un seul agent de rôle. Les agents de gouvernance (${GOVERNANCE_AGENTS.map((g) => `<code>${escape(g)}</code>`).join(', ')}) restent consultables par tous : leur veto prévaut.</p>
  <table><thead><tr><th>Agent de rôle</th><th>Sous-agents</th><th>Conformité</th></tr></thead><tbody>${lignes}</tbody></table>
  ${installe && equipe.orphans.length ? `<p class="muted">Sous-agent(s) sans gestionnaire connu : ${equipe.orphans.map((o) => `<code>${escape(o)}</code>`).join(', ')}.</p>` : ''}
  <div class="actions"><code>npx aiad-sdd agents validate</code><code>npx aiad-sdd skills validate</code><a href="governance.html">→ Gouvernance Tier 1</a><a href="eco.html">→ Impact écologique</a></div>
</section>
<section>
  <h2>Ce qui n'est pas mesuré ici</h2>
  <p class="section-lede">L'utilité réelle de chaque agent (usage, taux de correction humaine, faux positifs) ne figure pas encore dans ce cockpit. Elle se juge avec la skill <code>agent-monitoring</code> ; un agent inutilisé se retire.</p>
</section>`;
}

// ─── Cockpit Tech Lead ───────────────────────────────────────────────────────

export function pageTl(donnees) {
  const racine = sur(() => donnees.projet.racine, null);
  const adrs = sur(() => extraireAdrs(racine), null);
  const dette = sur(() => calculerTechDebt(racine, donnees), null);
  const sre = sur(() => calculerSre(racine, donnees), null);
  const viol = sur(() => calculerViolations(racine, donnees), null);
  const dep = sur(() => donnees.metrics.agregats.deployments, null);
  const fond = sur(() => donnees.fondamentaux.find((f) => /ARCHITECTURE/i.test(f.nom)), null);
  const succes = dep && dep.total > 0 ? pct(dep.success, dep.total) : '—';
  const critiques = sre ? (sre.severites.security['critique'] || 0) + (sre.severites.security['élevé'] || 0) : null;

  return `${blocAssistant('tl')}
<div class="kpis">
  ${kpi('ARCHITECTURE.md', fond ? (fond.present ? (fond.rempli ? 'rédigé' : 'gabarit') : 'absent') : '—', 'référence de cohérence', fond?.rempli ? 'ok' : (fond ? 'warn' : ''))}
  ${kpi('ADR', nb(adrs?.total), 'décisions d\'architecture tracées')}
  ${kpi('Déploiements', nb(dep?.total), dep?.total ? `${succes} réussis` : 'aucun enregistré')}
  ${kpi('Lead time moyen', dep?.leadTimeMoyen != null ? `${dep.leadTimeMoyen} j` : '—', 'de la SPEC à la production')}
  ${kpi('Violations Tier 1', nb(viol?.total), 'code ↔ gouvernance déclarée', viol ? (viol.total === 0 ? 'ok' : 'warn') : '')}
  ${kpi('Sécurité critique / élevée', nb(critiques), sre ? `${sre.security.total} rapport(s) d'audit` : 'aucun rapport', critiques ? 'bad' : (critiques === 0 && sre?.security.total ? 'ok' : ''))}
</div>
${blocAlertesRole(donnees, 'tl')}
<section>
  <h2>Dette technique</h2>
  <div class="kpis">
    ${kpi('TODO-JNSP ouverts', nb(dette?.jnsp.total), 'questions laissées à l\'humain dans le code', dette ? (dette.jnsp.total === 0 ? 'ok' : 'warn') : '')}
    ${kpi('SPECs trop grosses', nb(dette?.specsGrosses.total), dette ? `au-delà de ${dette.seuilLoc} lignes — à découper` : 'non mesuré', dette?.specsGrosses.total ? 'warn' : '')}
    ${kpi('SPECs proches du seuil', nb(dette?.specsWarning.total), dette ? `au-delà de ${dette.seuilLocWarn} lignes` : 'non mesuré')}
  </div>
</section>
<section>
  <h2>Aller plus loin</h2>
  <div class="actions"><a href="adrs.html">→ Décisions d'architecture</a><a href="metrics.html">→ DORA &amp; Flow</a><a href="sre.html">→ SRE / Ops</a><a href="graph.html">→ Graphe de connaissances</a></div>
</section>`;
}
