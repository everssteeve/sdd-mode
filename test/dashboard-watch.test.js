// Tests du watcher .aiad/ pour `dashboard --serve --watch`.
// Vérifie debounce, ignorance des fichiers technique (lock, metrics, .DS_Store)
// et déclenchement effectif sur modification d'un fichier surveillé.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { watcher, devraitIgnorer } from '../lib/dashboard/watch.js';

function tmp() {
  const d = mkdtempSync(join(tmpdir(), 'aiad-watch-'));
  mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
  mkdirSync(join(d, '.aiad', 'metrics'), { recursive: true });
  return d;
}

function pause(ms) { return new Promise((r) => setTimeout(r, ms)); }

test('watcher — racine sans .aiad/ → throw', () => {
  const d = mkdtempSync(join(tmpdir(), 'aiad-watch-no-'));
  try {
    assert.throws(() => watcher(d, () => {}), /\.aiad\//);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('watcher — déclenche onChange après debounce sur écriture SPEC', async () => {
  const d = tmp();
  let appels = 0;
  let dernier = null;
  const w = watcher(d, (filename) => { appels++; dernier = filename; }, { debounceMs: 100 });
  try {
    await pause(50);
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-W-1.md'), '# spec\n');
    await pause(300);
    assert.equal(appels, 1, `appels=${appels}`);
    assert.ok(dernier && dernier.includes('SPEC-W-1.md'), `dernier=${dernier}`);
  } finally {
    w.close();
    rmSync(d, { recursive: true, force: true });
  }
});

test('watcher — debounce groupe plusieurs writes rapides en un seul callback', async () => {
  const d = tmp();
  let appels = 0;
  const w = watcher(d, () => { appels++; }, { debounceMs: 80 });
  try {
    await pause(50);
    // 3 écritures dans la fenêtre de debounce
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-W-2.md'), '1');
    await pause(10);
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-W-2.md'), '2');
    await pause(10);
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-W-2.md'), '3');
    await pause(200);
    assert.equal(appels, 1, `debounce non respecté : ${appels} callback(s)`);
  } finally {
    w.close();
    rmSync(d, { recursive: true, force: true });
  }
});

// Tests fonction pure — plus déterministes que tester via fs.watch dont le
// comportement varie selon la plateforme (FSEvents sur macOS peut signaler
// le dossier parent même quand le fichier est dans la liste d'ignore).
test('devraitIgnorer — ignore .lock / metrics/ / fichiers temporaires', () => {
  assert.equal(devraitIgnorer('.emit-rules.lock'), true);
  assert.equal(devraitIgnorer('metrics/data.json'), true);
  assert.equal(devraitIgnorer('metrics/security/audit.md'), true);
  assert.equal(devraitIgnorer('specs/SPEC-001.md.swp'), true);
  assert.equal(devraitIgnorer('PRD.md~'), true);
  assert.equal(devraitIgnorer('.DS_Store'), true);
  assert.equal(devraitIgnorer('intents/.DS_Store'), true);

  // Ne doit PAS ignorer les artefacts utilisateur classiques
  assert.equal(devraitIgnorer('intents/INTENT-001.md'), false);
  assert.equal(devraitIgnorer('specs/SPEC-001-1-login.md'), false);
  assert.equal(devraitIgnorer('PRD.md'), false);
  assert.equal(devraitIgnorer('AGENT-GUIDE.md'), false);

  // filename vide / null → ne pas ignorer (laisse passer pour régénérer
  // le dashboard par sécurité quand fs.watch ne fournit pas le nom)
  assert.equal(devraitIgnorer(null), false);
  assert.equal(devraitIgnorer(''), false);
});

test('watcher — close arrête de surveiller', async () => {
  const d = tmp();
  let appels = 0;
  const w = watcher(d, () => { appels++; }, { debounceMs: 30 });
  await pause(30);
  w.close();
  writeFileSync(join(d, '.aiad', 'specs', 'SPEC-CLOSE.md'), '#');
  await pause(150);
  assert.equal(appels, 0, 'callback déclenché après close()');
  rmSync(d, { recursive: true, force: true });
});

test('watcher — fallback polling (AIAD_WATCH_POLL=1) détecte une écriture nichée', async () => {
  // Couvre le chemin polling — utilisé en prod sur Linux + Node < 20 où
  // fs.watch({recursive:true}) ne propage pas les sous-dossiers (.aiad/specs/).
  const d = tmp();
  const prev = process.env.AIAD_WATCH_POLL;
  process.env.AIAD_WATCH_POLL = '1';
  let appels = 0;
  let dernier = null;
  const w = watcher(d, (filename) => { appels++; dernier = filename; }, { debounceMs: 50, pollMs: 30 });
  try {
    await pause(50);
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-POLL-1.md'), '# spec\n');
    await pause(400);
    assert.equal(appels, 1, `appels=${appels}`);
    assert.ok(dernier && dernier.includes('SPEC-POLL-1.md'), `dernier=${dernier}`);
  } finally {
    w.close();
    if (prev === undefined) delete process.env.AIAD_WATCH_POLL;
    else process.env.AIAD_WATCH_POLL = prev;
    rmSync(d, { recursive: true, force: true });
  }
});
