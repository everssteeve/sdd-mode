#!/usr/bin/env node

import { argv, exit, cwd } from 'node:process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { init } from '../lib/init.js';
import { update } from '../lib/update.js';
import { addGovernance } from '../lib/governance.js';
import { showStatus } from '../lib/status.js';
import { installerHooks, desinstallerHooks } from '../lib/hooks.js';
import { bench } from '../lib/coldstart.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const VERSION = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')).version;
const command = argv[2];
const flags = argv.slice(3);

const AIDE = `
  aiad-sdd v${VERSION} — Spec Driven Development pour Claude Code
  https://aiad.ovh

  Commandes :
    init [options]        Initialise SDD Mode dans le projet courant
    update [options]      Met à jour un projet existant (commandes + gouvernance)
    gouvernance           Ajoute/met à jour les agents de gouvernance
    hooks [options]       Installe / désinstalle le hook Git pre-commit (Drift Lock)
    status                Affiche l'état SDD du projet
    bench                 Mesure le poids des frontmatters de commandes (cold-start)
    help                  Affiche cette aide

  Options init :
    --sans-gouvernance    Initialise sans les agents de gouvernance
    --with-git-hooks      Installe le hook pre-commit (Drift Lock)
    --force               Écrase les fichiers existants

  Options update :
    --sans-gouvernance    Met à jour sans toucher la gouvernance

  Options hooks :
    --uninstall           Désinstalle le hook pre-commit
    --force               Écrase un hook pre-commit utilisateur existant

  Exemples :
    npx aiad-sdd init                       Initialisation complète
    npx aiad-sdd init --with-git-hooks      Init + Drift Lock pre-commit
    npx aiad-sdd update                     Mise à jour (préserve vos fichiers)
    npx aiad-sdd init --force               Réinitialisation (écrase tout)
    npx aiad-sdd gouvernance                Met à jour les agents de gouvernance
    npx aiad-sdd hooks                      Installe le hook pre-commit
    npx aiad-sdd hooks --uninstall          Désinstalle le hook pre-commit
    npx aiad-sdd status                     État du projet SDD

  Framework AIAD — Artificial Intelligence Agent Development — Open Source
`;

async function main() {
  switch (command) {
    case 'init':
      await init(cwd(), {
        sansGouvernance: flags.includes('--sans-gouvernance'),
        force: flags.includes('--force'),
        withGitHooks: flags.includes('--with-git-hooks'),
      });
      break;

    case 'update':
      await update(cwd(), {
        sansGouvernance: flags.includes('--sans-gouvernance'),
      });
      break;

    case 'gouvernance':
      await addGovernance(cwd(), { force: flags.includes('--force') });
      break;

    case 'hooks':
      if (flags.includes('--uninstall')) {
        await desinstallerHooks(cwd());
      } else {
        await installerHooks(cwd(), { force: flags.includes('--force') });
      }
      break;

    case 'status':
      await showStatus(cwd());
      break;

    case 'bench':
      bench(cwd());
      break;

    case 'help':
    case '--help':
    case '-h':
    case undefined:
      console.log(AIDE);
      break;

    case 'version':
    case '--version':
    case '-v':
      console.log(`aiad-sdd v${VERSION}`);
      break;

    default:
      console.error(`\n  Commande inconnue : "${command}"\n`);
      console.log(AIDE);
      exit(1);
  }
}

main().catch((err) => {
  console.error('\n  Erreur :', err.message);
  exit(1);
});
