// AIAD SDD Mode — Dashboard : velocity forecast / prédiction (#479).
//
// Extrapolation linéaire sur les 6 dernières semaines de SPECs done
// pour répondre :
//   - "Combien de SPECs vais-je livrer fin de trimestre ?"
//   - "À ce rythme, quand sera livré le pipeline actuel ?"
//
// Réutilise `bucketsSemaines` de #424 vélocité. Modèle simple : régression
// linéaire OLS sur la fenêtre, projection N semaines en avant.
//
// Inclut un intervalle de confiance (± 1σ) basé sur l'écart-type de la
// régression. Si trop peu de données (< 3 semaines) → mention "n/a".
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

import { bucketsSemaines } from './velocity.js';

// Régression linéaire OLS sur tableau de points {x, y}. Renvoie
// {slope, intercept, stdErr}.
function regression(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y || 0, stdErr: 0 };
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0, den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  // Erreur résiduelle : écart-type des résidus.
  let ss = 0;
  for (const p of points) {
    const yhat = slope * p.x + intercept;
    ss += (p.y - yhat) ** 2;
  }
  const stdErr = n > 2 ? Math.sqrt(ss / (n - 2)) : 0;
  return { slope, intercept, stdErr };
}

const STATUTS_LIVRES = new Set(['done', 'archived']);

export function calculerVelocityForecast(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const fenetreSem = options.fenetreSem || 6; // histoire passée
  const horizonSem = options.horizonSem || 6; // projection future
  const specs = donnees?.specs || [];
  const buckets = bucketsSemaines(specs, { now, semaines: fenetreSem });
  // Construire les points (x = index semaine, y = count).
  const points = buckets.map((b, i) => ({ x: i, y: b.count }));
  if (points.length < 3 || points.every((p) => p.y === 0)) {
    return {
      points,
      forecast: [],
      reg: null,
      rythmeMoyen: 0,
      ic: null,
      message: 'Donnée insuffisante (< 3 semaines avec données).',
    };
  }
  const reg = regression(points);
  const rythmeMoyen = points.reduce((s, p) => s + p.y, 0) / points.length;
  // Projection : indices [fenetreSem .. fenetreSem + horizonSem - 1]
  const forecast = [];
  for (let i = 0; i < horizonSem; i++) {
    const x = fenetreSem + i;
    const ymid = Math.max(0, reg.slope * x + reg.intercept);
    forecast.push({
      semaineIdx: x,
      y: Math.round(ymid * 10) / 10,
      yMin: Math.max(0, Math.round((ymid - reg.stdErr) * 10) / 10),
      yMax: Math.round((ymid + reg.stdErr) * 10) / 10,
    });
  }
  const projectionTotale = forecast.reduce((s, p) => s + p.y, 0);
  // Backlog non-livré → ETA grossière.
  const restant = specs.filter((s) => !STATUTS_LIVRES.has(s.statut)).length;
  const etaSemaines = rythmeMoyen > 0 ? Math.ceil(restant / Math.max(rythmeMoyen, reg.slope * fenetreSem + reg.intercept)) : null;
  return {
    points,
    forecast,
    reg: { slope: Math.round(reg.slope * 100) / 100, intercept: Math.round(reg.intercept * 10) / 10, stdErr: Math.round(reg.stdErr * 10) / 10 },
    rythmeMoyen: Math.round(rythmeMoyen * 10) / 10,
    projectionHorizon: Math.round(projectionTotale * 10) / 10,
    horizonSem,
    fenetreSem,
    restant,
    etaSemaines,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const VF_CSS = `<style>
.vf-svg { width:100%; max-width:520px; height:auto; }
.vf-meta { display:grid; grid-template-columns: auto 1fr; gap: .3rem .8rem; font-size:.85rem; margin:.4rem 0; max-width: 400px; }
.vf-meta-key { color: var(--muted, #777); }
.vf-meta-val { font-weight: 500; }
.vf-warning { padding:.4rem .55rem; background:rgba(232,89,12,.06); border-left:3px solid #e8590c; border-radius:.25rem; font-size:.85rem; margin:.4rem 0; }
</style>`;

function rendreSvg(points, forecast, reg) {
  if (points.length === 0) return '';
  const w = 520, h = 220;
  const padLeft = 32, padRight = 12, padTop = 14, padBottom = 30;
  const zoneW = w - padLeft - padRight;
  const zoneH = h - padTop - padBottom;
  const allY = [...points.map((p) => p.y), ...forecast.map((f) => f.yMax), 1];
  const maxY = Math.max(...allY);
  const totalX = points.length + forecast.length - 1;
  const stepX = totalX > 0 ? zoneW / totalX : 0;
  const xy = (idx, v) => [padLeft + idx * stepX, padTop + zoneH - (v / maxY) * zoneH];
  // Historique : trait plein bleu.
  const histPolyline = points.map((p, i) => xy(i, p.y).map((n) => n.toFixed(1)).join(',')).join(' ');
  const histCircles = points.map((p, i) => {
    const [x, y] = xy(i, p.y);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#4c6ef5"><title>S-${points.length - 1 - i} : ${p.y}</title></circle>`;
  }).join('');
  // Forecast : trait pointillé orange.
  const lastHistPoint = xy(points.length - 1, points[points.length - 1].y);
  const fcstY = forecast.map((f, i) => xy(points.length + i, f.y).map((n) => n.toFixed(1)).join(',')).join(' ');
  const fcstPolyline = `${lastHistPoint.map((n) => n.toFixed(1)).join(',')} ${fcstY}`;
  // Bande IC pour forecast.
  const minPts = forecast.map((f, i) => xy(points.length + i, f.yMin).map((n) => n.toFixed(1)).join(','));
  const maxPts = forecast.map((f, i) => xy(points.length + i, f.yMax).map((n) => n.toFixed(1)).join(',')).reverse();
  const icPath = minPts.length > 0 ? `${lastHistPoint.map((n) => n.toFixed(1)).join(',')} ${minPts.join(' ')} ${maxPts.join(' ')} ${lastHistPoint.map((n) => n.toFixed(1)).join(',')}` : '';
  const fcstCircles = forecast.map((f, i) => {
    const [x, y] = xy(points.length + i, f.y);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#e8590c" fill-opacity="0.7"><title>S+${i + 1} : ${f.y} (±${f.yMax - f.y})</title></circle>`;
  }).join('');
  return `<svg class="vf-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Velocity forecast">
    ${icPath ? `<polygon points="${icPath}" fill="#e8590c" fill-opacity="0.08"/>` : ''}
    <polyline points="${histPolyline}" fill="none" stroke="#4c6ef5" stroke-width="2"/>
    <polyline points="${fcstPolyline}" fill="none" stroke="#e8590c" stroke-width="2" stroke-dasharray="4,3"/>
    ${histCircles}${fcstCircles}
    <line x1="${padLeft}" y1="${(padTop + zoneH).toFixed(1)}" x2="${(w - padRight).toFixed(1)}" y2="${(padTop + zoneH).toFixed(1)}" stroke="currentColor" stroke-opacity=".4"/>
    <text x="${padLeft - 4}" y="${(padTop + 4).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">${Math.round(maxY)}</text>
    <text x="${padLeft - 4}" y="${(padTop + zoneH + 4).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">0</text>
    <text x="${xy(0, 0)[0].toFixed(1)}" y="${(h - 6).toFixed(1)}" font-size="9" text-anchor="middle" fill="currentColor" opacity=".55">Passé</text>
    <text x="${xy(points.length, 0)[0].toFixed(1)}" y="${(h - 6).toFixed(1)}" font-size="9" text-anchor="middle" fill="currentColor" opacity=".55">| Maintenant</text>
    <text x="${xy(totalX, 0)[0].toFixed(1)}" y="${(h - 6).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">+${forecast.length} sem</text>
  </svg>`;
}

export function blocVelocityForecast(donnees) {
  const f = donnees?.velocityForecast;
  if (!f) return '';
  if (f.message) {
    return `<section>
      <h2>Velocity forecast <span class="count">${escape(f.message)}</span></h2>
      <p class="muted" style="font-size:.85rem">La prédiction nécessite au moins 3 semaines d'historique avec ≥ 1 SPEC livrée. Lance le dashboard régulièrement et marque des SPECs <code>done</code> pour alimenter la régression.</p>
    </section>`;
  }
  const r = f.reg;
  const directionTxt = r.slope > 0.1 ? '↗ accélération'
    : r.slope < -0.1 ? '↘ décélération' : '→ stable';
  const warnEta = f.etaSemaines > 26 ? `<div class="vf-warning">⚠ ETA pour livrer le backlog actuel : ${f.etaSemaines} semaines (> 6 mois). À ce rythme, le backlog risque de stagner — re-prioriser ou augmenter la capacité.</div>` : '';
  return `${VF_CSS}<section>
    <h2>Velocity forecast <span class="count">extrapolation ${f.horizonSem} sem sur historique ${f.fenetreSem} sem</span></h2>
    <p class="muted" style="font-size:.85rem">Régression linéaire OLS sur l'historique SPECs done. Bande pointillée orange = projection ±1σ (intervalle de confiance). Trait plein bleu = historique.</p>
    <div class="vf-meta">
      <span class="vf-meta-key">Rythme moyen :</span><span class="vf-meta-val">${f.rythmeMoyen} SPECs/sem</span>
      <span class="vf-meta-key">Pente régression :</span><span class="vf-meta-val">${r.slope >= 0 ? '+' : ''}${r.slope} SPECs/sem ${directionTxt}</span>
      <span class="vf-meta-key">Projection ${f.horizonSem} prochaines sem :</span><span class="vf-meta-val">~${f.projectionHorizon} SPECs (±${(r.stdErr * f.horizonSem).toFixed(1)})</span>
      <span class="vf-meta-key">Backlog SPECs restant :</span><span class="vf-meta-val">${f.restant} SPECs</span>
      ${f.etaSemaines != null ? `<span class="vf-meta-key">ETA backlog actuel :</span><span class="vf-meta-val">~${f.etaSemaines} semaines</span>` : ''}
    </div>
    ${warnEta}
    ${rendreSvg(f.points, f.forecast, f.reg)}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerVelocityForecast as computeVelocityForecast,
  blocVelocityForecast as velocityForecastSection,
};
