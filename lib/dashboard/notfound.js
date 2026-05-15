// AIAD SDD Mode — Dashboard : page 404 (#249).
//
// Page d'erreur stylisée qui réutilise le layout du dashboard. Servie :
//   - par GitHub Pages automatiquement quand /404.html existe à la racine
//   - par le serveur local --serve sur path inexistant (fallback)
// Garantit une expérience cohérente : nav latérale + branding + lien retour
// au lieu d'un plain-text "Not found".

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Le corps de la page 404. Le layout est appliqué par lib/dashboard.js
// comme pour les autres pages.
export function pageNotFound(donnees) {
  const projet = donnees?.projet?.nom || 'projet';
  return `
<section style="text-align:center;padding:3rem 1rem">
  <div style="font-size:4rem;line-height:1;color:var(--accent);font-weight:700;margin-bottom:.5rem">404</div>
  <h2 style="margin:.5rem 0 1rem">Page introuvable</h2>
  <p class="muted" style="max-width:480px;margin:0 auto 2rem">
    Cette page n'existe pas dans le dashboard <strong>${escape(projet)}</strong>.
    Elle a peut-être été renommée, ou le lien que vous avez suivi est obsolète.
  </p>
  <p>
    <a href="index.html" class="btn btn-primary" style="display:inline-block;padding:.6rem 1.2rem;background:var(--accent);color:#fff;text-decoration:none;border-radius:4px;font-weight:600">
      Retour à la vue d'ensemble
    </a>
  </p>
  <p class="muted" style="margin-top:2rem;font-size:.85rem">
    Pages disponibles : utilisez la navigation latérale.
  </p>
</section>
`;
}

export { pageNotFound as renderNotFound };
