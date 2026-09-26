#!/usr/bin/env node
// AIAD SDD Mode — Script de release automatisé.
//
// Pipeline en une commande :
//   0. Contrôle de drift de la doctrine vs Drive publié (SPEC-034-2) — AVANT
//      toute modification ; source lue dans AIAD_DOCTRINE_SOURCE (obligatoire,
//      y compris en --dry-run : le contrôle est en lecture seule)
//   1. Vérifie git working tree clean (sauf --allow-dirty)
//   2. Bump la version dans package.json (patch / minor / major / x.y.z)
//   3. Regen CHANGELOG.md depuis `git log` (commits conventionnels feat/fix/docs/...)
//   4. Regen DOCUMENTATION.md via `aiad-sdd docs`
//   5. Run lint + tests + tarball hygiene check
//   6. Stage + commit "chore: release vX.Y.Z" + tag vX.Y.Z
//   7. Optionnel : push (--push) — déclenche release.yml côté GitHub
//
// Mode `--dry-run` : imprime chaque étape sans rien modifier.
//
// **Zero-dep** : utilise uniquement node:* + binaires git/npm système.
//
// @intent INTENT-034
// @spec SPEC-034-2-controle-drift-doctrine
// @verified-by test/release.test.js
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { argv, exit } from 'node:process';
import { main as checkDoctrine, CODE_CONFORME } from './check-doctrine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RACINE = join(__dirname, '..');

// ─── Helpers couleur (stripped si NO_COLOR / non-TTY) ──────────────────────

const TTY = process.stdout.isTTY && !process.env.NO_COLOR && !process.env.AIAD_NO_COLOR;
const C = {
  bold: TTY ? '\x1b[1m' : '',
  cyan: TTY ? '\x1b[36m' : '',
  vert: TTY ? '\x1b[32m' : '',
  rouge: TTY ? '\x1b[31m' : '',
  jaune: TTY ? '\x1b[33m' : '',
  gris: TTY ? '\x1b[90m' : '',
  reset: TTY ? '\x1b[0m' : '',
};

// ─── Fonctions pures (testables) ────────────────────────────────────────────

/**
 * Bump une version SemVer selon `kind` ('patch' | 'minor' | 'major' | 'x.y.z').
 *
 * @param {string} current — version courante
 * @param {string} kind
 * @returns {string} nouvelle version
 */
export function bumpVersion(current, kind) {
  if (/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(kind)) return kind; // version explicite
  const m = String(current).match(/^(\d+)\.(\d+)\.(\d+)(-[\w.]+)?$/);
  if (!m) throw new Error(`Version courante invalide : ${current}`);
  let [_, maj, min, pat] = m;
  maj = +maj; min = +min; pat = +pat;
  if (kind === 'major') return `${maj + 1}.0.0`;
  if (kind === 'minor') return `${maj}.${min + 1}.0`;
  if (kind === 'patch') return `${maj}.${min}.${pat + 1}`;
  throw new Error(`Type de bump inconnu : "${kind}". Disponibles : patch, minor, major, ou x.y.z explicite.`);
}

/**
 * Parse une ligne de commit conventionnel :
 *   "feat: ajout X" → { type: 'feat', scope: null, subject: 'ajout X' }
 *   "fix(parser): bug Y" → { type: 'fix', scope: 'parser', subject: 'bug Y' }
 *   "ajout sans préfixe" → null
 */
export function parseCommit(ligne) {
  const m = String(ligne).match(/^(feat|fix|docs|refactor|perf|test|chore|build|ci|style|revert)(?:\(([^)]+)\))?(!?):\s*(.+)$/);
  if (!m) return null;
  return {
    type: m[1],
    scope: m[2] || null,
    breaking: m[3] === '!',
    subject: m[4].trim(),
  };
}

const SECTIONS = {
  feat: 'Ajouté',
  fix: 'Corrigé',
  perf: 'Performance',
  refactor: 'Changé',
  docs: 'Documentation',
  test: 'Tests',
  build: 'Build',
  ci: 'CI',
};

/**
 * Génère une section CHANGELOG (Keep a Changelog) depuis une liste de
 * commits parsés. Les types sont regroupés par catégorie.
 *
 * @param {string} version
 * @param {string} date — YYYY-MM-DD
 * @param {{ type: string, scope: string|null, subject: string, breaking: boolean }[]} commits
 * @returns {string}
 */
export function genererSectionChangelog(version, date, commits) {
  const lignes = [`## [${version}] — ${date}`, ''];
  if (commits.length === 0) {
    lignes.push('_Pas de commits conventionnels détectés depuis la dernière release._', '');
    return lignes.join('\n');
  }

  // Breaking en premier
  const breaking = commits.filter((c) => c.breaking);
  if (breaking.length) {
    lignes.push('### ⚠️ Breaking changes', '');
    for (const b of breaking) {
      lignes.push(`- ${b.scope ? `**${b.scope}** : ` : ''}${b.subject}`);
    }
    lignes.push('');
  }

  // Regroupement par section dans l'ordre Ajouté / Corrigé / Performance / ...
  const groupesOrdres = ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'build', 'ci'];
  for (const type of groupesOrdres) {
    const items = commits.filter((c) => c.type === type && !c.breaking);
    if (items.length === 0) continue;
    lignes.push(`### ${SECTIONS[type] || type}`, '');
    for (const c of items) {
      lignes.push(`- ${c.scope ? `**${c.scope}** : ` : ''}${c.subject}`);
    }
    lignes.push('');
  }
  return lignes.join('\n');
}

/**
 * Insère une nouvelle section CHANGELOG.md juste avant la première
 * `## [<version>]` existante. Si le CHANGELOG ne contient pas encore de
 * section, l'ajoute après l'entête principal.
 */
export function insererSectionChangelog(contenuExistant, sectionNouvelle) {
  const idx = contenuExistant.search(/^## \[/m);
  if (idx === -1) {
    return contenuExistant.trimEnd() + '\n\n' + sectionNouvelle.trimEnd() + '\n';
  }
  return contenuExistant.slice(0, idx) + sectionNouvelle.trimEnd() + '\n\n' + contenuExistant.slice(idx);
}

// ─── Pipeline runtime ───────────────────────────────────────────────────────

function log(sym, ligne) {
  console.log(`  ${sym} ${ligne}`);
}

/**
 * Étape 0 (SPEC-034-2) : contrôle de drift de la doctrine en mode release,
 * avant toute modification. Lecture seule.
 *
 * @param {{ env?: NodeJS.ProcessEnv, racine?: string,
 *           verifier?: (argv: string[], ctx: { racine: string }) => number }} [ctx]
 * @returns {{ ok: boolean, code: number|null, message: string }}
 *   `code` = code de sortie de check-doctrine (null si la source n'est pas configurée)
 */
export function controlerDoctrine(ctx = {}) {
  const { env = process.env, racine = RACINE, verifier = checkDoctrine } = ctx;
  const source = env.AIAD_DOCTRINE_SOURCE;
  if (!source) {
    return {
      ok: false,
      code: null,
      message: 'AIAD_DOCTRINE_SOURCE non défini — chemin du Drive publié (published/md) requis pour contrôler la doctrine avant release.',
    };
  }
  const code = verifier(['--source', source], { racine });
  return code === CODE_CONFORME
    ? { ok: true, code, message: 'Doctrine conforme au Drive publié.' }
    : { ok: false, code, message: `Contrôle de doctrine en échec (check-doctrine exit ${code}) — release bloquée.` };
}

function exec(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf-8', cwd: RACINE, ...opts });
  if (r.status !== 0) {
    throw new Error(`Échec ${cmd} ${args.join(' ')} (code ${r.status})\n${r.stderr || r.stdout}`);
  }
  return (r.stdout ?? '').trim();
}

function gitWorkingTreeClean(racine = RACINE) {
  const out = exec('git', ['status', '--porcelain'], { cwd: racine });
  return out.length === 0;
}

function dernierTag(racine = RACINE) {
  const r = spawnSync('git', ['describe', '--tags', '--abbrev=0'], { cwd: racine, encoding: 'utf-8' });
  if (r.status !== 0) return null;
  return (r.stdout ?? '').trim();
}

function commitsDepuis(tag, racine = RACINE) {
  const arg = tag ? `${tag}..HEAD` : 'HEAD';
  const out = exec('git', ['log', arg, '--pretty=format:%s'], { cwd: racine });
  return out.split('\n').map((l) => l.trim()).filter(Boolean);
}

export function parseFlags(args) {
  const out = { kind: null, dryRun: false, push: false, allowDirty: false, skipTests: false };
  for (const a of args) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--push') out.push = true;
    else if (a === '--allow-dirty') out.allowDirty = true;
    else if (a === '--skip-tests') out.skipTests = true;
    else if (!out.kind) out.kind = a;
  }
  return out;
}

/**
 * Pipeline de release.
 *
 * @param {string[]} [args]
 * @param {{ env?: NodeJS.ProcessEnv, racine?: string,
 *           verifierDoctrine?: (argv: string[], ctx: { racine: string }) => number }} [ctx]
 *   injections pour les tests (SPEC-034-2 CA-007 / CA-007b)
 * @returns {Promise<number>} code de sortie
 */
export async function main(args = argv.slice(2), ctx = {}) {
  const racine = ctx.racine || RACINE;
  const flags = parseFlags(args);
  const { kind, dryRun, push, allowDirty, skipTests } = flags;
  if (!kind) {
    console.error(`
${C.bold}AIAD SDD — Release${C.reset}

Usage : node scripts/release.js <patch|minor|major|x.y.z> [--dry-run] [--push] [--allow-dirty] [--skip-tests]

Prérequis : AIAD_DOCTRINE_SOURCE=<chemin published/md du Drive> (SPEC-034-2)

Étapes orchestrées :
  0. Contrôle de drift doctrine vs Drive publié (bloquant, avant toute modification)
  1. Vérifie git working tree clean (sauf --allow-dirty)
  2. Bump version package.json
  3. Régénère CHANGELOG.md depuis git log (Keep a Changelog)
  4. Régénère DOCUMENTATION.md via 'aiad-sdd docs'
  5. Lance lint + tests + npm pack hygiene
  6. Commit "chore: release vX.Y.Z" + tag vX.Y.Z
  7. Push (--push) — déclenche release.yml côté GitHub
`);
    return 1;
  }
  bumpVersion('0.0.0', kind); // valide le type de bump (pur) — lève si inconnu

  console.log(`\n${C.bold}${C.cyan}  AIAD SDD — Release${dryRun ? ' (DRY-RUN)' : ''}${C.reset}\n`);

  // 0. Doctrine vs Drive publié — AVANT toute modification (SPEC-034-2).
  // Exécuté aussi en --dry-run : lecture seule, et la prévisualisation doit
  // refléter le blocage qu'aurait la vraie release.
  log(`${C.cyan}0.${C.reset}`, 'Contrôle de drift de la doctrine (Drive publié)…');
  const doctrine = controlerDoctrine({ env: ctx.env, racine, verifier: ctx.verifierDoctrine });
  if (!doctrine.ok) {
    console.error(`  ${C.rouge}✗${C.reset} ${doctrine.message} Aucune modification effectuée.`);
    return 1;
  }
  log(`${C.vert}✓${C.reset}`, doctrine.message);

  // 1. Working tree clean
  log(`${C.cyan}1.${C.reset}`, 'Vérification git working tree…');
  if (!allowDirty && !gitWorkingTreeClean(racine)) {
    console.error(`  ${C.rouge}✗${C.reset} Working tree non propre. Commit ou stash, ou utilise --allow-dirty.`);
    return 1;
  }
  log(`${C.vert}✓${C.reset}`, 'Working tree propre.');

  // 2. Bump version
  const pkgPath = join(racine, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const current = pkg.version;
  const next = bumpVersion(current, kind);
  log(`${C.cyan}2.${C.reset}`, `Bump version : ${C.gris}${current}${C.reset} → ${C.cyan}${next}${C.reset}`);
  if (!dryRun) {
    pkg.version = next;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  }

  // 3. CHANGELOG depuis git log
  log(`${C.cyan}3.${C.reset}`, 'Régénération CHANGELOG.md…');
  const tag = dernierTag(racine);
  const lignes = commitsDepuis(tag, racine);
  const commits = lignes.map(parseCommit).filter(Boolean);
  const date = new Date().toISOString().slice(0, 10);
  const section = genererSectionChangelog(next, date, commits);
  log(`  ${C.gris}↪${C.reset}`, `${commits.length} commit(s) conventionnel(s) (sur ${lignes.length} total) depuis ${tag || 'racine'}.`);
  if (!dryRun) {
    const changelogPath = join(racine, 'CHANGELOG.md');
    const existant = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf-8') : '# Changelog\n\n';
    writeFileSync(changelogPath, insererSectionChangelog(existant, section), 'utf-8');
  }

  // 4. Régen DOCUMENTATION.md
  log(`${C.cyan}4.${C.reset}`, 'Régénération DOCUMENTATION.md…');
  if (!dryRun) {
    exec('node', ['bin/aiad-sdd.js', 'docs'], { cwd: racine, stdio: 'pipe' });
  }

  // 5. Lint + tests + tarball hygiene
  if (!skipTests) {
    log(`${C.cyan}5.${C.reset}`, 'Lint + tests + tarball hygiene…');
    if (!dryRun) {
      exec('npm', ['run', 'lint'], { cwd: racine, stdio: 'inherit' });
      exec('npm', ['test'], { cwd: racine, stdio: 'inherit' });
      exec('npm', ['pack', '--dry-run'], { cwd: racine, stdio: 'pipe' });
    }
  } else {
    log(`${C.jaune}5.${C.reset}`, 'Tests SAUTÉS (--skip-tests)');
  }

  // 6. Commit + tag
  log(`${C.cyan}6.${C.reset}`, `Commit + tag v${next}…`);
  if (!dryRun) {
    exec('git', ['add', 'package.json', 'CHANGELOG.md', 'DOCUMENTATION.md'], { cwd: racine });
    exec('git', ['commit', '-m', `chore: release v${next}`], { cwd: racine });
    exec('git', ['tag', `v${next}`], { cwd: racine });
  }

  // 7. Push
  if (push) {
    log(`${C.cyan}7.${C.reset}`, 'Push origin + tags (déclenche release.yml)…');
    if (!dryRun) {
      exec('git', ['push', '--follow-tags'], { cwd: racine, stdio: 'inherit' });
    }
  } else {
    log(`${C.gris}7.${C.reset}`, `Push non effectué — relance avec --push pour déclencher release.yml.`);
  }

  console.log(`\n${C.vert}${C.bold}  ✓ Release v${next} ${dryRun ? '(prévisualisée)' : 'préparée'}.${C.reset}\n`);
  if (!push && !dryRun) {
    console.log(`${C.gris}  Action manuelle restante : ${C.reset}git push --follow-tags`);
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => exit(code), (err) => {
    console.error(`\n${C.rouge}  ✗ ${err.message}${C.reset}\n`);
    exit(1);
  });
}
