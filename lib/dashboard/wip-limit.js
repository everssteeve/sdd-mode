// AIAD SDD Mode — Dashboard : WIP limit detection (#470).
//
// Kanban classique : compte les Intents et SPECs **simultanément** en
// cours (status `in-progress` / `review` / `validation` / `active`) et
// compare à la WIP limit définie. Si dépassée → alerte de surcharge
// produit qui suggère de stopper la prise de nouveau travail.
//
// Source de WIP limit (par ordre de priorité) :
//   1. frontmatter PRD `wip_limit: { intents: 5, specs: 8 }`
//   2. frontmatter PRD `wip_limit: 8` (valeur unique pour les deux)
//   3. heuristique défaut : `team_capacity_per_quarter / 4` (semaines par quarter)
//   4. plancher : 5 / 5
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from '../frontmatter.js';
import { lireFichier } from './collect.js';

const STATUTS_INTENT_WIP = new Set(['active', 'in-progress']);
const STATUTS_SPEC_WIP = new Set(['in-progress', 'review', 'validation']);

export const WIP_DEFAUT = Object.freeze({ intents: 5, specs: 8 });

export function lireWipLimit(racineProjet) {
  const chemin = join(racineProjet, '.aiad', 'PRD.md');
  if (!existsSync(chemin)) return { ...WIP_DEFAUT, source: 'défaut' };
  const contenu = lireFichier(chemin);
  if (!contenu) return { ...WIP_DEFAUT, source: 'défaut' };
  const { data } = parseFrontmatter(contenu);
  if (data.wip_limit != null) {
    // Forme `wip_limit: 8` ou `wip_limit: { intents: 5, specs: 8 }`
    if (typeof data.wip_limit === 'number') {
      const n = Number(data.wip_limit);
      if (Number.isFinite(n) && n > 0) return { intents: n, specs: n, source: 'PRD frontmatter (unique)' };
    }
    if (typeof data.wip_limit === 'object') {
      const i = Number(data.wip_limit.intents);
      const s = Number(data.wip_limit.specs);
      const intents = Number.isFinite(i) && i > 0 ? i : WIP_DEFAUT.intents;
      const specs = Number.isFinite(s) && s > 0 ? s : WIP_DEFAUT.specs;
      return { intents, specs, source: 'PRD frontmatter (par type)' };
    }
  }
  // Fallback heuristique : team_capacity_per_quarter / 4.
  if (data.team_capacity_per_quarter != null) {
    const cap = Number(data.team_capacity_per_quarter);
    if (Number.isFinite(cap) && cap > 0) {
      const v = Math.max(5, Math.round(cap / 4));
      return { intents: v, specs: v + 3, source: `dérivé de team_capacity_per_quarter=${cap}` };
    }
  }
  return { ...WIP_DEFAUT, source: 'défaut (5/8)' };
}

export function calculerWipLimit(racineProjet, donnees) {
  const limit = lireWipLimit(racineProjet);
  const intentsWip = (donnees?.intents || []).filter((i) => STATUTS_INTENT_WIP.has(i.statut));
  const specsWip = (donnees?.specs || []).filter((s) => STATUTS_SPEC_WIP.has(s.statut));
  function etat(charge, max) {
    if (charge >= max * 1.2) return 'critique';
    if (charge >= max) return 'depasse';
    if (charge >= max * 0.8) return 'proche';
    return 'sain';
  }
  return {
    limit,
    intents: {
      charge: intentsWip.length,
      limite: limit.intents,
      etat: etat(intentsWip.length, limit.intents),
      items: intentsWip.map((i) => ({ id: i.id, titre: i.titre || '', statut: i.statut, file: i.file || null })),
    },
    specs: {
      charge: specsWip.length,
      limite: limit.specs,
      etat: etat(specsWip.length, limit.specs),
      items: specsWip.map((s) => ({ id: s.id, titre: s.titre || '', statut: s.statut, file: s.file || null })),
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

function badgeEtat(etat) {
  const map = {
    critique: { cls: 'badge-bad', label: 'Critique > 120 %' },
    depasse: { cls: 'badge-bad', label: 'Dépassée ≥ 100 %' },
    proche: { cls: 'badge-warn', label: 'Proche 80 %' },
    sain: { cls: 'badge-ok', label: 'Sain' },
  };
  const v = map[etat] || { cls: 'badge-muted', label: '?' };
  return `<span class="badge ${v.cls}">${escape(v.label)}</span>`;
}

const WIP_CSS = `<style>
.wip-grid { display:grid; gap:.6rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); margin:.5rem 0; }
.wip-card { padding:.6rem .75rem; border:1px solid var(--border, #ddd); border-radius:.4rem; background:var(--card-bg, #fff); }
.wip-card.etat-critique, .wip-card.etat-depasse { border-left:4px solid #c92a2a; background:rgba(201,42,42,.04); }
.wip-card.etat-proche { border-left:4px solid #e8590c; }
.wip-card.etat-sain { border-left:4px solid #2b8a3e; }
.wip-card-head { display:flex; align-items:baseline; gap:.5rem; flex-wrap:wrap; margin-bottom:.3rem; }
.wip-card-titre { font-weight:600; font-size:.92rem; }
.wip-card-charge { font-size:1.4rem; font-weight:700; }
.wip-bar { height:.45rem; background:rgba(127,127,127,.12); border-radius:.2rem; overflow:hidden; margin:.3rem 0; }
.wip-bar-fill { height:100%; transition: width .3s; }
.wip-bar-fill.etat-critique, .wip-bar-fill.etat-depasse { background:#c92a2a; }
.wip-bar-fill.etat-proche { background:#e8590c; }
.wip-bar-fill.etat-sain { background:#2b8a3e; }
.wip-items { display:flex; flex-wrap:wrap; gap:.3rem; margin-top:.3rem; }
.wip-item-chip { padding:.15rem .4rem; background:rgba(127,127,127,.06); border-radius:.2rem; font-size:.72rem; }
</style>`;

function chipItem(it) {
  const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
  return `<span class="wip-item-chip" title="${escape(it.titre)} (${escape(it.statut)})">${idCell}</span>`;
}

export function blocWipLimit(donnees) {
  const w = donnees?.wipLimit;
  if (!w) return '';
  function carte(type, label, data) {
    const widthPct = Math.min(100, Math.round((data.charge / Math.max(1, data.limite)) * 100));
    return `<div class="wip-card etat-${escape(data.etat)}">
      <div class="wip-card-head">
        <span class="wip-card-titre">${escape(label)}</span>
        ${badgeEtat(data.etat)}
      </div>
      <div class="wip-card-charge">${data.charge} <span style="font-size:.78rem;color:var(--muted, #777)">/ ${data.limite}</span></div>
      <div class="wip-bar"><div class="wip-bar-fill etat-${escape(data.etat)}" style="width:${widthPct}%"></div></div>
      <div class="wip-items">${data.items.slice(0, 10).map(chipItem).join('') || '<span class="muted" style="font-size:.7rem">vide</span>'}</div>
    </div>`;
  }
  const alerte = (w.intents.etat === 'depasse' || w.intents.etat === 'critique'
    || w.specs.etat === 'depasse' || w.specs.etat === 'critique')
    ? '<p class="muted" style="font-size:.85rem; color:#7a1717; font-weight:500;">⚠ WIP limit dépassée — stopper toute nouvelle prise de travail, terminer ce qui est en cours en priorité (cadence Kanban).</p>'
    : '<p class="muted" style="font-size:.85rem">Charge WIP sous limite — l\'équipe peut absorber des nouveaux items.</p>';
  return `${WIP_CSS}<section>
    <h2>WIP limit (work-in-progress) <span class="count">Intents ${w.intents.charge}/${w.intents.limite} · SPECs ${w.specs.charge}/${w.specs.limite} · source: ${escape(w.limit.source)}</span></h2>
    ${alerte}
    <div class="wip-grid">
      ${carte('intents', 'Intents actifs / in-progress', w.intents)}
      ${carte('specs', 'SPECs en cours (in-progress / review / validation)', w.specs)}
    </div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  lireWipLimit as readWipLimit,
  calculerWipLimit as computeWipLimit,
  blocWipLimit as wipLimitSection,
};
export { WIP_DEFAUT as DEFAULT_WIP };
