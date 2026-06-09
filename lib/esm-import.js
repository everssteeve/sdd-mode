// AIAD SDD Mode — Import ESM robuste cross-runtime (Node 18 + projets CommonJS).
//
// **Pourquoi ce module ?**
// Les hooks AIAD (`.aiad/hooks/aiad-hooks.js`, hooks de plugins) sont des
// fichiers `.js` rédigés en ESM (`export`). Or, avant Node 21, `import()`
// d'un `.js` résout le type de module via le `package.json` le plus proche :
// dans un projet CommonJS (sans `"type": "module"`), Node 18 le traite en
// CJS → « Unexpected token 'export' ». Node 20.19+/22 détectent la syntaxe
// ESM automatiquement.
//
// Stratégie : on tente d'abord l'URL fichier (préserve `import.meta.url` et
// les imports relatifs sur les runtimes capables) ; en cas d'échec dû au
// type de module, on retombe sur une `data:` URL, **toujours** évaluée en
// ESM quel que soit le type du projet. Les hooks AIAD étant des fichiers
// autonomes, la perte de résolution relative est sans effet.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * Détecte l'erreur typique d'un `.js` ESM chargé comme CommonJS (Node 18,
 * projet sans `"type": "module"`).
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export function estErreurTypeModule(err) {
  return (
    err instanceof SyntaxError &&
    /Unexpected token ['"]?export|Cannot use import statement|export declaration/.test(err.message)
  );
}

/**
 * Importe un module ESM depuis un chemin de fichier absolu, avec repli
 * `data:` URL pour Node 18 / projets CommonJS.
 *
 * @param {string} path chemin absolu du fichier
 * @returns {Promise<object>} le module importé
 */
export async function importerEsm(path) {
  const fileUrl = pathToFileURL(path).href;
  try {
    return await import(fileUrl);
  } catch (err) {
    if (!estErreurTypeModule(err)) throw err;
    const code = readFileSync(path, 'utf-8');
    const dataUrl = `data:text/javascript;base64,${Buffer.from(code, 'utf-8').toString('base64')}`;
    return await import(dataUrl);
  }
}
