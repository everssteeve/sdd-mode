// AIAD SDD Mode — Worker pour scan parallèle de la matrice de traçabilité.
//
// Activé automatiquement par `scanCode()` quand le nombre de fichiers cibles
// dépasse `parallelThreshold` (défaut 50 000). Spawn N workers (1 par cœur)
// et leur distribue les chunks ; chaque worker parse en isolation et renvoie
// le sous-résultat via `parentPort.postMessage`.
//
// **Zero-dep** : utilise uniquement `node:worker_threads` natif.
//
// Documentation : https://aiad.ovh

import { parentPort, workerData } from 'node:worker_threads';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parserAnnotations, estTest } from './sdd-trace.js';
import { isFresh } from './trace-cache.js';

if (!parentPort) {
  // Importé hors contexte worker — pas de side effect.
  // Permet aux tests de charger le module pour vérifier ses exports.
}

/**
 * Traite un chunk de fichiers et retourne les annotations + métadonnées
 * cache. Pure (pas d'effet de bord disque autre que les `readFileSync`).
 *
 * @param {string} racine
 * @param {string[]} chunk — chemins relatifs
 * @param {Record<string, object>} cache — entrées cache pour réutilisation
 * @returns {{ entries: object[], cacheUpdates: Record<string, object> }}
 */
export function traiterChunk(racine, chunk, cache = {}) {
  const entries = [];
  const cacheUpdates = {};

  for (const fichier of chunk) {
    let stat;
    try { stat = statSync(join(racine, fichier)); }
    catch { continue; }
    const meta = { mtimeMs: stat.mtimeMs, size: stat.size };

    let entry;
    if (isFresh(cache[fichier], meta)) {
      entry = {
        path: fichier,
        isTest: cache[fichier].isTest,
        annotations: cache[fichier].annotations,
        annotated: cache[fichier].annotated,
      };
    } else {
      let contenu;
      try { contenu = readFileSync(join(racine, fichier), 'utf-8'); }
      catch { continue; }
      const ann = parserAnnotations(contenu, fichier);
      const aDesAnnotations =
        ann.intents.length || ann.specs.length || ann.verifiedBy.length || ann.governance.length;
      entry = {
        path: fichier,
        isTest: estTest(fichier),
        annotations: ann,
        annotated: Boolean(aDesAnnotations),
      };
    }

    entries.push(entry);
    cacheUpdates[fichier] = {
      mtimeMs: meta.mtimeMs,
      size: meta.size,
      isTest: entry.isTest,
      annotated: entry.annotated,
      annotations: entry.annotations,
    };
  }

  return { entries, cacheUpdates };
}

// Si le module est lancé en tant que worker thread, il traite son chunk
// et renvoie le résultat au thread principal puis se termine.
if (parentPort) {
  const { racine, chunk, cache } = workerData;
  try {
    const result = traiterChunk(racine, chunk, cache);
    parentPort.postMessage(result);
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
}
