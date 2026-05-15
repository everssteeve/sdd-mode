// AIAD SDD Mode — Dashboard : backlog refinement detector (#455).
//
// Détecte les Intents qui méritent une session de raffinement PM/PE :
//   - Intent `active` depuis ≥ 7j sans SPEC liée (signal "actif fantôme")
//   - Intent `draft` avec objectif lourd > 200 chars (signal "à découper")
//   - Intent bloqué actif (`bloqueActif` de #434) — chaîne à débloquer
//   - Intent sans target défini (`target` / `target_date` absent et statut
//     active) — promesse temporelle non formulée
//   - Intent sans Owner / Sponsor explicite (statut active/draft)
//
// Pour chaque signal, propose une **action concrète** copy-paste dans le
// PR ou la conversation de raffinement.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const JOUR_MS = 24 * 3600 * 1000;
const STATUTS_LIVRES = new Set(['done', 'archived']);

const RAISONS = {
  'spec-missing': { gravite: 'high', label: 'Active sans SPEC ≥ 7j', action: 'Lancer `/sdd spec` pour décomposer.' },
  'objectif-lourd': { gravite: 'medium', label: 'Objectif > 200 chars', action: 'Lancer `/sdd split` ou raffiner le scope.' },
  'bloque-actif': { gravite: 'medium', label: 'Bloqué par une dépendance ouverte', action: 'Discuter en standup, prioriser la dépendance.' },
  'no-target': { gravite: 'low', label: 'Aucun target déclaré', action: 'Ajouter `target: Q3-2026` ou `target_date: ...` dans le frontmatter.' },
  'no-owner': { gravite: 'low', label: 'Aucun owner / sponsor', action: 'Ajouter `owner:` et `sponsor:` dans le frontmatter.' },
};

function ageJours(intent, now) {
  if (!intent.mtime) return null;
  return Math.floor((now - intent.mtime) / JOUR_MS);
}

export function detecterRaisons(intent, ctx, now) {
  const raisons = [];
  if (STATUTS_LIVRES.has(intent.statut)) return raisons; // déjà livré → rien à raffiner
  // Active sans SPEC ≥ 7j
  if (intent.statut === 'active' || intent.statut === 'in-progress') {
    const specs = ctx?.specsParIntentId?.get(intent.id) || [];
    if (specs.length === 0 && ageJours(intent, now) != null && ageJours(intent, now) >= 7) {
      raisons.push('spec-missing');
    }
  }
  // Objectif lourd
  const obj = intent.sections?.objectif;
  if (obj && obj.length > 200) raisons.push('objectif-lourd');
  // Bloqué actif (via intentDeps de #434)
  const depsItem = ctx?.depsById?.get(intent.id);
  if (depsItem?.bloqueActif) raisons.push('bloque-actif');
  // No target
  if ((intent.statut === 'active' || intent.statut === 'in-progress')
    && !intent.target && !intent.target_date) raisons.push('no-target');
  // No owner / sponsor (sur draft ou active)
  if (['draft', 'active'].includes(intent.statut)) {
    const hasOwner = intent.owner || intent.pm || intent.owners || intent.assignee;
    const hasSponsor = intent.sponsor || intent.sponsors || intent.stakeholder;
    if (!hasOwner && !hasSponsor) raisons.push('no-owner');
  }
  return raisons;
}

export function calculerRefinement(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  // Index ctx (specs par intent + deps par intent)
  const specsParIntentId = new Map();
  const idsIntent = (donnees?.intents || []).map((i) => i.id);
  const courtVersLong = new Map();
  for (const id of idsIntent) {
    const court = id.split('-').slice(0, 2).join('-');
    if (!courtVersLong.has(court)) courtVersLong.set(court, id);
    specsParIntentId.set(id, []);
  }
  for (const s of donnees?.specs || []) {
    if (!s.parentIntent) continue;
    const court = s.parentIntent.split('-').slice(0, 2).join('-');
    const longId = courtVersLong.get(court);
    if (longId) specsParIntentId.get(longId).push(s);
  }
  const depsById = new Map((donnees?.intentDeps?.intents || []).map((d) => [d.id, d]));
  const ctx = { specsParIntentId, depsById };

  const items = [];
  for (const i of donnees?.intents || []) {
    const raisons = detecterRaisons(i, ctx, now);
    if (raisons.length === 0) continue;
    // Gravité agrégée = pire des gravités.
    const RANK = { high: 0, medium: 1, low: 2 };
    const pireRaison = raisons.reduce((acc, r) => {
      const g = RAISONS[r]?.gravite || 'low';
      return RANK[g] < RANK[acc] ? g : acc;
    }, 'low');
    items.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      raisons: raisons.map((r) => ({ key: r, ...RAISONS[r] })),
      pireGravite: pireRaison,
    });
  }
  // Tri par gravité puis nombre de raisons.
  const RANK = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => RANK[a.pireGravite] - RANK[b.pireGravite] || b.raisons.length - a.raisons.length);
  const totaux = {
    total: items.length,
    high: items.filter((i) => i.pireGravite === 'high').length,
    medium: items.filter((i) => i.pireGravite === 'medium').length,
    low: items.filter((i) => i.pireGravite === 'low').length,
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

function badgeGravite(g) {
  const map = {
    high: { cls: 'badge-bad', label: 'Haute' },
    medium: { cls: 'badge-warn', label: 'Moyenne' },
    low: { cls: 'badge-info', label: 'Faible' },
  };
  const v = map[g] || { cls: 'badge-muted', label: '?' };
  return `<span class="badge ${v.cls}">${escape(v.label)}</span>`;
}

const REF_CSS = `<style>
.refine-card { padding:.5rem .7rem; margin:.4rem 0; border:1px solid var(--border, #ddd); border-radius:.4rem; background:var(--card-bg, #fff); font-size:.85rem; }
.refine-card.gravite-high { border-left:4px solid #c92a2a; background:rgba(201,42,42,.04); }
.refine-card.gravite-medium { border-left:4px solid #e8590c; background:rgba(232,89,12,.04); }
.refine-card.gravite-low { border-left:4px solid #fab005; }
.refine-card-head { display:flex; align-items:baseline; gap:.5rem; flex-wrap:wrap; }
.refine-raisons { margin:.3rem 0 0; padding:0; list-style:none; display:grid; gap:.2rem; }
.refine-raisons li { padding:.2rem .4rem; background:rgba(127,127,127,.05); border-radius:.2rem; font-size:.78rem; }
.refine-raison-action { color: var(--muted, #777); font-size:.72rem; margin-top:.1rem; }
</style>`;

export function blocRefinement(donnees) {
  const r = donnees?.refinement;
  if (!r) return '';
  if (r.items.length === 0) {
    return `<section>
      <h2>À raffiner cette semaine <span class="count">✓ aucun signal</span></h2>
      <p class="muted">Tous les Intents du pipeline respectent les 5 critères de raffinement (SPEC liée, objectif &lt; 200 chars, pas bloqué, target défini, owner/sponsor explicite).</p>
    </section>`;
  }
  const cards = r.items.slice(0, 10).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const raisons = it.raisons.map((rs) => `<li>
      <strong>${badgeGravite(rs.gravite)} ${escape(rs.label)}</strong>
      <div class="refine-raison-action">→ ${escape(rs.action)}</div>
    </li>`).join('');
    return `<div class="refine-card gravite-${escape(it.pireGravite)}">
      <div class="refine-card-head">
        ${badgeGravite(it.pireGravite)}
        <strong>${idCell}</strong> — ${escape(it.titre)}
        <span class="muted">(${escape(it.statut || '?')})</span>
        <span class="muted" style="font-size:.7rem">${it.raisons.length} signal(s)</span>
      </div>
      <ul class="refine-raisons">${raisons}</ul>
    </div>`;
  }).join('');
  const t = r.totaux;
  return `${REF_CSS}<section>
    <h2>À raffiner cette semaine <span class="count">${t.total} Intent(s) — ${t.high} haute · ${t.medium} moyenne · ${t.low} faible</span></h2>
    <p class="muted" style="font-size:.85rem">Détection automatique des Intents qui méritent une session de raffinement (5 signaux : active sans SPEC ≥ 7j, objectif &gt; 200 chars, bloqué par dépendance, sans target, sans owner). Chaque ligne expose l'action concrète à mener.</p>
    ${cards}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  detecterRaisons as detectReasons,
  calculerRefinement as computeRefinement,
  blocRefinement as refinementSection,
  RAISONS as REFINEMENT_REASONS,
};
