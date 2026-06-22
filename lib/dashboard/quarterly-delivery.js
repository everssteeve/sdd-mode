// AIAD SDD Mode — Dashboard : quarterly planned-vs-actual delivery (#506).
//
// Compare pour chaque trimestre :
//   - PLANIFIÉ  : nb Intents avec target_date ou target en `Q[1-4]-YYYY`
//                  tombant dans ce trimestre
//   - LIVRÉ     : nb SPECs done/archived avec mtime dans ce trimestre
//
// Permet au PM de mesurer l'écart entre planification et livraison
// trimestre par trimestre — un écart répété signe un problème de
// scoping ou de capacité.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const STATUTS_LIVRES = new Set(['done', 'archived']);

function trimestreDeDate(dateMs) {
  if (dateMs == null) return null;
  const d = new Date(dateMs);
  const annee = d.getUTCFullYear();
  const trim = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${trim}-${annee}`;
}

function parseTargetTrimestre(s) {
  if (!s) return null;
  const m = String(s).match(/Q([1-4])[-\s]?(\d{4})/i);
  if (m) return `Q${m[1]}-${m[2]}`;
  // Sinon, tente date ISO et déduit trimestre
  const t = Date.parse(String(s));
  if (!isNaN(t)) return trimestreDeDate(t);
  return null;
}

function ordrerTrimestres(trims) {
  return [...trims].sort((a, b) => {
    const [ta, ya] = a.split('-');
    const [tb, yb] = b.split('-');
    const ya_n = parseInt(ya, 10);
    const yb_n = parseInt(yb, 10);
    if (ya_n !== yb_n) return ya_n - yb_n;
    return parseInt(ta.slice(1), 10) - parseInt(tb.slice(1), 10);
  });
}

export function calculerQuarterlyDelivery(donnees, options = {}) {
  const intents = donnees?.intents || [];
  const specs = donnees?.specs || [];
  // Map trimestre → { planifie, livre }
  const buckets = new Map();
  function ensure(t) {
    if (!buckets.has(t)) buckets.set(t, { trim: t, planifie: 0, livre: 0, intentsPlanifies: [], specsLivrees: [] });
    return buckets.get(t);
  }
  // Plan : Intents avec target/target_date résolu en trimestre.
  for (const i of intents) {
    if (['archived'].includes(i.statut)) continue;
    const t = parseTargetTrimestre(i.target_date || i.targetDate || i.target);
    if (!t) continue;
    const b = ensure(t);
    b.planifie++;
    b.intentsPlanifies.push({ id: i.id, titre: i.titre || '', statut: i.statut });
  }
  // Livraisons : SPECs done/archived avec mtime.
  for (const s of specs) {
    if (!STATUTS_LIVRES.has(s.statut)) continue;
    if (!s.mtime) continue;
    const t = trimestreDeDate(s.mtime);
    if (!t) continue;
    const b = ensure(t);
    b.livre++;
    b.specsLivrees.push({ id: s.id, mtime: s.mtime });
  }
  // Si zéro bucket, ajouter le trimestre courant pour rendu non-vide.
  if (buckets.size === 0) {
    const now = options.now != null ? options.now : Date.now();
    ensure(trimestreDeDate(now));
  }
  const trimestres = ordrerTrimestres([...buckets.keys()]);
  const items = trimestres.map((t) => {
    const b = buckets.get(t);
    return {
      trim: t,
      planifie: b.planifie,
      livre: b.livre,
      ecart: b.livre - b.planifie,
      ratio: b.planifie === 0 ? null : Math.round((b.livre / b.planifie) * 100) / 100,
      intentsPlanifies: b.intentsPlanifies.slice(0, 5),
      specsLivrees: b.specsLivrees.slice(0, 5),
    };
  });
  const totaux = {
    trimestres: items.length,
    totalPlanifie: items.reduce((s, b) => s + b.planifie, 0),
    totalLivre: items.reduce((s, b) => s + b.livre, 0),
    couvertures: items.filter((b) => b.planifie > 0 && b.livre >= b.planifie).length,
    deficits: items.filter((b) => b.planifie > 0 && b.livre < b.planifie).length,
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const QD_CSS = `<style>
.qd-table { width:100%; border-collapse:collapse; font-size:.85rem; margin:.4rem 0; }
.qd-table th, .qd-table td { padding:.35rem .5rem; border-bottom:1px solid var(--border, #eee); text-align:left; }
.qd-table th { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); letter-spacing:.04em; }
.qd-bar-wrap { display:inline-flex; align-items:center; gap:.4rem; }
.qd-bars { display:inline-flex; height:14px; min-width:80px; background:rgba(127,127,127,.1); border-radius:4px; overflow:hidden; }
.qd-bars span { display:block; height:100%; }
.qd-bars .b-planifie { background:rgba(127,127,127,.25); }
.qd-bars .b-livre.ok { background:#2b8a3e; }
.qd-bars .b-livre.low { background:#e8590c; }
.qd-tag { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.72rem; }
.qd-ecart.positif { color:#1c5a2a; font-weight:500; }
.qd-ecart.zero { color:var(--muted, #777); }
.qd-ecart.negatif { color:#7a1717; font-weight:500; }
@media (prefers-color-scheme: dark) { .qd-ecart.positif { color:#68d391; } .qd-ecart.negatif { color:#fc8181; } }
:root[data-theme="dark"] .qd-ecart.positif { color:#68d391; }
:root[data-theme="dark"] .qd-ecart.negatif { color:#fc8181; }
.qd-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.qd-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.qd-stat .qd-val { font-size:1.2rem; font-weight:700; }
.qd-stat .qd-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
</style>`;

export function blocQuarterlyDelivery(donnees) {
  const q = donnees?.quarterlyDelivery;
  if (!q) return '';
  if (q.items.length === 0) {
    return `${QD_CSS}<section>
      <h2>Livraison par trimestre <span class="count">aucun trimestre</span></h2>
      <p class="muted" style="font-size:.85rem">Ajoute <code>target_date</code> ou <code>target: Q1-2026</code> au frontmatter des Intents pour mesurer planifié vs livré par trimestre.</p>
    </section>`;
  }
  const t = q.totaux;
  const grid = [
    `<div class="qd-stat"><div class="qd-val">${t.totalPlanifie}</div><div class="qd-label">Intents planifiés</div></div>`,
    `<div class="qd-stat"><div class="qd-val">${t.totalLivre}</div><div class="qd-label">SPECs livrées</div></div>`,
    `<div class="qd-stat"><div class="qd-val" style="color:#2b8a3e">${t.couvertures}</div><div class="qd-label">Trimestres couverts</div></div>`,
    `<div class="qd-stat"><div class="qd-val" style="color:#c92a2a">${t.deficits}</div><div class="qd-label">Trimestres en déficit</div></div>`,
  ].join('');
  const maxVal = Math.max(...q.items.flatMap((b) => [b.planifie, b.livre]), 1);
  const rows = q.items.map((b) => {
    const pctP = Math.max(2, (b.planifie / maxVal) * 50);
    const pctL = Math.max(b.livre > 0 ? 2 : 0, (b.livre / maxVal) * 50);
    const ok = b.planifie > 0 && b.livre >= b.planifie;
    const ecartCls = b.ecart > 0 ? 'positif' : b.ecart === 0 ? 'zero' : 'negatif';
    return `<tr>
      <td><strong>${escape(b.trim)}</strong></td>
      <td>${b.planifie}</td>
      <td>${b.livre}</td>
      <td class="qd-ecart ${ecartCls}">${b.ecart >= 0 ? '+' : ''}${b.ecart}</td>
      <td>${b.ratio != null ? Math.round(b.ratio * 100) + '%' : '—'}</td>
      <td><div class="qd-bar-wrap">
        <span class="qd-bars">
          <span class="b-planifie" style="width:${pctP.toFixed(1)}px" title="${b.planifie} planifié(s)"></span>
          <span class="b-livre ${ok ? 'ok' : 'low'}" style="width:${pctL.toFixed(1)}px" title="${b.livre} livré(s)"></span>
        </span>
      </div></td>
    </tr>`;
  }).join('');
  return `${QD_CSS}<section>
    <h2>Livraison par trimestre <span class="count">${t.trimestres} trimestre(s) · ${t.totalPlanifie} planifié(s) · ${t.totalLivre} livré(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Pour chaque trimestre, compare planifié (Intents avec <code>target_date</code> ou <code>target: Q-YYYY</code>) vs livré (SPECs done/archived avec mtime dans le trimestre). Barre grise = planifié, verte = livré (suffisant) / orange (déficit).</p>
    <div class="qd-grid">${grid}</div>
    <table class="qd-table">
      <thead><tr><th>Trimestre</th><th>Planifié</th><th>Livré</th><th>Écart</th><th>Couverture</th><th>Mini-bars</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerQuarterlyDelivery as computeQuarterlyDelivery,
  blocQuarterlyDelivery as quarterlyDeliverySection,
};
