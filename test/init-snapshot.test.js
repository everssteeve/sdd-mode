// Snapshot test — fige la liste des fichiers livrés par `init` complet et
// `init --minimal`. Détecte toute régression de scope (commande retirée par
// erreur, agent oublié, workflow CI manquant) en comparant à une référence.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { init } from '../lib/init.js';

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
function listerFichiers(racine, dir = racine) {
  const out = [];
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    const st = statSync(chemin);
    if (st.isDirectory()) out.push(...listerFichiers(racine, chemin));
    else out.push(relative(racine, chemin));
  }
  return out.sort();
}

test('init --minimal — snapshot strict de l\'arbo livrée', silencerStdout(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-snap-min-'));
  try {
    await init(dir, { minimal: true });
    const fichiers = listerFichiers(dir);

    // Les chemins critiques doivent tous être présents (set inclusion).
    const attendus = [
      '.aiad/AGENT-GUIDE.md',
      '.aiad/intents/_index.md',
      '.aiad/specs/_index.md',
      '.claude/commands/sdd-intent.md',
      '.claude/commands/sdd-spec.md',
      '.claude/commands/sdd-gate.md',
      '.claude/commands/sdd-drift-check.md',
      'CLAUDE.md',
    ];
    for (const f of attendus) {
      assert.ok(fichiers.includes(f), `manquant dans le profil minimal : ${f}`);
    }

    // Le profil minimal NE livre PAS ces fichiers.
    const interdits = [
      '.aiad/PRD.md',
      '.aiad/ARCHITECTURE.md',
      '.aiad/gouvernance/AIAD-RGPD.md',
      'AGENTS.md',
      '.github/workflows/sdd-trace.yml',
    ];
    for (const f of interdits) {
      assert.ok(!fichiers.includes(f), `inattendu dans le profil minimal : ${f}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('init complet — snapshot strict des familles de fichiers', silencerStdout(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-snap-full-'));
  try {
    await init(dir, {});
    const fichiers = listerFichiers(dir);

    // Familles obligatoires
    const familles = {
      'fondamentaux': ['.aiad/PRD.md', '.aiad/ARCHITECTURE.md', '.aiad/AGENT-GUIDE.md'],
      'gouvernance': [
        '.aiad/gouvernance/AIAD-AI-ACT.md',
        '.aiad/gouvernance/AIAD-RGPD.md',
        '.aiad/gouvernance/AIAD-RGAA.md',
        '.aiad/gouvernance/AIAD-RGESN.md',
        '.aiad/gouvernance/_index.md',
      ],
      'commands SDD': [
        '.claude/commands/sdd.md',
        '.claude/commands/sdd-intent.md',
        '.claude/commands/sdd-spec.md',
        '.claude/commands/sdd-gate.md',
        '.claude/commands/sdd-exec.md',
        '.claude/commands/sdd-validate.md',
        '.claude/commands/sdd-drift-check.md',
        '.claude/commands/sdd-trace.md',
        '.claude/commands/sdd-split.md',
        '.claude/commands/sdd-resume.md',
        '.claude/commands/sdd-context.md',
        '.claude/commands/sdd-fact.md',
        '.claude/commands/sdd-security.md',
        '.claude/commands/sdd-audit.md',
      ],
      'commands AIAD': [
        '.claude/commands/aiad.md',
        '.claude/commands/aiad-help.md',
        '.claude/commands/aiad-status.md',
        '.claude/commands/aiad-dashboard.md',
        '.claude/commands/aiad-emit-rules.md',
      ],
      'skills': [
        '.claude/skills/human-authorship-check/SKILL.md',
        '.claude/skills/sqs-scoring/SKILL.md',
        '.claude/skills/drift-detection/SKILL.md',
        '.claude/skills/regulatory-veto/SKILL.md',
        '.claude/skills/context-budget/SKILL.md',
        '.claude/skills/ears-validator/SKILL.md',
        '.claude/skills/traceability/SKILL.md',
      ],
      'CI workflows': [
        '.github/workflows/sdd-trace.yml',
        '.github/workflows/aiad-emit-rules-check.yml',
      ],
      'multi-runtime': ['AGENTS.md', 'CLAUDE.md'],
    };

    for (const [famille, attendus] of Object.entries(familles)) {
      for (const f of attendus) {
        assert.ok(fichiers.includes(f), `[${famille}] manquant : ${f}`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));
