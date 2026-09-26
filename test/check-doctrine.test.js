// Tests `scripts/check-doctrine.js` — contrôle de drift de la doctrine livrée.
//
// @intent INTENT-034
// @spec SPEC-034-2-controle-drift-doctrine
//
// Fixtures en dossiers temporaires (jamais le vrai Drive). Le dépôt fixture
// est produit par la vraie `syncDoctrine` (SPEC-034-1a) : le lock et les
// fichiers livrés sont donc exactement ceux qu'écrirait la sync. Le dépôt
// réel est contrôlé en mode CI (lecture seule).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CORRESPONDANCES, LOCK_PATH, syncDoctrine } from '../scripts/sync-doctrine.js';
import {
  CODE_CONFORME,
  CODE_DRIFT,
  CODE_INDECIDABLE,
  DoctrineIndecidableError,
  lireLock,
  verifierCi,
  verifierRelease,
  main,
} from '../scripts/check-doctrine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RACINE_DEPOT = join(__dirname, '..');
const SCRIPT = join(RACINE_DEPOT, 'scripts', 'check-doctrine.js');
const muet = () => {};

function tmp(prefixe) { return mkdtempSync(join(tmpdir(), `aiad-checkdoc-${prefixe}-`)); }

function ecrire(racine, rel, contenu) {
  const p = join(racine, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, contenu, 'utf-8');
}

/** Source `published/md/` complète, avec des liens relevant des règles 1, 1b, 2 et 3. */
function fixtureSource() {
  const src = tmp('src');
  for (const c of CORRESPONDANCES) ecrire(src, c.source, `# ${c.source}\n\nContenu de ${c.source}.\n`);
  ecrire(src, '20_conception/framework/frameworkAIAD.md',
    '# Guide AIAD — Framework v1.9\n\nVoir `../gouvernance/AIAD-AI-ACT.md`.\n'
    + 'Argumentaire : `../../30_distribution/decideurs/argumentaires/governance-gap-2026.md`.\n');
  ecrire(src, '20_conception/framework/legitimation/execution-gate-evidence.md',
    '# Preuves\n\n- [Dette](../../../30_distribution/decideurs/argumentaires/dette-maintenance-agentique.md)\n'
    + '- Contexte : `../legitimation/conformite-cas-2026.md`\n');
  return src;
}

/** Dépôt conforme : produit par la vraie sync depuis `src`. */
async function depotSynchronise(src) {
  const depot = tmp('depot');
  // Fichier local → règle 1b lors de la réécriture (cf. SPEC-034-1a).
  ecrire(depot, 'docs/legitimation/dette-maintenance-agentique.md', '# Dette\n');
  await syncDoctrine({ source: src, racine: depot, emit: false, log: muet });
  return depot;
}

function nettoyer(...dossiers) { for (const d of dossiers) rmSync(d, { recursive: true, force: true }); }

function capturer() {
  const lignes = [];
  const push = (m) => lignes.push(m);
  return { lignes, ctx: { log: push, erreur: push }, texte: () => lignes.join('\n') };
}

// ─── Dépôt réel (garde-fou CI) ──────────────────────────────────────────────

test('dépôt réel — mode CI conforme (fichiers livrés = lock)', () => {
  const r = verifierCi(RACINE_DEPOT);
  assert.deepEqual(r.ecarts, []);
  assert.equal(r.exitCode, CODE_CONFORME);
});

// ─── CA-001 — Conformité ────────────────────────────────────────────────────

test('CA-001 — tous les fichiers du lock conformes → exit 0 (mode CI)', async () => {
  const src = fixtureSource();
  const depot = await depotSynchronise(src);
  try {
    const r = verifierCi(depot);
    assert.equal(r.exitCode, CODE_CONFORME);
    assert.equal(r.version, 'v1.9');
    assert.equal(Object.keys(lireLock(depot).files).length, 14);
    const c = capturer();
    assert.equal(main([], { racine: depot, ...c.ctx }), CODE_CONFORME);
    assert.match(c.texte(), /conforme \(mode CI\)/);
  } finally { nettoyer(src, depot); }
});

test('mode release — Drive identique au lock (réécriture 1/1b/2/3 identique à la sync) → exit 0', async () => {
  const src = fixtureSource();
  const depot = await depotSynchronise(src);
  try {
    // La fixture contient des liens réécrits : sans la même réécriture, l'empreinte différerait.
    assert.match(readFileSync(join(depot, 'docs/legitimation/execution-gate-evidence.md'), 'utf-8'),
      /docs\/legitimation\/dette-maintenance-agentique\.md/);
    const r = verifierRelease(depot, src);
    assert.deepEqual(r.ecarts, []);
    assert.equal(r.exitCode, CODE_CONFORME);
    assert.deepEqual(r.version, { lock: 'v1.9', source: 'v1.9' });
    assert.equal(main(['--source', src], { racine: depot, ...capturer().ctx }), CODE_CONFORME);
  } finally { nettoyer(src, depot); }
});

// ─── CA-002 / CA-002b — Modification directe dans le package ───────────────

test('CA-002 / CA-002b — fichier livré modifié → exit 1 et chemin affiché', async () => {
  const src = fixtureSource();
  const depot = await depotSynchronise(src);
  try {
    ecrire(depot, 'templates/.aiad/gouvernance/AIAD-RGPD.md', '# Modifié à la main dans le package\n');
    const r = verifierCi(depot);
    assert.equal(r.exitCode, CODE_DRIFT);
    assert.deepEqual(r.ecarts.map((e) => e.fichier), ['templates/.aiad/gouvernance/AIAD-RGPD.md']);
    const c = capturer();
    assert.equal(main([], { racine: depot, ...c.ctx }), CODE_DRIFT);
    assert.match(c.texte(), /templates\/\.aiad\/gouvernance\/AIAD-RGPD\.md/);
  } finally { nettoyer(src, depot); }
});

test('CA-002 — fichier listé dans le lock absent → exit 1 (drift, fichier nommé)', async () => {
  const src = fixtureSource();
  const depot = await depotSynchronise(src);
  try {
    rmSync(join(depot, 'templates/SDDMode.md'));
    const r = verifierCi(depot);
    assert.equal(r.exitCode, CODE_DRIFT);
    assert.deepEqual(r.ecarts, [{ fichier: 'templates/SDDMode.md', motif: 'fichier absent' }]);
  } finally { nettoyer(src, depot); }
});

// ─── CA-003 — Version différente du Drive ──────────────────────────────────

test('CA-003 — version du titre source ≠ doctrineVersion → exit 1 (mode release)', async () => {
  const src = fixtureSource();
  const depot = await depotSynchronise(src);
  try {
    const f = join(src, '20_conception/framework/frameworkAIAD.md');
    writeFileSync(f, readFileSync(f, 'utf-8').replace('Framework v1.9', 'Framework v2.0'), 'utf-8');
    const r = verifierRelease(depot, src);
    assert.equal(r.exitCode, CODE_DRIFT);
    assert.deepEqual(r.version, { lock: 'v1.9', source: 'v2.0' });
    assert.ok(r.ecarts.some((e) => /v2\.0.*v1\.9/.test(e.motif)));
    const c = capturer();
    assert.equal(main(['--source', src], { racine: depot, ...c.ctx }), CODE_DRIFT);
    assert.match(c.texte(), /version de doctrine v2\.0/);
  } finally { nettoyer(src, depot); }
});

// ─── CA-004 — Même version, contenu différent ──────────────────────────────

test('CA-004 — même version, contenu Drive différent → exit 1, cibles listées', async () => {
  const src = fixtureSource();
  const depot = await depotSynchronise(src);
  try {
    ecrire(src, '20_conception/gouvernance/AIAD-RGAA.md', '# RGAA — mis à jour sur le Drive\n');
    const r = verifierRelease(depot, src);
    assert.equal(r.exitCode, CODE_DRIFT);
    assert.deepEqual(r.version, { lock: 'v1.9', source: 'v1.9' });
    assert.deepEqual(r.ecarts.map((e) => e.fichier).sort(),
      ['.aiad/gouvernance/AIAD-RGAA.md', 'templates/.aiad/gouvernance/AIAD-RGAA.md']);
    // Le mode CI (fichiers livrés) reste conforme : c'est le Drive qui a bougé.
    assert.equal(verifierCi(depot).exitCode, CODE_CONFORME);
  } finally { nettoyer(src, depot); }
});

// ─── CA-005 — Lock absent ──────────────────────────────────────────────────

test('CA-005 — lock absent → exit 2 (mode CI et mode release)', async () => {
  const src = fixtureSource();
  const depot = await depotSynchronise(src);
  try {
    rmSync(join(depot, LOCK_PATH));
    assert.throws(() => verifierCi(depot), DoctrineIndecidableError);
    assert.throws(() => verifierRelease(depot, src), DoctrineIndecidableError);
    const c = capturer();
    assert.equal(main([], { racine: depot, ...c.ctx }), CODE_INDECIDABLE);
    assert.match(c.texte(), /doctrine\.lock\.json absent/);
    assert.equal(main(['--source', src], { racine: depot, ...capturer().ctx }), CODE_INDECIDABLE);
  } finally { nettoyer(src, depot); }
});

test('lock illisible (JSON invalide) → exit 2', () => {
  const depot = tmp('depot');
  try {
    ecrire(depot, LOCK_PATH, '{ pas du json');
    assert.equal(main([], { racine: depot, ...capturer().ctx }), CODE_INDECIDABLE);
  } finally { nettoyer(depot); }
});

// ─── CA-006 — Source Drive inaccessible ────────────────────────────────────

test('CA-006 — --source inexistant → exit 2 (mode release)', async () => {
  const src = fixtureSource();
  const depot = await depotSynchronise(src);
  try {
    const c = capturer();
    assert.equal(main(['--source', join(src, 'nexiste-pas')], { racine: depot, ...c.ctx }), CODE_INDECIDABLE);
    assert.match(c.texte(), /Source introuvable/);
    assert.equal(main(['--source', ''], { racine: depot, ...capturer().ctx }), CODE_INDECIDABLE);
  } finally { nettoyer(src, depot); }
});

test('mode release — fichier source manquant sur le Drive → exit 2 (indécidable)', async () => {
  const src = fixtureSource();
  const depot = await depotSynchronise(src);
  try {
    rmSync(join(src, '20_conception/sdd-mode/SDDMode.md'));
    const c = capturer();
    assert.equal(main(['--source', src], { racine: depot, ...c.ctx }), CODE_INDECIDABLE);
    assert.match(c.texte(), /SDDMode\.md/);
  } finally { nettoyer(src, depot); }
});

test('option inconnue → exit 2', () => {
  assert.equal(main(['--wat'], { racine: RACINE_DEPOT, ...capturer().ctx }), CODE_INDECIDABLE);
});

// ─── CLI (process réel) ─────────────────────────────────────────────────────

test('CLI — codes de sortie 0 / 1 / 2 et lecture seule', async () => {
  const src = fixtureSource();
  const depot = await depotSynchronise(src);
  try {
    // Le script contrôle son propre dépôt en mode CI : conforme.
    assert.equal(spawnSync('node', [SCRIPT], { encoding: 'utf-8' }).status, 0);
    const avant = readFileSync(join(RACINE_DEPOT, LOCK_PATH), 'utf-8');
    const r2 = spawnSync('node', [SCRIPT, '--source', join(src, 'absent')], { encoding: 'utf-8' });
    assert.equal(r2.status, 2);
    assert.equal(readFileSync(join(RACINE_DEPOT, LOCK_PATH), 'utf-8'), avant);
    // Drift : le dépôt réel comparé à une source fixture (contenu différent) → 1.
    const r1 = spawnSync('node', [SCRIPT, '--source', src], { encoding: 'utf-8' });
    assert.equal(r1.status, 1);
    assert.match(r1.stdout, /templates\/frameworkAIAD\.md/);
  } finally { nettoyer(src, depot); }
});
