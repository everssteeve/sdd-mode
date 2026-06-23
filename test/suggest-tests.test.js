// @spec SPEC-019-1-skeleton-generator
// @verified-by test/suggest-tests.test.js

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { genererSquelettesTests } from '../lib/test-skeleton-generator.js';

function makeDir(suffix) {
  const dir = join(tmpdir(), `aiad-suggest-tests-${suffix}`);
  mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
  mkdirSync(join(dir, 'test'), { recursive: true });
  return dir;
}

const SPEC_EARS_VALID = `**Format** : EARS

## 3. Critères d'Acceptation (EARS)

### CA-001 — Génération basique
> Pattern : Event-driven
\`WHEN a PE runs the command, the generator SHALL write the file.\`

### CA-002 — Annotations présentes
> Pattern : Ubiquitous
\`The generator SHALL write annotations.\`
`;

const SPEC_NO_EARS = `## 3. Critères

### CA-001 — Truc
\`The system SHALL do something.\`
`;

const SPEC_EARS_NO_CA = `**Format** : EARS

## 3. Critères

Aucun CA ici.
`;

// CA-001 — Génération depuis SPEC EARS valide
test('CA-001 — file written for valid EARS spec', () => {
  const racine = makeDir('ca001');
  writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-999-1-test.md'), SPEC_EARS_VALID);

  const result = genererSquelettesTests('SPEC-999-1', { racine });
  assert.ok(existsSync(result.outputPath), 'fichier créé');
  assert.match(result.outputPath, /SPEC-999-1\.test\.js$/);

  rmSync(racine, { recursive: true });
});

// CA-002 — Un cas de test par CA-NNN
test('CA-002 — one test entry per CA-NNN', () => {
  const racine = makeDir('ca002');
  writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-999-1-test.md'), SPEC_EARS_VALID);

  const { content } = genererSquelettesTests('SPEC-999-1', { racine, dryRun: true });
  assert.ok(content.includes("test('CA-001 —"), 'CA-001 présent');
  assert.ok(content.includes("test('CA-002 —"), 'CA-002 présent');
  assert.equal((content.match(/^test\(/mg) || []).length, 2, 'exactement 2 cas');

  rmSync(racine, { recursive: true });
});

// CA-003 — Annotations machine-vérifiables en en-tête
test('CA-003 — @spec and @verified-by as first two lines', () => {
  const racine = makeDir('ca003');
  writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-999-1-test.md'), SPEC_EARS_VALID);

  const { content } = genererSquelettesTests('SPEC-999-1', { racine, dryRun: true });
  const lines = content.split('\n');
  assert.match(lines[0], /^\/\/ @spec SPEC-999-1-test$/);
  assert.match(lines[1], /^\/\/ @verified-by test\/SPEC-999-1\.test\.js$/);

  rmSync(racine, { recursive: true });
});

// CA-004 — Protection contre l'écrasement (exit code via code d'erreur)
test('CA-004 — throws EXISTS when file exists without --force', () => {
  const racine = makeDir('ca004');
  writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-999-1-test.md'), SPEC_EARS_VALID);
  writeFileSync(join(racine, 'test', 'SPEC-999-1.test.js'), 'existing');

  assert.throws(
    () => genererSquelettesTests('SPEC-999-1', { racine }),
    { code: 'EXISTS' }
  );

  rmSync(racine, { recursive: true });
});

// CA-004b — Message d'erreur écrasement
test('CA-004b — error message contains "already exists" and "--force"', () => {
  const racine = makeDir('ca004b');
  writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-999-1-test.md'), SPEC_EARS_VALID);
  writeFileSync(join(racine, 'test', 'SPEC-999-1.test.js'), 'existing');

  assert.throws(
    () => genererSquelettesTests('SPEC-999-1', { racine }),
    (err) => {
      assert.ok(err.message.includes('already exists'), `message: ${err.message}`);
      assert.ok(err.message.includes('--force'), `mentions --force: ${err.message}`);
      return true;
    }
  );

  rmSync(racine, { recursive: true });
});

// CA-005 — Rejet SPEC non-EARS (code d'erreur)
test('CA-005 — throws NOT_EARS for non-EARS spec, no file created', () => {
  const racine = makeDir('ca005');
  writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-999-1-test.md'), SPEC_NO_EARS);

  assert.throws(
    () => genererSquelettesTests('SPEC-999-1', { racine }),
    { code: 'NOT_EARS' }
  );
  assert.ok(!existsSync(join(racine, 'test', 'SPEC-999-1.test.js')), 'aucun fichier créé');

  rmSync(racine, { recursive: true });
});

// CA-005b — Message d'erreur SPEC non-EARS
test('CA-005b — error message for non-EARS spec contains expected text', () => {
  const racine = makeDir('ca005b');
  writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-999-1-test.md'), SPEC_NO_EARS);

  assert.throws(
    () => genererSquelettesTests('SPEC-999-1', { racine }),
    (err) => {
      assert.ok(err.message.includes('not an EARS spec'), `message: ${err.message}`);
      return true;
    }
  );

  rmSync(racine, { recursive: true });
});

// CA-006 — Rejet SPEC EARS sans CA (code d'erreur)
test('CA-006 — throws NO_CA for EARS spec with no CA-NNN, no file created', () => {
  const racine = makeDir('ca006');
  writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-999-1-test.md'), SPEC_EARS_NO_CA);

  assert.throws(
    () => genererSquelettesTests('SPEC-999-1', { racine }),
    { code: 'NO_CA' }
  );
  assert.ok(!existsSync(join(racine, 'test', 'SPEC-999-1.test.js')), 'aucun fichier créé');

  rmSync(racine, { recursive: true });
});

// CA-006b — Message d'erreur EARS sans CA
test('CA-006b — error message for EARS spec with no CA', () => {
  const racine = makeDir('ca006b');
  writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-999-1-test.md'), SPEC_EARS_NO_CA);

  assert.throws(
    () => genererSquelettesTests('SPEC-999-1', { racine }),
    (err) => {
      assert.ok(err.message.includes('no acceptance criteria found'), `message: ${err.message}`);
      return true;
    }
  );

  rmSync(racine, { recursive: true });
});

// CA-007 — Mode dry-run
test('CA-007 — dry-run returns content without writing file', () => {
  const racine = makeDir('ca007');
  writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-999-1-test.md'), SPEC_EARS_VALID);

  const { content } = genererSquelettesTests('SPEC-999-1', { racine, dryRun: true });
  assert.ok(content.length > 0, 'contenu non vide');
  assert.ok(!existsSync(join(racine, 'test', 'SPEC-999-1.test.js')), 'aucun fichier écrit');

  rmSync(racine, { recursive: true });
});
