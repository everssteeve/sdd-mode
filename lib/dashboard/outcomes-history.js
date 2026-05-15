// AIAD SDD Mode — Dashboard : timeline historique des Outcome Criteria (#210).
//
// Suite #208/#209. Lit TOUS les snapshots `.aiad/metrics/outcomes/*.md` (au
// lieu du dernier uniquement) et produit une sparkline SVG par critère
// numérique. Ligne pointillée horizontale = cible PRD. Permet aux exec
// sponsors de répondre : "On converge ou on s'éloigne de la cible ?"
//
// Architecture cohérente avec tech-debt-history.js (#198) — buckets
// hebdomadaires UTC, dernier snapshot prend pour multiples le même jour.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename, relative } from 'node:path';
import { parserValeur } from './outcomes.js';
import { bucketsHebdomadaires as bucketsHebdomadairesGen } from './_history-utils.js';

const PATTERN_DATE = /^(\d{4}-\d{2}-\d{2})/;

// Parse un fichier de mesures (même format que lireMesures). On extrait
// {date, mesures[]} pour permettre la timeline. Format colonne
// `| Critère | Actuel | ...` (alias EN supportés).
function parserFichierMesures(contenu, dateDefaut) {
  const lignes = contenu.split('\n');
  let i = 0;
  while (i < lignes.length && !lignes[i].trim().startsWith('|')) i += 1;
  if (i >= lignes.length) return { date: dateDefaut, mesures: [] };
  const headers = lignes[i].split('|').map((c) => c.trim()).filter(Boolean);
  const idxCritere = headers.findIndex((h) => /^crit(ère|erion|eria)/i.test(h));
  const idxActuel = headers.findIndex((h) => /^(actuel|current|measured|valeur)/i.test(h));
  if (idxCritere < 0 || idxActuel < 0) return { date: dateDefaut, mesures: [] };
  let j = i + 1;
  if (j < lignes.length && /^[\s|:-]+$/.test(lignes[j])) j += 1;
  const mesures = [];
  while (j < lignes.length) {
    const ligne = lignes[j];
    if (!ligne.trim().startsWith('|')) break;
    const cells = ligne.split('|').map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (cells.length === 0) { j += 1; continue; }
    const critere = cells[idxCritere];
    const actuel = cells[idxActuel];
    if (critere && actuel && !/^[-:\s]+$/.test(actuel)) {
      const v = parserValeur(actuel);
      mesures.push({ critere, actuel, num: v.num });
    }
    j += 1;
  }
  return { date: dateDefaut, mesures };
}

// Lit tous les snapshots `.aiad/metrics/outcomes/*.md` triés chrono asc.
// Retourne `[{date, fichier, mesures: [{critere, actuel, num}]}]`.
export function lireHistorique(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'metrics', 'outcomes');
  if (!existsSync(dir)) return [];
  let entries;
  try { entries = readdirSync(dir); } catch { return []; }
  const out = [];
  for (const nom of entries) {
    if (!nom.endsWith('.md')) continue;
    const dm = basename(nom, '.md').match(PATTERN_DATE);
    if (!dm) continue;
    const p = join(dir, nom);
    let contenu;
    try { contenu = readFileSync(p, 'utf-8'); } catch { continue; }
    const { mesures } = parserFichierMesures(contenu, dm[1]);
    out.push({ date: dm[1], fichier: relative(racineProjet, p), mesures });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

// Re-organise l'historique par critère. Retourne une Map
// `critère normalisé → [{date, actuel, num}]` triée chrono.
export function indexerParCritere(historique) {
  const idx = new Map();
  for (const snap of historique) {
    for (const m of snap.mesures) {
      const key = String(m.critere).toLowerCase().trim();
      if (!idx.has(key)) idx.set(key, { critere: m.critere, points: [] });
      idx.get(key).points.push({ date: snap.date, actuel: m.actuel, num: m.num });
    }
  }
  return idx;
}

// (#220) Bucketing délégué à `_history-utils.js`. Forme outcomes : {num, actuel}.
export function bucketsHebdomadaires(points, opts = {}) {
  return bucketsHebdomadairesGen(points, {
    weeks: opts.weeks ?? 12,
    now: opts.now,
    extract: (p) => ({ num: p.num, actuel: p.actuel }),
    baseEntry: { num: null, actuel: null },
  });
}

// Façade : retourne, pour chaque critère du PRD numérique, ses buckets
// hebdomadaires et la cible numérique parsée pour la ligne de référence.
//   donnees = sortie de `lireOutcomes(racine)` (avec criteres[])
export function calculerTimelines(racineProjet, criteresPrd, opts = {}) {
  const historique = lireHistorique(racineProjet);
  if (historique.length === 0) return { snapshots: 0, timelines: [] };
  const idx = indexerParCritere(historique);
  const out = [];
  for (const c of criteresPrd || []) {
    const key = String(c.critere).toLowerCase().trim();
    const entry = idx.get(key);
    if (!entry || entry.points.length === 0) continue;
    const cibleParsed = parserValeur(c.cible);
    if (cibleParsed.num == null) continue; // critères non-numériques pas timelineables
    const buckets = bucketsHebdomadaires(entry.points, opts);
    out.push({
      critere: c.critere,
      cible: c.cible,
      cibleNum: cibleParsed.num,
      direction: cibleParsed.direction,
      buckets,
      pointsTotal: entry.points.length,
    });
  }
  return { snapshots: historique.length, timelines: out };
}

// ─── Rendu HTML ─────────────────────────────────────────────────────────────

import { escape } from './render.js';

function couleurEtat(num, cible, direction) {
  if (num == null) return '#888';
  if (direction === 'lower') {
    if (num <= cible) return '#2b8a3e'; // ok
    if (num <= cible * 1.5) return '#e8590c'; // warn
    return '#c92a2a'; // bad
  }
  if (num >= cible) return '#2b8a3e';
  if (num >= cible * 0.7) return '#e8590c';
  return '#c92a2a';
}

function renduSparkline(tl) {
  const buckets = tl.buckets;
  if (buckets.length === 0) return '';
  const valides = buckets.filter((b) => b.num != null);
  if (valides.length === 0) return '';
  const max = Math.max(tl.cibleNum * 1.2, ...valides.map((b) => b.num));
  const min = Math.min(0, tl.cibleNum * 0.8, ...valides.map((b) => b.num));
  const W = 280;
  const H = 60;
  const padX = 4;
  const padY = 4;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const stepX = innerW / (buckets.length - 1 || 1);

  function y(num) {
    if (num == null) return null;
    const norm = (num - min) / (max - min || 1);
    return padY + (1 - norm) * innerH;
  }

  // Polyline reliant les points (gap si num=null = brisure)
  const segments = [];
  let courant = [];
  for (let i = 0; i < buckets.length; i++) {
    const px = padX + i * stepX;
    const py = y(buckets[i].num);
    if (py == null) {
      if (courant.length > 1) segments.push(courant);
      courant = [];
    } else {
      courant.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
  }
  if (courant.length > 1) segments.push(courant);

  const lignes = segments.map((seg) =>
    `<polyline points="${seg.join(' ')}" fill="none" stroke="#4c6ef5" stroke-width="1.5"/>`
  ).join('');

  // Points individuels (cercles colorés selon état)
  const cercles = buckets.map((b, i) => {
    if (b.num == null) return '';
    const px = padX + i * stepX;
    const py = y(b.num);
    const couleur = couleurEtat(b.num, tl.cibleNum, tl.direction);
    return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.5" fill="${couleur}"><title>${escape(b.semaine)} : ${escape(b.actuel || '')}</title></circle>`;
  }).join('');

  // Ligne pointillée de la cible
  const yCible = y(tl.cibleNum);
  const ligneCible = yCible != null
    ? `<line x1="${padX}" y1="${yCible.toFixed(1)}" x2="${(W - padX).toFixed(1)}" y2="${yCible.toFixed(1)}" stroke="#888" stroke-width="1" stroke-dasharray="3,3"><title>Cible : ${escape(tl.cible)}</title></line>`
    : '';

  return `<div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;border-bottom:1px solid var(--border);font-size:.85rem">
    <div style="flex:1;min-width:0">
      <strong>${escape(tl.critere)}</strong>
      <span class="muted" style="font-size:.75rem">cible <code>${escape(tl.cible)}</code> · ${tl.pointsTotal} mesure(s)</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Timeline ${escape(tl.critere)}" style="width:280px;height:60px;flex-shrink:0">
      ${ligneCible}
      ${lignes}
      ${cercles}
    </svg>
  </div>`;
}

export function renduTimelines(evolution) {
  if (!evolution || !evolution.timelines || evolution.timelines.length === 0) return '';
  const cartes = evolution.timelines.map((tl) => renduSparkline(tl)).filter(Boolean).join('');
  if (!cartes) return '';
  return `<div style="margin-top:.75rem">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
      <strong style="font-size:.9rem">Évolution ${evolution.timelines[0].buckets.length} dernières semaines</strong>
      <span class="muted" style="font-size:.75rem">${evolution.snapshots} snapshot(s) · ligne pointillée = cible</span>
    </div>
    ${cartes}
  </div>`;
}

// Alias EN canoniques (#42)
export {
  lireHistorique as readHistory,
  indexerParCritere as indexByCriterion,
  bucketsHebdomadaires as weeklyBuckets,
  calculerTimelines as computeTimelines,
  renduTimelines as renderTimelines,
};
