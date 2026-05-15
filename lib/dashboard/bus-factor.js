// AIAD SDD Mode — Dashboard : bus factor analyzer (#546).
//
// Détecte les Intents où **un seul owner est impliqué** — si cette
// personne part, le projet perd la connaissance. Le "bus factor"
// (number of people that need to be hit by a bus before the project
// stalls) doit être > 1.
//
// Pour chaque Intent actif :
//   - Compte owners distincts (frontmatter)
//   - bus_factor = nb d'owners
//   - Risque "single-owner" si bus_factor == 1
//
// Score projet : ratio Intents > 1 owner / total actifs.
//
// Pure transformation.

const STATUTS_ACTIFS = new Set(['active', 'in-progress', 'review', 'validation']);

function lireOwners(intent) {
  const candidats = [intent?.owner, intent?.Owner, intent?.owners, intent?.assignees, intent?.assignee];
  const out = [];
  for (const v of candidats) {
    if (!v) continue;
    if (Array.isArray(v)) { for (const x of v) if (x) out.push(String(x).trim()); }
    else if (typeof v === 'string') {
      for (const x of v.split(/[,;]/)) if (x.trim()) out.push(x.trim());
    }
  }
  return [...new Set(out.filter(Boolean))];
}

export function calculerBusFactor(donnees) {
  const intents = (donnees?.intents || []).filter((i) => STATUTS_ACTIFS.has(i.statut));
  const items = intents.map((i) => {
    const owners = lireOwners(i);
    const bus = owners.length;
    let etat;
    if (bus === 0) etat = 'pas-downer';
    else if (bus === 1) etat = 'single-owner';
    else if (bus === 2) etat = 'duo';
    else etat = 'sain';
    return {
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      priority: i.priority || null,
      owners,
      busFactor: bus,
      etat,
    };
  });
  // Tri : single-owner d'abord (signal), puis pas-downer.
  const RANK = { 'single-owner': 0, 'pas-downer': 1, duo: 2, sain: 3 };
  items.sort((a, b) => (RANK[a.etat] ?? 99) - (RANK[b.etat] ?? 99));
  const totaux = {
    total: items.length,
    singleOwner: items.filter((i) => i.etat === 'single-owner').length,
    pasDowner: items.filter((i) => i.etat === 'pas-downer').length,
    duo: items.filter((i) => i.etat === 'duo').length,
    sain: items.filter((i) => i.etat === 'sain').length,
  };
  totaux.tauxSain = totaux.total === 0 ? null
    : Math.round(((totaux.duo + totaux.sain) / totaux.total) * 100);
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const BF_CSS = `<style>
.bf-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.bf-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.bf-stat .bf-val { font-size:1.2rem; font-weight:700; }
.bf-stat .bf-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.bf-stat.e-single-owner { background:rgba(232,89,12,.06); border-color:rgba(232,89,12,.3); }
.bf-stat.e-pas-downer { background:rgba(201,42,42,.06); border-color:rgba(201,42,42,.3); }
.bf-stat.e-duo { background:rgba(245,166,35,.05); border-color:rgba(245,166,35,.3); }
.bf-stat.e-sain { background:rgba(43,138,62,.07); border-color:rgba(43,138,62,.3); }
.bf-row { padding:.35rem .5rem; margin:.15rem 0; font-size:.82rem; background:rgba(127,127,127,.04); border-radius:.22rem; display:flex; gap:.5rem; align-items:baseline; flex-wrap:wrap; }
.bf-row.r-single-owner { border-left:3px solid #e8590c; background:rgba(232,89,12,.04); }
.bf-row.r-pas-downer { border-left:3px solid #c92a2a; background:rgba(201,42,42,.04); }
.bf-row.r-duo { border-left:3px solid #f5a623; }
.bf-row.r-sain { border-left:3px solid #2b8a3e; }
.bf-tag { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.72rem; }
.bf-tag.owner { background:rgba(76,110,245,.1); color:#3a4cba; }
.bf-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

const LABELS = {
  'single-owner': '⚠ Single-owner',
  'pas-downer': '⛔ Sans owner',
  duo: '◐ Duo',
  sain: '✓ Sain (≥ 3)',
};

export function blocBusFactor(donnees) {
  const b = donnees?.busFactor;
  if (!b) return '';
  if (b.items.length === 0) {
    return `${BF_CSS}<section>
      <h2>Bus factor analyzer <span class="count">aucun Intent actif</span></h2>
      <div class="bf-empty">Compte le nombre d'owners par Intent actif. Bus factor = 1 (single-owner) = risque si la personne part. Cible : bus factor ≥ 2.</div>
    </section>`;
  }
  const t = b.totaux;
  const grid = ['single-owner', 'pas-downer', 'duo', 'sain'].map((etat) => {
    const cle = etat === 'single-owner' ? 'singleOwner' : etat === 'pas-downer' ? 'pasDowner' : etat;
    return `<div class="bf-stat e-${etat}">
      <div class="bf-val">${t[cle] || 0}</div>
      <div class="bf-label">${escape(LABELS[etat])}</div>
    </div>`;
  }).join('');
  const rows = b.items.slice(0, 15).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const ownerTags = it.owners.length > 0 ? it.owners.map((o) => `<span class="bf-tag owner">${escape(o)}</span>`).join(' ') : '<span class="bf-tag">(aucun)</span>';
    return `<div class="bf-row r-${escape(it.etat)}">
      <strong>${idCell}</strong>
      <span>${escape((it.titre || '').slice(0, 40))}</span>
      ${it.priority ? `<span class="bf-tag">${escape(String(it.priority).toUpperCase())}</span>` : ''}
      <span class="bf-tag">bus ${it.busFactor}</span>
      ${ownerTags}
    </div>`;
  }).join('');
  return `${BF_CSS}<section>
    <h2>Bus factor analyzer <span class="count">${t.total} actifs · ${t.tauxSain ?? '—'}% bus factor ≥ 2</span></h2>
    <p class="muted" style="font-size:.85rem">Compte owners distincts par Intent actif. Bus factor = 1 (single-owner) = risque concentration : si la personne part, la connaissance disparaît. Cible : ≥ 2 owners par Intent stratégique.</p>
    <div class="bf-grid">${grid}</div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerBusFactor as computeBusFactor,
  blocBusFactor as busFactorSection,
};
