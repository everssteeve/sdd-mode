// Tests `scripts/lint-esm.js` — garde-fou ESM strict.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  effacerStringsEtCommentaires,
  detecterViolations,
  inspecter,
  listerJs,
} from '../scripts/lint-esm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', 'scripts', 'lint-esm.js');

// ─── effacerStringsEtCommentaires ───────────────────────────────────────────

test('effacerStringsEtCommentaires — retire commentaire de ligne', () => {
  const r = effacerStringsEtCommentaires('const a = 1; // comment');
  assert.equal(r.trim(), 'const a = 1;');
});

test('effacerStringsEtCommentaires — préserve // dans une string', () => {
  const r = effacerStringsEtCommentaires('const url = "http://example.com";');
  // La chaîne entière est remplacée par "" mais le code reste valide
  assert.match(r, /const url = ""/);
});

test('effacerStringsEtCommentaires — efface les chaînes simples / doubles / templates mono-ligne', () => {
  assert.match(effacerStringsEtCommentaires("const a = 'foo';"), /const a = ''/);
  assert.match(effacerStringsEtCommentaires('const a = "foo";'), /const a = ""/);
  assert.match(effacerStringsEtCommentaires('const a = `foo`;'), /const a = ``/);
});

// ─── detecterViolations ─────────────────────────────────────────────────────

test('detecterViolations — code ESM propre → 0 violation', () => {
  const code = `import fs from 'node:fs';
export const x = 1;
export function f() { return x; }
`;
  assert.deepEqual(detecterViolations(code), []);
});

test('detecterViolations — require() détecté', () => {
  const code = `const fs = require('node:fs');\n`;
  const v = detecterViolations(code);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, 'no-require');
  assert.equal(v[0].line, 1);
});

test('detecterViolations — module.exports détecté', () => {
  const code = `function f() {}\nmodule.exports = f;\n`;
  const v = detecterViolations(code);
  const rules = v.map((x) => x.rule);
  assert.ok(rules.includes('no-module-exports'));
});

test('detecterViolations — exports.X = ... détecté', () => {
  const code = `function f() {}\nexports.foo = f;\n`;
  const v = detecterViolations(code);
  const rules = v.map((x) => x.rule);
  assert.ok(rules.includes('no-exports-property'));
});

test('detecterViolations — __dirname brut sans redéfinition détecté', () => {
  const code = `import { join } from 'node:path';
const p = join(__dirname, 'x');
`;
  const v = detecterViolations(code);
  const rules = v.map((x) => x.rule);
  assert.ok(rules.includes('no-bare-dirname'));
});

test('detecterViolations — __dirname redéfini via import.meta.url → OK', () => {
  const code = `import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const p = join(__dirname, 'x');
`;
  const v = detecterViolations(code);
  // __dirname redéfini → pas de violation no-bare-dirname
  assert.equal(v.filter((x) => x.rule === 'no-bare-dirname').length, 0);
});

test('detecterViolations — createRequire(import.meta.url) tolère require()', () => {
  const code = `import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pkg = require('some-cjs-only-pkg');
`;
  const v = detecterViolations(code);
  // require() est toléré ici car createRequire est présent
  assert.equal(v.filter((x) => x.rule === 'no-require').length, 0);
});

test('detecterViolations — require() dans un commentaire ignoré', () => {
  const code = `// Pour utiliser ce module : const fs = require('fs');
import fs from 'node:fs';
`;
  const v = detecterViolations(code);
  assert.equal(v.filter((x) => x.rule === 'no-require').length, 0);
});

test('detecterViolations — require() dans une string mono-ligne ignoré', () => {
  const code = `import fs from 'node:fs';
const msg = "n'utilise pas require() en ESM";
`;
  const v = detecterViolations(code);
  assert.equal(v.filter((x) => x.rule === 'no-require').length, 0);
});

test('detecterViolations — require() dans un template literal multi-ligne ignoré', () => {
  const code = `import fs from 'node:fs';
console.error(\`
  Évite require() en ESM
  module.exports = ... non plus
\`);
`;
  const v = detecterViolations(code);
  assert.equal(v.length, 0, `attendu 0 violation, vu ${JSON.stringify(v)}`);
});

test('detecterViolations — multiples violations détectées simultanément', () => {
  const code = `const fs = require('fs');
exports.x = 1;
module.exports = { x: 1 };
`;
  const v = detecterViolations(code);
  assert.ok(v.length >= 3);
});

test('detecterViolations — line numbers exacts', () => {
  const code = `// ligne 1
import fs from 'node:fs';
const x = require('y');
export const z = 1;
`;
  const v = detecterViolations(code);
  assert.equal(v[0].line, 3);
});

// ─── listerJs / inspecter sur le repo réel ─────────────────────────────────

test('listerJs — produit une liste non vide pour lib/', () => {
  const racine = join(__dirname, '..');
  const out = listerJs(join(racine, 'lib'));
  assert.ok(out.length > 10);
  assert.ok(out.every((p) => p.endsWith('.js')));
});

test('inspecter — repo aiad-sdd actuel : 0 violation (ESM strict préservé)', () => {
  const racine = join(__dirname, '..');
  const r = inspecter([
    join(racine, 'lib'),
    join(racine, 'bin'),
    join(racine, 'scripts'),
  ]);
  // Aucune violation tolérée sur le repo réel
  assert.equal(r.length, 0, `violations détectées : ${JSON.stringify(r, null, 2)}`);
});

// ─── CLI ────────────────────────────────────────────────────────────────────

test('CLI — repo réel : exit 0', () => {
  const r = spawnSync('node', [SCRIPT], { encoding: 'utf-8' });
  assert.equal(r.status, 0, `stderr=${r.stderr}\nstdout=${r.stdout}`);
});

test('CLI — --json produit un rapport exploitable', () => {
  const r = spawnSync('node', [SCRIPT, '--json'], { encoding: 'utf-8' });
  assert.equal(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.total, 0);
  assert.deepEqual(parsed.files, []);
});
