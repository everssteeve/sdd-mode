// Tests `lib/statusline.js` — statusLine native + état SDD (§3.11 SPEC-A).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  etatSdd,
  prochaineEtapeCycle,
  construireStatusline,
  parserStdin,
  // alias EN
  buildStatusline,
  sddState,
} from '../lib/statusline.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'statusline-')); }

function projetAvecIndex(rows) {
  const d = tmp();
  mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
  const head = '| ID | Titre | Intent | Format | SQS | Statut | PR |\n|----|----|----|----|----|----|----|\n';
  writeFileSync(join(d, '.aiad', 'specs', '_index.md'), head + rows.join('\n') + '\n');
  return d;
}

// ─── parserStdin ────────────────────────────────────────────────────────────

test('parserStdin — vide / illisible → {}', () => {
  assert.deepEqual(parserStdin(''), {});
  assert.deepEqual(parserStdin('pas du json'), {});
  assert.deepEqual(parserStdin('{"a":1}'), { a: 1 });
});

// ─── etatSdd ────────────────────────────────────────────────────────────────

test('etatSdd — retient la SPEC active la plus avancée (in-progress)', () => {
  const d = projetAvecIndex([
    '| SPEC-001-1 | A | INTENT-001 | prose | 4.4 | done | — |',
    '| SPEC-002-1 | B | INTENT-002 | prose | 4.2 | in-progress | — |',
    '| SPEC-003-1 | C | INTENT-003 | prose | 3.0 | review | — |',
  ]);
  const e = sddState(d);
  assert.equal(e.spec, 'SPEC-002-1');
  assert.equal(e.sqs, 4.2);
  assert.equal(e.statut, 'in-progress');
  rmSync(d, { recursive: true, force: true });
});

test('etatSdd — aucune SPEC active → null', () => {
  const d = projetAvecIndex(['| SPEC-001-1 | A | INTENT-001 | prose | 4.4 | done | — |']);
  const e = etatSdd(d);
  assert.equal(e.spec, null);
  rmSync(d, { recursive: true, force: true });
});

test('etatSdd — index absent → null sans crash', () => {
  assert.deepEqual(etatSdd('/nope-xyz'), { spec: null, sqs: null, statut: null });
});

// ─── construireStatusline ───────────────────────────────────────────────────

test('construireStatusline — Gate ✅ si SQS ≥ 4', () => {
  const l = construireStatusline({ context_window: { used_percentage: 58 }, effort: { level: 'max' } }, { spec: 'SPEC-042-1', sqs: 4.2 });
  assert.ok(l.includes('SPEC-042-1'));
  assert.ok(l.includes('Gate ✅'));
  assert.ok(l.includes('ctx 58%'));
  assert.ok(l.includes('effort max'));
});

test('construireStatusline — Gate ⚠ si SQS < 4', () => {
  const l = buildStatusline({}, { spec: 'SPEC-009-1', sqs: 3 });
  assert.ok(l.includes('Gate ⚠'));
});

test('construireStatusline — alerte contexte ≥ 70 %', () => {
  const l = construireStatusline({ context_window: { used_percentage: 82 } }, { spec: 'SPEC-1' });
  assert.ok(/ctx 82%⚠/.test(l));
});

test('construireStatusline — étape de cycle ajoutée si fournie', () => {
  const l = construireStatusline({}, { spec: 'SPEC-1', sqs: 4, etape: 'EXEC' });
  assert.ok(l.includes('étape EXEC'));
});

test('construireStatusline — sans SPEC → libellé SDD', () => {
  const l = construireStatusline({}, { spec: null });
  assert.ok(l.startsWith('SDD'));
});

test('construireStatusline — coût affiché si > 0', () => {
  const l = construireStatusline({ cost: { total_cost_usd: 1.5 } }, { spec: 'SPEC-1', sqs: 4 });
  assert.ok(l.includes('$1.50'));
});

// ─── prochaineEtapeCycle ────────────────────────────────────────────────────

test('prochaineEtapeCycle — lit le 1er graphe non complet', () => {
  const d = tmp();
  mkdirSync(join(d, '.aiad', 'cycle'), { recursive: true });
  writeFileSync(join(d, '.aiad', 'cycle', 'INTENT-001.json'), JSON.stringify({
    intent: 'INTENT-001',
    etapes: [{ name: 'INTENT', status: 'done' }, { name: 'RESEARCH', status: 'done' }, { name: 'SPEC', status: 'todo' }],
  }));
  assert.equal(prochaineEtapeCycle(d, 'SPEC-001-1'), 'SPEC');
  rmSync(d, { recursive: true, force: true });
});

test('prochaineEtapeCycle — pas de dossier cycle → null', () => {
  assert.equal(prochaineEtapeCycle('/nope', 'SPEC-1'), null);
});
