// AIAD SDD Mode — Veto Tier 1 déterministe par diff (item §3.1 levier 3).
//
// **Cap stratégique** : rendre le droit de veto réglementaire *enforced*. La
// partie *décidable par machine* — « ce changement touche-t-il une zone
// réglementée, et porte-t-il la preuve de revue (`@governance`) ? » — est
// calculée ici (fail-closed). La partie *jugement de conformité* reste au
// subagent Tier 1 read-only (`.claude/agents/AIAD-*.md`, §3.1 levier 2).
//
// Sémantique (cohérente CLAUDE.md « UNKNOWN = VETO ») :
//   - Un fichier de code touchant la zone d'un agent Tier 1 à glob étroit
//     (RGPD / RGAA / AI-ACT) DOIT porter `@governance AIAD-XXX`. Sinon la
//     revue ne peut être confirmée → `JNSP` (exit 2 = VETO fail-closed).
//   - AIAD-RGESN (`**/*`) reste advisory (le subagent l'applique) : exiger
//     l'annotation sur *tout* fichier serait du bruit — exclu du gate.
//
// **Zero-dep** (matcher de glob maison).
//
// @intent INTENT-002
// @spec SPEC-002-1-gouvernance-enforced
// @verified-by test/veto.test.js
// @governance AIAD-RGPD,AIAD-RGAA,AIAD-AI-ACT
//
// Documentation : https://aiad.ovh

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parserAnnotations, estTest } from './sdd-trace.js';
import { GLOBS_TIER1 } from './emit-rules.js';
import { emitVerdict } from './verdict.js';

/** Agents à glob étroit soumis au gate d'annotation (RGESN exclu). */
export const AGENTS_GATE = ['AIAD-RGPD', 'AIAD-RGAA', 'AIAD-AI-ACT'];

/**
 * Compile un glob (`**`, `*`, segments littéraux) en RegExp ancrée.
 * `**` = n'importe quelle profondeur ; `*` = un segment sans `/`.
 *
 * @param {string} glob
 * @returns {RegExp}
 */
export function globVersRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++; // consomme la seconde étoile
        if (glob[i + 1] === '/') {
          i++; // `**/` → zéro ou plusieurs segments
          re += '(?:.*/)?';
        } else {
          re += '.*'; // `**` final (ou suivi d'autre chose) → n'importe quoi
        }
      } else {
        re += '[^/]*';
      }
    } else if ('\\^$+?.()|[]{}'.includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

/** Vrai si `chemin` matche `glob`. */
export function matchGlob(glob, chemin) {
  return globVersRegex(glob).test(chemin);
}

/**
 * Agents Tier 1 (parmi {@link AGENTS_GATE}) concernés par un fichier.
 *
 * @param {string} chemin
 * @returns {string[]} agentIds déclenchés
 */
export function agentsConcernes(chemin) {
  return AGENTS_GATE.filter((id) => (GLOBS_TIER1[id] || []).some((g) => matchGlob(g, chemin)));
}

/**
 * Liste les fichiers modifiés via git (stagés par défaut, ou diff d'un ref).
 *
 * @param {string} projetDir
 * @param {{ diff?: string }} [opts]
 * @returns {string[]}
 */
export function fichiersModifies(projetDir, { diff } = {}) {
  const args = diff
    ? ['diff', '--name-only', '--diff-filter=ACMR', diff]
    : ['diff', '--cached', '--name-only', '--diff-filter=ACMR'];
  try {
    return execFileSync('git', args, { cwd: projetDir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Calcule le verdict de veto sur une liste de fichiers modifiés.
 * Une violation = fichier de code dans une zone Tier 1 sans `@governance`
 * référençant l'agent concerné.
 *
 * @param {string} projetDir
 * @param {string[]} fichiers
 * @returns {{ verdict: 'PASS'|'JNSP', triggered: string[], violations: object[] }}
 */
export function calculerVeto(projetDir, fichiers) {
  const triggered = new Set();
  const violations = [];

  for (const f of fichiers) {
    if (estTest(f)) continue; // les tests ne portent pas le veto
    const concernes = agentsConcernes(f);
    if (concernes.length === 0) continue;
    for (const id of concernes) triggered.add(id);

    const abs = join(projetDir, f);
    let tags = [];
    if (existsSync(abs)) {
      try {
        const ann = parserAnnotations(readFileSync(abs, 'utf-8'), f);
        tags = ann.governance.flatMap((g) => g.tags);
      } catch { /* illisible → traité comme non annoté (fail-closed) */ }
    }
    for (const id of concernes) {
      if (!tags.includes(id)) {
        violations.push({ file: f, agent: id, reason: `Zone ${id} sans annotation @governance ${id}` });
      }
    }
  }

  return {
    verdict: violations.length > 0 ? 'JNSP' : 'PASS',
    triggered: [...triggered],
    violations,
  };
}

/**
 * Émet le verdict de veto (enveloppe canonique + exit code).
 *
 * @param {string} projetDir
 * @param {{ diff?: string, json?: boolean, schema?: object, stream?: {write: Function} }} [opts]
 * @returns {{ code: 0|1|2, verdict: string, enveloppe: object, valide: boolean, erreurs: string[] }}
 */
export function emitVeto(projetDir, { diff, json = false, schema = null, stream = process.stdout } = {}) {
  const fichiers = fichiersModifies(projetDir, { diff });
  const { verdict, triggered, violations } = calculerVeto(projetDir, fichiers);
  return emitVerdict({ verdict, payload: { triggered, violations }, schema, json, stream });
}

// ─── Aliases EN ─────────────────────────────────────────────────────────────

export {
  globVersRegex as globToRegex,
  matchGlob as globMatch,
  agentsConcernes as agentsForFile,
  fichiersModifies as changedFiles,
  calculerVeto as computeVeto,
  emitVeto as emitVetoVerdict,
};
