// AIAD SDD Mode — Dashboard : section visibility manager (#552).
//
// Permet au PM de masquer/afficher chaque section pm.html via UI
// client. Sélection persistée dans `localStorage.aiad-pm-sections-hidden`.
// Aide à dégonfler le cockpit (123 sections) en fonction du contexte.
//
// Pure transformation HTML+JS — opère purement côté client sur les
// `<section>` déjà rendus.

export function calculerSectionVisibility() {
  // Pas de calcul serveur — purement client.
  return { actif: true };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const SV_CSS = `<style>
.sv-card {
  position: sticky; top: 4.6rem; z-index: 23;
  margin: -.3rem -1rem .6rem; padding: .4rem .7rem;
  background: rgba(232,89,12,.05);
  border-bottom: 1px solid rgba(232,89,12,.3);
  display: flex; gap: .5rem; flex-wrap: wrap; align-items: center;
  font-size: .82rem;
}
.sv-btn { padding:.25rem .55rem; border:1px solid var(--border, #ccc); background:transparent; border-radius:.25rem; cursor:pointer; font-size:.78rem; color:inherit; }
.sv-btn:hover { background:rgba(127,127,127,.06); }
.sv-counter { color:var(--muted, #777); font-size:.78rem; }
body.pm-hide-mode section.pm-hidden { display:none !important; }
body.pm-hide-mode section.pm-hidden + section { margin-top: 0; }
body.pm-hide-mode-edit .sv-toggle { display:inline-block !important; }
.sv-toggle {
  display:none;
  position:absolute; top:.5rem; right:.5rem; z-index:1;
  padding:.15rem .45rem; background:rgba(232,89,12,.15); border:1px solid #e8590c; border-radius:.18rem;
  cursor:pointer; font-size:.7rem; color:#7a3a08;
}
main section { position:relative; }
@media print { .sv-card, .sv-toggle { display:none !important; } }
</style>`;

const SV_SCRIPT = `<script>
(function () {
  var KEY = 'aiad-pm-sections-hidden';
  function init() {
    var bar = document.querySelector('.sv-card');
    if (!bar) return;
    var btnEdit = bar.querySelector('[data-sv-action=edit]');
    var btnReset = bar.querySelector('[data-sv-action=reset]');
    var btnShowAll = bar.querySelector('[data-sv-action=show-all]');
    var counter = bar.querySelector('.sv-counter');
    var hidden = new Set();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) JSON.parse(raw).forEach(function (s) { hidden.add(s); });
    } catch (e) { /* ignore */ }
    function persist() {
      try { localStorage.setItem(KEY, JSON.stringify([...hidden])); } catch (e) { /* ignore */ }
    }
    function refreshCounter() {
      var total = document.querySelectorAll('main section > h2[id]').length;
      counter.textContent = hidden.size + '/' + total + ' sections masquées';
    }
    function appliquer() {
      document.body.classList.add('pm-hide-mode');
      document.querySelectorAll('main section > h2[id]').forEach(function (h) {
        var section = h.parentElement;
        if (!section) return;
        var slug = h.id;
        if (hidden.has(slug)) section.classList.add('pm-hidden');
        else section.classList.remove('pm-hidden');
        // Injecter bouton toggle (créé une fois)
        if (!section.querySelector('.sv-toggle')) {
          var btn = document.createElement('button');
          btn.className = 'sv-toggle';
          btn.type = 'button';
          btn.textContent = 'masquer';
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            hidden.add(slug);
            persist();
            appliquer();
          });
          section.appendChild(btn);
        }
      });
      refreshCounter();
    }
    if (btnEdit) btnEdit.addEventListener('click', function () {
      document.body.classList.toggle('pm-hide-mode-edit');
    });
    if (btnReset) btnReset.addEventListener('click', function () {
      hidden.clear();
      persist();
      appliquer();
    });
    if (btnShowAll) btnShowAll.addEventListener('click', function () {
      hidden.clear();
      persist();
      appliquer();
    });
    setTimeout(appliquer, 200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

export function blocSectionVisibility() {
  return `${SV_CSS}<div class="sv-card">
    <strong>👁 Visibilité sections</strong>
    <span class="sv-counter">… chargement</span>
    <button type="button" class="sv-btn" data-sv-action="edit">✏ Mode édition (afficher boutons masquer)</button>
    <button type="button" class="sv-btn" data-sv-action="show-all">👁 Tout afficher</button>
  </div>${SV_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  calculerSectionVisibility as computeSectionVisibility,
  blocSectionVisibility as sectionVisibilitySection,
};
