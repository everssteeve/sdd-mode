// Tests `init` parallélisé via `copierDossierRecursifAsync` — vérifie
// l'équivalence avec la version synchrone et l'absence de régression.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copierDossierRecursifAsync, init } from '../lib/init.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-init-par-')); }

// Silencer minimaliste : intercepte uniquement console.log (pas
// process.stdout.write, qui est utilisé par le test runner Node lui-même
// pour ses propres messages — l'écraser fausse le comptage des subtests).
function silencer(fn) {
  return async (...args) => {
    const origLog = console.log;
    console.log = () => {};
    try { return await fn(...args); }
    finally { console.log = origLog; }
  };
}

function listerArbre(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const nom of readdirSync(dir)) {
    const path = join(dir, nom);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      out.push(...listerArbre(path).map((sub) => join(nom, sub)));
    } else {
      out.push(nom);
    }
  }
  return out.sort();
}

function fixture(racine) {
  mkdirSync(join(racine, 'sub'), { recursive: true });
  writeFileSync(join(racine, 'a.md'), '# A\nContent A\n');
  writeFileSync(join(racine, 'b.md'), '# B\nContent B\n');
  writeFileSync(join(racine, 'sub', 'c.md'), '# C\nContent C\n');
  writeFileSync(join(racine, 'sub', 'd.md'), '# D\nContent D\n');
}

// ─── copierDossierRecursifAsync ─────────────────────────────────────────────

test('copierDossierRecursifAsync — produit l\'arbre attendu', silencer(async () => {
  const d = tmp();
  try {
    const src = join(d, 'src');
    const dest = join(d, 'dest');
    fixture(src);
    await copierDossierRecursifAsync(src, dest);
    const arbre = listerArbre(dest).sort();
    assert.deepEqual(arbre, ['a.md', 'b.md', 'sub/c.md', 'sub/d.md']);
    assert.equal(readFileSync(join(dest, 'a.md'), 'utf-8'), '# A\nContent A\n');
    assert.equal(readFileSync(join(dest, 'sub/c.md'), 'utf-8'), '# C\nContent C\n');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('copierDossierRecursifAsync — source absente → no-op silent', async () => {
  const d = tmp();
  try {
    await copierDossierRecursifAsync(join(d, 'inexistant'), join(d, 'dest'));
    assert.ok(!existsSync(join(d, 'dest')));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('copierDossierRecursifAsync — exclude filtre les éléments', silencer(async () => {
  const d = tmp();
  try {
    const src = join(d, 'src');
    const dest = join(d, 'dest');
    fixture(src);
    await copierDossierRecursifAsync(src, dest, false, {
      exclude: (nom) => nom === 'sub',
    });
    assert.ok(existsSync(join(dest, 'a.md')));
    assert.ok(existsSync(join(dest, 'b.md')));
    assert.ok(!existsSync(join(dest, 'sub')), 'sub/ filtré');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('copierDossierRecursifAsync --dry-run → rien sur disque', silencer(async () => {
  const d = tmp();
  try {
    const src = join(d, 'src');
    const dest = join(d, 'dest');
    fixture(src);
    await copierDossierRecursifAsync(src, dest, false, { dryRun: true });
    assert.ok(!existsSync(join(dest, 'a.md')), 'fichier créé en dry-run');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('copierDossierRecursifAsync — préserve les fichiers existants sans force', silencer(async () => {
  const d = tmp();
  try {
    const src = join(d, 'src');
    const dest = join(d, 'dest');
    fixture(src);
    mkdirSync(dest);
    writeFileSync(join(dest, 'a.md'), 'EXISTANT');
    await copierDossierRecursifAsync(src, dest, false);
    assert.equal(readFileSync(join(dest, 'a.md'), 'utf-8'), 'EXISTANT', 'fichier écrasé sans force');
    // Mais b.md (nouveau) doit être créé
    assert.ok(existsSync(join(dest, 'b.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('copierDossierRecursifAsync force=true → écrase les fichiers existants', silencer(async () => {
  const d = tmp();
  try {
    const src = join(d, 'src');
    const dest = join(d, 'dest');
    fixture(src);
    mkdirSync(dest);
    writeFileSync(join(dest, 'a.md'), 'EXISTANT');
    await copierDossierRecursifAsync(src, dest, true);
    assert.equal(readFileSync(join(dest, 'a.md'), 'utf-8'), '# A\nContent A\n');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('copierDossierRecursifAsync — gère les arbres profonds', silencer(async () => {
  const d = tmp();
  try {
    const src = join(d, 'src');
    mkdirSync(join(src, 'a/b/c/d/e'), { recursive: true });
    writeFileSync(join(src, 'a/b/c/d/e/deep.md'), 'profond');
    const dest = join(d, 'dest');
    await copierDossierRecursifAsync(src, dest);
    assert.ok(existsSync(join(dest, 'a/b/c/d/e/deep.md')));
    assert.equal(readFileSync(join(dest, 'a/b/c/d/e/deep.md'), 'utf-8'), 'profond');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('copierDossierRecursifAsync — équivalence avec init complet (5 agents Tier 1 présents)', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    // Vérification : les 5 agents Tier 1 sont copiés (post-init)
    const govDir = join(d, '.aiad', 'gouvernance');
    for (const f of ['AIAD-AI-ACT.md', 'AIAD-RGPD.md', 'AIAD-RGAA.md', 'AIAD-RGESN.md', 'AIAD-CRA.md']) {
      assert.ok(existsSync(join(govDir, f)), `agent ${f} absent`);
    }
    // .claude/commands/ existe
    assert.ok(existsSync(join(d, '.claude/commands')));
    // .github/ existe
    assert.ok(existsSync(join(d, '.github')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('copierDossierRecursifAsync — perf cold sous 100 ms sur fixture moyenne', silencer(async () => {
  const d = tmp();
  try {
    const src = join(d, 'src');
    mkdirSync(src);
    // 50 fichiers répartis sur 5 sous-dossiers
    for (let i = 0; i < 5; i++) {
      mkdirSync(join(src, `dir${i}`));
      for (let j = 0; j < 10; j++) {
        writeFileSync(join(src, `dir${i}`, `f${j}.md`), `# ${i}.${j}\n`.repeat(10));
      }
    }
    const dest = join(d, 'dest');
    const t0 = process.hrtime.bigint();
    await copierDossierRecursifAsync(src, dest);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.ok(ms < 100, `copie 50 fichiers prend ${ms.toFixed(1)} ms (> 100)`);
    assert.equal(listerArbre(dest).length, 50);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));
