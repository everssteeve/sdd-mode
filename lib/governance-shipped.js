/**
 * @intent INTENT-034
 * @spec SPEC-034-1b-update-ecrase-signale
 * @verified-by test/governance-shipped.test.js
 */
// AIAD SDD Mode — Manifeste des agents de gouvernance livrés.
//
// `update` écrase les agents de gouvernance (la doctrine vient du package),
// mais une adaptation locale ne doit jamais être perdue en silence :
//   - `init` et `update` écrivent `.aiad/gouvernance/.aiad-shipped.json`
//     (empreinte SHA-256 de chaque agent tel que livré) ;
//   - avant d'écraser, `update` sauvegarde en `AIAD-<X>.md.bak-<AAAA-MM-JJ>`
//     (puis `-2`, `-3`…) tout agent modifié localement ;
//   - un agent absent du package (ajouté par l'utilisateur) n'est pas touché.
//
// Documentation : https://aiad.ovh

import { createHash } from 'node:crypto';
import { constants as fsConstants, copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDir, translateIOError } from './fs-ops.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = join(__dirname, '..', 'templates', '.aiad', 'gouvernance');

export const MANIFEST_NAME = '.aiad-shipped.json';

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function gouvDir(projetDir) {
  return join(projetDir, '.aiad', 'gouvernance');
}

/**
 * Agents livrés par le package (`templates/.aiad/gouvernance/AIAD-*.md`).
 * @param {string} [sourceDir]
 * @returns {string[]} noms de fichiers triés
 */
export function listShippedAgents(sourceDir = SOURCE_DIR) {
  if (!existsSync(sourceDir)) return [];
  return readdirSync(sourceDir)
    .filter((f) => /^AIAD-.+\.md$/.test(f))
    .sort();
}

/**
 * Manifeste attendu : `{ "<AIAD-X.md>": "<sha256 livré>" }`.
 * @returns {Record<string, string>}
 */
export function buildShippedManifest(sourceDir = SOURCE_DIR) {
  const out = {};
  for (const f of listShippedAgents(sourceDir)) {
    out[f] = sha256(readFileSync(join(sourceDir, f)));
  }
  return out;
}

/**
 * Écrit (ou réécrit) le manifeste dans `.aiad/gouvernance/`.
 * @returns {string} chemin du manifeste
 */
export function writeShippedManifest(projetDir, { sourceDir = SOURCE_DIR } = {}) {
  const dir = gouvDir(projetDir);
  ensureDir(dir);
  const dest = join(dir, MANIFEST_NAME);
  const contenu = JSON.stringify(buildShippedManifest(sourceDir), null, 2) + '\n';
  try {
    writeFileSync(dest, contenu, 'utf-8');
  } catch (err) {
    throw translateIOError(err, dest);
  }
  return dest;
}

/**
 * Lit le manifeste du projet. Absent ou illisible (JSON invalide, pas un
 * objet) → `null` : l'appelant applique alors la règle « manifeste absent ».
 * @returns {Record<string, string> | null}
 */
export function readShippedManifest(projetDir) {
  const chemin = join(gouvDir(projetDir), MANIFEST_NAME);
  if (!existsSync(chemin)) return null;
  try {
    const data = JSON.parse(readFileSync(chemin, 'utf-8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Premier nom de sauvegarde libre : `<fichier>.bak-<date>`, puis `-2`, `-3`…
 * @returns {string} chemin absolu
 */
export function backupPath(dir, fichier, date) {
  const base = join(dir, `${fichier}.bak-${date}`);
  if (!existsSync(base)) return base;
  for (let n = 2; ; n++) {
    const candidat = `${base}-${n}`;
    if (!existsSync(candidat)) return candidat;
  }
}

/**
 * Sauvegarde les agents livrés modifiés localement, AVANT leur écrasement.
 *
 * Modifié localement :
 *   - manifeste présent (et entrée pour ce fichier) → le fichier local diffère
 *     de l'empreinte enregistrée ;
 *   - sinon (manifeste absent / illisible, ou fichier sans entrée) → le
 *     fichier local diffère du nouveau gabarit livré.
 *
 * Seuls les agents livrés par le package sont examinés : un agent local
 * absent du package n'est ni modifié ni sauvegardé.
 *
 * @param {string} projetDir
 * @param {{ date?: string, sourceDir?: string }} [options]
 *   date : AAAA-MM-JJ (injectable pour les tests ; défaut : aujourd'hui UTC).
 * @returns {{ fichier: string, backup: string }[]} sauvegardes créées
 */
export function backupModifiedAgents(projetDir, options = {}) {
  const { sourceDir = SOURCE_DIR } = options;
  const date = options.date || new Date().toISOString().slice(0, 10);
  const dir = gouvDir(projetDir);
  const manifeste = readShippedManifest(projetDir);
  const sauvegardes = [];

  for (const fichier of listShippedAgents(sourceDir)) {
    const local = join(dir, fichier);
    if (!existsSync(local)) continue;
    const empreinteLocale = sha256(readFileSync(local));
    const reference = manifeste && typeof manifeste[fichier] === 'string'
      ? manifeste[fichier]
      : sha256(readFileSync(join(sourceDir, fichier)));
    if (empreinteLocale === reference) continue;

    const backup = backupPath(dir, fichier, date);
    try {
      copyFileSync(local, backup, fsConstants.COPYFILE_EXCL);
    } catch (err) {
      throw translateIOError(err, backup);
    }
    sauvegardes.push({ fichier, backup });
  }
  return sauvegardes;
}
