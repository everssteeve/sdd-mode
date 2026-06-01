// AIAD SDD Mode — Verrou inter-processus simple, zero-dep.
//
// Évite que deux invocations concurrentes de `emit-rules` (ou autres
// commandes critiques) écrivent les mêmes fichiers en même temps — scénario
// réaliste en CI quand plusieurs jobs lancent `aiad-sdd emit-rules` en
// parallèle (matrix builds, hooks, monorepos).
//
// Mécanisme : création atomique d'un fichier via `O_EXCL` (flag `wx` de
// Node). Si le fichier existe déjà :
//   - et qu'il est frais → on retry avec backoff
//   - et qu'il est stale (> staleMs) ou que son PID est mort → on le
//     supprime et on retry l'acquisition
//
// Documentation : https://aiad.ovh

import { existsSync, openSync, writeSync, closeSync, unlinkSync, readFileSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

const DEFAULTS = {
  staleMs: 30_000,
  retries: 50,
  retryDelayMs: 100,
};

function pause(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pidVivant(pid) {
  if (!pid || typeof pid !== 'number') return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function lireMeta(path) {
  try {
    const brut = readFileSync(path, 'utf-8');
    return JSON.parse(brut);
  } catch { return null; }
}

function lockEstStale(path, { staleMs }) {
  let st;
  try { st = statSync(path); } catch { return false; }
  if (Date.now() - st.mtimeMs > staleMs) return true;
  const meta = lireMeta(path);
  if (meta && meta.pid && !pidVivant(meta.pid)) return true;
  return false;
}

function tenterCreer(path) {
  // Crée les dossiers parents au besoin pour éviter ENOENT sur le lock.
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  let fd;
  try {
    fd = openSync(path, 'wx'); // exclusive create
  } catch (err) {
    if (err.code === 'EEXIST') return null;
    throw err;
  }
  const meta = JSON.stringify({ pid: process.pid, time: Date.now() });
  writeSync(fd, meta);
  closeSync(fd);
  return path;
}

/**
 * Tente d'acquérir un verrou exclusif sur `path`. Si un autre process le
 * détient et qu'il n'est pas stale, attend jusqu'à `retries × retryDelayMs`
 * avant de rejeter avec `Error('lock occupé')`.
 *
 * @returns {Promise<{ path: string, release: () => void }>}
 */
export async function acquireLock(path, options = {}) {
  const opts = { ...DEFAULTS, ...options };

  for (let i = 0; i <= opts.retries; i++) {
    const acquired = tenterCreer(path);
    if (acquired) {
      return {
        path,
        release: () => { try { unlinkSync(path); } catch { /* ignore */ } },
      };
    }
    if (lockEstStale(path, opts)) {
      try { unlinkSync(path); } catch { /* ignore */ }
      continue; // retente immédiatement
    }
    if (i < opts.retries) await pause(opts.retryDelayMs);
  }

  const meta = lireMeta(path) || {};
  throw new Error(
    `Verrou ${path} occupé (pid ${meta.pid || '?'}). Si tu es certain qu'aucune autre instance ne tourne, supprime le fichier manuellement.`,
  );
}

/**
 * Wrapper synchrone simple : acquérir, exécuter, libérer.
 * Garantie : `release()` est toujours appelé, y compris si fn lève.
 */
export async function avecLock(path, fn, options = {}) {
  const lock = await acquireLock(path, options);
  try {
    return await fn();
  } finally {
    lock.release();
  }
}
