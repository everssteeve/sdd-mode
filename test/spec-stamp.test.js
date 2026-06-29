// @intent INTENT-027
// @spec SPEC-027-1-stamp-validated-at
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stampValidatedAt } from '../lib/spec-stamp.js';
import { parseFrontmatter } from '../lib/frontmatter.js';

const SPEC_CONTENT = `---\nid: SPEC-027-1\nstatut: done\n---\n\n# Body\n\nContent here.\n`;

function fixture(extras = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-stamp-'));
  mkdirSync(join(dir, '.aiad', 'specs', 'archive'), { recursive: true });
  writeFileSync(join(dir, '.aiad', 'specs', 'SPEC-027-1-stamp-validated-at.md'), SPEC_CONTENT, 'utf8');
  for (const [name, content] of Object.entries(extras)) {
    writeFileSync(join(dir, '.aiad', 'specs', name), content, 'utf8');
  }
  return dir;
}

test('spec-stamp CA-001 — stamp réussi : validated_at écrit dans le frontmatter', () => {
  const dir = fixture();
  try {
    const avant = Date.now();
    const { validatedAt } = stampValidatedAt(dir, 'SPEC-027-1');
    const après = Date.now();

    const contenu = readFileSync(join(dir, '.aiad', 'specs', 'SPEC-027-1-stamp-validated-at.md'), 'utf8');
    const { data } = parseFrontmatter(contenu);

    assert.ok(data.validated_at, 'validated_at présent dans le frontmatter');
    assert.equal(data.validated_at, validatedAt);
    const ts = new Date(data.validated_at).getTime();
    assert.ok(ts >= avant && ts <= après, 'timestamp dans la fenêtre du test');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('spec-stamp CA-002 — idempotence : validated_at écrasé si déjà présent', () => {
  const dir = fixture();
  try {
    const { validatedAt: first } = stampValidatedAt(dir, 'SPEC-027-1');
    const { validatedAt: second } = stampValidatedAt(dir, 'SPEC-027-1');

    assert.ok(new Date(first).getTime(), 'premier timestamp valide');
    assert.ok(new Date(second).getTime(), 'second timestamp valide');

    const contenu = readFileSync(join(dir, '.aiad', 'specs', 'SPEC-027-1-stamp-validated-at.md'), 'utf8');
    const { data } = parseFrontmatter(contenu);
    assert.equal(data.validated_at, second, 'le dernier appel gagne');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('spec-stamp CA-003 — SPEC introuvable : erreur avec SPEC ID et code SPEC_NOT_FOUND', () => {
  const dir = fixture();
  try {
    assert.throws(
      () => stampValidatedAt(dir, 'SPEC-999-9'),
      (e) => {
        assert.ok(e.message.includes('SPEC-999-9'), 'message contient le SPEC ID');
        assert.equal(e.code, 'SPEC_NOT_FOUND');
        return true;
      }
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('spec-stamp CA-004 — frontmatter absent : code NO_FRONTMATTER, fichier non modifié', () => {
  const original = '# Juste du Markdown sans frontmatter\n\nContenu.\n';
  const dir = fixture({ 'SPEC-028-1-no-fm.md': original });
  try {
    assert.throws(
      () => stampValidatedAt(dir, 'SPEC-028-1'),
      (e) => {
        assert.equal(e.code, 'NO_FRONTMATTER');
        return true;
      }
    );
    const après = readFileSync(join(dir, '.aiad', 'specs', 'SPEC-028-1-no-fm.md'), 'utf8');
    assert.equal(après, original, 'fichier non modifié');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('spec-stamp CA-005 — format ISO 8601 UTC quoted, parseable par new Date()', () => {
  const dir = fixture();
  try {
    const { validatedAt } = stampValidatedAt(dir, 'SPEC-027-1');

    assert.match(validatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'format ISO 8601 UTC');
    assert.ok(!isNaN(new Date(validatedAt).getTime()), 'parseable par new Date()');

    const raw = readFileSync(join(dir, '.aiad', 'specs', 'SPEC-027-1-stamp-validated-at.md'), 'utf8');
    assert.ok(raw.includes(`validated_at: "${validatedAt}"`), 'quoted dans le fichier');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('spec-stamp CA-006 — body préservé intégralement après stamp', () => {
  const dir = fixture();
  try {
    const { body: bodyAvant } = parseFrontmatter(SPEC_CONTENT);

    stampValidatedAt(dir, 'SPEC-027-1');

    const après = readFileSync(join(dir, '.aiad', 'specs', 'SPEC-027-1-stamp-validated-at.md'), 'utf8');
    const { body: bodyAprès } = parseFrontmatter(après);

    assert.equal(bodyAprès, bodyAvant, 'body identique avant et après');
  } finally {
    rmSync(dir, { recursive: true });
  }
});
