// AIAD SDD Mode — Canary suite + alignement des références modèles (item §3.10).
//
// **Cap stratégique** : « frozen weights ≠ frozen behavior ». La variance de
// serving mesurée (±8-14 % : bugs infra, routing MoE, post-training silencieux,
// context pollution comme cause #1) interdit de distinguer une **régression
// réelle** d'un **bruit de serving** sans point de référence stable. Sans ce
// repère, `/aiad retro` risque de tirer des conclusions du bruit.
//
// La canary suite rejoue un set **figé** de cas (`.aiad/canary/cases/*.md`)
// contre une baseline. Deux natures de cas, deux régimes d'attente distincts :
//   - **deterministic** : le cas s'appuie sur un verdict CLI déterministe
//     (`trace`, `veto`, `mini-gate`…). Attente : **100 % reproductible**. Tout
//     écart (entre runs, ou vs baseline figée) = **bug code**, jamais du bruit
//     modèle → verdict FAIL.
//   - **generative** : le cas mesure un volet jugé par le modèle (dispersion
//     d'un score). Attente : rester dans la **bande de tolérance** (déf. ±14 %).
//     Au-delà → DRIFT (régression à investiguer), surfacé en CONDITIONAL.
//
// **Computation off-context** (lien §3.4) : la logique de comparaison vit ici,
// déterministe et testable ; l'exécution réelle des cas est déléguée à un
// **runner injectable** (le CLI spawn `aiad-sdd`), de sorte que ce module reste
// pur — aucun spawn, aucune horloge, aucun aléa.
//
// **Zero-dep**.
//
// @intent INTENT-006
// @spec SPEC-006-1-canary-suite
// @verified-by test/canary.test.js
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';

/** Natures de cas canary acceptées. */
export const KINDS = ['deterministic', 'generative'];

/** Bande de tolérance par défaut (%) pour les volets génératifs (§2.2 : ±8-14 %). */
export const TOLERANCE_DEFAUT = 14;

// ─── Parsing d'un cas canary ────────────────────────────────────────────────

/**
 * Parse un cas canary figé.
 *
 * Frontmatter attendu :
 *   - `id`        : CANARY-NNN
 *   - `kind`      : deterministic | generative
 *   - `command`   : (deterministic) sous-commande CLI + args, ex. `trace --output-format verdict`
 *   - `expected`  : verdict canonique attendu (deterministic) ou score de référence (generative)
 *   - `tolerance` : (generative) bande en % — déf. {@link TOLERANCE_DEFAUT}
 *
 * @param {string} contenu — Markdown complet du cas
 * @returns {{ id: string|null, kind: string|null, command: string|null,
 *   expected: string|number|null, tolerance: number, valide: boolean, erreurs: string[] }}
 */
export function parserCasCanary(contenu) {
  const { data } = parseFrontmatter(contenu);
  const erreurs = [];

  const id = typeof data.id === 'string' ? data.id.trim() : null;
  const kind = typeof data.kind === 'string' ? data.kind.trim().toLowerCase() : null;
  const command = typeof data.command === 'string' ? data.command.trim() : null;
  const expected = data.expected != null ? data.expected : null;
  const tolerance = Number.isFinite(Number(data.tolerance)) ? Number(data.tolerance) : TOLERANCE_DEFAUT;

  if (!id) erreurs.push('`id` manquant (CANARY-NNN attendu).');
  if (!kind || !KINDS.includes(kind)) erreurs.push(`\`kind\` invalide (${KINDS.join(' | ')} attendu).`);
  if (kind === 'deterministic' && !command) erreurs.push('`command` manquant pour un cas deterministic.');
  if (expected == null) erreurs.push('`expected` manquant (verdict ou score de référence).');

  return { id, kind, command, expected, tolerance, valide: erreurs.length === 0, erreurs };
}

/**
 * Charge tous les cas figés de `.aiad/canary/cases/`.
 *
 * @param {string} projetDir
 * @returns {Array<ReturnType<typeof parserCasCanary> & { fichier: string }>}
 */
export function chargerCasCanary(projetDir) {
  const dir = join(projetDir, '.aiad', 'canary', 'cases');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== '_index.md')
    .sort()
    .map((f) => ({ fichier: f, ...parserCasCanary(readFileSync(join(dir, f), 'utf-8')) }));
}

// ─── Évaluation d'un cas ────────────────────────────────────────────────────

/**
 * Évalue un cas **déterministe** : exige 100 % de reproductibilité ET l'égalité
 * à la baseline figée. Toute divergence est un bug code (jamais du bruit modèle).
 *
 * @param {string[]} observations — verdicts observés (un par run, ≥ 1)
 * @param {string} expected — verdict de référence figé
 * @returns {{ stable: boolean, match: boolean, observed: string|null, reasons: string[] }}
 */
export function evaluerDeterministe(observations, expected) {
  const reasons = [];
  const obs = (observations || []).map((o) => String(o).trim().toUpperCase());
  if (obs.length === 0) {
    return { stable: false, match: false, observed: null, reasons: ['Aucune observation collectée.'] };
  }
  const distinctes = [...new Set(obs)];
  const stable = distinctes.length === 1;
  if (!stable) {
    reasons.push(`Verdict NON reproductible sur ${obs.length} runs : ${distinctes.join(', ')} — bug code (déterminisme rompu).`);
  }
  const observed = stable ? distinctes[0] : null;
  const exp = String(expected).trim().toUpperCase();
  const match = stable && observed === exp;
  if (stable && !match) {
    reasons.push(`Verdict stable mais ≠ baseline : observé ${observed}, attendu ${exp} — régression harness/scoring (baseline à réviser si le changement est voulu).`);
  }
  return { stable, match, observed, reasons };
}

/**
 * Évalue un cas **génératif** : la dispersion des scores observés doit rester
 * dans la bande de tolérance autour de la référence. Au-delà → DRIFT.
 *
 * Dispersion = écart relatif max à la référence, en % (robuste à 1 échantillon).
 *
 * @param {number[]} observations — scores observés (≥ 1)
 * @param {number} expected — score de référence
 * @param {number} tolerance — bande en %
 * @returns {{ withinBand: boolean, drift: boolean, dispersion: number, observed: number|null, reasons: string[] }}
 */
export function evaluerGeneratif(observations, expected, tolerance = TOLERANCE_DEFAUT) {
  const reasons = [];
  const obs = (observations || []).map(Number).filter((n) => Number.isFinite(n));
  if (obs.length === 0) {
    return { withinBand: false, drift: true, dispersion: Infinity, observed: null, reasons: ['Aucun échantillon génératif collecté.'] };
  }
  const ref = Number(expected);
  // Écart relatif max à la référence (si ref = 0, écart absolu en points).
  const ecartMax = Math.max(...obs.map((o) => (ref === 0 ? Math.abs(o) * 100 : (Math.abs(o - ref) / Math.abs(ref)) * 100)));
  const dispersion = Math.round(ecartMax * 10) / 10;
  const withinBand = dispersion <= tolerance;
  const moyenne = obs.reduce((a, b) => a + b, 0) / obs.length;
  const observed = Math.round(moyenne * 100) / 100;
  if (!withinBand) {
    reasons.push(`Dispersion ${dispersion} % > bande ±${tolerance} % (réf. ${ref}, observé ~${observed}) — DRIFT à investiguer.`);
  }
  return { withinBand, drift: !withinBand, dispersion, observed, reasons };
}

// ─── Agrégation de la suite ─────────────────────────────────────────────────

/**
 * Exécute la canary suite via un runner injectable et agrège un rapport.
 *
 * Le runner reçoit un cas et retourne ses observations :
 *   - deterministic → `{ observations: string[] }` (verdicts)
 *   - generative    → `{ observations: number[] }` (scores)
 *
 * Mapping verdict global (priorité descendante) :
 *   - un cas deterministic instable/≠baseline → **FAIL** (bug code, exit 1)
 *   - sinon un cas generative en DRIFT         → **CONDITIONAL** (DRIFT, exit 0 + conditions)
 *   - cas invalide / observations manquantes   → **JNSP** (exit 2)
 *   - tout vert                                 → **PASS** (exit 0)
 *
 * @param {Array<object>} cas — cas chargés ({@link chargerCasCanary})
 * @param {(cas: object) => { observations: Array<string|number> }} runner
 * @param {{ snapshot?: object }} [opts]
 * @returns {{ verdict: 'PASS'|'CONDITIONAL'|'FAIL'|'JNSP', cases: object[],
 *   summary: { total: number, pass: number, drift: number, fail: number, unknown: number },
 *   conditions: string[], snapshot: object|null }}
 */
export function executerCanary(cas, runner, { snapshot = null } = {}) {
  const resultats = [];
  let nbFail = 0;
  let nbDrift = 0;
  let nbUnknown = 0;
  const conditions = [];

  for (const c of cas) {
    if (!c.valide) {
      nbUnknown++;
      resultats.push({ id: c.id, kind: c.kind, verdict: 'JNSP', reasons: c.erreurs });
      continue;
    }
    let observations;
    try {
      observations = runner(c).observations;
    } catch (e) {
      nbUnknown++;
      resultats.push({ id: c.id, kind: c.kind, verdict: 'JNSP', reasons: [`Runner en échec : ${e.message}`] });
      continue;
    }

    if (c.kind === 'deterministic') {
      const r = evaluerDeterministe(observations, c.expected);
      if (r.stable && r.match) {
        resultats.push({ id: c.id, kind: c.kind, verdict: 'PASS', observed: r.observed, expected: String(c.expected).toUpperCase(), stable: true, reasons: [] });
      } else {
        nbFail++;
        resultats.push({ id: c.id, kind: c.kind, verdict: 'FAIL', observed: r.observed, expected: String(c.expected).toUpperCase(), stable: r.stable, reasons: r.reasons });
        conditions.push(`${c.id} : ${r.reasons[0] || 'écart déterministe'}`);
      }
    } else {
      // Pas d'échantillon collecté → non mesuré (JNSP), pas un DRIFT : la canary
      // ne fabrique jamais une mesure absente.
      if (!Array.isArray(observations) || observations.filter((n) => Number.isFinite(Number(n))).length === 0) {
        nbUnknown++;
        resultats.push({ id: c.id, kind: c.kind, verdict: 'JNSP', expected: Number(c.expected), drift: false, reasons: ['Aucun échantillon collecté — volet génératif non mesuré.'] });
        continue;
      }
      const r = evaluerGeneratif(observations, c.expected, c.tolerance);
      if (r.withinBand) {
        resultats.push({ id: c.id, kind: c.kind, verdict: 'PASS', observed: r.observed, expected: Number(c.expected), dispersion: r.dispersion, drift: false, reasons: [] });
      } else {
        nbDrift++;
        resultats.push({ id: c.id, kind: c.kind, verdict: 'CONDITIONAL', observed: r.observed, expected: Number(c.expected), dispersion: r.dispersion, drift: true, reasons: r.reasons });
        conditions.push(`${c.id} : ${r.reasons[0] || 'dispersion hors bande'}`);
      }
    }
  }

  const total = cas.length;
  const pass = resultats.filter((r) => r.verdict === 'PASS').length;
  let verdict;
  if (nbFail > 0) verdict = 'FAIL';
  else if (nbDrift > 0) verdict = 'CONDITIONAL';
  else if (nbUnknown > 0 && pass === 0) verdict = 'JNSP';
  else if (nbUnknown > 0) verdict = 'CONDITIONAL'; // mélange vert + indécidable → à compléter
  else verdict = 'PASS';

  // CONDITIONAL exige des conditions non vides (contrat verdict.js) : un mélange
  // pass + JNSP sans drift produit une condition explicite.
  if (verdict === 'CONDITIONAL' && conditions.length === 0) {
    conditions.push(`${nbUnknown} cas indécidable(s) — compléter la suite.`);
  }

  return {
    verdict,
    cases: resultats,
    summary: { total, pass, drift: nbDrift, fail: nbFail, unknown: nbUnknown },
    conditions,
    snapshot,
  };
}

// ─── Snapshot modèle figé (lu depuis config.yml) ────────────────────────────

/**
 * Lit le snapshot modèle figé dans `.aiad/config.yml` (bloc `canary:`) afin de
 * comparer toujours à modèle constant. Lecture regex zero-dep (cf. doctor.js).
 *
 * @param {string} projetDir
 * @returns {{ model: string|null, effort: string|null, claude_code_version: string|null, tolerance_pct: number }}
 */
export function lireSnapshotCanary(projetDir) {
  const p = join(projetDir, '.aiad', 'config.yml');
  const def = { model: null, effort: null, claude_code_version: null, tolerance_pct: TOLERANCE_DEFAUT };
  if (!existsSync(p)) return def;
  const txt = readFileSync(p, 'utf-8');
  const champ = (clef) => {
    const m = txt.match(new RegExp(`${clef}\\s*:\\s*([\\w.+-]+)`, 'i'));
    return m ? m[1] : null;
  };
  const tol = champ('tolerance_pct');
  return {
    model: champ('model'),
    effort: champ('effort'),
    claude_code_version: champ('claude_code_version'),
    tolerance_pct: Number.isFinite(Number(tol)) ? Number(tol) : TOLERANCE_DEFAUT,
  };
}

// ─── Aliases EN ─────────────────────────────────────────────────────────────

export {
  parserCasCanary as parseCanaryCase,
  chargerCasCanary as loadCanaryCases,
  evaluerDeterministe as evaluateDeterministic,
  evaluerGeneratif as evaluateGenerative,
  executerCanary as runCanary,
  lireSnapshotCanary as readCanarySnapshot,
};
