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
