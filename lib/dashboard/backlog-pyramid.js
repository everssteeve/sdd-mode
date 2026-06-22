// AIAD SDD Mode — Dashboard : backlog age pyramid histogram (#516).
//
// Histogramme de l'âge des Intents non-terminaux pour visualiser la
// distribution des âges et repérer des accumulations dans certains
// bandes.
//
// Buckets (en jours) :
//   - 0-7    "tout neuf"
//   - 8-30   "récent"
//   - 31-90  "mature"
//   - 91-180 "ancien"
//   - 181+   "héritage"
//
// Pure transformation.

const DAY = 24 * 3600 * 1000;

const BUCKETS = [
  { cle: 'neuf', label: '0-7j', max: 7, couleur: '#267336' },
  { cle: 'recent', label: '8-30j', max: 30, couleur: '#3b5bd9' },
  { cle: 'mature', label: '31-90j', max: 90, couleur: '#945500' },
  { cle: 'ancien', label: '91-180j', max: 180, couleur: '#c2410c' },
  { cle: 'heritage', label: '> 180j', max: Infinity, couleur: '#c92a2a' },
];

function bucketDe(jours) {
  for (const b of BUCKETS) {
    if (jours <= b.max) return b.cle;
  }
  return BUCKETS[BUCKETS.length - 1].cle;
}

export function calculerBacklogPyramid(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const intents = (donnees?.intents || []).filter((i) => !['done', 'archived'].includes(i.statut));
  const buckets = Object.fromEntries(BUCKETS.map((b) => [b.cle, { ...b, items: [], count: 0 }]));
  for (const i of intents) {
    if (!i.mtime) continue;
    const jours = Math.floor((now - i.mtime) / DAY);
    const c = bucketDe(jours);
    const e = buckets[c];
    e.count++;
    e.items.push({ id: i.id, titre: i.titre || '', file: i.file || null, jours, statut: i.statut });
  }
  for (const k of Object.keys(buckets)) {
    buckets[k].items.sort((a, b) => b.jours - a.jours);
  }
  const total = intents.filter((i) => i.mtime).length;
  return {
    buckets: BUCKETS.map((b) => buckets[b.cle]),
    total,
    ageMoyen: total === 0 ? 0 : Math.round(intents.reduce((s, i) => i.mtime ? s + (now - i.mtime) / DAY : s, 0) / total),
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const BP_CSS = `<style>
.bp-bar { display:flex; height:36px; border-radius:.3rem; overflow:hidden; margin:.4rem 0; background:rgba(127,127,127,.08); }
.bp-bar-seg { display:flex; align-items:center; justify-content:center; color:#fff; font-size:.78rem; font-weight:500; min-width:0; padding:0 .4rem; }
.bp-legend { display:flex; gap:.5rem; flex-wrap:wrap; font-size:.78rem; margin:.3rem 0; }
.bp-leg { display:inline-flex; gap:.3rem; align-items:baseline; padding:.2rem .45rem; border-radius:.2rem; background:rgba(127,127,127,.05); }
.bp-dot { width:.55rem; height:.55rem; border-radius:50%; display:inline-block; }
.bp-row { padding:.25rem .4rem; margin:.1rem 0; font-size:.78rem; background:rgba(127,127,127,.04); border-radius:.18rem; display:flex; gap:.4rem; align-items:baseline; }
.bp-row .bp-jours { font-weight:500; color:var(--muted, #555); }
.bp-bucket { margin-top:.3rem; }
.bp-bucket-h { font-weight:500; font-size:.78rem; margin:.3rem 0 .1rem; color:var(--muted, #777); text-transform:uppercase; letter-spacing:.04em; }
.bp-meta { padding:.4rem .55rem; background:rgba(127,127,127,.05); border-radius:.25rem; font-size:.85rem; margin:.3rem 0; }
</style>`;

export function blocBacklogPyramid(donnees) {
  const p = donnees?.backlogPyramid;
  if (!p) return '';
  if (p.total === 0) {
    return `${BP_CSS}<section>
      <h2>Pyramide d'âge backlog <span class="count">aucun Intent actif</span></h2>
      <p class="muted" style="font-size:.85rem">Histogramme de la distribution d'âge des Intents non-terminaux (5 buckets : neuf/récent/mature/ancien/héritage).</p>
    </section>`;
  }
  const segs = p.buckets.map((b) => {
    if (b.count === 0) return '';
    const pct = (b.count / p.total) * 100;
    return `<div class="bp-bar-seg" style="flex:${b.count} 0 0; background:${b.couleur}" title="${escape(b.label)} : ${b.count}">${b.count} ${b.cle}</div>`;
  }).filter(Boolean).join('');
  const legend = p.buckets.map((b) => `<span class="bp-leg"><span class="bp-dot" style="background:${b.couleur}"></span>${escape(b.label)} (${b.count})</span>`).join('');
  const details = p.buckets.filter((b) => b.count > 0).map((b) => {
    const rows = b.items.slice(0, 5).map((it) => {
      const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
      return `<div class="bp-row"><strong>${idCell}</strong> <span>${escape((it.titre || '').slice(0, 50))}</span> <span class="bp-jours">${it.jours}j · ${escape(it.statut || '?')}</span></div>`;
    }).join('');
    return `<div class="bp-bucket">
      <div class="bp-bucket-h">${escape(b.label)} — ${b.count} Intent(s)</div>
      ${rows}
    </div>`;
  }).join('');
  return `${BP_CSS}<section>
    <h2>Pyramide d'âge backlog <span class="count">${p.total} Intent(s) actif(s) — âge moyen ${p.ageMoyen}j</span></h2>
    <p class="muted" style="font-size:.85rem">Histogramme empilé de la distribution d'âge des Intents non-terminaux (5 buckets, couleurs progressives). Un accumulation dans "ancien" ou "héritage" signale un nettoyage à programmer.</p>
    <div class="bp-bar">${segs}</div>
    <div class="bp-legend">${legend}</div>
    <div class="bp-meta">Âge moyen : <strong>${p.ageMoyen} jours</strong> sur ${p.total} Intent(s) actif(s).</div>
    ${details}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerBacklogPyramid as computeBacklogPyramid,
  blocBacklogPyramid as backlogPyramidSection,
  BUCKETS as PYRAMID_BUCKETS,
};
