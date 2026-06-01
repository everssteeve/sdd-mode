// AIAD SDD Mode — Helper `_meta` partagé (#258).
//
// Source unique pour le bloc `_meta` injecté dans les sorties --json des
// commandes AIAD (dashboard data.json #253, doctor, brief #254 via
// propagation, etc.). Permet aux consumers externes (Slack-bot, CI,
// Notion sync) d'identifier la provenance + version + état du payload.

import { readFileSync } from 'node:fs';

// Lit la version depuis package.json au load. Cohérent avec docs.js et
// dashboard.js (sources multiples → DRY-isé ici).
function lireVersionPackage() {
  try {
    const url = new URL('../package.json', import.meta.url);
    return JSON.parse(readFileSync(url, 'utf-8')).version;
  } catch { return 'unknown'; }
}

export const VERSION_AIAD = lireVersionPackage();
export const SCHEMA_ID = 'aiad-sdd';

// Construit un `_meta` standard. Accepte des champs additionnels propres
// à chaque commande (ex: dashboard ajoute `slim`, brief n'ajoute rien et
// se contente de propager).
//   buildMeta()                       → { schema, version, generated }
//   buildMeta({ slim: true })         → { schema, version, generated, slim: true }
//   buildMeta({ schema: 'dashboard' }) → schema override (sous-namespace)
export function buildMeta(extra = {}) {
  return {
    schema: extra.schema || SCHEMA_ID,
    version: VERSION_AIAD,
    generated: extra.generated || new Date().toISOString(),
    ...Object.fromEntries(Object.entries(extra).filter(([k]) => !['schema', 'generated'].includes(k))),
  };
}

export { buildMeta as buildMetaBlock };
