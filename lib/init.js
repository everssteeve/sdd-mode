import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { addGovernance } from './governance.js';
import { installerHooks } from './hooks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

const COULEURS = {
  vert: '\x1b[32m',
  jaune: '\x1b[33m',
  cyan: '\x1b[36m',
  gris: '\x1b[90m',
  gras: '\x1b[1m',
  reset: '\x1b[0m',
};

function log(symbole, message) {
  console.log(`  ${symbole} ${message}`);
}

function logCreation(chemin) {
  log(`${COULEURS.vert}+${COULEURS.reset}`, chemin);
}

function logExiste(chemin) {
  log(`${COULEURS.jaune}~${COULEURS.reset}`, `${chemin} ${COULEURS.gris}(existe déjà, ignoré)${COULEURS.reset}`);
}

function logEcrase(chemin) {
  log(`${COULEURS.jaune}!${COULEURS.reset}`, `${chemin} ${COULEURS.gris}(écrasé)${COULEURS.reset}`);
}

function ecrireFichier(destination, contenu, force = false) {
  if (existsSync(destination) && !force) {
    logExiste(relative(process.cwd(), destination));
    return false;
  }
  const dir = dirname(destination);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(destination, contenu, 'utf-8');
  if (force && existsSync(destination)) {
    logEcrase(relative(process.cwd(), destination));
  } else {
    logCreation(relative(process.cwd(), destination));
  }
  return true;
}

function copierDossierRecursif(source, destination, force = false) {
  if (!existsSync(source)) return;
  const elements = readdirSync(source);
  for (const element of elements) {
    const cheminSource = join(source, element);
    const cheminDest = join(destination, element);
    const stat = statSync(cheminSource);
    if (stat.isDirectory()) {
      if (!existsSync(cheminDest)) {
        mkdirSync(cheminDest, { recursive: true });
      }
      copierDossierRecursif(cheminSource, cheminDest, force);
    } else {
      const contenu = readFileSync(cheminSource, 'utf-8');
      ecrireFichier(cheminDest, contenu, force);
    }
  }
}

export async function init(projetDir, options = {}) {
  const { sansGouvernance = false, force = false, withGitHooks = false } = options;

  const pkgJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  const version = pkgJson.version;

  console.log(`
${COULEURS.cyan}${COULEURS.gras}  AIAD SDD Mode — Initialisation v${version}${COULEURS.reset}
${COULEURS.gris}  Spec Driven Development pour Claude Code${COULEURS.reset}
`);

  // 1. Structure .aiad/
  console.log(`${COULEURS.gras}  Structure .aiad/${COULEURS.reset}\n`);

  const aiadDir = join(projetDir, '.aiad');
  const dossiers = [
    join(aiadDir, 'intents'),
    join(aiadDir, 'intents', 'archive'),
    join(aiadDir, 'specs'),
    join(aiadDir, 'specs', 'archive'),
    join(aiadDir, 'facts'),
    join(aiadDir, 'metrics'),
    join(aiadDir, 'metrics', 'security'),
    join(aiadDir, 'metrics', 'audit'),
  ];

  for (const dossier of dossiers) {
    if (!existsSync(dossier)) {
      mkdirSync(dossier, { recursive: true });
      logCreation(relative(projetDir, dossier) + '/');
    }
  }

  // Copier les templates .aiad/
  copierDossierRecursif(
    join(TEMPLATES_DIR, '.aiad'),
    aiadDir,
    force
  );

  // 2. Commandes Claude Code
  console.log(`\n${COULEURS.gras}  Commandes Claude Code (.claude/commands/)${COULEURS.reset}\n`);

  copierDossierRecursif(
    join(TEMPLATES_DIR, '.claude'),
    join(projetDir, '.claude'),
    force
  );

  // 3. CLAUDE.md
  console.log(`\n${COULEURS.gras}  Configuration agent (CLAUDE.md)${COULEURS.reset}\n`);

  const claudeMdSource = join(TEMPLATES_DIR, 'CLAUDE.md');
  const claudeMdDest = join(projetDir, 'CLAUDE.md');

  if (existsSync(claudeMdDest) && !force) {
    // Append SDD section si CLAUDE.md existe déjà
    const contenuExistant = readFileSync(claudeMdDest, 'utf-8');
    if (!contenuExistant.includes('# SDD Mode')) {
      const sddSection = readFileSync(claudeMdSource, 'utf-8');
      writeFileSync(claudeMdDest, contenuExistant + '\n\n' + sddSection, 'utf-8');
      log(`${COULEURS.vert}+${COULEURS.reset}`, 'CLAUDE.md — section SDD Mode ajoutée');
    } else {
      logExiste('CLAUDE.md (section SDD Mode déjà présente)');
    }
  } else {
    const contenu = readFileSync(claudeMdSource, 'utf-8');
    ecrireFichier(claudeMdDest, contenu, force);
  }

  // 4. Gouvernance
  if (!sansGouvernance) {
    console.log(`\n${COULEURS.gras}  Agents de gouvernance${COULEURS.reset}\n`);
    await addGovernance(projetDir, { force, silencieux: true });
  }

  // 5. Hooks Git (optionnel)
  if (withGitHooks) {
    await installerHooks(projetDir, { force });
  }

  // 6. .gitignore update
  const gitignorePath = join(projetDir, '.gitignore');
  if (existsSync(gitignorePath)) {
    const gitignore = readFileSync(gitignorePath, 'utf-8');
    if (!gitignore.includes('.aiad/intents/archive')) {
      writeFileSync(gitignorePath, gitignore + '\n# AIAD SDD Mode\n# (aucun fichier ignoré — tout est versionné)\n', 'utf-8');
    }
  }

  // Résumé
  console.log(`
${COULEURS.cyan}${COULEURS.gras}  SDD Mode initialisé avec succès !${COULEURS.reset}

${COULEURS.gras}  Prochaines étapes :${COULEURS.reset}

  ${COULEURS.cyan}1.${COULEURS.reset} Rédiger le PRD           ${COULEURS.gris}→ .aiad/PRD.md${COULEURS.reset}
  ${COULEURS.cyan}2.${COULEURS.reset} Définir l'architecture   ${COULEURS.gris}→ .aiad/ARCHITECTURE.md${COULEURS.reset}
  ${COULEURS.cyan}3.${COULEURS.reset} Configurer l'agent       ${COULEURS.gris}→ .aiad/AGENT-GUIDE.md${COULEURS.reset}
  ${COULEURS.cyan}4.${COULEURS.reset} Activer le Drift Lock    ${COULEURS.gris}→ npx aiad-sdd hooks${withGitHooks ? ' (déjà installé)' : ''}${COULEURS.reset}
  ${COULEURS.cyan}5.${COULEURS.reset} Commencer à spécifier    ${COULEURS.gris}→ /sdd intent dans Claude Code${COULEURS.reset}

${COULEURS.gras}  Routers (v1.7) — chargés à froid, sous-commandes à la demande :${COULEURS.reset}

  ${COULEURS.cyan}/sdd <sub>${COULEURS.reset}         Cycle SDD : init, intent, spec, gate, exec, validate,
                       drift-check, fact, security, audit, context, resume, split
  ${COULEURS.cyan}/aiad <sub>${COULEURS.reset}        Rituels & métriques : init, onboard, status, health,
                       gouvernance, tech-review, standup, demo, retro, intention,
                       sync-strat, dora, flow, dashboard
  ${COULEURS.cyan}/aiad-help${COULEURS.reset}         Aide contextuelle, parcours type, recherche d'une commande

${COULEURS.gras}  Exemples :${COULEURS.reset}

  ${COULEURS.cyan}/sdd intent${COULEURS.reset}        Capturer une intention
  ${COULEURS.cyan}/sdd spec${COULEURS.reset}          Rédiger une SPEC
  ${COULEURS.cyan}/sdd gate${COULEURS.reset}          Valider via Execution Gate
  ${COULEURS.cyan}/aiad status${COULEURS.reset}       État du projet
  ${COULEURS.cyan}/aiad retro${COULEURS.reset}        Rétrospective de fin d'itération

${COULEURS.gris}  Compat-rétro : les anciens alias plats (/sdd-spec, /aiad-status, …) restent${COULEURS.reset}
${COULEURS.gris}  fonctionnels pendant 1 version et seront retirés à la v2.${COULEURS.reset}

  ${COULEURS.gris}aiad-sdd v${version} — aiad.ovh${COULEURS.reset}
`);
}
