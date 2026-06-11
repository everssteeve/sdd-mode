// Tests `aiad-sdd version-sync` — sync de version sur zones marquées (SPEC-013-3).
//
// Couvre les 5 cas limites de la SPEC + le pipeline check/sync :
//   1. prose hors marqueur intacte (C1)   2. marqueur mal formé → MarkerError
//   3. version pré-release injectée telle quelle   4. zones multiples
//   5. idempotence

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  appliquerVersion,
  compterZones,
  decouvrirFichiers,
  versionSync,
  lirePackageVersion,
  MarkerError,
  MARKER_START,
  MARKER_END,
} from '../lib/version-sync.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-vsync-')); }
function zone(v) { return `${MARKER_START}${v}${MARKER_END}`; }

function silencer(fn) {
  return (...args) => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { return fn(...args); }
    finally { process.stdout.write = orig; }
  };
}

// ─── Fonctions pures ─────────────────────────────────────────────────────────

test('appliquerVersion — remplace le contenu de la zone marquée', () => {
  const src = `Footer ${zone('1.0.0')} fin`;
  const r = appliquerVersion(src, '2.3.4');
  assert.equal(r.contenu, `Footer ${zone('2.3.4')} fin`);
  assert.equal(r.zones, 1);
  assert.equal(r.modifie, true);
});

test('cas 1 — prose hors marqueur JAMAIS modifiée (C1)', () => {
  // Versions historiques en prose, hors sentinelles : doivent rester intactes.
  const src = `# Nouveautés v1.7\nDepuis la v1.10, le footer affiche ${zone('1.10.0')}.\nVoir le changelog v1.11.`;
  const r = appliquerVersion(src, '1.18.0');
  assert.match(r.contenu, /Nouveautés v1\.7/);
  assert.match(r.contenu, /changelog v1\.11/);
  assert.equal(r.contenu, `# Nouveautés v1.7\nDepuis la v1.10, le footer affiche ${zone('1.18.0')}.\nVoir le changelog v1.11.`);
});

test('cas 2 — marqueur mal formé → MarkerError, aucune transformation', () => {
  assert.throws(() => appliquerVersion(`a ${MARKER_START} b`, '1.0.0'), MarkerError); // START sans END
  assert.throws(() => appliquerVersion(`a ${MARKER_END} b`, '1.0.0'), MarkerError); // END sans START
  assert.throws(() => appliquerVersion(`${MARKER_END}x${MARKER_START}`, '1.0.0'), MarkerError); // END avant START
});

test('cas 3 — version pré-release injectée telle quelle', () => {
  const r = appliquerVersion(`v${zone('1.0.0')}`, '1.18.0-rc.1');
  assert.equal(r.contenu, `v${zone('1.18.0-rc.1')}`);
});

test('cas 4 — zones multiples toutes synchronisées', () => {
  const src = `${zone('1.0.0')} milieu ${zone('0.9.0')} fin`;
  const r = appliquerVersion(src, '2.0.0');
  assert.equal(r.zones, 2);
  assert.equal(r.contenu, `${zone('2.0.0')} milieu ${zone('2.0.0')} fin`);
});

test('cas 5 — idempotence (2e passage → aucun changement)', () => {
  const src = `x ${zone('1.0.0')} y`;
  const un = appliquerVersion(src, '1.18.0');
  const deux = appliquerVersion(un.contenu, '1.18.0');
  assert.equal(deux.modifie, false);
  assert.equal(deux.contenu, un.contenu);
});

test('compterZones — appariement correct', () => {
  assert.equal(compterZones('rien ici'), 0);
  assert.equal(compterZones(`${zone('a')}${zone('b')}`), 2);
  assert.throws(() => compterZones(MARKER_START), MarkerError);
});

// ─── Pipeline (découverte + check/sync sur disque) ───────────────────────────

function projet(versionPkg, fichiers) {
  const d = tmp();
  writeFileSync(join(d, 'package.json'), JSON.stringify({ name: 't', version: versionPkg }));
  mkdirSync(join(d, 'site'), { recursive: true });
  for (const [rel, contenu] of Object.entries(fichiers)) {
    const abs = join(d, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, contenu);
  }
  return d;
}

test('decouvrirFichiers — ne retient que les fichiers à sentinelle sous site/', () => {
  const d = projet('1.18.0', {
    'site/index.html': `<footer>${zone('1.0.0')}</footer>`,
    'site/about.html': '<p>pas de version</p>',
  });
  try {
    const found = decouvrirFichiers(d).map((f) => f.split('/').pop()).sort();
    assert.deepEqual(found, ['index.html']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('versionSync --check — exit drift sur écart, ok si synchronisé', () => {
  const d = projet('1.18.0', { 'site/index.html': `<footer>${zone('1.0.0')}</footer>` });
  try {
    const avant = readFileSync(join(d, 'site/index.html'), 'utf-8');
    const check = silencer(versionSync)(d, { check: true });
    assert.equal(check.drift, true);
    assert.equal(check.ok, false);
    // --check n'écrit rien
    assert.equal(readFileSync(join(d, 'site/index.html'), 'utf-8'), avant);

    // sync réel
    const sync = silencer(versionSync)(d, {});
    assert.equal(sync.zones, 1);
    assert.match(readFileSync(join(d, 'site/index.html'), 'utf-8'), new RegExp(`>1\\.18\\.0<`));

    // re-check → vert + idempotent
    const recheck = silencer(versionSync)(d, { check: true });
    assert.equal(recheck.drift, false);
    assert.equal(recheck.ok, true);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('versionSync --dry-run — détecte sans écrire', () => {
  const d = projet('1.18.0', { 'site/f.md': `footer ${zone('0.0.1')}` });
  try {
    const avant = readFileSync(join(d, 'site/f.md'), 'utf-8');
    const r = silencer(versionSync)(d, { dryRun: true });
    assert.equal(r.drift, true);
    assert.equal(readFileSync(join(d, 'site/f.md'), 'utf-8'), avant);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lirePackageVersion — lit la version du projet courant', () => {
  assert.match(lirePackageVersion(), /^\d+\.\d+\.\d+/);
});
