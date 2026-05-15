// AIAD SDD Mode — Dashboard : suivi des hypothèses produit (#440).
//
// Chaque Intent porte (idéalement) une hypothèse business : « SI on
// implémente X, ALORS Y se produira parce que Z ». Ce module agrège les
// hypothèses déclarées via 2 sources :
//   (a) frontmatter `hypothesis:` / `hypothèse:` (string ou bloc) + statut
//       explicite `hypothesis_status: validated|invalidated|untested`
//   (b) heuristique : section `## HYPOTHÈSE` / `## Hypothesis` du body
//       Intent (équivalent à `## POURQUOI MAINTENANT` enrichi). Statut
//       par défaut : `untested`.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

import { extraireSection } from './collect.js';

const STATUTS_HYP = ['validated', 'invalidated', 'untested', 'partial'];

function lireStatut(intent) {
  const raw = intent?.hypothesis_status || intent?.hypothesisStatus || intent?.hypothese_status;
  if (!raw) return null;
  const s = String(raw).toLowerCase().trim();
  // Aliases FR → EN
  if (s === 'validé' || s === 'valide') return 'validated';
  if (s === 'invalidé' || s === 'invalide') return 'invalidated';
  if (s === 'non testée' || s === 'untested') return 'untested';
  if (s === 'partielle') return 'partial';
  return STATUTS_HYP.includes(s) ? s : null;
}

function lireHypothese(intent, body) {
  // Frontmatter prime.
  const front = intent?.hypothesis || intent?.hypothese || intent?.['hypothèse'] || intent?.Hypothesis;
  if (front != null) {
    if (typeof front === 'string' && front.trim()) {
      return { texte: front.trim(), source: 'frontmatter' };
    }
    if (typeof front === 'object' && front.text) {
      return { texte: String(front.text).trim(), source: 'frontmatter' };
    }
  }
  // Section body.
  if (body) {
    const sec = extraireSection(body, 'HYPOTHESE') || extraireSection(body, 'Hypothèse')
      || extraireSection(body, 'Hypothesis');
    if (sec) return { texte: sec, source: 'body' };
  }
  return null;
}

export function calculerHypotheses(donnees) {
  const out = [];
  for (const i of donnees?.intents || []) {
    // Le body n'est pas exposé directement sur l'Intent, mais les sections
    // POURQUOI/POUR QUI etc. le sont via `i.sections`. On utilise les
    // sections déjà parsées pour rechercher Hypothèse (fallback car
    // POURQUOI MAINTENANT contient souvent l'hypothèse implicite).
    const bodyApproxime = Object.values(i.sections || {}).filter(Boolean).join('\n\n## SEP\n\n');
    const hyp = lireHypothese(i, bodyApproxime);
    if (!hyp) continue;
    const statut = lireStatut(i) || 'untested';
    out.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statutIntent: i.statut,
      hypothese: hyp.texte,
      source: hyp.source,
      statut,
    });
  }
  // Tri : invalidated/partial d'abord (signaux à traiter), puis untested,
  // puis validated.
  const rank = { invalidated: 0, partial: 1, untested: 2, validated: 3 };
  out.sort((a, b) => (rank[a.statut] ?? 99) - (rank[b.statut] ?? 99));
  const totaux = { validated: 0, invalidated: 0, untested: 0, partial: 0 };
  for (const h of out) totaux[h.statut]++;
  return {
    hypotheses: out,
    totaux: { ...totaux, total: out.length },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

function badgeStatut(statut) {
  const map = {
    validated: { cls: 'badge-ok', label: 'Validée ✓' },
    invalidated: { cls: 'badge-bad', label: 'Invalidée ✗' },
    untested: { cls: 'badge-warn', label: 'Non testée' },
    partial: { cls: 'badge-info', label: 'Partielle' },
  };
  const v = map[statut] || { cls: 'badge-muted', label: '?' };
  return `<span class="badge ${v.cls}">${escape(v.label)}</span>`;
}

const HYP_CSS = `<style>
.hyp-card { padding:.55rem .75rem; margin:.4rem 0; border:1px solid var(--border, #ddd); border-radius:.4rem; background:var(--card-bg, #fff); font-size:.85rem; }
.hyp-card.statut-validated { border-left:4px solid #2b8a3e; }
.hyp-card.statut-invalidated { border-left:4px solid #c92a2a; background:rgba(201,42,42,.04); }
.hyp-card.statut-untested { border-left:4px solid #e8590c; }
.hyp-card.statut-partial { border-left:4px solid #4c6ef5; }
.hyp-card-head { display:flex; align-items:baseline; gap:.5rem; flex-wrap:wrap; }
.hyp-text { margin:.35rem 0 0; padding:.3rem .5rem; background:rgba(127,127,127,.04); border-radius:.2rem; font-size:.8rem; line-height:1.4; white-space:pre-wrap; }
.hyp-source { font-size:.7rem; color:var(--muted, #777); text-transform:uppercase; letter-spacing:.04em; }
</style>`;

export function blocHypotheses(donnees) {
  const h = donnees?.hypotheses;
  if (!h) return '';
  if (h.totaux.total === 0) {
    return `<section>
      <h2>Hypothèses produit <span class="count">aucune déclarée</span></h2>
      <p class="muted" style="font-size:.85rem">Aucun Intent ne déclare <code>hypothesis:</code> dans son frontmatter et aucun ne contient une section <code>## HYPOTHÈSE</code> dans son corps. Ajouter le champ pour rendre les hypothèses business traçables et validables.</p>
    </section>`;
  }
  const cards = h.hypotheses.slice(0, 12).map((hyp) => {
    const idCell = hyp.file ? lienSource(hyp.file, hyp.id) : `<code>${escape(hyp.id)}</code>`;
    return `<div class="hyp-card statut-${escape(hyp.statut)}">
      <div class="hyp-card-head">
        ${badgeStatut(hyp.statut)}
        <strong>${idCell}</strong> — ${escape(hyp.titre)}
        <span class="hyp-source">via ${escape(hyp.source)}</span>
      </div>
      <div class="hyp-text">${escape(hyp.hypothese)}</div>
    </div>`;
  }).join('');
  const t = h.totaux;
  return `${HYP_CSS}<section>
    <h2>Hypothèses produit <span class="count">${t.total} — ${t.validated} validée(s) · ${t.invalidated} invalidée(s) · ${t.untested + t.partial} à valider</span></h2>
    <p class="muted" style="font-size:.85rem">Hypothèses extraites du frontmatter <code>hypothesis:</code> (prioritaire) ou de la section <code>## HYPOTHÈSE</code> du corps Intent. Statut via <code>hypothesis_status: validated|invalidated|untested|partial</code> (FR/EN accepté).</p>
    ${cards}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerHypotheses as computeHypotheses,
  blocHypotheses as hypothesesSection,
};
