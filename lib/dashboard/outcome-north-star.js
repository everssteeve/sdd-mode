// AIAD SDD Mode — Dashboard : outcome → North Star alignment (#556).
//
// Comme `#526 goal-alignment` mais au niveau **outcome PRD §4** (et non
// Intent). Mesure pour chaque outcome déclaré la similarité Jaccard
// avec le North Star §2.
//
// Pure transformation.

const STOPWORDS = new Set([
  'pour', 'avec', 'mais', 'sans', 'dans', 'cette', 'cela', 'tout', 'tous',
  'plus', 'moins', 'doit', 'doivent', 'avoir', 'etre', 'fait', 'faire',
  'leur', 'leurs', 'sur', 'sous', 'the', 'and', 'for', 'with', 'this',
  'that', 'must', 'have', 'will', 'our', 'product', 'produit',
]);

function tokens(s) {
  return (String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3 && !STOPWORDS.has(t)));
}

function jaccard(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function classer(score) {
  if (score >= 0.15) return 'aligne';
  if (score >= 0.05) return 'partiel';
  return 'isole';
}

function lireNorthStar(donnees) {
  const direct = donnees?.goalTree?.northStar || donnees?.northStar;
  if (direct && typeof direct === 'string') return direct;
  if (direct && direct.texte) return direct.texte;
  return '';
}

export function calculerOutcomeNorthStar(donnees) {
  const ns = lireNorthStar(donnees);
  if (!ns) {
    return { items: [], message: 'North Star non détecté', northStar: null };
  }
  const tokensNS = tokens(ns);
  const outcomes = donnees?.prdCoverage?.outcomes || [];
  const items = outcomes.map((o) => {
    const titre = o.titre || o.label || '';
    const tokensOut = tokens(titre);
    const score = jaccard(tokensOut, tokensNS);
    return {
      titre,
      target: o.target || null,
      nbIntents: (o.intents || []).length,
      score: Math.round(score * 1000) / 1000,
      etat: classer(score),
    };
  });
  items.sort((a, b) => b.score - a.score);
  const totaux = {
    total: items.length,
    aligne: items.filter((i) => i.etat === 'aligne').length,
    partiel: items.filter((i) => i.etat === 'partiel').length,
    isole: items.filter((i) => i.etat === 'isole').length,
    scoreMoyen: items.length === 0 ? 0
      : Math.round(items.reduce((s, x) => s + x.score, 0) / items.length * 1000) / 1000,
  };
  return { items, totaux, northStar: ns, tokensNorthStar: tokensNS.length };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const ON_CSS = `<style>
.ons-ns { padding:.5rem .65rem; background:rgba(76,110,245,.05); border-left:3px solid #4c6ef5; border-radius:.25rem; font-size:.85rem; margin:.3rem 0; font-style:italic; }
.ons-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.ons-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.ons-stat .ons-val { font-size:1.2rem; font-weight:700; }
.ons-stat .ons-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.ons-stat.e-aligne { background:rgba(43,138,62,.07); border-color:rgba(43,138,62,.3); }
.ons-stat.e-isole { background:rgba(201,42,42,.06); border-color:rgba(201,42,42,.3); }
.ons-row { padding:.35rem .5rem; margin:.15rem 0; font-size:.82rem; background:rgba(127,127,127,.04); border-radius:.22rem; display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; }
.ons-row.r-aligne { border-left:3px solid #2b8a3e; }
.ons-row.r-partiel { border-left:3px solid #e8590c; }
.ons-row.r-isole { border-left:3px solid #c92a2a; background:rgba(201,42,42,.03); }
.ons-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

export function blocOutcomeNorthStar(donnees) {
  const o = donnees?.outcomeNorthStar;
  if (!o) return '';
  if (o.message) {
    return `${ON_CSS}<section>
      <h2>Alignement Outcome ↔ North Star <span class="count">${escape(o.message)}</span></h2>
      <div class="ons-empty">Mesure similarité Jaccard (tokens > 3 chars, stopwords supprimés) entre chaque outcome PRD §4 et le North Star §2. Ajoute une section <code>## 2. North Star</code> au PRD pour activer.</div>
    </section>`;
  }
  if (o.items.length === 0) {
    return `${ON_CSS}<section>
      <h2>Alignement Outcome ↔ North Star <span class="count">aucun outcome PRD</span></h2>
    </section>`;
  }
  const t = o.totaux;
  const grid = ['aligne', 'partiel', 'isole'].map((etat) => `<div class="ons-stat e-${etat}">
      <div class="ons-val">${t[etat] || 0}</div>
      <div class="ons-label">${escape(etat)}</div>
    </div>`).join('');
  const rows = o.items.map((it) => `<div class="ons-row r-${escape(it.etat)}">
    <strong>${it.score.toFixed(3)}</strong>
    <span>${escape((it.titre || '').slice(0, 60))}</span>
    <span class="muted">${it.nbIntents} Intent(s)${it.target ? ' · ' + escape(it.target) : ''}</span>
  </div>`).join('');
  return `${ON_CSS}<section>
    <h2>Alignement Outcome ↔ North Star <span class="count">${t.total} outcomes · score moyen ${t.scoreMoyen}</span></h2>
    <p class="muted" style="font-size:.85rem">Similarité Jaccard entre chaque outcome PRD §4 et le North Star §2. Outcomes isolés (&lt; 0.05) = signal de dérive vs vision produit. Seuils : aligné ≥ 0.15, partiel 0.05-0.15.</p>
    <div class="ons-ns">North Star : « ${escape((o.northStar || '').slice(0, 180))}${o.northStar && o.northStar.length > 180 ? '…' : ''} »</div>
    <div class="ons-grid">${grid}</div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerOutcomeNorthStar as computeOutcomeNorthStar,
  blocOutcomeNorthStar as outcomeNorthStarSection,
};
