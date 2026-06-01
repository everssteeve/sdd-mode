// Tests `lib/bench-history.js` — benchmark continu + régression (item #127).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendRun, lireHistorique, comparer, compareCli, CONSTANTS,
  // alias EN
  logRun, readHistory, compare, compareCommand,
} from '../lib/bench-history.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-bh-')); }
function silent(fn) {
  return (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

function fakeBenchResult(overrides = {}) {
  return {
    apresTokens: 100, apresBytes: 500,
    transitionTokens: 150, avantTokens: 200,
    routers: { count: 3 }, alias: { count: 5 },
    ...overrides,
  };
}

// ─── appendRun / lireHistorique ──────────────────────────────────────────

test('appendRun — crée le fichier JSONL avec une entrée', () => {
  const d = tmp();
  try {
    const r = appendRun(d, fakeBenchResult({ apresTokens: 120 }));
    assert.match(r.path, /bench-history\.jsonl$/);
    const content = readFileSync(join(d, '.aiad', 'metrics', 'bench-history.jsonl'), 'utf-8');
    const entry = JSON.parse(content.trim());
    assert.equal(entry.apresTokens, 120);
    assert.ok(entry.ts.match(/^\d{4}-/));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('appendRun — append multiple sans écrasement', () => {
  const d = tmp();
  try {
    appendRun(d, fakeBenchResult({ apresTokens: 100 }));
    appendRun(d, fakeBenchResult({ apresTokens: 110 }));
    appendRun(d, fakeBenchResult({ apresTokens: 105 }));
    const lignes = readFileSync(
      join(d, '.aiad', 'metrics', 'bench-history.jsonl'), 'utf-8',
    ).trim().split('\n');
    assert.equal(lignes.length, 3);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireHistorique — fichier absent → []', () => {
  const d = tmp();
  try { assert.deepEqual(lireHistorique(d), []); }
  finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireHistorique — ligne corrompue ignorée', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'metrics'), { recursive: true });
    writeFileSync(
      join(d, '.aiad', 'metrics', 'bench-history.jsonl'),
      '{"ts":"2026-05-10","apresTokens":100}\nNOT_JSON\n{"ts":"2026-05-11","apresTokens":105}\n',
    );
    assert.equal(lireHistorique(d).length, 2);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── comparer ─────────────────────────────────────────────────────────────

test('comparer — historique vide → suffisant=false', () => {
  const r = comparer([]);
  assert.equal(r.suffisant, false);
  assert.equal(r.regression, false);
});

test('comparer — < 2 runs récents OU anciens → suffisant=false', () => {
  const now = new Date('2026-05-15T00:00:00Z');
  const historique = [
    { ts: '2026-05-14T00:00:00Z', apresTokens: 100 },
    { ts: '2026-05-13T00:00:00Z', apresTokens: 105 },
    { ts: '2026-04-20T00:00:00Z', apresTokens: 90 },  // seul ancien
  ];
  const r = comparer(historique, { since: 14, now });
  assert.equal(r.suffisant, false);
});

test('comparer — pas de régression (stable) → regression=false', () => {
  const now = new Date('2026-05-15T00:00:00Z');
  const historique = [
    // Anciens (entre J-28 et J-14)
    { ts: '2026-04-22T00:00:00Z', apresTokens: 100 },
    { ts: '2026-04-25T00:00:00Z', apresTokens: 100 },
    // Récents (entre J-14 et J0)
    { ts: '2026-05-05T00:00:00Z', apresTokens: 102 },
    { ts: '2026-05-10T00:00:00Z', apresTokens: 103 },
  ];
  const r = comparer(historique, { since: 14, threshold: 0.2, now });
  assert.equal(r.suffisant, true);
  assert.equal(r.regression, false);
  assert.ok(r.ratio < 0.1);
});

test('comparer — régression > 20% → regression=true', () => {
  const now = new Date('2026-05-15T00:00:00Z');
  const historique = [
    { ts: '2026-04-22T00:00:00Z', apresTokens: 100 },
    { ts: '2026-04-25T00:00:00Z', apresTokens: 100 },
    { ts: '2026-05-05T00:00:00Z', apresTokens: 140 },  // +40%
    { ts: '2026-05-10T00:00:00Z', apresTokens: 150 },
  ];
  const r = comparer(historique, { since: 14, threshold: 0.2, now });
  assert.equal(r.regression, true);
  assert.ok(r.ratio >= 0.2);
  assert.equal(r.delta, 45);
});

test('comparer — amélioration (réduction) → regression=false', () => {
  const now = new Date('2026-05-15T00:00:00Z');
  const historique = [
    { ts: '2026-04-22T00:00:00Z', apresTokens: 200 },
    { ts: '2026-04-25T00:00:00Z', apresTokens: 200 },
    { ts: '2026-05-05T00:00:00Z', apresTokens: 150 },
    { ts: '2026-05-10T00:00:00Z', apresTokens: 145 },
  ];
  const r = comparer(historique, { since: 14, threshold: 0.2, now });
  assert.equal(r.regression, false);
  assert.ok(r.ratio < 0);
});

test('comparer — threshold custom plus serré déclenche plus tôt', () => {
  const now = new Date('2026-05-15T00:00:00Z');
  const historique = [
    { ts: '2026-04-22T00:00:00Z', apresTokens: 100 },
    { ts: '2026-04-25T00:00:00Z', apresTokens: 100 },
    { ts: '2026-05-05T00:00:00Z', apresTokens: 110 },  // +10%
    { ts: '2026-05-10T00:00:00Z', apresTokens: 110 },
  ];
  const r1 = comparer(historique, { since: 14, threshold: 0.05, now });
  assert.equal(r1.regression, true);
  const r2 = comparer(historique, { since: 14, threshold: 0.2, now });
  assert.equal(r2.regression, false);
});

test('comparer — ts invalide → ignoré sans crash', () => {
  const now = new Date('2026-05-15T00:00:00Z');
  const historique = [
    { ts: 'pas-une-date', apresTokens: 100 },
    { ts: '2026-04-22T00:00:00Z', apresTokens: 100 },
    { ts: '2026-04-25T00:00:00Z', apresTokens: 100 },
    { ts: '2026-05-05T00:00:00Z', apresTokens: 100 },
    { ts: '2026-05-10T00:00:00Z', apresTokens: 100 },
  ];
  const r = comparer(historique, { since: 14, now });
  assert.equal(r.suffisant, true);
});

// ─── compareCli (CLI) ────────────────────────────────────────────────────

test('compareCli — historique insuffisant → message + JSON', () => {
  const d = tmp();
  try {
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { compareCli(d, { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.suffisant, false);
    assert.equal(parsed.totalRuns, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('compareCli — humain smoke', silent(() => {
  const d = tmp();
  try {
    const r = compareCli(d);
    assert.equal(r.suffisant, false);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('compareCli — détecte régression avec historique réel', () => {
  const d = tmp();
  try {
    const now = new Date('2026-05-15T00:00:00Z');
    mkdirSync(join(d, '.aiad', 'metrics'), { recursive: true });
    writeFileSync(
      join(d, '.aiad', 'metrics', 'bench-history.jsonl'),
      [
        { ts: '2026-04-22T00:00:00Z', apresTokens: 100 },
        { ts: '2026-04-25T00:00:00Z', apresTokens: 100 },
        { ts: '2026-05-05T00:00:00Z', apresTokens: 150 },
        { ts: '2026-05-10T00:00:00Z', apresTokens: 150 },
      ].map((e) => JSON.stringify(e)).join('\n') + '\n',
    );
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { compareCli(d, { since: 14, now, json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.suffisant, true);
    assert.equal(parsed.regression, true);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(logRun, appendRun);
  assert.equal(readHistory, lireHistorique);
  assert.equal(compare, comparer);
  assert.equal(compareCommand, compareCli);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.LOG_PATH, '.aiad/metrics/bench-history.jsonl');
  assert.equal(CONSTANTS.SEUIL_REGRESSION_DEFAUT, 0.2);
  assert.equal(CONSTANTS.SINCE_DEFAUT_JOURS, 14);
});
