function bindFilter(inputId, tableId) {
  var input = document.getElementById(inputId);
  var table = document.getElementById(tableId);
  if (!input || !table) return;
  // CA-002 @spec SPEC-016-2-design-system-rgaa @governance AIAD-RGAA
  if (!input.getAttribute('aria-label') && !document.querySelector('[for="' + inputId + '"]')) {
    input.setAttribute('aria-label', input.getAttribute('placeholder') || 'Filtrer');
  }
  input.addEventListener('input', function () {
    var q = input.value.toLowerCase();
    var rows = table.tBodies[0].rows;
    for (var i = 0; i < rows.length; i++) {
      var tr = rows[i];
      // (#425) Recherche aussi dans data-search-blob (contenu Intent body
      // qui n'est pas dans textContent quand <details> est replié).
      var blob = tr.getAttribute('data-search-blob') || '';
      var matchVisible = tr.textContent.toLowerCase().indexOf(q) >= 0;
      var matchBlob = blob.indexOf(q) >= 0;
      tr.style.display = (matchVisible || matchBlob) ? '' : 'none';
    }
  });
}

// Tri par colonne — déclenché au clic sur un th, alterne asc/desc.
// Lit data-sort sur les td quand présent (utilisé pour les badges /
// dates / nombres avec mise en forme HTML), sinon textContent.
function bindSortable(table) {
  var ths = table.tHead ? table.tHead.rows[0].cells : [];
  // CA-003b @spec SPEC-016-2-design-system-rgaa @governance AIAD-RGAA
  for (var k = 0; k < ths.length; k++) {
    if (!ths[k].getAttribute('scope')) ths[k].setAttribute('scope', 'col');
  }
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

// (#215) Glossaire AIAD : termes (clé, titre, description) injectés
// build-time depuis lib/dashboard/glossaire.js. Le helper autoTagGlossaire()
// parcourt le DOM au load et wrap les 1ères occurrences dans <dfn>.
var AIAD_GLOSSAIRE = [{"kw":"gouvernance Tier 1","titre":"Agent de gouvernance Tier 1","desc":"AI-ACT, RGPD, RGAA, RGESN, CRA. Ont un droit de veto sur le code/SPEC."},{"kw":"Intent Statement","titre":"Intent Statement","desc":"Le POURQUOI capturé avant toute spec. Document INTENT-NNN.md qui exprime le besoin, jamais la solution."},{"kw":"Execution Gate","titre":"Execution Gate","desc":"Validation humaine de la SPEC avant exécution. Vérifie SQS + EARS lint + Test de l'Étranger."},{"kw":"Souveraineté","titre":"Score Souveraineté","desc":"Score composite 0..100 (Bronze→Platinum) mesurant 5 dimensions : juridictions, agents Tier 1, langue, autorités, hébergement."},{"kw":"sovereignty","titre":"Score Souveraineté","desc":"Score composite 0..100 (Bronze→Platinum) mesurant 5 dimensions : juridictions, agents Tier 1, langue, autorités, hébergement."},{"kw":"Drift Lock","titre":"Drift Lock","desc":"Mécanisme qui détecte une désynchronisation code ↔ SPEC. Hook pre-commit + matrice de traçabilité."},{"kw":"Intents","titre":"Intent Statement","desc":"Le POURQUOI capturé avant toute spec. Document INTENT-NNN.md qui exprime le besoin, jamais la solution."},{"kw":"la Gate","titre":"Execution Gate","desc":"Validation humaine de la SPEC avant exécution. Vérifie SQS + EARS lint + Test de l'Étranger."},{"kw":"Intent","titre":"Intent Statement","desc":"Le POURQUOI capturé avant toute spec. Document INTENT-NNN.md qui exprime le besoin, jamais la solution."},{"kw":"Tier 1","titre":"Agent de gouvernance Tier 1","desc":"AI-ACT, RGPD, RGAA, RGESN, CRA. Ont un droit de veto sur le code/SPEC."},{"kw":"SPECs","titre":"SPEC","desc":"Spécification atomique (1 unité de livrable). Lie un Intent au code via @spec dans le code et @verified-by dans les tests."},{"kw":"drift","titre":"Drift Lock","desc":"Mécanisme qui détecte une désynchronisation code ↔ SPEC. Hook pre-commit + matrice de traçabilité."},{"kw":"SPEC","titre":"SPEC","desc":"Spécification atomique (1 unité de livrable). Lie un Intent au code via @spec dans le code et @verified-by dans les tests."},{"kw":"JNSP","titre":"JNSP — Je Ne Sais Pas","desc":"Verdict honnête plutôt qu'invention. Code spécial 2 dans les CLI AIAD : \"décision humaine requise\"."},{"kw":"SBOM","titre":"SBOM — Software Bill of Materials","desc":"Liste de tous les composants tiers (format CycloneDX). Exigé par le Cyber Resilience Act EU."},{"kw":"ADRs","titre":"ADR — Architecture Decision Record","desc":"Décision technique structurante documentée dans ARCHITECTURE.md sous forme **ADR-NNN** : décision."},{"kw":"EARS","titre":"EARS — Easy Approach to Requirements Syntax","desc":"Format de SPEC strict (WHEN/WHILE/IF/WHERE + sujet + SHALL). Activé via format: EARS en frontmatter."},{"kw":"DPIA","titre":"DPIA — Data Protection Impact Assessment","desc":"Analyse d'impact relative à la protection des données (Article 35 RGPD, méthode CNIL en 9 sections)."},{"kw":"DORA","titre":"DORA Metrics","desc":"Deployment Frequency, Lead Time, Change Failure Rate, MTTR — métriques de performance d'équipe."},{"kw":"SQS","titre":"SQS — Spec Quality Score","desc":"Score 0..5 attribué par la Gate. >= 4/5 → la SPEC est prête à être exécutée par l'agent."},{"kw":"ADR","titre":"ADR — Architecture Decision Record","desc":"Décision technique structurante documentée dans ARCHITECTURE.md sous forme **ADR-NNN** : décision."}];

// Containers où on cherche les termes (skip <code>, <a>, <dfn>, <input>,
// <pre>, <script>, <button>, <select>, <textarea>).
var GLOSSAIRE_TAGS = ['P', 'LI', 'TD', 'SUMMARY', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN'];
var GLOSSAIRE_SKIP = ['CODE', 'A', 'DFN', 'INPUT', 'PRE', 'SCRIPT', 'BUTTON', 'SELECT', 'TEXTAREA'];

function autoTagGlossaire() {
  if (!AIAD_GLOSSAIRE || AIAD_GLOSSAIRE.length === 0) return;
  // (#216) Opt-out via ?notooltips=1 ou localStorage.aiad-no-tooltips=1
  try {
    var sp = new URLSearchParams(window.location.search);
    if (sp.get('notooltips') === '1') {
      try { localStorage.setItem('aiad-no-tooltips', '1'); } catch (e) {}
      return;
    }
    if (localStorage.getItem('aiad-no-tooltips') === '1') return;
  } catch (e) { /* contexte sans window/URL → continue */ }
  // Map keyword → 1 = pas encore taggé (déduplicage : 1ère occurrence
  // seulement, évite le spam visuel sur les pages avec 20 mentions de SPEC).
  var dejaVus = Object.create(null);
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function walk(node) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (GLOSSAIRE_SKIP.indexOf(node.tagName) >= 0) return;
    // Si on est dans un tag candidat, on traite les text-nodes enfants
    var isCandidat = GLOSSAIRE_TAGS.indexOf(node.tagName) >= 0;
    var enfants = Array.from(node.childNodes);
    for (var i = 0; i < enfants.length; i++) {
      var c = enfants[i];
      if (c.nodeType === Node.TEXT_NODE && isCandidat) {
        // Cherche le 1er terme non-taggé qui match
        var txt = c.nodeValue;
        for (var j = 0; j < AIAD_GLOSSAIRE.length; j++) {
          var t = AIAD_GLOSSAIRE[j];
          if (dejaVus[t.kw]) continue;
          // Match exact mot/expression (boundary \b sauf si commence/finit par non-word)
          var re = new RegExp('\\b' + escapeRe(t.kw) + '\\b');
          var m = txt.match(re);
          if (!m) continue;
          dejaVus[t.kw] = true;
          // Splitter le text-node en 3 parts
          var avant = txt.slice(0, m.index);
          var match = m[0];
          var apres = txt.slice(m.index + match.length);
          var dfn = document.createElement('dfn');
          dfn.className = 'aiad-term';
          dfn.title = t.titre + ' — ' + t.desc;
          dfn.textContent = match;
          var parent = c.parentNode;
          if (avant) parent.insertBefore(document.createTextNode(avant), c);
          parent.insertBefore(dfn, c);
          if (apres) {
            var apresNode = document.createTextNode(apres);
            parent.insertBefore(apresNode, c);
          }
          parent.removeChild(c);
          break; // 1 transformation par text-node, sinon faut re-scanner
        }
      } else if (c.nodeType === Node.ELEMENT_NODE) {
        walk(c);
      }
    }
  }
  walk(document.body);
}

// (#231) Filtres rapides PM sur intents.html — chips qui filtrent les
// rows par data-tags (zombie / draft-vieux / sans-spec / sans-livraison).
// Un seul groupe de chips actif à la fois, "*" = aucun filtre actif.
function bindPmFilterChips() {
  var groupes = document.querySelectorAll('[data-pm-filter-target]');
  groupes.forEach(function (g) {
    var tableId = g.getAttribute('data-pm-filter-target');
    var table = document.getElementById(tableId);
    if (!table) return;
    var rows = table.querySelectorAll('tbody tr');
    var boutons = g.querySelectorAll('button[data-pm-filter]');
    boutons.forEach(function (b) {
      b.addEventListener('click', function () {
        var filtre = b.getAttribute('data-pm-filter');
        boutons.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        rows.forEach(function (r) {
          if (filtre === '*') { r.style.display = ''; return; }
          var tags = (r.getAttribute('data-tags') || '').split(/\s+/);
          r.style.display = tags.indexOf(filtre) >= 0 ? '' : 'none';
        });
      });
    });
  });
}

// CA-003/CA-003b @spec SPEC-016-2-design-system-rgaa @governance AIAD-RGAA
function initA11yTables() {
  var tables = document.querySelectorAll('table');
  tables.forEach(function (t) {
    var ths = t.tHead && t.tHead.rows[0] ? Array.prototype.slice.call(t.tHead.rows[0].cells) : [];
    ths.forEach(function (th) {
      if (th.tagName === 'TH' && !th.getAttribute('scope')) th.setAttribute('scope', 'col');
    });
    if (!t.querySelector('caption')) {
      var cap = document.createElement('caption');
      cap.textContent = t.getAttribute('data-a11y-caption') || 'Tableau de données';
      t.insertBefore(cap, t.firstChild);
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  var inputs = document.querySelectorAll('[data-filter-target]');
  inputs.forEach(function (inp) {
    bindFilter(inp.id, inp.getAttribute('data-filter-target'));
  });
  var sortables = document.querySelectorAll('table[data-sortable="true"]');
  sortables.forEach(bindSortable);
  initA11yTables();
  bindThemeToggle();
  autoTagIds();     // (#182) annote les IDs avant le binding
  bindCopyOnClick();
  autoTagGlossaire(); // (#215) tooltips sur le jargon AIAD
  bindPmFilterChips(); // (#231) chips PM sur intents.html
  startLivePolling(); // (#140) polling 30s du data.json
});
