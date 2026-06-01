// AIAD SDD Mode — Dashboard : historique santé projet (#219).
//
// Suite #218. Snapshot quotidien du score global dans
// `.aiad/metrics/sante-globale/YYYY-MM-DD.json` puis sparkline 12 semaines
// avec lignes de seuil (85=excellent, 70=sain, 50=attention) pour
// répondre à "Le projet converge vers excellent ou stagne ?".
//
// Architecture cohérente avec `tech-debt-history.js` (#198) et
// `outcomes-history.js` (#210) — buckets hebdomadaires UTC, dernier
// snapshot/semaine prend, rétention configurable via `.aiad/config.json`.

import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  lireRetention, ensureHistoryDir, lireHistorique as lireHistoriqueGen,
  pruneHistorique as pruneHistoriqueGen, bucketsHebdomadaires as bucketsHebdomadairesGen,
} from './_history-utils.js';

const DOSSIER = ['.aiad', 'metrics', 'sante-globale'];
const WEEKS_DEFAUT = 12;

function isoDate(t = Date.now()) {
  return new Date(t).toISOString().slice(0, 10);
}

export function snapshotSante(racine, sante, opts = {}) {
  if (!sante || sante.score == null) return null;
  const date = opts.date || isoDate();
  const payload = {
    date,
    score: sante.score,
    niveau: sante.niveau,
    composantes: sante.breakdown
      ? sante.breakdown.map((b) => ({ id: b.id, points: b.points, max: b.max, disponible: b.disponible }))
      : [],
  };
  if (opts.dryRun) return payload;
  try {
    const dir = ensureHistoryDir(racine, DOSSIER);
    writeFileSync(join(dir, `${date}.json`), JSON.stringify(payload, null, 2), 'utf-8');
  } catch { /* never throws */ }
  return payload;
}

// (#220) Lecture déléguée à `_history-utils.js`.
export function lireHistorique(racine) {
  return lireHistoriqueGen(racine, DOSSIER);
}

// (#220) Pruning délégué — accepte uniquement retentionJours (pas before).
export function pruneHistorique(racine, opts = {}) {
  return pruneHistoriqueGen(racine, DOSSIER, opts);
}

// (#220) Bucketing délégué.
export function bucketsHebdomadaires(historique, opts = {}) {
  return bucketsHebdomadairesGen(historique, {
    weeks: opts.weeks ?? WEEKS_DEFAUT,
    now: opts.now,
    extract: (s) => ({ score: s.score, niveau: s.niveau }),
    baseEntry: { score: null, niveau: null },
  });
}

function tendance(buckets) {
  const avec = buckets.filter((b) => b.score != null);
  if (avec.length < 2) return { sens: 'unknown', delta: 0 };
  const delta = avec[avec.length - 1].score - avec[0].score;
  if (delta >= 5) return { sens: 'up', delta };
  if (delta <= -5) return { sens: 'down', delta };
  return { sens: 'flat', delta };
}

export function calculerEvolution(racine, sante, opts = {}) {
  let pruneResult = { pruned: [], kept: 0 };
  if (!opts.dryRun && opts.skipSnapshot !== true) {
    snapshotSante(racine, sante, { date: opts.date });
  }
  if (!opts.dryRun && opts.skipPrune !== true) {
    const retention = Number.isFinite(opts.retentionJours) ? opts.retentionJours : lireRetention(racine);
    pruneResult = pruneHistoriqueGen(racine, DOSSIER, { retentionJours: retention, now: opts.now });
  }
  const historique = lireHistorique(racine);
  const buckets = bucketsHebdomadaires(historique, opts);
  return {
    snapshots: historique.length,
    buckets,
    tendance: tendance(buckets),
    prune: pruneResult,
  };
}

// ─── Rendu HTML ─────────────────────────────────────────────────────────────

import { escape } from './render.js';

function couleurScore(score) {
  if (score == null) return '#888';
  if (score >= 85) return '#2b8a3e';
  if (score >= 70) return '#52b788';
  if (score >= 50) return '#e8590c';
  return '#c92a2a';
}

export function renduTimeline(evolution) {
  if (!evolution || !evolution.buckets || evolution.buckets.length === 0) return '';
  const buckets = evolution.buckets;
  const valides = buckets.filter((b) => b.score != null);
  if (valides.length === 0) return '';
  const W = 320;
  const H = 80;
  const padX = 6;
  const padY = 8;
  const innerW = W - padX * 2;
  const innerH = H - padY - 16;
  const baseY = padY + innerH;
  const stepX = innerW / (buckets.length - 1 || 1);

  function y(score) {
    if (score == null) return null;
    return padY + (1 - score / 100) * innerH;
  }

  // Lignes de seuil (85/70/50)
  const seuils = [
    { y: y(85), label: '85', couleur: '#2b8a3e' },
    { y: y(70), label: '70', couleur: '#52b788' },
    { y: y(50), label: '50', couleur: '#e8590c' },
  ];
  const lignesSeuil = seuils.map((s) =>
    `<line x1="${padX}" y1="${s.y.toFixed(1)}" x2="${(W - padX).toFixed(1)}" y2="${s.y.toFixed(1)}" stroke="${s.couleur}" stroke-width="0.5" stroke-dasharray="2,3" opacity="0.5"><title>Seuil ${s.label}</title></line>` +
    `<text x="${(W - padX + 2).toFixed(1)}" y="${(s.y + 3).toFixed(1)}" font-size="8" fill="${s.couleur}" opacity="0.7">${s.label}</text>`
  ).join('');

  // Polyline + cercles
  const points = [];
  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i];
    if (b.score == null) continue;
    const px = padX + i * stepX;
    const py = y(b.score);
    points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  const polyline = points.length > 1
    ? `<polyline points="${points.join(' ')}" fill="none" stroke="#4c6ef5" stroke-width="1.5"/>`
    : '';
  const cercles = buckets.map((b, i) => {
    if (b.score == null) return '';
    const px = padX + i * stepX;
    const py = y(b.score);
    return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3" fill="${couleurScore(b.score)}"><title>${escape(b.semaine)} : ${b.score}/100 (${escape(b.niveau || '')})</title></circle>`;
  }).join('');

  const tend = evolution.tendance || {};
  const tendBadge = tend.sens === 'up'
    ? `<span class="badge badge-ok" style="font-size:.75rem">+${tend.delta} sur ${buckets.length} sem</span>`
    : tend.sens === 'down'
    ? `<span class="badge badge-bad" style="font-size:.75rem">${tend.delta} sur ${buckets.length} sem</span>`
    : tend.sens === 'flat'
    ? `<span class="badge" style="font-size:.75rem">stable</span>`
    : '<span class="badge" style="font-size:.75rem">historique court</span>';

  return `<div style="margin-top:.75rem">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
      <strong style="font-size:.9rem">Évolution ${buckets.length} dernières semaines</strong>
      ${tendBadge}
    </div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Timeline santé ${buckets.length} semaines" style="max-width:100%;height:auto;display:block">
      ${lignesSeuil}
      ${polyline}
      ${cercles}
    </svg>
    <p class="muted" style="font-size:.75rem;margin-top:.25rem">${evolution.snapshots} snapshot(s) · seuils ●85 excellent · ●70 sain · ●50 attention</p>
  </div>`;
}

// Alias EN canoniques (#42)
export {
  snapshotSante as snapshotHealth,
  lireHistorique as readHistory,
  pruneHistorique as pruneHistory,
  bucketsHebdomadaires as weeklyBuckets,
  calculerEvolution as computeEvolution,
  renduTimeline as renderTimeline,
};
