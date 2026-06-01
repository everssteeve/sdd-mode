// Tests `scripts/lint-size.js` — module size budget.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import {
  compterLOC,
  listerJs,
  lireWhitelist,
  evaluerBudget,
} from '../scripts/lint-size.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', 'scripts', 'lint-size.js');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-size-')); }

// ─── compterLOC ─────────────────────────────────────────────────────────────

test('compterLOC — code pur sans commentaire ni vide', () => {
  const r = compterLOC('export const x = 1;\nexport const y = 2;\nexport const z = 3;\n');
  assert.equal(r.effective, 3);
  assert.equal(r.blank, 1); // dernière ligne vide après le \n final
  assert.equal(r.comment, 0);
});

test('compterLOC — lignes vides comptées séparément', () => {
  const r = compterLOC('a\n\nb\n\n\nc\n');
  assert.equal(r.effective, 3);
  assert.equal(r.blank, 4);
});

test('compterLOC — commentaires de ligne //', () => {
  const r = compterLOC('// commentaire\nconst a = 1;\n// autre commentaire\n');
  assert.equal(r.effective, 1);
  assert.equal(r.comment, 2);
});

test('compterLOC — bloc /* ... */ sur plusieurs lignes', () => {
  const code = `/*
 * docstring
 * multi-ligne
 */
const x = 1;`;
  const r = compterLOC(code);
  assert.equal(r.effective, 1);
  assert.equal(r.comment, 4);
});

test('compterLOC — bloc /* ... */ sur une seule ligne', () => {
  const r = compterLOC('/* inline */\nconst a = 1;\n');
  assert.equal(r.effective, 1);
  assert.equal(r.comment, 1);
});

test('compterLOC — code et commentaire mélangés', () => {
  const code = `// hello
function f() {
  // commentaire interne
  return 42;
}
`;
  const r = compterLOC(code);
  assert.equal(r.effective, 3); // function f() {, return 42;, }
  assert.equal(r.comment, 2);
});

test('compterLOC — fichier vide', () => {
  const r = compterLOC('');
  assert.equal(r.effective, 0);
});

// ─── listerJs ───────────────────────────────────────────────────────────────

test('listerJs — récursif sur sous-dossiers', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, 'sub'), { recursive: true });
    writeFileSync(join(d, 'a.js'), 'x');
    writeFileSync(join(d, 'b.txt'), 'x'); // ignoré (pas .js)
    writeFileSync(join(d, 'sub', 'c.js'), 'x');
    const out = listerJs(d).sort();
    assert.deepEqual(out, ['a.js', 'sub/c.js']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerJs — dossier inexistant → []', () => {
  assert.deepEqual(listerJs('/dev/null/inexistant-' + Math.random()), []);
});

// ─── lireWhitelist ──────────────────────────────────────────────────────────

test('lireWhitelist — fichier absent → {}', () => {
  const d = tmp();
  try {
    assert.deepEqual(lireWhitelist(d), {});
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireWhitelist — JSON invalide → {} (silent)', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, '.aiad-size-budget.json'), '{ corrupt');
    assert.deepEqual(lireWhitelist(d), {});
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireWhitelist — filtre les entrées non-numériques (_doc, _notes)', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, '.aiad-size-budget.json'), JSON.stringify({
      _doc: 'description',
      _notes: { 'lib/x.js': 'note' },
      'lib/x.js': 1000,
      'lib/y.js': 800,
      'lib/z.js': 'invalide-string',
      'lib/neg.js': -5,
    }));
    const r = lireWhitelist(d);
    assert.deepEqual(r, { 'lib/x.js': 1000, 'lib/y.js': 800 });
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── evaluerBudget ──────────────────────────────────────────────────────────

test('evaluerBudget — tous sous le seuil → ok', () => {
  const r = evaluerBudget(
    [{ path: 'lib/a.js', effective: 100 }, { path: 'lib/b.js', effective: 200 }],
    { seuilDefaut: 500, whitelist: {} },
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.depassements, []);
  assert.equal(r.total, 300);
  assert.equal(r.max, 200);
});

test('evaluerBudget — un module au-dessus → !ok', () => {
  const r = evaluerBudget(
    [{ path: 'lib/big.js', effective: 800 }, { path: 'lib/small.js', effective: 100 }],
    { seuilDefaut: 500, whitelist: {} },
  );
  assert.equal(r.ok, false);
  assert.equal(r.depassements.length, 1);
  assert.equal(r.depassements[0].path, 'lib/big.js');
  assert.equal(r.depassements[0].depassement, 300);
});

test('evaluerBudget — whitelist exempte un module', () => {
  const r = evaluerBudget(
    [{ path: 'lib/big.js', effective: 800 }],
    { seuilDefaut: 500, whitelist: { 'lib/big.js': 1000 } },
  );
  assert.equal(r.ok, true);
});

test('evaluerBudget — whitelist trop étroite → !ok', () => {
  const r = evaluerBudget(
    [{ path: 'lib/big.js', effective: 800 }],
    { seuilDefaut: 500, whitelist: { 'lib/big.js': 600 } },
  );
  assert.equal(r.ok, false);
  assert.equal(r.depassements[0].depassement, 200);
});

test('evaluerBudget — modules triés par taille décroissante', () => {
  const r = evaluerBudget(
    [
      { path: 'lib/small.js', effective: 100 },
      { path: 'lib/big.js', effective: 500 },
      { path: 'lib/medium.js', effective: 300 },
    ],
    { seuilDefaut: 1000, whitelist: {} },
  );
  assert.equal(r.modules[0].path, 'lib/big.js');
  assert.equal(r.modules[1].path, 'lib/medium.js');
  assert.equal(r.modules[2].path, 'lib/small.js');
});

// ─── CLI ────────────────────────────────────────────────────────────────────

test('CLI — strict mode passe sur le repo réel (whitelist en place)', () => {
  const r = spawnSync('node', [SCRIPT, '--strict'], { encoding: 'utf-8' });
  assert.equal(r.status, 0, `stderr=${r.stderr}\nstdout=${r.stdout}`);
});

test('CLI — --json produit un rapport exploitable', () => {
  const r = spawnSync('node', [SCRIPT, '--json'], { encoding: 'utf-8' });
  assert.equal(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.equal(parsed.ok, true);
  assert.ok(typeof parsed.total === 'number');
  assert.ok(parsed.total > 0);
  assert.ok(Array.isArray(parsed.top));
  assert.ok(parsed.top.length > 0);
});

test('CLI — seuil bas force des dépassements', () => {
  const r = spawnSync('node', [SCRIPT, '--threshold', '50', '--strict'], { encoding: 'utf-8' });
  assert.equal(r.status, 1, 'exit 1 attendu en strict avec seuil bas');
});

// ─── Méta : top 5 ne dépasse pas la marge whitelistée ───────────────────────

test('Méta — aucun module lib/ ne dépasse 850 LOC effectives (limite stricte)', async () => {
  const { readFileSync } = await import('node:fs');
  const r = spawnSync('node', [SCRIPT, '--json'], { encoding: 'utf-8' });
  const parsed = JSON.parse(r.stdout);
  for (const m of parsed.top) {
    assert.ok(m.effective <= 850, `${m.path} dépasse la limite stricte : ${m.effective} LOC`);
  }
});
