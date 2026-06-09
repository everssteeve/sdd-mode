// Tests `lib/canary.js` — canary suite + alignement modèles (§3.10).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KINDS,
  TOLERANCE_DEFAUT,
  parserCasCanary,
  chargerCasCanary,
  evaluerDeterministe,
  evaluerGeneratif,
  executerCanary,
  lireSnapshotCanary,
  // alias EN
  runCanary,
  evaluateGenerative,
} from '../lib/canary.js';
import { validerSchema } from '../lib/verdict.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(readFileSync(join(__dirname, '..', '.aiad', 'schema', 'verdicts', 'canary.schema.json'), 'utf-8'));

function tmp() {
  return mkdtempSync(join(tmpdir(), 'canary-'));
}

// ─── Parsing ────────────────────────────────────────────────────────────────

test('parserCasCanary — cas deterministic valide', () => {
  const c = parserCasCanary('---\nid: CANARY-001\nkind: deterministic\ncommand: discovery-check INTENT-000\nexpected: JNSP\n---\n# x');
  assert.equal(c.id, 'CANARY-001');
  assert.equal(c.kind, 'deterministic');
  assert.equal(c.command, 'discovery-check INTENT-000');
  assert.equal(c.expected, 'JNSP');
  assert.equal(c.valide, true);
});

test('parserCasCanary — cas generative avec tolérance par défaut', () => {
  const c = parserCasCanary('---\nid: CANARY-010\nkind: generative\nexpected: 4\n---\n# x');
  assert.equal(c.kind, 'generative');
  assert.equal(c.expected, 4);
  assert.equal(c.tolerance, TOLERANCE_DEFAUT);
  assert.equal(c.valide, true);
});

test('parserCasCanary — kind invalide / command manquante → erreurs', () => {
  const c1 = parserCasCanary('---\nid: X\nkind: bogus\nexpected: PASS\n---');
  assert.equal(c1.valide, false);
  const c2 = parserCasCanary('---\nid: X\nkind: deterministic\nexpected: PASS\n---');
  assert.equal(c2.valide, false);
  assert.ok(c2.erreurs.some((e) => /command/.test(e)));
});

test('KINDS exporte les deux natures', () => {
  assert.deepEqual(KINDS, ['deterministic', 'generative']);
});

// ─── Évaluation déterministe ────────────────────────────────────────────────

test('evaluerDeterministe — stable + match → PASS', () => {
  const r = evaluerDeterministe(['JNSP', 'JNSP', 'JNSP'], 'JNSP');
  assert.equal(r.stable, true);
  assert.equal(r.match, true);
  assert.equal(r.observed, 'JNSP');
});

test('evaluerDeterministe — instable → bug code', () => {
  const r = evaluerDeterministe(['PASS', 'FAIL'], 'PASS');
  assert.equal(r.stable, false);
  assert.equal(r.match, false);
  assert.ok(r.reasons[0].includes('NON reproductible'));
});

test('evaluerDeterministe — stable mais ≠ baseline → régression', () => {
  const r = evaluerDeterministe(['FAIL', 'FAIL'], 'PASS');
  assert.equal(r.stable, true);
  assert.equal(r.match, false);
  assert.ok(r.reasons[0].includes('≠ baseline'));
});

test('evaluerDeterministe — aucune observation', () => {
  const r = evaluerDeterministe([], 'PASS');
  assert.equal(r.stable, false);
  assert.equal(r.observed, null);
});

// ─── Évaluation générative ──────────────────────────────────────────────────

test('evaluerGeneratif — dans la bande → PASS', () => {
  const r = evaluerGeneratif([4, 4.2, 3.8], 4, 14); // écart max 5 % < 14 %
  assert.equal(r.withinBand, true);
  assert.equal(r.drift, false);
});

test('evaluerGeneratif — hors bande → DRIFT', () => {
  const r = evaluateGenerative([4, 5.5], 4, 14); // 37.5 % > 14 %
  assert.equal(r.withinBand, false);
  assert.equal(r.drift, true);
  assert.ok(r.dispersion > 14);
});

test('evaluerGeneratif — référence 0 utilise l\'écart absolu', () => {
  const r = evaluerGeneratif([0.1], 0, 14);
  assert.equal(r.drift, false); // 0.1 * 100 = 10 % ≤ 14
});

test('evaluerGeneratif — aucun échantillon → DRIFT (indécidable côté mesure)', () => {
  const r = evaluerGeneratif([], 4, 14);
  assert.equal(r.drift, true);
  assert.equal(r.observed, null);
});

// ─── Agrégation ─────────────────────────────────────────────────────────────

const D = (id, expected) => ({ id, kind: 'deterministic', command: 'x', expected, tolerance: 14, valide: true });
const G = (id, expected) => ({ id, kind: 'generative', expected, tolerance: 14, valide: true });

test('executerCanary — tout vert → PASS', () => {
  const cas = [D('C1', 'PASS'), G('C2', 4)];
  const obs = { C1: ['PASS'], C2: [4, 4.1] };
  const r = executerCanary(cas, (c) => ({ observations: obs[c.id] }));
  assert.equal(r.verdict, 'PASS');
  assert.equal(r.summary.pass, 2);
});

test('executerCanary — une régression déterministe → FAIL', () => {
  const cas = [D('C1', 'PASS'), G('C2', 4)];
  const obs = { C1: ['FAIL', 'FAIL'], C2: [4] };
  const r = runCanary(cas, (c) => ({ observations: obs[c.id] }));
  assert.equal(r.verdict, 'FAIL');
  assert.equal(r.summary.fail, 1);
  assert.ok(r.conditions.length >= 1);
});

test('executerCanary — drift génératif seul → CONDITIONAL avec conditions', () => {
  const cas = [D('C1', 'PASS'), G('C2', 4)];
  const obs = { C1: ['PASS'], C2: [4, 6] };
  const r = executerCanary(cas, (c) => ({ observations: obs[c.id] }));
  assert.equal(r.verdict, 'CONDITIONAL');
  assert.equal(r.summary.drift, 1);
  assert.ok(r.conditions.length >= 1);
});

test('executerCanary — cas invalide → JNSP comptabilisé', () => {
  const cas = [{ id: 'C1', kind: 'deterministic', valide: false, erreurs: ['command manquante'] }];
  const r = executerCanary(cas, () => ({ observations: [] }));
  assert.equal(r.verdict, 'JNSP');
  assert.equal(r.summary.unknown, 1);
});

test('executerCanary — FAIL prime sur DRIFT', () => {
  const cas = [D('C1', 'PASS'), G('C2', 4)];
  const obs = { C1: ['FAIL'], C2: [4, 9] };
  const r = executerCanary(cas, (c) => ({ observations: obs[c.id] }));
  assert.equal(r.verdict, 'FAIL');
});

test('executerCanary — runner qui lève → JNSP pour ce cas', () => {
  const cas = [D('C1', 'PASS')];
  const r = executerCanary(cas, () => { throw new Error('spawn KO'); });
  assert.equal(r.verdict, 'JNSP');
  assert.ok(r.cases[0].reasons[0].includes('spawn KO'));
});

// ─── Conformité au schéma de verdict ────────────────────────────────────────

test('executerCanary — enveloppe conforme au schéma canary', () => {
  const cas = [D('C1', 'PASS'), G('C2', 4)];
  const obs = { C1: ['PASS'], C2: [4, 6] };
  const r = executerCanary(cas, (c) => ({ observations: obs[c.id] }), { snapshot: lireSnapshotCanary('/nope') });
  const enveloppe = { ...r, exitCode: 0, date: '2026-06-09' };
  const v = validerSchema(enveloppe, SCHEMA);
  assert.equal(v.valide, true, v.erreurs.join('\n'));
});

// ─── Chargement disque + snapshot ───────────────────────────────────────────

test('chargerCasCanary — lit les cas figés du dossier', () => {
  const dir = tmp();
  const cases = join(dir, '.aiad', 'canary', 'cases');
  mkdirSync(cases, { recursive: true });
  writeFileSync(join(cases, 'CANARY-001.md'), '---\nid: CANARY-001\nkind: deterministic\ncommand: trace\nexpected: PASS\n---');
  writeFileSync(join(cases, '_index.md'), '# index (ignoré)');
  const cas = chargerCasCanary(dir);
  assert.equal(cas.length, 1);
  assert.equal(cas[0].id, 'CANARY-001');
  rmSync(dir, { recursive: true, force: true });
});

test('lireSnapshotCanary — lit le bloc canary de config.yml', () => {
  const dir = tmp();
  mkdirSync(join(dir, '.aiad'), { recursive: true });
  writeFileSync(join(dir, '.aiad', 'config.yml'), 'canary:\n  model: claude-opus-4-8\n  effort: max\n  claude_code_version: v2.1.168\n  tolerance_pct: 14\n');
  const s = lireSnapshotCanary(dir);
  assert.equal(s.model, 'claude-opus-4-8');
  assert.equal(s.effort, 'max');
  assert.equal(s.claude_code_version, 'v2.1.168');
  assert.equal(s.tolerance_pct, 14);
  rmSync(dir, { recursive: true, force: true });
});

test('lireSnapshotCanary — config absente → défauts', () => {
  const s = lireSnapshotCanary('/nope-xyz');
  assert.equal(s.model, null);
  assert.equal(s.tolerance_pct, TOLERANCE_DEFAUT);
});
