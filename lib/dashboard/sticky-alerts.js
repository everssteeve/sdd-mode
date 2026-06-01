// AIAD SDD Mode — Dashboard : barre d'alerte sticky en haut (#445).
//
// Au-delà des sections détaillées du cockpit, le PM doit avoir un signal
// instantané "qu'est-ce qui brûle ?". Cette barre flottante en haut de
// pm.html agrège les 3 alertes les plus critiques + ajoute un suffixe
// au `<title>` de l'onglet (« (2) Cockpit PM — projet ») pour faciliter
// le pinning d'onglet et la veille passive.
//
// Sources d'alertes agrégées (en ordre de gravité décroissante) :
//   1. Cycles de dépendances détectés (#434)
//   2. Facts critiques ouverts
//   3. Intents en retard (`deadlines.buckets.retard`)
//   4. Intents urgents (J-14)
//   5. Intents zombies
//   6. Drafts oubliés (>14j)
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const NIVEAU_RANK = { bad: 0, warn: 1, info: 2 };

function pousser(out, niveau, texte, ancre) {
  out.push({ niveau, texte, ancre });
}

export function calculerStickyAlerts(donnees) {
  const out = [];
  const dl = donnees?.intentDeps;
  if (dl && dl.cycles?.length > 0) {
    pousser(out, 'bad', `${dl.cycles.length} cycle(s) de dépendances détecté(s)`, '#dependances-intent');
  }
  const fctsCritiques = (donnees?.facts || []).filter((f) => f.gravite === 'critical' && !['closed', 'resolu', 'résolu'].includes(f.statut));
  if (fctsCritiques.length > 0) {
    pousser(out, 'bad', `${fctsCritiques.length} fact(s) critique(s) ouvert(s)`, '#decisions-et-facts');
  }
  const deadTotaux = donnees?.deadlines?.totaux || {};
  if (deadTotaux.retard > 0) {
    pousser(out, 'bad', `${deadTotaux.retard} Intent(s) en retard sur target`, '#echeances-intent');
  }
  if (deadTotaux.urgent > 0) {
    pousser(out, 'warn', `${deadTotaux.urgent} Intent(s) urgent(s) (≤ 14j)`, '#echeances-intent');
  }
  const pm = donnees?.pm || {};
  if ((pm.zombies || []).length > 0) {
    pousser(out, 'warn', `${pm.zombies.length} Intent(s) zombie(s) (active > 30j sans SPEC)`, '#a-valider-cette-semaine');
  }
  if ((pm.draftsAnciens || []).length > 0) {
    pousser(out, 'info', `${pm.draftsAnciens.length} draft(s) anciens (> 14j)`, '#a-valider-cette-semaine');
  }
  // Tri par gravité + max 3 visibles.
  out.sort((a, b) => NIVEAU_RANK[a.niveau] - NIVEAU_RANK[b.niveau]);
  const visibles = out.slice(0, 3);
  const masquees = out.length - visibles.length;
  const critiques = out.filter((a) => a.niveau === 'bad').length;
  return {
    alertes: visibles,
    total: out.length,
    masquees,
    critiques,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const STICKY_CSS = `<style>
.pm-sticky-alerts { position: sticky; top: 0; z-index: 30; padding:.4rem .65rem; background: rgba(255, 240, 240, .96); backdrop-filter: blur(4px); border-bottom:1px solid #fab8b8; margin: -1rem -1rem 1rem; font-size:.85rem; }
.pm-sticky-alerts.no-critique { background: rgba(255, 250, 230, .96); border-bottom-color:#f0d27a; }
.pm-sticky-alerts.calme { background: rgba(220, 252, 231, .9); border-bottom-color:#86c79e; }
.pm-sticky-alerts ul { margin:0; padding:0; list-style:none; display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; }
.pm-sticky-alerts li { display:inline-flex; align-items:center; gap:.3rem; }
.pm-sticky-alerts a { color:inherit; text-decoration:none; padding:.15rem .45rem; border-radius:.2rem; }
.pm-sticky-alerts a:hover { background:rgba(0,0,0,.06); }
.pm-sticky-alerts .sa-niveau-bad { color:#9b1c1c; font-weight:600; }
.pm-sticky-alerts .sa-niveau-warn { color:#a05c0a; font-weight:500; }
.pm-sticky-alerts .sa-niveau-info { color:#1e40af; }
.pm-sticky-alerts .sa-masquees { color: var(--muted, #777); font-size:.75rem; }
.pm-sticky-alerts .sa-calme { color:#136d2a; font-weight:500; }
</style>`;

// Met à jour `<title>` côté client pour préfixer le nombre d'alertes
// critiques, utile en onglet épinglé : « (2) Cockpit … ».
const STICKY_TITLE_SCRIPT = `<script>
(function () {
  var el = document.getElementById('pm-sticky-counter');
  if (!el) return;
  var n = parseInt(el.getAttribute('data-critiques') || '0', 10);
  if (!isFinite(n) || n <= 0) return;
  try {
    document.title = '(' + n + ') ' + document.title;
  } catch (e) { /* env minimal */ }
})();
</script>`;

export function blocStickyAlerts(donnees) {
  const s = donnees?.stickyAlerts;
  if (!s) return '';
  if (s.total === 0) {
    return `${STICKY_CSS}<div class="pm-sticky-alerts calme" id="pm-sticky-counter" data-critiques="0">
      <ul><li class="sa-calme">✓ Pas d'alerte PM prioritaire ouverte.</li></ul>
    </div>`;
  }
  const cls = s.critiques > 0 ? '' : ' no-critique';
  const items = s.alertes.map((a) => `<li class="sa-niveau-${escape(a.niveau)}"><a href="${escape(a.ancre)}" title="Jump section">${escape(a.texte)}</a></li>`).join('');
  const masquees = s.masquees > 0 ? `<li class="sa-masquees">+${s.masquees} autre(s)</li>` : '';
  return `${STICKY_CSS}<div class="pm-sticky-alerts${cls}" id="pm-sticky-counter" data-critiques="${s.critiques}" role="status" aria-live="polite">
    <ul>${items}${masquees}</ul>
  </div>${STICKY_TITLE_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  calculerStickyAlerts as computeStickyAlerts,
  blocStickyAlerts as stickyAlertsSection,
};
