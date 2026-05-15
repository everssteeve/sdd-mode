// AIAD SDD Mode — Dashboard : sommaire latéral PM (#441).
//
// Avec 20+ sections sur `pm.html`, le PM doit pouvoir scanner / jumper
// rapidement. Ce module rend un sommaire **sticky** qui :
//   1. Auto-tag chaque `<h2>` avec un `id` slugifié au DOMContentLoaded.
//   2. Liste tous les `<h2>` dans une `<nav class="pm-toc">` à gauche.
//   3. Highlight de l'entrée active via IntersectionObserver.
//
// Tout est généré côté serveur HTML statique — pas besoin de connaître à
// l'avance la liste des sections (le JS la dérive du DOM). C'est cohérent
// avec le pattern existant de `autoTagIds()` côté client (#182).
//
// Aucun effet de bord serveur. Pure transformation.
//
// Documentation : https://aiad.ovh

const PM_TOC_CSS = `
<style>
.pm-toc-wrapper { position: relative; }
@media (min-width: 1280px) {
  .pm-toc-wrapper { display: grid; grid-template-columns: 220px 1fr; gap: 1.5rem; align-items: start; }
}
.pm-toc {
  position: sticky; top: 1rem; padding: .6rem .5rem; max-height: calc(100vh - 2rem);
  overflow: auto; border: 1px solid var(--border, #ddd); border-radius: .4rem;
  background: var(--card-bg, #fff); font-size: .82rem;
}
.pm-toc-title { font-size:.7rem; text-transform:uppercase; letter-spacing:.05em; color:var(--muted, #777); margin:0 0 .4rem; }
.pm-toc ol { list-style:none; margin:0; padding:0; counter-reset: pm-toc; }
.pm-toc li { counter-increment: pm-toc; margin:.1rem 0; }
.pm-toc li a {
  display: block; padding:.2rem .4rem; border-radius:.2rem; color: inherit;
  text-decoration: none; line-height: 1.3; border-left: 2px solid transparent;
}
.pm-toc li a::before { content: counter(pm-toc) "."; color: var(--muted, #777); margin-right:.3rem; font-size:.7rem; }
.pm-toc li a:hover { background: rgba(76, 110, 245, .08); }
.pm-toc li a.active { background: rgba(76, 110, 245, .12); border-left-color: var(--accent, #4c6ef5); font-weight: 600; }
@media (max-width: 1279px) {
  .pm-toc { display: none; }
}
</style>`;

const PM_TOC_SCRIPT = `<script>
(function () {
  function slug(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  }
  function init() {
    var main = document.querySelector('main');
    var toc = document.getElementById('pm-toc');
    if (!main || !toc) return;
    var headers = main.querySelectorAll('section > h2');
    if (headers.length === 0) return;
    var ol = document.createElement('ol');
    var dejaVu = {};
    var entries = [];
    headers.forEach(function (h) {
      var titre = (h.firstChild && h.firstChild.nodeType === 3) ? h.firstChild.nodeValue.trim() : h.textContent.trim();
      var s = slug(titre);
      if (!s) return;
      // Anti-collision sur titre dupliqué.
      while (dejaVu[s]) s = s + '-x';
      dejaVu[s] = true;
      h.id = s;
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + s;
      a.textContent = titre;
      li.appendChild(a);
      ol.appendChild(li);
      entries.push({ section: h.parentElement, link: a });
    });
    toc.appendChild(ol);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (e) {
          var entry = entries.find(function (x) { return x.section === e.target; });
          if (!entry) return;
          if (e.isIntersecting && e.intersectionRatio > 0.1) {
            entries.forEach(function (x) { x.link.classList.remove('active'); });
            entry.link.classList.add('active');
          }
        });
      }, { threshold: [0, 0.2, 0.5], rootMargin: '-10% 0px -70% 0px' });
      entries.forEach(function (e) { io.observe(e.section); });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>`;

// Wrappe le contenu de `pagePm` dans une grille TOC + main. Le `<nav>`
// est vide à la livraison, le JS le peuple côté client en parcourant
// les `<h2>` du DOM.
export function wrapWithToc(corpsHtml) {
  return `${PM_TOC_CSS}
<div class="pm-toc-wrapper">
  <nav class="pm-toc" id="pm-toc" aria-label="Sommaire des sections PM">
    <p class="pm-toc-title">Sommaire</p>
  </nav>
  <div class="pm-toc-content">
    ${corpsHtml}
  </div>
</div>
${PM_TOC_SCRIPT}`;
}

// Alias EN canoniques (#42)
export {
  wrapWithToc as wrapPmToc,
};
