// AIAD SDD Mode — Dashboard : page Kanban (#131 MVP).
//
// Vue Kanban à 4 colonnes (To-Do / In-Progress / Review / Done) des SPECs
// du projet. Chaque card expose : id (cliquable + copiable via #182),
// titre, intent parent (lien vers fichier), gouvernance Tier 1, présence
// tests (depuis la matrice de traçabilité), score SQS.
//
// Les sous-features sont toutes livrées :
//   - (b) #187 Détection parallélisme (frontmatter `parallel_with` ou code
//         touché en intersection)
//   - (c) #188 Rôle-aware (filtres PM/PE/AE/QA/TL qui colorent les cards)
//   - (d) #189 Intégration `/aiad standup` (ouvre la page avec `?lens=X&focus=today`)

import { escape, hrefSource, lienSource } from './render.js';

// Mapping statut → colonne. Statuts AIAD :
//   draft        → To-Do (idée, pas encore validée)
//   ready        → To-Do (validée, prête à exécution)
//   in-progress  → In-Progress
//   review       → Review (post-implémentation, avant validation)
//   validation   → Review
//   done         → Done
//   archived     → caché (ne pas afficher)
const COLONNES = [
  { id: 'todo',        titre: 'To-Do',        statuts: ['draft', 'ready'] },
  { id: 'in-progress', titre: 'In-Progress',  statuts: ['in-progress'] },
  { id: 'review',      titre: 'Review',       statuts: ['review', 'validation'] },
  { id: 'done',        titre: 'Done',         statuts: ['done'] },
];

export function calculerKanban(donnees) {
  const specs = donnees?.specs || [];
  const matrice = donnees?.matrice?.forward || [];

  // Index spec → { tests, code, intent } depuis matrice forward.
  // (#331) intentFile capté ici pour permettre l'hyperlien `⤴ INTENT-NNN` côté rendu.
  const matIndex = new Map();
  for (const e of matrice) {
    for (const { spec, tests, code } of e.specs) {
      if (spec) matIndex.set(spec.id, { tests, code, intentId: e.intent?.id, intentFile: e.intent?.file });
    }
  }

  // Lecture du frontmatter gouvernance par SPEC : déjà parsé dans
  // donnees.specs[].governance s'il est exposé. Sinon on lit en best-effort.
  function gouvernance(spec) {
    const g = spec.governance || spec.gouvernance;
    if (!g) return [];
    return String(g).split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  }

  const result = COLONNES.map((col) => ({
    id: col.id, titre: col.titre, statuts: col.statuts,
    cards: [],
  }));

  for (const s of specs) {
    const statut = (s.statut || s.status || '').toLowerCase();
    const col = result.find((c) => c.statuts.includes(statut));
    if (!col) continue; // archived, unknown → caché
    const m = matIndex.get(s.id) || { tests: [], code: [], intentId: s.parentIntent };
    col.cards.push({
      id: s.id,
      titre: s.titre || s.title || s.id,
      intentId: m.intentId || s.parentIntent || null,
      // (#331) intentFile exposé pour hyperlien card → fichier Intent.
      intentFile: m.intentFile || null,
      statut,
      sqs: s.sqs,
      governance: gouvernance(s),
      testsCount: m.tests.length,
      codeCount: m.code.length,
      file: s.file,
    });
  }

  // Tri stable : SPECs ordonnées par id dans chaque colonne (alphanumérique).
  for (const col of result) {
    col.cards.sort((a, b) => a.id.localeCompare(b.id));
  }
  return result;
}

// ─── Détection des conflits de parallélisme (#187) ──────────────────────────
//
// Une paire de SPECs `in-progress` est en conflit quand :
//   1. Aucune des deux ne déclare l'autre dans `parallel_with` côté
//      frontmatter, ET
//   2. Elles partagent au moins 1 fichier de code (intersection scope) OU
//      le même `parentIntent` (souvent un signe de découpage mal fait).
//
// Le but : prévenir au merge time quand deux PEs ont pris en parallèle des
// SPECs qui se marchent dessus. Le PM doit alors arbitrer.

export function detecterConflitsParallelisme(donnees) {
  const specs = donnees?.specs || [];
  const forward = donnees?.matrice?.forward || [];
  const inProgress = specs.filter((s) => (s.statut || s.status || '').toLowerCase() === 'in-progress');
  if (inProgress.length < 2) return [];

  // Index spec → set des chemins code (depuis matrice)
  const codeIndex = new Map();
  for (const e of forward) {
    for (const { spec, code } of e.specs) {
      if (!spec) continue;
      codeIndex.set(spec.id, new Set((code || []).map((c) => c.path)));
    }
  }

  function declareCompatible(a, b) {
    const pa = new Set(a.parallelWith || []);
    const pb = new Set(b.parallelWith || []);
    return pa.has(b.id) || pb.has(a.id);
  }

  function intersection(a, b) {
    const sa = codeIndex.get(a.id) || new Set();
    const sb = codeIndex.get(b.id) || new Set();
    const inter = [...sa].filter((p) => sb.has(p));
    return inter;
  }

  const conflits = [];
  for (let i = 0; i < inProgress.length; i++) {
    for (let j = i + 1; j < inProgress.length; j++) {
      const a = inProgress[i];
      const b = inProgress[j];
      if (declareCompatible(a, b)) continue;
      const filesShared = intersection(a, b);
      const sameIntent = a.parentIntent && a.parentIntent === b.parentIntent;
      if (filesShared.length > 0 || sameIntent) {
        conflits.push({
          a: a.id,
          b: b.id,
          raison: filesShared.length > 0 ? 'files-intersection' : 'same-intent',
          filesShared,
          intent: sameIntent ? a.parentIntent : null,
        });
      }
    }
  }
  return conflits;
}

// ─── Lens role-aware (#188) ─────────────────────────────────────────────────
//
// Détermine quels rôles s'intéressent à chaque card du Kanban. Une card peut
// être "dans le scope" de plusieurs rôles (ex: SPEC done avec gouvernance
// Tier 1 → PM + AE). Le JS côté browser applique ensuite un highlight sur
// les cards en scope du rôle sélectionné.
//
// Règles :
//   PM : statuts done (à démontrer) ou review (à valider) ; Intents avec
//        SPEC done (rituel demo). Cible : "qu'est-ce que je dois valider ?"
//   PE : statuts ready ou in-progress. Cible : "ma queue à exécuter".
//   AE : SPECs avec gouvernance Tier 1 (peu importe le statut). Cible :
//        "où dois-je vérifier la conformité ?"
//   QA : SPECs review (à tester) ou ready/done sans test annoté. Cible :
//        "qu'est-ce que je dois tester ?"
//   TL : SPECs sans parentIntent (orphelin), conflits parallélisme,
//        ou SPECs avec ratio code/tests faible. Cible : "drift architecture".
export function rolesPourCard(card, ctx = {}) {
  const roles = [];
  const st = (card.statut || '').toLowerCase();
  const TIER1 = ['AIAD-AI-ACT', 'AIAD-RGPD', 'AIAD-RGAA', 'AIAD-RGESN', 'AIAD-CRA'];
  const aTier1 = (card.governance || []).some((g) => TIER1.includes(g));
  const conflits = ctx.conflits || [];
  const enConflit = conflits.some((c) => c.a === card.id || c.b === card.id);

  if (st === 'done' || st === 'review' || st === 'validation') roles.push('pm');
  if (st === 'ready' || st === 'in-progress') roles.push('pe');
  if (aTier1) roles.push('ae');
  if (st === 'review' || st === 'validation' || ((st === 'ready' || st === 'done') && card.testsCount === 0)) {
    roles.push('qa');
  }
  if (!card.intentId || enConflit || (card.codeCount > 0 && card.testsCount === 0)) roles.push('tl');
  return roles;
}

// ─── Focus du jour (#189) ───────────────────────────────────────────────────
//
// Le mode focus est activé par `?focus=today` (depuis /aiad standup). Il produit :
//   - une bannière listant au plus 3 alertes prioritaires à traiter "aujourd'hui",
//   - un filtre visuel qui masque les cards `draft` et `done` (statuts non
//     actionnables au standup).
//
// Règles de priorité des alertes (3 max, ordre stable) :
//   P1 — conflits de parallélisme (≥ 1 dans `conflits`)
//   P2 — review/validation en attente (PM/QA)
//   P3 — in-progress sans test annoté (drift à risque)
//   P4 — gouvernance Tier 1 dans `review` ou `in-progress` sans test
//   P5 — ready (queue PE à démarrer)
//
// L'argument `lens` (optionnel) priorise les alertes pertinentes au rôle :
//   pm  → P2 (review en attente) en tête
//   pe  → P5 (ready) puis P3 (in-progress sans test)
//   qa  → P2 et P3 prioritaires
//   ae  → P4 prioritaire (Tier 1 sans tests)
//   tl  → P1 prioritaire (conflits)
//
// Sortie : tableau de `{ priorite, titre, detail, action, cardIds }`.
export function calculerFocusAlertes(donnees, lens = 'all') {
  const cols = donnees?.kanban || calculerKanban(donnees);
  const conflits = donnees?.kanbanConflits || [];
  const TIER1 = ['AIAD-AI-ACT', 'AIAD-RGPD', 'AIAD-RGAA', 'AIAD-RGESN', 'AIAD-CRA'];
  const todo = cols.find((c) => c.id === 'todo')?.cards || [];
  const inProg = cols.find((c) => c.id === 'in-progress')?.cards || [];
  const review = cols.find((c) => c.id === 'review')?.cards || [];

  const candidats = [];

  if (conflits.length > 0) {
    candidats.push({
      priorite: 'P1',
      titre: `${conflits.length} conflit(s) de parallélisme`,
      detail: conflits.slice(0, 2).map((c) => `${c.a} ↔ ${c.b}`).join(' · '),
      action: 'PM doit arbitrer — ajouter `parallel_with` ou re-séquencer.',
      cardIds: conflits.flatMap((c) => [c.a, c.b]),
      roles: ['tl', 'pm'],
    });
  }

  if (review.length > 0) {
    candidats.push({
      priorite: 'P2',
      titre: `${review.length} SPEC(s) à valider`,
      detail: review.slice(0, 3).map((c) => c.id).join(' · '),
      action: 'PM/QA passe en revue pour fermer la boucle Drift Lock.',
      cardIds: review.map((c) => c.id),
      roles: ['pm', 'qa'],
    });
  }

  const inProgSansTest = inProg.filter((c) => c.codeCount > 0 && c.testsCount === 0);
  if (inProgSansTest.length > 0) {
    candidats.push({
      priorite: 'P3',
      titre: `${inProgSansTest.length} SPEC(s) in-progress sans test annoté`,
      detail: inProgSansTest.slice(0, 3).map((c) => c.id).join(' · '),
      action: 'QA/PE — ajouter `@verified-by` avant Drift Check.',
      cardIds: inProgSansTest.map((c) => c.id),
      roles: ['qa', 'pe'],
    });
  }

  const tier1Risque = [...review, ...inProg].filter((c) =>
    (c.governance || []).some((g) => TIER1.includes(g)) && c.testsCount === 0
  );
  if (tier1Risque.length > 0) {
    candidats.push({
      priorite: 'P4',
      titre: `${tier1Risque.length} SPEC(s) Tier 1 sans tests`,
      detail: tier1Risque.slice(0, 3).map((c) => `${c.id} (${(c.governance || []).join(',')})`).join(' · '),
      action: 'AE — exiger preuve avant gate ; risque veto.',
      cardIds: tier1Risque.map((c) => c.id),
      roles: ['ae', 'qa'],
    });
  }

  const ready = todo.filter((c) => (c.statut || '').toLowerCase() === 'ready');
  if (ready.length > 0) {
    candidats.push({
      priorite: 'P5',
      titre: `${ready.length} SPEC(s) prête(s) à exécuter`,
      detail: ready.slice(0, 3).map((c) => c.id).join(' · '),
      action: 'PE — démarrer la prochaine via `/sdd exec`.',
      cardIds: ready.map((c) => c.id),
      roles: ['pe'],
    });
  }

  if (lens && lens !== 'all') {
    candidats.sort((a, b) => {
      const ai = a.roles.includes(lens) ? 0 : 1;
      const bi = b.roles.includes(lens) ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return a.priorite.localeCompare(b.priorite);
    });
  }

  return candidats.slice(0, 3);
}

// (#190) Pré-calcule les 3 alertes prioritaires pour les 6 lenses (all + 5
// rôles). Utilisé par `pageKanban` pour rendre une bannière par lens (toggled
// par le JS au switch) et exposé dans `data.json#focusAlertes` pour les
// consommateurs externes (CI, scripts standup).
export function calculerFocusAlertesParLens(donnees) {
  const lenses = ['all', 'pm', 'pe', 'ae', 'qa', 'tl'];
  const out = {};
  for (const l of lenses) out[l] = calculerFocusAlertes(donnees, l);
  return out;
}

function blocFocus(alertes, lens) {
  if (!alertes || alertes.length === 0) {
    return `<section class="focus-banner" data-focus="empty" data-lens="${escape(lens || 'all')}" hidden>
      <div class="alerte alerte-ok">
        <div class="alerte-titre">🎯 Focus du jour — Rien d'urgent</div>
        <div class="alerte-detail">Backlog propre côté standup. Continuer le flux SPEC normal.</div>
      </div>
    </section>`;
  }
  const lensLabel = lens && lens !== 'all' ? ` · lens ${lens.toUpperCase()}` : '';
  const rows = alertes.map((a) => `
    <li style="margin-bottom:.5rem">
      <strong>${escape(a.priorite)} — ${escape(a.titre)}</strong>
      <div class="muted" style="font-size:.85rem">${escape(a.detail)}</div>
      <div style="font-size:.85rem;margin-top:.2rem">→ ${escape(a.action)}</div>
    </li>`).join('');
  return `<section class="focus-banner" data-focus="active" data-lens="${escape(lens || 'all')}" hidden>
    <div class="alerte alerte-warn" style="margin-bottom:1rem">
      <div class="alerte-titre">🎯 Focus du jour${escape(lensLabel)} — ${alertes.length} alerte(s) prioritaire(s)</div>
      <div class="alerte-detail" style="margin-top:.5rem">
        <ul style="margin:0;padding-left:1.2rem">${rows}</ul>
      </div>
      <div class="alerte-action" style="margin-top:.5rem">
        <a href="?lens=${escape(lens || 'all')}" style="font-size:.85rem">← Sortir du focus</a>
      </div>
    </div>
  </section>`;
}

// ─── Rendu HTML ─────────────────────────────────────────────────────────────

function renduCard(card, ctx = {}) {
  const govBadges = card.governance.slice(0, 3).map((g) =>
    `<span class="badge badge-info" style="font-size:.7rem">${escape(g)}</span>`
  ).join(' ');
  const testsBadge = card.testsCount > 0
    ? `<span class="badge badge-ok" style="font-size:.7rem">${card.testsCount} test(s)</span>`
    : '<span class="badge badge-warn" style="font-size:.7rem">0 test</span>';
  const sqsBadge = card.sqs != null
    ? `<span class="badge ${Number(card.sqs) >= 4 ? 'badge-ok' : 'badge-warn'}" style="font-size:.7rem">SQS ${card.sqs}</span>`
    : '';
  // (#331) "⤴ INTENT-NNN" hyperlié vers le fichier Intent (placé hors du
  // wrapper `<a>` parent — donc pas de nested-anchor).
  const intentLink = card.intentId
    ? `<div class="muted" style="font-size:.8rem;margin-top:.25rem">⤴ ${card.intentFile ? lienSource(card.intentFile, card.intentId) : `<code>${escape(card.intentId)}</code>`}</div>`
    : '';
  // (#313) Wrapper card-link respecte --source-base via hrefSource()
  const fileLink = card.file
    ? `<a href="${hrefSource(card.file)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">`
    : '';
  const fileClose = card.file ? '</a>' : '';
  // (#188) data-roles = liste des rôles pour qui cette card est dans le scope
  const roles = rolesPourCard(card, ctx).join(' ');
  // (#189) data-statut = clé pour le filtrage focus-mode (cache draft/done)
  const statut = (card.statut || '').toLowerCase();
  return `<div class="kanban-card" data-roles="${roles}" data-statut="${escape(statut)}" data-id="${escape(card.id || '')}" style="background:var(--bg-alt);border:1px solid var(--border);border-radius:6px;padding:.65rem;margin-bottom:.5rem">
    ${fileLink}<div style="font-size:.85rem"><code>${escape(card.id)}</code></div>
    <div style="font-weight:600;margin-top:.25rem">${escape(card.titre)}</div>${fileClose}
    ${intentLink}
    <div style="display:flex;gap:.25rem;flex-wrap:wrap;margin-top:.5rem">
      ${sqsBadge}${testsBadge}${govBadges}
    </div>
  </div>`;
}

function blocConflits(conflits, donnees) {
  if (!conflits || conflits.length === 0) return '';
  // (#354) Lookup specs/intents par ID pour hyperlier `SPECa ↔ SPECb` + `intent parent`.
  const specById = new Map((donnees?.specs || []).map((s) => [s.id, s]));
  const intentById = new Map((donnees?.intents || []).map((i) => [i.id, i]));
  const lienSpec = (id) => {
    const s = specById.get(id);
    return s?.file ? lienSource(s.file, id) : `<code>${escape(id)}</code>`;
  };
  const lienIntent = (id) => {
    if (!id) return '';
    const i = intentById.get(id);
    return i?.file ? lienSource(i.file, id) : `<code>${escape(id)}</code>`;
  };
  const rows = conflits.slice(0, 10).map((c) => {
    // (#332) Fichiers partagés hyperliés vers la source.
    const detail = c.raison === 'files-intersection'
      ? `${c.filesShared.length} fichier(s) partagé(s) : ${c.filesShared.slice(0, 3).map((f) => lienSource(f)).join(', ')}${c.filesShared.length > 3 ? '…' : ''}`
      : `même intent parent ${lienIntent(c.intent)}`;
    return `<li style="margin-bottom:.5rem">${lienSpec(c.a)} ↔ ${lienSpec(c.b)} · ${detail}</li>`;
  }).join('');
  return `<section>
    <div class="alerte alerte-bad" style="margin-bottom:1rem">
      <div class="alerte-titre">🚨 ${conflits.length} conflit(s) de parallélisme détecté(s)</div>
      <div class="alerte-detail" style="margin-top:.5rem">
        <ul style="margin:0;padding-left:1.2rem">${rows}</ul>
      </div>
      <div class="alerte-action" style="margin-top:.5rem">→ Le PM doit arbitrer ; ajouter <code>parallel_with: [SPEC-X]</code> dans le frontmatter si compatibles.</div>
    </div>
  </section>`;
}

export function pageKanban(donnees) {
  const cols = donnees?.kanban || calculerKanban(donnees);
  const conflits = donnees?.kanbanConflits || detecterConflitsParallelisme(donnees);
  const total = cols.reduce((s, c) => s + c.cards.length, 0);
  if (total === 0) {
    return `<div class="empty"><strong>Aucune SPEC à afficher.</strong>Lance <code>/sdd spec</code> pour en créer une.</div>`;
  }
  // (#189 + #190) Pré-calcul des alertes focus pour les 6 lenses. Chaque
  // bannière est rendue hidden ; le JS révèle uniquement celle qui matche la
  // lens active. Au switch de lens, le JS bascule de bannière sans reload.
  const donneesAvecAlertes = { ...donnees, kanban: cols, kanbanConflits: conflits };
  const alertesParLens = donnees?.focusAlertes || calculerFocusAlertesParLens(donneesAvecAlertes);
  const focusBanners = Object.entries(alertesParLens)
    .map(([lens, alertes]) => blocFocus(alertes, lens))
    .join('\n');
  const colsHtml = cols.map((col) => `
    <div class="kanban-col" data-col="${col.id}" style="flex:1;min-width:240px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:.75rem">
      <h3 style="margin-top:0;display:flex;justify-content:space-between;align-items:baseline">
        <span>${escape(col.titre)}</span>
        <span class="muted" style="font-size:.85rem">${col.cards.length}</span>
      </h3>
      ${col.cards.map((card) => renduCard(card, { conflits })).join('') || '<p class="muted" style="font-size:.85rem;text-align:center;padding:1rem 0">—</p>'}
    </div>`).join('');
  // (#188) Sélecteur de lens role-aware. Le JS inline lit `?lens=` ou
  // localStorage.aiad-kanban-lens, applique .in-scope/.out-scope aux cards
  // selon leur data-roles.
  const lensSelector = `
  <div class="kanban-lens" role="tablist" aria-label="Filtrer par rôle" style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.75rem">
    <button type="button" role="tab" data-lens="all" class="lens-btn active">Tout</button>
    <button type="button" role="tab" data-lens="pm"  class="lens-btn">PM</button>
    <button type="button" role="tab" data-lens="pe"  class="lens-btn">PE</button>
    <button type="button" role="tab" data-lens="ae"  class="lens-btn">AE</button>
    <button type="button" role="tab" data-lens="qa"  class="lens-btn">QA</button>
    <button type="button" role="tab" data-lens="tl"  class="lens-btn">TL</button>
  </div>`;
  const lensScript = `<script>(function(){
    var KEY='aiad-kanban-lens';
    var url=new URL(window.location.href);
    var initial=url.searchParams.get('lens') || localStorage.getItem(KEY) || 'all';
    // (#189) focus=today : masque draft/done, révèle la bannière focus.
    var focus=url.searchParams.get('focus')==='today';
    function applyFocus(on){
      document.body.classList.toggle('focus-mode', on);
      var activeLens=document.querySelector('.lens-btn.active')?.getAttribute('data-lens') || 'all';
      // (#190) Bascule entre 6 bannières lens-aware : on révèle uniquement
      // celle dont data-lens matche la lens active. Fallback "all" si la
      // bannière ciblée n'existe pas (build hétérogène).
      document.querySelectorAll('.focus-banner').forEach(function(b){
        var matches = b.getAttribute('data-lens') === activeLens;
        b.hidden = !(on && matches);
      });
      var nbHidden = document.querySelectorAll('.focus-banner:not([hidden])').length;
      if (on && nbHidden === 0) {
        var fallback = document.querySelector('.focus-banner[data-lens="all"]');
        if (fallback) fallback.hidden = false;
      }
      document.querySelectorAll('.kanban-card').forEach(function(c){
        var st=(c.getAttribute('data-statut')||'').toLowerCase();
        // Masque draft + done quand focus actif (statuts non actionnables au standup)
        var masque = on && (st==='draft' || st==='done');
        c.style.display = masque ? 'none' : '';
      });
      // Lien "Sortir du focus" : préserve la lens active.
      document.querySelectorAll('.focus-banner a').forEach(function(a){
        a.setAttribute('href', '?lens='+encodeURIComponent(activeLens));
      });
    }
    function apply(lens){
      var cards=document.querySelectorAll('.kanban-card');
      cards.forEach(function(c){
        var roles=(c.getAttribute('data-roles')||'').split(/\\s+/).filter(Boolean);
        if(lens==='all'){ c.classList.remove('in-scope'); c.classList.remove('out-scope'); }
        else if(roles.indexOf(lens)>-1){ c.classList.add('in-scope'); c.classList.remove('out-scope'); }
        else { c.classList.add('out-scope'); c.classList.remove('in-scope'); }
      });
      document.querySelectorAll('.lens-btn').forEach(function(b){
        if(b.getAttribute('data-lens')===lens) b.classList.add('active'); else b.classList.remove('active');
      });
    }
    document.querySelectorAll('.lens-btn').forEach(function(b){
      b.addEventListener('click', function(){
        var lens=b.getAttribute('data-lens');
        localStorage.setItem(KEY, lens);
        apply(lens);
        if(document.body.classList.contains('focus-mode')) applyFocus(true);
      });
    });
    apply(initial);
    applyFocus(focus);
  })();</script>`;
  // (#279) Search box client-side : filtre les .kanban-card par data-id +
  // texte visible. Cohérent avec graph.html qui a déjà un search.
  // Combinable avec lens/focus (additif via opacity 0 sur non-match).
  const searchBox = `
  <div class="kanban-search" style="margin-bottom:.75rem">
    <input type="search" id="kanban-search" placeholder="Rechercher SPEC (ID ou titre) — Cmd+F"
      style="width:100%;max-width:480px;padding:.5rem .75rem;border:1px solid var(--border);border-radius:6px;background:var(--bg-alt);color:var(--fg);font-size:.9rem"
      aria-label="Rechercher dans le kanban"/>
  </div>`;
  const searchScript = `<script>(function(){
    var input=document.getElementById('kanban-search');
    if(!input) return;
    function filtrer(){
      var q=input.value.trim().toLowerCase();
      var cards=document.querySelectorAll('.kanban-card');
      var visibles=0, total=cards.length;
      cards.forEach(function(c){
        if(!q){ c.style.display=''; visibles++; return; }
        var id=(c.getAttribute('data-id')||'').toLowerCase();
        var txt=(c.textContent||'').toLowerCase();
        var match=id.indexOf(q)>=0 || txt.indexOf(q)>=0;
        c.style.display=match?'':'none';
        if(match) visibles++;
      });
      // Annonce ARIA pour lecteurs d'écran
      input.setAttribute('aria-label', q?'Rechercher : '+visibles+'/'+total+' résultats':'Rechercher dans le kanban');
    }
    input.addEventListener('input', filtrer);
    // Cmd+F / Ctrl+F → focus sur la search box (UX standard)
    document.addEventListener('keydown', function(e){
      if((e.metaKey||e.ctrlKey)&&e.key==='f'){
        var k=document.querySelector('.kanban-card'); // sur kanban uniquement
        if(k){ e.preventDefault(); input.focus(); input.select(); }
      }
    });
  })();</script>`;
  return `
${blocConflits(conflits, donnees)}
${focusBanners}
<section>
  <p class="muted">Vue Kanban des SPECs du projet. ${total} carte(s) au total — clique sur une carte pour ouvrir le fichier source.</p>
  ${lensSelector}
  ${searchBox}
  <div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:stretch">${colsHtml}</div>
  ${lensScript}
  ${searchScript}
</section>`;
}

export { calculerKanban as computeKanban, pageKanban as kanbanPage, calculerFocusAlertes as computeFocusAlerts, calculerFocusAlertesParLens as computeFocusAlertsByLens };
