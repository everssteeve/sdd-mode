// AIAD SDD Mode — Historique dette technique (#198).
//
// Persiste un snapshot horodaté à chaque `aiad-sdd dashboard` puis lit les
// snapshots des N dernières semaines pour produire une mini-timeline. Cible
// : persona Tech Lead en `/aiad tech-review` — voir si la dette stagne,
// augmente ou recule.
//
// Format snapshot : `.aiad/metrics/tech-debt/YYYY-MM-DD.json` avec
// `{date, jnsp, specsGrosses, specsWarning, seuilLoc, seuilLocWarn}`. Un
// snapshot par jour (idempotent — réécrit si même date pour capturer le
// dernier état).

import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  lireRetention, ensureHistoryDir, lireHistorique as lireHistoriqueGen,
  pruneHistorique as pruneHistoriqueGen, bucketsHebdomadaires as bucketsHebdomadairesGen,
} from './_history-utils.js';

const DOSSIER = ['.aiad', 'metrics', 'tech-debt'];

function isoDate(t = Date.now()) {
  // YYYY-MM-DD en UTC pour stabilité cross-fuseau.
  return new Date(t).toISOString().slice(0, 10);
}

// (#220) Pruning délégué à `_history-utils.js`. Wrapper conservé pour
// l'API publique stable.
export function pruneHistorique(racineProjet, opts = {}) {
  return pruneHistoriqueGen(racineProjet, DOSSIER, opts);
}

// Persiste un snapshot du calcul courant (idempotent par jour).
//   - debt : retour de `calculerTechDebt(...)`
//   - opts.date : date YYYY-MM-DD à forcer (utile pour tests)
//   - opts.dryRun : ne pas écrire (lecture seule)
export function snapshotTechDebt(racineProjet, debt, opts = {}) {
  if (!debt) return null;
  const date = opts.date || isoDate();
  const payload = {
    date,
    seuilLoc: debt.seuilLoc,
    seuilLocWarn: debt.seuilLocWarn,
    jnsp: debt.jnsp?.total || 0,
    jnspStale: debt.jnsp?.parAge?.stale || 0,
    specsGrosses: debt.specsGrosses?.total || 0,
    specsWarning: debt.specsWarning?.total || 0,
  };
  if (opts.dryRun) return payload;
  try {
    const dir = ensureHistoryDir(racineProjet, DOSSIER);
    writeFileSync(join(dir, `${date}.json`), JSON.stringify(payload, null, 2), 'utf-8');
  } catch { /* ne casse jamais le rendu */ }
  return payload;
}

// (#220) Lecture déléguée à `_history-utils.js#lireHistorique`.
export function lireHistorique(racineProjet) {
  return lireHistoriqueGen(racineProjet, DOSSIER);
}

// (#220) Bucketing délégué à `_history-utils.js`. Forme du bucket conservée
// par le `baseEntry` et `extract` spécifique à tech-debt.
export function bucketsHebdomadaires(historique, opts = {}) {
  return bucketsHebdomadairesGen(historique, {
    weeks: opts.weeks ?? 4,
    now: opts.now,
    extract: (s) => ({
      jnsp: s.jnsp,
      jnspStale: s.jnspStale || 0,
      specsGrosses: s.specsGrosses,
      specsWarning: s.specsWarning,
    }),
    baseEntry: { jnsp: null, jnspStale: null, specsGrosses: null, specsWarning: null },
  });
}

export function calculerEvolution(racineProjet, debt, opts = {}) {
  // Persiste d'abord (sauf dryRun) puis relit l'historique complet — assure
  // que le snapshot courant est inclus.
  snapshotTechDebt(racineProjet, debt, opts);
  // (#199) Auto-pruning silencieux : applique la rétention de la config
  // projet AVANT de relire l'historique, pour ne pas considérer comme
  // valides des snapshots qu'on va supprimer ensuite. Skip en dryRun.
  let pruneResult = { pruned: [], kept: 0 };
  if (!opts.dryRun && opts.skipPrune !== true) {
    const retentionJours = Number.isFinite(opts.retentionJours)
      ? opts.retentionJours
      : lireRetention(racineProjet);
    pruneResult = pruneHistoriqueGen(racineProjet, DOSSIER, { retentionJours, now: opts.now });
  }
  const historique = lireHistorique(racineProjet);
  const buckets = bucketsHebdomadaires(historique, opts);
  const tendance = calculerTendance(buckets);
  return {
    snapshots: historique.length,
    buckets,
    tendance,
    prune: pruneResult,
  };
}

// Tendance courte (delta entre la 1ère et la dernière semaine avec valeurs).
// Retourne `{jnsp: 'up'|'down'|'flat'|'unknown', delta}`.
function calculerTendance(buckets) {
  const avec = buckets.filter((b) => b.jnsp != null);
  if (avec.length < 2) return { jnsp: 'unknown', delta: 0 };
  const debut = avec[0].jnsp;
  const fin = avec[avec.length - 1].jnsp;
  const delta = fin - debut;
  if (delta > 0) return { jnsp: 'up', delta };
  if (delta < 0) return { jnsp: 'down', delta };
  return { jnsp: 'flat', delta: 0 };
}

// Rendu SVG inline d'une mini-timeline 2 séries (JNSP barres bleues, SPECs
// > seuil barres rouges). 100 % zero-dep. Ne dépend pas du CSS global.
import { escape } from './render.js';

export function renduTimeline(evolution) {
  if (!evolution || !evolution.buckets || evolution.buckets.length === 0) return '';
  const buckets = evolution.buckets;
  const max = Math.max(
    1,
    ...buckets.flatMap((b) => [b.jnsp || 0, b.specsGrosses || 0, b.specsWarning || 0])
  );
  const W = 320;
  const H = 80;
  const padLeft = 28;
  const padBottom = 18;
  const padTop = 6;
  const innerW = W - padLeft - 8;
  const innerH = H - padBottom - padTop;
  const colW = innerW / buckets.length;
  const barW = Math.max(4, (colW - 8) / 2);
  const baseY = padTop + innerH;

  function y(val) {
    if (val == null) return baseY;
    return baseY - (val / max) * innerH;
  }

  const cols = buckets.map((b, i) => {
    const xCol = padLeft + i * colW + (colW - 2 * barW - 4) / 2;
    const xJnsp = xCol;
    const xSpec = xCol + barW + 4;
    const jnspBar = b.jnsp != null
      ? `<rect x="${xJnsp.toFixed(1)}" y="${y(b.jnsp).toFixed(1)}" width="${barW.toFixed(1)}" height="${(baseY - y(b.jnsp)).toFixed(1)}" fill="#4c6ef5" rx="1"><title>JNSP ${b.jnsp} · semaine du ${escape(b.semaine)}</title></rect>`
      : '';
    const specBar = b.specsGrosses != null
      ? `<rect x="${xSpec.toFixed(1)}" y="${y(b.specsGrosses).toFixed(1)}" width="${barW.toFixed(1)}" height="${(baseY - y(b.specsGrosses)).toFixed(1)}" fill="#fa5252" rx="1"><title>SPECs grosses ${b.specsGrosses} · semaine du ${escape(b.semaine)}</title></rect>`
      : '';
    const label = `<text x="${(xCol + barW).toFixed(1)}" y="${(baseY + 12).toFixed(1)}" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.7">${escape(b.semaine.slice(5))}</text>`;
    return jnspBar + specBar + label;
  }).join('');

  const axe = `<line x1="${padLeft}" y1="${baseY}" x2="${W - 4}" y2="${baseY}" stroke="currentColor" opacity="0.2"/>` +
    `<text x="${padLeft - 4}" y="${(padTop + 8).toFixed(1)}" text-anchor="end" font-size="9" fill="currentColor" opacity="0.5">${max}</text>` +
    `<text x="${padLeft - 4}" y="${(baseY).toFixed(1)}" text-anchor="end" font-size="9" fill="currentColor" opacity="0.5">0</text>`;

  const legende = `<g font-size="10" fill="currentColor">
    <rect x="${padLeft}" y="0" width="8" height="8" fill="#4c6ef5"/>
    <text x="${padLeft + 12}" y="8">JNSP</text>
    <rect x="${padLeft + 50}" y="0" width="8" height="8" fill="#fa5252"/>
    <text x="${padLeft + 62}" y="8">SPECs > seuil</text>
  </g>`;

  const tend = evolution.tendance || {};
  const tendBadge = tend.jnsp === 'up'
    ? `<span class="badge badge-bad" style="font-size:.75rem">JNSP +${tend.delta} sur ${buckets.length} semaines</span>`
    : tend.jnsp === 'down'
    ? `<span class="badge badge-ok" style="font-size:.75rem">JNSP ${tend.delta} sur ${buckets.length} semaines</span>`
    : tend.jnsp === 'flat'
    ? `<span class="badge" style="font-size:.75rem">JNSP stable sur ${buckets.length} semaines</span>`
    : `<span class="badge" style="font-size:.75rem">Pas assez d'historique</span>`;

  return `<div style="margin-top:.75rem">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
      <strong style="font-size:.9rem">Évolution ${buckets.length} dernières semaines</strong>
      ${tendBadge}
    </div>
    <svg viewBox="0 0 ${W} ${H + 4}" role="img" aria-label="Timeline dette technique ${buckets.length} semaines" style="max-width:100%;height:auto;display:block">
      ${legende}
      ${axe}
      ${cols}
    </svg>
    <p class="muted" style="font-size:.8rem;margin-top:.25rem">${evolution.snapshots} snapshot(s) total · 1 par jour persisté dans <code>.aiad/metrics/tech-debt/</code>.</p>
  </div>`;
}

// Alias EN canoniques (#42)
export {
  snapshotTechDebt as snapshotTechDebtEN,
  lireHistorique as readHistory,
  bucketsHebdomadaires as weeklyBuckets,
  calculerEvolution as computeEvolution,
  renduTimeline as renderTimeline,
  pruneHistorique as pruneHistory,
};
