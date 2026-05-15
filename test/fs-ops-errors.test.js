// Tests gestion erreurs IO actionnables (#24).
// Vérifie qu'EACCES/EPERM/ENOSPC/EROFS donnent un message en français
// utilisable par l'utilisateur final, en préservant `err.code`.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { traduireErreurIO, mettreAJour, copierFichier } from '../lib/fs-ops.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-fserr-')); }

test('traduireErreurIO — EACCES → message actionnable français', () => {
  const err = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES', path: '/etc/foo' });
  const t = traduireErreurIO(err, '/etc/foo');
  assert.match(t.message, /Permission refusée/);
  assert.match(t.message, /\/etc\/foo/);
  assert.match(t.message, /droits/);
  assert.equal(t.code, 'EACCES');
  assert.equal(t.cause, err);
});

test('traduireErreurIO — EPERM → mention propriétaire/chown', () => {
  const err = Object.assign(new Error('EPERM'), { code: 'EPERM' });
  const t = traduireErreurIO(err, '/usr/bin/foo');
  assert.match(t.message, /Opération non permise/);
  assert.match(t.message, /chown/);
});

test('traduireErreurIO — ENOSPC → libère espace disque', () => {
  const err = Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' });
  const t = traduireErreurIO(err, '/tmp/foo');
  assert.match(t.message, /espace disque/i);
});

test('traduireErreurIO — EROFS → readonly fs', () => {
  const err = Object.assign(new Error('EROFS'), { code: 'EROFS' });
  const t = traduireErreurIO(err, '/readonly/foo');
  assert.match(t.message, /lecture seule/);
});

test('traduireErreurIO — code inconnu → erreur originale inchangée', () => {
  const err = Object.assign(new Error('weird'), { code: 'EWHATEVER' });
  const t = traduireErreurIO(err, '/foo');
  assert.equal(t, err);
});

test('mettreAJour — erreur EACCES sur dossier read-only → message traduit', () => {
  // Skip sur Windows ou si lancé en root (chmod ignoré).
  if (process.platform === 'win32' || process.getuid?.() === 0) return;

  const d = tmp();
  try {
    const ro = join(d, 'readonly');
    mkdirSync(ro);
    chmodSync(ro, 0o555); // r-x r-x r-x : pas d'écriture
    try {
      assert.throws(
        () => mettreAJour(join(ro, 'cible.txt'), 'contenu'),
        (err) => {
          assert.match(err.message, /Permission refusée/);
          assert.equal(err.code, 'EACCES');
          return true;
        },
      );
    } finally {
      chmodSync(ro, 0o755); // restore pour le rmSync
    }
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('copierFichier — erreur sur source absente → traduite si code matché', () => {
  const d = tmp();
  try {
    // ENOENT n'est pas dans notre table → erreur originale renvoyée
    assert.throws(
      () => copierFichier(join(d, 'inexistant.txt'), join(d, 'dst.txt')),
      (err) => err.code === 'ENOENT',
    );
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
