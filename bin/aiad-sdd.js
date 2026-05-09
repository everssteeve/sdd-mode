#!/usr/bin/env node

import { argv, exit, cwd } from 'node:process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { init } from '../lib/init.js';
import { update } from '../lib/update.js';
import { upgrade } from '../lib/upgrade.js';
import { addGovernance } from '../lib/governance.js';
import { showStatus } from '../lib/status.js';
import { installerHooks, desinstallerHooks } from '../lib/hooks.js';
import { bench } from '../lib/coldstart.js';
import { trace } from '../lib/sdd-trace.js';
import { emitRules } from '../lib/emit-rules.js';
import { dashboard, serveDashboard } from '../lib/dashboard.js';

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
    trace [options]       Génère la matrice Intent ↔ SPEC ↔ Code ↔ Tests
    dashboard [options]   Génère le dashboard HTML multi-pages dans dashboard/
    emit-rules [options]  Régénère AGENTS.md, CLAUDE.md, .cursor/rules/, .codex/, GEMINI.md
    help                  Affiche cette aide

  Options init :
    --minimal             Profil AIAD-Lean : 4 commandes (intent/spec/gate/drift-check)
    --upgrade <module>    Ajoute un module (rituals|metrics|gouvernance|all)
    --runtime <list>      Cible IA — claude-code|cursor|codex|copilot|gemini|all
                          (séparés par virgule, défaut : claude-code)
    --sans-gouvernance    Initialise sans les agents de gouvernance
    --with-git-hooks      Installe le hook pre-commit (Drift Lock)
    --force               Écrase les fichiers existants

  Options update :
    --sans-gouvernance    Met à jour sans toucher la gouvernance

  Options hooks :
    --uninstall           Désinstalle le hook pre-commit
    --force               Écrase un hook pre-commit utilisateur existant

  Options trace :
    --format <list>       Formats produits (md,json,html — défaut: tous)
    --out <dir>           Dossier de sortie (défaut: .aiad/metrics/traceability)
    --json                Imprime la matrice JSON sur stdout (CI)
    --fail-on-gap         Exit 1 si gap bloquant détecté (CI)
    --quiet               Pas de résumé console

  Options emit-rules :
    --runtime <list>      Runtimes ciblés — claude-code|cursor|codex|copilot|gemini|all
                          (séparés par virgule, défaut : all)
    --check               Mode CI — exit 1 si divergence avec AGENT-GUIDE

  Options dashboard :
    --out <dir>           Dossier de sortie (défaut : dashboard)
    --quiet               Pas de résumé console
    --serve               Lance un serveur HTTP local après génération
    --port <n>            Port du serveur --serve (défaut : 8765)
    --source-base <url>   URL préfixant les liens vers les fichiers .md sources
                          (ex: GitHub Pages → blob/main/)

  Exemples :
    npx aiad-sdd init                       Initialisation complète
    npx aiad-sdd init --minimal             Profil minimal (4 commandes, ≤ 1k tokens)
    npx aiad-sdd init --upgrade rituals     Ajoute les rituels au profil minimal
    npx aiad-sdd init --upgrade gouvernance Ajoute les agents Tier 1 (AI-ACT, RGPD, …)
    npx aiad-sdd init --upgrade metrics     Ajoute dashboards & métriques DORA/flow
    npx aiad-sdd init --upgrade all         Bascule minimal → profil complet
    npx aiad-sdd init --with-git-hooks      Init + Drift Lock pre-commit
    npx aiad-sdd update                     Mise à jour (préserve vos fichiers)
    npx aiad-sdd init --force               Réinitialisation (écrase tout)
    npx aiad-sdd gouvernance                Met à jour les agents de gouvernance
    npx aiad-sdd hooks                      Installe le hook pre-commit
    npx aiad-sdd hooks --uninstall          Désinstalle le hook pre-commit
    npx aiad-sdd status                     État du projet SDD
    npx aiad-sdd trace                      Génère la matrice de traçabilité (md+json+html)
    npx aiad-sdd trace --fail-on-gap        Échoue si gap bloquant (usage CI)
    npx aiad-sdd dashboard                  Génère le dashboard HTML dans dashboard/
    npx aiad-sdd dashboard --serve          Génère puis sert sur http://127.0.0.1:8765
    npx aiad-sdd dashboard --out docs/dash  Dashboard dans un dossier custom
    npx aiad-sdd emit-rules                 Régénère AGENTS.md + Cursor + Codex + Gemini
    npx aiad-sdd emit-rules --runtime cursor  Cible un runtime unique
    npx aiad-sdd emit-rules --check         Vérifie la parité (usage CI)

  Framework AIAD — Artificial Intelligence Agent Development — Open Source
`;

function lireValeurFlag(nom) {
  const idx = flags.indexOf(nom);
  if (idx === -1) return null;
  const valeur = flags[idx + 1];
  if (!valeur || valeur.startsWith('--')) return null;
  return valeur;
}

function lireListeFlag(nom, defaut) {
  const v = lireValeurFlag(nom);
  if (!v) return defaut;
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

async function main() {
  switch (command) {
    case 'init': {
      const moduleUpgrade = lireValeurFlag('--upgrade');
      if (moduleUpgrade) {
        await upgrade(cwd(), moduleUpgrade, {
          force: flags.includes('--force'),
        });
        break;
      }
      const runtimes = lireListeFlag('--runtime', ['claude-code']);
      await init(cwd(), {
        sansGouvernance: flags.includes('--sans-gouvernance'),
        force: flags.includes('--force'),
        withGitHooks: flags.includes('--with-git-hooks'),
        minimal: flags.includes('--minimal'),
        runtimes,
      });
      break;
    }

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

    case 'trace':
      await trace(cwd(), flags);
      break;

    case 'dashboard': {
      const result = await dashboard(cwd(), {
        out: lireValeurFlag('--out'),
        quiet: flags.includes('--quiet'),
        sourceBase: lireValeurFlag('--source-base'),
      });
      if (flags.includes('--serve')) {
        const port = lireValeurFlag('--port');
        const { server } = await serveDashboard(result.outDir, { port });
        // Garde le process en vie. Ctrl+C arrête le serveur proprement.
        const arret = () => {
          console.log('\n  Arrêt du serveur…');
          server.close(() => process.exit(0));
        };
        process.on('SIGINT', arret);
        process.on('SIGTERM', arret);
        await new Promise(() => {}); // bloque jusqu'à un signal
      }
      break;
    }

    case 'emit-rules':
      await emitRules(cwd(), {
        runtimes: lireListeFlag('--runtime', ['all']),
        check: flags.includes('--check'),
        force: flags.includes('--force'),
      });
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
