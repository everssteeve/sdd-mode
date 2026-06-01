// AIAD SDD Mode — Dashboard HTTP local (--serve).
//
// Sert le dossier `dashboard/` (ou un autre) sur 127.0.0.1:<port>. Aucune
// dépendance externe — utilise le module http natif. Bound à localhost
// uniquement (pas d'exposition réseau). Pratique pour :
//   - Visualiser le dashboard depuis un navigateur
//   - Demander à un agent (MCP Playwright) d'inspecter / capturer la page
//   - Itérer rapidement sur les SPECs sans publier le dashboard

import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve, relative, extname } from 'node:path';
import { C } from '../term.js';

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  // (#257) Types ajoutés pour la chaîne publication #237-#241 :
  // - .webmanifest : PWA install (#241). Spec W3C : application/manifest+json
  // - .xml : sitemap.xml (#239). Google/Bing s'attendent à text/xml ou
  //   application/xml — text/xml plus permissif côté caches.
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'text/xml; charset=utf-8',
};

export function serveDashboard(rootDir, opts = {}) {
  // (#282) Préserve port=0 explicite (ephemeral) via nullish check au lieu
  // de truthy fallback qui le confondait avec "absent" → fallback 8765.
  const port = opts.port != null && opts.port !== '' ? Number(opts.port) : 8765;
  const racine = resolve(rootDir);
  const server = createServer((req, res) => {
    let chemin = decodeURIComponent((req.url || '/').split('?')[0]);
    if (chemin === '/') chemin = '/index.html';
    const cible = join(racine, chemin);
    // Garde anti-traversal : join() normalise déjà `..` mais on revérifie.
    if (!cible.startsWith(racine)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }
    let st;
    try { st = statSync(cible); } catch { st = null; }
    if (!st || !st.isFile()) {
      // (#249) Fallback sur 404.html stylisée si disponible. Sinon plain
      // text — back-compat avec les dashboards générés avant #249.
      const page404 = join(racine, '404.html');
      try {
        const stat404 = statSync(page404);
        if (stat404.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(readFileSync(page404));
          return;
        }
      } catch { /* 404.html absent */ }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Not found: ${chemin}`);
      return;
    }
    const mime = MIME[extname(cible).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(readFileSync(cible));
  });

  return new Promise((resolveP, rejectP) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        const hint = port === 0 ? 'Aucun port éphémère disponible.' : `Réessaie avec --port ${port + 1} ou --port 0 (éphémère).`;
        rejectP(new Error(`Port ${port} déjà utilisé. ${hint}`));
      } else rejectP(err);
    });
    server.listen(port, '127.0.0.1', () => {
      // (#282) Si port=0 (éphémère), lit le port réellement assigné par
      // l'OS via server.address(). Utile pour : CI parallèles (évite
      // collisions), tests d'intégration (mute hardcode), preview headless.
      const actualPort = server.address()?.port || port;
      const url = `http://127.0.0.1:${actualPort}/`;
      if (!opts.quiet) {
        console.log(`\n${C.cyan}${C.gras}  Dashboard servi en local${C.reset}`);
        console.log(`    URL    : ${C.cyan}${url}${C.reset}`);
        console.log(`    Source : ${relative(process.cwd(), racine)}`);
        console.log(`    ${C.gris}Ctrl+C pour arrêter le serveur${C.reset}\n`);
      }
      resolveP({ server, url, port: actualPort });
    });
  });
}
