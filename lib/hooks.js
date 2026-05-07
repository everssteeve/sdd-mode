import { existsSync, mkdirSync, writeFileSync, readFileSync, chmodSync, copyFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

const C = {
  vert: '\x1b[32m',
  jaune: '\x1b[33m',
  rouge: '\x1b[31m',
  cyan: '\x1b[36m',
  gris: '\x1b[90m',
  gras: '\x1b[1m',
  reset: '\x1b[0m',
};

function log(symbole, message) {
  console.log(`  ${symbole} ${message}`);
}

function detecterHusky(projetDir) {
  if (existsSync(join(projetDir, '.husky'))) return true;
  const pkgPath = join(projetDir, 'package.json');
  if (!existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    return Boolean(deps.husky);
  } catch {
    return false;
  }
}

function copierHook(projetDir) {
  const source = join(TEMPLATES_DIR, '.aiad', 'hooks', 'pre-commit.sh');
  const dest = join(projetDir, '.aiad', 'hooks', 'pre-commit.sh');

  if (!existsSync(source)) {
    throw new Error(`Template pre-commit.sh introuvable : ${source}`);
  }

  const destDir = dirname(dest);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  // Toujours réécrire pour rester aligné avec le package.
  copyFileSync(source, dest);
  chmodSync(dest, 0o755);
  return dest;
}

function ecrireConfigSiAbsente(projetDir) {
  const dest = join(projetDir, '.aiad', 'config.yml');
  if (existsSync(dest)) return false;
  const source = join(TEMPLATES_DIR, '.aiad', 'config.yml');
  if (!existsSync(source)) return false;
  copyFileSync(source, dest);
  return true;
}

function ecrireBypassSiAbsent(projetDir) {
  const dest = join(projetDir, '.aiad', 'hook-bypass.yml');
  if (existsSync(dest)) return false;
  const source = join(TEMPLATES_DIR, '.aiad', 'hook-bypass.yml');
  if (!existsSync(source)) return false;
  copyFileSync(source, dest);
  return true;
}

function installerHusky(projetDir) {
  const huskyDir = join(projetDir, '.husky');
  if (!existsSync(huskyDir)) {
    mkdirSync(huskyDir, { recursive: true });
  }
  const dest = join(huskyDir, 'pre-commit');
  const wrapper = `#!/usr/bin/env sh
# AIAD SDD Mode — pre-commit (Husky entrypoint)
# Délègue au hook versionné dans .aiad/hooks/.
. "$(dirname -- "$0")/_/husky.sh" 2>/dev/null || true
exec "$(git rev-parse --show-toplevel)/.aiad/hooks/pre-commit.sh"
`;
  writeFileSync(dest, wrapper, 'utf-8');
  chmodSync(dest, 0o755);
  return dest;
}

function installerGitHook(projetDir) {
  const gitDir = join(projetDir, '.git');
  if (!existsSync(gitDir) || !statSync(gitDir).isDirectory()) {
    throw new Error("Pas de dossier .git/ — initialisez le repo avec 'git init' avant.");
  }
  const hooksDir = join(gitDir, 'hooks');
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }
  const dest = join(hooksDir, 'pre-commit');
  const existant = existsSync(dest) ? readFileSync(dest, 'utf-8') : '';
  // Ne pas écraser un hook utilisateur déjà présent qui ne nous appartient pas.
  if (existant && !existant.includes('AIAD SDD Mode')) {
    return { dest, conflit: true };
  }
  const wrapper = `#!/usr/bin/env sh
# AIAD SDD Mode — pre-commit (entrypoint .git/hooks/)
# Délègue au hook versionné dans .aiad/hooks/.
exec "$(git rev-parse --show-toplevel)/.aiad/hooks/pre-commit.sh"
`;
  writeFileSync(dest, wrapper, 'utf-8');
  chmodSync(dest, 0o755);
  return { dest, conflit: false };
}

export async function installerHooks(projetDir, options = {}) {
  const { silencieux = false, force = false } = options;
  const rel = (p) => relative(projetDir, p);

  if (!silencieux) {
    console.log(`\n${C.cyan}${C.gras}  AIAD SDD Mode — Installation des hooks Git${C.reset}\n`);
  }

  // 1. Hook script (toujours synchronisé avec le package).
  const hookPath = copierHook(projetDir);
  if (!silencieux) log(`${C.vert}+${C.reset}`, `${rel(hookPath)} ${C.gris}(hook script)${C.reset}`);

  // 2. Config + bypass — créés seulement si absents (préserve la perso).
  if (ecrireConfigSiAbsente(projetDir) && !silencieux) {
    log(`${C.vert}+${C.reset}`, `${rel(join(projetDir, '.aiad', 'config.yml'))} ${C.gris}(config par défaut)${C.reset}`);
  }
  if (ecrireBypassSiAbsent(projetDir) && !silencieux) {
    log(`${C.vert}+${C.reset}`, `${rel(join(projetDir, '.aiad', 'hook-bypass.yml'))} ${C.gris}(whitelist par défaut)${C.reset}`);
  }

  // 3. Entrypoint Git ou Husky.
  const husky = detecterHusky(projetDir);
  if (husky) {
    const dest = installerHusky(projetDir);
    if (!silencieux) {
      log(`${C.vert}+${C.reset}`, `${rel(dest)} ${C.gris}(Husky détecté → entrypoint Husky)${C.reset}`);
    }
  } else {
    const { dest, conflit } = installerGitHook(projetDir);
    if (conflit && !force) {
      if (!silencieux) {
        log(
          `${C.rouge}!${C.reset}`,
          `${rel(dest)} ${C.gris}(hook utilisateur existant — non écrasé. Utilisez --force pour remplacer.)${C.reset}`
        );
      }
    } else {
      if (conflit && force) {
        // Force : on réinstalle.
        const wrapper = `#!/usr/bin/env sh
# AIAD SDD Mode — pre-commit (entrypoint .git/hooks/)
# Délègue au hook versionné dans .aiad/hooks/.
exec "$(git rev-parse --show-toplevel)/.aiad/hooks/pre-commit.sh"
`;
        writeFileSync(dest, wrapper, 'utf-8');
        chmodSync(dest, 0o755);
      }
      if (!silencieux) {
        log(`${C.vert}+${C.reset}`, `${rel(dest)} ${C.gris}(entrypoint .git/hooks/)${C.reset}`);
      }
    }
  }

  if (!silencieux) {
    console.log(`
${C.gras}  Drift Lock activé.${C.reset}
${C.gris}  Mode (warn/block/off) configurable dans .aiad/config.yml${C.reset}
${C.gris}  Whitelist dans .aiad/hook-bypass.yml${C.reset}
${C.gris}  Bypass ponctuel : git commit --no-verify (déconseillé)${C.reset}
`);
  }
}

export async function desinstallerHooks(projetDir, options = {}) {
  const { silencieux = false } = options;
  const { unlinkSync } = await import('node:fs');
  const rel = (p) => relative(projetDir, p);
  let supprimes = 0;

  if (!silencieux) {
    console.log(`\n${C.cyan}${C.gras}  AIAD SDD Mode — Désinstallation des hooks Git${C.reset}\n`);
  }

  const cibles = [
    join(projetDir, '.git', 'hooks', 'pre-commit'),
    join(projetDir, '.husky', 'pre-commit'),
  ];

  for (const cible of cibles) {
    if (!existsSync(cible)) continue;
    try {
      const contenu = readFileSync(cible, 'utf-8');
      if (!contenu.includes('AIAD SDD Mode')) continue;
      unlinkSync(cible);
      supprimes++;
      if (!silencieux) {
        log(`${C.jaune}-${C.reset}`, `${rel(cible)} ${C.gris}(supprimé)${C.reset}`);
      }
    } catch {
      // ignore
    }
  }

  if (!silencieux) {
    console.log(`\n  ${supprimes} hook(s) supprimé(s).\n`);
  }
}
