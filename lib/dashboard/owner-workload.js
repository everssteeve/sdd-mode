// AIAD SDD Mode — Dashboard : owner workload heatmap (#523).
//
// Distribution de la **charge active** par owner (frontmatter `owner:` /
// `assignee:`) pour identifier qui est surchargé. Va plus loin que
// `#437 ownership` (qui liste les Intents par owner) en ajoutant :
//   - Détection seuil WIP (cf #470 wip-limit)
//   - Croisement avec capacité par owner (frontmatter `capacity:`)
//
// Pure transformation.

const STATUTS_ACTIFS = new Set(['active', 'in-progress', 'review', 'validation']);

const WIP_DEFAUT = 3;

function lireOwners(intent) {
  const candidats = [intent?.owner, intent?.Owner, intent?.owners, intent?.assignee, intent?.assignees];
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

function lireCapacity(intent) {
  const c = intent?.capacity ?? intent?.Capacity ?? intent?.wip_limit;
  const n = Number(c);
  return isNaN(n) || n <= 0 ? null : n;
}

export function calculerOwnerWorkload(donnees, options = {}) {
  const wipDefaut = options.wipDefaut || WIP_DEFAUT;
  const parOwner = new Map();
  for (const i of donnees?.intents || []) {
    const owners = lireOwners(i);
    if (owners.length === 0) continue;
    for (const o of owners) {
      if (!parOwner.has(o)) parOwner.set(o, { owner: o, actifs: [], inactifs: [], capacity: null });
      const entry = parOwner.get(o);
      if (STATUTS_ACTIFS.has(i.statut)) entry.actifs.push({ id: i.id, titre: i.titre || '', statut: i.statut });
      else entry.inactifs.push({ id: i.id, statut: i.statut });
      const c = lireCapacity(i);
      if (c != null && (entry.capacity == null || c > entry.capacity)) entry.capacity = c;
    }
  }
  const items = [...parOwner.values()].map((e) => {
    const capacite = e.capacity != null ? e.capacity : wipDefaut;
    const charge = e.actifs.length;
    const ratio = capacite > 0 ? charge / capacite : 0;
    const etat = ratio > 1.3 ? 'surcharge'
      : ratio > 1.0 ? 'limite'
      : ratio > 0.7 ? 'optimal'
      : ratio > 0.2 ? 'leger' : 'libre';
    return { ...e, capacite, charge, ratio: Math.round(ratio * 100) / 100, etat };
  });
  items.sort((a, b) => b.ratio - a.ratio);
  return {
    items,
    totaux: {
      owners: items.length,
      surcharges: items.filter((i) => i.etat === 'surcharge').length,
      libres: items.filter((i) => i.etat === 'libre').length,
      capaciteDefaut: wipDefaut,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const OW_CSS = `<style>
.ow-row { padding:.5rem .65rem; margin:.3rem 0; border-radius:.35rem; background:rgba(127,127,127,.04); border-left:3px solid var(--accent, #4c6ef5); }
.ow-row.e-surcharge { border-left-color:#c92a2a; background:rgba(201,42,42,.05); }
.ow-row.e-limite { border-left-color:#e8590c; background:rgba(232,89,12,.04); }
.ow-row.e-optimal { border-left-color:#2b8a3e; }
.ow-row.e-leger { border-left-color:#4c6ef5; }
.ow-row.e-libre { border-left-color:rgba(127,127,127,.3); opacity:.85; }
.ow-head { display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; font-size:.88rem; }
.ow-bar { width:120px; height:10px; background:rgba(127,127,127,.15); border-radius:5px; overflow:hidden; display:inline-block; vertical-align:middle; position:relative; }
.ow-fill { height:100%; transition:width .15s; }
.ow-fill.e-surcharge { background:#c92a2a; }
.ow-fill.e-limite { background:#e8590c; }
.ow-fill.e-optimal { background:#2b8a3e; }
.ow-fill.e-leger { background:#4c6ef5; }
.ow-fill.e-libre { background:rgba(127,127,127,.4); }
.ow-tag { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.7rem; }
.ow-tag.e-surcharge { background:rgba(201,42,42,.15); color:#7a1717; }
.ow-tag.e-limite { background:rgba(232,89,12,.15); color:#7a3a08; }
.ow-tag.e-optimal { background:rgba(43,138,62,.15); color:#1c5a2a; }
.ow-tag.e-leger { background:rgba(76,110,245,.12); color:#3a4cba; }
.ow-meta { font-size:.78rem; color:var(--muted, #777); margin-top:.25rem; }
.ow-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

const LABELS = {
  surcharge: '⛔ Surcharge (> 130%)',
  limite: '⚠ Limite (100-130%)',
  optimal: '✓ Optimal (70-100%)',
  leger: '◐ Léger (20-70%)',
  libre: '⊘ Libre (< 20%)',
};

export function blocOwnerWorkload(donnees) {
  const w = donnees?.ownerWorkload;
  if (!w) return '';
  if (w.items.length === 0) {
    return `${OW_CSS}<section>
      <h2>Charge par owner <span class="count">aucun owner déclaré</span></h2>
      <div class="ow-empty">Ajoute <code>owner:</code> au frontmatter des Intents pour mesurer la distribution de charge active. Optionnel : <code>capacity: N</code> pour un seuil WIP personnalisé (défaut ${w.totaux?.capaciteDefaut || 3}).</div>
    </section>`;
  }
  const t = w.totaux;
  const rows = w.items.slice(0, 15).map((it) => {
    const pct = Math.min(150, Math.round(it.ratio * 100));
    const samples = it.actifs.slice(0, 4).map((a) => `<code>${escape(a.id)}</code>`).join(' ');
    return `<div class="ow-row e-${escape(it.etat)}">
      <div class="ow-head">
        <strong>${escape(it.owner)}</strong>
        <span class="ow-bar"><span class="ow-fill e-${escape(it.etat)}" style="width:${pct}%"></span></span>
        <span class="ow-tag e-${escape(it.etat)}">${escape(LABELS[it.etat])}</span>
        <span class="ow-tag">${it.charge}/${it.capacite} actifs</span>
      </div>
      <div class="ow-meta">${samples}${it.inactifs.length > 0 ? ` · ${it.inactifs.length} autre(s) (done/archived/draft)` : ''}</div>
    </div>`;
  }).join('');
  const action = t.surcharges > 0
    ? `<p class="muted" style="font-size:.85rem">⛔ <strong>${t.surcharges} owner(s) en surcharge</strong> (> 130 % WIP). Re-prioriser ou re-distribuer.</p>`
    : `<p class="muted" style="font-size:.85rem">✓ Aucun owner en surcharge — distribution saine.</p>`;
  return `${OW_CSS}<section>
    <h2>Charge par owner <span class="count">${t.owners} owner(s) — ${t.surcharges} en surcharge</span></h2>
    <p class="muted" style="font-size:.85rem">Distribution de la charge active (Intents en statut active/in-progress/review/validation) par owner. Seuil WIP par défaut : ${t.capaciteDefaut} (override via frontmatter <code>capacity:</code> sur un Intent).</p>
    ${action}
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerOwnerWorkload as computeOwnerWorkload,
  blocOwnerWorkload as ownerWorkloadSection,
};
