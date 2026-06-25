// AIAD SDD Mode — Configuration du chaînage automatique conditionnel (INTENT-031).
//
// Lit la clé `auto_chain` dans `.aiad/config.yml` et retourne un objet normalisé.
// Clé absente ou fichier absent → defaults hardcodés (compatibilité descendante, R4 RESEARCH-031).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseYaml } from './org-config.js';

/**
 * Valeurs par défaut : chaînage activé, seuil contexte 40 %.
 * Immuable — modifiable uniquement via une nouvelle SPEC.
 */
const DEFAULTS = Object.freeze({ enabled: true, max_context_pct: 40 });

/**
 * Lit la configuration `auto_chain` depuis `.aiad/config.yml`.
 * Retourne toujours un objet valide — jamais throw, jamais undefined.
 *
 * @intent INTENT-031
 * @spec SPEC-031-3-auto-chain-config
 * @verified-by test/auto-chain-config.test.js
 *
 * @param {string} racine — chemin absolu du projet
 * @returns {{ enabled: boolean, max_context_pct: number }}
 */
export function lireConfigAutoChain(racine) {
  const configPath = join(racine, '.aiad', 'config.yml');
  if (!existsSync(configPath)) return { ...DEFAULTS };

  let parsed;
  try {
    parsed = parseYaml(readFileSync(configPath, 'utf-8'));
  } catch {
    return { ...DEFAULTS };
  }

  const autoChain = parsed?.auto_chain;
  if (!autoChain || typeof autoChain !== 'object') return { ...DEFAULTS };

  const result = { ...DEFAULTS };

  if (typeof autoChain.enabled === 'boolean') {
    result.enabled = autoChain.enabled;
  } else if (autoChain.enabled != null) {
    process.stderr.write('[AIAD] auto_chain.enabled invalide, défaut true\n');
  }

  const pct = autoChain.max_context_pct;
  if (typeof pct === 'number' && Number.isInteger(pct) && pct >= 1 && pct <= 100) {
    result.max_context_pct = pct;
  } else if (pct != null) {
    process.stderr.write('[AIAD] auto_chain.max_context_pct invalide, défaut 40\n');
  }

  return result;
}

// Alias EN
export { lireConfigAutoChain as readAutoChainConfig };
