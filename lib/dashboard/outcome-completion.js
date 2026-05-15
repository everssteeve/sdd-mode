// AIAD SDD Mode — Dashboard : outcome completion progress (#530).
//
// Pour chaque outcome PRD, calcule un % de complétion = SPECs livrées /
// SPECs attendues (via Intents rattachés). Va plus loin que
// `#492 outcome-attribution` qui montre les SPECs livrées mais sans
// progress relatif.
//
// Pure transformation.

const STATUTS_LIVRES = new Set(['done', 'archived']);

function indexerSpecsParCourt(specs) {
  const m = new Map();
  for (const s of specs || []) {
    if (!s.parentIntent) continue;
    const court = String(s.parentIntent).split('-').slice(0, 2).join('-');
    if (!m.has(court)) m.set(court, []);
    m.get(court).push(s);
  }
  return m;
}

export function calculerOutcomeCompletion(donnees) {
  const outcomes = donnees?.prdCoverage?.outcomes || [];
  const specsParCourt = indexerSpecsParCourt(donnees?.specs);
  const items = outcomes.map((o) => {
    let totalSpecs = 0;
    let livreesSpecs = 0;
    const intentsRattaches = o.intents || [];
    for (const i of intentsRattaches) {
      const court = String(i.id || '').split('-').slice(0, 2).join('-');
      const specs = specsParCourt.get(court) || [];
      totalSpecs += specs.length;
      livreesSpecs += specs.filter((s) => STATUTS_LIVRES.has(s.statut)).length;
    }
    const pct = totalSpecs === 0 ? null : Math.round((livreesSpecs / totalSpecs) * 100);
    let etat = 'sans-data';
    if (pct == null) etat = 'sans-data';
    else if (pct === 100) etat = 'complet';
    else if (pct >= 60) etat = 'avance';
    else if (pct >= 25) etat = 'progresse';
    else etat = 'debut';
    return {
      titre: o.titre || o.label || '?',
      target: o.target || null,
      nbIntents: intentsRattaches.length,
      totalSpecs,
      livreesSpecs,
      pct,
      etat,
    };
  });
  items.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
  const totaux = {
    outcomes: items.length,
    complet: items.filter((i) => i.etat === 'complet').length,
    avance: items.filter((i) => i.etat === 'avance').length,
    progresse: items.filter((i) => i.etat === 'progresse').length,
    debut: items.filter((i) => i.etat === 'debut').length,
    sansData: items.filter((i) => i.etat === 'sans-data').length,
    pctMoyen: items.filter((i) => i.pct != null).length === 0 ? null
      : Math.round(items.filter((i) => i.pct != null).reduce((s, x) => s + x.pct, 0) / items.filter((i) => i.pct != null).length),
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const OC_CSS = `<style>
.oc-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.oc-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.oc-stat .oc-val { font-size:1.2rem; font-weight:700; }
.oc-stat .oc-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.oc-stat.e-complet { background:rgba(43,138,62,.1); border-color:rgba(43,138,62,.4); }
.oc-stat.e-avance { background:rgba(43,138,62,.05); border-color:rgba(43,138,62,.3); }
.oc-stat.e-progresse { background:rgba(245,166,35,.05); border-color:rgba(245,166,35,.3); }
.oc-stat.e-debut { background:rgba(232,89,12,.06); border-color:rgba(232,89,12,.3); }
.oc-stat.e-sans-data { background:rgba(127,127,127,.04); }
.oc-row { padding:.45rem .55rem; margin:.25rem 0; border-radius:.3rem; background:rgba(127,127,127,.04); border-left:3px solid var(--border, #ccc); }
.oc-row.e-complet { border-left-color:#2b8a3e; background:rgba(43,138,62,.05); }
.oc-row.e-avance { border-left-color:rgba(43,138,62,.7); background:rgba(43,138,62,.03); }
.oc-row.e-progresse { border-left-color:#f5a623; }
.oc-row.e-debut { border-left-color:#e8590c; }
.oc-row.e-sans-data { border-left-color:rgba(127,127,127,.3); opacity:.75; }
.oc-head { display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; font-size:.88rem; }
.oc-progress { width:140px; height:8px; background:rgba(127,127,127,.15); border-radius:4px; overflow:hidden; display:inline-block; vertical-align:middle; }
.oc-fill { height:100%; transition:width .2s; }
.oc-fill.e-complet { background:#2b8a3e; }
.oc-fill.e-avance { background:#3a9c4f; }
.oc-fill.e-progresse { background:#f5a623; }
.oc-fill.e-debut { background:#e8590c; }
.oc-pct { font-weight:600; padding:.05rem .35rem; border-radius:.18rem; font-size:.75rem; }
.oc-pct.e-complet { background:rgba(43,138,62,.18); color:#1c5a2a; }
.oc-pct.e-avance { background:rgba(43,138,62,.12); color:#1c5a2a; }
.oc-pct.e-progresse { background:rgba(245,166,35,.15); color:#7a560f; }
.oc-pct.e-debut { background:rgba(232,89,12,.15); color:#7a3a08; }
.oc-pct.e-sans-data { background:rgba(127,127,127,.12); }
.oc-meta { font-size:.75rem; color:var(--muted, #777); margin-top:.25rem; }
</style>`;

const LABELS = {
  complet: '✓ Complet (100%)',
  avance: '◐ Avancé (≥ 60%)',
  progresse: '◐ Progresse (25-60%)',
  debut: '⚠ Début (< 25%)',
  'sans-data': '⊘ Sans SPECs',
};

export function blocOutcomeCompletion(donnees) {
  const o = donnees?.outcomeCompletion;
  if (!o) return '';
  if (o.items.length === 0) {
    return `${OC_CSS}<section>
      <h2>Complétion des outcomes <span class="count">aucun outcome PRD</span></h2>
      <p class="muted" style="font-size:.85rem">Pour chaque outcome PRD (#428), calcule % de complétion = SPECs livrées / SPECs attendues via Intents rattachés.</p>
    </section>`;
  }
  const t = o.totaux;
  const grid = ['complet', 'avance', 'progresse', 'debut', 'sans-data'].map((etat) => {
    const cle = etat === 'sans-data' ? 'sansData' : etat;
    return `<div class="oc-stat e-${etat}">
      <div class="oc-val">${t[cle] || 0}</div>
      <div class="oc-label">${escape(LABELS[etat])}</div>
    </div>`;
  }).join('');
  const rows = o.items.slice(0, 15).map((it) => {
    const pct = it.pct == null ? 0 : it.pct;
    const pctTxt = it.pct == null ? 'sans data' : `${it.pct}%`;
    return `<div class="oc-row e-${escape(it.etat)}">
      <div class="oc-head">
        <strong>${escape(it.titre.slice(0, 60))}</strong>
        <span class="oc-pct e-${escape(it.etat)}">${escape(pctTxt)}</span>
        <span class="oc-progress"><span class="oc-fill e-${escape(it.etat)}" style="width:${pct}%"></span></span>
      </div>
      <div class="oc-meta">${it.nbIntents} Intent(s) rattaché(s) · ${it.livreesSpecs}/${it.totalSpecs} SPEC(s) livrée(s)${it.target ? ` · cible ${escape(it.target)}` : ''}</div>
    </div>`;
  }).join('');
  return `${OC_CSS}<section>
    <h2>Complétion des outcomes <span class="count">${t.outcomes} outcome(s) — moyenne ${t.pctMoyen ?? '—'}%</span></h2>
    <p class="muted" style="font-size:.85rem">% de complétion = SPECs livrées / SPECs attendues via Intents rattachés. États : complet (100 %) / avancé (≥ 60 %) / progresse (25-60 %) / début (&lt; 25 %) / sans-data (0 SPEC).</p>
    <div class="oc-grid">${grid}</div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerOutcomeCompletion as computeOutcomeCompletion,
  blocOutcomeCompletion as outcomeCompletionSection,
};
