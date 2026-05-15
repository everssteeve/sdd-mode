// AIAD SDD Mode — Dashboard : theme switcher PM-friendly (#477).
//
// Le dashboard SDD est PE-centric par défaut (palette bleue cool). Ce
// module ajoute une palette PM dédiée (chaude/focus) sélectionnable
// depuis un toggle dans le cockpit pm.html. État persisté dans
// `localStorage.aiad-pm-theme` :
//   - "default" (PE) : la palette générique du dashboard
//   - "pm-warm"      : tons chauds (orange/ambre/rouge) pour signaler
//                       les sections PM-centric
//   - "pm-focus"     : haute densité — réduit padding/gap pour PMs
//                       qui veulent voir 2x plus de sections sans scroll
//
// Pure client-side : CSS variables overridden + classes scopées via
// `body.pm-theme-{nom}`. Pas de regen serveur nécessaire.
//
// Aucun effet de bord serveur. Pure transformation HTML+JS.
//
// Documentation : https://aiad.ovh

const PM_THEME_CSS = `<style>
/* Theme PM Warm : accentue le cockpit PM avec une palette chaude. */
body.pm-theme-pm-warm {
  --accent: #e8590c;
}
body.pm-theme-pm-warm .pm-daily-focus.gravite-calme {
  background: linear-gradient(90deg, rgba(232,89,12,.10), rgba(232,89,12,.02));
  border-bottom-color: #e8590c; color: #7a3a08;
}
body.pm-theme-pm-warm .pm-sticky-alerts.calme {
  background: rgba(255, 247, 230, .96);
  border-bottom-color: #fab005;
}
body.pm-theme-pm-warm .pm-search-bar {
  background: rgba(255, 250, 240, .96);
}
body.pm-theme-pm-warm .pm-toc li a.active {
  background: rgba(232,89,12,.15);
  border-left-color: #e8590c;
}
body.pm-theme-pm-warm .pm-funnel .stage,
body.pm-theme-pm-warm .roadmap-col,
body.pm-theme-pm-warm .vc-card,
body.pm-theme-pm-warm .cycle-stat {
  border-left: 3px solid rgba(232,89,12,.4);
}
body.pm-theme-pm-warm a { color: #9b3d05; }

/* Theme PM Focus : haute densité — réduit padding/marges. */
body.pm-theme-pm-focus section { margin-bottom: .7rem; padding-top: .3rem; }
body.pm-theme-pm-focus h2 { font-size: 1.05rem; margin: .4rem 0 .3rem; }
body.pm-theme-pm-focus h3 { font-size: .92rem; margin: .4rem 0 .25rem; }
body.pm-theme-pm-focus .pm-section, body.pm-theme-pm-focus .roadmap-col,
body.pm-theme-pm-focus .deps-card, body.pm-theme-pm-focus .persona-card,
body.pm-theme-pm-focus .owner-card, body.pm-theme-pm-focus .sponsor-card,
body.pm-theme-pm-focus .refine-card, body.pm-theme-pm-focus .conf-card,
body.pm-theme-pm-focus .ab-card, body.pm-theme-pm-focus .risk-card,
body.pm-theme-pm-focus .hyp-card, body.pm-theme-pm-focus .fresh-card {
  padding: .35rem .55rem; margin: .25rem 0;
}
body.pm-theme-pm-focus table { font-size: .78rem; }
body.pm-theme-pm-focus table td, body.pm-theme-pm-focus table th {
  padding: .2rem .35rem;
}
body.pm-theme-pm-focus pre { font-size: .72rem; max-height: 180px !important; }

.pm-theme-switcher {
  display: inline-flex; align-items: center; gap: .25rem; margin-left: .5rem;
  font-size: .75rem;
}
.pm-theme-switcher select {
  font-size: .75rem; padding: .15rem .35rem;
  border: 1px solid var(--border, #ccc); border-radius: .25rem;
  background: var(--card-bg, #fff); color: inherit;
}
@media print { .pm-theme-switcher { display: none !important; } }
</style>`;

const PM_THEME_SCRIPT = `<script>
(function () {
  var KEY = 'aiad-pm-theme';
  function applyTheme(name) {
    document.body.classList.remove('pm-theme-pm-warm', 'pm-theme-pm-focus');
    if (name && name !== 'default') {
      document.body.classList.add('pm-theme-' + name);
    }
  }
  function init() {
    var sel = document.getElementById('pm-theme-select');
    if (!sel) return;
    var saved = 'default';
    try { saved = localStorage.getItem(KEY) || 'default'; } catch (e) { /* env minimal */ }
    sel.value = saved;
    applyTheme(saved);
    sel.addEventListener('change', function () {
      var v = sel.value;
      applyTheme(v);
      try { localStorage.setItem(KEY, v); } catch (e) { /* ok */ }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

export function blocPmThemeSwitcher() {
  return `${PM_THEME_CSS}
<div class="pm-theme-switcher" role="region" aria-label="Sélecteur de thème PM">
  <label for="pm-theme-select" class="muted">Thème :</label>
  <select id="pm-theme-select" aria-label="Choix du thème PM">
    <option value="default">Défaut (PE)</option>
    <option value="pm-warm">PM Warm (chaud)</option>
    <option value="pm-focus">PM Focus (dense)</option>
  </select>
</div>
${PM_THEME_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  blocPmThemeSwitcher as pmThemeSwitcher,
};
