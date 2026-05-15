// Tests `lib/sovereignty-score.js` — EU Sovereignty Score (item #94).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  dimensionJuridictions, dimensionAgentsTier1, dimensionLangueFr,
  dimensionAutorites, dimensionHebergement,
  computeSovereigntyScore, afficherScore, CONSTANTS,
  // alias EN
  scoreJurisdictions, scoreTier1Agents, scoreLanguageFr,
  scoreAuthorities, scoreHosting, showScore,
} from '../lib/sovereignty-score.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-sov-')); }
function silent(fn) {
  return (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

function setupGov(d, agents) {
  const govDir = join(d, '.aiad', 'gouvernance');
  mkdirSync(govDir, { recursive: true });
  for (const a of agents) writeFileSync(join(govDir, a), '# ' + a);
}

// ─── dimensionJuridictions ─────────────────────────────────────────────────

test('dimensionJuridictions — projet vide → score 0', () => {
  const d = tmp();
  try {
    const r = dimensionJuridictions(d);
    assert.equal(r.score, 0);
    assert.deepEqual(r.juridictions, []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('dimensionJuridictions — baseline EU → 4pt + juridiction eu', () => {
  const d = tmp();
  try {
    setupGov(d, ['AIAD-AI-ACT.md', 'AIAD-RGPD.md', 'AIAD-RGAA.md', 'AIAD-RGESN.md']);
    const r = dimensionJuridictions(d);
    assert.equal(r.score, 4);
    assert.deepEqual(r.juridictions, ['eu']);
    assert.ok(r.packs.includes('eu-baseline'));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('dimensionJuridictions — baseline + fr-anssi + de-bsi → 12pt (3 juridictions)', () => {
  const d = tmp();
  try {
    setupGov(d, [
      'AIAD-AI-ACT.md', 'AIAD-RGPD.md', 'AIAD-RGAA.md', 'AIAD-RGESN.md',
      'AIAD-RGS.md', 'AIAD-PASSI.md',
      'AIAD-BSI-IT-Grundschutz.md', 'AIAD-BDSG.md',
    ]);
    const r = dimensionJuridictions(d);
    assert.ok(r.juridictions.includes('eu'));
    assert.ok(r.juridictions.includes('fr'));
    assert.ok(r.juridictions.includes('de'));
    assert.equal(r.score, 12);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('dimensionJuridictions — score plafonné à 20', () => {
  const d = tmp();
  try {
    setupGov(d, [
      'AIAD-AI-ACT.md', 'AIAD-RGPD.md', 'AIAD-RGAA.md', 'AIAD-RGESN.md',
      'AIAD-RGS.md', 'AIAD-BDSG.md', 'AIAD-AEPD.md', 'AIAD-AGID.md',
      'AIAD-AP.md', 'AIAD-APD.md', 'AIAD-CH-FADP.md',
    ]);
    const r = dimensionJuridictions(d);
    assert.ok(r.score <= 20);
    assert.ok(r.juridictions.length >= 5);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── dimensionAgentsTier1 ──────────────────────────────────────────────────

test('dimensionAgentsTier1 — 4 baseline → 12pt', () => {
  const d = tmp();
  try {
    setupGov(d, ['AIAD-AI-ACT.md', 'AIAD-RGPD.md', 'AIAD-RGAA.md', 'AIAD-RGESN.md']);
    const r = dimensionAgentsTier1(d);
    assert.equal(r.baseline, 4);
    assert.equal(r.prime, 0);
    assert.equal(r.score, 12);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('dimensionAgentsTier1 — 4 baseline + 4 prime → 20pt (plafonné)', () => {
  const d = tmp();
  try {
    setupGov(d, [
      'AIAD-AI-ACT.md', 'AIAD-RGPD.md', 'AIAD-RGAA.md', 'AIAD-RGESN.md',
      'AIAD-CRA.md', 'AIAD-ISO-42001.md', 'AIAD-RGS.md', 'AIAD-PASSI.md',
    ]);
    const r = dimensionAgentsTier1(d);
    assert.equal(r.baseline, 4);
    assert.equal(r.prime, 4);
    assert.equal(r.score, 20);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('dimensionAgentsTier1 — projet sans gouvernance → 0', () => {
  const d = tmp();
  try {
    const r = dimensionAgentsTier1(d);
    assert.equal(r.score, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── dimensionLangueFr ─────────────────────────────────────────────────────

test('dimensionLangueFr — aucun artefact → score 0 et ratio null', () => {
  const d = tmp();
  try {
    const r = dimensionLangueFr(d);
    assert.equal(r.score, 0);
    assert.equal(r.ratioFr, null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('dimensionLangueFr — Intents en français → score élevé', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'INT-001.md'),
      '---\ntitle: Permettre à l\'utilisateur de récupérer ses données\n---\n# Body en français');
    writeFileSync(join(d, '.aiad', 'intents', 'INT-002.md'),
      '---\ntitle: Offrir une expérience accessible et inclusive\n---\n# Body');
    const r = dimensionLangueFr(d);
    assert.ok(r.score > 0, `attendu > 0, vu ${r.score}`);
    assert.equal(r.fr, 2);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('dimensionLangueFr — Intents en anglais → score 0', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'INT-001.md'),
      '---\ntitle: Allow the user to retrieve a copy of the data\n---\n# Body');
    const r = dimensionLangueFr(d);
    assert.equal(r.score, 0);
    assert.equal(r.en, 1);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── dimensionAutorites ────────────────────────────────────────────────────

test('dimensionAutorites — aucune mention → 0', () => {
  const d = tmp();
  try {
    const r = dimensionAutorites(d);
    assert.equal(r.score, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('dimensionAutorites — CNIL + ANSSI cités → 10pt', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'),
      '# SPEC\n\nConformément aux exigences CNIL et ANSSI...');
    const r = dimensionAutorites(d);
    assert.equal(r.score, 10);
    assert.deepEqual(r.autorites.sort(), ['anssi', 'cnil']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('dimensionAutorites — toutes les autorités → 20pt', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'),
      'CNIL ANSSI DINUM SecNumCloud doivent être référencés.');
    const r = dimensionAutorites(d);
    assert.equal(r.score, 20);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── dimensionHebergement ──────────────────────────────────────────────────

test('dimensionHebergement — projet vide → 0', () => {
  const d = tmp();
  try {
    const r = dimensionHebergement(d);
    assert.equal(r.score, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('dimensionHebergement — publiccode countries=fr → 10pt', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'publiccode.yml'),
      'publiccodeYmlVersion: 0.4\nname: x\nintendedAudience:\n  countries:\n    - fr\n');
    const r = dimensionHebergement(d);
    assert.equal(r.score, 10);
    assert.ok(r.sources[0].match(/publiccode/));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('dimensionHebergement — SecNumCloud agent → 10pt', () => {
  const d = tmp();
  try {
    setupGov(d, ['AIAD-SECNUMCLOUD.md']);
    const r = dimensionHebergement(d);
    assert.equal(r.score, 10);
    assert.match(r.sources[0], /SECNUMCLOUD/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('dimensionHebergement — combo plafonné à 20', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'publiccode.yml'),
      'intendedAudience:\n  countries:\n    - fr\n');
    setupGov(d, ['AIAD-SECNUMCLOUD.md']);
    mkdirSync(join(d, '.aiad'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'config.yml'), 'hosting: eu\n');
    const r = dimensionHebergement(d);
    assert.equal(r.score, 20);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── computeSovereigntyScore ───────────────────────────────────────────────

test('computeSovereigntyScore — projet vide → Bronze', () => {
  const d = tmp();
  try {
    const r = computeSovereigntyScore(d);
    assert.equal(r.level, 'Bronze');
    assert.ok(r.score < 40);
    assert.ok(Array.isArray(r.recommendations));
    assert.ok(r.recommendations.length > 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('computeSovereigntyScore — projet EU complet → niveau ≥ Gold', () => {
  const d = tmp();
  try {
    setupGov(d, [
      'AIAD-AI-ACT.md', 'AIAD-RGPD.md', 'AIAD-RGAA.md', 'AIAD-RGESN.md',
      'AIAD-CRA.md', 'AIAD-ISO-42001.md',
      'AIAD-RGS.md', 'AIAD-PASSI.md', 'AIAD-SECNUMCLOUD.md',
    ]);
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'),
      '---\ntitle: Implémenter le portail des données utilisateur\n---\nLes exigences CNIL et ANSSI sont respectées via DINUM et SecNumCloud.');
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'INT-001.md'),
      '---\ntitle: Permettre à l\'utilisateur de récupérer ses données personnelles\n---\nIntent en français.');
    writeFileSync(join(d, 'publiccode.yml'),
      'intendedAudience:\n  countries:\n    - fr\n');
    const r = computeSovereigntyScore(d);
    assert.ok(r.score >= 70, `attendu ≥ 70, vu ${r.score}`);
    assert.ok(['Gold', 'Platinum'].includes(r.level), `attendu Gold/Platinum, vu ${r.level}`);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('computeSovereigntyScore — résultat sérialisable JSON', () => {
  const d = tmp();
  try {
    const r = computeSovereigntyScore(d);
    const s = JSON.stringify(r);
    const parsed = JSON.parse(s);
    assert.equal(parsed.score, r.score);
    assert.equal(parsed.level, r.level);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── afficherScore CLI ─────────────────────────────────────────────────────

test('afficherScore — affichage humain (smoke)', silent(() => {
  const d = tmp();
  try {
    const r = afficherScore(d);
    assert.ok(typeof r.score === 'number');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('afficherScore --json → JSON exploitable', () => {
  const d = tmp();
  try {
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { afficherScore(d, { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.ok(typeof parsed.score === 'number');
    assert.ok(['Bronze', 'Silver', 'Gold', 'Platinum'].includes(parsed.level));
    assert.equal(parsed.maxScore, 100);
    // (#263) _meta cohérent avec écosystème
    assert.equal(parsed._meta.schema, 'aiad-sdd-sovereignty');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(scoreJurisdictions, dimensionJuridictions);
  assert.equal(scoreTier1Agents, dimensionAgentsTier1);
  assert.equal(scoreLanguageFr, dimensionLangueFr);
  assert.equal(scoreAuthorities, dimensionAutorites);
  assert.equal(scoreHosting, dimensionHebergement);
  assert.equal(showScore, afficherScore);
});

test('CONSTANTS — exposées', () => {
  assert.ok(Array.isArray(CONSTANTS.JURIDICTIONS_EU));
  assert.ok(CONSTANTS.JURIDICTIONS_EU.includes('fr'));
  assert.ok(CONSTANTS.JURIDICTIONS_EU.includes('eu'));
  assert.equal(CONSTANTS.AGENTS_TIER1_BASELINE.length, 4);
  assert.equal(CONSTANTS.NIVEAUX.length, 4);
});
