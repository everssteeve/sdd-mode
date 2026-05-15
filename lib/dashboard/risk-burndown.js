// AIAD SDD Mode — Dashboard : risk burndown chart (#476).
//
// Pour chaque snapshot PM (#433), reconstitue le nombre de risques
// ouverts à cette date (heuristique : Intents non-livrés × risk_level
// ≠ null + Intents avec `risks: [...]` frontmatter). Trace une sparkline
// sur la fenêtre disponible. Donne au PM le signal "les risques
// s'accumulent ou se résolvent".
//
// Limitation : les snapshots ne capturent que `{id, statut}` à ce jour.
// On approxime en (a) considérant qu'un risque est "résolu" quand son
// Intent passe done/archived, (b) extrapolant le compteur courant
// depuis `donnees.risks.intents` puis recule en utilisant les snapshots
// pour compter combien d'Intents en risque étaient encore non-livrés
// à chaque date.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

import { lireSnapshots } from './pm-diff.js';

const STATUTS_LIVRES = new Set(['done', 'archived']);

// Pour un snapshot et un set d'ids de risques connus aujourd'hui,
// compte combien étaient encore non-livrés à la date du snapshot.
function compterRisquesOuverts(snapshot, idsRisques) {
  if (!snapshot?.data?.intents) return 0;
  let n = 0;
  for (const ri of snapshot.data.intents) {
    if (!idsRisques.has(ri.id)) continue;
    if (STATUTS_LIVRES.has(ri.statut)) continue;
    n++;
  }
  return n;
}

export function calculerRiskBurndown(racineProjet, donnees, options = {}) {
  const lecteur = options.lecteur || (() => lireSnapshots(racineProjet));
  const snapshots = lecteur();
  const intentsAvecRisque = donnees?.risks?.intents || [];
  const idsRisques = new Set(intentsAvecRisque.map((r) => r.id));
  // Risques courants : intents non-livrés.
  const courantsOuverts = intentsAvecRisque.filter((r) => !STATUTS_LIVRES.has(r.statut)).length;
  if (snapshots.length === 0 || idsRisques.size === 0) {
    return {
      points: [], snapshots: snapshots.length, totalRisques: idsRisques.size,
      courantsOuverts,
      tendance: 'unknown',
    };
  }
  const points = snapshots.map((s) => ({
    date: s.date,
    ouverts: compterRisquesOuverts(s, idsRisques),
  }));
  // Tendance : compare moitié récente à moitié ancienne.
  let tendance = 'unknown';
  if (points.length >= 2) {
    const mid = Math.floor(points.length / 2);
    const ancien = points.slice(0, mid).reduce((sum, p) => sum + p.ouverts, 0);
    const recent = points.slice(mid).reduce((sum, p) => sum + p.ouverts, 0);
    if (recent < ancien) tendance = 'down'; // bon : on résout
    else if (recent > ancien) tendance = 'up'; // mauvais : on accumule
    else tendance = 'flat';
  }
  return {
    points,
    snapshots: snapshots.length,
    totalRisques: idsRisques.size,
    courantsOuverts,
    tendance,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const RBD_CSS = `<style>
.rbd-svg { width:100%; max-width:480px; height:auto; }
.rbd-stats { display:flex; gap:1rem; flex-wrap:wrap; margin:.4rem 0; font-size:.85rem; }
.rbd-stat strong { font-size:1.2rem; }
.rbd-tendance { padding:.25rem .55rem; border-radius:.25rem; font-size:.82rem; }
.rbd-tendance.down { background:rgba(43,138,62,.15); color:#1f6b2f; }
.rbd-tendance.up { background:rgba(201,42,42,.15); color:#7a1717; }
.rbd-tendance.flat { background:rgba(127,127,127,.1); color: var(--muted, #777); }
</style>`;

function rendreSparkline(points) {
  if (points.length < 2) return '';
  const w = 480, h = 120;
  const padLeft = 32, padRight = 8, padTop = 10, padBottom = 24;
  const zoneW = w - padLeft - padRight;
  const zoneH = h - padTop - padBottom;
  const max = Math.max(1, ...points.map((p) => p.ouverts));
  const stepX = zoneW / (points.length - 1);
  const xy = (i, v) => [padLeft + i * stepX, padTop + zoneH - (v / max) * zoneH];
  const polyPoints = points.map((p, i) => xy(i, p.ouverts).map((n) => n.toFixed(1)).join(',')).join(' ');
  const circles = points.map((p, i) => {
    const [x, y] = xy(i, p.ouverts);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#e8590c"><title>${escape(p.date)} : ${p.ouverts} risque(s)</title></circle>`;
  }).join('');
  const idxLabels = points.length <= 5 ? points.map((_, i) => i) : [0, Math.floor(points.length / 2), points.length - 1];
  const dateLabels = idxLabels.map((i) => {
    const [x] = xy(i, 0);
    return `<text x="${x.toFixed(1)}" y="${(h - 4).toFixed(1)}" font-size="9" text-anchor="middle" fill="currentColor" opacity=".55">${escape(points[i].date.slice(5))}</text>`;
  }).join('');
  return `<svg class="rbd-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Risk burndown ${points.length} snapshots">
    <polyline points="${polyPoints}" fill="none" stroke="#e8590c" stroke-width="2" stroke-linejoin="round"/>
    ${circles}
    <line x1="${padLeft}" y1="${(padTop + zoneH).toFixed(1)}" x2="${(w - padRight).toFixed(1)}" y2="${(padTop + zoneH).toFixed(1)}" stroke="currentColor" stroke-opacity=".4"/>
    <text x="${padLeft - 4}" y="${(padTop + 4).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">${max}</text>
    <text x="${padLeft - 4}" y="${(padTop + zoneH + 4).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">0</text>
    ${dateLabels}
  </svg>`;
}

function labelTendance(t) {
  if (t === 'down') return '↘ Burndown — risques en baisse';
  if (t === 'up') return '↗ Risques en hausse — attention';
  if (t === 'flat') return '→ Stable';
  return '— Inconnu (< 2 snapshots)';
}

export function blocRiskBurndown(donnees) {
  const r = donnees?.riskBurndown;
  if (!r) return '';
  if (r.totalRisques === 0) {
    return `<section>
      <h2>Risk burndown <span class="count">aucun risque déclaré</span></h2>
      <p class="muted" style="font-size:.85rem">Pour suivre le burndown des risques, déclarer <code>risk_level:</code> ou <code>risks:</code> dans le frontmatter d'au moins un Intent (cf. <code>lib/dashboard/risks.js</code> #439).</p>
    </section>`;
  }
  if (r.snapshots < 2) {
    return `<section>
      <h2>Risk burndown <span class="count">${r.snapshots} snapshot(s) — minimum 2 requis · ${r.courantsOuverts} risque(s) ouvert(s)</span></h2>
      <p class="muted" style="font-size:.85rem">Le burndown nécessite ≥ 2 snapshots PM (#433). Relance <code>aiad-sdd dashboard</code> régulièrement pour alimenter la sparkline.</p>
    </section>`;
  }
  return `${RBD_CSS}<section>
    <h2>Risk burndown <span class="count">${r.courantsOuverts}/${r.totalRisques} risque(s) ouvert(s) aujourd'hui</span></h2>
    <p class="muted" style="font-size:.85rem">Évolution du nombre d'Intents à risque (heuristique : <code>risks:</code>/<code>risk_level:</code> du frontmatter) non encore livrés à chaque snapshot.</p>
    <div class="rbd-stats">
      <div class="rbd-stat">Ouverts aujourd'hui : <strong>${r.courantsOuverts}</strong></div>
      <div class="rbd-stat">Total identifiés : <strong>${r.totalRisques}</strong></div>
      <div class="rbd-tendance ${escape(r.tendance)}">${labelTendance(r.tendance)}</div>
    </div>
    ${rendreSparkline(r.points)}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerRiskBurndown as computeRiskBurndown,
  blocRiskBurndown as riskBurndownSection,
};
