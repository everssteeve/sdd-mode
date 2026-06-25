// Tests `lib/archive.js` — archivage des artefacts (item #105).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  detecterSousDossier, localiserArtefact,
  patcherFrontmatterArchivage, patcherFrontmatterRestauration,
  archiver, restaurer, listerArchives, afficherListe, CONSTANTS,
  // alias EN
  detectKind, locateArtifact, patchArchiveFrontmatter, patchRestoreFrontmatter,
  archive, restore, listArchives, showArchives,
} from '../lib/archive.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-arc-')); }
function silent(fn) {
  return async (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return await fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

function ecrireSpec(d, id, fm = '', body = 'Body') {
  mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
  const frontmatter = fm ? `---\n${fm}\n---\n` : '';
  writeFileSync(join(d, '.aiad', 'specs', `${id}.md`), frontmatter + body);
}

function ecrireIntent(d, id, fm = '', body = 'Body') {
  mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
  const frontmatter = fm ? `---\n${fm}\n---\n` : '';
  writeFileSync(join(d, '.aiad', 'intents', `${id}.md`), frontmatter + body);
}

// ─── detecterSousDossier ──────────────────────────────────────────────────

test('detecterSousDossier — INT-NNN → intents', () => {
  assert.equal(detecterSousDossier('INT-001'), 'intents');
  assert.equal(detecterSousDossier('int-007'), 'intents');
});

test('detecterSousDossier — SPEC-NNN-N-slug → specs', () => {
  assert.equal(detecterSousDossier('SPEC-001-1-x'), 'specs');
  assert.equal(detecterSousDossier('spec-007-2-auth'), 'specs');
});

test('detecterSousDossier — préfixe inconnu → throw', () => {
  assert.throws(() => detecterSousDossier('FOO-001'), /ID inconnu/);
  assert.throws(() => detecterSousDossier(''), /ID inconnu/);
});

// ─── localiserArtefact ────────────────────────────────────────────────────

test('localiserArtefact — fichier ouvert détecté', () => {
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-001-1-x', 'title: T', 'body');
    const r = localiserArtefact(d, 'SPEC-001-1-x');
    assert.ok(r.ouvertPath);
    assert.equal(r.archivePath, null);
    assert.equal(r.fichier, 'SPEC-001-1-x.md');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('localiserArtefact — fichier archivé détecté', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs', 'archive'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'archive', 'SPEC-001-1-x.md'), 'x');
    const r = localiserArtefact(d, 'SPEC-001-1-x');
    assert.equal(r.ouvertPath, null);
    assert.ok(r.archivePath);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('localiserArtefact — absent → fichier null', () => {
  const d = tmp();
  try {
    const r = localiserArtefact(d, 'SPEC-999');
    assert.equal(r.fichier, null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── patcherFrontmatter ───────────────────────────────────────────────────

test('patcherFrontmatterArchivage — pose status + archivedAt + archivedBy + reason', () => {
  const fm = patcherFrontmatterArchivage({ title: 'T' }, {
    acteur: 'alice', raison: 'obsolete',
  });
  assert.equal(fm.status, 'archived');
  assert.equal(fm.archivedBy, 'alice');
  assert.equal(fm.archivedReason, 'obsolete');
  assert.match(fm.archivedAt, /^\d{4}-/);
});

test('patcherFrontmatterArchivage — ts custom', () => {
  const fm = patcherFrontmatterArchivage({}, { ts: '2026-01-01T00:00:00Z' });
  assert.equal(fm.archivedAt, '2026-01-01T00:00:00Z');
});

test('patcherFrontmatterRestauration — supprime status/archive*', () => {
  const fm = patcherFrontmatterRestauration({
    title: 'T', status: 'archived', archivedAt: 'x', archivedBy: 'u', archivedReason: 'r',
  });
  assert.equal(fm.title, 'T');
  assert.equal(fm.status, undefined);
  assert.equal(fm.archivedAt, undefined);
  assert.equal(fm.archivedBy, undefined);
  assert.equal(fm.archivedReason, undefined);
});

// ─── archiver (pipeline) ──────────────────────────────────────────────────

test('archiver — déplace fichier + patche frontmatter', silent(async () => {
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-001-1-x', 'title: T', 'Body content');
    const r = await archiver(d, 'SPEC-001-1-x', { raison: 'obsolete', webhook: false });
    assert.equal(r.archived, true);
    // Fichier déplacé
    assert.ok(!existsSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md')));
    assert.ok(existsSync(join(d, '.aiad', 'specs', 'archive', 'SPEC-001-1-x.md')));
    // Frontmatter patché
    const contenu = readFileSync(join(d, '.aiad', 'specs', 'archive', 'SPEC-001-1-x.md'), 'utf-8');
    assert.match(contenu, /status: archived/);
    assert.match(contenu, /archivedReason: obsolete/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('archiver — archive un Intent → dossier intents/archive', silent(async () => {
  const d = tmp();
  try {
    ecrireIntent(d, 'INT-001', 'title: T');
    await archiver(d, 'INT-001', { webhook: false });
    assert.ok(existsSync(join(d, '.aiad', 'intents', 'archive', 'INT-001.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('archiver — déjà archivé → throw', silent(async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs', 'archive'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'archive', 'SPEC-001-1-x.md'),
      '---\nstatus: archived\n---\nx');
    await assert.rejects(
      () => archiver(d, 'SPEC-001-1-x', { webhook: false }),
      /déjà archivé/,
    );
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('archiver — artefact inexistant → throw', async () => {
  const d = tmp();
  try {
    await assert.rejects(
      () => archiver(d, 'SPEC-999-1-x', { webhook: false }),
      /introuvable/,
    );
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('archiver --dry-run → aucune mutation', silent(async () => {
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-001-1-x', 'title: T');
    await archiver(d, 'SPEC-001-1-x', { dryRun: true, webhook: false });
    assert.ok(existsSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md')));
    assert.ok(!existsSync(join(d, '.aiad', 'specs', 'archive')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('archiver — append événement audit (best-effort)', silent(async () => {
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-001-1-x', 'title: T');
    await archiver(d, 'SPEC-001-1-x', { webhook: false });
    const auditPath = join(d, '.aiad', 'audit', 'audit.jsonl');
    assert.ok(existsSync(auditPath));
    const ev = JSON.parse(readFileSync(auditPath, 'utf-8').trim());
    assert.equal(ev.action, 'archived');
    assert.match(ev.artifact, /archive\/SPEC-001-1-x\.md$/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('archiver — pas d\'audit si audit:false', silent(async () => {
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-001-1-x', 'title: T');
    await archiver(d, 'SPEC-001-1-x', { audit: false, webhook: false });
    assert.ok(!existsSync(join(d, '.aiad', 'audit', 'audit.jsonl')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('archiver --json → sortie JSON', async () => {
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-001-1-x', 'title: T');
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { await archiver(d, 'SPEC-001-1-x', { json: true, webhook: false }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.archived, true);
    assert.match(parsed.archivePath, /archive\/SPEC-001-1-x\.md$/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── restaurer ────────────────────────────────────────────────────────────

test('restaurer — déplace archive vers ouvert + nettoie frontmatter', silent(async () => {
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-001-1-x', 'title: T');
    await archiver(d, 'SPEC-001-1-x', { webhook: false });
    await restaurer(d, 'SPEC-001-1-x');
    assert.ok(existsSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md')));
    assert.ok(!existsSync(join(d, '.aiad', 'specs', 'archive', 'SPEC-001-1-x.md')));
    const contenu = readFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'), 'utf-8');
    assert.ok(!contenu.includes('status: archived'));
    assert.ok(!contenu.includes('archivedAt'));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('restaurer — non archivé → throw', async () => {
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-001-1-x', 'title: T');
    await assert.rejects(() => restaurer(d, 'SPEC-001-1-x'), /non archivé/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('restaurer — collision (ouvert + archivé existent) → throw', async () => {
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-001-1-x', 'title: T');
    mkdirSync(join(d, '.aiad', 'specs', 'archive'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'archive', 'SPEC-001-1-x.md'), 'x');
    await assert.rejects(() => restaurer(d, 'SPEC-001-1-x'), /collision/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('restaurer --dry-run → aucune mutation', silent(async () => {
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-001-1-x', 'title: T');
    await archiver(d, 'SPEC-001-1-x', { webhook: false });
    await restaurer(d, 'SPEC-001-1-x', { dryRun: true });
    // Toujours archivé
    assert.ok(existsSync(join(d, '.aiad', 'specs', 'archive', 'SPEC-001-1-x.md')));
    assert.ok(!existsSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

// ─── listerArchives ──────────────────────────────────────────────────────

test('listerArchives — projet vide → []', () => {
  const d = tmp();
  try {
    assert.deepEqual(listerArchives(d), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerArchives — combine intents + specs archivés', silent(async () => {
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-001-1-x', 'title: SX');
    ecrireIntent(d, 'INT-001', 'title: IX');
    await archiver(d, 'SPEC-001-1-x', { raison: 'r1', webhook: false });
    await archiver(d, 'INT-001', { raison: 'r2', webhook: false });
    const r = listerArchives(d);
    assert.equal(r.length, 2);
    const sous = r.map((a) => a.sousDossier).sort();
    assert.deepEqual(sous, ['intents', 'specs']);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('afficherListe --json — format exploitable', () => {
  const d = tmp();
  try {
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { afficherListe(d, { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.total, 0);
    assert.deepEqual(parsed.archives, []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── Cycle anti dock rot — listerLivrables (§3.8 SPEC-B) ────────────────────

test('listerLivrables — ne retient que les artefacts status done', async () => {
  const { listerLivrables } = await import('../lib/archive.js');
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-001-x.md'), '---\nstatus: done\ntitle: Fini\n---\n');
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-002-y.md'), '---\nstatus: active\ntitle: Encore chaud\n---\n');
    const liste = listerLivrables(d);
    assert.equal(liste.length, 1);
    assert.equal(liste[0].id, 'INTENT-001-x');
    assert.equal(liste[0].safe, true);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerLivrables — une SPEC done référencée par du code est safe (FACT-007)', async () => {
  // @spec annotations are permanent; construireMatrice() includes archive/ in specsConnus
  // so archiving a referenced done spec no longer creates orphan gaps (fix 78d3b9b).
  const { listerLivrables } = await import('../lib/archive.js');
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    mkdirSync(join(d, 'lib'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-009-1-live.md'), '---\nstatus: done\ntitle: Live\n---\n');
    writeFileSync(join(d, 'lib', 'live.js'), '// @spec SPEC-009-1-live\nexport const x = 1;\n');
    const liste = listerLivrables(d);
    assert.equal(liste.length, 1);
    assert.equal(liste[0].safe, true);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(detectKind, detecterSousDossier);
  assert.equal(locateArtifact, localiserArtefact);
  assert.equal(patchArchiveFrontmatter, patcherFrontmatterArchivage);
  assert.equal(patchRestoreFrontmatter, patcherFrontmatterRestauration);
  assert.equal(archive, archiver);
  assert.equal(restore, restaurer);
  assert.equal(listArchives, listerArchives);
  assert.equal(showArchives, afficherListe);
});

test('CONSTANTS — exposées', () => {
  assert.deepEqual(CONSTANTS.SOUS_DOSSIERS, ['intents', 'specs']);
});

// ─── archiverTous (SPEC-026-1) ───────────────────────────────────────────────

test('archive done — CA-001 affiche la liste des candidats safe', async () => {
  const { archiverTous } = await import('../lib/archive.js');
  const d = tmp();
  try {
    ecrireIntent(d, 'INTENT-001-x', 'status: done\ntitle: Titre intent');
    ecrireSpec(d, 'SPEC-001-1-x', 'status: done\ntitle: Titre spec');
    ecrireIntent(d, 'INTENT-002-y', 'status: active\ntitle: Encore chaud');
    const result = await archiverTous(d, { dryRun: true });
    assert.equal(result.total, 2);
    assert.equal(result.archived, 0);
    const ids = result.items.map((i) => i.id);
    assert.ok(ids.includes('INTENT-001-x'));
    assert.ok(ids.includes('SPEC-001-1-x'));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('archive done — CA-002 sans --apply aucune mutation', silent(async () => {
  const { archiverTous } = await import('../lib/archive.js');
  const d = tmp();
  try {
    ecrireIntent(d, 'INTENT-001-x', 'status: done\ntitle: T');
    await archiverTous(d, { dryRun: true });
    assert.ok(existsSync(join(d, '.aiad', 'intents', 'INTENT-001-x.md')));
    assert.ok(!existsSync(join(d, '.aiad', 'intents', 'archive')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('archive done — CA-003 --apply déplace les fichiers', silent(async () => {
  const { archiverTous } = await import('../lib/archive.js');
  const d = tmp();
  try {
    ecrireIntent(d, 'INTENT-001-x', 'status: done\ntitle: T');
    ecrireSpec(d, 'SPEC-001-1-x', 'status: done\ntitle: T');
    const result = await archiverTous(d, { dryRun: false, raison: 'test' });
    assert.equal(result.archived, 2);
    assert.ok(!existsSync(join(d, '.aiad', 'intents', 'INTENT-001-x.md')));
    assert.ok(existsSync(join(d, '.aiad', 'intents', 'archive', 'INTENT-001-x.md')));
    assert.ok(!existsSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md')));
    assert.ok(existsSync(join(d, '.aiad', 'specs', 'archive', 'SPEC-001-1-x.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('archive done — CA-004 patch frontmatter', silent(async () => {
  const { archiverTous } = await import('../lib/archive.js');
  const d = tmp();
  try {
    ecrireIntent(d, 'INTENT-001-x', 'status: done\ntitle: T');
    await archiverTous(d, { dryRun: false, raison: 'archive done' });
    const contenu = readFileSync(join(d, '.aiad', 'intents', 'archive', 'INTENT-001-x.md'), 'utf-8');
    assert.match(contenu, /status: archived/);
    assert.match(contenu, /archivedAt:/);
    assert.match(contenu, /archivedReason: archive done/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('archive done — CA-005 spec référencée par @spec est archivable (FACT-007)', async () => {
  // Since construireMatrice() includes archive/ in specsConnus (fix 78d3b9b),
  // archiving a spec still annotated in code no longer creates orphan gaps.
  const { archiverTous } = await import('../lib/archive.js');
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    mkdirSync(join(d, 'lib'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-009-1-live.md'), '---\nstatus: done\ntitle: Live\n---\n');
    writeFileSync(join(d, 'lib', 'live.js'), '// @spec SPEC-009-1-live\nexport const x = 1;\n');
    const result = await archiverTous(d, { dryRun: true });
    assert.equal(result.total, 1);
    assert.equal(result.items[0].id, 'SPEC-009-1-live');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('archive done — CA-006 crée archive/ si absent', silent(async () => {
  const { archiverTous } = await import('../lib/archive.js');
  const d = tmp();
  try {
    ecrireIntent(d, 'INTENT-001-x', 'status: done\ntitle: T');
    assert.ok(!existsSync(join(d, '.aiad', 'intents', 'archive')));
    await archiverTous(d, { dryRun: false });
    assert.ok(existsSync(join(d, '.aiad', 'intents', 'archive')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('archive done — CA-007 zéro candidat → total 0', async () => {
  const { archiverTous } = await import('../lib/archive.js');
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-001-x.md'), '---\nstatus: active\ntitle: T\n---\n');
    const result = await archiverTous(d, { dryRun: true });
    assert.equal(result.total, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('archive done — CA-008 audit entry par artefact archivé', silent(async () => {
  const { archiverTous } = await import('../lib/archive.js');
  const d = tmp();
  try {
    ecrireIntent(d, 'INTENT-001-x', 'status: done\ntitle: T');
    ecrireSpec(d, 'SPEC-001-1-x', 'status: done\ntitle: T');
    await archiverTous(d, { dryRun: false });
    const auditPath = join(d, '.aiad', 'audit', 'audit.jsonl');
    assert.ok(existsSync(auditPath));
    const lignes = readFileSync(auditPath, 'utf-8').trim().split('\n').filter(Boolean);
    assert.equal(lignes.length, 2);
    for (const l of lignes) {
      const ev = JSON.parse(l);
      assert.equal(ev.action, 'archived');
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

// ─── SPEC-026-2 — listerLivrables(split) + listerOrphelins ──────────────────

test('listerLivrables — CA-001 SPEC split toutes sous-SPECs done', async () => {
  const { listerLivrables } = await import('../lib/archive.js');
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-007-1-parent', 'id: SPEC-007-1\nstatus: split\ntitle: Parent split');
    ecrireSpec(d, 'SPEC-007-1a-sous-a', 'id: SPEC-007-1a\nstatus: done\ntitle: Sous A');
    ecrireSpec(d, 'SPEC-007-1b-sous-b', 'id: SPEC-007-1b\nstatus: archived\ntitle: Sous B');
    const candidats = listerLivrables(d);
    const parent = candidats.find((c) => c.fichier === 'SPEC-007-1-parent.md');
    assert.ok(parent, 'SPEC split terminée absente de listerLivrables');
    assert.equal(parent.safe, true);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerLivrables — CA-002 SPEC split sous-SPEC non terminée exclue', async () => {
  const { listerLivrables } = await import('../lib/archive.js');
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-008-1-parent', 'id: SPEC-008-1\nstatus: split\ntitle: Parent split');
    ecrireSpec(d, 'SPEC-008-1a-ok', 'id: SPEC-008-1a\nstatus: done\ntitle: Sous OK');
    ecrireSpec(d, 'SPEC-008-1b-wip', 'id: SPEC-008-1b\nstatus: in-progress\ntitle: Sous WIP');
    const candidats = listerLivrables(d);
    const parent = candidats.find((c) => c.fichier === 'SPEC-008-1-parent.md');
    assert.ok(!parent, 'SPEC split partielle ne devrait pas être dans listerLivrables');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerLivrables — CA-003 SPEC split sans sous-SPECs exclue', async () => {
  const { listerLivrables } = await import('../lib/archive.js');
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-009-1-parent', 'id: SPEC-009-1\nstatus: split\ntitle: Parent sans sous-SPECs');
    const candidats = listerLivrables(d);
    const parent = candidats.find((c) => c.fichier === 'SPEC-009-1-parent.md');
    assert.ok(!parent, 'SPEC split sans sous-SPECs ne devrait pas être dans listerLivrables');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerOrphelins — CA-004 détecte original avec status archived', async () => {
  const { listerOrphelins } = await import('../lib/archive.js');
  const d = tmp();
  try {
    ecrireIntent(d, 'INTENT-099-stale', 'status: archived\ntitle: Intent orphelin');
    ecrireSpec(d, 'SPEC-099-1-stale', 'status: active\ntitle: Spec normale');
    const orphelins = listerOrphelins(d);
    assert.equal(orphelins.length, 1);
    assert.equal(orphelins[0].id, 'INTENT-099-stale');
    assert.equal(orphelins[0].kind, 'intents');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('archive done --apply — CA-005a affiche avertissement orphelins (listerOrphelins non vide)', async () => {
  const { listerOrphelins } = await import('../lib/archive.js');
  const d = tmp();
  try {
    ecrireIntent(d, 'INTENT-098-orphan', 'status: archived\ntitle: Orphelin CLI');
    const orphelins = listerOrphelins(d);
    assert.ok(orphelins.length > 0, 'listerOrphelins doit retourner des entrées pour déclencher le warning CLI');
    assert.ok(orphelins[0].raison, 'chaque orphelin doit avoir une raison');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('archive done --apply — CA-005b orphelins non touchés', silent(async () => {
  const { archiverTous, listerOrphelins } = await import('../lib/archive.js');
  const d = tmp();
  try {
    ecrireIntent(d, 'INTENT-097-orphan', 'status: archived\ntitle: Orphelin');
    await archiverTous(d, { dryRun: false });
    assert.ok(existsSync(join(d, '.aiad', 'intents', 'INTENT-097-orphan.md')), 'orphelin ne doit pas être déplacé');
    assert.ok(!existsSync(join(d, '.aiad', 'intents', 'archive', 'INTENT-097-orphan.md')), 'orphelin ne doit pas être dans archive/');
    const orphelins = listerOrphelins(d);
    assert.equal(orphelins.length, 1, 'orphelin toujours détectable après --apply');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('archive done — CA-006 affiche section orphelins en preview (listerOrphelins retourne des entrées)', async () => {
  const { listerOrphelins } = await import('../lib/archive.js');
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-096-1-orphan', 'status: archived\ntitle: Spec orpheline');
    const orphelins = listerOrphelins(d);
    assert.equal(orphelins.length, 1);
    assert.equal(orphelins[0].kind, 'specs');
    assert.ok(orphelins[0].titre, 'titre présent pour affichage CLI');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('archive done — CA-007a message vide aucun candidat (archiverTous retourne total 0)', async () => {
  const { archiverTous } = await import('../lib/archive.js');
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-001.md'), '---\nstatus: active\ntitle: T\n---\n');
    const result = await archiverTous(d, { dryRun: true });
    assert.equal(result.total, 0, 'aucun candidat → total doit être 0');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('archive done — CA-007b exit 0 aucun candidat (listerOrphelins retourne [] quand dossier vide)', async () => {
  const { listerOrphelins } = await import('../lib/archive.js');
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    const orphelins = listerOrphelins(d);
    assert.equal(orphelins.length, 0, 'aucun orphelin → listerOrphelins retourne []');
  } finally { rmSync(d, { recursive: true, force: true }); }
});
