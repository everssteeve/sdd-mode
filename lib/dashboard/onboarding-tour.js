// AIAD SDD Mode — Dashboard : onboarding tour PM (#462).
//
// Au premier chargement de pm.html (pas de localStorage flag), affiche
// un overlay 5 étapes qui présente les sections clés du cockpit :
//   1. Échéances Intent — où voir ce qui brûle
//   2. Top priorités — ce qu'on travaille en premier
//   3. Roadmap par trimestre — vue stratégique
//   4. Brief PM exportable — copy/paste Slack
//   5. Wizard de capture — créer un nouvel Intent
//
// Le PM peut Skip à tout moment. État persisté dans localStorage
// (`aiad-pm-tour-seen`). Un bouton "Rejouer le tour" est ajouté en bas
// de pm.html pour revoir le tour à la demande.
//
// Aucun effet de bord serveur. Pure transformation HTML+JS.
//
// Documentation : https://aiad.ovh

const TOUR_CSS = `<style>
.pm-tour-overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, .65);
  z-index: 1000; display: none;
  align-items: center; justify-content: center;
  backdrop-filter: blur(2px);
}
.pm-tour-overlay.visible { display: flex; }
.pm-tour-panel {
  background: var(--card-bg, #fff); color: var(--fg, #0f172a);
  border-radius: .5rem; padding: 1.2rem 1.4rem;
  max-width: 480px; box-shadow: 0 10px 32px rgba(0,0,0,.3);
  border: 1px solid var(--border, #e2e8f0);
}
.pm-tour-step-num { font-size: .75rem; text-transform: uppercase;
  letter-spacing: .05em; color: var(--muted, #777); margin-bottom: .3rem; }
.pm-tour-title { font-size: 1.15rem; font-weight: 600; margin: 0 0 .4rem; }
.pm-tour-desc { font-size: .9rem; line-height: 1.45; margin-bottom: 1rem; }
.pm-tour-actions { display: flex; gap: .5rem; justify-content: space-between; align-items: center; }
.pm-tour-actions .pm-tour-progress { font-size: .75rem; color: var(--muted, #777); }
.pm-tour-btn {
  padding: .4rem .75rem; border-radius: .25rem; border: 0;
  cursor: pointer; font-size: .85rem; font-weight: 500;
}
.pm-tour-btn.primary { background: var(--accent, #4c6ef5); color: var(--accent-fg, #fff); }
.pm-tour-btn.secondary { background: transparent; color: inherit; border: 1px solid var(--border, #ccc); }
.pm-tour-btn:hover { filter: brightness(1.1); }
.pm-tour-replay {
  display: inline-block; padding: .35rem .7rem; margin: .5rem 0;
  background: rgba(76,110,245,.1); color: #3a4cba; border-radius: .25rem;
  border: 0; cursor: pointer; font-size: .82rem;
}
@media print { .pm-tour-overlay, .pm-tour-replay { display: none !important; } }
</style>`;

const ETAPES = [
  {
    titre: 'Bienvenue dans le Cockpit PM',
    desc: 'Cette page consolide 39 vues PM : alertes, priorités, roadmap, OKR, risques, hypothèses, etc. Tu peux taper <kbd>Cmd+K</kbd> à tout moment pour filtrer.',
  },
  {
    titre: 'Échéances Intent',
    desc: 'Section <strong>Échéances Intent</strong> en haut : Intents avec target_date proche (≤ 14 j urgent, ≤ 30 j proche). Le sticky alert bar les remonte aussi.',
  },
  {
    titre: 'Top priorités',
    desc: 'Section <strong>Top priorités à travailler</strong> : pipeline ordonné par P0 < P1 < … (RICE/WSJF en fallback). C\'est par là que tu commences le sprint.',
  },
  {
    titre: 'Roadmap & Capacity',
    desc: 'Vues stratégiques : <strong>Roadmap par trimestre</strong> + <strong>Capacité par trimestre</strong>. Pour planifier T+1 et T+2 sans saturer l\'équipe.',
  },
  {
    titre: 'Brief PM & Wizard',
    desc: 'En bas : <strong>Brief PM exportable</strong> (Markdown copy/paste Slack) et <strong>Capturer un nouvel Intent</strong> (wizard offline 5 sections canoniques). Tout est partageable sans backend.',
  },
];

const TOUR_SCRIPT = `<script>
(function () {
  var ETAPES = ${JSON.stringify(ETAPES)};
  var KEY = 'aiad-pm-tour-seen';
  function lancerTour(force) {
    if (!force) {
      try { if (localStorage.getItem(KEY) === '1') return; } catch (e) { /* env sans storage */ }
    }
    var overlay = document.getElementById('pm-tour-overlay');
    var panel = document.getElementById('pm-tour-panel');
    if (!overlay || !panel) return;
    var idx = 0;
    function render() {
      var e = ETAPES[idx];
      panel.innerHTML = '<div class="pm-tour-step-num">Étape ' + (idx + 1) + ' / ' + ETAPES.length + '</div>' +
        '<h3 class="pm-tour-title">' + e.titre + '</h3>' +
        '<p class="pm-tour-desc">' + e.desc + '</p>' +
        '<div class="pm-tour-actions">' +
          '<button type="button" class="pm-tour-btn secondary" data-action="skip">Passer</button>' +
          '<span class="pm-tour-progress">' + (idx + 1) + '/' + ETAPES.length + '</span>' +
          '<button type="button" class="pm-tour-btn primary" data-action="next">' + (idx === ETAPES.length - 1 ? 'C\\'est parti !' : 'Suivant →') + '</button>' +
        '</div>';
      panel.querySelector('[data-action="next"]').addEventListener('click', function () {
        if (idx < ETAPES.length - 1) { idx++; render(); }
        else fermer();
      });
      panel.querySelector('[data-action="skip"]').addEventListener('click', fermer);
    }
    function fermer() {
      overlay.classList.remove('visible');
      try { localStorage.setItem(KEY, '1'); } catch (e) { /* ok */ }
    }
    overlay.classList.add('visible');
    render();
    // Esc → ferme
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape' && overlay.classList.contains('visible')) {
        fermer();
        document.removeEventListener('keydown', escHandler);
      }
    });
  }
  function init() {
    lancerTour(false);
    var replayBtn = document.getElementById('pm-tour-replay');
    if (replayBtn) replayBtn.addEventListener('click', function () { lancerTour(true); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

export function blocOnboardingTour() {
  return `${TOUR_CSS}
<div class="pm-tour-overlay" id="pm-tour-overlay" role="dialog" aria-modal="true" aria-label="Tour d'introduction PM">
  <div class="pm-tour-panel" id="pm-tour-panel"></div>
</div>
${TOUR_SCRIPT}`;
}

export function blocOnboardingTourReplay() {
  return `<section>
    <h2>Tour d'introduction PM</h2>
    <p class="muted" style="font-size:.85rem">Premier passage ? Le tour PM s'affiche automatiquement. Pour le revoir, click ci-dessous (l'état est mémorisé dans <code>localStorage</code>).</p>
    <button type="button" class="pm-tour-replay" id="pm-tour-replay">🎓 Rejouer le tour PM</button>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  blocOnboardingTour as onboardingTourOverlay,
  blocOnboardingTourReplay as onboardingTourReplaySection,
  ETAPES as TOUR_STEPS,
};
