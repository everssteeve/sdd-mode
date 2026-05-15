// Tests `aiad-sdd verify-reproducibility` — content hash déterministe.
// Anticipation Cyber Resilience Act EU 2024/2847 + SLSA + NIST SSDF.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeContentHash, verifyReproducibility } from '../lib/reproducibility.js';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'aiad-repro-'));
}

function projetMinimal(dir) {
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'demo-repro',
        version: '1.0.0',
        files: ['index.js', 'lib/'],
      },
      null,
      2,
    ),
  );
  writeFileSync(join(dir, 'index.js'), 'export const greet = () => "hello";\n');
  mkdirSync(join(dir, 'lib'));
  writeFileSync(join(dir, 'lib/util.js'), 'export const x = 1;\n');
}

test('computeContentHash — produit un hash sha-256 hex 64 chars', () => {
  const dir = tmp();
  try {
    projetMinimal(dir);
    const { hash, files } = computeContentHash(dir);
    assert.match(hash, /^[0-9a-f]{64}$/, 'hash invalide');
    assert.ok(files.length >= 3, `attendu ≥3 fichiers, vu ${files.length}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('computeContentHash — déterministe entre deux invocations', () => {
  const dir = tmp();
  try {
    projetMinimal(dir);
    const r1 = computeContentHash(dir);
    const r2 = computeContentHash(dir);
    assert.equal(r1.hash, r2.hash, 'hash non déterministe');
    assert.equal(r1.files.length, r2.files.length);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('computeContentHash — invariant aux mtimes (vrai test reproductibilité)', () => {
  const dir = tmp();
  try {
    projetMinimal(dir);
    const r1 = computeContentHash(dir);
    // Modifie les mtimes des fichiers (simule un build à un autre instant).
    const epoch = new Date('2020-01-01');
    utimesSync(join(dir, 'index.js'), epoch, epoch);
    utimesSync(join(dir, 'lib/util.js'), epoch, epoch);
    const r2 = computeContentHash(dir);
    assert.equal(r1.hash, r2.hash, 'mtime ne devrait pas affecter le content hash');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('computeContentHash — change si le contenu change', () => {
  const dir = tmp();
  try {
    projetMinimal(dir);
    const r1 = computeContentHash(dir);
    writeFileSync(join(dir, 'index.js'), 'export const greet = () => "world";\n');
    const r2 = computeContentHash(dir);
    assert.notEqual(r1.hash, r2.hash, 'le hash devrait diverger si le contenu change');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('computeContentHash — change si on ajoute/retire un fichier', () => {
  const dir = tmp();
  try {
    projetMinimal(dir);
    const r1 = computeContentHash(dir);
    writeFileSync(join(dir, 'lib/extra.js'), 'export const y = 2;\n');
    const r2 = computeContentHash(dir);
    assert.notEqual(r1.hash, r2.hash);
    assert.ok(r2.files.length > r1.files.length);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('computeContentHash — entries triées alphabétiquement', () => {
  const dir = tmp();
  try {
    projetMinimal(dir);
    const { files } = computeContentHash(dir);
    for (let i = 1; i < files.length; i++) {
      assert.ok(files[i - 1].path <= files[i].path, `non trié : ${files[i - 1].path} > ${files[i].path}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('computeContentHash — chaque entrée porte sha256, size, mode', () => {
  const dir = tmp();
  try {
    projetMinimal(dir);
    const { files } = computeContentHash(dir);
    for (const f of files) {
      assert.match(f.sha256, /^[0-9a-f]{64}$/);
      assert.ok(typeof f.size === 'number' && f.size >= 0);
      assert.ok(f.mode === 0o755 || f.mode === 0o644, `mode normalisé attendu, vu ${f.mode.toString(8)}`);
      assert.ok(typeof f.path === 'string' && f.path.length > 0);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('verifyReproducibility — sans expected : retourne hash + match=null', async () => {
  const dir = tmp();
  try {
    projetMinimal(dir);
    const origLog = console.log;
    console.log = () => {};
    try {
      const r = await verifyReproducibility(dir);
      assert.match(r.hash, /^[0-9a-f]{64}$/);
      assert.equal(r.match, null);
    } finally {
      console.log = origLog;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('verifyReproducibility — expected match → match=true', async () => {
  const dir = tmp();
  try {
    projetMinimal(dir);
    const { hash } = computeContentHash(dir);
    const origLog = console.log;
    console.log = () => {};
    try {
      const r = await verifyReproducibility(dir, { expected: hash });
      assert.equal(r.match, true);
    } finally {
      console.log = origLog;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('verifyReproducibility — expected mismatch → match=false', async () => {
  const dir = tmp();
  try {
    projetMinimal(dir);
    const origLog = console.log;
    console.log = () => {};
    try {
      const r = await verifyReproducibility(dir, { expected: '0'.repeat(64) });
      assert.equal(r.match, false);
    } finally {
      console.log = origLog;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('verifyReproducibility — mode --json écrit JSON exploitable sur stdout', async () => {
  const dir = tmp();
  try {
    projetMinimal(dir);
    let captured = '';
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk) => {
      captured += chunk;
      return true;
    };
    try {
      const r = await verifyReproducibility(dir, { json: true });
      const parsed = JSON.parse(captured);
      assert.equal(parsed.hash, r.hash);
      assert.equal(typeof parsed.files, 'number');
      assert.equal(parsed.expected, null);
      assert.equal(parsed.match, null);
    } finally {
      process.stdout.write = origWrite;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('computeContentHash — pas de package.json → erreur explicite', () => {
  const dir = tmp();
  try {
    assert.throws(() => computeContentHash(dir), /npm pack/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
