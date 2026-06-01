// AIAD SDD Mode — Templates de projets clés-en-main.
//
// `aiad-sdd new <template> [<dir>]` bootstrap un projet complet (code initial
// + AIAD préinstallé : `.aiad/`, `.claude/`, agents Tier 1 EU, hooks Drift
// Lock, multi-runtime AGENTS.md). Cible : réduire drastiquement le coût
// d'entrée pour un nouveau projet sur le marché EU.
//
// Architecture extensible :
//   - Chaque template vit dans `templates/projects/<id>/` avec un manifest
//     `aiad-template.json` (id, title, description, target, scripts, engines).
//   - Les fichiers `*.tpl` sont des squelettes interpolés (variables `{{var}}`).
//   - Les autres fichiers sont copiés tels quels.
//   - Après copie, on lance `init()` automatiquement pour ajouter `.aiad/`.
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncFile, copyDir } from './fs-ops.js';
import { C, log, logHeader } from './term.js';
import { init } from './init.js';
import { t } from './i18n.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_PROJECTS_DIR = join(__dirname, '..', 'templates', 'projects');

/**
 * Charge le manifest d'un template depuis disk.
 *
 * @param {string} id
 * @returns {object|null}
 */
function lireManifest(id) {
  const path = join(TEMPLATES_PROJECTS_DIR, id, 'aiad-template.json');
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return null; }
}

/**
 * Liste les templates disponibles (lecture du système de fichiers).
 *
 * @returns {object[]} manifests des templates trouvés
 */
export function listerTemplates() {
  if (!existsSync(TEMPLATES_PROJECTS_DIR)) return [];
  const out = [];
  for (const nom of readdirSync(TEMPLATES_PROJECTS_DIR)) {
    const dir = join(TEMPLATES_PROJECTS_DIR, nom);
    if (!statSync(dir).isDirectory()) continue;
    const m = lireManifest(nom);
    if (m) out.push(m);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function templateExiste(id) {
  return lireManifest(id) !== null;
}

/**
 * Substitue les variables `{{var}}` dans un contenu textuel.
 *
 * @param {string} contenu
 * @param {Record<string, string>} vars
 * @returns {string}
 */
function interpoler(contenu, vars) {
  return contenu.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{{${key}}}`;
  });
}

/**
 * Copie un template dans une racine cible avec interpolation des `*.tpl`.
 *
 * @param {string} sourceDir
 * @param {string} destDir
 * @param {Record<string, string>} vars
 * @param {{ dryRun?: boolean }} [options]
 * @returns {{ created: number, updated: number, skipped: number }}
 */
function copierTemplate(sourceDir, destDir, vars, options = {}) {
  const { dryRun = false } = options;
  const stats = { created: 0, updated: 0, skipped: 0 };

  function recurse(src, dest) {
    if (!dryRun && !existsSync(dest)) mkdirSync(dest, { recursive: true });
    for (const nom of readdirSync(src)) {
      const srcPath = join(src, nom);
      const stat = statSync(srcPath);
      if (stat.isDirectory()) {
        recurse(srcPath, join(dest, nom));
      } else if (nom === 'aiad-template.json') {
        // manifest, pas copié
      } else {
        const isTpl = nom.endsWith('.tpl');
        // npm exclut `.gitignore` du tarball publié → on le stocke en
        // `_gitignore` côté template et on rétablit le préfixe `.` à la copie.
        const renomme = nom === '_gitignore' ? '.gitignore' : nom;
        const destNom = isTpl ? renomme.slice(0, -4) : renomme;
        const destPath = join(dest, destNom);
        let contenu = readFileSync(srcPath, 'utf-8');
        if (isTpl) contenu = interpoler(contenu, vars);
        const r = syncFile(destPath, contenu, { dryRun });
        if (r === 'created') stats.created++;
        else if (r === 'updated') stats.updated++;
        else stats.skipped++;
      }
    }
  }

  recurse(sourceDir, destDir);
  return stats;
}

/**
 * Crée un nouveau projet à partir d'un template.
 *
 * @param {string} templateId
 * @param {string} destDir — racine du nouveau projet (créée si absente)
 * @param {{ name?: string, description?: string, license?: string, dryRun?: boolean, force?: boolean, sansInit?: boolean }} [options]
 * @returns {Promise<{ template: object, stats: object, destDir: string }>}
 */
export async function creerProjet(templateId, destDir, options = {}) {
  const manifest = lireManifest(templateId);
  if (!manifest) {
    const available = listerTemplates().map((x) => x.id).join(', ');
    throw new Error(t('errors.unknownTemplate', { template: templateId, available }));
  }
  const {
    name = manifest.id,
    description = manifest.description,
    license = manifest.license || 'MIT',
    dryRun = false,
    force = false,
    sansInit = false,
  } = options;

  if (!dryRun && existsSync(destDir) && readdirSync(destDir).length > 0 && !force) {
    throw new Error(t('errors.dirNotEmpty', { dir: destDir }));
  }

  if (!dryRun && !existsSync(destDir)) mkdirSync(destDir, { recursive: true });

  logHeader(
    `AIAD SDD — Nouveau projet "${manifest.id}"`,
    manifest.title,
  );

  const sourceDir = join(TEMPLATES_PROJECTS_DIR, templateId);
  const stats = copierTemplate(sourceDir, destDir, { name, description, license }, { dryRun });

  log(`${C.vert}+${C.reset}`, `${stats.created} fichier(s) créé(s)${dryRun ? ` ${C.gris}(dry-run)${C.reset}` : ''}`);
  if (stats.updated) log(`${C.cyan}↑${C.reset}`, `${stats.updated} mis à jour`);
  if (stats.skipped) log(`${C.gris}-${C.reset}`, `${stats.skipped} déjà à jour`);

  // Initialise AIAD à l'intérieur (sauf si sansInit)
  if (!sansInit) {
    console.log('');
    await init(destDir, { sansGouvernance: false, force, dryRun, runtimes: ['claude-code'] });
  }

  console.log(`
${C.gras}  Prochaines étapes${C.reset}
    cd ${relative(process.cwd(), destDir) || '.'}
    ${manifest.scripts && manifest.scripts.test ? manifest.scripts.test : 'npm test'}
    npx aiad-sdd doctor

${C.gris}  Documentation : https://aiad.ovh${C.reset}
`);

  return { template: manifest, stats, destDir };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  listerTemplates as listTemplates,
  templateExiste as templateExists,
  creerProjet as createProject,
};
