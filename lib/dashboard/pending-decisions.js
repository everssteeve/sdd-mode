// AIAD SDD Mode — Dashboard : pending decisions queue (#550).
//
// Agrège les **décisions en attente** du PM :
//   - SPECs en `review`/`validation` (à valider/refuser)
//   - Intents draft > 14j (à promouvoir ou descoper)
//   - Hypothèses untested > 30j (à tester ou abandonner)
//   - Risques critical/high non-mitigés (à mitiger ou accepter)
//
// Pure transformation.

const DAY = 24 * 3600 * 1000;
const STATUTS_LIVRES = new Set(['done', 'archived']);

export function calculerPendingDecisions(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const items = [];
  // SPECs en review/validation
  for (const s of donnees?.specs || []) {
    if (s.statut !== 'review' && s.statut !== 'validation') continue;
    const ageJours = s.mtime ? Math.floor((now - s.mtime) / DAY) : 0;
    items.push({
      type: 'spec-review',
      id: s.id,
      titre: s.titre || '',
      file: s.file || null,
      action: `Valider ou refuser SPEC en ${s.statut} (${ageJours}j)`,
      ageJours,
      urgence: ageJours > 14 ? 'urgent' : ageJours > 7 ? 'normal' : 'frais',
    });
  }
  // Intents draft > 14j
  for (const i of donnees?.intents || []) {
    if (i.statut !== 'draft' || !i.mtime) continue;
    const ageJours = Math.floor((now - i.mtime) / DAY);
    if (ageJours < 14) continue;
    items.push({
      type: 'intent-draft',
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      action: `Décider : promouvoir en active ou descoper (draft ${ageJours}j)`,
      ageJours,
      urgence: ageJours > 60 ? 'urgent' : ageJours > 30 ? 'normal' : 'frais',
    });
  }
  // Hypothèses untested > 30j
  for (const i of donnees?.intents || []) {
    if (!i.hypothesis) continue;
    const etat = String(i.hypothesis_status || i.hypothesisStatus || 'untested').toLowerCase();
    if (etat !== 'untested' && etat !== 'non-teste' && etat !== 'draft' && etat !== 'proposed') continue;
    if (!i.mtime) continue;
    const ageJours = Math.floor((now - i.mtime) / DAY);
    if (ageJours < 30) continue;
    items.push({
      type: 'hypothesis-untested',
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      action: `Tester ou abandonner hypothèse (${ageJours}j sans test)`,
      ageJours,
      urgence: ageJours > 90 ? 'urgent' : 'normal',
    });
  }
  // Risques critical/high non couverts (depuis riskTransparency)
  const rt = donnees?.riskTransparency?.items || [];
  for (const r of rt) {
    if (r.couvert) continue;
    items.push({
      type: 'risque-decouvert',
      id: r.id,
      titre: r.titre || '',
      file: r.file || null,
      action: `Mitiger ou accepter risque ${r.niveau}`,
      ageJours: null,
      urgence: r.niveau === 'critical' ? 'urgent' : 'normal',
    });
  }
  // Tri : urgent d'abord
  const RANK = { urgent: 0, normal: 1, frais: 2 };
  items.sort((a, b) => (RANK[a.urgence] ?? 99) - (RANK[b.urgence] ?? 99));
  const totaux = {
    total: items.length,
    specReview: items.filter((i) => i.type === 'spec-review').length,
    intentDraft: items.filter((i) => i.type === 'intent-draft').length,
    hypoUntested: items.filter((i) => i.type === 'hypothesis-untested').length,
    risqueDecouvert: items.filter((i) => i.type === 'risque-decouvert').length,
    urgent: items.filter((i) => i.urgence === 'urgent').length,
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const PD_CSS = `<style>
.pd-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.pd-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.pd-stat .pd-val { font-size:1.2rem; font-weight:700; }
.pd-stat .pd-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.pd-stat.has-urgent { background:rgba(201,42,42,.06); border-color:rgba(201,42,42,.3); }
.pd-row { padding:.35rem .5rem; margin:.2rem 0; border-radius:.3rem; background:rgba(127,127,127,.04); border-left:3px solid var(--accent, #4c6ef5); font-size:.83rem; }
.pd-row.urgent { border-left-color:#c92a2a; background:rgba(201,42,42,.04); }
.pd-row.normal { border-left-color:#e8590c; }
.pd-row.frais { border-left-color:#4c6ef5; }
.pd-head { display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; }
.pd-type { padding:.05rem .35rem; border-radius:.18rem; font-size:.7rem; background:rgba(127,127,127,.1); }
.pd-type.spec-review { background:rgba(76,110,245,.12); color:#3a4cba; }
.pd-type.intent-draft { background:rgba(245,166,35,.15); color:#7a560f; }
.pd-type.hypothesis-untested { background:rgba(232,89,12,.12); color:#7a3a08; }
.pd-type.risque-decouvert { background:rgba(201,42,42,.15); color:#7a1717; }
.pd-action { font-size:.78rem; color:var(--muted, #555); margin-top:.2rem; }
.pd-empty { padding:.5rem .7rem; background:rgba(43,138,62,.06); border-left:3px solid #2b8a3e; border-radius:.25rem; font-size:.85rem; color:#1c5a2a; }
</style>`;

export function blocPendingDecisions(donnees) {
  const p = donnees?.pendingDecisions;
  if (!p) return '';
  if (p.items.length === 0) {
    return `${PD_CSS}<section>
      <h2>Décisions en attente <span class="count">file vide</span></h2>
      <div class="pd-empty">✓ Aucune décision en attente — file zen. Décisions traquées : SPECs en review/validation, Intents draft > 14j, hypothèses untested > 30j, risques élevés non-couverts.</div>
    </section>`;
  }
  const t = p.totaux;
  const grid = [
    `<div class="pd-stat ${t.urgent > 0 ? 'has-urgent' : ''}"><div class="pd-val">${t.urgent}</div><div class="pd-label">Urgent</div></div>`,
    `<div class="pd-stat"><div class="pd-val">${t.specReview}</div><div class="pd-label">SPECs review</div></div>`,
    `<div class="pd-stat"><div class="pd-val">${t.intentDraft}</div><div class="pd-label">Drafts vieux</div></div>`,
    `<div class="pd-stat"><div class="pd-val">${t.hypoUntested}</div><div class="pd-label">Hypo untested</div></div>`,
    `<div class="pd-stat"><div class="pd-val">${t.risqueDecouvert}</div><div class="pd-label">Risques découverts</div></div>`,
  ].join('');
  const rows = p.items.slice(0, 20).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    return `<div class="pd-row ${escape(it.urgence)}">
      <div class="pd-head">
        <span class="pd-type ${escape(it.type)}">${escape(it.type)}</span>
        <strong>${idCell}</strong>
        <span>${escape((it.titre || '').slice(0, 60))}</span>
      </div>
      <div class="pd-action">→ ${escape(it.action)}</div>
    </div>`;
  }).join('');
  return `${PD_CSS}<section>
    <h2>Décisions en attente <span class="count">${t.total} décisions · ${t.urgent} urgent(s)</span></h2>
    <p class="muted" style="font-size:.85rem">File de décisions PM en attente : SPECs en review/validation, Intents draft > 14j, hypothèses untested > 30j, risques élevés non-mitigés/acceptés. Tri urgent d'abord.</p>
    <div class="pd-grid">${grid}</div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerPendingDecisions as computePendingDecisions,
  blocPendingDecisions as pendingDecisionsSection,
};
