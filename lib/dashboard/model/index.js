// @spec SPEC-016-1-architecture-4-couches
// @spec SPEC-017-3-digest-delta
// @intent INTENT-016
// @intent INTENT-017

import { collecterDonnees } from '../collect.js';
// cycle toléré : collect.js → leadership-metrics.js → collect.js (Node.js résout via hoisting ESM)
import { calculerQa } from '../qa.js';
import { calculerPm } from '../pm.js';
import { calculerCouverturePrd } from '../prd-coverage.js';
import { calculerVelocity } from '../velocity.js';
import { calculerRoadmap } from '../roadmap.js';
import { calculerDemoReadiness } from '../demo-readiness.js';
import { calculerPersonaDrill } from '../persona-drill.js';
import { calculerEcheances } from '../deadlines.js';
import { calculerPmDiff, lireSnapshots } from '../pm-diff.js';
import { calculerDeps } from '../intent-deps.js';
import { calculerOwnership } from '../ownership.js';
import { calculerBottlenecks } from '../bottlenecks.js';
import { calculerSponsors } from '../sponsors.js';
import { calculerCycleTime } from '../cycle-time.js';
import { calculerRisques } from '../risks.js';
import { calculerHypotheses } from '../hypotheses.js';
import { calculerRiceMatrix } from '../rice-matrix.js';
import { calculerDecisionLog } from '../decision-log.js';
import { calculerStickyAlerts } from '../sticky-alerts.js';
import { calculerActiviteRecente } from '../recent-activity.js';
import { calculerCumulativeFlow } from '../cumulative-flow.js';
import { calculerOkrMapping } from '../okr-mapping.js';
import { calculerDiscoveryBoard } from '../discovery-board.js';
import { calculerTagCloud } from '../tag-cloud.js';
import { calculerBurnupChart } from '../burnup-chart.js';
import { calculerRefinement } from '../refinement.js';
import { calculerCapacityPlanner } from '../capacity-planner.js';
import { calculerConfidenceTracker } from '../confidence-tracker.js';
import { lireJournalEntries } from '../pm-journal.js';
import { calculerSuggestions } from '../smart-suggestions.js';
import { calculerActivityHeatmap } from '../activity-heatmap.js';
import { calculerDailyFocus } from '../daily-focus.js';
import { lireQuickLinks } from '../quick-links.js';
import { calculerVelocityComparison } from '../velocity-comparison.js';
import { calculerWipLimit } from '../wip-limit.js';
import { calculerBacklogFreshness } from '../backlog-freshness.js';
import { calculerGoalTree } from '../goal-tree.js';
import { calculerAbTestTracker } from '../ab-test-tracker.js';
import { calculerRiskBurndown } from '../risk-burndown.js';
import { calculerOutcomeLeaderboard } from '../outcome-leaderboard.js';
import { calculerVelocityForecast } from '../velocity-forecast.js';
import { calculerAiActCompliance } from '../ai-act-compliance.js';
import { calculerNotifications } from '../notification-center.js';
import { calculerSqsReadiness } from '../sqs-readiness.js';
import { calculerHealthTimeline } from '../health-timeline.js';
import { calculerIntentMaturity } from '../intent-maturity.js';
import { genererNarratif } from '../strategic-narrative.js';
import { calculerSprintPlanner } from '../sprint-planner.js';
import { calculerStakeholderComms } from '../stakeholder-comms.js';
import { calculerDecisionVelocity } from '../decision-velocity.js';
import { calculerWeeklyChecklist } from '../pm-weekly-checklist.js';
import { calculerOutcomeAttribution, calculerMatriceOutcomesIntents } from '../outcome-attribution.js';
import { calculerDiscoveryDeliveryBalance } from '../discovery-delivery-balance.js';
import { calculerVelocityBySponsor } from '../velocity-by-sponsor.js';
import { calculerPrdFreshness } from '../prd-freshness.js';
import { calculerCustomerFeedback } from '../customer-feedback.js';
import { calculerWhatsNew } from '../whats-new.js';
import { calculerHypothesisLifecycle } from '../hypothesis-lifecycle.js';
import { calculerRoadmapTimeline } from '../roadmap-timeline.js';
import { calculerPmScorecard } from '../pm-scorecard.js';
import { calculerIntentCompare } from '../intent-compare.js';
import { calculerSponsorPrep } from '../sponsor-prep.js';
import { calculerBacklogHygiene } from '../backlog-hygiene.js';
import { calculerTimeToFirstSpec } from '../time-to-first-spec.js';
import { calculerCustomerVoiceWall } from '../customer-voice-wall.js';
import { calculerQuarterlyDelivery } from '../quarterly-delivery.js';
import { calculerReviewQueue } from '../review-queue.js';
import { calculerAcceptedRisks } from '../accepted-risks.js';
import { calculerWinsWall } from '../wins-wall.js';
import { calculerStateTransitions } from '../state-transitions.js';
import { calculerOrphanDeps } from '../orphan-deps.js';
import { calculerDemoAgenda } from '../demo-agenda.js';
import { calculerSpecStuck } from '../spec-stuck.js';
import { calculerTagClusters } from '../tag-clusters.js';
import { calculerCostOfDelay } from '../cost-of-delay.js';
import { calculerBacklogPyramid } from '../backlog-pyramid.js';
import { calculerSpecCrossIntent } from '../spec-cross-intent.js';
import { calculerBlockerReminders } from '../blocker-reminders.js';
import { calculerPersonaOutcomeMatrix } from '../persona-outcome-matrix.js';
import { calculerThroughputTrend } from '../throughput-trend.js';
import { calculerRiskConcentration } from '../risk-concentration.js';
import { calculerDiscoveryToDelivery } from '../discovery-to-delivery.js';
import { calculerOwnerWorkload } from '../owner-workload.js';
import { calculerReadingTime } from '../reading-time.js';
import { calculerSpecScope } from '../spec-scope.js';
import { calculerGoalAlignment } from '../goal-alignment.js';
import { calculerVelocitySla } from '../velocity-sla.js';
import { calculerDoneTimeline } from '../done-timeline.js';
import { calculerPrdSectionsCoverage } from '../prd-sections-coverage.js';
import { calculerOutcomeCompletion } from '../outcome-completion.js';
import { calculerRiskTransparency } from '../risk-transparency.js';
import { calculerCumulativeAchievements } from '../cumulative-achievements.js';
import { calculerStandupScript } from '../standup-script.js';
import { calculerQuarterlyRetroDraft } from '../quarterly-retro-draft.js';
import { calculerPrdCoverageGaps } from '../prd-coverage-gaps.js';
import { calculerSpecAnnotationCoverage } from '../spec-annotation-coverage.js';
import { calculerPortfolioDiversity } from '../portfolio-diversity.js';
import { calculerDowHeatmap } from '../dow-heatmap.js';
import { calculerPrTemplate } from '../pr-template.js';
import { calculerVelocityByTag } from '../velocity-by-tag.js';
import { calculerAutoArchiveCandidates } from '../auto-archive-candidates.js';
import { calculerSprintRecap } from '../sprint-recap.js';
import { calculerAcceptanceCriteria } from '../acceptance-criteria.js';
import { calculerActionItems } from '../action-items.js';
import { calculerOkrProgress } from '../okr-progress.js';
import { calculerBusFactor } from '../bus-factor.js';
import { calculerSentimentTrend } from '../sentiment-trend.js';
import { calculerRitualsCalendar } from '../rituals-calendar.js';
import { calculerNewcomerChecklist } from '../newcomer-checklist.js';
import { calculerPendingDecisions } from '../pending-decisions.js';
import { calculerStakeholderMap } from '../stakeholder-map.js';
import { calculerQuarterlyDecisions } from '../quarterly-decisions.js';
import { calculerSpecQualityScore } from '../spec-quality-score.js';
import { calculerSponsorScorecard } from '../sponsor-scorecard.js';
import { calculerOutcomeNorthStar } from '../outcome-north-star.js';
import { calculerActivityFeed } from '../activity-feed.js';
import { calculerInitiativeCards } from '../initiative-cards.js';
import { calculerSpecLifecycleTime } from '../spec-lifecycle-time.js';
import { extraireAdrs, detecterDriftAdr } from '../adrs.js';
import { listerPacksInstalles } from '../legal.js';
import { calculerKanban, detecterConflitsParallelisme, calculerFocusAlertesParLens } from '../kanban.js';
import { calculerTechDebt } from '../tech-debt.js';
import { calculerEvolution } from '../tech-debt-history.js';
import { compterLearnings } from '../learnings.js';
import { calculerAuditTrail } from '../audit-trail.js';
import { calculerViolations } from '../violations.js';
import { calculerSre } from '../sre.js';
import { calculerDpo } from '../dpo.js';
import { lireOutcomes } from '../outcomes.js';
import { calculerTimelines } from '../outcomes-history.js';
import { calculerEdgeCases } from '../edge-cases.js';
import { lirePerfBudgets } from '../perf-budgets.js';
import { calculerSanteGlobale } from '../sante-globale.js';
import { calculerEvolution as calculerEvolutionSante } from '../sante-globale-history.js';
// @spec SPEC-017-2-inbox-triage
import { calculerInboxTriage } from '../views/inbox.js';
// @spec SPEC-017-3-digest-delta
import { lireDernierSnapshotDigest, calculerDigestDelta } from '../digest-delta.js';

export async function enrichir(racineProjet) {
  const donnees = collecterDonnees(racineProjet);
  // QA (#135) — specs ready sans tests, coverage, rollup audit, EARS lint.
  donnees.qa = calculerQa(racineProjet, donnees);
  // PM (#137) — zombies, drafts vieux, specs done non démontrées.
  donnees.pm = calculerPm(donnees);
  // Velocity (#424) — Intents done/mois + SPECs done/semaine.
  donnees.velocity = calculerVelocity(donnees);
  // Roadmap (#427) — buckets par trimestre civil (target / target_date).
  donnees.roadmap = calculerRoadmap(donnees);
  // NB : `donnees.prdCoverage` (#423 + #428) calculé plus bas, APRÈS
  // `donnees.outcomes` qui est consommé par le mapping Outcome → Intents.
  // Tech Lead (#138) — ADRs depuis ARCHITECTURE.md.
  donnees.adrs = extraireAdrs(racineProjet);
  // Kanban (#131) — vue 4 colonnes pré-calculée.
  donnees.kanban = calculerKanban(donnees);
  // Conflits parallélisme (#187).
  donnees.kanbanConflits = detecterConflitsParallelisme(donnees);
  // Focus alertes (#190) — 6 lenses.
  donnees.focusAlertes = calculerFocusAlertesParLens(donnees);
  // Tech debt (#196) + history 4 sem (#198).
  donnees.techDebt = calculerTechDebt(racineProjet, donnees);
  donnees.techDebtHistory = calculerEvolution(racineProjet, donnees.techDebt);
  // Learnings (#200) + audit trail (#201) + violations (#202).
  donnees.learnings = compterLearnings(racineProjet);
  donnees.auditTrail = calculerAuditTrail(racineProjet);
  donnees.violations = calculerViolations(racineProjet, donnees);
  // SRE (#203) + DPO (#205) + outcomes (#208/#210) + edge cases (#211).
  donnees.sre = calculerSre(racineProjet, donnees);
  donnees.dpo = calculerDpo(racineProjet, donnees);
  donnees.outcomes = lireOutcomes(racineProjet);
  donnees.outcomes.evolution = calculerTimelines(racineProjet, donnees.outcomes.criteres);
  // PRD coverage (#423 + #428) — APRÈS outcomes (consommé par le mapping
  // Outcome → Intents).
  donnees.prdCoverage = calculerCouverturePrd(racineProjet, donnees);
  // Demo readiness (#429), persona drill-down (#430), deadlines (#431) —
  // tous trois consomment prdCoverage (#430) ou pm (#429/#431).
  donnees.demoReadiness = calculerDemoReadiness(racineProjet, donnees);
  donnees.personaDrill = calculerPersonaDrill(donnees);
  donnees.deadlines = calculerEcheances(donnees);
  // PM diff (#433) — écrit un snapshot du jour + diff vs ~7j en arrière.
  donnees.pmDiff = calculerPmDiff(racineProjet, donnees);
  // Intent deps (#434) — graphe depends_on/blocked_by + détection cycles.
  donnees.intentDeps = calculerDeps(donnees);
  // Ownership (#435) + Bottlenecks (#436) + Sponsors (#437).
  donnees.ownership = calculerOwnership(donnees);
  donnees.bottlenecks = calculerBottlenecks(donnees);
  donnees.sponsors = calculerSponsors(donnees);
  // Cycle time (#438) — consomme les snapshots PM (#433) déjà persistés.
  donnees.cycleTime = calculerCycleTime(donnees, lireSnapshots(racineProjet));
  // Risques (#439) + Hypothèses (#440).
  donnees.risks = calculerRisques(donnees);
  donnees.hypotheses = calculerHypotheses(donnees);
  donnees.riceMatrix = calculerRiceMatrix(donnees);
  donnees.decisionLog = calculerDecisionLog(racineProjet, donnees);
  donnees.stickyAlerts = calculerStickyAlerts(donnees);
  donnees.recentActivity = calculerActiviteRecente(donnees);
  donnees.cumulativeFlow = calculerCumulativeFlow(racineProjet, donnees);
  donnees.okrMapping = calculerOkrMapping(racineProjet, donnees);
  donnees.discoveryBoard = calculerDiscoveryBoard(donnees);
  donnees.tagCloud = calculerTagCloud(donnees);
  donnees.burnupChart = calculerBurnupChart(racineProjet, donnees);
  donnees.refinement = calculerRefinement(donnees);
  donnees.capacityPlanner = calculerCapacityPlanner(racineProjet, donnees);
  donnees.confidenceTracker = calculerConfidenceTracker(donnees);
  donnees.pmJournal = lireJournalEntries(racineProjet);
  donnees.smartSuggestions = calculerSuggestions(donnees);
  donnees.activityHeatmap = calculerActivityHeatmap(donnees);
  donnees.dailyFocus = calculerDailyFocus(donnees);
  donnees.quickLinks = lireQuickLinks(racineProjet);
  donnees.velocityComparison = calculerVelocityComparison(donnees);
  donnees.wipLimit = calculerWipLimit(racineProjet, donnees);
  donnees.backlogFreshness = calculerBacklogFreshness(donnees);
  donnees.goalTree = calculerGoalTree(racineProjet, donnees);
  donnees.abTestTracker = calculerAbTestTracker(donnees);
  donnees.riskBurndown = calculerRiskBurndown(racineProjet, donnees);
  donnees.outcomeLeaderboard = calculerOutcomeLeaderboard(donnees);
  donnees.velocityForecast = calculerVelocityForecast(donnees);
  donnees.aiActCompliance = calculerAiActCompliance(donnees);
  donnees.sqsReadiness = calculerSqsReadiness(donnees);
  donnees.healthTimeline = calculerHealthTimeline(racineProjet, donnees);
  donnees.notifications = calculerNotifications(donnees);
  donnees.intentMaturity = calculerIntentMaturity(donnees);
  donnees.sprintPlanner = calculerSprintPlanner(donnees);
  donnees.strategicNarrative = genererNarratif(donnees);
  donnees.stakeholderComms = calculerStakeholderComms(racineProjet, donnees);
  donnees.decisionVelocity = calculerDecisionVelocity(racineProjet, donnees);
  donnees.weeklyChecklist = calculerWeeklyChecklist();
  donnees.outcomeAttribution = calculerOutcomeAttribution(donnees);
  // @spec SPEC-018-1-matrice-outcomes-intents
  donnees.matriceOutcomesIntents = calculerMatriceOutcomesIntents(donnees);
  donnees.discoveryDeliveryBalance = calculerDiscoveryDeliveryBalance(donnees);
  donnees.velocityBySponsor = calculerVelocityBySponsor(donnees);
  donnees.prdFreshness = calculerPrdFreshness(racineProjet);
  donnees.customerFeedback = calculerCustomerFeedback(racineProjet);
  donnees.whatsNew = calculerWhatsNew(donnees);
  donnees.hypothesisLifecycle = calculerHypothesisLifecycle(donnees);
  donnees.roadmapTimeline = calculerRoadmapTimeline(donnees);
  donnees.pmScorecard = calculerPmScorecard(racineProjet, donnees);
  donnees.intentCompare = calculerIntentCompare(donnees);
  donnees.sponsorPrep = calculerSponsorPrep(donnees);
  donnees.backlogHygiene = calculerBacklogHygiene(donnees);
  donnees.timeToFirstSpec = calculerTimeToFirstSpec(donnees);
  donnees.customerVoiceWall = calculerCustomerVoiceWall(donnees);
  donnees.quarterlyDelivery = calculerQuarterlyDelivery(donnees);
  donnees.reviewQueue = calculerReviewQueue(donnees);
  donnees.acceptedRisks = calculerAcceptedRisks(donnees);
  donnees.winsWall = calculerWinsWall(donnees);
  donnees.stateTransitions = calculerStateTransitions(racineProjet, donnees);
  donnees.orphanDeps = calculerOrphanDeps(donnees);
  donnees.demoAgenda = calculerDemoAgenda(donnees);
  donnees.specStuck = calculerSpecStuck(donnees);
  donnees.tagClusters = calculerTagClusters(donnees);
  donnees.costOfDelay = calculerCostOfDelay(donnees);
  donnees.backlogPyramid = calculerBacklogPyramid(donnees);
  donnees.specCrossIntent = calculerSpecCrossIntent(donnees);
  donnees.blockerReminders = calculerBlockerReminders(donnees);
  donnees.personaOutcomeMatrix = calculerPersonaOutcomeMatrix(donnees);
  donnees.throughputTrend = calculerThroughputTrend(donnees);
  donnees.riskConcentration = calculerRiskConcentration(donnees);
  donnees.discoveryToDelivery = calculerDiscoveryToDelivery(donnees);
  donnees.ownerWorkload = calculerOwnerWorkload(donnees);
  donnees.readingTime = calculerReadingTime(donnees);
  donnees.specScope = calculerSpecScope(donnees);
  donnees.goalAlignment = calculerGoalAlignment(donnees);
  donnees.velocitySla = calculerVelocitySla(donnees);
  donnees.doneTimeline = calculerDoneTimeline(donnees);
  donnees.prdSectionsCoverage = calculerPrdSectionsCoverage(racineProjet);
  donnees.outcomeCompletion = calculerOutcomeCompletion(donnees);
  donnees.riskTransparency = calculerRiskTransparency(donnees);
  donnees.cumulativeAchievements = calculerCumulativeAchievements(donnees);
  donnees.standupScript = calculerStandupScript(donnees);
  donnees.quarterlyRetroDraft = calculerQuarterlyRetroDraft(donnees);
  donnees.prdCoverageGaps = calculerPrdCoverageGaps(donnees);
  donnees.specAnnotationCoverage = calculerSpecAnnotationCoverage(donnees);
  donnees.portfolioDiversity = calculerPortfolioDiversity(donnees);
  donnees.dowHeatmap = calculerDowHeatmap(donnees);
  donnees.prTemplate = calculerPrTemplate(donnees);
  donnees.velocityByTag = calculerVelocityByTag(donnees);
  donnees.autoArchiveCandidates = calculerAutoArchiveCandidates(donnees);
  donnees.sprintRecap = calculerSprintRecap(donnees);
  donnees.acceptanceCriteria = calculerAcceptanceCriteria(donnees);
  donnees.actionItems = calculerActionItems(racineProjet);
  donnees.okrProgress = calculerOkrProgress(donnees);
  donnees.busFactor = calculerBusFactor(donnees);
  donnees.sentimentTrend = calculerSentimentTrend(donnees);
  donnees.ritualsCalendar = calculerRitualsCalendar(racineProjet);
  donnees.newcomerChecklist = calculerNewcomerChecklist(donnees);
  donnees.pendingDecisions = calculerPendingDecisions(donnees);
  donnees.stakeholderMap = calculerStakeholderMap(donnees);
  donnees.quarterlyDecisions = calculerQuarterlyDecisions(racineProjet);
  donnees.specQualityScore = calculerSpecQualityScore(donnees);
  donnees.sponsorScorecard = calculerSponsorScorecard(donnees);
  donnees.outcomeNorthStar = calculerOutcomeNorthStar(donnees);
  donnees.activityFeed = calculerActivityFeed(racineProjet, donnees);
  donnees.initiativeCards = calculerInitiativeCards(donnees);
  donnees.specLifecycleTime = calculerSpecLifecycleTime(racineProjet);
  donnees.edgeCases = calculerEdgeCases(racineProjet, donnees);
  // Perf budgets (#213).
  donnees.perfBudgets = lirePerfBudgets(racineProjet);
  // Santé globale (#218) + history (#219) — APRÈS dpo/edgeCases/violations.
  donnees.santeGlobale = calculerSanteGlobale(donnees);
  donnees.santeGlobale.evolution = calculerEvolutionSante(racineProjet, donnees.santeGlobale);
  // Drift ADR (#161) + legal packs (#139).
  donnees.adrsDrift = detecterDriftAdr(racineProjet, donnees.adrs);
  donnees.legalPacks = listerPacksInstalles(racineProjet);
  donnees.inboxTriage = calculerInboxTriage(donnees);
  // Digest delta (#017-3) — compare état courant vs snapshot précédent.
  const _snapshotPrecedent = lireDernierSnapshotDigest(racineProjet);
  donnees.digestDelta = calculerDigestDelta(donnees, _snapshotPrecedent);
  return donnees;
}
