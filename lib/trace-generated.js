// AIAD SDD Mode — Dossiers générés, exclus de la traçabilité.
//
// La sortie du tableau de bord embarque des assets du paquet, annotés avec les
// SPEC du paquet. Lus par la traçabilité d'un projet, ils deviennent des écarts
// qui ne lui appartiennent pas. Un fichier témoin marque donc tout dossier
// généré ; ce qu'il contient n'est jamais analysé.
//
// @intent INTENT-039
// @spec SPEC-039-3-diagnostics-vrais
// @verified-by test/install-lifecycle.test.js
//
// Documentation : https://aiad.ovh

import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Fichier témoin d'un dossier généré par l'outil (ex. sortie du dashboard).
 * Tout ce qui s'y trouve est exclu de la traçabilité.
 */
export const MARQUEUR_GENERE = '.aiad-generated';

/**
 * Fabrique un prédicat « ce fichier est-il dans un dossier généré ? », avec
 * cache par dossier (un `existsSync` par dossier, pas par fichier).
 *
 * @param {string} racine
 * @returns {(cheminRelatif: string) => boolean}
 */
export function fabriquerFiltreGenere(racine) {
  const cache = new Map();
  const genere = (dir) => {
    if (cache.has(dir)) return cache.get(dir);
    const ici = existsSync(join(racine, dir, MARQUEUR_GENERE));
    const parent = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : null;
    const r = ici || (parent !== null && genere(parent));
    cache.set(dir, r);
    return r;
  };
  return (cheminRelatif) => {
    const p = cheminRelatif.split('\\').join('/');
    const i = p.lastIndexOf('/');
    return i > 0 ? genere(p.slice(0, i)) : false;
  };
}
