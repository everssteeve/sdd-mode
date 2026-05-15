// Tests packs gouvernance EU vague 2 — IT-AGID + NL-AP + BE-APD.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKS, packExiste, listerPacks, installerPack } from '../lib/governance-packs.js';
import { init } from '../lib/init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKS_DIR = join(__dirname, '..', 'templates', '.aiad', 'gouvernance-packs');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-eu-v2-')); }

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

// ─── Registration des 3 packs ──────────────────────────────────────────────

test('listerPacks — 3 packs vague 2 enregistrés (it-agid, nl-ap, be-apd)', () => {
  const liste = listerPacks();
  for (const id of ['it-agid', 'nl-ap', 'be-apd']) {
    assert.ok(packExiste(id), `pack ${id} absent`);
    assert.ok(liste.find((p) => p.id === id), `${id} pas dans listerPacks()`);
  }
});

test('PACKS — juridictions correctes', () => {
  assert.equal(PACKS['it-agid'].juridiction, 'Italie');
  assert.equal(PACKS['nl-ap'].juridiction, 'Pays-Bas');
  assert.equal(PACKS['be-apd'].juridiction, 'Belgique');
});

// ─── IT-AGID ────────────────────────────────────────────────────────────────

test('AIAD-IT-AGID — fichier présent + référence AGID/CAD/Linee Guida AI 2024', () => {
  const c = readFileSync(join(PACKS_DIR, 'it-agid', 'AIAD-IT-AGID.md'), 'utf-8');
  assert.match(c, /AGID/);
  assert.match(c, /CAD|Codice dell'Amministrazione Digitale/);
  assert.match(c, /D\.lgs\.\s*82\/2005/);
  assert.match(c, /Linee Guida.*IA|Linee Guida.*AI/i);
});

test('AIAD-IT-AGID — couvre SPID/CIE/eIDAS + PagoPA + FEQ', () => {
  const c = readFileSync(join(PACKS_DIR, 'it-agid', 'AIAD-IT-AGID.md'), 'utf-8');
  assert.match(c, /SPID/);
  assert.match(c, /CIE/);
  assert.match(c, /eIDAS/);
  assert.match(c, /PagoPA/);
  assert.match(c, /FEQ/);
});

test('AIAD-IT-AGID — 7 principes éthiques + 3 niveaux de risque IA + Marketplace AgID', () => {
  const c = readFileSync(join(PACKS_DIR, 'it-agid', 'AIAD-IT-AGID.md'), 'utf-8');
  assert.match(c, /7 principes/);
  assert.match(c, /3 niveaux de risque|niveau de risque|niveaux/);
  assert.match(c, /Marketplace|Marketplace cloud|cloud souverain/i);
  assert.match(c, /QC1|QC2|QC3/);
});

// ─── NL-AP ──────────────────────────────────────────────────────────────────

test('AIAD-NL-AP — fichier présent + AP + UAVG + BIO + Algorithm Register', () => {
  const c = readFileSync(join(PACKS_DIR, 'nl-ap', 'AIAD-NL-AP.md'), 'utf-8');
  assert.match(c, /Autoriteit Persoonsgegevens|AP/);
  assert.match(c, /UAVG/);
  assert.match(c, /BIO/);
  assert.match(c, /Algorithm Register|Algoritmeregister|registre des algorithmes/i);
});

test('AIAD-NL-AP — précurseur 2022 sur algorithmes publics + niveaux BBN1-3', () => {
  const c = readFileSync(join(PACKS_DIR, 'nl-ap', 'AIAD-NL-AP.md'), 'utf-8');
  assert.match(c, /2022/);
  assert.match(c, /BBN1.*BBN2.*BBN3|BBN/s);
});

test('AIAD-NL-AP — DigiD (citoyens) + eHerkenning (entreprises)', () => {
  const c = readFileSync(join(PACKS_DIR, 'nl-ap', 'AIAD-NL-AP.md'), 'utf-8');
  assert.match(c, /DigiD/);
  assert.match(c, /eHerkenning/);
});

// ─── BE-APD ─────────────────────────────────────────────────────────────────

test('AIAD-BE-APD — fichier présent + APD/GBA + Loi 30 juillet 2018 + CCT 81', () => {
  const c = readFileSync(join(PACKS_DIR, 'be-apd', 'AIAD-BE-APD.md'), 'utf-8');
  assert.match(c, /APD|GBA|Autorité de protection des données/);
  assert.match(c, /30 juillet 2018/);
  assert.match(c, /CCT 81/);
});

test('AIAD-BE-APD — trilinguisme FR/NL/DE par région', () => {
  const c = readFileSync(join(PACKS_DIR, 'be-apd', 'AIAD-BE-APD.md'), 'utf-8');
  assert.match(c, /flamande/i);
  assert.match(c, /wallonne/i);
  assert.match(c, /bruxelloise|Bruxelles/i);
  assert.match(c, /germanophone/i);
  // Les 3 codes langue mentionnés
  assert.match(c, /FR.*NL.*DE|NL.*FR.*DE/);
});

test('AIAD-BE-APD — eID belge + itsme® + Loi 11 mars 2003 e-commerce', () => {
  const c = readFileSync(join(PACKS_DIR, 'be-apd', 'AIAD-BE-APD.md'), 'utf-8');
  assert.match(c, /eID/);
  assert.match(c, /itsme/);
  assert.match(c, /11 mars 2003/);
});

// ─── Sections obligatoires + Tier 1 ────────────────────────────────────────

test('chaque pack vague 2 — sections obligatoires + Tier 1', () => {
  const cibles = [
    ['it-agid', 'AIAD-IT-AGID.md'],
    ['nl-ap', 'AIAD-NL-AP.md'],
    ['be-apd', 'AIAD-BE-APD.md'],
  ];
  for (const [pack, agent] of cibles) {
    const c = readFileSync(join(PACKS_DIR, pack, agent), 'utf-8');
    for (const s of ['## MISSION', '## DÉCLENCHEURS', '## RÈGLES ABSOLUES — TOUJOURS',
                      '## RÈGLES ABSOLUES — JAMAIS', '## PROTOCOLE DE SIGNALEMENT', '## ARTICULATION']) {
      assert.match(c, new RegExp(s), `${pack}/${agent} : ${s} absente`);
    }
    assert.match(c, /Tier 1/, `${pack}/${agent} : Tier 1 absent`);
    assert.match(c, /Droit de veto.*oui/i, `${pack}/${agent} : droit de veto absent`);
  }
});

test('chaque pack vague 2 — articulation explicite avec AIAD-RGPD', () => {
  const cibles = [
    ['it-agid', 'AIAD-IT-AGID.md'],
    ['nl-ap', 'AIAD-NL-AP.md'],
    ['be-apd', 'AIAD-BE-APD.md'],
  ];
  for (const [pack, agent] of cibles) {
    const c = readFileSync(join(PACKS_DIR, pack, agent), 'utf-8');
    assert.match(c, /AIAD-RGPD/, `${pack}/${agent} : AIAD-RGPD non cité`);
  }
});

// ─── Installation ───────────────────────────────────────────────────────────

test('installerPack it-agid → AIAD-IT-AGID installé', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await installerPack(d, 'it-agid', { silencieux: true });
    assert.equal(r.created, 1);
    assert.ok(existsSync(join(d, '.aiad/gouvernance/AIAD-IT-AGID.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerPack nl-ap → AIAD-NL-AP installé', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await installerPack(d, 'nl-ap', { silencieux: true });
    assert.equal(r.created, 1);
    assert.ok(existsSync(join(d, '.aiad/gouvernance/AIAD-NL-AP.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerPack be-apd → AIAD-BE-APD installé', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await installerPack(d, 'be-apd', { silencieux: true });
    assert.equal(r.created, 1);
    assert.ok(existsSync(join(d, '.aiad/gouvernance/AIAD-BE-APD.md')));
    // eu-baseline préservé
    assert.ok(existsSync(join(d, '.aiad/gouvernance/AIAD-RGPD.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));
