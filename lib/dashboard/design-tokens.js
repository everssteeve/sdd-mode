// AIAD SDD Mode — Dashboard : design system (1/2) — tokens, base, coquille.
//
// Tokens de couleur (clair / sombre), typographie, rayons, ombres, puis la
// coquille de l'application : barre supérieure à onglets par responsabilité,
// sous-navigation, en-tête de page, pied. Les composants de contenu (KPI,
// cartes, tableaux, badges…) sont dans `design-components.js`.
//
// Contraintes tenues : zéro ressource externe (polices système, CSP `self`),
// contrastes AA sur les couples texte / fond, `prefers-reduced-motion`,
// thème sombre par réglage système ou bascule manuelle (`data-theme`).
// Les noms de variables historiques (`--bg-alt`, `--fg-muted`, `--card-bg`…)
// sont conservés : ~180 modules de blocs s'y réfèrent en style inline.
//
// @intent INTENT-037
// @spec SPEC-037-1-dashboard-par-role
// @verified-by test/dashboard-design-system.test.js
// @governance AIAD-RGAA, AIAD-RGESN
//
// Documentation : https://aiad.ovh

const CLAIR = `
  --bg: #f5f6fa;
  --bg-alt: #ffffff;
  --bg-raised: #ffffff;
  --bg-sunken: #eceef5;
  --fg: #12141f;
  --fg-muted: #515a70;
  --border: #e1e4ee;
  --border-strong: #c9cedd;
  --accent: #4f46e5;
  --accent-strong: #4338ca;
  --accent-soft: #eef0ff;
  --accent-fg: #ffffff;
  --ok-bg: #dcfce7;
  --ok-fg: #166534;
  --warn-bg: #fef3c7;
  --warn-fg: #92400e;
  --bad-bg: #fee2e2;
  --bad-fg: #991b1b;
  --info-bg: #e0e7ff;
  --info-fg: #3730a3;
  --muted-bg: #e7e9f2;
  --muted-fg: #474f63;
  --muted: #5d6579;
  --code-bg: #eef0f6;
  --role-global: #4f46e5;
  --role-pm: #7c3aed;
  --role-pe: #2563eb;
  --role-ae: #0f766e;
  --role-qa: #15803d;
  --role-tl: #b45309;
  --shadow-sm: 0 1px 2px rgba(18, 20, 31, .06);
  --shadow-md: 0 1px 2px rgba(18, 20, 31, .05), 0 8px 24px -12px rgba(18, 20, 31, .18);
  --shadow-lg: 0 2px 4px rgba(18, 20, 31, .05), 0 24px 48px -24px rgba(18, 20, 31, .28);
  --appbar-bg: rgba(255, 255, 255, .86);
  --hero-ink: #ffffff;`;

const SOMBRE = `
  --bg: #0b0d14;
  --bg-alt: #141722;
  --bg-raised: #191d2b;
  --bg-sunken: #0f1119;
  --fg: #eef0f7;
  --fg-muted: #a3abc0;
  --border: #252a3a;
  --border-strong: #363d52;
  --accent: #8b8ff8;
  --accent-strong: #a5a8fb;
  --accent-soft: #1d2040;
  --accent-fg: #0b0d14;
  --ok-bg: #12351f;
  --ok-fg: #a7f3c1;
  --warn-bg: #3f2a0b;
  --warn-fg: #fcd98a;
  --bad-bg: #431717;
  --bad-fg: #fdc3c3;
  --info-bg: #1e2350;
  --info-fg: #c3c9ff;
  --muted-bg: #222738;
  --muted-fg: #c5cbdc;
  --muted: #a3abc0;
  --code-bg: #1d2130;
  --role-global: #8b8ff8;
  --role-pm: #b197fc;
  --role-pe: #74a7ff;
  --role-ae: #3fd4c2;
  --role-qa: #5bd98a;
  --role-tl: #f5b651;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, .4);
  --shadow-md: 0 1px 2px rgba(0, 0, 0, .4), 0 12px 28px -14px rgba(0, 0, 0, .7);
  --shadow-lg: 0 2px 4px rgba(0, 0, 0, .4), 0 28px 56px -24px rgba(0, 0, 0, .8);
  --appbar-bg: rgba(15, 17, 26, .84);
  --hero-ink: #ffffff;`;

export const CSS_TOKENS = `:root {
  color-scheme: light dark;${CLAIR}
  --card-bg: var(--bg-alt);
  --bg-soft: var(--bg);
  --text-muted: var(--fg-muted);
  --bg-nav: var(--bg-alt);
  --bg-nav-active: var(--accent-soft);
  --fg-nav: var(--fg-muted);
  --fg-nav-active: var(--fg);
  --role: var(--role-global);
  --radius-sm: 8px;
  --radius: 14px;
  --radius-lg: 22px;
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;
  --ease: cubic-bezier(.2, .7, .2, 1);
}
/* Thème sombre : réglage système, ou bascule manuelle (html[data-theme]) qui l'emporte. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {${SOMBRE}
  }
}
:root[data-theme="dark"] {${SOMBRE}
}
body[data-onglet="pm"] { --role: var(--role-pm); }
body[data-onglet="pe"] { --role: var(--role-pe); }
body[data-onglet="ae"] { --role: var(--role-ae); }
body[data-onglet="qa"] { --role: var(--role-qa); }
body[data-onglet="tl"] { --role: var(--role-tl); }

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
html { scroll-padding-top: 8rem; }
body {
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--fg);
  line-height: 1.55;
  font-size: 14.5px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
a { color: var(--accent-strong); text-underline-offset: 2px; }
a:hover { color: var(--accent); }
h1, h2, h3, h4 { letter-spacing: -.015em; line-height: 1.25; }
.skip-link {
  position: absolute; left: .75rem; top: -4rem; z-index: 100;
  background: var(--fg); color: var(--bg); padding: .6rem .9rem;
  border-radius: var(--radius-sm); font-weight: 600; text-decoration: none;
}
.skip-link:focus { top: .75rem; color: var(--bg); }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }

/* ── Barre supérieure : marque + onglets par responsabilité ─────────────── */
.appbar {
  position: sticky; top: 0; z-index: 60;
  display: flex; align-items: center; gap: 1.25rem;
  padding: .6rem clamp(1rem, 3vw, 2.25rem);
  background: var(--appbar-bg);
  -webkit-backdrop-filter: saturate(160%) blur(14px);
  backdrop-filter: saturate(160%) blur(14px);
  border-bottom: 1px solid var(--border);
}
.brand { display: flex; align-items: center; gap: .7rem; text-decoration: none; color: var(--fg); flex-shrink: 0; }
.brand:hover { color: var(--fg); }
.brand-mark {
  width: 2.1rem; height: 2.1rem; border-radius: 10px;
  display: grid; place-items: center;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #db2777 100%);
  color: #fff; font-weight: 800; font-size: .95rem; letter-spacing: -.04em;
  box-shadow: 0 6px 16px -6px rgba(79, 70, 229, .7);
}
.brand-text { display: flex; flex-direction: column; line-height: 1.15; }
.brand-title { font-weight: 700; font-size: .98rem; letter-spacing: -.01em; }
.brand-sub { font-size: .72rem; color: var(--fg-muted); }
.brand-version { font-family: var(--font-mono); }
.tabs { flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
.tabs ul, .subnav ul { list-style: none; margin: 0; padding: 0; display: flex; gap: .2rem; }
.tab {
  display: inline-flex; align-items: center; gap: .5rem;
  padding: .5rem .8rem; border-radius: 999px;
  color: var(--fg-muted); text-decoration: none; white-space: nowrap;
  font-size: .88rem; font-weight: 550;
  transition: background .18s var(--ease), color .18s var(--ease);
}
.tab:hover { background: var(--bg-sunken); color: var(--fg); }
.tab::before { content: ""; width: .55rem; height: .55rem; border-radius: 50%; background: var(--tab-color, var(--role-global)); flex-shrink: 0; }
.tab-count { order: 3; }
.tab[data-onglet="pm"] { --tab-color: var(--role-pm); }
.tab[data-onglet="pe"] { --tab-color: var(--role-pe); }
.tab[data-onglet="ae"] { --tab-color: var(--role-ae); }
.tab[data-onglet="qa"] { --tab-color: var(--role-qa); }
.tab[data-onglet="tl"] { --tab-color: var(--role-tl); }
.tab.active {
  color: var(--fg); font-weight: 650;
  background: color-mix(in srgb, var(--tab-color, var(--role-global)) 13%, var(--bg-alt));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tab-color, var(--role-global)) 38%, transparent);
}
.tab-count {
  min-width: 1.25rem; padding: 0 .35rem; border-radius: 999px;
  background: var(--bad-bg); color: var(--bad-fg);
  font-size: .7rem; font-weight: 700; line-height: 1.25rem; text-align: center;
}
.tab-count.warn { background: var(--warn-bg); color: var(--warn-fg); }
.appbar-tools { display: flex; align-items: center; gap: .6rem; flex-shrink: 0; }
.appbar-tools .meta { display: none; }

/* ── Sous-navigation de l'onglet ────────────────────────────────────────── */
.subnav {
  position: sticky; top: 3.35rem; z-index: 55;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: .4rem clamp(1rem, 3vw, 2.25rem);
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  overflow-x: auto; scrollbar-width: none;
}
.subnav::-webkit-scrollbar { display: none; }
.subnav a {
  display: inline-flex; align-items: center; gap: .4rem;
  padding: .38rem .7rem; border-radius: var(--radius-sm);
  color: var(--fg-muted); text-decoration: none; white-space: nowrap;
  font-size: .84rem; font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: color .18s var(--ease), background .18s var(--ease);
}
.subnav a:hover { color: var(--fg); background: var(--bg-sunken); }
.subnav a.active { color: var(--fg); font-weight: 650; border-bottom-color: var(--role); border-radius: var(--radius-sm) var(--radius-sm) 0 0; }
.subnav .nav-icon { font-size: .9rem; opacity: .8; width: 1rem; text-align: center; }
.subnav-agent { font-size: .78rem; color: var(--fg-muted); white-space: nowrap; flex-shrink: 0; }
.subnav-agent code { color: var(--role); font-weight: 600; background: color-mix(in srgb, var(--role) 10%, var(--bg-alt)); }

/* ── Contenu ────────────────────────────────────────────────────────────── */
main {
  flex: 1; width: 100%; max-width: 1360px; margin: 0 auto;
  padding: 1.75rem clamp(1rem, 3vw, 2.25rem) 4rem;
}
header.page-header {
  margin-bottom: 1.6rem;
  display: flex; justify-content: space-between; align-items: end; gap: 1rem; flex-wrap: wrap;
}
header.page-header .eyebrow {
  display: inline-flex; align-items: center; gap: .45rem;
  font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .09em;
  color: var(--role); margin-bottom: .35rem;
}
header.page-header .eyebrow::before { content: ""; width: 1.1rem; height: 2px; border-radius: 2px; background: var(--role); }
header.page-header h1 { margin: 0 0 .3rem; font-size: clamp(1.5rem, 2.4vw, 2rem); font-weight: 750; letter-spacing: -.03em; }
header.page-header .subtitle { color: var(--fg-muted); font-size: .98rem; max-width: 70ch; }
header.page-header .meta { font-size: .8rem; color: var(--fg-muted); }
header.page-header .header-right { display: flex; align-items: center; gap: .75rem; }
.toggle-theme {
  background: var(--bg-alt); color: var(--fg);
  border: 1px solid var(--border); border-radius: 999px;
  width: 2.2rem; height: 2.2rem; padding: 0; cursor: pointer; font-size: .9rem;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background .18s var(--ease), border-color .18s var(--ease), transform .18s var(--ease);
}
.toggle-theme:hover { border-color: var(--accent); transform: rotate(-12deg); }
.toggle-theme .icon { font-size: 1rem; line-height: 1; }
:root[data-theme="dark"] .toggle-theme .icon-dark { display: none; }
:root[data-theme="dark"] .toggle-theme .icon-light { display: inline; }
:root:not([data-theme="dark"]) .toggle-theme .icon-light { display: none; }
:root:not([data-theme="dark"]) .toggle-theme .icon-dark { display: inline; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) .toggle-theme .icon-dark { display: none; }
  :root:not([data-theme]) .toggle-theme .icon-light { display: inline; }
}
.app-footer {
  border-top: 1px solid var(--border);
  padding: 1.1rem clamp(1rem, 3vw, 2.25rem) 1.6rem;
  font-size: .78rem; color: var(--fg-muted);
  display: flex; flex-wrap: wrap; gap: .4rem 1.25rem; justify-content: space-between;
}
.app-footer a { color: inherit; }

/* ── Héros de la vue d'ensemble ─────────────────────────────────────────── */
.hero {
  position: relative; overflow: hidden;
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2rem; align-items: center;
  padding: clamp(1.4rem, 3vw, 2.25rem);
  border-radius: var(--radius-lg);
  color: var(--hero-ink);
  background:
    radial-gradient(60rem 22rem at 105% -30%, rgba(219, 39, 119, .55), transparent 60%),
    radial-gradient(40rem 20rem at -10% 130%, rgba(14, 165, 233, .45), transparent 60%),
    linear-gradient(135deg, #312e81 0%, #4338ca 45%, #6d28d9 100%);
  box-shadow: var(--shadow-lg);
  margin-bottom: 1.5rem;
}
.hero-kicker { font-size: .72rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: rgba(255, 255, 255, .82); }
.hero h2 { margin: .35rem 0 .5rem; font-size: clamp(1.45rem, 2.6vw, 2.15rem); font-weight: 780; letter-spacing: -.035em; display: block; }
.hero p { margin: 0; max-width: 62ch; color: rgba(255, 255, 255, .9); font-size: 1rem; }
.hero-chips { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: 1.1rem; }
.hero-chip {
  display: inline-flex; align-items: baseline; gap: .4rem;
  padding: .4rem .75rem; border-radius: 999px;
  background: rgba(255, 255, 255, .14); border: 1px solid rgba(255, 255, 255, .22);
  color: #fff; font-size: .82rem; text-decoration: none;
}
a.hero-chip:hover { background: rgba(255, 255, 255, .24); color: #fff; }
.hero-chip strong { font-size: 1rem; font-variant-numeric: tabular-nums; }
.hero-ring { position: relative; width: 9.5rem; height: 9.5rem; flex-shrink: 0; }
.hero-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.hero-ring .ring-track { fill: none; stroke: rgba(255, 255, 255, .2); stroke-width: 9; }
.hero-ring .ring-fill { fill: none; stroke: #fff; stroke-width: 9; stroke-linecap: round; }
.hero-ring-label { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
.hero-ring-label strong { font-size: 2.1rem; font-weight: 800; letter-spacing: -.04em; line-height: 1; }
.hero-ring-label span { font-size: .72rem; text-transform: uppercase; letter-spacing: .1em; color: rgba(255, 255, 255, .85); margin-top: .3rem; }

/* ── Cycle SDD en un coup d'œil ─────────────────────────────────────────── */
.pipeline { display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: .6rem; }
.pipe-step {
  position: relative; display: block; text-decoration: none; color: var(--fg);
  background: var(--bg-alt); border: 1px solid var(--border); border-radius: var(--radius);
  padding: .9rem 1rem; box-shadow: var(--shadow-sm);
  transition: transform .18s var(--ease), box-shadow .18s var(--ease), border-color .18s var(--ease);
}
a.pipe-step:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--border-strong); color: var(--fg); }
.pipe-step .pipe-n { font-size: 1.7rem; font-weight: 780; letter-spacing: -.03em; line-height: 1.1; font-variant-numeric: tabular-nums; }
.pipe-step .pipe-label { font-size: .74rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--fg-muted); }
.pipe-step .pipe-hint { font-size: .78rem; color: var(--fg-muted); margin-top: .15rem; }
.pipe-n small { font-size: .9rem; font-weight: 500; color: var(--fg-muted); }
.pipe-step.is-empty .pipe-n { color: var(--fg-muted); font-weight: 600; }

/* ── Cartes de responsabilité ───────────────────────────────────────────── */
.roles { display: grid; grid-template-columns: repeat(auto-fit, minmax(232px, 1fr)); gap: .9rem; }
.role-card {
  --rc: var(--role-global);
  position: relative; display: flex; flex-direction: column; gap: .7rem;
  background: var(--bg-alt); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 1.1rem 1.15rem 1rem; text-decoration: none; color: var(--fg);
  box-shadow: var(--shadow-sm); overflow: hidden;
  transition: transform .2s var(--ease), box-shadow .2s var(--ease), border-color .2s var(--ease);
}
.role-card::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 4px; background: var(--rc); }
.role-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: color-mix(in srgb, var(--rc) 45%, var(--border)); color: var(--fg); }
.role-card[data-onglet="pm"] { --rc: var(--role-pm); }
.role-card[data-onglet="pe"] { --rc: var(--role-pe); }
.role-card[data-onglet="ae"] { --rc: var(--role-ae); }
.role-card[data-onglet="qa"] { --rc: var(--role-qa); }
.role-card[data-onglet="tl"] { --rc: var(--role-tl); }
.role-head { display: flex; align-items: center; gap: .65rem; }
.role-badge {
  width: 2.3rem; height: 2.3rem; border-radius: 11px; display: grid; place-items: center; flex-shrink: 0;
  background: color-mix(in srgb, var(--rc) 14%, var(--bg-alt)); color: var(--rc);
  font-weight: 800; font-size: .82rem; letter-spacing: .02em;
}
.role-name { font-weight: 700; font-size: 1rem; letter-spacing: -.01em; }
.role-question { font-size: .8rem; color: var(--fg-muted); line-height: 1.35; }
.role-stats { display: grid; gap: .3rem; margin: 0; }
.role-stat { display: flex; align-items: baseline; justify-content: space-between; gap: .75rem; background: var(--bg-sunken); border-radius: var(--radius-sm); padding: .4rem .65rem; }
.role-stat dt { font-size: .78rem; color: var(--fg-muted); }
.role-stat dd { margin: 0; font-size: 1.02rem; font-weight: 750; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.role-foot { display: flex; align-items: center; justify-content: space-between; gap: .5rem; font-size: .8rem; margin-top: auto; }
.role-foot .role-open { color: var(--rc); font-weight: 650; }

/* ── Carte « assistant de rôle » ────────────────────────────────────────── */
.assistant {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .9rem 1.5rem; align-items: center;
  background: linear-gradient(120deg, color-mix(in srgb, var(--role) 9%, var(--bg-alt)), var(--bg-alt) 60%);
  border: 1px solid color-mix(in srgb, var(--role) 28%, var(--border));
  border-radius: var(--radius); padding: 1.1rem 1.25rem; margin-bottom: 1.5rem;
}
.assistant h2 { margin: 0 0 .2rem; font-size: 1.05rem; display: block; }
.assistant p { margin: 0; color: var(--fg-muted); font-size: .88rem; }
.assistant-cmd { display: inline-flex; align-items: center; gap: .5rem; font-family: var(--font-mono); font-size: .82rem; background: var(--fg); color: var(--bg); padding: .5rem .8rem; border-radius: var(--radius-sm); white-space: nowrap; }
.assistant-team { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: .4rem; }
.chip {
  display: inline-flex; align-items: center; gap: .35rem;
  padding: .25rem .6rem; border-radius: 999px; font-size: .76rem;
  background: var(--bg-alt); border: 1px solid var(--border); color: var(--fg);
}
.chip code { background: none; padding: 0; font-size: .76rem; color: var(--role); font-weight: 600; }

@media (max-width: 1100px) {
  .appbar { flex-wrap: wrap; gap: .5rem .75rem; }
  .tabs { order: 3; flex-basis: 100%; }
  .subnav { top: 5.9rem; }
  .tab-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
  .tab::after { content: attr(data-court); order: 2; }
  .hero { grid-template-columns: 1fr; }
  .hero-ring { width: 7rem; height: 7rem; }
  .hero-ring-label strong { font-size: 1.6rem; }
}
@media (max-width: 640px) {
  body { font-size: 13.5px; }
  main { padding: 1.1rem .8rem 2.5rem; }
  .brand-sub { display: none; }
  .subnav-agent { display: none; }
  .assistant { grid-template-columns: 1fr; }
  header.page-header { flex-direction: column; align-items: flex-start; gap: .35rem; }
}
`;
