// AIAD SDD Mode — Dashboard : widget PM "À valider cette semaine" (#137).
//
// Agrège trois signaux pour la persona Product Manager :
//   (i) Intents zombies  → status active depuis > 30j sans SPEC modifiée
//   (ii) Intents drafts  → status draft depuis > 14j
//   (iii) SPECs done non démontrées depuis le dernier `/aiad demo`
//
// Toutes les fonctions sont pures et consomment `donnees` produit par
// `collecterDonnees`. Aucun effet de bord. Les seuils sont configurables via
// le 2ᵉ argument optionnel pour faciliter les tests.
//
// Pour l'item (iii), la convention `/aiad demo` est d'écrire un fichier
// horodaté dans `.aiad/metrics/demo/` ; `donnees.metrics.categories.demo`
// expose le dernier mtime de cette catégorie.

export const SEUILS = Object.freeze({
  intentZombieJours: 30,
  intentDraftJours: 14,
});

function jours(ms) { return ms / (24 * 3600 * 1000); }

// ─── (i) Intents zombies ────────────────────────────────────────────────────
//
// Un Intent "zombie" est marqué `active` mais n'a aucune SPEC dont le mtime
// est postérieur à sa date de bascule en active. Heuristique pragmatique : on
// approxime "date de bascule en active" par le mtime du fichier Intent lui-
// même. Si SPEC parente la plus récente est antérieure à `aujourd'hui - 30j`
// ET au mtime de l'Intent, on signale.

// (#158) Date de référence pour zombies : `activated_at` du frontmatter si
// présent (signe explicite de bascule en active), sinon mtime du fichier.
// Accepte ISO 8601 partiel (`2025-04-01` ou `2025-04-01T12:00:00Z`).
function dateActivation(intent) {
  if (intent.activatedAt) {
    const t = Date.parse(intent.activatedAt);
    if (!isNaN(t)) return { ts: t, source: 'activated_at' };
  }
  if (intent.mtime) return { ts: intent.mtime, source: 'mtime' };
  return { ts: null, source: 'none' };
}

export function intentsZombies(donnees, seuils = SEUILS) {
  const now = Date.now();
  const limite = now - seuils.intentZombieJours * 24 * 3600 * 1000;
  const specsParIntent = new Map();
  for (const s of donnees?.specs || []) {
    if (!s.parentIntent) continue;
    const cle = s.parentIntent.split('-').slice(0, 2).join('-'); // INTENT-NNN
    if (!specsParIntent.has(cle)) specsParIntent.set(cle, []);
    specsParIntent.get(cle).push(s);
  }

  const out = [];
  for (const i of donnees?.intents || []) {
    if (i.statut !== 'active') continue;
    const ref = dateActivation(i);
    if (!ref.ts || ref.ts > limite) continue; // récent → pas zombie
    const cle = i.id.split('-').slice(0, 2).join('-');
    const specs = specsParIntent.get(cle) || [];
    const lastSpecMtime = specs.reduce((m, s) => Math.max(m, s.mtime || 0), 0);
    if (lastSpecMtime > limite) continue; // SPEC remuée récemment → ok
    out.push({
      id: i.id,
      titre: i.titre,
      statut: i.statut,
      mtime: i.mtime,
      file: i.file || null, // (#159) chemin source pour lien cliquable
      activatedAt: ref.source === 'activated_at' ? i.activatedAt : null, // (#158)
      sourceAge: ref.source, // (#158) `activated_at` ou `mtime`, utile en debug
      lastSpecMtime: lastSpecMtime || null,
      anciennete: Math.round(jours(now - ref.ts)),
      specsCount: specs.length,
    });
  }
  out.sort((a, b) => {
    // Tri par âge décroissant (plus ancien d'abord) — référence : `ts` calculé.
    const ta = dateActivation(donnees.intents.find((x) => x.id === a.id) || {}).ts || 0;
    const tb = dateActivation(donnees.intents.find((x) => x.id === b.id) || {}).ts || 0;
    return ta - tb;
  });
  return out;
}

// ─── (ii) Intents drafts trop vieux ─────────────────────────────────────────

export function intentsDraftsAnciens(donnees, seuils = SEUILS) {
  const now = Date.now();
  const limite = now - seuils.intentDraftJours * 24 * 3600 * 1000;
  const out = [];
  for (const i of donnees?.intents || []) {
    if (i.statut !== 'draft') continue;
    if (!i.mtime || i.mtime > limite) continue;
    out.push({
      id: i.id,
      titre: i.titre,
      statut: i.statut,
      mtime: i.mtime,
      file: i.file || null, // (#159)
      anciennete: Math.round(jours(now - i.mtime)),
    });
  }
  out.sort((a, b) => a.mtime - b.mtime);
  return out;
}

// ─── (iii) SPECs done non démontrées depuis le dernier `/aiad demo` ────────

export function lastDemoMtime(donnees) {
  const cat = donnees?.metrics?.categories?.demo;
  if (!cat?.fichiers?.length) return null;
  return cat.fichiers.reduce((m, f) => Math.max(m, f.mtime || 0), 0) || null;
}

export function specsDoneNonDemontrees(donnees) {
  const last = lastDemoMtime(donnees);
  const out = [];
  for (const s of donnees?.specs || []) {
    if (s.statut !== 'done') continue;
    if (!s.mtime) continue;
    // Si pas de demo enregistrée, toutes les `done` sont "non démontrées".
    if (last !== null && s.mtime < last) continue;
    out.push({
      id: s.id,
      titre: s.titre,
      mtime: s.mtime,
      file: s.file || null, // (#159)
      lastDemo: last,
    });
  }
  out.sort((a, b) => (a.mtime || 0) - (b.mtime || 0));
  return out;
}

// ─── (iv) Avancement Intent ↔ Livraison (#231) ──────────────────────────────
//
// Pour chaque Intent, compte les SPECs liées par statut. Donne au PM un
// signal d'alignement direct entre l'intention et la livraison : tant que
// `done < total`, l'Intent n'est pas réalisé même s'il est marqué `active`.

const STATUTS_LIVRES = new Set(['done', 'archived']);

export function calculerAvancement(donnees) {
  const specsParIntent = new Map();
  for (const s of donnees?.specs || []) {
    if (!s.parentIntent) continue;
    // Normalisation INTENT-NNN (court) pour matcher Intent.id même si
    // parentIntent est `SPEC-NNN-…` ou `INTENT-NNN-slug`.
    const cle = s.parentIntent.split('-').slice(0, 2).join('-');
    if (!specsParIntent.has(cle)) specsParIntent.set(cle, []);
    specsParIntent.get(cle).push(s);
  }
  const out = [];
  for (const i of donnees?.intents || []) {
    const cle = i.id.split('-').slice(0, 2).join('-');
    const specs = specsParIntent.get(cle) || [];
    const total = specs.length;
    const done = specs.filter((s) => STATUTS_LIVRES.has(s.statut)).length;
    const enCours = specs.filter((s) => ['in-progress', 'validation', 'review'].includes(s.statut)).length;
    const ratio = total === 0 ? null : done / total;
    out.push({
      id: i.id,
      titre: i.titre,
      statut: i.statut,
      file: i.file || null,
      total,
      done,
      enCours,
      ratio,
    });
  }
  return out;
}

// ─── (v) Funnel Intent (#232) ───────────────────────────────────────────────
//
// Distribution des Intents en 4 étapes du cycle SDD : Idea (draft) →
// Validated (active sans SPEC) → In delivery (active avec ≥ 1 SPEC) →
// Done (statut done).

export function calculerFunnel(donnees) {
  const avancement = calculerAvancement(donnees);
  const idx = new Map(avancement.map((a) => [a.id, a]));
  let idea = 0, validated = 0, inDelivery = 0, done = 0, archived = 0;
  for (const i of donnees?.intents || []) {
    const av = idx.get(i.id);
    if (i.statut === 'done') { done++; continue; }
    if (i.statut === 'archived') { archived++; continue; }
    if (i.statut === 'draft') { idea++; continue; }
    if (i.statut === 'active') {
      if ((av?.total || 0) === 0) validated++;
      else inDelivery++;
      continue;
    }
    // Statuts inconnus : comptés en idea.
    idea++;
  }
  return { idea, validated, inDelivery, done, archived };
}

// ─── Façade ─────────────────────────────────────────────────────────────────

export function calculerPm(donnees, seuils = SEUILS) {
  return {
    zombies: intentsZombies(donnees, seuils),
    draftsAnciens: intentsDraftsAnciens(donnees, seuils),
    specsNonDemontrees: specsDoneNonDemontrees(donnees),
    avancement: calculerAvancement(donnees),
    funnel: calculerFunnel(donnees),
    seuils,
    lastDemoMtime: lastDemoMtime(donnees),
  };
}

// ─── Rendu HTML ─────────────────────────────────────────────────────────────
//
// Renvoie un bloc `<section>` qui se branche en haut de pageOverview. Vide
// quand aucune alerte (équipe à jour) → on retourne quand même une carte
// "rien à faire" pour rassurer le PM.

import { escape, lienSource } from './render.js';
import { blocCouverturePrd } from './prd-coverage.js';
import { blocVelocity } from './velocity.js';
import { rendreSectionIntent } from './markdown-light.js';
import { blocTopPriorites } from './intent-priority.js';
import { blocRoadmap } from './roadmap.js';
import { blocDemoReadiness } from './demo-readiness.js';
import { blocPersonaDrill } from './persona-drill.js';
import { blocEcheances } from './deadlines.js';
import { blocBriefPm } from './brief-pm.js';
import { blocPmDiff } from './pm-diff.js';
import { blocIntentDeps } from './intent-deps.js';
import { blocOwnership } from './ownership.js';
import { blocBottlenecks } from './bottlenecks.js';
import { blocSponsors } from './sponsors.js';
import { blocCycleTime } from './cycle-time.js';
import { blocRisks } from './risks.js';
import { blocHypotheses } from './hypotheses.js';
import { blocRiceMatrix } from './rice-matrix.js';
import { blocDecisionLog } from './decision-log.js';
import { wrapWithToc } from './pm-toc.js';
import { blocStickyAlerts } from './sticky-alerts.js';
import { blocActiviteRecente } from './recent-activity.js';
import { blocCsvIntents } from './intents-csv.js';
import { blocPrintMode } from './print-mode.js';
import { blocQuickCapture } from './quick-capture.js';
import { blocCumulativeFlow } from './cumulative-flow.js';
import { blocOkrMapping } from './okr-mapping.js';
import { blocDiscoveryBoard } from './discovery-board.js';
import { blocTagCloud } from './tag-cloud.js';
import { blocBurnupChart } from './burnup-chart.js';
import { blocRefinement } from './refinement.js';
import { blocIntentPagesIndex } from './intent-page.js';
import { blocCapacityPlanner } from './capacity-planner.js';
import { blocGlobalSearch } from './global-search.js';
import { blocSectionPermalinks } from './section-permalinks.js';
import { blocConfidenceTracker } from './confidence-tracker.js';
import { blocPmJournal } from './pm-journal.js';
import { blocOnboardingTour, blocOnboardingTourReplay } from './onboarding-tour.js';
import { blocSmartSuggestions } from './smart-suggestions.js';
import { blocActivityHeatmap } from './activity-heatmap.js';
import { blocDailyFocus } from './daily-focus.js';
import { blocSavedFilters } from './saved-filters.js';
import { blocQuickLinks } from './quick-links.js';
import { blocNewsletter } from './weekly-newsletter.js';
import { blocVelocityComparison } from './velocity-comparison.js';
import { blocWipLimit } from './wip-limit.js';
import { blocBacklogFreshness } from './backlog-freshness.js';
import { blocStandupTimer } from './standup-timer.js';
import { blocQuarterlyRetro } from './quarterly-retro.js';
import { blocGoalTree } from './goal-tree.js';
import { blocAbTestTracker } from './ab-test-tracker.js';
import { blocRiskBurndown } from './risk-burndown.js';
import { blocPmThemeSwitcher } from './pm-theme.js';
import { blocOutcomeLeaderboard } from './outcome-leaderboard.js';
import { blocVelocityForecast } from './velocity-forecast.js';
import { blocCockpitTabs } from './cockpit-tabs.js';
import { blocPmMdExport } from './pm-md-export.js';
import { blocAiActCompliance } from './ai-act-compliance.js';
import { blocNotificationCenter } from './notification-center.js';
import { blocSqsReadiness } from './sqs-readiness.js';
import { blocHealthTimeline } from './health-timeline.js';
import { blocIntentMaturity } from './intent-maturity.js';
import { blocStrategicNarrative } from './strategic-narrative.js';
import { blocSprintPlanner } from './sprint-planner.js';
import { blocStakeholderComms } from './stakeholder-comms.js';
import { blocDecisionVelocity } from './decision-velocity.js';
import { blocWeeklyChecklist } from './pm-weekly-checklist.js';
import { blocOutcomeAttribution } from './outcome-attribution.js';
import { blocDiscoveryDeliveryBalance } from './discovery-delivery-balance.js';
import { blocVelocityBySponsor } from './velocity-by-sponsor.js';
import { blocPrdFreshness } from './prd-freshness.js';
import { blocCustomerFeedback } from './customer-feedback.js';
import { blocWhatsNew } from './whats-new.js';
import { blocHypothesisLifecycle } from './hypothesis-lifecycle.js';
import { blocRoadmapTimeline } from './roadmap-timeline.js';
import { blocPmScorecard } from './pm-scorecard.js';
import { blocIntentCompare } from './intent-compare.js';
import { blocSponsorPrep } from './sponsor-prep.js';
import { blocBacklogHygiene } from './backlog-hygiene.js';
import { blocTimeToFirstSpec } from './time-to-first-spec.js';
import { blocCustomerVoiceWall } from './customer-voice-wall.js';
import { blocQuarterlyDelivery } from './quarterly-delivery.js';
import { blocReviewQueue } from './review-queue.js';
import { blocAcceptedRisks } from './accepted-risks.js';
import { blocWinsWall } from './wins-wall.js';
import { blocStateTransitions } from './state-transitions.js';
import { blocOrphanDeps } from './orphan-deps.js';
import { blocDemoAgenda } from './demo-agenda.js';
import { blocSpecStuck } from './spec-stuck.js';
import { blocTagClusters } from './tag-clusters.js';
import { blocCostOfDelay } from './cost-of-delay.js';
import { blocBacklogPyramid } from './backlog-pyramid.js';
import { blocSpecCrossIntent } from './spec-cross-intent.js';
import { blocBlockerReminders } from './blocker-reminders.js';
import { blocPersonaOutcomeMatrix } from './persona-outcome-matrix.js';
import { blocThroughputTrend } from './throughput-trend.js';
import { blocRiskConcentration } from './risk-concentration.js';
import { blocDiscoveryToDelivery } from './discovery-to-delivery.js';
import { blocOwnerWorkload } from './owner-workload.js';
import { blocReadingTime } from './reading-time.js';
import { blocSpecScope } from './spec-scope.js';
import { blocGoalAlignment } from './goal-alignment.js';
import { blocVelocitySla } from './velocity-sla.js';
import { blocDoneTimeline } from './done-timeline.js';
import { blocPrdSectionsCoverage } from './prd-sections-coverage.js';
import { blocOutcomeCompletion } from './outcome-completion.js';
import { blocRiskTransparency } from './risk-transparency.js';
import { blocCumulativeAchievements } from './cumulative-achievements.js';
import { blocStandupScript } from './standup-script.js';
import { blocQuarterlyRetroDraft } from './quarterly-retro-draft.js';
import { blocPrdCoverageGaps } from './prd-coverage-gaps.js';
import { blocSpecAnnotationCoverage } from './spec-annotation-coverage.js';
import { blocPortfolioDiversity } from './portfolio-diversity.js';
import { blocDowHeatmap } from './dow-heatmap.js';
import { blocPrTemplate } from './pr-template.js';
import { blocVelocityByTag } from './velocity-by-tag.js';
import { blocAutoArchiveCandidates } from './auto-archive-candidates.js';
import { blocSprintRecap } from './sprint-recap.js';
import { blocAcceptanceCriteria } from './acceptance-criteria.js';
import { blocActionItems } from './action-items.js';
import { blocOkrProgress } from './okr-progress.js';
import { blocBusFactor } from './bus-factor.js';
import { blocSentimentTrend } from './sentiment-trend.js';
import { blocRitualsCalendar } from './rituals-calendar.js';
import { blocNewcomerChecklist } from './newcomer-checklist.js';
import { blocPendingDecisions } from './pending-decisions.js';
import { blocStakeholderMap } from './stakeholder-map.js';

// (#159) Rendu d'un ID avec lien vers le fichier source quand disponible.
// (#335) Délègue à `lienSource(file, id)` du module render.js pour profiter
// de la résolution `--source-base` (CLI/env/auto) — auparavant l'anchor
// `../FILE` était hardcodé et ignorait sourceBase sur GitHub Pages.
function idLien(item) {
  if (item.file) return lienSource(item.file, item.id);
  return `<code>${escape(item.id)}</code>`;
}

function lignesIntents(items, label, cls) {
  if (items.length === 0) {
    return `<p class="muted"><span class="badge ok">${label} : 0</span> Rien à valider.</p>`;
  }
  const rows = items.slice(0, 10).map((i) => `
    <tr>
      <td>${idLien(i)}</td>
      <td>${escape(i.titre || '')}</td>
      <td class="muted">${i.anciennete} j</td>
    </tr>`).join('');
  return `
    <p class="muted"><span class="badge ${cls}">${label} : ${items.length}</span></p>
    <table>
      <thead><tr><th>ID</th><th>Titre</th><th>Ancienneté</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function lignesSpecs(items, lastDemo) {
  if (items.length === 0) {
    return `<p class="muted"><span class="badge ok">SPECs done non démontrées : 0</span></p>`;
  }
  const rows = items.slice(0, 10).map((s) => `
    <tr>
      <td>${idLien(s)}</td>
      <td>${escape(s.titre || '')}</td>
      <td class="muted">${new Date(s.mtime).toLocaleDateString('fr-FR')}</td>
    </tr>`).join('');
  const hint = lastDemo
    ? `<p class="muted">Dernière demo : ${new Date(lastDemo).toLocaleDateString('fr-FR')}</p>`
    : `<p class="muted"><em>Aucune trace de <code>/aiad demo</code> dans <code>.aiad/metrics/demo/</code> — toutes les SPECs <code>done</code> sont listées.</em></p>`;
  return `
    <p class="muted"><span class="badge warn">SPECs done non démontrées : ${items.length}</span></p>
    ${hint}
    <table>
      <thead><tr><th>ID</th><th>Titre</th><th>Done depuis</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function pmSection(donnees) {
  const pm = donnees?.pm;
  if (!pm) return '';
  const total = pm.zombies.length + pm.draftsAnciens.length + pm.specsNonDemontrees.length;
  const titreBadge = total === 0
    ? '<span class="badge ok">À jour</span>'
    : `<span class="badge warn">${total} action(s)</span>`;
  return `
<section>
  <h2>À valider cette semaine ${titreBadge}</h2>
  <div class="split">
    <div>
      <h3>Intents zombies <span class="count">${pm.zombies.length} (active &gt; ${pm.seuils.intentZombieJours}j sans SPEC remuée)</span></h3>
      ${lignesIntents(pm.zombies, 'Zombies', pm.zombies.length === 0 ? 'ok' : 'warn')}
    </div>
    <div>
      <h3>Intents drafts vieux <span class="count">${pm.draftsAnciens.length} (draft &gt; ${pm.seuils.intentDraftJours}j)</span></h3>
      ${lignesIntents(pm.draftsAnciens, 'Drafts', pm.draftsAnciens.length === 0 ? 'ok' : 'warn')}
    </div>
  </div>
  <h3 style="margin-top:1.5rem">SPECs done non démontrées</h3>
  ${lignesSpecs(pm.specsNonDemontrees, pm.lastDemoMtime)}
</section>
`;
}

// ─── (#232) Page dédiée PM — cockpit consolidé ──────────────────────────────
//
// Une page unique qui rassemble tout ce dont un Product Manager a besoin
// pour piloter le SDD Mode sans quitter le dashboard : alertes hebdo,
// funnel Intent, alignement Intent ↔ Livraison, sections d'Intent
// déroulables, cheatsheet CLI prête à copier.

function escAttr(s) { return escape(s); }

function progressBar(ratio, opts = {}) {
  if (ratio == null) {
    return `<span class="muted" title="Aucune SPEC liée">—</span>`;
  }
  const pct = Math.round(ratio * 100);
  const cls = ratio >= 1 ? 'ok' : ratio >= 0.5 ? 'warn' : 'bad';
  const label = opts.label || `${pct}%`;
  return `<div class="pm-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" title="Avancement : ${pct}%">
    <div class="pm-progress-fill pm-progress-${cls}" style="width:${pct}%"></div>
    <span class="pm-progress-label">${escape(label)}</span>
  </div>`;
}

function sectionsDetails(sections) {
  if (!sections) {
    return '<em class="muted">Sections POURQUOI / POUR QUI / OBJECTIF non détectées — ouvrir le fichier .md.</em>';
  }
  const items = [
    { cle: 'pourquoi', label: 'POURQUOI MAINTENANT' },
    { cle: 'pourQui', label: 'POUR QUI' },
    { cle: 'objectif', label: 'OBJECTIF' },
    { cle: 'contraintes', label: 'CONTRAINTES' },
    { cle: 'critereDrift', label: 'CRITÈRE DE DRIFT' },
  ];
  const blocs = items.map((it) => {
    const v = sections[it.cle];
    if (!v) return `<div class="pm-section pm-section-empty"><strong>${escape(it.label)}</strong><span class="muted">— non renseigné</span></div>`;
    // (#461) Markdown léger : **gras**, *italic*, listes, refs AIAD (INTENT-NNN…).
    // Sécurisé : escape HTML d'abord, allowlist d'URLs (http/https/mailto).
    return `<div class="pm-section"><strong>${escape(it.label)}</strong>${rendreSectionIntent(v)}</div>`;
  }).join('');
  return `<div class="pm-sections">${blocs}</div>`;
}

const PM_PAGE_STYLE = `
<style>
.pm-funnel { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.75rem; margin:.5rem 0 1rem; }
.pm-funnel .stage { padding:.75rem; border:1px solid var(--border, #ddd); border-radius:.5rem; background:var(--card-bg, #fff); }
.pm-funnel .stage .stage-label { font-size:.75rem; text-transform:uppercase; letter-spacing:.05em; color:var(--muted, #777); }
.pm-funnel .stage .stage-value { font-size:1.5rem; font-weight:700; margin:.25rem 0; }
.pm-funnel .stage .stage-hint { font-size:.7rem; color:var(--muted, #777); }
.pm-funnel .stage.is-bottleneck { border-color:#e8590c; background:rgba(232,89,12,.05); }
.pm-progress { position:relative; width:120px; height:14px; background:var(--track, #eee); border-radius:7px; overflow:hidden; display:inline-block; vertical-align:middle; }
.pm-progress-fill { height:100%; transition:width .2s ease; }
.pm-progress-ok { background:#2b8a3e; }
.pm-progress-warn { background:#e8590c; }
.pm-progress-bad { background:#c92a2a; }
.pm-progress-label { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:.7rem; font-weight:600; color:var(--text, #222); mix-blend-mode:difference; color:#fff; }
.pm-sections { display:grid; gap:.5rem; padding:.5rem 0; }
.pm-section { padding:.5rem .75rem; background:rgba(127,127,127,.06); border-left:3px solid var(--accent, #4c6ef5); border-radius:.25rem; }
.pm-section pre { margin:.25rem 0 0; white-space:pre-wrap; font-family:inherit; font-size:.85rem; line-height:1.4; }
.pm-section-empty { border-left-color:#bbb; opacity:.7; }
.pm-section strong { display:block; font-size:.7rem; text-transform:uppercase; letter-spacing:.05em; color:var(--muted, #777); margin-bottom:.1rem; }
.pm-filter-chips { display:flex; flex-wrap:wrap; gap:.4rem; margin:.5rem 0 1rem; }
.pm-filter-chips button { padding:.3rem .65rem; border:1px solid var(--border, #ccc); background:transparent; border-radius:999px; cursor:pointer; font-size:.8rem; color:inherit; }
.pm-filter-chips button[aria-pressed="true"] { background:var(--accent, #4c6ef5); color:#fff; border-color:var(--accent, #4c6ef5); }
.pm-cheatsheet code { display:block; padding:.4rem .6rem; margin:.25rem 0; background:rgba(127,127,127,.08); border-radius:.25rem; font-size:.8rem; user-select:all; }
.intents-details { padding:.5rem 0; }
.intents-row-details summary { cursor:pointer; padding:.25rem 0; font-size:.85rem; color:var(--accent, #4c6ef5); }
</style>
`;

function blocFunnel(funnel) {
  const stages = [
    { cle: 'idea', label: 'Idea (draft)', hint: 'À mûrir' },
    { cle: 'validated', label: 'Validated', hint: 'Active sans SPEC' },
    { cle: 'inDelivery', label: 'In delivery', hint: 'Active avec SPEC' },
    { cle: 'done', label: 'Done', hint: 'Toutes SPECs livrées' },
    { cle: 'archived', label: 'Archived', hint: 'Historique' },
  ];
  const max = Math.max(...stages.map((s) => funnel[s.cle] || 0), 1);
  const cards = stages.map((s) => {
    const v = funnel[s.cle] || 0;
    const isBottleneck = s.cle === 'idea' && v >= max && max >= 5;
    return `<div class="stage${isBottleneck ? ' is-bottleneck' : ''}">
      <div class="stage-label">${escape(s.label)}</div>
      <div class="stage-value">${v}</div>
      <div class="stage-hint">${escape(s.hint)}</div>
    </div>`;
  }).join('');
  return `<section>
    <h2>Funnel Intent <span class="count">cycle SDD</span></h2>
    <p class="muted" style="font-size:.85rem">Distribution des Intents le long du cycle Idea → Validated → In delivery → Done.</p>
    <div class="pm-funnel">${cards}</div>
  </section>`;
}

function blocAvancement(avancement, intents) {
  const intentById = new Map((intents || []).map((i) => [i.id, i]));
  const actifs = avancement
    .filter((a) => a.statut === 'active' || a.statut === 'in-progress')
    .sort((a, b) => {
      const ra = a.ratio == null ? -1 : a.ratio;
      const rb = b.ratio == null ? -1 : b.ratio;
      return rb - ra;
    });
  if (actifs.length === 0) {
    return `<section>
      <h2>Alignement Intent ↔ Livraison</h2>
      <p class="muted">Aucun Intent actif. Lance <code>/sdd intent</code> dans Claude Code pour en capturer un.</p>
    </section>`;
  }
  const rows = actifs.slice(0, 20).map((a) => {
    const i = intentById.get(a.id);
    const idCell = i?.file ? lienSource(i.file, a.id) : `<code>${escape(a.id)}</code>`;
    const summary = i?.sections
      ? `<details class="intents-row-details"><summary>Voir détail</summary><div class="intents-details">${sectionsDetails(i.sections)}</div></details>`
      : '<span class="muted">—</span>';
    return `<tr>
      <td>${idCell}</td>
      <td>${escape(a.titre || '')}</td>
      <td>${progressBar(a.ratio, { label: `${a.done}/${a.total}` })}</td>
      <td class="muted">${a.enCours} en cours</td>
      <td>${summary}</td>
    </tr>`;
  }).join('');
  return `<section>
    <h2>Alignement Intent ↔ Livraison <span class="count">${actifs.length} actif(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Pour chaque Intent actif, ratio SPECs livrées / SPECs liées. Un Intent à 0/N signale un manque de décomposition.</p>
    <table>
      <thead><tr><th>ID</th><th>Titre</th><th>Avancement</th><th>WIP</th><th>Détail</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function blocCheatsheet() {
  return `<section class="pm-cheatsheet">
    <h2>Commandes PM (copy/paste)</h2>
    <p class="muted" style="font-size:.85rem">Les actions PM passent par la CLI ou Claude Code. Le dashboard donne la décision, les commandes la mettent en œuvre.</p>
    <code>/sdd intent              # Capturer un nouvel Intent Statement</code>
    <code>/aiad health              # Détecter zombies, orphelins, drafts oubliés</code>
    <code>/aiad demo                # Préparer la démo bi-hebdo (marque les SPECs done)</code>
    <code>/aiad intention           # Atelier d'Intention mensuel (rituel humain pur)</code>
    <code>npx aiad-sdd brief        # Résumé 1 écran (rituel standup)</code>
    <code>npx aiad-sdd dashboard    # Régénérer ce dashboard</code>
  </section>`;
}

export function pagePm(donnees) {
  const pm = donnees?.pm;
  if (!pm) {
    return `<div class="empty">
      <strong>Pas de données PM.</strong>
      Vérifie que <code>.aiad/intents/</code> existe puis régénère le dashboard.
    </div>`;
  }
  const totalActions = pm.zombies.length + pm.draftsAnciens.length + pm.specsNonDemontrees.length;
  const enTete = totalActions === 0
    ? '<p class="muted">✓ Aucune action urgente détectée — équipe à jour.</p>'
    : `<p>Tu as <strong>${totalActions} action(s)</strong> à traiter cette semaine.</p>`;
  const corps = `${PM_PAGE_STYLE}
${blocNotificationCenter(donnees)}
${blocWhatsNew(donnees)}
${blocCustomerVoiceWall(donnees)}
${blocSentimentTrend(donnees)}
${blocWinsWall(donnees)}
${blocDoneTimeline(donnees)}
${blocCumulativeAchievements(donnees)}
${blocBlockerReminders(donnees)}
${blocStrategicNarrative(donnees)}
${blocStickyAlerts(donnees)}
${blocDailyFocus(donnees)}
${blocGlobalSearch()}
${blocSavedFilters()}
${blocPmThemeSwitcher()}
${blocCockpitTabs()}
${blocSectionPermalinks()}
${blocOnboardingTour()}
${blocNewcomerChecklist(donnees)}
${blocQuickLinks(donnees)}
<section>
  <h2>Cockpit Product Manager</h2>
  ${enTete}
</section>
${pmSection(donnees)}
${blocEcheances(donnees)}
${blocStandupTimer()}
${blocRitualsCalendar(donnees)}
${blocStandupScript(donnees)}
${blocWeeklyChecklist(donnees)}
${blocBottlenecks(donnees)}
${blocWipLimit(donnees)}
${blocBacklogFreshness(donnees)}
${blocBacklogPyramid(donnees)}
${blocBacklogHygiene(donnees)}
${blocAutoArchiveCandidates(donnees)}
${blocPmDiff(donnees)}
${blocActiviteRecente(donnees)}
${blocCustomerFeedback(donnees)}
${blocPmJournal(donnees)}
${blocActionItems(donnees)}
${blocStateTransitions(donnees)}
${blocActivityHeatmap(donnees)}
${blocDowHeatmap(donnees)}
${blocPmScorecard(donnees)}
${blocTopPriorites(donnees)}
${blocIntentCompare(donnees)}
${blocCostOfDelay(donnees)}
${blocRiceMatrix(donnees)}
${blocFunnel(pm.funnel || { idea: 0, validated: 0, inDelivery: 0, done: 0, archived: 0 })}
${blocCumulativeFlow(donnees)}
${blocBurnupChart(donnees)}
${blocRoadmap(donnees)}
${blocRoadmapTimeline(donnees)}
${blocQuarterlyDelivery(donnees)}
${blocCapacityPlanner(donnees)}
${blocRefinement(donnees)}
${blocIntentMaturity(donnees)}
${blocSqsReadiness(donnees)}
${blocReviewQueue(donnees)}
${blocPendingDecisions(donnees)}
${blocSpecStuck(donnees)}
${blocSpecCrossIntent(donnees)}
${blocSpecScope(donnees)}
${blocSpecAnnotationCoverage(donnees)}
${blocAcceptanceCriteria(donnees)}
${blocPrTemplate(donnees)}
${blocSprintPlanner(donnees)}
${blocSprintRecap(donnees)}
${blocSmartSuggestions(donnees)}
${blocIntentDeps(donnees)}
${blocOrphanDeps(donnees)}
${blocRisks(donnees)}
${blocRiskConcentration(donnees)}
${blocAiActCompliance(donnees)}
${blocAcceptedRisks(donnees)}
${blocRiskTransparency(donnees)}
${blocRiskBurndown(donnees)}
${blocAvancement(pm.avancement || [], donnees.intents)}
${blocGoalTree(donnees)}
${blocGoalAlignment(donnees)}
${blocOutcomeLeaderboard(donnees)}
${blocOutcomeAttribution(donnees)}
${blocOutcomeCompletion(donnees)}
${blocCouverturePrd(donnees)}
${blocPrdFreshness(donnees)}
${blocPrdSectionsCoverage(donnees)}
${blocPrdCoverageGaps(donnees)}
${blocOkrMapping(donnees)}
${blocOkrProgress(donnees)}
${blocDiscoveryBoard(donnees)}
${blocDiscoveryDeliveryBalance(donnees)}
${blocDiscoveryToDelivery(donnees)}
${blocHypotheses(donnees)}
${blocHypothesisLifecycle(donnees)}
${blocConfidenceTracker(donnees)}
${blocAbTestTracker(donnees)}
${blocPersonaDrill(donnees)}
${blocPersonaOutcomeMatrix(donnees)}
${blocOwnership(donnees)}
${blocOwnerWorkload(donnees)}
${blocPortfolioDiversity(donnees)}
${blocBusFactor(donnees)}
${blocSponsors(donnees)}
${blocStakeholderComms(donnees)}
${blocVelocityBySponsor(donnees)}
${blocVelocityByTag(donnees)}
${blocSponsorPrep(donnees)}
${blocStakeholderMap(donnees)}
${blocTagCloud(donnees)}
${blocTagClusters(donnees)}
${blocDecisionLog(donnees)}
${blocDecisionVelocity(donnees)}
${blocDemoReadiness(donnees)}
${blocDemoAgenda(donnees)}
${blocVelocity(donnees)}
${blocVelocityComparison(donnees)}
${blocVelocityForecast(donnees)}
${blocThroughputTrend(donnees)}
${blocVelocitySla(donnees)}
${blocHealthTimeline(donnees)}
${blocCycleTime(donnees)}
${blocTimeToFirstSpec(donnees)}
${blocBriefPm(donnees)}
${blocNewsletter(donnees)}
${blocQuarterlyRetro(donnees)}
${blocQuarterlyRetroDraft(donnees)}
${blocPmMdExport(donnees)}
${blocCsvIntents(donnees)}
${blocQuickCapture(donnees)}
${blocIntentPagesIndex(donnees)}
${blocReadingTime(donnees)}
${blocPrintMode(donnees)}
${blocOnboardingTourReplay()}
${blocCheatsheet()}
`;
  return wrapWithToc(corps);
}

// ─── (#231) Bloc d'avancement à injecter dans intents.html ──────────────────
//
// Petit panneau qui complète le catalogue Intents existant avec un mini
// résumé funnel + raccourci vers la page PM.

export function pmTopBanner(donnees) {
  const pm = donnees?.pm;
  if (!pm) return '';
  const total = pm.zombies.length + pm.draftsAnciens.length + pm.specsNonDemontrees.length;
  if (total === 0) return '';
  return `<div class="card" style="border-left:3px solid #e8590c; padding:.75rem; margin:.5rem 0;">
    <strong>${total} action(s) PM à traiter</strong>
    — <a href="pm.html">Voir le cockpit Product Manager →</a>
  </div>`;
}

// (#231) Retourne `{ sections: HTML | null, avancement: HTML | null }` pour
// un Intent donné. Réutilisé par `pageIntents` pour rendre les details
// expandables sans dupliquer le code rendu.
export function detailIntentHtml(intent, avancement) {
  return {
    sections: sectionsDetails(intent?.sections),
    progress: avancement ? progressBar(avancement.ratio, { label: `${avancement.done}/${avancement.total}` }) : '—',
  };
}

// (#231) Contexte pré-calculé pour `pageIntents` : index avancement + sets
// d'IDs en alerte PM + map SPECs liées par Intent.id avec matching court
// (INTENT-NNN ↔ INTENT-NNN-slug). Mutualisé ici pour éviter de gonfler
// render.js. Le matching court résout le décalage Intent ID long /
// parent_intent court visible dans le bench.
export function indexerContextePm(donnees) {
  const specsParIntentId = new Map();
  const idsIntent = (donnees?.intents || []).map((i) => i.id);
  const courtVersLong = new Map();
  for (const id of idsIntent) {
    const court = id.split('-').slice(0, 2).join('-');
    if (!courtVersLong.has(court)) courtVersLong.set(court, id);
    specsParIntentId.set(id, []);
  }
  for (const s of donnees?.specs || []) {
    if (!s.parentIntent) continue;
    const court = s.parentIntent.split('-').slice(0, 2).join('-');
    const longId = courtVersLong.get(court);
    if (!longId) continue;
    specsParIntentId.get(longId).push(s);
  }
  return {
    avancementById: new Map((donnees?.pm?.avancement || []).map((a) => [a.id, a])),
    zombieIds: new Set((donnees?.pm?.zombies || []).map((z) => z.id)),
    draftAncienIds: new Set((donnees?.pm?.draftsAnciens || []).map((d) => d.id)),
    specsParIntentId,
  };
}

// (#425) Concatène le texte des 5 sections d'Intent pour permettre la
// recherche full-text côté client (champ data-search-blob lu par bindFilter).
export function searchBlobIntent(intent) {
  const s = intent?.sections;
  if (!s) return '';
  const parts = [];
  for (const k of ['pourquoi', 'pourQui', 'objectif', 'contraintes', 'critereDrift']) {
    if (s[k]) parts.push(s[k]);
  }
  return parts.join(' ').toLowerCase();
}

// (#231) Calcule les tags PM d'un Intent — utilisé en `data-tags` HTML pour
// le filtrage côté client via les chips. Retourne un tableau de strings.
export function tagsIntent(intent, specsLies, ctx) {
  const av = ctx.avancementById.get(intent.id);
  const tags = [];
  if (ctx.zombieIds.has(intent.id)) tags.push('zombie');
  if (ctx.draftAncienIds.has(intent.id)) tags.push('draft-vieux');
  if ((specsLies?.length || 0) === 0 && intent.statut === 'active') tags.push('sans-spec');
  if ((av?.total || 0) > 0 && (av?.done || 0) === 0) tags.push('sans-livraison');
  return tags;
}

// Alias EN canoniques (#42)
export {
  intentsZombies as zombieIntents,
  intentsDraftsAnciens as oldDraftIntents,
  specsDoneNonDemontrees as undemonstratedDoneSpecs,
  lastDemoMtime as lastDemoTime,
  calculerPm as computePm,
  pmSection as pmSummary,
  calculerAvancement as computeAlignment,
  calculerFunnel as computeFunnel,
  pagePm as pmPage,
  pmTopBanner as pmBanner,
};
