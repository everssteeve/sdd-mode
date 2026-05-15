// AIAD SDD Mode — Dashboard : timeline du score santé global (#485).
//
// Réutilise les snapshots `.aiad/metrics/sante-globale/YYYY-MM-DD.json`
// déjà persistés par #sante-globale pour tracer l'évolution du score
// sur les N derniers jours. Permet de répondre :
//   - "La santé du projet s'améliore-t-elle ou se dégrade-t-elle ?"
//   - "Quand s'est produit le décrochage ?"
//
// Pure lecture filesystem. Pas d'effet de bord serveur (pas d'écriture).
//
// Documentation : https://aiad.ovh

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Lecture défensive d'un répertoire — retourne [] si manquant.
function lireRep(rep) {
  try { return readdirSync(rep); } catch (e) { return []; }
}

export function lireSnapshotsSante(racineProjet, options = {}) {
  const rep = join(racineProjet || '.', '.aiad', 'metrics', 'sante-globale');
  const limite = options.maxItems || 90;
  const fichiers = lireRep(rep)
    .filter((n) => n.endsWith('.json'))
    .sort();
  const items = [];
  for (const f of fichiers) {
    const chemin = join(rep, f);
    try {
      const contenu = readFileSync(chemin, 'utf8');
      const data = JSON.parse(contenu);
      const date = data.date || f.replace(/\.json$/, '');
      const score = Number(data.score);
      if (isNaN(score)) continue;
      items.push({
        date,
        score,
        niveau: data.niveau || '?',
        composantes: Array.isArray(data.composantes) ? data.composantes : [],
        mtime: (function () { try { return statSync(chemin).mtimeMs; } catch { return 0; } })(),
      });
    } catch (e) { /* fichier illisible, on ignore */ }
  }
  return items.slice(-limite);
}

// Calcule la tendance (pente) en regroupant moitié récente vs moitié ancienne.
export function calculerTendance(points) {
  if (points.length < 2) return { direction: 'unknown', delta: 0, base: null };
  const mid = Math.floor(points.length / 2);
  const ancienne = points.slice(0, Math.max(1, mid));
  const recente = points.slice(mid);
  const moy = (arr) => arr.reduce((s, p) => s + p.score, 0) / arr.length;
  const ma = moy(ancienne);
  const mr = moy(recente);
  const delta = Math.round((mr - ma) * 10) / 10;
  if (Math.abs(delta) < 2) return { direction: 'flat', delta, base: Math.round(ma * 10) / 10 };
  return {
    direction: delta > 0 ? 'up' : 'down',
    delta,
    base: Math.round(ma * 10) / 10,
  };
}

export function calculerHealthTimeline(racineProjet, donnees, options = {}) {
  const points = lireSnapshotsSante(racineProjet, options);
  const tendance = calculerTendance(points);
  const courant = donnees?.santeGlobale || null;
  return {
    points,
    tendance,
    courant,
    nbPoints: points.length,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const HT_CSS = `<style>
.ht-svg { width:100%; max-width:560px; height:auto; }
.ht-meta { display:grid; grid-template-columns: auto 1fr; gap:.3rem .8rem; font-size:.85rem; margin:.4rem 0; max-width: 420px; }
.ht-meta-key { color: var(--muted, #777); }
.ht-trend-up { color:#2b8a3e; font-weight:500; }
.ht-trend-down { color:#c92a2a; font-weight:500; }
.ht-trend-flat { color:var(--muted, #777); font-weight:500; }
</style>`;

function rendreSparkline(points) {
  if (points.length < 2) return '';
  const w = 560, h = 140;
  const padLeft = 36, padRight = 12, padTop = 16, padBottom = 26;
  const zoneW = w - padLeft - padRight;
  const zoneH = h - padTop - padBottom;
  // 0-100 scale.
  const xy = (i, v) => [
    padLeft + (points.length === 1 ? zoneW / 2 : (i / (points.length - 1)) * zoneW),
    padTop + zoneH - (v / 100) * zoneH,
  ];
  const polyline = points.map((p, i) => xy(i, p.score).map((n) => n.toFixed(1)).join(',')).join(' ');
  const cercles = points.map((p, i) => {
    const [x, y] = xy(i, p.score);
    const couleur = p.score >= 80 ? '#2b8a3e' : p.score >= 50 ? '#e8590c' : '#c92a2a';
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${couleur}"><title>${escape(p.date)} : ${p.score}/100 (${escape(p.niveau)})</title></circle>`;
  }).join('');
  const seuil80 = padTop + zoneH - (80 / 100) * zoneH;
  const seuil50 = padTop + zoneH - (50 / 100) * zoneH;
  return `<svg class="ht-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Évolution score santé sur ${points.length} snapshot(s)">
    <line x1="${padLeft}" y1="${seuil80.toFixed(1)}" x2="${(w - padRight).toFixed(1)}" y2="${seuil80.toFixed(1)}" stroke="#2b8a3e" stroke-dasharray="3,3" stroke-opacity=".5"/>
    <line x1="${padLeft}" y1="${seuil50.toFixed(1)}" x2="${(w - padRight).toFixed(1)}" y2="${seuil50.toFixed(1)}" stroke="#e8590c" stroke-dasharray="3,3" stroke-opacity=".4"/>
    <polyline points="${polyline}" fill="none" stroke="currentColor" stroke-width="2" stroke-opacity=".7"/>
    ${cercles}
    <line x1="${padLeft}" y1="${(padTop + zoneH).toFixed(1)}" x2="${(w - padRight).toFixed(1)}" y2="${(padTop + zoneH).toFixed(1)}" stroke="currentColor" stroke-opacity=".4"/>
    <text x="${padLeft - 4}" y="${(padTop + 4).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">100</text>
    <text x="${padLeft - 4}" y="${seuil80.toFixed(1)}" font-size="9" text-anchor="end" fill="#2b8a3e" opacity=".7">80</text>
    <text x="${padLeft - 4}" y="${seuil50.toFixed(1)}" font-size="9" text-anchor="end" fill="#e8590c" opacity=".7">50</text>
    <text x="${padLeft - 4}" y="${(padTop + zoneH + 4).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">0</text>
    <text x="${padLeft}" y="${(h - 6).toFixed(1)}" font-size="9" text-anchor="start" fill="currentColor" opacity=".55">${escape(points[0].date)}</text>
    <text x="${(w - padRight).toFixed(1)}" y="${(h - 6).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">${escape(points[points.length - 1].date)}</text>
  </svg>`;
}

export function blocHealthTimeline(donnees) {
  const t = donnees?.healthTimeline;
  if (!t) return '';
  if (t.nbPoints === 0) {
    return `<section>
      <h2>Évolution score santé <span class="count">aucun snapshot encore</span></h2>
      <p class="muted" style="font-size:.85rem">Aucun fichier dans <code>.aiad/metrics/sante-globale/</code>. Lance <code>npx aiad-sdd health --persist</code> régulièrement pour alimenter cette timeline.</p>
    </section>`;
  }
  if (t.nbPoints < 2) {
    const p = t.points[0];
    return `<section>
      <h2>Évolution score santé <span class="count">1 seul snapshot — besoin de plus d'historique</span></h2>
      <p class="muted" style="font-size:.85rem">Score actuel : <strong>${p.score}/100</strong> (${escape(p.niveau)}) au ${escape(p.date)}. Relance régulièrement <code>npx aiad-sdd health --persist</code> pour voir l'évolution.</p>
    </section>`;
  }
  const direction = t.tendance.direction;
  const trendTxt = direction === 'up' ? `↗ ${t.tendance.delta >= 0 ? '+' : ''}${t.tendance.delta} pt (amélioration)`
    : direction === 'down' ? `↘ ${t.tendance.delta} pt (dégradation)`
    : `→ ${t.tendance.delta >= 0 ? '+' : ''}${t.tendance.delta} pt (stable)`;
  const trendCls = direction === 'up' ? 'ht-trend-up' : direction === 'down' ? 'ht-trend-down' : 'ht-trend-flat';
  const courant = t.points[t.points.length - 1];
  return `${HT_CSS}<section>
    <h2>Évolution score santé <span class="count">${t.nbPoints} snapshot(s) — score actuel ${courant.score}/100 (${escape(courant.niveau)})</span></h2>
    <p class="muted" style="font-size:.85rem">Lignes pointillées : seuil sain (80) en vert et seuil critique (50) en orange. Couleur des points proportionnelle au niveau de chaque snapshot.</p>
    <div class="ht-meta">
      <span class="ht-meta-key">Score actuel :</span><span><strong>${courant.score}/100</strong> · ${escape(courant.niveau)}</span>
      <span class="ht-meta-key">Tendance moitié récente :</span><span class="${trendCls}">${escape(trendTxt)}</span>
      <span class="ht-meta-key">Base passée :</span><span>${t.tendance.base ?? '—'}/100</span>
      <span class="ht-meta-key">Historique disponible :</span><span>${t.nbPoints} snapshot(s) sur ${escape(t.points[0].date)} → ${escape(courant.date)}</span>
    </div>
    ${rendreSparkline(t.points)}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  lireSnapshotsSante as readHealthSnapshots,
  calculerTendance as computeTrend,
  calculerHealthTimeline as computeHealthTimeline,
  blocHealthTimeline as healthTimelineSection,
};
