// AIAD SDD Mode — Mini-gate par tranche d'exécution (§3.6).
//
// **Cap stratégique** : à la fin de chaque tranche verticale (et non à la fin
// d'une longue passe horizontale), on valide mécaniquement « cette tranche
// a-t-elle livré son incrément ET ses tests ? ». Le verdict n'est pas le
// jugement libre du modèle : il est recalculé ici de façon déterministe et
// mappé sur le contrat canonique (`lib/verdict.js`), avec exit 0/1/2.
//
// Verdicts (cohérents §3.4) :
//   PASS         (0) — tranche livrée : tests présents, aucune dette ouverte.
//   CONDITIONAL  (0) — tranche acceptable mais porte une dette explicitée
//                      (conditions non vides à lever avant la gate finale).
//   FAIL         (1) — tranche bloquée, sans tests (code horizontal) ou tests
//                      non livrés / rouges.
//   JNSP         (2) — plan/tranche indécidable (introuvable, non parsable).
//
// `UNKNOWN = VETO` : une tranche non décidable force JNSP, jamais CONDITIONAL.
//
// L'exécution réelle des tests est *injectable* (`runner`) — par défaut on
// vérifie que la tranche a **livré** ses fichiers de test (présence sur disque),
// ce qui suffit à interdire le « code horizontal sans test ». La CI / l'agent
// exécutent la suite ; le runner permet de brancher cette exécution.
//
// **Zero-dep**.
//
// @intent INTENT-004
// @spec SPEC-004-1-execution-phasee
// @verified-by test/mini-gate.test.js
//
// Documentation : https://aiad.ovh

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parserPlan, chargerPlan } from './exec-status.js';
import { emitVerdict } from './verdict.js';

/**
 * Calcule le verdict mini-gate d'une tranche à partir de son modèle.
 *
 * @param {object} phase — phase issue de {@link parserPlan}
 * @param {string} projetDir
 * @param {{ runner?: (phase: object) => { ok: boolean, output?: string } }} [opts]
 * @returns {{ verdict: 'PASS'|'CONDITIONAL'|'FAIL'|'JNSP', conditions: string[], evidence: object[], raisons: string[] }}
 */
export function calculerMiniGate(phase, projetDir, { runner } = {}) {
  const raisons = [];
  const evidence = [];

  if (!phase) {
    return { verdict: 'JNSP', conditions: [], evidence, raisons: ['Tranche introuvable dans le plan.'] };
  }

  // Hors-scope : rien à valider.
  if (phase.statut.key === 'out-of-scope') {
    return { verdict: 'PASS', conditions: [], evidence, raisons: ['Tranche hors-scope [-] — non gatée.'] };
  }

  // Bloquée : échec explicite.
  if (phase.statut.key === 'blocked') {
    raisons.push('Tranche marquée bloquée [!].');
    return { verdict: 'FAIL', conditions: [], evidence, raisons };
  }

  // Anti « code horizontal » : une tranche verticale DOIT livrer ses tests.
  if (!phase.tests || phase.tests.length === 0) {
    raisons.push('Aucun test déclaré pour la tranche (anti code horizontal — livre une tranche testable).');
    return { verdict: 'FAIL', conditions: [], evidence, raisons };
  }

  // Tests livrés ? (présence sur disque)
  const manquants = [];
  for (const t of phase.tests) {
    const present = existsSync(join(projetDir, t));
    evidence.push({ test: t, present });
    if (!present) manquants.push(t);
  }
  if (manquants.length > 0) {
    raisons.push(`Tests non livrés : ${manquants.join(', ')}.`);
    return { verdict: 'FAIL', conditions: [], evidence, raisons };
  }

  // Exécution réelle (optionnelle, injectable).
  if (typeof runner === 'function') {
    const r = runner(phase) || {};
    if (!r.ok) {
      raisons.push(`Tests rouges${r.output ? ` : ${r.output}` : ''}.`);
      return { verdict: 'FAIL', conditions: [], evidence, raisons };
    }
    raisons.push('Tests verts (runner).');
  } else {
    raisons.push('Tests présents (livrés). Exécution déléguée à la CI / au runner.');
  }

  // Dette explicitée → CONDITIONAL (conditions non vides exigées par le contrat).
  if (phase.conditions && phase.conditions.length > 0) {
    raisons.push('Dette ouverte — CONDITIONAL PASS, à lever avant la gate finale.');
    return { verdict: 'CONDITIONAL', conditions: phase.conditions, evidence, raisons };
  }

  raisons.push('Tranche livrée, aucune dette ouverte.');
  return { verdict: 'PASS', conditions: [], evidence, raisons };
}

/**
 * Émet le verdict mini-gate d'une tranche (enveloppe canonique + exit code).
 *
 * @param {string} projetDir
 * @param {string} specId
 * @param {number} phaseNum
 * @param {{ json?: boolean, schema?: object, runner?: Function, stream?: {write: Function} }} [opts]
 * @returns {{ code: 0|1|2, verdict: string, enveloppe: object, valide: boolean, erreurs: string[] }}
 */
export function emitMiniGate(projetDir, specId, phaseNum, { json = false, schema = null, runner, stream = process.stdout } = {}) {
  const plan = chargerPlan(projetDir, specId);
  if (!plan) {
    return emitVerdict({
      verdict: 'JNSP',
      payload: { phase: phaseNum ?? null, titre: null, conditions: [], evidence: [], raisons: [`Plan d'exécution introuvable pour « ${specId} » — lance d'abord /sdd exec.`] },
      schema, json, stream,
    });
  }
  const modele = parserPlan(plan.contenu);
  const phase = modele.phases.find((p) => p.num === Number(phaseNum));
  const r = calculerMiniGate(phase, projetDir, { runner });
  return emitVerdict({
    verdict: r.verdict,
    payload: { phase: phase ? phase.num : (phaseNum ?? null), titre: phase ? phase.titre : null, conditions: r.conditions, evidence: r.evidence, raisons: r.raisons },
    schema, json, stream,
  });
}

/**
 * Verdict agrégé d'un plan complet : FAIL si une tranche comptable échoue,
 * CONDITIONAL si au moins une porte une dette (et aucune FAIL), JNSP si une
 * tranche est indécidable, PASS sinon. Les tranches hors-scope sont ignorées.
 *
 * @param {object} plan — sortie de {@link parserPlan}
 * @param {string} projetDir
 * @param {{ runner?: Function }} [opts]
 * @returns {{ verdict: string, conditions: string[], parTranche: object[] }}
 */
export function calculerMiniGatePlan(plan, projetDir, { runner } = {}) {
  const parTranche = [];
  const conditions = [];
  let aFail = false;
  let aJnsp = false;
  let aConditional = false;
  for (const phase of plan.phases) {
    if (phase.statut.key === 'out-of-scope') continue;
    const r = calculerMiniGate(phase, projetDir, { runner });
    parTranche.push({ num: phase.num, titre: phase.titre, verdict: r.verdict, conditions: r.conditions });
    if (r.verdict === 'FAIL') aFail = true;
    else if (r.verdict === 'JNSP') aJnsp = true;
    else if (r.verdict === 'CONDITIONAL') { aConditional = true; conditions.push(...r.conditions); }
  }
  let verdict = 'PASS';
  if (aFail) verdict = 'FAIL';
  else if (aJnsp) verdict = 'JNSP';
  else if (aConditional) verdict = 'CONDITIONAL';
  return { verdict, conditions, parTranche };
}

// ─── Aliases EN ─────────────────────────────────────────────────────────────

export {
  calculerMiniGate as computeMiniGate,
  emitMiniGate as emitMiniGateVerdict,
  calculerMiniGatePlan as computeMiniGatePlan,
};
