// Tests `aiad-sdd migrate`. Vérifie idempotence + détection précise.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { migrer, planifier } from '../lib/migrate.js';

function silencer(fn) {
  return async (...args) => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { process.stdout.write = orig; }
  };
}

function projetVxLegacy() {
  // Projet d'une version pré-1.10 : pas de metrics/traceability/, pas de facts/
  const dir = mkdtempSync(join(tmpdir(), 'aiad-mig-'));
  mkdirSync(join(dir, '.aiad', 'intents'), { recursive: true });
  mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
  return dir;
}

test('planifier — projet à jour → 0 migration', () => {
  const d = projetVxLegacy();
  try {
    // Crée tous les dossiers requis pour simuler "à jour"
    for (const sub of ['metrics/traceability', 'metrics/security', 'metrics/audit', 'facts']) {
      mkdirSync(join(d, '.aiad', sub), { recursive: true });
    }
    // Indices présents
    writeFileSync(join(d, '.aiad', 'intents', '_index.md'), '# X');
    writeFileSync(join(d, '.aiad', 'specs', '_index.md'), '# X');
    const r = planifier(d);
    assert.equal(r.length, 0);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('planifier — projet legacy → 4 migrations applicables (M1..M4)', () => {
  const d = projetVxLegacy();
  try {
    const r = planifier(d);
    const ids = r.map((m) => m.id);
    assert.ok(ids.includes('M1-metrics-traceability'));
    assert.ok(ids.includes('M2-facts'));
    assert.ok(ids.includes('M3-metrics-security-audit'));
    assert.ok(ids.includes('M4-indices'));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('planifier — détecte commandes désynchronisées (M5)', () => {
  const d = projetVxLegacy();
  try {
    mkdirSync(join(d, '.claude', 'commands'), { recursive: true });
    writeFileSync(join(d, '.claude', 'commands', 'sdd.md'), '# router');
    // sdd-trace.md absent → désynchronisé avec v1.10+
    const r = planifier(d);
    assert.ok(r.some((m) => m.id === 'M5-update-check-recommandé'));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('migrer — sans --force = aperçu (rien écrit)', silencer(async () => {
  const d = projetVxLegacy();
  try {
    const r = await migrer(d, {});
    assert.ok(r.planned.length >= 4, 'migrations planned attendues');
    assert.equal(r.appliquees.length, 0);
    // Aucun nouveau dossier
    assert.ok(!existsSync(join(d, '.aiad', 'metrics', 'traceability')));
    assert.ok(!existsSync(join(d, '.aiad', 'facts')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('migrer --force — applique les migrations', silencer(async () => {
  const d = projetVxLegacy();
  try {
    const r = await migrer(d, { force: true });
    assert.ok(r.appliquees.length >= 4);
    assert.ok(existsSync(join(d, '.aiad', 'metrics', 'traceability')));
    assert.ok(existsSync(join(d, '.aiad', 'facts')));
    assert.ok(existsSync(join(d, '.aiad', 'metrics', 'security')));
    assert.ok(existsSync(join(d, '.aiad', 'metrics', 'audit')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('migrer --force --dry-run — équivalent à mode aperçu (rien écrit)', silencer(async () => {
  const d = projetVxLegacy();
  try {
    const r = await migrer(d, { force: true, dryRun: true });
    assert.equal(r.appliquees.length, 0);
    assert.ok(!existsSync(join(d, '.aiad', 'metrics', 'traceability')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('migrer — idempotent : second run après --force = 0 migration', silencer(async () => {
  const d = projetVxLegacy();
  try {
    await migrer(d, { force: true });
    // Deuxième passage
    const r2 = await migrer(d, {});
    assert.equal(r2.planned.length, 0);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('migrer — projet sans .aiad/ → message clair, ok=false', silencer(async () => {
  const d = mkdtempSync(join(tmpdir(), 'aiad-mig-virgin-'));
  try {
    const r = await migrer(d, { force: true });
    assert.equal(r.ok, false);
    assert.equal(r.appliquees.length, 0);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));
