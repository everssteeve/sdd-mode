// AIAD SDD Mode — Cross-model review « additive-only » (item §3.12).
//
// **Cap stratégique** : les *uncorrelated context windows* (§2.3, §2.4) — un
// modèle crée un bug, un **autre** le trouve (~80 % des bugs attrapés par une
// équipe d'agents à l'ouverture de PR). Le pattern cross-model (Claude auteur,
// Codex/Gemini reviewer) impose une règle d'or : le reviewer **insère des
// findings sans réécrire** — « additive only ». Transposé à SDD, c'est du
// **Human Authorship entre IA** : la paternité de l'auteur est préservée, le
// reviewer ne fait qu'ajouter des observations citées.
//
// **Contrat** :
//   - le reviewer reçoit un **contexte frais** (faits, pas le raisonnement de
//     l'auteur — §2.4 Dex) et produit des Findings JSON (schéma `review`),
//   - il **n'écrit ni code ni SPEC** (read-only — même principe que §3.1),
//   - les Findings sont **dédupliqués** puis **mergés** dans le rapport de
//     validation, attribués au reviewer,
//   - le verdict final reste **déterministe** (§3.4) ; des Findings hauts non
//     résolus peuvent au plus forcer `CONDITIONAL` (§3.6), jamais inventer un
//     FAIL.
//
// **Computation off-context** : ce module ne fait aucun appel modèle. Il
// fabrique le prompt, parse/dédup/merge les sorties et calcule l'influence sur
// le verdict — tout est pur et testable. L'invocation du runtime tiers est
// déléguée (CLI/orchestrateur), et **dégrade proprement** si indisponible.
//
// **Zero-dep**.
//
// @intent INTENT-010
// @spec SPEC-010-1-cross-model-review
// @verified-by test/cross-model.test.js
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Sévérités ordonnées (décroissant). Les deux premières « bloquent » au sens influence. */
export const SEVERITES = ['critical', 'high', 'medium', 'low', 'info'];

/** Sévérités qui peuvent forcer un CONDITIONAL si non résolues. */
const SEVERITES_HAUTES = new Set(['critical', 'high']);

// ─── Prompt contexte frais ──────────────────────────────────────────────────

/**
 * Construit le prompt du reviewer tiers. Contexte **frais** : on lui donne le
 * diff et la SPEC, jamais le raisonnement de l'auteur. Sortie JSON imposée.
 *
 * @param {{ spec: string, diff: string, reviewer?: string, specBody?: string }} p
 * @returns {string}
 */
export function construirePromptReviewer({ spec, diff, reviewer = 'reviewer', specBody = '' }) {
  return [
    `Tu es un reviewer indépendant (${reviewer}) en contexte frais. Tu ne connais PAS`,
    `le raisonnement de l'auteur — tu juges le code sur faits.`,
    '',
    `RÈGLE ABSOLUE — ADDITIVE ONLY : tu ne modifies NI le code NI la SPEC.`,
    `Tu produis uniquement des Findings (observations citées). Aucune réécriture.`,
    '',
    `SPEC ${spec} :`,
    specBody ? specBody.slice(0, 4000) : '(non fournie)',
    '',
    'DIFF à reviewer :',
    '```diff',
    String(diff || '').slice(0, 16000),
    '```',
    '',
    'Réponds STRICTEMENT en JSON (rien d\'autre) :',
    '{"reviewer":"' + reviewer + '","findings":[{"severity":"critical|high|medium|low|info","file":"chemin","line":0,"description":"...","suggestion":"..."}]}',
    'Si aucun problème : {"reviewer":"' + reviewer + '","findings":[]}.',
  ].join('\n');
}

// ─── Parsing de la sortie reviewer ──────────────────────────────────────────

/**
 * Parse la sortie d'un reviewer (JSON, éventuellement entouré de texte/```).
 * Tolérant ; normalise les findings. Retourne `{ reviewer, findings, valide, erreurs }`.
 *
 * @param {string} brut
 * @param {string} [reviewerParDefaut]
 * @returns {{ reviewer: string, findings: object[], valide: boolean, erreurs: string[] }}
 */
export function parserSortieReviewer(brut, reviewerParDefaut = 'reviewer') {
  const erreurs = [];
  let obj = null;
  const texte = String(brut || '');
  // Extrait le 1er bloc {...} plausible (gère le ```json ... ``` et le bavardage).
  const m = texte.match(/\{[\s\S]*\}/);
  if (m) { try { obj = JSON.parse(m[0]); } catch { erreurs.push('JSON illisible.'); } }
  else erreurs.push('Aucun objet JSON trouvé.');

  const reviewer = (obj && typeof obj.reviewer === 'string' && obj.reviewer.trim()) ? obj.reviewer.trim() : reviewerParDefaut;
  const findingsBruts = obj && Array.isArray(obj.findings) ? obj.findings : [];
  const findings = [];
  for (const f of findingsBruts) {
    if (!f || typeof f !== 'object') continue;
    const severity = SEVERITES.includes(String(f.severity)) ? f.severity : 'info';
    findings.push({
      severity,
      file: typeof f.file === 'string' ? f.file : '',
      line: Number.isFinite(Number(f.line)) ? Number(f.line) : null,
      description: typeof f.description === 'string' ? f.description.trim() : '',
      suggestion: typeof f.suggestion === 'string' ? f.suggestion.trim() : '',
      reviewer,
    });
  }
  return { reviewer, findings, valide: erreurs.length === 0, erreurs };
}

// ─── Dédup & merge ──────────────────────────────────────────────────────────

function signature(f) {
  const desc = String(f.description || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80);
  return `${(f.file || '').toLowerCase()}:${f.line ?? ''}:${desc}`;
}

/**
 * Déduplique des findings (même fichier:ligne:description). En cas de doublon,
 * conserve la sévérité la plus élevée et fusionne les reviewers.
 *
 * @param {object[]} findings
 * @returns {object[]}
 */
export function dedupFindings(findings) {
  const parClef = new Map();
  for (const f of findings || []) {
    const k = signature(f);
    if (!parClef.has(k)) { parClef.set(k, { ...f, reviewers: [f.reviewer].filter(Boolean) }); continue; }
    const g = parClef.get(k);
    if (SEVERITES.indexOf(f.severity) < SEVERITES.indexOf(g.severity)) g.severity = f.severity;
    if (f.reviewer && !g.reviewers.includes(f.reviewer)) g.reviewers.push(f.reviewer);
  }
  return [...parClef.values()].sort((a, b) => SEVERITES.indexOf(a.severity) - SEVERITES.indexOf(b.severity));
}

/**
 * Merge plusieurs rapports reviewer en une liste dédupliquée.
 *
 * @param {{ reviewer: string, findings: object[] }[]} rapports
 * @returns {{ findings: object[], reviewers: string[], parSeverite: Record<string, number> }}
 */
export function mergerRapports(rapports) {
  const tous = [];
  const reviewers = new Set();
  for (const r of rapports || []) {
    if (r && r.reviewer) reviewers.add(r.reviewer);
    for (const f of (r && r.findings) || []) tous.push({ ...f, reviewer: f.reviewer || r.reviewer });
  }
  const findings = dedupFindings(tous);
  const parSeverite = {};
  for (const s of SEVERITES) parSeverite[s] = findings.filter((f) => f.severity === s).length;
  return { findings, reviewers: [...reviewers], parSeverite };
}

// ─── Influence sur le verdict (déterministe, informe seulement) ─────────────

/**
 * Calcule l'influence des Findings sur un verdict de base. **N'invente jamais
 * un FAIL** : un base PASS avec des findings hauts non résolus devient au plus
 * `CONDITIONAL` ; les verdicts FAIL/JNSP de base sont conservés tels quels.
 *
 * @param {'PASS'|'CONDITIONAL'|'FAIL'|'JNSP'} baseVerdict
 * @param {object[]} findings — findings mergés
 * @returns {{ verdict: string, conditions: string[], raison: string }}
 */
export function influenceVerdict(baseVerdict, findings) {
  const base = String(baseVerdict || '').toUpperCase();
  const hauts = (findings || []).filter((f) => SEVERITES_HAUTES.has(f.severity));
  if (base === 'FAIL' || base === 'JNSP') {
    return { verdict: base, conditions: [], raison: 'Verdict de base conservé (cross-model informe, ne dégrade pas davantage).' };
  }
  if (hauts.length === 0) {
    return { verdict: base, conditions: [], raison: 'Aucun finding haut non résolu — verdict de base inchangé.' };
  }
  const conditions = hauts.slice(0, 10).map((f) => `[${f.severity}] ${f.file}${f.line ? `:${f.line}` : ''} — ${f.description}`);
  return { verdict: 'CONDITIONAL', conditions, raison: `${hauts.length} finding(s) haut(s) cross-model à lever — CONDITIONAL.` };
}

// ─── Rendu d'artefact + chargement ──────────────────────────────────────────

/**
 * Rend le rapport de review additif (Markdown), attribué aux reviewers.
 *
 * @param {string} spec
 * @param {ReturnType<typeof mergerRapports>} merge
 * @returns {string}
 */
export function rendreReview(spec, merge) {
  const l = [`# REVIEW ${spec} — cross-model (additive only)`, ''];
  l.push(`> Reviewers : ${merge.reviewers.join(', ') || '—'}. Findings additifs (aucune réécriture).`, '');
  if (merge.findings.length === 0) { l.push('Aucun finding.', ''); return l.join('\n'); }
  l.push('| Sévérité | Fichier:ligne | Description | Reviewer(s) |', '|----------|---------------|-------------|-------------|');
  for (const f of merge.findings) {
    l.push(`| ${f.severity} | ${f.file}${f.line ? `:${f.line}` : ''} | ${f.description.replace(/\|/g, '\\|')} | ${(f.reviewers || [f.reviewer]).join(', ')} |`);
  }
  l.push('');
  return l.join('\n');
}

/**
 * Charge les sorties reviewer figées (`.aiad/reviews/REVIEW-<spec>-*.json`).
 *
 * @param {string} racine
 * @param {string} spec
 * @returns {{ reviewer: string, findings: object[] }[]}
 */
export function chargerRapports(racine, spec) {
  const dir = join(racine, '.aiad', 'reviews');
  if (!existsSync(dir)) return [];
  const prefixe = `REVIEW-${spec}-`.toLowerCase();
  const out = [];
  for (const f of readdirSync(dir)) {
    if (!f.toLowerCase().startsWith(prefixe) || !f.endsWith('.json')) continue;
    try { out.push(parserSortieReviewer(readFileSync(join(dir, f), 'utf-8'), f.replace(/\.json$/, ''))); } catch { /* ignore */ }
  }
  return out;
}

// ─── Aliases EN ─────────────────────────────────────────────────────────────

export {
  construirePromptReviewer as buildReviewerPrompt,
  parserSortieReviewer as parseReviewerOutput,
  dedupFindings as dedupeFindings,
  mergerRapports as mergeReports,
  influenceVerdict as verdictInfluence,
  rendreReview as renderReview,
  chargerRapports as loadReports,
};
