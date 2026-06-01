// AIAD SDD Mode — Vérification de la reproductibilité du tarball npm.
//
// Le **Cyber Resilience Act EU 2024/2847** et plus largement les standards
// supply-chain (SLSA, NIST SSDF) imposent que les builds soient
// **reproductibles** : le même code doit produire le même artefact, bit
// pour bit, indépendamment de la machine, de l'utilisateur ou du moment.
//
// Le tarball `npm pack` n'est PAS bit-identique entre runs : il intègre
// les mtimes des fichiers, la compression gzip varie selon la version de
// `zlib`, et l'ordre des entrées dépend de l'OS. On contourne cela en
// calculant un **content hash** déterministe :
//   1. `npm pack --dry-run --json` → liste exacte des fichiers du tarball.
//   2. Pour chaque fichier : `sha-256(contenu)` lu depuis le repo source
//      (pas besoin d'extraire l'archive — la liste est fiable).
//   3. Manifest = lignes `<path>:<sha256>:<mode>` triées alphabétiquement.
//   4. Hash final = `sha-256(manifest)`.
//
// Ce hash est **invariant cross-Node, cross-OS, cross-mtime**. Si deux
// machines produisent le même hash, le code packagé est identique.
//
// Documentation : https://aiad.ovh

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { C, log, logHeader } from './term.js';

/**
 * Calcule le content hash déterministe d'un projet npm.
 *
 * @param {string} racine — racine du projet (contient package.json)
 * @returns {{ hash: string, files: { path: string, sha256: string, size: number, mode: number }[] }}
 */
export function computeContentHash(racine) {
  // 1. Liste les fichiers exacts du futur tarball via npm pack --dry-run.
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: racine,
    encoding: 'utf-8',
    // npm écrit parfois des warnings sur stderr → on ignore stderr.
  });
  if (result.status !== 0) {
    throw new Error(`npm pack --dry-run a échoué : ${result.stderr || result.stdout}`);
  }
  const parsed = JSON.parse(result.stdout);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('npm pack --dry-run --json n\'a retourné aucun paquet.');
  }
  const pack = parsed[0];
  if (!Array.isArray(pack.files)) {
    throw new Error('npm pack --dry-run --json : champ `files` absent.');
  }

  // 2. Pour chaque fichier, hash sha-256 du contenu lu depuis le repo.
  const entries = [];
  for (const f of pack.files) {
    const abs = join(racine, f.path);
    const contenu = readFileSync(abs);
    const sha256 = createHash('sha256').update(contenu).digest('hex');
    // mode normalisé : on ne garde que les permissions x (les autres bits
    // varient selon l'OS et ne sont pas significatifs dans le tarball).
    const stat = statSync(abs);
    const mode = stat.mode & 0o111 ? 0o755 : 0o644;
    entries.push({ path: f.path, sha256, size: contenu.length, mode });
  }

  // 3. Tri alphabétique stable.
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // 4. Manifest + hash final.
  const manifest = entries.map((e) => `${e.path}:${e.sha256}:${e.mode.toString(8)}`).join('\n');
  const hash = createHash('sha256').update(manifest).digest('hex');

  return { hash, files: entries };
}

/**
 * Vérifie la reproductibilité du tarball.
 *
 * @param {string} racine
 * @param {{ expected?: string, json?: boolean }} [options]
 * @returns {Promise<{ hash: string, files: object[], match: boolean | null }>}
 */
export async function verifyReproducibility(racine, options = {}) {
  const { expected, json = false } = options;
  const { hash, files } = computeContentHash(racine);
  const match = expected ? hash === expected : null;

  if (json) {
    process.stdout.write(JSON.stringify({ hash, files: files.length, expected: expected || null, match }, null, 2) + '\n');
    return { hash, files, match };
  }

  logHeader(
    'AIAD SDD — Vérification reproductibilité',
    'Content hash déterministe (cross-Node, cross-OS)',
  );

  log('🔒', `Content hash : ${C.cyan}${hash}${C.reset}`);
  log('📦', `Fichiers     : ${C.cyan}${files.length}${C.reset}`);

  if (expected) {
    if (match) {
      console.log(`\n  ${C.vert}✓${C.reset} Reproductibilité confirmée — hash identique à la référence.\n`);
    } else {
      console.log(`\n  ${C.rouge}✗${C.reset} ÉCHEC reproductibilité — hash diverge :`);
      console.log(`    Attendu : ${C.gris}${expected}${C.reset}`);
      console.log(`    Obtenu  : ${C.gris}${hash}${C.reset}\n`);
    }
  } else {
    console.log(`
${C.gris}  Astuce : sauvegarde ce hash en CI puis relance sur Node 18/20/22${C.reset}
${C.gris}  avec --expected <hash> pour confirmer la reproductibilité.${C.reset}
${C.gris}  Référence : Cyber Resilience Act EU 2024/2847, SLSA, NIST SSDF.${C.reset}
`);
  }

  return { hash, files, match };
}
