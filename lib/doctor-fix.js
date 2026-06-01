// AIAD SDD Mode — Auto-réparation des problèmes detectables (item #125).
//
// **Cap stratégique** : réduire la friction d'adoption pour les projets
// imparfaits. Plutôt que d'afficher "✗ `.aiad/intents/_index.md` absent",
// AIAD propose **un fix** que l'utilisateur peut accepter d'un clic.
//
// **Catégorie blanche** : uniquement les fixes **sans risque** :
//   - Création de dossiers `.aiad/{intents,specs,gouvernance,metrics}/`
//   - Création de `_index.md` placeholders (jamais d'écrasement)
//   - Ajout de frontmatter minimal sur les fichiers .md `INT-*` ou
//     `SPEC-*` qui n'en ont pas (title dérivé du nom)
//
// **Catégorie noire** (jamais auto-fix) : suppression de fichiers,
// modification de contenu existant, modification de frontmatter
// existant, écrasement d'un fichier rédigé par l'utilisateur. Ces
// problèmes sont **signalés** par `doctor` mais nécessitent une
// intervention humaine.
//
// **Dry-run par défaut** : sécurité maximale. `--apply` pour exécuter
// réellement les fixes. Le résultat est toujours auditable
// (liste structurée des opérations).
//
// **Zero-dep** : `fs` natif uniquement.
//
// Documentation : https://aiad.ovh/doctor-fix

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter.js';
import { C, logHeader } from './term.js';

// ─── Détection des fixes possibles ─────────────────────────────────────────

const DOSSIERS_REQUIS = [
  { path: '.aiad/intents', label: 'Dossier .aiad/intents/' },
  { path: '.aiad/specs', label: 'Dossier .aiad/specs/' },
  { path: '.aiad/gouvernance', label: 'Dossier .aiad/gouvernance/' },
  { path: '.aiad/metrics', label: 'Dossier .aiad/metrics/' },
];

const INDEX_PLACEHOLDERS = [
  {
    path: '.aiad/intents/_index.md',
    content: '# Index des Intent Statements\n\n_Liste des Intents du projet. Mise à jour automatique via `/sdd intent`._\n',
  },
  {
    path: '.aiad/specs/_index.md',
    content: '# Index des SPECs\n\n_Liste des SPECs du projet. Mise à jour automatique via `/sdd spec`._\n',
  },
];

/**
 * Inventorie tous les fixes applicables sur le projet.
 *
 * @param {string} racine
 * @returns {{ kind: string, path: string, label: string }[]}
 */
export function detecterFixes(racine) {
  const fixes = [];

  // 1. Dossiers requis manquants
  for (const d of DOSSIERS_REQUIS) {
    const abs = join(racine, d.path);
    if (!existsSync(abs)) {
      fixes.push({ kind: 'create-directory', path: d.path, label: d.label });
    }
  }

  // 2. Index placeholders absents (le dossier parent est créé au besoin
  // par appliquerFix, on n'exige pas son existence préalable pour rester
  // idempotent en une passe).
  for (const idx of INDEX_PLACEHOLDERS) {
    const abs = join(racine, idx.path);
    if (!existsSync(abs)) {
      fixes.push({
        kind: 'create-index',
        path: idx.path,
        label: `Index placeholder ${idx.path}`,
        content: idx.content,
      });
    }
  }

  // 3. Frontmatter manquant sur Intent/SPEC (titre dérivé du nom)
  for (const sous of ['intents', 'specs']) {
    const dir = join(racine, '.aiad', sous);
    if (!existsSync(dir)) continue;
    let fichiers = [];
    try { fichiers = readdirSync(dir); } catch { continue; }
    for (const f of fichiers) {
      if (!f.endsWith('.md')) continue;
      if (f.startsWith('_') || f.startsWith('spec-ears-template')) continue;
      if (!/^(INT|SPEC)-/i.test(f)) continue;
      const abs = join(dir, f);
      let contenu;
      try { contenu = readFileSync(abs, 'utf-8'); } catch { continue; }
      const { data } = parseFrontmatter(contenu);
      const aFrontmatter = Object.keys(data).length > 0;
      const aTitre = data.title || data.titre;
      if (!aFrontmatter || !aTitre) {
        fixes.push({
          kind: 'add-frontmatter',
          path: `.aiad/${sous}/${f}`,
          label: `Frontmatter manquant : ${f}`,
          file: abs,
        });
      }
    }
  }

  return fixes;
}

// ─── Application des fixes ────────────────────────────────────────────────

/**
 * Applique un fix individuel. Retourne ce qui a été fait (pour audit).
 *
 * @param {string} racine
 * @param {object} fix
 * @returns {{ applied: boolean, message: string }}
 */
export function appliquerFix(racine, fix) {
  if (fix.kind === 'create-directory') {
    const abs = join(racine, fix.path);
    if (existsSync(abs)) return { applied: false, message: 'déjà présent' };
    mkdirSync(abs, { recursive: true });
    return { applied: true, message: `créé ${fix.path}` };
  }
  if (fix.kind === 'create-index') {
    const abs = join(racine, fix.path);
    if (existsSync(abs)) return { applied: false, message: 'déjà présent' };
    const parent = join(racine, fix.path.split('/').slice(0, -1).join('/'));
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
    writeFileSync(abs, fix.content, 'utf-8');
    return { applied: true, message: `créé ${fix.path}` };
  }
  if (fix.kind === 'add-frontmatter') {
    const contenu = readFileSync(fix.file, 'utf-8');
    const { data, body } = parseFrontmatter(contenu);
    const nom = fix.path.split('/').pop().replace(/\.md$/, '');
    const titre = data.title || data.titre || titreDepuisNom(nom);
    const nouveauData = { ...data, title: titre };
    const nouveau = stringifyFrontmatter(nouveauData) + body;
    writeFileSync(fix.file, nouveau, 'utf-8');
    return { applied: true, message: `frontmatter ajouté : title="${titre}"` };
  }
  return { applied: false, message: `Kind inconnu : ${fix.kind}` };
}

function titreDepuisNom(nom) {
  // INT-001-mon-intent → "Mon Intent"
  // SPEC-001-1-auth-oidc → "Auth Oidc"
  const reste = nom.replace(/^(INT|SPEC)-\d+(-\d+)?-?/i, '');
  if (reste.length === 0) return nom;
  return reste.split('-')
    .filter(Boolean)
    .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
    .join(' ');
}

// ─── Pipeline CLI ──────────────────────────────────────────────────────────

/**
 * Détecte et (optionnellement) applique les fixes.
 *
 * @param {string} racine
 * @param {{ apply?: boolean, json?: boolean }} [options]
 * @returns {{ detected: number, applied: number, fixes: object[], dryRun: boolean }}
 */
export function fix(racine, options = {}) {
  const fixes = detecterFixes(racine);
  const dryRun = !options.apply;

  const resultats = [];
  for (const f of fixes) {
    if (dryRun) {
      resultats.push({ ...f, applied: false, message: '(dry-run)' });
    } else {
      const r = appliquerFix(racine, f);
      resultats.push({ ...f, applied: r.applied, message: r.message });
    }
  }
  const appliques = resultats.filter((r) => r.applied).length;

  if (options.json) {
    process.stdout.write(JSON.stringify({
      detected: fixes.length,
      applied: appliques,
      dryRun,
      fixes: resultats,
    }, null, 2) + '\n');
    return { detected: fixes.length, applied: appliques, fixes: resultats, dryRun };
  }

  logHeader(
    'AIAD SDD — Doctor fix',
    `${fixes.length} fix(es) ${dryRun ? 'détecté(s) [dry-run]' : 'appliqué(s)'}`,
  );
  if (fixes.length === 0) {
    console.log(`  ${C.vert}✓${C.reset} Aucun problème auto-réparable détecté.\n`);
    return { detected: 0, applied: 0, fixes: [], dryRun };
  }
  for (const r of resultats) {
    const sym = r.applied ? C.vert + '✓' : C.jaune + '◯';
    console.log(`  ${sym}${C.reset} [${r.kind}] ${r.label}`);
    if (r.message && r.message !== '(dry-run)') {
      console.log(`    ${C.gris}${r.message}${C.reset}`);
    }
  }
  if (dryRun) {
    console.log(`\n  ${C.gris}Mode dry-run — relance avec ${C.cyan}--apply${C.reset}${C.gris} pour exécuter.${C.reset}\n`);
  } else {
    console.log(`\n  ${C.vert}✓${C.reset} ${appliques}/${fixes.length} fix(es) appliqué(s).\n`);
  }
  return { detected: fixes.length, applied: appliques, fixes: resultats, dryRun };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  detecterFixes as detectFixes,
  appliquerFix as applyFix,
  fix as runFix,
};

export const CONSTANTS = {
  DOSSIERS_REQUIS: DOSSIERS_REQUIS.map((d) => d.path),
  INDEX_PLACEHOLDERS: INDEX_PLACEHOLDERS.map((i) => i.path),
};
