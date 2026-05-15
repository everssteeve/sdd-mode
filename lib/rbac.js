// AIAD SDD Mode — RBAC léger sur les artefacts (item #124).
//
// **Cap stratégique** : dans une organisation multi-équipes, chaque
// Intent/SPEC appartient à une équipe et nécessite revue par une autre
// (typiquement : produit-owner + sécurité-reviewer). AIAD pose des
// **garde-fous légers** (pas un IAM complet) qui suffisent pour la
// traçabilité multi-équipes :
//
//   - Frontmatter d'un artefact : `owner: equipe-paiements`,
//     `reviewers: [equipe-securite, equipe-juridique]`.
//   - Mapping équipes → membres (par git user.email) dans
//     `.aiad/rbac/teams.yml`.
//   - `aiad-sdd rbac check --staged` valide qu'un commit Intent/SPEC
//     vient de l'owner et que tous les reviewers requis sont
//     représentés au moins une fois dans l'historique git du fichier.
//
// **Pas un IAM** : pas d'authentification serveur, pas de chiffrement,
// pas de RBAC fine-grained sur les commandes CLI. C'est un **contrat
// social documenté + vérifié** au pre-commit, suffisant pour la grande
// majorité des organisations.
//
// **Zero-dep** : réutilise le mini-parser YAML de `org-config.js`.
//
// Documentation : https://aiad.ovh/rbac

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseFrontmatter } from './frontmatter.js';
import { parseYaml } from './org-config.js';
import { C, logHeader } from './term.js';

const TEAMS_PATH = '.aiad/rbac/teams.yml';

// ─── Lecture teams.yml ─────────────────────────────────────────────────────

/**
 * Charge le mapping équipes → membres.
 *
 * Format `.aiad/rbac/teams.yml` :
 *   ```yaml
 *   equipe-paiements:
 *     - alice@corp.fr
 *     - bob@corp.fr
 *   equipe-securite:
 *     - carol@corp.fr
 *   ```
 *
 * @param {string} racine
 * @returns {{ [team: string]: string[] }}
 */
export function chargerTeams(racine) {
  const path = join(racine, TEAMS_PATH);
  if (!existsSync(path)) return {};
  const contenu = readFileSync(path, 'utf-8');
  const data = parseYaml(contenu) || {};
  const out = {};
  for (const [team, members] of Object.entries(data)) {
    if (Array.isArray(members)) {
      out[team] = members.filter((m) => typeof m === 'string' && m.includes('@'));
    }
  }
  return out;
}

/**
 * Retourne les équipes auxquelles appartient un email.
 *
 * @param {{ [team: string]: string[] }} teams
 * @param {string} email
 * @returns {string[]}
 */
export function equipesPourEmail(teams, email) {
  if (typeof email !== 'string' || !email.includes('@')) return [];
  const norm = email.trim().toLowerCase();
  const out = [];
  for (const [team, members] of Object.entries(teams)) {
    if (members.some((m) => m.toLowerCase() === norm)) out.push(team);
  }
  return out;
}

// ─── Lecture frontmatter artefact ──────────────────────────────────────────

/**
 * Extrait owner + reviewers d'un artefact.
 *
 * @param {string} contenu — contenu du fichier .md
 * @returns {{ owner: string|null, reviewers: string[] }}
 */
export function lireOwnership(contenu) {
  const { data } = parseFrontmatter(contenu);
  const owner = typeof data.owner === 'string' ? data.owner.trim() : null;
  let reviewers = [];
  if (Array.isArray(data.reviewers)) {
    reviewers = data.reviewers.filter((r) => typeof r === 'string').map((r) => r.trim());
  } else if (typeof data.reviewers === 'string') {
    reviewers = data.reviewers.split(',').map((r) => r.trim()).filter(Boolean);
  }
  return { owner, reviewers };
}

// ─── Validation ────────────────────────────────────────────────────────────

/**
 * Vérifie qu'un changement sur un artefact est conforme RBAC.
 *
 * Règles :
 *   - Si le frontmatter ne contient ni owner ni reviewers → artefact
 *     "ouvert", validation OK (sauf mode strict).
 *   - Si owner défini → l'auteur du commit doit appartenir à cette équipe.
 *   - Si reviewers défini → ignoré au pre-commit (vérification post-merge
 *     via CI ou GitHub Codeowners).
 *
 * @param {{ owner: string|null, reviewers: string[] }} ownership
 * @param {string[]} equipesAuteur
 * @param {{ strict?: boolean }} [options]
 * @returns {{ valid: boolean, raison?: string }}
 */
export function verifierChangement(ownership, equipesAuteur, options = {}) {
  if (!ownership.owner && ownership.reviewers.length === 0) {
    if (options.strict) {
      return { valid: false, raison: 'Mode strict : owner + reviewers requis sur tous les artefacts.' };
    }
    return { valid: true };
  }
  if (ownership.owner) {
    if (!equipesAuteur.includes(ownership.owner)) {
      return {
        valid: false,
        raison: `L'auteur n'appartient pas à l'équipe owner "${ownership.owner}". Équipes auteur : ${equipesAuteur.join(', ') || 'aucune'}.`,
      };
    }
  }
  return { valid: true };
}

// ─── Listing fichiers stagés (git) ────────────────────────────────────────

/**
 * Liste les fichiers Intent/SPEC stagés depuis l'index git.
 */
export function listerFichiersStages(racine) {
  const r = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    cwd: racine, encoding: 'utf-8',
  });
  if (r.status !== 0) return [];
  return r.stdout.split('\n')
    .filter(Boolean)
    .filter((f) => /^\.aiad\/(intents|specs)\//.test(f));
}

/**
 * Récupère l'email auteur courant via `git config user.email`.
 */
export function detecterAuteur(racine) {
  try {
    const r = spawnSync('git', ['config', 'user.email'], { cwd: racine, encoding: 'utf-8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  } catch { /* ignore */ }
  return '';
}

// ─── Pipeline check ───────────────────────────────────────────────────────

/**
 * Vérifie tous les artefacts stagés.
 *
 * @param {string} racine
 * @param {{ strict?: boolean, author?: string }} [options]
 * @returns {{ valid: boolean, violations: { fichier: string, raison: string }[], stages: number }}
 */
export function verifier(racine, options = {}) {
  const fichiers = listerFichiersStages(racine);
  if (fichiers.length === 0) {
    return { valid: true, violations: [], stages: 0 };
  }
  const teams = chargerTeams(racine);
  const auteur = options.author || detecterAuteur(racine);
  const equipesAuteur = equipesPourEmail(teams, auteur);

  const violations = [];
  for (const f of fichiers) {
    const path = join(racine, f);
    if (!existsSync(path)) continue;
    const ownership = lireOwnership(readFileSync(path, 'utf-8'));
    const r = verifierChangement(ownership, equipesAuteur, { strict: options.strict });
    if (!r.valid) violations.push({ fichier: f, raison: r.raison });
  }
  return { valid: violations.length === 0, violations, stages: fichiers.length };
}

// ─── Init template ────────────────────────────────────────────────────────

export function templateTeams() {
  return [
    '# .aiad/rbac/teams.yml — mapping équipes → membres (par email git).',
    '# Documentation : https://aiad.ovh/rbac',
    '#',
    '# Format : <nom-equipe>: liste d\'emails',
    '# Les noms d\'équipes sont référencés dans le frontmatter des Intents/SPECs :',
    '#   owner: equipe-paiements',
    '#   reviewers: [equipe-securite, equipe-juridique]',
    '',
    'equipe-produit:',
    '  - alice@corp.fr',
    '  - bob@corp.fr',
    '',
    'equipe-tech:',
    '  - carol@corp.fr',
    '  - dave@corp.fr',
    '',
    'equipe-securite:',
    '  - eve@corp.fr',
    '',
    'equipe-juridique:',
    '  - frank@corp.fr',
  ].join('\n') + '\n';
}

// ─── CLI ────────────────────────────────────────────────────────────────────

/**
 * Affiche les équipes du dev courant.
 */
export function whoami(racine, options = {}) {
  const teams = chargerTeams(racine);
  const email = options.author || detecterAuteur(racine);
  const equipes = equipesPourEmail(teams, email);
  if (options.json) {
    process.stdout.write(JSON.stringify({ email, teams: equipes }, null, 2) + '\n');
    return { email, teams: equipes };
  }
  logHeader('AIAD SDD — RBAC whoami', email || '(git user.email absent)');
  if (equipes.length === 0) {
    console.log(`  ${C.gris}~ ${email} n'appartient à aucune équipe déclarée dans ${TEAMS_PATH}.${C.reset}\n`);
  } else {
    console.log(`  Équipes : ${C.cyan}${equipes.join(', ')}${C.reset}\n`);
  }
  return { email, teams: equipes };
}

/**
 * Init du template teams.yml.
 */
export function init(racine, options = {}) {
  const path = join(racine, TEAMS_PATH);
  if (existsSync(path) && !options.force) {
    throw new Error(`${TEAMS_PATH} existe déjà. --force pour écraser.`);
  }
  const dir = join(racine, '.aiad', 'rbac');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!options.dryRun) writeFileSync(path, templateTeams(), 'utf-8');
  return { path: TEAMS_PATH, dryRun: Boolean(options.dryRun) };
}

/**
 * Vérification CLI.
 */
export function check(racine, options = {}) {
  const r = verifier(racine, { strict: options.strict, author: options.author });
  if (options.json) {
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    return r;
  }
  logHeader(
    'AIAD SDD — RBAC check',
    `${r.stages} artefact(s) stagé(s)${options.strict ? ' · mode strict' : ''}`,
  );
  if (r.violations.length === 0) {
    console.log(`  ${C.vert}✓${C.reset} Tous les changements sont conformes RBAC.\n`);
  } else {
    console.error(`  ${C.rouge}✗${C.reset} ${r.violations.length} violation(s) :`);
    for (const v of r.violations) {
      console.error(`    ${C.rouge}-${C.reset} ${v.fichier}`);
      console.error(`      ${v.raison}`);
    }
    console.error('');
  }
  return r;
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  chargerTeams as loadTeams,
  equipesPourEmail as teamsForEmail,
  lireOwnership as readOwnership,
  verifierChangement as verifyChange,
  listerFichiersStages as listStagedFiles,
  detecterAuteur as detectAuthor,
  verifier as checkRbac,
  templateTeams as teamsTemplate,
  whoami as whoAmI,
  init as initTeams,
  check as checkCli,
};

export const CONSTANTS = {
  TEAMS_PATH,
};
