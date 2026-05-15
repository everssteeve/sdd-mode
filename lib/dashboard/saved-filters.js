// AIAD SDD Mode — Dashboard : persistance localStorage des filtres PM (#466).
//
// Sauvegarde et restaure dans `localStorage` l'état des filtres PM :
//   - Search global (#456) → key `aiad-pm-search`
//   - Chips filtres intents.html (#421) → key `aiad-pm-chips`
//
// Sur pm.html : ajoute un script qui écoute les inputs sur ces filtres et
// persiste, puis au DOMContentLoaded restaure depuis localStorage. Bouton
// "Reset filtres" qui clear localStorage + reset l'UI.
//
// Module purement client-side (CSS + script). Inséré une fois dans pm.html
// après les filtres déjà présents.
//
// Aucun effet de bord serveur. Pure transformation HTML+JS.
//
// Documentation : https://aiad.ovh

const SAVED_CSS = `<style>
.pm-saved-filters {
  display: inline-flex; align-items: center; gap: .4rem; font-size: .78rem;
  color: var(--muted, #777); margin-left: .5rem;
}
.pm-saved-filters-btn {
  padding: .2rem .55rem; background: transparent; border: 1px solid var(--border, #ccc);
  border-radius: .2rem; cursor: pointer; font-size: .72rem; color: inherit;
}
.pm-saved-filters-btn:hover { background: rgba(127,127,127,.08); }
.pm-saved-filters-indicator { font-size: .7rem; }
.pm-saved-filters-indicator.active { color: var(--accent, #4c6ef5); font-weight: 600; }
@media print { .pm-saved-filters { display: none !important; } }
</style>`;

const SAVED_SCRIPT = `<script>
(function () {
  var KEY_SEARCH = 'aiad-pm-search';
  var KEY_CHIPS = 'aiad-pm-chips';
  function readLS(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeLS(key, val) {
    try {
      if (val == null || val === '') localStorage.removeItem(key);
      else localStorage.setItem(key, val);
    } catch (e) { /* env sans storage */ }
  }
  function refreshIndicator() {
    var ind = document.getElementById('pm-saved-filters-indicator');
    if (!ind) return;
    var has = readLS(KEY_SEARCH) || readLS(KEY_CHIPS);
    if (has) {
      ind.textContent = '● Filtres sauvegardés';
      ind.classList.add('active');
    } else {
      ind.textContent = 'Aucun filtre sauvegardé';
      ind.classList.remove('active');
    }
  }
  function init() {
    // (a) Search global (#456) — persist + restore.
    var search = document.getElementById('pm-search-input');
    if (search) {
      var saved = readLS(KEY_SEARCH);
      if (saved) {
        search.value = saved;
        // Trigger input event to apply filter immediately.
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
      search.addEventListener('input', function () {
        writeLS(KEY_SEARCH, search.value);
        refreshIndicator();
      });
    }
    // (b) Chips filter (#421) — actuels sur intents.html (data-pm-filter-target),
    // pas sur pm.html. On peut quand même sauvegarder l'état si présent.
    var chipsGroup = document.querySelector('[data-pm-filter-target]');
    if (chipsGroup) {
      var savedChip = readLS(KEY_CHIPS);
      if (savedChip) {
        var btn = chipsGroup.querySelector('button[data-pm-filter="' + savedChip + '"]');
        if (btn) btn.click();
      }
      chipsGroup.querySelectorAll('button[data-pm-filter]').forEach(function (b) {
        b.addEventListener('click', function () {
          var f = b.getAttribute('data-pm-filter');
          writeLS(KEY_CHIPS, f === '*' ? null : f);
          refreshIndicator();
        });
      });
    }
    // (c) Bouton Reset.
    var resetBtn = document.getElementById('pm-saved-filters-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        writeLS(KEY_SEARCH, null);
        writeLS(KEY_CHIPS, null);
        if (search) {
          search.value = '';
          search.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (chipsGroup) {
          var btnAll = chipsGroup.querySelector('button[data-pm-filter="*"]');
          if (btnAll) btnAll.click();
        }
        refreshIndicator();
      });
    }
    refreshIndicator();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

// Bloc UI à injecter à côté de la barre de recherche (#456). Affiche
// l'état de persistance + bouton reset.
export function blocSavedFilters() {
  return `${SAVED_CSS}<div class="pm-saved-filters" id="pm-saved-filters" role="status">
    <span class="pm-saved-filters-indicator" id="pm-saved-filters-indicator">Aucun filtre sauvegardé</span>
    <button type="button" class="pm-saved-filters-btn" id="pm-saved-filters-reset" title="Effacer la recherche + les chips persistées">Reset filtres</button>
  </div>${SAVED_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  blocSavedFilters as savedFiltersWidget,
};
