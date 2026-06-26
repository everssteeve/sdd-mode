/**
 * @intent INTENT-021
 * @spec SPEC-021-1-attribution-tokens-artefact
 * @spec SPEC-021-2-restitution-empreinte-context
 * @verified-by test/empreinte-artefact.test.js
 * @verified-by test/footprint-formatter.test.js
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

/**
 * Formate la sortie de collecterEmpreinteParArtefact en bloc texte lisible.
 * Tri : tokens décroissants ; à égalité, specId croissant (CA-007, CA-008).
 * Avertissement si nonAttribues > 50 % du total (CA-005).
 * Aucune valeur monétaire € (CA-010, condition C2 RESEARCH-034).
 *
 * @param {{ parSpec: Object, parIntent: Object, nonAttribues: { tokens: number, sessions: number } }} empreinte
 * @param {{ cible?: string }} [options]
 * @returns {string}
 */
export function formaterEmpreinte(empreinte, { cible } = {}) {
  const { parSpec = {}, parIntent = {}, nonAttribues = { tokens: 0, sessions: 0 } } = empreinte;

  const lignes = ['Empreinte mesurée (tokens, local opt-in)'];

  if (cible) {
    // Ciblage d'un artefact (CA-002)
    const entreeSpec = parSpec[cible];
    const entreeIntent = parIntent[cible];
    const entree = entreeSpec || entreeIntent;
    if (entree) {
      lignes.push(`  ${cible.padEnd(20)} ${String(entree.tokens).padStart(8)} tok   ${entree.sessions} session${entree.sessions > 1 ? 's' : ''}`);
    } else {
      lignes.push(`  ${cible.padEnd(20)}        0 tok   non encore mesuré`);
    }
    return lignes.join('\n');
  }

  // Agrégat tous artefacts (CA-001)
  const entrees = Object.entries(parSpec).map(([id, v]) => ({ id, ...v }));
  entrees.sort((a, b) => b.tokens - a.tokens || a.id.localeCompare(b.id));

  for (const { id, tokens, sessions } of entrees) {
    lignes.push(`  ${id.padEnd(20)} ${String(tokens).padStart(8)} tok   ${sessions} session${sessions > 1 ? 's' : ''}`);
  }

  if (nonAttribues.sessions > 0) {
    lignes.push(`  ${'non attribués'.padEnd(20)} ${String(nonAttribues.tokens).padStart(8)} tok   ${nonAttribues.sessions} session${nonAttribues.sessions > 1 ? 's' : ''}`);
  }

  // Avertissement de couverture (CA-005)
  const totalTokens = entrees.reduce((s, e) => s + e.tokens, 0) + nonAttribues.tokens;
  if (totalTokens > 0 && nonAttribues.tokens / totalTokens > 0.5) {
    lignes.push('');
    lignes.push('  ⚠ Couverture partielle : plus de 50 % des tokens ne sont pas attribués.');
    lignes.push('    Lance aiad-sdd track set <SPEC-ID> avant ta prochaine session.');
  }

  return lignes.join('\n');
}
