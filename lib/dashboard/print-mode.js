// AIAD SDD Mode — Dashboard : mode impression / PDF COMEX (#447).
//
// Les rituels COMEX / arbitrages exigent souvent une sortie papier. Ce
// module ajoute (a) un media query CSS `@media print` qui masque le TOC,
// la sticky alert bar, les boutons interactifs et resserre la typo ; (b)
// un bouton "🖨 Imprimer / PDF" qui appelle `window.print()` ; (c) un
// query string `?print=1` qui force le mode print à l'écran (utile pour
// preview avant impression / capture screenshot).
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

// CSS imprimable + override `body.aiad-print` pour le mode `?print=1`.
const PRINT_CSS = `<style>
@media print {
  .pm-toc, .pm-sticky-alerts, .csv-btn, .csv-export, button.toggle-theme,
  .demo-checklist input[type="checkbox"], .pm-cheatsheet { display: none !important; }
  nav.side { display: none !important; }
  main { padding: 0 !important; }
  .pm-toc-wrapper { display: block !important; }
  body { color: #000 !important; background: #fff !important; font-size: 11pt; }
  section { page-break-inside: avoid; margin-bottom: 1rem; break-inside: avoid; }
  h2 { page-break-after: avoid; font-size: 14pt; margin-top: 1.2em; }
  h3 { page-break-after: avoid; font-size: 12pt; }
  .badge { border: 1px solid #888; padding: 0 4px !important; }
  table { font-size: 9pt; }
  pre, .brief-pm-pre, .demo-script, .csv-pre { font-size: 8pt; max-height: none !important; overflow: visible !important; }
  a { color: inherit !important; text-decoration: none !important; }
  .roadmap-col, .persona-card, .deps-card, .risk-card, .hyp-card, .owner-card, .sponsor-card, .bottleneck-card, .fact-card { border: 1px solid #888 !important; box-shadow: none !important; }
  .rice-svg, svg { max-width: 100% !important; }
}
body.aiad-print .pm-toc, body.aiad-print .pm-sticky-alerts, body.aiad-print nav.side { display: none !important; }
body.aiad-print main { padding: 0; }
.pm-print-btn { display:inline-block; padding:.35rem .7rem; background:#0c0c0c; color:#fff; border-radius:.25rem; border:0; cursor:pointer; font-size:.85rem; font-weight:500; margin:.5rem 0; }
.pm-print-btn:hover { filter: brightness(1.2); }
.pm-print-hint { color: var(--muted, #777); font-size:.78rem; margin:.3rem 0; }
@media print {
  .pm-print-btn, .pm-print-hint { display: none !important; }
}
</style>`;

// Script : si `?print=1` dans l'URL, ajoute la classe `aiad-print` sur
// le body et appelle window.print(). Si `?pdf=1`, ajoute juste la classe
// (preview sans dialog). Le bouton "Imprimer / PDF" appelle print().
const PRINT_SCRIPT = `<script>
(function () {
  function init() {
    try {
      var params = new URLSearchParams(window.location.search);
      var print = params.get('print') === '1';
      var pdfPreview = params.get('pdf') === '1';
      if (print || pdfPreview) document.body.classList.add('aiad-print');
      if (print) setTimeout(function () { window.print(); }, 200);
    } catch (e) { /* env minimal */ }
    document.querySelectorAll('button.pm-print-btn[data-print]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        try { window.print(); } catch (e) { /* env minimal */ }
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;

// Section très compacte qui se place près du début de pm.html.
export function blocPrintMode(donnees) {
  const projet = donnees?.projet?.nom || 'projet';
  return `${PRINT_CSS}<section>
    <h2>Imprimer / PDF <span class="count">mode COMEX</span></h2>
    <p class="pm-print-hint">Optimisé pour impression / export PDF (papier A4) : TOC, alertes sticky, boutons et liens couleur sont masqués, polices resserrées, sections insécables sur saut de page. Ouvrir aussi avec <code>?pdf=1</code> pour preview à l'écran sans dialog.</p>
    <button type="button" class="pm-print-btn" data-print="1" title="Ouvre la fenêtre d'impression du navigateur">🖨 Imprimer / Exporter en PDF — ${escape(projet)}</button>
  </section>${PRINT_SCRIPT}`;
}

import { escape } from './render.js';

// Alias EN canoniques (#42)
export {
  blocPrintMode as printModeSection,
};
