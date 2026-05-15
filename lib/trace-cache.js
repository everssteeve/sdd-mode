// AIAD SDD Mode — Cache incrémental de la matrice de traçabilité.
//
// Le scan complet `parserAnnotations()` est linéaire en nombre de fichiers
// (~17 µs/fichier mesuré dans #43). Sur un monorepo de 100k+ fichiers, c'est
// ~1.8 s — déjà tenu, mais on peut faire ~10× mieux en cache incrémental :
// si le `mtimeMs + size` d'un fichier n'a pas changé depuis le dernier
// scan, on réutilise le résultat parsé.
//
// **Invariant de cache** : la clé `mtimeMs:size` est suffisante pour
// détecter une modification (les filesystem POSIX mettent à jour mtime
// sur écriture, et la combinaison avec `size` couvre les rares cas de
// rewrites stricts qui préservent mtime).
//
// Format `.aiad/.cache/trace.json` :
//   {
//     "version": 1,
//     "files": {
//       "<chemin relatif>": {
//         "mtimeMs": 1234567890.123,
//         "size": 1024,
//         "isTest": false,
//         "annotated": true,
//         "annotations": { intents, specs, verifiedBy, governance }
//       }
//     }
//   }
//
// Le cache est ignoré silencieusement si le format change (`version` ≠ 1)
// ou si le fichier est corrompu — on retombe simplement en re-scan complet.
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const CACHE_VERSION = 1;
const CACHE_DIR = '.aiad/.cache';
const CACHE_FILE = 'trace.json';

/**
 * Construit la clé d'invalidation d'un fichier (mtime + size).
 *
 * @param {{ mtimeMs: number, size: number }} stat
 * @returns {string}
 */
export function cacheKey(stat) {
  return `${stat.mtimeMs}:${stat.size}`;
}

/**
 * Lit le cache disque ; renvoie un objet vide si inexistant ou invalide.
 *
 * @param {string} racine
 * @returns {{ version: number, files: Record<string, object> }}
 */
export function readCache(racine) {
  const path = join(racine, CACHE_DIR, CACHE_FILE);
  if (!existsSync(path)) return { version: CACHE_VERSION, files: {} };
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    if (data.version !== CACHE_VERSION || typeof data.files !== 'object') {
      return { version: CACHE_VERSION, files: {} };
    }
    return data;
  } catch {
    return { version: CACHE_VERSION, files: {} };
  }
}

/**
 * Écrit le cache. Crée `.aiad/.cache/` si absent. Silencieux sur erreur
 * (le cache est une optimisation, jamais une dépendance dure).
 *
 * @param {string} racine
 * @param {{ files: Record<string, object> }} cache
 */
export function writeCache(racine, cache) {
  try {
    const dir = join(racine, CACHE_DIR);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const path = join(dir, CACHE_FILE);
    const payload = {
      version: CACHE_VERSION,
      files: cache.files,
    };
    writeFileSync(path, JSON.stringify(payload), 'utf-8');
  } catch {
    // Cache écriture best-effort — silencieux.
  }
}

/**
 * Détermine si une entrée cache est valide pour un fichier donné.
 *
 * @param {object|undefined} entry
 * @param {{ mtimeMs: number, size: number }} stat
 * @returns {boolean}
 */
export function isFresh(entry, stat) {
  if (!entry) return false;
  return entry.mtimeMs === stat.mtimeMs && entry.size === stat.size;
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  readCache as loadCache,
  writeCache as saveCache,
};
