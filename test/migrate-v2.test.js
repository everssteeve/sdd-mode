// Tests #129 — Squelette migration v1 → v2.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  detecter, lister, migrate, TRANSFORMS_V2, detect, list, migrateV2,
  creerBackup, listerBackups, prunerBackups, restoreBackup,
  createBackup, listBackups, pruneBackups, restoreBackupEN,
  rewriteIntentToParentIntent, detecterConventionLegacy, TRANSFORM_INTENT_TO_PARENT_INTENT,
  detectLegacyConvention, rewriteIntentToParentIntentEN,
} from '../lib/migrate-v2.js';

function tmpProjet() {
  return mkdtempSync(join(tmpdir(), 'aiad-migv2-'));
}

function projetV1(racine) {
  mkdirSync(join(racine, '.aiad'));
  mkdirSync(join(racine, '.aiad', 'intents'));
  mkdirSync(join(racine, '.aiad', 'specs'));
  writeFileSync(join(racine, '.aiad', 'intents', 'INTENT-001-x.md'), '---\nid: INTENT-001\nstatut: validated\n---\n');
  writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-001-1-x.md'), '---\nid: SPEC-001-1-x\nstatut: ready\n---\n');
}

function projetV110(racine) {
  projetV1(racine);
  mkdirSync(join(racine, '.aiad', 'metrics'));
  mkdirSync(join(racine, '.aiad', 'metrics', 'traceability'));
}

function projetV114(racine) {
  projetV110(racine);
  mkdirSync(join(racine, '.aiad', 'metrics', 'standup'));
  mkdirSync(join(racine, '.aiad', 'facts'));
}

test('detecter — sans .aiad/ → exists=false', () => {
  const r = detecter(tmpProjet());
  assert.equal(r.exists, false);
  assert.equal(r.version, null);
  assert.deepEqual(r.marqueurs, []);
});

test('detecter — projet v1 minimal → version=v1.x', () => {
  const racine = tmpProjet();
  try {
    projetV1(racine);
    const r = detecter(racine);
    assert.equal(r.exists, true);
    assert.equal(r.version, 'v1.x');
    assert.deepEqual(r.marqueurs, []);
    assert.equal(r.fichiers, 2);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('detecter — projet v1.10+ détecté via metrics/traceability', () => {
  const racine = tmpProjet();
  try {
    projetV110(racine);
    const r = detecter(racine);
    assert.equal(r.version, 'v1.10+');
    assert.ok(r.marqueurs.includes('v1.10+'));
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('detecter — projet v1.14+ détecté (3 marqueurs cumulatifs)', () => {
  const racine = tmpProjet();
  try {
    projetV114(racine);
    const r = detecter(racine);
    assert.equal(r.version, 'v1.14+');
    assert.deepEqual(r.marqueurs.sort(), ['v1.10+', 'v1.14+', 'v1.6+']);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lister — vide tant que v2 non défini', () => {
  assert.deepEqual(lister('v1.x', 'v2.0'), []);
  assert.equal(TRANSFORMS_V2.length, 0);
});

test('migrate — pas de .aiad/ → ok=false raison=aiad-absent', async () => {
  const racine = tmpProjet();
  try {
    const r = await migrate(racine);
    assert.equal(r.ok, false);
    assert.equal(r.raison, 'aiad-absent');
    assert.match(r.message, /aiad-sdd init/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('migrate — projet v1, dry-run par défaut, 0 transform → message clair', async () => {
  const racine = tmpProjet();
  try {
    projetV1(racine);
    const r = await migrate(racine);
    assert.equal(r.ok, true);
    assert.equal(r.mode, 'dry-run');
    assert.match(r.message, /v2 n'est pas encore définie/);
    assert.deepEqual(r.plan, []);
    assert.deepEqual(r.appliquees, []);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('migrate — apply sans transform → ok=true 0 appliquée', async () => {
  const racine = tmpProjet();
  try {
    projetV114(racine);
    const r = await migrate(racine, { apply: true });
    assert.equal(r.ok, true);
    assert.equal(r.mode, 'apply');
    assert.deepEqual(r.appliquees, []);
    assert.deepEqual(r.erreurs, []);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('migrate — transform fictive sans applique → erreur captée', async () => {
  // Test du mécanisme d'extension : on injecte temporairement une transform
  // mal formée pour vérifier que l'orchestration échoue proprement sans
  // crash global.
  const racine = tmpProjet();
  try {
    projetV1(racine);
    TRANSFORMS_V2.push({ id: 'test-broken', titre: 'transform sans applique', decrit: () => [] });
    const r = await migrate(racine, { apply: true });
    assert.equal(r.ok, false);
    assert.equal(r.erreurs.length, 1);
    assert.equal(r.erreurs[0].id, 'test-broken');
    assert.equal(r.erreurs[0].raison, 'applique-absent');
  } finally {
    // Cleanup pour ne pas polluer les autres tests.
    const idx = TRANSFORMS_V2.findIndex((t) => t.id === 'test-broken');
    if (idx >= 0) TRANSFORMS_V2.splice(idx, 1);
    rmSync(racine, { recursive: true, force: true });
  }
});

test('migrate — transform complète appliquée → ok=true', async () => {
  // Vérifie que le mécanisme d'apply fonctionne quand une transform est
  // bien formée. Démontre l'extensibilité du squelette.
  const racine = tmpProjet();
  try {
    projetV1(racine);
    let calls = 0;
    TRANSFORMS_V2.push({
      id: 'test-noop',
      titre: 'transform no-op valide',
      decrit() { return []; },
      applique() { calls += 1; },
    });
    const r = await migrate(racine, { apply: true });
    assert.equal(r.ok, true);
    assert.equal(r.appliquees.length, 1);
    assert.equal(r.appliquees[0].id, 'test-noop');
    assert.equal(calls, 1, 'applique appelée une fois');
  } finally {
    const idx = TRANSFORMS_V2.findIndex((t) => t.id === 'test-noop');
    if (idx >= 0) TRANSFORMS_V2.splice(idx, 1);
    rmSync(racine, { recursive: true, force: true });
  }
});

test('Alias EN canoniques (detect / list / migrateV2)', () => {
  assert.equal(detect, detecter);
  assert.equal(list, lister);
  assert.equal(migrateV2, migrate);
});

// ─── CLI E2E ────────────────────────────────────────────────────────────────

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'aiad-sdd.js');

test('CLI migrate-v2 --json (sans .aiad) → exit 1 message clair', () => {
  const racine = tmpProjet();
  try {
    const r = spawnSync('node', [BIN, 'migrate-v2', '--json'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 1);
    const j = JSON.parse(r.stdout);
    assert.equal(j.ok, false);
    assert.equal(j.raison, 'aiad-absent');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('CLI migrate-v2 --json sur projet v1 → ok=true dry-run', () => {
  const racine = tmpProjet();
  try {
    projetV1(racine);
    const r = spawnSync('node', [BIN, 'migrate-v2', '--json'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 0);
    const j = JSON.parse(r.stdout);
    assert.equal(j.ok, true);
    assert.equal(j.mode, 'dry-run');
    assert.equal(j.detection.version, 'v1.x');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

// ─── #195 Backup / Rollback ─────────────────────────────────────────────────

test('creerBackup — sans .aiad/ → ok=false', () => {
  const r = creerBackup(tmpProjet());
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'aiad-absent');
});

test('creerBackup — copie récursive sans inclure migrations/', () => {
  const racine = tmpProjet();
  try {
    projetV1(racine);
    // Pré-existant migrations/ pour vérifier l'exclusion
    mkdirSync(join(racine, '.aiad', 'migrations'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'migrations', 'pre-existant.txt'), 'noise');
    const r = creerBackup(racine, { timestamp: '2026-05-13T17-00-00Z' });
    assert.equal(r.ok, true);
    assert.equal(r.files, 2, 'INTENT + SPEC, migrations/ exclu');
    assert.ok(existsSync(r.dir));
    assert.ok(existsSync(join(r.dir, 'intents', 'INTENT-001-x.md')));
    assert.equal(existsSync(join(r.dir, 'migrations')), false, 'pas de récursion');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('listerBackups — tri chronologique ascendant', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'migrations');
    mkdirSync(dir, { recursive: true });
    mkdirSync(join(dir, 'v2-backup-2026-05-13T17-00-00Z'));
    mkdirSync(join(dir, 'v2-backup-2026-04-01T10-00-00Z'));
    mkdirSync(join(dir, 'v2-backup-2026-05-13T18-00-00Z'));
    mkdirSync(join(dir, 'autre-dossier')); // ignoré
    const r = listerBackups(racine);
    assert.equal(r.length, 3);
    assert.deepEqual(r.map((b) => b.timestamp), [
      '2026-04-01T10-00-00Z',
      '2026-05-13T17-00-00Z',
      '2026-05-13T18-00-00Z',
    ]);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('prunerBackups — keep N plus récents, supprime les plus vieux', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'migrations');
    mkdirSync(dir, { recursive: true });
    for (const ts of [
      '2026-01-01T00-00-00Z',
      '2026-02-01T00-00-00Z',
      '2026-03-01T00-00-00Z',
      '2026-04-01T00-00-00Z',
      '2026-05-01T00-00-00Z',
      '2026-05-13T00-00-00Z',
    ]) {
      mkdirSync(join(dir, `v2-backup-${ts}`));
      writeFileSync(join(dir, `v2-backup-${ts}`, 'marker.txt'), ts);
    }
    const r = prunerBackups(racine, { keep: 3 });
    assert.equal(r.pruned.length, 3);
    assert.equal(r.kept, 3);
    assert.equal(existsSync(join(dir, 'v2-backup-2026-01-01T00-00-00Z')), false, 'vieux supprimé');
    assert.equal(existsSync(join(dir, 'v2-backup-2026-05-13T00-00-00Z')), true, 'récent gardé');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('prunerBackups — moins de N backups → rien à pruner', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'migrations');
    mkdirSync(dir, { recursive: true });
    mkdirSync(join(dir, 'v2-backup-2026-05-13T00-00-00Z'));
    const r = prunerBackups(racine, { keep: 5 });
    assert.deepEqual(r.pruned, []);
    assert.equal(r.kept, 1);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('prunerBackups — dryRun ne supprime pas', () => {
  const racine = tmpProjet();
  try {
    const dir = join(racine, '.aiad', 'migrations');
    mkdirSync(dir, { recursive: true });
    mkdirSync(join(dir, 'v2-backup-2025-01-01T00-00-00Z'));
    mkdirSync(join(dir, 'v2-backup-2026-05-13T00-00-00Z'));
    const r = prunerBackups(racine, { keep: 1, dryRun: true });
    assert.deepEqual(r.pruned, ['v2-backup-2025-01-01T00-00-00Z']);
    assert.equal(existsSync(join(dir, 'v2-backup-2025-01-01T00-00-00Z')), true);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('restoreBackup — restore le contenu du snapshot', () => {
  const racine = tmpProjet();
  try {
    projetV1(racine);
    const backup = creerBackup(racine, { timestamp: 'snap-1' });
    // Modifie le projet
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-001-1-x.md'), '---\nid: SPEC-001-1-x\nstatut: MODIFIE\n---\n');
    writeFileSync(join(racine, '.aiad', 'specs', 'NOUVEAU.md'), 'fichier ajouté');
    // Restore
    const r = restoreBackup(racine, backup);
    assert.equal(r.ok, true);
    const lu = readFileSync(join(racine, '.aiad', 'specs', 'SPEC-001-1-x.md'), 'utf-8');
    assert.match(lu, /statut: ready/, 'restored to original');
    assert.equal(existsSync(join(racine, '.aiad', 'specs', 'NOUVEAU.md')), false, 'fichier post-backup supprimé');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('restoreBackup — préserve le dossier migrations/ (où sont les backups)', () => {
  const racine = tmpProjet();
  try {
    projetV1(racine);
    const b1 = creerBackup(racine, { timestamp: 'snap-1' });
    const b2 = creerBackup(racine, { timestamp: 'snap-2' });
    restoreBackup(racine, b1);
    // Les 2 backups doivent toujours exister après restore
    assert.equal(existsSync(b1.dir), true, 'b1 préservé');
    assert.equal(existsSync(b2.dir), true, 'b2 préservé');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('restoreBackup — backup absent → ok=false', () => {
  const r = restoreBackup(tmpProjet(), { dir: '/nonexistent/path' });
  assert.equal(r.ok, false);
});

test('migrate apply — crée un backup avant la 1ère transform', async () => {
  const racine = tmpProjet();
  try {
    projetV1(racine);
    TRANSFORMS_V2.push({
      id: 'test-noop-backup',
      titre: 'no-op',
      decrit: () => [],
      applique: () => { /* no-op */ },
    });
    const r = await migrate(racine, { apply: true });
    assert.equal(r.ok, true);
    assert.ok(r.backup?.ok, 'backup créé');
    assert.equal(r.appliquees.length, 1);
    // Vérifie qu'un dossier v2-backup-* existe
    const backups = listerBackups(racine);
    assert.equal(backups.length, 1);
  } finally {
    const idx = TRANSFORMS_V2.findIndex((t) => t.id === 'test-noop-backup');
    if (idx >= 0) TRANSFORMS_V2.splice(idx, 1);
    rmSync(racine, { recursive: true, force: true });
  }
});

test('migrate apply — rollbackOnError restore le snapshot en cas d\'échec', async () => {
  const racine = tmpProjet();
  try {
    projetV1(racine);
    TRANSFORMS_V2.push({
      id: 'test-broken-tx',
      titre: 'transform qui crashe',
      decrit: () => [],
      applique: (r) => {
        // Modifie un fichier puis lève — simule un apply partiel
        writeFileSync(join(r, '.aiad', 'specs', 'CORRUPTED.md'), 'partiel');
        throw new Error('crash volontaire');
      },
    });
    const r = await migrate(racine, { apply: true, rollbackOnError: true });
    assert.equal(r.ok, false);
    assert.ok(r.rollback?.ok, 'rollback effectué');
    assert.equal(existsSync(join(racine, '.aiad', 'specs', 'CORRUPTED.md')), false, 'fichier partiel supprimé');
    assert.match(r.message, /rollback effectué/);
  } finally {
    const idx = TRANSFORMS_V2.findIndex((t) => t.id === 'test-broken-tx');
    if (idx >= 0) TRANSFORMS_V2.splice(idx, 1);
    rmSync(racine, { recursive: true, force: true });
  }
});

test('migrate apply — sans rollbackOnError, le fichier corrompu reste', async () => {
  const racine = tmpProjet();
  try {
    projetV1(racine);
    TRANSFORMS_V2.push({
      id: 'test-broken-noroll',
      titre: 'crash sans rollback',
      decrit: () => [],
      applique: (r) => {
        writeFileSync(join(r, '.aiad', 'specs', 'CORRUPTED.md'), 'partiel');
        throw new Error('crash');
      },
    });
    const r = await migrate(racine, { apply: true });
    assert.equal(r.ok, false);
    assert.equal(r.rollback, null);
    assert.equal(existsSync(join(racine, '.aiad', 'specs', 'CORRUPTED.md')), true, 'partiel conservé');
  } finally {
    const idx = TRANSFORMS_V2.findIndex((t) => t.id === 'test-broken-noroll');
    if (idx >= 0) TRANSFORMS_V2.splice(idx, 1);
    rmSync(racine, { recursive: true, force: true });
  }
});

test('migrate apply — pruning automatique via keepBackups', async () => {
  const racine = tmpProjet();
  try {
    projetV1(racine);
    // Pré-seed 4 backups historiques
    const dir = join(racine, '.aiad', 'migrations');
    mkdirSync(dir, { recursive: true });
    for (const ts of ['2026-01-01T00-00-00Z', '2026-02-01T00-00-00Z', '2026-03-01T00-00-00Z', '2026-04-01T00-00-00Z']) {
      mkdirSync(join(dir, `v2-backup-${ts}`));
    }
    TRANSFORMS_V2.push({
      id: 'test-prune',
      titre: 'pour déclencher backup',
      decrit: () => [],
      applique: () => { /* no-op */ },
    });
    const r = await migrate(racine, { apply: true, keepBackups: 2 });
    assert.equal(r.ok, true);
    assert.ok(r.prune, 'prune exécuté');
    // 4 historiques + 1 nouveau = 5, keep 2 → 3 prunés
    assert.equal(r.prune.pruned.length, 3);
    const restants = listerBackups(racine);
    assert.equal(restants.length, 2);
  } finally {
    const idx = TRANSFORMS_V2.findIndex((t) => t.id === 'test-prune');
    if (idx >= 0) TRANSFORMS_V2.splice(idx, 1);
    rmSync(racine, { recursive: true, force: true });
  }
});

test('migrate apply — skipBackup désactive la création du snapshot', async () => {
  const racine = tmpProjet();
  try {
    projetV1(racine);
    TRANSFORMS_V2.push({
      id: 'test-skip-backup',
      titre: 'no-op',
      decrit: () => [],
      applique: () => { /* no-op */ },
    });
    const r = await migrate(racine, { apply: true, skipBackup: true });
    assert.equal(r.ok, true);
    assert.equal(r.backup, null);
    assert.equal(listerBackups(racine).length, 0);
  } finally {
    const idx = TRANSFORMS_V2.findIndex((t) => t.id === 'test-skip-backup');
    if (idx >= 0) TRANSFORMS_V2.splice(idx, 1);
    rmSync(racine, { recursive: true, force: true });
  }
});

// ─── #206 Convention frontmatter parent_intent ──────────────────────────────

test('rewriteIntentToParentIntent — intent: → parent_intent: (frontmatter only)', () => {
  const r = rewriteIntentToParentIntent(`---\nid: SPEC-1\nintent: INTENT-001\nstatut: ready\n---\n\nBody.\n`);
  assert.equal(r.change, true);
  assert.match(r.contenu, /parent_intent: INTENT-001/);
  assert.doesNotMatch(r.contenu, /^intent:/m);
});

test('rewriteIntentToParentIntent — idempotent (parent_intent: déjà présent)', () => {
  const r = rewriteIntentToParentIntent(`---\nid: SPEC-1\nparent_intent: INTENT-001\nintent: AUTRE\n---\n\nBody.\n`);
  assert.equal(r.change, false, 'skip si parent_intent existe déjà');
});

test('rewriteIntentToParentIntent — préserve indentation et valeur', () => {
  const r = rewriteIntentToParentIntent(`---\n  intent: INTENT-042\n---\nBody.\n`);
  assert.equal(r.change, true);
  assert.match(r.contenu, /^\s+parent_intent: INTENT-042$/m);
});

test('rewriteIntentToParentIntent — n\'affecte pas les occurrences hors frontmatter', () => {
  const r = rewriteIntentToParentIntent(`---\nid: SPEC-1\n---\n\nintent: dans le body, ne pas toucher.\n`);
  assert.equal(r.change, false);
  assert.match(r.contenu, /^intent: dans le body/m);
});

test('rewriteIntentToParentIntent — pas de frontmatter → change=false', () => {
  const r = rewriteIntentToParentIntent(`# Titre\n\nContenu.\n`);
  assert.equal(r.change, false);
});

test('rewriteIntentToParentIntent — case-insensitive sur la clé', () => {
  const r = rewriteIntentToParentIntent(`---\nINTENT: INTENT-001\n---\n`);
  assert.equal(r.change, true);
  assert.match(r.contenu, /parent_intent: INTENT-001/);
});

test('detecterConventionLegacy — sans .aiad/specs → total=0', () => {
  const r = detecterConventionLegacy(tmpProjet());
  assert.equal(r.total, 0);
});

test('detecterConventionLegacy — détecte intent: et parent:, ignore parent_intent:', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-A.md'), `---\nid: A\nintent: INTENT-001\n---\nBody.`);
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-B.md'), `---\nid: B\nparent: INTENT-002\n---\nBody.`);
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-C.md'), `---\nid: C\nparent_intent: INTENT-003\n---\nBody.`);
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-D.md'), `---\nid: D\n---\nBody.`);
    const r = detecterConventionLegacy(racine);
    assert.equal(r.total, 2);
    const conventions = r.entrees.map((e) => e.convention).sort();
    assert.deepEqual(conventions, ['intent', 'parent']);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('detecterConventionLegacy — ignore les fichiers _index.md et autres', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'specs', '_index.md'), `---\nintent: noise\n---`);
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-1.md'), `---\nintent: INTENT-1\n---`);
    const r = detecterConventionLegacy(racine);
    assert.equal(r.total, 1);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('TRANSFORM_INTENT_TO_PARENT_INTENT — decrit retourne le plan', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-X.md'), `---\nintent: INTENT-X\n---`);
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-Y.md'), `---\nintent: INTENT-Y\n---`);
    const plan = TRANSFORM_INTENT_TO_PARENT_INTENT.decrit(racine);
    assert.equal(plan.length, 2);
    assert.match(plan[0].fichier, /SPEC-/);
    assert.equal(plan[0].avant, 'intent:');
    assert.equal(plan[0].apres, 'parent_intent:');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('TRANSFORM_INTENT_TO_PARENT_INTENT — applique rewrites + idempotent', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-1.md'), `---\nid: 1\nintent: INTENT-001\nstatut: ready\n---\nBody.`);
    TRANSFORM_INTENT_TO_PARENT_INTENT.applique(racine);
    const apres = readFileSync(join(racine, '.aiad', 'specs', 'SPEC-1.md'), 'utf-8');
    assert.match(apres, /parent_intent: INTENT-001/);
    // Idempotent : 2e run no-op
    TRANSFORM_INTENT_TO_PARENT_INTENT.applique(racine);
    const reapres = readFileSync(join(racine, '.aiad', 'specs', 'SPEC-1.md'), 'utf-8');
    assert.equal(reapres, apres, 'idempotent');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('TRANSFORM_INTENT_TO_PARENT_INTENT — non auto-registrée dans TRANSFORMS_V2', () => {
  // Politique Human Authorship : le mainteneur pousse manuellement.
  const ids = TRANSFORMS_V2.map((t) => t.id);
  assert.equal(ids.includes(TRANSFORM_INTENT_TO_PARENT_INTENT.id), false,
    'transform candidate présente mais pas active tant que v2 n\'est pas déclenchée');
});

test('TRANSFORM_INTENT_TO_PARENT_INTENT — pousser dans TRANSFORMS_V2 permet l\'exécution via migrate()', async () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-Z.md'), `---\nintent: INTENT-Z\n---`);
    TRANSFORMS_V2.push(TRANSFORM_INTENT_TO_PARENT_INTENT);
    const r = await migrate(racine, { apply: true });
    assert.equal(r.ok, true);
    assert.equal(r.appliquees.length, 1);
    const apres = readFileSync(join(racine, '.aiad', 'specs', 'SPEC-Z.md'), 'utf-8');
    assert.match(apres, /parent_intent: INTENT-Z/);
  } finally {
    const idx = TRANSFORMS_V2.findIndex((t) => t.id === TRANSFORM_INTENT_TO_PARENT_INTENT.id);
    if (idx >= 0) TRANSFORMS_V2.splice(idx, 1);
    rmSync(racine, { recursive: true, force: true });
  }
});

test('Alias EN #206', () => {
  assert.equal(detectLegacyConvention, detecterConventionLegacy);
  assert.equal(rewriteIntentToParentIntentEN, rewriteIntentToParentIntent);
});

test('Alias EN backup helpers', () => {
  assert.equal(createBackup, creerBackup);
  assert.equal(listBackups, listerBackups);
  assert.equal(pruneBackups, prunerBackups);
  assert.equal(restoreBackupEN, restoreBackup);
});

test('CLI migrate-v2 (texte humain) sur projet v1.14+', () => {
  const racine = tmpProjet();
  try {
    projetV114(racine);
    const r = spawnSync('node', [BIN, 'migrate-v2'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /migrate-v2 — mode dry-run/);
    assert.match(r.stdout, /v1\.14\+/);
    assert.match(r.stdout, /v2 n'est pas encore définie/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});
