// Tests pack `ch-fadp` — nLPD / FADP suisse révisée 2023.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKS, packExiste, listerPacks, installerPack } from '../lib/governance-packs.js';
import { init } from '../lib/init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACK_DIR = join(__dirname, '..', 'templates', '.aiad', 'gouvernance-packs', 'ch-fadp');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-ch-')); }

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

test('ch-fadp — pack enregistré', () => {
  assert.ok(packExiste('ch-fadp'));
  const p = PACKS['ch-fadp'];
  assert.equal(p.juridiction, 'Suisse');
  assert.match(p.description, /nLPD|FADP/);
  assert.match(p.description, /250 000/);
});

test('listerPacks — ch-fadp inclus', () => {
  assert.ok(listerPacks().find((p) => p.id === 'ch-fadp'));
});

test('AIAD-CH-FADP.md — fichier présent', () => {
  assert.ok(existsSync(join(PACK_DIR, 'AIAD-CH-FADP.md')));
});

test('AIAD-CH-FADP — référence nLPD + 1er septembre 2023 + RS 235.1', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-CH-FADP.md'), 'utf-8');
  assert.match(c, /nLPD|FADP/);
  assert.match(c, /1er septembre 2023/);
  assert.match(c, /RS 235\.1/);
});

test('AIAD-CH-FADP — sanctions personnelles pénales CHF 250 000 (Art. 60-63)', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-CH-FADP.md'), 'utf-8');
  assert.match(c, /CHF 250 000/);
  assert.match(c, /Art\. 60-63/);
  // Spécificité critique vs RGPD : sanctions sur la personne physique
  assert.match(c, /personnes physiques|personnelles/i);
});

test('AIAD-CH-FADP — articles clés cités (5g, 8, 14, 16-17, 19-21, 22-23, 24)', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-CH-FADP.md'), 'utf-8');
  for (const art of ['Art. 5', 'Art. 8', 'Art. 14', 'Art. 16-17', 'Art. 19', 'Art. 21', 'Art. 22', 'Art. 23', 'Art. 24']) {
    assert.match(c, new RegExp(art.replace(/\./g, '\\.').replace(/\s/g, '\\s')), `${art} non cité`);
  }
});

test('AIAD-CH-FADP — décision d\'adéquation UE↔CH 2024 mentionnée', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-CH-FADP.md'), 'utf-8');
  assert.match(c, /adéquation/i);
  assert.match(c, /UE↔CH|EU↔CH/);
});

test('AIAD-CH-FADP — profilage à risque élevé (Art. 5 lettre g) explicite', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-CH-FADP.md'), 'utf-8');
  assert.match(c, /profilage à risque élevé/i);
});

test('AIAD-CH-FADP — PFPDT (autorité) cité', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-CH-FADP.md'), 'utf-8');
  assert.match(c, /PFPDT/);
});

test('AIAD-CH-FADP — AIPD + consultation préalable (Art. 22-23)', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-CH-FADP.md'), 'utf-8');
  assert.match(c, /AIPD|Datenschutz-Folgenabschätzung/);
  assert.match(c, /3 mois/);
});

test('AIAD-CH-FADP — articulation avec AIAD-RGPD (pas de duplication)', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-CH-FADP.md'), 'utf-8');
  assert.match(c, /AIAD-RGPD/);
  assert.match(c, /Ne PAS dupliquer|alignée sur le RGPD/i);
});

test('AIAD-CH-FADP — sections obligatoires + Tier 1', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-CH-FADP.md'), 'utf-8');
  for (const s of ['## MISSION', '## DÉCLENCHEURS', '## RÈGLES ABSOLUES — TOUJOURS',
                   '## RÈGLES ABSOLUES — JAMAIS', '## PROTOCOLE DE SIGNALEMENT', '## ARTICULATION']) {
    assert.match(c, new RegExp(s));
  }
  assert.match(c, /Tier 1/);
  assert.match(c, /Droit de veto.*oui/i);
});

test('installerPack ch-fadp → AIAD-CH-FADP installé au-dessus de eu-baseline', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await installerPack(d, 'ch-fadp', { silencieux: true });
    assert.equal(r.created, 1);
    assert.ok(existsSync(join(d, '.aiad/gouvernance/AIAD-CH-FADP.md')));
    // eu-baseline préservé
    assert.ok(existsSync(join(d, '.aiad/gouvernance/AIAD-RGPD.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerPack ch-fadp --dry-run → ne crée rien', silencer(async () => {
  const d = tmp();
  try {
    await init(d, { sansGouvernance: true });
    await installerPack(d, 'ch-fadp', { dryRun: true, silencieux: true });
    assert.ok(!existsSync(join(d, '.aiad/gouvernance/AIAD-CH-FADP.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));
