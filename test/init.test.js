// Tests d'intégration init — sur projet temporaire isolé.
// Vérifie que `init --minimal` et `init` complets produisent l'arbo attendue
// sans toucher au repo réel et de manière idempotente.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { init } from '../lib/init.js';

// Silence stdout pendant les tests (init log beaucoup pour l'utilisateur).
// (#222) Mock console.log/error/warn au lieu de process.stdout.write —
// préserve le canal de communication du test runner en mode
// `--test-isolation=process` (le runner publie ses résultats TAP/JSON sur
// stdout). Le code applicatif (term.js, console.log) passe par console.*,
// donc on intercepte la couche au-dessus.
function silencerStdout(fn) {
  return async (...args) => {
    const origLog = console.log;
    const origErr = console.error;
    const origWarn = console.warn;
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
    try { return await fn(...args); }
    finally {
      console.log = origLog;
      console.error = origErr;
      console.warn = origWarn;
    }
  };
}
function projetTemp() {
  return mkdtempSync(join(tmpdir(), 'aiad-init-'));
}

test('init --minimal — produit l\'arbo lean attendue', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, { minimal: true });

    assert.ok(existsSync(join(dir, '.aiad', 'intents', '_index.md')));
    assert.ok(existsSync(join(dir, '.aiad', 'specs', '_index.md')));
    assert.ok(existsSync(join(dir, '.aiad', 'AGENT-GUIDE.md')));
    assert.ok(existsSync(join(dir, 'CLAUDE.md')));

    // 4 commandes essentielles uniquement
    const cmds = ['sdd-intent', 'sdd-spec', 'sdd-gate', 'sdd-drift-check'];
    for (const c of cmds) {
      assert.ok(
        existsSync(join(dir, '.claude', 'commands', `${c}.md`)),
        `commande manquante : ${c}`,
      );
    }

    // Le profil minimal n'installe PAS la gouvernance
    assert.ok(!existsSync(join(dir, '.aiad', 'gouvernance')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('init complet — installe gouvernance, skills, github actions', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, {});

    // Fondamentaux
    assert.ok(existsSync(join(dir, '.aiad', 'PRD.md')));
    assert.ok(existsSync(join(dir, '.aiad', 'ARCHITECTURE.md')));
    assert.ok(existsSync(join(dir, '.aiad', 'AGENT-GUIDE.md')));
    assert.ok(existsSync(join(dir, 'CLAUDE.md')));

    // Gouvernance Tier 1 — 4 agents
    for (const a of ['AIAD-AI-ACT', 'AIAD-RGPD', 'AIAD-RGAA', 'AIAD-RGESN']) {
      assert.ok(
        existsSync(join(dir, '.aiad', 'gouvernance', `${a}.md`)),
        `agent manquant : ${a}`,
      );
    }

    // GitHub Actions
    assert.ok(existsSync(join(dir, '.github', 'workflows', 'sdd-trace.yml')));
    assert.ok(existsSync(join(dir, '.github', 'workflows', 'aiad-emit-rules-check.yml')));

    // AGENTS.md généré par emit-rules au passage
    assert.ok(existsSync(join(dir, 'AGENTS.md')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('init complet — idempotent : second appel sans --force préserve les fichiers', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, {});
    const claudeAvant = readFileSync(join(dir, 'CLAUDE.md'), 'utf-8');

    // Modifier CLAUDE.md comme le ferait l'utilisateur
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(dir, 'CLAUDE.md'), claudeAvant + '\n# Ma section perso\n', 'utf-8');

    await init(dir, {});
    const claudeApres = readFileSync(join(dir, 'CLAUDE.md'), 'utf-8');
    assert.ok(claudeApres.includes('# Ma section perso'), 'modification utilisateur écrasée');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('init --sans-gouvernance — n\'installe pas les agents Tier 1', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, { sansGouvernance: true });
    assert.ok(!existsSync(join(dir, '.aiad', 'gouvernance', 'AIAD-RGPD.md')));
    assert.ok(existsSync(join(dir, '.aiad', 'AGENT-GUIDE.md')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));
