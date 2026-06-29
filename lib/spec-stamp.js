/**
 * @intent INTENT-027
 * @spec SPEC-027-1-stamp-validated-at
 * @verified-by test/spec-stamp.test.js
 * @governance AIAD-RGESN
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter.js';

const SPEC_DIRS = [
  ['.aiad', 'specs'],
  ['.aiad', 'specs', 'archive'],
];

function trouverFichierSpec(racineProjet, specId) {
  for (const segments of SPEC_DIRS) {
    const dir = join(racineProjet, ...segments);
    let fichiers;
    try {
      fichiers = readdirSync(dir);
    } catch {
      continue;
    }
    const match = fichiers.find((f) => f.startsWith(specId) && f.endsWith('.md'));
    if (match) return join(dir, match);
  }
  return null;
}

/**
 * Stamps `validated_at` (ISO 8601 UTC) into the frontmatter of the given SPEC.
 * Idempotent: overwrites any existing `validated_at` value.
 *
 * @param {string} racineProjet - Project root directory
 * @param {string} specId - SPEC ID prefix (e.g. "SPEC-027-1")
 * @returns {{ fichier: string, validatedAt: string }}
 */
export function stampValidatedAt(racineProjet, specId) {
  const fichier = trouverFichierSpec(racineProjet, specId);
  if (!fichier) {
    const err = new Error(`SPEC "${specId}" introuvable dans .aiad/specs/ ni dans .aiad/specs/archive/`);
    err.code = 'SPEC_NOT_FOUND';
    throw err;
  }

  const contenu = readFileSync(fichier, 'utf8');
  const { data, body } = parseFrontmatter(contenu);

  if (Object.keys(data).length === 0) {
    const err = new Error(`Frontmatter absent ou illisible dans ${fichier}`);
    err.code = 'NO_FRONTMATTER';
    throw err;
  }

  const validatedAt = new Date().toISOString();
  data.validated_at = validatedAt;

  writeFileSync(fichier, stringifyFrontmatter(data) + body, 'utf8');

  return { fichier, validatedAt };
}
