// AIAD SDD Mode — Templates CI/CD (item #114).
//
// **Objectif** : exposer les templates Jenkinsfile et .drone.yml (et
// l'existant bitbucket-pipelines) via une commande CLI unifiée
// `aiad-sdd ci-template <forge> [--out path]` qui les copie dans le
// projet courant à un emplacement standard.
//
// **Forges couvertes** :
//   - `jenkins` → `templates/forges/Jenkinsfile.aiad` → `Jenkinsfile`
//   - `drone` → `templates/forges/.drone.aiad.yml` → `.drone.yml`
//   - `bitbucket` → `templates/forges/bitbucket-pipelines.aiad.yml`
//                  → `bitbucket-pipelines.yml`
//
// Les templates GitHub Actions et GitLab CI existent dans
// `templates/.github/` et `templates/.gitlab-ci.yml` et sont copiés
// automatiquement par `aiad-sdd init` (pas exposés ici car ils ne
// nécessitent pas de sélection manuelle).
//
// Documentation : https://aiad.ovh/ci-templates

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMeta } from './meta.js';
import { C, logHeader } from './term.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, '..', 'templates', 'forges');

/**
 * Catalogue de forges supportées avec leurs templates source et cible
 * standard dans le projet.
 */
export const FORGES = {
  github: {
    label: 'GitHub Actions',
    source: 'github-actions.aiad.yml',
    cible: '.github/workflows/aiad.yml',
    description: 'GitHub Actions (matrix 5-checks PR incl. dashboard --check + brief --strict gate + Pages deploy + badges commit auto main)',
  },
  jenkins: {
    label: 'Jenkins',
    source: 'Jenkinsfile.aiad',
    cible: 'Jenkinsfile',
    description: 'Pipeline déclaratif Jenkins (2.346+, agent Docker, 6 stages)',
  },
  gitlab: {
    label: 'GitLab CI',
    source: '.gitlab-ci.aiad.yml',
    cible: '.gitlab-ci.aiad.yml',
    description: 'GitLab CI/CD (6 jobs : trace+SARIF, emit-rules, docs, update, dashboard-check, dashboard ; rules path-aware ; à inclure via `include:`)',
  },
  drone: {
    label: 'Drone CI',
    source: '.drone.aiad.yml',
    cible: '.drone.yml',
    description: 'Drone CI 1.x (self-hosted, 8 steps avec dépendances)',
  },
  bitbucket: {
    label: 'Bitbucket Pipelines',
    source: 'bitbucket-pipelines.aiad.yml',
    cible: 'bitbucket-pipelines.yml',
    description: 'Bitbucket Pipelines (Cloud, definitions+steps réutilisables, 5 steps PR incl. dashboard --check)',
  },
  azure: {
    label: 'Azure Pipelines',
    source: 'azure-pipelines.aiad.yml',
    cible: 'azure-pipelines.yml',
    description: 'Azure Pipelines (DevOps cloud, matrix 5-checks PR incl. dashboard --check + main-build dashboard+brief --strict, commit auto badges)',
  },
};

// ─── Listing ──────────────────────────────────────────────────────────────

export function listerForges() {
  return Object.entries(FORGES).map(([id, meta]) => ({ id, ...meta }));
}

// ─── Lecture du template source ───────────────────────────────────────────

/**
 * Renvoie le contenu d'un template forge.
 *
 * @param {string} forgeId
 * @returns {string}
 */
export function lireTemplate(forgeId) {
  const forge = FORGES[forgeId];
  if (!forge) {
    throw new Error(`Forge inconnue : "${forgeId}". Disponibles : ${Object.keys(FORGES).join(', ')}.`);
  }
  const path = join(TEMPLATES_DIR, forge.source);
  if (!existsSync(path)) {
    throw new Error(`Template source absent : ${forge.source}.`);
  }
  return readFileSync(path, 'utf-8');
}

// ─── Pipeline CLI ──────────────────────────────────────────────────────────

/**
 * Affiche la liste des forges disponibles.
 */
export function afficherListe(options = {}) {
  const forges = listerForges();
  if (options.json) {
    // (#298) _meta cohérent. 13ᵉ schéma de l'écosystème.
    process.stdout.write(JSON.stringify({
      _meta: buildMeta({ schema: 'aiad-sdd-ci-template', action: 'list' }),
      forges,
    }, null, 2) + '\n');
    return forges;
  }
  logHeader('AIAD SDD — Templates CI/CD', `${forges.length} forge(s) disponible(s)`);
  for (const f of forges) {
    console.log(`  ${C.cyan}${f.id.padEnd(12)}${C.reset} ${f.label}`);
    console.log(`    ${C.gris}${f.description}${C.reset}`);
    console.log(`    ${C.gris}Source : templates/forges/${f.source} → cible projet : ${f.cible}${C.reset}\n`);
  }
  return forges;
}

/**
 * Installe un template dans le projet courant.
 *
 * @param {string} racine
 * @param {string} forgeId
 * @param {{ out?: string, force?: boolean, dryRun?: boolean, json?: boolean }} [options]
 * @returns {{ forge: string, source: string, cible: string, action: 'created'|'overwritten'|'skipped' }}
 */
export function installerTemplate(racine, forgeId, options = {}) {
  const forge = FORGES[forgeId];
  if (!forge) {
    throw new Error(`Forge inconnue : "${forgeId}". Disponibles : ${Object.keys(FORGES).join(', ')}.`);
  }
  const contenu = lireTemplate(forgeId);
  const outRel = options.out || forge.cible;
  const outAbs = join(racine, outRel);

  let action = 'created';
  if (existsSync(outAbs)) {
    if (!options.force) {
      action = 'skipped';
      if (options.json) {
        process.stdout.write(JSON.stringify({
          forge: forgeId, source: forge.source, cible: outRel, action, reason: 'exists',
        }, null, 2) + '\n');
        return { forge: forgeId, source: forge.source, cible: outRel, action };
      }
      console.error(`\n  ${C.jaune}⚠${C.reset} Fichier déjà existant : ${outRel}.`);
      console.error(`    Utilise ${C.cyan}--force${C.reset} pour écraser, ou ${C.cyan}--out <chemin>${C.reset} pour cibler ailleurs.\n`);
      return { forge: forgeId, source: forge.source, cible: outRel, action };
    }
    action = 'overwritten';
  }

  if (!options.dryRun) {
    if (!existsSync(dirname(outAbs))) mkdirSync(dirname(outAbs), { recursive: true });
    writeFileSync(outAbs, contenu, 'utf-8');
  }

  if (options.json) {
    process.stdout.write(JSON.stringify({
      forge: forgeId, source: forge.source, cible: outRel, action,
      dryRun: Boolean(options.dryRun),
    }, null, 2) + '\n');
    return { forge: forgeId, source: forge.source, cible: outRel, action };
  }
  logHeader(`AIAD SDD — CI template : ${forge.label}`, `${action} : ${outRel}`);
  console.log(`  ${C.vert}✓${C.reset} ${options.dryRun ? '(dry-run, fichier non écrit)' : `Template ${forge.label} installé dans ${C.cyan}${outRel}${C.reset}`}`);
  // (#234) Liste réelle des commandes appelées par le template (regex sur
  // `aiad-sdd <cmd>` + flags) — auparavant hardcodé pour Jenkins seul.
  const cmds = extraireCommandes(contenu);
  if (cmds.length > 0) {
    console.log(`  ${C.gris}Le pipeline appelle : ${cmds.join(', ')}.${C.reset}\n`);
  } else {
    console.log('');
  }
  return { forge: forgeId, source: forge.source, cible: outRel, action };
}

// (#234) Extrait les invocations `aiad-sdd <cmd> [flags clés]` d'un template.
// Garde les flags `--check`, `--fail-on-gap`, `--strict=N`, `verify`, `check`
// (sous-commandes), dédupe en préservant l'ordre, max 8 entrées pour rester
// lisible.
export function extraireCommandes(contenu) {
  // Match `aiad-sdd <cmd>` puis optionnellement une sous-commande (mot, pas
  // un flag) et les flags qui suivent. La sous-commande commence par une
  // lettre pour ne pas capturer `--quiet` comme "sous-commande".
  const re = /aiad-sdd\s+([a-zA-Z][\w-]*(?:\s+[a-zA-Z][\w-]*)?)((?:\s+--[\w-]+(?:=\S+)?)*)/g;
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(contenu)) != null) {
    const cmd = m[1].trim();
    // Garde seulement les flags d'intérêt pour le résumé
    const flags = (m[2].match(/--(check|fail-on-gap|strict(?:=\d+)?)/g) || []).join(' ');
    const display = flags ? `${cmd} ${flags}` : cmd;
    if (!seen.has(display)) {
      seen.add(display);
      out.push(display);
      if (out.length >= 8) break;
    }
  }
  return out;
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  listerForges as listForges,
  lireTemplate as readTemplate,
  afficherListe as showList,
  installerTemplate as installTemplate,
  extraireCommandes as extractCommands,
};
