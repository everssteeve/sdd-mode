// AIAD SDD Mode — Dashboard : discovery → delivery cycle time (#522).
//
// Mesure pour chaque Intent classé `kind: discovery|experiment` puis
// passé à un statut `delivered` (done/archived) le **délai total**
// entre la création de l'Intent et la première SPEC livrée.
//
// Cas couverts :
//   - kind == discovery|experiment + au moins 1 SPEC done/archived
//   - Calcule cycle = mtime(SPEC livrée) - mtime(intent) en jours
//
// Buckets : `tres-court ≤ 14j`, `court 15-30j`, `moyen 31-60j`,
//           `long 61-120j`, `tres-long > 120j`.
//
// Pure transformation.

const DAY = 24 * 3600 * 1000;
const STATUTS_LIVRES = new Set(['done', 'archived']);
const KINDS_DISCOVERY = new Set(['discovery', 'experiment', 'exploration', 'hypothesis']);

function classerCycle(jours) {
  if (jours <= 14) return 'tres-court';
  if (jours <= 30) return 'court';
  if (jours <= 60) return 'moyen';
  if (jours <= 120) return 'long';
  return 'tres-long';
}

export function calculerDiscoveryToDelivery(donnees) {
  const specsParCourt = new Map();
  for (const s of donnees?.specs || []) {
    if (!STATUTS_LIVRES.has(s.statut) || !s.mtime || !s.parentIntent) continue;
    const court = String(s.parentIntent).split('-').slice(0, 2).join('-');
    if (!specsParCourt.has(court)) specsParCourt.set(court, s);
    else if (s.mtime < specsParCourt.get(court).mtime) specsParCourt.set(court, s);
  }
  const items = [];
  for (const i of donnees?.intents || []) {
    const kind = String(i.kind || '').toLowerCase().trim();
    if (!KINDS_DISCOVERY.has(kind)) continue;
    if (!i.mtime) continue;
    const court = i.id.split('-').slice(0, 2).join('-');
    const spec = specsParCourt.get(court);
    if (!spec) continue;
    const cycleJours = Math.max(0, Math.floor((spec.mtime - i.mtime) / DAY));
    items.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      kind,
      specLivree: { id: spec.id, mtime: spec.mtime },
      intentMtime: i.mtime,
      cycleJours,
      bucket: classerCycle(cycleJours),
    });
  }
  items.sort((a, b) => b.cycleJours - a.cycleJours);
  const cycleMoyen = items.length === 0 ? null
    : Math.round(items.reduce((s, x) => s + x.cycleJours, 0) / items.length);
  const cycleMedian = items.length === 0 ? null
    : items.map((x) => x.cycleJours).sort((a, b) => a - b)[Math.floor(items.length / 2)];
  return {
    items,
    totaux: {
      total: items.length,
      tresCourt: items.filter((i) => i.bucket === 'tres-court').length,
      court: items.filter((i) => i.bucket === 'court').length,
      moyen: items.filter((i) => i.bucket === 'moyen').length,
      long: items.filter((i) => i.bucket === 'long').length,
      tresLong: items.filter((i) => i.bucket === 'tres-long').length,
    },
    cycleMoyen,
    cycleMedian,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const DD_CSS = `<style>
.dd-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:.4rem; margin:.5rem 0; }
.dd-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.dd-stat .dd-val { font-size:1.25rem; font-weight:700; }
.dd-stat .dd-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.dd-stat.b-tres-court { background:rgba(43,138,62,.08); border-color:rgba(43,138,62,.3); }
.dd-stat.b-court { background:rgba(76,110,245,.05); border-color:rgba(76,110,245,.3); }
.dd-stat.b-moyen { background:rgba(232,89,12,.05); border-color:rgba(232,89,12,.3); }
.dd-stat.b-long { background:rgba(201,42,42,.05); border-color:rgba(201,42,42,.3); }
.dd-stat.b-tres-long { background:rgba(201,42,42,.1); border-color:rgba(201,42,42,.5); }
.dd-meta { padding:.4rem .55rem; background:rgba(127,127,127,.05); border-radius:.25rem; font-size:.85rem; margin:.3rem 0; }
.dd-row { padding:.3rem .45rem; margin:.2rem 0; font-size:.82rem; background:rgba(127,127,127,.04); border-radius:.22rem; display:flex; gap:.5rem; flex-wrap:wrap; align-items:baseline; border-left:3px solid var(--accent, #4c6ef5); }
.dd-row.r-tres-long { border-left-color:#c92a2a; background:rgba(201,42,42,.04); }
.dd-row.r-long { border-left-color:#e8590c; }
.dd-row.r-moyen { border-left-color:#f5a623; }
.dd-row.r-court { border-left-color:#4c6ef5; }
.dd-row.r-tres-court { border-left-color:#2b8a3e; }
.dd-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

const LABELS = {
  'tres-court': '✓ Très court (≤ 14j)',
  court: '◐ Court (15-30j)',
  moyen: '⚠ Moyen (31-60j)',
  long: '⛔ Long (61-120j)',
  'tres-long': '⛔ Très long (> 120j)',
};

export function blocDiscoveryToDelivery(donnees) {
  const d = donnees?.discoveryToDelivery;
  if (!d) return '';
  if (d.items.length === 0) {
    return `${DD_CSS}<section>
      <h2>Discovery → Delivery cycle time <span class="count">aucun Intent discovery livré</span></h2>
      <div class="dd-empty">Mesure le délai entre la création d'un Intent <code>kind: discovery|experiment</code> et sa première SPEC livrée. Aucun Intent discovery n'a encore atteint une SPEC done/archived. Marker davantage d'Intents en <code>kind: discovery</code> ou attendre la première livraison.</div>
    </section>`;
  }
  const t = d.totaux;
  const grid = ['tres-court', 'court', 'moyen', 'long', 'tres-long'].map((b) => {
    const cle = b === 'tres-court' ? 'tresCourt' : b === 'tres-long' ? 'tresLong' : b;
    return `<div class="dd-stat b-${b}">
      <div class="dd-val">${t[cle] || 0}</div>
      <div class="dd-label">${escape(LABELS[b])}</div>
    </div>`;
  }).join('');
  const rows = d.items.slice(0, 12).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    return `<div class="dd-row r-${escape(it.bucket)}">
      <strong>${idCell}</strong>
      <span>${escape((it.titre || '').slice(0, 50))}</span>
      <span class="muted">[${escape(it.kind)}]</span>
      <span class="muted"><strong>${it.cycleJours}j</strong> cycle (1ʳᵉ SPEC ${escape(it.specLivree.id)})</span>
    </div>`;
  }).join('');
  return `${DD_CSS}<section>
    <h2>Discovery → Delivery cycle time <span class="count">${t.total} Intent(s) livré(s) — moyen ${d.cycleMoyen}j · médian ${d.cycleMedian}j</span></h2>
    <p class="muted" style="font-size:.85rem">Délai entre création Intent <code>kind: discovery|experiment</code> et sa première SPEC livrée. Mesure l'efficacité du pipeline discovery → delivery. Buckets : très-court ≤ 14j → très-long &gt; 120j.</p>
    <div class="dd-grid">${grid}</div>
    <div class="dd-meta">Cycle moyen : <strong>${d.cycleMoyen}j</strong> · médian : <strong>${d.cycleMedian}j</strong> sur ${t.total} Intent(s) discovery livré(s).</div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerDiscoveryToDelivery as computeDiscoveryToDelivery,
  blocDiscoveryToDelivery as discoveryToDeliverySection,
};
