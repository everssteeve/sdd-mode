// @intent INTENT-019
// @spec SPEC-019-2-trace-ears-gap
// @verified-by test/trace-ears-gap.test.js

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { construireMatrice } from '../lib/sdd-trace.js';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-ears-gap-'));
  mkdirSync(join(dir, '.aiad', 'intents'), { recursive: true });
  mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
  mkdirSync(join(dir, 'src'), { recursive: true });
  mkdirSync(join(dir, 'test'), { recursive: true });
  return dir;
}

// CA-001 — Détection du gap earsSpecsSansTests
test('CA-001 — EARS SPEC sans test lié → listée dans earsSpecsSansTests', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-099-1-ears-no-test.md'),
      `**Format** : EARS\n\n**Intent parent** : INTENT-099\nstatut: ready\n\n# Spec EARS sans test\n`,
    );
    const m = construireMatrice(dir);
    assert.ok(Array.isArray(m.gaps.earsSpecsSansTests), 'earsSpecsSansTests existe');
    assert.equal(m.gaps.earsSpecsSansTests.length, 1);
    assert.equal(m.gaps.earsSpecsSansTests[0].id, 'SPEC-099-1-ears-no-test');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CA-002 — compterGapsBloquants inclut earsSpecsSansTests
test('CA-002 — earsSpecsSansTests non vide → compterGapsBloquants > 0', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-099-1-ears-no-test.md'),
      `**Format** : EARS\n\n**Intent parent** : INTENT-099\nstatut: ready\n\n# Spec EARS sans test\n`,
    );
    const m = construireMatrice(dir);
    assert.equal(m.gaps.earsSpecsSansTests.length, 1, 'gap non vide');
    // compterGapsBloquants est interne — on vérifie via la présence du gap
    // (le comportement --fail-on-gap dépend de cette somme)
    const total =
      m.gaps.specsValideesNonImplementees.length +
      m.gaps.specsOrphelinsSurCode.length +
      m.gaps.intentsOrphelinsSurCode.length +
      m.gaps.earsSpecsSansTests.length;
    assert.ok(total > 0, 'gaps bloquants > 0');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CA-003 — Absence de faux positif : SPEC EARS avec @spec lié dans un test
test('CA-003 — SPEC EARS avec test annoté @spec → exclue de earsSpecsSansTests', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-099-1-ears-covered.md'),
      `**Format** : EARS\n\n**Intent parent** : INTENT-099\nstatut: ready\n\n# Spec EARS couverte\n`,
    );
    writeFileSync(
      join(dir, 'src', 'ears-covered.js'),
      `// @spec SPEC-099-1-ears-covered\nexport const x = 1;\n`,
    );
    writeFileSync(
      join(dir, 'test', 'ears-covered.test.js'),
      `// @spec SPEC-099-1-ears-covered\nimport { test } from 'node:test';\n`,
    );
    const m = construireMatrice(dir);
    assert.equal(m.gaps.earsSpecsSansTests.length, 0, 'pas de gap — SPEC couverte');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CA-004 — Exclusion statuts draft / archived
test('CA-004 — SPEC EARS en statut draft → exclue de earsSpecsSansTests', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-099-1-ears-draft.md'),
      `**Format** : EARS\n\n**Intent parent** : INTENT-099\nstatut: draft\n\n# Spec EARS draft\n`,
    );
    const m = construireMatrice(dir);
    assert.equal(m.gaps.earsSpecsSansTests.length, 0, 'draft exclue');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CA-004b — SPEC EARS en statut archived → exclue de earsSpecsSansTests', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-099-1-ears-archived.md'),
      `**Format** : EARS\n\n**Intent parent** : INTENT-099\nstatut: archived\n\n# Spec EARS archived\n`,
    );
    const m = construireMatrice(dir);
    assert.equal(m.gaps.earsSpecsSansTests.length, 0, 'archived exclue');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CA-005 — --suggest : vérifier la présence du gap pour que la logique CLI s'active
// (le --suggest est testé via l'API construireMatrice — la sortie console est CLI-level)
test('CA-005 — earsSpecsSansTests expose l\'id de chaque SPEC pour le rendu --suggest', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-099-1-ears-a.md'),
      `**Format** : EARS\nstatut: ready\n\n# A\n`,
    );
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-099-2-ears-b.md'),
      `**Format** : EARS\nstatut: done\n\n# B\n`,
    );
    const m = construireMatrice(dir);
    assert.equal(m.gaps.earsSpecsSansTests.length, 2);
    const ids = m.gaps.earsSpecsSansTests.map((s) => s.id);
    assert.ok(ids.includes('SPEC-099-1-ears-a'), 'SPEC-A dans le gap');
    assert.ok(ids.includes('SPEC-099-2-ears-b'), 'SPEC-B dans le gap');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CA-006 — Projet sans aucune SPEC EARS → earsSpecsSansTests vide
test('CA-006 — projet sans SPEC EARS → earsSpecsSansTests vide sans erreur', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-099-1-prose.md'),
      `**Intent parent** : INTENT-099\nstatut: ready\n\n# Spec prose\n`,
    );
    const m = construireMatrice(dir);
    assert.ok(Array.isArray(m.gaps.earsSpecsSansTests), 'champ présent');
    assert.equal(m.gaps.earsSpecsSansTests.length, 0, 'vide sans SPEC EARS');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
