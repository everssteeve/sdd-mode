import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addGovernance } from './governance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

const C = {
  vert: '\x1b[32m',
  jaune: '\x1b[33m',
  rouge: '\x1b[31m',
  cyan: '\x1b[36m',
  gris: '\x1b[90m',
  gras: '\x1b[1m',
  reset: '\x1b[0m',
};

function log(symbole, message) {
  console.log(`  ${symbole} ${message}`);
}
function logCreation(p) { log(`${C.vert}+${C.reset}`, p); }
function logMaj(p) { log(`${C.cyan}↑${C.reset}`, `${p} ${C.gris}(synchronisé)${C.reset}`); }
function logOk(p) { log(`${C.vert}✓${C.reset}`, `${p} ${C.gris}(déjà à jour)${C.reset}`); }
function logPreserve(p) { log(`${C.jaune}~${C.reset}`, `${p} ${C.gris}(préservé)${C.reset}`); }

function ensureDir(d) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

/**
 * Copie un fichier source vers destination ; ne touche jamais aux fichiers
 * personnalisables (PRD/ARCHITECTURE/AGENT-GUIDE) si déjà présents.
 * Retourne 'created' | 'updated' | 'unchanged' | 'preserved'.
 */
function copierFichier(source, destination, { preserve = false, force = false } = {}) {
  ensureDir(dirname(destination));
  if (!existsSync(destination)) {
    writeFileSync(destination, readFileSync(source), 'utf-8');
    return 'created';
  }
  if (preserve && !force) return 'preserved';
  const nouveau = readFileSync(source, 'utf-8');
  const existant = readFileSync(destination, 'utf-8');
  if (nouveau === existant) return 'unchanged';
  if (!force) return 'preserved';
  writeFileSync(destination, nouveau, 'utf-8');
  return 'updated';
}

function copierListe(projetDir, fichiers, stats, { force = false } = {}) {
  for (const fichier of fichiers) {
    const source = join(TEMPLATES_DIR, fichier);
    const dest = join(projetDir, fichier);
    if (!existsSync(source)) continue;
    if (statSync(source).isDirectory()) {
      copierDossier(source, dest, stats, { force });
    } else {
      const result = copierFichier(source, dest, { force });
      const rel = relative(projetDir, dest);
      if (result === 'created') { logCreation(rel); stats.created++; }
      else if (result === 'updated') { logMaj(rel); stats.updated++; }
      else if (result === 'preserved') { logPreserve(rel); stats.preserved++; }
      else { logOk(rel); stats.unchanged++; }
    }
  }
}

function copierDossier(source, destination, stats, { force = false } = {}) {
  if (!existsSync(source)) return;
  ensureDir(destination);
  for (const nom of readdirSync(source)) {
    const s = join(source, nom);
    const d = join(destination, nom);
    if (statSync(s).isDirectory()) {
      copierDossier(s, d, stats, { force });
    } else {
      const result = copierFichier(s, d, { force });
      const rel = relative(process.cwd(), d);
      if (result === 'created') { logCreation(rel); stats.created++; }
      else if (result === 'updated') { logMaj(rel); stats.updated++; }
      else if (result === 'preserved') { logPreserve(rel); stats.preserved++; }
      else { logOk(rel); stats.unchanged++; }
    }
  }
}

// ─── Manifestes des modules ────────────────────────────────────────────────

// Note : tous les chemins sont relatifs à templates/.

// Commandes ritual (router + sous-commandes + alias plats)
const RITUALS_COMMANDS = [
  '.claude/commands/aiad.md',                    // router /aiad
  '.claude/commands/aiad-help.md',
  '.claude/commands/aiad-init.md',
  '.claude/commands/aiad-onboard.md',
  '.claude/commands/aiad-status.md',
  '.claude/commands/aiad-health.md',
  '.claude/commands/aiad-tech-review.md',
  '.claude/commands/aiad-standup.md',
  '.claude/commands/aiad-demo.md',
  '.claude/commands/aiad-retro.md',
  '.claude/commands/aiad-intention.md',
  '.claude/commands/aiad-sync-strat.md',
  '.claude/aiad/init.md',
  '.claude/aiad/onboard.md',
  '.claude/aiad/status.md',
  '.claude/aiad/health.md',
  '.claude/aiad/tech-review.md',
  '.claude/aiad/standup.md',
  '.claude/aiad/demo.md',
  '.claude/aiad/retro.md',
  '.claude/aiad/intention.md',
  '.claude/aiad/sync-strat.md',
  // router /sdd partagé (utile dès qu'on quitte le profil minimal)
  '.claude/commands/sdd.md',
];

// Métriques + commandes SDD avancées (fact / security / audit / context)
const METRICS_COMMANDS = [
  '.claude/commands/aiad-dashboard.md',
  '.claude/commands/aiad-dora.md',
  '.claude/commands/aiad-flow.md',
  '.claude/aiad/dashboard.md',
  '.claude/aiad/dora.md',
  '.claude/aiad/flow.md',
  '.claude/commands/sdd-fact.md',
  '.claude/commands/sdd-security.md',
  '.claude/commands/sdd-audit.md',
  '.claude/commands/sdd-context.md',
  '.claude/sdd/fact.md',
  '.claude/sdd/security.md',
  '.claude/sdd/audit.md',
  '.claude/sdd/context.md',
];

const METRICS_DIRS = [
  '.aiad/facts',
  '.aiad/metrics',
  '.aiad/metrics/security',
  '.aiad/metrics/audit',
];

// Toutes les commandes restantes (init/exec/validate/resume/split SDD + intent/spec/gate/drift-check version router)
const ALL_REMAINING_COMMANDS = [
  '.claude/commands/sdd-init.md',
  '.claude/commands/sdd-intent.md',
  '.claude/commands/sdd-spec.md',
  '.claude/commands/sdd-gate.md',
  '.claude/commands/sdd-drift-check.md',
  '.claude/commands/sdd-exec.md',
  '.claude/commands/sdd-validate.md',
  '.claude/commands/sdd-resume.md',
  '.claude/commands/sdd-split.md',
  '.claude/sdd/init.md',
  '.claude/sdd/intent.md',
  '.claude/sdd/spec.md',
  '.claude/sdd/gate.md',
  '.claude/sdd/drift-check.md',
  '.claude/sdd/exec.md',
  '.claude/sdd/validate.md',
  '.claude/sdd/resume.md',
  '.claude/sdd/split.md',
];

// ─── Modules d'upgrade ─────────────────────────────────────────────────────

async function upgradeRituals(projetDir, stats, { force }) {
  console.log(`\n${C.gras}  Module : rituals${C.reset}\n`);
  copierListe(projetDir, RITUALS_COMMANDS, stats, { force });
  // Index des intents/specs (versions full = ajoutent statuts détaillés)
  copierListe(projetDir, [
    '.aiad/intents/_index.md',
    '.aiad/specs/_index.md',
    '.aiad/CHANGELOG-ARTEFACTS.md',
  ], stats, { force });
}

async function upgradeMetrics(projetDir, stats, { force }) {
  console.log(`\n${C.gras}  Module : metrics${C.reset}\n`);
  for (const d of METRICS_DIRS) {
    const p = join(projetDir, d);
    if (!existsSync(p)) {
      mkdirSync(p, { recursive: true });
      logCreation(relative(projetDir, p) + '/');
      stats.created++;
    }
  }
  copierListe(projetDir, METRICS_COMMANDS, stats, { force });
}

async function upgradeGouvernance(projetDir, stats, { force }) {
  console.log(`\n${C.gras}  Module : gouvernance${C.reset}\n`);
  await addGovernance(projetDir, { force, silencieux: false });
  stats.updated += 4;
  // alias plat + corps de la sous-commande (sans le routeur /aiad complet :
  //   on évite de promettre 14 sous-commandes qui n'existent pas encore)
  copierListe(projetDir, [
    '.claude/commands/aiad-gouvernance.md',
    '.claude/aiad/gouvernance.md',
  ], stats, { force });
}

async function upgradeAll(projetDir, stats, { force }) {
  await upgradeRituals(projetDir, stats, { force });
  await upgradeMetrics(projetDir, stats, { force });
  await upgradeGouvernance(projetDir, stats, { force });
  console.log(`\n${C.gras}  Module : commandes SDD restantes${C.reset}\n`);
  copierListe(projetDir, ALL_REMAINING_COMMANDS, stats, { force });
  // Templates structurels personnalisables — créés seulement s'ils n'existent pas
  console.log(`\n${C.gras}  Templates structurels (PRD, ARCHITECTURE, AGENT-GUIDE)${C.reset}\n`);
  for (const fichier of ['.aiad/PRD.md', '.aiad/ARCHITECTURE.md', '.aiad/AGENT-GUIDE.md']) {
    const source = join(TEMPLATES_DIR, fichier);
    const dest = join(projetDir, fichier);
    if (!existsSync(source)) continue;
    if (!existsSync(dest)) {
      ensureDir(dirname(dest));
      writeFileSync(dest, readFileSync(source, 'utf-8'), 'utf-8');
      logCreation(relative(projetDir, dest));
      stats.created++;
    } else {
      logPreserve(relative(projetDir, dest));
      stats.preserved++;
    }
  }
}

// ─── Entrée publique ───────────────────────────────────────────────────────

const MODULES_VALIDES = ['rituals', 'metrics', 'gouvernance', 'all'];

export async function upgrade(projetDir, module, options = {}) {
  const { force = false } = options;
  const pkgJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  const version = pkgJson.version;

  if (!MODULES_VALIDES.includes(module)) {
    console.error(`
${C.rouge}  Module inconnu : "${module}"${C.reset}

${C.gras}  Modules disponibles :${C.reset}
  ${C.cyan}rituals${C.reset}        Rituels & synchronisations (standup, retro, demo, …)
  ${C.cyan}metrics${C.reset}        Métriques & dashboards (DORA, flow, dashboard)
  ${C.cyan}gouvernance${C.reset}    Agents Tier 1 (AI-ACT, RGPD, RGAA, RGESN)
  ${C.cyan}all${C.reset}            Bascule profil minimal → profil complet
`);
    process.exit(1);
  }

  console.log(`
${C.cyan}${C.gras}  AIAD SDD Mode — Upgrade "${module}" v${version}${C.reset}
${C.gris}  Ajout incrémental — les fichiers personnalisés sont préservés${C.reset}
`);

  const stats = { created: 0, updated: 0, unchanged: 0, preserved: 0 };

  if (module === 'rituals') await upgradeRituals(projetDir, stats, { force });
  else if (module === 'metrics') await upgradeMetrics(projetDir, stats, { force });
  else if (module === 'gouvernance') await upgradeGouvernance(projetDir, stats, { force });
  else if (module === 'all') await upgradeAll(projetDir, stats, { force });

  console.log(`
${C.cyan}${C.gras}  Upgrade "${module}" terminé !${C.reset}

  ${C.vert}+${C.reset} ${stats.created} créé(s)    ${C.cyan}↑${C.reset} ${stats.updated} synchronisé(s)    ${C.vert}✓${C.reset} ${stats.unchanged} inchangé(s)    ${C.jaune}~${C.reset} ${stats.preserved} préservé(s)

  ${C.gris}aiad-sdd v${version} — aiad.ovh${C.reset}
`);
}
