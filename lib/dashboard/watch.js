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

import { watch, existsSync, readdirSync, statSync } from 'node:fs';
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
  const { debounceMs = 200, pollMs = 60 } = options;
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

  // `recursive: true` est supporté sur macOS/Windows, et sur Linux à partir de
  // Node 20. Sur Linux + Node < 20, l'option est ignorée ou l'erreur est émise
  // de façon asynchrone (pas d'exception synchrone fiable, et un fallback
  // non-récursif raterait les sous-dossiers comme `.aiad/specs/`). On détecte
  // donc explicitement la config non supportée pour basculer sur le polling.
  const majeurNode = Number(process.versions.node.split('.')[0]);
  const recursifSupporte = process.platform !== 'linux' || majeurNode >= 20;
  const forcerPolling = process.env.AIAD_WATCH_POLL === '1';

  let inner, pollTimer;
  if (recursifSupporte && !forcerPolling) {
    try {
      inner = watch(cible, { recursive: true }, (_evt, filename) => {
        if (devraitIgnorer(filename)) return;
        trigger(filename);
      });
    } catch (err) {
      if (err.code === 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM') {
        inner = null;
      } else {
        throw err;
      }
    }
  }

  if (!inner) {
    // Fallback polling : compare une signature {chemin → mtime/size} de `.aiad/`.
    let prec = signatureAiad(cible);
    pollTimer = setInterval(() => {
      const cur = signatureAiad(cible, prec);
      if (cur.sig !== prec.sig) {
        const change = cur.change;
        prec = cur;
        if (change && !devraitIgnorer(change)) trigger(change);
      }
    }, pollMs);
    if (typeof pollTimer.unref === 'function') pollTimer.unref();
  }

  return {
    close: () => {
      if (timer) clearTimeout(timer);
      if (pollTimer) clearInterval(pollTimer);
      try { inner?.close(); } catch { /* ignore */ }
    },
  };
}

/**
 * Signature d'arborescence de `.aiad/` pour le fallback polling : map
 * `chemin relatif → mtimeMs:size`. Quand un état précédent est fourni, repère
 * le premier fichier ajouté/modifié (pour transmettre un nom à `onChange`).
 *
 * @param {string} cible dossier `.aiad/` absolu
 * @param {{ map?: Map<string,string> }} [precedent]
 * @returns {{ sig: string, map: Map<string,string>, change: string|null }}
 */
function signatureAiad(cible, precedent) {
  const map = new Map();
  const visiter = (dir, base) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const rel = base ? `${base}/${ent.name}` : ent.name;
      const chemin = join(dir, ent.name);
      if (ent.isDirectory()) {
        visiter(chemin, rel);
      } else if (ent.isFile()) {
        let st;
        try { st = statSync(chemin); } catch { continue; }
        map.set(rel, `${st.mtimeMs}:${st.size}`);
      }
    }
  };
  visiter(cible, '');
  const sig = [...map.entries()].sort().map(([k, v]) => `${k}=${v}`).join('|');
  let change = null;
  if (precedent && precedent.map) {
    for (const [k, v] of map) {
      if (precedent.map.get(k) !== v) { change = k; break; }
    }
  }
  return { sig, map, change };
}
