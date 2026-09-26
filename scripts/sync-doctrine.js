#!/usr/bin/env node
// AIAD SDD Mode — Synchronisation de la doctrine depuis le Drive publié.
//
// @intent INTENT-034
// @spec SPEC-034-1a-sync-doctrine-drive
// @verified-by test/sync-doctrine.test.js
// @governance AIAD-RGESN
//
// Le Drive fait foi (INTENT-034). Ce script (usage mainteneur, hors package)
// copie la version **publiée** de la doctrine (`published/md/`) vers le dépôt :
//   - 4 agents de gouvernance → `templates/.aiad/gouvernance/` ET `.aiad/gouvernance/`
//   - frameworkAIAD.md / SDDMode.md → `templates/`
//   - 4 dossiers de légitimation → `docs/legitimation/`
// soit 14 fichiers cibles. Les chemins relatifs (lien Markdown ou entre accents
// graves) sont réécrits selon la table SPEC §2 : règle 1 (légitimation, avec ou
// sans `../`), règle 2 (agents), sous-cas 1b (fichier présent dans
// `docs/legitimation/` du dépôt cible, liste lue au moment de la sync) et
// règle 3 (mention textuelle, chemins `../` restants).
// L'agent CRA (absent du Drive) n'est ni supprimé ni modifié.
//
// Invariants :
//   - Toutes les sources sont lues, réécrites et la version est extraite AVANT
//     la moindre écriture (cas limites 1–3 → exit 2, rien d'écrit).
//   - `--dry-run` n'écrit rien (ni cibles, ni lock, ni règles émises).
//   - Aucun appel réseau : les URL GitHub ne sont pas résolues.
//
// Écrit ensuite `templates/doctrine.lock.json` (empreintes SHA-256 des 14
// cibles après réécriture — lu par SPEC-034-2) puis régénère les règles
// émises (`emit-rules`), dont `.aiad/gouvernance/` est la source.
//
// Usage :
//   node scripts/sync-doctrine.js --source <chemin published/md> [--dry-run]
//   (ou variable d'environnement AIAD_DOCTRINE_SOURCE)
//   exit 0 : synchronisé · exit 2 : source invalide / fichier manquant / version illisible
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { syncFile } from '../lib/fs-ops.js';
import { emitRules } from '../lib/emit-rules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RACINE = resolve(__dirname, '..');

// ─── Constantes (SPEC-034-1a §2) ────────────────────────────────────────────

export const BASE_URL = 'https://github.com/everssteeve/sdd-mode/blob/main/';

export const DOSSIERS_LEGITIMATION = [
  'conformite-cas-2026',
  'execution-gate-evidence',
  'responsabilite-evidence',
  'verification-evidence',
];

const AGENTS = ['AIAD-AI-ACT', 'AIAD-RGPD', 'AIAD-RGAA', 'AIAD-RGESN'];

/** Correspondances source (relative à `published/md/`) → cibles (relatives au dépôt). */
export const CORRESPONDANCES = [
  ...AGENTS.map((a) => ({
    source: `20_conception/gouvernance/${a}.md`,
    cibles: [`templates/.aiad/gouvernance/${a}.md`, `.aiad/gouvernance/${a}.md`],
  })),
  { source: '20_conception/framework/frameworkAIAD.md', cibles: ['templates/frameworkAIAD.md'] },
  { source: '20_conception/sdd-mode/SDDMode.md', cibles: ['templates/SDDMode.md'] },
  ...DOSSIERS_LEGITIMATION.map((f) => ({
    source: `20_conception/framework/legitimation/${f}.md`,
    cibles: [`docs/legitimation/${f}.md`],
  })),
];

export const FICHIER_VERSION = '20_conception/framework/frameworkAIAD.md';
export const LOCK_PATH = 'templates/doctrine.lock.json';

export const CODE_OK = 0;
export const CODE_ERREUR = 2;

/** Erreur « source invalide / fichier manquant / version illisible » → exit 2. */
export class SyncDoctrineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SyncDoctrineError';
  }
}

// ─── Fonctions pures (testables, réutilisables par SPEC-034-2) ─────────────

/**
 * Applique la table de réécriture à un chemin relatif (sans fragment).
 * Première règle qui s'applique :
 *   1.  `[…/]legitimation/<f>.md` (f ∈ dossiers synchronisés), avec ou sans
 *       préfixe `../`                                   → URL docs/legitimation/
 *   2.  `../…/gouvernance/AIAD-<X>.md`                  → URL templates/.aiad/gouvernance/
 *   1b. `../…/<nom>` avec <nom> présent dans `docs/legitimation/` du dépôt
 *       cible (`legitimationLocale`)                    → URL docs/legitimation/<nom>
 *   3.  toute autre cible `../…`                        → mention textuelle
 * Un chemin sans `../` qui ne relève pas de la règle 1 renvoie `regle: null`
 * (laissé intact : noms nus, `./voisin.md`, fichiers projet…).
 *
 * @param {string} chemin
 * @param {{ legitimationLocale?: Iterable<string> }} [options]
 *   noms de fichiers (`x.md`) présents dans `docs/legitimation/` du dépôt cible
 * @returns {{ regle: 1|2|'1b'|3|null, url?: string, nom: string }}
 */
export function classerChemin(chemin, options = {}) {
  const nom = basename(chemin);
  const legit = chemin.match(/(?:^|\/)legitimation\/([^/]+)\.md$/);
  if (legit && DOSSIERS_LEGITIMATION.includes(legit[1])) {
    return { regle: 1, url: `${BASE_URL}docs/legitimation/${legit[1]}.md`, nom };
  }
  if (!chemin.startsWith('../')) return { regle: null, nom };
  const gouv = chemin.match(/(?:^|\/)gouvernance\/(AIAD-[^/]+)\.md$/);
  if (gouv) {
    return { regle: 2, url: `${BASE_URL}templates/.aiad/gouvernance/${gouv[1]}.md`, nom };
  }
  const locale = new Set(options.legitimationLocale || []);
  if (locale.has(nom)) {
    return { regle: '1b', url: `${BASE_URL}docs/legitimation/${nom}`, nom };
  }
  return { regle: 3, nom };
}

// Candidats : un chemin `../…` (pas d'espace, de parenthèse fermante ni
// d'accent grave) OU un chemin relatif sans `../` se terminant par
// `legitimation/<f>.md` (règle 1 étendue). Une URL (`https://…`) n'est jamais
// candidate (le `:` est exclu des segments). Fragment `#ancre` optionnel,
// conservé pour les réécritures en URL.
const CHEMIN = String.raw`(\.\.\/[^)\s#\x60]*|(?:[\w.-]+\/)*legitimation\/[\w.-]+\.md)`;
const LIEN_MD_RE = new RegExp(String.raw`\[([^\]\n]*)\]\(${CHEMIN}(#[^)\s]*)?\)`, 'g');
const CODE_RE = new RegExp(String.raw`\x60${CHEMIN}(#[^\x60\s]*)?\x60`, 'g');

/**
 * Réécrit les chemins relatifs d'un contenu Markdown (table SPEC §2).
 *
 * @param {string} contenu
 * @param {{ legitimationLocale?: Iterable<string> }} [options] cf. `classerChemin`
 * @returns {{ contenu: string, reecritures: Array<{ forme: 'lien'|'code', regle: 1|2|'1b'|3, avant: string, apres: string }> }}
 */
export function reecrireChemins(contenu, options = {}) {
  const reecritures = [];

  let sortie = contenu.replace(LIEN_MD_RE, (tout, texte, chemin, ancre = '') => {
    const c = classerChemin(chemin, options);
    if (c.regle === null) return tout;
    const apres = c.regle === 3 ? texte : `[${texte}](${c.url}${ancre})`;
    reecritures.push({ forme: 'lien', regle: c.regle, avant: tout, apres });
    return apres;
  });

  sortie = sortie.replace(CODE_RE, (tout, chemin, ancre = '') => {
    const c = classerChemin(chemin, options);
    if (c.regle === null) return tout;
    const apres = c.regle === 3
      ? `\`${c.nom}\` (document publié avec le framework AIAD)`
      : `\`${c.url}${ancre}\``;
    reecritures.push({ forme: 'code', regle: c.regle, avant: tout, apres });
    return apres;
  });

  return { contenu: sortie, reecritures };
}

/**
 * Noms des fichiers `.md` présents dans `docs/legitimation/` du dépôt cible,
 * lus au moment de la synchronisation (triés — déterministe pour un état du
 * dépôt donné), unis aux quatre dossiers synchronisés (présents après sync).
 *
 * @param {string} racine
 * @returns {string[]}
 */
export function listerLegitimationLocale(racine) {
  const dossier = join(racine, 'docs', 'legitimation');
  const noms = new Set(DOSSIERS_LEGITIMATION.map((f) => `${f}.md`));
  if (existsSync(dossier)) {
    for (const n of readdirSync(dossier)) if (n.endsWith('.md')) noms.add(n);
  }
  return [...noms].sort();
}

/**
 * Extrait la version de doctrine du titre H1 de `frameworkAIAD.md`
 * (motif `Framework v<X.Y>`).
 *
 * @param {string} contenu
 * @returns {string} ex. `v1.9`
 * @throws {SyncDoctrineError} si pas de H1 ou motif absent
 */
export function lireVersionDoctrine(contenu) {
  const h1 = contenu.split(/\r?\n/).find((l) => /^#\s/.test(l));
  const m = h1 && h1.match(/Framework v(\d+\.\d+)\b/);
  if (!m) {
    throw new SyncDoctrineError(
      `Version de doctrine illisible : le titre H1 de frameworkAIAD.md ne contient pas « Framework v<X.Y> » (lu : ${h1 ? `« ${h1.trim()} »` : 'aucun H1'}).`,
    );
  }
  return `v${m[1]}`;
}

/** Empreinte SHA-256 (hex) d'un contenu. */
export function empreinte(contenu) {
  return createHash('sha256').update(contenu, 'utf-8').digest('hex');
}

/**
 * Construit l'objet `doctrine.lock.json`.
 *
 * @param {string} version
 * @param {Record<string, string>} contenusParCible
 * @param {Date} [maintenant]
 */
export function construireLock(version, contenusParCible, maintenant = new Date()) {
  const files = {};
  for (const [cible, contenu] of Object.entries(contenusParCible)) files[cible] = empreinte(contenu);
  return { doctrineVersion: version, syncedAt: maintenant.toISOString(), files };
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Prépare la synchronisation sans rien écrire : vérifie la source, lit et
 * réécrit tous les fichiers, extrait la version. Lève `SyncDoctrineError`.
 *
 * @param {string|undefined} source racine `published/md/`
 * @param {{ legitimationLocale?: Iterable<string> }} [options] cf. `classerChemin`
 * @returns {{ version: string, plan: Array<{ source: string, cibles: string[], contenu: string, reecritures: object[] }> }}
 */
export function preparerSync(source, options = {}) {
  if (!source) {
    throw new SyncDoctrineError('Source absente : fournir --source <chemin published/md> ou AIAD_DOCTRINE_SOURCE.');
  }
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    throw new SyncDoctrineError(`Source introuvable ou n'est pas un dossier : ${source}`);
  }
  const manquants = CORRESPONDANCES
    .map((c) => c.source)
    .filter((s) => !existsSync(join(source, s)));
  if (manquants.length) {
    throw new SyncDoctrineError(`Fichier(s) source manquant(s) :\n    - ${manquants.join('\n    - ')}`);
  }

  const version = lireVersionDoctrine(readFileSync(join(source, FICHIER_VERSION), 'utf-8'));
  const plan = CORRESPONDANCES.map((c) => {
    const brut = readFileSync(join(source, c.source), 'utf-8');
    const { contenu, reecritures } = reecrireChemins(brut, options);
    return { source: c.source, cibles: c.cibles, contenu, reecritures };
  });
  return { version, plan };
}

async function emettreRegles(racine) {
  await emitRules(racine, { runtimes: ['all'] });
}

/**
 * Synchronise la doctrine vers `racine`.
 *
 * @param {{ source?: string, racine?: string, dryRun?: boolean,
 *           emit?: false | ((racine: string) => Promise<void>|void),
 *           maintenant?: Date, log?: (msg: string) => void }} options
 * @returns {Promise<{ version: string, ecrits: string[], inchanges: string[],
 *                     reecritures: { 1: number, '1b': number, 2: number, 3: number }, lock: object|null }>}
 */
export async function syncDoctrine(options = {}) {
  const {
    source,
    racine = RACINE,
    dryRun = false,
    emit = emettreRegles,
    maintenant = new Date(),
    log = (m) => console.log(m),
  } = options;

  // Liste lue dans le dépôt cible AVANT toute écriture (déterministe).
  const legitimationLocale = listerLegitimationLocale(racine);
  const { version, plan } = preparerSync(source, { legitimationLocale }); // lève avant toute écriture

  const reecritures = { 1: 0, '1b': 0, 2: 0, 3: 0 };
  const contenusParCible = {};
  const ecrits = [];
  const inchanges = [];

  log(`\n  AIAD — sync-doctrine${dryRun ? ' (--dry-run)' : ''} · doctrine ${version}\n`);

  for (const etape of plan) {
    for (const r of etape.reecritures) {
      reecritures[r.regle] += etape.cibles.length;
      if (dryRun) log(`    ~ ${etape.source} [règle ${r.regle}] ${r.avant}  →  ${r.apres}`);
    }
    for (const cible of etape.cibles) {
      contenusParCible[cible] = etape.contenu;
      const etat = syncFile(join(racine, cible), etape.contenu, { dryRun });
      if (etat === 'unchanged') inchanges.push(cible);
      else ecrits.push(cible);
      log(`  ${etat === 'unchanged' ? '✓' : dryRun ? '~' : '↑'} ${cible}${etat === 'unchanged' ? ' (à jour)' : dryRun ? ' (serait écrit)' : ''}`);
    }
  }

  if (dryRun) {
    log(`\n  ${LOCK_PATH} (serait écrit) · règles émises (seraient régénérées)`);
    log(`  Dry-run : ${ecrits.length} fichier(s) seraient écrits, réécritures règle 1/1b/2/3 : ${reecritures[1]}/${reecritures['1b']}/${reecritures[2]}/${reecritures[3]}. Aucune écriture.\n`);
    return { version, ecrits, inchanges, reecritures, lock: null };
  }

  const lock = construireLock(version, contenusParCible, maintenant);
  syncFile(join(racine, LOCK_PATH), `${JSON.stringify(lock, null, 2)}\n`);
  log(`  ↑ ${LOCK_PATH}`);

  if (emit) await emit(racine);

  log(`\n  ✓ Doctrine ${version} synchronisée : ${ecrits.length} fichier(s) écrit(s), ${inchanges.length} à jour ; réécritures règle 1/1b/2/3 : ${reecritures[1]}/${reecritures['1b']}/${reecritures[2]}/${reecritures[3]}.\n`);
  return { version, ecrits, inchanges, reecritures, lock };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

/**
 * @param {string[]} argv
 * @param {{ racine?: string, env?: NodeJS.ProcessEnv, emit?: false | Function }} [ctx]
 * @returns {Promise<number>} code de sortie
 */
export async function main(argv = process.argv.slice(2), ctx = {}) {
  const env = ctx.env || process.env;
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { source: { type: 'string' }, 'dry-run': { type: 'boolean' } },
      strict: true,
    }));
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
    return CODE_ERREUR;
  }
  try {
    await syncDoctrine({
      source: values.source || env.AIAD_DOCTRINE_SOURCE,
      racine: ctx.racine,
      dryRun: Boolean(values['dry-run']),
      ...(ctx.emit !== undefined ? { emit: ctx.emit } : {}),
    });
    return CODE_OK;
  } catch (e) {
    if (e instanceof SyncDoctrineError) {
      console.error(`\n  ✗ ${e.message}\n  Aucun fichier écrit.\n`);
      return CODE_ERREUR;
    }
    throw e;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}
