// AIAD SDD Mode — Dashboard : SPEC scope estimator (T-shirt size) (#525).
//
// Estime un T-shirt size par SPEC basé sur :
//   - nb mots du body (proxy complexité texte)
//   - nb sections h2/h3 (proxy nombre d'aspects couverts)
//
// Buckets :
//   - XS  ≤ 100 mots
//   - S   101-300 mots
//   - M   301-700 mots
//   - L   701-1500 mots
//   - XL  > 1500 mots
//
// Indication informelle pour : "cette SPEC est-elle un découpage à
// faire ou OK ?". Une SPEC XL est souvent un signal à découper en
// 2-3 SPECs plus petites.
//
// Pure transformation.

const SEUILS = [
  { taille: 'XS', max: 100, couleur: '#2b8a3e' },
  { taille: 'S', max: 300, couleur: '#4c6ef5' },
  { taille: 'M', max: 700, couleur: '#f5a623' },
  { taille: 'L', max: 1500, couleur: '#e8590c' },
  { taille: 'XL', max: Infinity, couleur: '#c92a2a' },
];

function compterMots(s) {
  if (!s || typeof s !== 'string') return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function compterSections(s) {
  if (!s || typeof s !== 'string') return 0;
  let n = 0;
  for (const l of s.split(/\r?\n/)) {
    if (/^#{2,3}\s+/.test(l)) n++;
  }
  return n;
}

function classer(mots) {
  for (const s of SEUILS) if (mots <= s.max) return s.taille;
  return 'XL';
}

export function calculerSpecScope(donnees) {
  const items = [];
  for (const s of donnees?.specs || []) {
    let texte = '';
    if (typeof s.body === 'string') texte = s.body;
    else if (typeof s.contenu === 'string') texte = s.contenu;
    else if (typeof s.titre === 'string') texte = s.titre;
    const mots = compterMots(texte);
    const sections = compterSections(texte);
    const taille = classer(mots);
    items.push({
      id: s.id,
      titre: s.titre || '',
      file: s.file || null,
      statut: s.statut,
      parentIntent: s.parentIntent || null,
      mots,
      sections,
      taille,
      aDecouper: taille === 'XL',
    });
  }
  items.sort((a, b) => b.mots - a.mots);
  const totaux = { total: items.length };
  for (const s of SEUILS) totaux[s.taille] = items.filter((i) => i.taille === s.taille).length;
  return { items, totaux, motsMoyens: items.length === 0 ? 0 : Math.round(items.reduce((sum, x) => sum + x.mots, 0) / items.length), aDecouperCount: items.filter((i) => i.aDecouper).length };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const SC_CSS = `<style>
.sc-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap:.35rem; margin:.4rem 0; }
.sc-stat { padding:.4rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.sc-stat .sc-val { font-size:1.2rem; font-weight:700; }
.sc-stat .sc-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.sc-stat.t-XS { background:rgba(43,138,62,.07); border-color:rgba(43,138,62,.3); }
.sc-stat.t-S { background:rgba(76,110,245,.05); border-color:rgba(76,110,245,.3); }
.sc-stat.t-M { background:rgba(245,166,35,.06); border-color:rgba(245,166,35,.3); }
.sc-stat.t-L { background:rgba(232,89,12,.06); border-color:rgba(232,89,12,.3); }
.sc-stat.t-XL { background:rgba(201,42,42,.06); border-color:rgba(201,42,42,.3); }
.sc-row { padding:.3rem .45rem; margin:.15rem 0; font-size:.82rem; background:rgba(127,127,127,.04); border-radius:.22rem; display:flex; gap:.5rem; flex-wrap:wrap; align-items:baseline; }
.sc-row.r-XL { border-left:3px solid #c92a2a; background:rgba(201,42,42,.04); }
.sc-row.r-L { border-left:3px solid #e8590c; }
.sc-row.r-M { border-left:3px solid #f5a623; }
.sc-tshirt { font-weight:600; padding:.05rem .35rem; border-radius:.2rem; font-size:.78rem; }
.sc-tshirt.t-XS { background:rgba(43,138,62,.15); color:#1c5a2a; }
.sc-tshirt.t-S { background:rgba(76,110,245,.12); color:#3a4cba; }
.sc-tshirt.t-M { background:rgba(245,166,35,.15); color:#7a560f; }
.sc-tshirt.t-L { background:rgba(232,89,12,.15); color:#7a3a08; }
.sc-tshirt.t-XL { background:rgba(201,42,42,.15); color:#7a1717; }
.sc-meta { font-size:.74rem; color:var(--muted, #777); }
.sc-empty { padding:.5rem .7rem; background:rgba(127,127,127,.04); border-radius:.25rem; font-size:.85rem; color:var(--muted, #777); }
</style>`;

export function blocSpecScope(donnees) {
  const s = donnees?.specScope;
  if (!s) return '';
  if (s.items.length === 0) {
    return `${SC_CSS}<section>
      <h2>Taille SPEC (T-shirt size) <span class="count">aucune SPEC</span></h2>
      <div class="sc-empty">Estime un T-shirt size par SPEC basé sur le nb de mots du body (XS ≤ 100, S ≤ 300, M ≤ 700, L ≤ 1500, XL > 1500). Une SPEC XL est souvent à découper.</div>
    </section>`;
  }
  const t = s.totaux;
  const grid = ['XS', 'S', 'M', 'L', 'XL'].map((taille) => `<div class="sc-stat t-${taille}">
      <div class="sc-val">${t[taille] || 0}</div>
      <div class="sc-label">${taille}</div>
    </div>`).join('');
  const rows = s.items.slice(0, 15).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const parent = it.parentIntent ? `<span class="sc-meta">parent <code>${escape(it.parentIntent)}</code></span>` : '';
    return `<div class="sc-row r-${escape(it.taille)}">
      <span class="sc-tshirt t-${escape(it.taille)}">${escape(it.taille)}</span>
      <strong>${idCell}</strong>
      <span>${escape((it.titre || '').slice(0, 50))}</span>
      ${parent}
      <span class="sc-meta">${it.mots} mots · ${it.sections} section(s)${it.aDecouper ? ' · ⚠ à découper' : ''}</span>
    </div>`;
  }).join('');
  const conseil = s.aDecouperCount > 0
    ? `<p class="muted" style="font-size:.85rem">⚠ <strong>${s.aDecouperCount} SPEC(s) XL</strong> — découper via <code>/sdd split</code> pour gagner en testabilité.</p>`
    : `<p class="muted" style="font-size:.85rem">✓ Toutes les SPECs ≤ L — taille raisonnable.</p>`;
  return `${SC_CSS}<section>
    <h2>Taille SPEC (T-shirt size) <span class="count">${t.total} SPEC(s) — moyenne ${s.motsMoyens} mots</span></h2>
    <p class="muted" style="font-size:.85rem">T-shirt size par SPEC basé sur nb mots du body : XS ≤ 100 · S ≤ 300 · M ≤ 700 · L ≤ 1500 · XL &gt; 1500. Indicateur de découpage à faire.</p>
    <div class="sc-grid">${grid}</div>
    ${conseil}
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerSpecScope as computeSpecScope,
  blocSpecScope as specScopeSection,
  SEUILS as SCOPE_THRESHOLDS,
};
