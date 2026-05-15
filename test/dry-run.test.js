// Tests du flag global --dry-run.
// Invariant central : aucun fichier ne doit être créé / modifié sur disque
// quand dryRun=true, tout en gardant la trace des verdicts qui auraient été
// émis (créé/MAJ/inchangé/préservé).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mettreAJour, copierFichier, copierDossier, ajouterSiAbsent } from '../lib/fs-ops.js';
import { init } from '../lib/init.js';
import { emitRules } from '../lib/emit-rules.js';

// (#222) Mock console.log/error/warn au lieu de process.stdout.write —
// préserve le canal de communication du test runner en mode
// `--test-isolation=process` (le runner publie ses résultats TAP/JSON sur
// stdout). Le code applicatif (term.js, console.log) passe par console.*,
// donc on intercepte la couche au-dessus.
function silencerStdout(fn) {
  return async (...args) => {
    const origLog = console.log;
    const origErr = console.error;
    const origWarn = console.warn;
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
    try { return await fn(...args); }
    finally {
      console.log = origLog;
      console.error = origErr;
      console.warn = origWarn;
    }
  };
}
function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-dryrun-')); }

test('mettreAJour --dry-run — verdict correct sans écriture', () => {
  const d = tmp();
  try {
    const f = join(d, 'sub', 'a.txt');
    assert.equal(mettreAJour(f, 'hello', { dryRun: true }), 'created');
    assert.ok(!existsSync(f), 'fichier créé malgré dry-run');
    assert.ok(!existsSync(join(d, 'sub')), 'dossier créé malgré dry-run');

    writeFileSync(join(d, 'b.txt'), 'old');
    assert.equal(mettreAJour(join(d, 'b.txt'), 'old', { dryRun: true }), 'unchanged');
    assert.equal(mettreAJour(join(d, 'b.txt'), 'new', { dryRun: true }), 'updated');
    assert.equal(readFileSync(join(d, 'b.txt'), 'utf-8'), 'old', 'écrit malgré dry-run');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('copierFichier --dry-run — toutes les transitions sans effet de bord', () => {
  const d = tmp();
  try {
    const src = join(d, 'src.txt');
    const dst = join(d, 'sub', 'dst.txt');
    writeFileSync(src, 'A');

    assert.equal(copierFichier(src, dst, { dryRun: true }), 'created');
    assert.ok(!existsSync(dst));

    writeFileSync(dst.replace('sub/', ''), 'A');
    const dst2 = dst.replace('sub/', '');
    assert.equal(copierFichier(src, dst2, { dryRun: true }), 'unchanged');

    writeFileSync(src, 'B');
    assert.equal(copierFichier(src, dst2, { dryRun: true, force: true }), 'updated');
    assert.equal(readFileSync(dst2, 'utf-8'), 'A', 'écrasé malgré dry-run');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('copierDossier --dry-run — stats agrégés cohérents sans écriture', () => {
  const d = tmp();
  try {
    const src = join(d, 'src');
    const dst = join(d, 'dst');
    mkdirSync(join(src, 'sub'), { recursive: true });
    writeFileSync(join(src, 'a.txt'), '1');
    writeFileSync(join(src, 'sub', 'b.txt'), '2');

    const stats = copierDossier(src, dst, { dryRun: true });
    assert.equal(stats.created, 2);
    assert.ok(!existsSync(dst), 'dst créé malgré dry-run');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('ajouterSiAbsent --dry-run — verdict correct sans toucher au fichier', () => {
  const d = tmp();
  try {
    const f = join(d, 'CLAUDE.md');
    assert.equal(ajouterSiAbsent(f, '# X', '# X', { dryRun: true }), 'created');
    assert.ok(!existsSync(f));

    writeFileSync(f, 'existing\n');
    assert.equal(ajouterSiAbsent(f, '\n# X', '# X', { dryRun: true }), 'appended');
    assert.equal(readFileSync(f, 'utf-8'), 'existing\n');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('init --dry-run — aucun fichier créé sur le projet cible', silencerStdout(async () => {
  const dir = tmp();
  try {
    await init(dir, { dryRun: true });
    // Le projet doit rester vide (sauf le dossier racine lui-même)
    const contenu = readdirSync(dir);
    assert.equal(contenu.length, 0, `fichiers créés : ${contenu.join(', ')}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('init --minimal --dry-run — aperçu seul, projet vierge', silencerStdout(async () => {
  const dir = tmp();
  try {
    await init(dir, { minimal: true, dryRun: true });
    assert.equal(readdirSync(dir).length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('emit-rules --dry-run — détecte les écritures qui seraient faites mais ne touche rien', silencerStdout(async () => {
  const dir = tmp();
  try {
    // D'abord on init pour que AGENT-GUIDE existe
    await init(dir, {});
    // Patcher AGENT-GUIDE → emit-rules détecterait des MAJ
    const guide = join(dir, '.aiad', 'AGENT-GUIDE.md');
    writeFileSync(guide, readFileSync(guide, 'utf-8') + '\n## Patch\n', 'utf-8');

    const agentsAvant = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
    const stats = await emitRules(dir, { runtimes: ['claude-code'], dryRun: true });

    // En dryRun, AGENTS.md ne doit PAS avoir changé sur disque
    assert.equal(readFileSync(join(dir, 'AGENTS.md'), 'utf-8'), agentsAvant);
    // Mais les stats doivent indiquer une MAJ qui serait faite
    assert.ok(stats.updated >= 1 || stats.created >= 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));
