// AIAD SDD Mode — Dashboard : architecture de navigation par responsabilité.
//
// Six onglets principaux : une vue d'ensemble de l'application en cours de
// développement, puis un onglet par responsabilité AIAD (PM, PE, AE, QA,
// Tech Lead). Chaque page du dashboard appartient à un seul onglet ; les pages
// d'un onglet forment sa sous-navigation.
//
// Source unique : `ONGLETS`. `render.js` en dérive `PAGES` (liste à plat,
// consommée par le sitemap, le serveur et les tests) et le layout.
//
// Sobriété (RGESN) : module statique, zéro I/O.
//
// @intent INTENT-037
// @spec SPEC-037-1-dashboard-par-role
// @verified-by test/dashboard-navigation.test.js
// @governance AIAD-RGAA
//
// Documentation : https://aiad.ovh

/**
 * Onglets principaux : `{ id, titre, court, agent, question, pages }`.
 * `pages[0]` est la page d'accueil de l'onglet.
 */
export const ONGLETS = Object.freeze([
  {
    id: 'global',
    titre: "Vue d'ensemble",
    court: 'Global',
    agent: null,
    question: "Où en est l'application ?",
    pages: [
      { slug: 'index', titre: "Vue d'ensemble", icone: '◐', file: 'index.html' },
      { slug: 'scorecard', titre: 'Métriques AIAD', icone: '◎', file: 'scorecard.html' },
      { slug: 'today', titre: "Aujourd'hui", icone: '⊙', file: 'today.html' },
      { slug: 'inbox', titre: 'Inbox', icone: '📥', file: 'inbox.html' },
      { slug: 'changelog', titre: 'Changelog', icone: '⏱', file: 'changelog.html' },
      { slug: 'onboarding', titre: 'Onboarding', icone: '?', file: 'onboarding.html' },
    ],
  },
  {
    id: 'pm',
    titre: 'Product Manager',
    court: 'PM',
    agent: 'aiad-pm',
    question: 'Construit-on les bonnes choses ?',
    pages: [
      { slug: 'pm', titre: 'PM Cockpit', icone: '◑', file: 'pm.html' },
      { slug: 'intents', titre: 'Intents', icone: '◇', file: 'intents.html' },
    ],
  },
  {
    id: 'pe',
    titre: 'Product Engineer',
    court: 'PE',
    agent: 'aiad-pe',
    question: "L'intention est-elle réalisée sans être trahie ?",
    pages: [
      { slug: 'pe', titre: 'PE Cockpit', icone: '◈', file: 'pe.html' },
      { slug: 'specs', titre: 'SPECs', icone: '◆', file: 'specs.html' },
      { slug: 'kanban', titre: 'Kanban', icone: '▦', file: 'kanban.html' },
      { slug: 'traceability', titre: 'Traçabilité', icone: '⇄', file: 'traceability.html' },
      { slug: 'drifts', titre: 'Drifts & Facts', icone: '⚠', file: 'drifts.html' },
    ],
  },
  {
    id: 'ae',
    titre: 'Agents Engineer',
    court: 'AE',
    agent: 'aiad-ae',
    question: "L'écosystème d'agents est-il optimal ?",
    pages: [
      { slug: 'ae', titre: 'AE Cockpit', icone: '✦', file: 'ae.html' },
      { slug: 'governance', titre: 'Gouvernance', icone: '⚖', file: 'governance.html' },
      { slug: 'eco', titre: 'Éco', icone: '🌱', file: 'eco.html' },
    ],
  },
  {
    id: 'qa',
    titre: 'QA Engineer',
    court: 'QA',
    agent: 'aiad-qa',
    question: 'La qualité est-elle intégrée dès le départ ?',
    pages: [
      { slug: 'qa', titre: 'QA', icone: '✓', file: 'qa.html' },
      { slug: 'legal', titre: 'Legal', icone: '§', file: 'legal.html' },
      { slug: 'dpo', titre: 'DPO / RGPD', icone: '⊙', file: 'dpo.html' },
    ],
  },
  {
    id: 'tl',
    titre: 'Tech Lead',
    court: 'TL',
    agent: 'aiad-tech-lead',
    question: "L'ensemble reste-t-il techniquement cohérent ?",
    pages: [
      { slug: 'tl', titre: 'Tech Lead Cockpit', icone: '⌬', file: 'tl.html' },
      { slug: 'adrs', titre: 'ADRs', icone: '⎈', file: 'adrs.html' },
      { slug: 'metrics', titre: 'Métriques', icone: '⊞', file: 'metrics.html' },
      { slug: 'sre', titre: 'SRE / Ops', icone: '⚙', file: 'sre.html' },
      { slug: 'graph', titre: 'Graphe', icone: '⊛', file: 'graph.html' },
    ],
  },
]);

/** Onglets de rôle (hors vue d'ensemble), dans l'ordre d'affichage. */
export const ONGLETS_ROLE = Object.freeze(ONGLETS.filter((o) => o.agent));

/** Liste à plat de toutes les pages, chacune avec l'`onglet` auquel elle appartient. */
export const PAGES_NAV = Object.freeze(
  ONGLETS.flatMap((o) => o.pages.map((p) => Object.freeze({ ...p, onglet: o.id }))),
);

/**
 * Onglet auquel appartient une page. Les pages de détail (`intent-…`,
 * `spec-…`) sont rattachées à l'onglet de leur liste ; une page inconnue
 * (404) retombe sur la vue d'ensemble.
 *
 * @param {string} slug slug de page, ou nom de fichier
 * @returns {typeof ONGLETS[number]}
 */
export function ongletDe(slug) {
  const s = String(slug || '').replace(/\.html$/, '');
  const page = PAGES_NAV.find((p) => p.slug === s);
  if (page) return ONGLETS.find((o) => o.id === page.onglet);
  if (/^intent[-_]/i.test(s)) return ONGLETS.find((o) => o.id === 'pm');
  if (/^spec[-_]/i.test(s)) return ONGLETS.find((o) => o.id === 'pe');
  return ONGLETS[0];
}

/** Slug de la page de liste dont dépend une page de détail (pour l'état actif). */
export function pageActive(slug) {
  const s = String(slug || '').replace(/\.html$/, '');
  if (PAGES_NAV.some((p) => p.slug === s)) return s;
  if (/^intent[-_]/i.test(s)) return 'intents';
  if (/^spec[-_]/i.test(s)) return 'specs';
  return s;
}

/** Onglet (id) vers lequel pointe un lien `fichier.html[#ancre]` — sert à ventiler les alertes par rôle. */
export function ongletDuLien(href) {
  const fichier = String(href || '').split('#')[0].split('?')[0];
  return ongletDe(fichier).id;
}
