// Tests du suggestionneur de SPECs squelettées.
// Hard rule testée : ne réécrit JAMAIS une SPEC existante.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { suggererSpecs } from '../lib/spec-suggester.js';
import { construireMatrice, trace } from '../lib/sdd-trace.js';
import { parseFrontmatter } from '../lib/frontmatter.js';

function silencer(fn) {
  return async (...args) => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { process.stdout.write = orig; }
  };
}

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-sugg-'));
  mkdirSync(join(dir, '.aiad', 'intents'), { recursive: true });
  mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
  mkdirSync(join(dir, 'src'), { recursive: true });
  return dir;
}

test('suggererSpecs — crée un squelette EARS pour SPEC orpheline', () => {
  const d = fixture();
  try {
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-042.md'),
      '---\nstatus: active\n---\n# Auth\n');
    writeFileSync(join(d, 'src', 'login.ts'),
      '// @intent INTENT-042\n// @spec SPEC-042-1-login-flow\nexport function login() {}\n');

    const matrice = construireMatrice(d);
    const r = suggererSpecs(d, matrice);
    assert.deepEqual(r.created, ['SPEC-042-1-login-flow']);
    assert.deepEqual(r.existing, []);

    const dest = join(d, '.aiad', 'specs', 'SPEC-042-1-login-flow.md');
    assert.ok(existsSync(dest));
    const contenu = readFileSync(dest, 'utf-8');
    const { data } = parseFrontmatter(contenu);
    assert.equal(data.parent_intent, 'INTENT-042'); // deviné depuis @intent du code
    assert.equal(data.status, 'draft');
    assert.equal(data.format, 'EARS');
    assert.match(contenu, /Squelette généré/);
    assert.match(contenu, /src\/login\.ts/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('suggererSpecs — préserve une SPEC existante (Human Authorship)', () => {
  const d = fixture();
  try {
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-100-1-existante.md'),
      '# Spec rédigée par moi\n\nContenu critique à ne pas écraser.\n');
    writeFileSync(join(d, 'src', 'foo.ts'),
      '// @spec SPEC-100-1-existante\nexport {};\n');

    const matrice = construireMatrice(d);
    const r = suggererSpecs(d, matrice);
    // Pas dans created (pas écrasée)
    assert.deepEqual(r.created, []);
    // Et pas dans existing non plus puisqu'elle n'apparaît pas dans
    // gaps.specsOrphelinsSurCode (elle existe → matrice trouve normal forward)
    // → elle n'est juste pas suggérée du tout, ce qui est le comportement attendu.

    // Le fichier reste intact
    assert.match(readFileSync(join(d, '.aiad', 'specs', 'SPEC-100-1-existante.md'), 'utf-8'),
      /Contenu critique/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('suggererSpecs — devine parent_intent depuis _index.md', () => {
  const d = fixture();
  try {
    // Pas d'@intent dans le code, mais un _index.md actif
    writeFileSync(join(d, '.aiad', 'intents', '_index.md'),
      `# Intents

| ID | Titre | Auteur | Date | Statut |
|----|-------|--------|------|--------|
| INTENT-007 | Mon intent | Alice | 2026-05-10 | active |
`);
    writeFileSync(join(d, 'src', 'feat.ts'),
      '// @spec SPEC-007-1-feature\nexport {};\n');

    const matrice = construireMatrice(d);
    const r = suggererSpecs(d, matrice);
    assert.equal(r.created.length, 1);
    const dest = join(d, '.aiad', 'specs', 'SPEC-007-1-feature.md');
    const { data } = parseFrontmatter(readFileSync(dest, 'utf-8'));
    assert.equal(data.parent_intent, 'INTENT-007');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('suggererSpecs — sans Intent, fallback "TODO"', () => {
  const d = fixture();
  try {
    writeFileSync(join(d, 'src', 'orphelin.ts'),
      '// @spec SPEC-999-1-orphelin\nexport {};\n');
    const matrice = construireMatrice(d);
    const r = suggererSpecs(d, matrice);
    assert.equal(r.created.length, 1);
    const dest = join(d, '.aiad', 'specs', 'SPEC-999-1-orphelin.md');
    const { data } = parseFrontmatter(readFileSync(dest, 'utf-8'));
    assert.equal(data.parent_intent, 'TODO');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('suggererSpecs --dry-run — n\'écrit rien', () => {
  const d = fixture();
  try {
    writeFileSync(join(d, 'src', 'foo.ts'), '// @spec SPEC-XYZ-1-dry\nexport {};\n');
    const matrice = construireMatrice(d);
    const r = suggererSpecs(d, matrice, { dryRun: true });
    assert.equal(r.created.length, 1);
    assert.ok(!existsSync(join(d, '.aiad', 'specs', 'SPEC-XYZ-1-dry.md')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('trace --suggest — intégration via la commande', silencer(async () => {
  const d = fixture();
  try {
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-001.md'),
      '---\nstatus: active\n---\n# I\n');
    writeFileSync(join(d, 'src', 'a.ts'), '// @spec SPEC-001-1-feat\nexport {};\n');

    await trace(d, { quiet: true, suggest: true, dryRun: false });
    assert.ok(existsSync(join(d, '.aiad', 'specs', 'SPEC-001-1-feat.md')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('suggererSpecs — titre dérivé du slug correctement', () => {
  const d = fixture();
  try {
    writeFileSync(join(d, 'src', 'a.ts'), '// @spec SPEC-042-1-flow-auth-oidc\nexport {};\n');
    const matrice = construireMatrice(d);
    suggererSpecs(d, matrice);
    const contenu = readFileSync(join(d, '.aiad', 'specs', 'SPEC-042-1-flow-auth-oidc.md'), 'utf-8');
    const { data } = parseFrontmatter(contenu);
    assert.equal(data.title, 'Flow auth oidc');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
