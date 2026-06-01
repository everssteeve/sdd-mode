// AIAD SDD Mode — Dashboard : backlog health score composite (#561).
//
// Score composite final synthétisant l'état global du backlog en
// agrégeant les modules existants. /100 sur 10 dimensions × 10 pts :
//   1. Freshness — backlog-freshness #471 frais ≥ 50 %
//   2. Hygiene — backlog-hygiene #503 total ≤ 3
//   3. Outcomes — outcome-completion #530 moyen ≥ 50 %
//   4. Risks — risk-transparency #531 score ≥ 75 %
//   5. Decisions — decision-velocity #490 pas d'inertie
//   6. Hypotheses — hypothesis-lifecycle #498 stagnantes = 0
//   7. Annotations — spec-annotation-coverage #536 ≥ 50 %
//   8. Velocity — velocity-sla #527 tenu ou proche
//   9. Maturity — intent-maturity #486 ≥ 70 %
//   10. Alignment — goal-alignment #526 ≥ 50 % aligné
//
// Pure transformation (agrégation).

function safeNum(v) {
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function calculerBacklogHealthScore(donnees) {
  const checks = [];
  // 1. Freshness
  const freshness = donnees?.backlogFreshness?.totaux;
  let okFreshness = false;
  if (freshness) {
    const total = (freshness.frais || 0) + (freshness.tiede || 0) + (freshness.stale || 0) + (freshness.abandonne || 0);
    okFreshness = total > 0 && (freshness.frais || 0) / total >= 0.5;
  }
  checks.push({ id: 'freshness', label: 'Freshness ≥ 50 % frais', ok: okFreshness });
  // 2. Hygiene
  const hygiene = donnees?.backlogHygiene?.totaux;
  checks.push({ id: 'hygiene', label: 'Hygiene total ≤ 3', ok: hygiene && hygiene.total <= 3 });
  // 3. Outcomes
  const oc = donnees?.outcomeCompletion?.totaux;
  checks.push({ id: 'outcomes', label: 'Outcomes moyenne ≥ 50 %', ok: oc && oc.pctMoyen != null && oc.pctMoyen >= 50 });
  // 4. Risks
  const rt = donnees?.riskTransparency?.totaux;
  checks.push({ id: 'risks', label: 'Risques transparency ≥ 75 %', ok: rt && rt.score != null && rt.score >= 75 });
  // 5. Decisions
  const dv = donnees?.decisionVelocity;
  checks.push({ id: 'decisions', label: 'Pas d\'inertie décisions', ok: dv && !dv.inertie });
  // 6. Hypotheses
  const hl = donnees?.hypothesisLifecycle;
  checks.push({ id: 'hypotheses', label: 'Pas d\'hypothèses stagnantes', ok: hl && hl.stagnantes === 0 });
  // 7. Annotations
  const sac = donnees?.specAnnotationCoverage?.totaux;
  checks.push({ id: 'annotations', label: 'Annotations score ≥ 50 %', ok: sac && sac.scoreMoyen >= 50 });
  // 8. Velocity SLA
  const sla = donnees?.velocitySla;
  checks.push({ id: 'velocity', label: 'Vélocité tenue ou proche', ok: sla && (sla.etat === 'tenu' || sla.etat === 'proche') });
  // 9. Maturity
  const m = donnees?.intentMaturity?.items;
  let okMat = false;
  if (m && m.length > 0) {
    const moyen = m.reduce((s, x) => s + x.score, 0) / m.length;
    okMat = moyen >= 70;
  }
  checks.push({ id: 'maturity', label: 'Maturité Intents ≥ 70/100', ok: okMat });
  // 10. Alignment
  const ga = donnees?.goalAlignment;
  let okAlign = false;
  if (ga && ga.items && ga.items.length > 0) {
    const aligne = ga.totaux?.aligne || 0;
    okAlign = aligne / ga.items.length >= 0.5;
  }
  checks.push({ id: 'alignment', label: 'Alignement NS ≥ 50 %', ok: okAlign });
  const score = checks.filter((c) => c.ok).length * 10;
  let etat;
  if (score >= 80) etat = 'excellent';
  else if (score >= 60) etat = 'bon';
  else if (score >= 40) etat = 'partiel';
  else if (score >= 20) etat = 'faible';
  else etat = 'critique';
  return { score, etat, checks };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape } from './render.js';

const BH_CSS = `<style>
.bh-hero { padding:.7rem .85rem; border-radius:.4rem; margin:.3rem 0; }
.bh-hero.e-excellent { background:rgba(43,138,62,.08); border-left:4px solid #2b8a3e; }
.bh-hero.e-bon { background:rgba(43,138,62,.05); border-left:4px solid #3a9c4f; }
.bh-hero.e-partiel { background:rgba(245,166,35,.06); border-left:4px solid #f5a623; }
.bh-hero.e-faible { background:rgba(232,89,12,.06); border-left:4px solid #e8590c; }
.bh-hero.e-critique { background:rgba(201,42,42,.07); border-left:4px solid #c92a2a; }
.bh-score-big { font-size:2rem; font-weight:700; }
.bh-bar { width:100%; height:14px; background:rgba(127,127,127,.15); border-radius:7px; overflow:hidden; margin:.3rem 0; }
.bh-fill { height:100%; transition:width .15s; }
.bh-fill.e-excellent { background:#2b8a3e; }
.bh-fill.e-bon { background:#3a9c4f; }
.bh-fill.e-partiel { background:#f5a623; }
.bh-fill.e-faible { background:#e8590c; }
.bh-fill.e-critique { background:#c92a2a; }
.bh-checks { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:.3rem; margin:.4rem 0; }
.bh-check { padding:.3rem .45rem; border-radius:.22rem; font-size:.78rem; display:flex; gap:.4rem; align-items:baseline; background:rgba(127,127,127,.04); }
.bh-check.ok { background:rgba(43,138,62,.08); }
.bh-check.ko { background:rgba(201,42,42,.05); }
.bh-icon.ok { color:#2b8a3e; font-weight:700; }
.bh-icon.ko { color:#c92a2a; font-weight:700; }
</style>`;

const LABELS_ETAT = {
  excellent: '✓ Excellent (≥ 80)',
  bon: '◐ Bon (60-79)',
  partiel: '⚠ Partiel (40-59)',
  faible: '⛔ Faible (20-39)',
  critique: '⛔ Critique (< 20)',
};

export function blocBacklogHealthScore(donnees) {
  const h = donnees?.backlogHealthScore;
  if (!h) return '';
  return `${BH_CSS}<section>
    <h2>Score santé backlog <span class="count">composite 10 dimensions</span></h2>
    <p class="muted" style="font-size:.85rem">Score composite /100 agrégeant 10 modules-clés (freshness, hygiene, outcomes, risques, décisions, hypothèses, annotations, vélocité, maturité, alignement). 10 pts par dimension réussie.</p>
    <div class="bh-hero e-${escape(h.etat)}">
      <div class="bh-score-big">${h.score}/100 — ${escape(LABELS_ETAT[h.etat] || h.etat)}</div>
      <div class="bh-bar"><div class="bh-fill e-${escape(h.etat)}" style="width:${h.score}%"></div></div>
    </div>
    <div class="bh-checks">
      ${h.checks.map((c) => `<div class="bh-check ${c.ok ? 'ok' : 'ko'}"><span class="bh-icon ${c.ok ? 'ok' : 'ko'}">${c.ok ? '✓' : '✗'}</span><span>${escape(c.label)}</span></div>`).join('')}
    </div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerBacklogHealthScore as computeBacklogHealthScore,
  blocBacklogHealthScore as backlogHealthScoreSection,
};
