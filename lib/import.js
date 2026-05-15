// AIAD SDD Mode — Import depuis Spec Kit / Kiro vers `.aiad/`.
//
// Détecte automatiquement la structure source et convertit les artefacts
// existants en format AIAD :
//
//   - **Spec Kit** (GitHub) — Repère `.specify/` ou `specs/<name>/spec.md` :
//     ```
//     specs/<name>/
//       spec.md      → .aiad/specs/SPEC-NNN-N-<slug>.md (corps SPEC)
//       plan.md      → annexe technique dans la même SPEC
//       tasks.md     → annexe tasks dans la même SPEC
//     ```
//
//   - **Kiro** (Amazon Q) — Repère `.kiro/steering/` ou `.kiro/specs/` :
//     ```
//     .kiro/steering/*.md           → .aiad/AGENT-GUIDE.md (concat)
//     .kiro/specs/<feature>/
//       requirements.md             → .aiad/intents/INTENT-NNN.md (le pourquoi)
//       design.md                   → .aiad/specs/SPEC-NNN-N-<slug>.md (corps)
//       tasks.md                    → annexe dans la même SPEC
//     ```
//
// **Idempotent** — si un fichier cible existe déjà, il est préservé (sauf
// `--force`). Mode aperçu par défaut via `--dry-run`.
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { syncFile } from './fs-ops.js';
import { C, log, logHeader } from './term.js';
import { t } from './i18n.js';

// ─── Détection de la source ─────────────────────────────────────────────────

/**
 * Détecte la structure source dans le répertoire racine.
 *
 * @param {string} racine
 * @returns {'spec-kit'|'kiro'|null}
 */
export function detecter(racine) {
  // Kiro : `.kiro/steering/` ou `.kiro/specs/`
  if (existsSync(join(racine, '.kiro', 'steering')) || existsSync(join(racine, '.kiro', 'specs'))) {
    return 'kiro';
  }
  // Spec Kit : `.specify/` (CLI marker) ou `specs/<name>/spec.md`
  if (existsSync(join(racine, '.specify'))) return 'spec-kit';
  const specsDir = join(racine, 'specs');
  if (existsSync(specsDir) && statSync(specsDir).isDirectory()) {
    for (const nom of readdirSync(specsDir)) {
      const sub = join(specsDir, nom);
      if (statSync(sub).isDirectory() && existsSync(join(sub, 'spec.md'))) {
        return 'spec-kit';
      }
    }
  }
  return null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function slug(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'sans-titre';
}

function pad3(n) { return String(n).padStart(3, '0'); }

/**
 * Calcule le prochain numéro INTENT/SPEC libre dans le projet AIAD.
 */
function prochainNumero(racine, dossier, prefix) {
  const dir = join(racine, '.aiad', dossier);
  if (!existsSync(dir)) return 1;
  const re = new RegExp(`^${prefix}-(\\d{3})`);
  let max = 0;
  for (const nom of readdirSync(dir)) {
    const m = nom.match(re);
    if (m) max = Math.max(max, Number.parseInt(m[1], 10));
  }
  return max + 1;
}

/**
 * Recherche un fichier SPEC existant avec le même slug pour préserver l'ID.
 *
 * @param {string} racine
 * @param {string} slugCible
 * @returns {string|null} ID retrouvé (`SPEC-NNN-N-slug`) ou null
 */
function trouverSpecExistantParSlug(racine, slugCible) {
  const dir = join(racine, '.aiad', 'specs');
  if (!existsSync(dir)) return null;
  const re = new RegExp(`^(SPEC-\\d{3}-\\d+-${slugCible})\\.md$`);
  for (const nom of readdirSync(dir)) {
    const m = nom.match(re);
    if (m) return m[1];
  }
  return null;
}

function lireSurDisk(p) {
  try { return readFileSync(p, 'utf-8'); }
  catch { return null; }
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

/**
 * Construit une SPEC AIAD depuis spec.md / plan.md / tasks.md (Spec Kit).
 *
 * @returns {{ id: string, slug: string, contenu: string, sourcePath: string }[]}
 */
function mapperSpecKit(racine, etat) {
  const out = [];
  const specsDir = join(racine, 'specs');
  if (!existsSync(specsDir)) return out;
  for (const nom of readdirSync(specsDir)) {
    const sub = join(specsDir, nom);
    if (!statSync(sub).isDirectory()) continue;
    const specMd = lireSurDisk(join(sub, 'spec.md'));
    if (!specMd) continue;
    const planMd = lireSurDisk(join(sub, 'plan.md'));
    const tasksMd = lireSurDisk(join(sub, 'tasks.md'));
    const slugNom = slug(nom);
    const idExistant = trouverSpecExistantParSlug(etat.racine, slugNom);
    const id = idExistant || `SPEC-${pad3(etat.prochainSpec++)}-1-${slugNom}`;
    const titre = (specMd.match(/^#\s+(.+)$/m) || [])[1] || nom;
    const lignes = [];
    lignes.push('---');
    lignes.push(`title: ${JSON.stringify(titre)}`);
    lignes.push('status: imported');
    lignes.push('source: spec-kit');
    lignes.push(`source-dir: specs/${nom}`);
    lignes.push('---');
    lignes.push('');
    lignes.push(`# ${id} — ${titre}`);
    lignes.push('');
    lignes.push(`> Importé depuis \`specs/${nom}/\` (Spec Kit) par \`aiad-sdd import\`. Re-valide via \`/sdd gate\` avant exécution.`);
    lignes.push('');
    lignes.push('## Spécification');
    lignes.push('');
    lignes.push(specMd.trim());
    if (planMd) {
      lignes.push('');
      lignes.push('## Plan technique (Spec Kit)');
      lignes.push('');
      lignes.push(planMd.trim());
    }
    if (tasksMd) {
      lignes.push('');
      lignes.push('## Tâches (Spec Kit)');
      lignes.push('');
      lignes.push(tasksMd.trim());
    }
    out.push({ id, slug: slugNom, contenu: lignes.join('\n') + '\n', sourcePath: sub });
  }
  return out;
}

/**
 * Construit Intent + SPEC AIAD depuis Kiro (`.kiro/specs/<feature>/*.md`).
 */
function mapperKiroSpecs(racine, etat) {
  const intents = [];
  const specs = [];
  const specsDir = join(racine, '.kiro', 'specs');
  if (!existsSync(specsDir)) return { intents, specs };
  for (const nom of readdirSync(specsDir)) {
    const sub = join(specsDir, nom);
    if (!statSync(sub).isDirectory()) continue;

    const requirements = lireSurDisk(join(sub, 'requirements.md'));
    const design = lireSurDisk(join(sub, 'design.md'));
    const tasksMd = lireSurDisk(join(sub, 'tasks.md'));
    if (!requirements && !design) continue;

    const slugNom = slug(nom);
    let intentId = null;
    if (requirements) {
      const numero = etat.prochainIntent++;
      intentId = `INTENT-${pad3(numero)}`;
      const titre = (requirements.match(/^#\s+(.+)$/m) || [])[1] || nom;
      const lignes = [];
      lignes.push('---');
      lignes.push(`title: ${JSON.stringify(titre)}`);
      lignes.push('status: imported');
      lignes.push('source: kiro');
      lignes.push(`source-dir: .kiro/specs/${nom}`);
      lignes.push('---');
      lignes.push('');
      lignes.push(`# ${intentId} — ${titre}`);
      lignes.push('');
      lignes.push(`> Importé depuis \`.kiro/specs/${nom}/requirements.md\` (Kiro) par \`aiad-sdd import\`. L'**intention humaine** doit être validée — Kiro fait du EARS sur les requirements, AIAD demande aussi un *pourquoi* explicite.`);
      lignes.push('');
      lignes.push('## Pourquoi (à compléter)');
      lignes.push('');
      lignes.push('*Quel besoin métier ou utilisateur cette fonctionnalité résout-elle ? Quelle est la conséquence si rien n\'est fait ?*');
      lignes.push('');
      lignes.push('## Exigences importées');
      lignes.push('');
      lignes.push(requirements.trim());
      intents.push({ id: intentId, contenu: lignes.join('\n') + '\n', sourcePath: sub });
    }

    if (design || tasksMd) {
      const idExistant = trouverSpecExistantParSlug(etat.racine, slugNom);
      const id = idExistant || `SPEC-${pad3(etat.prochainSpec++)}-1-${slugNom}`;
      const titre = (design || requirements || '').match(/^#\s+(.+)$/m)?.[1] || nom;
      const lignes = [];
      lignes.push('---');
      lignes.push(`title: ${JSON.stringify(titre)}`);
      lignes.push('status: imported');
      lignes.push('source: kiro');
      if (intentId) lignes.push(`parent_intent: ${intentId}`);
      lignes.push(`source-dir: .kiro/specs/${nom}`);
      lignes.push('---');
      lignes.push('');
      lignes.push(`# ${id} — ${titre}`);
      lignes.push('');
      lignes.push(`> Importé depuis \`.kiro/specs/${nom}/\` (Kiro) par \`aiad-sdd import\`. Re-valide via \`/sdd gate\` avant exécution.`);
      lignes.push('');
      if (design) {
        lignes.push('## Design technique (Kiro)');
        lignes.push('');
        lignes.push(design.trim());
        lignes.push('');
      }
      if (tasksMd) {
        lignes.push('## Tâches (Kiro)');
        lignes.push('');
        lignes.push(tasksMd.trim());
        lignes.push('');
      }
      specs.push({ id, slug: slugNom, contenu: lignes.join('\n'), sourcePath: sub, intentId });
    }
  }
  return { intents, specs };
}

/**
 * Concatène `.kiro/steering/*.md` dans une section dédiée pour AGENT-GUIDE.
 */
function mapperKiroSteering(racine) {
  const dir = join(racine, '.kiro', 'steering');
  if (!existsSync(dir)) return null;
  const fichiers = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  if (fichiers.length === 0) return null;
  const lignes = [];
  lignes.push('## Steering importé depuis Kiro');
  lignes.push('');
  lignes.push(`> ${fichiers.length} fichier(s) de steering importé(s) depuis \`.kiro/steering/\`. Réintègre les éléments pertinents dans les sections AGENT-GUIDE adaptées.`);
  lignes.push('');
  for (const f of fichiers) {
    const c = lireSurDisk(join(dir, f));
    if (!c) continue;
    lignes.push(`### ${f.replace(/\.md$/, '')}`);
    lignes.push('');
    lignes.push(c.trim());
    lignes.push('');
  }
  return lignes.join('\n') + '\n';
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Exécute l'import depuis une source détectée ou explicite.
 *
 * @param {string} racine
 * @param {{ from?: 'spec-kit'|'kiro'|'auto', dryRun?: boolean, force?: boolean }} [options]
 * @returns {Promise<{ source: string|null, stats: { intents: number, specs: number, steering: boolean } }>}
 */
export async function importer(racine, options = {}) {
  const { from = 'auto', dryRun = false, force = false } = options;

  const source = from === 'auto' ? detecter(racine) : from;
  if (!source) {
    throw new Error(t('import.errorNoStructure'));
  }
  if (!['spec-kit', 'kiro'].includes(source)) {
    throw new Error(t('import.errorUnknownSource', { source }));
  }

  if (!existsSync(join(racine, '.aiad'))) {
    throw new Error(t('import.errorNoAiad'));
  }

  logHeader(
    t('import.title', { source }),
    dryRun ? t('import.dryRunSubtitle') : ``,
  );

  const etat = {
    racine,
    prochainSpec: prochainNumero(racine, 'specs', 'SPEC'),
    prochainIntent: prochainNumero(racine, 'intents', 'INTENT'),
  };

  const stats = { intents: 0, specs: 0, steering: false };

  if (source === 'spec-kit') {
    const specs = mapperSpecKit(racine, etat);
    for (const s of specs) {
      const dest = join(racine, '.aiad', 'specs', `${s.id}.md`);
      ecrireSiAbsent(dest, s.contenu, { dryRun, force });
      stats.specs++;
    }
  } else if (source === 'kiro') {
    const { intents, specs } = mapperKiroSpecs(racine, etat);
    for (const i of intents) {
      const dest = join(racine, '.aiad', 'intents', `${i.id}.md`);
      ecrireSiAbsent(dest, i.contenu, { dryRun, force });
      stats.intents++;
    }
    for (const s of specs) {
      const dest = join(racine, '.aiad', 'specs', `${s.id}.md`);
      ecrireSiAbsent(dest, s.contenu, { dryRun, force });
      stats.specs++;
    }
    const steering = mapperKiroSteering(racine);
    if (steering) {
      const guidePath = join(racine, '.aiad', 'AGENT-GUIDE.md');
      const existant = lireSurDisk(guidePath) || '';
      // On append le steering au guide existant si pas déjà présent.
      if (!existant.includes('## Steering importé depuis Kiro')) {
        const nouveau = (existant.trimEnd() + '\n\n' + steering).replace(/^\n+/, '');
        syncFile(guidePath, nouveau, { dryRun });
        stats.steering = true;
      }
    }
  }

  console.log(`
${C.gras}  ${t('import.summary.title')}${C.reset}
    ${t('import.summary.source')}  : ${C.cyan}${source}${C.reset}
    ${t('import.summary.intents')} : ${C.cyan}${stats.intents}${C.reset}
    ${t('import.summary.specs')}  : ${C.cyan}${stats.specs}${C.reset}
    ${t('import.summary.steering')}         : ${stats.steering ? C.vert + t('import.summary.merged') + C.reset : C.gris + t('import.summary.none') + C.reset}
${dryRun ? `\n  ${C.gris}${t('common.dryRun')} ${t('init.successDryRun')}${C.reset}` : ''}

${C.gris}  ${t('import.nextStep')}${C.reset}
`);

  return { source, stats };
}

function ecrireSiAbsent(dest, contenu, { dryRun = false, force = false }) {
  if (existsSync(dest) && !force) {
    log(`${C.jaune}~${C.reset}`, `${dest} ${C.gris}(préservé — utilise --force pour écraser)${C.reset}`);
    return;
  }
  // s'assurer que le dossier parent existe
  const dir = dest.substring(0, dest.lastIndexOf('/'));
  if (!dryRun && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  const r = syncFile(dest, contenu, { dryRun });
  const sym = r === 'created' ? `${C.vert}+${C.reset}` : `${C.cyan}↑${C.reset}`;
  log(sym, `${dest}${dryRun ? ` ${C.gris}(dry-run)${C.reset}` : ''}`);
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  detecter as detect,
  importer as importFromExternal,
};
