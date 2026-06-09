// AIAD SDD Mode — Règles à durée de vie limitée (garde-fou GF5, §4).
//
// **Cap stratégique** : « prévoir des règles qui se suppriment ». Les
// best-practices changent à chaque modèle (l'analyse note : « plan mode sera
// *unship* » ; « à relire à chaque montée de version majeure »). Une règle ou
// une skill SDD qui pallie une lacune du modèle doit porter une **métadonnée
// d'obsolescence** — pour qu'on la retire quand le modèle n'en a plus besoin,
// au lieu de l'accumuler en échafaudage mort (anti dock rot doctrinal).
//
// Conventions de frontmatter acceptées :
//   - `sunset_when: "le modèle pose nativement les annotations"`  (condition libre)
//   - `review_at: v2.2.0`  (version Claude Code à laquelle réexaminer)
//
// `scannerSunset` parcourt skills + rules + gouvernance et signale les
// candidates : `review_at` atteint par la version courante, ou `sunset_when`
// présent (à réexaminer). Consommé par `aiad-sdd doctor` / `/aiad health`.
//
// **Zero-dep**.
//
// @intent INTENT-012
// @spec SPEC-012-1-garde-fous
// @verified-by test/sunset.test.js
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';

/** Emplacements scannés (relatifs à la racine projet). */
const SOURCES = [
  { dir: ['.claude', 'skills'], kind: 'skill', fichier: 'SKILL.md' },
  { dir: ['.claude', 'rules'], kind: 'rule' },
  { dir: ['.aiad', 'gouvernance'], kind: 'gouvernance' },
];

/**
 * Compare deux versions sémantiques `vX.Y.Z` (ou `X.Y.Z`). Retourne -1/0/1.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function comparerVersions(a, b) {
  const norm = (v) => String(v || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const [a1, a2, a3] = norm(a);
  const [b1, b2, b3] = norm(b);
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  if (a2 !== b2) return a2 < b2 ? -1 : 1;
  if (a3 !== b3) return a3 < b3 ? -1 : 1;
  return 0;
}

/**
 * Détermine si une entrée est candidate au retrait/réexamen.
 *
 * @param {{ sunset_when?: string, review_at?: string }} frontmatter
 * @param {string} versionCourante
 * @returns {{ candidate: boolean, raison: string }}
 */
export function estCandidate(frontmatter, versionCourante) {
  const sw = frontmatter.sunset_when;
  const ra = frontmatter.review_at;
  if (ra && comparerVersions(ra, versionCourante) <= 0) {
    return { candidate: true, raison: `review_at ${ra} atteint (version courante ${versionCourante}).` };
  }
  if (sw) {
    return { candidate: true, raison: `sunset_when : « ${sw} » — à réexaminer.` };
  }
  return { candidate: false, raison: '' };
}

/**
 * Scanne skills + rules + gouvernance et liste les entrées portant une
 * métadonnée d'obsolescence + leur statut candidate.
 *
 * @param {string} racine
 * @param {{ versionCourante?: string }} [opts]
 * @returns {{ kind: string, nom: string, sunset_when: string|null, review_at: string|null, candidate: boolean, raison: string }[]}
 */
export function scannerSunset(racine, { versionCourante = '0.0.0' } = {}) {
  const out = [];
  for (const src of SOURCES) {
    const dir = join(racine, ...src.dir);
    if (!existsSync(dir)) continue;
    for (const entree of readdirSync(dir)) {
      let path;
      let nom;
      if (src.fichier) {
        // skills : un dossier par skill contenant SKILL.md.
        const candidat = join(dir, entree, src.fichier);
        if (!existsSync(candidat)) continue;
        path = candidat;
        nom = entree;
      } else {
        if (!entree.endsWith('.md') || entree.startsWith('_')) continue;
        path = join(dir, entree);
        nom = entree.replace(/\.md$/, '');
      }
      let contenu;
      try {
        if (!statSync(path).isFile()) continue;
        contenu = readFileSync(path, 'utf-8');
      } catch { continue; }
      const { data } = parseFrontmatter(contenu);
      if (!data.sunset_when && !data.review_at) continue; // pas de métadonnée → ignoré
      const c = estCandidate(data, versionCourante);
      out.push({
        kind: src.kind,
        nom,
        sunset_when: data.sunset_when || null,
        review_at: data.review_at || null,
        candidate: c.candidate,
        raison: c.raison,
      });
    }
  }
  return out;
}

// ─── Aliases EN ─────────────────────────────────────────────────────────────

export {
  comparerVersions as compareVersions,
  estCandidate as isCandidate,
  scannerSunset as scanSunset,
};
