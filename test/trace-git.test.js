// Tests `listerFichiersGit` et `scanCode` quand un repo Git est présent.
// Vérifie que .gitignore est respecté et que les fichiers exclus ne se
// retrouvent pas dans la matrice de traçabilité.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { listerFichiersGit, construireMatrice } from '../lib/sdd-trace.js';

function git(dir, ...args) {
  return spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
}

function setupRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-trace-git-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@aiad.local');
  git(dir, 'config', 'user.name', 'AIAD Tests');
  git(dir, 'config', 'commit.gpgsign', 'false');
  mkdirSync(join(dir, '.aiad', 'intents'), { recursive: true });
  mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
  return dir;
}

test('listerFichiersGit — sans .git → null', () => {
  const d = mkdtempSync(join(tmpdir(), 'aiad-no-git-'));
  try {
    assert.equal(listerFichiersGit(d), null);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('listerFichiersGit — repo Git, retourne fichiers code tracked et untracked filtrés .gitignore', () => {
  const d = setupRepo();
  try {
    writeFileSync(join(d, 'app.ts'), 'export const a = 1;\n');
    writeFileSync(join(d, 'app.py'), 'a = 1\n');
    writeFileSync(join(d, 'README.md'), '# Doc'); // doit être ignoré (pas une extension code)

    mkdirSync(join(d, 'vendor'), { recursive: true });
    writeFileSync(join(d, 'vendor', 'tiers.js'), 'window.x = 1;');
    writeFileSync(join(d, '.gitignore'), 'vendor/\n');

    git(d, 'add', '.');
    git(d, 'commit', '-q', '-m', 'init');

    const liste = listerFichiersGit(d);
    assert.ok(Array.isArray(liste));
    assert.ok(liste.includes('app.ts'));
    assert.ok(liste.includes('app.py'));
    assert.ok(!liste.includes('README.md'), 'fichier hors extensions code inclus');
    assert.ok(!liste.some((f) => f.startsWith('vendor/')), 'vendor/ inclus malgré .gitignore');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('listerFichiersGit — fichiers untracked + .gitignore respecté', () => {
  const d = setupRepo();
  try {
    writeFileSync(join(d, '.gitignore'), 'build/\nnode_modules/\n');
    writeFileSync(join(d, 'a.ts'), 'export const a = 1;');
    git(d, 'add', '.');
    git(d, 'commit', '-q', '-m', 'init');

    // Untracked mais pas ignoré → doit apparaître
    writeFileSync(join(d, 'b.ts'), 'export const b = 1;');
    // Untracked et ignoré → ne doit PAS apparaître
    mkdirSync(join(d, 'build'));
    writeFileSync(join(d, 'build', 'gen.ts'), 'export {};');

    const liste = listerFichiersGit(d);
    assert.ok(liste.includes('a.ts'));
    assert.ok(liste.includes('b.ts'), 'untracked non gitignored absent');
    assert.ok(!liste.some((f) => f.startsWith('build/')), 'fichier ignoré par .gitignore inclus');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('construireMatrice — .gitignore respecté côté annotations sur repo Git', () => {
  const d = setupRepo();
  try {
    // Intent + SPEC liés
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-001.md'),
      `---\nstatus: active\n---\n\n# Intent\n`, 'utf-8');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1.md'),
      `---\nparent_intent: INTENT-001\nstatus: ready\n---\n\n# Spec\n`, 'utf-8');

    // Fichier code annoté tracké
    writeFileSync(join(d, 'login.ts'),
      `// @spec SPEC-001-1\nexport function login(){}\n`);

    // Fichier annoté MAIS dans build/ (gitignored) — ne doit pas apparaître
    writeFileSync(join(d, '.gitignore'), 'build/\n');
    mkdirSync(join(d, 'build'));
    writeFileSync(join(d, 'build', 'gen.ts'),
      `// @spec SPEC-999-1\nexport {};\n`);

    git(d, 'add', '.');
    git(d, 'commit', '-q', '-m', 'init');

    const m = construireMatrice(d);
    // SPEC-001-1 doit apparaître dans le forward
    const code001 = m.forward[0]?.specs[0]?.code || [];
    assert.ok(code001.some((c) => c.path === 'login.ts'), 'login.ts manquant dans matrice');
    // SPEC-999-1 venant de build/ doit être absent (gitignored donc pas scanné)
    assert.equal(m.gaps.specsOrphelinsSurCode.filter((s) => s.id === 'SPEC-999-1').length, 0,
      'SPEC fantôme depuis build/ (gitignored) inclus — .gitignore non respecté');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('construireMatrice — sans repo Git, fallback walk récursif fonctionne', () => {
  const d = mkdtempSync(join(tmpdir(), 'aiad-trace-nogit-'));
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });

    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-X.md'), 'status: active\n# X');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-X-1.md'),
      `**Intent parent** : INTENT-X\nstatut: ready\n# X`);
    writeFileSync(join(d, 'x.ts'), '// @spec SPEC-X-1\nexport {};');

    const m = construireMatrice(d);
    assert.equal(m.summary.specs, 1);
    assert.ok(m.forward[0].specs[0].code.length === 1);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
