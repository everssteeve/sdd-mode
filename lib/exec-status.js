// AIAD SDD Mode — Exécution phasée : plan en tranches verticales + statut (§3.6).
//
// **Cap stratégique** : `/sdd exec` lançait l'agent en une passe avec une gate
// unique en amont, puis laissait filer — le modèle « code horizontalement »
// (Dex : ~1200 lignes avant le moindre test). On découpe l'exécution en
// **tranches verticales testables**, chacune livrant un incrément + ses tests,
// et on suit l'avancement par des marqueurs machine-vérifiables.
//
// Ce module parse l'artefact `.aiad/exec/EXEC-<spec>-plan.md` en un modèle
// structuré (phases + champs + statut) et calcule la progression et la
// prochaine tranche à reprendre (consommé par `/sdd resume`). Le *verdict*
// d'une tranche est calculé séparément par `lib/mini-gate.js`.
//
// Marqueurs de statut (cohérents plan §4.1) :
//   [ ] à faire · [~] en cours · [x] validé · [!] bloqué · [-] hors-scope
//
// **Zero-dep**.
//
// @intent INTENT-004
// @spec SPEC-004-1-execution-phasee
// @verified-by test/exec-status.test.js
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Marqueur (caractère entre crochets) → statut canonique. */
export const STATUTS = Object.freeze({
  ' ': { key: 'todo', label: 'À faire', symbole: '[ ]' },
  '~': { key: 'in-progress', label: 'En cours', symbole: '[~]' },
  x: { key: 'done', label: 'Validé', symbole: '[x]' },
  '!': { key: 'blocked', label: 'Bloqué', symbole: '[!]' },
  '-': { key: 'out-of-scope', label: 'Hors-scope', symbole: '[-]' },
});

// Titre de phase : `## Phase N — <titre>  [m]` (marqueur en fin de ligne, ou
// au début sous forme de case à cocher `- [m]`). On tolère `Phase`/`Tranche`.
const RE_PHASE = /^#{2,3}\s+(?:Phase|Tranche)\s+(\d+)\s*[—:-]\s*(.*?)\s*(?:`?\[([ x~!-])\]`?)?\s*$/i;
const RE_CHECK = /^\s*[-*]\s+`?\[([ x~!-])\]`?\s+(?:Phase|Tranche)\s+(\d+)\s*[—:-]\s*(.*\S)\s*$/i;

/** Normalise un marqueur brut (`x`, ` `, `~`, `!`, `-`) → statut canonique. */
export function statutDepuisMarqueur(m) {
  const clef = m === '' || m == null ? ' ' : m.toLowerCase();
  return STATUTS[clef] || STATUTS[' '];
}

/** Items d'une liste à puces sous une étiquette `Champ : a, b` ou bullets. */
function valeursListe(brut) {
  if (!brut) return [];
  return brut
    .split(/[,\n]/)
    .map((s) => s.replace(/^\s*[-*]\s*/, '').trim())
    .filter((s) => s && !/^[…\-]+$/.test(s) && !/^<.*>$/.test(s));
}

/**
 * Parse un plan d'exécution phasé en modèle structuré.
 *
 * @param {string} contenu — Markdown du plan
 * @returns {{
 *   phases: Array<{ num: number, titre: string, statut: object,
 *     objectif: string, fichiers: string[], tests: string[],
 *     done: string[], conditions: string[] }>,
 *   summary: { total: number, done: number, inProgress: number,
 *     blocked: number, todo: number, outOfScope: number },
 * }}
 */
export function parserPlan(contenu) {
  const lignes = String(contenu).split('\n');
  const phases = [];
  let courante = null;
  let champ = null; // dernier champ ouvert (pour collecter des bullets multi-lignes)

  const pousser = () => { if (courante) phases.push(courante); };

  for (const ligne of lignes) {
    const mh = ligne.match(RE_PHASE);
    const mc = ligne.match(RE_CHECK);
    if (mh || mc) {
      pousser();
      const num = Number(mh ? mh[1] : mc[2]);
      const titre = (mh ? mh[2] : mc[3]).trim();
      const marqueur = (mh ? mh[3] : mc[1]) || ' ';
      courante = {
        num, titre, statut: statutDepuisMarqueur(marqueur),
        objectif: '', fichiers: [], tests: [], done: [], conditions: [],
      };
      champ = null;
      continue;
    }
    if (!courante) continue;

    // Champ étiqueté : `- Objectif : …`, `- Fichiers : a, b`, `Tests : …`, etc.
    const mf = ligne.match(/^\s*(?:[-*]\s*)?(Objectif|Fichiers?|Tests?|Done|Critères?\s+de\s+done|Conditions?)\s*:\s*(.*)$/i);
    if (mf) {
      const clef = mf[1].toLowerCase();
      const val = mf[2].trim();
      if (/^objectif/.test(clef)) { courante.objectif = val; champ = 'objectif'; }
      else if (/^fichier/.test(clef)) { courante.fichiers = valeursListe(val); champ = 'fichiers'; }
      else if (/^test/.test(clef)) { courante.tests = valeursListe(val); champ = 'tests'; }
      else if (/^condition/.test(clef)) { courante.conditions = valeursListe(val); champ = 'conditions'; }
      else { courante.done = valeursListe(val); champ = 'done'; } // done / critères de done
      continue;
    }

    // Bullet de continuation pour un champ-liste ouvert.
    const mb = ligne.match(/^\s+[-*]\s+(.*\S)\s*$/);
    if (mb && champ && champ !== 'objectif') {
      const v = mb[1].trim();
      if (v && !/^[…\-]+$/.test(v) && !/^<.*>$/.test(v)) courante[champ].push(v);
    }
  }
  pousser();

  const summary = { total: phases.length, done: 0, inProgress: 0, blocked: 0, todo: 0, outOfScope: 0 };
  for (const p of phases) {
    if (p.statut.key === 'done') summary.done++;
    else if (p.statut.key === 'in-progress') summary.inProgress++;
    else if (p.statut.key === 'blocked') summary.blocked++;
    else if (p.statut.key === 'out-of-scope') summary.outOfScope++;
    else summary.todo++;
  }
  return { phases, summary };
}

/**
 * Progression d'un plan : ratio de tranches validées sur les tranches
 * « comptables » (hors-scope exclues).
 *
 * @param {object} plan — sortie de {@link parserPlan}
 * @returns {{ done: number, comptables: number, ratio: number }}
 */
export function progression(plan) {
  const comptables = plan.summary.total - plan.summary.outOfScope;
  const ratio = comptables > 0 ? plan.summary.done / comptables : 1;
  return { done: plan.summary.done, comptables, ratio };
}

/**
 * Prochaine tranche à traiter (reprise `/sdd resume`) : priorité à une tranche
 * en cours `[~]`, puis bloquée `[!]`, puis la première à faire `[ ]`.
 *
 * @param {object} plan
 * @returns {object|null} la phase, ou null si tout est validé/hors-scope.
 */
export function prochaineTranche(plan) {
  return (
    plan.phases.find((p) => p.statut.key === 'in-progress') ||
    plan.phases.find((p) => p.statut.key === 'blocked') ||
    plan.phases.find((p) => p.statut.key === 'todo') ||
    null
  );
}

/** Rendu console compact de l'avancement. */
export function rendreStatut(plan) {
  const { ratio, done, comptables } = progression(plan);
  const lignes = plan.phases.map((p) => `  ${p.statut.symbole} Phase ${p.num} — ${p.titre}`);
  lignes.push('', `  Progression : ${done}/${comptables} tranches (${Math.round(ratio * 100)} %)`);
  return lignes.join('\n');
}

/**
 * Localise et charge un plan d'exécution par identifiant de SPEC.
 *
 * @param {string} projetDir
 * @param {string} specId — SPEC-NNN(-…) ou nom de fichier
 * @returns {{ path: string, contenu: string }|null}
 */
export function chargerPlan(projetDir, specId) {
  const dir = join(projetDir, '.aiad', 'exec');
  if (!existsSync(dir)) return null;
  const norm = String(specId || '').toLowerCase();
  const fichier = readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== '_index.md')
    .find((f) => f.toLowerCase().includes(norm) || f.toLowerCase().includes(`exec-${norm}`));
  if (!fichier) return null;
  const path = join(dir, fichier);
  return { path, contenu: readFileSync(path, 'utf-8') };
}

// ─── Aliases EN ─────────────────────────────────────────────────────────────

export {
  STATUTS as STATUSES,
  statutDepuisMarqueur as statusFromMarker,
  parserPlan as parsePlan,
  progression as progress,
  prochaineTranche as nextSlice,
  rendreStatut as renderStatus,
  chargerPlan as loadPlan,
};
