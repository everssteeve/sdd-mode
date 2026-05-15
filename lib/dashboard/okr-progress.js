// AIAD SDD Mode — Dashboard : OKR progress per quarter (#545).
//
// Va plus loin que `#444 okr-mapping` (qui liste les Intents par KR)
// en calculant un **% de complétion par OKR** basé sur les SPECs
// livrées des Intents rattachés.
//
// Lit les OKR depuis `donnees.okrMapping.objectifs` (#444).
//
// Pure transformation.

const STATUTS_LIVRES = new Set(['done', 'archived']);

function indexerSpecs(specs) {
  const m = new Map();
  for (const s of specs || []) {
    if (!s.parentIntent) continue;
    const court = String(s.parentIntent).split('-').slice(0, 2).join('-');
    if (!m.has(court)) m.set(court, []);
    m.get(court).push(s);
  }
  return m;
}

export function calculerOkrProgress(donnees) {
  const okr = donnees?.okrMapping;
  if (!okr || !Array.isArray(okr.objectifs)) {
    return { objectifs: [], message: 'OKR non détectés' };
  }
  const specsParCourt = indexerSpecs(donnees?.specs);
  const objectifs = okr.objectifs.map((obj) => {
    const krs = (obj.keyResults || []).map((kr) => {
      const intents = kr.intents || [];
      let totalSpecs = 0;
      let livreesSpecs = 0;
      for (const i of intents) {
        const court = String(i.id || '').split('-').slice(0, 2).join('-');
        const specs = specsParCourt.get(court) || [];
        totalSpecs += specs.length;
        livreesSpecs += specs.filter((s) => STATUTS_LIVRES.has(s.statut)).length;
      }
      const pct = totalSpecs === 0 ? null : Math.round((livreesSpecs / totalSpecs) * 100);
      let etat;
      if (pct == null) etat = 'sans-data';
      else if (pct === 100) etat = 'atteint';
      else if (pct >= 70) etat = 'on-track';
      else if (pct >= 30) etat = 'risque';
      else etat = 'en-peril';
      return {
        id: kr.id,
        description: kr.description,
        nbIntents: intents.length,
        totalSpecs,
        livreesSpecs,
        pct,
        etat,
      };
    });
    // Calcul du % objectif = moyenne des KR
    const krsAvecData = krs.filter((k) => k.pct != null);
    const pctObj = krsAvecData.length === 0 ? null
      : Math.round(krsAvecData.reduce((s, k) => s + k.pct, 0) / krsAvecData.length);
    return {
      id: obj.id,
      description: obj.description,
      krs,
      pctMoyen: pctObj,
    };
  });
  const totaux = {
    nbObjectifs: objectifs.length,
    nbKr: objectifs.reduce((s, o) => s + o.krs.length, 0),
    krAtteints: objectifs.reduce((s, o) => s + o.krs.filter((k) => k.etat === 'atteint').length, 0),
    krEnPeril: objectifs.reduce((s, o) => s + o.krs.filter((k) => k.etat === 'en-peril').length, 0),
  };
  return { objectifs, totaux, message: null };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const OK_CSS = `<style>
.ok-objectif { padding:.5rem .65rem; margin:.4rem 0; border-radius:.35rem; background:rgba(127,127,127,.04); border-left:3px solid #4c6ef5; }
.ok-objectif h4 { font-size:.92rem; margin:.05rem 0 .3rem; display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; }
.ok-pct { font-weight:600; padding:.05rem .35rem; border-radius:.18rem; font-size:.78rem; }
.ok-pct.e-atteint { background:rgba(43,138,62,.15); color:#1c5a2a; }
.ok-pct.e-on-track { background:rgba(43,138,62,.1); color:#1c5a2a; }
.ok-pct.e-risque { background:rgba(232,89,12,.15); color:#7a3a08; }
.ok-pct.e-en-peril { background:rgba(201,42,42,.15); color:#7a1717; }
.ok-pct.e-sans-data { background:rgba(127,127,127,.1); }
.ok-kr { padding:.3rem .45rem; margin:.2rem 0; font-size:.82rem; background:rgba(127,127,127,.04); border-radius:.22rem; display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; border-left:2px solid var(--border, #ccc); }
.ok-kr.e-atteint { border-left-color:#2b8a3e; }
.ok-kr.e-on-track { border-left-color:#3a9c4f; }
.ok-kr.e-risque { border-left-color:#e8590c; }
.ok-kr.e-en-peril { border-left-color:#c92a2a; background:rgba(201,42,42,.04); }
.ok-bar { width:120px; height:8px; background:rgba(127,127,127,.15); border-radius:4px; overflow:hidden; display:inline-block; vertical-align:middle; }
.ok-fill { height:100%; }
.ok-fill.e-atteint { background:#2b8a3e; }
.ok-fill.e-on-track { background:#3a9c4f; }
.ok-fill.e-risque { background:#e8590c; }
.ok-fill.e-en-peril { background:#c92a2a; }
.ok-meta { font-size:.74rem; color:var(--muted, #777); }
.ok-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

const LABELS = {
  atteint: '✓ atteint',
  'on-track': '◐ on-track',
  risque: '⚠ à risque',
  'en-peril': '⛔ en péril',
  'sans-data': '⊘ sans SPEC',
};

export function blocOkrProgress(donnees) {
  const o = donnees?.okrProgress;
  if (!o) return '';
  if (o.message || o.objectifs.length === 0) {
    return `${OK_CSS}<section>
      <h2>Progression OKR par KR <span class="count">${escape(o.message || 'aucun OKR')}</span></h2>
      <div class="ok-empty">Calcule % de complétion par Key Result basé sur les SPECs livrées des Intents rattachés (#444 okr-mapping). Format frontmatter : <code>okr: KR-1.2</code>.</div>
    </section>`;
  }
  const t = o.totaux;
  const cards = o.objectifs.map((obj) => {
    const krs = obj.krs.map((kr) => {
      const pct = kr.pct ?? 0;
      return `<div class="ok-kr e-${escape(kr.etat)}">
        <strong>${escape(kr.id || '?')}</strong>
        <span>${escape((kr.description || '').slice(0, 60))}</span>
        <span class="ok-bar"><span class="ok-fill e-${escape(kr.etat)}" style="width:${pct}%"></span></span>
        <span class="ok-pct e-${escape(kr.etat)}">${kr.pct == null ? '—' : kr.pct + '%'}</span>
        <span class="ok-meta">${escape(LABELS[kr.etat])} · ${kr.livreesSpecs}/${kr.totalSpecs} SPECs · ${kr.nbIntents} Intent(s)</span>
      </div>`;
    }).join('');
    return `<div class="ok-objectif">
      <h4>${escape(obj.id || '?')} — ${escape((obj.description || '').slice(0, 70))} <span class="ok-pct ${obj.pctMoyen != null ? '' : 'e-sans-data'}">${obj.pctMoyen == null ? '—' : obj.pctMoyen + '%'}</span></h4>
      ${krs}
    </div>`;
  }).join('');
  return `${OK_CSS}<section>
    <h2>Progression OKR par KR <span class="count">${t.nbObjectifs} objectif(s) · ${t.nbKr} KR · ${t.krAtteints} atteint(s) · ${t.krEnPeril} en péril</span></h2>
    <p class="muted" style="font-size:.85rem">Pour chaque Objectif/KR du #444 okr-mapping, calcule % de complétion = SPECs livrées / SPECs des Intents rattachés. États : atteint 100 % / on-track ≥ 70 % / à risque 30-70 % / en péril &lt; 30 %.</p>
    <div>${cards}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerOkrProgress as computeOkrProgress,
  blocOkrProgress as okrProgressSection,
};
