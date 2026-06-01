// AIAD SDD Mode — Dashboard : risk transparency score (#531).
//
// Mesure la **transparence du registre des risques** : pour les
// Intents à risque niveau critical/high, % qui ont SOIT un plan de
// mitigation (champ `risks_mitigation:` ou `mitigation:`), SOIT une
// acceptation formelle (#508 accepted-risks).
//
// Politique :
//   - couvert : mitigation explicite OU risque accepté
//   - decouvert : ni l'un ni l'autre — silence sur un risque élevé
//   - Score global : couverts / total intents-à-risque
//
// Pure transformation.

function lireMitigation(intent) {
  const v = intent?.risks_mitigation || intent?.risksMitigation || intent?.mitigation || intent?.Mitigation;
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(/[;\n]/).map((x) => x.trim()).filter(Boolean);
  return [];
}

export function calculerRiskTransparency(donnees) {
  const risquesEleves = (donnees?.risks?.intents || []).filter((r) => r.niveau === 'critical' || r.niveau === 'high');
  const intentMap = new Map((donnees?.intents || []).map((i) => [i.id, i]));
  const acceptedIds = new Set((donnees?.acceptedRisks?.items || []).map((a) => a.id));
  const items = risquesEleves.map((r) => {
    const intent = intentMap.get(r.id);
    const mitigation = lireMitigation(intent);
    const accepte = acceptedIds.has(r.id);
    const couvert = mitigation.length > 0 || accepte;
    return {
      id: r.id,
      titre: intent?.titre || r.titre || '',
      file: intent?.file || null,
      niveau: r.niveau,
      mitigation,
      accepte,
      couvert,
    };
  });
  items.sort((a, b) => {
    // Découverts d'abord (signal), critical avant high
    if (a.couvert !== b.couvert) return Number(a.couvert) - Number(b.couvert);
    if (a.niveau !== b.niveau) return a.niveau === 'critical' ? -1 : 1;
    return 0;
  });
  const total = items.length;
  const couverts = items.filter((i) => i.couvert).length;
  const score = total === 0 ? null : Math.round((couverts / total) * 100);
  let etat = 'sans-data';
  if (score == null) etat = 'sans-data';
  else if (score === 100) etat = 'parfait';
  else if (score >= 75) etat = 'bon';
  else if (score >= 50) etat = 'partiel';
  else etat = 'faible';
  return {
    items,
    totaux: {
      total,
      couverts,
      decouverts: total - couverts,
      avecMitigation: items.filter((i) => i.mitigation.length > 0).length,
      acceptes: items.filter((i) => i.accepte).length,
      score,
      etat,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const RT_CSS = `<style>
.rt-card { padding:.6rem .75rem; border-radius:.35rem; border-left:4px solid var(--accent, #4c6ef5); background:rgba(76,110,245,.05); margin:.3rem 0; }
.rt-card.e-parfait { border-left-color:#2b8a3e; background:rgba(43,138,62,.05); }
.rt-card.e-bon { border-left-color:#3a9c4f; background:rgba(43,138,62,.04); }
.rt-card.e-partiel { border-left-color:#f5a623; background:rgba(245,166,35,.05); }
.rt-card.e-faible { border-left-color:#c92a2a; background:rgba(201,42,42,.06); }
.rt-card.e-sans-data { border-left-color:rgba(127,127,127,.3); }
.rt-head { display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; }
.rt-bar { width:140px; height:10px; background:rgba(127,127,127,.15); border-radius:5px; overflow:hidden; display:inline-block; vertical-align:middle; }
.rt-fill { height:100%; transition:width .15s; }
.rt-fill.e-parfait { background:#2b8a3e; }
.rt-fill.e-bon { background:#3a9c4f; }
.rt-fill.e-partiel { background:#f5a623; }
.rt-fill.e-faible { background:#c92a2a; }
.rt-row { padding:.3rem .45rem; margin:.15rem 0; font-size:.82rem; background:rgba(127,127,127,.04); border-radius:.22rem; display:flex; gap:.5rem; align-items:baseline; flex-wrap:wrap; }
.rt-row.r-couvert { border-left:3px solid #2b8a3e; }
.rt-row.r-decouvert { border-left:3px solid #c92a2a; background:rgba(201,42,42,.04); }
.rt-tag { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.7rem; }
.rt-tag.t-mitig { background:rgba(76,110,245,.12); color:#3a4cba; }
.rt-tag.t-accepte { background:rgba(43,138,62,.12); color:#1c5a2a; }
.rt-tag.t-decouvert { background:rgba(201,42,42,.15); color:#7a1717; }
.rt-tag.t-critical { background:rgba(201,42,42,.15); color:#7a1717; }
.rt-tag.t-high { background:rgba(232,89,12,.15); color:#7a3a08; }
.rt-meta { font-size:.74rem; color:var(--muted, #777); }
</style>`;

const LABELS = {
  parfait: '✓ Parfait (100 %)',
  bon: '◐ Bon (≥ 75 %)',
  partiel: '⚠ Partiel (50-75 %)',
  faible: '⛔ Faible (< 50 %)',
  'sans-data': '⊘ Sans risque élevé',
};

export function blocRiskTransparency(donnees) {
  const r = donnees?.riskTransparency;
  if (!r) return '';
  const t = r.totaux;
  if (t.etat === 'sans-data') {
    return `${RT_CSS}<section>
      <h2>Transparence du registre de risque <span class="count">aucun risque élevé</span></h2>
      <p class="muted" style="font-size:.85rem">Score de transparence = % d'Intents à risque critical/high qui ont SOIT une <code>risks_mitigation:</code> SOIT une acceptation formelle (#508).</p>
    </section>`;
  }
  const pct = t.score || 0;
  const rows = r.items.slice(0, 12).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const niveauTag = `<span class="rt-tag t-${escape(it.niveau)}">${escape(it.niveau)}</span>`;
    let status;
    if (it.accepte && it.mitigation.length > 0) {
      status = `<span class="rt-tag t-accepte">accepté</span><span class="rt-tag t-mitig">${it.mitigation.length} mitigation(s)</span>`;
    } else if (it.accepte) {
      status = `<span class="rt-tag t-accepte">accepté</span>`;
    } else if (it.mitigation.length > 0) {
      status = `<span class="rt-tag t-mitig">${it.mitigation.length} mitigation(s)</span>`;
    } else {
      status = `<span class="rt-tag t-decouvert">⚠ découvert</span>`;
    }
    return `<div class="rt-row ${it.couvert ? 'r-couvert' : 'r-decouvert'}">
      ${niveauTag}
      <strong>${idCell}</strong>
      <span>${escape((it.titre || '').slice(0, 50))}</span>
      ${status}
      ${it.mitigation[0] ? `<span class="rt-meta">${escape(it.mitigation[0].slice(0, 60))}…</span>` : ''}
    </div>`;
  }).join('');
  return `${RT_CSS}<section>
    <h2>Transparence du registre de risque <span class="count">${t.couverts}/${t.total} couverts · score ${pct}%</span></h2>
    <p class="muted" style="font-size:.85rem">% d'Intents à risque critical/high avec <strong>mitigation explicite</strong> (<code>risks_mitigation:</code>) OU <strong>acceptation formelle</strong> (#508). Un risque élevé sans mitigation ni acceptation = silence sur un risque connu.</p>
    <div class="rt-card e-${escape(t.etat)}">
      <div class="rt-head">
        <strong>${pct}%</strong> de transparence
        <span class="rt-tag">${escape(LABELS[t.etat])}</span>
        <span class="rt-bar"><span class="rt-fill e-${escape(t.etat)}" style="width:${pct}%"></span></span>
        <span class="rt-meta">${t.avecMitigation} avec mitigation · ${t.acceptes} accepté(s) · ${t.decouverts} découvert(s)</span>
      </div>
    </div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerRiskTransparency as computeRiskTransparency,
  blocRiskTransparency as riskTransparencySection,
};
