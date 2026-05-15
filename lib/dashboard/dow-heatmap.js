// AIAD SDD Mode — Dashboard : day-of-week activity heatmap (#538).
//
// Distribution de l'activité (mtime des Intents + SPECs) par **jour de
// la semaine** (lundi → dimanche). Identifie les patterns de cadence
// PM/équipe : "on livre majoritairement le jeudi" ou "on travaille
// régulièrement le week-end".
//
// Pure transformation.

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function isoDayIndex(date) {
  // 0 = Lun, 6 = Dim (ISO)
  const d = new Date(date).getUTCDay();
  return d === 0 ? 6 : d - 1;
}

export function calculerDowHeatmap(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const fenetreJours = options.fenetreJours || 90;
  const limite = now - fenetreJours * 24 * 3600 * 1000;
  const buckets = Array(7).fill(null).map((_, i) => ({ jour: JOURS[i], idx: i, total: 0, intents: 0, specs: 0 }));
  for (const i of donnees?.intents || []) {
    if (!i.mtime || i.mtime < limite) continue;
    const idx = isoDayIndex(i.mtime);
    buckets[idx].intents++;
    buckets[idx].total++;
  }
  for (const s of donnees?.specs || []) {
    if (!s.mtime || s.mtime < limite) continue;
    const idx = isoDayIndex(s.mtime);
    buckets[idx].specs++;
    buckets[idx].total++;
  }
  const total = buckets.reduce((s, b) => s + b.total, 0);
  const maxTotal = Math.max(...buckets.map((b) => b.total), 1);
  const weekend = buckets[5].total + buckets[6].total;
  const semaine = total - weekend;
  return {
    buckets,
    total,
    maxTotal,
    weekend,
    semaine,
    fenetreJours,
    pourcentageWeekend: total === 0 ? 0 : Math.round((weekend / total) * 100),
    plusActif: buckets.slice().sort((a, b) => b.total - a.total)[0]?.jour || null,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const DH_CSS = `<style>
.dh-grid { display:grid; grid-template-columns: repeat(7, 1fr); gap:.3rem; margin:.4rem 0; }
.dh-cell { padding:.5rem; border-radius:.3rem; background:rgba(76,110,245,.1); text-align:center; font-size:.78rem; transition:background .15s; position:relative; }
.dh-cell.we { opacity:.85; }
.dh-cell .dh-count { font-size:1.05rem; font-weight:700; }
.dh-cell .dh-label { font-size:.7rem; color:var(--muted, #555); text-transform:uppercase; letter-spacing:.04em; }
.dh-cell.heavy { background:rgba(43,138,62,.25); color:#1c5a2a; }
.dh-cell.empty { background:rgba(127,127,127,.05); color:var(--muted, #aaa); }
.dh-meta { padding:.4rem .55rem; background:rgba(127,127,127,.05); border-radius:.25rem; font-size:.85rem; margin:.3rem 0; }
.dh-meta.weekend-heavy { background:rgba(232,89,12,.06); border-left:3px solid #e8590c; }
</style>`;

export function blocDowHeatmap(donnees) {
  const h = donnees?.dowHeatmap;
  if (!h) return '';
  if (h.total === 0) {
    return `${DH_CSS}<section>
      <h2>Heatmap activité par jour <span class="count">aucune activité sur ${h.fenetreJours}j</span></h2>
      <p class="muted" style="font-size:.85rem">Distribution de l'activité (mtime Intents + SPECs) par jour de la semaine sur ${h.fenetreJours} derniers jours.</p>
    </section>`;
  }
  const cells = h.buckets.map((b) => {
    const pct = b.total / h.maxTotal;
    let cls = 'dh-cell';
    if (b.idx >= 5) cls += ' we';
    if (b.total === 0) cls += ' empty';
    else if (pct >= 0.7) cls += ' heavy';
    return `<div class="${cls}" title="${b.jour} : ${b.total} (${b.intents} Intent + ${b.specs} SPEC)">
      <div class="dh-count">${b.total}</div>
      <div class="dh-label">${escape(b.jour)}</div>
    </div>`;
  }).join('');
  const weekendAlert = h.pourcentageWeekend > 25 ? 'weekend-heavy' : '';
  const wkndMsg = h.pourcentageWeekend > 25
    ? `⚠ <strong>${h.pourcentageWeekend}% d'activité le week-end</strong> — signal possible de pression équipe.`
    : `Week-end : ${h.pourcentageWeekend}% de l'activité.`;
  return `${DH_CSS}<section>
    <h2>Heatmap activité par jour <span class="count">${h.total} activité(s) sur ${h.fenetreJours}j — pic ${escape(h.plusActif || '?')}</span></h2>
    <p class="muted" style="font-size:.85rem">Distribution de l'activité (mtime Intents + SPECs) par jour de la semaine. Identifie les patterns de cadence (jours de livraison, présence week-end).</p>
    <div class="dh-grid">${cells}</div>
    <div class="dh-meta ${weekendAlert}">${wkndMsg} Jour le plus actif : <strong>${escape(h.plusActif)}</strong>. Semaine ${h.semaine} / week-end ${h.weekend}.</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerDowHeatmap as computeDowHeatmap,
  blocDowHeatmap as dowHeatmapSection,
};
