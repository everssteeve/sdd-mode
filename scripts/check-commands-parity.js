/**
 * @spec SPEC-033-1-resync-commandes-livrees
 * @intent INTENT-033
 * @verified-by test/check-commands-parity.test.js
 *
 * Parité des commandes et skills : `.claude/` (dépôt) ↔ `templates/.claude/` (livré).
 * `templates/.claude/` est la source unique ; toute divergence fait échouer la CI.
 *
 * node scripts/check-commands-parity.js [--root <path>] [--json]
 * exit 0 → arbres identiques
 * exit 1 → divergence (fichiers listés sur stdout)
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DOSSIERS = ['sdd', 'aiad', 'skills'];

// Fichiers propres au dépôt, exclus du contrôle (chemins relatifs à `.claude/`).
// Vide par défaut — chaque exclusion affaiblit la parité.
export const EXCLUSIONS = [];

function lister(base) {
  if (!existsSync(base)) return [];
  const out = [];
  const parcourir = (dir) => {
    for (const nom of readdirSync(dir)) {
      const chemin = join(dir, nom);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else out.push(relative(base, chemin).split(sep).join('/'));
    }
  };
  parcourir(base);
  return out;
}

export function verifierParite(racine, { exclusions = EXCLUSIONS } = {}) {
  const divergents = [];
  for (const dossier of DOSSIERS) {
    const depot = join(racine, '.claude', dossier);
    const livre = join(racine, 'templates', '.claude', dossier);
    const fichiers = new Set([...lister(depot), ...lister(livre)]);
    for (const f of [...fichiers].sort()) {
      const rel = `${dossier}/${f}`;
      if (exclusions.includes(rel)) continue;
      const a = join(depot, f);
      const b = join(livre, f);
      if (!existsSync(a)) divergents.push({ fichier: rel, motif: 'absent de .claude/' });
      else if (!existsSync(b)) divergents.push({ fichier: rel, motif: 'absent de templates/.claude/' });
      else if (!readFileSync(a).equals(readFileSync(b))) divergents.push({ fichier: rel, motif: 'contenu différent' });
    }
  }
  return { exitCode: divergents.length ? 1 : 0, divergents };
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const rootIdx = process.argv.indexOf('--root');
  const racine = rootIdx >= 0 ? resolve(process.argv[rootIdx + 1]) : resolve(dirname(__filename), '..');
  const result = verifierParite(racine);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.exitCode === 0) {
    console.log(`✓ Parité .claude/ ↔ templates/.claude/ (${DOSSIERS.join(', ')}) : arbres identiques.`);
  } else {
    console.log(`✗ ${result.divergents.length} fichier(s) divergent(s) entre .claude/ et templates/.claude/ :`);
    for (const d of result.divergents) console.log(`  - ${d.fichier} (${d.motif})`);
    console.log('  → Modifier templates/.claude/ (source unique) puis copier dans .claude/.');
  }
  process.exit(result.exitCode);
}
