// AIAD SDD Mode — Dashboard : fil "Activité rituelle" (#142 + #217).
//
// Agrège chronologiquement les rituels AIAD (standup / demo / retro /
// sync-strat / tech-review) à partir des fichiers déjà collectés par
// `lireMetrics`. L'objectif est de donner au PM/manager un fil narratif
// sur l'index :
//   "Standup 13/05 — 3 SPECs en cours, 1 blocker"
//   "Demo 11/05 — 4 SPECs présentées"
//   "Retro 10/05 — 2 LL ajoutées"
//   "Tech Review 09/05 — 2 ADRs proposés, 3 décisions techniques"
//
// Pure : consomme `donnees.metrics.categories` (déjà parsé), produit un
// tableau JSON-sérialisable. Aucun fichier nouveau, aucun parsing
// supplémentaire — réutilise tout ce que `lireMetricsCategorie` produit.

const RITUELS = {
  standup: {
    titre: 'Standup',
    resume: (d) => {
      const wip = d.wip ?? d.WIP ?? null;
      const block = d.blockers ?? d.Blockers ?? null;
      const parts = [];
      if (wip !== null) parts.push(`${wip} SPEC(s) en cours`);
      if (block !== null && block > 0) parts.push(`${block} blocker(s)`);
      return parts.length ? parts.join(' · ') : 'rituel enregistré';
    },
  },
  demo: {
    titre: 'Demo',
    resume: (d) => {
      const specs = d.specs_presentees ?? d.specs ?? d.SPECs ?? null;
      const feedback = d.feedback_count ?? d.feedback ?? null;
      const parts = [];
      if (specs !== null) parts.push(`${specs} SPEC(s) présentée(s)`);
      if (feedback !== null) parts.push(`${feedback} feedback(s)`);
      return parts.length ? parts.join(' · ') : 'rituel enregistré';
    },
  },
  retro: {
    titre: 'Rétro',
    resume: (d) => {
      const ll = d.lessons_learned ?? d.LL ?? d.learnings ?? null;
      const actions = d.actions ?? null;
      const parts = [];
      if (ll !== null) parts.push(`${ll} LL ajoutée(s)`);
      if (actions !== null) parts.push(`${actions} action(s)`);
      return parts.length ? parts.join(' · ') : 'rituel enregistré';
    },
  },
  'sync-strat': {
    titre: 'Sync stratégique',
    resume: (d) => {
      const dec = d.decisions ?? d.Decisions ?? null;
      const parts = [];
      if (dec !== null) parts.push(`${dec} décision(s)`);
      return parts.length ? parts.join(' · ') : 'rituel enregistré';
    },
  },
  // (#217) Tech Review — rituel hebdomadaire/bi-hebdomadaire des Tech Leads.
  // Métriques typiques : ADRs proposés, décisions techniques prises, drifts
  // architecture discutés. Aligné DASHBOARD-AUDIT.md ligne 149.
  'tech-review': {
    titre: 'Tech Review',
    resume: (d) => {
      const adrs = d.adrs_proposes ?? d.ADRs ?? d.adrs ?? null;
      const decisions = d.decisions_techniques ?? d.decisions ?? null;
      const drifts = d.drifts_discutes ?? d.drifts ?? null;
      const parts = [];
      if (adrs !== null) parts.push(`${adrs} ADR(s) proposé(s)`);
      if (decisions !== null) parts.push(`${decisions} décision(s) technique(s)`);
      if (drifts !== null) parts.push(`${drifts} drift(s) discuté(s)`);
      return parts.length ? parts.join(' · ') : 'rituel enregistré';
    },
  },
};

/**
 * @param {object} donnees - résultat de `collecterDonnees`
 * @param {{limit?: number}} [opts]
 * @returns {Array<{type, titre, date, resume, file}>}
 */
export function lireRituels(donnees, opts = {}) {
  const limit = opts.limit ?? 5;
  const cats = donnees?.metrics?.categories || {};
  const out = [];
  for (const [key, cfg] of Object.entries(RITUELS)) {
    const cat = cats[key];
    if (!cat?.fichiers?.length) continue;
    for (const f of cat.fichiers) {
      out.push({
        type: key,
        titre: cfg.titre,
        date: f.mtime, // timestamp ms
        resume: cfg.resume(f.data || {}),
        file: f.file,
        nom: f.nom,
      });
    }
  }
  // Tri descendant (plus récent en premier)
  out.sort((a, b) => (b.date || 0) - (a.date || 0));
  return out.slice(0, limit);
}

// ─── Rendu HTML ─────────────────────────────────────────────────────────────

import { escape } from './render.js';

export function blocRituels(donnees) {
  const items = lireRituels(donnees);
  if (items.length === 0) return '';
  const rows = items.map((r) => {
    const d = new Date(r.date);
    const dateLisible = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    return `<li style="margin-bottom:.5rem">
      <span class="muted" style="display:inline-block;min-width:3.5rem">${escape(dateLisible)}</span>
      <strong>${escape(r.titre)}</strong>
      <span class="muted">·</span>
      ${escape(r.resume)}
    </li>`;
  }).join('');
  return `
<section>
  <h2>Activité rituelle <span class="count">${items.length} dernier(s) rituel(s)</span></h2>
  <ul style="list-style:none;padding-left:0">${rows}</ul>
</section>`;
}

// Alias EN
export { lireRituels as readRituels, blocRituels as ritualsBlock };
