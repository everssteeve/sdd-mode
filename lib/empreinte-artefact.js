/**
 * @intent INTENT-021
 * @spec SPEC-021-1-attribution-tokens-artefact
 * @verified-by test/empreinte-artefact.test.js
 * @governance AIAD-RGPD
 *
 * Agrégateur d'empreinte tokens par artefact (Intent/SPEC).
 * Lit .aiad/metrics/hook-runs.jsonl et groupe les tokens par specId/intentId.
 * Persistance locale uniquement (CA-010). Aucune requête réseau (CA-011).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Lit hook-runs.jsonl et regroupe les tokens par artefact actif.
 *
 * @param {string} racine - racine du projet
 * @returns {{ parSpec: Object, parIntent: Object, nonAttribues: { tokens: number, sessions: number } }}
 */
export function collecterEmpreinteParArtefact(racine) {
  const jsonlPath = join(racine, '.aiad', 'metrics', 'hook-runs.jsonl');

  const parSpec = {};
  const parIntent = {};
  const nonAttribues = { tokens: 0, sessions: 0 };

  if (!existsSync(jsonlPath)) return { parSpec, parIntent, nonAttribues };

  let lignes;
  try {
    lignes = readFileSync(jsonlPath, 'utf-8').split('\n').filter(Boolean);
  } catch {
    return { parSpec, parIntent, nonAttribues };
  }

  for (const ligne of lignes) {
    let entry;
    try {
      entry = JSON.parse(ligne);
    } catch {
      continue; // ligne malformée — ignorée silencieusement (CA-005)
    }

    if (!entry || typeof entry !== 'object') continue;

    const tokens = entry.ecoMetrics?.totalTokens ?? 0;
    const specId = entry.specId || null;
    const intentId = entry.intentId || null;

    if (!specId && !intentId) {
      // CA-004 — entrées héritées ou non attribuées
      nonAttribues.tokens += tokens;
      nonAttribues.sessions += 1;
      continue;
    }

    if (specId) {
      if (!parSpec[specId]) parSpec[specId] = { tokens: 0, sessions: 0 };
      parSpec[specId].tokens += tokens;
      parSpec[specId].sessions += 1;
    }

    if (intentId) {
      if (!parIntent[intentId]) parIntent[intentId] = { tokens: 0, sessions: 0 };
      parIntent[intentId].tokens += tokens;
      parIntent[intentId].sessions += 1;
    }
  }

  return { parSpec, parIntent, nonAttribues };
}
