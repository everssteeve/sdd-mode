// AIAD SDD Mode — Dashboard : active portfolio diversity (Shannon entropy) (#537).
//
// Mesure la **diversité** du portefeuille Intents actifs sur 3 axes :
//   - tags  (thèmes produit)
//   - owner (charge équipe)
//   - sponsor (alignement stakeholders)
//
// Score : entropie de Shannon normalisée [0..1]
//   - 0 = mono-axe (tout sur 1 valeur)
//   - 1 = uniforme (équipartition)
//
// Indication PM : un portefeuille trop concentré sur 1 tag/owner signale
// un risque (single point of failure ou manque d'exploration).
//
// Pure transformation.

const STATUTS_ACTIFS = new Set(['active', 'in-progress', 'review', 'validation']);

export function entropieShannon(counts) {
  const total = counts.reduce((s, x) => s + x, 0);
  if (total === 0) return { score: 0, normalise: 0 };
  let h = 0;
  for (const c of counts) {
    if (c === 0) continue;
    const p = c / total;
    h -= p * Math.log2(p);
  }
  const max = counts.length > 1 ? Math.log2(counts.length) : 1;
  return {
    score: Math.round(h * 1000) / 1000,
    normalise: max === 0 ? 0 : Math.round((h / max) * 1000) / 1000,
  };
}

function lireValeurs(intent, ...alias) {
  for (const a of alias) {
    const v = intent?.[a];
    if (Array.isArray(v)) return v.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
    if (typeof v === 'string' && v.trim() !== '') {
      return v.split(/[,;]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    }
  }
  return [];
}

function distribuer(intents, lecteur) {
  const compteur = new Map();
  for (const i of intents) {
    const vals = lecteur(i);
    if (vals.length === 0) {
      compteur.set('(non-déclaré)', (compteur.get('(non-déclaré)') || 0) + 1);
      continue;
    }
    for (const v of vals) {
      compteur.set(v, (compteur.get(v) || 0) + 1);
    }
  }
  return [...compteur.entries()].sort((a, b) => b[1] - a[1]);
}

function classerScore(s) {
  if (s >= 0.85) return 'uniforme';
  if (s >= 0.65) return 'diversifie';
  if (s >= 0.4) return 'concentre';
  return 'mono-axe';
}

export function calculerPortfolioDiversity(donnees) {
  const actifs = (donnees?.intents || []).filter((i) => STATUTS_ACTIFS.has(i.statut));
  const dimensions = {
    tags: distribuer(actifs, (i) => lireValeurs(i, 'tags', 'Tags', 'labels')),
    owners: distribuer(actifs, (i) => lireValeurs(i, 'owner', 'Owner', 'owners')),
    sponsors: distribuer(actifs, (i) => lireValeurs(i, 'sponsor', 'sponsors', 'stakeholder')),
  };
  const scores = {};
  for (const [dim, distribution] of Object.entries(dimensions)) {
    const e = entropieShannon(distribution.map(([_, n]) => n));
    scores[dim] = {
      ...e,
      etat: classerScore(e.normalise),
      top: distribution.slice(0, 5).map(([v, n]) => ({ valeur: v, count: n })),
      total: distribution.length,
    };
  }
  return {
    nbActifs: actifs.length,
    dimensions: scores,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const PD_CSS = `<style>
.pd-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:.5rem; margin:.4rem 0; }
.pd-card { padding:.55rem .7rem; border-radius:.35rem; background:rgba(127,127,127,.04); border-left:3px solid var(--accent, #4c6ef5); }
.pd-card.e-uniforme { border-left-color:#2b8a3e; background:rgba(43,138,62,.04); }
.pd-card.e-diversifie { border-left-color:#3a9c4f; }
.pd-card.e-concentre { border-left-color:#f5a623; background:rgba(245,166,35,.05); }
.pd-card.e-mono-axe { border-left-color:#c92a2a; background:rgba(201,42,42,.05); }
.pd-head { display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; font-size:.88rem; }
.pd-score { font-weight:700; font-size:.95rem; }
.pd-bar { width:100%; height:6px; background:rgba(127,127,127,.15); border-radius:3px; overflow:hidden; margin:.25rem 0; }
.pd-fill { height:100%; transition:width .15s; }
.pd-fill.e-uniforme { background:#2b8a3e; }
.pd-fill.e-diversifie { background:#3a9c4f; }
.pd-fill.e-concentre { background:#f5a623; }
.pd-fill.e-mono-axe { background:#c92a2a; }
.pd-top { font-size:.75rem; color:var(--muted, #777); margin:.2rem 0; }
.pd-top .pd-pill { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; margin:.05rem .15rem .05rem 0; display:inline-block; }
.pd-tag { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.7rem; }
.pd-tag.e-uniforme { background:rgba(43,138,62,.15); color:#1c5a2a; }
.pd-tag.e-diversifie { background:rgba(43,138,62,.12); color:#1c5a2a; }
.pd-tag.e-concentre { background:rgba(245,166,35,.15); color:#7a560f; }
.pd-tag.e-mono-axe { background:rgba(201,42,42,.15); color:#7a1717; }
.pd-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

const LABELS = {
  uniforme: '✓ Uniforme (≥ 0.85)',
  diversifie: '◐ Diversifié (0.65-0.85)',
  concentre: '⚠ Concentré (0.40-0.65)',
  'mono-axe': '⛔ Mono-axe (< 0.40)',
};

const DIM_LABELS = { tags: '🏷 Tags / Thèmes', owners: '👤 Owners', sponsors: '🎯 Sponsors' };

export function blocPortfolioDiversity(donnees) {
  const p = donnees?.portfolioDiversity;
  if (!p) return '';
  if (p.nbActifs === 0) {
    return `${PD_CSS}<section>
      <h2>Diversité du portefeuille actif <span class="count">aucun Intent actif</span></h2>
      <div class="pd-empty">Mesure la diversité des Intents actifs sur 3 axes (tags / owners / sponsors) via entropie de Shannon normalisée. Score 0 = mono-axe (single point of failure) ; 1 = équiparti (sain).</div>
    </section>`;
  }
  const cards = Object.entries(p.dimensions).map(([dim, s]) => {
    const pct = Math.round(s.normalise * 100);
    const top = s.top.map((t) => `<span class="pd-pill">${escape(t.valeur)} ×${t.count}</span>`).join('');
    return `<div class="pd-card e-${escape(s.etat)}">
      <div class="pd-head">
        <span>${DIM_LABELS[dim]}</span>
        <span class="pd-score">${s.normalise}</span>
        <span class="pd-tag e-${escape(s.etat)}">${escape(LABELS[s.etat])}</span>
        <span class="muted" style="font-size:.7rem">${s.total} valeur(s) uniques</span>
      </div>
      <div class="pd-bar"><div class="pd-fill e-${escape(s.etat)}" style="width:${pct}%"></div></div>
      <div class="pd-top">Top : ${top}</div>
    </div>`;
  }).join('');
  return `${PD_CSS}<section>
    <h2>Diversité du portefeuille actif <span class="count">${p.nbActifs} Intent(s) actif(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Entropie de Shannon normalisée [0..1] sur 3 axes du portefeuille actif : <strong>tags</strong> (équilibre thématique), <strong>owners</strong> (équilibre charge équipe), <strong>sponsors</strong> (équilibre stakeholders). Score &lt; 0.4 = concentration risquée.</p>
    <div class="pd-grid">${cards}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  entropieShannon as shannonEntropy,
  calculerPortfolioDiversity as computePortfolioDiversity,
  blocPortfolioDiversity as portfolioDiversitySection,
};
