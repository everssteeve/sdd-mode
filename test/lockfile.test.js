// Tests du verrou inter-processus (lib/lockfile.js).
// Couvre acquisition exclusive, contention, libération, stale lock recovery.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, existsSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { acquireLock, avecLock } from '../lib/lockfile.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-lock-')); }

test('acquireLock — création atomique, fichier sur disque', async () => {
  const d = tmp();
  try {
    const lock = await acquireLock(join(d, '.lock'));
    assert.ok(existsSync(lock.path));
    lock.release();
    assert.ok(!existsSync(lock.path));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('acquireLock — contention sans stale → rejet après retries', async () => {
  const d = tmp();
  try {
    const path = join(d, '.lock');
    // Simule un lock vivant : pid courant + écrit récent
    writeFileSync(path, JSON.stringify({ pid: process.pid, time: Date.now() }));

    await assert.rejects(
      acquireLock(path, { retries: 2, retryDelayMs: 10, staleMs: 60_000 }),
      /occupé/,
    );
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('acquireLock — récupère un lock stale par âge', async () => {
  const d = tmp();
  try {
    const path = join(d, '.lock');
    writeFileSync(path, JSON.stringify({ pid: 999_999, time: 0 }));
    // Forcer mtime ancien (sécurise au cas où writeFileSync mette mtime=now)
    const ancien = new Date(Date.now() - 60_000);
    utimesSync(path, ancien, ancien);

    const lock = await acquireLock(path, { staleMs: 100, retries: 1, retryDelayMs: 10 });
    assert.ok(existsSync(lock.path));
    lock.release();
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('acquireLock — récupère un lock dont le PID est mort', async () => {
  const d = tmp();
  try {
    const path = join(d, '.lock');
    // PID très improbable d'exister
    writeFileSync(path, JSON.stringify({ pid: 999_999_999, time: Date.now() }));

    const lock = await acquireLock(path, { staleMs: 60_000, retries: 1, retryDelayMs: 10 });
    assert.ok(existsSync(lock.path));
    lock.release();
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('avecLock — release garanti même si fn lève', async () => {
  const d = tmp();
  try {
    const path = join(d, '.lock');
    await assert.rejects(
      avecLock(path, async () => { throw new Error('boom'); }),
      /boom/,
    );
    assert.ok(!existsSync(path), 'lock pas relâché après exception');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('avecLock — sérialise les exécutions concurrentes', async () => {
  const d = tmp();
  try {
    const path = join(d, '.lock');
    const ordre = [];

    const tache = (etiquette, ms) => avecLock(path, async () => {
      ordre.push(`${etiquette}:debut`);
      await new Promise((r) => setTimeout(r, ms));
      ordre.push(`${etiquette}:fin`);
    }, { retryDelayMs: 5 });

    // Lancées simultanément ; doivent s'exécuter en séquence.
    await Promise.all([tache('A', 30), tache('B', 10), tache('C', 5)]);

    // Pour chaque étiquette, son `debut` doit précéder son `fin`, et
    // les blocs ne doivent jamais s'entrelacer.
    for (const etq of ['A', 'B', 'C']) {
      const idxDebut = ordre.indexOf(`${etq}:debut`);
      const idxFin = ordre.indexOf(`${etq}:fin`);
      assert.ok(idxDebut >= 0 && idxFin === idxDebut + 1, `${etq} entrelacé : ${ordre.join(' ')}`);
    }
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
