// AIAD SDD Mode — Dashboard : page QA (#135).
//
// Persona QA absente du dashboard avant la v1.15. Cette page agrège :
//   (a) SPECs ready sans tests              → queue actionnable
//   (b) coverage % par SPEC (via @verified-by) → indicateur de fiabilité
//   (c) rollup audit VALIDÉ/CORRECTIONS/REJET → suivi de l'effort qualité
//   (d) EARS lint status (R1-R7)            → qualité formelle des SPECs
//   (e) tests ajoutés cette semaine          → vitesse de couverture
//   (f) regression alerts                    → différé (nécessite historique CI)
//
// Aucun effet de bord : les helpers sont purs et consomment uniquement
// `donnees` produit par `collecterDonnees`. Le rendu HTML est encapsulé dans
// `pageQa()` pour suivre la convention render.js (helpers visuels privés).

import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, basename, relative } from 'node:path';
import { escape, lienSource, statutBadge, sqsBadge } from './render.js';
import { blocEdgeCases } from './edge-cases.js';

// ─── (f) Régressions — historique CI persisté (#155) ────────────────────────
//
// Lit `.aiad/metrics/tests/runs.jsonl` produit par la CI (1 ligne JSON par
// run). Format attendu pour chaque ligne :
//   { ts, sha?, branch?, total, passed, failed, failingTests: [...] }
//
// Calcule les régressions = tests présents dans `failingTests` du dernier
// run mais absents dans `failingTests` du run précédent. Idée : on flag le
// passage `pass → fail`, pas un échec persistant (qui sera déjà connu).

export function lireRunsHistory(racineProjet) {
  const chemin = join(racineProjet, '.aiad', 'metrics', 'tests', 'runs.jsonl');
  if (!existsSync(chemin)) return { fichier: null, runs: [] };
  const contenu = readFileSync(chemin, 'utf-8');
  const runs = [];
  for (const ligne of contenu.split('\n')) {
    const l = ligne.trim();
    if (!l) continue;
    try { runs.push(JSON.parse(l)); } catch { /* ignore ligne corrompue */ }
  }
  // Tri ascendant par ts (les jsonl peuvent être désordonnés en cas de
  // merge concurrent en CI).
  runs.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  return { fichier: relative(racineProjet, chemin), runs };
}

export function calculerRegressions(history) {
  const runs = history?.runs || [];
  if (runs.length < 2) {
    return { regressions: [], dernierRun: runs[runs.length - 1] || null, runPrecedent: null, total: 0 };
  }
  const dernier = runs[runs.length - 1];
  const precedent = runs[runs.length - 2];
  const failsAvant = new Set(precedent.failingTests || []);
  const failsApres = new Set(dernier.failingTests || []);
  const regressions = [...failsApres].filter((t) => !failsAvant.has(t));
  return {
    regressions,
    dernierRun: dernier,
    runPrecedent: precedent,
    total: regressions.length,
  };
}

// ─── (a) SPECs ready sans tests ─────────────────────────────────────────────

export function specsReadySansTests(donnees) {
  const matrice = donnees?.matrice;
  if (!matrice?.forward) return [];
  const queue = [];
  for (const entree of matrice.forward) {
    for (const { spec, tests, code } of entree.specs) {
      if (!spec) continue;
      const statut = (spec.status || spec.statut || '').toLowerCase();
      if (!['ready', 'in-progress', 'validation', 'done'].includes(statut)) continue;
      if (tests.length > 0) continue;
      // (#336) Expose file + parentIntentFile pour hyperliens render.
      queue.push({
        id: spec.id,
        titre: spec.titre || spec.title || spec.id,
        statut,
        parentIntent: entree.intent?.id || null,
        parentIntentFile: entree.intent?.file || null,
        file: spec.file || null,
        codeLies: code.length,
      });
    }
  }
  // Priorisation : statut puis nombre de fichiers code touchés (plus on a de
  // code sans test, plus le risque est élevé).
  const ordreStatut = { 'done': 0, 'validation': 1, 'in-progress': 2, 'ready': 3 };
  queue.sort((a, b) => {
    const sa = ordreStatut[a.statut] ?? 99;
    const sb = ordreStatut[b.statut] ?? 99;
    if (sa !== sb) return sa - sb;
    return b.codeLies - a.codeLies;
  });
  return queue;
}

// ─── (b) Coverage par SPEC ──────────────────────────────────────────────────
//
// Deux modes :
// (1) Coverage RÉEL (#156) — si `.aiad/metrics/tests/coverage-summary.json`
//     existe (format c8/istanbul json-summary), on agrège `lines.pct` des
//     fichiers code annotés par SPEC. Plus précis : couvre les vraies lignes
//     exécutées par les tests.
// (2) Coverage HEURISTIQUE (fallback) — ratio tests.length / code.length
//     (au moins un test pour N fichiers). Imprécis mais 0-dépendance.
//
// Bands :
//   - réel : ≥ 80% → ok, ≥ 50% → partiel, > 0 → faible, 0 → vide
//   - heuristique : ≥ 0.5 → ok, > 0 → partiel, = 0 → vide
//
// La source utilisée est exposée dans chaque ligne (`source: 'réel'|'heuristique'`).

// Lecture du json-summary c8/istanbul. Format attendu :
// { "total": { "lines": { "pct": N } }, "/abs/path.ts": { "lines": { "pct": N } }, ... }
// On normalise les clés vers des chemins relatifs au projet pour matcher
// les annotations.
export function lireCoverageReel(racineProjet) {
  const chemin = join(racineProjet, '.aiad', 'metrics', 'tests', 'coverage-summary.json');
  if (!existsSync(chemin)) return null;
  let raw;
  try { raw = readFileSync(chemin, 'utf-8'); } catch { return null; }
  let json;
  try { json = JSON.parse(raw); } catch { return null; }
  const map = new Map(); // path relatif → pct
  for (const [k, v] of Object.entries(json)) {
    if (k === 'total') continue;
    const pct = v?.lines?.pct;
    if (typeof pct !== 'number') continue;
    // Normalise vers chemin relatif (enlève prefix racine absolu si présent)
    let rel = k;
    if (rel.startsWith(racineProjet)) rel = rel.slice(racineProjet.length).replace(/^\//, '');
    map.set(rel, pct);
  }
  return {
    total: typeof json.total?.lines?.pct === 'number' ? json.total.lines.pct : null,
    files: map,
    file: relative(racineProjet, chemin),
  };
}

function bandReel(pct) {
  if (pct === null) return 'na';
  if (pct >= 80) return 'ok';
  if (pct >= 50) return 'partiel';
  if (pct > 0) return 'faible';
  return 'vide';
}

function bandHeuristique(ratio) {
  if (ratio === null) return 'na';
  if (ratio >= 0.5) return 'ok';
  if (ratio > 0) return 'partiel';
  return 'vide';
}

export function coverageParSpec(donnees, opts = {}) {
  const matrice = donnees?.matrice;
  if (!matrice?.forward) return [];
  const cov = opts.coverageReel ?? null;
  const lignes = [];
  for (const entree of matrice.forward) {
    for (const { spec, tests, code } of entree.specs) {
      if (!spec) continue;
      let entry;
      if (cov && cov.files && cov.files.size > 0 && code.length > 0) {
        // Coverage réel : moyenne des pct des fichiers code de cette SPEC
        const pcts = code.map((c) => cov.files.get(c.path)).filter((p) => typeof p === 'number');
        if (pcts.length > 0) {
          const pct = Math.round(pcts.reduce((s, n) => s + n, 0) / pcts.length);
          entry = {
            id: spec.id,
            titre: spec.titre || spec.title || spec.id,
            file: spec.file || null, // (#336) hyperlien SPEC dans render
            tests: tests.length,
            code: code.length,
            ratio: pct / 100,
            pct,
            band: bandReel(pct),
            source: 'réel',
          };
        }
      }
      if (!entry) {
        const ratio = code.length === 0 ? null : tests.length / code.length;
        entry = {
          id: spec.id,
          titre: spec.titre || spec.title || spec.id,
          file: spec.file || null, // (#336)
          tests: tests.length,
          code: code.length,
          ratio,
          pct: null,
          band: bandHeuristique(ratio),
          source: 'heuristique',
        };
      }
      lignes.push(entry);
    }
  }
  const order = { vide: 0, faible: 1, partiel: 2, ok: 3, na: 4 };
  lignes.sort((a, b) => order[a.band] - order[b.band]);
  return lignes;
}

// ─── (c) Rollup audit ───────────────────────────────────────────────────────
//
// Lit `.aiad/metrics/audit/*.md` via la collecte existante. Pour chaque
// fichier, extrait le `verdict` (VALIDÉ / CORRECTIONS / REJET).

export function auditRollup(donnees) {
  const cat = donnees?.metrics?.categories?.audit;
  const total = cat?.fichiers?.length || 0;
  const rollup = { VALIDÉ: 0, CORRECTIONS: 0, REJET: 0, AUTRE: 0, total };
  for (const f of cat?.fichiers || []) {
    const v = (f.data?.verdict || f.data?.Verdict || '').toString().trim().toUpperCase();
    if (v === 'VALIDÉ' || v === 'VALIDE' || v === 'PASS') rollup.VALIDÉ += 1;
    else if (v === 'CORRECTIONS' || v === 'WARN') rollup.CORRECTIONS += 1;
    else if (v === 'REJET' || v === 'FAIL') rollup.REJET += 1;
    else if (v) rollup.AUTRE += 1;
    else rollup.AUTRE += 1;
  }
  return rollup;
}

// ─── (d) EARS lint status (heuristique simple) ──────────────────────────────
//
// Détection : SPEC déclarant `Format : EARS` (frontmatter ou prose) sans
// SQS ≥ 4 → warning. Pas de relancement du linter complet ici (coûteux), on
// affiche le drapeau "à re-linter" qui pointe vers `/sdd gate`.

export function earsLintStatus(donnees) {
  const liste = [];
  for (const s of donnees?.specs || []) {
    if ((s.format || '').toLowerCase() !== 'ears') continue;
    const sqsNum = Number(s.sqs);
    const passant = !isNaN(sqsNum) && sqsNum >= 4;
    liste.push({
      id: s.id,
      titre: s.titre || s.id,
      file: s.file || null, // (#336) hyperlien SPEC dans render
      sqs: isNaN(sqsNum) ? null : sqsNum,
      passant,
    });
  }
  liste.sort((a, b) => (a.passant ? 1 : 0) - (b.passant ? 1 : 0));
  return {
    total: liste.length,
    passants: liste.filter((x) => x.passant).length,
    aRelinter: liste.filter((x) => !x.passant).length,
    liste,
  };
}

// ─── (e) Tests ajoutés cette semaine ────────────────────────────────────────
//
// Parcourt le scan code de la matrice (déjà construit), filtre les fichiers
// classés `kind: 'test'` et dont la mtime est < 7 jours.

export function testsAjoutesCetteSemaine(racineProjet, donnees) {
  // Si la matrice expose déjà des fichiers de test typés, on s'en sert ;
  // sinon on parcourt le filesystem en best-effort.
  const seuilMs = Date.now() - 7 * 24 * 3600 * 1000;
  const fichiers = donnees?.matrice?.testFiles || [];
  if (fichiers.length === 0) {
    // best-effort fallback : scanner test/ et tests/ s'ils existent
    return scanTestsFs(racineProjet, seuilMs);
  }
  const recents = [];
  for (const f of fichiers) {
    let st;
    try { st = statSync(join(racineProjet, f.path)); } catch { continue; }
    if (st.mtimeMs < seuilMs) continue;
    recents.push({ path: f.path, mtime: st.mtimeMs });
  }
  recents.sort((a, b) => b.mtime - a.mtime);
  return recents;
}

function scanTestsFs(racineProjet, seuilMs, dossiers = ['tests', 'test', '__tests__']) {
  const recents = [];
  for (const d of dossiers) {
    const dir = join(racineProjet, d);
    if (!existsSync(dir)) continue;
    walkTests(dir, seuilMs, recents, racineProjet);
  }
  recents.sort((a, b) => b.mtime - a.mtime);
  return recents;
}

function walkTests(dir, seuilMs, acc, racine, profondeur = 0) {
  if (profondeur > 4) return;
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const n of entries) {
    if (n.startsWith('.') || n === 'node_modules') continue;
    const p = join(dir, n);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walkTests(p, seuilMs, acc, racine, profondeur + 1);
    else if (/\.(test|spec)\.(ts|tsx|js|mjs|cjs|py)$/.test(n) && st.mtimeMs >= seuilMs) {
      acc.push({ path: relative(racine, p), mtime: st.mtimeMs });
    }
  }
}

// ─── Façade ─────────────────────────────────────────────────────────────────

export function calculerQa(racineProjet, donnees) {
  const history = lireRunsHistory(racineProjet);
  const regressions = calculerRegressions(history);
  const coverageReel = lireCoverageReel(racineProjet); // (#156) null si absent
  return {
    queueReadySansTests: specsReadySansTests(donnees),
    coverage: coverageParSpec(donnees, { coverageReel }),
    coverageReelTotal: coverageReel ? coverageReel.total : null,
    coverageReelFile: coverageReel ? coverageReel.file : null,
    audit: auditRollup(donnees),
    ears: earsLintStatus(donnees),
    testsRecents: testsAjoutesCetteSemaine(racineProjet, donnees),
    regressions, // (#155) { regressions: [...], dernierRun, runPrecedent, total }
    runsHistoryFile: history.fichier,
  };
}

// ─── Rendu HTML ─────────────────────────────────────────────────────────────
//
// Consomme `donnees.qa` (pré-calculé par dashboard.js via calculerQa).
// 5 sections + KPI panel. La régression (f) est listée comme placeholder
// car son agrégation nécessite un historique CI persisté (item futur).

// (#155) Bloc régressions — affiche soit un placeholder explicatif (pas
// d'historique CI), soit un récap "✓ aucune régression", soit la liste
// rouge des tests pass→fail.
function blocRegressions(qa) {
  const r = qa.regressions;
  if (!r || !r.dernierRun) {
    return `
<section>
  <h2>Régressions détectées</h2>
  <div class="empty"><strong>Aucun historique CI.</strong>Pour activer la détection, append une ligne JSON à <code>.aiad/metrics/tests/runs.jsonl</code> après chaque run de tests : <code>{"ts":...,"sha":"...","total":N,"passed":N,"failed":N,"failingTests":[]}</code>. Une simple commande post-run en CI suffit.</div>
</section>`;
  }
  if (r.total === 0) {
    const last = r.dernierRun;
    return `
<section>
  <h2>Régressions détectées <span class="count">0</span></h2>
  <div class="alertes ok"><span class="alertes-icon">✓</span><div><strong>Aucune régression au dernier run.</strong><div class="muted">${escape(String(last.passed ?? '?'))}/${escape(String(last.total ?? '?'))} tests passants${last.sha ? ' · sha ' + escape(String(last.sha).slice(0, 7)) : ''}.</div></div></div>
</section>`;
  }
  const rows = r.regressions.slice(0, 50).map((t) => `<tr><td><code>${escape(t)}</code></td></tr>`).join('');
  return `
<section>
  <h2>Régressions détectées <span class="count">${r.total} test(s) pass → fail</span></h2>
  <p class="muted">Comparaison du run le plus récent (${escape(new Date(r.dernierRun.ts).toLocaleString('fr-FR'))}) avec le précédent.</p>
  <table>
    <thead><tr><th>Test passant à fail</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

export function pageQa(donnees) {
  const qa = donnees.qa || {
    queueReadySansTests: [], coverage: [],
    audit: { VALIDÉ: 0, CORRECTIONS: 0, REJET: 0, AUTRE: 0, total: 0 },
    ears: { total: 0, passants: 0, aRelinter: 0, liste: [] },
    testsRecents: [],
    regressions: null,
  };
  const audit = qa.audit;

  const kpis = `
    <div class="kpi ${qa.queueReadySansTests.length === 0 ? 'ok' : 'warn'}">
      <div class="label">SPECs ready sans tests</div>
      <div class="value">${qa.queueReadySansTests.length}</div>
      <div class="delta">queue actionnable QA</div>
    </div>
    <div class="kpi">
      <div class="label">Audits VALIDÉ</div>
      <div class="value">${audit.VALIDÉ}</div>
      <div class="delta">sur ${audit.total} audit(s)</div>
    </div>
    <div class="kpi ${audit.CORRECTIONS > 0 ? 'warn' : ''}">
      <div class="label">CORRECTIONS demandées</div>
      <div class="value">${audit.CORRECTIONS}</div>
      <div class="delta">à reprendre</div>
    </div>
    <div class="kpi ${audit.REJET > 0 ? 'bad' : 'ok'}">
      <div class="label">REJETS</div>
      <div class="value">${audit.REJET}</div>
      <div class="delta">audit qualité bloquant</div>
    </div>
    <div class="kpi ${qa.ears.aRelinter > 0 ? 'warn' : 'ok'}">
      <div class="label">SPECs EARS à re-linter</div>
      <div class="value">${qa.ears.aRelinter}</div>
      <div class="delta">${qa.ears.total} SPEC(s) EARS</div>
    </div>
    <div class="kpi">
      <div class="label">Tests ajoutés cette semaine</div>
      <div class="value">${qa.testsRecents.length}</div>
      <div class="delta">fichiers .test/.spec mtime &lt; 7j</div>
    </div>
  `;

  // (#336) SPEC ID + parentIntent hyperliés vers leur fichier source.
  const queueRows = qa.queueReadySansTests.slice(0, 50).map((s) => `
    <tr><td>${s.file ? lienSource(s.file, s.id) : `<code>${escape(s.id)}</code>`}</td><td>${escape(s.titre)}</td>
    <td>${statutBadge(s.statut)}</td>
    <td>${s.parentIntent ? (s.parentIntentFile ? lienSource(s.parentIntentFile, s.parentIntent) : `<code>${escape(s.parentIntent)}</code>`) : '<em class="muted">—</em>'}</td>
    <td class="muted">${s.codeLies}</td></tr>`).join('');

  const coverageRows = qa.coverage.slice(0, 100).map((c) => {
    const pct = c.ratio === null ? '—' : Math.round(c.ratio * 100) + '%';
    const cls = c.band === 'vide' ? 'bad' : c.band === 'faible' ? 'bad' : c.band === 'partiel' ? 'warn' : c.band === 'ok' ? 'ok' : '';
    const sourceBadge = c.source === 'réel' ? '<span class="badge ok" title="Coverage agrégé depuis c8/istanbul">réel</span>' : '<span class="badge badge-muted" title="Ratio tests/code (fallback)">heuristique</span>';
    // (#336) Cell SPEC ID hyperliée.
    return `<tr><td>${c.file ? lienSource(c.file, c.id) : `<code>${escape(c.id)}</code>`}</td><td>${escape(c.titre)}</td>
      <td class="muted">${c.code}</td><td class="muted">${c.tests}</td>
      <td><span class="badge ${cls}">${escape(pct)}</span></td>
      <td>${sourceBadge}</td></tr>`;
  }).join('');

  // (#336) Cell SPEC ID hyperliée pour la table EARS lint.
  const earsRows = qa.ears.liste.slice(0, 50).map((e) => `
    <tr><td>${e.file ? lienSource(e.file, e.id) : `<code>${escape(e.id)}</code>`}</td><td>${escape(e.titre)}</td>
    <td>${e.sqs === null ? '<em class="muted">—</em>' : sqsBadge(e.sqs)}</td>
    <td>${e.passant ? '<span class="badge ok">passant</span>' : '<span class="badge warn">à re-linter</span>'}</td></tr>`).join('');

  const testsRecentsRows = qa.testsRecents.slice(0, 30).map((t) => `
    <tr><td>${lienSource(t.path)}</td><td class="muted">${new Date(t.mtime).toLocaleString('fr-FR')}</td></tr>`).join('');

  return `
<div class="kpis">${kpis}</div>

<section>
  <h2>Queue QA — SPECs ready sans tests <span class="count">${qa.queueReadySansTests.length} ouverture(s)</span></h2>
  ${qa.queueReadySansTests.length === 0
    ? '<div class="empty"><strong>Aucune SPEC ready sans test.</strong>Bravo — toutes les SPECs prêtes ont au moins un test annoté.</div>'
    : `<div class="filter"><input type="search" id="qQaQueue" data-filter-target="tQaQueue" placeholder="Filtrer la queue QA…" autocomplete="off"/></div>
      <table id="tQaQueue" data-sortable="true" data-a11y-caption="Queue QA — SPECs en attente de validation">
        <thead><tr><th>ID</th><th>Titre</th><th>Statut</th><th>Intent</th><th>Fichiers code</th></tr></thead>
        <tbody>${queueRows}</tbody>
      </table>`}
</section>

<section>
  <h2>Coverage par SPEC <span class="count">${qa.coverage.length} SPEC(s)${qa.coverageReelTotal !== null && qa.coverageReelTotal !== undefined ? ` · total ${qa.coverageReelTotal}%` : ''}</span></h2>
  ${qa.coverageReelFile
    ? `<p class="muted">Coverage réel agrégé depuis <code>${escape(qa.coverageReelFile)}</code> (c8/istanbul json-summary).</p>`
    : `<p class="muted">Coverage heuristique (ratio tests/code). Pour un coverage réel, écris <code>.aiad/metrics/tests/coverage-summary.json</code> en sortie de c8/istanbul.</p>`}
  ${qa.coverage.length === 0
    ? '<div class="empty">Aucune SPEC annotée pour l\'instant.</div>'
    : `<div class="filter"><input type="search" id="qQaCoverage" data-filter-target="tQaCoverage" placeholder="Filtrer par ID, titre, bande…" autocomplete="off"/></div>
      <table id="tQaCoverage" data-sortable="true" data-a11y-caption="Couverture EARS par SPEC">
        <thead><tr><th>ID</th><th>Titre</th><th>Code</th><th>Tests</th><th>Couverture</th><th>Source</th></tr></thead>
        <tbody>${coverageRows}</tbody>
      </table>`}
</section>

<section>
  <h2>EARS lint <span class="count">${qa.ears.total} SPEC(s) EARS · ${qa.ears.aRelinter} à re-linter</span></h2>
  ${qa.ears.total === 0
    ? '<div class="empty">Aucune SPEC au format EARS. Utilise <code>/sdd spec --ears</code> pour les domaines sensibles (sécurité, paiement, conformité).</div>'
    : `<div class="filter"><input type="search" id="qQaEars" data-filter-target="tQaEars" placeholder="Filtrer par ID, titre, SQS…" autocomplete="off"/></div>
      <table id="tQaEars" data-sortable="true" data-a11y-caption="SPECs EARS — résultats du lint">
        <thead><tr><th>ID</th><th>Titre</th><th>SQS</th><th>Lint</th></tr></thead>
        <tbody>${earsRows}</tbody>
      </table>`}
</section>

<section>
  <h2>Tests ajoutés cette semaine <span class="count">${qa.testsRecents.length} fichier(s)</span></h2>
  ${qa.testsRecents.length === 0
    ? '<div class="empty">Aucun fichier de test modifié dans les 7 derniers jours.</div>'
    : `<table data-sortable="true">
        <thead><tr><th>Fichier</th><th>Modifié</th></tr></thead>
        <tbody>${testsRecentsRows}</tbody>
      </table>`}
</section>

${blocRegressions(qa)}
${blocEdgeCases(donnees)}
`;
}

// Widget "Queue QA" affiché en haut de pageMetrics quand il y a du travail
// QA en attente (#157). Pont vers `qa.html` qui détaille chaque item. Caché
// quand la queue est vide pour ne pas polluer la page metrics. Placé ici
// (et pas dans render.js) pour respecter la limite stricte LOC.
export function blocQueueQa(donnees) {
  const qa = donnees?.qa;
  if (!qa) return '';
  const queue = qa.queueReadySansTests?.length || 0;
  const corrections = qa.audit?.CORRECTIONS || 0;
  const aRelinter = qa.ears?.aRelinter || 0;
  const total = queue + corrections + aRelinter;
  if (total === 0) return '';
  const items = [];
  if (queue > 0) items.push(`<strong>${queue}</strong> SPEC(s) ready sans test`);
  if (corrections > 0) items.push(`<strong>${corrections}</strong> audit(s) avec CORRECTIONS`);
  if (aRelinter > 0) items.push(`<strong>${aRelinter}</strong> SPEC(s) EARS à re-linter`);
  return `
<section>
  <a href="qa.html" class="alerte alerte-warn" style="display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div class="alerte-titre">Queue QA active — ${total} action(s) en attente</div>
      <div class="alerte-detail">${items.join(' · ')}</div>
    </div>
    <div class="alerte-action">→ ouvrir qa.html</div>
  </a>
</section>
`;
}

// Alias EN canoniques (#42)
export {
  specsReadySansTests as readySpecsWithoutTests,
  coverageParSpec as coveragePerSpec,
  auditRollup as auditRollupEN,
  earsLintStatus as earsLint,
  testsAjoutesCetteSemaine as recentTests,
  calculerQa as computeQa,
  pageQa as qaPage,
  blocQueueQa as queueQaBlock,
};
