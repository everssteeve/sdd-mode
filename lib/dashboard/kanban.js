// AIAD SDD Mode — Dashboard : page Kanban (#131 MVP).
//
// Vue Kanban à 4 colonnes (To-Do / In-Progress / Review / Done) des SPECs
// du projet. Chaque card expose : id (cliquable + copiable via #182),
// titre, intent parent (lien vers fichier), gouvernance Tier 1, présence
// tests (depuis la matrice de traçabilité), score SQS.
//
// Les sous-features restent en items futurs (à exécuter une fois ce MVP
// validé en usage) :
//   - (b) Détection parallélisme (frontmatter `parallel_with` ou code
//         touché en intersection)
//   - (c) Rôle-aware (filtres PM/PE/AE/QA/TL qui colorent les cards)
//   - (d) Intégration `/aiad standup` (ouvre la page avec `?lens=X&focus=today`)

import { escape } from './render.js';

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

  // Index spec → { tests, code } depuis matrice forward
  const matIndex = new Map();
  for (const e of matrice) {
    for (const { spec, tests, code } of e.specs) {
      if (spec) matIndex.set(spec.id, { tests, code, intentId: e.intent?.id });
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
  const intentLink = card.intentId
    ? `<div class="muted" style="font-size:.8rem;margin-top:.25rem">⤴ <code>${escape(card.intentId)}</code></div>`
    : '';
  const fileLink = card.file
    ? `<a href="../${escape(card.file)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">`
    : '';
  const fileClose = card.file ? '</a>' : '';
  // (#188) data-roles = liste des rôles pour qui cette card est dans le scope
  const roles = rolesPourCard(card, ctx).join(' ');
  return `<div class="kanban-card" data-roles="${roles}" style="background:var(--bg-alt);border:1px solid var(--border);border-radius:6px;padding:.65rem;margin-bottom:.5rem">
    ${fileLink}<div style="font-size:.85rem"><code>${escape(card.id)}</code></div>
    <div style="font-weight:600;margin-top:.25rem">${escape(card.titre)}</div>${fileClose}
    ${intentLink}
    <div style="display:flex;gap:.25rem;flex-wrap:wrap;margin-top:.5rem">
      ${sqsBadge}${testsBadge}${govBadges}
    </div>
  </div>`;
}

function blocConflits(conflits) {
  if (!conflits || conflits.length === 0) return '';
  const rows = conflits.slice(0, 10).map((c) => {
    const detail = c.raison === 'files-intersection'
      ? `${c.filesShared.length} fichier(s) partagé(s) : ${c.filesShared.slice(0, 3).map((f) => `<code>${escape(f)}</code>`).join(', ')}${c.filesShared.length > 3 ? '…' : ''}`
      : `même intent parent <code>${escape(c.intent || '')}</code>`;
    return `<li style="margin-bottom:.5rem"><code>${escape(c.a)}</code> ↔ <code>${escape(c.b)}</code> · ${detail}</li>`;
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
      });
    });
    apply(initial);
  })();</script>`;
  return `
${blocConflits(conflits)}
<section>
  <p class="muted">Vue Kanban des SPECs du projet. ${total} carte(s) au total — clique sur une carte pour ouvrir le fichier source.</p>
  ${lensSelector}
  <div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:stretch">${colsHtml}</div>
  ${lensScript}
</section>`;
}

export { calculerKanban as computeKanban, pageKanban as kanbanPage };
