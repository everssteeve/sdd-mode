// AIAD SDD Mode — Synchronisation de version sur zones marquées.
//
// @intent INTENT-013
// @spec SPEC-013-3-sync-version-zones-marquees
// @verified-by test/version-sync.test.js
// @governance AIAD-RGESN
//
// Garantit mécaniquement que toute version affichée dans une zone marquée
//   <!--VERSION:START-->…<!--VERSION:END-->
// reste égale à `package.json`. Conditions RESEARCH-013 :
//   - C1 : seules les zones marquées sont touchées ; la prose narrative (hors
//     marqueurs) n'est JAMAIS modifiée ni analysée — pas de falsification de
//     l'historique (changelog, « depuis v1.x »).
//   - C2 : le mode `--check` compare uniquement ces zones à `package.json`
//     (exit 1 sur écart), consommable en CI.
//
// Motif réutilisé : `lib/docs.js` / `lib/emit-rules.js` (lecture version,
// `syncFile`, `--check`).
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { C, log, logHeader } from './term.js';
import { syncFile } from './fs-ops.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

export const MARKER_START = '<!--VERSION:START-->';
export const MARKER_END = '<!--VERSION:END-->';

// Capture le contenu entre sentinelles (non greedy) — valable en Markdown + HTML.
const ZONE_RE = /<!--VERSION:START-->([\s\S]*?)<!--VERSION:END-->/g;

// Racines scannées par défaut : le site (surface d'affichage public). On NE
// scanne PAS `.aiad/` ni `templates/` : leurs SPECs/docs contiennent des
// exemples littéraux de marqueurs qu'il ne faut jamais réécrire.
const DEFAULT_ROOTS = ['site'];
const EXT_SCAN = new Set(['.md', '.html', '.htm']);

export function lirePackageVersion(racine = ROOT) {
  return JSON.parse(readFileSync(join(racine, 'package.json'), 'utf-8')).version;
}

/**
 * Erreur levée quand les sentinelles sont mal appariées (START sans END,
 * END sans START, ou END avant START). Aucune écriture n'est tentée.
 */
export class MarkerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MarkerError';
  }
}

/**
 * Vérifie l'appariement des sentinelles et renvoie le nombre de zones bien
 * formées. Lève `MarkerError` si une sentinelle est orpheline ou mal ordonnée.
 *
 * @param {string} contenu
 * @returns {number} nombre de zones valides
 */
export function compterZones(contenu) {
  const starts = (contenu.match(/<!--VERSION:START-->/g) || []).length;
  const ends = (contenu.match(/<!--VERSION:END-->/g) || []).length;
  const appariees = (contenu.match(ZONE_RE) || []).length;
  if (starts !== ends || appariees !== starts) {
    throw new MarkerError(
      `Sentinelles VERSION mal appariées (START=${starts}, END=${ends}, paires=${appariees})`,
    );
  }
  return appariees;
}

/**
 * Remplace le contenu de chaque zone marquée par `version`. Ne touche RIEN en
 * dehors des sentinelles (C1). Idempotent.
 *
 * @param {string} contenu
 * @param {string} version
 * @returns {{ contenu: string, zones: number, modifie: boolean }}
 */
export function appliquerVersion(contenu, version) {
  const zones = compterZones(contenu); // lève MarkerError si mal formé
  const nouveau = contenu.replace(ZONE_RE, `${MARKER_START}${version}${MARKER_END}`);
  return { contenu: nouveau, zones, modifie: nouveau !== contenu };
}

// ─── Découverte de fichiers ─────────────────────────────────────────────────

function marche(dir, acc) {
  let entrees;
  try {
    entrees = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entrees) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      marche(p, acc);
    } else {
      const pt = e.name.slice(e.name.lastIndexOf('.'));
      if (EXT_SCAN.has(pt)) acc.push(p);
    }
  }
  return acc;
}

/**
 * Liste les fichiers scannables contenant au moins une sentinelle de version,
 * sous les racines fournies (défaut : `site/`).
 *
 * @param {string} racine
 * @param {{ roots?: string[] }} [options]
 * @returns {string[]} chemins absolus
 */
export function decouvrirFichiers(racine, options = {}) {
  const roots = options.roots || DEFAULT_ROOTS;
  const candidats = [];
  for (const r of roots) {
    const base = join(racine, r);
    if (!existsSync(base)) continue;
    if (statSync(base).isDirectory()) marche(base, candidats);
    else candidats.push(base);
  }
  return candidats.filter((f) => readFileSync(f, 'utf-8').includes(MARKER_START));
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Synchronise (ou vérifie) les zones de version marquées sous `racine`.
 *
 * @param {string} racine
 * @param {{ check?: boolean, dryRun?: boolean, roots?: string[] }} [options]
 * @returns {{ ok: boolean, drift: boolean, version: string,
 *             fichiers: number, zones: number, ecarts: string[] }}
 */
export function versionSync(racine, options = {}) {
  const { check = false, dryRun = false, roots } = options;
  const version = lirePackageVersion(racine);
  const fichiers = decouvrirFichiers(racine, { roots });

  logHeader(
    `AIAD SDD Mode — Version sync${check ? ' (--check)' : dryRun ? ' (--dry-run)' : ''}`,
    `version : ${version}`,
  );

  let totalZones = 0;
  const ecarts = [];
  let modifies = 0;

  for (const f of fichiers) {
    const rel = relative(racine, f);
    const avant = readFileSync(f, 'utf-8');
    let res;
    try {
      res = appliquerVersion(avant, version);
    } catch (e) {
      if (e instanceof MarkerError) {
        log(`${C.rouge}✗${C.reset}`, `${rel} — ${e.message}`);
        ecarts.push(rel);
        continue;
      }
      throw e;
    }
    totalZones += res.zones;

    if (res.modifie) {
      ecarts.push(rel);
      if (check) {
        log(`${C.rouge}✗${C.reset}`, `${rel} (${res.zones} zone(s) désynchronisée(s))`);
      } else if (dryRun) {
        log(`${C.cyan}~${C.reset}`, `${rel} → ${version} (${res.zones} zone(s), dry-run)`);
      } else {
        syncFile(f, res.contenu);
        modifies += 1;
        log(`${C.cyan}↑${C.reset}`, `${rel} (${res.zones} zone(s) → ${version})`);
      }
    } else {
      log(`${C.vert}✓${C.reset}`, `${rel} (${res.zones} zone(s) à jour)`);
    }
  }

  const drift = ecarts.length > 0;

  if (check) {
    if (drift) {
      console.log(`
${C.rouge}${C.gras}  ✗ Versions désynchronisées dans ${ecarts.length} fichier(s) — écart vs package.json (${version}).${C.reset}
${C.gris}  Corrige avec :  ${C.reset}${C.cyan}npx aiad-sdd version-sync${C.reset}
`);
    } else {
      console.log(`\n${C.vert}${C.gras}  ✓ Versions synchronisées (${totalZones} zone(s), ${fichiers.length} fichier(s)).${C.reset}\n`);
    }
  } else if (!dryRun) {
    console.log(`\n${C.vert}${C.gras}  ✓ ${modifies} fichier(s) mis à jour · ${totalZones} zone(s) → v${version}.${C.reset}\n`);
  }

  return {
    ok: check ? !drift : true,
    drift,
    version,
    fichiers: fichiers.length,
    zones: totalZones,
    ecarts,
  };
}
