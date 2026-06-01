// AIAD SDD Mode — Dashboard : SQS readiness scorecard par Intent (#484).
//
// Agrège les scores SQS de toutes les SPECs liées à un Intent pour
// répondre : "cet Intent est-il prêt à shipper (SQS ≥ 4/5 partout) ou
// y a-t-il un maillon faible ?"
//
// Politique :
//   - Lit `spec.sqs` (parsé par `lireChampPriorite` dans collect.js)
//   - SPEC sans SQS → comptée mais classée "à scorer"
//   - Intent classé :
//       * `ready`        : ≥ 1 SPEC liée ET toutes ≥ 4
//       * `partial`      : mix — au moins 1 SPEC ≥ 4, mais au moins 1 < 4
//       * `to-score`     : ≥ 1 SPEC liée mais aucune n'a de score
//       * `needs-work`   : ≥ 1 SPEC liée ET toutes < 4
//       * `no-spec`      : aucune SPEC liée (Intent encore à décomposer)
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const SEUIL = 4;

function moyenne(arr) {
  if (!arr.length) return null;
  return Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10;
}

export function classerIntent(specsLiees) {
  const total = specsLiees.length;
  if (total === 0) return { etat: 'no-spec', total: 0, score: { min: null, avg: null, scored: 0 } };
  const scored = specsLiees
    .map((s) => Number(s.sqs))
    .filter((n) => !isNaN(n) && n >= 0);
  if (scored.length === 0) return { etat: 'to-score', total, score: { min: null, avg: null, scored: 0 } };
  const min = Math.min(...scored);
  const avg = moyenne(scored);
  let etat;
  if (scored.length === total && min >= SEUIL) etat = 'ready';
  else if (scored.some((s) => s >= SEUIL)) etat = 'partial';
  else etat = 'needs-work';
  return { etat, total, score: { min, avg, scored: scored.length } };
}

export function calculerSqsReadiness(donnees) {
  // Map SPECs par INTENT-NNN (court).
  const specsParCourt = new Map();
  for (const s of donnees?.specs || []) {
    if (!s.parentIntent) continue;
    const court = String(s.parentIntent).split('-').slice(0, 2).join('-');
    if (!specsParCourt.has(court)) specsParCourt.set(court, []);
    specsParCourt.get(court).push(s);
  }
  const items = [];
  for (const i of donnees?.intents || []) {
    if (['done', 'archived'].includes(i.statut)) continue;
    const court = i.id.split('-').slice(0, 2).join('-');
    const specs = specsParCourt.get(court) || [];
    const c = classerIntent(specs);
    items.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      priority: i.priority || null,
      ...c,
      specsFaibles: specs.filter((s) => !isNaN(Number(s.sqs)) && Number(s.sqs) < SEUIL)
        .map((s) => ({ id: s.id, sqs: Number(s.sqs), titre: s.titre || '' })),
    });
  }
  // Tri : ready en bas (rassurant), needs-work en tête.
  const RANK = { 'needs-work': 0, partial: 1, 'to-score': 2, 'no-spec': 3, ready: 4 };
  items.sort((a, b) => (RANK[a.etat] ?? 99) - (RANK[b.etat] ?? 99));
  const totaux = {
    total: items.length,
    ready: items.filter((i) => i.etat === 'ready').length,
    partial: items.filter((i) => i.etat === 'partial').length,
    needsWork: items.filter((i) => i.etat === 'needs-work').length,
    toScore: items.filter((i) => i.etat === 'to-score').length,
    noSpec: items.filter((i) => i.etat === 'no-spec').length,
  };
  return { items, totaux, seuil: SEUIL };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const SR_CSS = `<style>
.sr-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:.5rem; margin:.5rem 0; }
.sr-stat { padding:.5rem .7rem; border-radius:.35rem; text-align:center; }
.sr-stat .sr-val { font-size:1.35rem; font-weight:700; }
.sr-stat .sr-label { font-size:.72rem; text-transform:uppercase; letter-spacing:.05em; color:var(--muted, #777); }
.sr-stat.lvl-ready { background:rgba(43,138,62,.08); border:1px solid rgba(43,138,62,.3); }
.sr-stat.lvl-partial { background:rgba(232,89,12,.06); border:1px solid rgba(232,89,12,.25); }
.sr-stat.lvl-needs-work { background:rgba(201,42,42,.07); border:1px solid rgba(201,42,42,.3); }
.sr-stat.lvl-to-score { background:rgba(127,127,127,.07); border:1px dashed var(--border, #ccc); }
.sr-stat.lvl-no-spec { background:rgba(127,127,127,.04); border:1px dashed var(--border, #ccc); color:var(--muted, #777); }
.sr-row { padding:.4rem .55rem; margin:.3rem 0; border-radius:.3rem; background:rgba(127,127,127,.04); display:flex; gap:.5rem; flex-wrap:wrap; align-items:baseline; }
.sr-row.row-needs-work { border-left:3px solid #c92a2a; background:rgba(201,42,42,.04); }
.sr-row.row-partial { border-left:3px solid #e8590c; background:rgba(232,89,12,.03); }
.sr-row.row-to-score { border-left:3px dashed var(--border, #ccc); }
.sr-row.row-ready { border-left:3px solid #2b8a3e; }
.sr-row.row-no-spec { border-left:3px dashed var(--border, #ccc); opacity:.75; }
.sr-meta { font-size:.78rem; color:var(--muted, #777); }
.sr-weak { font-size:.75rem; padding:.15rem .4rem; background:rgba(201,42,42,.1); color:#7a1717; border-radius:.2rem; }
</style>`;

const LABELS = {
  ready: 'Prêts à shipper',
  partial: 'Partiels (au moins 1 SPEC faible)',
  'needs-work': 'À retravailler (toutes SPEC < 4)',
  'to-score': 'À scorer (SPECs sans SQS)',
  'no-spec': 'Sans SPEC liée',
};

const SHORT_LABELS = {
  ready: '✓ Ready',
  partial: '⚠ Partial',
  'needs-work': '✗ À retravailler',
  'to-score': '? À scorer',
  'no-spec': '⊘ Sans SPEC',
};

export function blocSqsReadiness(donnees) {
  const r = donnees?.sqsReadiness;
  if (!r) return '';
  if (r.items.length === 0) {
    return `${SR_CSS}<section>
      <h2>SQS readiness scorecard <span class="count">aucun Intent actif</span></h2>
      <p class="muted" style="font-size:.85rem">Aucun Intent à scorer (tous done/archived). Le scorecard agrège les SQS des SPECs liées à chaque Intent actif/in-progress pour identifier les **maillons faibles** avant exec.</p>
    </section>`;
  }
  const t = r.totaux;
  const grid = ['ready', 'partial', 'needs-work', 'to-score', 'no-spec']
    .map((etat) => `<div class="sr-stat lvl-${etat}">
      <div class="sr-val">${t[etat === 'needs-work' ? 'needsWork' : etat === 'to-score' ? 'toScore' : etat === 'no-spec' ? 'noSpec' : etat] || 0}</div>
      <div class="sr-label">${escape(LABELS[etat])}</div>
    </div>`).join('');
  const rows = r.items.slice(0, 20).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const sc = it.score;
    const scoreTxt = sc.scored > 0 ? `min ${sc.min}/5 · moyenne ${sc.avg}/5 · ${sc.scored}/${it.total} scorées` : (it.total > 0 ? `${it.total} SPEC(s) sans SQS` : 'aucune SPEC liée');
    const weaks = it.specsFaibles.length > 0 ? it.specsFaibles.slice(0, 3).map((s) => `<span class="sr-weak">${escape(s.id)} → ${s.sqs}/5</span>`).join(' ') : '';
    return `<div class="sr-row row-${escape(it.etat)}">
      <strong>${idCell}</strong>
      <span>${escape(it.titre)}</span>
      <span class="sr-meta">[${escape(it.statut || '?')}${it.priority ? ` · ${escape(String(it.priority).toUpperCase())}` : ''}]</span>
      <span class="sr-meta">${escape(SHORT_LABELS[it.etat] || it.etat)}</span>
      <span class="sr-meta">${escape(scoreTxt)}</span>
      ${weaks}
    </div>`;
  }).join('');
  const ready = t.ready;
  const blockers = (t.needsWork || 0) + (t.partial || 0);
  const summary = blockers > 0
    ? `<p class="muted" style="font-size:.85rem">⚠ <strong>${blockers} Intent(s) bloqué(s)</strong> par une ou plusieurs SPECs &lt; ${r.seuil}/5 → ouvrir <code>/sdd gate</code> sur les SPECs faibles avant <code>/sdd exec</code>.</p>`
    : `<p class="muted" style="font-size:.85rem">✓ <strong>${ready}/${t.total} Intent(s) prêts à shipper</strong> (toutes SPECs ≥ ${r.seuil}/5).</p>`;
  return `${SR_CSS}<section>
    <h2>SQS readiness scorecard <span class="count">${t.total} Intent(s) actif(s) — seuil ${r.seuil}/5</span></h2>
    <p class="muted" style="font-size:.85rem">Agrégation des SQS des SPECs liées par Intent : un Intent ready a TOUTES ses SPECs ≥ ${r.seuil}/5. Permet d'identifier les maillons faibles avant <code>/sdd exec</code>.</p>
    <div class="sr-grid">${grid}</div>
    ${summary}
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  classerIntent as classifyIntent,
  calculerSqsReadiness as computeSqsReadiness,
  blocSqsReadiness as sqsReadinessSection,
};
