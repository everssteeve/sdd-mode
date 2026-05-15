#!/usr/bin/env node
// AIAD SDD Mode — Lint ESM strict.
//
// Le projet est **100 % ESM** (`package.json#type: module`). Ce script
// vérifie qu'aucun fichier `lib/`, `bin/`, `scripts/` ne contient de
// résidu CommonJS qui passerait le `node --check` mais signalerait un
// glissement progressif vers du syntaxe legacy :
//
//   - `require(...)` — sauf `createRequire(import.meta.url)` documenté
//   - `module.exports = ...`
//   - `exports.X = ...`
//   - Usage de `__dirname` / `__filename` sans les avoir construits via
//     `fileURLToPath(import.meta.url)`
//
// **Heuristique d'exclusion** : on ignore les commentaires `//` et les
// chaînes ; on tolère le pattern explicite `import { createRequire }
// from 'node:module'` + `const require = createRequire(import.meta.url)`
// (rarement nécessaire mais légitime).
//
// Usage :
//   node scripts/lint-esm.js              # exit 1 si violation
//   node scripts/lint-esm.js --json       # rapport JSON
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exit, argv } from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RACINE = join(__dirname, '..');

// ─── Fonctions pures (testables) ────────────────────────────────────────────

/**
 * Retire les commentaires (lignes // et blocs slash-star) ainsi que les
 * chaînes (simples, doubles, template literals) d'une ligne pour éviter
 * les faux positifs. Approche heuristique simple, suffisante pour le scan
 * des modules `lib/` qui ne contiennent pas de `require` dans des chaînes.
 *
 * @param {string} ligne
 * @returns {string}
 */
export function effacerStringsEtCommentaires(ligne) {
  let s = String(ligne);
  // Retire les commentaires de ligne
  const idxComment = s.indexOf('//');
  if (idxComment >= 0) {
    // Vérifier que le // n'est pas dans une chaîne (heuristique)
    const avant = s.slice(0, idxComment);
    const guillemets = (avant.match(/['"`]/g) || []).length;
    if (guillemets % 2 === 0) s = avant;
  }
  // Retire les chaînes ' ... ', " ... ", ` ... ` (mono-ligne).
  s = s.replace(/'(?:[^'\\]|\\.)*'/g, "''");
  s = s.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  s = s.replace(/`(?:[^`\\]|\\.)*`/g, '``');
  return s;
}

/**
 * Inspecte un fichier source ESM et retourne la liste des violations.
 *
 * @param {string} contenu
 * @returns {{ rule: string, line: number, snippet: string }[]}
 */
export function detecterViolations(contenu) {
  const violations = [];
  const lignes = String(contenu).split('\n');
  let aCreateRequire = false;
  let aImportMetaUrl = false;
  let definitFilename = false;
  let definitDirname = false;

  // Pré-pass : détecter le pattern `createRequire` autorisé et
  // `__dirname` / `__filename` redéfinis. (Le pré-pass tolère les faux
  // positifs car il ne fait que collecter des "permissions".)
  for (const ligne of lignes) {
    const c = effacerStringsEtCommentaires(ligne);
    if (/createRequire\s*\(\s*import\.meta\.url\s*\)/.test(c)) {
      aCreateRequire = true;
      aImportMetaUrl = true;
    }
    if (/const\s+__filename\s*=/.test(c)) definitFilename = true;
    if (/const\s+__dirname\s*=/.test(c)) definitDirname = true;
  }

  // Détection ligne par ligne, avec état multi-ligne : on ignore tout ce
  // qui se trouve à l'intérieur d'un template literal multi-ligne (les
  // messages d'aide / docstrings dans `console.error(\`...\`)`).
  let dansTemplate = false;
  let dansBlocComment = false;
  for (let i = 0; i < lignes.length; i++) {
    const original = lignes[i];
    const num = i + 1;
    const snippet = original.trim().slice(0, 80);

    // Suit l'état multi-ligne en parcourant les caractères significatifs
    // (sans gérer toutes les subtilités JS — heuristique suffisante pour
    // les modules `lib/`).
    let courant = original;
    if (dansBlocComment) {
      const fin = courant.indexOf('*/');
      if (fin === -1) continue;
      courant = courant.slice(fin + 2);
      dansBlocComment = false;
    }
    if (dansTemplate) {
      const fin = courant.indexOf('`');
      if (fin === -1) continue;
      courant = courant.slice(fin + 1);
      dansTemplate = false;
    }

    // Compte les backticks pour détecter une ouverture sans fermeture.
    const backticks = (courant.match(/`/g) || []).length;
    if (backticks % 2 === 1) dansTemplate = true;
    // Compte les ouvertures de bloc /* sans fermeture sur la même ligne.
    if (/\/\*/.test(courant) && !/\*\//.test(courant.split('/*').slice(1).join('/*'))) {
      dansBlocComment = true;
    }

    const c = effacerStringsEtCommentaires(courant);

    // require() — toléré uniquement si createRequire(import.meta.url) est
    // déclaré juste avant ou dans le fichier.
    if (/\brequire\s*\(/.test(c) && !/createRequire\s*\(/.test(c)) {
      if (!aCreateRequire) {
        violations.push({ rule: 'no-require', line: num, snippet });
      }
    }

    // module.exports = ...
    if (/\bmodule\.exports\b/.test(c)) {
      violations.push({ rule: 'no-module-exports', line: num, snippet });
    }

    // exports.X = ... (en début de ligne — ne pas confondre avec
    // `import { foo } from '...'` ni `export const foo = ...`)
    if (/^\s*exports\.\w+\s*=/.test(c)) {
      violations.push({ rule: 'no-exports-property', line: num, snippet });
    }

    // __filename / __dirname utilisés sans avoir été redéfinis depuis
    // `fileURLToPath(import.meta.url)`.
    if (/\b__filename\b/.test(c) && !definitFilename && !/=\s*fileURLToPath/.test(c)) {
      // tolérer les commentaires/docs où __filename apparaît
      if (!/^\s*[\/\*]/.test(original)) {
        violations.push({ rule: 'no-bare-filename', line: num, snippet });
      }
    }
    if (/\b__dirname\b/.test(c) && !definitDirname && !/dirname\s*\(\s*__filename\s*\)/.test(c)) {
      if (!/^\s*[\/\*]/.test(original)) {
        violations.push({ rule: 'no-bare-dirname', line: num, snippet });
      }
    }
  }

  return violations;
}

/**
 * Liste récursivement les fichiers .js sous un dossier.
 */
export function listerJs(dir, racine = dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const nom of readdirSync(dir)) {
    const path = join(dir, nom);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...listerJs(path, racine));
    else if (stat.isFile() && nom.endsWith('.js')) out.push(relative(racine, path));
  }
  return out.sort();
}

/**
 * Inspecte plusieurs dossiers et retourne le rapport agrégé.
 */
export function inspecter(dossiers) {
  const rapport = [];
  for (const dossier of dossiers) {
    if (!existsSync(dossier)) continue;
    for (const rel of listerJs(dossier)) {
      const path = join(dossier, rel);
      const c = readFileSync(path, 'utf-8');
      const violations = detecterViolations(c);
      if (violations.length) rapport.push({ path: relative(RACINE, path), violations });
    }
  }
  return rapport;
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseFlags(args) {
  const out = { json: false };
  for (const a of args) if (a === '--json') out.json = true;
  return out;
}

function main() {
  const flags = parseFlags(argv.slice(2));
  const rapport = inspecter([
    join(RACINE, 'lib'),
    join(RACINE, 'bin'),
    join(RACINE, 'scripts'),
  ]);

  const total = rapport.reduce((acc, r) => acc + r.violations.length, 0);
  const ok = total === 0;

  if (flags.json) {
    process.stdout.write(JSON.stringify({ ok, total, files: rapport }, null, 2) + '\n');
    if (!ok) exit(1);
    return;
  }

  if (ok) {
    console.log(`  ✓ ESM strict préservé (${rapport.length === 0 ? 'aucune' : rapport.length} violation(s) sur lib/ + bin/ + scripts/).`);
    exit(0);
  }

  console.error(`\n  ✗ ESM strict VIOLÉ — ${total} violation(s) sur ${rapport.length} fichier(s) :\n`);
  for (const f of rapport) {
    console.error(`  ${f.path}`);
    for (const v of f.violations) {
      console.error(`    L${v.line}  [${v.rule}]  ${v.snippet}`);
    }
  }
  console.error(`
  Le projet aiad-sdd est 100% ESM (package.json#type: module). Évite :
    - require()  → utilise import natif
    - module.exports / exports.X  → utilise export
    - __filename / __dirname bruts  → fileURLToPath(import.meta.url) + dirname
`);
  exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
