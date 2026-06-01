// Tests annotations machine-vérifiables multi-language.
// Le parser fonctionne ligne par ligne sur n'importe quel commentaire ; on
// vérifie que les nouvelles extensions sont scannées et que la détection
// de tests est correcte par langage.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { construireMatrice, parserAnnotations } from '../lib/sdd-trace.js';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-multi-'));
  mkdirSync(join(dir, '.aiad', 'intents'), { recursive: true });
  mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
  writeFileSync(join(dir, '.aiad', 'intents', 'INTENT-001.md'), '---\nstatus: active\n---\n# I\n');
  return dir;
}

test('parserAnnotations — fonctionne identiquement quel que soit le commentaire', () => {
  const cases = [
    { lang: 'rust', src: '// @spec SPEC-001-1\nfn login() {}\n' },
    { lang: 'go', src: '// @spec SPEC-001-1\nfunc login() {}\n' },
    { lang: 'java', src: '// @spec SPEC-001-1\npublic void login() {}\n' },
    { lang: 'kotlin', src: '// @spec SPEC-001-1\nfun login() {}\n' },
    { lang: 'csharp', src: '// @spec SPEC-001-1\npublic void Login() {}\n' },
    { lang: 'ruby', src: '# @spec SPEC-001-1\ndef login; end\n' },
    { lang: 'php', src: '// @spec SPEC-001-1\nfunction login() {}\n' },
    { lang: 'swift', src: '// @spec SPEC-001-1\nfunc login() {}\n' },
    { lang: 'scala', src: '// @spec SPEC-001-1\ndef login() = ()\n' },
    { lang: 'elixir', src: '# @spec SPEC-001-1\ndef login(), do: nil\n' },
  ];
  for (const c of cases) {
    const r = parserAnnotations(c.src, `f.${c.lang}`);
    assert.equal(r.specs.length, 1, `pas de match en ${c.lang}`);
    assert.equal(r.specs[0].id, 'SPEC-001-1');
  }
});

test('parserAnnotations — commentaire Java/Rust/C# bloc /* */', () => {
  const r = parserAnnotations(`/**
 * @intent INTENT-042
 * @spec SPEC-042-1-foo
 * @verified-by tests/foo_test.go
 */
public class Foo {}
`, 'Foo.java');
  assert.equal(r.intents[0].id, 'INTENT-042');
  assert.equal(r.specs[0].id, 'SPEC-042-1-foo');
  assert.equal(r.verifiedBy[0].path, 'tests/foo_test.go');
});

test('construireMatrice — Rust + Go + Java vus comme code annoté', () => {
  const d = fixture();
  try {
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-rust.md'),
      '---\nparent_intent: INTENT-001\nstatus: ready\n---\n# Rust\n');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-2-go.md'),
      '---\nparent_intent: INTENT-001\nstatus: ready\n---\n# Go\n');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-3-java.md'),
      '---\nparent_intent: INTENT-001\nstatus: ready\n---\n# Java\n');

    mkdirSync(join(d, 'src'), { recursive: true });
    writeFileSync(join(d, 'src', 'lib.rs'), '// @spec SPEC-001-1-rust\npub fn login() {}\n');
    writeFileSync(join(d, 'src', 'main.go'), '// @spec SPEC-001-2-go\npackage main\nfunc Login() {}\n');
    writeFileSync(join(d, 'src', 'Login.java'), '// @spec SPEC-001-3-java\npublic class Login {}\n');

    const m = construireMatrice(d);
    const specsDansForward = m.forward[0].specs.map((s) => s.spec.id).sort();
    assert.deepEqual(specsDansForward, ['SPEC-001-1-rust', 'SPEC-001-2-go', 'SPEC-001-3-java']);
    // Chacun des 3 fichiers a du code annoté
    for (const s of m.forward[0].specs) {
      assert.equal(s.code.length, 1, `${s.spec.id} sans code`);
    }
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('estTest — patterns Rust / Go / Java / Ruby reconnus', () => {
  const d = fixture();
  try {
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1.md'),
      '---\nparent_intent: INTENT-001\nstatus: ready\n---\n# X\n');

    mkdirSync(join(d, 'src'), { recursive: true });
    mkdirSync(join(d, 'tests'), { recursive: true });
    // Code applicatif
    writeFileSync(join(d, 'src', 'lib.rs'), '// @spec SPEC-001-1\npub fn x() {}\n');
    // Test Rust : tests/foo.rs (dans dossier tests/)
    writeFileSync(join(d, 'tests', 'login_test.rs'), '// @spec SPEC-001-1\nfn t() {}\n');
    // Test Go : foo_test.go
    writeFileSync(join(d, 'src', 'main_test.go'), '// @spec SPEC-001-1\nfunc TestLogin() {}\n');
    // Test Java
    writeFileSync(join(d, 'src', 'LoginTest.java'), '// @spec SPEC-001-1\nclass LoginTest {}\n');
    // Test Ruby
    writeFileSync(join(d, 'src', 'login_spec.rb'), '# @spec SPEC-001-1\n');

    const m = construireMatrice(d);
    const tests = m.forward[0].specs[0].tests.map((t) => t.path).sort();
    // Tous les fichiers de test doivent être détectés (pattern par langage)
    assert.ok(tests.some((t) => t.endsWith('login_test.rs')), `Rust test absent: ${tests.join(', ')}`);
    assert.ok(tests.some((t) => t.endsWith('main_test.go')), `Go test absent: ${tests.join(', ')}`);
    assert.ok(tests.some((t) => t.endsWith('LoginTest.java')), `Java test absent: ${tests.join(', ')}`);
    assert.ok(tests.some((t) => t.endsWith('login_spec.rb')), `Ruby test absent: ${tests.join(', ')}`);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('SARIF — tags multi-language inclus dans les results', async () => {
  const { rendreSarif } = await import('../lib/sarif.js');
  const d = fixture();
  try {
    mkdirSync(join(d, 'src'), { recursive: true });
    // SPEC orpheline en Go
    writeFileSync(join(d, 'src', 'rogue.go'), '// @spec SPEC-999-1-fantome\npackage main\n');

    const m = construireMatrice(d);
    const sarif = rendreSarif(m);
    const r = sarif.runs[0].results.find((x) => x.ruleId === 'AIAD-TRACE-003');
    assert.ok(r);
    assert.equal(r.locations[0].physicalLocation.artifactLocation.uri, 'src/rogue.go');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
