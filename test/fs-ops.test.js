// Tests pour lib/fs-ops.js — sémantique de copie/MAJ centralisée.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ensureDir, mettreAJour, copierFichier, copierDossier, ajouterSiAbsent } from '../lib/fs-ops.js';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'aiad-fsops-'));
}

test('ensureDir — crée récursivement', () => {
  const d = tmp();
  try {
    const cible = join(d, 'a', 'b', 'c');
    ensureDir(cible);
    assert.ok(existsSync(cible));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('ensureDir — idempotent', () => {
  const d = tmp();
  try {
    ensureDir(d); // déjà existant
    assert.ok(existsSync(d));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('mettreAJour — created / unchanged / updated', () => {
  const d = tmp();
  try {
    const f = join(d, 'sub', 'file.txt');
    assert.equal(mettreAJour(f, 'hello'), 'created');
    assert.equal(readFileSync(f, 'utf-8'), 'hello');
    assert.equal(mettreAJour(f, 'hello'), 'unchanged');
    assert.equal(mettreAJour(f, 'world'), 'updated');
    assert.equal(readFileSync(f, 'utf-8'), 'world');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('copierFichier — created sur cible absente', () => {
  const d = tmp();
  try {
    const src = join(d, 'src.txt');
    const dst = join(d, 'dst.txt');
    writeFileSync(src, 'A');
    assert.equal(copierFichier(src, dst), 'created');
    assert.equal(readFileSync(dst, 'utf-8'), 'A');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('copierFichier — preserve=true protège la cible existante', () => {
  const d = tmp();
  try {
    const src = join(d, 'src.txt');
    const dst = join(d, 'dst.txt');
    writeFileSync(src, 'NOUVEAU');
    writeFileSync(dst, 'PERSONNALISE');
    assert.equal(copierFichier(src, dst, { preserve: true }), 'preserved');
    assert.equal(readFileSync(dst, 'utf-8'), 'PERSONNALISE');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('copierFichier — force=true écrase même si preserve=true', () => {
  const d = tmp();
  try {
    const src = join(d, 'src.txt');
    const dst = join(d, 'dst.txt');
    writeFileSync(src, 'NOUVEAU');
    writeFileSync(dst, 'ANCIEN');
    assert.equal(copierFichier(src, dst, { preserve: true, force: true }), 'updated');
    assert.equal(readFileSync(dst, 'utf-8'), 'NOUVEAU');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('copierFichier — unchanged quand contenus identiques', () => {
  const d = tmp();
  try {
    const src = join(d, 'src.txt');
    const dst = join(d, 'dst.txt');
    writeFileSync(src, 'identique');
    writeFileSync(dst, 'identique');
    assert.equal(copierFichier(src, dst), 'unchanged');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('copierDossier — récursion et stats agrégés', () => {
  const d = tmp();
  try {
    const src = join(d, 'src');
    const dst = join(d, 'dst');
    mkdirSync(join(src, 'sub'), { recursive: true });
    writeFileSync(join(src, 'a.txt'), '1');
    writeFileSync(join(src, 'sub', 'b.txt'), '2');
    const stats = copierDossier(src, dst);
    assert.equal(stats.created, 2);
    assert.equal(stats.unchanged, 0);
    assert.ok(existsSync(join(dst, 'a.txt')));
    assert.ok(existsSync(join(dst, 'sub', 'b.txt')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('copierDossier — exclude(nom) filtre un sous-dossier au depth 0', () => {
  const d = tmp();
  try {
    const src = join(d, 'src');
    const dst = join(d, 'dst');
    mkdirSync(join(src, 'gouvernance'), { recursive: true });
    mkdirSync(join(src, 'specs'), { recursive: true });
    writeFileSync(join(src, 'gouvernance', 'sec.md'), 'X');
    writeFileSync(join(src, 'specs', 'a.md'), 'Y');
    const stats = copierDossier(src, dst, {
      exclude: (nom, _src, depth) => depth === 0 && nom === 'gouvernance',
    });
    assert.ok(!existsSync(join(dst, 'gouvernance')));
    assert.ok(existsSync(join(dst, 'specs', 'a.md')));
    assert.equal(stats.created, 1);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('ajouterSiAbsent — created si absent, appended si marqueur manquant, unchanged sinon', () => {
  const d = tmp();
  try {
    const f = join(d, 'CLAUDE.md');
    assert.equal(ajouterSiAbsent(f, '# SDD Mode\nbody', '# SDD Mode'), 'created');

    // Marqueur déjà présent
    assert.equal(ajouterSiAbsent(f, '\n# SDD Mode\nplus', '# SDD Mode'), 'unchanged');

    // Marqueur absent → append
    writeFileSync(f, 'simple existing\n');
    assert.equal(ajouterSiAbsent(f, '\n# SDD Mode\nbody', '# SDD Mode'), 'appended');
    const final = readFileSync(f, 'utf-8');
    assert.ok(final.startsWith('simple existing'));
    assert.ok(final.includes('# SDD Mode'));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
