// AIAD SDD Mode — Dashboard : customer sentiment trend over time (#547).
//
// Trace l'évolution du sentiment client semaine par semaine depuis
// `customerFeedback` (#496) sur les N dernières semaines. Identifie
// les périodes positives vs négatives.
//
// Pure transformation.

const DAY = 24 * 3600 * 1000;
const SEM = 7 * DAY;

export function calculerSentimentTrend(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const nbSem = options.nbSemaines || 8;
  const feedbacks = donnees?.customerFeedback?.items || [];
  // Buckets hebdo
  const buckets = [];
  for (let i = nbSem - 1; i >= 0; i--) {
    const finSem = now - i * SEM;
    const debutSem = finSem - SEM;
    const dansBucket = feedbacks.filter((f) => f.date && f.date >= debutSem && f.date < finSem);
    buckets.push({
      idx: nbSem - 1 - i,
      finSem,
      total: dansBucket.length,
      positif: dansBucket.filter((f) => f.sentiment === 'positif').length,
      negatif: dansBucket.filter((f) => f.sentiment === 'negatif').length,
      question: dansBucket.filter((f) => f.sentiment === 'question').length,
      neutre: dansBucket.filter((f) => f.sentiment === 'neutre').length,
    });
  }
  const totalFeedbacks = buckets.reduce((s, b) => s + b.total, 0);
  const totalPositif = buckets.reduce((s, b) => s + b.positif, 0);
  const totalNegatif = buckets.reduce((s, b) => s + b.negatif, 0);
  const totalQuestion = buckets.reduce((s, b) => s + b.question, 0);
  // Tendance : compare moitiés
  const mid = Math.floor(nbSem / 2);
  const moitieAnc = buckets.slice(0, mid);
  const moitieRec = buckets.slice(mid);
  const ratioAnc = moitieAnc.reduce((s, b) => s + (b.positif - b.negatif), 0);
  const ratioRec = moitieRec.reduce((s, b) => s + (b.positif - b.negatif), 0);
  let tendance = 'stable';
  if (ratioRec > ratioAnc + 1) tendance = 'ameliore';
  else if (ratioRec < ratioAnc - 1) tendance = 'degrade';
  return {
    buckets,
    nbSem,
    totaux: { total: totalFeedbacks, positif: totalPositif, negatif: totalNegatif, question: totalQuestion },
    tendance,
    ratioAnc,
    ratioRec,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const ST_CSS = `<style>
.st-svg { width:100%; max-width:540px; height:auto; }
.st-meta { display:grid; grid-template-columns: auto 1fr; gap:.3rem .8rem; font-size:.85rem; margin:.4rem 0; max-width: 420px; }
.st-meta-key { color: var(--muted, #777); }
.st-dir-ameliore { color:#2b8a3e; font-weight:500; }
.st-dir-degrade { color:#c92a2a; font-weight:500; }
.st-dir-stable { color:var(--muted, #777); font-weight:500; }
.st-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

function rendreSvg(buckets) {
  const w = 540, h = 180;
  const padL = 30, padR = 12, padT = 14, padB = 30;
  const zoneW = w - padL - padR;
  const zoneH = h - padT - padB;
  const maxY = Math.max(...buckets.map((b) => Math.max(b.positif, b.negatif, b.question)), 1);
  const groupW = zoneW / buckets.length;
  const barW = groupW * 0.25;
  const gap = groupW * 0.08;
  const items = buckets.map((b, i) => {
    const xC = padL + i * groupW + groupW / 2;
    const xPos = xC - barW - gap;
    const xNeg = xC;
    const xQ = xC + barW + gap;
    const hPos = (b.positif / maxY) * zoneH;
    const hNeg = (b.negatif / maxY) * zoneH;
    const hQ = (b.question / maxY) * zoneH;
    return `<rect x="${xPos.toFixed(1)}" y="${(padT + zoneH - hPos).toFixed(1)}" width="${barW.toFixed(1)}" height="${hPos.toFixed(1)}" fill="#2b8a3e" rx="1.5"><title>S-${buckets.length - 1 - i} positif : ${b.positif}</title></rect>
      <rect x="${xNeg.toFixed(1)}" y="${(padT + zoneH - hNeg).toFixed(1)}" width="${barW.toFixed(1)}" height="${hNeg.toFixed(1)}" fill="#c92a2a" rx="1.5"><title>S-${buckets.length - 1 - i} négatif : ${b.negatif}</title></rect>
      <rect x="${xQ.toFixed(1)}" y="${(padT + zoneH - hQ).toFixed(1)}" width="${barW.toFixed(1)}" height="${hQ.toFixed(1)}" fill="#4c6ef5" rx="1.5"><title>S-${buckets.length - 1 - i} question : ${b.question}</title></rect>`;
  }).join('');
  return `<svg class="st-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Sentiment trend">
    ${items}
    <line x1="${padL}" y1="${(padT + zoneH).toFixed(1)}" x2="${(w - padR).toFixed(1)}" y2="${(padT + zoneH).toFixed(1)}" stroke="currentColor" stroke-opacity=".4"/>
    <text x="${padL - 4}" y="${(padT + 4).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">${maxY}</text>
    <text x="${padL - 4}" y="${(padT + zoneH + 4).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">0</text>
    <text x="${padL}" y="${(h - 8).toFixed(1)}" font-size="9" text-anchor="start" fill="currentColor" opacity=".55">S-${buckets.length - 1}</text>
    <text x="${(w - padR).toFixed(1)}" y="${(h - 8).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">cette sem</text>
    <rect x="${(padL + 4).toFixed(1)}" y="${(padT + 4).toFixed(1)}" width="8" height="8" fill="#2b8a3e"/><text x="${(padL + 16).toFixed(1)}" y="${(padT + 12).toFixed(1)}" font-size="9" fill="currentColor">+ positif</text>
    <rect x="${(padL + 56).toFixed(1)}" y="${(padT + 4).toFixed(1)}" width="8" height="8" fill="#c92a2a"/><text x="${(padL + 68).toFixed(1)}" y="${(padT + 12).toFixed(1)}" font-size="9" fill="currentColor">− négatif</text>
    <rect x="${(padL + 112).toFixed(1)}" y="${(padT + 4).toFixed(1)}" width="8" height="8" fill="#4c6ef5"/><text x="${(padL + 124).toFixed(1)}" y="${(padT + 12).toFixed(1)}" font-size="9" fill="currentColor">? question</text>
  </svg>`;
}

export function blocSentimentTrend(donnees) {
  const s = donnees?.sentimentTrend;
  if (!s) return '';
  if (s.totaux.total === 0) {
    return `${ST_CSS}<section>
      <h2>Évolution sentiment client <span class="count">aucun feedback</span></h2>
      <div class="st-empty">Trace l'évolution du sentiment client (#496 customer-feedback) semaine par semaine sur ${s.nbSem} sem. Aucun fichier <code>.aiad/feedback/*.md</code> détecté.</div>
    </section>`;
  }
  const t = s.totaux;
  const dirTxt = s.tendance === 'ameliore' ? '↗ s\'améliore'
    : s.tendance === 'degrade' ? '↘ se dégrade' : '→ stable';
  const dirCls = `st-dir-${s.tendance}`;
  return `${ST_CSS}<section>
    <h2>Évolution sentiment client <span class="count">${t.total} feedback(s) · ${t.positif} 👍 · ${t.negatif} 👎 · ${t.question} ❓</span></h2>
    <p class="muted" style="font-size:.85rem">Évolution du sentiment (#496) semaine par semaine sur ${s.nbSem} sem. Tendance calculée sur la moitié récente vs ancienne.</p>
    <div class="st-meta">
      <span class="st-meta-key">Tendance :</span><span class="${dirCls}">${escape(dirTxt)} (${s.ratioRec - s.ratioAnc >= 0 ? '+' : ''}${s.ratioRec - s.ratioAnc} pts)</span>
      <span class="st-meta-key">Solde récent :</span><span>${s.ratioRec > 0 ? '+' : ''}${s.ratioRec} (positif - négatif)</span>
    </div>
    ${rendreSvg(s.buckets)}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerSentimentTrend as computeSentimentTrend,
  blocSentimentTrend as sentimentTrendSection,
};
