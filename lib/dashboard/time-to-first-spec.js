// AIAD SDD Mode — Dashboard : time-to-first-SPEC tracker (#504).
//
// Mesure pour chaque Intent **le délai entre sa création (mtime) et la
// première SPEC liée**. Métrique-clé pour la discovery velocity :
// "combien de temps un Intent passe en zone d'idée avant d'être
// décomposé en SPECs ?".
//
// Politique :
//   - intent.mtime         = proxy date de création
//   - première SPEC liée   = min(spec.mtime) parmi SPECs avec
//                            parentIntent matchant (court INTENT-NNN)
//   - TTFS                 = (premièreSpec - intent.mtime) en jours
//   - non-décomposé        = Intent sans aucune SPEC → ttfs = null
//
// Classe :
//   - rapide  ≤ 7j
//   - normal  ≤ 21j
//   - lent    ≤ 60j
//   - tres-lent > 60j
//   - non-decompose (Intent actif sans SPEC)
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const DAY = 24 * 3600 * 1000;

function indexerSpecsParCourt(specs) {
  const m = new Map();
  for (const s of specs || []) {
    if (!s.parentIntent || !s.mtime) continue;
    const court = String(s.parentIntent).split('-').slice(0, 2).join('-');
    if (!m.has(court)) m.set(court, []);
    m.get(court).push(s);
  }
  return m;
}

function classerTtfs(jours) {
  if (jours == null) return 'non-decompose';
  if (jours <= 7) return 'rapide';
  if (jours <= 21) return 'normal';
  if (jours <= 60) return 'lent';
  return 'tres-lent';
}

export function calculerTimeToFirstSpec(donnees) {
  const specsParCourt = indexerSpecsParCourt(donnees?.specs);
  const items = [];
  for (const i of donnees?.intents || []) {
    if (!i.mtime) continue;
    if (['archived'].includes(i.statut)) continue;
    const court = i.id.split('-').slice(0, 2).join('-');
    const specs = specsParCourt.get(court) || [];
    let premiereSpec = null;
    if (specs.length > 0) {
      premiereSpec = specs.reduce((min, s) => !min || s.mtime < min.mtime ? s : min, null);
    }
    const ttfsJours = premiereSpec
      ? Math.max(0, Math.floor((premiereSpec.mtime - i.mtime) / DAY))
      : null;
    items.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      mtime: i.mtime,
      premiereSpec: premiereSpec ? { id: premiereSpec.id, mtime: premiereSpec.mtime } : null,
      ttfsJours,
      etat: classerTtfs(ttfsJours),
    });
  }
  // Calcul TTFS moyen (Intents décomposés uniquement)
  const decomposes = items.filter((i) => i.ttfsJours != null);
  const ttfsMoyen = decomposes.length === 0 ? null
    : Math.round(decomposes.reduce((s, x) => s + x.ttfsJours, 0) / decomposes.length);
  const totaux = {
    total: items.length,
    rapide: items.filter((i) => i.etat === 'rapide').length,
    normal: items.filter((i) => i.etat === 'normal').length,
    lent: items.filter((i) => i.etat === 'lent').length,
    tresLent: items.filter((i) => i.etat === 'tres-lent').length,
    nonDecompose: items.filter((i) => i.etat === 'non-decompose').length,
  };
  // Tri : non-décomposé d'abord (à traiter), puis très lent → rapide.
  const RANK = { 'non-decompose': 0, 'tres-lent': 1, lent: 2, normal: 3, rapide: 4 };
  items.sort((a, b) => (RANK[a.etat] ?? 99) - (RANK[b.etat] ?? 99));
  return { items, totaux, ttfsMoyen };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const TT_CSS = `<style>
.tt-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:.4rem; margin:.5rem 0; }
.tt-stat { padding:.45rem; border-radius:.3rem; text-align:center; border:1px solid var(--border, #ddd); }
.tt-stat .tt-val { font-size:1.25rem; font-weight:700; }
.tt-stat .tt-label { font-size:.7rem; text-transform:uppercase; color:var(--muted, #777); }
.tt-stat.e-rapide { background:rgba(43,138,62,.08); border-color:rgba(43,138,62,.3); }
.tt-stat.e-normal { background:rgba(76,110,245,.05); border-color:rgba(76,110,245,.3); }
.tt-stat.e-lent { background:rgba(232,89,12,.05); border-color:rgba(232,89,12,.3); }
.tt-stat.e-tres-lent { background:rgba(201,42,42,.07); border-color:rgba(201,42,42,.3); }
.tt-stat.e-non-decompose { background:rgba(127,127,127,.06); border:1px dashed var(--border, #aaa); color:var(--muted, #555); }
.tt-row { padding:.3rem .4rem; margin:.2rem 0; border-radius:.2rem; font-size:.82rem; background:rgba(127,127,127,.04); display:flex; gap:.5rem; flex-wrap:wrap; align-items:baseline; }
.tt-row.r-non-decompose { border-left:3px dashed var(--border, #aaa); }
.tt-row.r-tres-lent { border-left:3px solid #c92a2a; background:rgba(201,42,42,.03); }
.tt-row.r-lent { border-left:3px solid #e8590c; }
.tt-row.r-normal { border-left:3px solid #4c6ef5; }
.tt-row.r-rapide { border-left:3px solid #2b8a3e; }
.tt-meta { font-size:.74rem; color:var(--muted, #777); }
.tt-summary { padding:.4rem .55rem; border-radius:.25rem; font-size:.85rem; margin:.3rem 0; background:rgba(127,127,127,.05); }
</style>`;

const LABELS = {
  rapide: '✓ Rapide (≤ 7j)',
  normal: '◐ Normal (8-21j)',
  lent: '⚠ Lent (22-60j)',
  'tres-lent': '⛔ Très lent (> 60j)',
  'non-decompose': '⊘ Non-décomposé',
};

export function blocTimeToFirstSpec(donnees) {
  const t = donnees?.timeToFirstSpec;
  if (!t) return '';
  if (t.items.length === 0) {
    return `${TT_CSS}<section>
      <h2>Time-to-first-SPEC <span class="count">aucun Intent à mesurer</span></h2>
      <p class="muted" style="font-size:.85rem">Mesure pour chaque Intent le délai entre création (mtime fichier) et première SPEC liée. Métrique-clé de la <strong>discovery velocity</strong>.</p>
    </section>`;
  }
  const totaux = t.totaux;
  const grid = ['rapide', 'normal', 'lent', 'tres-lent', 'non-decompose'].map((etat) => {
    const cle = etat === 'tres-lent' ? 'tresLent' : etat === 'non-decompose' ? 'nonDecompose' : etat;
    return `<div class="tt-stat e-${etat}">
      <div class="tt-val">${totaux[cle] || 0}</div>
      <div class="tt-label">${escape(LABELS[etat])}</div>
    </div>`;
  }).join('');
  const summary = t.ttfsMoyen != null
    ? `<div class="tt-summary"><strong>TTFS moyen : ${t.ttfsMoyen} jours</strong> sur ${totaux.rapide + totaux.normal + totaux.lent + totaux.tresLent} Intent(s) décomposé(s). ${totaux.nonDecompose > 0 ? `<span style="color:#7a3a08">${totaux.nonDecompose} Intent(s) actif(s) sans SPEC à ce jour.</span>` : ''}</div>`
    : `<div class="tt-summary">Aucun Intent décomposé en SPEC à ce jour — discovery encore en amont.</div>`;
  const rows = t.items.slice(0, 15).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const valTxt = it.ttfsJours != null ? `<span class="tt-meta">TTFS : <strong>${it.ttfsJours}j</strong> (1ʳᵉ SPEC ${escape(it.premiereSpec.id)})</span>` : `<span class="tt-meta">aucune SPEC</span>`;
    return `<div class="tt-row r-${escape(it.etat)}">
      <strong>${idCell}</strong>
      <span>${escape((it.titre || '').slice(0, 56))}</span>
      <span class="tt-meta">[${escape(it.statut || '?')}]</span>
      ${valTxt}
    </div>`;
  }).join('');
  return `${TT_CSS}<section>
    <h2>Time-to-first-SPEC <span class="count">discovery velocity — délai création → 1ʳᵉ SPEC</span></h2>
    <p class="muted" style="font-size:.85rem">Pour chaque Intent, mesure le délai entre sa création (mtime fichier) et sa première SPEC liée. Un TTFS court signale une discovery efficace ; un TTFS &gt; 60j suggère une décomposition retardée.</p>
    <div class="tt-grid">${grid}</div>
    ${summary}
    <div>${rows}</div>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  calculerTimeToFirstSpec as computeTimeToFirstSpec,
  blocTimeToFirstSpec as timeToFirstSpecSection,
};
