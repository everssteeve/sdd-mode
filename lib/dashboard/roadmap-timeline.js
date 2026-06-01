// AIAD SDD Mode — Dashboard : roadmap timeline Gantt-light (#499).
//
// Visualisation Gantt-light des Intents avec target_date. Pour chaque
// Intent non-archived avec un `target_date`, dessine un trait horizontal :
//   - début   = mtime du fichier (proxy date de création)
//   - fin     = target_date parsé
//   - couleur = selon proximité (vert si > 30j, orange ≤ 30j, rouge en retard)
//
// Permet une lecture trimestrielle visuelle : "qu'est-ce qui arrive
// à échéance dans les 3 prochains mois ?".
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const DAY = 24 * 3600 * 1000;

export function parseTargetDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  // Format direct ISO
  const t = Date.parse(s);
  if (!isNaN(t)) return t;
  // Format Q?-YYYY → fin du trimestre
  const mQ = s.match(/Q(\d)[-\s]?(\d{4})/i);
  if (mQ) {
    const q = parseInt(mQ[1], 10);
    const y = parseInt(mQ[2], 10);
    if (q >= 1 && q <= 4) {
      const finMois = q * 3; // Q1 → mars (3), Q2 → juin (6)…
      return Date.UTC(y, finMois, 0, 23, 59); // dernier jour du mois
    }
  }
  return null;
}

function classerProximite(echeance, now) {
  const delta = echeance - now;
  if (delta < 0) return 'retard';
  if (delta <= 30 * DAY) return 'urgent';
  if (delta <= 90 * DAY) return 'proche';
  return 'distant';
}

export function calculerRoadmapTimeline(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const items = [];
  for (const i of donnees?.intents || []) {
    if (['archived'].includes(i.statut)) continue;
    const echeance = parseTargetDate(i.target_date || i.targetDate || i.target);
    if (echeance == null) continue;
    const debut = i.mtime || now - 60 * DAY;
    items.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      priority: i.priority || null,
      debut,
      echeance,
      proximite: classerProximite(echeance, now),
      target: i.target_date || i.targetDate || i.target,
    });
  }
  items.sort((a, b) => a.echeance - b.echeance);
  return {
    items,
    plage: items.length ? { min: Math.min(...items.map((i) => i.debut), now - 30 * DAY), max: Math.max(...items.map((i) => i.echeance), now + 30 * DAY) } : null,
    now,
    totaux: {
      total: items.length,
      retard: items.filter((i) => i.proximite === 'retard').length,
      urgent: items.filter((i) => i.proximite === 'urgent').length,
      proche: items.filter((i) => i.proximite === 'proche').length,
      distant: items.filter((i) => i.proximite === 'distant').length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const RT_CSS = `<style>
.rt-gantt { width:100%; max-width:760px; height:auto; }
.rt-row { padding:.3rem 0; }
.rt-meta { font-size:.78rem; color:var(--muted, #777); display:flex; gap:.5rem; flex-wrap:wrap; margin-top:.3rem; }
.rt-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:.4rem; margin:.4rem 0; }
.rt-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.rt-stat.p-retard { background:rgba(201,42,42,.07); border-color:rgba(201,42,42,.3); }
.rt-stat.p-urgent { background:rgba(232,89,12,.06); border-color:rgba(232,89,12,.3); }
.rt-stat.p-proche { background:rgba(255,193,7,.05); border-color:rgba(255,193,7,.3); }
.rt-stat.p-distant { background:rgba(43,138,62,.06); border-color:rgba(43,138,62,.3); }
.rt-stat .rt-val { font-size:1.2rem; font-weight:700; }
.rt-stat .rt-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
</style>`;

function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }) : '—'; }

function rendreGantt(items, plage, now) {
  if (items.length === 0 || !plage) return '';
  const w = 760, h = Math.max(180, items.length * 24 + 60);
  const padLeft = 200, padRight = 18, padTop = 30, padBottom = 28;
  const zoneW = w - padLeft - padRight;
  const totalMs = plage.max - plage.min || 1;
  const xAt = (ts) => padLeft + ((ts - plage.min) / totalMs) * zoneW;
  // Mois ticks : un tick par mois sur la plage.
  const ticks = [];
  let cur = new Date(plage.min);
  cur.setUTCDate(1);
  cur.setUTCHours(0, 0, 0, 0);
  while (cur.getTime() <= plage.max) {
    ticks.push({ ts: cur.getTime(), label: new Date(cur).toLocaleDateString('fr-FR', { month: 'short' }) });
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  const xNow = xAt(now);
  const rows = items.map((it, i) => {
    const y = padTop + i * 24 + 6;
    const x1 = xAt(it.debut);
    const x2 = xAt(it.echeance);
    const barW = Math.max(8, x2 - x1);
    const couleur = it.proximite === 'retard' ? '#c92a2a'
      : it.proximite === 'urgent' ? '#e8590c'
      : it.proximite === 'proche' ? '#f5a623' : '#2b8a3e';
    const label = (it.titre || it.id).slice(0, 24);
    const prioTag = it.priority ? `[${String(it.priority).toUpperCase()}] ` : '';
    return `<text x="${(padLeft - 8).toFixed(1)}" y="${(y + 12).toFixed(1)}" font-size="10" text-anchor="end" fill="currentColor"><title>${escape(it.id)} — ${escape(it.titre || '')}</title>${escape(prioTag + label)}</text>
      <rect x="${x1.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="14" fill="${couleur}" rx="2"><title>${escape(it.id)}\nDébut : ${fmtDate(it.debut)}\nÉchéance : ${fmtDate(it.echeance)} (${it.proximite})</title></rect>
      <text x="${(x2 + 4).toFixed(1)}" y="${(y + 11).toFixed(1)}" font-size="9" fill="currentColor" opacity=".7">${escape(fmtDate(it.echeance))}</text>`;
  }).join('');
  const tickLines = ticks.map((t) => {
    const x = xAt(t.ts);
    return `<line x1="${x.toFixed(1)}" y1="${padTop.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(h - padBottom).toFixed(1)}" stroke="currentColor" stroke-opacity=".1"/>
      <text x="${x.toFixed(1)}" y="${(padTop - 6).toFixed(1)}" font-size="9" text-anchor="middle" fill="currentColor" opacity=".55">${escape(t.label)}</text>`;
  }).join('');
  return `<svg class="rt-gantt" viewBox="0 0 ${w} ${h}" role="img" aria-label="Roadmap timeline Gantt-light">
    ${tickLines}
    <line x1="${xNow.toFixed(1)}" y1="${(padTop - 4).toFixed(1)}" x2="${xNow.toFixed(1)}" y2="${(h - padBottom + 4).toFixed(1)}" stroke="#c92a2a" stroke-width="1.5" stroke-dasharray="3,3"><title>Maintenant</title></line>
    <text x="${xNow.toFixed(1)}" y="${(h - padBottom + 18).toFixed(1)}" font-size="9" text-anchor="middle" fill="#c92a2a" font-weight="500">maintenant</text>
    ${rows}
  </svg>`;
}

export function blocRoadmapTimeline(donnees) {
  const r = donnees?.roadmapTimeline;
  if (!r) return '';
  if (r.items.length === 0) {
    return `${RT_CSS}<section>
      <h2>Roadmap timeline <span class="count">aucun target_date</span></h2>
      <p class="muted" style="font-size:.85rem">Ajoute <code>target_date:</code> au frontmatter des Intents (format ISO YYYY-MM-DD ou Q1-2026) pour visualiser la roadmap en Gantt-light. Couleurs : 🔴 retard, 🟠 urgent (≤ 30j), 🟡 proche (≤ 90j), 🟢 distant.</p>
    </section>`;
  }
  const t = r.totaux;
  const grid = ['retard', 'urgent', 'proche', 'distant'].map((p) => `<div class="rt-stat p-${p}">
      <div class="rt-val">${t[p]}</div>
      <div class="rt-label">${escape(p)}</div>
    </div>`).join('');
  return `${RT_CSS}<section>
    <h2>Roadmap timeline <span class="count">${t.total} Intent(s) avec target_date — Gantt-light SVG</span></h2>
    <p class="muted" style="font-size:.85rem">Pour chaque Intent avec <code>target_date</code> (ISO ou Q-YYYY), trait horizontal entre date de création (mtime) et échéance. Couleurs : 🔴 retard, 🟠 urgent ≤ 30j, 🟡 proche ≤ 90j, 🟢 distant. Trait rouge pointillé = maintenant.</p>
    <div class="rt-grid">${grid}</div>
    ${rendreGantt(r.items, r.plage, r.now)}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  parseTargetDate as parseDeadline,
  calculerRoadmapTimeline as computeRoadmapTimeline,
  blocRoadmapTimeline as roadmapTimelineSection,
};
