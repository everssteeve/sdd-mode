// AIAD SDD Mode — Internationalisation des messages CLI.
//
// Cap stratégique : **français par défaut** (positionnement leader EU/FR),
// anglais en opt-in via `--lang en` ou `AIAD_LANG=en`. Les artefacts métier
// (Intent, SPEC, PRD, AGENT-GUIDE, gouvernance) restent toujours en
// français — seuls les messages CLI sont internationalisés.
//
// Détection langue (ordre de priorité) :
//   1. Argument CLI `--lang <code>` (passé à setLang()).
//   2. Variable d'env `AIAD_LANG=fr|en`.
//   3. Variable d'env `LANG=fr_FR.UTF-8` ou `LC_ALL=...` (préfixe analysé).
//   4. Défaut : `fr`.
//
// API minimaliste :
//   - `setLang(code)` — force une langue
//   - `getLang()` — code actif
//   - `t(key, vars)` — traduction avec interpolation `{var}`. Fallback sur
//     fr puis sur la clé brute si manquant.
//
// Documentation : https://aiad.ovh

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const I18N_DIR = join(__dirname, 'i18n');

const LANGS_SUPPORTEES = ['fr', 'en'];

let _langActive = null;
const _cache = new Map();

function detectAuto() {
  if (process.env.AIAD_LANG) {
    const code = process.env.AIAD_LANG.slice(0, 2).toLowerCase();
    if (LANGS_SUPPORTEES.includes(code)) return code;
  }
  for (const env of [process.env.LC_ALL, process.env.LANG]) {
    if (!env) continue;
    const code = env.slice(0, 2).toLowerCase();
    if (LANGS_SUPPORTEES.includes(code)) return code;
  }
  return 'fr';
}

function loadMessages(code) {
  if (_cache.has(code)) return _cache.get(code);
  try {
    const path = join(I18N_DIR, `${code}.json`);
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    _cache.set(code, data);
    return data;
  } catch {
    return null;
  }
}

/**
 * Force la langue active. Code valide = `fr` ou `en`. Codes inconnus →
 * fallback sur la détection automatique.
 *
 * @param {string|null} code — `'fr'`, `'en'`, ou null pour auto-détection.
 */
export function setLang(code) {
  if (code && LANGS_SUPPORTEES.includes(code)) {
    _langActive = code;
  } else {
    _langActive = detectAuto();
  }
}

export function getLang() {
  if (!_langActive) _langActive = detectAuto();
  return _langActive;
}

/**
 * Traduit une clé dans la langue active. Interpolation `{var}` depuis
 * l'objet `vars`. Fallback : actif → fr → clé brute.
 *
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 * @returns {string}
 */
export function t(key, vars = {}) {
  const lang = getLang();
  const messages = loadMessages(lang) || loadMessages('fr');
  let template = (messages && messages[key]) || null;
  if (template == null && lang !== 'fr') {
    const fr = loadMessages('fr');
    template = (fr && fr[key]) || null;
  }
  if (template == null) return key;
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

/**
 * Liste les langues disponibles pour le menu CLI.
 *
 * @returns {{ code: string, name: string, default: boolean }[]}
 */
export function listerLangues() {
  return LANGS_SUPPORTEES.map((code) => {
    const m = loadMessages(code);
    const meta = m?._meta || {};
    return { code, name: meta.name || code, default: meta.default === true };
  });
}

// ─── Alias EN canoniques (item #42) ─────────────────────────────────────────
export {
  listerLangues as listLanguages,
};
