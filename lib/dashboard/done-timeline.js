// AIAD SDD Mode — Dashboard : done milestones timeline (per month) (#528).
//
// Regroupe les Intents et SPECs livrés (done/archived) **par mois** pour
// visualiser l'évolution des achievements dans le temps. Va plus loin
// que #509 wins-wall (fenêtre 30j fixe) en montrant **plusieurs mois**
// d'historique avec comptes mensuels.
//
// Pure transformation.

const DAY = 24 * 3600 * 1000;
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const STATUTS_LIVRES = new Set(['done', 'archived']);

function moisCle(ts) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function moisLabel(cle) {
  const [y, m] = cle.split('-');
  return `${MOIS[parseInt(m, 10) - 1]} ${y}`;
}

export function calculerDoneTimeline(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const moisMax = options.moisMax || 6;
  const buckets = new Map();
  // Initialise N derniers mois pour avoir des slots vides.
  for (let i = moisMax - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    const cle = moisCle(d.getTime());
    buckets.set(cle, { cle, label: moisLabel(cle), intents: [], specs: [] });
  }
  for (const s of donnees?.specs || []) {
    if (!STATUTS_LIVRES.has(s.statut) || !s.mtime) continue;
    const cle = moisCle(s.mtime);
    if (!buckets.has(cle)) continue;
    buckets.get(cle).specs.push({ id: s.id, titre: s.titre || '', mtime: s.mtime });
  }
  for (const i of donnees?.intents || []) {
    if (!STATUTS_LIVRES.has(i.statut) || !i.mtime) continue;
    const cle = moisCle(i.mtime);
    if (!buckets.has(cle)) continue;
    buckets.get(cle).intents.push({ id: i.id, titre: i.titre || '', mtime: i.mtime });
  }
  const items = [...buckets.values()];
  const totaux = {
    moisAffiches: items.length,
    totalSpecs: items.reduce((s, b) => s + b.specs.length, 0),
    totalIntents: items.reduce((s, b) => s + b.intents.length, 0),
    moisPlusActif: items.slice().sort((a, b) => (b.specs.length + b.intents.length) - (a.specs.length + a.intents.length))[0]?.label || null,
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const DT_CSS = `<style>
.dt-bar { display:flex; gap:2px; height:36px; margin:.4rem 0; }
.dt-month { flex:1; display:flex; flex-direction:column; justify-content:flex-end; min-width:0; position:relative; }
.dt-month-bar { width:100%; background:#4c6ef5; border-radius:2px 2px 0 0; transition:height .2s; }
.dt-month-bar.empty { background:rgba(127,127,127,.1); }
.dt-month-label { font-size:.65rem; text-align:center; color:var(--muted, #777); padding-top:.2rem; transform:rotate(-30deg) translateX(-4px); transform-origin:left top; white-space:nowrap; height:0; overflow:visible; }
.dt-month-count { font-size:.7rem; text-align:center; color:var(--accent, #4c6ef5); font-weight:600; padding-bottom:.05rem; }
.dt-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:.4rem; margin-top:1.3rem; }
.dt-bucket { padding:.45rem .55rem; border-radius:.3rem; background:rgba(127,127,127,.04); border-left:3px solid rgba(76,110,245,.4); }
.dt-bucket.empty { opacity:.5; }
.dt-bucket h4 { font-size:.85rem; margin:.1rem 0 .2rem; }
.dt-list { list-style:none; padding:0; margin:0; font-size:.75rem; }
.dt-list li { padding:.1rem 0; }
.dt-list .tag { padding:.05rem .3rem; background:rgba(43,138,62,.12); color:#1c5a2a; border-radius:.15rem; font-size:.68rem; margin-right:.25rem; }
.dt-list .tag.t-intent { background:rgba(76,110,245,.12); color:#3a4cba; }
.dt-meta { padding:.4rem .55rem; background:rgba(43,138,62,.06); border-left:3px solid #2b8a3e; border-radius:.25rem; font-size:.85rem; color:#1c5a2a; margin:.3rem 0; }
</style>`;

export function blocDoneTimeline(donnees) {
  const d = donnees?.doneTimeline;
  if (!d) return '';
  const t = d.totaux;
  if (t.totalSpecs + t.totalIntents === 0) {
    return `${DT_CSS}<section>
      <h2>Timeline des livraisons <span class="count">${t.moisAffiches} mois — aucun livrable</span></h2>
      <p class="muted" style="font-size:.85rem">Regroupe par mois les Intents et SPECs livrés (done/archived). Fenêtre ${t.moisAffiches} mois.</p>
    </section>`;
  }
  const maxTotal = Math.max(...d.items.map((b) => b.specs.length + b.intents.length), 1);
  const bars = d.items.map((b) => {
    const total = b.specs.length + b.intents.length;
    const h = total === 0 ? 4 : Math.max(8, (total / maxTotal) * 30);
    return `<div class="dt-month" title="${escape(b.label)} : ${total} livrable(s)">
      ${total > 0 ? `<div class="dt-month-count">${total}</div>` : ''}
      <div class="dt-month-bar ${total === 0 ? 'empty' : ''}" style="height:${h.toFixed(1)}px"></div>
      <div class="dt-month-label">${escape(b.label.split(' ')[0])}</div>
    </div>`;
  }).join('');
  const cards = d.items.map((b) => {
    const intentsLi = b.intents.slice(0, 3).map((x) => `<li><span class="tag t-intent">intent</span><code>${escape(x.id)}</code></li>`).join('');
    const specsLi = b.specs.slice(0, 4).map((x) => `<li><span class="tag">spec</span><code>${escape(x.id)}</code></li>`).join('');
    return `<div class="dt-bucket ${(b.specs.length + b.intents.length) === 0 ? 'empty' : ''}">
      <h4>${escape(b.label)} <span class="count">${b.specs.length + b.intents.length}</span></h4>
      <ul class="dt-list">${intentsLi}${specsLi}</ul>
    </div>`;
  }).join('');
  return `${DT_CSS}<section>
    <h2>Timeline des livraisons <span class="count">${t.moisAffiches} mois · ${t.totalSpecs} SPEC(s) + ${t.totalIntents} Intent(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Achievements par mois sur les ${t.moisAffiches} derniers mois. Visualise la cadence de livraison et identifie les pics ou creux.</p>
    <div class="dt-bar">${bars}</div>
    ${t.moisPlusActif ? `<div class="dt-meta">🎉 Mois le plus actif : <strong>${escape(t.moisPlusActif)}</strong>.</div>` : ''}
    <div class="dt-grid">${cards}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerDoneTimeline as computeDoneTimeline,
  blocDoneTimeline as doneTimelineSection,
};
