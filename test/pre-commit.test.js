// Tests d'intégration du hook pre-commit (Drift Lock).
// On instancie un mini-repo Git, on stage des fichiers selon différents
// scénarios, et on exécute le script bash directement.
//
// Couvre :
//   - mode block / warn / off (.aiad/config.yml)
//   - whitelist basename + path glob (.aiad/hook-bypass.yml)
//   - bypass env var (AIAD_SKIP_DRIFT_CHECK=1)
//   - SPEC modifiée en parallèle du code → drift respecté
//   - absence de .aiad/ → no-op (exit 0)

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, chmodSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HOOK_TEMPLATE = join(__dirname, '..', 'templates', '.aiad', 'hooks', 'pre-commit.sh');

// Marqueur construit par morceaux : CE fichier de test ne doit jamais contenir
// la séquence « <délimiteur de commentaire> TODO-JNSP: » en clair, sinon le hook
// réel bloquerait son propre commit. Les fixtures reconstruisent le marqueur à
// l'exécution, de sorte que le hook *sous test* voit bien un vrai marqueur.
const JNSP = 'TODO-' + 'JNSP:';

function git(dir, ...args) {
  return spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
}

function runHook(dir, env = {}) {
  return spawnSync('bash', [join(dir, '.aiad', 'hooks', 'pre-commit.sh')], {
    cwd: dir,
    encoding: 'utf-8',
    env: { ...process.env, ...env },
  });
}

function setupRepo({ withAiad = true, mode, bypass } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-hook-'));

  // Init Git silencieux + identité minimale
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@aiad.local');
  git(dir, 'config', 'user.name', 'AIAD Tests');
  git(dir, 'config', 'commit.gpgsign', 'false');

  if (withAiad) {
    mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
    mkdirSync(join(dir, '.aiad', 'hooks'), { recursive: true });
    copyFileSync(HOOK_TEMPLATE, join(dir, '.aiad', 'hooks', 'pre-commit.sh'));
    chmodSync(join(dir, '.aiad', 'hooks', 'pre-commit.sh'), 0o755);

    if (mode) {
      writeFileSync(join(dir, '.aiad', 'config.yml'), `hooks:\n  pre_commit: ${mode}\n`, 'utf-8');
    }
    if (bypass) {
      writeFileSync(join(dir, '.aiad', 'hook-bypass.yml'), bypass, 'utf-8');
    }
  }

  // Commit initial pour avoir un HEAD
  writeFileSync(join(dir, 'README.md'), 'seed');
  git(dir, 'add', 'README.md');
  git(dir, 'commit', '-q', '-m', 'init');

  return dir;
}

function stageNew(dir, path, contenu = 'x') {
  const cible = join(dir, path);
  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, contenu, 'utf-8');
  git(dir, 'add', path);
}

test('hook — repo sans .aiad/ → exit 0 (no-op)', () => {
  const dir = setupRepo({ withAiad: false });
  try {
    // Hook absent → on simule en exécutant le template directement
    const r = spawnSync('bash', [HOOK_TEMPLATE], { cwd: dir, encoding: 'utf-8' });
    assert.equal(r.status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hook — code modifié + SPEC stagée dans le même commit → exit 0', () => {
  const dir = setupRepo({ mode: 'block' });
  try {
    stageNew(dir, 'src/login.ts', 'export function login(){}');
    stageNew(dir, '.aiad/specs/SPEC-001-1-login.md', '# Login');
    const r = runHook(dir);
    assert.equal(r.status, 0, `exit ${r.status}\nstderr: ${r.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hook — code modifié sans SPEC + mode block → exit 1', () => {
  const dir = setupRepo({ mode: 'block' });
  try {
    stageNew(dir, 'src/login.ts', 'export function login(){}');
    const r = runHook(dir);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /Drift Lock/);
    assert.match(r.stdout, /commit refusé/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hook — code modifié sans SPEC + mode warn → exit 0 + message', () => {
  const dir = setupRepo({ mode: 'warn' });
  try {
    stageNew(dir, 'src/login.ts', 'export function login(){}');
    const r = runHook(dir);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Drift Lock/);
    assert.match(r.stdout, /commit autorisé/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hook — mode off → exit 0 sans message', () => {
  const dir = setupRepo({ mode: 'off' });
  try {
    stageNew(dir, 'src/login.ts', 'export function login(){}');
    const r = runHook(dir);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hook — AIAD_SKIP_DRIFT_CHECK=1 court-circuite tout', () => {
  const dir = setupRepo({ mode: 'block' });
  try {
    stageNew(dir, 'src/login.ts', 'export function login(){}');
    const r = runHook(dir, { AIAD_SKIP_DRIFT_CHECK: '1' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hook — whitelist basename "*.md" laisse passer une doc seule', () => {
  const dir = setupRepo({ mode: 'block', bypass: '- "*.md"\n' });
  try {
    stageNew(dir, 'docs/guide.md', '# Guide');
    const r = runHook(dir);
    assert.equal(r.status, 0, `stdout: ${r.stdout}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hook — whitelist path "docs/**/*.md" laisse passer la doc mais bloque le code', () => {
  const dir = setupRepo({ mode: 'block', bypass: '- "docs/**/*.md"\n' });
  try {
    stageNew(dir, 'docs/sub/note.md', 'note');
    stageNew(dir, 'src/x.ts', 'x');
    const r = runHook(dir);
    assert.equal(r.status, 1, 'devrait bloquer pour src/x.ts non whitelisté');
    assert.match(r.stdout, /src\/x\.ts/);
    // La note ne doit PAS être listée
    assert.doesNotMatch(r.stdout, /docs\/sub\/note\.md/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hook — config par défaut (sans config.yml) = block', () => {
  const dir = setupRepo({ mode: undefined }); // pas de config.yml
  try {
    stageNew(dir, 'src/login.ts', 'export function login(){}');
    const r = runHook(dir);
    assert.equal(r.status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hook — modification dans .aiad/intents ou .aiad/gouvernance ne déclenche rien', () => {
  const dir = setupRepo({ mode: 'block' });
  try {
    stageNew(dir, '.aiad/intents/INTENT-001.md', '# Intent');
    stageNew(dir, '.aiad/gouvernance/AIAD-RGPD.md', '# RGPD');
    const r = runHook(dir);
    assert.equal(r.status, 0, `stdout: ${r.stdout}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hook — aucun fichier stagé → exit 0', () => {
  const dir = setupRepo({ mode: 'block' });
  try {
    const r = runHook(dir);
    assert.equal(r.status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ─── Garde-fou JNSP ─────────────────────────────────────────────────────
// Tout TODO-JNSP non résolu dans le code stagé doit bloquer le commit
// même si une SPEC est mise à jour en parallèle (la question humaine
// reste en suspens — le Drift Lock seul ne suffit pas).

test('hook — TODO-JNSP dans le code stagé + mode block → exit 1', () => {
  const dir = setupRepo({ mode: 'block' });
  try {
    stageNew(dir, 'src/login.ts', 'export function login(){\n  // ' + JNSP + ' quel comportement si le user est verrouillé ?\n  return null;\n}');
    stageNew(dir, '.aiad/specs/SPEC-001-1-login.md', '# Login\nSPEC à jour');
    const r = runHook(dir);
    assert.equal(r.status, 1, `stdout: ${r.stdout}`);
    assert.match(r.stdout, /JNSP/);
    assert.match(r.stdout, /TODO-JNSP/);
    assert.match(r.stdout, /quel comportement si/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hook — TODO-JNSP en mode warn → exit 0 + message', () => {
  const dir = setupRepo({ mode: 'warn' });
  try {
    stageNew(dir, 'src/x.ts', '// ' + JNSP + ' à clarifier\nexport const x = 1;\n');
    const r = runHook(dir);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /JNSP/);
    assert.match(r.stdout, /commit autorisé/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hook — code sans TODO-JNSP + SPEC stagée → exit 0 (pas de faux positif)', () => {
  const dir = setupRepo({ mode: 'block' });
  try {
    // Volontairement la chaîne « JNSP » apparaît en commentaire libre
    // mais sans le préfixe TODO-JNSP: → pas de blocage attendu.
    stageNew(dir, 'src/x.ts', '// Doc : JNSP est notre garde-fou\nexport const x = 1;\n');
    stageNew(dir, '.aiad/specs/SPEC-002-1-x.md', '# X');
    const r = runHook(dir);
    assert.equal(r.status, 0, `stdout: ${r.stdout}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ─── Faux positifs JNSP — documentation & mentions hors commentaire ──────
// Le marqueur est un commentaire de code. La documentation qui le décrit et
// les mentions en chaîne / backticks ne doivent jamais bloquer.

test('hook — doc Markdown décrivant le marqueur (backticks) + SPEC → exit 0', () => {
  const dir = setupRepo({ mode: 'block' });
  try {
    // Reproduit le faux positif réel sur .aiad/AGENT-GUIDE.md (ligne en backticks).
    stageNew(
      dir,
      'docs/AGENT-GUIDE.md',
      '- Dans le code : poser `// ' + JNSP + ' <question pour l\'humain>` ; le hook bloque.\n',
    );
    stageNew(dir, '.aiad/specs/SPEC-010-1-doc.md', '# Doc');
    const r = runHook(dir);
    assert.equal(r.status, 0, `stdout: ${r.stdout}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hook — doc Markdown avec bloc de code clôturé montrant le marqueur + SPEC → exit 0', () => {
  const dir = setupRepo({ mode: 'block' });
  try {
    stageNew(
      dir,
      'docs/guide.md',
      'Exemple :\n\n```js\n// ' + JNSP + ' question illustrative\n```\n',
    );
    stageNew(dir, '.aiad/specs/SPEC-011-1-guide.md', '# Guide');
    const r = runHook(dir);
    assert.equal(r.status, 0, `stdout: ${r.stdout}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hook — mention TODO-JNSP en chaîne (hors commentaire) + SPEC → exit 0', () => {
  const dir = setupRepo({ mode: 'block' });
  try {
    // Le token apparaît dans un littéral chaîne, pas en position de commentaire.
    stageNew(dir, 'src/scan.js', 'const MARKER = "' + JNSP + '"; // motif recherché\nexport { MARKER };\n');
    stageNew(dir, '.aiad/specs/SPEC-012-1-scan.md', '# Scan');
    const r = runHook(dir);
    assert.equal(r.status, 0, `stdout: ${r.stdout}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hook — vrai marqueur en commentaire trailing (Python #) → exit 1', () => {
  const dir = setupRepo({ mode: 'block' });
  try {
    stageNew(dir, 'src/svc.py', 'def f():\n    return 1  # ' + JNSP + ' confirmer le comportement par défaut\n');
    stageNew(dir, '.aiad/specs/SPEC-013-1-svc.md', '# Svc');
    const r = runHook(dir);
    assert.equal(r.status, 1, `stdout: ${r.stdout}`);
    assert.match(r.stdout, /TODO-JNSP/);
    assert.match(r.stdout, /confirmer le comportement/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
