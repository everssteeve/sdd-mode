// Tests pack gouvernance FR — ANSSI / PASSI / SecNumCloud / Homologation (#92).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKS, packExiste, listerPacks, installerPack } from '../lib/governance-packs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKS_DIR = join(__dirname, '..', 'templates', '.aiad', 'gouvernance-packs');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-fr-anssi-')); }

function silencer(fn) {
  return async (...args) => {
    const origLog = console.log;
    const origWrite = process.stdout.write.bind(process.stdout);
    console.log = () => {};
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { console.log = origLog; process.stdout.write = origWrite; }
  };
}

// ─── Registration ──────────────────────────────────────────────────────────

test('PACKS — fr-anssi enregistré comme extension France', () => {
  assert.ok(packExiste('fr-anssi'));
  assert.equal(PACKS['fr-anssi'].juridiction, 'France');
  assert.equal(PACKS['fr-anssi'].defaut, false);
  assert.match(PACKS['fr-anssi'].titre, /ANSSI|PASSI|SecNumCloud/);
});

test('listerPacks — fr-anssi présent dans la liste', () => {
  const liste = listerPacks();
  const pack = liste.find((p) => p.id === 'fr-anssi');
  assert.ok(pack, 'fr-anssi absent de listerPacks()');
  assert.equal(pack.juridiction, 'France');
});

// ─── Templates 4 agents ─────────────────────────────────────────────────────

test('templates fr-anssi — 4 agents Tier 1 livrés', () => {
  const dir = join(PACKS_DIR, 'fr-anssi');
  assert.ok(existsSync(dir), 'dossier fr-anssi/ absent');
  const fichiers = readdirSync(dir).filter((f) => f.endsWith('.md'));
  for (const attendu of ['AIAD-RGS.md', 'AIAD-PASSI.md', 'AIAD-SECNUMCLOUD.md', 'AIAD-HOMOLOGATION.md']) {
    assert.ok(fichiers.includes(attendu), `agent ${attendu} manquant`);
  }
});

test('templates fr-anssi — chaque agent a une structure valide (MISSION / DÉCLENCHEURS / TOUJOURS / JAMAIS)', () => {
  const dir = join(PACKS_DIR, 'fr-anssi');
  for (const f of ['AIAD-RGS.md', 'AIAD-PASSI.md', 'AIAD-SECNUMCLOUD.md', 'AIAD-HOMOLOGATION.md']) {
    const contenu = readFileSync(join(dir, f), 'utf-8');
    assert.match(contenu, /## MISSION/, `${f} : MISSION absente`);
    assert.match(contenu, /## DÉCLENCHEURS/, `${f} : DÉCLENCHEURS absent`);
    assert.match(contenu, /TOUJOURS/, `${f} : section TOUJOURS absente`);
    assert.match(contenu, /JAMAIS/, `${f} : section JAMAIS absente`);
    assert.match(contenu, /Droit de veto.*oui/i, `${f} : veto Tier 1 non déclaré`);
  }
});

test('templates fr-anssi — références ANSSI présentes (ssi.gouv.fr ou cyber.gouv.fr)', () => {
  const dir = join(PACKS_DIR, 'fr-anssi');
  for (const f of ['AIAD-RGS.md', 'AIAD-PASSI.md', 'AIAD-SECNUMCLOUD.md', 'AIAD-HOMOLOGATION.md']) {
    const contenu = readFileSync(join(dir, f), 'utf-8');
    assert.match(contenu, /ssi\.gouv\.fr|cyber\.gouv\.fr/, `${f} : aucune référence ANSSI`);
  }
});

test('templates fr-anssi — RGS cite annexe B1 (cryptographie)', () => {
  const contenu = readFileSync(join(PACKS_DIR, 'fr-anssi', 'AIAD-RGS.md'), 'utf-8');
  assert.match(contenu, /annexe B1/i);
  assert.match(contenu, /AES-256/);
  assert.match(contenu, /RSA.*3072|RSA.*≥/);
});

test('templates fr-anssi — PASSI cite les 5 portées qualifiées', () => {
  const contenu = readFileSync(join(PACKS_DIR, 'fr-anssi', 'AIAD-PASSI.md'), 'utf-8');
  assert.match(contenu, /Architecture/);
  assert.match(contenu, /Configuration/);
  assert.match(contenu, /Code source/);
  assert.match(contenu, /Tests d'intrusion/);
  assert.match(contenu, /organisationnel/);
});

test('templates fr-anssi — SecNumCloud cite extraterritorialité (CLOUD Act)', () => {
  const contenu = readFileSync(join(PACKS_DIR, 'fr-anssi', 'AIAD-SECNUMCLOUD.md'), 'utf-8');
  assert.match(contenu, /CLOUD Act|FISA|extraterritoriale/i);
  assert.match(contenu, /BYOK|HYOK|HSM/);
});

test('templates fr-anssi — Homologation cite 9 étapes PA-039', () => {
  const contenu = readFileSync(join(PACKS_DIR, 'fr-anssi', 'AIAD-HOMOLOGATION.md'), 'utf-8');
  assert.match(contenu, /PA-039/);
  assert.match(contenu, /9 étapes|neuf étapes/i);
  assert.match(contenu, /EBIOS/);
});

// ─── Installation pack dans projet ─────────────────────────────────────────

test('installerPack fr-anssi — copie les 4 agents dans .aiad/gouvernance/', silencer(async () => {
  const d = tmp();
  try {
    await installerPack(d, 'fr-anssi', { silencieux: true });
    const govDir = join(d, '.aiad', 'gouvernance');
    assert.ok(existsSync(govDir));
    for (const f of ['AIAD-RGS.md', 'AIAD-PASSI.md', 'AIAD-SECNUMCLOUD.md', 'AIAD-HOMOLOGATION.md']) {
      assert.ok(existsSync(join(govDir, f)), `${f} non installé`);
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerPack fr-anssi --dry-run — n\'écrit aucun fichier sur disque', silencer(async () => {
  const d = tmp();
  try {
    await installerPack(d, 'fr-anssi', { silencieux: true, dryRun: true });
    const govDir = join(d, '.aiad', 'gouvernance');
    assert.ok(!existsSync(govDir) || readdirSync(govDir).length === 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));
