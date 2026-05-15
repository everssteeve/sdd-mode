// AIAD SDD Mode — Dashboard : capacity planner trimestriel (#458).
//
// Pour chaque trimestre civil (Q1/Q2/Q3/Q4), compte les Intents `active`
// + `in-progress` + `draft` ciblés sur ce quarter (via `target` ou
// `target_date` du frontmatter, #427) et le compare à la capacité équipe
// définie via `.aiad/config.yml` ou config par défaut.
//
// Heuristique de capacité par défaut : `2 Intents par PE × 5 PE = 10
// Intents max par trimestre` (Cycle Time moyen historique 6-8 semaines
// par Intent, observé en PE AIAD). Surchargeable via :
//   - frontmatter `team_capacity_per_quarter: N` dans `.aiad/PRD.md`
//   - frontmatter `intents_per_pe: N` (per-PE rate) + `team_size: N`
//
// Détecte les trimestres saturés (count >= capacité × 1.0) et les
// trimestres en sous-utilisation (count < capacité × 0.4).
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from '../frontmatter.js';
import { lireFichier } from './collect.js';
import { lireQuarterIntent, formatQuarter, cleQuarter, quartersAffiches } from './roadmap.js';

export const CAPACITY_PAR_DEFAUT = 10; // 2 Intents × 5 PE par trimestre

// Lit la capacité depuis le PRD ou config locale. Cohérent avec le pattern
// existant des modules `outcomes.js` / `prd-coverage.js`.
export function lireCapacite(racineProjet, options = {}) {
  const chemin = options.fichier
    ? join(racineProjet, options.fichier)
    : join(racineProjet, '.aiad', 'PRD.md');
  if (!existsSync(chemin)) return { capacite: CAPACITY_PAR_DEFAUT, source: 'défaut' };
  const contenu = lireFichier(chemin);
  if (!contenu) return { capacite: CAPACITY_PAR_DEFAUT, source: 'défaut' };
  const { data } = parseFrontmatter(contenu);
  if (data.team_capacity_per_quarter != null) {
    const n = Number(data.team_capacity_per_quarter);
    if (Number.isFinite(n) && n > 0) return { capacite: n, source: 'PRD frontmatter' };
  }
  if (data.intents_per_pe != null && data.team_size != null) {
    const ipp = Number(data.intents_per_pe);
    const ts = Number(data.team_size);
    if (Number.isFinite(ipp) && Number.isFinite(ts) && ipp > 0 && ts > 0) {
      return { capacite: ipp * ts, source: `${ipp} Intents × ${ts} PE` };
    }
  }
  return { capacite: CAPACITY_PAR_DEFAUT, source: 'défaut (2 Intents × 5 PE)' };
}

const STATUTS_ACTIFS = new Set(['active', 'in-progress', 'review', 'validation', 'draft']);

// Statut d'un trimestre par rapport à sa capacité.
export function etatTrimestre(charge, capacite) {
  if (capacite <= 0) return 'inconnu';
  const ratio = charge / capacite;
  if (ratio >= 1.0) return 'sature';
  if (ratio >= 0.7) return 'plein';
  if (ratio >= 0.4) return 'sain';
  return 'sous-utilise';
}

export function calculerCapacityPlanner(racineProjet, donnees, options = {}) {
  const { capacite, source } = lireCapacite(racineProjet);
  const now = options.now != null ? options.now : Date.now();
  const colonnes = quartersAffiches({ now, ahead: 3, behind: 1 });
  const intents = donnees?.intents || [];
  const buckets = colonnes.map((q) => ({
    quarter: q,
    label: formatQuarter(q),
    cle: cleQuarter(q),
    charge: 0,
    intents: [],
  }));
  for (const i of intents) {
    if (!STATUTS_ACTIFS.has(i.statut)) continue;
    const q = lireQuarterIntent(i);
    if (!q) continue;
    const b = buckets.find((x) => x.quarter.year === q.year && x.quarter.quarter === q.quarter);
    if (!b) continue;
    b.charge += 1;
    b.intents.push({ id: i.id, file: i.file || null, titre: i.titre || '', statut: i.statut });
  }
  for (const b of buckets) {
    b.capacite = capacite;
    b.ratio = capacite > 0 ? b.charge / capacite : 0;
    b.etat = etatTrimestre(b.charge, capacite);
  }
  const satures = buckets.filter((b) => b.etat === 'sature').length;
  const intentsActifsSansQuarter = intents.filter((i) => STATUTS_ACTIFS.has(i.statut) && !lireQuarterIntent(i)).length;
  return {
    capacite,
    capaciteSource: source,
    buckets,
    totaux: {
      satures,
      sansQuarter: intentsActifsSansQuarter,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const CAPACITY_CSS = `<style>
.cap-grid { display:grid; gap:.5rem; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin:.5rem 0; }
.cap-col { padding:.55rem .65rem; border:1px solid var(--border, #ddd); border-radius:.4rem; background:var(--card-bg, #fff); }
.cap-col-head { display:flex; justify-content:space-between; align-items:baseline; }
.cap-col-label { font-weight:600; font-size:.85rem; }
.cap-col-ratio { font-size:.72rem; color:var(--muted, #777); font-variant-numeric: tabular-nums; }
.cap-bar { height:.45rem; background:rgba(127,127,127,.12); border-radius:.2rem; margin:.3rem 0; overflow:hidden; }
.cap-bar-fill { height:100%; transition: width .3s; }
.cap-col.etat-sature { border-left:4px solid #c92a2a; background:rgba(201,42,42,.04); }
.cap-col.etat-sature .cap-bar-fill { background:#c92a2a; }
.cap-col.etat-plein { border-left:4px solid #e8590c; }
.cap-col.etat-plein .cap-bar-fill { background:#e8590c; }
.cap-col.etat-sain { border-left:4px solid #2b8a3e; }
.cap-col.etat-sain .cap-bar-fill { background:#2b8a3e; }
.cap-col.etat-sous-utilise { border-left:4px solid #868e96; }
.cap-col.etat-sous-utilise .cap-bar-fill { background:#868e96; }
.cap-intents { display:flex; flex-wrap:wrap; gap:.25rem; margin-top:.25rem; }
.cap-intent-chip { padding:.1rem .35rem; background:rgba(127,127,127,.06); border-radius:.2rem; font-size:.7rem; }
.cap-sans-quarter { padding:.5rem .65rem; background:rgba(232,89,12,.06); border-left:3px solid #e8590c; border-radius:.25rem; font-size:.85rem; margin:.5rem 0; }
</style>`;

function chipIntent(it) {
  const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
  return `<span class="cap-intent-chip" title="${escape(it.titre)} (${escape(it.statut)})">${idCell}</span>`;
}

export function blocCapacityPlanner(donnees) {
  const c = donnees?.capacityPlanner;
  if (!c) return '';
  const cols = c.buckets.map((b) => {
    const widthPct = Math.min(100, Math.round((b.ratio || 0) * 100));
    const chips = b.intents.slice(0, 8).map(chipIntent).join('');
    return `<div class="cap-col etat-${escape(b.etat)}">
      <div class="cap-col-head">
        <span class="cap-col-label">${escape(b.label)}</span>
        <span class="cap-col-ratio">${b.charge} / ${b.capacite}</span>
      </div>
      <div class="cap-bar"><div class="cap-bar-fill" style="width:${widthPct}%"></div></div>
      <div class="cap-intents">${chips || '<span class="muted" style="font-size:.7rem">vide</span>'}</div>
    </div>`;
  }).join('');
  const sansQ = c.totaux.sansQuarter > 0
    ? `<div class="cap-sans-quarter"><strong>${c.totaux.sansQuarter} Intent(s) actif(s) sans target défini</strong> — non pris en compte dans le calcul de capacité. Ajoute <code>target: Q3-2026</code> dans le frontmatter pour les inclure.</div>`
    : '';
  const t = c.totaux;
  return `${CAPACITY_CSS}<section>
    <h2>Capacité par trimestre <span class="count">capacité ${c.capacite} Intents/trim (${escape(c.capaciteSource)}) · ${t.satures} trim. saturé(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Charge planifiée vs. capacité équipe. État : <span class="badge badge-bad">Saturé</span> ≥ 100 % · <span class="badge badge-warn">Plein</span> 70-99 % · <span class="badge badge-ok">Sain</span> 40-69 % · <span class="badge badge-muted">Sous-utilisé</span> &lt; 40 %. Surcharger via frontmatter <code>team_capacity_per_quarter:</code> dans <code>.aiad/PRD.md</code>.</p>
    <div class="cap-grid">${cols}</div>
    ${sansQ}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  lireCapacite as readCapacity,
  etatTrimestre as quarterState,
  calculerCapacityPlanner as computeCapacityPlanner,
  blocCapacityPlanner as capacityPlannerSection,
};
export { CAPACITY_PAR_DEFAUT as DEFAULT_CAPACITY };
