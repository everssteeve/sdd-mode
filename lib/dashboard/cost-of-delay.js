// AIAD SDD Mode — Dashboard : cost-of-delay (CoD) calculator (#515).
//
// Score chaque Intent par son **coût de retard** pour informer les
// arbitrages prioritaires : un Intent P0 avec échéance proche a un CoD
// élevé ; un P3 avec échéance distante a un CoD faible.
//
// Formule (simple, transparente) :
//   CoD = poidsPrio × urgenceTarget
//
//   poidsPrio :  P0 = 50, P1 = 30, P2 = 15, P3 = 5, P4 = 2, autres = 10
//   urgenceTarget :
//     - retard               → ×3.0
//     - urgent (≤ 30j)       → ×2.0
//     - proche (≤ 90j)       → ×1.3
//     - distant              → ×1.0
//     - aucun target_date    → ×0.7
//   bonus si Intent actif (×1.2) — il consomme déjà du WIP.
//   malus si statut draft (×0.6) — pas encore engagé.
//
// Tri CoD desc → Intents à shipper en priorité.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const DAY = 24 * 3600 * 1000;
const PRANK = { P0: 50, P1: 30, P2: 15, P3: 5, P4: 2 };

function poidsPrio(p) {
  if (!p) return 10;
  return PRANK[String(p).toUpperCase()] ?? 10;
}

function parseTarget(v) {
  if (!v) return null;
  const s = String(v).trim();
  const t = Date.parse(s);
  if (!isNaN(t)) return t;
  // Q1-2026
  const m = s.match(/Q(\d)[-\s]?(\d{4})/i);
  if (m) {
    const q = parseInt(m[1], 10);
    const y = parseInt(m[2], 10);
    if (q >= 1 && q <= 4) return Date.UTC(y, q * 3, 0, 23, 59);
  }
  return null;
}

function urgenceTarget(target, now) {
  if (target == null) return { mult: 0.7, classe: 'aucun-target' };
  const delta = target - now;
  if (delta < 0) return { mult: 3.0, classe: 'retard' };
  if (delta <= 30 * DAY) return { mult: 2.0, classe: 'urgent' };
  if (delta <= 90 * DAY) return { mult: 1.3, classe: 'proche' };
  return { mult: 1.0, classe: 'distant' };
}

function multStatut(statut) {
  if (statut === 'active' || statut === 'in-progress') return 1.2;
  if (statut === 'draft') return 0.6;
  return 1.0;
}

export function calculerCostOfDelay(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const items = [];
  for (const i of (donnees?.intents || [])) {
    if (['done', 'archived'].includes(i.statut)) continue;
    const wp = poidsPrio(i.priority);
    const target = parseTarget(i.target_date || i.targetDate || i.target);
    const u = urgenceTarget(target, now);
    const ms = multStatut(i.statut);
    const cod = Math.round(wp * u.mult * ms * 10) / 10;
    items.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      priority: i.priority || null,
      poidsPrio: wp,
      target,
      urgenceClasse: u.classe,
      urgenceMult: u.mult,
      statutMult: ms,
      cod,
    });
  }
  items.sort((a, b) => b.cod - a.cod);
  // 3 tiers : top 30% = critical, top 30-60% = elevé, reste = standard
  const n = items.length;
  for (let idx = 0; idx < n; idx++) {
    if (idx < n * 0.3) items[idx].tier = 'critical';
    else if (idx < n * 0.6) items[idx].tier = 'eleve';
    else items[idx].tier = 'standard';
  }
  return {
    items,
    totaux: {
      total: n,
      critical: items.filter((i) => i.tier === 'critical').length,
      eleve: items.filter((i) => i.tier === 'eleve').length,
      standard: items.filter((i) => i.tier === 'standard').length,
    },
    formule: 'poidsPrio × urgenceTarget × multStatut',
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const CD_CSS = `<style>
.cd-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.cd-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.cd-stat .cd-val { font-size:1.2rem; font-weight:700; }
.cd-stat .cd-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.cd-stat.t-critical { background:rgba(201,42,42,.07); border-color:rgba(201,42,42,.3); }
.cd-stat.t-eleve { background:rgba(232,89,12,.05); border-color:rgba(232,89,12,.3); }
.cd-stat.t-standard { background:rgba(127,127,127,.04); }
.cd-row { padding:.35rem .5rem; margin:.2rem 0; font-size:.82rem; background:rgba(127,127,127,.04); border-radius:.25rem; display:flex; gap:.5rem; flex-wrap:wrap; align-items:baseline; }
.cd-row.t-critical { border-left:3px solid #c92a2a; background:rgba(201,42,42,.04); }
.cd-row.t-eleve { border-left:3px solid #e8590c; background:rgba(232,89,12,.03); }
.cd-row.t-standard { border-left:3px solid rgba(127,127,127,.3); }
.cd-cod { font-weight:700; font-size:.9rem; padding:.05rem .35rem; border-radius:.2rem; }
.cd-cod.t-critical { background:rgba(201,42,42,.15); color:#7a1717; }
.cd-cod.t-eleve { background:rgba(232,89,12,.15); color:#7a3a08; }
.cd-cod.t-standard { background:rgba(127,127,127,.1); }
.cd-tag { font-size:.7rem; padding:.05rem .3rem; background:rgba(127,127,127,.1); border-radius:.15rem; }
.cd-tag.u-retard { background:rgba(201,42,42,.15); color:#7a1717; }
.cd-tag.u-urgent { background:rgba(232,89,12,.15); color:#7a3a08; }
</style>`;

const LABELS_URG = {
  retard: '⚠ retard',
  urgent: '🔥 urgent ≤30j',
  proche: '🟡 proche ≤90j',
  distant: '🟢 distant',
  'aucun-target': 'pas de target',
};

export function blocCostOfDelay(donnees) {
  const c = donnees?.costOfDelay;
  if (!c) return '';
  if (c.items.length === 0) {
    return `${CD_CSS}<section>
      <h2>Cost-of-delay scorer <span class="count">aucun Intent actif</span></h2>
      <p class="muted" style="font-size:.85rem">Score chaque Intent par <code>poidsPrio × urgenceTarget × multStatut</code> pour informer les arbitrages prioritaires. Tri CoD desc → Intents à shipper en priorité.</p>
    </section>`;
  }
  const t = c.totaux;
  const grid = ['critical', 'eleve', 'standard'].map((tier) => `<div class="cd-stat t-${tier}">
      <div class="cd-val">${t[tier]}</div>
      <div class="cd-label">${escape(tier)}</div>
    </div>`).join('');
  const rows = c.items.slice(0, 15).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const prio = it.priority ? `<span class="cd-tag">${escape(String(it.priority).toUpperCase())}</span>` : '';
    return `<div class="cd-row t-${escape(it.tier)}">
      <span class="cd-cod t-${escape(it.tier)}">${it.cod}</span>
      <strong>${idCell}</strong>
      <span>${escape((it.titre || '').slice(0, 50))}</span>
      ${prio}
      <span class="cd-tag u-${escape(it.urgenceClasse)}">${escape(LABELS_URG[it.urgenceClasse] || it.urgenceClasse)}</span>
      <span class="cd-tag">[${escape(it.statut || '?')}]</span>
    </div>`;
  }).join('');
  return `${CD_CSS}<section>
    <h2>Cost-of-delay scorer <span class="count">${t.total} Intent(s) actif(s) — top tier critical (${t.critical})</span></h2>
    <p class="muted" style="font-size:.85rem">Score CoD = <code>${escape(c.formule)}</code>. Poids prio P0=50, P1=30, P2=15, P3=5. Multiplicateurs urgence : retard ×3, urgent ×2, proche ×1.3, distant ×1, sans-target ×0.7. Statut : active ×1.2, draft ×0.6. Tri CoD desc.</p>
    <div class="cd-grid">${grid}</div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerCostOfDelay as computeCostOfDelay,
  blocCostOfDelay as costOfDelaySection,
};
