/**
 * @intent INTENT-022
 * @spec SPEC-022-1-retro-annotations-core
 */
// AIAD SDD Mode — Opérations fichiers partagées.
//
// Centralise la stratégie de copie/mise à jour aujourd'hui réimplémentée dans
// init.js, update.js, upgrade.js, governance.js et hooks.js, avec des
// variantes subtiles (write-if-not-exists vs write-always vs append) qui
// rendent les bugs difficiles à diagnostiquer.
//
// Sémantique unique :
//   - `ensureDir(d)`         crée d récursivement si absent.
//   - `mettreAJour(dest, c)` écrit c dans dest seulement si différent.
//                            Renvoie 'created' | 'updated' | 'unchanged'.
//   - `copierFichier(s,d,o)` lit s et applique mettreAJour avec policy.
//                            o.preserve=true → ne touche pas un fichier existant.
//                            o.force=true    → écrase même si preserve.
//                            Renvoie 'created' | 'updated' | 'unchanged' | 'preserved'.
//   - `copierDossier(s,d,o)` récursif. Accepte o.exclude(nom, src, depth).
//                            Renvoie un objet stats { created, updated, unchanged, preserved }.
//
// Toutes les opérations sont synchrones — cohérent avec le profil CLI court
// du paquet, et trivialement testables. La gestion d'erreurs IO (EACCES,
// EPERM, ENOSPC) est centralisée ici (item #24 du backlog).
//
// Documentation : https://aiad.ovh

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

// Traduit les erreurs Node FS courantes en messages actionnables en
// français. Préserve l'`err.code` original pour permettre aux appelants
// de filtrer programmatiquement (`err.code === 'EACCES'`).
//
// Sans ce wrapper, l'utilisateur voit `Error: EACCES: permission denied`
// brut depuis le bin/aiad-sdd.js → message peu utile pour quelqu'un qui
// ne connaît pas les codes errno POSIX.
const MESSAGES_IO = {
  EACCES: (path) => `Permission refusée sur "${path}". Vérifie les droits d'écriture (\`ls -ld "${dirname(path)}"\` pour inspecter).`,
  EPERM: (path) => `Opération non permise sur "${path}". Vérifie le propriétaire du fichier ou du dossier — un \`chown\` peut être nécessaire.`,
  ENOSPC: () => `Aucun espace disque disponible. Libère de l'espace puis relance la commande.`,
  EROFS: (path) => `Système de fichiers en lecture seule pour "${path}". Le volume cible n'est pas writable.`,
  EISDIR: (path) => `"${path}" est un dossier — un fichier était attendu.`,
  ENOTDIR: (path) => `"${path}" n'est pas un dossier — un dossier était attendu.`,
  EMFILE: () => `Trop de fichiers ouverts simultanément. Réessaie ou augmente la limite système (\`ulimit -n\`).`,
};

export function traduireErreurIO(err, path = '') {
  const factory = MESSAGES_IO[err && err.code];
  if (!factory) return err;
  const msg = factory(path);
  const wrapped = new Error(msg);
  wrapped.code = err.code;
  wrapped.path = err.path || path;
  wrapped.cause = err;
  return wrapped;
}

// Helper interne qui exécute un `fn()` et traduit toute erreur IO.
function executerIO(fn, path) {
  try {
    return fn();
  } catch (err) {
    throw traduireErreurIO(err, path);
  }
}

export function ensureDir(chemin, { dryRun = false } = {}) {
  if (dryRun) return;
  if (!existsSync(chemin)) executerIO(() => mkdirSync(chemin, { recursive: true }), chemin);
}

/**
 * Écrit `contenu` dans `destination` seulement si différent du contenu existant.
 * Crée les dossiers parents au besoin.
 *
 * Quand `dryRun` est true, aucune écriture n'est effectuée — la fonction
 * retourne le verdict qui serait obtenu (`'created'`, `'updated'`,
 * `'unchanged'`). C'est l'invariant central qui rend toutes les commandes
 * `init/update/upgrade/emit-rules` sûres en mode aperçu.
 *
 * @param {string} destination
 * @param {string} contenu
 * @param {{ dryRun?: boolean }} [options]
 * @returns {'created'|'updated'|'unchanged'}
 */
export function mettreAJour(destination, contenu, { dryRun = false } = {}) {
  if (!existsSync(destination)) {
    if (!dryRun) {
      ensureDir(dirname(destination));
      executerIO(() => writeFileSync(destination, contenu, 'utf-8'), destination);
    }
    return 'created';
  }
  const existant = executerIO(() => readFileSync(destination, 'utf-8'), destination);
  if (existant === contenu) return 'unchanged';
  if (!dryRun) executerIO(() => writeFileSync(destination, contenu, 'utf-8'), destination);
  return 'updated';
}

/**
 * Copie un fichier source vers destination en respectant la politique de
 * préservation utilisateur.
 *
 * @param {string} source
 * @param {string} destination
 * @param {{ preserve?: boolean, force?: boolean }} [options]
 *   preserve: si true et que la destination existe, ne pas la toucher.
 *   force:    si true, écrase même si preserve.
 * @returns {'created'|'updated'|'unchanged'|'preserved'}
 */
export function copierFichier(source, destination, options = {}) {
  const { preserve = false, force = false, dryRun = false } = options;
  if (!existsSync(destination)) {
    if (!dryRun) {
      ensureDir(dirname(destination));
      const data = executerIO(() => readFileSync(source), source);
      executerIO(() => writeFileSync(destination, data, 'utf-8'), destination);
    }
    return 'created';
  }
  if (preserve && !force) return 'preserved';
  const nouveau = executerIO(() => readFileSync(source, 'utf-8'), source);
  const existant = executerIO(() => readFileSync(destination, 'utf-8'), destination);
  if (nouveau === existant) return 'unchanged';
  if (!force) return 'preserved';
  if (!dryRun) executerIO(() => writeFileSync(destination, nouveau, 'utf-8'), destination);
  return 'updated';
}

/**
 * Copie récursive d'un dossier. Accepte un filtre `exclude(nom, srcPath, depth)`
 * — si truthy, l'élément (fichier ou dossier) est sauté.
 *
 * @returns {{ created: number, updated: number, unchanged: number, preserved: number }}
 */
export function copierDossier(source, destination, options = {}) {
  const stats = { created: 0, updated: 0, unchanged: 0, preserved: 0 };
  if (!existsSync(source)) return stats;
  const { exclude = () => false, force = false, preserve = false, dryRun = false, _depth = 0 } = options;

  ensureDir(destination, { dryRun });
  for (const nom of readdirSync(source)) {
    const cheminSource = `${source}/${nom}`;
    const cheminDest = `${destination}/${nom}`;
    if (exclude(nom, cheminSource, _depth)) continue;

    let st;
    try { st = statSync(cheminSource); } catch { continue; }

    if (st.isDirectory()) {
      const sub = copierDossier(cheminSource, cheminDest, {
        exclude,
        force,
        preserve,
        dryRun,
        _depth: _depth + 1,
      });
      stats.created += sub.created;
      stats.updated += sub.updated;
      stats.unchanged += sub.unchanged;
      stats.preserved += sub.preserved;
    } else if (st.isFile()) {
      const result = copierFichier(cheminSource, cheminDest, { preserve, force, dryRun });
      stats[result] = (stats[result] || 0) + 1;
    }
  }
  return stats;
}

/**
 * Append `bloc` à `destination` seulement s'il n'y figure pas déjà
 * (`marqueur` sert de sentinelle d'idempotence). Si destination n'existe
 * pas, elle est créée avec `bloc` comme contenu.
 *
 * @returns {'appended'|'created'|'unchanged'}
 */
export function ajouterSiAbsent(destination, bloc, marqueur, { dryRun = false } = {}) {
  if (!existsSync(destination)) {
    if (!dryRun) {
      ensureDir(dirname(destination));
      executerIO(() => writeFileSync(destination, bloc, 'utf-8'), destination);
    }
    return 'created';
  }
  const existant = executerIO(() => readFileSync(destination, 'utf-8'), destination);
  if (existant.includes(marqueur)) return 'unchanged';
  if (!dryRun) executerIO(() => writeFileSync(destination, existant + bloc, 'utf-8'), destination);
  return 'appended';
}

// ─── Alias EN canoniques ────────────────────────────────────────────────────
//
// Le code interne historique est en français mixte (mettreAJour, copierFichier,
// ajouterSiAbsent, traduireErreurIO, executerIO). On expose désormais les
// noms anglais comme **canoniques** pour :
//   - rejoindre la convention de l'écosystème Node (faciliter les
//     contributions externes EU/internationales),
//   - rendre l'API cohérente avec `ensureDir` qui était déjà en anglais.
//
// Les anciens noms restent exportés pour préserver la compat. Les nouveaux
// modules doivent importer les versions EN ; les anciens peuvent migrer
// progressivement (item #25 du backlog).

export {
  mettreAJour as syncFile,
  copierFichier as copyFile,
  copierDossier as copyDir,
  ajouterSiAbsent as appendIfMissing,
  traduireErreurIO as translateIOError,
};
