// @spec SPEC-017-3-digest-delta
// @verified-by test/dashboard-digest.test.js

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, rmSync, existsSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  lireDernierSnapshotDigest,
  calculerDigestDelta,
  ecrireSnapshotDigest,
  blocDigestDelta,
} from '../lib/dashboard/digest-delta.js';

function tmpDir(suffix = '') {
  const dir = join(tmpdir(), `aiad-digest-test-${Date.now()}-${suffix}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function donneesMock(opts = {}) {
  return {
    specs: opts.specs ?? [
      { statut: 'done' },
      { statut: 'done' },
      { statut: 'draft' },
    ],
    intents: opts.intents ?? [
      { statut: 'done' },
      { statut: 'active' },
      { statut: 'archived' },
    ],
    pm: { zombies: opts.zombies ?? [{ id: 'Z1' }] },
    santeGlobale: { score: opts.score ?? 80 },
  };
}

// CA-001 — Écriture snapshot à chaque run
test('CA-001 — snapshot written on every run', () => {
  const racine = tmpDir('ca001');
  const donnees = donneesMock();
  const result = ecrireSnapshotDigest(racine, donnees);
  assert.ok(result.ecrit, 'ecrit doit être true');
  assert.ok(existsSync(result.fichier), 'fichier doit exister');
  const snap = JSON.parse(readFileSync(result.fichier, 'utf-8'));
  assert.ok(snap.generatedAt, 'generatedAt présent');
  assert.ok(typeof snap.specsCount === 'object', 'specsCount présent');
  assert.ok(typeof snap.intentsCount === 'object', 'intentsCount présent');
  assert.equal(typeof snap.zombiesCount, 'number', 'zombiesCount présent');
  assert.equal(typeof snap.santeScore, 'number', 'santeScore présent');
  rmSync(racine, { recursive: true });
});

// CA-002 — Contenu du delta affiché (4 valeurs)
test('CA-002 — 4 delta values displayed when snapshot exists', () => {
  const racine = tmpDir('ca002');
  const snapshot = {
    generatedAt: '2026-06-20T10:00:00.000Z',
    specsCount: { done: 1, draft: 1, active: 0 },
    intentsCount: { done: 1, active: 2, archived: 0 },
    zombiesCount: 0,
    santeScore: 70,
  };
  const donnees = donneesMock({ score: 80 });
  donnees.specs = [{ statut: 'done' }, { statut: 'done' }, { statut: 'draft' }];
  donnees.intents = [{ statut: 'done' }, { statut: 'active' }, { statut: 'archived' }];
  donnees.pm = { zombies: [{ id: 'Z1' }] };
  const result = calculerDigestDelta(donnees, snapshot);
  assert.ok(result.delta !== null, 'delta doit être non-null');
  assert.equal(result.delta.specsDone, 1, 'specsDone delta');
  assert.equal(result.delta.intentsArchived, 1, 'intentsArchived delta');
  assert.equal(result.delta.zombies, 1, 'zombies delta');
  assert.equal(result.delta.santeScore, 10, 'santeScore delta');
  rmSync(racine, { recursive: true });
});

// CA-003a — Message première génération
test('CA-003a — "Première génération" message when no snapshot', () => {
  const result = calculerDigestDelta(donneesMock(), null);
  assert.ok(result.message.includes('Première génération'), 'message première génération');
});

// CA-003b — Aucun delta numérique en première génération
test('CA-003b — no numeric delta when no snapshot', () => {
  const result = calculerDigestDelta(donneesMock(), null);
  assert.equal(result.delta, null, 'delta doit être null en première génération');
  const html = blocDigestDelta({ digestDelta: result });
  assert.ok(!html.match(/\+\d|\-\d/), 'aucune valeur numérique delta dans le HTML');
});

// CA-004a — Warning si snapshot illisible
test('CA-004a — console.warn emitted when snapshot is invalid JSON', () => {
  const racine = tmpDir('ca004a');
  const dir = join(racine, '.aiad', 'metrics', 'digest');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '2026-06-20-1000.json'), 'NOT JSON', 'utf-8');
  const warned = [];
  const origWarn = console.warn;
  console.warn = (...args) => warned.push(args.join(' '));
  lireDernierSnapshotDigest(racine);
  console.warn = origWarn;
  assert.ok(warned.some((m) => m.includes('2026-06-20-1000.json')), 'warn doit contenir le chemin du fichier');
  rmSync(racine, { recursive: true });
});

// CA-004b — Repli première génération si snapshot illisible
test('CA-004b — falls back to first-run when snapshot is invalid JSON', () => {
  const racine = tmpDir('ca004b');
  const dir = join(racine, '.aiad', 'metrics', 'digest');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '2026-06-20-1000.json'), 'NOT JSON', 'utf-8');
  const origWarn = console.warn;
  console.warn = () => {};
  const snap = lireDernierSnapshotDigest(racine);
  console.warn = origWarn;
  assert.equal(snap, null, 'retourne null pour snapshot illisible');
  const result = calculerDigestDelta(donneesMock(), snap);
  assert.equal(result.delta, null, 'delta null = repli première génération');
  rmSync(racine, { recursive: true });
});

// CA-005 — Aucun delta
test('CA-005 — "Aucun changement" message when all deltas are zero', () => {
  const snapshot = {
    generatedAt: '2026-06-20T10:00:00.000Z',
    specsCount: { done: 2, draft: 1, active: 0 },
    intentsCount: { done: 1, active: 1, archived: 1 },
    zombiesCount: 1,
    santeScore: 80,
  };
  const donnees = donneesMock();
  const result = calculerDigestDelta(donnees, snapshot);
  assert.ok(result.message === 'Aucun changement depuis la dernière génération.', 'message aucun changement');
  const html = blocDigestDelta({ digestDelta: result });
  assert.ok(html.includes('Aucun changement'), 'HTML contient le message');
});

// CA-006a — Répertoire créé automatiquement
test('CA-006a — digest directory created if absent', () => {
  const racine = tmpDir('ca006a');
  const expectedDir = join(racine, '.aiad', 'metrics', 'digest');
  assert.ok(!existsSync(expectedDir), 'répertoire absent avant le run');
  ecrireSnapshotDigest(racine, donneesMock());
  assert.ok(existsSync(expectedDir), 'répertoire créé après le run');
  rmSync(racine, { recursive: true });
});

// CA-006b — Pas d'erreur si répertoire absent
test('CA-006b — no uncaught error when directory is absent', () => {
  const racine = tmpDir('ca006b');
  assert.doesNotThrow(() => {
    ecrireSnapshotDigest(racine, donneesMock());
  });
  rmSync(racine, { recursive: true });
});

// CA-007 — Deltas calculés sur état réel
test('CA-007 — delta computed by comparing current donnees to snapshot', () => {
  const snapshot = {
    generatedAt: '2026-06-01T00:00:00.000Z',
    specsCount: { done: 5, draft: 2, active: 1 },
    intentsCount: { done: 3, active: 4, archived: 2 },
    zombiesCount: 2,
    santeScore: 60,
  };
  const donnees = donneesMock({ score: 75 });
  donnees.specs = [
    { statut: 'done' }, { statut: 'done' }, { statut: 'done' },
    { statut: 'done' }, { statut: 'done' }, { statut: 'done' }, // 6 done
    { statut: 'draft' },
  ];
  donnees.intents = [
    { statut: 'done' }, { statut: 'done' }, { statut: 'done' },
    { statut: 'active' },
    { statut: 'archived' }, { statut: 'archived' }, { statut: 'archived' }, // 3 archived
  ];
  donnees.pm = { zombies: [] };
  const result = calculerDigestDelta(donnees, snapshot);
  assert.equal(result.delta.specsDone, 1, 'specsDone = 6 - 5 = 1');
  assert.equal(result.delta.intentsArchived, 1, 'intentsArchived = 3 - 2 = 1');
  assert.equal(result.delta.zombies, -2, 'zombies = 0 - 2 = -2');
  assert.equal(result.delta.santeScore, 15, 'santeScore = 75 - 60 = 15');
});
