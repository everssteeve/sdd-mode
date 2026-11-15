// AIAD SDD Mode — Agents de rôle : liste, validation, choix de l'assistant.
//
// Trois sous-commandes de `aiad-sdd agents` :
//   list      — l'équipe : 5 agents de rôle, leurs sous-agents, leurs skills ;
//   validate  — confronte `.claude/agents/` au registre (contrôle appliqué) ;
//   use <rôle> — inscrit l'assistant personnel dans `.claude/settings.local.json`
//                (clé `agent`), réglage par personne et hors dépôt.
//
// Le verdict de `validate` dérive d'un script déterministe : exit 0 si l'équipe
// installée est conforme au registre, 1 sinon.
//
// @intent INTENT-036
// @spec SPEC-036-1-agents-de-role
// @verified-by test/agents.test.js
//
// Documentation : https://aiad.ovh

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { C, log, logHeader } from './term.js';
import { parseFrontmatter } from './frontmatter.js';
import {
  ROLE_AGENTS, SUB_AGENTS, GOVERNANCE_AGENTS, GOVERNANCE_MANAGER,
  sousAgentsDe, skillsDuRole, toolsDuRole, resoudreRole,
} from './agents-registry.js';

const MIN_DESCRIPTION = 30;
const MAX_DESCRIPTION = 1536;

function lireAgent(racine, nom) {
  const chemin = join(racine, '.claude', 'agents', `${nom}.md`);
  if (!existsSync(chemin)) return null;
  const { data, body } = parseFrontmatter(readFileSync(chemin, 'utf-8'));
  return { data, body };
}

function normaliserListe(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
}

/** Outils d'un champ `tools`, sans découper l'intérieur de `Agent(a, b)`. */
export function decouperTools(tools) {
  return String(tools || '').split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean);
}

/** Types d'agents autorisés par une entrée `Agent(a, b)` ; null si absente. */
export function delegationDe(tools) {
  const entree = decouperTools(tools).find((t) => /^Agent\b/.test(t));
  if (!entree) return null;
  const m = entree.match(/^Agent\((.*)\)$/);
  return m ? m[1].split(',').map((x) => x.trim()).filter(Boolean) : [];
}

function controlesCommuns(nom, agent, raisons) {
  const { data, body } = agent;
  if (data.name !== nom) raisons.push(`\`name\` (« ${data.name ?? ''} ») différent du nom de fichier.`);
  const desc = String(data.description || '').trim();
  if (desc.length < MIN_DESCRIPTION) raisons.push(`Description absente ou trop courte (${desc.length} caractères, minimum ${MIN_DESCRIPTION}).`);
  if (desc.length > MAX_DESCRIPTION) raisons.push(`Description trop longue (${desc.length} caractères, plafond ${MAX_DESCRIPTION}).`);
  if (!body || body.trim().length < 200) raisons.push('Corps quasi vide : contrat d\'exécution absent.');
}

function controlerSkills(racine, declarees, attendues, raisons) {
  const liste = normaliserListe(declarees);
  for (const s of attendues) {
    if (!liste.includes(s)) raisons.push(`Skill attendue non préchargée : ${s}.`);
  }
  for (const s of liste) {
    if (!existsSync(join(racine, '.claude', 'skills', s, 'SKILL.md'))) {
      raisons.push(`Skill préchargée absente du projet : ${s}.`);
    }
  }
}

/**
 * Valide l'équipe d'agents installée contre le registre.
 *
 * @param {string} racine
 * @returns {{ ok: boolean, installed: boolean, total: number, valid: number, results: { name: string, kind: string, ok: boolean, raisons: string[] }[], orphans: string[] }}
 */
export function validerEquipe(racine) {
  const results = [];
  const dir = join(racine, '.claude', 'agents');
  const presents = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''))
    : [];
  const connus = new Set([...ROLE_AGENTS, ...SUB_AGENTS].map((a) => a.name));
  const installed = presents.some((n) => connus.has(n));

  // Sous-agents ajoutés par le projet : acceptés s'ils déclarent un gestionnaire
  // (`aiad-managed-by`) qui est un agent de rôle ; orphelins sinon.
  const ajouts = new Map(ROLE_AGENTS.map((r) => [r.name, []]));
  const orphans = [];
  for (const nom of presents) {
    if (connus.has(nom) || GOVERNANCE_AGENTS.includes(nom)) continue;
    const agent = lireAgent(racine, nom);
    const gestionnaire = agent && agent.data['aiad-managed-by'];
    if (!gestionnaire) continue;
    if (ajouts.has(gestionnaire)) ajouts.get(gestionnaire).push(nom);
    else orphans.push(nom);
  }

  for (const role of ROLE_AGENTS) {
    const raisons = [];
    const agent = lireAgent(racine, role.name);
    if (!agent) {
      raisons.push('Fichier absent.');
    } else {
      controlesCommuns(role.name, agent, raisons);
      const geres = [...sousAgentsDe(role.name), ...ajouts.get(role.name)];
      const attendu = [...geres, ...GOVERNANCE_AGENTS];
      const delegation = delegationDe(agent.data.tools);
      if (delegation === null) {
        raisons.push('Champ `tools` sans `Agent(...)` : la délégation n\'est pas bornée.');
      } else {
        for (const d of delegation) {
          if (!attendu.includes(d)) raisons.push(`Délègue à « ${d} », qui n'est pas géré par ce rôle.`);
        }
        for (const a of geres) {
          if (!delegation.includes(a)) raisons.push(`Sous-agent « ${a} » absent de la liste Agent(...).`);
        }
      }
      controlerSkills(racine, agent.data.skills, skillsDuRole(role.name), raisons);
    }
    results.push({ name: role.name, kind: 'role-agent', ok: raisons.length === 0, raisons });
  }

  for (const sub of SUB_AGENTS) {
    const raisons = [];
    const agent = lireAgent(racine, sub.name);
    if (!agent) {
      raisons.push('Fichier absent.');
    } else {
      controlesCommuns(sub.name, agent, raisons);
      if (agent.data['aiad-managed-by'] !== sub.owner) {
        raisons.push(`\`aiad-managed-by\` attendu : ${sub.owner} (lu : ${agent.data['aiad-managed-by'] ?? 'absent'}).`);
      }
      const outils = decouperTools(agent.data.tools);
      if (outils.length === 0) raisons.push('Champ `tools` absent : le sous-agent hériterait de tous les outils.');
      if (outils.some((t) => /^(Agent|Task)\b/.test(t))) raisons.push('Un sous-agent ne doit pas disposer de l\'outil Agent.');
      const interdits = normaliserListe(agent.data.disallowedTools);
      for (const t of outils) {
        if (interdits.includes(t)) raisons.push(`Outil « ${t} » à la fois accordé et interdit.`);
      }
      controlerSkills(racine, agent.data.skills, sub.skills, raisons);
    }
    results.push({ name: sub.name, kind: 'sub-agent', ok: raisons.length === 0, raisons });
  }

  const valid = results.filter((r) => r.ok).length;
  return { ok: valid === results.length && orphans.length === 0, installed, total: results.length, valid, results, orphans };
}

/** Structure de l'équipe, pour `agents list --json` et la documentation. */
export function decrireEquipe() {
  return {
    roles: ROLE_AGENTS.map((r) => ({
      name: r.name,
      role: r.role,
      label: r.label,
      question: r.question,
      skills: skillsDuRole(r.name),
      commands: r.commands,
      subAgents: SUB_AGENTS.filter((s) => s.owner === r.name)
        .map((s) => ({ name: s.name, mission: s.mission, model: s.model, tools: s.tools, skills: s.skills })),
    })),
    governance: { agents: GOVERNANCE_AGENTS, managedBy: GOVERNANCE_MANAGER },
  };
}

function afficherListe() {
  const equipe = decrireEquipe();
  logHeader('AIAD SDD Mode — Agents de rôle', `${ROLE_AGENTS.length} assistants · ${SUB_AGENTS.length} sous-agents`);
  for (const r of equipe.roles) {
    console.log(`  ${C.cyan}${C.gras}${r.name}${C.reset} — ${r.label} ${C.gris}« ${r.question} »${C.reset}`);
    console.log(`    ${C.gris}skills : ${r.skills.join(', ')}${C.reset}`);
    for (const s of r.subAgents) {
      console.log(`    └─ ${C.gras}${s.name}${C.reset} ${C.gris}(${s.model})${C.reset} — ${s.mission}`);
    }
    console.log('');
  }
  console.log(`  ${C.gris}Gouvernance Tier 1 (veto, consultable par tous, administrée par ${GOVERNANCE_MANAGER}) : ${GOVERNANCE_AGENTS.join(', ')}${C.reset}`);
  console.log(`\n  Lancer son assistant : ${C.gras}claude --agent aiad-pe${C.reset}   ·   le fixer : ${C.gras}aiad-sdd agents use pe${C.reset}\n`);
}

/**
 * Inscrit (ou retire) l'assistant personnel dans `.claude/settings.local.json`.
 *
 * @param {string} racine
 * @param {string|undefined} saisie rôle (`pe`, `tech-lead`, `aiad-qa`…)
 * @param {{ clear?: boolean }} [options]
 * @returns {{ ok: boolean, agent: string|null, path: string, message: string }}
 */
export function choisirAssistant(racine, saisie, options = {}) {
  const chemin = join(racine, '.claude', 'settings.local.json');
  let reglages = {};
  if (existsSync(chemin)) {
    try {
      reglages = JSON.parse(readFileSync(chemin, 'utf-8'));
    } catch {
      return { ok: false, agent: null, path: chemin, message: 'settings.local.json illisible (JSON invalide) — aucun changement.' };
    }
  }
  if (options.clear) {
    delete reglages.agent;
  } else {
    const role = resoudreRole(saisie);
    if (!role) {
      const roles = ROLE_AGENTS.map((r) => r.role.toLowerCase()).join(', ');
      return { ok: false, agent: null, path: chemin, message: `Rôle inconnu : « ${saisie || ''} ». Rôles : ${roles}.` };
    }
    if (!existsSync(join(racine, '.claude', 'agents', `${role.name}.md`))) {
      return { ok: false, agent: null, path: chemin, message: `${role.name} n'est pas installé — lance \`aiad-sdd update\`.` };
    }
    reglages.agent = role.name;
  }
  mkdirSync(join(racine, '.claude'), { recursive: true });
  writeFileSync(chemin, JSON.stringify(reglages, null, 2) + '\n', 'utf-8');
  const agent = reglages.agent || null;
  return {
    ok: true,
    agent,
    path: chemin,
    message: agent
      ? `Assistant par défaut de tes sessions : ${agent} (.claude/settings.local.json — réglage personnel, hors dépôt).`
      : 'Assistant par défaut retiré.',
  };
}

/**
 * Point d'entrée CLI : `aiad-sdd agents <list|validate|use> [rôle|none] [--json]`.
 *
 * @returns {Promise<number>} code de sortie
 */
export async function commandeAgents(racine, sub, arg, options = {}) {
  const { json = false } = options;

  if (!sub || sub === 'list') {
    if (json) process.stdout.write(JSON.stringify(decrireEquipe(), null, 2) + '\n');
    else afficherListe();
    return 0;
  }

  if (sub === 'validate') {
    const rapport = validerEquipe(racine);
    if (json) {
      process.stdout.write(JSON.stringify(rapport, null, 2) + '\n');
      return rapport.ok ? 0 : 1;
    }
    logHeader('AIAD SDD Mode — Agents validate', `${rapport.total} agent(s) au registre`);
    if (!rapport.installed) {
      console.log(`  ${C.gris}Aucun agent de rôle installé — lance \`aiad-sdd update\`.${C.reset}\n`);
      return 1;
    }
    for (const r of rapport.results) {
      const sym = r.ok ? `${C.vert}✓${C.reset}` : `${C.rouge}✗${C.reset}`;
      log(sym, `${C.gras}${r.name}${C.reset} ${C.gris}— ${r.kind}${C.reset}`);
      for (const m of r.raisons) console.log(`     ${C.rouge}↳${C.reset} ${m}`);
    }
    for (const o of rapport.orphans) {
      log(`${C.rouge}✗${C.reset}`, `${C.gras}${o}${C.reset} ${C.gris}— gestionnaire inconnu (aiad-managed-by)${C.reset}`);
    }
    console.log(rapport.ok
      ? `\n${C.vert}${C.gras}  ✓ Équipe conforme au registre (${rapport.valid}/${rapport.total}).${C.reset}\n`
      : `\n${C.rouge}${C.gras}  ✗ ${rapport.total - rapport.valid + rapport.orphans.length} écart(s) avec le registre.${C.reset}\n`);
    return rapport.ok ? 0 : 1;
  }

  if (sub === 'use') {
    const r = choisirAssistant(racine, arg, { clear: arg === 'none' });
    if (json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    else console.log(`\n  ${r.ok ? `${C.vert}✓${C.reset}` : `${C.rouge}✗${C.reset}`} ${r.message}\n`);
    return r.ok ? 0 : 1;
  }

  console.error(`\n  Sous-commande inconnue : "${sub}"\n  Disponible : aiad-sdd agents list | validate | use <rôle|none>\n`);
  return 1;
}
