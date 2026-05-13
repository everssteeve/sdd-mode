// AIAD SDD Mode — Dashboard : assets statiques (CSS + JS client).
//
// Extraits de lib/dashboard.js pour permettre l'édition isolée du visuel
// et alléger l'orchestrateur. Émis en .css / .js réels par dashboard().

export const CSS = `:root {
  color-scheme: light dark;
  --bg: #f7f8fa;
  --bg-alt: #ffffff;
  --bg-nav: #0f172a;
  --bg-nav-active: #1e293b;
  --fg: #0f172a;
  --fg-muted: #64748b;
  --fg-nav: #cbd5e1;
  --fg-nav-active: #f8fafc;
  --border: #e2e8f0;
  --accent: #2563eb;
  --ok-bg: #dcfce7;
  --ok-fg: #166534;
  --warn-bg: #fef3c7;
  --warn-fg: #92400e;
  --bad-bg: #fee2e2;
  --bad-fg: #991b1b;
  --info-bg: #dbeafe;
  --info-fg: #1e40af;
  --muted-bg: #e2e8f0;
  --muted-fg: #475569;
  --code-bg: #f1f5f9;
}
/* Dark vars : appliquées soit via le réglage OS, soit via toggle manuel
   (html[data-theme="dark"]). Le toggle manuel l'emporte toujours. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0b1020;
    --bg-alt: #111827;
    --bg-nav: #0a0f1d;
    --bg-nav-active: #1f2937;
    --fg: #f1f5f9;
    --fg-muted: #94a3b8;
    --fg-nav: #cbd5e1;
    --fg-nav-active: #ffffff;
    --border: #1f2937;
    --accent: #60a5fa;
    --ok-bg: #14532d;
    --ok-fg: #bbf7d0;
    --warn-bg: #78350f;
    --warn-fg: #fde68a;
    --bad-bg: #7f1d1d;
    --bad-fg: #fecaca;
    --info-bg: #1e3a8a;
    --info-fg: #bfdbfe;
    --muted-bg: #1f2937;
    --muted-fg: #cbd5e1;
    --code-bg: #1f2937;
  }
}
:root[data-theme="dark"] {
  --bg: #0b1020;
  --bg-alt: #111827;
  --bg-nav: #0a0f1d;
  --bg-nav-active: #1f2937;
  --fg: #f1f5f9;
  --fg-muted: #94a3b8;
  --fg-nav: #cbd5e1;
  --fg-nav-active: #ffffff;
  --border: #1f2937;
  --accent: #60a5fa;
  --ok-bg: #14532d;
  --ok-fg: #bbf7d0;
  --warn-bg: #78350f;
  --warn-fg: #fde68a;
  --bad-bg: #7f1d1d;
  --bad-fg: #fecaca;
  --info-bg: #1e3a8a;
  --info-fg: #bfdbfe;
  --muted-bg: #1f2937;
  --muted-fg: #cbd5e1;
  --code-bg: #1f2937;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.5;
  font-size: 14px;
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}
nav.side {
  background: var(--bg-nav);
  color: var(--fg-nav);
  padding: 1.5rem 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}
nav.side .brand {
  padding: 0 1.25rem 1.25rem;
  border-bottom: 1px solid rgba(255,255,255,.08);
  margin-bottom: 1rem;
}
nav.side .brand-title {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--fg-nav-active);
  letter-spacing: -.01em;
}
nav.side .brand-sub {
  font-size: .8rem;
  color: var(--fg-nav);
  opacity: .7;
  margin-top: .25rem;
}
nav.side .brand-version {
  display: inline-block;
  margin-top: .35rem;
  padding: .1rem .45rem;
  background: rgba(255,255,255,.08);
  border-radius: 4px;
  font-size: .7rem;
  font-family: ui-monospace, monospace;
}
nav.side ul { list-style: none; padding: 0; margin: 0; }
nav.side li { margin: 0; }
nav.side a {
  display: flex;
  align-items: center;
  gap: .6rem;
  padding: .55rem 1.25rem;
  color: var(--fg-nav);
  text-decoration: none;
  border-left: 3px solid transparent;
  font-size: .9rem;
}
nav.side a:hover { background: var(--bg-nav-active); color: var(--fg-nav-active); }
nav.side a.active {
  background: var(--bg-nav-active);
  color: var(--fg-nav-active);
  border-left-color: var(--accent);
  font-weight: 600;
}
nav.side .nav-icon {
  width: 1.1rem;
  text-align: center;
  font-size: 1rem;
  opacity: .85;
}
nav.side .footer {
  margin-top: 2rem;
  padding: 1rem 1.25rem;
  font-size: .75rem;
  color: var(--fg-nav);
  opacity: .5;
  border-top: 1px solid rgba(255,255,255,.08);
}
main {
  padding: 2rem 2.5rem 4rem;
  max-width: 1280px;
}
header.page-header {
  margin-bottom: 1.75rem;
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 1rem;
  flex-wrap: wrap;
}
header.page-header h1 {
  margin: 0 0 .25rem;
  font-size: 1.75rem;
  letter-spacing: -.02em;
}
header.page-header .subtitle {
  color: var(--fg-muted);
  font-size: .95rem;
}
header.page-header .meta {
  font-size: .8rem;
  color: var(--fg-muted);
}
header.page-header .header-right {
  display: flex;
  align-items: center;
  gap: .75rem;
}
.toggle-theme {
  background: var(--bg-alt);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: .4rem .65rem;
  cursor: pointer;
  font-size: .85rem;
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  transition: background .15s, border-color .15s;
}
.toggle-theme:hover { background: var(--bg); border-color: var(--accent); }
.toggle-theme .icon { font-size: 1rem; line-height: 1; }
:root[data-theme="dark"] .toggle-theme .icon-dark { display: none; }
:root[data-theme="dark"] .toggle-theme .icon-light { display: inline; }
:root:not([data-theme="dark"]) .toggle-theme .icon-light { display: none; }
:root:not([data-theme="dark"]) .toggle-theme .icon-dark { display: inline; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) .toggle-theme .icon-dark { display: none; }
  :root:not([data-theme]) .toggle-theme .icon-light { display: inline; }
}
section { margin-bottom: 2.5rem; }
section h2 {
  font-size: 1.1rem;
  margin: 0 0 .75rem;
  letter-spacing: -.01em;
  display: flex;
  align-items: center;
  gap: .5rem;
}
section h2 .count {
  font-weight: 400;
  color: var(--fg-muted);
  font-size: .9rem;
}
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: .85rem;
  margin-bottom: 1.5rem;
}
.kpi {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem 1.1rem;
}
.kpi .label {
  font-size: .75rem;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: .05em;
  margin-bottom: .35rem;
}
.kpi .value {
  font-size: 1.65rem;
  font-weight: 700;
  letter-spacing: -.02em;
  line-height: 1.1;
}
.kpi .value.small { font-size: 1.15rem; }
.kpi .delta {
  font-size: .75rem;
  margin-top: .25rem;
  color: var(--fg-muted);
}
.kpi.ok .value { color: var(--ok-fg); }
.kpi.warn .value { color: var(--warn-fg); }
.kpi.bad .value { color: var(--bad-fg); }
.card {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}
.card h3 { margin: 0 0 .5rem; font-size: 1rem; }
.card p { margin: .25rem 0; }
.muted { color: var(--fg-muted); }
table {
  border-collapse: collapse;
  width: 100%;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  font-size: .88rem;
}
th, td {
  padding: .65rem .8rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}
th {
  background: var(--bg);
  font-weight: 600;
  font-size: .78rem;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--fg-muted);
}
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--bg); }
code {
  background: var(--code-bg);
  padding: .1rem .35rem;
  border-radius: 3px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: .85em;
}
.badge {
  display: inline-block;
  padding: .15rem .5rem;
  border-radius: 4px;
  font-size: .75rem;
  font-weight: 600;
  background: var(--muted-bg);
  color: var(--muted-fg);
  white-space: nowrap;
}
.badge-ok { background: var(--ok-bg); color: var(--ok-fg); }
.badge-warn { background: var(--warn-bg); color: var(--warn-fg); }
.badge-bad { background: var(--bad-bg); color: var(--bad-fg); }
.badge-info { background: var(--info-bg); color: var(--info-fg); }
.badge-muted { background: var(--muted-bg); color: var(--muted-fg); }
.lens-btn { padding: .35rem .75rem; border: 1px solid var(--border); background: var(--bg); color: var(--fg); border-radius: 999px; cursor: pointer; font-size: .8rem; font-weight: 500; }
.lens-btn:hover { background: var(--bg-alt); }
.lens-btn.active { background: var(--accent); color: var(--accent-fg, #fff); border-color: var(--accent); }
.kanban-card.in-scope { outline: 2px solid var(--accent); outline-offset: -1px; }
.kanban-card.out-scope { opacity: 0.35; }
.freshness { font-weight: 500; opacity: .85; cursor: pointer; user-select: none; }
.freshness:hover { opacity: 1; }
[data-copy].copied { background: var(--ok-bg); color: var(--ok-fg); transition: background .2s; }
code.id-copyable { cursor: pointer; user-select: all; }
code.id-copyable:hover { background: var(--bg-alt); outline: 1px solid var(--border); }
.maturite {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.25rem;
}
.maturite .barre {
  flex: 1;
  height: 10px;
  background: var(--muted-bg);
  border-radius: 4px;
  overflow: hidden;
}
.maturite .barre .fill {
  height: 100%;
  background: var(--accent);
  transition: width .4s;
}
.maturite-ok .fill { background: #16a34a; }
.maturite-info .fill { background: #2563eb; }
.maturite-warn .fill { background: #ea580c; }
.maturite-bad .fill { background: #dc2626; }
.maturite .label { font-weight: 600; min-width: 8rem; }
.maturite .score { color: var(--fg-muted); font-size: .9rem; }
.filter {
  margin: 0 0 .75rem;
}
.filter input {
  padding: .5rem .75rem;
  width: 100%;
  max-width: 360px;
  background: var(--bg-alt);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: .9rem;
}
.empty {
  background: var(--bg-alt);
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  color: var(--fg-muted);
  font-size: .95rem;
}
.empty strong { display: block; color: var(--fg); margin-bottom: .25rem; font-size: 1rem; }
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin-top: .5rem;
}
.actions a, .actions code {
  background: var(--code-bg);
  color: var(--fg);
  padding: .35rem .6rem;
  border-radius: 5px;
  text-decoration: none;
  font-size: .8rem;
  border: 1px solid var(--border);
}
.actions a:hover { background: var(--accent); color: white; border-color: var(--accent); }
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
@media (max-width: 1100px) {
  body { grid-template-columns: 1fr; }
  nav.side {
    position: sticky;
    top: 0;
    z-index: 50;
    height: auto;
    padding: .5rem 1rem;
    display: flex;
    align-items: center;
    gap: .5rem;
    overflow-x: auto;
  }
  nav.side .brand { padding: 0 .5rem 0 0; border: none; margin: 0; flex-shrink: 0; }
  nav.side .brand-sub, nav.side .brand-version { display: none; }
  nav.side ul { display: flex; gap: .25rem; flex: 1; min-width: 0; }
  nav.side a { padding: .4rem .65rem; border-left: none; border-bottom: 3px solid transparent; border-radius: 4px; white-space: nowrap; font-size: .85rem; }
  nav.side a.active { border-left: none; border-bottom-color: var(--accent); background: var(--bg-nav-active); }
  nav.side .footer { display: none; }
  main { padding: 1.5rem 1rem 3rem; }
  .split { grid-template-columns: 1fr; }
  header.page-header h1 { font-size: 1.4rem; }
}
/* Mobile : KPIs sur 2 colonnes, tables avec scroll horizontal,
   cellules plus serrées, badges plus petits */
@media (max-width: 640px) {
  body { font-size: 13px; }
  main { padding: 1rem .75rem 2rem; }
  .kpis { grid-template-columns: repeat(2, 1fr); gap: .5rem; }
  .kpi { padding: .75rem .85rem; }
  .kpi .value { font-size: 1.3rem; }
  .kpi .value.small { font-size: 1rem; }
  table { font-size: .8rem; }
  th, td { padding: .5rem .55rem; }
  .alertes-list { grid-template-columns: 1fr; }
  /* tables wrappées dans un conteneur scrollable */
  section table { display: block; overflow-x: auto; }
  header.page-header { flex-direction: column; align-items: flex-start; gap: .35rem; }
  .toggle-theme { padding: .35rem .5rem; }
}
.row-cluster { display: flex; flex-direction: column; gap: .15rem; }
.row-cluster small { color: var(--fg-muted); font-size: .8rem; }
ul.compact { padding-left: 1.1rem; margin: .25rem 0; }
ul.compact li { margin: .15rem 0; }
.matrix-tab table { font-size: .82rem; }
hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }

/* Source links */
.src-link {
  font-size: .75rem;
  color: var(--fg-muted);
  text-decoration: none;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  border-bottom: 1px dotted transparent;
  transition: color .15s, border-color .15s;
}
.src-link::before { content: "↗ "; opacity: .6; }
.src-link:hover { color: var(--accent); border-bottom-color: var(--accent); }

/* Alertes (page index) */
.alertes {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--ok-bg);
  color: var(--ok-fg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem 1.25rem;
}
.alertes .alertes-icon { font-size: 1.5rem; }
.alertes-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: .75rem;
}
.alerte {
  display: block;
  text-decoration: none;
  border: 1px solid var(--border);
  border-left: 4px solid var(--muted-fg);
  border-radius: 6px;
  padding: .85rem 1rem;
  background: var(--bg-alt);
  color: var(--fg);
  transition: transform .12s, box-shadow .12s;
}
.alerte:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.06); }
.alerte-warn { border-left-color: #ea580c; }
.alerte-bad { border-left-color: #dc2626; }
.alerte-titre { font-weight: 600; font-size: .95rem; margin-bottom: .15rem; }
.alerte-detail { color: var(--fg-muted); font-size: .85rem; margin-bottom: .35rem; }
.alerte-action { color: var(--accent); font-size: .8rem; }

/* Distribution bar (statuts) */
.dist-bar {
  display: flex;
  height: 28px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--muted-bg);
  margin-bottom: .75rem;
}
.dist-bar.empty { opacity: .3; }
.dist-seg {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: .8rem;
  transition: filter .15s;
  min-width: 1px;
}
.dist-seg:hover { filter: brightness(1.1); }
.seg-ok { background: #16a34a; }
.seg-info { background: #2563eb; }
.seg-warn { background: #ea580c; }
.seg-bad { background: #dc2626; }
.seg-muted { background: #94a3b8; }
.dist-leg {
  display: flex;
  flex-wrap: wrap;
  gap: .85rem;
  font-size: .8rem;
  color: var(--fg-muted);
}
.dist-leg-item { display: inline-flex; align-items: center; gap: .35rem; }
.dist-leg-item strong { color: var(--fg); margin-left: .15rem; }
.dist-leg-dot {
  width: .65rem;
  height: .65rem;
  border-radius: 2px;
  display: inline-block;
}

/* Sparklines */
.kpi .spark-row { margin-top: .35rem; color: var(--accent); opacity: .85; }
svg.spark { display: block; max-width: 100%; height: 28px; }

/* Sortable tables */
table[data-sortable="true"] th {
  cursor: pointer;
  user-select: none;
  position: relative;
}
table[data-sortable="true"] th:hover { color: var(--fg); }
table[data-sortable="true"] th::after {
  content: " ⇅";
  font-size: .7rem;
  opacity: .35;
}
table[data-sortable="true"] th.sort-asc::after { content: " ↑"; opacity: 1; color: var(--accent); }
table[data-sortable="true"] th.sort-desc::after { content: " ↓"; opacity: 1; color: var(--accent); }

/* Rowspan (matrice forward) */
td.rowspan {
  background: var(--bg);
  font-weight: 600;
  border-right: 2px solid var(--border);
  vertical-align: top;
}

/* Impression : nav cachée, couleurs claires forcées, pleine largeur */
@media print {
  body { display: block; background: white; color: black; font-size: 11px; }
  nav.side { display: none; }
  main { padding: 0; max-width: none; }
  .kpi, .card, table { box-shadow: none; page-break-inside: avoid; }
  .alerte { page-break-inside: avoid; }
  .filter, .actions { display: none; }
  a { color: black; text-decoration: none; }
  .src-link { display: none; }
}

/* Focus visible (a11y) */
a:focus-visible, input:focus-visible, button:focus-visible, th:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
`;

export const APP_JS = `function bindFilter(inputId, tableId) {
  var input = document.getElementById(inputId);
  var table = document.getElementById(tableId);
  if (!input || !table) return;
  input.addEventListener('input', function () {
    var q = input.value.toLowerCase();
    var rows = table.tBodies[0].rows;
    for (var i = 0; i < rows.length; i++) {
      var tr = rows[i];
      tr.style.display = tr.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
    }
  });
}

// Tri par colonne — déclenché au clic sur un th, alterne asc/desc.
// Lit data-sort sur les td quand présent (utilisé pour les badges /
// dates / nombres avec mise en forme HTML), sinon textContent.
function bindSortable(table) {
  var ths = table.tHead ? table.tHead.rows[0].cells : [];
  for (var i = 0; i < ths.length; i++) {
    (function (col) {
      ths[col].addEventListener('click', function () {
        var asc = !ths[col].classList.contains('sort-asc');
        for (var j = 0; j < ths.length; j++) ths[j].classList.remove('sort-asc', 'sort-desc');
        ths[col].classList.add(asc ? 'sort-asc' : 'sort-desc');
        var rows = Array.prototype.slice.call(table.tBodies[0].rows);
        rows.sort(function (a, b) {
          var ca = a.cells[col], cb = b.cells[col];
          var va = ca && ca.dataset.sort != null ? ca.dataset.sort : (ca ? ca.textContent : '');
          var vb = cb && cb.dataset.sort != null ? cb.dataset.sort : (cb ? cb.textContent : '');
          var na = parseFloat(va), nb = parseFloat(vb);
          var cmp;
          if (!isNaN(na) && !isNaN(nb) && va.trim() !== '' && vb.trim() !== '') cmp = na - nb;
          else cmp = va.trim().localeCompare(vb.trim(), 'fr', { numeric: true });
          return asc ? cmp : -cmp;
        });
        var tbody = table.tBodies[0];
        rows.forEach(function (r) { tbody.appendChild(r); });
      });
    })(i);
  }
}

// Toggle dark/light : alterne data-theme, persiste dans localStorage.
function bindThemeToggle() {
  var btn = document.getElementById('toggleTheme');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-theme');
    var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    // Si pas de choix manuel : on bascule par rapport au système
    var next;
    if (current === 'dark') next = 'light';
    else if (current === 'light') next = 'dark';
    else next = systemDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('aiad-dashboard-theme', next); } catch (e) {}
  });
}

// (#182) Annote automatiquement les balises code qui contiennent un ID AIAD
// (INTENT-NNN, SPEC-NNN-..., ADR-NNN, FACT-...) avec data-copy = leur
// textContent. Permet à un utilisateur de cliquer sur un ID dans n'importe
// quelle table pour le copier (Slack, Jira, PR description, etc.) sans que
// le rendu HTML ait à annoter chaque balise à la main.
function autoTagIds() {
  var re = /^(INTENT|SPEC|ADR|FACT)-[A-Za-z0-9-]+$/;
  var codes = document.querySelectorAll('code');
  codes.forEach(function (c) {
    if (c.hasAttribute('data-copy')) return;
    var txt = (c.textContent || '').trim();
    if (!re.test(txt)) return;
    c.setAttribute('data-copy', txt);
    c.setAttribute('role', 'button');
    c.setAttribute('tabindex', '0');
    c.setAttribute('title', 'Cliquer pour copier ' + txt);
    c.classList.add('id-copyable');
  });
}

// (#177) Click-to-copy : tout élément avec data-copy="..." copie sa valeur
// dans le presse-papier au clic ou via Enter/Space (a11y), avec un feedback
// éphémère "Copié !" qui s'efface au bout d'1.5s. Fail-safe sur navigateurs
// anciens (pas de navigator.clipboard) : on garde l'élément cliquable mais
// le copy est skip.
function bindCopyOnClick() {
  var els = document.querySelectorAll('[data-copy]');
  els.forEach(function (el) {
    function flash(message) {
      var original = el.textContent;
      el.textContent = message;
      el.classList.add('copied');
      setTimeout(function () {
        el.textContent = original;
        el.classList.remove('copied');
      }, 1500);
    }
    function copy() {
      var v = el.getAttribute('data-copy') || '';
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        flash('non supporté');
        return;
      }
      navigator.clipboard.writeText(v).then(
        function () { flash('Copié !'); },
        function () { flash('échec'); },
      );
    }
    el.addEventListener('click', copy);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copy(); }
    });
  });
}

// (#140) Mode "live" : polling de data.json toutes les N secondes pour
// détecter une régénération du dashboard. Si generatedAt change, affiche
// un toast persistant en bas à droite avec un bouton "Recharger".
// Désactivable via querystring ?live=0. Par défaut : actif (intervalle 30s).
// Le badge freshness (#145) reste affiché en haut et complète l'expérience.
// Fail-safe : si data.json n'est pas accessible (file://, CORS, 404),
// on stoppe silencieusement le polling et on ne perturbe pas le rendu.
function startLivePolling() {
  if (typeof window === 'undefined') return;
  var params = new URLSearchParams(window.location.search);
  if (params.get('live') === '0') return;
  var initialGeneratedAt = null;
  var consecutiveErrors = 0;
  var MAX_ERRORS = 3;
  var INTERVAL_MS = 30000;
  function readGeneratedAt() {
    var meta = document.querySelector('meta[name="aiad-generated-at"]');
    return meta ? meta.getAttribute('content') : null;
  }
  function showRefreshToast(newAt) {
    if (document.getElementById('aiad-live-toast')) return;
    var el = document.createElement('div');
    el.id = 'aiad-live-toast';
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;bottom:1rem;right:1rem;padding:.75rem 1rem;background:var(--ok-bg);color:var(--ok-fg);border-radius:8px;font-size:.875rem;box-shadow:0 2px 8px rgba(0,0,0,.15);z-index:9999;display:flex;gap:.75rem;align-items:center';
    var msg = document.createElement('span');
    msg.textContent = '↻ Données régénérées (' + newAt.slice(11, 16) + ')';
    var btn = document.createElement('button');
    btn.textContent = 'Recharger';
    btn.style.cssText = 'padding:.25rem .5rem;border:1px solid currentColor;border-radius:4px;background:transparent;color:inherit;cursor:pointer;font-weight:600';
    btn.onclick = function () { window.location.reload(); };
    el.appendChild(msg);
    el.appendChild(btn);
    document.body.appendChild(el);
  }
  initialGeneratedAt = readGeneratedAt();
  if (!initialGeneratedAt) return; // pas de meta → pas de polling
  setInterval(function () {
    fetch('data.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (d) {
      consecutiveErrors = 0;
      var current = d.generatedAt || (d.projet && d.projet.genere);
      if (current && current !== initialGeneratedAt) {
        showRefreshToast(current);
      }
    }).catch(function () {
      consecutiveErrors++;
      // Pas de spam : on logge une seule fois après 3 échecs et on arrête.
      if (consecutiveErrors === MAX_ERRORS) {
        console.log('[aiad] polling stoppé après 3 erreurs (file:// ou CORS ?)');
      }
    });
  }, INTERVAL_MS);
}

document.addEventListener('DOMContentLoaded', function () {
  var inputs = document.querySelectorAll('[data-filter-target]');
  inputs.forEach(function (inp) {
    bindFilter(inp.id, inp.getAttribute('data-filter-target'));
  });
  var sortables = document.querySelectorAll('table[data-sortable="true"]');
  sortables.forEach(bindSortable);
  bindThemeToggle();
  autoTagIds();     // (#182) annote les IDs avant le binding
  bindCopyOnClick();
  startLivePolling(); // (#140) polling 30s du data.json
});
`;
