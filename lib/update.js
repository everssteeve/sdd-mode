import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, chmodSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { addGovernance } from './governance.js';
import { C, log, logCreation, logDrift } from './term.js';
import { syncFile as mettreAJour } from './fs-ops.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

// Variantes locales (libellés différents de term.js — `(mis à jour)` vs
// `(synchronisé)`). À unifier en #4.
function logMaj(chemin) {
  log(`${C.cyan}↑${C.reset}`, `${chemin} ${C.gris}(mis à jour)${C.reset}`);
}

function logOk(chemin) {
  log(`${C.vert}✓${C.reset}`, `${chemin} ${C.gris}(déjà à jour)${C.reset}`);
}

function logPreserve(chemin) {
  log(`${C.jaune}~${C.reset}`, `${chemin} ${C.gris}(préservé — personnalisé par l'utilisateur)${C.reset}`);
}

// Synchronise ou vérifie un fichier. En mode `check`, on ne touche pas au
// disque — on enregistre les chemins qui divergent dans `stats.drifts` et
// on signale via logDrift / logOk. Modèle inspiré d'`emit-rules --check`.
function syncOuVerif(destination, contenu, ctx) {
  const { check = false, stats, rel } = ctx;
  const r = rel(destination);
  if (check) {
    if (!existsSync(destination)) {
      logDrift(`${r} (manquant)`);
      stats.drifts.push(r);
      return 'drift';
    }
    const existant = readFileSync(destination, 'utf-8');
    if (existant === contenu) {
      logOk(r);
      stats.unchanged++;
      return 'unchanged';
    }
    logDrift(r);
    stats.drifts.push(r);
    return 'drift';
  }
  const result = mettreAJour(destination, contenu);
  if (result === 'created') { logCreation(r); stats.created++; }
  else if (result === 'updated') { logMaj(r); stats.updated++; }
  else { logOk(r); stats.unchanged++; }
  return result;
}

export async function update(projetDir, options = {}) {
  const { sansGouvernance = false, dryRun = false, check = false } = options;
  const rel = (p) => relative(projetDir, p);

  const pkgJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  const version = pkgJson.version;

  console.log(`
${C.cyan}${C.gras}  AIAD SDD Mode — ${check ? 'Vérification de parité' : 'Mise à jour'} v${version}${C.reset}
${C.gris}  ${check ? 'Liste les divergences avec le package (pas d\'écriture)' : 'Met à jour les commandes, la gouvernance et les templates structurels'}${C.reset}
`);

  let stats = { created: 0, updated: 0, unchanged: 0, preserved: 0, drifts: [] };
  const ctx = { check, stats, rel };

  // ─── 1. Commandes Claude Code (TOUJOURS écrasées — viennent du package) ───
  console.log(`${C.gras}  Commandes Claude Code (.claude/commands/)${C.reset}\n`);

  const cmdSource = join(TEMPLATES_DIR, '.claude', 'commands');
  const cmdDest = join(projetDir, '.claude', 'commands');

  if (existsSync(cmdSource)) {
    const fichiers = readdirSync(cmdSource);
    for (const f of fichiers) {
      const contenu = readFileSync(join(cmdSource, f), 'utf-8');
      syncOuVerif(join(cmdDest, f), contenu, ctx);
    }
  }

  // ─── 2. Gouvernance (TOUJOURS écrasée — vient du package) ───
  if (!sansGouvernance) {
    console.log(`\n${C.gras}  Agents de gouvernance${C.reset}\n`);
    if (check) {
      // Mode check : compare chaque agent au template plutôt que d'écraser.
      const gouvSrc = join(TEMPLATES_DIR, '.aiad', 'gouvernance');
      const gouvDest = join(projetDir, '.aiad', 'gouvernance');
      for (const a of ['AIAD-AI-ACT', 'AIAD-RGPD', 'AIAD-RGAA', 'AIAD-RGESN', 'AIAD-CRA']) {
        const src = join(gouvSrc, `${a}.md`);
        if (!existsSync(src)) continue;
        syncOuVerif(join(gouvDest, `${a}.md`), readFileSync(src, 'utf-8'), ctx);
      }
    } else {
      await addGovernance(projetDir, { force: true, silencieux: true });
      stats.updated += 5; // 5 agents Tier 1
    }
  }

  // ─── 2.bis Hooks Claude Code (script écrasé, settings.json fusionné) ───
  console.log(`\n${C.gras}  Hooks Claude Code${C.reset}\n`);

  const hookSource = join(TEMPLATES_DIR, '.aiad', 'hooks', 'session-start.js');
  const hookDest = join(projetDir, '.aiad', 'hooks', 'session-start.js');
  if (existsSync(hookSource)) {
    syncOuVerif(hookDest, readFileSync(hookSource, 'utf-8'), ctx);
  }

  // Hook pre-commit : on resynchronise le script si déjà installé.
  const preCommitSource = join(TEMPLATES_DIR, '.aiad', 'hooks', 'pre-commit.sh');
  const preCommitDest = join(projetDir, '.aiad', 'hooks', 'pre-commit.sh');
  if (existsSync(preCommitSource) && existsSync(preCommitDest)) {
    const r = syncOuVerif(preCommitDest, readFileSync(preCommitSource, 'utf-8'), ctx);
    if (!check && r === 'updated') {
      try { chmodSync(preCommitDest, 0o755); } catch {}
    }
  }

  const settingsSource = join(TEMPLATES_DIR, '.claude', 'settings.json');
  const settingsDest = join(projetDir, '.claude', 'settings.json');
  if (existsSync(settingsSource)) {
    const tpl = JSON.parse(readFileSync(settingsSource, 'utf-8'));
    const cible = existsSync(settingsDest)
      ? JSON.parse(readFileSync(settingsDest, 'utf-8'))
      : {};
    cible.hooks = cible.hooks || {};
    cible.hooks.SessionStart = tpl.hooks.SessionStart;
    const nouveauContenu = JSON.stringify(cible, null, 2) + '\n';
    syncOuVerif(settingsDest, nouveauContenu, ctx);
  }

  // ─── 3. Templates structurels (.aiad/ index + changelog) ───
  console.log(`\n${C.gras}  Templates structurels (.aiad/)${C.reset}\n`);

  // Créer les nouveaux dossiers v1.6 s'ils n'existent pas
  const nouveauxDossiers = ['facts', 'metrics', 'metrics/security', 'metrics/audit', 'metrics/traceability'];
  for (const dossier of nouveauxDossiers) {
    const chemin = join(projetDir, '.aiad', dossier);
    if (!existsSync(chemin)) {
      if (check) {
        logDrift(`${rel(chemin)}/ (manquant)`);
        stats.drifts.push(rel(chemin) + '/');
      } else {
        mkdirSync(chemin, { recursive: true });
        logCreation(rel(chemin) + '/');
        stats.created++;
      }
    }
  }

  // Fichiers structurels = index et changelog (toujours mis à jour)
  const fichiersStructurels = [
    'intents/_index.md',
    'specs/_index.md',
    'gouvernance/_index.md',
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
  if (check) {
    if (stats.drifts.length > 0) {
      console.log(`
${C.rouge}${C.gras}  ✗ Divergence détectée (${stats.drifts.length} fichier(s))${C.reset}

${stats.drifts.map((d) => `    - ${d}`).join('\n')}

${C.gris}  Synchronise avec :  ${C.reset}${C.cyan}npx aiad-sdd update${C.reset}
`);
    } else {
      console.log(`
${C.vert}${C.gras}  ✓ Tous les fichiers synchronisés avec le package.${C.reset}

  ${C.vert}✓${C.reset} ${stats.unchanged} à jour
`);
    }
    return stats;
  }

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
  return stats;
}
