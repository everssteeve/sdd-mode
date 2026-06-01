// Tests marketplace de packs gouvernance.
// Validation cryptographique SHA-256 + refus des packs altérés.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadCommunityPack, computePackChecksum, verifyPackChecksum, installCommunityPack,
} from '../lib/governance-marketplace.js';

function silencer(fn) {
  return async (...args) => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { process.stdout.write = orig; }
  };
}

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-mp-')); }

function creerPack(racine, manifest, agents = {}) {
  mkdirSync(racine, { recursive: true });
  writeFileSync(join(racine, 'aiad-pack.json'), JSON.stringify(manifest, null, 2));
  for (const [nom, contenu] of Object.entries(agents)) {
    writeFileSync(join(racine, nom), contenu);
  }
  return racine;
}

test('loadCommunityPack — manifest valide', () => {
  const d = tmp();
  try {
    const pack = creerPack(join(d, 'fr-asn'), {
      id: 'fr-asn', title: 'FR', description: 'X', jurisdiction: 'France',
      version: '1.0.0', agents: ['AIAD-FR-RGS.md'],
    }, { 'AIAD-FR-RGS.md': '# RGS' });
    const r = loadCommunityPack(pack);
    assert.equal(r.manifest.id, 'fr-asn');
    assert.equal(r.manifest.agents.length, 1);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('loadCommunityPack — manifest manquant → erreur', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, 'pack'));
    assert.throws(() => loadCommunityPack(join(d, 'pack')), /Manifest manquant/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('loadCommunityPack — champ obligatoire manquant → erreur', () => {
  const d = tmp();
  try {
    creerPack(join(d, 'p'), { id: 'x', title: 'T' /* … champs manquants */ });
    assert.throws(() => loadCommunityPack(join(d, 'p')), /Manifest incomplet/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('loadCommunityPack — agent référencé mais absent → erreur', () => {
  const d = tmp();
  try {
    creerPack(join(d, 'p'), {
      id: 'x', title: 'T', description: 'X', jurisdiction: 'FR',
      version: '1.0', agents: ['AIAD-INEXISTANT.md'],
    });
    assert.throws(() => loadCommunityPack(join(d, 'p')), /référencé absent/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('computePackChecksum — déterministe et change si contenu modifié', () => {
  const d = tmp();
  try {
    const p = creerPack(join(d, 'p'), {
      id: 'x', title: 'T', description: 'X', jurisdiction: 'FR',
      version: '1.0', agents: ['AIAD-X.md'],
    }, { 'AIAD-X.md': '# original' });
    const pack = loadCommunityPack(p);
    const c1 = computePackChecksum(pack);
    assert.match(c1, /^sha256-[0-9a-f]{64}$/);

    // Même calcul deux fois → identique
    const c2 = computePackChecksum(loadCommunityPack(p));
    assert.equal(c1, c2);

    // Modifier l'agent → checksum change
    writeFileSync(join(p, 'AIAD-X.md'), '# modifié');
    const c3 = computePackChecksum(loadCommunityPack(p));
    assert.notEqual(c1, c3);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('verifyPackChecksum — pack signé valide → ok=true source=verified', () => {
  const d = tmp();
  try {
    const p = creerPack(join(d, 'p'), {
      id: 'x', title: 'T', description: 'X', jurisdiction: 'FR',
      version: '1.0', agents: ['AIAD-X.md'],
    }, { 'AIAD-X.md': '# X' });

    const pack = loadCommunityPack(p);
    const cs = computePackChecksum(pack);

    // On rajoute le checksum au manifest et recharge
    const manifest = { ...pack.manifest, checksum: cs };
    writeFileSync(join(p, 'aiad-pack.json'), JSON.stringify(manifest));
    const pack2 = loadCommunityPack(p);
    const r = verifyPackChecksum(pack2);
    assert.equal(r.ok, true);
    assert.equal(r.source, 'verified');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('verifyPackChecksum — sans checksum → ok=true source=unsigned', () => {
  const d = tmp();
  try {
    const p = creerPack(join(d, 'p'), {
      id: 'x', title: 'T', description: 'X', jurisdiction: 'FR',
      version: '1.0', agents: ['AIAD-X.md'],
    }, { 'AIAD-X.md': '# X' });
    const r = verifyPackChecksum(loadCommunityPack(p));
    assert.equal(r.ok, true);
    assert.equal(r.source, 'unsigned');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('verifyPackChecksum — checksum altéré → ok=false', () => {
  const d = tmp();
  try {
    const p = creerPack(join(d, 'p'), {
      id: 'x', title: 'T', description: 'X', jurisdiction: 'FR',
      version: '1.0', agents: ['AIAD-X.md'],
      checksum: 'sha256-deadbeef000000000000000000000000000000000000000000000000000000',
    }, { 'AIAD-X.md': '# X' });
    const r = verifyPackChecksum(loadCommunityPack(p));
    assert.equal(r.ok, false);
    assert.match(r.expected, /^sha256-deadbeef/);
    assert.match(r.actual, /^sha256-/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('installCommunityPack — refuse pack non signé sans --unsafe', silencer(async () => {
  const d = tmp();
  const racineProjet = join(d, 'projet');
  mkdirSync(join(racineProjet, '.aiad', 'gouvernance'), { recursive: true });
  try {
    const pack = creerPack(join(d, 'pack'), {
      id: 'x', title: 'T', description: 'X', jurisdiction: 'FR',
      version: '1.0', agents: ['AIAD-X.md'],
    }, { 'AIAD-X.md': '# X' });
    await assert.rejects(
      installCommunityPack(racineProjet, pack, { silent: true }),
      /sans checksum.*Refus/i,
    );
    assert.ok(!existsSync(join(racineProjet, '.aiad', 'gouvernance', 'AIAD-X.md')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('installCommunityPack --unsafe — installe un pack non signé', silencer(async () => {
  const d = tmp();
  const racineProjet = join(d, 'projet');
  mkdirSync(join(racineProjet, '.aiad', 'gouvernance'), { recursive: true });
  try {
    const pack = creerPack(join(d, 'pack'), {
      id: 'x', title: 'T', description: 'X', jurisdiction: 'FR',
      version: '1.0', agents: ['AIAD-X.md'],
    }, { 'AIAD-X.md': '# X' });
    const r = await installCommunityPack(racineProjet, pack, { silent: true, unsafe: true });
    assert.equal(r.source, 'unsigned');
    assert.ok(existsSync(join(racineProjet, '.aiad', 'gouvernance', 'AIAD-X.md')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('installCommunityPack — pack signé valide → installation directe', silencer(async () => {
  const d = tmp();
  const racineProjet = join(d, 'projet');
  mkdirSync(join(racineProjet, '.aiad', 'gouvernance'), { recursive: true });
  try {
    const p = creerPack(join(d, 'pack'), {
      id: 'fr-asn', title: 'FR', description: 'X', jurisdiction: 'France',
      version: '1.0', agents: ['AIAD-FR-RGS.md'],
    }, { 'AIAD-FR-RGS.md': '# RGS' });
    // Calcule + injecte le checksum
    const pack = loadCommunityPack(p);
    const cs = computePackChecksum(pack);
    writeFileSync(join(p, 'aiad-pack.json'), JSON.stringify({ ...pack.manifest, checksum: cs }));

    const r = await installCommunityPack(racineProjet, p, { silent: true });
    assert.equal(r.source, 'verified');
    assert.equal(r.created, 1);
    assert.ok(existsSync(join(racineProjet, '.aiad', 'gouvernance', 'AIAD-FR-RGS.md')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('installCommunityPack — pack altéré (checksum invalide) → refus', silencer(async () => {
  const d = tmp();
  const racineProjet = join(d, 'projet');
  mkdirSync(join(racineProjet, '.aiad', 'gouvernance'), { recursive: true });
  try {
    const p = creerPack(join(d, 'pack'), {
      id: 'x', title: 'T', description: 'X', jurisdiction: 'FR',
      version: '1.0', agents: ['AIAD-X.md'],
      checksum: 'sha256-zerozeroinvalide000000000000000000000000000000000000000000000000',
    }, { 'AIAD-X.md': '# X' });
    await assert.rejects(
      installCommunityPack(racineProjet, p, { silent: true }),
      /Checksum invalide/,
    );
    assert.ok(!existsSync(join(racineProjet, '.aiad', 'gouvernance', 'AIAD-X.md')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));
