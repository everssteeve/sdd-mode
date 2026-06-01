// AIAD SDD Mode — Dashboard : cumulative flow diagram (CFD) PM (#449).
//
// Vue Kanban classique : pour chaque date des snapshots PM (#433), compte
// le nombre d'Intents par statut (draft, active, done, archived) et rend
// un area-chart empilé SVG. Donne au PM la lecture "santé du flow" :
//   - WIP qui gonfle (active >> done) → trop en parallèle
//   - Plateau done → livraison stoppée
//   - Backpressure draft → discovery saturée
//
// Source : `.aiad/metrics/pm-snapshots/*.json` lus par `lireSnapshots`
// (#433). Aucun calcul si < 2 snapshots disponibles.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

import { lireSnapshots } from './pm-diff.js';

const STATUTS_ORDRE = ['draft', 'active', 'review', 'in-progress', 'validation', 'done', 'archived'];
const COULEURS = {
  draft: '#fab005',
  active: '#4c6ef5',
  review: '#9775fa',
  'in-progress': '#3a86ff',
  validation: '#48bf91',
  done: '#2b8a3e',
  archived: '#868e96',
};

// Compte les Intents par statut pour un snapshot donné.
export function compterParStatut(snapshot) {
  const compteurs = {};
  for (const s of STATUTS_ORDRE) compteurs[s] = 0;
  compteurs.unknown = 0;
  for (const i of snapshot?.data?.intents || []) {
    const s = i.statut || 'unknown';
    if (compteurs[s] !== undefined) compteurs[s]++;
    else compteurs.unknown++;
  }
  return compteurs;
}

export function calculerCumulativeFlow(racineProjet, donnees, options = {}) {
  const lecteur = options.lecteur || (() => lireSnapshots(racineProjet));
  const snapshots = lecteur();
  if (snapshots.length === 0) return { points: [], statuts: [], snapshots: 0 };
  const points = snapshots.map((s) => ({
    date: s.date,
    par: compterParStatut(s),
  }));
  // Détermine les statuts effectivement présents (≥ 1 sur tout l'historique).
  const presents = new Set();
  for (const p of points) {
    for (const s of STATUTS_ORDRE) {
      if (p.par[s] > 0) presents.add(s);
    }
  }
  // Ordre canonique conservé (workflow gauche → droite).
  const statuts = STATUTS_ORDRE.filter((s) => presents.has(s));
  return {
    points,
    statuts,
    snapshots: snapshots.length,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const CFD_CSS = `<style>
.cfd-svg { width:100%; max-width: 720px; height: auto; }
.cfd-legend { display:flex; flex-wrap:wrap; gap:.5rem; margin:.4rem 0; font-size:.8rem; }
.cfd-leg-item { display:inline-flex; align-items:center; gap:.25rem; }
.cfd-leg-dot { display:inline-block; width:10px; height:10px; border-radius:50%; }
.cfd-table { font-size:.78rem; margin-top:.5rem; }
.cfd-table th, .cfd-table td { padding:.25rem .4rem; text-align:right; font-variant-numeric: tabular-nums; }
.cfd-table th:first-child, .cfd-table td:first-child { text-align: left; }
</style>`;

function rendreSvg(points, statuts) {
  if (points.length < 2 || statuts.length === 0) return '';
  const w = 720, h = 280;
  const padLeft = 36, padRight = 12, padTop = 14, padBottom = 28;
  const zoneW = w - padLeft - padRight;
  const zoneH = h - padTop - padBottom;
  // Total max sur la fenêtre pour échelle Y.
  let maxY = 0;
  for (const p of points) {
    const total = statuts.reduce((s, st) => s + (p.par[st] || 0), 0);
    if (total > maxY) maxY = total;
  }
  if (maxY === 0) maxY = 1;
  const stepX = points.length === 1 ? zoneW : zoneW / (points.length - 1);
  // Pour chaque statut, construire un polygone empilé. Ordre canonique
  // (draft en bas → archived en haut, plus stable visuellement).
  const polygones = [];
  // Pour chaque point, calcule cumul après chaque statut.
  const cumuls = points.map(() => 0);
  for (const s of statuts) {
    const hauts = points.map((p, i) => {
      cumuls[i] += p.par[s] || 0;
      return cumuls[i];
    });
    const bas = hauts.map((v, i) => v - (points[i].par[s] || 0));
    // Polygone bas-haut.
    const pointsBas = bas.map((v, i) => `${(padLeft + i * stepX).toFixed(1)},${(padTop + zoneH - (v / maxY) * zoneH).toFixed(1)}`);
    const pointsHaut = hauts.map((v, i) => `${(padLeft + i * stepX).toFixed(1)},${(padTop + zoneH - (v / maxY) * zoneH).toFixed(1)}`);
    const path = pointsBas.concat(pointsHaut.reverse()).join(' ');
    polygones.push(`<polygon points="${path}" fill="${COULEURS[s]}" fill-opacity="0.85" stroke="${COULEURS[s]}" stroke-width="0.5"><title>${escape(s)}</title></polygon>`);
  }
  // Axes + labels dates (1er, milieu, dernier).
  const idxLabels = points.length <= 5 ? points.map((_, i) => i) : [0, Math.floor(points.length / 2), points.length - 1];
  const labels = idxLabels.map((i) => {
    const x = padLeft + i * stepX;
    return `<text x="${x.toFixed(1)}" y="${(h - 4).toFixed(1)}" font-size="9" text-anchor="middle" fill="currentColor" opacity=".55">${escape(points[i].date.slice(5))}</text>`;
  }).join('');
  const yLabels = `
    <text x="${padLeft - 6}" y="${(padTop + 4).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">${maxY}</text>
    <text x="${padLeft - 6}" y="${(padTop + zoneH + 4).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">0</text>
  `;
  const axes = `
    <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${(padTop + zoneH).toFixed(1)}" stroke="currentColor" stroke-opacity=".4"/>
    <line x1="${padLeft}" y1="${(padTop + zoneH).toFixed(1)}" x2="${(w - padRight).toFixed(1)}" y2="${(padTop + zoneH).toFixed(1)}" stroke="currentColor" stroke-opacity=".4"/>
  `;
  return `<svg class="cfd-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Cumulative Flow Diagram, ${points.length} snapshots × ${statuts.length} statuts">
    ${polygones.join('')}
    ${axes}${yLabels}${labels}
  </svg>`;
}

function rendreLegende(statuts) {
  return statuts.map((s) => `<span class="cfd-leg-item"><span class="cfd-leg-dot" style="background:${COULEURS[s]}"></span>${escape(s)}</span>`).join('');
}

function rendreTable(points, statuts) {
  const lignes = points.slice(-5).map((p) => {
    const cells = statuts.map((s) => `<td>${p.par[s] || 0}</td>`).join('');
    const total = statuts.reduce((sum, s) => sum + (p.par[s] || 0), 0);
    return `<tr><td>${escape(p.date)}</td>${cells}<td><strong>${total}</strong></td></tr>`;
  }).join('');
  const headers = statuts.map((s) => `<th>${escape(s)}</th>`).join('');
  return `<table class="cfd-table">
    <thead><tr><th>Date</th>${headers}<th>Total</th></tr></thead>
    <tbody>${lignes}</tbody>
  </table>`;
}

export function blocCumulativeFlow(donnees) {
  const c = donnees?.cumulativeFlow;
  if (!c) return '';
  if (c.snapshots < 2) {
    return `<section>
      <h2>Cumulative Flow Diagram <span class="count">${c.snapshots} snapshot(s) — minimum 2 requis</span></h2>
      <p class="muted">Le CFD se construit dès que ≥ 2 snapshots PM (#433) sont persistés. Relance <code>aiad-sdd dashboard</code> sur plusieurs jours pour alimenter la vue temporelle de distribution des statuts.</p>
    </section>`;
  }
  return `${CFD_CSS}<section>
    <h2>Cumulative Flow Diagram <span class="count">${c.snapshots} snapshot(s) · ${c.statuts.length} statuts</span></h2>
    <p class="muted" style="font-size:.85rem">Distribution empilée des Intents par statut au fil du temps. Lecture Kanban classique : WIP qui gonfle = trop en parallèle · plateau done = livraison stoppée · backpressure draft = discovery saturée. Données : <code>.aiad/metrics/pm-snapshots/</code>.</p>
    <div class="cfd-legend">${rendreLegende(c.statuts)}</div>
    ${rendreSvg(c.points, c.statuts)}
    ${rendreTable(c.points, c.statuts)}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  compterParStatut as countByStatus,
  calculerCumulativeFlow as computeCumulativeFlow,
  blocCumulativeFlow as cumulativeFlowSection,
};
