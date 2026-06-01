// AIAD SDD Mode — Watcher .aiad/ pour le dashboard --serve --watch.
//
// Surveille `.aiad/` et appelle `onChange(filename)` après debounce. La
// re-génération du dashboard est déclenchée par l'appelant (lib/dashboard.js).
// Le serveur HTTP n'est pas redémarré — on remet simplement les fichiers
// statiques à jour ; le navigateur reload manuellement (ou via un futur SSE).
//
// Filtrage par défaut :
//   - ignore .lock files (lock-file emit-rules)
//   - ignore les changements dans metrics/ (souvent produits par les
//     commandes qui consultent le dashboard, → boucle infinie sinon)
//   - ignore les fichiers temporaires des éditeurs (.swp, ~, .tmp)
//
// Documentation : https://aiad.ovh

import { watch } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const IGNORE_PATTERNS = [
  /\.lock$/,
  /^metrics\//,
  /\.swp$/i,
  /~$/,
  /\.tmp$/i,
  /\.DS_Store$/,
];

export function devraitIgnorer(filename) {
  if (!filename) return false;
  return IGNORE_PATTERNS.some((re) => re.test(filename));
}

/**
 * Démarre un watcher sur `.aiad/` du projet et appelle `onChange(filename)`
 * après debounce.
 *
 * @param {string} racine
 * @param {(filename: string) => void | Promise<void>} onChange
 * @param {{ debounceMs?: number }} [options]
 * @returns {{ close: () => void }}
 */
export function watcher(racine, onChange, options = {}) {
  const { debounceMs = 200 } = options;
  const cible = join(racine, '.aiad');
  if (!existsSync(cible)) {
    throw new Error(`.aiad/ introuvable : ${cible}`);
  }

  let timer = null;
  let dernierFichier = null;
  const trigger = (filename) => {
    dernierFichier = filename;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const f = dernierFichier;
      dernierFichier = null;
      try { onChange(f); } catch { /* swallow — ne casse pas le watcher */ }
    }, debounceMs);
  };

  // `recursive: true` est supporté sur macOS/Windows depuis longtemps et sur
  // Linux à partir de Node 20. Si la plateforme rejette l'option, on retombe
  // sur un watcher non-récursif (limité au top-level de `.aiad/`).
  let inner;
  try {
    inner = watch(cible, { recursive: true }, (_evt, filename) => {
      if (devraitIgnorer(filename)) return;
      trigger(filename);
    });
  } catch (err) {
    if (err.code === 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM') {
      inner = watch(cible, (_evt, filename) => {
        if (devraitIgnorer(filename)) return;
        trigger(filename);
      });
    } else {
      throw err;
    }
  }

  return {
    close: () => {
      if (timer) clearTimeout(timer);
      try { inner.close(); } catch { /* ignore */ }
    },
  };
}
