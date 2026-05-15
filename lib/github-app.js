// AIAD SDD Mode — GitHub App / Action (item #115).
//
// **Cap stratégique** : permettre l'adoption AIAD via deux voies dans
// l'écosystème GitHub :
//
//   1. **GitHub Action native** (recommandé) — workflow
//      `templates/.github/workflows/aiad-pr-review.yml` qui exécute le
//      pipeline AIAD à chaque PR et publie le commentaire de review +
//      le score EU Sovereignty. Pas de serveur tiers à héberger, fonctionne
//      avec le `GITHUB_TOKEN` automatique. **Souverain par défaut**.
//
//   2. **GitHub App déployée** — manifeste
//      `templates/.github/aiad-app-manifest.yml` à coller dans
//      "Create app from manifest" GitHub. Nécessite un serveur Probot/
//      Octokit hébergé. Pertinent pour les organisations qui veulent une
//      App officielle Marketplace.
//
// Ce module fournit la CLI pour installer ces artefacts dans un projet.
//
// **Zero-dep runtime** : copie de fichiers uniquement.
//
// Documentation : https://aiad.ovh/github-app

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { C, logHeader } from './term.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, '..', 'templates', '.github');

const ARTEFACTS = {
  workflow: {
    label: 'GitHub Action — aiad-pr-review',
    source: 'workflows/aiad-pr-review.yml',
    cible: '.github/workflows/aiad-pr-review.yml',
    description: 'Workflow PR : review + sovereignty + trace, commentaire unique mis à jour',
  },
  manifest: {
    label: 'GitHub App — manifest officiel',
    source: 'aiad-app-manifest.yml',
    cible: '.github/aiad-app-manifest.yml',
    description: 'Manifeste à coller dans "Create app from manifest" GitHub',
  },
};

// ─── Lecture des artefacts ────────────────────────────────────────────────

export function lireArtefact(id) {
  const a = ARTEFACTS[id];
  if (!a) {
    throw new Error(`Artefact inconnu : "${id}". Disponibles : ${Object.keys(ARTEFACTS).join(', ')}.`);
  }
  const path = join(TEMPLATES_DIR, a.source);
  if (!existsSync(path)) throw new Error(`Source absente : ${a.source}.`);
  return readFileSync(path, 'utf-8');
}

export function listerArtefacts() {
  return Object.entries(ARTEFACTS).map(([id, meta]) => ({ id, ...meta }));
}

// ─── Installation ──────────────────────────────────────────────────────────

/**
 * Installe un artefact dans le projet courant.
 *
 * @param {string} racine
 * @param {string} id - 'workflow' | 'manifest'
 * @param {{ out?: string, force?: boolean, dryRun?: boolean, json?: boolean }} [options]
 */
export function installerArtefact(racine, id, options = {}) {
  const a = ARTEFACTS[id];
  if (!a) {
    throw new Error(`Artefact inconnu : "${id}". Disponibles : ${Object.keys(ARTEFACTS).join(', ')}.`);
  }
  const contenu = lireArtefact(id);
  const outRel = options.out || a.cible;
  const outAbs = join(racine, outRel);

  let action = 'created';
  if (existsSync(outAbs)) {
    if (!options.force) {
      action = 'skipped';
      if (options.json) {
        process.stdout.write(JSON.stringify({
          artefact: id, cible: outRel, action, reason: 'exists',
        }, null, 2) + '\n');
        return { artefact: id, cible: outRel, action };
      }
      console.error(`\n  ${C.jaune}⚠${C.reset} Fichier déjà existant : ${outRel}.`);
      console.error(`    Utilise ${C.cyan}--force${C.reset} pour écraser.\n`);
      return { artefact: id, cible: outRel, action };
    }
    action = 'overwritten';
  }

  if (!options.dryRun) {
    if (!existsSync(dirname(outAbs))) mkdirSync(dirname(outAbs), { recursive: true });
    writeFileSync(outAbs, contenu, 'utf-8');
  }

  if (options.json) {
    process.stdout.write(JSON.stringify({
      artefact: id, cible: outRel, action, dryRun: Boolean(options.dryRun),
    }, null, 2) + '\n');
    return { artefact: id, cible: outRel, action };
  }
  logHeader(`AIAD SDD — GitHub : ${a.label}`, `${action} : ${outRel}`);
  console.log(`  ${C.vert}✓${C.reset} ${options.dryRun ? '(dry-run, fichier non écrit)' : `Installé dans ${C.cyan}${outRel}${C.reset}`}`);
  if (id === 'workflow') {
    console.log(`  ${C.gris}Le workflow publie un commentaire AIAD unique (review + sovereignty + trace) à chaque PR.${C.reset}\n`);
  } else if (id === 'manifest') {
    console.log(`  ${C.gris}Pour créer l'App :${C.reset}`);
    console.log(`    1. https://github.com/settings/apps/new`);
    console.log(`    2. "Create from manifest" → coller le contenu de ${outRel}`);
    console.log(`    3. Installer l'App sur les repos cibles\n`);
  }
  return { artefact: id, cible: outRel, action };
}

// ─── Aide setup ────────────────────────────────────────────────────────────

/**
 * Affiche un guide setup pour les deux voies.
 */
export function setup(options = {}) {
  if (options.json) {
    process.stdout.write(JSON.stringify({ artefacts: listerArtefacts() }, null, 2) + '\n');
    return;
  }
  logHeader('AIAD SDD — Setup GitHub', '2 voies disponibles : Action native (rec.) ou App déployée');
  console.log('');
  console.log(`  ${C.gras}Voie 1 : GitHub Action (recommandé)${C.reset}`);
  console.log(`    aiad-sdd github-app install workflow`);
  console.log(`    ${C.gris}Aucun serveur tiers requis. Fonctionne avec GITHUB_TOKEN automatique.${C.reset}`);
  console.log('');
  console.log(`  ${C.gras}Voie 2 : GitHub App déployée${C.reset}`);
  console.log(`    aiad-sdd github-app install manifest`);
  console.log(`    ${C.gris}Nécessite un serveur Probot/Octokit hébergé. Pertinent pour Marketplace.${C.reset}`);
  console.log('');
  console.log(`  Documentation : https://aiad.ovh/github-app\n`);
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  lireArtefact as readArtifact,
  listerArtefacts as listArtifacts,
  installerArtefact as installArtifact,
  setup as showSetup,
};

export const CONSTANTS = {
  ARTEFACTS,
};
