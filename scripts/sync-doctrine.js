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
// soit 14 fichiers cibles. Les chemins relatifs `../` (lien Markdown ou entre
// accents graves) sont réécrits selon une table à trois règles (cf. SPEC §2).
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

import { existsSync, readFileSync, statSync } from 'node:fs';
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
 * Applique la table de réécriture à un chemin `../…` (sans fragment).
 * Première règle qui s'applique :
 *   1. `…/legitimation/<f>.md` (f ∈ dossiers synchronisés) → URL docs/legitimation/
 *   2. `…/gouvernance/AIAD-<X>.md`                          → URL templates/.aiad/gouvernance/
 *   3. toute autre cible                                     → mention textuelle
 *
 * @param {string} chemin
 * @returns {{ regle: 1|2|3, url?: string, nom: string }}
 */
export function classerChemin(chemin) {
  const nom = basename(chemin);
  const legit = chemin.match(/(?:^|\/)legitimation\/([^/]+)\.md$/);
  if (legit && DOSSIERS_LEGITIMATION.includes(legit[1])) {
    return { regle: 1, url: `${BASE_URL}docs/legitimation/${legit[1]}.md`, nom };
  }
  const gouv = chemin.match(/(?:^|\/)gouvernance\/(AIAD-[^/]+)\.md$/);
  if (gouv) {
    return { regle: 2, url: `${BASE_URL}templates/.aiad/gouvernance/${gouv[1]}.md`, nom };
  }
  return { regle: 3, nom };
}

// Chemin `../…` : pas d'espace, pas de parenthèse fermante, pas d'accent grave ;
// fragment `#ancre` optionnel conservé pour les règles 1–2.
const LIEN_MD_RE = /\[([^\]\n]*)\]\((\.\.\/[^)\s#`]*)(#[^)\s]*)?\)/g;
const CODE_RE = /`(\.\.\/[^`\s#]*)(#[^`\s]*)?`/g;

/**
 * Réécrit tous les chemins relatifs `../` d'un contenu Markdown.
 *
 * @param {string} contenu
 * @returns {{ contenu: string, reecritures: Array<{ forme: 'lien'|'code', regle: 1|2|3, avant: string, apres: string }> }}
 */
export function reecrireChemins(contenu) {
  const reecritures = [];

  let sortie = contenu.replace(LIEN_MD_RE, (tout, texte, chemin, ancre = '') => {
    const c = classerChemin(chemin);
    const apres = c.regle === 3 ? texte : `[${texte}](${c.url}${ancre})`;
    reecritures.push({ forme: 'lien', regle: c.regle, avant: tout, apres });
    return apres;
  });

  sortie = sortie.replace(CODE_RE, (tout, chemin, ancre = '') => {
    const c = classerChemin(chemin);
    const apres = c.regle === 3
      ? `\`${c.nom}\` (document publié avec le framework AIAD)`
      : `\`${c.url}${ancre}\``;
    reecritures.push({ forme: 'code', regle: c.regle, avant: tout, apres });
    return apres;
  });

  return { contenu: sortie, reecritures };
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
 * @returns {{ version: string, plan: Array<{ source: string, cibles: string[], contenu: string, reecritures: object[] }> }}
 */
export function preparerSync(source) {
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
    const { contenu, reecritures } = reecrireChemins(brut);
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
 *                     reecritures: { 1: number, 2: number, 3: number }, lock: object|null }>}
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

  const { version, plan } = preparerSync(source); // lève avant toute écriture

  const reecritures = { 1: 0, 2: 0, 3: 0 };
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
    log(`  Dry-run : ${ecrits.length} fichier(s) seraient écrits, réécritures règle 1/2/3 : ${reecritures[1]}/${reecritures[2]}/${reecritures[3]}. Aucune écriture.\n`);
    return { version, ecrits, inchanges, reecritures, lock: null };
  }

  const lock = construireLock(version, contenusParCible, maintenant);
  syncFile(join(racine, LOCK_PATH), `${JSON.stringify(lock, null, 2)}\n`);
  log(`  ↑ ${LOCK_PATH}`);

  if (emit) await emit(racine);

  log(`\n  ✓ Doctrine ${version} synchronisée : ${ecrits.length} fichier(s) écrit(s), ${inchanges.length} à jour ; réécritures règle 1/2/3 : ${reecritures[1]}/${reecritures[2]}/${reecritures[3]}.\n`);
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
