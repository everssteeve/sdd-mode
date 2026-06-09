// AIAD SDD Mode — Pattern « grill me » : gate humain interactif (garde-fou GF4, §4).
//
// **Cap stratégique** : un gate humain efficace n'est pas un formulaire statique
// mais un **interrogatoire** (Matt Pocock « grill me », design-concept de Brooks)
// — **une question à la fois**, l'agent **propose sa réponse recommandée**,
// l'humain valide ou corrige. La paternité reste humaine (Human Authorship) :
// l'agent n'impose pas, il propose et attend l'arbitrage.
//
// Ce module ordonne une file de questions et délivre la **suivante non
// répondue** avec sa recommandation. Pur, déterministe, réutilisable par les
// modes `--guided` de `/sdd gate` et `/sdd research`.
//
// **Zero-dep**.
//
// @intent INTENT-012
// @spec SPEC-012-1-garde-fous
// @verified-by test/grill.test.js
//
// Documentation : https://aiad.ovh

/**
 * Sélectionne la prochaine question non répondue d'une file. Une question =
 * `{ id, question, recommandation?, obligatoire? }`. Les réponses sont indexées
 * par `id`. Retourne `null` quand tout est répondu (ou que seules restent des
 * questions optionnelles, si `inclureOptionnelles` est faux).
 *
 * @param {{ id: string, question: string, recommandation?: string, obligatoire?: boolean }[]} questions
 * @param {Record<string, unknown>} reponses
 * @param {{ inclureOptionnelles?: boolean }} [opts]
 * @returns {{ id: string, question: string, recommandation: string, obligatoire: boolean, reste: number }|null}
 */
export function prochaineQuestion(questions, reponses = {}, { inclureOptionnelles = true } = {}) {
  const enAttente = (questions || []).filter((q) => !aRepondu(reponses, q.id));
  const cibles = inclureOptionnelles ? enAttente : enAttente.filter((q) => q.obligatoire !== false);
  if (cibles.length === 0) return null;
  const q = cibles[0];
  return {
    id: q.id,
    question: q.question,
    recommandation: q.recommandation || '',
    obligatoire: q.obligatoire !== false,
    reste: cibles.length,
  };
}

function aRepondu(reponses, id) {
  if (!Object.prototype.hasOwnProperty.call(reponses, id)) return false;
  const v = reponses[id];
  return v !== undefined && v !== null && String(v).trim() !== '';
}

/**
 * Vrai si toutes les questions **obligatoires** ont une réponse.
 *
 * @param {object[]} questions
 * @param {Record<string, unknown>} reponses
 * @returns {boolean}
 */
export function grillComplet(questions, reponses = {}) {
  return (questions || []).filter((q) => q.obligatoire !== false).every((q) => aRepondu(reponses, q.id));
}

/**
 * Rend une question pour affichage interactif : intitulé + réponse recommandée
 * (que l'humain valide d'un mot ou corrige). Format « grill me » 1 question/tour.
 *
 * @param {{ id: string, question: string, recommandation: string, reste: number }} q
 * @returns {string}
 */
export function rendreQuestion(q) {
  if (!q) return '  ✓ Toutes les questions obligatoires sont tranchées.';
  const lignes = [`  ❓ ${q.question}`];
  if (q.recommandation) lignes.push(`     💡 Recommandation : ${q.recommandation}`);
  lignes.push(`     (valide d'un mot ou corrige — ${q.reste} question(s) restante(s))`);
  return lignes.join('\n');
}

// ─── Aliases EN ─────────────────────────────────────────────────────────────

export {
  prochaineQuestion as nextQuestion,
  grillComplet as grillComplete,
  rendreQuestion as renderQuestion,
};
