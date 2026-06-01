// AIAD SDD Mode — Dashboard : SPEC quality score (#554).
//
// Score composite de qualité par SPEC sur 5 dimensions :
//   1. SQS déclaré (≥ 4/5) — frontmatter `sqs:`
//   2. T-shirt size ≤ M (#525) — pas XL
//   3. ≥ 1 critère d'acceptation (#543) — sectionAC / EARS / checkboxes
//   4. ≥ 1 annotation v1.10 (#536)
//   5. Statut non-terminal stable (pas stuck)
//
// Score /5 + état (excellent ≥ 4 / bon ≥ 3 / partiel ≥ 2 / faible < 2).
//
// Pure transformation (réutilise les calculs des modules précédents).

function compterTag(texte, tag) {
  if (!texte) return 0;
  const regex = new RegExp('(^|\\s)' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  return (texte.match(regex) || []).length;
}

function calculerScoresSpec(spec, donnees) {
  let score = 0;
  const checks = {};
  // 1. SQS
  const sqs = Number(spec?.sqs);
  checks.sqs = !isNaN(sqs) && sqs >= 4 ? { ok: true, valeur: sqs } : { ok: false, valeur: isNaN(sqs) ? null : sqs };
  if (checks.sqs.ok) score++;
  // 2. T-shirt size (depuis #525 specScope)
  const scopeItem = (donnees?.specScope?.items || []).find((i) => i.id === spec.id);
  const taille = scopeItem?.taille || null;
  checks.taille = taille && taille !== 'XL' ? { ok: true, valeur: taille } : { ok: false, valeur: taille };
  if (checks.taille.ok) score++;
  // 3. Critères d'acceptation (depuis #543)
  const acItem = (donnees?.acceptanceCriteria?.items || []).find((i) => i.id === spec.id);
  checks.ac = acItem && acItem.total > 0 ? { ok: true, valeur: acItem.total } : { ok: false, valeur: 0 };
  if (checks.ac.ok) score++;
  // 4. Annotations v1.10 (depuis #536)
  const annoItem = (donnees?.specAnnotationCoverage?.items || []).find((i) => i.id === spec.id);
  checks.anno = annoItem && annoItem.nbTags > 0 ? { ok: true, valeur: annoItem.nbTags } : { ok: false, valeur: 0 };
  if (checks.anno.ok) score++;
  // 5. Stable (pas stuck depuis #513)
  const stuckItem = (donnees?.specStuck?.items || []).find((i) => i.id === spec.id);
  checks.stable = !stuckItem ? { ok: true, valeur: 'stable' } : { ok: false, valeur: 'stuck' };
  if (checks.stable.ok) score++;
  let etat;
  if (score >= 4) etat = 'excellent';
  else if (score >= 3) etat = 'bon';
  else if (score >= 2) etat = 'partiel';
  else etat = 'faible';
  return { score, etat, checks };
}

export function calculerSpecQualityScore(donnees) {
  const items = [];
  for (const s of donnees?.specs || []) {
    if (['done', 'archived'].includes(s.statut)) continue;
    const sc = calculerScoresSpec(s, donnees);
    items.push({
      id: s.id,
      titre: s.titre || '',
      file: s.file || null,
      statut: s.statut,
      ...sc,
    });
  }
  items.sort((a, b) => a.score - b.score);
  const totaux = {
    total: items.length,
    excellent: items.filter((i) => i.etat === 'excellent').length,
    bon: items.filter((i) => i.etat === 'bon').length,
    partiel: items.filter((i) => i.etat === 'partiel').length,
    faible: items.filter((i) => i.etat === 'faible').length,
    scoreMoyen: items.length === 0 ? 0
      : Math.round((items.reduce((s, x) => s + x.score, 0) / items.length) * 10) / 10,
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const SQ_CSS = `<style>
.sq-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:.4rem; margin:.4rem 0; }
.sq-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.sq-stat .sq-val { font-size:1.2rem; font-weight:700; }
.sq-stat .sq-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.sq-stat.e-excellent { background:rgba(43,138,62,.07); border-color:rgba(43,138,62,.3); }
.sq-stat.e-bon { background:rgba(76,110,245,.05); border-color:rgba(76,110,245,.3); }
.sq-stat.e-partiel { background:rgba(245,166,35,.05); border-color:rgba(245,166,35,.3); }
.sq-stat.e-faible { background:rgba(201,42,42,.06); border-color:rgba(201,42,42,.3); }
.sq-row { padding:.35rem .5rem; margin:.15rem 0; font-size:.82rem; background:rgba(127,127,127,.04); border-radius:.22rem; display:flex; gap:.4rem; align-items:baseline; flex-wrap:wrap; }
.sq-row.r-excellent { border-left:3px solid #2b8a3e; }
.sq-row.r-bon { border-left:3px solid #4c6ef5; }
.sq-row.r-partiel { border-left:3px solid #f5a623; }
.sq-row.r-faible { border-left:3px solid #c92a2a; background:rgba(201,42,42,.04); }
.sq-checks { display:flex; gap:.2rem; }
.sq-check { padding:.05rem .3rem; border-radius:.15rem; font-size:.7rem; }
.sq-check.ok { background:rgba(43,138,62,.15); color:#1c5a2a; }
.sq-check.ko { background:rgba(201,42,42,.12); color:#7a1717; }
.sq-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

const LABELS = {
  excellent: '✓ Excellent (4-5)',
  bon: '◐ Bon (3)',
  partiel: '⚠ Partiel (2)',
  faible: '⛔ Faible (< 2)',
};

const CHECK_LABELS = { sqs: 'SQS≥4', taille: 'taille≤M', ac: 'AC', anno: 'anno', stable: 'stable' };

export function blocSpecQualityScore(donnees) {
  const q = donnees?.specQualityScore;
  if (!q) return '';
  if (q.items.length === 0) {
    return `${SQ_CSS}<section>
      <h2>Score qualité SPEC <span class="count">aucune SPEC non-terminale</span></h2>
      <div class="sq-empty">Score composite par SPEC sur 5 dimensions (SQS≥4 / taille≤M / ≥1 AC / ≥1 annotation v1.10 / pas stuck). Permet d'identifier les SPECs faibles avant <code>/sdd exec</code>.</div>
    </section>`;
  }
  const t = q.totaux;
  const grid = ['excellent', 'bon', 'partiel', 'faible'].map((etat) => `<div class="sq-stat e-${etat}">
      <div class="sq-val">${t[etat]}</div>
      <div class="sq-label">${escape(LABELS[etat])}</div>
    </div>`).join('');
  const rows = q.items.slice(0, 15).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const checks = ['sqs', 'taille', 'ac', 'anno', 'stable'].map((k) => `<span class="sq-check ${it.checks[k].ok ? 'ok' : 'ko'}">${escape(CHECK_LABELS[k])}</span>`).join('');
    return `<div class="sq-row r-${escape(it.etat)}">
      <strong>${idCell}</strong>
      <span>${escape((it.titre || '').slice(0, 35))}</span>
      <span class="muted">[${escape(it.statut)}]</span>
      <strong>${it.score}/5</strong>
      <span class="sq-checks">${checks}</span>
    </div>`;
  }).join('');
  return `${SQ_CSS}<section>
    <h2>Score qualité SPEC <span class="count">${t.total} SPECs · score moyen ${t.scoreMoyen}/5</span></h2>
    <p class="muted" style="font-size:.85rem">Score composite /5 par SPEC sur 5 dimensions : SQS ≥ 4, taille ≤ M (pas XL #525), ≥ 1 critère acceptation (#543), ≥ 1 annotation v1.10 (#536), stable (pas stuck #513). Identifie les SPECs à raffiner avant exec.</p>
    <div class="sq-grid">${grid}</div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerSpecQualityScore as computeSpecQualityScore,
  blocSpecQualityScore as specQualityScoreSection,
};
