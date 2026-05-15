// AIAD SDD Mode — Dashboard : arbre des objectifs (#474).
//
// Visualise la hiérarchie produit canonique :
//   North Star (PRD §2)
//     ├── Outcome A (PRD §4)
//     │     ├── INTENT-X
//     │     │     ├── SPEC-X.1
//     │     │     └── SPEC-X.2
//     │     └── INTENT-Y
//     └── Outcome B
//           └── INTENT-Z
//
// Source des liaisons :
//   - North Star : `## 2. North Star / Product Goal` du PRD.md
//   - Outcomes → Intents : déjà calculé par #428 (prdCoverage.outcomes)
//   - Intents → SPECs : déjà calculé par #421 (specsParIntent)
//
// Rendu : ASCII-art arbre avec connecteurs (├ └) + version HTML
// indentée avec lignes verticales CSS.
//
// Aucun effet de bord. Pure transformation.
//
// Documentation : https://aiad.ovh

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from '../frontmatter.js';
import { lireFichier } from './collect.js';

const PATTERN_NORTH_STAR = /^##\s+(?:\d+\.\s+)?(?:North\s+Star|North\s+Star\s*\/\s*Product\s+Goal|Product\s+Goal)\s*$/im;

export function lireNorthStar(racineProjet) {
  const chemin = join(racineProjet, '.aiad', 'PRD.md');
  if (!existsSync(chemin)) return null;
  const contenu = lireFichier(chemin);
  if (!contenu) return null;
  const { body } = parseFrontmatter(contenu);
  const lignes = body.split(/\r?\n/);
  let i = 0;
  for (; i < lignes.length; i++) {
    if (PATTERN_NORTH_STAR.test(lignes[i])) break;
  }
  if (i === lignes.length) return null;
  // Capture lignes jusqu'à la prochaine `##`.
  const parts = [];
  for (let j = i + 1; j < lignes.length; j++) {
    if (/^##\s+/.test(lignes[j])) break;
    const t = lignes[j].trim();
    if (t && !/^\[.*\]$/.test(t)) parts.push(t);
  }
  const text = parts.join(' ').replace(/<!--[\s\S]*?-->/g, '').trim();
  return text || null;
}

export function calculerGoalTree(racineProjet, donnees) {
  const northStar = lireNorthStar(racineProjet);
  const outcomes = donnees?.prdCoverage?.outcomes || [];
  const intents = donnees?.intents || [];
  const specsParIntentLong = donnees?.specsParIntent;
  // Reconstruit la map court → SPECs (cf. pm.js#indexerContextePm).
  const specsParIntent = new Map();
  const courtVersLong = new Map();
  for (const i of intents) {
    const court = i.id.split('-').slice(0, 2).join('-');
    if (!courtVersLong.has(court)) courtVersLong.set(court, i.id);
    specsParIntent.set(i.id, []);
  }
  for (const s of donnees?.specs || []) {
    if (!s.parentIntent) continue;
    const court = s.parentIntent.split('-').slice(0, 2).join('-');
    const longId = courtVersLong.get(court);
    if (longId) specsParIntent.get(longId).push(s);
  }

  // Pour chaque outcome, expanse ses Intents et leurs SPECs.
  const arbre = outcomes.map((o) => {
    const intentsExpanded = (o.intents || []).map((iRef) => {
      const intent = intents.find((x) => x.id === iRef.id) || iRef;
      return {
        id: intent.id,
        titre: intent.titre || '',
        statut: intent.statut || null,
        file: intent.file || null,
        specs: (specsParIntent.get(intent.id) || []).map((s) => ({
          id: s.id, titre: s.titre || '', statut: s.statut, file: s.file || null,
        })),
      };
    });
    return {
      id: o.critere || '',
      cible: o.cible || '',
      baseline: o.baseline || '',
      etat: o.etat || null,
      intents: intentsExpanded,
    };
  });
  // Intents sans outcome rattaché (orphelins de l'arbre).
  const intentsLies = new Set();
  for (const o of arbre) for (const i of o.intents) intentsLies.add(i.id);
  const intentsOrphelins = intents
    .filter((i) => !intentsLies.has(i.id))
    .map((i) => ({
      id: i.id, titre: i.titre || '', statut: i.statut || null, file: i.file || null,
      specs: (specsParIntent.get(i.id) || []).map((s) => ({
        id: s.id, titre: s.titre || '', statut: s.statut, file: s.file || null,
      })),
    }));
  return {
    northStar,
    outcomes: arbre,
    intentsOrphelins,
    totaux: {
      outcomes: arbre.length,
      intentsLies: intentsLies.size,
      intentsOrphelins: intentsOrphelins.length,
    },
  };
}

// ─── Rendu HTML ──────────────────────────────────────────────────────────────

import { escape, lienSource, statutBadge } from './render.js';

const GT_CSS = `<style>
.gt-tree { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.85rem; line-height:1.55; }
.gt-northstar { padding:.5rem .75rem; margin:.5rem 0; background: rgba(76,110,245,.07); border-left:4px solid #4c6ef5; border-radius:.3rem; font-weight:500; }
.gt-northstar-label { font-size:.7rem; text-transform:uppercase; letter-spacing:.05em; color: var(--muted, #777); display:block; margin-bottom:.15rem; }
.gt-outcome { margin:.55rem 0; padding-left:1rem; border-left:2px solid rgba(76,110,245,.4); }
.gt-outcome-titre { font-weight:600; font-size:.92rem; font-family: inherit; }
.gt-outcome-meta { font-size:.72rem; color: var(--muted, #777); margin-left:.4rem; }
.gt-intent { margin:.25rem 0 .25rem 1.2rem; padding-left:.6rem; border-left:1px solid rgba(127,127,127,.25); font-size:.85rem; font-family: inherit; }
.gt-spec { margin:.1rem 0 .1rem 1.5rem; padding-left:.5rem; border-left:1px dotted rgba(127,127,127,.3); font-size:.78rem; color: var(--muted, #777); font-family: inherit; }
.gt-orphelins { margin-top:.7rem; padding:.5rem .7rem; background: rgba(232,89,12,.05); border-left:4px solid #e8590c; border-radius:.3rem; }
.gt-empty { color: var(--muted, #777); font-style: italic; font-size:.8rem; padding-left:1rem; }
</style>`;

function refSpec(s) {
  const idCell = s.file ? lienSource(s.file, s.id) : `<code>${escape(s.id)}</code>`;
  return `${idCell} ${statutBadge(s.statut)} <span style="font-size:.72rem">${escape(s.titre)}</span>`;
}

function refIntent(i) {
  const idCell = i.file ? lienSource(i.file, i.id) : `<code>${escape(i.id)}</code>`;
  const specs = i.specs.map((s) => `<div class="gt-spec">└─ ${refSpec(s)}</div>`).join('');
  return `<div class="gt-intent">├─ ${idCell} ${statutBadge(i.statut)} <strong>${escape(i.titre)}</strong></div>${specs}`;
}

export function blocGoalTree(donnees) {
  const t = donnees?.goalTree;
  if (!t) return '';
  const ns = t.northStar
    ? `<div class="gt-northstar"><span class="gt-northstar-label">North Star · PRD §2</span>${escape(t.northStar)}</div>`
    : '<p class="muted" style="font-size:.85rem">_North Star non défini dans PRD §2._</p>';
  let outcomeBlocs = '';
  if (t.outcomes.length === 0) {
    outcomeBlocs = '<p class="gt-empty">_Aucun Outcome déclaré dans PRD §4._</p>';
  } else {
    outcomeBlocs = t.outcomes.map((o) => {
      const intents = o.intents.length === 0
        ? '<div class="gt-empty">_Aucun Intent rattaché — outcome orphelin._</div>'
        : o.intents.map(refIntent).join('');
      return `<div class="gt-outcome">
        <span class="gt-outcome-titre">📊 ${escape(o.id)}</span>
        <span class="gt-outcome-meta">${escape(o.baseline)} → ${escape(o.cible)}${o.etat ? ` · ${escape(o.etat)}` : ''}</span>
        ${intents}
      </div>`;
    }).join('');
  }
  const orphelins = t.intentsOrphelins.length > 0
    ? `<div class="gt-orphelins">
        <strong>${t.intentsOrphelins.length} Intent(s) sans outcome rattaché</strong> — ajoute <code>outcomes: [Nom Critère]</code> dans le frontmatter pour les relier au PRD §4 :
        <ul style="margin:.3rem 0 0; padding-left:1.5rem; font-size:.8rem">
          ${t.intentsOrphelins.slice(0, 5).map((i) => `<li>${i.file ? lienSource(i.file, i.id) : `<code>${escape(i.id)}</code>`} — ${escape(i.titre)}</li>`).join('')}
        </ul>
      </div>`
    : '';
  const tot = t.totaux;
  return `${GT_CSS}<section>
    <h2>Arbre des objectifs <span class="count">North Star → ${tot.outcomes} outcome(s) → ${tot.intentsLies}/${tot.intentsLies + tot.intentsOrphelins} Intents reliés</span></h2>
    <p class="muted" style="font-size:.85rem">Hiérarchie produit canonique : <strong>North Star</strong> (PRD §2) → <strong>Outcomes mesurables</strong> (PRD §4) → <strong>Intents</strong> qui les servent (#428) → <strong>SPECs</strong> qui livrent les Intents.</p>
    <div class="gt-tree">
      ${ns}
      ${outcomeBlocs}
    </div>
    ${orphelins}
  </section>`;
}

// Alias EN canoniques (#42)
export {
  lireNorthStar as readNorthStar,
  calculerGoalTree as computeGoalTree,
  blocGoalTree as goalTreeSection,
};
