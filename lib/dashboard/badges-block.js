// AIAD SDD Mode — Dashboard : bloc "Badges README" (#232).
//
// Affiche les 3 badges SVG générés par #231 sur dashboard/index.html
// + snippet markdown copy-paste à coller dans le README.md du projet.
// Extrait dans son propre module pour préserver le budget LOC de render.js.

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const FICHIERS = [
  { type: 'sante',      file: 'badge.svg',            alt: 'Santé AIAD SDD' },
  { type: 'maturite',   file: 'badge-maturite.svg',   alt: 'Maturité AIAD' },
  { type: 'violations', file: 'badge-violations.svg', alt: 'Violations Tier 1' },
];

// Construit le snippet Markdown à copier dans README.md.
// `baseUrl` = préfixe relatif (défaut "dashboard/") ; les utilisateurs qui
// publient le dashboard sur Pages peuvent override via opts.baseUrl.
export function snippetMarkdown(baseUrl = 'dashboard/') {
  return FICHIERS.map(({ alt, file }) => `![${alt}](${baseUrl}${file})`).join('\n');
}

// Construit le bloc HTML pour pageOverview.
// Affiche les 3 <img> + un bloc <pre><code> avec snippet + bouton copy.
export function blocBadgesReadme(donnees, opts = {}) {
  // Si aucun badge généré (cas extrême), on rend rien.
  if (!donnees || !donnees.santeGlobale) return '';
  const baseUrl = opts.baseUrl || '';
  const snippet = snippetMarkdown(opts.baseUrl ?? 'dashboard/');
  return `<section class="badges-readme" aria-labelledby="badges-readme-h">
  <h2 id="badges-readme-h">Badges README</h2>
  <p class="muted">Copier-coller dans le <code>README.md</code> du projet (les SVG se rafraîchissent à chaque <code>aiad-sdd dashboard</code>).</p>
  <div class="badges-row" style="display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin:.75rem 0">
    ${FICHIERS.map(({ file, alt }) => `<img src="${escape(baseUrl + file)}" alt="${escape(alt)}" loading="lazy"/>`).join('\n    ')}
  </div>
  <details>
    <summary class="muted">Voir le snippet Markdown</summary>
    <pre style="background:var(--bg-mute,#f4f4f4);padding:.5rem;border-radius:4px;overflow:auto;font-size:.85em"><code>${escape(snippet)}</code></pre>
  </details>
</section>`;
}

export { blocBadgesReadme as readmeBadgesBlock, snippetMarkdown as markdownSnippet };
