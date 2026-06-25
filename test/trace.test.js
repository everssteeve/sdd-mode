// Test d'intégration de construireMatrice — projet fixture isolé,
// vérifie la matrice forward, backward et la détection de gaps.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { construireMatrice } from '../lib/sdd-trace.js';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-trace-'));
  mkdirSync(join(dir, '.aiad', 'intents'), { recursive: true });
  mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
  mkdirSync(join(dir, 'src'), { recursive: true });
  mkdirSync(join(dir, 'tests'), { recursive: true });
  return dir;
}

test('construireMatrice — Intent → SPEC → Code → Test heureux', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'intents', 'INTENT-001.md'),
      `# Authentifier les utilisateurs\n\nstatus: active\n`,
    );
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-001-1-login.md'),
      `# Login flow\n\n**Intent parent** : INTENT-001\nstatut: ready\n`,
    );
    writeFileSync(
      join(dir, 'src', 'login.ts'),
      `/**\n * @spec SPEC-001-1-login\n */\nexport function login() {}\n`,
    );
    writeFileSync(
      join(dir, 'tests', 'login.test.ts'),
      `// @spec SPEC-001-1-login\nimport { test } from 'node:test';\n`,
    );

    const m = construireMatrice(dir);
    assert.equal(m.summary.intents, 1);
    assert.equal(m.summary.specs, 1);
    assert.equal(m.forward.length, 1);
    assert.equal(m.forward[0].specs.length, 1);
    assert.equal(m.forward[0].specs[0].code.length, 1);
    assert.equal(m.forward[0].specs[0].tests.length, 1);
    assert.equal(m.gaps.intentsSansSpec.length, 0);
    assert.equal(m.gaps.specsSansCode.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('construireMatrice — détection SPEC orpheline référencée dans le code', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, 'src', 'rogue.ts'),
      `// @spec SPEC-999-1-fantome\nexport const x = 1;\n`,
    );
    const m = construireMatrice(dir);
    assert.equal(m.gaps.specsOrphelinsSurCode.length, 1);
    assert.equal(m.gaps.specsOrphelinsSurCode[0].id, 'SPEC-999-1-fantome');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('construireMatrice — Intent sans SPEC = orphelin', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'intents', 'INTENT-007.md'),
      `# Une intention seule\n\nstatus: active\n`,
    );
    const m = construireMatrice(dir);
    assert.equal(m.gaps.intentsSansSpec.length, 1);
    assert.equal(m.gaps.intentsSansSpec[0].id, 'INTENT-007');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// @spec SPEC-031-1-hook-stop-ready-fix — CA-1 : ready pré-exec n'est pas un gap bloquant
test('construireMatrice — SPEC ready sans code = pré-exec normal, non bloquant', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'intents', 'INTENT-002.md'),
      `# Intent\n\nstatus: active\n`,
    );
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-002-1-vide.md'),
      `# Spec sans code\n\n**Intent parent** : INTENT-002\nstatut: ready\n`,
    );
    const m = construireMatrice(dir);
    assert.equal(m.gaps.specsValideesNonImplementees.length, 0, 'ready ne génère pas de gap bloquant (SPEC-031-1)');
    assert.equal(m.gaps.specsSansCode.length, 1, 'mais reste visible via specsSansCode');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// @spec SPEC-031-1-hook-stop-ready-fix — CA-2 : validation sans code reste bloquant
test('construireMatrice — SPEC validation sans code = gap bloquant', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'intents', 'INTENT-002.md'),
      `# Intent\n\nstatus: active\n`,
    );
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-002-1-vide.md'),
      `# Spec sans code\n\n**Intent parent** : INTENT-002\nstatut: validation\n`,
    );
    const m = construireMatrice(dir);
    assert.equal(m.gaps.specsValideesNonImplementees.length, 1, 'validation sans code = gap bloquant');
    assert.equal(m.gaps.specsValideesNonImplementees[0].id, 'SPEC-002-1-vide');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('construireMatrice — SPEC in-progress sans code = WIP non bloquant', () => {
  // Régression : une SPEC en cours d'implémentation est un WIP assumé, pas un
  // drift bloquant. Elle reste visible (non bloquante) via `specsSansCode`.
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'intents', 'INTENT-005.md'),
      `# Intent\n\nstatus: active\n`,
    );
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-005-1-wip.md'),
      `# Spec en cours\n\n**Intent parent** : INTENT-005\nstatut: in-progress\n`,
    );
    const m = construireMatrice(dir);
    assert.equal(m.gaps.specsValideesNonImplementees.length, 0, 'in-progress ne bloque pas');
    assert.equal(m.gaps.specsSansCode.length, 1, 'mais reste visible (non bloquant)');
    assert.equal(m.gaps.specsSansCode[0].id, 'SPEC-005-1-wip');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('construireMatrice — fichier test sans @spec = non-tracé en backward', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, 'tests', 'orphelin.test.ts'),
      `// pas d'annotation\nimport { test } from 'node:test';\n`,
    );
    const m = construireMatrice(dir);
    const nonTraces = m.backward.filter((b) => !b.spec);
    assert.equal(nonTraces.length, 1);
    assert.equal(nonTraces[0].test.path, 'tests/orphelin.test.ts');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ─── Exemption de traçabilité (SPEC-024-1 / FACT-004) ────────────────────────

// CA-001 — exemption valide : exclue du gap specsValideesNonImplementees.
test('construireMatrice — SPEC done exemptée (raison non vide) hors du gap', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-013-1a-site.md'),
      `---\nstatus: done\ntraceability: exempt\ntraceability_reason: "Livrable documentaire (site/), aucun fichier scanné"\n---\n# Déploiement site\n`,
    );
    const m = construireMatrice(dir);
    assert.equal(m.gaps.specsValideesNonImplementees.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CA-002 — exemption sans raison : inerte, le gap est maintenu (fail-honest).
test('construireMatrice — SPEC exempt sans raison reste un gap', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-013-1a-site.md'),
      `---\nstatus: done\ntraceability: exempt\ntraceability_reason: ""\n---\n# Déploiement site\n`,
    );
    const m = construireMatrice(dir);
    assert.equal(m.gaps.specsValideesNonImplementees.length, 1);
    assert.equal(m.gaps.specsValideesNonImplementees[0].id, 'SPEC-013-1a-site');
    assert.equal(m.specsExemptees.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CA-003 — rétro-compatibilité : SPEC done sans champ et sans code = gap.
test('construireMatrice — SPEC done sans exemption ni code reste un gap', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-001-1-login.md'),
      `---\nstatus: done\n---\n# Login\n`,
    );
    const m = construireMatrice(dir);
    assert.equal(m.gaps.specsValideesNonImplementees.length, 1);
    assert.equal(m.gaps.specsValideesNonImplementees[0].id, 'SPEC-001-1-login');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CA-004 — visibilité : la SPEC exemptée figure dans specsExemptees.
test('construireMatrice — SPEC exemptée exposée dans specsExemptees', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-013-2-docs.md'),
      `---\nstatus: done\ntraceability: exempt\ntraceability_reason: "Docs racine, pas de code applicatif"\n---\n# Unification docs\n`,
    );
    const m = construireMatrice(dir);
    assert.equal(m.specsExemptees.length, 1);
    assert.equal(m.specsExemptees[0].id, 'SPEC-013-2-docs');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CA-005 — isolation : les autres gaps sont inchangés pour une SPEC exemptée
// (elle reste visible dans specsSansCode, informatif et non bloquant).
test('construireMatrice — exemption n’affecte que specsValideesNonImplementees', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, '.aiad', 'specs', 'SPEC-013-1a-site.md'),
      `---\nstatus: done\ntraceability: exempt\ntraceability_reason: "Contenu de site, aucun fichier scanné"\n---\n# Déploiement site\n`,
    );
    const m = construireMatrice(dir);
    assert.equal(m.gaps.specsValideesNonImplementees.length, 0);
    // specsSansCode (informatif) garde la SPEC : l'exemption ne le touche pas.
    assert.equal(m.gaps.specsSansCode.length, 1);
    assert.equal(m.gaps.specsSansCode[0].id, 'SPEC-013-1a-site');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CA-009 — SPEC-026-1-archive-done : lireIntents/lireSpecs excluent archive/
test('construireMatrice — CA-009 exclut les artefacts dans archive/', () => {
  const dir = fixture();
  try {
    mkdirSync(join(dir, '.aiad', 'intents', 'archive'), { recursive: true });
    mkdirSync(join(dir, '.aiad', 'specs', 'archive'), { recursive: true });
    writeFileSync(
      join(dir, '.aiad', 'intents', 'archive', 'INTENT-OLD.md'),
      '---\nstatus: archived\n---\n# Old intent\n',
    );
    writeFileSync(
      join(dir, '.aiad', 'specs', 'archive', 'SPEC-OLD-1-x.md'),
      '---\nstatus: archived\n---\n# Old spec\n',
    );
    writeFileSync(
      join(dir, '.aiad', 'intents', 'INTENT-001.md'),
      '---\nstatus: active\n---\n# Active intent\n',
    );
    const m = construireMatrice(dir);
    assert.equal(m.summary.intents, 1, 'seul 1 intent actif attendu (archive/ ignoré)');
    assert.equal(m.summary.specs, 0, 'zéro spec active attendue (archive/ ignoré)');
    const allIntentIds = m.forward.map((e) => e.id);
    assert.ok(!allIntentIds.includes('INTENT-OLD'), 'INTENT-OLD dans archive/ ne doit pas apparaître');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
