// AIAD SDD Mode — Dashboard : burnup chart cumulatif (#454).
//
// Pour chaque snapshot PM (#433), trace deux courbes :
//   - "scope total" : nombre d'Intents existants à cette date
//   - "complete"    : nombre d'Intents `done`/`archived` à cette date
//
// La distance entre les deux courbes est le travail restant. Vue
// canonique Lean/Agile complémentaire au CFD (#449) — le CFD montre la
// distribution, le burnup montre la convergence vers la complétion.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

import { lireSnapshots } from './pm-diff.js';

const STATUTS_COMPLETS = new Set(['done', 'archived']);

export function pointsBurnup(snapshots) {
  return snapshots.map((s) => {
    const intents = s.data?.intents || [];
    const total = intents.length;
    const done = intents.filter((i) => STATUTS_COMPLETS.has(i.statut)).length;
    return { date: s.date, total, done };
  });
}

// Projette la date estimée de complétion à 100 % par extrapolation
// linéaire sur les 2 derniers points (si vélocité positive).
export function estimerCompletion(points) {
  if (points.length < 2) return null;
  const der = points[points.length - 1];
  const av = points[points.length - 2];
  const dt = new Date(der.date).getTime() - new Date(av.date).getTime();
  const dDone = der.done - av.done;
  const dScope = der.total - av.total;
  if (dt <= 0) return null;
  // Vélocité nette = doneIncrement - scopeIncrement (le scope qui augmente
  // recule la cible).
  const velocite = (dDone - dScope) / dt; // items par ms
  if (velocite <= 0) return { vitesse: velocite, date: null, note: 'vélocité ≤ 0 — pas d\'estimation' };
  const restant = der.total - der.done;
  const tsCompletion = new Date(der.date).getTime() + (restant / velocite);
  return { vitesse: velocite, date: new Date(tsCompletion).toISOString().slice(0, 10), restant };
}

export function calculerBurnupChart(racineProjet, donnees, options = {}) {
  const lecteur = options.lecteur || (() => lireSnapshots(racineProjet));
  const snapshots = lecteur();
  if (snapshots.length === 0) return { points: [], estimation: null, snapshots: 0 };
  const points = pointsBurnup(snapshots);
  const estimation = estimerCompletion(points);
  return { points, estimation, snapshots: snapshots.length };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const BURNUP_CSS = `<style>
.burnup-svg { width:100%; max-width: 640px; height: auto; }
.burnup-legend { display:flex; gap:.7rem; font-size:.8rem; margin:.3rem 0; }
.burnup-leg-item { display:inline-flex; align-items:center; gap:.25rem; }
.burnup-leg-dot { display:inline-block; width:14px; height:3px; background:currentColor; border-radius:2px; }
.burnup-estim { padding:.4rem .55rem; background:rgba(76,110,245,.06); border-radius:.25rem; font-size:.85rem; margin:.4rem 0; }
.burnup-estim.no-eta { background:rgba(232,89,12,.06); }
</style>`;

function rendreSvg(points) {
  if (points.length < 2) return '';
  const w = 640, h = 240;
  const padLeft = 36, padRight = 12, padTop = 14, padBottom = 28;
  const zoneW = w - padLeft - padRight;
  const zoneH = h - padTop - padBottom;
  const maxY = Math.max(...points.map((p) => p.total), 1);
  const stepX = zoneW / (points.length - 1);
  const x = (i) => padLeft + i * stepX;
  const y = (v) => padTop + zoneH - (v / maxY) * zoneH;
  // Polyline scope total + done.
  const ptsScope = points.map((p, i) => `${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(' ');
  const ptsDone = points.map((p, i) => `${x(i).toFixed(1)},${y(p.done).toFixed(1)}`).join(' ');
  // Zone "restant" entre les 2 courbes.
  const zone = [...points.map((p, i) => `${x(i).toFixed(1)},${y(p.total).toFixed(1)}`),
    ...points.map((p, i) => `${x(points.length - 1 - i).toFixed(1)},${y(points[points.length - 1 - i].done).toFixed(1)}`)].join(' ');
  // Cercles + labels.
  const cerclesScope = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.total).toFixed(1)}" r="3" fill="#4c6ef5"><title>${escape(p.date)} : scope ${p.total}</title></circle>`).join('');
  const cerclesDone = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.done).toFixed(1)}" r="3" fill="#2b8a3e"><title>${escape(p.date)} : done ${p.done}</title></circle>`).join('');
  const dateLabels = (points.length <= 5 ? points.map((_, i) => i) : [0, Math.floor(points.length / 2), points.length - 1])
    .map((i) => `<text x="${x(i).toFixed(1)}" y="${(h - 4).toFixed(1)}" font-size="9" text-anchor="middle" fill="currentColor" opacity=".55">${escape(points[i].date.slice(5))}</text>`)
    .join('');
  const yLabels = `
    <text x="${padLeft - 4}" y="${(padTop + 4).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">${maxY}</text>
    <text x="${padLeft - 4}" y="${(padTop + zoneH + 4).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">0</text>
  `;
  return `<svg class="burnup-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Burnup chart, ${points.length} snapshots">
    <polygon points="${zone}" fill="#4c6ef5" fill-opacity="0.08"/>
    <polyline points="${ptsScope}" fill="none" stroke="#4c6ef5" stroke-width="2"/>
    <polyline points="${ptsDone}" fill="none" stroke="#2b8a3e" stroke-width="2"/>
    ${cerclesScope}${cerclesDone}
    <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${(padTop + zoneH).toFixed(1)}" stroke="currentColor" stroke-opacity=".4"/>
    <line x1="${padLeft}" y1="${(padTop + zoneH).toFixed(1)}" x2="${(w - padRight).toFixed(1)}" y2="${(padTop + zoneH).toFixed(1)}" stroke="currentColor" stroke-opacity=".4"/>
    ${yLabels}${dateLabels}
  </svg>`;
}

export function blocBurnupChart(donnees) {
  const b = donnees?.burnupChart;
  if (!b) return '';
  if (b.snapshots < 2) {
    return `<section>
      <h2>Burnup chart <span class="count">${b.snapshots} snapshot(s) — minimum 2 requis</span></h2>
      <p class="muted">Le burnup nécessite ≥ 2 snapshots PM (#433) pour tracer scope vs. done. Le dashboard en écrit un par jour — relance <code>aiad-sdd dashboard</code> demain pour la 1ère comparaison.</p>
    </section>`;
  }
  const der = b.points[b.points.length - 1];
  const pct = der.total > 0 ? Math.round((der.done / der.total) * 100) : 0;
  let estim = '';
  if (b.estimation && b.estimation.date) {
    estim = `<div class="burnup-estim">📅 ETA complétion (extrapolation linéaire 2 derniers points) : <strong>${escape(b.estimation.date)}</strong> · ${b.estimation.restant} Intent(s) restant(s).</div>`;
  } else if (b.estimation) {
    estim = `<div class="burnup-estim no-eta">⚠ Vélocité nulle ou négative sur les 2 derniers points — aucune ETA de complétion projetable.</div>`;
  }
  return `${BURNUP_CSS}<section>
    <h2>Burnup chart <span class="count">${der.done}/${der.total} Intents (${pct} %)</span></h2>
    <p class="muted" style="font-size:.85rem">Convergence scope vs. complétion (Intents done/archived). Vue canonique Lean/Agile — la distance entre les deux courbes = travail restant.</p>
    <div class="burnup-legend">
      <span class="burnup-leg-item" style="color:#4c6ef5"><span class="burnup-leg-dot"></span>scope total</span>
      <span class="burnup-leg-item" style="color:#2b8a3e"><span class="burnup-leg-dot"></span>complete (done + archived)</span>
    </div>
    ${rendreSvg(b.points)}
    ${estim}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  pointsBurnup as burnupPoints,
  estimerCompletion as estimateCompletion,
  calculerBurnupChart as computeBurnupChart,
  blocBurnupChart as burnupChartSection,
};
