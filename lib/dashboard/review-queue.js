// AIAD SDD Mode — Dashboard : SPECs in review queue (#507).
//
// Surface les SPECs actuellement en `review` ou `validation` que le PM
// doit valider avant qu'elles passent en `done`. Sans cette file
// visible, des SPECs restent en review pendant des semaines.
//
// Politique :
//   - Inclut tous statuts ∈ {`review`, `validation`}
//   - Tri par âge en review (mtime asc → plus ancien d'abord = urgent)
//   - Classe selon ancienneté : `frais ≤ 7j`, `tiede ≤ 14j`, `bloque > 14j`
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const DAY = 24 * 3600 * 1000;
const STATUTS_REVIEW = new Set(['review', 'validation']);

function classerAge(jours) {
  if (jours <= 7) return 'frais';
  if (jours <= 14) return 'tiede';
  return 'bloque';
}

export function calculerReviewQueue(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const items = [];
  for (const s of donnees?.specs || []) {
    if (!STATUTS_REVIEW.has(s.statut)) continue;
    const mtime = s.mtime || now;
    const ageJours = Math.floor((now - mtime) / DAY);
    items.push({
      id: s.id,
      titre: s.titre || '',
      file: s.file || null,
      statut: s.statut,
      parentIntent: s.parentIntent || null,
      mtime,
      ageJours,
      etat: classerAge(ageJours),
      sqs: typeof s.sqs === 'number' || (typeof s.sqs === 'string' && !isNaN(Number(s.sqs))) ? Number(s.sqs) : null,
    });
  }
  // Tri : bloqué d'abord, puis par age desc.
  items.sort((a, b) => b.ageJours - a.ageJours);
  return {
    items,
    totaux: {
      total: items.length,
      frais: items.filter((i) => i.etat === 'frais').length,
      tiede: items.filter((i) => i.etat === 'tiede').length,
      bloque: items.filter((i) => i.etat === 'bloque').length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const RQ_CSS = `<style>
.rq-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.rq-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.rq-stat .rq-val { font-size:1.25rem; font-weight:700; }
.rq-stat .rq-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.rq-stat.e-frais { background:rgba(43,138,62,.07); border-color:rgba(43,138,62,.3); }
.rq-stat.e-tiede { background:rgba(232,89,12,.05); border-color:rgba(232,89,12,.3); }
.rq-stat.e-bloque { background:rgba(201,42,42,.07); border-color:rgba(201,42,42,.3); }
.rq-row { padding:.35rem .5rem; margin:.2rem 0; font-size:.83rem; background:rgba(127,127,127,.04); border-radius:.25rem; display:flex; gap:.5rem; flex-wrap:wrap; align-items:baseline; }
.rq-row.r-bloque { border-left:3px solid #c92a2a; background:rgba(201,42,42,.04); }
.rq-row.r-tiede { border-left:3px solid #e8590c; background:rgba(232,89,12,.03); }
.rq-row.r-frais { border-left:3px solid #2b8a3e; }
.rq-meta { font-size:.74rem; color:var(--muted, #777); }
.rq-empty { padding:.5rem .7rem; background:rgba(43,138,62,.06); border-left:3px solid #2b8a3e; border-radius:.25rem; font-size:.85rem; color:#1c5a2a; }
</style>`;

const LABELS = { frais: '✓ Frais (≤ 7j)', tiede: '⚠ Tiède (8-14j)', bloque: '⛔ Bloqué (> 14j)' };

export function blocReviewQueue(donnees) {
  const r = donnees?.reviewQueue;
  if (!r) return '';
  if (r.items.length === 0) {
    return `${RQ_CSS}<section>
      <h2>File de revue SPECs <span class="count">file vide</span></h2>
      <div class="rq-empty">✓ Aucune SPEC en review/validation à traiter — le pipeline est fluide.</div>
    </section>`;
  }
  const t = r.totaux;
  const grid = ['bloque', 'tiede', 'frais'].map((etat) => `<div class="rq-stat e-${etat}">
      <div class="rq-val">${t[etat]}</div>
      <div class="rq-label">${escape(LABELS[etat])}</div>
    </div>`).join('');
  const rows = r.items.slice(0, 20).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const sqs = it.sqs != null ? `<span class="rq-meta">SQS ${it.sqs}/5</span>` : '';
    const parent = it.parentIntent ? `<span class="rq-meta">parent <code>${escape(it.parentIntent)}</code></span>` : '';
    return `<div class="rq-row r-${escape(it.etat)}">
      <strong>${idCell}</strong>
      <span>${escape((it.titre || '').slice(0, 56))}</span>
      <span class="rq-meta">[${escape(it.statut)}]</span>
      ${parent}
      <span class="rq-meta"><strong>${it.ageJours}j</strong> en review</span>
      ${sqs}
    </div>`;
  }).join('');
  const action = t.bloque > 0
    ? `<p class="muted" style="font-size:.85rem">⛔ <strong>${t.bloque} SPEC(s) bloquée(s) &gt; 14j en review</strong> — débloquer en priorité ou changer de statut (back to in-progress / done).</p>`
    : `<p class="muted" style="font-size:.85rem">✓ Aucune SPEC bloquée — file en bon état.</p>`;
  return `${RQ_CSS}<section>
    <h2>File de revue SPECs <span class="count">${t.total} SPEC(s) en review/validation</span></h2>
    <p class="muted" style="font-size:.85rem">Surface les SPECs avec statut <code>review</code> ou <code>validation</code> qui attendent une décision PM. Tri par âge desc : la plus ancienne d'abord. Une SPEC qui stagne &gt; 14j en review = signal de blocage à débloquer.</p>
    <div class="rq-grid">${grid}</div>
    ${action}
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerReviewQueue as computeReviewQueue,
  blocReviewQueue as reviewQueueSection,
};
