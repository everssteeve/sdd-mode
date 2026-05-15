#!/usr/bin/env node
// Linter zero-dep — boucle sur tous les .js de bin/, lib/, test/, scripts/
// et lance `node --check` (validation syntaxique du parser ESM/CJS Node).
// Détecte aussi les imports relatifs cassés (vérifie que les fichiers
// référencés existent).
//
// Pourquoi pas eslint/biome ? Parce que aiad-sdd revendique zero runtime
// dependency. Le lint reste utile pour bloquer les fautes de frappe et les
// imports morts en CI.

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(__dirname, '..');

const DOSSIERS = ['bin', 'lib', 'test', 'scripts'];

function* walk(dir) {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    const st = statSync(chemin);
    if (st.isDirectory()) yield* walk(chemin);
    else if (st.isFile() && extname(chemin) === '.js') yield chemin;
  }
}

function checkSyntax(fichier) {
  const r = spawnSync(process.execPath, ['--check', fichier], { encoding: 'utf-8' });
  if (r.status !== 0) {
    return { ok: false, raison: r.stderr.trim() || `exit ${r.status}` };
  }
  return { ok: true };
}

function checkImportsRelatifs(fichier) {
  const contenu = readFileSync(fichier, 'utf-8');
  const re = /from\s+['"](\.\/[^'"]+|\.\.\/[^'"]+)['"]/g;
  const erreurs = [];
  let m;
  while ((m = re.exec(contenu)) !== null) {
    let cible = resolve(dirname(fichier), m[1]);
    // Node permet d'omettre l'extension si `package.json` le permet ;
    // dans ce paquet on impose l'extension .js explicite côté ESM.
    if (!existsSync(cible)) {
      // Tolérer les imports vers .json ou autres
      if (existsSync(cible + '.js') || existsSync(join(cible, 'index.js'))) continue;
      erreurs.push(`import cassé : ${m[1]}`);
    }
  }
  return erreurs;
}

const erreurs = [];
let nbFichiers = 0;
for (const d of DOSSIERS) {
  const chemin = join(RACINE, d);
  if (!existsSync(chemin)) continue;
  for (const f of walk(chemin)) {
    nbFichiers++;
    const r = checkSyntax(f);
    if (!r.ok) erreurs.push(`${f}\n  ${r.raison}`);
    const imp = checkImportsRelatifs(f);
    for (const e of imp) erreurs.push(`${f} : ${e}`);
  }
}

if (erreurs.length > 0) {
  console.error(`\n  ${erreurs.length} erreur(s) sur ${nbFichiers} fichier(s) :\n`);
  for (const e of erreurs) console.error('  - ' + e);
  process.exit(1);
}

console.log(`  ✓ ${nbFichiers} fichiers vérifiés (syntaxe + imports relatifs).`);
