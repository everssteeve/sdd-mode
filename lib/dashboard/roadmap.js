// AIAD SDD Mode — Dashboard : roadmap timeline (#427).
//
// Réponds à la question stratégique du PM : « Quels Intents on livre ce
// trimestre, le suivant, et après ? ». Bucketise les Intents par trimestre
// civil (Q1-2026, Q2-2026, …) sur la base du frontmatter `target` ou
// `target_date`, ou (fallback) du mtime.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

// Parse une chaîne `target` flexible. Accepte :
//   - "Q3-2026", "Q3 2026", "2026-Q3" → quarter
//   - "2026-09-30", "2026-09", "2026" → quarter calculé depuis la date
//   - n'importe quoi d'autre → null
export function parseTarget(s) {
  if (s == null || s === '') return null;
  const str = String(s).trim();
  const qMatch = str.match(/^Q([1-4])[-\s]?(\d{4})$/i) || str.match(/^(\d{4})[-\s]?Q([1-4])$/i);
  if (qMatch) {
    // Reconnaît les 2 formes "Q3-2026" et "2026-Q3"
    const q = parseInt(qMatch[1], 10);
    const y = parseInt(qMatch[2], 10);
    // Cas "2026-Q3" : groupe 1 = année, groupe 2 = quarter
    if (q > 4) return { year: parseInt(qMatch[1], 10), quarter: parseInt(qMatch[2], 10) };
    return { year: y, quarter: q };
  }
  // Format date ISO partiel
  const dateMatch = str.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
  if (dateMatch) {
    const y = parseInt(dateMatch[1], 10);
    const m = dateMatch[2] ? parseInt(dateMatch[2], 10) : 1;
    return { year: y, quarter: Math.ceil(m / 3) };
  }
  // Tentative Date.parse pour formats moins standards
  const ts = Date.parse(str);
  if (!isNaN(ts)) {
    const d = new Date(ts);
    return { year: d.getUTCFullYear(), quarter: Math.ceil((d.getUTCMonth() + 1) / 3) };
  }
  return null;
}

// Lit le quarter cible d'un Intent. Priorité : frontmatter `target` /
// `target_date` / `quarter`. Sinon retourne null (l'Intent est mis en
// "Non daté" dans le bucket).
export function lireQuarterIntent(intent) {
  if (!intent) return null;
  const candidats = [intent.target, intent.target_date, intent.quarter, intent.Quarter];
  for (const c of candidats) {
    const parsed = parseTarget(c);
    if (parsed) return parsed;
  }
  return null;
}

// Formatte un quarter en label canonique `Q3-2026`.
export function formatQuarter(q) {
  if (!q) return '';
  return `Q${q.quarter}-${q.year}`;
}

// Clé numérique triable : 2026 * 4 + (quarter - 1).
export function cleQuarter(q) {
  if (!q) return Infinity;
  return q.year * 4 + (q.quarter - 1);
}

// Génère la séquence de quarters de [actuel - 1, actuel + N+1] pour les
// bornes du timeline. Retourne tableau de `{year, quarter}`.
export function quartersAffiches(options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const ahead = options.ahead != null ? options.ahead : 3;
  const behind = options.behind != null ? options.behind : 1;
  const d = new Date(now);
  const qNow = { year: d.getUTCFullYear(), quarter: Math.ceil((d.getUTCMonth() + 1) / 3) };
  const out = [];
  // Behind
  for (let i = behind; i > 0; i--) {
    out.push(decalerQuarter(qNow, -i));
  }
  out.push(qNow);
  // Ahead
  for (let i = 1; i <= ahead; i++) {
    out.push(decalerQuarter(qNow, i));
  }
  return out;
}

function decalerQuarter(q, delta) {
  let totalQ = q.quarter + delta;
  let year = q.year;
  while (totalQ < 1) { totalQ += 4; year -= 1; }
  while (totalQ > 4) { totalQ -= 4; year += 1; }
  return { year, quarter: totalQ };
}

// ─── Façade ──────────────────────────────────────────────────────────────────

export function calculerRoadmap(donnees, options = {}) {
  const colonnes = quartersAffiches(options);
  const now = options.now != null ? options.now : Date.now();
  const dNow = new Date(now);
  const qNow = { year: dNow.getUTCFullYear(), quarter: Math.ceil((dNow.getUTCMonth() + 1) / 3) };
  const cleActuelle = cleQuarter(qNow);

  const buckets = colonnes.map((q) => ({
    quarter: q,
    label: formatQuarter(q),
    cle: cleQuarter(q),
    intents: [],
    estActuel: cleQuarter(q) === cleActuelle,
    estPasse: cleQuarter(q) < cleActuelle,
  }));
  // "Non daté" en hors-bande.
  const nonDates = [];

  for (const i of donnees?.intents || []) {
    const q = lireQuarterIntent(i);
    if (!q) {
      nonDates.push({ id: i.id, file: i.file || null, titre: i.titre || '', statut: i.statut });
      continue;
    }
    const bucket = buckets.find((b) => b.quarter.year === q.year && b.quarter.quarter === q.quarter);
    if (bucket) {
      bucket.intents.push({ id: i.id, file: i.file || null, titre: i.titre || '', statut: i.statut, quarter: q });
    } else {
      // Hors fenêtre → on push dans le bucket le plus proche (bord)
      const dehors = cleQuarter(q) < buckets[0].cle ? buckets[0] : buckets[buckets.length - 1];
      dehors.intents.push({ id: i.id, file: i.file || null, titre: i.titre || '', statut: i.statut, quarter: q, horsFenetre: true });
    }
  }
  const totalPlanifies = buckets.reduce((s, b) => s + b.intents.length, 0);
  return {
    buckets,
    nonDates,
    totaux: {
      planifies: totalPlanifies,
      nonDates: nonDates.length,
      total: totalPlanifies + nonDates.length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';
import { statutBadge } from './render.js';

function carteIntent(it) {
  const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
  const badge = statutBadge(it.statut);
  const horsFenetre = it.horsFenetre ? '<span class="badge badge-muted" title="Hors fenêtre roadmap affichée">↗</span>' : '';
  return `<div class="roadmap-card">
    <div class="roadmap-card-id">${idCell} ${badge} ${horsFenetre}</div>
    <div class="roadmap-card-titre">${escape(it.titre || '')}</div>
  </div>`;
}

const ROADMAP_CSS = `
<style>
.roadmap-grid { display: grid; gap: .5rem; margin: .5rem 0 1rem; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
.roadmap-col { border: 1px solid var(--border, #ddd); border-radius: .5rem; padding: .5rem; background: var(--card-bg, #fff); display: flex; flex-direction: column; gap: .35rem; }
.roadmap-col.is-actuel { border-color: #4c6ef5; box-shadow: 0 0 0 2px rgba(76,110,245,.18); }
.roadmap-col.is-passe { opacity: .55; }
.roadmap-col-header { display: flex; justify-content: space-between; align-items: baseline; font-size: .75rem; }
.roadmap-col-label { font-weight: 700; letter-spacing: .04em; }
.roadmap-col-count { color: var(--muted, #777); }
.roadmap-card { padding: .35rem .5rem; background: rgba(127,127,127,.06); border-radius: .25rem; font-size: .8rem; }
.roadmap-card-id { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem; font-size: .75rem; }
.roadmap-card-titre { font-size: .78rem; line-height: 1.3; margin-top: .15rem; }
.roadmap-empty { color: var(--muted, #777); font-style: italic; font-size: .75rem; }
.roadmap-non-dates { margin-top: .5rem; padding: .5rem .75rem; background: rgba(232,89,12,.07); border-left: 3px solid #e8590c; border-radius: .25rem; font-size: .85rem; }
</style>`;

export function blocRoadmap(donnees) {
  const r = donnees?.roadmap;
  if (!r) return '';
  if (r.totaux.total === 0) return '';
  const cols = r.buckets.map((b) => {
    const cls = b.estActuel ? 'is-actuel' : (b.estPasse ? 'is-passe' : '');
    const contenu = b.intents.length === 0
      ? '<div class="roadmap-empty">Vide</div>'
      : b.intents.map(carteIntent).join('');
    return `<div class="roadmap-col ${cls}">
      <div class="roadmap-col-header">
        <span class="roadmap-col-label">${escape(b.label)}</span>
        <span class="roadmap-col-count">${b.intents.length}</span>
      </div>
      ${contenu}
    </div>`;
  }).join('');
  const banniere = r.nonDates.length > 0
    ? `<div class="roadmap-non-dates"><strong>${r.nonDates.length} Intent(s) sans cible</strong> — ajouter <code>target: Q3-2026</code> ou <code>target_date: 2026-09-30</code> dans le frontmatter pour les placer sur la roadmap.</div>`
    : '';
  return `${ROADMAP_CSS}<section>
    <h2>Roadmap par trimestre <span class="count">${r.totaux.planifies} planifiés · ${r.totaux.nonDates} sans cible</span></h2>
    <p class="muted" style="font-size:.85rem">Intents bucketisés par <code>target</code> ou <code>target_date</code> du frontmatter. La colonne mise en évidence est le trimestre en cours.</p>
    <div class="roadmap-grid">${cols}</div>
    ${banniere}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  parseTarget as parseTargetField,
  lireQuarterIntent as readIntentQuarter,
  formatQuarter as formatQuarterLabel,
  cleQuarter as quarterKey,
  quartersAffiches as displayedQuarters,
  calculerRoadmap as computeRoadmap,
  blocRoadmap as roadmapSection,
};
