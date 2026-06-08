// Tests `lib/verdict.js` — contrat de sortie déterministe des verdicts (§3.4).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  VERDICTS_CANONIQUES,
  VERDICT_EXIT,
  VERDICT_ALIASES,
  normaliserVerdict,
  codeSortie,
  validerSchema,
  emitVerdict,
  // alias EN
  normalizeVerdict,
  exitCode,
  validateSchema,
  emit,
  CANONICAL_VERDICTS,
} from '../lib/verdict.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(__dirname, '..', '.aiad', 'schema', 'verdicts');

/** Capture un flux d'écriture pour inspecter la sortie JSON. */
function captureur() {
  const lignes = [];
  return { write: (s) => { lignes.push(s); return true; }, lignes };
}

// ─── Normalisation & exit codes ─────────────────────────────────────────────

test('VERDICT_EXIT — mapping 0/1/2 stable', () => {
  assert.equal(VERDICT_EXIT.PASS, 0);
  assert.equal(VERDICT_EXIT.CONDITIONAL, 0);
  assert.equal(VERDICT_EXIT.FAIL, 1);
  assert.equal(VERDICT_EXIT.JNSP, 2);
});

test('normaliserVerdict — canoniques inchangés', () => {
  for (const v of VERDICTS_CANONIQUES) assert.equal(normaliserVerdict(v), v);
});

test('normaliserVerdict — casse et accents tolérés', () => {
  assert.equal(normaliserVerdict('pass'), 'PASS');
  assert.equal(normaliserVerdict('  Fail '), 'FAIL');
});

test('normaliserVerdict — alias EN/gouvernance (UNKNOWN=JNSP fail-closed)', () => {
  assert.equal(normaliserVerdict('UNKNOWN'), 'JNSP');
  assert.equal(normaliserVerdict('INCONNUE'), 'JNSP');
  assert.equal(normaliserVerdict('OK'), 'PASS');
  assert.equal(normaliserVerdict('NON-CONFORME'), 'FAIL');
  assert.equal(normaliserVerdict('CONDITIONAL PASS'), 'CONDITIONAL');
});

test('normaliserVerdict — verdict inconnu lève', () => {
  assert.throws(() => normaliserVerdict('PEUT-ETRE'), /Verdict inconnu/);
  assert.throws(() => normaliserVerdict(''), /vide/);
  assert.throws(() => normaliserVerdict(null), /vide/);
});

test('codeSortie — résout via alias', () => {
  assert.equal(codeSortie('PASS'), 0);
  assert.equal(codeSortie('UNKNOWN'), 2);
  assert.equal(codeSortie('NON-CONFORME'), 1);
});

// ─── Validateur JSON Schema minimal ─────────────────────────────────────────

test('validerSchema — type simple', () => {
  assert.ok(validerSchema('x', { type: 'string' }).valide);
  assert.ok(!validerSchema(3, { type: 'string' }).valide);
  assert.ok(validerSchema(3, { type: 'integer' }).valide);
  assert.ok(!validerSchema(3.5, { type: 'integer' }).valide);
  assert.ok(validerSchema(null, { type: ['string', 'null'] }).valide);
});

test('validerSchema — required + properties imbriquées', () => {
  const schema = {
    type: 'object',
    required: ['verdict', 'sqs'],
    properties: {
      verdict: { type: 'string', enum: ['PASS', 'FAIL'] },
      sqs: { type: 'object', required: ['total'], properties: { total: { type: 'integer' } } },
    },
  };
  assert.ok(validerSchema({ verdict: 'PASS', sqs: { total: 20 } }, schema).valide);
  const manque = validerSchema({ verdict: 'PASS' }, schema);
  assert.ok(!manque.valide);
  assert.ok(manque.erreurs.some((e) => /sqs/.test(e)));
  const mauvaisEnum = validerSchema({ verdict: 'MAYBE', sqs: { total: 1 } }, schema);
  assert.ok(!mauvaisEnum.valide);
});

test('validerSchema — items de tableau', () => {
  const schema = { type: 'array', items: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } };
  assert.ok(validerSchema([{ id: 'a' }, { id: 'b' }], schema).valide);
  assert.ok(!validerSchema([{ id: 'a' }, { x: 1 }], schema).valide);
});

test('validerSchema — additionalProperties false', () => {
  const schema = { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: false };
  assert.ok(validerSchema({ a: 'x' }, schema).valide);
  assert.ok(!validerSchema({ a: 'x', b: 1 }, schema).valide);
});

// ─── emitVerdict ────────────────────────────────────────────────────────────

test('emitVerdict — PASS exit 0, pas de JSON si json=false', () => {
  const out = captureur();
  const r = emitVerdict({ verdict: 'PASS', json: false, stream: out });
  assert.equal(r.code, 0);
  assert.equal(r.verdict, 'PASS');
  assert.equal(out.lignes.length, 0);
  assert.equal(r.enveloppe.exitCode, 0);
});

test('emitVerdict — JSON émis sur le flux', () => {
  const out = captureur();
  const r = emitVerdict({ verdict: 'FAIL', payload: { findings: [] }, json: true, stream: out });
  assert.equal(r.code, 1);
  assert.equal(out.lignes.length, 1);
  const parsed = JSON.parse(out.lignes[0]);
  assert.equal(parsed.verdict, 'FAIL');
  assert.equal(parsed.exitCode, 1);
  assert.deepEqual(parsed.findings, []);
});

test('emitVerdict — JNSP exit 2', () => {
  const r = emitVerdict({ verdict: 'UNKNOWN' });
  assert.equal(r.code, 2);
  assert.equal(r.verdict, 'JNSP');
});

test('emitVerdict — CONDITIONAL exige des conditions non vides', () => {
  const sansCond = emitVerdict({ verdict: 'CONDITIONAL', payload: {} });
  assert.equal(sansCond.code, 1, 'CONDITIONAL sans conditions doit échouer');
  assert.ok(!sansCond.valide);

  const avecCond = emitVerdict({ verdict: 'CONDITIONAL', payload: { conditions: ['lever la dette X'] } });
  assert.equal(avecCond.code, 0);
  assert.equal(avecCond.verdict, 'CONDITIONAL');
});

test('emitVerdict — payload non conforme au schéma → dégradé en FAIL sans publier la sortie invalide', () => {
  const out = captureur();
  const schema = { type: 'object', required: ['verdict', 'exitCode', 'sqs'], properties: { sqs: { type: 'object', required: ['total'] } } };
  const r = emitVerdict({ verdict: 'PASS', payload: {}, schema, json: true, stream: out });
  assert.equal(r.code, 1);
  assert.equal(r.verdict, 'FAIL');
  assert.ok(!r.valide);
  // La sortie publiée signale l'échec de validation, pas un faux PASS.
  const parsed = JSON.parse(out.lignes[0]);
  assert.equal(parsed.verdict, 'FAIL');
  assert.equal(parsed.error, 'schema_validation_failed');
});

test('emitVerdict — payload conforme au schéma gate réel', () => {
  const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, 'gate.schema.json'), 'utf-8'));
  const out = captureur();
  const r = emitVerdict({
    verdict: 'PASS',
    payload: { sqs: { total: 22, max: 25, criteres: [{ id: 'testabilite', score: 5, evidence: 'EARS 0 violation' }] } },
    schema, json: true, stream: out,
  });
  assert.equal(r.code, 0);
  assert.ok(r.valide, r.erreurs.join('; '));
});

// ─── Schémas versionnés bien formés ─────────────────────────────────────────

test('les 4 schémas de verdict sont du JSON valide avec exitCode 0/1/2', () => {
  for (const nom of ['gate', 'trace', 'validate', 'security']) {
    const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, `${nom}.schema.json`), 'utf-8'));
    assert.equal(schema.type, 'object', `${nom}: racine object`);
    assert.deepEqual(schema.properties.exitCode.enum, [0, 1, 2], `${nom}: exitCode 0/1/2`);
    assert.ok(Array.isArray(schema.required) && schema.required.includes('verdict'), `${nom}: verdict requis`);
  }
});

// ─── Alias EN ───────────────────────────────────────────────────────────────

test('alias EN exposés', () => {
  assert.equal(normalizeVerdict, normaliserVerdict);
  assert.equal(exitCode, codeSortie);
  assert.equal(validateSchema, validerSchema);
  assert.equal(emit, emitVerdict);
  assert.deepEqual(CANONICAL_VERDICTS, VERDICTS_CANONIQUES);
});
