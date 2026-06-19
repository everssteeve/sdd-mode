// AIAD SDD Mode — Cycle de dépréciation soft des commandes CLI.
//
// @intent INTENT-015
// @spec SPEC-015-2-2-cycle-depreciation
// @verified-by test/deprecation.test.js
// @governance AIAD-RGESN
//
// Mécanisme « soft » (condition C2 de RESEARCH-017) : une commande marquée
// `status: 'deprecated'` dans `lib/commands-registry.js` déclenche un
// avertissement non bloquant sur **stderr** au dispatch, puis s'exécute
// normalement (phase warning v1.x → retrait v2). Aucune rupture.
//
// Livré **dormant** : aucune commande n'est dépréciée à ce stade (la première
// dépréciation concrète est une décision humaine séparée — Human Authorship,
// et cohérent avec C-DATA : pas de dépréciation guidée par la donnée d'usage
// polluée). Sobriété (RGESN) : module pur, zéro dépendance, zéro I/O propre.
//
// Documentation : https://aiad.ovh

import { COMMANDS_REGISTRY } from './commands-registry.js';

/**
 * Construit le message d'avertissement d'une entrée dépréciée.
 *
 * @param {{ command: string, deprecatedSince?: string, removeIn?: string, replacement?: string }} entry
 * @returns {string}
 */
export function formatDeprecationNotice(entry) {
  const since = entry.deprecatedSince || '?';
  const removeIn = entry.removeIn || '?';
  let msg = `⚠ ${entry.command} est dépréciée depuis ${since}, retrait prévu en ${removeIn}.`;
  if (entry.replacement) msg += ` Utilise ${entry.replacement}.`;
  return msg;
}

/**
 * Message de dépréciation d'une commande, ou `null` si elle est active ou
 * absente du registre.
 *
 * @param {string} command
 * @returns {string | null}
 */
export function deprecationNotice(command) {
  const entry = COMMANDS_REGISTRY.find((e) => e.command === command);
  if (!entry || entry.status !== 'deprecated') return null;
  return formatDeprecationNotice(entry);
}

/**
 * Émet un avertissement de dépréciation s'il est non `null`. No-op sinon.
 * Écrit sur stderr par défaut — jamais stdout, pour ne pas polluer `--json`.
 *
 * @param {string | null} notice
 * @param {(s: string) => void} [write]
 * @returns {boolean} vrai si un message a été émis
 */
export function emitDeprecation(notice, write = (s) => process.stderr.write(s)) {
  if (!notice) return false;
  write(notice + '\n');
  return true;
}

/**
 * Valide qu'une entrée dépréciée porte les champs requis (`deprecatedSince`,
 * `removeIn` non vides). Les entrées actives sont valides d'office.
 *
 * @param {{ status?: string, deprecatedSince?: string, removeIn?: string }} entry
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateDeprecation(entry) {
  if (!entry || entry.status !== 'deprecated') return { valid: true };
  if (!entry.deprecatedSince || !entry.removeIn) {
    return { valid: false, reason: 'une entrée dépréciée exige deprecatedSince et removeIn non vides' };
  }
  return { valid: true };
}
