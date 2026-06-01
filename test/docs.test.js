// Tests `aiad-sdd docs` — documentation utilisateur générée + check parité.
// Critère leadership EU/FR : la doc reste toujours à jour à 100 %.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { docs, _collecter, _genererMarkdown, _calculerSourceHash } from '../lib/docs.js';

function silencer(fn) {
  return async (...args) => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { process.stdout.write = orig; }
  };
}

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-docs-')); }

test('_collecter — modèle non vide avec 5 sources de vérité couvertes', () => {
  const d = _collecter();
  assert.match(d.version, /^\d+\.\d+\.\d+/);
  assert.equal(typeof d.sourceHash, 'string');
  assert.equal(d.sourceHash.length, 16);
  assert.ok(d.bin.length > 100, 'bin AIDE vide');
  assert.ok(d.sddCmds.length >= 10, `commandes SDD < 10 : ${d.sddCmds.length}`);
  assert.ok(d.aiadCmds.length >= 10, `commandes AIAD < 10 : ${d.aiadCmds.length}`);
  assert.ok(d.skills.length >= 7, `skills < 7 : ${d.skills.length}`);
  assert.ok(d.gouvernance.length === 5, `gouvernance ≠ 5 : ${d.gouvernance.length}`);
  assert.ok(d.annotations.length === 4, `annotations ≠ 4 : ${d.annotations.length}`);
});

test('_calculerSourceHash — déterministe, change si une source change', () => {
  const a = _calculerSourceHash({ x: 'foo', y: [1, 2] });
  const b = _calculerSourceHash({ x: 'foo', y: [1, 2] });
  assert.equal(a, b);
  const c = _calculerSourceHash({ x: 'bar', y: [1, 2] });
  assert.notEqual(a, c);
});

test('_genererMarkdown — contient les 6 sections + frontmatter + sentinel', () => {
  const d = _collecter();
  const md = _genererMarkdown(d);
  assert.match(md, /<!-- DO NOT EDIT — regenerate via aiad-sdd docs -->/);
  assert.match(md, /^---/m);
  assert.match(md, /source-hash:/);
  assert.match(md, /## 1\. Interface en ligne de commande/);
  assert.match(md, /## 2\. Commandes slash SDD/);
  assert.match(md, /## 3\. Commandes slash AIAD/);
  assert.match(md, /## 4\. Skills auto-déclenchées/);
  assert.match(md, /## 5\. Gouvernance Tier 1/);
  assert.match(md, /## 6\. Annotations machine-vérifiables/);
});

test('_genererMarkdown — cite tous les flags exposés par le bin', () => {
  const d = _collecter();
  const md = _genererMarkdown(d);
  // Sample des flags critiques qui doivent apparaître dans la section CLI
  for (const flag of ['--minimal', '--upgrade', '--runtime', '--force', '--dry-run', '--check', '--json']) {
    assert.ok(md.includes(flag), `flag manquant dans la doc : ${flag}`);
  }
});

test('docs — première exécution crée DOCUMENTATION.md', silencer(async () => {
  const d = tmp();
  try {
    const r = await docs(d, {});
    assert.equal(r.ok, true);
    assert.equal(r.drift, false);
    assert.ok(existsSync(join(d, 'DOCUMENTATION.md')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('docs --check — exit 1 si DOCUMENTATION.md manquante', silencer(async () => {
  const d = tmp();
  try {
    const r = await docs(d, { check: true });
    assert.equal(r.ok, false);
    assert.equal(r.drift, true);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('docs --check — exit 0 après génération (parité)', silencer(async () => {
  const d = tmp();
  try {
    await docs(d, {});
    const r = await docs(d, { check: true });
    assert.equal(r.ok, true);
    assert.equal(r.drift, false);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('docs --check — détecte une édition manuelle de DOCUMENTATION.md', silencer(async () => {
  const d = tmp();
  try {
    await docs(d, {});
    const path = join(d, 'DOCUMENTATION.md');
    writeFileSync(path, readFileSync(path, 'utf-8') + '\n\n## Section pirate\n', 'utf-8');
    const r = await docs(d, { check: true });
    assert.equal(r.ok, false);
    assert.equal(r.drift, true);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('docs — régénération est idempotente (même source-hash)', silencer(async () => {
  const d = tmp();
  try {
    const r1 = await docs(d, {});
    const r2 = await docs(d, {});
    assert.equal(r1.hash, r2.hash);
    // Le contenu doit être strictement identique
    const content1 = readFileSync(r1.path, 'utf-8');
    await docs(d, {});
    const content2 = readFileSync(r1.path, 'utf-8');
    assert.equal(content1, content2);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('docs --out chemin/perso.md — écrit à l\'emplacement demandé', silencer(async () => {
  const d = tmp();
  try {
    await docs(d, { out: 'doc.md' });
    assert.ok(existsSync(join(d, 'doc.md')));
    assert.ok(!existsSync(join(d, 'DOCUMENTATION.md')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));
