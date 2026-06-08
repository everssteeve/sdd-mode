// Tests `lib/research.js` — phase Research + gate GO/NO-GO déterministe (§3.5).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DECISIONS,
  DECISION_VERDICT,
  ligneAncree,
  parserResearch,
  calculerVerdictResearch,
  chargerResearch,
  emitResearchVerdict,
  discoveryPrete,
  // alias EN
  computeResearchVerdict,
  discoveryReady,
} from '../lib/research.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(readFileSync(join(__dirname, '..', '.aiad', 'schema', 'verdicts', 'research.schema.json'), 'utf-8'));

// Fabrique un artefact Research minimal.
function art({ discovery = ['- src/x.ts:42'], unknowns = [], conditions = [], jnsp = [], verdict = null }) {
  const L = ['# RESEARCH-001 — Test  (← INTENT-001)', '', '## Discovery', ...discovery];
  L.push('', '## Risques & inconnues', ...unknowns.map((u) => `- ${u}`), ...jnsp.map((j) => `- ${j}`));
  if (conditions.length) L.push('', '## Conditions', ...conditions.map((c) => `- ${c}`));
  if (verdict) L.push('', `## Verdict : ${verdict}`);
  return L.join('\n');
}

// ─── Ancrage code ───────────────────────────────────────────────────────────

test('ligneAncree — détecte chemin:ligne et evidence:', () => {
  assert.ok(ligneAncree('- Fichier : src/auth/login.ts:42'));
  assert.ok(ligneAncree('- evidence: dépend de Stripe'));
  assert.ok(!ligneAncree('- Fichiers impactés : …'));
  assert.ok(!ligneAncree('- Fichier : <chemin>'));
});

// ─── Parsing ────────────────────────────────────────────────────────────────

test('parserResearch — extrait intent, discovery, inconnues, verdict', () => {
  const m = parserResearch(art({
    discovery: ['- src/pay/checkout.ts:120'],
    unknowns: ['Quota Stripe inconnu'],
    verdict: 'CONDITIONAL GO (confidence: 65 %)',
  }));
  assert.equal(m.intent, 'INTENT-001');
  assert.equal(m.discovery.populated, true);
  assert.deepEqual(m.discovery.anchors, ['src/pay/checkout.ts:120']);
  assert.deepEqual(m.unknowns, ['Quota Stripe inconnu']);
  assert.equal(m.declared.decision, 'CONDITIONAL GO');
  assert.equal(m.declared.confidence, 65);
});

test('parserResearch — placeholders du template ignorés', () => {
  const m = parserResearch(art({ discovery: ['- Fichiers impactés : …'], verdict: 'GO (confidence: 90 %)' }));
  assert.equal(m.discovery.populated, false);
});

test('parserResearch — TODO-JNSP détecté comme inconnue ouverte', () => {
  const m = parserResearch(art({ jnsp: ['TODO-JNSP: quel SLA cible ?'], verdict: 'GO (confidence: 90 %)' }));
  assert.equal(m.openJnsp.length, 1);
});

// ─── Verdicts ───────────────────────────────────────────────────────────────

test('calculerVerdictResearch — GO franc → PASS', () => {
  const r = computeResearchVerdict(parserResearch(art({ verdict: 'GO (confidence: 88 %)' })));
  assert.equal(r.verdict, 'PASS');
  assert.equal(r.decision, 'GO');
  assert.equal(r.confidence, 88);
});

test('calculerVerdictResearch — CONDITIONAL GO → CONDITIONAL avec conditions', () => {
  const r = calculerVerdictResearch(parserResearch(art({
    unknowns: ['Quota Stripe', 'Idempotency-key'],
    verdict: 'CONDITIONAL GO (confidence: 60 %)',
  })));
  assert.equal(r.verdict, 'CONDITIONAL');
  assert.ok(r.conditions.length >= 1);
});

test('calculerVerdictResearch — GO + inconnues non levées → durci en CONDITIONAL', () => {
  const r = calculerVerdictResearch(parserResearch(art({
    unknowns: ['Inconnue résiduelle'],
    verdict: 'GO (confidence: 90 %)',
  })));
  assert.equal(r.verdict, 'CONDITIONAL');
  assert.equal(r.decision, 'CONDITIONAL GO');
  assert.deepEqual(r.conditions, ['Inconnue résiduelle']);
});

test('calculerVerdictResearch — CONDITIONAL GO sans conditions ni inconnues → JNSP', () => {
  const r = calculerVerdictResearch(parserResearch(art({ verdict: 'CONDITIONAL GO (confidence: 50 %)' })));
  assert.equal(r.verdict, 'JNSP');
});

test('calculerVerdictResearch — NO-GO et DEFER → FAIL', () => {
  assert.equal(calculerVerdictResearch(parserResearch(art({ verdict: 'NO-GO (confidence: 15 %)' }))).verdict, 'FAIL');
  assert.equal(calculerVerdictResearch(parserResearch(art({ verdict: 'DEFER (confidence: 40 %)' }))).verdict, 'FAIL');
});

test('calculerVerdictResearch — Discovery vide → JNSP (fail-closed)', () => {
  const r = calculerVerdictResearch(parserResearch(art({ discovery: ['- …'], verdict: 'GO (confidence: 90 %)' })));
  assert.equal(r.verdict, 'JNSP');
  assert.match(r.reasons[0], /Discovery/);
});

test('calculerVerdictResearch — JNSP ouvert prime sur un GO déclaré', () => {
  const r = calculerVerdictResearch(parserResearch(art({ jnsp: ['TODO-JNSP: seuil ?'], verdict: 'GO (confidence: 90 %)' })));
  assert.equal(r.verdict, 'JNSP');
});

test('calculerVerdictResearch — verdict humain absent → JNSP (Human Authorship)', () => {
  const r = calculerVerdictResearch(parserResearch(art({})));
  assert.equal(r.verdict, 'JNSP');
  assert.match(r.reasons[0], /humain/);
});

test('DECISION_VERDICT — mapping cohérent avec le contrat', () => {
  assert.equal(DECISION_VERDICT.GO, 'PASS');
  assert.equal(DECISION_VERDICT['CONDITIONAL GO'], 'CONDITIONAL');
  assert.equal(DECISION_VERDICT.DEFER, 'FAIL');
  assert.equal(DECISION_VERDICT['NO-GO'], 'FAIL');
  assert.equal(DECISIONS.length, 4);
});

// ─── Chargement + émission (intégration) ────────────────────────────────────

function projet() {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-research-'));
  mkdirSync(join(dir, '.aiad', 'research'), { recursive: true });
  return dir;
}

test('chargerResearch — trouve par id complet et par NNN', () => {
  const dir = projet();
  try {
    writeFileSync(join(dir, '.aiad', 'research', 'RESEARCH-007-auth.md'), art({ verdict: 'GO (confidence: 90 %)' }));
    assert.ok(chargerResearch(dir, 'RESEARCH-007-auth'));
    assert.ok(chargerResearch(dir, 'RESEARCH-007'));
    assert.ok(chargerResearch(dir, '007'));
    assert.equal(chargerResearch(dir, '999'), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('emitResearchVerdict — exit 0 + enveloppe valide vs schéma (GO)', () => {
  const dir = projet();
  try {
    writeFileSync(join(dir, '.aiad', 'research', 'RESEARCH-001-x.md'), art({ verdict: 'GO (confidence: 88 %)' }));
    let out = '';
    const r = emitResearchVerdict(dir, '001', { json: true, schema: SCHEMA, stream: { write: (s) => { out += s; } } });
    assert.equal(r.code, 0);
    assert.equal(r.valide, true);
    const env = JSON.parse(out);
    assert.equal(env.verdict, 'PASS');
    assert.equal(env.decision, 'GO');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('emitResearchVerdict — artefact absent → JNSP (exit 2)', () => {
  const dir = projet();
  try {
    const r = emitResearchVerdict(dir, '404', { schema: SCHEMA, stream: { write: () => {} } });
    assert.equal(r.code, 2);
    assert.equal(r.verdict, 'JNSP');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('emitResearchVerdict — CONDITIONAL respecte la contrainte conditions non vides', () => {
  const dir = projet();
  try {
    writeFileSync(join(dir, '.aiad', 'research', 'RESEARCH-002-pay.md'),
      art({ unknowns: ['Quota'], verdict: 'CONDITIONAL GO (confidence: 60 %)' }));
    const r = emitResearchVerdict(dir, '002', { schema: SCHEMA, stream: { write: () => {} } });
    assert.equal(r.code, 0);
    assert.equal(r.verdict, 'CONDITIONAL');
    assert.ok(r.enveloppe.conditions.length > 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ─── Prérequis Discovery (SPEC-B) ───────────────────────────────────────────

test('discoveryPrete — prête si Research liée GO avec Discovery ancré', () => {
  const dir = projet();
  try {
    const contenu = ['# RESEARCH-001 (← INTENT-042)', '## Discovery', '- src/x.ts:1', '## Verdict : GO (confidence: 90 %)'].join('\n');
    writeFileSync(join(dir, '.aiad', 'research', 'RESEARCH-001-x.md'), contenu);
    const r = discoveryReady(dir, 'INTENT-042');
    assert.equal(r.ready, true);
    assert.equal(r.verdict, 'PASS');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('discoveryPrete — non prête sans Research liée', () => {
  const dir = projet();
  try {
    const r = discoveryPrete(dir, 'INTENT-999');
    assert.equal(r.ready, false);
    assert.match(r.raison, /Aucune Research/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('discoveryPrete — non prête si verdict NO-GO', () => {
  const dir = projet();
  try {
    const contenu = ['# RESEARCH-001 (← INTENT-042)', '## Discovery', '- src/x.ts:1', '## Verdict : NO-GO (confidence: 10 %)'].join('\n');
    writeFileSync(join(dir, '.aiad', 'research', 'RESEARCH-001-x.md'), contenu);
    const r = discoveryPrete(dir, 'INTENT-042');
    assert.equal(r.ready, false);
    assert.equal(r.verdict, 'FAIL');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
