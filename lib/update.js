import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { addGovernance } from './governance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

const C = {
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

function logMaj(chemin) {
  log(`${C.cyan}↑${C.reset}`, `${chemin} ${C.gris}(mis à jour)${C.reset}`);
}

function logOk(chemin) {
  log(`${C.vert}✓${C.reset}`, `${chemin} ${C.gris}(déjà à jour)${C.reset}`);
}

function logCreation(chemin) {
  log(`${C.vert}+${C.reset}`, chemin);
}

function logPreserve(chemin) {
  log(`${C.jaune}~${C.reset}`, `${chemin} ${C.gris}(préservé — personnalisé par l'utilisateur)${C.reset}`);
}

/**
 * Met à jour un fichier seulement si le contenu a changé.
 * Retourne 'created' | 'updated' | 'unchanged'
 */
function mettreAJour(destination, nouveauContenu) {
  const dir = dirname(destination);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  if (!existsSync(destination)) {
    writeFileSync(destination, nouveauContenu, 'utf-8');
    return 'created';
  }
  const existant = readFileSync(destination, 'utf-8');
  if (existant === nouveauContenu) {
    return 'unchanged';
  }
  writeFileSync(destination, nouveauContenu, 'utf-8');
  return 'updated';
}

export async function update(projetDir, options = {}) {
  const { sansGouvernance = false } = options;
  const rel = (p) => relative(projetDir, p);

  const pkgJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  const version = pkgJson.version;

  console.log(`
${C.cyan}${C.gras}  AIAD SDD Mode — Mise à jour v${version}${C.reset}
${C.gris}  Met à jour les commandes, la gouvernance et les templates structurels${C.reset}
`);

  let stats = { created: 0, updated: 0, unchanged: 0, preserved: 0 };

  // ─── 1. Commandes Claude Code (TOUJOURS écrasées — viennent du package) ───
  console.log(`${C.gras}  Commandes Claude Code (.claude/commands/)${C.reset}\n`);

  const cmdSource = join(TEMPLATES_DIR, '.claude', 'commands');
  const cmdDest = join(projetDir, '.claude', 'commands');

  if (existsSync(cmdSource)) {
    const fichiers = readdirSync(cmdSource);
    for (const f of fichiers) {
      const contenu = readFileSync(join(cmdSource, f), 'utf-8');
      const result = mettreAJour(join(cmdDest, f), contenu);
      const chemin = rel(join(cmdDest, f));
      if (result === 'created') { logCreation(chemin); stats.created++; }
      else if (result === 'updated') { logMaj(chemin); stats.updated++; }
      else { logOk(chemin); stats.unchanged++; }
    }
  }

  // ─── 2. Gouvernance (TOUJOURS écrasée — vient du package) ───
  if (!sansGouvernance) {
    console.log(`\n${C.gras}  Agents de gouvernance${C.reset}\n`);
    await addGovernance(projetDir, { force: true, silencieux: true });
    stats.updated += 4; // 4 agents
  }

  // ─── 3. Templates structurels (.aiad/ index + changelog) ───
  console.log(`\n${C.gras}  Templates structurels (.aiad/)${C.reset}\n`);

  // Fichiers structurels = index et changelog (toujours mis à jour)
  const fichiersStructurels = [
    'intents/_index.md',
    'specs/_index.md',
    'CHANGELOG-ARTEFACTS.md',
  ];

  for (const fichier of fichiersStructurels) {
    const source = join(TEMPLATES_DIR, '.aiad', fichier);
    const dest = join(projetDir, '.aiad', fichier);
    if (existsSync(source)) {
      // Ne met à jour que si c'est encore le template par défaut ou n'existe pas
      if (!existsSync(dest)) {
        const contenu = readFileSync(source, 'utf-8');
        mettreAJour(dest, contenu);
        logCreation(rel(dest));
        stats.created++;
      } else {
        logOk(rel(dest));
        stats.unchanged++;
      }
    }
  }

  // Fichiers personnalisables = PRD, ARCHITECTURE, AGENT-GUIDE (jamais écrasés)
  const fichiersPerso = ['PRD.md', 'ARCHITECTURE.md', 'AGENT-GUIDE.md'];

  for (const fichier of fichiersPerso) {
    const source = join(TEMPLATES_DIR, '.aiad', fichier);
    const dest = join(projetDir, '.aiad', fichier);
    if (!existsSync(dest) && existsSync(source)) {
      const contenu = readFileSync(source, 'utf-8');
      writeFileSync(dest, contenu, 'utf-8');
      logCreation(rel(dest));
      stats.created++;
    } else if (existsSync(dest)) {
      logPreserve(rel(dest));
      stats.preserved++;
    }
  }

  // ─── 4. CLAUDE.md (JAMAIS écrasé — seulement append si section absente) ───
  console.log(`\n${C.gras}  Configuration agent (CLAUDE.md)${C.reset}\n`);

  const claudeMdSource = join(TEMPLATES_DIR, 'CLAUDE.md');
  const claudeMdDest = join(projetDir, 'CLAUDE.md');

  if (existsSync(claudeMdDest)) {
    const contenuExistant = readFileSync(claudeMdDest, 'utf-8');
    if (!contenuExistant.includes('# SDD Mode')) {
      const sddSection = readFileSync(claudeMdSource, 'utf-8');
      writeFileSync(claudeMdDest, contenuExistant + '\n\n' + sddSection, 'utf-8');
      log(`${C.vert}+${C.reset}`, 'CLAUDE.md — section SDD Mode ajoutée');
      stats.updated++;
    } else {
      logPreserve('CLAUDE.md');
      stats.preserved++;
    }
  } else {
    const contenu = readFileSync(claudeMdSource, 'utf-8');
    writeFileSync(claudeMdDest, contenu, 'utf-8');
    logCreation('CLAUDE.md');
    stats.created++;
  }

  // ─── Résumé ───
  console.log(`
${C.cyan}${C.gras}  Mise à jour terminée !${C.reset}

  ${C.vert}+${C.reset} ${stats.created} créé(s)    ${C.cyan}↑${C.reset} ${stats.updated} mis à jour    ${C.vert}✓${C.reset} ${stats.unchanged} inchangé(s)    ${C.jaune}~${C.reset} ${stats.preserved} préservé(s)

${C.gras}  Politique de mise à jour :${C.reset}
  ${C.cyan}•${C.reset} Commandes slash       ${C.gris}→ toujours synchronisées avec le package${C.reset}
  ${C.cyan}•${C.reset} Agents de gouvernance  ${C.gris}→ toujours synchronisés avec le package${C.reset}
  ${C.jaune}•${C.reset} PRD / ARCHITECTURE / AGENT-GUIDE  ${C.gris}→ jamais écrasés${C.reset}
  ${C.jaune}•${C.reset} CLAUDE.md              ${C.gris}→ jamais écrasé (section SDD ajoutée si absente)${C.reset}

  ${C.gris}aiad-sdd v${version} — aiad.ovh${C.reset}
`);
}
