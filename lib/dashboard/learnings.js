// AIAD SDD Mode — Dashboard : compteur Lessons Learned + Human Learnings
// dans `.aiad/AGENT-GUIDE.md` (#200, persona Agents Engineer).
//
// Audit DASHBOARD-AUDIT.md ligne 98 : "Lessons Learned counter absent —
// combien d'entrées AGENT-GUIDE > Lessons Learned ce sprint ?"
//
// Source : sections H2 `## Lessons Learned` et `## Human Learnings` du
// fichier `.aiad/AGENT-GUIDE.md`. Conventions de format (idiomatiques AIAD) :
//   - Listes à puces `- LL-NNN : ...` ou `- texte libre`
//   - Listes numérotées `1. texte`
//   - Sections ignorées si elles ne contiennent que `_(vide à l'init)_`
//     ou un placeholder italique
//
// Sortie : `{fichier, lessonsLearned: {total, entrees}, humanLearnings: {total, entrees}}`.

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const PATTERN_H2 = /^##\s+(.+?)\s*$/;
const PATTERN_LISTE = /^\s*(?:[-*]\s+|\d+\.\s+)(.+?)\s*$/;
// Lignes à ignorer : citations `>`, italique seul `_..._`, placeholders.
const PATTERN_PLACEHOLDER = /^_\(?vide|^_\(à compléter|^_\(vide à l'init\)_$/i;

function extraireEntrees(lignes, debutIdx, finIdx) {
  const entrees = [];
  for (let i = debutIdx; i < finIdx; i++) {
    const ligne = lignes[i];
    const t = ligne.trim();
    if (!t) continue;
    if (t.startsWith('>')) continue; // blockquote = description, pas une entrée
    if (PATTERN_PLACEHOLDER.test(t)) continue;
    const m = ligne.match(PATTERN_LISTE);
    if (m) {
      entrees.push({ ligne: i + 1, texte: m[1].slice(0, 200) });
    }
  }
  return entrees;
}

function parserSection(lignes, titreRegex) {
  let debut = -1;
  let fin = lignes.length;
  for (let i = 0; i < lignes.length; i++) {
    const m = lignes[i].match(PATTERN_H2);
    if (!m) continue;
    if (debut < 0 && titreRegex.test(m[1])) {
      debut = i + 1;
    } else if (debut >= 0) {
      // Section suivante = fin de la section courante
      fin = i;
      break;
    }
  }
  if (debut < 0) return { entrees: [], debut: null, fin: null };
  return { entrees: extraireEntrees(lignes, debut, fin), debut, fin };
}

export function compterLearnings(racineProjet, options = {}) {
  const chemin = options.fichier || join(racineProjet, '.aiad', 'AGENT-GUIDE.md');
  if (!existsSync(chemin)) {
    return {
      fichier: null,
      lessonsLearned: { total: 0, entrees: [] },
      humanLearnings: { total: 0, entrees: [] },
    };
  }
  let contenu;
  try { contenu = readFileSync(chemin, 'utf-8'); }
  catch {
    return {
      fichier: null,
      lessonsLearned: { total: 0, entrees: [] },
      humanLearnings: { total: 0, entrees: [] },
    };
  }
  const lignes = contenu.split('\n');
  const lessons = parserSection(lignes, /^lessons learned\b/i);
  const human = parserSection(lignes, /^human learnings\b/i);
  return {
    fichier: relative(racineProjet, chemin),
    lessonsLearned: { total: lessons.entrees.length, entrees: lessons.entrees.slice(0, 30) },
    humanLearnings: { total: human.entrees.length, entrees: human.entrees.slice(0, 30) },
  };
}

// ─── Rendu HTML ─────────────────────────────────────────────────────────────

import { escape, lienSource, lienSourceLigne } from './render.js';

export function blocLearnings(donnees) {
  const learnings = donnees?.learnings;
  if (!learnings) return '';
  const totalLL = learnings.lessonsLearned?.total || 0;
  const totalHL = learnings.humanLearnings?.total || 0;
  // (#200) Section omise quand l'AGENT-GUIDE.md est absent — évite de
  // polluer le dashboard avec une section vide qui n'apporte rien.
  if (!learnings.fichier && totalLL === 0 && totalHL === 0) return '';

  function tableEntrees(entrees) {
    if (entrees.length === 0) return '<p class="muted" style="font-size:.85rem">Aucune entrée capturée.</p>';
    // (#311) Ligne hyperliée vers AGENT-GUIDE.md#LNN (cohérent #309 ADRs).
    const rows = entrees.slice(0, 20).map((e) => `
      <tr>
        <td class="muted" style="white-space:nowrap">${learnings.fichier ? lienSourceLigne(learnings.fichier, e.ligne) : `L${e.ligne}`}</td>
        <td>${escape(e.texte)}</td>
      </tr>`).join('');
    return `<table>
      <thead><tr><th>Ligne</th><th>Entrée</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  return `<section>
    <h2>Lessons Learned & Human Learnings <span class="count">${totalLL + totalHL}</span></h2>
    <div class="kpis">
      <div class="kpi"><div class="label">Lessons Learned</div><div class="value">${totalLL}</div><div class="delta">alimentées par <code>/aiad retro</code></div></div>
      <div class="kpi"><div class="label">Human Learnings</div><div class="value">${totalHL}</div><div class="delta">alimentées par <code>/aiad intention</code></div></div>
    </div>
    ${learnings.fichier ? `<p class="muted" style="font-size:.85rem">Source : ${lienSource(learnings.fichier)}</p>` : ''}
    <details ${totalLL > 0 ? 'open' : ''}>
      <summary><strong>Lessons Learned</strong> (${totalLL})</summary>
      ${tableEntrees(learnings.lessonsLearned?.entrees || [])}
    </details>
    <details ${totalHL > 0 ? 'open' : ''}>
      <summary><strong>Human Learnings</strong> (${totalHL})</summary>
      ${tableEntrees(learnings.humanLearnings?.entrees || [])}
    </details>
  </section>`;
}

// Alias EN canoniques (#42)
export {
  compterLearnings as countLearnings,
  blocLearnings as learningsSection,
};
