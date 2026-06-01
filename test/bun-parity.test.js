// Tests `scripts/bun-parity.js` — matrice Bun feature parity (item #111).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMMANDES, executerSousRuntime, comparer, executerMatrice, rendreRapport,
} from '../scripts/bun-parity.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── COMMANDES (catalogue) ─────────────────────────────────────────────────

test('COMMANDES — catalogue de ~23 commandes safe', () => {
  assert.ok(COMMANDES.length >= 20, `attendu ≥ 20 commandes, vu ${COMMANDES.length}`);
});

test('COMMANDES — chaque entrée a id, args, expect', () => {
  for (const c of COMMANDES) {
    assert.ok(typeof c.id === 'string' && c.id.length > 0, `id manquant`);
    assert.ok(Array.isArray(c.args) && c.args.length > 0, `${c.id} : args manquants`);
    assert.ok(['success', 'any', 'exit-nonzero-ok'].includes(c.expect),
      `${c.id} : expect invalide`);
  }
});

test('COMMANDES — IDs uniques', () => {
  const ids = COMMANDES.map((c) => c.id);
  const set = new Set(ids);
  assert.equal(set.size, ids.length);
});

test('COMMANDES — couvre toutes les commandes critiques', () => {
  const ids = new Set(COMMANDES.map((c) => c.id));
  for (const attendu of ['version', 'help', 'status', 'doctor-json', 'sbom-json', 'sovereignty-json', 'completion-bash', 'pii-scan-json']) {
    assert.ok(ids.has(attendu), `commande ${attendu} absente du catalogue`);
  }
});

// ─── comparer ──────────────────────────────────────────────────────────────

test('comparer — match parfait', () => {
  const r = comparer(
    { status: 0, stdout: 'OK' },
    { status: 0, stdout: 'OK' },
    'success',
  );
  assert.equal(r.match, true);
});

test('comparer — exit codes différents → mismatch', () => {
  const r = comparer(
    { status: 0, stdout: 'OK' },
    { status: 1, stdout: 'KO' },
    'any',
  );
  assert.equal(r.match, false);
  assert.match(r.raison, /Exit codes différents/);
});

test('comparer — expect success mais Node échoue → mismatch', () => {
  const r = comparer(
    { status: 1, stdout: '' },
    { status: 1, stdout: '' },
    'success',
  );
  assert.equal(r.match, false);
  assert.match(r.raison, /Node a échoué/);
});

test('comparer — signature présente Node, absente Bun → mismatch', () => {
  const r = comparer(
    { status: 0, stdout: 'aiad signature' },
    { status: 0, stdout: 'nothing' },
    'success',
    (o) => o.includes('aiad'),
  );
  assert.equal(r.match, false);
  assert.match(r.raison, /Signature.*divergente/);
});

test('comparer — signature présente dans les deux → match', () => {
  const r = comparer(
    { status: 0, stdout: 'aiad OK' },
    { status: 0, stdout: 'aiad OK' },
    'success',
    (o) => o.includes('aiad'),
  );
  assert.equal(r.match, true);
});

test('comparer — signature absente partout → mismatch', () => {
  const r = comparer(
    { status: 0, stdout: 'nothing' },
    { status: 0, stdout: 'nothing' },
    'success',
    (o) => o.includes('aiad'),
  );
  assert.equal(r.match, false);
  assert.match(r.raison, /Signature absente/);
});

// ─── executerSousRuntime ──────────────────────────────────────────────────

test('executerSousRuntime — node --version local', () => {
  const r = executerSousRuntime('node', ['--version'], ROOT);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.length > 0);
});

// ─── executerMatrice (sans Bun, en mode local) ────────────────────────────

test('executerMatrice — sans Bun → tous match (Node-only)', () => {
  const r = executerMatrice({ withBun: false });
  assert.equal(r.bunDetecte, false);
  assert.equal(r.divergences, 0);
  assert.equal(r.ok, r.total);
  assert.ok(r.total >= 20);
});

test('executerMatrice — résultats incluent id + nodeStatus + match', () => {
  const r = executerMatrice({ withBun: false });
  for (const res of r.resultats) {
    assert.ok(res.id);
    assert.ok(typeof res.nodeStatus === 'number');
    assert.ok(typeof res.match === 'boolean');
  }
});

// ─── rendreRapport ─────────────────────────────────────────────────────────

test('rendreRapport — markdown structuré', () => {
  const md = rendreRapport({
    bunDetecte: false,
    total: 2,
    ok: 2,
    divergences: 0,
    resultats: [
      { id: 'a', args: ['--version'], nodeStatus: 0, bunStatus: null, match: true },
      { id: 'b', args: ['help'], nodeStatus: 0, bunStatus: null, match: true },
    ],
  });
  assert.match(md, /^# Bun feature parity report/m);
  assert.match(md, /Total commandes testées.*2/);
  assert.match(md, /Match.*2\/2/);
  assert.match(md, /\| `a` \| `--version`/);
  assert.match(md, /## Méthodologie/);
});

test('rendreRapport — section divergences quand présentes', () => {
  const md = rendreRapport({
    bunDetecte: true,
    total: 2,
    ok: 1,
    divergences: 1,
    resultats: [
      { id: 'a', args: [], nodeStatus: 0, bunStatus: 0, match: true },
      { id: 'b', args: [], nodeStatus: 0, bunStatus: 1, match: false, raison: 'Exit codes différents' },
    ],
  });
  assert.match(md, /## Divergences observées/);
  assert.match(md, /\*\*b\*\*.*Exit codes différents/);
});

test('rendreRapport — bunDetecte=false → mention ❌ skip', () => {
  const md = rendreRapport({
    bunDetecte: false, total: 1, ok: 1, divergences: 0, resultats: [],
  });
  assert.match(md, /Bun détecté.*❌/);
});

// ─── Script CLI ───────────────────────────────────────────────────────────

test('script --json --no-bun → JSON valide sur stdout', () => {
  const r = spawnSync('node', ['scripts/bun-parity.js', '--json', '--no-bun'], {
    cwd: ROOT, encoding: 'utf-8', timeout: 60000,
  });
  assert.equal(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.ok(parsed.total >= 20);
  assert.equal(parsed.bunDetecte, false);
});

test('script --check sans divergence → exit 0', () => {
  const r = spawnSync('node', ['scripts/bun-parity.js', '--check', '--no-bun'], {
    cwd: ROOT, encoding: 'utf-8', timeout: 60000,
  });
  assert.equal(r.status, 0);
});
