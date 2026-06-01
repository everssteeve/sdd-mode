// AIAD SDD Mode — Dashboard : recherche globale pm.html (#456).
//
// Barre de recherche sticky qui filtre en live toutes les sections de
// pm.html : tables, cards, listes. Inspirée de l'UX `bindFilter` (#421)
// mais appliquée transversalement à l'ensemble du DOM main, pas à une
// table unique.
//
// Algorithme côté client :
//   1. Au chargement, indexer chaque "item filtrable" (tr, .card, .roadmap-card,
//      .deps-card, .risk-card, .hyp-card, .persona-card, .owner-card,
//      .sponsor-card, .demo-item, .activite-item, .deadline-item, .refine-card,
//      .bottleneck-card, .ip-list-link, .tag-chip).
//   2. À chaque input, ne garder visibles que les items dont textContent
//      contient la query (case-insensitive, trim).
//   3. Compter les sections impactées + masquer (collapse) les sections
//      sans aucun item visible.
//   4. Raccourci `Cmd+K` / `Ctrl+K` pour focus la barre.
//
// Aucun effet de bord serveur. Pure transformation HTML+JS.
//
// Documentation : https://aiad.ovh

const SEARCH_CSS = `<style>
.pm-search-bar {
  position: sticky; top: 3rem; z-index: 25;
  margin: -.5rem -1rem 1rem; padding:.45rem .7rem;
  background: rgba(255,255,255,.96);
  backdrop-filter: blur(4px);
  border-bottom: 1px solid var(--border, #e1e4e8);
  display: flex; gap:.5rem; align-items:center;
}
.pm-search-bar input {
  flex: 1; padding:.35rem .55rem; border:1px solid var(--border, #ccc);
  border-radius:.25rem; font-size:.9rem;
  background: var(--card-bg, #fff); color: inherit;
}
.pm-search-bar input:focus { outline: 2px solid var(--accent, #4c6ef5); outline-offset: -1px; }
.pm-search-bar kbd { font-size:.7rem; padding:.1rem .3rem; background:rgba(127,127,127,.12); border-radius:.2rem; border:1px solid var(--border, #ccc); }
.pm-search-stats { color: var(--muted, #777); font-size:.78rem; white-space: nowrap; }
.pm-search-clear { padding:.25rem .5rem; background:transparent; border:1px solid var(--border, #ccc); border-radius:.25rem; cursor:pointer; font-size:.75rem; color:inherit; }
.pm-search-clear:hover { background:rgba(127,127,127,.08); }
body.pm-searching section.pm-hidden { display: none !important; }
body.pm-searching .pm-item.pm-hidden { display: none !important; }
.pm-search-hint-empty { padding:.5rem .7rem; margin:.5rem 0; background:rgba(232,89,12,.06); border-left:3px solid #e8590c; border-radius:.25rem; font-size:.85rem; }
@media print {
  .pm-search-bar, .pm-search-hint-empty { display: none !important; }
}
</style>`;

// Sélecteurs d'items filtrables — inclusifs : on prend tous les containers
// qui représentent une "entité" sur pm.html.
const ITEM_SELECTORS = [
  'main section table tbody tr',
  'main section .roadmap-card',
  'main section .deps-card',
  'main section .risk-card',
  'main section .hyp-card',
  'main section .persona-card',
  'main section .owner-card',
  'main section .sponsor-card',
  'main section .demo-item',
  'main section .activite-item',
  'main section .deadline-item',
  'main section .refine-card',
  'main section .bottleneck-card',
  'main section .ip-list-link',
  'main section .tag-chip',
  'main section .okr-obj',
  'main section .disco-card',
  'main section .fact-card',
];

const SEARCH_SCRIPT = `<script>
(function () {
  var SELECTORS = ${JSON.stringify(ITEM_SELECTORS)};
  function init() {
    var bar = document.getElementById('pm-search-input');
    var stats = document.getElementById('pm-search-stats');
    var clear = document.getElementById('pm-search-clear');
    var empty = document.getElementById('pm-search-empty');
    if (!bar) return;
    var items = [];
    SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        // Évite doublons si plusieurs sélecteurs matchent.
        if (el.classList.contains('pm-item')) return;
        el.classList.add('pm-item');
        items.push(el);
      });
    });
    function update() {
      var q = bar.value.trim().toLowerCase();
      if (!q) {
        document.body.classList.remove('pm-searching');
        items.forEach(function (it) { it.classList.remove('pm-hidden'); });
        document.querySelectorAll('main section').forEach(function (s) { s.classList.remove('pm-hidden'); });
        if (stats) stats.textContent = items.length + ' items indexés';
        if (empty) empty.style.display = 'none';
        return;
      }
      document.body.classList.add('pm-searching');
      var visibles = 0;
      items.forEach(function (it) {
        var t = (it.textContent || '').toLowerCase();
        if (t.indexOf(q) >= 0) {
          it.classList.remove('pm-hidden');
          visibles++;
        } else {
          it.classList.add('pm-hidden');
        }
      });
      // Sections sans item visible → masquées (sauf cockpit titre & search bar).
      document.querySelectorAll('main section').forEach(function (s) {
        var enfants = s.querySelectorAll('.pm-item');
        if (enfants.length === 0) {
          s.classList.remove('pm-hidden'); // sections sans items du tout (texte pur) → toujours affichées
          return;
        }
        var visible = false;
        enfants.forEach(function (e) { if (!e.classList.contains('pm-hidden')) visible = true; });
        if (visible) s.classList.remove('pm-hidden');
        else s.classList.add('pm-hidden');
      });
      if (stats) stats.textContent = visibles + ' / ' + items.length + ' items';
      if (empty) empty.style.display = visibles === 0 ? '' : 'none';
    }
    bar.addEventListener('input', update);
    if (clear) clear.addEventListener('click', function () {
      bar.value = '';
      update();
      bar.focus();
    });
    // Cmd+K / Ctrl+K → focus
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        bar.focus();
        bar.select();
      }
      if (e.key === 'Escape' && document.activeElement === bar) {
        bar.value = '';
        update();
        bar.blur();
      }
    });
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

export function blocGlobalSearch() {
  return `${SEARCH_CSS}<div class="pm-search-bar" role="search">
    <input type="search" id="pm-search-input" placeholder="Filtrer cockpit (titre, ID, persona, owner, tag…)" aria-label="Recherche globale PM" />
    <kbd>⌘K</kbd>
    <span class="pm-search-stats" id="pm-search-stats">items indexés</span>
    <button type="button" class="pm-search-clear" id="pm-search-clear" title="Effacer (Esc)">Effacer</button>
  </div>
  <div class="pm-search-hint-empty" id="pm-search-empty" style="display:none">Aucun item ne correspond à ta recherche. Efface la barre ou raffine.</div>
  ${SEARCH_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  blocGlobalSearch as globalSearchBar,
};
