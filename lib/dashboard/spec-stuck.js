// AIAD SDD Mode — Dashboard : SPEC stuck-in-status detector (#513).
//
// Détecte les SPECs qui restent **bloquées dans le même statut**
// depuis trop longtemps. Plus large que `#507 review-queue` (qui ne
// couvre que review/validation) : ici on signale tout statut
// intermédiaire qui stagne anormalement.
//
// Seuils par statut (configurables) :
//   - draft         > 45j → stagne
//   - ready         > 30j → stagne
//   - in-progress   > 21j → stagne
//   - review        > 14j → stagne (cohérent avec #507)
//   - validation    > 14j → stagne
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const DAY = 24 * 3600 * 1000;

const SEUILS_JOURS = Object.freeze({
  draft: 45,
  ready: 30,
  'in-progress': 21,
  review: 14,
  validation: 14,
});

const STATUTS_NON_TERMINAUX = new Set(Object.keys(SEUILS_JOURS));

export function calculerSpecStuck(donnees, options = {}) {
  const now = options.now != null ? options.now : Date.now();
  const seuils = { ...SEUILS_JOURS, ...(options.seuils || {}) };
  const items = [];
  for (const s of donnees?.specs || []) {
    if (!STATUTS_NON_TERMINAUX.has(s.statut)) continue;
    if (!s.mtime) continue;
    const ageJours = Math.floor((now - s.mtime) / DAY);
    const seuil = seuils[s.statut];
    if (ageJours <= seuil) continue;
    items.push({
      id: s.id,
      titre: s.titre || '',
      file: s.file || null,
      statut: s.statut,
      parentIntent: s.parentIntent || null,
      mtime: s.mtime,
      ageJours,
      seuil,
      depassement: ageJours - seuil,
    });
  }
  items.sort((a, b) => b.depassement - a.depassement);
  const parStatut = {};
  for (const it of items) {
    parStatut[it.statut] = (parStatut[it.statut] || 0) + 1;
  }
  return {
    items,
    totaux: {
      total: items.length,
      parStatut,
    },
    seuils,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const SS_CSS = `<style>
.ss-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.ss-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.ss-stat .ss-val { font-size:1.2rem; font-weight:700; }
.ss-stat .ss-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.ss-stat.s-draft { background:rgba(127,127,127,.06); }
.ss-stat.s-ready { background:rgba(76,110,245,.05); }
.ss-stat.s-in-progress { background:rgba(232,89,12,.05); }
.ss-stat.s-review, .ss-stat.s-validation { background:rgba(201,42,42,.06); }
.ss-row { padding:.35rem .5rem; margin:.2rem 0; font-size:.82rem; background:rgba(127,127,127,.04); border-radius:.25rem; display:flex; gap:.5rem; flex-wrap:wrap; align-items:baseline; border-left:3px solid #e8590c; }
.ss-row.high-depassement { border-left-color:#c92a2a; background:rgba(201,42,42,.04); }
.ss-meta { font-size:.74rem; color:var(--muted, #777); }
.ss-empty { padding:.5rem .7rem; background:rgba(43,138,62,.06); border-left:3px solid #2b8a3e; border-radius:.25rem; font-size:.85rem; color:#1c5a2a; }
</style>`;

export function blocSpecStuck(donnees) {
  const s = donnees?.specStuck;
  if (!s) return '';
  if (s.items.length === 0) {
    return `${SS_CSS}<section>
      <h2>SPECs bloquées <span class="count">aucune SPEC stagnante</span></h2>
      <div class="ss-empty">✓ Aucune SPEC n'a dépassé le seuil de stagnation par statut (draft 45j / ready 30j / in-progress 21j / review-validation 14j). Pipeline en mouvement.</div>
    </section>`;
  }
  const t = s.totaux;
  const stats = Object.entries(t.parStatut)
    .sort((a, b) => b[1] - a[1])
    .map(([statut, n]) => `<div class="ss-stat s-${escape(statut)}">
      <div class="ss-val">${n}</div>
      <div class="ss-label">${escape(statut)} > ${s.seuils[statut]}j</div>
    </div>`).join('');
  const rows = s.items.slice(0, 20).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const parent = it.parentIntent ? `<span class="ss-meta">parent <code>${escape(it.parentIntent)}</code></span>` : '';
    const cls = it.depassement > it.seuil ? 'high-depassement' : '';
    return `<div class="ss-row ${cls}">
      <strong>${idCell}</strong>
      <span>${escape((it.titre || '').slice(0, 56))}</span>
      <span class="ss-meta">[${escape(it.statut)}]</span>
      ${parent}
      <span class="ss-meta"><strong>${it.ageJours}j</strong> en statut (seuil ${it.seuil}j · dépassement +${it.depassement}j)</span>
    </div>`;
  }).join('');
  return `${SS_CSS}<section>
    <h2>SPECs bloquées <span class="count">${t.total} SPEC(s) stagnante(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Détecte les SPECs qui restent dans le même statut anormalement longtemps. Seuils par statut : draft 45j, ready 30j, in-progress 21j, review/validation 14j. Tri par dépassement desc.</p>
    <div class="ss-grid">${stats}</div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerSpecStuck as computeSpecStuck,
  blocSpecStuck as specStuckSection,
  SEUILS_JOURS as STUCK_THRESHOLDS,
};
