// AIAD SDD Mode — Dashboard : onglets de navigation cockpit (#480).
//
// pm.html à 56 sections devient submersif même avec TOC. Ce module
// ajoute 5 onglets qui regroupent les sections par axe :
//   - "Tactique"      : daily focus, échéances, goulots, top priorités, refinement
//   - "Stratégique"   : goal tree, OKR, roadmap, capacity, leaderboard
//   - "Rituels"       : standup, daily focus, demo, retro, journal, heatmap
//   - "Communication" : brief, newsletter, retro, CSV, quick links
//   - "Tout"          : vue complète (défaut)
//
// Implémentation : chaque section peut être taguée avec un attribut
// `data-cockpit-tab` (multiples séparés par espace). Le script masque les
// sections non taguées avec le tab sélectionné. État persisté dans
// `localStorage.aiad-pm-tab`. La barre est sticky sous la search bar.
//
// Pure client-side : pas de regen serveur.
//
// Aucun effet de bord serveur. Pure transformation HTML+JS.
//
// Documentation : https://aiad.ovh

// Mapping section-title → liste de tabs (au moment du rendu côté serveur,
// on annote les `<section>` avec data-cockpit-tab via post-processing).
// Cohérent avec les ancres TOC slugifiées (#441).
export const SECTION_TO_TABS = Object.freeze({
  // Tactique
  'a-valider-cette-semaine': 'tactique rituels',
  'echeances-intent': 'tactique',
  'goulots-detranglement': 'tactique',
  'ce-qui-a-change-cette-semaine': 'tactique rituels',
  'top-priorites-a-travailler': 'tactique strategique',
  'matrice-impact-effort': 'tactique strategique',
  'funnel-intent': 'tactique strategique',
  'a-raffiner-cette-semaine': 'tactique rituels',
  'suggestions-de-rapprochement': 'tactique',
  // Stratégique
  'arbre-des-objectifs': 'strategique',
  'roadmap-par-trimestre': 'strategique',
  'capacite-par-trimestre': 'strategique',
  'alignement-intent-livraison': 'strategique tactique',
  'couverture-prd': 'strategique',
  'alignement-okr': 'strategique',
  'outcome-leaderboard': 'strategique',
  'discovery-board': 'strategique',
  'hypotheses-produit': 'strategique',
  'confidence-tracker': 'strategique',
  'a-b-tests-experimentations': 'strategique',
  'wip-limit-work-in-progress': 'strategique tactique',
  // Communication
  'brief-pm-exportable': 'communication',
  'newsletter-pm-hebdo': 'communication',
  'retrospective-trimestrielle': 'communication rituels',
  'export-csv-des-intents': 'communication',
  'liens-rapides': 'communication',
  'pages-detaillees-intent': 'communication',
  // Rituels
  'stand-up-timer': 'rituels',
  'preparer-la-prochaine-demo': 'rituels communication',
  'cockpit-product-manager': 'rituels tactique strategique communication',
  // Métriques (= stratégique secondaire)
  'velocite': 'strategique',
  'velocite-semaine-vs-precedente': 'strategique tactique',
  'velocity-forecast': 'strategique',
  'vitesse-de-livraison': 'strategique',
  'cumulative-flow-diagram': 'strategique',
  'burnup-chart': 'strategique',
  'risk-burndown': 'strategique',
  'fraicheur-du-backlog': 'tactique',
  // Référentiels
  'dependances-intent': 'strategique tactique',
  'risques': 'tactique strategique',
  'registre-des-risques': 'strategique',
  'drill-down-par-persona': 'strategique',
  'portefeuille-par-owner': 'tactique',
  'portefeuille-par-sponsor': 'communication strategique',
  'decisions-et-facts': 'strategique communication',
  'tag-cloud': 'strategique',
  'activite-recente': 'rituels',
  'heatmap-activite-pm': 'rituels',
  'journal-pm': 'rituels',
  'capturer-un-nouvel-intent': 'tactique',
  'imprimer-pdf': 'communication',
  'tour-dintroduction-pm': 'rituels',
  'commandes-pm-copy-paste': 'tactique communication',
  // Boucle 22
  'centre-de-notifications': 'tactique strategique communication rituels',
  'sqs-readiness-scorecard': 'tactique strategique',
  'evolution-score-sante': 'strategique rituels',
  // Boucle 23
  'maturite-documentaire-des-intents': 'tactique strategique',
  'narratif-strategique': 'communication strategique',
  'sprint-planner-commit-horizon': 'tactique strategique',
  // Boucle 24
  'communication-stakeholder': 'communication tactique',
  'velocite-decisionnelle': 'strategique rituels',
  'checklist-hebdomadaire-pm': 'rituels tactique',
  // Boucle 25
  'attribution-outcomes': 'strategique',
  'discovery-delivery-balance': 'strategique tactique',
  'velocite-par-sponsor': 'communication strategique',
  // Boucle 26
  'fraicheur-cadrage': 'strategique',
  'inbox-feedback-utilisateur': 'tactique communication',
  'nouveautes-depuis-votre-derniere-visite': 'tactique rituels',
  // Boucle 27
  'cycle-de-vie-des-hypotheses': 'strategique tactique',
  'roadmap-timeline': 'strategique tactique',
  'scorecard-pm-personnel': 'rituels strategique',
  // Boucle 28
  'compare-intents': 'tactique strategique',
  'prep-1-1-sponsor': 'communication strategique',
  'hygiene-backlog': 'tactique',
  // Boucle 29
  'time-to-first-spec': 'strategique tactique',
  'mur-de-la-voix-client': 'communication tactique',
  'livraison-par-trimestre': 'strategique',
  // Boucle 30
  'file-de-revue-specs': 'tactique',
  'registre-des-risques-acceptes': 'strategique communication',
  'wins-recents': 'communication rituels',
  // Boucle 31
  'transitions-detat-intent': 'strategique rituels',
  'dependances-orphelines': 'tactique',
  'agenda-demo-auto': 'communication rituels',
  // Boucle 32
  'specs-bloquees': 'tactique',
  'clusters-thematiques-paires-de-tags': 'strategique communication',
  'cost-of-delay-scorer': 'tactique strategique',
  // Boucle 33
  'pyramide-dage-backlog': 'strategique tactique',
  'specs-transverses': 'tactique strategique',
  'relances-blockers': 'communication tactique',
  // Boucle 34
  'matrice-persona-outcome': 'strategique',
  'throughput-backlog': 'strategique tactique',
  'concentration-des-risques-par-sponsor': 'strategique communication',
  // Boucle 35
  'discovery-delivery-cycle-time': 'strategique',
  'charge-par-owner': 'tactique strategique',
  'temps-de-lecture-artefacts': 'tactique',
  // Boucle 36
  'taille-spec-t-shirt-size': 'tactique',
  'alignement-intent-north-star': 'strategique',
  'velocite-vs-sla': 'strategique',
  // Boucle 37
  'timeline-des-livraisons': 'strategique communication rituels',
  'couverture-sections-prd': 'strategique',
  'completion-des-outcomes': 'strategique',
  // Boucle 38
  'transparence-du-registre-de-risque': 'strategique communication',
  'cumul-des-achievements': 'communication rituels',
  'script-standup-auto': 'rituels communication',
  // Boucle 39
  'brouillon-retro-trimestrielle': 'rituels communication',
  'trous-de-couverture-prd': 'strategique',
  'couverture-annotations-spec': 'tactique strategique',
  // Boucle 40
  'diversite-du-portefeuille-actif': 'strategique',
  'heatmap-activite-par-jour': 'rituels',
  'templates-pr-par-intent': 'tactique communication',
  // Boucle 41
  'velocite-par-tag': 'strategique',
  'candidats-archivage': 'tactique',
  'recap-sprint-14j': 'rituels strategique',
  // Boucle 42
  'criteres-dacceptation-spec': 'tactique',
  'action-items-journaux': 'tactique rituels',
  'progression-okr-par-kr': 'strategique',
  // Boucle 43
  'bus-factor-analyzer': 'strategique tactique',
  'evolution-sentiment-client': 'communication strategique',
  'calendrier-rituels-aiad': 'rituels',
  // Boucle 44
  'onboarding-nouveau-membre': 'communication',
  'decisions-en-attente': 'tactique',
  'carte-stakeholder-intent': 'communication strategique',
  // Boucle 45
  'decisions-facts-par-trimestre': 'rituels strategique',
  'score-qualite-spec': 'tactique',
  // Boucle 46
  'scorecard-sponsors': 'communication strategique',
  'alignement-outcome-north-star': 'strategique',
  'feed-activite-7j': 'rituels tactique',
  // Boucle 47
  'cartes-dinitiatives-par-theme': 'strategique communication',
  'temps-median-par-statut-spec': 'tactique strategique',
  'filtres-rapides': 'tactique',
});

const TABS_CSS = `<style>
.pm-cockpit-tabs {
  position: sticky; top: 4.2rem; z-index: 24;
  margin: -.3rem -1rem .8rem; padding: .4rem .7rem;
  background: rgba(255,255,255,.95);
  backdrop-filter: blur(4px);
  border-bottom: 1px solid var(--border, #e1e4e8);
  display: flex; gap: .4rem; flex-wrap: wrap; align-items: center;
}
.pm-cockpit-tab {
  padding: .25rem .65rem; border-radius: 999px;
  border: 1px solid var(--border, #ccc); background: transparent;
  cursor: pointer; font-size: .82rem; color: inherit;
  transition: background .12s, border-color .12s;
}
.pm-cockpit-tab:hover { background: rgba(127,127,127,.08); }
.pm-cockpit-tab[aria-pressed="true"] {
  background: var(--accent, #4c6ef5); color: #fff; border-color: var(--accent, #4c6ef5);
  font-weight: 500;
}
.pm-cockpit-tabs-label {
  font-size: .72rem; text-transform: uppercase;
  letter-spacing: .04em; color: var(--muted, #777);
  margin-right: .3rem;
}
body.pm-tab-active section.pm-tab-hidden { display: none !important; }
body.pm-searching .pm-cockpit-tabs { display: none !important; }
@media print { .pm-cockpit-tabs { display: none !important; } }
</style>`;

const TABS_SCRIPT = `<script>
(function () {
  var SECTION_TO_TABS = ${JSON.stringify(SECTION_TO_TABS)};
  var KEY = 'aiad-pm-tab';
  var TABS = ['all', 'tactique', 'strategique', 'communication', 'rituels'];
  function init() {
    var bar = document.querySelector('.pm-cockpit-tabs');
    if (!bar) return;
    // 1. Tag chaque section selon son <h2> id (auto-taggué par TOC #441 au DOMContentLoaded).
    setTimeout(function () {
      document.querySelectorAll('main section > h2[id]').forEach(function (h) {
        var section = h.parentElement;
        var id = h.id;
        var tabs = SECTION_TO_TABS[id] || 'all';
        section.setAttribute('data-cockpit-tabs', tabs);
      });
      // 2. Applique le tab persistant.
      var saved = 'all';
      try { saved = localStorage.getItem(KEY) || 'all'; } catch (e) { /* env minimal */ }
      applyTab(saved);
    }, 150);
    // 3. Click sur tab → switch + persist.
    bar.querySelectorAll('button.pm-cockpit-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-tab');
        applyTab(tab);
        try { localStorage.setItem(KEY, tab); } catch (e) { /* ok */ }
      });
    });
  }
  function applyTab(tab) {
    document.querySelectorAll('button.pm-cockpit-tab').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-tab') === tab ? 'true' : 'false');
    });
    if (tab === 'all') {
      document.body.classList.remove('pm-tab-active');
      document.querySelectorAll('main section').forEach(function (s) { s.classList.remove('pm-tab-hidden'); });
      return;
    }
    document.body.classList.add('pm-tab-active');
    document.querySelectorAll('main section').forEach(function (s) {
      var tabs = (s.getAttribute('data-cockpit-tabs') || 'all').split(/\\s+/);
      if (tabs.indexOf(tab) >= 0 || tabs.indexOf('all') >= 0) {
        s.classList.remove('pm-tab-hidden');
      } else {
        s.classList.add('pm-tab-hidden');
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

const LABELS = {
  all: 'Tout (56 sections)',
  tactique: 'Tactique',
  strategique: 'Stratégique',
  communication: 'Communication',
  rituels: 'Rituels',
};

export function blocCockpitTabs() {
  const btns = Object.entries(LABELS).map(([key, label]) => {
    const pressed = key === 'all' ? 'true' : 'false';
    return `<button type="button" class="pm-cockpit-tab" data-tab="${key}" aria-pressed="${pressed}">${label}</button>`;
  }).join('');
  return `${TABS_CSS}<div class="pm-cockpit-tabs" role="tablist" aria-label="Filtre cockpit PM par axe">
    <span class="pm-cockpit-tabs-label">Filtrer :</span>
    ${btns}
  </div>${TABS_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  blocCockpitTabs as cockpitTabsBar,
  blocCockpitTabs as cockpitTabsSection,
  SECTION_TO_TABS as TAB_MAPPING,
  SECTION_TO_TABS as SLUG_TO_TABS,
};
