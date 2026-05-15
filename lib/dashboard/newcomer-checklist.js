// AIAD SDD Mode — Dashboard : newcomer onboarding reading list (#549).
//
// Génère une **reading list ordonnée** pour un nouvel arrivant qui
// rejoint le projet : du PRD aux Intents actifs P0/P1, en passant par
// l'ARCHITECTURE et les facts récents.
//
// Pure transformation.

const PRANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

function poidsPrio(p) {
  if (!p) return 99;
  return PRANK[String(p).toUpperCase()] ?? 99;
}

export function calculerNewcomerChecklist(donnees) {
  const intents = donnees?.intents || [];
  const specs = donnees?.specs || [];
  const items = [];
  // 1. Cadrage (PRD/ARCHITECTURE/AGENT-GUIDE)
  items.push({ ordre: 1, type: 'cadrage', label: 'Lire le PRD complet', cible: '.aiad/PRD.md', minutes: 15, priorite: 'incontournable' });
  items.push({ ordre: 2, type: 'cadrage', label: 'Lire ARCHITECTURE.md', cible: '.aiad/ARCHITECTURE.md', minutes: 10, priorite: 'incontournable' });
  items.push({ ordre: 3, type: 'cadrage', label: 'Lire AGENT-GUIDE.md', cible: '.aiad/AGENT-GUIDE.md', minutes: 5, priorite: 'incontournable' });
  // 2. Top 3 Intents actifs P0/P1
  const intentsActifs = intents.filter((i) => (i.statut === 'active' || i.statut === 'in-progress')).sort((a, b) => poidsPrio(a.priority) - poidsPrio(b.priority)).slice(0, 5);
  for (const i of intentsActifs) {
    items.push({
      ordre: items.length + 1,
      type: 'intent',
      label: `${i.id}${i.titre ? ' — ' + i.titre : ''}`,
      cible: i.file || null,
      minutes: 5,
      priorite: poidsPrio(i.priority) <= 1 ? 'incontournable' : 'recommande',
      meta: i.priority ? `[${String(i.priority).toUpperCase()}]` : '',
    });
  }
  // 3. SPECs en cours (review/validation) avec lien parent
  const specsEnCours = specs.filter((s) => s.statut === 'review' || s.statut === 'validation' || s.statut === 'in-progress').slice(0, 4);
  for (const s of specsEnCours) {
    items.push({
      ordre: items.length + 1,
      type: 'spec',
      label: `${s.id}${s.titre ? ' — ' + s.titre : ''}`,
      cible: s.file || null,
      minutes: 4,
      priorite: 'recommande',
      meta: `[${s.statut}]`,
    });
  }
  // 4. Gouvernance Tier 1 si Intents IA ou RGPD
  const aIaAct = (donnees?.aiActCompliance?.totaux?.total || 0) > 0;
  items.push({
    ordre: items.length + 1,
    type: 'gouvernance',
    label: 'Lire les 4 agents Tier 1 (AI-ACT / RGPD / RGAA / RGESN)',
    cible: '.aiad/gouvernance/',
    minutes: aIaAct ? 15 : 10,
    priorite: aIaAct ? 'incontournable' : 'recommande',
  });
  // 5. Cheatsheet commandes
  items.push({
    ordre: items.length + 1,
    type: 'reference',
    label: 'Mémo commandes /sdd et /aiad',
    cible: '#commandes-pm-copy-paste',
    minutes: 3,
    priorite: 'recommande',
  });
  const totalMin = items.reduce((s, x) => s + x.minutes, 0);
  return {
    items,
    totalMinutes: totalMin,
    totaux: {
      total: items.length,
      incontournables: items.filter((i) => i.priorite === 'incontournable').length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const NC_CSS = `<style>
.nc-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.nc-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.nc-stat .nc-val { font-size:1.2rem; font-weight:700; }
.nc-stat .nc-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.nc-list { list-style:none; padding:0; margin:.3rem 0; }
.nc-item { padding:.4rem .55rem; margin:.2rem 0; border-radius:.3rem; background:rgba(127,127,127,.04); display:flex; gap:.5rem; align-items:baseline; flex-wrap:wrap; border-left:3px solid var(--accent, #4c6ef5); }
.nc-item.t-cadrage { border-left-color:#c92a2a; background:rgba(201,42,42,.04); }
.nc-item.t-gouvernance { border-left-color:#e8590c; background:rgba(232,89,12,.04); }
.nc-item.t-intent { border-left-color:#2b8a3e; }
.nc-item.t-spec { border-left-color:#4c6ef5; }
.nc-item.t-reference { border-left-color:rgba(127,127,127,.4); }
.nc-num { font-weight:600; padding:.05rem .3rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.75rem; }
.nc-priorite { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.7rem; }
.nc-priorite.incontournable { background:rgba(201,42,42,.12); color:#7a1717; }
.nc-priorite.recommande { background:rgba(76,110,245,.12); color:#3a4cba; }
.nc-meta { font-size:.74rem; color:var(--muted, #777); }
</style>`;

export function blocNewcomerChecklist(donnees) {
  const c = donnees?.newcomerChecklist;
  if (!c) return '';
  const t = c.totaux;
  const grid = [
    `<div class="nc-stat"><div class="nc-val">${t.total}</div><div class="nc-label">Items</div></div>`,
    `<div class="nc-stat"><div class="nc-val">${t.incontournables}</div><div class="nc-label">Incontournables</div></div>`,
    `<div class="nc-stat"><div class="nc-val">~${c.totalMinutes}min</div><div class="nc-label">Lecture totale</div></div>`,
  ].join('');
  const li = c.items.map((it) => {
    let cible = '';
    if (it.cible && it.cible.startsWith('.aiad/')) cible = `<code>${escape(it.cible)}</code>`;
    else if (it.cible && it.cible.startsWith('#')) cible = `<a href="${escape(it.cible)}">section interne</a>`;
    else if (it.cible) cible = it.type === 'intent' || it.type === 'spec' ? lienSource(it.cible, '↗') : `<code>${escape(it.cible)}</code>`;
    return `<li class="nc-item t-${escape(it.type)}">
      <span class="nc-num">#${it.ordre}</span>
      <span>${escape(it.label)}</span>
      <span class="nc-priorite ${escape(it.priorite)}">${escape(it.priorite)}</span>
      <span class="nc-meta">${escape(it.meta || '')} · ~${it.minutes} min ${cible}</span>
    </li>`;
  }).join('');
  return `${NC_CSS}<section>
    <h2>Onboarding nouveau membre <span class="count">${t.total} items · ~${c.totalMinutes} min</span></h2>
    <p class="muted" style="font-size:.85rem">Reading list ordonnée pour un nouvel arrivant : cadrage PRD/ARCHITECTURE/AGENT-GUIDE, top Intents actifs P0-P1, SPECs en cours, gouvernance Tier 1 si pertinent, cheatsheet commandes. Marqué <strong>incontournable</strong> ou <strong>recommandé</strong>.</p>
    <div class="nc-grid">${grid}</div>
    <ol class="nc-list">${li}</ol>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerNewcomerChecklist as computeNewcomerChecklist,
  blocNewcomerChecklist as newcomerChecklistSection,
};
