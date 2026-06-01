// AIAD SDD Mode — Dashboard : backlog freshness (#471).
//
// Détecte les Intents et SPECs **stales** : non modifiés depuis ≥ N jours
// et toujours en statut actif (draft / active / in-progress / review).
// Complète #455 (refinement) avec une perspective temporelle :
// "ces items sont peut-être oubliés — à rafraîchir ou archiver".
//
// Heuristique :
//   - "frais" si mtime ≥ now - 14 jours
//   - "tiède" si 14j < age ≤ 30j
//   - "stale" si 30j < age ≤ 60j (recommander revue)
//   - "abandonné" si age > 60j (recommander archive ou re-validation)
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const JOUR_MS = 24 * 3600 * 1000;
const STATUTS_INTENT_ACTIF = new Set(['draft', 'active', 'in-progress']);
const STATUTS_SPEC_ACTIF = new Set(['draft', 'ready', 'in-progress', 'review', 'validation']);

export function bandeFraicheur(ageJours) {
  if (ageJours == null) return 'inconnu';
  if (ageJours <= 14) return 'frais';
  if (ageJours <= 30) return 'tiede';
  if (ageJours <= 60) return 'stale';
  return 'abandonne';
}

export function calculerBacklogFreshness(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const items = [];
  for (const i of donnees?.intents || []) {
    if (!STATUTS_INTENT_ACTIF.has(i.statut)) continue;
    if (!i.mtime) continue;
    const ageJours = Math.floor((now - i.mtime) / JOUR_MS);
    items.push({
      type: 'Intent',
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      mtime: i.mtime,
      ageJours,
      bande: bandeFraicheur(ageJours),
    });
  }
  for (const s of donnees?.specs || []) {
    if (!STATUTS_SPEC_ACTIF.has(s.statut)) continue;
    if (!s.mtime) continue;
    const ageJours = Math.floor((now - s.mtime) / JOUR_MS);
    items.push({
      type: 'SPEC',
      id: s.id,
      titre: s.titre || '',
      file: s.file || null,
      statut: s.statut,
      mtime: s.mtime,
      ageJours,
      bande: bandeFraicheur(ageJours),
    });
  }
  // Tri : abandonné d'abord, puis stale, puis tiède, frais en queue.
  const RANK = { abandonne: 0, stale: 1, tiede: 2, frais: 3, inconnu: 4 };
  items.sort((a, b) => RANK[a.bande] - RANK[b.bande] || b.ageJours - a.ageJours);
  const totaux = {
    total: items.length,
    abandonne: items.filter((i) => i.bande === 'abandonne').length,
    stale: items.filter((i) => i.bande === 'stale').length,
    tiede: items.filter((i) => i.bande === 'tiede').length,
    frais: items.filter((i) => i.bande === 'frais').length,
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

function badgeBande(bande) {
  const map = {
    abandonne: { cls: 'badge-bad', label: 'Abandonné > 60j' },
    stale: { cls: 'badge-warn', label: 'Stale 30-60j' },
    tiede: { cls: 'badge-info', label: 'Tiède 14-30j' },
    frais: { cls: 'badge-ok', label: 'Frais ≤ 14j' },
    inconnu: { cls: 'badge-muted', label: 'Inconnu' },
  };
  const v = map[bande] || map.inconnu;
  return `<span class="badge ${v.cls}">${escape(v.label)}</span>`;
}

const FRESH_CSS = `<style>
.fresh-stats { display:flex; gap:.5rem; flex-wrap:wrap; margin:.4rem 0; }
.fresh-stat { padding:.25rem .55rem; border-radius:.2rem; font-size:.78rem; }
.fresh-stat.bande-abandonne { background:rgba(201,42,42,.12); color:#7a1717; font-weight:600; }
.fresh-stat.bande-stale { background:rgba(232,89,12,.12); color:#7a3a08; font-weight:500; }
.fresh-stat.bande-tiede { background:rgba(76,110,245,.12); color:#3a4cba; }
.fresh-stat.bande-frais { background:rgba(43,138,62,.12); color:#1f6b2f; }
.fresh-card { padding:.4rem .6rem; margin:.3rem 0; border:1px solid var(--border, #ddd); border-radius:.3rem; background:var(--card-bg, #fff); font-size:.83rem; }
.fresh-card.bande-abandonne { border-left:4px solid #c92a2a; background:rgba(201,42,42,.04); }
.fresh-card.bande-stale { border-left:4px solid #e8590c; background:rgba(232,89,12,.04); }
.fresh-card.bande-tiede { border-left:4px solid #4c6ef5; }
.fresh-card.bande-frais { border-left:4px solid #2b8a3e; opacity: .65; }
.fresh-card-head { display:flex; align-items:baseline; gap:.4rem; flex-wrap:wrap; }
.fresh-card-age { font-variant-numeric: tabular-nums; font-weight:600; min-width: 60px; text-align: right; font-size:.78rem; color: var(--muted, #777); }
</style>`;

export function blocBacklogFreshness(donnees) {
  const f = donnees?.backlogFreshness;
  if (!f) return '';
  if (f.items.length === 0) {
    return `<section>
      <h2>Fraîcheur du backlog <span class="count">aucun item actif</span></h2>
      <p class="muted" style="font-size:.85rem">Aucun Intent ou SPEC en statut actif détecté.</p>
    </section>`;
  }
  // Affiche en priorité les abandonné/stale (= signal d'action).
  const aActionner = f.items.filter((i) => i.bande === 'abandonne' || i.bande === 'stale');
  const items = aActionner.length > 0 ? aActionner : f.items;
  const cards = items.slice(0, 15).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    return `<div class="fresh-card bande-${escape(it.bande)}">
      <div class="fresh-card-head">
        ${badgeBande(it.bande)}
        <span class="muted" style="font-size:.7rem">${escape(it.type)}</span>
        <strong>${idCell}</strong>
        <span>${escape(it.titre)}</span>
        <span class="muted">(${escape(it.statut)})</span>
        <span class="fresh-card-age">${it.ageJours} j</span>
      </div>
    </div>`;
  }).join('');
  const t = f.totaux;
  const stats = `<div class="fresh-stats">
    <span class="fresh-stat bande-abandonne">${t.abandonne} abandonné(s) > 60j</span>
    <span class="fresh-stat bande-stale">${t.stale} stale 30-60j</span>
    <span class="fresh-stat bande-tiede">${t.tiede} tiède 14-30j</span>
    <span class="fresh-stat bande-frais">${t.frais} frais ≤ 14j</span>
  </div>`;
  const conseil = (t.abandonne + t.stale > 0)
    ? `<p class="muted" style="font-size:.85rem">⚠ ${t.abandonne + t.stale} item(s) à rafraîchir, ré-évaluer ou archiver. Le silence prolongé est rarement un bon signal en product management.</p>`
    : '<p class="muted" style="font-size:.85rem">Backlog frais — pas d\'item oublié.</p>';
  return `${FRESH_CSS}<section>
    <h2>Fraîcheur du backlog <span class="count">${t.total} item(s) actif(s) suivis</span></h2>
    ${stats}
    ${conseil}
    ${cards}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  bandeFraicheur as freshnessBand,
  calculerBacklogFreshness as computeBacklogFreshness,
  blocBacklogFreshness as backlogFreshnessSection,
};
