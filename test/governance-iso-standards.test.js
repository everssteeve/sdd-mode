// Tests pack `iso-standards` — ISO/IEC 42001:2023 AI Management System.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKS, listerPacks, packExiste, installerPack } from '../lib/governance-packs.js';
import { init } from '../lib/init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACK_DIR = join(__dirname, '..', 'templates', '.aiad', 'gouvernance-packs', 'iso-standards');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-iso-')); }

function silencer(fn) {
  return async (...args) => {
    const origLog = console.log;
    const origWrite = process.stdout.write.bind(process.stdout);
    console.log = () => {};
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { console.log = origLog; process.stdout.write = origWrite; }
  };
}

// ─── Pack registration ──────────────────────────────────────────────────────

test('iso-standards — pack enregistré', () => {
  assert.ok(packExiste('iso-standards'));
  const p = PACKS['iso-standards'];
  assert.match(p.description, /ISO\/IEC 42001/);
  assert.equal(p.defaut, false);
});

test('listerPacks — iso-standards inclus', () => {
  const liste = listerPacks();
  assert.ok(liste.find((p) => p.id === 'iso-standards'));
});

// ─── AIAD-ISO-42001 content ─────────────────────────────────────────────────

test('AIAD-ISO-42001.md — fichier présent', () => {
  assert.ok(existsSync(join(PACK_DIR, 'AIAD-ISO-42001.md')));
});

test('AIAD-ISO-42001 — référence ISO/IEC 42001:2023 + publication décembre 2023', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-ISO-42001.md'), 'utf-8');
  assert.match(c, /ISO\/IEC 42001:2023/);
  assert.match(c, /décembre 2023/);
});

test('AIAD-ISO-42001 — couvre les clauses HLS 4-10', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-ISO-42001.md'), 'utf-8');
  // Clauses 4 à 10 référencées explicitement
  for (const cl of ['Clause 4', 'Clause 5', 'Clause 6', 'Clause 7', 'Clause 8', 'Clause 9', 'Clause 10']) {
    assert.match(c, new RegExp(cl), `${cl} non cité`);
  }
});

test('AIAD-ISO-42001 — Annexe A 38 contrôles + 9 catégories A.2-A.10', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-ISO-42001.md'), 'utf-8');
  assert.match(c, /38 contrôles/);
  // Catégories Annexe A
  for (const cat of ['A.2', 'A.3', 'A.4', 'A.5', 'A.6', 'A.7', 'A.8', 'A.9', 'A.10']) {
    assert.match(c, new RegExp(cat.replace('.', '\\.')), `Catégorie ${cat} absente`);
  }
});

test('AIAD-ISO-42001 — concepts management clés', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-ISO-42001.md'), 'utf-8');
  // Vocabulaire spécifique ISO management
  for (const concept of ['AIMS', 'PDCA', 'Statement of Applicability', 'SoA',
                         'HLS', 'Annex SL', 'audit interne', 'revue de direction']) {
    assert.match(c, new RegExp(concept.replace(/[()]/g, '\\$&')), `${concept} non cité`);
  }
});

test('AIAD-ISO-42001 — distinction réglementaire vs management explicite', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-ISO-42001.md'), 'utf-8');
  assert.match(c, /AI Act.*réglementaire|réglementaire.*AI Act/i);
  assert.match(c, /certifiable/);
});

test('AIAD-ISO-42001 — table d\'intégration AIAD SDD', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-ISO-42001.md'), 'utf-8');
  // La section "Intégration AIAD" doit mapper les exigences ISO aux artefacts AIAD
  assert.match(c, /## INTÉGRATION AIAD/);
  assert.match(c, /Politique IA/);
  assert.match(c, /\.aiad\/specs\//);
  assert.match(c, /aiad-sdd ai-act audit/);
  assert.match(c, /aiad-sdd dashboard/);
});

test('AIAD-ISO-42001 — articulation avec autres standards/agents', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-ISO-42001.md'), 'utf-8');
  assert.match(c, /AIAD-AI-ACT/);
  assert.match(c, /ISO\/IEC 23894/); // futur agent vague 2
  assert.match(c, /ISO\/IEC 27001/);
});

test('AIAD-ISO-42001 — sections obligatoires (MISSION/DÉCLENCHEURS/TOUJOURS/JAMAIS/PROTOCOLE)', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-ISO-42001.md'), 'utf-8');
  for (const section of ['## MISSION', '## DÉCLENCHEURS', '## RÈGLES ABSOLUES — TOUJOURS',
                          '## RÈGLES ABSOLUES — JAMAIS', '## PROTOCOLE DE SIGNALEMENT']) {
    assert.match(c, new RegExp(section));
  }
  assert.match(c, /Tier 1/);
  assert.match(c, /Droit de veto.*oui/i);
});

// ─── Installation ───────────────────────────────────────────────────────────

test('installerPack iso-standards → AIAD-ISO-42001 installé au-dessus de eu-baseline', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await installerPack(d, 'iso-standards', { silencieux: true });
    assert.equal(r.created, 1);
    assert.ok(existsSync(join(d, '.aiad/gouvernance/AIAD-ISO-42001.md')));
    // eu-baseline préservé
    assert.ok(existsSync(join(d, '.aiad/gouvernance/AIAD-AI-ACT.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerPack iso-standards --dry-run → ne crée rien', silencer(async () => {
  const d = tmp();
  try {
    await init(d, { sansGouvernance: true });
    await installerPack(d, 'iso-standards', { dryRun: true, silencieux: true });
    assert.ok(!existsSync(join(d, '.aiad/gouvernance/AIAD-ISO-42001.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));
