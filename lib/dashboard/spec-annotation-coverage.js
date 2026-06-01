// AIAD SDD Mode — Dashboard : SPEC annotation coverage (#536).
//
// Mesure pour chaque SPEC la présence des **annotations machine-vérifiables**
// AIAD v1.10 :
//   - @intent INTENT-NNN
//   - @spec SPEC-NNN-N-slug
//   - @verified-by chemin/vers/test
//   - @governance AIAD-XXX,AIAD-YYY
//
// Les annotations doivent être présentes dans le code applicatif
// (#74 graph), pas seulement dans la SPEC Markdown. Ce module fait
// un proxy : scan le body de la SPEC pour les 4 tags.
//
// Pure transformation.

const TAGS = ['@intent', '@spec', '@verified-by', '@governance'];

function compterTag(texte, tag) {
  if (!texte) return 0;
  const regex = new RegExp('(^|\\s)' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const matches = texte.match(regex);
  return matches ? matches.length : 0;
}

export function calculerSpecAnnotationCoverage(donnees) {
  const items = [];
  for (const s of donnees?.specs || []) {
    let texte = '';
    if (typeof s.body === 'string') texte = s.body;
    else if (typeof s.contenu === 'string') texte = s.contenu;
    const tags = {};
    let nbTags = 0;
    for (const tag of TAGS) {
      const n = compterTag(texte, tag);
      tags[tag] = n;
      if (n > 0) nbTags++;
    }
    const pct = Math.round((nbTags / TAGS.length) * 100);
    let etat;
    if (pct === 100) etat = 'complet';
    else if (pct >= 75) etat = 'avance';
    else if (pct >= 50) etat = 'partiel';
    else if (pct >= 25) etat = 'debut';
    else etat = 'vide';
    items.push({
      id: s.id,
      titre: s.titre || '',
      file: s.file || null,
      statut: s.statut,
      tags,
      nbTags,
      pct,
      etat,
    });
  }
  items.sort((a, b) => a.pct - b.pct);
  const total = items.length;
  const totauxTags = {};
  for (const tag of TAGS) totauxTags[tag] = items.filter((i) => i.tags[tag] > 0).length;
  const scoreMoyen = total === 0 ? 0 : Math.round(items.reduce((s, x) => s + x.pct, 0) / total);
  return {
    items,
    totaux: {
      total,
      complet: items.filter((i) => i.etat === 'complet').length,
      avance: items.filter((i) => i.etat === 'avance').length,
      partiel: items.filter((i) => i.etat === 'partiel').length,
      debut: items.filter((i) => i.etat === 'debut').length,
      vide: items.filter((i) => i.etat === 'vide').length,
      tags: totauxTags,
      scoreMoyen,
    },
    seuilTags: TAGS,
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const SAC_CSS = `<style>
.sac-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:.4rem; margin:.4rem 0; }
.sac-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.sac-stat .sac-val { font-size:1.2rem; font-weight:700; }
.sac-stat .sac-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.sac-stat.e-complet { background:rgba(43,138,62,.07); border-color:rgba(43,138,62,.3); }
.sac-stat.e-avance { background:rgba(43,138,62,.05); border-color:rgba(43,138,62,.2); }
.sac-stat.e-partiel { background:rgba(245,166,35,.05); border-color:rgba(245,166,35,.3); }
.sac-stat.e-debut { background:rgba(232,89,12,.05); border-color:rgba(232,89,12,.3); }
.sac-stat.e-vide { background:rgba(201,42,42,.05); border-color:rgba(201,42,42,.3); }
.sac-tags { display:flex; gap:.3rem; flex-wrap:wrap; margin:.3rem 0; font-size:.75rem; }
.sac-tag-chip { padding:.05rem .35rem; background:rgba(127,127,127,.08); border-radius:.15rem; }
.sac-tag-chip.has { background:rgba(43,138,62,.12); color:#1c5a2a; }
.sac-row { padding:.35rem .5rem; margin:.15rem 0; font-size:.82rem; background:rgba(127,127,127,.04); border-radius:.22rem; display:flex; gap:.5rem; align-items:baseline; flex-wrap:wrap; border-left:3px solid var(--border, #ccc); }
.sac-row.r-vide { border-left-color:#c92a2a; }
.sac-row.r-debut { border-left-color:#e8590c; }
.sac-row.r-partiel { border-left-color:#f5a623; }
.sac-row.r-avance { border-left-color:#3a9c4f; }
.sac-row.r-complet { border-left-color:#2b8a3e; }
.sac-bar { width:100px; height:8px; background:rgba(127,127,127,.15); border-radius:4px; overflow:hidden; display:inline-block; vertical-align:middle; }
.sac-fill { height:100%; transition:width .15s; }
.sac-fill.e-complet { background:#2b8a3e; }
.sac-fill.e-avance { background:#3a9c4f; }
.sac-fill.e-partiel { background:#f5a623; }
.sac-fill.e-debut { background:#e8590c; }
.sac-fill.e-vide { background:#c92a2a; }
</style>`;

const LABELS = {
  complet: '✓ 4/4',
  avance: '◐ 3/4',
  partiel: '⚠ 2/4',
  debut: '⛔ 1/4',
  vide: '⊘ 0/4',
};

export function blocSpecAnnotationCoverage(donnees) {
  const a = donnees?.specAnnotationCoverage;
  if (!a) return '';
  if (a.items.length === 0) {
    return `${SAC_CSS}<section>
      <h2>Couverture annotations SPEC <span class="count">aucune SPEC</span></h2>
      <p class="muted" style="font-size:.85rem">Mesure la présence des 4 tags AIAD v1.10 (<code>@intent</code> / <code>@spec</code> / <code>@verified-by</code> / <code>@governance</code>) dans le body de chaque SPEC. Tags requis pour le Drift Lock machine-vérifiable (#74 graph, #/sdd trace).</p>
    </section>`;
  }
  const t = a.totaux;
  const grid = ['complet', 'avance', 'partiel', 'debut', 'vide'].map((etat) => `<div class="sac-stat e-${etat}">
      <div class="sac-val">${t[etat] || 0}</div>
      <div class="sac-label">${escape(LABELS[etat])}</div>
    </div>`).join('');
  const tagsBar = `<div class="sac-tags">${a.seuilTags.map((tag) => {
    const n = t.tags[tag] || 0;
    return `<span class="sac-tag-chip ${n > 0 ? 'has' : ''}">${escape(tag)} : ${n}/${t.total}</span>`;
  }).join('')}</div>`;
  const rows = a.items.slice(0, 15).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const tags = a.seuilTags.map((tag) => it.tags[tag] > 0 ? `<span class="sac-tag-chip has">${escape(tag)}</span>` : '').filter(Boolean).join(' ');
    return `<div class="sac-row r-${escape(it.etat)}">
      <strong>${idCell}</strong>
      <span>${escape((it.titre || '').slice(0, 40))}</span>
      <span class="muted">[${escape(it.statut || '?')}]</span>
      <span class="sac-bar"><span class="sac-fill e-${escape(it.etat)}" style="width:${it.pct}%"></span></span>
      <span class="muted">${it.pct}%</span>
      ${tags}
    </div>`;
  }).join('');
  return `${SAC_CSS}<section>
    <h2>Couverture annotations SPEC <span class="count">${t.total} SPEC(s) — score moyen ${t.scoreMoyen}%</span></h2>
    <p class="muted" style="font-size:.85rem">Présence des 4 tags AIAD v1.10 (<code>@intent</code> / <code>@spec</code> / <code>@verified-by</code> / <code>@governance</code>) dans le body de chaque SPEC. Requis pour le Drift Lock machine-vérifiable.</p>
    ${tagsBar}
    <div class="sac-grid">${grid}</div>
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerSpecAnnotationCoverage as computeSpecAnnotationCoverage,
  blocSpecAnnotationCoverage as specAnnotationCoverageSection,
  TAGS as REQUIRED_TAGS,
};
