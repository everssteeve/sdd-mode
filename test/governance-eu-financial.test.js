// Tests pack gouvernance `eu-financial` — DORA / PSD2 / MiCA / SFDR.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKS, listerPacks, packExiste, installerPack } from '../lib/governance-packs.js';
import { init } from '../lib/init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACK_DIR = join(__dirname, '..', 'templates', '.aiad', 'gouvernance-packs', 'eu-financial');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-eufin-')); }

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

test('eu-financial — pack enregistré dans PACKS', () => {
  assert.ok(packExiste('eu-financial'));
  const p = PACKS['eu-financial'];
  assert.equal(p.juridiction, 'Union européenne — secteur financier');
  assert.equal(p.defaut, false);
  assert.match(p.description, /DORA.*PSD2.*MiCA.*SFDR/);
});

test('eu-financial — listerPacks le retourne avec ses métadonnées', () => {
  const liste = listerPacks();
  const p = liste.find((x) => x.id === 'eu-financial');
  assert.ok(p, 'pack absent de listerPacks()');
  assert.equal(p.id, 'eu-financial');
  assert.match(p.titre, /EU Financial/);
});

test('eu-financial — 4 agents Tier 1 présents dans templates/', () => {
  for (const a of ['AIAD-DORA.md', 'AIAD-PSD2.md', 'AIAD-MICA.md', 'AIAD-SFDR.md']) {
    assert.ok(existsSync(join(PACK_DIR, a)), `${a} absent`);
  }
});

test('AIAD-DORA — référence Règlement (UE) 2022/2554 et Article 14 reporting', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-DORA.md'), 'utf-8');
  assert.match(c, /Règlement \(UE\) 2022\/2554/);
  assert.match(c, /Digital Operational Resilience Act/i);
  assert.match(c, /17 janvier 2025/);
  // Reporting d'incidents : pré-notif 4h, intermédiaire 72h
  assert.match(c, /4 heures/);
  assert.match(c, /72 heures/);
  // TLPT 3 ans
  assert.match(c, /TLPT/);
  // Tiers TIC critiques
  assert.match(c, /tiers TIC/i);
  assert.match(c, /stratégie de sortie/i);
});

test('AIAD-PSD2 — SCA + Dynamic Linking + RTS 2018/389', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-PSD2.md'), 'utf-8');
  assert.match(c, /Directive \(UE\) 2015\/2366/);
  assert.match(c, /Strong Customer Authentication|SCA/);
  assert.match(c, /Dynamic Linking/i);
  assert.match(c, /Connaissance.*Possession.*Inhérence/s);
  assert.match(c, /eIDAS/);
  // Reporting Article 96
  assert.match(c, /Article 96/);
  assert.match(c, /4 heures/);
});

test('AIAD-MICA — Règlement 2023/1114 + classification CASP/ART/EMT', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-MICA.md'), 'utf-8');
  assert.match(c, /Règlement \(UE\) 2023\/1114/);
  assert.match(c, /Markets in Crypto-Assets/i);
  assert.match(c, /CASP/);
  assert.match(c, /ART|Asset-Referenced/);
  assert.match(c, /EMT|E-Money/);
  assert.match(c, /whitepaper/i);
  // Ségrégation des actifs
  assert.match(c, /ségréger|séparation comptable/i);
  // Cumul DORA pour CASP
  assert.match(c, /DORA/);
});

test('AIAD-SFDR — Article 6 / 8 / 9 + PAI + Taxonomie UE', () => {
  const c = readFileSync(join(PACK_DIR, 'AIAD-SFDR.md'), 'utf-8');
  assert.match(c, /Règlement \(UE\) 2019\/2088/);
  assert.match(c, /Article 6/);
  assert.match(c, /Article 8/);
  assert.match(c, /Article 9/);
  // PAI
  assert.match(c, /PAI/);
  assert.match(c, /14 indicateurs/);
  // Taxonomie UE 2020/852
  assert.match(c, /Taxonomie/i);
  assert.match(c, /2020\/852/);
  // DNSH + garanties minimales
  assert.match(c, /DNSH/);
  assert.match(c, /greenwashing/i);
});

test('chaque agent eu-financial — sections obligatoires (MISSION/DÉCLENCHEURS/TOUJOURS/JAMAIS/PROTOCOLE)', () => {
  for (const a of ['AIAD-DORA.md', 'AIAD-PSD2.md', 'AIAD-MICA.md', 'AIAD-SFDR.md']) {
    const c = readFileSync(join(PACK_DIR, a), 'utf-8');
    assert.match(c, /## MISSION/, `${a} : MISSION absente`);
    assert.match(c, /## DÉCLENCHEURS/, `${a} : DÉCLENCHEURS absente`);
    assert.match(c, /## RÈGLES ABSOLUES — TOUJOURS/, `${a} : TOUJOURS absente`);
    assert.match(c, /## RÈGLES ABSOLUES — JAMAIS/, `${a} : JAMAIS absente`);
    assert.match(c, /## PROTOCOLE DE SIGNALEMENT/, `${a} : PROTOCOLE absent`);
    assert.match(c, /## ARTICULATION/, `${a} : ARTICULATION absente`);
    assert.match(c, /Tier 1/, `${a} : Tier 1 absent`);
    assert.match(c, /Droit de veto.*oui|droit de veto/i, `${a} : droit de veto absent`);
  }
});

test('installerPack eu-financial → 4 agents installés sans toucher eu-baseline', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    // Avant : 5 agents EU baseline (CRA inclus)
    const govDir = join(d, '.aiad', 'gouvernance');
    const baseline = ['AIAD-AI-ACT.md', 'AIAD-RGPD.md', 'AIAD-RGAA.md', 'AIAD-RGESN.md', 'AIAD-CRA.md'];
    for (const f of baseline) assert.ok(existsSync(join(govDir, f)), `baseline ${f} absent avant`);

    // Installer eu-financial
    const r = await installerPack(d, 'eu-financial', { force: false, silencieux: true });
    assert.equal(r.created, 4);

    // 4 nouveaux + 5 baseline préservés
    for (const f of baseline) assert.ok(existsSync(join(govDir, f)), `baseline ${f} disparu après pack`);
    for (const f of ['AIAD-DORA.md', 'AIAD-PSD2.md', 'AIAD-MICA.md', 'AIAD-SFDR.md']) {
      assert.ok(existsSync(join(govDir, f)), `${f} absent après install`);
    }
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('installerPack eu-financial --dry-run → ne crée rien', silencer(async () => {
  const d = tmp();
  try {
    await init(d, { sansGouvernance: true });
    const govDir = join(d, '.aiad', 'gouvernance');
    await installerPack(d, 'eu-financial', { dryRun: true, silencieux: true });
    for (const f of ['AIAD-DORA.md', 'AIAD-PSD2.md', 'AIAD-MICA.md', 'AIAD-SFDR.md']) {
      assert.ok(!existsSync(join(govDir, f)), `${f} créé en dry-run`);
    }
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));
