// AIAD SDD Mode — Dashboard : matrice RICE / Impact × Effort (#442).
//
// Quadrant PM canonique pour arbitrer entre Intents :
//   - Quick wins (high impact, low effort) — à attaquer en priorité
//   - Big bets (high impact, high effort) — à planifier
//   - Fill-ins (low impact, low effort) — opportunistes
//   - Time sinks (low impact, high effort) — à éviter
//
// Score impact = priority (P0=10, P1=7, P2=4, P3=2, P4=1) ou RICE/WSJF
// si présent. Score effort = nombre de SPECs liées (proxy) + bonus pour
// contraintes lourdes détectées (RGPD, dépendance, sécurité).
//
// Rendu SVG inline 360×280 avec axes + 4 quadrants colorés + points
// cliquables (anchors vers le fichier source via `lienSource`).
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const PRIORITY_IMPACT = { P0: 10, P1: 7, P2: 4, P3: 2, P4: 1 };

export function scoreImpact(intent) {
  if (!intent) return 0;
  // RICE prime si présent (R*I*C/E), sinon WSJF / 10, sinon priority.
  if (intent.rice != null) {
    const n = Number(intent.rice);
    if (Number.isFinite(n)) return Math.min(10, n / 10); // RICE typique 0-100
  }
  if (intent.wsjf != null) {
    const n = Number(intent.wsjf);
    if (Number.isFinite(n)) return Math.min(10, n);
  }
  if (intent.priority) {
    const k = String(intent.priority).toUpperCase();
    return PRIORITY_IMPACT[k] ?? 0;
  }
  return 0;
}

// Effort = (nombre de SPECs liées non-done) + bonus contraintes lourdes.
// Calcule sur 0..10, où 10 = chantier majeur, 1 = trivial.
const MOTS_CONTRAINTES_LOURDES = ['rgpd', 'pci dss', 'iso 27001', 'ai act', 'sebi', 'sox'];

export function scoreEffort(intent, specsLies = []) {
  let base = Math.min(8, specsLies.length * 2); // 2 SPECs = 4, 4 SPECs = 8
  // Bonus contraintes lourdes (jusqu'à +2)
  const corpus = String(intent?.sections?.contraintes || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  let bonus = 0;
  for (const m of MOTS_CONTRAINTES_LOURDES) {
    if (corpus.includes(m)) bonus += 0.8;
  }
  base += Math.min(2, bonus);
  // Plancher 1 (un Intent quelconque exige au moins un peu d'effort).
  return Math.max(1, Math.min(10, base));
}

export function quadrant(impact, effort) {
  // Seuil au milieu : score 5/10.
  if (impact >= 5 && effort < 5) return 'quick-wins';
  if (impact >= 5 && effort >= 5) return 'big-bets';
  if (impact < 5 && effort < 5) return 'fill-ins';
  return 'time-sinks';
}

export function calculerRiceMatrix(donnees) {
  const intents = donnees?.intents || [];
  const specsParIntent = new Map();
  for (const s of donnees?.specs || []) {
    if (!s.parentIntent) continue;
    const court = s.parentIntent.split('-').slice(0, 2).join('-');
    if (!specsParIntent.has(court)) specsParIntent.set(court, []);
    specsParIntent.get(court).push(s);
  }
  // Filtre les statuts done/archived (déjà livrés — non actionnables sur
  // la matrice de décision).
  const points = [];
  for (const i of intents) {
    if (['done', 'archived'].includes(i.statut)) continue;
    const court = i.id.split('-').slice(0, 2).join('-');
    const specsLies = specsParIntent.get(court) || [];
    const impact = scoreImpact(i);
    const effort = scoreEffort(i, specsLies);
    if (impact === 0 && effort === 1) continue; // Intent sans aucun signal → exclu
    points.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      impact,
      effort,
      quadrant: quadrant(impact, effort),
    });
  }
  const totaux = { 'quick-wins': 0, 'big-bets': 0, 'fill-ins': 0, 'time-sinks': 0 };
  for (const p of points) totaux[p.quadrant]++;
  return { points, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource, hrefSource } from './render.js';

const RICE_CSS = `<style>
.rice-grid { display:grid; grid-template-columns: 1fr 240px; gap: 1rem; align-items:start; }
@media (max-width: 900px) { .rice-grid { grid-template-columns: 1fr; } }
.rice-svg { width:100%; max-width:520px; height:auto; border:1px solid var(--border, #ddd); border-radius:.4rem; background:var(--card-bg, #fff); }
.rice-legend { font-size:.78rem; }
.rice-legend dt { font-weight:600; margin-top:.4rem; }
.rice-legend dd { margin:0 0 .3rem .8rem; color: var(--muted, #777); }
.rice-legend dt.quick-wins::before { content:"● "; color:#2b8a3e; }
.rice-legend dt.big-bets::before { content:"● "; color:#4c6ef5; }
.rice-legend dt.fill-ins::before { content:"● "; color:#fab005; }
.rice-legend dt.time-sinks::before { content:"● "; color:#c92a2a; }
.rice-table { margin-top:.5rem; }
.rice-table td.quick-wins { color:#2b8a3e; font-weight:600; }
.rice-table td.big-bets { color:#4c6ef5; font-weight:600; }
.rice-table td.fill-ins { color:#fab005; font-weight:600; }
.rice-table td.time-sinks { color:#c92a2a; font-weight:600; }
@media (prefers-color-scheme: dark) { .rice-legend dt.time-sinks::before { color:#fc8181; } .rice-table td.time-sinks { color:#fc8181; } }
:root[data-theme="dark"] .rice-legend dt.time-sinks::before { color:#fc8181; }
:root[data-theme="dark"] .rice-table td.time-sinks { color:#fc8181; }
</style>`;

const COULEURS_QUADRANT = {
  'quick-wins': '#2b8a3e',
  'big-bets': '#4c6ef5',
  'fill-ins': '#fab005',
  'time-sinks': '#c92a2a',
};

function rendrePoint(p, options) {
  const cx = options.padLeft + (p.effort / 10) * options.zoneW;
  const cy = options.padTop + (1 - p.impact / 10) * options.zoneH;
  const color = COULEURS_QUADRANT[p.quadrant];
  const idCourt = p.id.split('-').slice(0, 2).join('-');
  const href = p.file ? hrefSource(p.file) : '#';
  return `<a href="${href}" target="_blank" rel="noopener">
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="${color}" fill-opacity="0.75" stroke="${color}" stroke-width="1.5">
      <title>${escape(p.id)} — ${escape(p.titre)} (impact ${p.impact.toFixed(1)}, effort ${p.effort.toFixed(1)})</title>
    </circle>
    <text x="${(cx + 8).toFixed(1)}" y="${(cy + 3).toFixed(1)}" font-size="9" fill="currentColor">${escape(idCourt)}</text>
  </a>`;
}

function rendreSvg(points) {
  const w = 480, h = 320;
  const padLeft = 50, padRight = 20, padTop = 30, padBottom = 40;
  const zoneW = w - padLeft - padRight;
  const zoneH = h - padTop - padBottom;
  const midX = padLeft + zoneW / 2;
  const midY = padTop + zoneH / 2;
  // 4 quadrants en background.
  const quadrants = `
    <rect x="${padLeft}" y="${padTop}" width="${zoneW / 2}" height="${zoneH / 2}" fill="${COULEURS_QUADRANT['quick-wins']}" fill-opacity="0.06"/>
    <rect x="${midX}" y="${padTop}" width="${zoneW / 2}" height="${zoneH / 2}" fill="${COULEURS_QUADRANT['big-bets']}" fill-opacity="0.06"/>
    <rect x="${padLeft}" y="${midY}" width="${zoneW / 2}" height="${zoneH / 2}" fill="${COULEURS_QUADRANT['fill-ins']}" fill-opacity="0.06"/>
    <rect x="${midX}" y="${midY}" width="${zoneW / 2}" height="${zoneH / 2}" fill="${COULEURS_QUADRANT['time-sinks']}" fill-opacity="0.06"/>
  `;
  // Axes + médianes.
  const axes = `
    <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${h - padBottom}" stroke="currentColor" stroke-opacity=".4"/>
    <line x1="${padLeft}" y1="${h - padBottom}" x2="${w - padRight}" y2="${h - padBottom}" stroke="currentColor" stroke-opacity=".4"/>
    <line x1="${midX}" y1="${padTop}" x2="${midX}" y2="${h - padBottom}" stroke="currentColor" stroke-opacity=".15" stroke-dasharray="4,3"/>
    <line x1="${padLeft}" y1="${midY}" x2="${w - padRight}" y2="${midY}" stroke="currentColor" stroke-opacity=".15" stroke-dasharray="4,3"/>
  `;
  const labels = `
    <text x="${padLeft + zoneW / 4}" y="${padTop - 8}" font-size="10" text-anchor="middle" fill="${COULEURS_QUADRANT['quick-wins']}" font-weight="600">Quick wins</text>
    <text x="${midX + zoneW / 4}" y="${padTop - 8}" font-size="10" text-anchor="middle" fill="${COULEURS_QUADRANT['big-bets']}" font-weight="600">Big bets</text>
    <text x="${padLeft + zoneW / 4}" y="${h - padBottom + 15}" font-size="10" text-anchor="middle" fill="${COULEURS_QUADRANT['fill-ins']}" font-weight="600">Fill-ins</text>
    <text x="${midX + zoneW / 4}" y="${h - padBottom + 15}" font-size="10" text-anchor="middle" fill="${COULEURS_QUADRANT['time-sinks']}" font-weight="600">Time sinks</text>
    <text x="${padLeft - 8}" y="${padTop + 6}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">Impact 10</text>
    <text x="${padLeft - 8}" y="${h - padBottom + 4}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">0</text>
    <text x="${padLeft}" y="${h - padBottom + 28}" font-size="9" text-anchor="middle" fill="currentColor" opacity=".55">Effort 0</text>
    <text x="${w - padRight}" y="${h - padBottom + 28}" font-size="9" text-anchor="middle" fill="currentColor" opacity=".55">10</text>
  `;
  const opt = { padLeft, padTop, zoneW, zoneH };
  const dots = points.map((p) => rendrePoint(p, opt)).join('');
  return `<svg class="rice-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Matrice Impact x Effort, ${points.length} Intents">
    ${quadrants}${axes}${labels}${dots}
  </svg>`;
}

function rendreTable(points) {
  if (points.length === 0) return '';
  const rows = points
    .sort((a, b) => (a.quadrant === b.quadrant ? b.impact - a.impact : (a.quadrant < b.quadrant ? -1 : 1)))
    .slice(0, 12)
    .map((p) => {
      const idCell = p.file ? lienSource(p.file, p.id) : `<code>${escape(p.id)}</code>`;
      return `<tr><td>${idCell}</td><td>${escape(p.titre)}</td><td>${p.impact.toFixed(1)}</td><td>${p.effort.toFixed(1)}</td><td class="${escape(p.quadrant)}">${escape(p.quadrant)}</td></tr>`;
    }).join('');
  return `<table class="rice-table">
    <thead><tr><th>ID</th><th>Titre</th><th>Impact</th><th>Effort</th><th>Quadrant</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function blocRiceMatrix(donnees) {
  const r = donnees?.riceMatrix;
  if (!r) return '';
  if (r.points.length === 0) {
    return `<section>
      <h2>Matrice Impact × Effort <span class="count">aucun Intent scorable</span></h2>
      <p class="muted">Aucun Intent du pipeline n'a de signal d'impact (frontmatter <code>priority</code> / <code>rice</code> / <code>wsjf</code>) ni d'effort déductible (SPECs liées). Ajouter au moins <code>priority: P1</code> pour faire apparaître l'Intent sur la matrice.</p>
    </section>`;
  }
  const t = r.totaux;
  return `${RICE_CSS}<section>
    <h2>Matrice Impact × Effort <span class="count">${t['quick-wins']} quick wins · ${t['big-bets']} big bets · ${t['fill-ins']} fill-ins · ${t['time-sinks']} time sinks</span></h2>
    <p class="muted" style="font-size:.85rem">Quadrant PM canonique. Impact = <code>priority</code> (P0=10, P1=7…) ou <code>rice</code>/<code>wsjf</code> si présent. Effort = nombre de SPECs liées non-done + bonus pour contraintes lourdes (RGPD/PCI/etc.) détectées dans la section CONTRAINTES.</p>
    <div class="rice-grid">
      <div>${rendreSvg(r.points)}</div>
      <dl class="rice-legend">
        <dt class="quick-wins">Quick wins</dt><dd>high impact, low effort — attaquer en premier</dd>
        <dt class="big-bets">Big bets</dt><dd>high impact, high effort — planifier sur trimestre</dd>
        <dt class="fill-ins">Fill-ins</dt><dd>low impact, low effort — opportunistes</dd>
        <dt class="time-sinks">Time sinks</dt><dd>low impact, high effort — challenger ou couper</dd>
      </dl>
    </div>
    ${rendreTable(r.points)}
  </section>`;
}

// ─── SPEC-018-5 — Filtre backlog en attente ──────────────────────────────────

/**
 * @intent INTENT-018
 * @spec SPEC-018-5-impact-effort-en-attente
 */
const STATUTS_ACTIFS_OU_FAITS = new Set(['done', 'archived', 'active', 'in-progress']);
const QUADRANT_SINGULAR = {
  'quick-wins': 'quick-win', 'big-bets': 'big-bet',
  'fill-ins': 'fill-in', 'time-sinks': 'time-sink',
};
const QUADRANT_LABEL = {
  'quick-win': 'Quick Win', 'big-bet': 'Big Bet',
  'fill-in': 'Fill-in', 'time-sink': 'Time-sink',
};

export function calculerImpactEffortEnAttente(donnees) {
  const rice = donnees?.riceMatrix;
  if (!rice) return { items: [], total: 0, message: 'Scores RICE non calculés' };

  const items = (rice.points ?? [])
    .filter((p) => !STATUTS_ACTIFS_OU_FAITS.has(p.statut))
    .map((p) => ({
      id: p.id,
      titre: p.titre,
      statut: p.statut,
      scoreImpact: p.impact,
      scoreEffort: p.effort,
      scoreRice: p.impact / Math.max(p.effort, 1),
      quadrant: QUADRANT_SINGULAR[p.quadrant] ?? p.quadrant,
    }))
    .sort((a, b) => b.scoreRice - a.scoreRice);

  const message = items.length === 0 ? 'Aucun Intent en attente de priorisation' : null;
  return { items, total: items.length, message };
}

export function blocImpactEffortEnAttente(donnees) {
  const data = donnees?.impactEffortEnAttente ?? calculerImpactEffortEnAttente(donnees);

  if (!data.items.length) {
    return `<section class="impact-effort-attente"><p class="empty-state">${escape(data.message ?? 'Aucun Intent en attente de priorisation')}</p></section>`;
  }

  const rows = data.items.map((item) => {
    const label = escape(QUADRANT_LABEL[item.quadrant] ?? item.quadrant);
    const scoreCell = item.scoreRice.toFixed(2);
    return `    <tr>
      <td><span class="intent-id">${escape(item.id)}</span> ${escape(item.titre)}</td>
      <td>${item.scoreImpact.toFixed(1)}</td>
      <td>${item.scoreEffort.toFixed(1)}</td>
      <td>${scoreCell}</td>
      <td><span class="badge badge-${escape(item.quadrant)}">${label}</span></td>
    </tr>`;
  }).join('\n');

  return `<section class="impact-effort-attente">
  <table>
    <caption>Intents en attente — Impact × Effort</caption>
    <thead>
      <tr>
        <th scope="col">Intent</th>
        <th scope="col">Impact</th>
        <th scope="col">Effort</th>
        <th scope="col">Score</th>
        <th scope="col">Quadrant</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</section>`;
}

// Alias EN canoniques (#42)
export {
  scoreImpact as impactScore,
  scoreEffort as effortScore,
  quadrant as quadrantOf,
  calculerRiceMatrix as computeRiceMatrix,
  blocRiceMatrix as riceMatrixSection,
  calculerImpactEffortEnAttente as computeImpactEffortBacklog,
  blocImpactEffortEnAttente as impactEffortBacklogSection,
};
