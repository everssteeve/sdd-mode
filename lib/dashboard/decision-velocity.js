// AIAD SDD Mode — Dashboard : decision velocity tracker (#490).
//
// Compte le nombre de **décisions documentées** par semaine (depuis
// `pm-journal/` + `facts/`) pour répondre :
//   - "L'équipe prend-elle des décisions ou stagne-t-elle ?"
//   - "Quand a-t-on connu une période d'inertie décisionnelle ?"
//
// Sources :
//   - `.aiad/metrics/pm-journal/*.md`   — sections `## Décisions` / `## Decisions`
//     Bullet `- texte` sous l'en-tête = 1 décision.
//   - `.aiad/facts/*.md`                — chaque fichier fact = 1 décision capturée.
//
// Politique :
//   - Buckets sur N dernières semaines (défaut 8).
//   - Tendance : régression linéaire simple slope > 0.5 = accélération.
//
// Aucun effet de bord. Pure lecture filesystem.
//
// Documentation : https://aiad.ovh

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SEC_DECISIONS = /^##\s+(décisions|decisions|décision|decision)\s*$/im;

function lireRep(rep) {
  try { return readdirSync(rep); } catch (e) { return []; }
}

// Extrait les bullets `- …` situés sous une section `## Décisions`,
// jusqu'au prochain `## ` ou EOF.
export function compterDecisionsJournal(texte) {
  if (!texte) return 0;
  const lignes = texte.split(/\r?\n/);
  let dans = false;
  let count = 0;
  for (const l of lignes) {
    if (SEC_DECISIONS.test(l)) { dans = true; continue; }
    if (dans && /^##\s+/.test(l)) { dans = false; continue; }
    if (dans && /^\s*[-*]\s+/.test(l)) count++;
  }
  return count;
}

function parserDateFichier(nom, mtimeMs) {
  // Préfère le nom de fichier YYYY-MM-DD si parsable.
  const sansExt = nom.replace(/\.(md|json)$/, '');
  const t = Date.parse(sansExt);
  if (!isNaN(t)) return t;
  return mtimeMs;
}

// Regroupe les décisions par bucket de 7j sur les `nbBuckets` semaines
// se terminant à `now`. bucket[0] = plus ancien.
export function bucketsHebdo(decisions, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const nb = options.nbBuckets || 8;
  const buckets = [];
  for (let i = nb - 1; i >= 0; i--) {
    const finBucket = now - i * 7 * 24 * 3600 * 1000;
    const debutBucket = finBucket - 7 * 24 * 3600 * 1000;
    const inclus = decisions.filter((d) => d.ts >= debutBucket && d.ts < finBucket);
    buckets.push({
      idx: nb - 1 - i,
      debut: debutBucket,
      fin: finBucket,
      count: inclus.length,
      decisions: inclus,
    });
  }
  return buckets;
}

function pente(buckets) {
  const n = buckets.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = buckets.reduce((s, b) => s + b.count, 0) / n;
  let num = 0, den = 0;
  buckets.forEach((b, i) => {
    num += (i - meanX) * (b.count - meanY);
    den += (i - meanX) ** 2;
  });
  return den === 0 ? 0 : Math.round((num / den) * 100) / 100;
}

export function calculerDecisionVelocity(racineProjet, donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  // (a) pm-journal entries.
  const repJournal = join(racineProjet || '.', '.aiad', 'metrics', 'pm-journal');
  const decisions = [];
  for (const n of lireRep(repJournal)) {
    if (!n.endsWith('.md')) continue;
    const chemin = join(repJournal, n);
    let texte = '', mtime = 0;
    try {
      texte = readFileSync(chemin, 'utf8');
      mtime = statSync(chemin).mtimeMs;
    } catch { continue; }
    const ts = parserDateFichier(n, mtime);
    const nb = compterDecisionsJournal(texte);
    for (let i = 0; i < nb; i++) {
      decisions.push({ source: 'journal', ts, fichier: n });
    }
  }
  // (b) facts.
  const repFacts = join(racineProjet || '.', '.aiad', 'facts');
  for (const n of lireRep(repFacts)) {
    if (!n.endsWith('.md')) continue;
    let mtime = 0;
    try { mtime = statSync(join(repFacts, n)).mtimeMs; } catch { continue; }
    decisions.push({ source: 'fact', ts: mtime, fichier: n });
  }
  const buckets = bucketsHebdo(decisions, { now, nbBuckets: options.nbBuckets || 8 });
  const total = decisions.length;
  const moyenne = buckets.length ? Math.round((buckets.reduce((s, b) => s + b.count, 0) / buckets.length) * 10) / 10 : 0;
  const slope = pente(buckets);
  let tendance = 'stable';
  if (slope > 0.5) tendance = 'acceleration';
  else if (slope < -0.5) tendance = 'deceleration';
  // Inertie : 0 décision sur les 2 dernières semaines.
  const recentes = buckets.slice(-2).reduce((s, b) => s + b.count, 0);
  const inertie = recentes === 0 && total > 0;
  return {
    total,
    buckets,
    moyenne,
    slope,
    tendance,
    inertie,
    nbJournal: decisions.filter((d) => d.source === 'journal').length,
    nbFacts: decisions.filter((d) => d.source === 'fact').length,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const DV_CSS = `<style>
.dv-svg { width:100%; max-width:520px; height:auto; }
.dv-meta { display:grid; grid-template-columns: auto 1fr; gap:.3rem .8rem; font-size:.85rem; margin:.4rem 0; max-width: 420px; }
.dv-meta-key { color: var(--muted, #777); }
.dv-trend-up { color:#2b8a3e; font-weight:500; }
.dv-trend-down { color:#c92a2a; font-weight:500; }
.dv-trend-flat { color:var(--muted, #777); font-weight:500; }
.dv-inertie { padding:.4rem .55rem; background:rgba(232,89,12,.06); border-left:3px solid #e8590c; border-radius:.25rem; font-size:.85rem; margin:.4rem 0; }
</style>`;

function rendreSvgBars(buckets) {
  if (buckets.length === 0) return '';
  const w = 520, h = 160;
  const padLeft = 32, padRight = 12, padTop = 14, padBottom = 30;
  const zoneW = w - padLeft - padRight;
  const zoneH = h - padTop - padBottom;
  const maxY = Math.max(...buckets.map((b) => b.count), 1);
  const barW = (zoneW / buckets.length) * 0.8;
  const gap = (zoneW / buckets.length) * 0.2;
  const bars = buckets.map((b, i) => {
    const x = padLeft + i * (barW + gap) + gap / 2;
    const barH = (b.count / maxY) * zoneH;
    const y = padTop + zoneH - barH;
    const couleur = b.count === 0 ? 'rgba(127,127,127,.25)' : (i >= buckets.length - 2 && b.count >= maxY * 0.6) ? '#2b8a3e' : '#4c6ef5';
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" fill="${couleur}" rx="2"><title>Semaine -${buckets.length - 1 - i} : ${b.count} décision(s)</title></rect>`;
  }).join('');
  return `<svg class="dv-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Décisions par semaine, ${buckets.length} dernières semaines">
    ${bars}
    <line x1="${padLeft}" y1="${(padTop + zoneH).toFixed(1)}" x2="${(w - padRight).toFixed(1)}" y2="${(padTop + zoneH).toFixed(1)}" stroke="currentColor" stroke-opacity=".4"/>
    <text x="${padLeft - 4}" y="${(padTop + 4).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">${maxY}</text>
    <text x="${padLeft - 4}" y="${(padTop + zoneH + 4).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">0</text>
    <text x="${padLeft}" y="${(h - 6).toFixed(1)}" font-size="9" text-anchor="start" fill="currentColor" opacity=".55">S-${buckets.length - 1}</text>
    <text x="${(w - padRight).toFixed(1)}" y="${(h - 6).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".55">cette sem</text>
  </svg>`;
}

export function blocDecisionVelocity(donnees) {
  const v = donnees?.decisionVelocity;
  if (!v) return '';
  if (v.total === 0) {
    return `${DV_CSS}<section>
      <h2>Vélocité décisionnelle <span class="count">aucune décision documentée</span></h2>
      <p class="muted" style="font-size:.85rem">Aucune section <code>## Décisions</code> dans <code>pm-journal/</code> ni de fichier dans <code>facts/</code>. Une décision documentée = trace pour un futur audit. Lance <code>/aiad standup</code> avec une section Décisions, ou <code>/sdd fact</code> pour capturer un écart livré/désiré.</p>
    </section>`;
  }
  const trendTxt = v.tendance === 'acceleration' ? `↗ accélération (+${v.slope}/sem)`
    : v.tendance === 'deceleration' ? `↘ décélération (${v.slope}/sem)`
    : `→ stable (${v.slope >= 0 ? '+' : ''}${v.slope}/sem)`;
  const trendCls = v.tendance === 'acceleration' ? 'dv-trend-up' : v.tendance === 'deceleration' ? 'dv-trend-down' : 'dv-trend-flat';
  const inertieBox = v.inertie ? `<div class="dv-inertie">⚠ <strong>Inertie décisionnelle</strong> — 0 décision documentée sur les 2 dernières semaines. Risque : décisions implicites = drift assuré. Programmer un standup avec une section <code>## Décisions</code>.</div>` : '';
  return `${DV_CSS}<section>
    <h2>Vélocité décisionnelle <span class="count">${v.total} décision(s) total — moyenne ${v.moyenne}/sem</span></h2>
    <p class="muted" style="font-size:.85rem">Compte des décisions documentées par semaine : sections <code>## Décisions</code> dans <code>pm-journal/</code> + fichiers dans <code>facts/</code>. Une équipe qui décide explicitement réduit le drift.</p>
    <div class="dv-meta">
      <span class="dv-meta-key">Sources :</span><span>${v.nbJournal} journal · ${v.nbFacts} facts</span>
      <span class="dv-meta-key">Moyenne :</span><span><strong>${v.moyenne} décisions/sem</strong></span>
      <span class="dv-meta-key">Tendance :</span><span class="${trendCls}">${escape(trendTxt)}</span>
    </div>
    ${inertieBox}
    ${rendreSvgBars(v.buckets)}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  compterDecisionsJournal as countJournalDecisions,
  bucketsHebdo as weeklyBuckets,
  calculerDecisionVelocity as computeDecisionVelocity,
  blocDecisionVelocity as decisionVelocitySection,
};
