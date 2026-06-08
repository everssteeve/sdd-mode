// AIAD SDD Mode — Verdict Drift Lock déterministe (items §3.3 + §3.4b).
//
// **Cap stratégique** : le hook harness `Stop` (Drift Lock) et la CI doivent
// décider « clôture autorisée ? » sur un verdict machine, pas sur le jugement
// du modèle. Ce module transforme la matrice de traçabilité (`construireMatrice`)
// en une enveloppe de verdict conforme à `.aiad/schema/verdicts/trace.schema.json`.
//
// **Sémantique des exit codes** (cohérente CLAUDE.md « INCONNU ≠ OK ») :
//   PASS (0)  — aucun gap bloquant et traçabilité décidable.
//   FAIL (1)  — au moins un drift machine-vérifiable (SPEC validée sans code,
//               SPEC/Intent référencé par le code mais absent des artefacts).
//   JNSP (2)  — annotations `@spec` totalement absentes : on ne peut pas
//               *décider* du drift → décision humaine requise (fail-closed).
//
// Le `--json` historique de `trace` (matrice complète) reste INCHANGÉ : ce
// module alimente un mode verdict distinct (`trace --output-format verdict`).
//
// **Zero-dep**.
//
// @intent INTENT-002
// @spec SPEC-002-1-gouvernance-enforced
// @verified-by test/drift-verdict.test.js
//
// Documentation : https://aiad.ovh

import { construireMatrice } from './sdd-trace.js';
import { emitVerdict } from './verdict.js';

/**
 * Compte les gaps bloquants (mêmes critères que la CI `--fail-on-gap`).
 * Dupliqué volontairement ici car la fonction d'origine est privée à
 * `sdd-trace.js` — on évite d'élargir sa surface publique.
 *
 * @param {object} m — modèle de matrice
 * @returns {number}
 */
export function compterGapsBloquants(m) {
  return (
    m.gaps.specsValideesNonImplementees.length +
    m.gaps.specsOrphelinsSurCode.length +
    m.gaps.intentsOrphelinsSurCode.length
  );
}

/**
 * Construit la liste de gaps normalisée pour le schéma de verdict.
 *
 * @param {object} m — modèle de matrice
 * @returns {Array<{kind: string, ref: string, file?: string, blocking: boolean}>}
 */
export function listerGaps(m) {
  const gaps = [];
  for (const x of m.gaps.specsValideesNonImplementees) {
    gaps.push({ kind: 'spec_validated_not_implemented', ref: x.id, blocking: true });
  }
  for (const x of m.gaps.specsOrphelinsSurCode) {
    gaps.push({ kind: 'spec_orphan_in_code', ref: x.id, file: `${x.file}:${x.line}`, blocking: true });
  }
  for (const x of m.gaps.intentsOrphelinsSurCode) {
    gaps.push({ kind: 'intent_orphan_in_code', ref: x.id, file: `${x.file}:${x.line}`, blocking: true });
  }
  // Code sans @spec : non bloquant en soi, mais utile au message de rewake.
  for (const f of m.gaps.codeSansSpec) {
    gaps.push({ kind: 'code_without_spec', ref: f.path, file: f.path, blocking: false });
  }
  return gaps;
}

/**
 * Calcule le verdict Drift Lock à partir d'un modèle de matrice.
 *
 * @param {object} modele
 * @returns {{ verdict: 'PASS'|'FAIL'|'JNSP', gaps: object[], coverage: number }}
 */
export function calculerVerdictDrift(modele) {
  const { codeFiles, annotatedCodeFiles } = modele.summary;
  const coverage = codeFiles > 0 ? annotatedCodeFiles / codeFiles : 1;
  const gaps = listerGaps(modele);

  let verdict;
  if (codeFiles > 0 && annotatedCodeFiles === 0) {
    verdict = 'JNSP'; // annotations totalement absentes — indécidable
  } else if (compterGapsBloquants(modele) > 0) {
    verdict = 'FAIL';
  } else {
    verdict = 'PASS';
  }
  return { verdict, gaps, coverage };
}

/**
 * Émet le verdict Drift Lock (enveloppe canonique + exit code).
 * Ne fait pas d'effet de bord process : retourne `{ code, enveloppe, ... }`.
 *
 * @param {string} projetDir
 * @param {{ json?: boolean, schema?: object, stream?: {write: Function} }} [opts]
 * @returns {{ code: 0|1|2, verdict: string, enveloppe: object, valide: boolean, erreurs: string[] }}
 */
export function emitDriftVerdict(projetDir, { json = false, schema = null, stream = process.stdout } = {}) {
  const modele = construireMatrice(projetDir);
  const { verdict, gaps, coverage } = calculerVerdictDrift(modele);
  return emitVerdict({ verdict, payload: { gaps, coverage }, schema, json, stream });
}

// ─── Aliases EN ─────────────────────────────────────────────────────────────

export {
  compterGapsBloquants as countBlockingGaps,
  listerGaps as listGaps,
  calculerVerdictDrift as computeDriftVerdict,
  emitDriftVerdict as emitDrift,
};
