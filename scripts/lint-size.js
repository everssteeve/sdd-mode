#!/usr/bin/env node
// AIAD SDD Mode — Module size budget.
//
// Garde-fou contre la dérive vers des fichiers gigantesques (cf. l'ancien
// `lib/dashboard.js` à 2038 LOC, refactorisé en #11). Compte les **LOC
// effectives** (lignes non-vides, hors commentaires `//` et `/* */`) de
// chaque module et signale ceux au-dessus du seuil.
//
// **Mode par défaut** : `--warn` (exit 0 + avertissement). **Mode strict**
// `--strict` : exit 1 si dépassement (utilisable en CI bloquante quand le
// projet aura été assaini).
//
// **Whitelist** : fichier `.aiad-size-budget.json` à la racine peut lister
// des exceptions justifiées (ex. `{ "lib/sdd-trace.js": 1000 }`).
//
// Usage :
//   node scripts/lint-size.js              # mode warn
//   node scripts/lint-size.js --strict     # exit 1 si dépassement
//   node scripts/lint-size.js --threshold 500
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exit, argv } from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RACINE = join(__dirname, '..');
const SEUIL_DEFAUT = 700;

// ─── Fonctions pures (testables) ────────────────────────────────────────────

/**
 * Compte les **LOC effectives** d'un fichier source : lignes non vides hors
 * commentaires de ligne (slash-slash) et blocs (slash-star ... star-slash).
 *
 * @param {string} contenu
 * @returns {{ total: number, effective: number, blank: number, comment: number }}
 */
export function compterLOC(contenu) {
  const lignes = String(contenu).split('\n');
  let blank = 0, comment = 0, effective = 0;
  let dansBloc = false;

  for (const ligne of lignes) {
    const trim = ligne.trim();
    if (trim.length === 0) { blank++; continue; }

    if (dansBloc) {
      comment++;
      if (trim.includes('*/')) dansBloc = false;
      continue;
    }

    if (trim.startsWith('//')) { comment++; continue; }

    if (trim.startsWith('/*')) {
      comment++;
      if (!trim.includes('*/')) dansBloc = true;
      continue;
    }

    effective++;
  }

  return { total: lignes.length, effective, blank, comment };
}

/**
 * Liste tous les fichiers `.js` sous un dossier (récursif).
 *
 * @param {string} dir
 * @param {string} racine — pour calculer les chemins relatifs
 * @returns {string[]} chemins relatifs
 */
export function listerJs(dir, racine = dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const nom of readdirSync(dir)) {
    const path = join(dir, nom);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      out.push(...listerJs(path, racine));
    } else if (stat.isFile() && nom.endsWith('.js')) {
      out.push(relative(racine, path));
    }
  }
  return out.sort();
}

/**
 * Charge la whitelist `.aiad-size-budget.json` si présente.
 *
 * Format : { "lib/sdd-trace.js": 1000, "lib/emit-rules.js": 800 }
 */
export function lireWhitelist(racine) {
  const path = join(racine, '.aiad-size-budget.json');
  if (!existsSync(path)) return {};
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    // Garde uniquement les entrées clé→nombre (ignore _doc, _notes…).
    const out = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'number' && Number.isInteger(v) && v > 0) out[k] = v;
    }
    return out;
  } catch { return {}; }
}

/**
 * Évalue le budget de taille pour un ensemble de fichiers.
 *
 * @param {{ path: string, effective: number }[]} mesures
 * @param {{ seuilDefaut: number, whitelist: Record<string, number> }} options
 * @returns {{ ok: boolean, depassements: object[], total: number, max: number, modules: object[] }}
 */
export function evaluerBudget(mesures, options) {
  const { seuilDefaut, whitelist } = options;
  const depassements = [];
  const modules = [];
  let total = 0;
  let max = 0;

  for (const m of mesures) {
    const seuil = whitelist[m.path] ?? seuilDefaut;
    total += m.effective;
    if (m.effective > max) max = m.effective;
    const entry = { ...m, seuil, depassement: m.effective - seuil };
    modules.push(entry);
    if (m.effective > seuil) depassements.push(entry);
  }

  modules.sort((a, b) => b.effective - a.effective);
  depassements.sort((a, b) => b.depassement - a.depassement);

  return { ok: depassements.length === 0, depassements, total, max, modules };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseFlags(args) {
  const out = { strict: false, threshold: SEUIL_DEFAUT, top: 5, json: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--strict') out.strict = true;
    else if (args[i] === '--threshold') out.threshold = Number(args[++i]);
    else if (args[i] === '--top') out.top = Number(args[++i]);
    else if (args[i] === '--json') out.json = true;
  }
  return out;
}

function main() {
  const flags = parseFlags(argv.slice(2));
  const libDir = join(RACINE, 'lib');
  const fichiers = listerJs(libDir);
  const mesures = fichiers.map((rel) => {
    const c = readFileSync(join(libDir, rel), 'utf-8');
    return { path: `lib/${rel}`, ...compterLOC(c) };
  });

  const whitelist = lireWhitelist(RACINE);
  const result = evaluerBudget(mesures, { seuilDefaut: flags.threshold, whitelist });

  if (flags.json) {
    process.stdout.write(JSON.stringify({
      ok: result.ok,
      threshold: flags.threshold,
      strict: flags.strict,
      total: result.total,
      max: result.max,
      depassements: result.depassements.map((m) => ({
        path: m.path, effective: m.effective, seuil: m.seuil, depassement: m.depassement,
      })),
      top: result.modules.slice(0, flags.top).map((m) => ({
        path: m.path, effective: m.effective, total: m.total, comment: m.comment,
      })),
    }, null, 2) + '\n');
    if (flags.strict && !result.ok) exit(1);
    return;
  }

  console.log(`\n  Module size budget (lib/) — seuil ${flags.threshold} LOC effectives`);
  console.log(`  Total LOC effectives : ${result.total}  ·  Plus gros module : ${result.max} LOC\n`);

  console.log(`  Top ${flags.top} modules :`);
  for (const m of result.modules.slice(0, flags.top)) {
    const pct = Math.round(100 * m.effective / m.seuil);
    const bar = pct >= 100 ? '🔴' : pct >= 80 ? '🟡' : '🟢';
    console.log(`    ${bar} ${m.path.padEnd(40)} ${String(m.effective).padStart(4)} LOC (${pct}% du seuil)`);
  }

  if (result.depassements.length === 0) {
    console.log(`\n  ✓ Tous les modules sous le seuil de ${flags.threshold} LOC effectives.\n`);
    exit(0);
  }

  console.log(`\n  ⚠ ${result.depassements.length} module(s) au-dessus du seuil :`);
  for (const m of result.depassements) {
    console.log(`    ${m.path}  ${m.effective} LOC > ${m.seuil} LOC  (+${m.depassement})`);
  }
  console.log(`\n  Pour autoriser un dépassement justifié, ajoute à .aiad-size-budget.json :`);
  console.log(`    { "${result.depassements[0].path}": ${result.depassements[0].effective + 50} }`);

  if (flags.strict) {
    console.error(`\n  ✗ Module size budget dépassé (mode strict).\n`);
    exit(1);
  } else {
    console.log(`\n  (mode warn — relance avec --strict pour bloquer la CI)\n`);
    exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
