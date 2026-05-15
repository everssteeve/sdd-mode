// AIAD SDD Mode — Dashboard : permalinks par section (#457).
//
// Pour chaque <h2> sur pm.html, ajoute un bouton 🔗 qui copie l'URL
// complète avec ancre (#slug) dans le presse-papier — partage Slack/
// email facile : « regarde la section "Échéances Intent" → pm.html#echeances ».
//
// Le TOC (#441) auto-tag déjà les <h2> avec un id slugifié au
// DOMContentLoaded. Ce module ajoute juste le bouton + le binding click
// → navigator.clipboard. Pure couche présentation client.
//
// Aucun effet de bord. Pure transformation HTML+JS.
//
// Documentation : https://aiad.ovh

const PERMALINKS_CSS = `<style>
.pm-permalink {
  margin-left: .35rem; padding: 0 .25rem;
  background: transparent; border: 0; color: inherit;
  opacity: .25; cursor: pointer; font-size: .7em;
  transition: opacity .15s, background .15s;
  vertical-align: middle;
  border-radius: .2rem;
}
.pm-permalink:hover { opacity: 1; background: rgba(127,127,127,.1); }
.pm-permalink.copied { opacity: 1; color: #2b8a3e; }
.pm-permalink-toast {
  position: fixed; bottom: 1.5rem; right: 1.5rem;
  background: #0c0c0c; color: #fff;
  padding: .55rem .8rem; border-radius: .3rem;
  font-size: .85rem; box-shadow: 0 2px 8px rgba(0,0,0,.25);
  z-index: 100; opacity: 0;
  transition: opacity .2s, transform .2s;
  pointer-events: none;
  transform: translateY(8px);
}
.pm-permalink-toast.show { opacity: 1; transform: translateY(0); }
@media print {
  .pm-permalink, .pm-permalink-toast { display: none !important; }
}
</style>`;

const PERMALINKS_SCRIPT = `<script>
(function () {
  function init() {
    var toast = document.getElementById('pm-permalink-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pm-permalink-toast';
      toast.className = 'pm-permalink-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    function montrerToast(message) {
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(function () { toast.classList.remove('show'); }, 1500);
    }
    // Le TOC (#441) tagge les h2 avec un id. On attend qu'il ait fini.
    // Délai 100 ms suffit (le script TOC s'exécute au même DOMContentLoaded).
    setTimeout(function () {
      document.querySelectorAll('main section > h2[id]').forEach(function (h) {
        if (h.querySelector('.pm-permalink')) return; // déjà ajouté
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pm-permalink';
        btn.title = 'Copier le lien vers cette section';
        btn.setAttribute('aria-label', 'Copier le lien vers la section');
        btn.textContent = '🔗';
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var url = window.location.origin + window.location.pathname + '#' + h.id;
          var copied = function () {
            btn.classList.add('copied');
            btn.textContent = '✓';
            montrerToast('Lien copié : ' + h.id);
            setTimeout(function () {
              btn.classList.remove('copied');
              btn.textContent = '🔗';
            }, 1200);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(copied, function () {
              // fallback
              var ta = document.createElement('textarea');
              ta.value = url;
              document.body.appendChild(ta);
              ta.select();
              try { document.execCommand('copy'); copied(); }
              catch (err) { montrerToast('Copie impossible — URL : ' + url); }
              document.body.removeChild(ta);
            });
          } else {
            // Très vieux navigateur
            var ta2 = document.createElement('textarea');
            ta2.value = url;
            document.body.appendChild(ta2);
            ta2.select();
            try { document.execCommand('copy'); copied(); }
            catch (err) { montrerToast('Copie impossible — URL : ' + url); }
            document.body.removeChild(ta2);
          }
        });
        h.appendChild(btn);
      });
    }, 100);
    // Auto-scroll vers l'ancre si présente au chargement (UX permalink reçu).
    if (window.location.hash) {
      setTimeout(function () {
        var el = document.getElementById(window.location.hash.slice(1));
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

export function blocSectionPermalinks() {
  return `${PERMALINKS_CSS}${PERMALINKS_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  blocSectionPermalinks as sectionPermalinks,
};
