// AIAD SDD Mode — Dashboard : performance budgets pour Tech Lead (#213).
//
// Audit DASHBOARD-AUDIT.md section 5 ligne 150 : "Pas de performance budgets
// — bundle size, hot paths". Source attendue : fichier convention
// `.aiad/perf-budgets.md` avec tableau Markdown :
//
//   | Metric           | Budget   | Actuel  | Date       |
//   |------------------|----------|---------|------------|
//   | Bundle main      | < 200 KB | 145 KB  | 2026-05-13 |
//   | API p95          | < 200 ms | 180 ms  | 2026-05-13 |
//   | Hot path /shorten| < 30 ms  | 12 ms   | 2026-05-13 |
//
// Réutilise `parserValeur` + `evaluerEtat` de outcomes.js — même sémantique
// que les outcomes mais focalisée Tech Lead (bundle/perf, pas business).

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parserValeur, evaluerEtat } from './outcomes.js';

const PATTERN_H2 = /^##\s+/;

function parserTableau(lignes, debutIdx) {
  let i = debutIdx;
  while (i < lignes.length && !lignes[i].trim().startsWith('|')) {
    if (PATTERN_H2.test(lignes[i]) && i > debutIdx) return [];
    i += 1;
  }
  if (i >= lignes.length) return [];
  const headers = lignes[i].split('|').map((c) => c.trim()).filter(Boolean);
  // Recherche flexible des colonnes
  const idxMetric = headers.findIndex((h) => /^(metric|metrique|métrique|critère|critere|page|nom)/i.test(h)); // D1-B SPEC-016-4
  const idxBudget = headers.findIndex((h) => /^(budget|cible|target|max)/i.test(h));
  const idxActuel = headers.findIndex((h) => /^(actuel|current|measured|valeur|mesuré)/i.test(h));
  const idxDate = headers.findIndex((h) => /^(date|mesuré le|measured)/i.test(h));
  const idxFichier = headers.findIndex((h) => /^(fichier|file|path|chemin)/i.test(h)); // D1-B SPEC-016-4
  if (idxMetric < 0 || idxBudget < 0) return [];
  let j = i + 1;
  if (j < lignes.length && /^[\s|:-]+$/.test(lignes[j])) j += 1;
  const out = [];
  while (j < lignes.length) {
    const ligne = lignes[j];
    if (!ligne.trim().startsWith('|')) break;
    if (PATTERN_H2.test(ligne)) break;
    const cells = ligne.split('|').map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (cells.length === 0) { j += 1; continue; }
    const metric = cells[idxMetric];
    const budget = cells[idxBudget];
    const actuel = idxActuel >= 0 ? cells[idxActuel] : null;
    const date = idxDate >= 0 ? cells[idxDate] : null;
    const fichierPage = idxFichier >= 0 ? cells[idxFichier] : null; // D1-B SPEC-016-4
    if (!metric || /^[-:\s]+$/.test(metric)) { j += 1; continue; }
    const etat = (actuel && !/^[-:\s—]+$/.test(actuel))
      ? evaluerEtat(budget, actuel)
      : 'unknown';
    out.push({ metric, budget, actuel: actuel || null, date: date || null, etat, fichier: fichierPage || null });
    j += 1;
  }
  return out;
}

export function lirePerfBudgets(racineProjet, options = {}) {
  const chemin = options.fichier || join(racineProjet, '.aiad', 'perf-budgets.md');
  if (!existsSync(chemin)) {
    return { fichier: null, total: 0, budgets: [] };
  }
  let contenu;
  try { contenu = readFileSync(chemin, 'utf-8'); }
  catch { return { fichier: null, total: 0, budgets: [] }; }
  const lignes = contenu.split('\n');
  // Trouve le 1er tableau (peut être direct ou sous une section H2)
  let debut = 0;
  // Skip frontmatter éventuel
  if (lignes[0]?.trim() === '---') {
    let k = 1;
    while (k < lignes.length && lignes[k]?.trim() !== '---') k += 1;
    debut = k + 1;
  }
  // Skip H1/H2 et texte jusqu'à trouver le 1er tableau
  const budgets = parserTableau(lignes, debut);
  return {
    fichier: relative(racineProjet, chemin),
    total: budgets.length,
    budgets,
  };
}

// ─── Rendu HTML ─────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

function badgeEtat(etat, actuel) {
  if (actuel == null) return '<span class="muted" style="font-size:.85rem">—</span>';
  if (etat === 'ok') return `<span class="badge badge-ok" style="font-size:.75rem">${escape(actuel)} ✓</span>`;
  if (etat === 'warn') return `<span class="badge badge-warn" style="font-size:.75rem">${escape(actuel)}</span>`;
  if (etat === 'bad') return `<span class="badge badge-bad" style="font-size:.75rem">${escape(actuel)} ⚠</span>`;
  return `<span class="badge" style="font-size:.75rem">${escape(actuel)}</span>`;
}

export function blocPerfBudgets(donnees) {
  const pb = donnees?.perfBudgets;
  if (!pb || !pb.fichier || pb.total === 0) return '';
  const totalMesures = pb.budgets.filter((b) => b.actuel != null).length;
  const totalOk = pb.budgets.filter((b) => b.etat === 'ok').length;
  const totalBad = pb.budgets.filter((b) => b.etat === 'bad').length;
  const rows = pb.budgets.slice(0, 30).map((b) => `
    <tr>
      <td><strong>${escape(b.metric)}</strong></td>
      <td><span class="badge badge-info" style="font-size:.75rem">${escape(b.budget)}</span></td>
      <td>${badgeEtat(b.etat, b.actuel)}</td>
      <td class="muted" style="font-size:.85rem">${escape(b.date || '—')}</td>
    </tr>`).join('');
  return `<section>
    <h2>Performance budgets <span class="count">${totalOk}/${pb.total}</span></h2>
    <p class="muted" style="font-size:.85rem">Budgets perf déclarés dans ${lienSource(pb.fichier)}. Source unique pour bundle size, latence p95, hot paths.</p>
    <div class="kpis">
      <div class="kpi"><div class="label">Budgets total</div><div class="value">${pb.total}</div><div class="delta">${totalMesures} mesurés</div></div>
      <div class="kpi"><div class="label">Dans le budget</div><div class="value">${totalOk}</div><div class="delta">✓ atteints</div></div>
      <div class="kpi"><div class="label">Hors budget</div><div class="value">${totalBad}</div><div class="delta">⚠ à traiter</div></div>
    </div>
    <table>
      <thead><tr><th>Metric</th><th>Budget</th><th>Actuel</th><th>Date</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  lirePerfBudgets as readPerfBudgets,
  blocPerfBudgets as perfBudgetsSection,
};
