// AIAD SDD Mode — Registre des agents de rôle, de leurs sous-agents et skills.
//
// Source unique de vérité de l'équipe d'agents livrée dans `.claude/agents/` :
//   - 5 agents de rôle (assistants personnels des 5 responsabilités AIAD) ;
//   - leurs sous-agents spécialisés — chacun géré par UN seul agent de rôle ;
//   - les skills préchargées par chaque agent.
//
// `aiad-sdd agents validate` (lib/agents.js) confronte ce registre aux fichiers
// installés : un sous-agent sans gestionnaire, une liste de délégation
// `Agent(...)` divergente ou une skill absente font échouer le contrôle.
// Le contrôle est appliqué (script déterministe), pas déclaratif.
//
// Sobriété (RGESN) : module statique, zéro dépendance, zéro I/O.
//
// @intent INTENT-036
// @spec SPEC-036-1-agents-de-role
// @verified-by test/agents-registry.test.js
//
// Documentation : https://aiad.ovh

/** Agents de gouvernance Tier 1 générés par `emit-rules` (veto, lecture seule). */
export const GOVERNANCE_AGENTS = Object.freeze(['AIAD-AI-ACT', 'AIAD-RGPD', 'AIAD-RGAA', 'AIAD-RGESN']);

/** Agent de rôle qui administre les agents de gouvernance (configuration, mise à jour). */
export const GOVERNANCE_MANAGER = 'aiad-ae';

/** Skill de relais inter-rôles, préchargée par les 5 agents de rôle. */
export const HANDOFF_SKILL = 'role-handoff';

const LECTURE = 'Read, Grep, Glob';
const LECTURE_BASH = 'Read, Grep, Glob, Bash';
const ECRITURE = 'Read, Grep, Glob, Bash, Edit, Write';
const SANS_ECRITURE = 'Edit, Write, NotebookEdit';

/** Outils d'un agent de rôle, hors délégation `Agent(...)`. */
export const ROLE_TOOLS = 'Read, Grep, Glob, Bash, Edit, Write, Skill, AskUserQuestion, TodoWrite, WebFetch, WebSearch';

/**
 * Agents de rôle : `{ name, role, label, question, skills, commands }`.
 * `skills` : skills préchargées (hors `role-handoff`, ajoutée d'office).
 */
export const ROLE_AGENTS = Object.freeze([
  {
    name: 'aiad-pm',
    role: 'PM',
    label: 'Product Manager',
    question: 'Construit-on les bonnes choses ?',
    skills: ['human-authorship-check', 'discovery-synthesis', 'backlog-health', 'outcome-review'],
    commands: ['/sdd prd', '/sdd intent', '/aiad sync-strat', '/aiad demo', '/aiad intention', '/aiad dashboard-html'],
  },
  {
    name: 'aiad-pe',
    role: 'PE',
    label: 'Product Engineer',
    question: "L'intention est-elle réalisée sans être trahie ?",
    skills: ['human-authorship-check', 'sqs-scoring', 'context-budget', 'grill-me', 'exec-orchestration'],
    commands: ['/sdd intent', '/sdd research', '/sdd spec', '/sdd gate', '/sdd exec', '/sdd validate', '/sdd drift-check', '/sdd trace', '/sdd split', '/sdd resume', '/sdd fact'],
  },
  {
    name: 'aiad-ae',
    role: 'AE',
    label: 'Agents Engineer',
    question: "L'écosystème d'agents est-il optimal ?",
    skills: ['context-budget', 'regulatory-veto', 'agent-authoring', 'agent-monitoring', 'permissions-audit'],
    commands: ['/sdd context', '/aiad emit-rules', '/aiad gouvernance', '/aiad health', '/aiad agents', '/aiad retro'],
  },
  {
    name: 'aiad-qa',
    role: 'QA',
    label: 'QA Engineer',
    question: 'La qualité est-elle intégrée dès le départ ?',
    skills: ['ears-validator', 'test-strategy', 'acceptance-verification', 'exploratory-charter'],
    commands: ['/sdd validate', '/sdd audit', '/sdd fact', '/aiad gouvernance', '/aiad demo'],
  },
  {
    name: 'aiad-tech-lead',
    role: 'TL',
    label: 'Tech Lead',
    question: "L'ensemble reste-t-il techniquement cohérent ?",
    skills: ['architecture-review', 'security-audit', 'release-readiness'],
    commands: ['/sdd arch', '/sdd security', '/sdd audit', '/aiad tech-review', '/aiad dora', '/aiad flow'],
  },
]);

/**
 * Sous-agents : `{ name, owner, mission, tools, disallowed, model, skills }`.
 * `owner` : l'unique agent de rôle qui le délègue. Aucun sous-agent ne reçoit
 * l'outil `Agent` : la délégation s'arrête à un niveau.
 */
export const SUB_AGENTS = Object.freeze([
  // ── Product Manager ────────────────────────────────────────────────────
  { name: 'pm-discovery-analyst', owner: 'aiad-pm', mission: 'Synthèse de discovery : retours utilisateurs, hypothèses, signaux marché', tools: `${LECTURE}, WebFetch, WebSearch`, disallowed: SANS_ECRITURE, model: 'sonnet', skills: ['discovery-synthesis'] },
  { name: 'pm-backlog-curator', owner: 'aiad-pm', mission: 'Santé du backlog : intents zombies, orphelins, doublons, cohérence PRD', tools: LECTURE_BASH, disallowed: SANS_ECRITURE, model: 'haiku', skills: ['backlog-health'] },
  { name: 'pm-outcome-analyst', owner: 'aiad-pm', mission: 'Outcomes et validation métier : critère de drift, métriques, préparation de démo', tools: LECTURE_BASH, disallowed: SANS_ECRITURE, model: 'sonnet', skills: ['outcome-review'] },
  // ── Product Engineer ───────────────────────────────────────────────────
  { name: 'pe-spec-writer', owner: 'aiad-pe', mission: "Brouillon de SPEC atomique depuis un Intent validé par l'humain", tools: ECRITURE, disallowed: 'NotebookEdit', model: 'inherit', skills: ['spec-authoring', 'ears-validator', 'reasons-canvas'] },
  { name: 'pe-implementer', owner: 'aiad-pe', mission: "Implémentation d'UNE SPEC dont l'Execution Gate est ouverte", tools: ECRITURE, disallowed: 'NotebookEdit', model: 'inherit', skills: ['traceability'] },
  { name: 'pe-code-reviewer', owner: 'aiad-pe', mission: 'Revue de code adossée à la SPEC : conformité, défauts, lisibilité', tools: LECTURE_BASH, disallowed: SANS_ECRITURE, model: 'inherit', skills: ['code-review', 'drift-detection'] },
  { name: 'pe-drift-sentinel', owner: 'aiad-pe', mission: 'Drift Lock : synchronisation SPEC ↔ code ↔ tests, matrice de traçabilité', tools: LECTURE_BASH, disallowed: SANS_ECRITURE, model: 'haiku', skills: ['drift-detection', 'traceability'] },
  { name: 'pe-doc-writer', owner: 'aiad-pe', mission: 'Documentation synchronisée avec le code livré : README, changelog, guides', tools: ECRITURE, disallowed: 'NotebookEdit', model: 'sonnet', skills: [] },
  // ── Agents Engineer ────────────────────────────────────────────────────
  { name: 'ae-agent-configurator', owner: 'aiad-ae', mission: "Création et maintenance d'agents, de skills et de l'AGENT-GUIDE", tools: ECRITURE, disallowed: 'NotebookEdit', model: 'inherit', skills: ['agent-authoring'] },
  { name: 'ae-context-auditor', owner: 'aiad-ae', mission: 'Audit du budget de contexte : estimation vs réel, usage des skills, mémoire', tools: LECTURE_BASH, disallowed: SANS_ECRITURE, model: 'haiku', skills: ['context-budget', 'agent-monitoring'] },
  { name: 'ae-agent-evaluator', owner: 'aiad-ae', mission: 'Évaluation des agents : canaris, taux de correction, faux positifs', tools: LECTURE_BASH, disallowed: SANS_ECRITURE, model: 'sonnet', skills: ['agent-monitoring'] },
  { name: 'ae-permissions-auditor', owner: 'aiad-ae', mission: 'Moindre privilège : permissions, approbations persistées, outillage autorisé', tools: LECTURE, disallowed: `${SANS_ECRITURE}, Bash`, model: 'sonnet', skills: ['permissions-audit'] },
  // ── QA Engineer ────────────────────────────────────────────────────────
  { name: 'qa-test-strategist', owner: 'aiad-qa', mission: "Stratégie de test dès la SPEC : plan dérivé des critères d'acceptation", tools: LECTURE, disallowed: `${SANS_ECRITURE}, Bash`, model: 'sonnet', skills: ['test-strategy', 'ears-validator'] },
  { name: 'qa-test-author', owner: 'aiad-qa', mission: 'Écriture des tests automatisés, dans les répertoires de tests uniquement', tools: ECRITURE, disallowed: 'NotebookEdit', model: 'inherit', skills: ['test-strategy', 'traceability'] },
  { name: 'qa-functional-validator', owner: 'aiad-qa', mission: "Validation fonctionnelle : chaque critère d'acceptation, preuve à l'appui", tools: LECTURE_BASH, disallowed: SANS_ECRITURE, model: 'sonnet', skills: ['acceptance-verification'] },
  { name: 'qa-exploratory-tester', owner: 'aiad-qa', mission: 'Test exploratoire par chartes : cas limites, parcours non spécifiés', tools: LECTURE_BASH, disallowed: SANS_ECRITURE, model: 'sonnet', skills: ['exploratory-charter'] },
  // ── Tech Lead ──────────────────────────────────────────────────────────
  { name: 'tl-architecture-reviewer', owner: 'aiad-tech-lead', mission: 'Cohérence avec ARCHITECTURE.md : patterns, couplage, brouillons d\'ADR', tools: LECTURE_BASH, disallowed: SANS_ECRITURE, model: 'inherit', skills: ['architecture-review'] },
  { name: 'tl-security-auditor', owner: 'aiad-tech-lead', mission: 'Audit sécurité : OWASP, secrets, dépendances, authentification', tools: LECTURE_BASH, disallowed: SANS_ECRITURE, model: 'inherit', skills: ['security-audit'] },
  { name: 'tl-performance-analyst', owner: 'aiad-tech-lead', mission: 'Performance et sobriété : budgets, régressions, requêtes, poids', tools: LECTURE_BASH, disallowed: SANS_ECRITURE, model: 'sonnet', skills: ['architecture-review'] },
  { name: 'tl-debt-analyst', owner: 'aiad-tech-lead', mission: 'Dette technique : inventaire, classement, plans de refactoring et de migration', tools: LECTURE_BASH, disallowed: SANS_ECRITURE, model: 'sonnet', skills: ['architecture-review'] },
  { name: 'tl-release-engineer', owner: 'aiad-tech-lead', mission: 'Préparation de release : contrôles, changelog, version — sans publier', tools: ECRITURE, disallowed: 'NotebookEdit', model: 'sonnet', skills: ['release-readiness'] },
]);

/** Skills introduites avec les agents de rôle (INTENT-036). */
export const ROLE_SKILLS = Object.freeze([
  'role-handoff',
  'discovery-synthesis', 'backlog-health', 'outcome-review',
  'code-review', 'spec-authoring', 'exec-orchestration',
  'agent-authoring', 'agent-monitoring', 'permissions-audit',
  'test-strategy', 'acceptance-verification', 'exploratory-charter',
  'architecture-review', 'security-audit', 'release-readiness',
]);

/** Sous-agents gérés par un agent de rôle, dans l'ordre du registre. */
export function sousAgentsDe(roleAgent) {
  return SUB_AGENTS.filter((s) => s.owner === roleAgent).map((s) => s.name);
}

/** Skills préchargées par un agent de rôle (`role-handoff` comprise). */
export function skillsDuRole(roleAgent) {
  const a = ROLE_AGENTS.find((r) => r.name === roleAgent);
  return a ? [...a.skills, HANDOFF_SKILL] : [];
}

/**
 * Valeur attendue du champ `tools` d'un agent de rôle : la liste de délégation
 * `Agent(...)` (ses sous-agents + les agents de gouvernance, consultables par
 * tous) suivie des outils courants. Appliquée par Claude Code quand l'agent est
 * lancé en session principale (`claude --agent <nom>`).
 */
export function toolsDuRole(roleAgent) {
  const delegues = [...sousAgentsDe(roleAgent), ...GOVERNANCE_AGENTS];
  return `Agent(${delegues.join(', ')}), ${ROLE_TOOLS}`;
}

/** Résout un rôle (`pe`, `PE`, `tech-lead`, `aiad-pe`…) en agent de rôle, ou null. */
export function resoudreRole(saisie) {
  const s = String(saisie || '').trim().toLowerCase();
  if (!s) return null;
  return ROLE_AGENTS.find((r) =>
    r.name === s || r.name === `aiad-${s}` || r.role.toLowerCase() === s
    || r.label.toLowerCase().replace(/\s+/g, '-') === s) || null;
}

/** Chemins relatifs de tous les fichiers d'agents livrés. */
export function fichiersAgents() {
  return [...ROLE_AGENTS, ...SUB_AGENTS].map((a) => `.claude/agents/${a.name}.md`);
}

/** Chemins relatifs des skills introduites avec les agents de rôle. */
export function fichiersSkillsDeRole() {
  return ROLE_SKILLS.map((s) => `.claude/skills/${s}/SKILL.md`);
}
