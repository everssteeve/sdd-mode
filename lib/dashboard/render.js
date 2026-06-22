// @spec SPEC-016-1-architecture-4-couches
// @intent INTENT-016
//
// Orchestrateur léger : PAGES + layout() + re-exports.
// Les renderers de pages sont dans views/, les helpers UI dans ui/.

import { metaShareTags } from './meta-share.js';
import { metaCsp, THEME_DETECT_SCRIPT } from './csp.js';
import { VERSION_AIAD } from '../meta.js';

// ─── UI modules (SPEC-016-1 — Phase 1) ──────────────────────────────────────
import { escape, setSourceBase, lienSource, hrefSource, lienSourceLigne } from './ui/helpers.js';
export { escape, setSourceBase, lienSource, hrefSource, lienSourceLigne };
import { badge, statutBadge, sqsBadge, freshnessBadge } from './ui/badges.js';
export { badge, statutBadge, sqsBadge, freshnessBadge };
import { sparkline, distributionBar } from './ui/sparklines.js';
export { sparkline, distributionBar };

// ─── KPI cards ───────────────────────────────────────────────────────────────
import { kpiSbom, kpiSovereignty, kpiHookStats, kpiViolations } from './kpi-cards.js';
export { kpiSbom, kpiSovereignty, kpiHookStats, kpiViolations };

// ─── QA block ────────────────────────────────────────────────────────────────
import { blocQueueQa } from './qa.js';
export { blocQueueQa };

// ─── Views (SPEC-016-1 — Phase 3) ────────────────────────────────────────────
export { listerAlertes, pageOverview } from './views/overview.js';
export { pageIntents } from './views/intents.js';
export { pageSpecs } from './views/specs.js';
export { pageTraceability } from './views/traceability.js';
export { pageMetrics } from './views/metrics.js';
export { pageDrifts } from './views/drifts.js';
export { pageChangelog } from './views/changelog.js';
export { pageGovernance } from './governance.js';

// ─── Pages constant ──────────────────────────────────────────────────────────

export const PAGES = [
  { slug: 'index', titre: 'Vue d\'ensemble', icone: '◐', file: 'index.html' },
  { slug: 'pm', titre: 'PM Cockpit', icone: '◑', file: 'pm.html' },
  { slug: 'intents', titre: 'Intents', icone: '◇', file: 'intents.html' },
  { slug: 'specs', titre: 'SPECs', icone: '◆', file: 'specs.html' },
  { slug: 'traceability', titre: 'Traçabilité', icone: '⇄', file: 'traceability.html' },
  { slug: 'graph', titre: 'Graphe', icone: '⊛', file: 'graph.html' },
  { slug: 'metrics', titre: 'Métriques', icone: '⊞', file: 'metrics.html' },
  { slug: 'qa', titre: 'QA', icone: '✓', file: 'qa.html' },
  { slug: 'adrs', titre: 'ADRs', icone: '⎈', file: 'adrs.html' },
  { slug: 'legal', titre: 'Legal', icone: '§', file: 'legal.html' },
  { slug: 'governance', titre: 'Gouvernance', icone: '⚖', file: 'governance.html' },
  { slug: 'drifts', titre: 'Drifts & Facts', icone: '⚠', file: 'drifts.html' },
  { slug: 'changelog', titre: 'Changelog', icone: '⏱', file: 'changelog.html' },
  { slug: 'onboarding', titre: 'Onboarding', icone: '?', file: 'onboarding.html' },
  { slug: 'kanban', titre: 'Kanban', icone: '▦', file: 'kanban.html' },
  { slug: 'sre', titre: 'SRE / Ops', icone: '⚙', file: 'sre.html' },
  { slug: 'dpo', titre: 'DPO / RGPD', icone: '⊙', file: 'dpo.html' }];

// ─── Layout commun ───────────────────────────────────────────────────────────

export function layout({ slug, titre, sous, donnees, body }) {
  const projet = donnees.projet;
  const itemsNav = PAGES.map((p) => `
    <li><a href="${p.file}" class="${p.slug === slug ? 'active' : ''}">
      <span class="nav-icon">${p.icone}</span>${escape(p.titre)}
    </a></li>`).join('');
  const pageTitle = `${titre} — ${projet.nom || 'projet'}`;
  const pageFile = PAGES.find((p) => p.slug === slug)?.file || 'index.html';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="aiad-generated-at" content="${escape(projet.genere || '')}"/><meta name="aiad-version" content="${escape(VERSION_AIAD)}"/>
${metaCsp()}
<title>${escape(pageTitle)}</title>
${metaShareTags(donnees, titre, sous, { pageFile })}
<link rel="icon" href="favicon.svg" type="image/svg+xml"/>
<link rel="manifest" href="manifest.webmanifest"/>
<link rel="stylesheet" href="assets/style.css"/>
<script>${THEME_DETECT_SCRIPT}</script>
</head>
<body>
<nav class="side">
  <div class="brand">
    <div class="brand-title">${escape(projet.nom)}</div>
    <div class="brand-sub">SDD Mode · Dashboard</div>
    ${projet.version ? `<div class="brand-version">v${escape(projet.version)}</div>` : ''}
  </div>
  <ul>${itemsNav}</ul>
  <div class="footer">Généré ${escape(new Date(projet.genere).toLocaleString('fr-FR'))}<br/>Framework AIAD v${escape(VERSION_AIAD)} · <a href="https://aiad.ovh" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">aiad.ovh</a></div>
</nav>
<main>
  <header class="page-header">
    <div>
      <h1>${escape(titre)}</h1>
      ${sous ? `<div class="subtitle">${sous}</div>` : ''}
    </div>
    <div class="header-right">
      ${freshnessBadge(projet.genere)}
      <div class="meta">${escape(projet.nom)}${projet.version ? ' · v' + escape(projet.version) : ''}</div>
      <button type="button" class="toggle-theme" id="toggleTheme" aria-label="Basculer thème clair / sombre" title="Basculer thème clair / sombre">
        <span class="icon icon-dark">☾</span><span class="icon icon-light">☀</span>
      </button>
    </div>
  </header>
  ${body}
</main>
<script src="assets/app.js"></script>
</body>
</html>
`;
}

// ─── Génération ──────────────────────────────────────────────────────────────
