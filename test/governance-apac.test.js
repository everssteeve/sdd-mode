// Tests pack gouvernance APAC — JP-APPI / SG-PDPA / AU-Privacy (#99).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKS, packExiste, listerPacks, installerPack } from '../lib/governance-packs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKS_DIR = join(__dirname, '..', 'templates', '.aiad', 'gouvernance-packs');
const APAC_DIR = join(PACKS_DIR, 'apac-baseline');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-apac-')); }

function silencer(fn) {
  return async (...args) => {
    const ol = console.log;
    const ow = process.stdout.write.bind(process.stdout);
    console.log = () => {}; process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { console.log = ol; process.stdout.write = ow; }
  };
}

// ─── Registration ──────────────────────────────────────────────────────────

test('PACKS — apac-baseline enregistré', () => {
  assert.ok(packExiste('apac-baseline'));
  assert.equal(PACKS['apac-baseline'].juridiction, 'Asie-Pacifique (JP/SG/AU)');
  assert.equal(PACKS['apac-baseline'].defaut, false);
  assert.match(PACKS['apac-baseline'].titre, /APAC|JP|SG|AU/);
});

test('listerPacks — apac-baseline présent', () => {
  const liste = listerPacks();
  const pack = liste.find((p) => p.id === 'apac-baseline');
  assert.ok(pack);
});

// ─── Templates 3 agents ────────────────────────────────────────────────────

test('templates apac — 3 agents Tier 1 livrés', () => {
  assert.ok(existsSync(APAC_DIR), 'apac-baseline/ absent');
  const fichiers = readdirSync(APAC_DIR).filter((f) => f.endsWith('.md'));
  for (const a of ['AIAD-JP-APPI.md', 'AIAD-SG-PDPA.md', 'AIAD-AU-PRIVACY.md']) {
    assert.ok(fichiers.includes(a), `agent ${a} manquant`);
  }
});

test('templates apac — chaque agent a structure valide (MISSION/DÉCLENCHEURS/TOUJOURS/JAMAIS/Veto)', () => {
  for (const f of ['AIAD-JP-APPI.md', 'AIAD-SG-PDPA.md', 'AIAD-AU-PRIVACY.md']) {
    const c = readFileSync(join(APAC_DIR, f), 'utf-8');
    assert.match(c, /## MISSION/, `${f} : MISSION absente`);
    assert.match(c, /## DÉCLENCHEURS/, `${f} : DÉCLENCHEURS absent`);
    assert.match(c, /TOUJOURS/, `${f} : TOUJOURS absent`);
    assert.match(c, /JAMAIS/, `${f} : JAMAIS absent`);
    assert.match(c, /Droit de veto.*oui/i, `${f} : veto Tier 1 non déclaré`);
  }
});

test('templates apac — JP-APPI cite révision 2022 + PPC + sensitive information', () => {
  const c = readFileSync(join(APAC_DIR, 'AIAD-JP-APPI.md'), 'utf-8');
  assert.match(c, /2022/);
  assert.match(c, /PPC|Personal Information Protection Commission/i);
  assert.match(c, /sensitive personal information|要配慮個人情報/);
});

test('templates apac — SG-PDPA cite NDB 72 h + portabilité + DNC', () => {
  const c = readFileSync(join(APAC_DIR, 'AIAD-SG-PDPA.md'), 'utf-8');
  assert.match(c, /Mandatory Data Breach|NDB/i);
  assert.match(c, /72 h|72 heures/i);
  assert.match(c, /Data Portability|portabilité/i);
  assert.match(c, /Do Not Call|DNC/);
  assert.match(c, /PDPC/);
});

test('templates apac — AU-Privacy cite 13 APPs + NDB + sanctions 2024', () => {
  const c = readFileSync(join(APAC_DIR, 'AIAD-AU-PRIVACY.md'), 'utf-8');
  assert.match(c, /APP[s]? 1-13|13 APPs|APP 1\b/);
  assert.match(c, /Notifiable Data Breach|NDB/i);
  assert.match(c, /AUD 50M|50M/);
  assert.match(c, /OAIC/);
});

test('templates apac — chaque agent référence l\'autorité de contrôle officielle', () => {
  const referencesAttendues = {
    'AIAD-JP-APPI.md': /ppc\.go\.jp/i,
    'AIAD-SG-PDPA.md': /pdpc\.gov\.sg/i,
    'AIAD-AU-PRIVACY.md': /oaic\.gov\.au/i,
  };
  for (const [f, re] of Object.entries(referencesAttendues)) {
    const c = readFileSync(join(APAC_DIR, f), 'utf-8');
    assert.match(c, re, `${f} : référence autorité absente`);
  }
});

// ─── Installation ──────────────────────────────────────────────────────────

test('installerPack apac-baseline — copie les 3 agents', silencer(async () => {
  const d = tmp();
  try {
    await installerPack(d, 'apac-baseline', { silencieux: true });
    const govDir = join(d, '.aiad', 'gouvernance');
    assert.ok(existsSync(govDir));
    for (const f of ['AIAD-JP-APPI.md', 'AIAD-SG-PDPA.md', 'AIAD-AU-PRIVACY.md']) {
      assert.ok(existsSync(join(govDir, f)), `${f} non installé`);
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerPack apac-baseline --dry-run — n\'écrit rien', silencer(async () => {
  const d = tmp();
  try {
    await installerPack(d, 'apac-baseline', { silencieux: true, dryRun: true });
    const govDir = join(d, '.aiad', 'gouvernance');
    assert.ok(!existsSync(govDir) || readdirSync(govDir).length === 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));
