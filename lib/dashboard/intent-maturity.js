// AIAD SDD Mode — Dashboard : intent doc maturity scorecard (#486).
//
// Évalue la **complétude documentaire** de chaque Intent sur les 5
// sections canoniques : POURQUOI MAINTENANT, POUR QUI, OBJECTIF,
// CONTRAINTES, CRITÈRE DE DRIFT.
//
// Politique de scoring (20 pts par section, max 100) :
//   - mature   = ≥ 50 chars OU ≥ 1 ligne hors placeholder → 20 pts
//   - squelette = présent mais < 50 chars (probablement placeholder) → 10 pts
//   - absent   = section manquante → 0 pt
//
// États composites :
//   - complete   ≥ 90 % (toutes sections mature)
//   - structured 60-89 % (la plupart matures)
//   - skeleton   20-59 % (présentes mais courtes)
//   - incomplete < 20 % (Intent à compléter)
//
// Aide le PM à repérer les Intents documentairement faibles AVANT
// d'investir en SPECs/exec (un Intent squelettique génère du drift).
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

const SECTIONS_CANONIQUES = [
  { cle: 'pourquoi', label: 'POURQUOI MAINTENANT' },
  { cle: 'pourQui', label: 'POUR QUI' },
  { cle: 'objectif', label: 'OBJECTIF' },
  { cle: 'contraintes', label: 'CONTRAINTES' },
  { cle: 'critereDrift', label: 'CRITÈRE DE DRIFT' },
];

const SEUIL_MATURE = 50;
const POIDS_SECTION = 20;

function classerSection(contenu) {
  if (!contenu || typeof contenu !== 'string') return { etat: 'absent', points: 0, chars: 0 };
  // Nettoyer placeholders bracketés [...] et HTML comments
  const nettoye = contenu
    .replace(/\[[^\]]*\]/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  if (nettoye.length === 0) return { etat: 'absent', points: 0, chars: 0 };
  if (nettoye.length < SEUIL_MATURE) return { etat: 'squelette', points: POIDS_SECTION / 2, chars: nettoye.length };
  return { etat: 'mature', points: POIDS_SECTION, chars: nettoye.length };
}

export function scorerIntent(intent) {
  const sections = intent?.sections || {};
  const cellules = SECTIONS_CANONIQUES.map((s) => ({
    cle: s.cle,
    label: s.label,
    ...classerSection(sections[s.cle]),
  }));
  const score = cellules.reduce((s, c) => s + c.points, 0);
  let etat;
  if (score >= 90) etat = 'complete';
  else if (score >= 60) etat = 'structured';
  else if (score >= 20) etat = 'skeleton';
  else etat = 'incomplete';
  return { cellules, score, etat };
}

export function calculerIntentMaturity(donnees) {
  const items = [];
  for (const i of donnees?.intents || []) {
    if (['archived'].includes(i.statut)) continue;
    const s = scorerIntent(i);
    items.push({
      id: i.id,
      titre: i.titre || '',
      file: i.file || null,
      statut: i.statut,
      priority: i.priority || null,
      ...s,
    });
  }
  // Tri : incomplete d'abord (à corriger), complete à la fin.
  const RANK = { incomplete: 0, skeleton: 1, structured: 2, complete: 3 };
  items.sort((a, b) => (RANK[a.etat] ?? 99) - (RANK[b.etat] ?? 99));
  const totaux = {
    total: items.length,
    complete: items.filter((i) => i.etat === 'complete').length,
    structured: items.filter((i) => i.etat === 'structured').length,
    skeleton: items.filter((i) => i.etat === 'skeleton').length,
    incomplete: items.filter((i) => i.etat === 'incomplete').length,
  };
  return { items, totaux, sections: SECTIONS_CANONIQUES };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

const IM_CSS = `<style>
.im-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:.4rem; margin:.5rem 0; }
.im-stat { padding:.5rem; border-radius:.35rem; text-align:center; border:1px solid var(--border, #ddd); }
.im-stat.lvl-complete { background:rgba(43,138,62,.08); border-color:rgba(43,138,62,.3); }
.im-stat.lvl-structured { background:rgba(76,110,245,.05); border-color:rgba(76,110,245,.25); }
.im-stat.lvl-skeleton { background:rgba(232,89,12,.05); border-color:rgba(232,89,12,.25); }
.im-stat.lvl-incomplete { background:rgba(201,42,42,.06); border-color:rgba(201,42,42,.3); }
.im-stat .im-val { font-size:1.25rem; font-weight:700; }
.im-stat .im-label { font-size:.72rem; text-transform:uppercase; color:var(--muted, #777); }
.im-table { width:100%; border-collapse:collapse; font-size:.82rem; margin:.5rem 0; }
.im-table th, .im-table td { padding:.3rem .45rem; border-bottom:1px solid var(--border, #eee); text-align:left; }
.im-cell { display:inline-block; width:1rem; height:1rem; border-radius:.2rem; vertical-align:middle; margin-right:.15rem; }
.im-cell.s-mature { background:#2b8a3e; }
.im-cell.s-squelette { background:#e8590c; }
.im-cell.s-absent { background:rgba(127,127,127,.18); border:1px dashed var(--border, #ccc); }
.im-score-bar { width:60px; height:6px; background:rgba(127,127,127,.15); border-radius:3px; display:inline-block; vertical-align:middle; overflow:hidden; }
.im-score-fill { height:100%; transition:width .2s; }
.im-score-fill.lvl-complete { background:#2b8a3e; }
.im-score-fill.lvl-structured { background:#4c6ef5; }
.im-score-fill.lvl-skeleton { background:#e8590c; }
.im-score-fill.lvl-incomplete { background:#c92a2a; }
</style>`;

const LABELS_ETAT = {
  complete: '✓ Complet',
  structured: '◐ Structuré',
  skeleton: '⚠ Squelette',
  incomplete: '✗ Incomplet',
};

export function blocIntentMaturity(donnees) {
  const m = donnees?.intentMaturity;
  if (!m) return '';
  if (m.items.length === 0) {
    return `${IM_CSS}<section>
      <h2>Maturité documentaire des Intents <span class="count">aucun Intent à scorer</span></h2>
      <p class="muted" style="font-size:.85rem">Le scorecard évalue chaque Intent sur les 5 sections canoniques (POURQUOI MAINTENANT / POUR QUI / OBJECTIF / CONTRAINTES / CRITÈRE DE DRIFT) — 20 pts par section, max 100. Un Intent squelettique génère du drift en SPEC/exec.</p>
    </section>`;
  }
  const t = m.totaux;
  const grid = ['incomplete', 'skeleton', 'structured', 'complete']
    .map((etat) => `<div class="im-stat lvl-${etat}">
      <div class="im-val">${t[etat]}</div>
      <div class="im-label">${escape(LABELS_ETAT[etat])}</div>
    </div>`).join('');
  const headers = m.sections.map((s) => `<th title="${escape(s.label)}">${escape(s.label.slice(0, 4))}</th>`).join('');
  const rows = m.items.slice(0, 25).map((it) => {
    const idCell = it.file ? lienSource(it.file, it.id) : `<code>${escape(it.id)}</code>`;
    const cells = it.cellules.map((c) => `<td><span class="im-cell s-${escape(c.etat)}" title="${escape(c.label)} : ${escape(c.etat)} (${c.chars} chars)"></span></td>`).join('');
    return `<tr>
      <td>${idCell}</td>
      <td>${escape((it.titre || '').slice(0, 60))}</td>
      <td><span class="muted">${escape(it.statut || '?')}</span></td>
      ${cells}
      <td><div class="im-score-bar"><div class="im-score-fill lvl-${escape(it.etat)}" style="width:${it.score}%"></div></div> <span class="muted">${it.score}/100</span></td>
      <td>${escape(LABELS_ETAT[it.etat] || it.etat)}</td>
    </tr>`;
  }).join('');
  const aTraiter = (t.incomplete || 0) + (t.skeleton || 0);
  const conseil = aTraiter > 0
    ? `<p class="muted" style="font-size:.85rem">⚠ <strong>${aTraiter} Intent(s) à compléter</strong> — légende cases : <span class="im-cell s-mature"></span> mature (≥ 50 chars), <span class="im-cell s-squelette"></span> squelette (&lt; 50 chars), <span class="im-cell s-absent"></span> absent.</p>`
    : `<p class="muted" style="font-size:.85rem">✓ <strong>${t.complete}/${t.total} Intent(s) complets</strong> — documentation solide.</p>`;
  return `${IM_CSS}<section>
    <h2>Maturité documentaire des Intents <span class="count">${t.total} Intent(s) — score moyen ${Math.round(m.items.reduce((s, x) => s + x.score, 0) / m.items.length)}/100</span></h2>
    <p class="muted" style="font-size:.85rem">Évaluation par Intent des 5 sections canoniques (POURQUOI MAINTENANT / POUR QUI / OBJECTIF / CONTRAINTES / CRITÈRE DE DRIFT). Un Intent squelettique génère du drift en SPEC/exec.</p>
    <div class="im-grid">${grid}</div>
    ${conseil}
    <table class="im-table">
      <thead><tr><th>ID</th><th>Titre</th><th>Statut</th>${headers}<th>Score</th><th>État</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  scorerIntent as scoreIntent,
  calculerIntentMaturity as computeIntentMaturity,
  blocIntentMaturity as intentMaturitySection,
  SECTIONS_CANONIQUES as CANONICAL_SECTIONS,
};
