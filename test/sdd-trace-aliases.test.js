// Régression : matching tolérant des IDs Intent/SPEC dans construireMatrice.
// Couvre deux conventions courantes ignorées avant le fix :
//   - alias frontmatter `intent:` sur les SPECs (en plus de `parent_intent`)
//   - forme courte `INTENT-NNN` matchant un fichier sluggé `INTENT-NNN-slug.md`
// Ces deux écarts produisaient de faux "Intents sans SPEC" et bloquaient la
// CI via `aiad-sdd trace --fail-on-gap` sur des projets parfaitement annotés.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { construireMatrice } from '../lib/sdd-trace.js';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-trace-aliases-'));
  mkdirSync(join(dir, '.aiad', 'intents'), { recursive: true });
  mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
  mkdirSync(join(dir, 'src'), { recursive: true });
  return dir;
}

test('construireMatrice — frontmatter `intent:` accepté comme alias de parent_intent', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'intents', 'INTENT-042.md'),
      `---\ntitle: Auth\nstatus: active\n---\n# Auth\n`,
    );
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-042-1-login.md'),
      `---\nintent: INTENT-042\nstatus: ready\n---\n# Login\n`,
    );
    const m = construireMatrice(dir);
    assert.equal(m.gaps.intentsSansSpec.length, 0, 'Intent doit être lié à la SPEC via frontmatter intent:');
    assert.equal(m.forward[0].specs.length, 1);
    assert.equal(m.forward[0].specs[0].spec.id, 'SPEC-042-1-login');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('construireMatrice — ID court (INTENT-NNN) matche le fichier sluggé (INTENT-NNN-slug)', () => {
  // Avant le fix, `parent_intent: INTENT-042` ne matchait PAS un fichier
  // `INTENT-042-auth.md` car la comparaison était strict-equal. Le matching
  // forme-courte (préfixe numérique) lève cette friction sans imposer aux
  // utilisateurs de copier le slug complet partout.
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'intents', 'INTENT-042-auth.md'),
      `---\nstatus: active\n---\n# Auth\n`,
    );
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-042-1-login.md'),
      `---\nparent_intent: INTENT-042\nstatus: ready\n---\n# Login\n`,
    );
    writeFileSync(
      join(dir, 'src', 'login.ts'),
      `/**\n * @intent INTENT-042\n * @spec SPEC-042-1\n */\nexport const x = 1;\n`,
    );
    const m = construireMatrice(dir);
    assert.equal(m.gaps.intentsOrphelinsSurCode.length, 0);
    assert.equal(m.gaps.specsOrphelinsSurCode.length, 0);
    assert.equal(m.gaps.intentsSansSpec.length, 0);
    assert.equal(m.forward[0].intent.id, 'INTENT-042-auth');
    assert.equal(m.forward[0].specs[0].code.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
