#!/usr/bin/env node
// AIAD SDD Mode — Contrôle de drift de la doctrine livrée.
//
// @intent INTENT-034
// @spec SPEC-034-2-controle-drift-doctrine
// @verified-by test/check-doctrine.test.js
// @governance AIAD-RGESN
//
// Le Drive fait foi (INTENT-034). La CI (GitHub) ne lit pas le Drive : le
// contrôle se fait en deux temps, contre l'empreinte `templates/doctrine.lock.json`
// écrite par `scripts/sync-doctrine.js` (SPEC-034-1a).
//
//   - Mode CI (défaut) : recalcule le SHA-256 de chaque fichier listé dans le
//     lock et le compare à l'empreinte enregistrée (modification directe dans
//     le package → drift).
//   - Mode release (`--source <published/md>`) : applique à chaque fichier
//     source du Drive la MÊME réécriture de liens que la sync (fonctions de
//     `sync-doctrine.js`, non dupliquées), compare les empreintes à celles du
//     lock, et compare la version lue dans le titre de `frameworkAIAD.md` source
//     à `doctrineVersion`. Exécuté par `scripts/release.js` avant tout bump.
//
// Lecture seule : ce script n'écrit rien. Aucun appel réseau.
//
// Usage :
//   node scripts/check-doctrine.js                          # mode CI
//   node scripts/check-doctrine.js --source <published/md>  # mode release
//   exit 0 : conforme · exit 1 : drift (écarts listés) · exit 2 : indécidable
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  LOCK_PATH,
  SyncDoctrineError,
  empreinte,
  listerLegitimationLocale,
  preparerSync,
} from './sync-doctrine.js';

const __filename = fileURLToPath(import.meta.url);
const RACINE = resolve(dirname(__filename), '..');

export const CODE_CONFORME = 0;
export const CODE_DRIFT = 1;
export const CODE_INDECIDABLE = 2;

/** Contrôle impossible à trancher (lock absent/illisible, source absente…) → exit 2. */
export class DoctrineIndecidableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DoctrineIndecidableError';
  }
}

/**
 * Lit `templates/doctrine.lock.json`.
 *
 * @param {string} racine
 * @returns {{ doctrineVersion: string, files: Record<string, string> }}
 * @throws {DoctrineIndecidableError} lock absent, JSON invalide ou structure inattendue
 */
export function lireLock(racine) {
  const chemin = join(racine, LOCK_PATH);
  if (!existsSync(chemin)) {
    throw new DoctrineIndecidableError(`${LOCK_PATH} absent — lancer d'abord scripts/sync-doctrine.js.`);
  }
  let lock;
  try {
    lock = JSON.parse(readFileSync(chemin, 'utf-8'));
  } catch (e) {
    throw new DoctrineIndecidableError(`${LOCK_PATH} illisible (JSON invalide) : ${e.message}`);
  }
  if (!lock || typeof lock.files !== 'object' || lock.files === null || typeof lock.doctrineVersion !== 'string') {
    throw new DoctrineIndecidableError(`${LOCK_PATH} mal formé : champs « doctrineVersion » et « files » attendus.`);
  }
  return lock;
}

/**
 * Mode CI : compare le SHA-256 de chaque fichier listé dans le lock (dans
 * `racine`) à l'empreinte enregistrée. Un fichier listé absent est un drift.
 *
 * @param {string} racine
 * @returns {{ exitCode: 0|1, version: string, ecarts: Array<{ fichier: string, motif: string }> }}
 * @throws {DoctrineIndecidableError}
 */
export function verifierCi(racine) {
  const lock = lireLock(racine);
  const ecarts = [];
  for (const [fichier, attendu] of Object.entries(lock.files)) {
    const chemin = join(racine, fichier);
    if (!existsSync(chemin)) {
      ecarts.push({ fichier, motif: 'fichier absent' });
    } else if (empreinte(readFileSync(chemin, 'utf-8')) !== attendu) {
      ecarts.push({ fichier, motif: 'contenu différent de l\'empreinte du lock' });
    }
  }
  return { exitCode: ecarts.length ? CODE_DRIFT : CODE_CONFORME, version: lock.doctrineVersion, ecarts };
}

/**
 * Mode release : réécrit chaque source du Drive exactement comme la sync
 * (SPEC-034-1a, `preparerSync` + `listerLegitimationLocale(racine)`), puis
 * compare empreintes et version de doctrine au lock.
 *
 * @param {string} racine dépôt (lock + `docs/legitimation/` pour la règle 1b)
 * @param {string|undefined} source racine `published/md/`
 * @returns {{ exitCode: 0|1, version: { lock: string, source: string },
 *             ecarts: Array<{ fichier: string, motif: string }> }}
 * @throws {DoctrineIndecidableError}
 */
export function verifierRelease(racine, source) {
  const lock = lireLock(racine);
  if (!source) {
    throw new DoctrineIndecidableError('Source absente : fournir --source <chemin published/md> (ou AIAD_DOCTRINE_SOURCE via release.js).');
  }
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    throw new DoctrineIndecidableError(`Source introuvable ou n'est pas un dossier : ${source}`);
  }

  let prepare;
  try {
    prepare = preparerSync(source, { legitimationLocale: listerLegitimationLocale(racine) });
  } catch (e) {
    if (e instanceof SyncDoctrineError) throw new DoctrineIndecidableError(e.message);
    throw e;
  }

  const ecarts = [];
  if (prepare.version !== lock.doctrineVersion) {
    ecarts.push({
      fichier: 'frameworkAIAD.md (titre)',
      motif: `version de doctrine ${prepare.version} sur le Drive ≠ ${lock.doctrineVersion} dans le lock`,
    });
  }

  const attendus = new Set(Object.keys(lock.files));
  for (const etape of prepare.plan) {
    const calcule = empreinte(etape.contenu);
    for (const cible of etape.cibles) {
      attendus.delete(cible);
      if (!(cible in lock.files)) {
        ecarts.push({ fichier: cible, motif: `absent du lock (source ${etape.source})` });
      } else if (lock.files[cible] !== calcule) {
        ecarts.push({ fichier: cible, motif: `contenu du Drive (${etape.source}) différent de l'empreinte du lock` });
      }
    }
  }
  for (const orphelin of attendus) {
    ecarts.push({ fichier: orphelin, motif: 'listé dans le lock mais sans source correspondante sur le Drive' });
  }

  return {
    exitCode: ecarts.length ? CODE_DRIFT : CODE_CONFORME,
    version: { lock: lock.doctrineVersion, source: prepare.version },
    ecarts,
  };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

/**
 * @param {string[]} [argv]
 * @param {{ racine?: string, log?: (m: string) => void, erreur?: (m: string) => void }} [ctx]
 * @returns {number} code de sortie
 */
export function main(argv = process.argv.slice(2), ctx = {}) {
  const racine = ctx.racine || RACINE;
  const log = ctx.log || ((m) => console.log(m));
  const erreur = ctx.erreur || ((m) => console.error(m));

  let values;
  try {
    ({ values } = parseArgs({ args: argv, options: { source: { type: 'string' } }, strict: true }));
  } catch (e) {
    erreur(`  ✗ ${e.message}`);
    return CODE_INDECIDABLE;
  }
  const release = values.source !== undefined;
  const mode = release ? 'release' : 'CI';

  let r;
  try {
    r = release ? verifierRelease(racine, values.source) : verifierCi(racine);
  } catch (e) {
    if (e instanceof DoctrineIndecidableError) {
      erreur(`  ✗ check-doctrine (mode ${mode}) indécidable : ${e.message}`);
      return CODE_INDECIDABLE;
    }
    throw e;
  }

  const version = release ? r.version.lock : r.version;
  if (r.exitCode === CODE_CONFORME) {
    log(`  ✓ Doctrine ${version} conforme (mode ${mode}) : ${LOCK_PATH} ${release ? '= Drive publié' : '= fichiers livrés'}.`);
  } else {
    log(`  ✗ Drift de doctrine (mode ${mode}) — ${r.ecarts.length} écart(s) :`);
    for (const e of r.ecarts) log(`    - ${e.fichier} (${e.motif})`);
    log('  → Resynchroniser depuis le Drive : node scripts/sync-doctrine.js --source <published/md>');
  }
  return r.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
