// AIAD SDD Mode — Matrice machine-vérifiable des garde-fous (enforced/advisory).
//
// @intent INTENT-015
// @spec SPEC-015-3-matrice-garde-fous
// @verified-by test/guardrails.test.js
// @governance AIAD-RGESN
//
// Source unique de vérité de la sévérité des garde-fous (hooks + gates CI).
// Adossée à un audit (`auditGuardrails`) qui confronte la sévérité DÉCLARÉE à
// la réalité du CODE : un hook `bypassable: false` (le veto Tier 1) ne doit
// contenir aucune lecture de `process.env.AIAD_HOOK_SILENT`. C-MATRICE/C3 de
// RESEARCH-018 : la matrice ne peut pas dériver du code sans casser un test.
//
// Sobriété (RGESN) : module statique, zéro dépendance.
//
// Documentation : https://aiad.ovh

import { C, log, logHeader } from './term.js';

export const TYPES = Object.freeze(['enforced', 'advisory']);
export const LAYERS = Object.freeze(['hook', 'ci']);

// Pattern de bypass audité : la lecture réelle de l'env (pas une mention en
// commentaire). Un garde-fou non-bypassable ne doit pas contenir ce pattern.
export const BYPASS_PATTERN = 'process.env.AIAD_HOOK_SILENT';

/**
 * Matrice des garde-fous. `bypassable` reflète si `AIAD_HOOK_SILENT` silence
 * le garde-fou (vrai ⇔ la source lit BYPASS_PATTERN, pour les hooks).
 */
export const GUARDRAILS = Object.freeze([
  // ── Hooks ─────────────────────────────────────────────────────────────
  { id: 'veto', layer: 'hook', event: 'PreToolUse', type: 'enforced', blocking: true, bypassable: false, bypass: null, test: 'test/guardrails.test.js' },
  { id: 'drift-lock', layer: 'hook', event: 'Stop', type: 'enforced', blocking: true, bypassable: true, bypass: 'disableStopHook | AIAD_HOOK_SILENT', test: 'test/pre-commit.test.js' },
  { id: 'jnsp-scan', layer: 'hook', event: 'PreToolUse', type: 'enforced', blocking: true, bypassable: true, bypass: 'disableJnspHook | AIAD_HOOK_SILENT', test: 'test/jnsp.test.js' },
  { id: 'discovery-gate', layer: 'hook', event: 'UserPromptSubmit', type: 'advisory', blocking: false, bypassable: true, bypass: 'AIAD_HOOK_SILENT (strict opt-in AIAD_DISCOVERY_STRICT)', test: 'test/discovery-gate.test.js' },
  { id: 'skill-usage', layer: 'hook', event: 'PreToolUse', type: 'advisory', blocking: false, bypassable: true, bypass: 'disableSkillUsageHook | AIAD_HOOK_SILENT', test: 'test/skills.test.js' },
  { id: 'session-start', layer: 'hook', event: 'SessionStart', type: 'advisory', blocking: false, bypassable: true, bypass: 'AIAD_HOOK_SILENT', test: 'test/statusline.test.js' },
  { id: 'statusline', layer: 'hook', event: 'statusLine', type: 'advisory', blocking: false, bypassable: false, bypass: null, test: 'test/statusline.test.js' },

  // ── Gates CI (pas de source hook → hors audit de bypass) ──────────────
  { id: 'ci-tests', layer: 'ci', event: 'pull_request', type: 'enforced', blocking: true, bypassable: false, bypass: null, test: '.github/workflows/ci.yml' },
  { id: 'ci-lint', layer: 'ci', event: 'pull_request', type: 'enforced', blocking: true, bypassable: false, bypass: null, test: '.github/workflows/ci.yml' },
  { id: 'coverage-badge', layer: 'ci', event: 'pull_request', type: 'enforced', blocking: true, bypassable: false, bypass: null, test: '.github/workflows/ci.yml' },
  { id: 'reproducibility', layer: 'ci', event: 'pull_request', type: 'enforced', blocking: true, bypassable: false, bypass: null, test: '.github/workflows/ci.yml' },
  { id: 'sdd-trace', layer: 'ci', event: 'pull_request', type: 'enforced', blocking: true, bypassable: false, bypass: null, test: '.github/workflows/sdd-trace.yml' },
  { id: 'emit-rules-check', layer: 'ci', event: 'pull_request', type: 'enforced', blocking: true, bypassable: false, bypass: null, test: '.github/workflows/aiad-emit-rules-check.yml' },
  { id: 'version-check', layer: 'ci', event: 'pull_request', type: 'enforced', blocking: true, bypassable: false, bypass: null, test: '.github/workflows/aiad-version-check.yml' },
  { id: 'docs-check', layer: 'ci', event: 'pull_request', type: 'enforced', blocking: true, bypassable: false, bypass: null, test: '.github/workflows/aiad-docs-check.yml' },
  { id: 'pr-review', layer: 'ci', event: 'pull_request', type: 'advisory', blocking: false, bypassable: false, bypass: null, test: '.github/workflows/aiad-pr-review.yml' },
  { id: 'canary', layer: 'ci', event: 'pull_request', type: 'advisory', blocking: false, bypassable: false, bypass: null, test: '.github/workflows/canary.yml' },
]);

/** Entrées de type hook. */
export function hookGuardrails() {
  return GUARDRAILS.filter((g) => g.layer === 'hook');
}

/**
 * Audit : confronte la sévérité déclarée à la réalité du code.
 * - Tout id de hook présent (`hookIds`) doit avoir une entrée (exhaustivité).
 * - Pour chaque hook, `bypassable` doit refléter la présence du BYPASS_PATTERN
 *   dans sa source (`readSource(id)`). En particulier, un `bypassable: false`
 *   (veto) qui contiendrait le pattern = régression de sévérité bloquante.
 *
 * @param {{ readSource: (id: string) => string|null, hookIds: string[] }} io
 * @returns {{ ok: boolean, violations: Array<{ id: string, reason: string }> }}
 */
export function auditGuardrails({ readSource, hookIds }) {
  const violations = [];
  const declared = new Map(hookGuardrails().map((g) => [g.id, g]));

  // Exhaustivité : tout hook réel doit être déclaré.
  for (const id of hookIds) {
    if (!declared.has(id)) violations.push({ id, reason: 'hook absent de la matrice' });
  }

  // Cohérence sévérité ↔ code.
  for (const g of declared.values()) {
    const src = readSource(g.id);
    if (src == null) {
      violations.push({ id: g.id, reason: 'source du hook introuvable' });
      continue;
    }
    const hasBypass = src.includes(BYPASS_PATTERN);
    if (g.bypassable !== hasBypass) {
      violations.push({
        id: g.id,
        reason: g.bypassable
          ? 'déclaré bypassable mais ne lit pas AIAD_HOOK_SILENT'
          : `déclaré non-bypassable mais lit ${BYPASS_PATTERN} (régression de sévérité)`,
      });
    }
  }

  return { ok: violations.length === 0, violations };
}

/** Modèle d'agrégat (rendu JSON stable). */
export function aggregateGuardrails() {
  const enforced = GUARDRAILS.filter((g) => g.type === 'enforced').map((g) => g.id);
  const advisory = GUARDRAILS.filter((g) => g.type === 'advisory').map((g) => g.id);
  return { total: GUARDRAILS.length, enforced, advisory, guardrails: GUARDRAILS.slice() };
}

/**
 * Rendu de la commande `guardrails` — texte (défaut) ou JSON.
 *
 * @param {{ json?: boolean }} [options]
 */
export function showGuardrails(options = {}) {
  const { json = false } = options;
  const agg = aggregateGuardrails();

  if (json) {
    process.stdout.write(JSON.stringify(agg, null, 2) + '\n');
    return agg;
  }

  logHeader('Matrice des garde-fous', `${agg.total} — enforced / advisory`);
  for (const type of TYPES) {
    const entries = GUARDRAILS.filter((g) => g.type === type);
    console.log(`\n${C.gras}  ${type}${C.reset} ${C.gris}(${entries.length})${C.reset}`);
    for (const g of entries) {
      const flags = `${g.blocking ? 'bloquant' : 'informatif'}, ${g.bypassable ? `bypass: ${g.bypass}` : 'non-bypassable'}`;
      log(`${C.gris}·${C.reset}`, `${g.id.padEnd(20)} ${C.gris}${g.layer}/${g.event} — ${flags}${C.reset}`);
    }
  }
  console.log('');
  return agg;
}
