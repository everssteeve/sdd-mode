// Tests pack `eu-platforms` — Digital Services Act (Règlement UE 2022/2065).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKS, listerPacks, packExiste, installerPack } from '../lib/governance-packs.js';
import { init } from '../lib/init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACK_DIR = join(__dirname, '..', 'templates', '.aiad', 'gouvernance-packs', 'eu-platforms');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-platforms-')); }

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

test('eu-platforms — pack enregistré dans PACKS', () => {
  assert.ok(packExiste('eu-platforms'));
  const p = PACKS['eu-platforms'];
  assert.equal(p.juridiction, 'Union européenne — plateformes intermédiaires');
  assert.equal(p.defaut, false);
  assert.match(p.description, /DSA/);
  assert.match(p.description, /2022\/2065/);
});

test('listerPacks — eu-platforms apparaît dans la liste', () => {
  const liste = listerPacks();
  assert.ok(liste.find((p) => p.id === 'eu-platforms'));
});

// ─── AIAD-DSA agent content ─────────────────────────────────────────────────

test('AIAD-DSA.md — fichier présent', () => {
  assert.ok(existsSync(join(PACK_DIR, 'AIAD-DSA.md')));
});

test('AIAD-DSA — référence Règlement (UE) 2022/2065 + application 17 février 2024', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-DSA.md'), 'utf-8');
  assert.match(c, /Règlement \(UE\) 2022\/2065/);
  assert.match(c, /Digital Services Act/);
  assert.match(c, /17 février 2024/);
});

test('AIAD-DSA — couvre les 4 niveaux d\'asymétrie (intermédiaires / hébergeurs / plateformes / VLOP)', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-DSA.md'), 'utf-8');
  assert.match(c, /VLOP/);
  assert.match(c, /VLOSE/);
  assert.match(c, /45 M/);
  assert.match(c, /Hébergeurs/i);
  assert.match(c, /marketplace/i);
});

test('AIAD-DSA — articles clés cités', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-DSA.md'), 'utf-8');
  // Articles fondamentaux DSA
  for (const art of ['11', '14', '15', '16', '17', '20', '22', '25', '26', '27', '28', '30', '34', '35', '37', '38', '40']) {
    assert.match(c, new RegExp(`Article ${art}`), `Article ${art} non cité`);
  }
});

test('AIAD-DSA — interdictions explicites (mineurs, dark patterns)', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-DSA.md'), 'utf-8');
  assert.match(c, /JAMAIS.*mineur/i);
  assert.match(c, /dark pattern/i);
});

test('AIAD-DSA — Article 30 trace-the-trader pour marketplaces', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-DSA.md'), 'utf-8');
  assert.match(c, /trace-the-trader/i);
  assert.match(c, /vendeurs professionnels|trader/i);
  assert.match(c, /6 mois/);
});

test('AIAD-DSA — sanctions Article 74 (6 % CA mondial)', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-DSA.md'), 'utf-8');
  assert.match(c, /Article 74/);
  assert.match(c, /6\s*%/);
});

test('AIAD-DSA — sections obligatoires (MISSION/DÉCLENCHEURS/TOUJOURS/JAMAIS/PROTOCOLE/ARTICULATION)', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-DSA.md'), 'utf-8');
  assert.match(c, /## MISSION/);
  assert.match(c, /## DÉCLENCHEURS/);
  assert.match(c, /## RÈGLES ABSOLUES — TOUJOURS/);
  assert.match(c, /## RÈGLES ABSOLUES — JAMAIS/);
  assert.match(c, /## PROTOCOLE DE SIGNALEMENT/);
  assert.match(c, /## ARTICULATION/);
  assert.match(c, /Tier 1/);
  assert.match(c, /Droit de veto.*oui/i);
});

test('AIAD-DSA — articulation avec autres agents (RGPD/AI-ACT/CRA/RGAA)', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-DSA.md'), 'utf-8');
  // L'articulation doit mentionner les autres agents Tier 1 EU
  assert.match(c, /AIAD-RGPD/);
  assert.match(c, /AIAD-AI-ACT/);
  assert.match(c, /AIAD-CRA/);
  assert.match(c, /AIAD-RGAA/);
});

// ─── Installation ───────────────────────────────────────────────────────────

test('installerPack eu-platforms → AIAD-DSA installé au-dessus de eu-baseline', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await installerPack(d, 'eu-platforms', { silencieux: true });
    assert.equal(r.created, 1);
    assert.ok(existsSync(join(d, '.aiad/gouvernance/AIAD-DSA.md')));
    // eu-baseline préservé
    assert.ok(existsSync(join(d, '.aiad/gouvernance/AIAD-RGPD.md')));
    assert.ok(existsSync(join(d, '.aiad/gouvernance/AIAD-CRA.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerPack eu-platforms --dry-run → ne crée rien', silencer(async () => {
  const d = tmp();
  try {
    await init(d, { sansGouvernance: true });
    await installerPack(d, 'eu-platforms', { dryRun: true, silencieux: true });
    assert.ok(!existsSync(join(d, '.aiad/gouvernance/AIAD-DSA.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));
