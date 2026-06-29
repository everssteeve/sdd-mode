// @intent INTENT-022
// @spec SPEC-022-2-campagne-annotation-progressive
// Test d'intégration de construireMatrice — projet fixture isolé,
// vérifie la matrice forward, backward et la détection de gaps.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { construireMatrice, detecterNouveauxFichiers } from '../lib/sdd-trace.js';

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

// SPEC-022-2 : codeSansSpec est désormais un objet {bloquant, non_bloquant, total, items}

test('construireMatrice — codeSansSpec est un objet enrichi (SPEC-022-2)', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, 'src', 'sans-annotation.ts'),
      `export function foo() {}\n`,
    );
    const m = construireMatrice(dir);
    const css = m.gaps.codeSansSpec;
    assert.ok(typeof css === 'object' && !Array.isArray(css), 'codeSansSpec doit être un objet, pas un tableau');
    assert.ok('bloquant' in css, 'codeSansSpec.bloquant doit exister');
    assert.ok('non_bloquant' in css, 'codeSansSpec.non_bloquant doit exister');
    assert.ok('total' in css, 'codeSansSpec.total doit exister');
    assert.ok(Array.isArray(css.items), 'codeSansSpec.items doit être un tableau');
    assert.equal(css.total, css.bloquant + css.non_bloquant, 'total = bloquant + non_bloquant');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('construireMatrice — fichier sans @spec a une propriété severity (SPEC-022-2)', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, 'src', 'module.ts'),
      `export const x = 1;\n`,
    );
    const m = construireMatrice(dir);
    const items = m.gaps.codeSansSpec.items;
    assert.ok(items.length > 0, 'au moins un fichier sans @spec attendu');
    for (const item of items) {
      assert.ok('severity' in item, `item ${item.path} doit avoir severity`);
      assert.ok(
        item.severity === 'bloquant' || item.severity === 'non-bloquant',
        `severity doit être 'bloquant' ou 'non-bloquant', reçu: ${item.severity}`,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('construireMatrice — sans git, tous les fichiers sans @spec sont non-bloquants (SPEC-022-2)', () => {
  // Le fixture est hors du dépôt git du projet, git diff retourne erreur → fail-open
  const dir = fixture();
  try {
    writeFileSync(join(dir, 'src', 'a.ts'), `export const a = 1;\n`);
    writeFileSync(join(dir, 'src', 'b.ts'), `export const b = 2;\n`);
    const m = construireMatrice(dir);
    assert.equal(m.gaps.codeSansSpec.bloquant, 0, 'hors git, aucun fichier ne doit être bloquant');
    assert.equal(m.gaps.codeSansSpec.non_bloquant, m.gaps.codeSansSpec.total,
      'tous les gaps sans @spec sont non-bloquants hors contexte git');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('construireMatrice — fichier avec @spec : absent de codeSansSpec (SPEC-022-2)', () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, 'src', 'annote.ts'),
      `/**\n * @spec SPEC-001-1-login\n */\nexport function login() {}\n`,
    );
    writeFileSync(
      join(dir, 'src', 'non-annote.ts'),
      `export const x = 1;\n`,
    );
    const m = construireMatrice(dir);
    const paths = m.gaps.codeSansSpec.items.map((f) => f.path);
    assert.ok(!paths.some((p) => p.endsWith('/annote.ts') || p === 'src/annote.ts'), 'annote.ts ne doit pas apparaître dans les gaps');
    assert.ok(paths.some((p) => p.endsWith('non-annote.ts')), 'non-annote.ts doit être dans les gaps');
    assert.equal(m.gaps.codeSansSpec.total, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Helpers git pour les tests CA-1 et CA-5 (dépôt git temporaire isolé)
function fixtureGit() {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-git-'));
  mkdirSync(join(dir, '.aiad', 'intents'), { recursive: true });
  mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
  mkdirSync(join(dir, 'lib'), { recursive: true });
  const g = (args) => spawnSync('git', args, { cwd: dir, encoding: 'utf-8', stdio: 'pipe' });
  g(['init']);
  g(['config', 'user.email', 'ci@aiad.test']);
  g(['config', 'user.name', 'AIAD CI']);
  // Commit initial pour que HEAD existe
  writeFileSync(join(dir, 'lib', 'existing.js'), '// @spec SPEC-001-1-existing\nexport const x = 1;\n');
  g(['add', '.']);
  g(['commit', '-m', 'init']);
  return dir;
}

// CA-1 — SPEC-022-2 : nouveau lib/*.js sans @spec → codeSansSpec.bloquant = 1
test('construireMatrice — CA-1 : nouveau fichier lib/ sans @spec = gap bloquant (SPEC-022-2)', () => {
  const dir = fixtureGit();
  try {
    writeFileSync(join(dir, 'lib', 'nouveau.js'), 'export function foo() {}\n');
    spawnSync('git', ['add', join('lib', 'nouveau.js')], { cwd: dir, encoding: 'utf-8', stdio: 'pipe' });
    const m = construireMatrice(dir);
    assert.equal(m.gaps.codeSansSpec.bloquant, 1, 'nouveau.js sans @spec doit être bloquant');
    assert.ok(
      m.gaps.codeSansSpec.items.some((f) => f.path === 'lib/nouveau.js' && f.severity === 'bloquant'),
      'lib/nouveau.js doit figurer dans les items avec severity bloquant',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// CA-5 — SPEC-022-2 : renommage lib/a.js → lib/b.js → detecterNouveauxFichiers n'inclut pas b.js
test('detecterNouveauxFichiers — CA-5 : renommage lib/*.js n\'est pas classé comme ajouté (SPEC-022-2)', () => {
  const dir = fixtureGit();
  try {
    spawnSync('git', ['mv', 'lib/existing.js', 'lib/renamed.js'], { cwd: dir, encoding: 'utf-8', stdio: 'pipe' });
    const nouveaux = detecterNouveauxFichiers('lib/', dir);
    assert.ok(!nouveaux.has('lib/renamed.js'), 'un fichier renommé ne doit pas apparaître comme nouveau (--diff-filter=A exclut les renames)');
    assert.equal(nouveaux.size, 0, 'aucun fichier ne doit être classé ajouté lors d\'un simple renommage');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
