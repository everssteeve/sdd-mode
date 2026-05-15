// AIAD SDD Mode — Dashboard : backlog throughput trend (intake vs delivery) (#520).
//
// Compare hebdomadairement :
//   - Intake   : nb Intents créés cette semaine (mtime dans la fenêtre)
//   - Delivery : nb Intents passés en done/archived (proxy : mtime + statut)
//
// Si intake > delivery sur N semaines consécutives → le backlog gonfle
// plus vite qu'il ne se vide. Signal majeur pour la priorisation.
//
// Politique :
//   - Fenêtre par défaut 6 semaines
//   - Intake = `intent.mtime` dans la semaine (proxy de création)
//   - Delivery = `intent.statut in (done, archived) AND mtime in week`
//   - Note : avec mtime seul on ne distingue pas création vs modif.
//     Heuristique acceptable en l'absence de git history.
//
// Pure transformation.

const DAY = 24 * 3600 * 1000;
const SEM = 7 * DAY;

function dansSemaine(ts, finSem) {
  return ts >= finSem - SEM && ts < finSem;
}

export function calculerThroughputTrend(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const nbSem = options.nbSemaines || 6;
  const intents = donnees?.intents || [];
  const buckets = [];
  for (let i = nbSem - 1; i >= 0; i--) {
    const finSem = now - i * SEM;
    const intake = intents.filter((it) => it.mtime && dansSemaine(it.mtime, finSem)).length;
    const delivery = intents.filter((it) =>
      ['done', 'archived'].includes(it.statut) && it.mtime && dansSemaine(it.mtime, finSem)).length;
    buckets.push({
      idx: nbSem - 1 - i,
      finSem,
      intake,
      delivery,
      delta: intake - delivery,
    });
  }
  // Direction sur 3 dernières semaines.
  const dernieres3 = buckets.slice(-3);
  const sumIntake = dernieres3.reduce((s, b) => s + b.intake, 0);
  const sumDelivery = dernieres3.reduce((s, b) => s + b.delivery, 0);
  let direction = 'equilibre';
  if (sumIntake > sumDelivery + 2) direction = 'gonfle';
  else if (sumDelivery > sumIntake + 2) direction = 'reduit';
  return {
    buckets,
    nbSem,
    cumul: {
      intake: buckets.reduce((s, b) => s + b.intake, 0),
      delivery: buckets.reduce((s, b) => s + b.delivery, 0),
    },
    dernieres3: { intake: sumIntake, delivery: sumDelivery },
    direction,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const TT_CSS = `<style>
.tt-svg { width:100%; max-width:540px; height:auto; }
.tt-meta { display:grid; grid-template-columns: auto 1fr; gap:.3rem .8rem; font-size:.85rem; margin:.4rem 0; max-width: 480px; }
.tt-meta-key { color: var(--muted, #777); }
.tt-dir-gonfle { color:#c92a2a; font-weight:500; }
.tt-dir-reduit { color:#2b8a3e; font-weight:500; }
.tt-dir-equilibre { color:var(--muted, #777); font-weight:500; }
.tt-warning { padding:.4rem .55rem; background:rgba(201,42,42,.06); border-left:3px solid #c92a2a; border-radius:.25rem; font-size:.85rem; margin:.3rem 0; }
.tt-good { padding:.4rem .55rem; background:rgba(43,138,62,.06); border-left:3px solid #2b8a3e; border-radius:.25rem; font-size:.85rem; color:#1c5a2a; margin:.3rem 0; }
</style>`;

function rendreSvgBars(buckets) {
  const w = 540, h = 180;
  const padL = 30, padR = 12, padT = 14, padB = 30;
  const zoneW = w - padL - padR;
  const zoneH = h - padT - padB;
  const maxY = Math.max(...buckets.flatMap((b) => [b.intake, b.delivery]), 1);
  const groupW = zoneW / buckets.length;
  const barW = (groupW * 0.4);
  const gap = groupW * 0.1;
  const items = buckets.map((b, i) => {
    const xC = padL + i * groupW + groupW / 2;
    const xIntake = xC - barW - gap / 2;
    const xDeliv = xC + gap / 2;
    const hIntake = (b.intake / maxY) * zoneH;
    const hDeliv = (b.delivery / maxY) * zoneH;
    return `<rect x="${xIntake.toFixed(1)}" y="${(padT + zoneH - hIntake).toFixed(1)}" width="${barW.toFixed(1)}" height="${hIntake.toFixed(1)}" fill="#4c6ef5" rx="1.5"><title>S-${buckets.length - 1 - i} intake : ${b.intake}</title></rect>
      <rect x="${xDeliv.toFixed(1)}" y="${(padT + zoneH - hDeliv).toFixed(1)}" width="${barW.toFixed(1)}" height="${hDeliv.toFixed(1)}" fill="#2b8a3e" rx="1.5"><title>S-${buckets.length - 1 - i} delivery : ${b.delivery}</title></rect>`;
  }).join('');
  return `<svg class="tt-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Throughput intake vs delivery">
    ${items}
    <line x1="${padL}" y1="${(padT + zoneH).toFixed(1)}" x2="${(w - padR).toFixed(1)}" y2="${(padT + zoneH).toFixed(1)}" stroke="currentColor" stroke-opacity=".4"/>
    <text x="${padL - 4}" y="${(padT + 4).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">${maxY}</text>
    <text x="${padL - 4}" y="${(padT + zoneH + 4).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">0</text>
    <text x="${padL}" y="${(h - 8).toFixed(1)}" font-size="9" text-anchor="start" fill="currentColor" opacity=".55">S-${buckets.length - 1}</text>
    <text x="${(w - padR).toFixed(1)}" y="${(h - 8).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">cette sem</text>
    <rect x="${(padL + 4).toFixed(1)}" y="${(padT + 4).toFixed(1)}" width="10" height="10" fill="#4c6ef5"/>
    <text x="${(padL + 18).toFixed(1)}" y="${(padT + 13).toFixed(1)}" font-size="9" fill="currentColor">intake</text>
    <rect x="${(padL + 60).toFixed(1)}" y="${(padT + 4).toFixed(1)}" width="10" height="10" fill="#2b8a3e"/>
    <text x="${(padL + 74).toFixed(1)}" y="${(padT + 13).toFixed(1)}" font-size="9" fill="currentColor">delivery</text>
  </svg>`;
}

export function blocThroughputTrend(donnees) {
  const t = donnees?.throughputTrend;
  if (!t) return '';
  const direction = t.direction;
  const dirTxt = direction === 'gonfle' ? '↗ backlog gonfle (intake > delivery)'
    : direction === 'reduit' ? '↘ backlog se réduit (delivery > intake)'
    : '→ équilibré (intake ≈ delivery)';
  const dirCls = direction === 'gonfle' ? 'tt-dir-gonfle'
    : direction === 'reduit' ? 'tt-dir-reduit' : 'tt-dir-equilibre';
  const alert = direction === 'gonfle'
    ? `<div class="tt-warning">⚠ <strong>Backlog en croissance</strong> — sur 3 sem : ${t.dernieres3.intake} entrées vs ${t.dernieres3.delivery} sorties. Prioriser le delivery ou freiner l'intake.</div>`
    : direction === 'reduit'
      ? `<div class="tt-good">✓ <strong>Backlog en réduction</strong> — sur 3 sem : ${t.dernieres3.delivery} sorties vs ${t.dernieres3.intake} entrées. Tendance saine.</div>`
      : '';
  return `${TT_CSS}<section>
    <h2>Throughput backlog <span class="count">intake vs delivery ${t.nbSem} sem</span></h2>
    <p class="muted" style="font-size:.85rem">Compare l'intake (Intents créés, bleu) vs delivery (Intents passés en done/archived, vert) par semaine sur ${t.nbSem} semaines. Direction calculée sur les 3 dernières.</p>
    <div class="tt-meta">
      <span class="tt-meta-key">Cumul ${t.nbSem}sem :</span><span>${t.cumul.intake} intake · ${t.cumul.delivery} delivery</span>
      <span class="tt-meta-key">3 dernières sem :</span><span>${t.dernieres3.intake} intake · ${t.dernieres3.delivery} delivery</span>
      <span class="tt-meta-key">Direction :</span><span class="${dirCls}">${escape(dirTxt)}</span>
    </div>
    ${alert}
    ${rendreSvgBars(t.buckets)}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerThroughputTrend as computeThroughputTrend,
  blocThroughputTrend as throughputTrendSection,
};
