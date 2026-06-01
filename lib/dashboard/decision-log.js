// AIAD SDD Mode — Dashboard : journal de décisions (#443).
//
// Le PM doit avoir une vue consolidée des décisions prises sur le projet
// pour préparer ses rétros, ses arbitrages COMEX, ou pour comprendre
// pourquoi telle option a été retenue. Source double :
//   (a) section `## 7. Trade-offs et Décisions Clés` du PRD.md
//   (b) facts capturés via `/sdd fact` dans `.aiad/facts/*.md` (écarts
//       livré/désiré qui sont une forme de décision implicite)
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseFrontmatter } from '../frontmatter.js';
import { lireFichier } from './collect.js';

// Parse la section `## 7. Trade-offs et Décisions Clés` du PRD. Table
// Markdown avec colonnes `Décision | Raison | Coût / Bénéfice`. Robuste
// aux variantes EN (`## Decisions`, `## Trade-offs`, `## Trade-offs and
// Key Decisions`).
const PATTERN_SECTION = /^##\s+(?:\d+\.\s+)?(?:Trade-offs?(?:\s+et\s+D[ée]cisions(?:\s+Cl[ée]s)?)?|D[ée]cisions(?:\s+Cl[ée]s)?|Key\s+Decisions)\s*$/im;

export function lireDecisionsPrd(racineProjet, options = {}) {
  const chemin = options.fichier
    ? join(racineProjet, options.fichier)
    : join(racineProjet, '.aiad', 'PRD.md');
  if (!existsSync(chemin)) return { fichier: null, total: 0, decisions: [] };
  const contenu = lireFichier(chemin);
  if (!contenu) return { fichier: null, total: 0, decisions: [] };
  const { body } = parseFrontmatter(contenu);
  const lignes = body.split(/\r?\n/);
  let sectionIdx = -1;
  for (let i = 0; i < lignes.length; i++) {
    if (PATTERN_SECTION.test(lignes[i])) { sectionIdx = i; break; }
  }
  if (sectionIdx < 0) return { fichier: relative(racineProjet, chemin), total: 0, decisions: [] };
  // Parse table jusqu'au prochain `##`. La row d'en-tête est détectée
  // par look-ahead : toute row immédiatement suivie d'une row séparatrice
  // (`|---|---|`) est forcément l'en-tête, on l'ignore quel que soit son
  // contenu.
  const decisions = [];
  for (let i = sectionIdx + 1; i < lignes.length; i++) {
    if (/^##\s+/.test(lignes[i])) break;
    const cells = lignes[i].split('|').map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (cells.length < 2) continue;
    // Skip separator row.
    if (/^[-\s|:]+$/.test(cells.join(''))) continue;
    // Look-ahead : si la ligne suivante est une séparatrice, on est sur
    // l'en-tête de la table — on skip silencieusement.
    if (i + 1 < lignes.length) {
      const nextCells = lignes[i + 1].split('|').map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (nextCells.length >= 2 && /^[-\s|:]+$/.test(nextCells.join(''))) continue;
    }
    if (/^\[.*\]$/.test(cells[0])) continue; // placeholder du template
    if (!cells[0]) continue;
    decisions.push({
      decision: cells[0],
      raison: cells[1] || '',
      tradeoff: cells[2] || '',
    });
  }
  return {
    fichier: relative(racineProjet, chemin),
    total: decisions.length,
    decisions,
  };
}

// ─── Façade ──────────────────────────────────────────────────────────────────

export function calculerDecisionLog(racineProjet, donnees) {
  const prd = lireDecisionsPrd(racineProjet);
  // Facts déjà collectés via collect.js (donnees.facts).
  const facts = (donnees?.facts || []).map((f) => ({
    id: f.id,
    titre: f.titre || '',
    gravite: f.gravite || null,
    statut: f.statut || null,
    cause: f.cause || '',
    file: f.file || null,
    date: f.date || null,
    mtime: f.mtime || null,
  }));
  // Tri facts : ouverts + critiques d'abord.
  const RANK_GRAV = { critical: 0, major: 1, minor: 2, info: 3 };
  facts.sort((a, b) => {
    const ouvertA = !['closed', 'resolu', 'résolu'].includes(a.statut) ? 0 : 1;
    const ouvertB = !['closed', 'resolu', 'résolu'].includes(b.statut) ? 0 : 1;
    if (ouvertA !== ouvertB) return ouvertA - ouvertB;
    return (RANK_GRAV[a.gravite] ?? 99) - (RANK_GRAV[b.gravite] ?? 99);
  });
  return {
    prd,
    facts,
    totaux: {
      decisionsPrd: prd.total,
      facts: facts.length,
      factsOuverts: facts.filter((f) => !['closed', 'resolu', 'résolu'].includes(f.statut)).length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource } from './render.js';

function badgeFact(f) {
  const ouvert = !['closed', 'resolu', 'résolu'].includes(f.statut);
  if (!ouvert) return '<span class="badge badge-ok">Résolu</span>';
  if (f.gravite === 'critical') return '<span class="badge badge-bad">Critique</span>';
  if (f.gravite === 'major') return '<span class="badge badge-warn">Majeur</span>';
  if (f.gravite === 'minor') return '<span class="badge badge-info">Mineur</span>';
  return '<span class="badge badge-muted">Ouvert</span>';
}

const DECISION_CSS = `<style>
.decision-table th { text-align:left; font-weight:600; font-size:.75rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted, #777); }
.decision-table td { padding:.35rem .5rem; vertical-align:top; font-size:.85rem; }
.decision-table tr:nth-child(even) td { background: rgba(127,127,127,.04); }
.decision-tradeoff { color: var(--muted, #777); font-size:.78rem; font-style: italic; }
.facts-list { display:grid; gap:.4rem; margin-top:.5rem; }
.fact-card { padding:.4rem .55rem; border-left:3px solid var(--border, #ddd); background:rgba(127,127,127,.04); border-radius:.2rem; font-size:.83rem; }
.fact-card.gravite-critical { border-left-color:#c92a2a; background:rgba(201,42,42,.04); }
.fact-card.gravite-major { border-left-color:#e8590c; background:rgba(232,89,12,.04); }
.fact-card.statut-closed, .fact-card.statut-resolu { opacity:.55; }
</style>`;

export function blocDecisionLog(donnees) {
  const d = donnees?.decisionLog;
  if (!d) return '';
  if (d.totaux.decisionsPrd === 0 && d.totaux.facts === 0) {
    return `<section>
      <h2>Décisions et facts <span class="count">aucune décision tracée</span></h2>
      <p class="muted" style="font-size:.85rem">Le PRD ne contient pas de section <code>## Trade-offs et Décisions Clés</code> remplie, et aucun fact n'a été capturé via <code>/sdd fact</code>. Ces deux sources alimenteraient ce journal.</p>
    </section>`;
  }
  const decRows = d.prd.decisions.map((dec) => `<tr>
    <td><strong>${escape(dec.decision)}</strong></td>
    <td>${escape(dec.raison || '—')}</td>
    <td class="decision-tradeoff">${escape(dec.tradeoff || '—')}</td>
  </tr>`).join('');
  const factCards = d.facts.slice(0, 8).map((f) => {
    const cls = `gravite-${escape(f.gravite || 'none')} statut-${escape(f.statut || 'open')}`;
    const idCell = f.file ? lienSource(f.file, f.id) : `<code>${escape(f.id)}</code>`;
    return `<div class="fact-card ${cls}">
      <strong>${idCell}</strong> ${badgeFact(f)} — ${escape(f.titre)}
      ${f.cause ? `<div class="muted" style="font-size:.75rem;margin-top:.15rem">Cause : ${escape(f.cause)}</div>` : ''}
    </div>`;
  }).join('');
  const sectionFacts = factCards
    ? `<h3 style="margin-top:1rem">Facts (écarts livré/désiré) <span class="count">${d.totaux.factsOuverts} ouvert(s) / ${d.totaux.facts} total</span></h3><div class="facts-list">${factCards}</div>`
    : '';
  const sectionPrd = decRows
    ? `<h3>Décisions PRD ${d.prd.fichier ? `<span class="count">source : ${lienSource(d.prd.fichier)}</span>` : ''}</h3>
    <table class="decision-table">
      <thead><tr><th>Décision</th><th>Raison</th><th>Trade-off</th></tr></thead>
      <tbody>${decRows}</tbody>
    </table>`
    : '';
  return `${DECISION_CSS}<section>
    <h2>Décisions et facts <span class="count">${d.totaux.decisionsPrd} décisions PRD · ${d.totaux.factsOuverts} fact(s) ouvert(s)</span></h2>
    <p class="muted" style="font-size:.85rem">Vue consolidée des décisions tracées : (1) table <code>## Trade-offs et Décisions Clés</code> du PRD et (2) facts capturés via <code>/sdd fact</code>.</p>
    ${sectionPrd}
    ${sectionFacts}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  lireDecisionsPrd as readPrdDecisions,
  calculerDecisionLog as computeDecisionLog,
  blocDecisionLog as decisionLogSection,
};
