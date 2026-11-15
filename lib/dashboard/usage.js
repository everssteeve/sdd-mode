// AIAD SDD Mode — Dashboard : mesure d'usage locale.
//
// Le critère de drift d'INTENT-037 est « le dashboard n'est pas utilisé ».
// Pour qu'il soit constatable, le serveur local (`aiad-sdd dashboard --serve`)
// compte les pages consultées, par jour et par onglet, dans
// `.aiad/metrics/dashboard-usage/AAAA-MM.json`.
//
// Ce qui est enregistré : une date (jour), un nombre de vues, l'onglet.
// Ce qui ne l'est pas : adresse IP, navigateur, identité, URL complète, heure.
// Aucune donnée ne quitte la machine. Désactivation : AIAD_DASHBOARD_USAGE=0.
//
// Limite : seul le serveur local mesure. Un dashboard ouvert en fichier
// statique ou publié (GitHub Pages) n'est pas compté — « non mesuré » n'est
// donc jamais interprété comme « non utilisé ».
//
// @intent INTENT-037
// @spec SPEC-037-2-mesure-usage-dashboard
// @verified-by test/dashboard-usage.test.js
// @governance AIAD-RGPD, AIAD-RGESN
//
// Documentation : https://aiad.ovh

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ongletDe } from './navigation.js';

export const SCHEMA_USAGE = 'aiad-sdd-dashboard-usage';
/** Au-delà de ce nombre de jours sans consultation mesurée, le drift est signalé. */
export const SEUIL_INUTILISE_JOURS = 14;

const dossier = (projetDir) => join(projetDir, '.aiad', 'metrics', 'dashboard-usage');
const jourDe = (date) => new Date(date).toISOString().slice(0, 10);

function lireMois(chemin) {
  try {
    const d = JSON.parse(readFileSync(chemin, 'utf-8'));
    return d && typeof d.jours === 'object' && d.jours ? d : { schema: SCHEMA_USAGE, jours: {} };
  } catch {
    return { schema: SCHEMA_USAGE, jours: {} };
  }
}

/**
 * Compte une page consultée. Ne lève jamais : une mesure qui échoue ne doit
 * pas empêcher de servir la page.
 *
 * @param {string} projetDir racine du projet (contient `.aiad/`)
 * @param {string} fichier chemin demandé (`/pe.html`, `index.html`…)
 * @param {{ date?: Date|string|number, env?: Record<string, string|undefined> }} [options]
 * @returns {boolean} true si la vue a été comptée
 */
export function enregistrerVue(projetDir, fichier, options = {}) {
  const env = options.env || process.env;
  if (env.AIAD_DASHBOARD_USAGE === '0') return false;
  const nom = String(fichier || '').split('?')[0].replace(/^\/+/, '');
  if (!/^[\w.-]+\.html$/.test(nom) || nom === '404.html') return false;
  try {
    if (!existsSync(join(projetDir, '.aiad'))) return false;
    const jour = jourDe(options.date ?? Date.now());
    const dir = dossier(projetDir);
    mkdirSync(dir, { recursive: true });
    const chemin = join(dir, `${jour.slice(0, 7)}.json`);
    const mois = lireMois(chemin);
    const j = mois.jours[jour] || { vues: 0, onglets: {} };
    const onglet = ongletDe(nom).id;
    j.vues += 1;
    j.onglets[onglet] = (j.onglets[onglet] || 0) + 1;
    mois.jours[jour] = j;
    writeFileSync(chemin, JSON.stringify({ schema: SCHEMA_USAGE, jours: mois.jours }, null, 2) + '\n', 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Synthèse de l'usage mesuré.
 *
 * @param {string} projetDir
 * @param {{ aujourdhui?: Date|string|number, fenetre?: number }} [options]
 * @returns {{ mesure: boolean, vues: number, joursActifs: number, fenetre: number, derniereVue: string|null, joursDepuis: number|null, parOnglet: Record<string, number>, inutilise: boolean }}
 */
export function lireUsage(projetDir, options = {}) {
  const fenetre = options.fenetre || 30;
  const vide = { mesure: false, vues: 0, joursActifs: 0, fenetre, derniereVue: null, joursDepuis: null, parOnglet: {}, inutilise: false };
  let fichiers = [];
  try { fichiers = readdirSync(dossier(projetDir)).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)); } catch { return vide; }
  const jours = {};
  for (const f of fichiers) Object.assign(jours, lireMois(join(dossier(projetDir), f)).jours);
  const dates = Object.keys(jours).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && jours[d]?.vues > 0).sort();
  if (dates.length === 0) return vide;

  const auj = jourDe(options.aujourdhui ?? Date.now());
  const ecart = (d) => Math.round((Date.parse(auj) - Date.parse(d)) / 86400000);
  const derniereVue = dates[dates.length - 1];
  const joursDepuis = Math.max(0, ecart(derniereVue));
  const recents = dates.filter((d) => ecart(d) >= 0 && ecart(d) < fenetre);
  const parOnglet = {};
  let vues = 0;
  for (const d of recents) {
    vues += jours[d].vues;
    for (const [o, n] of Object.entries(jours[d].onglets || {})) parOnglet[o] = (parOnglet[o] || 0) + n;
  }
  return { mesure: true, vues, joursActifs: recents.length, fenetre, derniereVue, joursDepuis, parOnglet, inutilise: joursDepuis > SEUIL_INUTILISE_JOURS };
}

/** Phrase d'état, pour la CLI et le dashboard. */
export function phraseUsage(usage) {
  if (!usage || !usage.mesure) return 'usage non mesuré — seul `aiad-sdd dashboard --serve` compte les consultations';
  const quand = usage.joursDepuis === 0 ? "aujourd'hui" : `il y a ${usage.joursDepuis} j`;
  return `${usage.vues} page(s) consultée(s) sur ${usage.fenetre} j, ${usage.joursActifs} jour(s) actif(s), dernière consultation ${quand}`;
}
