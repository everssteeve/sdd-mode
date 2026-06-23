// AIAD SDD Mode — Dashboard : quick filters bar (#560).
//
// Barre de **filtres pré-fabriqués** combinant statut × priorité ×
// kind pour pré-filtrer rapidement les Intents listés dans
// `#231 alignement-intent-livraison` (table avec data-tags).
//
// Active/désactive via clic, persiste dans `localStorage.aiad-pm-quick-filter`.
// Purement client.

export function calculerQuickFilters() {
  return { actif: true };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const QF_CSS = `<style>
.qf-bar { display:flex; gap:.3rem; flex-wrap:wrap; margin:.4rem 0; padding:.4rem .55rem; background:rgba(127,127,127,.04); border-radius:.3rem; align-items:baseline; }
.qf-label { font-size:.78rem; color:var(--muted, #777); text-transform:uppercase; letter-spacing:.04em; margin-right:.2rem; }
.qf-chip {
  padding:.2rem .55rem; border:1px solid var(--border, #ccc);
  background:transparent; border-radius:999px;
  cursor:pointer; font-size:.78rem; color:inherit;
}
.qf-chip:hover { background:rgba(127,127,127,.06); }
.qf-chip[aria-pressed="true"] {
  background:var(--accent, #4c6ef5); color:var(--accent-fg,#fff);
  border-color:var(--accent, #4c6ef5); font-weight:500;
}
body.qf-active table.intents-table tr.intents-row-hidden { display:none !important; }
@media print { .qf-bar { display:none !important; } }
</style>`;

const QF_SCRIPT = `<script>
(function () {
  var KEY = 'aiad-pm-quick-filter';
  var FILTERS = {
    'p0-actifs': { label: 'P0 actifs', test: function (row) {
      var tags = (row.getAttribute('data-tags') || '');
      var prio = (row.getAttribute('data-priority') || row.getAttribute('data-prio') || '').toUpperCase();
      var statut = (row.getAttribute('data-statut') || row.getAttribute('data-status') || '').toLowerCase();
      return prio === 'P0' && (statut === 'active' || statut === 'in-progress');
    }},
    'zombies': { label: '🧟 Zombies', test: function (row) {
      var tags = (row.getAttribute('data-tags') || '');
      return /zombie/.test(tags);
    }},
    'sans-spec': { label: 'Sans SPEC', test: function (row) {
      var tags = (row.getAttribute('data-tags') || '');
      return /sans-spec/.test(tags);
    }},
    'discovery': { label: 'Discovery', test: function (row) {
      var kind = (row.getAttribute('data-kind') || '').toLowerCase();
      return kind === 'discovery' || kind === 'experiment';
    }},
    'all': { label: 'Tout afficher', test: function () { return true; }},
  };
  function init() {
    var bar = document.querySelector('.qf-bar');
    if (!bar) return;
    var actif = 'all';
    try { actif = localStorage.getItem(KEY) || 'all'; } catch (e) {}
    function appliquer(filter) {
      var f = FILTERS[filter] || FILTERS.all;
      var rows = document.querySelectorAll('table.intents-table tbody tr[data-tags], table.intents-table tbody tr[data-priority]');
      if (rows.length === 0) {
        // Fallback : cherche les rows par autre attribut
        rows = document.querySelectorAll('table tbody tr');
      }
      var nb = 0;
      rows.forEach(function (r) {
        if (filter === 'all' || f.test(r)) {
          r.classList.remove('intents-row-hidden');
          nb++;
        } else {
          r.classList.add('intents-row-hidden');
        }
      });
      if (filter === 'all') document.body.classList.remove('qf-active');
      else document.body.classList.add('qf-active');
      bar.querySelectorAll('button.qf-chip').forEach(function (btn) {
        btn.setAttribute('aria-pressed', btn.dataset.filter === filter ? 'true' : 'false');
      });
      var counter = bar.querySelector('.qf-counter');
      if (counter) counter.textContent = (filter === 'all' ? rows.length : nb) + ' lignes';
    }
    bar.querySelectorAll('button.qf-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var f = btn.dataset.filter;
        actif = f;
        try { localStorage.setItem(KEY, f); } catch (e) {}
        appliquer(f);
      });
    });
    setTimeout(function () { appliquer(actif); }, 200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

const FILTERS_DEF = [
  { id: 'all', label: 'Tout' },
  { id: 'p0-actifs', label: 'P0 actifs' },
  { id: 'zombies', label: '🧟 Zombies' },
  { id: 'sans-spec', label: 'Sans SPEC' },
  { id: 'discovery', label: 'Discovery' },
];

export function blocQuickFilters() {
  const chips = FILTERS_DEF.map((f) => `<button type="button" class="qf-chip" data-filter="${escape(f.id)}" aria-pressed="${f.id === 'all' ? 'true' : 'false'}">${escape(f.label)}</button>`).join('');
  return `${QF_CSS}<section>
    <h2>Filtres rapides <span class="count">pré-filtres table Intent</span></h2>
    <p class="muted" style="font-size:.85rem">Chips pré-fabriqués qui filtrent la table d'alignement Intent ↔ Livraison (#231) selon combinaisons usuelles. Persistance <code>localStorage.aiad-pm-quick-filter</code>.</p>
    <div class="qf-bar">
      <span class="qf-label">Filtrer :</span>
      ${chips}
      <span class="qf-counter muted" style="font-size:.78rem; margin-left:auto"></span>
    </div>
  </section>${QF_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  calculerQuickFilters as computeQuickFilters,
  blocQuickFilters as quickFiltersSection,
};
