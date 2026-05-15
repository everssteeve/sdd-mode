// AIAD SDD Mode — Dashboard HTML
//
// Lit l'état d'un projet SDD Mode (.aiad/) et produit un dashboard HTML
// multi-pages dans le dossier `dashboard/`. Inspiré de la sortie de
// `sdd-trace.js` (qui ne couvre que la traçabilité), il agrège ici toutes les
// dimensions du projet : artefacts, cycle SDD, gouvernance Tier 1, métriques
// (DORA / flow / qualité), traçabilité Intent ↔ SPEC ↔ Code ↔ Tests, drifts
// & facts, changelog.
//
// Pages produites :
//   - index.html         Vue d'ensemble + maturité + actions
//   - intents.html       Catalogue des Intent Statements
//   - specs.html         Catalogue des SPECs
//   - traceability.html  Matrice Forward / Backward + gaps
//   - metrics.html       DORA + Flow + Qualité (lus depuis .aiad/metrics/)
//   - governance.html    Agents Tier 1 (AI-ACT / RGPD / RGAA / RGESN)
//   - drifts.html        Drifts détectés et facts capturés
//   - changelog.html     Historique des artefacts
//
// Les pages sont statiques, autonomes, sans dépendance externe — elles
// s'ouvrent directement dans un navigateur sans serveur.
//
// Documentation : https://aiad.ovh

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { C } from './term.js';
import { buildMeta } from './meta.js';
import {
  collecterDonnees,
  lireFichier,
  listerFichiersMd,
  extraireChamp,
  extraireTitre,
} from './dashboard/collect.js';
import { serveDashboard } from './dashboard/server.js';
import { CSS, APP_JS } from './dashboard/assets.js';
import { watcher } from './dashboard/watch.js';
import {
  PAGES, layout, setSourceBase,
  pageOverview, pageIntents, pageSpecs, pageTraceability,
  pageMetrics, pageGovernance, pageDrifts, pageChangelog,
} from './dashboard/render.js';
import { pageGraph } from './dashboard/graph.js';
import { calculerQa, pageQa } from './dashboard/qa.js';
import { calculerPm, pagePm } from './dashboard/pm.js';
import { calculerCouverturePrd } from './dashboard/prd-coverage.js';
import { calculerVelocity } from './dashboard/velocity.js';
import { calculerRoadmap } from './dashboard/roadmap.js';
import { calculerDemoReadiness } from './dashboard/demo-readiness.js';
import { calculerPersonaDrill } from './dashboard/persona-drill.js';
import { calculerEcheances } from './dashboard/deadlines.js';
import { calculerPmDiff } from './dashboard/pm-diff.js';
import { calculerDeps } from './dashboard/intent-deps.js';
import { calculerOwnership } from './dashboard/ownership.js';
import { calculerBottlenecks } from './dashboard/bottlenecks.js';
import { calculerSponsors } from './dashboard/sponsors.js';
import { calculerCycleTime } from './dashboard/cycle-time.js';
import { calculerRisques } from './dashboard/risks.js';
import { calculerHypotheses } from './dashboard/hypotheses.js';
import { lireSnapshots } from './dashboard/pm-diff.js';
import { calculerRiceMatrix } from './dashboard/rice-matrix.js';
import { calculerDecisionLog } from './dashboard/decision-log.js';
import { calculerStickyAlerts } from './dashboard/sticky-alerts.js';
import { calculerActiviteRecente } from './dashboard/recent-activity.js';
import { calculerCumulativeFlow } from './dashboard/cumulative-flow.js';
import { calculerOkrMapping } from './dashboard/okr-mapping.js';
import { calculerDiscoveryBoard } from './dashboard/discovery-board.js';
import { calculerTagCloud } from './dashboard/tag-cloud.js';
import { calculerBurnupChart } from './dashboard/burnup-chart.js';
import { calculerRefinement } from './dashboard/refinement.js';
import { genererPagesIntents } from './dashboard/intent-page.js';
import { calculerCapacityPlanner } from './dashboard/capacity-planner.js';
import { calculerConfidenceTracker } from './dashboard/confidence-tracker.js';
import { lireJournalEntries } from './dashboard/pm-journal.js';
import { calculerSuggestions } from './dashboard/smart-suggestions.js';
import { calculerActivityHeatmap } from './dashboard/activity-heatmap.js';
import { calculerDailyFocus } from './dashboard/daily-focus.js';
import { lireQuickLinks } from './dashboard/quick-links.js';
import { extraireAdrs, pageAdrs, detecterDriftAdr } from './dashboard/adrs.js';
import { listerPacksInstalles, pageLegal } from './dashboard/legal.js';
import { pageOnboarding } from './dashboard/onboarding.js';
import { calculerKanban, pageKanban, detecterConflitsParallelisme, calculerFocusAlertesParLens } from './dashboard/kanban.js';
import { calculerTechDebt } from './dashboard/tech-debt.js';
import { calculerEvolution } from './dashboard/tech-debt-history.js';
import { compterLearnings } from './dashboard/learnings.js';
import { calculerAuditTrail } from './dashboard/audit-trail.js';
import { calculerViolations } from './dashboard/violations.js';
import { calculerSre, pageSre } from './dashboard/sre.js';
import { calculerDpo, pageDpo } from './dashboard/dpo.js';
import { lireOutcomes } from './dashboard/outcomes.js';
import { calculerTimelines } from './dashboard/outcomes-history.js';
import { calculerEdgeCases } from './dashboard/edge-cases.js';
import { lirePerfBudgets } from './dashboard/perf-budgets.js';
import { calculerSanteGlobale } from './dashboard/sante-globale.js';
import { calculerEvolution as calculerEvolutionSante } from './dashboard/sante-globale-history.js';
export { serveDashboard, collecterDonnees, watcher };


const RENDERERS = {
  index: { titre: 'Vue d\'ensemble', sous: 'Pulse global du projet SDD Mode', render: pageOverview },
  pm: { titre: 'Cockpit Product Manager', sous: 'Pilotage Intent ↔ Livraison · funnel · alertes hebdo', render: pagePm },
  intents: { titre: 'Intent Statements', sous: 'Le POURQUOI capturé avant toute spécification', render: pageIntents },
  specs: { titre: 'SPECs', sous: 'Spécifications techniques atomiques liées aux Intents', render: pageSpecs },
  traceability: { titre: 'Traçabilité', sous: 'Matrice machine-vérifiable Intent ↔ SPEC ↔ Code ↔ Tests', render: pageTraceability },
  graph: { titre: 'Graphe de connaissances', sous: 'Visualisation D3 force-directed Intent ↔ SPEC ↔ Code ↔ Gouvernance', render: pageGraph },
  metrics: { titre: 'Métriques', sous: 'DORA, Flow et qualité — agrégés depuis .aiad/metrics/', render: pageMetrics },
  qa: { titre: 'Quality Assurance', sous: 'Queue, coverage, audit, EARS lint, régressions', render: pageQa },
  adrs: { titre: 'Architecture Decision Records', sous: 'ADRs extraits de ARCHITECTURE.md (persona Tech Lead)', render: pageAdrs },
  legal: { titre: 'Legal & Compliance', sous: 'AI Act · DPIA · Souveraineté · Packs juridictionnels', render: pageLegal },
  governance: { titre: 'Gouvernance Tier 1', sous: 'AI-ACT · RGPD · RGAA · RGESN — droit de veto', render: pageGovernance },
  drifts: { titre: 'Drifts & Facts', sous: 'Écarts livré ↔ désiré et drifts code ↔ SPEC capturés', render: pageDrifts },
  changelog: { titre: 'Changelog des artefacts', sous: 'Historique des mises à jour SDD Mode', render: pageChangelog },
  onboarding: { titre: 'Onboarding', sous: 'Visite guidée par rôle + glossaire AIAD', render: pageOnboarding },
  kanban: { titre: 'Kanban SPECs', sous: 'Vue kanban 4 colonnes — To-Do / In-Progress / Review / Done', render: pageKanban },
  sre: { titre: 'SRE / Ops', sous: 'Hook pre-commit · Déploiements · Rapports sécurité/audit', render: pageSre },
  dpo: { titre: 'DPO / RGPD', sous: 'DPIA · SPECs RGPD · Coverage · Angles morts', render: pageDpo },
};

export async function dashboard(racineProjet, options = {}) {
  const aiadDir = join(racineProjet, '.aiad');
  if (!existsSync(aiadDir)) {
    console.error(`${C.rouge}  Pas de dossier .aiad/ — initialisez le projet avec 'npx aiad-sdd init'.${C.reset}`);
    process.exit(1);
  }

  // (#250) Mode --check : valide collect + render sans écrire les fichiers.
  // Utile en CI (cohérent avec emit-rules --check, docs --check, etc.).
  // Renvoie un { ok, errors[] } et n'appelle pas process.exit ici (le CLI
  // wrapper s'occupe du code de sortie).
  if (options.check) {
    return checkDashboard(racineProjet);
  }

  const outDir = options.out
    ? join(racineProjet, options.out)
    : join(racineProjet, 'dashboard');
  const verbose = !options.quiet;

  // (#315) `--source-base auto` → détecter depuis `git remote.origin.url`
  // (github/gitlab/bitbucket reconnus). Échec silencieux : si pas de remote
  // ou host non-reconnu, retombe sur '' (liens relatifs `../`).
  // (#316) Fallback env AIAD_SOURCE_BASE pour CI/CD (symétrie AIAD_PUBLIC_URL).
  // (#321) On note l'origine de la résolution pour le log verbose.
  let resolvedSourceBase = options.sourceBase || process.env.AIAD_SOURCE_BASE || '';
  let sourceBaseOrigine = options.sourceBase ? 'CLI'
    : (process.env.AIAD_SOURCE_BASE ? 'env AIAD_SOURCE_BASE' : null);
  // (#323) Forme `auto:branche` permet de remplacer HEAD par une branche
  // précise (`main`, `develop`, `master`, ou même un SHA). Forme `auto`
  // seule conserve `HEAD` (résolu par GitHub/GitLab/Bitbucket comme la
  // branche par défaut).
  if (resolvedSourceBase === 'auto' || resolvedSourceBase.startsWith('auto:')) {
    const branche = resolvedSourceBase.startsWith('auto:')
      ? resolvedSourceBase.slice(5).trim()
      : null;
    const { detecterSourceBase } = await import('./dashboard/source-base.js');
    const detected = detecterSourceBase(racineProjet, branche);
    resolvedSourceBase = detected || '';
    const sufBranche = branche ? `, branche ${branche}` : '';
    sourceBaseOrigine = detected ? `auto (git remote${sufBranche})` : `auto (remote non reconnu${sufBranche})`;
  }
  // (#337) Warn si sourceBase non-vide et ne ressemble pas à une URL absolue
  // (catch typo : `github.com/o/r/blob/main` manque `https://`). On accepte
  // toute URL `http(s)://` mais on n'impose pas plus strict — l'utilisateur
  // peut pointer vers un domaine interne intranet `https://gitea.acme.corp`.
  if (resolvedSourceBase && !/^https?:\/\//.test(resolvedSourceBase)) {
    process.stderr.write(`  ⚠ --source-base="${resolvedSourceBase}" ne ressemble pas à une URL absolue (attendu : https://...). Liens potentiellement cassés. Utilise --source-base auto pour détecter depuis git remote.\n`);
  }
  setSourceBase(resolvedSourceBase);

  // (#240/#322) Résolution publicUrl avant le bloc verbose pour pouvoir
  // afficher son origine en symétrie avec sourceBase (#321).
  const resolvedPublicUrl = (options.publicUrl || process.env.AIAD_PUBLIC_URL || '').replace(/\/+$/, '');
  const publicUrlOrigine = options.publicUrl ? 'CLI'
    : (process.env.AIAD_PUBLIC_URL ? 'env AIAD_PUBLIC_URL' : null);

  if (verbose) {
    console.log(`\n${C.cyan}${C.gras}  AIAD SDD Mode — Dashboard HTML${C.reset}\n`);
    console.log(`  ${C.gras}Source${C.reset}      ${relative(racineProjet, aiadDir)}/`);
    console.log(`  ${C.gras}Destination${C.reset} ${relative(racineProjet, outDir)}/`);
    // (#322) Ligne `Public URL` symétrique à `Source base` (#321). Aide à
    // diagnostiquer "pourquoi mes og:image sont relatifs / mon sitemap est vide ?"
    if (publicUrlOrigine) {
      const valeur = resolvedPublicUrl || '(vide → og:url et sitemap relatifs)';
      console.log(`  ${C.gras}Public URL${C.reset}  ${valeur} ${C.gris}[${publicUrlOrigine}]${C.reset}`);
    }
    if (sourceBaseOrigine) {
      const valeurAffichee = resolvedSourceBase || '(vide → liens relatifs)';
      console.log(`  ${C.gras}Source base${C.reset} ${valeurAffichee} ${C.gris}[${sourceBaseOrigine}]${C.reset}`);
    }
    console.log('');
  }

  const donnees = await collecterEnrichi(racineProjet);

  // (#240) URL publique propagée vers le layout pour og:url, og:image, sitemap.
  donnees.publicUrl = resolvedPublicUrl;

  // (#320) sourceBase résolu (CLI > env > auto > '') exposé dans data.json
  // pour les consumers (Slack-bot, Notion sync, audit scripts) qui veulent
  // reconstruire les URLs de fichiers sources eux-mêmes sans re-parser HTML.
  donnees.sourceBase = resolvedSourceBase;

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const assetsDir = join(outDir, 'assets');
  if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true });

  // Assets partagés
  writeFileSync(join(assetsDir, 'style.css'), CSS, 'utf-8');
  writeFileSync(join(assetsDir, 'app.js'), APP_JS, 'utf-8');

  // (#237) Favicon SVG à la racine du dashboard → supprime 404 console.
  try {
    const { FAVICON_SVG } = await import('./dashboard/favicon.js');
    writeFileSync(join(outDir, 'favicon.svg'), FAVICON_SVG, 'utf-8');
  } catch { /* favicon non-fatal */ }

  // (#241) Web manifest PWA pour install "Add to Home Screen" mobile.
  try {
    const { manifestJson } = await import('./dashboard/manifest.js');
    writeFileSync(join(outDir, 'manifest.webmanifest'), manifestJson(donnees), 'utf-8');
  } catch { /* manifest non-fatal */ }

  // (#243) `.nojekyll` désactive le traitement Jekyll par défaut de
  // GitHub Pages — sinon les fichiers commençant par `_` (cf. obsidian
  // export) seraient ignorés, et Jekyll tenterait du Liquid templating
  // sur des templates AIAD qui ressemblent à des tags Liquid.
  writeFileSync(join(outDir, '.nojekyll'), '', 'utf-8');

  // (#239) sitemap.xml + robots.txt pour publication GitHub Pages / SEO.
  // baseUrl peut être passée via options.publicUrl ou env AIAD_PUBLIC_URL.
  try {
    const { genererSitemap, genererRobots } = await import('./dashboard/sitemap.js');
    const { PAGES } = await import('./dashboard/render.js');
    const baseUrl = donnees.publicUrl;
    const lastmod = donnees.projet?.genere || new Date().toISOString();
    writeFileSync(join(outDir, 'sitemap.xml'), genererSitemap(PAGES, baseUrl, lastmod), 'utf-8');
    writeFileSync(join(outDir, 'robots.txt'), genererRobots(baseUrl), 'utf-8');
  } catch { /* sitemap non-fatal */ }

  // Dump JSON pour debug / inspection
  // (#305) Trailing newline POSIX pour cohérence avec CLI --json outputs.
  writeFileSync(join(outDir, 'data.json'), JSON.stringify(serializerDonnees(donnees, { full: options.full }), null, 2) + '\n', 'utf-8');

  // (#232) Trio SVG pour README. Génère sans planter même si une source
  // manque (le module renvoie alors "non calculé" gris).
  try {
    const { genererTousLesBadges, genererShieldsEndpoint, TYPES_VALIDES } = await import('./badge.js');
    const dataDir = relative(racineProjet, outDir) || 'dashboard';
    genererTousLesBadges(racineProjet, { dataDir });
    // (#289) Écrit aussi shields-endpoints.json (tableau de 3 endpoints
    // conformes shields.io spec) — utile pour CI qui push sur gist.
    const endpoints = TYPES_VALIDES.map((t) => ({
      type: t, ...genererShieldsEndpoint(racineProjet, { dataDir, type: t }),
    }));
    // (#305) Trailing newline pour cohérence POSIX (= CLI output).
    writeFileSync(join(outDir, 'shields-endpoints.json'), JSON.stringify(endpoints, null, 2) + '\n', 'utf-8');
  } catch { /* badge errors are non-fatal for the dashboard */ }

  // Pages
  const ecrits = [];
  for (const page of PAGES) {
    const def = RENDERERS[page.slug];
    if (!def) continue;
    const body = def.render(donnees);
    const html = layout({
      slug: page.slug,
      titre: def.titre,
      sous: def.sous,
      donnees,
      body,
    });
    const chemin = join(outDir, page.file);
    writeFileSync(chemin, html, 'utf-8');
    ecrits.push(chemin);
  }

  // (#453) Pages individuelles par Intent (intent-INTENT-XXX-slug.html).
  // Génération best-effort : un échec ne bloque pas le dashboard.
  try {
    const pagesIntent = genererPagesIntents(donnees, { outDir, layout });
    for (const p of pagesIntent) ecrits.push(join(outDir, p.file));
  } catch { /* intent-pages non-fatal */ }

  // (#249) Page 404 stylisée — GitHub Pages la sert auto, et le serveur
  // local --serve fallback dessus (cf. lib/dashboard/server.js).
  try {
    const { pageNotFound } = await import('./dashboard/notfound.js');
    const html404 = layout({
      slug: '__notfound__', // slug fictif → aucun item nav actif
      titre: 'Page introuvable',
      sous: '404 — la ressource demandée n\'existe pas',
      donnees,
      body: pageNotFound(donnees),
    });
    writeFileSync(join(outDir, '404.html'), html404, 'utf-8');
  } catch { /* 404 non-fatal */ }

  if (verbose) {
    console.log(`  ${C.gras}Synthèse${C.reset}`);
    console.log(`    Maturité       : ${donnees.maturite.score}/${donnees.maturite.total} — ${donnees.maturite.label}`);
    console.log(`    Intents        : ${donnees.intents.length}`);
    console.log(`    SPECs          : ${donnees.specs.length}`);
    console.log(`    Gouvernance    : ${donnees.gouvernance.filter((g) => g.present).length}/${donnees.gouvernance.length}`);
    console.log(`    Facts          : ${donnees.facts.length}`);
    console.log(`    Changelog      : ${donnees.changelog.entrees.length} entrée(s)`);

    console.log(`\n  ${C.gras}Pages générées${C.reset}`);
    for (const p of ecrits) {
      console.log(`    ${C.vert}+${C.reset} ${relative(racineProjet, p)}`);
    }
    console.log(`    ${C.vert}+${C.reset} ${relative(racineProjet, join(assetsDir, 'style.css'))}`);
    console.log(`    ${C.vert}+${C.reset} ${relative(racineProjet, join(assetsDir, 'app.js'))}`);
    console.log(`    ${C.vert}+${C.reset} ${relative(racineProjet, join(outDir, 'data.json'))}`);
    console.log(`\n  ${C.gras}Ouvrir${C.reset}      file://${join(outDir, 'index.html')}\n`);
  }

  return { outDir, donnees, pages: ecrits };
}

// Helper : collecte enrichie (toutes les façades calculer*/lire* dans l'ordre
// de dépendance). Extrait pour partage entre dashboard() et checkDashboard().
async function collecterEnrichi(racineProjet) {
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
  donnees.edgeCases = calculerEdgeCases(racineProjet, donnees);
  // Perf budgets (#213).
  donnees.perfBudgets = lirePerfBudgets(racineProjet);
  // Santé globale (#218) + history (#219) — APRÈS dpo/edgeCases/violations.
  donnees.santeGlobale = calculerSanteGlobale(donnees);
  donnees.santeGlobale.evolution = calculerEvolutionSante(racineProjet, donnees.santeGlobale);
  // Drift ADR (#161) + legal packs (#139).
  donnees.adrsDrift = detecterDriftAdr(racineProjet, donnees.adrs);
  donnees.legalPacks = listerPacksInstalles(racineProjet);
  return donnees;
}

// (#250) Valide la génération du dashboard sans écrire de fichier.
// Retourne `{ ok: boolean, errors: string[], pages: string[] }`.
async function checkDashboard(racineProjet) {
  const errors = [];
  const okPages = [];
  let donnees;
  try {
    donnees = await collecterEnrichi(racineProjet);
    donnees.publicUrl = '';
    donnees.sourceBase = '';
  } catch (err) {
    errors.push(`collecte: ${err.message}`);
    return { ok: false, errors, pages: okPages };
  }

  for (const page of PAGES) {
    const def = RENDERERS[page.slug];
    if (!def) continue;
    try {
      const body = def.render(donnees);
      layout({
        slug: page.slug,
        titre: def.titre,
        sous: def.sous,
        donnees,
        body,
      });
      okPages.push(page.file);
    } catch (err) {
      errors.push(`${page.file}: ${err.message}`);
    }
  }
  return { ok: errors.length === 0, errors, pages: okPages };
}

// (#252) Seuil de troncature des grosses listes dans data.json.
// Renderer dispose toujours de `donnees` complet en mémoire. Cette
// troncature ne touche QUE la sérialisation publique pour les
// consommateurs externes (CI, Slack-bot, Notion sync).
const TRONCATURE_LIMITE = 100;

// Tronque les longues listes d'un objet de gaps. Ajoute des sidecar
// fields `<key>_truncated: true` et `<key>_total: N` pour signaler au
// consumer qu'il manque des items (cohérence type : arrays restent
// arrays, pas conversion en objet qui casserait les consumers).
function tronquerGaps(gaps, limite = TRONCATURE_LIMITE) {
  if (!gaps || typeof gaps !== 'object') return gaps;
  const out = { ...gaps };
  for (const k of Object.keys(gaps)) {
    const v = gaps[k];
    if (Array.isArray(v) && v.length > limite) {
      out[k] = v.slice(0, limite);
      out[`${k}_truncated`] = true;
      out[`${k}_total`] = v.length;
    }
  }
  return out;
}

function serializerDonnees(d, options = {}) {
  // (#253 + #258) `_meta` en TÊTE (JSON préserve l'ordre d'insertion).
  // Helper partagé lib/meta.js produit { schema, version, generated, ...extra }.
  const _meta = buildMeta({
    schema: 'aiad-sdd-dashboard',
    slim: !options.full,
    generated: d.projet?.genere,
  });
  const out = { _meta, ...d };
  out.specsParIntent = Object.fromEntries(d.specsParIntent);
  // (#145) Alias `generatedAt` au top-level pour les consommateurs externes
  // (CI, scripts d'audit, intégrations Notion/Slack). Source de vérité :
  // `projet.genere` posé par `lireProjet`. On clone explicitement plutôt que
  // de muter `projet` pour rester traçable.
  if (d.projet?.genere) out.generatedAt = d.projet.genere;

  // (#252) Slim mode (défaut). Tronque les grosses listes de gaps qui
  // peuvent atteindre 1000+ items sur projets avec beaucoup de hooks/code
  // non annoté @spec. Réduit data.json de ~860KB à ~80KB sur scenario réel.
  // `--full` skip cette troncature (utile pour audit complet en CI).
  if (!options.full && out.matrice) {
    out.matrice = { ...out.matrice };
    if (out.matrice.gaps) {
      out.matrice.gaps = tronquerGaps(out.matrice.gaps);
    }
    // matrice.backward est aussi grosse (~117KB) — troncature similaire.
    if (Array.isArray(out.matrice.backward) && out.matrice.backward.length > TRONCATURE_LIMITE) {
      out.matrice.backward_total = out.matrice.backward.length;
      out.matrice.backward_truncated = true;
      out.matrice.backward = out.matrice.backward.slice(0, TRONCATURE_LIMITE);
    }
  }
  return out;
}

// Serveur HTTP local (--serve) extrait dans ./dashboard/server.js et
// ré-exporté en haut de fichier (compat ascendante du chemin d'import).

// ─── Alias EN canoniques (item #42) ─────────────────────────────────────────
export {
  collecterDonnees as collectData,
  watcher as watch,
};
