// Tests `lib/cross-model.js` — review cross-model additive-only (§3.12).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SEVERITES,
  construirePromptReviewer,
  parserSortieReviewer,
  dedupFindings,
  mergerRapports,
  influenceVerdict,
  rendreReview,
  chargerRapports,
  // alias EN
  mergeReports,
  verdictInfluence,
} from '../lib/cross-model.js';
import { validerSchema } from '../lib/verdict.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(readFileSync(join(__dirname, '..', '.aiad', 'schema', 'verdicts', 'review.schema.json'), 'utf-8'));

function tmp() { return mkdtempSync(join(tmpdir(), 'xmodel-')); }

// ─── Prompt ─────────────────────────────────────────────────────────────────

test('construirePromptReviewer — impose additive-only + JSON + contexte frais', () => {
  const p = construirePromptReviewer({ spec: 'SPEC-042-1', diff: 'diff body', reviewer: 'codex' });
  assert.ok(/ADDITIVE ONLY/.test(p));
  assert.ok(p.includes('SPEC-042-1'));
  assert.ok(p.includes('codex'));
  assert.ok(/JSON/.test(p));
});

// ─── Parsing ────────────────────────────────────────────────────────────────

test('parserSortieReviewer — extrait le JSON même entouré de texte/```', () => {
  const brut = 'Voici mon analyse :\n```json\n{"reviewer":"gemini","findings":[{"severity":"high","file":"a.js","line":12,"description":"fuite"}]}\n```\nFin.';
  const r = parserSortieReviewer(brut);
  assert.equal(r.reviewer, 'gemini');
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].severity, 'high');
  assert.equal(r.findings[0].reviewer, 'gemini');
});

test('parserSortieReviewer — sévérité inconnue → info ; JSON absent → erreur', () => {
  const r = parserSortieReviewer('{"reviewer":"x","findings":[{"severity":"ULTRA","description":"d"}]}');
  assert.equal(r.findings[0].severity, 'info');
  const ko = parserSortieReviewer('pas de json');
  assert.equal(ko.valide, false);
});

test('sortie reviewer conforme au schéma review', () => {
  const r = parserSortieReviewer('{"reviewer":"codex","findings":[{"severity":"medium","file":"x.js","line":1,"description":"d","suggestion":"s"}]}');
  const v = validerSchema({ reviewer: r.reviewer, findings: r.findings.map((f) => ({ severity: f.severity, file: f.file, line: f.line, description: f.description, suggestion: f.suggestion })) }, SCHEMA);
  assert.equal(v.valide, true, v.erreurs.join('\n'));
});

// ─── Dédup & merge ──────────────────────────────────────────────────────────

test('dedupFindings — fusionne les doublons, garde la sévérité max + reviewers', () => {
  const out = dedupFindings([
    { severity: 'medium', file: 'a.js', line: 10, description: 'Même souci', reviewer: 'codex' },
    { severity: 'high', file: 'a.js', line: 10, description: 'Même souci', reviewer: 'gemini' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].severity, 'high'); // max
  assert.deepEqual(out[0].reviewers.sort(), ['codex', 'gemini']);
});

test('mergerRapports — agrège plusieurs rapports + compte par sévérité', () => {
  const m = mergeReports([
    { reviewer: 'codex', findings: [{ severity: 'high', file: 'a', line: 1, description: 'x', reviewer: 'codex' }] },
    { reviewer: 'gemini', findings: [{ severity: 'low', file: 'b', line: 2, description: 'y', reviewer: 'gemini' }] },
  ]);
  assert.equal(m.findings.length, 2);
  assert.deepEqual(m.reviewers.sort(), ['codex', 'gemini']);
  assert.equal(m.parSeverite.high, 1);
  assert.equal(m.parSeverite.low, 1);
});

// ─── Influence sur le verdict ───────────────────────────────────────────────

test('influenceVerdict — PASS + finding haut → CONDITIONAL avec conditions', () => {
  const r = influenceVerdict('PASS', [{ severity: 'high', file: 'a.js', line: 3, description: 'injection' }]);
  assert.equal(r.verdict, 'CONDITIONAL');
  assert.ok(r.conditions.length >= 1);
});

test('influenceVerdict — PASS sans finding haut → reste PASS', () => {
  const r = verdictInfluence('PASS', [{ severity: 'low', file: 'a', description: 'd' }]);
  assert.equal(r.verdict, 'PASS');
});

test('influenceVerdict — n\'invente jamais un FAIL ; base FAIL/JNSP conservée', () => {
  assert.equal(influenceVerdict('FAIL', [{ severity: 'critical', description: 'x' }]).verdict, 'FAIL');
  assert.equal(influenceVerdict('JNSP', [{ severity: 'critical', description: 'x' }]).verdict, 'JNSP');
  // Pire cas PASS + critical → au plus CONDITIONAL, jamais FAIL.
  assert.equal(influenceVerdict('PASS', [{ severity: 'critical', description: 'x' }]).verdict, 'CONDITIONAL');
});

// ─── Rendu & chargement ─────────────────────────────────────────────────────

test('rendreReview — table attribuée ou « Aucun finding »', () => {
  const vide = rendreReview('SPEC-1', mergerRapports([]));
  assert.ok(/Aucun finding/.test(vide));
  const plein = rendreReview('SPEC-1', mergerRapports([{ reviewer: 'codex', findings: [{ severity: 'high', file: 'a.js', line: 1, description: 'd', reviewer: 'codex' }] }]));
  assert.ok(plein.includes('| high |'));
  assert.ok(plein.includes('a.js:1'));
});

test('chargerRapports — lit les sorties figées REVIEW-<spec>-*.json', () => {
  const d = tmp();
  const dir = join(d, '.aiad', 'reviews');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'REVIEW-SPEC-009-1-codex.json'), '{"reviewer":"codex","findings":[{"severity":"high","file":"x","line":1,"description":"d"}]}');
  writeFileSync(join(dir, 'REVIEW-SPEC-009-1-gemini.json'), '{"reviewer":"gemini","findings":[]}');
  const r = chargerRapports(d, 'SPEC-009-1');
  assert.equal(r.length, 2);
  rmSync(d, { recursive: true, force: true });
});

test('SEVERITES exposées dans le bon ordre', () => {
  assert.deepEqual(SEVERITES, ['critical', 'high', 'medium', 'low', 'info']);
});
