// AIAD SDD Mode — Dashboard : heatmap d'activité PM (#464).
//
// Pour chaque jour des N derniers jours (défaut 60), compte les
// modifications cumulées d'Intents + SPECs + facts (mtime tombant sur
// ce jour). Rend un mini-calendrier GitHub-style 7 colonnes (jours de
// semaine) × N/7 lignes (semaines) avec opacité proportionnelle à
// l'activité.
//
// Source : mtime filesystem déjà collecté par #137/#446. Aucun
// snapshot supplémentaire requis.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const JOUR_MS = 24 * 3600 * 1000;

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Construit le tableau des N derniers jours (incluant aujourd'hui) avec
// leur count d'activité. Chaque jour porte aussi le jour de la semaine
// (0 = dimanche, 6 = samedi) pour le rendu calendrier.
export function calculerActivityHeatmap(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const nbJours = options.nbJours || 60;
  const debut = now - (nbJours - 1) * JOUR_MS;
  // Index counts par jour.
  const counts = new Map();
  function ajouter(item) {
    if (!item || !item.mtime) return;
    if (item.mtime < debut) return;
    const k = dayKey(item.mtime);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  for (const i of donnees?.intents || []) ajouter(i);
  for (const s of donnees?.specs || []) ajouter(s);
  for (const f of donnees?.facts || []) ajouter(f);

  // Génère les jours pour la grille.
  const jours = [];
  for (let i = 0; i < nbJours; i++) {
    const ts = debut + i * JOUR_MS;
    const d = new Date(ts);
    const key = dayKey(ts);
    jours.push({
      date: key,
      dow: d.getUTCDay(),
      count: counts.get(key) || 0,
    });
  }

  // Stats.
  const total = jours.reduce((s, d) => s + d.count, 0);
  const max = Math.max(...jours.map((d) => d.count), 0);
  const joursActifs = jours.filter((d) => d.count > 0).length;
  // Streak : nb de jours consécutifs avec activité, en partant du dernier
  // jour vers le passé.
  let streak = 0;
  for (let i = jours.length - 1; i >= 0; i--) {
    if (jours[i].count > 0) streak++;
    else break;
  }
  return {
    jours,
    nbJours,
    max,
    total,
    joursActifs,
    streak,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const HEAT_CSS = `<style>
.heat-grid { display: grid; grid-template-columns: auto repeat(var(--heat-cols), 12px); gap: 2px; align-items: center; margin: .5rem 0; }
.heat-dow-label { font-size: .65rem; color: var(--muted, #777); text-align: right; padding-right: .4rem; }
.heat-cell { width: 12px; height: 12px; border-radius: 2px; background: rgba(127,127,127,.08); }
.heat-cell.level-1 { background: rgba(76,110,245,.35); }
.heat-cell.level-2 { background: rgba(76,110,245,.55); }
.heat-cell.level-3 { background: rgba(76,110,245,.75); }
.heat-cell.level-4 { background: rgba(76,110,245,.95); }
.heat-legend { display: flex; gap: .25rem; align-items: center; font-size: .75rem; color: var(--muted, #777); margin: .3rem 0; }
.heat-stats { display: flex; gap: 1.2rem; margin: .3rem 0; font-size: .85rem; flex-wrap: wrap; }
.heat-stats strong { font-size: 1.1rem; }
</style>`;

function niveau(count, max) {
  if (count === 0 || max === 0) return 0;
  const ratio = count / max;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

export function blocActivityHeatmap(donnees) {
  const h = donnees?.activityHeatmap;
  if (!h) return '';
  if (h.total === 0) {
    return `<section>
      <h2>Heatmap activité PM <span class="count">aucune activité sur ${h.nbJours} jours</span></h2>
      <p class="muted">Aucun Intent / SPEC / fact modifié sur la fenêtre. Lance des éditions ou crée des Intents pour alimenter cette vue.</p>
    </section>`;
  }
  // Construit la grille : organise les jours en colonnes-semaines.
  // Première colonne = première semaine. Lignes = jours de la semaine
  // (dimanche en haut comme GitHub).
  // On groupe les jours en semaines (lundi-dimanche, ou tout autre).
  // Approche simple : N jours linéaires, on remplit colonne par colonne.
  const cols = Math.ceil(h.jours.length / 7);
  const grille = Array.from({ length: 7 }, () => Array(cols).fill(null));
  for (let i = 0; i < h.jours.length; i++) {
    const j = h.jours[i];
    const col = Math.floor(i / 7);
    const row = i % 7;
    grille[row][col] = j;
  }
  const dowLabels = ['Dim', 'Lun', '', 'Mer', '', 'Ven', ''];
  const rows = grille.map((rowDays, rowIdx) => {
    const label = `<div class="heat-dow-label">${dowLabels[rowIdx] || ''}</div>`;
    const cells = rowDays.map((d) => {
      if (!d) return '<div class="heat-cell"></div>';
      const lvl = niveau(d.count, h.max);
      return `<div class="heat-cell level-${lvl}" title="${escape(d.date)} : ${d.count} modification(s)"></div>`;
    }).join('');
    return label + cells;
  }).join('');
  const legendCells = [0, 1, 2, 3, 4].map((lvl) => `<span class="heat-cell level-${lvl}"></span>`).join(' ');
  return `${HEAT_CSS}<section>
    <h2>Heatmap activité PM <span class="count">${h.joursActifs} jours actifs / ${h.nbJours} · streak ${h.streak} j</span></h2>
    <p class="muted" style="font-size:.85rem">Modifications cumulées (Intents + SPECs + facts) par jour sur ${h.nbJours} jours. Plus la cellule est foncée, plus la journée a été active. Streak = nb de jours consécutifs avec activité depuis aujourd'hui.</p>
    <div class="heat-stats">
      <span>Total modifications : <strong>${h.total}</strong></span>
      <span>Pic journalier : <strong>${h.max}</strong></span>
      <span>Streak : <strong>${h.streak}</strong> j</span>
    </div>
    <div class="heat-grid" style="--heat-cols: ${cols}">${rows}</div>
    <div class="heat-legend">Moins <span style="display:contents">${legendCells}</span> Plus</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerActivityHeatmap as computeActivityHeatmap,
  blocActivityHeatmap as activityHeatmapSection,
};
