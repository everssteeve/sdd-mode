// AIAD SDD Mode — Dashboard : sitemap.xml + robots.txt (#239).
//
// Génère un sitemap conforme au protocole sitemaps.org (XML) et un
// robots.txt allow-all qui pointe sur le sitemap. Utile pour publication
// GitHub Pages / Netlify / serveur statique : les moteurs de recherche
// découvrent les pages, et les crawlers Slack/Teams ne devinent pas un
// fichier privé.

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[c]));
}

// Construit le sitemap XML. `baseUrl` peut être :
//   - une URL absolue (préférée pour Pages : "https://exemple.com/dash")
//   - chaîne vide → URLs relatives (utile en preview locale, accepté par
//     certains crawlers même si non strict)
// `pages` = [{ file: 'index.html', titre: '…' }, …]
// `lastmod` = ISO date string
export function genererSitemap(pages, baseUrl = '', lastmod = null) {
  const base = baseUrl.replace(/\/+$/, '');
  const date = lastmod ? new Date(lastmod).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const urls = pages.map((p, i) => `  <url>
    <loc>${escape(base + '/' + p.file)}</loc>
    <lastmod>${escape(date)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${i === 0 ? '1.0' : '0.7'}</priority>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

// Génère robots.txt allow-all qui référence le sitemap.
// `baseUrl` même contrat que genererSitemap.
export function genererRobots(baseUrl = '') {
  const base = baseUrl.replace(/\/+$/, '');
  const sitemapUrl = base ? `${base}/sitemap.xml` : 'sitemap.xml';
  return `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;
}

export {
  genererSitemap as generateSitemap,
  genererRobots as generateRobots,
};
