// Tests #85 — Export Obsidian Vault depuis .aiad/.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  exporterObsidian, transformerPourObsidian, indexerFichiers, shortId, parserFrontmatter,
  exportObsidian, transformForObsidian, indexFiles, shortIdEN,
} from '../lib/obsidian-export.js';

function tmpProjet() {
  return mkdtempSync(join(tmpdir(), 'aiad-obs-'));
}

function projetMinimal(racine) {
  mkdirSync(join(racine, '.aiad'), { recursive: true });
  mkdirSync(join(racine, '.aiad', 'intents'));
  mkdirSync(join(racine, '.aiad', 'specs'));
  mkdirSync(join(racine, '.aiad', 'gouvernance'));
  writeFileSync(join(racine, '.aiad', 'intents', 'INTENT-001-auth.md'),
    `---\nid: INTENT-001\ntitre: Authentification\n---\n\nContenu intent.\n`);
  writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-001-1-jwt.md'),
    `---\nid: SPEC-001-1-jwt\nparent_intent: INTENT-001\ngovernance: AIAD-RGPD,AIAD-AI-ACT\nstatut: ready\n---\n\nContenu spec.\n`);
  writeFileSync(join(racine, '.aiad', 'gouvernance', 'AIAD-RGPD.md'), `# RGPD\n`);
  writeFileSync(join(racine, '.aiad', 'gouvernance', 'AIAD-AI-ACT.md'), `# AI Act\n`);
  writeFileSync(join(racine, '.aiad', 'AGENT-GUIDE.md'), `# Guide\n`);
}

test('shortId — normalise INTENT-NNN et SPEC-NNN-N', () => {
  assert.equal(shortId('INTENT-001-auth'), 'INTENT-001');
  assert.equal(shortId('SPEC-001-1-jwt'), 'SPEC-001-1');
  assert.equal(shortId('intent-042'), 'INTENT-042', 'case-insensitive');
  assert.equal(shortId('autre'), null);
  assert.equal(shortId(null), null);
  assert.equal(shortId(''), null);
});

test('parserFrontmatter — extrait clé:valeur, expose body', () => {
  const r = parserFrontmatter(`---\nid: SPEC-001-1\nparent_intent: INTENT-001\n---\n\nBody ici.\n`);
  assert.equal(r.fields.id, 'SPEC-001-1');
  assert.equal(r.fields.parent_intent, 'INTENT-001');
  assert.match(r.body, /Body ici/);
});

test('parserFrontmatter — sans frontmatter → body=contenu, fields={}', () => {
  const r = parserFrontmatter(`# Titre\n\nContenu.\n`);
  assert.deepEqual(r.fields, {});
  assert.match(r.body, /Titre/);
});

test('indexerFichiers — index par shortId et nom complet', () => {
  const racine = tmpProjet();
  try {
    projetMinimal(racine);
    const idx = indexerFichiers(join(racine, '.aiad'));
    assert.ok(idx['INTENT-001'], 'shortId Intent indexé');
    assert.ok(idx['SPEC-001-1'], 'shortId Spec indexé');
    assert.ok(idx['INTENT-001-auth'], 'nom complet Intent indexé');
    assert.equal(idx['INTENT-001'].category, 'Intents');
    assert.equal(idx['SPEC-001-1'].category, 'SPECs');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('transformerPourObsidian — injecte section "Liens AIAD" depuis parent_intent', () => {
  const racine = tmpProjet();
  try {
    projetMinimal(racine);
    const idx = indexerFichiers(join(racine, '.aiad'));
    const contenu = readFileSync(join(racine, '.aiad', 'specs', 'SPEC-001-1-jwt.md'), 'utf-8');
    const t = transformerPourObsidian(contenu, idx);
    assert.match(t, /\[!info\] Liens AIAD/);
    assert.match(t, /\[\[INTENT-001-auth\]\]/);
    assert.match(t, /\[\[AIAD-RGPD\]\]/);
    assert.match(t, /\[\[AIAD-AI-ACT\]\]/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('transformerPourObsidian — préserve frontmatter intact', () => {
  const idx = { 'INTENT-001': { fullName: 'INTENT-001', category: 'Intents' } };
  const t = transformerPourObsidian(`---\nid: SPEC-1\nparent: INTENT-001\n---\n\nBody.\n`, idx);
  assert.match(t, /^---\nid: SPEC-1\nparent: INTENT-001\n---/);
});

test('transformerPourObsidian — supporte alias `intent:` (convention legacy)', () => {
  const idx = { 'INTENT-001': { fullName: 'INTENT-001-auth', category: 'Intents' } };
  const t = transformerPourObsidian(`---\nid: SPEC-1\nintent: INTENT-001\n---\n\nBody.\n`, idx);
  assert.match(t, /\[\[INTENT-001-auth\]\]/);
});

test('transformerPourObsidian — sans relations → pas de section "Liens"', () => {
  const idx = {};
  const t = transformerPourObsidian(`---\nid: ORPHAN\n---\n\nBody.\n`, idx);
  assert.doesNotMatch(t, /Liens AIAD/);
});

test('exporterObsidian — sans .aiad → ok=false', () => {
  const r = exporterObsidian(tmpProjet());
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'aiad-absent');
});

test('exporterObsidian — dryRun ne crée rien', () => {
  const racine = tmpProjet();
  try {
    projetMinimal(racine);
    const r = exporterObsidian(racine, { dryRun: true });
    assert.equal(r.mode, 'dry-run');
    assert.equal(r.files, 0);
    assert.equal(existsSync(join(racine, 'obsidian-vault')), false);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('exporterObsidian — produit un vault complet (apply)', () => {
  const racine = tmpProjet();
  try {
    projetMinimal(racine);
    const r = exporterObsidian(racine);
    assert.equal(r.ok, true);
    assert.equal(r.mode, 'apply');
    assert.ok(r.files >= 6, `>= 6 fichiers (intent + spec + 2 gov + AGENT-GUIDE + MOC + README), got ${r.files}`);
    const out = join(racine, 'obsidian-vault');
    assert.ok(existsSync(join(out, 'intents', 'INTENT-001-auth.md')));
    assert.ok(existsSync(join(out, 'specs', 'SPEC-001-1-jwt.md')));
    assert.ok(existsSync(join(out, 'gouvernance', 'AIAD-RGPD.md')));
    assert.ok(existsSync(join(out, 'AGENT-GUIDE.md')));
    assert.ok(existsSync(join(out, '_index.md')));
    assert.ok(existsSync(join(out, 'README.md')));
    // SPEC contient les wiki-links
    const spec = readFileSync(join(out, 'specs', 'SPEC-001-1-jwt.md'), 'utf-8');
    assert.match(spec, /\[\[INTENT-001-auth\]\]/);
    assert.match(spec, /\[\[AIAD-RGPD\]\]/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('exporterObsidian — --out=DIR custom', () => {
  const racine = tmpProjet();
  try {
    projetMinimal(racine);
    const r = exporterObsidian(racine, { out: 'mon-vault' });
    assert.equal(r.ok, true);
    assert.ok(existsSync(join(racine, 'mon-vault', '_index.md')));
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('exporterObsidian — MOC liste tous les artefacts par catégorie', () => {
  const racine = tmpProjet();
  try {
    projetMinimal(racine);
    exporterObsidian(racine);
    const moc = readFileSync(join(racine, 'obsidian-vault', '_index.md'), 'utf-8');
    assert.match(moc, /## Pivots/);
    assert.match(moc, /## Intents \(1\)/);
    assert.match(moc, /## SPECs \(1\)/);
    assert.match(moc, /## Gouvernance \(2\)/);
    assert.match(moc, /\[\[INTENT-001-auth\]\]/);
    assert.match(moc, /\[\[AGENT-GUIDE\]\]/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('exporterObsidian — README pédagogique généré', () => {
  const racine = tmpProjet();
  try {
    projetMinimal(racine);
    exporterObsidian(racine);
    const readme = readFileSync(join(racine, 'obsidian-vault', 'README.md'), 'utf-8');
    assert.match(readme, /AIAD Vault/);
    assert.match(readme, /Graph view/);
    assert.match(readme, /aiad-sdd obsidian/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('Alias EN canoniques', () => {
  assert.equal(exportObsidian, exporterObsidian);
  assert.equal(transformForObsidian, transformerPourObsidian);
  assert.equal(indexFiles, indexerFichiers);
  assert.equal(shortIdEN, shortId);
});

// ─── CLI E2E ────────────────────────────────────────────────────────────────

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'aiad-sdd.js');

test('CLI aiad-sdd obsidian --json produit un JSON valide', () => {
  const racine = tmpProjet();
  try {
    projetMinimal(racine);
    const r = spawnSync('node', [BIN, 'obsidian', '--json'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.equal(j.ok, true);
    assert.equal(j.mode, 'apply');
    assert.ok(j.files >= 6);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('CLI aiad-sdd obsidian sans .aiad → exit 1', () => {
  const r = spawnSync('node', [BIN, 'obsidian'], { cwd: tmpProjet(), encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /aiad-absent/);
});

test('CLI aiad-sdd obsidian --out=custom-vault', () => {
  const racine = tmpProjet();
  try {
    projetMinimal(racine);
    const r = spawnSync('node', [BIN, 'obsidian', '--out=custom-vault', '--json'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 0);
    const j = JSON.parse(r.stdout);
    assert.match(j.dir, /custom-vault/);
    assert.ok(existsSync(join(racine, 'custom-vault', '_index.md')));
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});
