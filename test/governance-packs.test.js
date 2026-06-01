// Tests des packs de gouvernance par juridiction.
// Le défaut reste eu-baseline (4 agents Tier 1) ; us-baseline et uk-baseline
// sont des extensions optionnelles pour étendre le marché adressable.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PACKS, listerPacks, packExiste, installerPack } from '../lib/governance-packs.js';

function silencer(fn) {
  return async (...args) => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { process.stdout.write = orig; }
  };
}

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-packs-')); }

test('listerPacks — expose ≥ 6 packs avec eu-baseline en défaut', () => {
  const liste = listerPacks();
  assert.ok(liste.length >= 6, `attendu ≥ 6 packs, vu ${liste.length}`);
  const eu = liste.find((p) => p.id === 'eu-baseline');
  const us = liste.find((p) => p.id === 'us-baseline');
  const uk = liste.find((p) => p.id === 'uk-baseline');
  const fin = liste.find((p) => p.id === 'eu-financial');
  const de = liste.find((p) => p.id === 'de-bsi');
  const es = liste.find((p) => p.id === 'es-aepd');
  assert.ok(eu && us && uk && fin && de && es);
  assert.equal(eu.defaut, true);
  for (const p of [us, uk, fin, de, es]) assert.equal(p.defaut, false);
});

test('packExiste — discrimine valides / invalides', () => {
  assert.equal(packExiste('eu-baseline'), true);
  assert.equal(packExiste('us-baseline'), true);
  assert.equal(packExiste('uk-baseline'), true);
  assert.equal(packExiste('canada-baseline'), false);
  assert.equal(packExiste(''), false);
});

test('installerPack — us-baseline livre 4 agents (SOC2/HIPAA/ADA/NIST-AI-RMF)', silencer(async () => {
  const d = tmp();
  try {
    const r = await installerPack(d, 'us-baseline', { silencieux: true });
    assert.equal(r.pack, 'us-baseline');
    assert.equal(r.agents.length, 4);
    assert.ok(r.agents.includes('AIAD-SOC2'));
    assert.ok(r.agents.includes('AIAD-HIPAA'));
    assert.ok(r.agents.includes('AIAD-ADA'));
    assert.ok(r.agents.includes('AIAD-NIST-AI-RMF'));

    assert.ok(existsSync(join(d, '.aiad', 'gouvernance', 'AIAD-SOC2.md')));
    assert.ok(existsSync(join(d, '.aiad', 'gouvernance', 'AIAD-HIPAA.md')));
    assert.ok(existsSync(join(d, '.aiad', 'gouvernance', 'AIAD-ADA.md')));
    assert.ok(existsSync(join(d, '.aiad', 'gouvernance', 'AIAD-NIST-AI-RMF.md')));

    // Sanity contenu : SOC2 mentionne TSC
    const soc2 = readFileSync(join(d, '.aiad', 'gouvernance', 'AIAD-SOC2.md'), 'utf-8');
    assert.match(soc2, /Trust Services Criteria/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('installerPack — uk-baseline livre 4 agents (DPA/EQA/AI/ESG)', silencer(async () => {
  const d = tmp();
  try {
    const r = await installerPack(d, 'uk-baseline', { silencieux: true });
    assert.equal(r.pack, 'uk-baseline');
    assert.equal(r.agents.length, 4);
    assert.ok(r.agents.includes('AIAD-UK-DPA'));
    assert.ok(r.agents.includes('AIAD-UK-EQA'));
    assert.ok(r.agents.includes('AIAD-UK-AI'));
    assert.ok(r.agents.includes('AIAD-UK-ESG'));

    const dpa = readFileSync(join(d, '.aiad', 'gouvernance', 'AIAD-UK-DPA.md'), 'utf-8');
    assert.match(dpa, /Data Protection Act 2018/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('installerPack — préserve un agent personnalisé existant sans --force', silencer(async () => {
  const d = tmp();
  try {
    // L'utilisateur a déjà customisé AIAD-SOC2.md
    const dest = join(d, '.aiad', 'gouvernance', 'AIAD-SOC2.md');
    await installerPack(d, 'us-baseline', { silencieux: true });
    writeFileSync(dest, '# SOC2 personnalisé\n\nMa version locale\n', 'utf-8');

    // Ré-installer sans --force → préservation
    const r = await installerPack(d, 'us-baseline', { silencieux: true });
    assert.ok(r.preserved >= 1);
    assert.equal(readFileSync(dest, 'utf-8'), '# SOC2 personnalisé\n\nMa version locale\n');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('installerPack --dry-run — n\'écrit rien', silencer(async () => {
  const d = tmp();
  try {
    await installerPack(d, 'us-baseline', { silencieux: true, dryRun: true });
    assert.ok(!existsSync(join(d, '.aiad', 'gouvernance', 'AIAD-SOC2.md')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('installerPack — pack inconnu lève une erreur', async () => {
  const d = tmp();
  try {
    await assert.rejects(
      installerPack(d, 'pas-un-pack', { silencieux: true }),
      /inconnu/,
    );
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('PACKS — eu-baseline pointe vers les 4 templates Tier 1 historiques', () => {
  const eu = PACKS['eu-baseline'];
  assert.ok(eu.sourceDir.includes('/templates/.aiad/gouvernance'));
  // Le pack est cohérent avec le déploiement historique de governance.js
});
