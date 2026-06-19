// Tests de la matrice des garde-fous (SPEC-015-3).
// @intent INTENT-015
// @spec SPEC-015-3-matrice-garde-fous
//
// Couvre CA-001→CA-008. L'audit confronte la sévérité déclarée à la réalité
// du code des hooks — c'est le garde anti-régression du bypass veto (C3).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  GUARDRAILS, TYPES, LAYERS, BYPASS_PATTERN,
  hookGuardrails, auditGuardrails, aggregateGuardrails, showGuardrails,
} from '../lib/guardrails.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = join(__dirname, '..', '.aiad', 'hooks');

function hookIdsReels() {
  return readdirSync(HOOKS_DIR).filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, ''));
}
function readHookSource(id) {
  try { return readFileSync(join(HOOKS_DIR, `${id}.js`), 'utf-8'); }
  catch { return null; }
}

function capture(fn) {
  const orig = process.stdout.write.bind(process.stdout);
  let out = '';
  process.stdout.write = (c) => { out += c; return true; };
  try { const r = fn(); return { r, out }; }
  finally { process.stdout.write = orig; }
}

// CA-001 — veto non-bypassable : sa source ne lit pas AIAD_HOOK_SILENT.
test('veto hook has no AIAD_HOOK_SILENT bypass', () => {
  const veto = GUARDRAILS.find((g) => g.id === 'veto');
  assert.equal(veto.bypassable, false);
  const src = readHookSource('veto');
  assert.ok(src, 'source veto.js lisible');
  assert.equal(src.includes(BYPASS_PATTERN), false, 'veto.js ne doit pas lire process.env.AIAD_HOOK_SILENT');
});

// CA-002 — les hooks advisory conservent leur bypass.
test('advisory hooks still honour AIAD_HOOK_SILENT', () => {
  const advisoryHooks = hookGuardrails().filter((g) => g.type === 'advisory' && g.bypassable);
  assert.ok(advisoryHooks.length > 0);
  for (const g of advisoryHooks) {
    const src = readHookSource(g.id);
    assert.ok(src && src.includes(BYPASS_PATTERN), `${g.id} (advisory) doit honorer AIAD_HOOK_SILENT`);
  }
});

// CA-003 — matrice exhaustive : tout hook réel est déclaré.
test('matrix covers every hook file', () => {
  const declared = new Set(hookGuardrails().map((g) => g.id));
  for (const id of hookIdsReels()) {
    assert.ok(declared.has(id), `hook ${id} absent de la matrice`);
  }
});

// CA-004 — l'audit échoue sur une régression de sévérité (bypass réintroduit).
test('audit fails on severity regression', () => {
  // Réalité : audit propre.
  const reel = auditGuardrails({ readSource: readHookSource, hookIds: hookIdsReels() });
  assert.equal(reel.ok, true, `violations inattendues : ${JSON.stringify(reel.violations)}`);

  // Simulation : veto réintroduit le bypass → violation détectée.
  const fakeRead = (id) => id === 'veto'
    ? `function main(){ if (${BYPASS_PATTERN} === '1') return 0; }`
    : readHookSource(id);
  const regress = auditGuardrails({ readSource: fakeRead, hookIds: hookIdsReels() });
  assert.equal(regress.ok, false);
  assert.ok(regress.violations.some((v) => v.id === 'veto' && /régression/.test(v.reason)));
});

// CA-005 — listing groupé par type.
test('lists guardrails grouped by type', () => {
  const { r } = capture(() => showGuardrails({ json: false }));
  assert.equal(r.total, GUARDRAILS.length);
  assert.ok(r.enforced.includes('veto'));
});

// CA-006 — sortie JSON stable, objet unique.
test('json shape', () => {
  const { out } = capture(() => showGuardrails({ json: true }));
  const parsed = JSON.parse(out);
  assert.deepEqual(Object.keys(parsed).sort(), ['advisory', 'enforced', 'guardrails', 'total']);
  assert.equal(parsed.total, GUARDRAILS.length);
  assert.ok(Array.isArray(parsed.guardrails));
});

// CA-007 — schéma de chaque entrée.
test('every entry has valid schema', () => {
  for (const g of GUARDRAILS) {
    assert.ok(typeof g.id === 'string' && g.id.length > 0);
    assert.ok(LAYERS.includes(g.layer), `layer invalide : ${g.id}`);
    assert.ok(TYPES.includes(g.type), `type invalide : ${g.id}`);
    assert.equal(typeof g.blocking, 'boolean');
    assert.equal(typeof g.bypassable, 'boolean');
  }
  const ids = GUARDRAILS.map((g) => g.id);
  assert.equal(ids.length, new Set(ids).size, 'doublon dans la matrice');
});

// CA-008 — lecture seule : helpers purs, aucune mutation du gel.
test('no write no network', () => {
  const agg = aggregateGuardrails();
  assert.equal(agg.total, GUARDRAILS.length);
  assert.throws(() => { GUARDRAILS.push({}); }); // Object.freeze
});
