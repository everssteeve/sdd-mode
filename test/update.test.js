// Tests d'intégration de la commande `update`. Vérifie le contrat clé :
//   - les commandes Claude Code sont toujours synchronisées
//   - PRD / ARCHITECTURE / AGENT-GUIDE / CLAUDE.md ne sont jamais écrasés
//   - les nouveaux dossiers (facts/, metrics/) sont créés idempotamment

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { init } from '../lib/init.js';
import { update } from '../lib/update.js';

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
function projetTemp() { return mkdtempSync(join(tmpdir(), 'aiad-update-')); }

test('update — préserve PRD/ARCHITECTURE/AGENT-GUIDE personnalisés', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, {});

    // Personnaliser les 3 fichiers structurels (sentinelles supprimées)
    writeFileSync(join(dir, '.aiad', 'PRD.md'), '# Mon PRD\n\nPersonnalisé.\n', 'utf-8');
    writeFileSync(join(dir, '.aiad', 'ARCHITECTURE.md'), '# Mon archi\n', 'utf-8');
    writeFileSync(join(dir, '.aiad', 'AGENT-GUIDE.md'), '# Mon guide\n', 'utf-8');

    await update(dir, {});

    assert.equal(readFileSync(join(dir, '.aiad', 'PRD.md'), 'utf-8'), '# Mon PRD\n\nPersonnalisé.\n');
    assert.equal(readFileSync(join(dir, '.aiad', 'ARCHITECTURE.md'), 'utf-8'), '# Mon archi\n');
    assert.equal(readFileSync(join(dir, '.aiad', 'AGENT-GUIDE.md'), 'utf-8'), '# Mon guide\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('update — préserve CLAUDE.md utilisateur (section SDD déjà présente)', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, {});
    const avant = readFileSync(join(dir, 'CLAUDE.md'), 'utf-8');
    // Personnaliser
    writeFileSync(join(dir, 'CLAUDE.md'), avant + '\n\n# Section perso\n', 'utf-8');

    await update(dir, {});

    const apres = readFileSync(join(dir, 'CLAUDE.md'), 'utf-8');
    assert.ok(apres.includes('# Section perso'), 'modification utilisateur écrasée par update');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('update — crée les nouveaux dossiers metrics/ + facts/ si absents', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, {});
    rmSync(join(dir, '.aiad', 'facts'), { recursive: true, force: true });
    rmSync(join(dir, '.aiad', 'metrics'), { recursive: true, force: true });

    await update(dir, {});

    assert.ok(existsSync(join(dir, '.aiad', 'facts')));
    assert.ok(existsSync(join(dir, '.aiad', 'metrics', 'security')));
    assert.ok(existsSync(join(dir, '.aiad', 'metrics', 'audit')));
    assert.ok(existsSync(join(dir, '.aiad', 'metrics', 'traceability')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('update --sans-gouvernance — ne touche pas la gouvernance', silencerStdout(async () => {
  const dir = projetTemp();
  try {
    await init(dir, {});
    const rgpdAvant = readFileSync(join(dir, '.aiad', 'gouvernance', 'AIAD-RGPD.md'), 'utf-8');
    // Modifier RGPD localement
    writeFileSync(join(dir, '.aiad', 'gouvernance', 'AIAD-RGPD.md'), rgpdAvant + '\n<!-- patch local -->\n', 'utf-8');

    await update(dir, { sansGouvernance: true });

    const rgpdApres = readFileSync(join(dir, '.aiad', 'gouvernance', 'AIAD-RGPD.md'), 'utf-8');
    assert.ok(rgpdApres.includes('<!-- patch local -->'), 'patch local effacé malgré --sans-gouvernance');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));
