// AIAD SDD Mode — Dashboard : Content-Security-Policy (#244).
//
// Calcule le hash SHA-256 du script inline (theme detector) et construit
// le header CSP via <meta http-equiv>. Bloque tout autre script + ressources
// externes → durcit contre XSS pour publication publique (GitHub Pages,
// Netlify, etc.).
//
// Note importante sur les `style-src`/`img-src` : le dashboard utilise des
// inline styles dynamiques (`style="width:${score}%"` pour barre maturité,
// `style="display:flex"` pour bloc badges) et des `data:` URLs (favicon).
// On autorise donc `'unsafe-inline'` sur style et `data:` sur img — c'est
// pragmatique : la cible CSP ici est le **script** (vrai vecteur XSS),
// pas les styles (data exfiltration limitée).

import { createHash } from 'node:crypto';

// Le script inline. Source de vérité unique — render.js le réutilise et csp
// calcule le hash dessus pour rester cohérent.
export const THEME_DETECT_SCRIPT = `
  // Applique le thème enregistré avant le rendu pour éviter le flash.
  (function () {
    try {
      var t = localStorage.getItem('aiad-dashboard-theme');
      if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
    } catch (e) {}
  })();
`;

// Calcule le hash SHA-256 base64 d'un contenu inline pour CSP `'sha256-…'`.
export function hashSha256Base64(contenu) {
  return createHash('sha256').update(contenu, 'utf-8').digest('base64');
}

// Construit la directive CSP complète. `extraHashes` permet d'ajouter
// d'autres hashes si plusieurs scripts inline (extensibilité future).
export function constructCsp(opts = {}) {
  // (#246) Plusieurs pages (onboarding, kanban, graph) ont des scripts
  // inline interactifs. Graph charge aussi D3 depuis CDN avec SRI.
  // Règle CSP : `'unsafe-inline'` est IGNORÉ si un hash ou nonce est
  // présent dans script-src — donc lister juste 'unsafe-inline' (sans
  // hash) pour que tous les inline scripts passent. Durcissement futur
  // possible via extraction des inline scripts + hash centralisés
  // (P3 — voir #247).
  // Les `extraHashes` restent supportés pour usage avancé.
  const extraHashesPart = (opts.extraHashes || []).length > 0
    ? ' ' + opts.extraHashes.map((h) => `'sha256-${h}'`).join(' ')
    : '';
  return [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'${extraHashesPart} https://cdn.jsdelivr.net`,
    // Inline styles nécessaires (barre maturité, etc.) — voir note module
    `style-src 'self' 'unsafe-inline'`,
    // SVG inline + data: pour favicon (#237)
    `img-src 'self' data:`,
    // Connexion XHR/fetch limitée au même domaine
    `connect-src 'self'`,
    // Manifest PWA (#241)
    `manifest-src 'self'`,
    // Police générique form-action / base-uri
    `base-uri 'self'`,
    `form-action 'self'`,
    // Note: `frame-ancestors` ne fonctionne PAS via <meta> (W3C ignore).
    // Pour la protection clickjacking, configurer X-Frame-Options ou
    // Content-Security-Policy au niveau HTTP header sur le CDN.
  ].join('; ');
}

// Render <meta http-equiv="Content-Security-Policy" content="…">.
export function metaCsp(opts = {}) {
  return `<meta http-equiv="Content-Security-Policy" content="${constructCsp(opts)}"/>`;
}

export {
  hashSha256Base64 as sha256Base64,
  constructCsp as buildCsp,
  metaCsp as buildMetaCsp,
};
