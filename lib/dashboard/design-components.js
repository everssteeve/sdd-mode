// AIAD SDD Mode — Dashboard : design system (2/2) — composants de contenu.
//
// KPI, cartes, tableaux, badges, alertes, barres de distribution, filtres,
// états vides. Les sélecteurs historiques sont tous conservés : les blocs
// existants (PM Cockpit, QA, SRE, DPO…) changent d'apparence sans changer de
// balisage.
//
// @intent INTENT-037
// @spec SPEC-037-1-dashboard-par-role
// @verified-by test/dashboard-design-system.test.js
// @governance AIAD-RGAA, AIAD-RGESN
//
// Documentation : https://aiad.ovh

export const CSS_COMPONENTS = `
section { margin-bottom: 2.25rem; }
section h2 {
  font-size: 1.12rem; font-weight: 700; margin: 0 0 .8rem;
  display: flex; align-items: center; gap: .5rem; flex-wrap: wrap;
}
section h2 .count {
  font-weight: 600; font-size: .74rem; color: var(--fg-muted);
  background: var(--muted-bg); padding: .12rem .55rem; border-radius: 999px; letter-spacing: 0;
}
.section-lede { color: var(--fg-muted); margin: -.4rem 0 .9rem; font-size: .9rem; max-width: 75ch; }

/* ── KPI ────────────────────────────────────────────────────────────────── */
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(176px, 1fr)); gap: .8rem; margin-bottom: 1.5rem; }
.kpi {
  position: relative; overflow: hidden;
  background: var(--bg-alt); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 1rem 1.1rem 1rem 1.2rem; box-shadow: var(--shadow-sm);
  transition: transform .18s var(--ease), box-shadow .18s var(--ease);
}
.kpi::before { content: ""; position: absolute; inset: .9rem auto .9rem 0; width: 3px; border-radius: 0 3px 3px 0; background: var(--border-strong); }
.kpi:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.kpi .label { font-size: .7rem; font-weight: 650; color: var(--fg-muted); text-transform: uppercase; letter-spacing: .07em; margin-bottom: .4rem; }
.kpi .value { font-size: 1.85rem; font-weight: 780; letter-spacing: -.035em; line-height: 1.05; font-variant-numeric: tabular-nums; }
.kpi .value.small { font-size: 1.2rem; }
.kpi .delta { font-size: .76rem; margin-top: .3rem; color: var(--fg-muted); }
.kpi.ok::before { background: var(--ok-fg); }
.kpi.warn::before { background: var(--warn-fg); }
.kpi.bad::before { background: var(--bad-fg); }
.kpi.ok .value { color: var(--ok-fg); }
.kpi.warn .value { color: var(--warn-fg); }
.kpi.bad .value { color: var(--bad-fg); }
.kpi .spark-row { margin-top: .4rem; color: var(--accent); opacity: .9; }
svg.spark { display: block; max-width: 100%; height: 28px; }
svg.spark polyline { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }

/* ── Cartes ─────────────────────────────────────────────────────────────── */
.card {
  background: var(--bg-alt); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 1.25rem; margin-bottom: 1rem; box-shadow: var(--shadow-sm);
}
.card h3 { margin: 0 0 .5rem; font-size: 1rem; font-weight: 700; }
.card p { margin: .25rem 0; }
.muted { color: var(--fg-muted); }
details { border-radius: var(--radius-sm); }
details > summary { cursor: pointer; padding: .3rem 0; }
details > summary:hover { color: var(--accent-strong); }

/* ── Tableaux ───────────────────────────────────────────────────────────── */
table {
  border-collapse: separate; border-spacing: 0; width: 100%;
  background: var(--bg-alt); border: 1px solid var(--border); border-radius: var(--radius);
  overflow: hidden; font-size: .88rem; box-shadow: var(--shadow-sm);
}
th, td { padding: .7rem .9rem; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
th {
  background: var(--bg-sunken); font-weight: 650; font-size: .72rem;
  text-transform: uppercase; letter-spacing: .06em; color: var(--fg-muted);
}
tr:last-child td { border-bottom: none; }
/* Légende injectée pour les lecteurs d'écran (initA11yTables) : présente, non affichée */
table caption { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
tbody tr { transition: background .12s var(--ease); }
tr:hover td { background: color-mix(in srgb, var(--accent) 5%, var(--bg-alt)); }
td.rowspan { background: var(--bg-sunken); font-weight: 600; border-right: 1px solid var(--border-strong); vertical-align: top; }
table[data-sortable="true"] th { cursor: pointer; user-select: none; position: relative; }
table[data-sortable="true"] th:hover { color: var(--fg); }
table[data-sortable="true"] th::after { content: " ⇅"; font-size: .7rem; opacity: .4; }
table[data-sortable="true"] th.sort-asc::after { content: " ↑"; opacity: 1; color: var(--accent); }
table[data-sortable="true"] th.sort-desc::after { content: " ↓"; opacity: 1; color: var(--accent); }
.matrix-tab table { font-size: .82rem; }
code {
  background: var(--code-bg); padding: .12rem .4rem; border-radius: 6px;
  font-family: var(--font-mono); font-size: .84em;
  overflow-wrap: anywhere;
}
hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }

/* ── Badges ─────────────────────────────────────────────────────────────── */
.badge {
  display: inline-flex; align-items: center; gap: .3rem;
  padding: .16rem .6rem; border-radius: 999px;
  font-size: .73rem; font-weight: 650; white-space: nowrap;
  background: var(--muted-bg); color: var(--muted-fg);
}
.badge-ok { background: var(--ok-bg); color: var(--ok-fg); }
.badge-warn { background: var(--warn-bg); color: var(--warn-fg); }
.badge-bad { background: var(--bad-bg); color: var(--bad-fg); }
.badge-info { background: var(--info-bg); color: var(--info-fg); }
.badge-muted { background: var(--muted-bg); color: var(--muted-fg); }
.lens-btn {
  padding: .38rem .8rem; border: 1px solid var(--border); background: var(--bg-alt); color: var(--fg);
  border-radius: 999px; cursor: pointer; font-size: .8rem; font-weight: 550; font-family: inherit;
  transition: background .15s var(--ease), border-color .15s var(--ease);
}
.lens-btn:hover { background: var(--bg-sunken); border-color: var(--border-strong); }
.lens-btn.active { background: var(--accent); color: var(--accent-fg, #fff); border-color: var(--accent); }
.kanban-card.in-scope { outline: 2px solid var(--accent); outline-offset: -1px; }
.kanban-card.out-scope { opacity: 0.35; }
.freshness { font-weight: 550; cursor: pointer; user-select: none; }
[data-copy].copied { background: var(--ok-bg); color: var(--ok-fg); transition: background .2s; }
code.id-copyable { cursor: pointer; user-select: all; }
code.id-copyable:hover { background: var(--bg-alt); outline: 1px solid var(--border-strong); }
/* Glossaire AIAD inline — termes auto-taggés au chargement */
dfn.aiad-term { border-bottom: 1px dotted var(--accent); cursor: help; font-style: normal; }
dfn.aiad-term:hover { background: var(--info-bg); color: var(--info-fg); }

/* ── Maturité ───────────────────────────────────────────────────────────── */
.maturite {
  display: flex; align-items: center; gap: 1rem;
  background: var(--bg-alt); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 1.1rem 1.25rem; box-shadow: var(--shadow-sm);
}
.maturite .barre { flex: 1; height: 10px; background: var(--muted-bg); border-radius: 999px; overflow: hidden; }
.maturite .barre .fill { height: 100%; border-radius: 999px; background: var(--accent); transition: width .5s var(--ease); }
.maturite-ok .fill { background: #16a34a; }
.maturite-info .fill { background: #4f46e5; }
.maturite-warn .fill { background: #ea580c; }
.maturite-bad .fill { background: #dc2626; }
.maturite .label { font-weight: 700; min-width: 8rem; }
.maturite .score { color: var(--fg-muted); font-size: .9rem; font-variant-numeric: tabular-nums; }

/* ── Filtres, états vides, actions ──────────────────────────────────────── */
.filter { margin: 0 0 .8rem; }
.filter input {
  padding: .55rem .85rem; width: 100%; max-width: 380px;
  background: var(--bg-alt); color: var(--fg);
  border: 1px solid var(--border); border-radius: 999px; font-size: .9rem; font-family: inherit;
  transition: border-color .15s var(--ease), box-shadow .15s var(--ease);
}
.filter input:focus { border-color: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent); }
.empty {
  background: var(--bg-alt); border: 1px dashed var(--border-strong); border-radius: var(--radius);
  padding: 2rem; text-align: center; color: var(--fg-muted); font-size: .95rem;
}
.empty strong { display: block; color: var(--fg); margin-bottom: .25rem; font-size: 1rem; }
.actions { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .5rem; }
.actions a, .actions code {
  background: var(--bg-alt); color: var(--fg);
  padding: .42rem .8rem; border-radius: 999px; text-decoration: none;
  font-size: .82rem; font-weight: 550; border: 1px solid var(--border);
  transition: background .15s var(--ease), color .15s var(--ease), border-color .15s var(--ease);
}
.actions a:hover { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.row-cluster { display: flex; flex-direction: column; gap: .15rem; }
.row-cluster small { color: var(--fg-muted); font-size: .8rem; }
ul.compact { padding-left: 1.1rem; margin: .25rem 0; }
ul.compact li { margin: .15rem 0; }
.src-link {
  font-size: .75rem; color: var(--fg-muted); text-decoration: none; font-family: var(--font-mono);
  border-bottom: 1px dotted transparent; transition: color .15s, border-color .15s;
}
.src-link::before { content: "↗ "; opacity: .6; }
.src-link:hover { color: var(--accent); border-bottom-color: var(--accent); }

/* ── Alertes ────────────────────────────────────────────────────────────── */
.alertes {
  display: flex; align-items: center; gap: 1rem;
  background: var(--ok-bg); color: var(--ok-fg);
  border: 1px solid color-mix(in srgb, var(--ok-fg) 22%, transparent);
  border-radius: var(--radius); padding: 1rem 1.25rem;
}
/* CA-008b @spec SPEC-016-2-design-system-rgaa @governance AIAD-RGAA — pas de gris atténué dans un bloc coloré */
.alertes .muted { color: currentColor; }
.alertes .alertes-icon { font-size: 1.5rem; }
.alertes-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: .75rem; }
.alerte {
  display: block; text-decoration: none; color: var(--fg);
  border: 1px solid var(--border); border-left: 4px solid var(--muted-fg);
  border-radius: var(--radius-sm) var(--radius) var(--radius) var(--radius-sm);
  padding: .9rem 1rem; background: var(--bg-alt); box-shadow: var(--shadow-sm);
  transition: transform .15s var(--ease), box-shadow .15s var(--ease);
}
.alerte:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); color: var(--fg); }
.alerte-warn { border-left-color: #ea580c; }
.alerte-bad { border-left-color: #dc2626; }
.alerte-titre { font-weight: 650; font-size: .95rem; margin-bottom: .15rem; }
.alerte-detail { color: var(--fg-muted); font-size: .85rem; margin-bottom: .35rem; }
.alerte-action { color: var(--accent-strong); font-size: .8rem; font-weight: 550; }

/* ── Barre de distribution ──────────────────────────────────────────────── */
.dist-bar { display: flex; height: 26px; border-radius: 999px; overflow: hidden; background: var(--muted-bg); margin-bottom: .75rem; }
.dist-bar.empty { opacity: .3; }
.dist-seg { display: flex; align-items: center; justify-content: center; color: white; font-weight: 650; font-size: .78rem; transition: filter .15s; min-width: 1px; }
.dist-seg:hover { filter: brightness(1.1); }
.seg-ok { background: #008933; }
.seg-info { background: #1d4ed8; }
.seg-warn { background: #d14800; }
.seg-bad { background: #b91c1c; }
.seg-muted { background: #68778c; }
.dist-leg { display: flex; flex-wrap: wrap; gap: .85rem; font-size: .8rem; color: var(--fg-muted); }
.dist-leg-item { display: inline-flex; align-items: center; gap: .35rem; }
.dist-leg-item strong { color: var(--fg); margin-left: .15rem; }
.dist-leg-dot { width: .65rem; height: .65rem; border-radius: 50%; display: inline-block; }

@media (max-width: 1100px) { .split { grid-template-columns: 1fr; } }
/* Mobile : KPI sur 2 colonnes, tableaux défilants, cellules resserrées */
@media (max-width: 640px) {
  .kpis { grid-template-columns: repeat(2, 1fr); gap: .5rem; }
  .kpi { padding: .75rem .85rem .75rem 1rem; }
  .kpi .value { font-size: 1.35rem; }
  .kpi .value.small { font-size: 1rem; }
  table { font-size: .8rem; }
  th, td { padding: .5rem .55rem; }
  .alertes-list { grid-template-columns: 1fr; }
  section table { display: block; overflow-x: auto; }
}

/* Impression : navigation masquée, couleurs claires, pleine largeur */
@media print {
  body { display: block; background: white; color: black; font-size: 11px; }
  .appbar, .subnav, .app-footer, .skip-link { display: none; }
  main { padding: 0; max-width: none; }
  .hero { background: none; color: black; box-shadow: none; border: 1px solid #999; }
  .hero p, .hero-kicker, .hero-ring-label span { color: black; }
  .kpi, .card, table, .role-card, .pipe-step { box-shadow: none; page-break-inside: avoid; }
  .alerte { page-break-inside: avoid; }
  .filter, .actions { display: none; }
  a { color: black; text-decoration: none; }
  .src-link { display: none; }
}

/* Focus visible (a11y — CA-004 @spec SPEC-016-2-design-system-rgaa @governance AIAD-RGAA) */
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, [tabindex]:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
.hero a:focus-visible { outline-color: #fff; }

/* Mouvement réduit (CA-005 @spec SPEC-016-2-design-system-rgaa @governance AIAD-RGAA) */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; animation: none !important; }
}
`;
