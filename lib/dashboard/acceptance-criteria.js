// AIAD SDD Mode — Dashboard : acceptance criteria extractor (#543).
//
// Extrait pour chaque SPEC les **critères d'acceptation** identifiés
// via patterns :
//   - Bullets sous `## Critères d'acceptation` / `## Acceptance criteria`
//   - Bullets EARS (`WHEN/IF/WHILE/WHERE … SHALL …`)
//   - Checkboxes `- [ ]` / `- [x]` (peu importe section)
//
// Permet au PM de voir combien chaque SPEC porte de critères testables.
//
// Pure transformation.

const SEC_AC_PAT = /^##\s+(critères?\s*d.acceptation|acceptance\s*criteria|critères?\s*acceptance)/i;
const SEC_ANY = /^##\s+/;
const EARS_PAT = /\b(WHEN|IF|WHILE|WHERE)\b.+\bSHALL\b/i;
const CHECKBOX_PAT = /^\s*[-*]\s+\[\s*([ xX])\s*\]\s+/;
const BULLET_PAT = /^\s*[-*]\s+/;

export function extraireCriteres(texte) {
  if (!texte || typeof texte !== 'string') return { sectionAC: [], ears: [], checkboxes: { total: 0, faits: 0 } };
  const lignes = texte.split(/\r?\n/);
  const sectionAC = [];
  const ears = [];
  let dansAC = false;
  let checkboxesTotal = 0;
  let checkboxesFaits = 0;
  for (const l of lignes) {
    if (SEC_AC_PAT.test(l)) { dansAC = true; continue; }
    if (SEC_ANY.test(l) && !SEC_AC_PAT.test(l)) { dansAC = false; }
    if (dansAC && BULLET_PAT.test(l)) {
      sectionAC.push(l.replace(BULLET_PAT, '').trim());
    }
    if (EARS_PAT.test(l)) {
      ears.push(l.trim());
    }
    const cb = l.match(CHECKBOX_PAT);
    if (cb) {
      checkboxesTotal++;
      if (cb[1].toLowerCase() === 'x') checkboxesFaits++;
    }
  }
  return { sectionAC, ears, checkboxes: { total: checkboxesTotal, faits: checkboxesFaits } };
}

export function calculerAcceptanceCriteria(donnees) {
  const items = [];
  for (const s of donnees?.specs || []) {
    let texte = '';
    if (typeof s.body === 'string') texte = s.body;
    else if (typeof s.contenu === 'string') texte = s.contenu;
    if (!texte) continue;
    const ext = extraireCriteres(texte);
    const totalAC = ext.sectionAC.length + ext.ears.length + ext.checkboxes.total;
    if (totalAC === 0 && ext.checkboxes.total === 0) continue;
    items.push({
      id: s.id,
      titre: s.titre || '',
      file: s.file || null,
      statut: s.statut,
      sectionAC: ext.sectionAC.length,
      ears: ext.ears.length,
      checkboxes: ext.checkboxes,
      total: totalAC,
      progression: ext.checkboxes.total === 0 ? null
        : Math.round((ext.checkboxes.faits / ext.checkboxes.total) * 100),
    });
  }
  items.sort((a, b) => b.total - a.total);
  const totaux = {
    specsAvecAC: items.length,
    totalSpecs: (donnees?.specs || []).length,
    sansAC: (donnees?.specs || []).length - items.length,
    totalCriteres: items.reduce((s, x) => s + x.total, 0),
    totalEars: items.reduce((s, x) => s + x.ears, 0),
    totalCheckboxes: items.reduce((s, x) => s + x.checkboxes.total, 0),
    checkboxesFaits: items.reduce((s, x) => s + x.checkboxes.faits, 0),
  };
  return { items, totaux };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const AC_CSS = `<style>
.ac-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:.4rem; margin:.4rem 0; }
.ac-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.ac-stat .ac-val { font-size:1.2rem; font-weight:700; }
.ac-stat .ac-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.ac-row { padding:.35rem .5rem; margin:.15rem 0; font-size:.82rem; background:rgba(127,127,127,.04); border-radius:.22rem; display:flex; gap:.5rem; align-items:baseline; flex-wrap:wrap; border-left:3px solid #4c6ef5; }
.ac-row.empty { border-left-color:#e8590c; background:rgba(232,89,12,.04); }
.ac-tag { padding:.05rem .35rem; background:rgba(127,127,127,.1); border-radius:.18rem; font-size:.72rem; }
.ac-tag.ears { background:rgba(76,110,245,.12); color:#3a4cba; }
.ac-tag.section { background:rgba(43,138,62,.12); color:#1c5a2a; }
.ac-tag.cb { background:rgba(245,166,35,.15); color:#7a560f; }
.ac-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
.ac-bar { width:80px; height:6px; background:rgba(127,127,127,.15); border-radius:3px; overflow:hidden; display:inline-block; vertical-align:middle; }
.ac-fill { height:100%; background:#2b8a3e; }
</style>`;

export function blocAcceptanceCriteria(donnees) {
  const a = donnees?.acceptanceCriteria;
  if (!a) return '';
  const t = a.totaux;
  if (a.items.length === 0) {
    return `${AC_CSS}<section>
      <h2>Critères d'acceptation SPEC <span class="count">aucun critère trouvé</span></h2>
      <div class="ac-empty">Extrait pour chaque SPEC les critères d'acceptation via 3 patterns : <code>## Critères d'acceptation</code> bullets, EARS (<code>WHEN/IF/WHILE/WHERE … SHALL …</code>), checkboxes <code>- [ ]</code>. Ajoute des critères dans tes SPECs pour améliorer leur testabilité.</div>
    </section>`;
  }
  const grid = [
    `<div class="ac-stat"><div class="ac-val">${t.specsAvecAC}/${t.totalSpecs}</div><div class="ac-label">SPECs avec AC</div></div>`,
    `<div class="ac-stat"><div class="ac-val">${t.totalEars}</div><div class="ac-label">Critères EARS</div></div>`,
    `<div class="ac-stat"><div class="ac-val">${t.totalCheckboxes}</div><div class="ac-label">Checkboxes</div></div>`,
    `<div class="ac-stat"><div class="ac-val">${t.checkboxesFaits}/${t.totalCheckboxes}</div><div class="ac-label">Faits</div></div>`,
  ].join('');
  const rows = a.items.slice(0, 15).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const tags = [];
    if (it.sectionAC > 0) tags.push(`<span class="ac-tag section">${it.sectionAC} bullet</span>`);
    if (it.ears > 0) tags.push(`<span class="ac-tag ears">${it.ears} EARS</span>`);
    if (it.checkboxes.total > 0) tags.push(`<span class="ac-tag cb">${it.checkboxes.faits}/${it.checkboxes.total} ☑</span>`);
    const progressHtml = it.progression != null ? `<span class="ac-bar"><span class="ac-fill" style="width:${it.progression}%"></span></span> ${it.progression}%` : '';
    return `<div class="ac-row">
      <strong>${idCell}</strong>
      <span>${escape((it.titre || '').slice(0, 40))}</span>
      <span class="muted">[${escape(it.statut || '?')}]</span>
      ${tags.join(' ')}
      ${progressHtml}
    </div>`;
  }).join('');
  return `${AC_CSS}<section>
    <h2>Critères d'acceptation SPEC <span class="count">${t.specsAvecAC}/${t.totalSpecs} SPECs · ${t.totalCriteres} critères au total</span></h2>
    <p class="muted" style="font-size:.85rem">Extrait critères d'acceptation des SPECs via 3 patterns : section <code>## Critères d'acceptation</code>, EARS (<code>WHEN/IF/WHILE/WHERE … SHALL</code>), checkboxes <code>- [ ]</code>. Progression checkboxes mesure l'avancement testable.</p>
    <div class="ac-grid">${grid}</div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  extraireCriteres as extractCriteria,
  calculerAcceptanceCriteria as computeAcceptanceCriteria,
  blocAcceptanceCriteria as acceptanceCriteriaSection,
};
