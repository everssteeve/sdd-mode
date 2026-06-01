// AIAD SDD Mode — Self-update opt-in (#128).
//
// Vérifie la dernière version publiée sur le registry npm et propose la
// commande d'update. Aucun appel réseau **par défaut** : la fonction est
// strictement opt-in (CLI explicite ou env `AIAD_UPDATE_CHECK=1`), pour
// respecter la souveraineté EU/FR — pas de phone-home silencieux.
//
// Le helper ne lance jamais `npm install` lui-même (les actions modifiantes
// restent du ressort de l'utilisateur). Il affiche la commande à exécuter.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_NAME = 'aiad-sdd';
const REGISTRY = 'https://registry.npmjs.org';

export function lireVersionLocale() {
  try {
    const raw = readFileSync(join(__dirname, '..', 'package.json'), 'utf-8');
    return JSON.parse(raw).version;
  } catch {
    return null;
  }
}

// Récupère la dernière version publiée. Bornée par un timeout pour ne pas
// pendre indéfiniment si le registre est lent ou injoignable.
export async function fetchVersionDistante(opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 3000;
  const url = opts.url || `${REGISTRY}/${PKG_NAME}/latest`;
  // Permet de mocker en test via une fonction d'injection
  const fetchImpl = opts.fetch || globalThis.fetch;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`registry HTTP ${res.status}`);
    const json = await res.json();
    return json.version || null;
  } finally {
    clearTimeout(t);
  }
}

// Comparaison semver minimale (X.Y.Z). Renvoie 1, -1 ou 0.
export function compareSemver(a, b) {
  const pa = String(a || '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

// Façade : retourne `{ locale, distante, status, action }` consommable par
// CLI ou JSON. status: 'up-to-date' | 'update-available' | 'ahead' | 'unknown'.
export async function checkUpdate(opts = {}) {
  const locale = lireVersionLocale();
  let distante = null;
  try { distante = await fetchVersionDistante(opts); }
  catch { return { locale, distante: null, status: 'unknown', action: null, error: 'registry inaccessible' }; }
  if (!locale || !distante) return { locale, distante, status: 'unknown', action: null };
  const cmp = compareSemver(distante, locale);
  if (cmp > 0) {
    return {
      locale, distante,
      status: 'update-available',
      action: `npm install -g aiad-sdd@${distante}`,
    };
  }
  if (cmp < 0) return { locale, distante, status: 'ahead', action: null };
  return { locale, distante, status: 'up-to-date', action: null };
}

// Décide si la vérification doit s'exécuter. Strictement opt-in :
// - flag explicite `--check` ou `--json` sur la CLI → toujours
// - env `AIAD_UPDATE_CHECK=1` → autorise
// - sinon → pas d'appel réseau
export function estAutorise({ explicit = false } = {}) {
  if (explicit) return true;
  return process.env.AIAD_UPDATE_CHECK === '1';
}
