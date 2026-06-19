// Tests du cycle de dépréciation soft (SPEC-015-2-2).
// @intent INTENT-015
// @spec SPEC-015-2-2-cycle-depreciation
//
// Couvre CA-001→CA-008. Le mécanisme est livré dormant : les chemins positifs
// (entrée dépréciée) sont testés via des entrées synthétiques, conformément à
// l'absence volontaire de commande réellement dépréciée.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  formatDeprecationNotice, deprecationNotice, emitDeprecation, validateDeprecation,
} from '../lib/deprecation.js';
import { COMMANDS_REGISTRY } from '../lib/commands-registry.js';

// CA-001 — commande active ou absente → notice null.
test('active or absent returns null', () => {
  assert.equal(deprecationNotice('init'), null);     // active
  assert.equal(deprecationNotice('inexistante'), null); // absente
});

// CA-002 — message complet : nom, since, removeIn.
test('notice contains name since removeIn', () => {
  const msg = formatDeprecationNotice({ command: 'oldcmd', deprecatedSince: 'v1.18', removeIn: 'v2.0' });
  assert.match(msg, /oldcmd/);
  assert.match(msg, /v1\.18/);
  assert.match(msg, /v2\.0/);
});

// CA-003 — remplacement inclus si présent, absent sinon.
test('notice includes replacement when present', () => {
  const withRepl = formatDeprecationNotice({ command: 'oldcmd', deprecatedSince: 'v1.18', removeIn: 'v2.0', replacement: 'newcmd' });
  assert.match(withRepl, /Utilise newcmd/);
  const without = formatDeprecationNotice({ command: 'oldcmd', deprecatedSince: 'v1.18', removeIn: 'v2.0' });
  assert.doesNotMatch(without, /Utilise/);
});

// CA-004 — emitDeprecation écrit une notice non-null + newline.
test('emit writes non-null notice', () => {
  let buf = '';
  const emitted = emitDeprecation('⚠ test', (s) => { buf += s; });
  assert.equal(emitted, true);
  assert.equal(buf, '⚠ test\n');
});

// CA-005 — emit(null) = no-op (pas d'interférence, pas d'écriture).
test('emit null is a no-op (no interference)', () => {
  let called = false;
  const emitted = emitDeprecation(null, () => { called = true; });
  assert.equal(emitted, false);
  assert.equal(called, false);
});

// CA-006 — avertissement sur stderr, jamais stdout.
test('notice goes to stderr not stdout', () => {
  const origErr = process.stderr.write.bind(process.stderr);
  const origOut = process.stdout.write.bind(process.stdout);
  let err = '';
  let out = '';
  process.stderr.write = (c) => { err += c; return true; };
  process.stdout.write = (c) => { out += c; return true; };
  try {
    emitDeprecation('⚠ depr'); // write par défaut → stderr
  } finally {
    process.stderr.write = origErr;
    process.stdout.write = origOut;
  }
  assert.match(err, /⚠ depr/);
  assert.equal(out, '');
});

// CA-007 — entrée dépréciée sans since/removeIn → invalide.
test('deprecated entry requires since and removeIn', () => {
  assert.equal(validateDeprecation({ command: 'x', status: 'deprecated', deprecatedSince: 'v1', removeIn: 'v2' }).valid, true);
  assert.equal(validateDeprecation({ command: 'x', status: 'deprecated', deprecatedSince: 'v1' }).valid, false);
  assert.equal(validateDeprecation({ command: 'x', status: 'deprecated' }).valid, false);
  // Active : valide d'office.
  assert.equal(validateDeprecation({ command: 'x', status: 'active' }).valid, true);
});

// CA-008 — mécanisme livré dormant : zéro commande dépréciée.
test('registry ships with no deprecated command', () => {
  const deprecated = COMMANDS_REGISTRY.filter((e) => e.status === 'deprecated');
  assert.deepEqual(deprecated, [], 'aucune commande ne doit être dépréciée à ce stade');
  // Et toutes les entrées passent la validation de dépréciation.
  for (const e of COMMANDS_REGISTRY) assert.equal(validateDeprecation(e).valid, true);
});
