import { existsSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { readdir, stat as statAsync, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { addGovernance } from './governance.js';
import { installerHooks } from './hooks.js';
import { emitRules } from './emit-rules.js';
import { COLORS as COULEURS, log, logCreation, logExiste, logEcrase } from './term.js';
import { ensureDir } from './fs-ops.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

function ecrireFichier(destination, contenu, force = false, { dryRun = false } = {}) {
  const rel = relative(process.cwd(), destination);
  const suffixe = dryRun ? `${COULEURS.gris} (dry-run)${COULEURS.reset}` : '';
  if (existsSync(destination) && !force) {
    logExiste(rel + suffixe);
    return false;
  }
  if (!dryRun) {
    ensureDir(dirname(destination));
    writeFileSync(destination, contenu, 'utf-8');
  }
  if (force && existsSync(destination) && !dryRun) {
    logEcrase(rel + suffixe);
  } else {
    logCreation(rel + suffixe);
  }
  return true;
}

// Copie récursive avec logs intégrés (logExiste/logCreation/logEcrase). On ne
// peut pas utiliser fs-ops.copierDossier directement parce qu'il agrège des
// stats au lieu de logger ; les commandes init/update ont des UX distinctes.
function copierDossierRecursif(source, destination, force = false, options = {}) {
  if (!existsSync(source)) return;
  const { exclude = () => false, dryRun = false, _depth = 0 } = options;
  const elements = readdirSync(source);
  for (const element of elements) {
    const cheminSource = join(source, element);
    const cheminDest = join(destination, element);
    const stat = statSync(cheminSource);
    if (exclude(element, cheminSource, _depth)) continue;
    if (stat.isDirectory()) {
      ensureDir(cheminDest, { dryRun });
      copierDossierRecursif(cheminSource, cheminDest, force, {
        exclude,
        dryRun,
        _depth: _depth + 1,
      });
    } else {
      const contenu = readFileSync(cheminSource, 'utf-8');
      ecrireFichier(cheminDest, contenu, force, { dryRun });
    }
  }
}

/**
 * Variante **async** parallélisée de `copierDossierRecursif`. Les enfants
 * d'un dossier sont copiés en parallèle via `Promise.all`, ce qui dispatche
 * les I/O sur le thread pool libuv et accélère sensiblement les copies de
 * monorepos avec disques lents (HDD, NFS, CI runners).
 *
 * **Trade-off** : l'ordre des logs devient légèrement non-déterministe au
 * sein d'un dossier (les `+ fichier.md` peuvent apparaître dans un ordre
 * différent du `readdir`), mais l'ordre **inter-dossier** (parent avant
 * enfants) est préservé. Cohérence sémantique garantie.
 *
 * @param {string} source
 * @param {string} destination
 * @param {boolean} force
 * @param {{ exclude?: Function, dryRun?: boolean, _depth?: number }} [options]
 */
export async function copierDossierRecursifAsync(source, destination, force = false, options = {}) {
  if (!existsSync(source)) return;
  const { exclude = () => false, dryRun = false, _depth = 0 } = options;
  const elements = await readdir(source);
  await Promise.all(elements.map(async (element) => {
    const cheminSource = join(source, element);
    const cheminDest = join(destination, element);
    if (exclude(element, cheminSource, _depth)) return;
    const stat = await statAsync(cheminSource);
    if (stat.isDirectory()) {
      ensureDir(cheminDest, { dryRun });
      return copierDossierRecursifAsync(cheminSource, cheminDest, force, {
        exclude,
        dryRun,
        _depth: _depth + 1,
      });
    }
    const contenu = await readFile(cheminSource, 'utf-8');
    // ecrireFichier est sync (logs immédiats) — acceptable car on a déjà
    // parallélisé la lecture/stat et la décision écraser/préserver est
    // courte. Le bottleneck I/O reste la lecture du source.
    ecrireFichier(cheminDest, contenu, force, { dryRun });
  }));
}

export async function init(projetDir, options = {}) {
  const {
    sansGouvernance = false,
    force = false,
    withGitHooks = false,
    minimal = false,
    runtimes = ['claude-code'],
    dryRun = false,
    quiet = false, // (#176) silencieux pour tests d'intégration
  } = options;

  const pkgJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  const version = pkgJson.version;

  // (#176) Si quiet, redirige tous les console.log vers /dev/null le temps
  // de l'exécution. Restauration garantie via try/finally pour ne pas
  // affecter les autres tests parallèles. Pattern préférable au silencer
  // côté test car limité au scope d'init().
  const _origLog = console.log;
  if (quiet) console.log = () => {};
  try {
    return await initInternal(projetDir, options, version);
  } finally {
    if (quiet) console.log = _origLog;
  }
}

async function initInternal(projetDir, options, version) {
  const {
    sansGouvernance = false,
    force = false,
    withGitHooks = false,
    minimal = false,
    runtimes = ['claude-code'],
    dryRun = false,
  } = options;

  if (minimal) {
    return initMinimal(projetDir, { force, version, dryRun });
  }

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
    join(aiadDir, 'research'),
    join(aiadDir, 'exec'),
    join(aiadDir, 'specs'),
    join(aiadDir, 'specs', 'archive'),
    join(aiadDir, 'facts'),
    join(aiadDir, 'metrics'),
    join(aiadDir, 'metrics', 'security'),
    join(aiadDir, 'metrics', 'audit'),
    join(aiadDir, 'metrics', 'traceability'),
    join(aiadDir, 'metrics', 'canary'),
    join(aiadDir, 'canary'),
    join(aiadDir, 'canary', 'cases'),
    join(aiadDir, 'memory'),
    join(aiadDir, 'cycle'),
    join(aiadDir, 'reviews'),
  ];

  const suffixeDry = dryRun ? `${COULEURS.gris} (dry-run)${COULEURS.reset}` : '';

  for (const dossier of dossiers) {
    if (!existsSync(dossier)) {
      ensureDir(dossier, { dryRun });
      logCreation(relative(projetDir, dossier) + '/' + suffixeDry);
    }
  }

  await copierDossierRecursifAsync(
    join(TEMPLATES_DIR, '.aiad'),
    aiadDir,
    force,
    {
      dryRun,
      ...(sansGouvernance
        ? { exclude: (nom, _src, depth) => depth === 0 && nom === 'gouvernance' }
        : {}),
    }
  );

  console.log(`\n${COULEURS.gras}  Commandes Claude Code (.claude/commands/)${COULEURS.reset}\n`);

  await copierDossierRecursifAsync(
    join(TEMPLATES_DIR, '.claude'),
    join(projetDir, '.claude'),
    force,
    { dryRun }
  );

  console.log(`\n${COULEURS.gras}  Configuration agent (CLAUDE.md)${COULEURS.reset}\n`);

  const claudeMdSource = join(TEMPLATES_DIR, 'CLAUDE.md');
  const claudeMdDest = join(projetDir, 'CLAUDE.md');

  if (existsSync(claudeMdDest) && !force) {
    const contenuExistant = readFileSync(claudeMdDest, 'utf-8');
    if (!contenuExistant.includes('# SDD Mode')) {
      const sddSection = readFileSync(claudeMdSource, 'utf-8');
      if (!dryRun) writeFileSync(claudeMdDest, contenuExistant + '\n\n' + sddSection, 'utf-8');
      log(`${COULEURS.vert}+${COULEURS.reset}`, `CLAUDE.md — section SDD Mode ajoutée${suffixeDry}`);
    } else {
      logExiste('CLAUDE.md (section SDD Mode déjà présente)');
    }
  } else {
    const contenu = readFileSync(claudeMdSource, 'utf-8');
    ecrireFichier(claudeMdDest, contenu, force, { dryRun });
  }

  // Gouvernance — pas de support dryRun en aval encore : on saute en mode aperçu.
  if (!sansGouvernance) {
    console.log(`\n${COULEURS.gras}  Agents de gouvernance${COULEURS.reset}\n`);
    if (dryRun) {
      log(`${COULEURS.gris}-${COULEURS.reset}`, `5 agents Tier 1 (AI-ACT/RGPD/RGAA/RGESN/CRA)${suffixeDry}`);
    } else {
      await addGovernance(projetDir, { force, silencieux: true });
    }
  }

  console.log(`\n${COULEURS.gras}  GitHub Actions (CI traceability)${COULEURS.reset}\n`);
  await copierDossierRecursifAsync(
    join(TEMPLATES_DIR, '.github'),
    join(projetDir, '.github'),
    force,
    { dryRun }
  );

  if (withGitHooks) {
    if (dryRun) {
      log(`${COULEURS.gris}-${COULEURS.reset}`, `hook pre-commit (Drift Lock)${suffixeDry}`);
    } else {
      await installerHooks(projetDir, { force });
    }
  }

  const runtimesNonClaude = runtimes.filter((r) => r !== 'claude-code');
  const aBesoinEmit = runtimes.includes('all') || runtimesNonClaude.length > 0 || runtimes.includes('claude-code');
  if (aBesoinEmit) {
    console.log(`\n${COULEURS.gras}  Multi-runtime (AGENTS.md + cibles dérivées)${COULEURS.reset}\n`);
    try {
      await emitRules(projetDir, { runtimes, dryRun });
    } catch (err) {
      console.warn(`  ${COULEURS.jaune}!${COULEURS.reset} emit-rules différé : ${err.message}`);
    }
  }

  const gitignorePath = join(projetDir, '.gitignore');
  if (existsSync(gitignorePath)) {
    const gitignore = readFileSync(gitignorePath, 'utf-8');
    if (!gitignore.includes('.aiad/intents/archive')) {
      if (!dryRun) writeFileSync(gitignorePath, gitignore + '\n# AIAD SDD Mode\n# Override local des toggles de hooks (§3.13) — par machine, non versionné\n.aiad/hooks-config.local.json\n', 'utf-8');
    } else if (!gitignore.includes('hooks-config.local.json')) {
      if (!dryRun) writeFileSync(gitignorePath, gitignore + '\n# Override local des toggles de hooks (§3.13)\n.aiad/hooks-config.local.json\n', 'utf-8');
    }
  }

  // Résumé
  console.log(`
${COULEURS.cyan}${COULEURS.gras}  SDD Mode initialisé avec succès !${COULEURS.reset}

${COULEURS.gras}  Prochaines étapes :${COULEURS.reset}

  ${COULEURS.cyan}1.${COULEURS.reset} Rédiger le PRD           ${COULEURS.gris}→ /sdd prd  (assistant PM) ou .aiad/PRD.md (manuel)${COULEURS.reset}
  ${COULEURS.cyan}2.${COULEURS.reset} Définir l'architecture   ${COULEURS.gris}→ /sdd arch (assistant architecte) ou .aiad/ARCHITECTURE.md (manuel)${COULEURS.reset}
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

const TEMPLATES_MIN_DIR = join(__dirname, '..', 'templates', 'minimal');

async function initMinimal(projetDir, { force, version, dryRun = false }) {
  console.log(`
${COULEURS.cyan}${COULEURS.gras}  AIAD SDD Mode — Profil minimal (Lean) v${version}${COULEURS.reset}
${COULEURS.gris}  4 commandes essentielles, sans gouvernance ni rituels — démarre vite, évolue à la demande${COULEURS.reset}
`);

  // 1. Structure .aiad/ — intents + specs uniquement
  console.log(`${COULEURS.gras}  Structure .aiad/ (lean)${COULEURS.reset}\n`);

  const suffixeDry = dryRun ? `${COULEURS.gris} (dry-run)${COULEURS.reset}` : '';
  const aiadDir = join(projetDir, '.aiad');
  for (const dossier of [join(aiadDir, 'intents'), join(aiadDir, 'specs')]) {
    if (!existsSync(dossier)) {
      ensureDir(dossier, { dryRun });
      logCreation(relative(projetDir, dossier) + '/' + suffixeDry);
    }
  }

  copierDossierRecursif(join(TEMPLATES_MIN_DIR, '.aiad'), aiadDir, force, { dryRun });

  console.log(`\n${COULEURS.gras}  Commandes Claude Code (.claude/commands/) — 4 commandes${COULEURS.reset}\n`);

  copierDossierRecursif(
    join(TEMPLATES_MIN_DIR, '.claude'),
    join(projetDir, '.claude'),
    force,
    { dryRun }
  );

  console.log(`\n${COULEURS.gras}  Configuration agent (CLAUDE.md condensé)${COULEURS.reset}\n`);

  const claudeMdSource = join(TEMPLATES_MIN_DIR, 'CLAUDE.md');
  const claudeMdDest = join(projetDir, 'CLAUDE.md');

  if (existsSync(claudeMdDest) && !force) {
    const contenuExistant = readFileSync(claudeMdDest, 'utf-8');
    if (!contenuExistant.includes('# SDD Mode')) {
      const sddSection = readFileSync(claudeMdSource, 'utf-8');
      if (!dryRun) writeFileSync(claudeMdDest, contenuExistant + '\n\n' + sddSection, 'utf-8');
      log(`${COULEURS.vert}+${COULEURS.reset}`, `CLAUDE.md — section SDD Mode minimal ajoutée${suffixeDry}`);
    } else {
      logExiste('CLAUDE.md (section SDD Mode déjà présente)');
    }
  } else {
    const contenu = readFileSync(claudeMdSource, 'utf-8');
    ecrireFichier(claudeMdDest, contenu, force, { dryRun });
  }

  const gitignorePath = join(projetDir, '.gitignore');
  if (existsSync(gitignorePath)) {
    const gitignore = readFileSync(gitignorePath, 'utf-8');
    if (!gitignore.includes('# AIAD SDD Mode')) {
      if (!dryRun) writeFileSync(gitignorePath, gitignore + '\n# AIAD SDD Mode (profil minimal)\n# (aucun fichier ignoré — tout est versionné)\n', 'utf-8');
    }
  }

  // Résumé
  console.log(`
${COULEURS.cyan}${COULEURS.gras}  Profil minimal initialisé avec succès !${COULEURS.reset}

${COULEURS.gras}  Cycle SDD essentiel :${COULEURS.reset}

  ${COULEURS.cyan}/sdd-intent${COULEURS.reset}        Capturer une intention humaine (POURQUOI)
  ${COULEURS.cyan}/sdd-spec${COULEURS.reset}          Rédiger une SPEC depuis un Intent
  ${COULEURS.cyan}/sdd-gate${COULEURS.reset}          Valider la SPEC (SQS ≥ 4/5)
  ${COULEURS.cyan}/sdd-drift-check${COULEURS.reset}   Vérifier la synchro code/SPEC

${COULEURS.gras}  Évoluer à la demande :${COULEURS.reset}

  ${COULEURS.cyan}npx aiad-sdd init --upgrade gouvernance${COULEURS.reset}   ${COULEURS.gris}Agents Tier 1 (AI-ACT, RGPD, RGAA, RGESN)${COULEURS.reset}
  ${COULEURS.cyan}npx aiad-sdd init --upgrade rituals${COULEURS.reset}       ${COULEURS.gris}Standup, retro, demo, intention, …${COULEURS.reset}
  ${COULEURS.cyan}npx aiad-sdd init --upgrade metrics${COULEURS.reset}       ${COULEURS.gris}Dashboard, DORA, flow${COULEURS.reset}
  ${COULEURS.cyan}npx aiad-sdd init --upgrade all${COULEURS.reset}           ${COULEURS.gris}Profil complet (27 commandes)${COULEURS.reset}

${COULEURS.gras}  Démarre minimal, évolue progressivement.${COULEURS.reset}

  ${COULEURS.gris}aiad-sdd v${version} — aiad.ovh${COULEURS.reset}
`);
}
