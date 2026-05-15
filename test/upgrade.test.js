// Tests d'intégration de la commande `upgrade`. Vérifie que chaque module
// (rituals, metrics, gouvernance, all) ajoute strictement les bons fichiers
// au profil minimal sans casser les artefacts personnalisés.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { init } from '../lib/init.js';
import { upgrade } from '../lib/upgrade.js';

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
function projetTemp() { return mkdtempSync(join(tmpdir(), 'aiad-upgrade-')); }

test('upgrade rituals — ajoute le router /aiad et les sous-commandes rituels', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, { minimal: true });
    assert.ok(!existsSync(join(dir, '.claude', 'commands', 'aiad.md')));

    await upgrade(dir, 'rituals', {});

    assert.ok(existsSync(join(dir, '.claude', 'commands', 'aiad.md')));
    assert.ok(existsSync(join(dir, '.claude', 'commands', 'aiad-standup.md')));
    assert.ok(existsSync(join(dir, '.claude', 'commands', 'aiad-retro.md')));
    assert.ok(existsSync(join(dir, '.claude', 'aiad', 'standup.md')));
    // Skills déployées dès qu'on quitte le minimal
    assert.ok(existsSync(join(dir, '.claude', 'skills', 'human-authorship-check', 'SKILL.md')));
    assert.ok(existsSync(join(dir, '.claude', 'skills', 'sqs-scoring', 'SKILL.md')));
    // Template EARS optionnel
    assert.ok(existsSync(join(dir, '.aiad', 'specs', 'spec-ears-template.md')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('upgrade metrics — ajoute dashboard/dora/flow + commandes SDD étendues', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, { minimal: true });

    await upgrade(dir, 'metrics', {});

    assert.ok(existsSync(join(dir, '.claude', 'commands', 'aiad-dashboard.md')));
    assert.ok(existsSync(join(dir, '.claude', 'commands', 'aiad-dora.md')));
    assert.ok(existsSync(join(dir, '.claude', 'commands', 'aiad-flow.md')));
    assert.ok(existsSync(join(dir, '.claude', 'commands', 'sdd-fact.md')));
    assert.ok(existsSync(join(dir, '.claude', 'commands', 'sdd-security.md')));
    assert.ok(existsSync(join(dir, '.claude', 'commands', 'sdd-audit.md')));
    assert.ok(existsSync(join(dir, '.claude', 'commands', 'sdd-context.md')));
    // Dossiers metrics
    assert.ok(existsSync(join(dir, '.aiad', 'metrics', 'security')));
    assert.ok(existsSync(join(dir, '.aiad', 'metrics', 'audit')));
    assert.ok(existsSync(join(dir, '.aiad', 'metrics', 'traceability')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('upgrade gouvernance — ajoute les 4 agents Tier 1 sur profil minimal', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, { minimal: true });
    assert.ok(!existsSync(join(dir, '.aiad', 'gouvernance')));

    await upgrade(dir, 'gouvernance', {});

    for (const a of ['AIAD-AI-ACT', 'AIAD-RGPD', 'AIAD-RGAA', 'AIAD-RGESN']) {
      assert.ok(
        existsSync(join(dir, '.aiad', 'gouvernance', `${a}.md`)),
        `agent manquant : ${a}`,
      );
    }
    assert.ok(existsSync(join(dir, '.claude', 'commands', 'aiad-gouvernance.md')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('upgrade all — bascule profil minimal → profil complet', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, { minimal: true });

    await upgrade(dir, 'all', {});

    // Mix de toutes les catégories
    assert.ok(existsSync(join(dir, '.claude', 'commands', 'aiad.md')));
    assert.ok(existsSync(join(dir, '.claude', 'commands', 'sdd-exec.md')));
    assert.ok(existsSync(join(dir, '.claude', 'commands', 'aiad-dashboard.md')));
    assert.ok(existsSync(join(dir, '.aiad', 'gouvernance', 'AIAD-RGPD.md')));
    assert.ok(existsSync(join(dir, '.github', 'workflows', 'sdd-trace.yml')));
    // PRD/ARCHITECTURE/AGENT-GUIDE créés s'ils n'existaient pas
    assert.ok(existsSync(join(dir, '.aiad', 'PRD.md')));
    assert.ok(existsSync(join(dir, '.aiad', 'ARCHITECTURE.md')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('upgrade all — préserve un AGENT-GUIDE personnalisé existant', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, { minimal: true });
    writeFileSync(join(dir, '.aiad', 'AGENT-GUIDE.md'), '# Mon guide perso\n', 'utf-8');

    await upgrade(dir, 'all', {});

    assert.equal(
      readFileSync(join(dir, '.aiad', 'AGENT-GUIDE.md'), 'utf-8'),
      '# Mon guide perso\n',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('upgrade — module inconnu → exit code via process.exit (capturé)', silencerStdout(async () => {
  const dir = projetTemp();
  const origExit = process.exit;
  let captured = null;
  process.exit = (code) => { captured = code; throw new Error('process.exit called'); };
  try {
    await init(dir, { minimal: true });
    await assert.rejects(() => upgrade(dir, 'inexistant', {}), /process\.exit/);
    assert.equal(captured, 1);
  } finally {
    process.exit = origExit;
    rmSync(dir, { recursive: true, force: true });
  }
}));
