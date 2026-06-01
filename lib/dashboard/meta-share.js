// AIAD SDD Mode — Dashboard : meta tags share (#238).
//
// Extrait de render.js pour préserver le budget LOC. Produit :
//   - <meta name="description"> SEO
//   - Open Graph (og:title/description/type/image) → preview Slack/Teams/Discord
//   - Twitter Cards (summary)
//   - theme-color pour Chrome mobile + Safari iOS

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Construit la description page-specific + signal projet (santé/maturité).
// Tronquée à 200 chars pour rester sous la limite OG/Twitter cards.
export function metaDescription(donnees, titre, sous) {
  const projet = donnees.projet || {};
  const m = donnees.maturite;
  const s = donnees.santeGlobale;
  const signal = [
    s?.score != null ? `Santé ${s.score}/100` : null,
    m?.score != null && m?.total != null ? `Maturité ${m.score}/${m.total}` : null,
  ].filter(Boolean).join(' · ');
  const base = `${titre}${sous ? ' — ' + sous : ''} · ${projet.nom || 'projet'}`;
  const full = signal ? `${base} · ${signal}` : base;
  return full.length > 200 ? full.slice(0, 197) + '…' : full;
}

// Rendu HTML des balises <meta> pour le <head>. Retourne du markup brut.
// opts.pageFile  : nom du fichier de la page courante (pour og:url)
// opts.themeColor: surcharge la couleur (défaut #2563eb)
// (#240) donnees.publicUrl est l'URL absolue publiée (CLI --public-url ou
// env AIAD_PUBLIC_URL). Si présente, og:url et og:image deviennent
// absolues — requis pour que les crawlers Slack/Teams puissent fetch le
// thumbnail badge.svg. Sinon URLs relatives (preview locale).
export function metaShareTags(donnees, titre, sous, opts = {}) {
  const projet = donnees.projet || {};
  const desc = metaDescription(donnees, titre, sous);
  const pageTitle = `${titre} — ${projet.nom || 'projet'}`;
  const themeColor = opts.themeColor || '#2563eb';
  const pageFile = opts.pageFile || 'index.html';
  const base = (donnees.publicUrl || '').replace(/\/+$/, '');
  const ogUrl = base ? `${base}/${pageFile}` : pageFile;
  const ogImage = base ? `${base}/badge.svg` : 'badge.svg';
  return `<meta name="description" content="${escape(desc)}"/>
<meta name="generator" content="AIAD SDD Mode"/>
<meta name="theme-color" content="${escape(themeColor)}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${escape(pageTitle)}"/>
<meta property="og:description" content="${escape(desc)}"/>
<meta property="og:url" content="${escape(ogUrl)}"/>
<meta property="og:image" content="${escape(ogImage)}"/>
<meta name="twitter:card" content="summary"/>
<meta name="twitter:title" content="${escape(pageTitle)}"/>
<meta name="twitter:description" content="${escape(desc)}"/>`;
}

export { metaDescription as buildMetaDescription, metaShareTags as buildMetaShareTags };
