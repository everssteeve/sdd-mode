// @spec SPEC-016-1-architecture-4-couches
// @intent INTENT-016
//
// Orchestrateur léger : PAGES + layout() + re-exports.
// Les renderers de pages sont dans views/, les helpers UI dans ui/.

import { metaShareTags } from './meta-share.js';
import { metaCsp, THEME_DETECT_SCRIPT } from './csp.js';
import { VERSION_AIAD } from '../meta.js';
import { ONGLETS, PAGES_NAV, ongletDe, pageActive, ongletDuLien } from './navigation.js';
import { listerAlertes } from './views/overview.js';

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
export { pageAujourdhui } from './views/today.js';
export { pageInbox, calculerInboxTriage } from './views/inbox.js';

// ─── Pages ───────────────────────────────────────────────────────────────────
// Dérivées de la navigation par responsabilité (SPEC-037-1) : une vue
// d'ensemble + un onglet par rôle AIAD. Chaque page porte son `onglet`.

export const PAGES = PAGES_NAV;

// ─── Layout commun ───────────────────────────────────────────────────────────

/**
 * Coquille de page : barre d'onglets par responsabilité, sous-navigation de
 * l'onglet courant, en-tête, contenu, pied.
 *
 * @intent INTENT-037
 * @spec SPEC-037-1-dashboard-par-role
 * @verified-by test/dashboard-navigation.test.js
 * @governance AIAD-RGAA
 */
export function layout({ slug, titre, sous, donnees, body }) {
  const projet = donnees.projet;
  const onglet = ongletDe(slug);
  const actif = pageActive(slug);
  const compteurs = compterAlertesParOnglet(donnees);
  const initiales = String(projet.nom || 'AI').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ')
    .slice(0, 2).map((m) => m[0] || '').join('').toUpperCase() || 'AI';

  const tabs = ONGLETS.map((o) => {
    const estActif = o.id === onglet.id;
    const n = compteurs[o.id] || { bad: 0, warn: 0 };
    const total = n.bad + n.warn;
    const pastille = total > 0
      ? `<span class="tab-count${n.bad === 0 ? ' warn' : ''}" title="${total} signal(s) à traiter">${total}</span>`
      : '';
    return `<li><a href="${o.pages[0].file}" class="tab${estActif ? ' active' : ''}" data-onglet="${o.id}"${estActif ? ' aria-current="true"' : ''} data-court="${escape(o.court)}"><span class="tab-label">${escape(o.titre)}</span>${pastille}</a></li>`;
  }).join('');

  const sousNav = onglet.pages.map((p) => `<li><a href="${p.file}" class="${p.slug === actif ? 'active' : ''}"${p.slug === actif ? ' aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${p.icone}</span>${escape(p.titre)}</a></li>`).join('');

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
<body data-onglet="${onglet.id}">
<a class="skip-link" href="#contenu">Aller au contenu</a>
<header class="appbar">
  <a class="brand" href="index.html" aria-label="${escape(projet.nom || 'Projet')} — vue d'ensemble">
    <span class="brand-mark" aria-hidden="true">${escape(initiales)}</span>
    <span class="brand-text"><span class="brand-title">${escape(projet.nom)}</span><span class="brand-sub">SDD Mode${projet.version ? ` · <span class="brand-version">v${escape(projet.version)}</span>` : ''}</span></span>
  </a>
  <nav class="tabs" aria-label="Responsabilités">
    <ul>${tabs}</ul>
  </nav>
  <div class="appbar-tools">
    ${freshnessBadge(projet.genere)}
    <button type="button" class="toggle-theme" id="toggleTheme" aria-label="Basculer thème clair / sombre">
      <span class="icon icon-dark" aria-hidden="true">☾</span><span class="icon icon-light" aria-hidden="true">☀</span>
    </button>
  </div>
</header>
<nav class="subnav" aria-label="Pages — ${escape(onglet.titre)}">
  <ul>${sousNav}</ul>
  ${onglet.agent ? `<span class="subnav-agent">Assistant <code>${escape(onglet.agent)}</code></span>` : ''}
</nav>
<main id="contenu">
  <header class="page-header">
    <div>
      <div class="eyebrow">${escape(onglet.titre)}</div>
      <h1>${escape(titre)}</h1>
      ${sous ? `<div class="subtitle">${sous}</div>` : ''}
    </div>
  </header>
  ${body}
</main>
<footer class="app-footer">
  <span>Généré ${escape(new Date(projet.genere).toLocaleString('fr-FR'))}</span>
  <span>Framework AIAD v${escape(VERSION_AIAD)} · <a href="https://aiad.ovh" target="_blank" rel="noopener">aiad.ovh</a></span>
</footer>
<script src="assets/app.js"></script>
</body>
</html>
`;
}

/**
 * Nombre d'alertes par onglet (`{ [ongletId]: { bad, warn } }`), d'après la
 * page vers laquelle chaque alerte renvoie. Tolérant : un jeu de données
 * partiel (tests, page 404) donne des compteurs vides.
 */
export function compterAlertesParOnglet(donnees) {
  const out = {};
  let alertes = [];
  try { alertes = listerAlertes(donnees); } catch { return out; }
  for (const a of alertes) {
    const id = ongletDuLien(a.cible);
    out[id] = out[id] || { bad: 0, warn: 0 };
    if (a.gravite === 'bad') out[id].bad++;
    else out[id].warn++;
  }
  return out;
}

// ─── Génération ──────────────────────────────────────────────────────────────
