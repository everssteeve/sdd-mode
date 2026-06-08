// Tests `lib/jnsp.js` — détection des marqueurs TODO-JNSP (§3.2).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  JNSP_TOKEN,
  marqueur,
  estFichierCode,
  scannerContenu,
  construireDecisionHook,
  // alias EN
  isCodeFile,
  scanContent,
  buildHookDecision,
} from '../lib/jnsp.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RACINE = join(__dirname, '..');

// Construit dynamiquement le marqueur pour ne pas l'écrire en clair ici.
const M = `${JNSP_TOKEN}:`;

test('estFichierCode — exclut la doc Markdown', () => {
  assert.equal(estFichierCode('lib/x.js'), true);
  assert.equal(estFichierCode('README.md'), false);
  assert.equal(estFichierCode('docs/x.markdown'), false);
  assert.equal(estFichierCode('a.mdx'), false);
});

test('scannerContenu — détecte un marqueur en commentaire', () => {
  const src = `function f() {\n  // ${M} faut-il chiffrer le champ ?\n  return 1;\n}`;
  const hits = scannerContenu(src, 'lib/f.js');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 2);
  assert.equal(hits[0].file, 'lib/f.js');
});

test('scannerContenu — ignore une mention hors commentaire (backtick/chaîne)', () => {
  const src = 'const doc = `' + M + ' ceci est un exemple`;\nconst s = "' + M + ' string";';
  const hits = scannerContenu(src);
  assert.equal(hits.length, 0);
});

test('scannerContenu — supporte # et /* */', () => {
  assert.equal(scannerContenu(`# ${M} question python`).length, 1);
  assert.equal(scannerContenu(`/* ${M} question bloc */`).length, 1);
});

test('construireDecisionHook — vide → pas de deny', () => {
  const d = construireDecisionHook([]);
  assert.equal(d.deny, false);
});

test('construireDecisionHook — hits → deny + raison listant les marqueurs', () => {
  const d = construireDecisionHook([{ file: 'a.js', line: 3, text: `// ${M} x` }]);
  assert.equal(d.deny, true);
  assert.ok(d.reason.includes('a.js:3'));
  assert.ok(d.reason.includes(JNSP_TOKEN));
});

// ─── Intégration : exécution réelle du hook self-contained ──────────────────
//
// Exécute le hook contre un dépôt git temporaire → garantit la parité de
// comportement avec `lib/jnsp.js` (un drift du hook casse ce test).

function gitInit(dir) {
  const opt = { cwd: dir, stdio: 'ignore' };
  execFileSync('git', ['init', '-q'], opt);
  execFileSync('git', ['config', 'user.email', 't@t.io'], opt);
  execFileSync('git', ['config', 'user.name', 'T'], opt);
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], opt);
}

/** Lance le hook ; retourne { code, stdout }. */
function runHook(dir) {
  const hook = join(RACINE, '.aiad', 'hooks', 'jnsp-scan.js');
  try {
    const stdout = execFileSync('node', [hook], { cwd: dir, encoding: 'utf-8', env: { ...process.env, CLAUDE_EFFORT: 'medium' } });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status, stdout: e.stdout ? String(e.stdout) : '' };
  }
}

test('hook jnsp-scan.js — bloque (exit 2 + deny) sur un marqueur stagé', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-jnsp-'));
  gitInit(dir);
  writeFileSync(join(dir, 'a.js'), `function f() {\n  // ${M} faut-il chiffrer ?\n}`);
  execFileSync('git', ['add', 'a.js'], { cwd: dir, stdio: 'ignore' });
  const r = runHook(dir);
  assert.equal(r.code, 2, 'le hook doit bloquer (exit 2)');
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.ok(out.hookSpecificOutput.permissionDecisionReason.includes('a.js:2'));
});

test('hook jnsp-scan.js — autorise (exit 0) sans marqueur', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-jnsp-'));
  gitInit(dir);
  writeFileSync(join(dir, 'a.js'), 'function f() { return 1; }');
  execFileSync('git', ['add', 'a.js'], { cwd: dir, stdio: 'ignore' });
  const r = runHook(dir);
  assert.equal(r.code, 0);
});

test('hook jnsp-scan.js — ignore la doc Markdown même avec marqueur', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-jnsp-'));
  gitInit(dir);
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'docs', 'g.md'), `Exemple : // ${M} ceci décrit le pattern`);
  execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'ignore' });
  const r = runHook(dir);
  assert.equal(r.code, 0, 'la doc Markdown ne doit pas bloquer');
});

test('marqueur() retourne une RegExp neuve à chaque appel (pas d\'état partagé)', () => {
  const a = marqueur('g');
  const b = marqueur('g');
  assert.notEqual(a, b);
});

test('alias EN', () => {
  assert.equal(isCodeFile, estFichierCode);
  assert.equal(scanContent, scannerContenu);
  assert.equal(buildHookDecision, construireDecisionHook);
});
