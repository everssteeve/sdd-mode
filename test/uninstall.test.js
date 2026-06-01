// Tests `aiad-sdd uninstall` — préservation des artefacts métier, mode
// aperçu par défaut, désinstallation framework + purge complète.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { init } from '../lib/init.js';
import { uninstall, planifier } from '../lib/uninstall.js';

function silencer(fn) {
  return async (...args) => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { process.stdout.write = orig; }
  };
}

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-uninst-')); }

test('uninstall — sans flag = mode aperçu, aucun fichier supprimé', silencer(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    const r = await uninstall(dir, {});
    assert.equal(r.appliquees, 0);
    assert.ok(r.actions.length > 0);
    // Tout est encore là
    assert.ok(existsSync(join(dir, 'AGENTS.md')));
    assert.ok(existsSync(join(dir, '.claude', 'commands', 'sdd.md')));
    assert.ok(existsSync(join(dir, '.aiad', 'gouvernance', 'AIAD-RGPD.md')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('uninstall --force — retire le framework, préserve les artefacts métier', silencer(async () => {
  const dir = tmp();
  try {
    await init(dir, {});

    // L'utilisateur a écrit un Intent
    writeFileSync(join(dir, '.aiad', 'intents', 'INTENT-001.md'),
      '# Mon intent\n\nstatus: active\n', 'utf-8');
    writeFileSync(join(dir, '.aiad', 'PRD.md'), '# Mon PRD perso\n', 'utf-8');

    const r = await uninstall(dir, { force: true });
    assert.ok(r.appliquees >= 1);

    // Framework retiré
    assert.ok(!existsSync(join(dir, 'AGENTS.md')), 'AGENTS.md non retiré');
    assert.ok(!existsSync(join(dir, '.claude', 'commands', 'sdd.md')), 'sdd.md non retiré');
    assert.ok(!existsSync(join(dir, '.claude', 'sdd')), '.claude/sdd/ non retiré');
    assert.ok(!existsSync(join(dir, '.claude', 'aiad')), '.claude/aiad/ non retiré');
    assert.ok(!existsSync(join(dir, '.claude', 'skills', 'sqs-scoring')), 'skills non retirées');
    assert.ok(!existsSync(join(dir, '.github', 'workflows', 'sdd-trace.yml')), 'workflow non retiré');

    // Artefacts métier préservés
    assert.ok(existsSync(join(dir, '.aiad', 'intents', 'INTENT-001.md')), 'Intent utilisateur supprimé');
    assert.ok(existsSync(join(dir, '.aiad', 'PRD.md')), 'PRD utilisateur supprimé');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('uninstall --force — nettoie le header CLAUDE.md sans toucher au reste', silencer(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    // Ajouter une section utilisateur après le contenu SDD
    const claudeMd = join(dir, 'CLAUDE.md');
    const avant = readFileSync(claudeMd, 'utf-8');
    writeFileSync(claudeMd, '# Mes règles à moi\n\nimportant.\n\n' + avant, 'utf-8');

    await uninstall(dir, { force: true });

    const apres = readFileSync(claudeMd, 'utf-8');
    assert.ok(apres.includes('# Mes règles à moi'), 'section utilisateur effacée');
    assert.ok(!apres.includes('aiad-emit-rules:start'), 'header AIAD encore présent');
    assert.ok(!apres.includes('# SDD Mode'), 'section SDD Mode encore présente');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('uninstall --purge --force — supprime aussi .aiad/', silencer(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    writeFileSync(join(dir, '.aiad', 'intents', 'INTENT-001.md'), '# X\n', 'utf-8');

    await uninstall(dir, { force: true, purge: true });

    assert.ok(!existsSync(join(dir, '.aiad')), '.aiad/ non supprimé en --purge');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('uninstall — projet vierge → "rien à supprimer"', silencer(async () => {
  const dir = tmp();
  try {
    const r = await uninstall(dir, { force: true });
    assert.equal(r.actions.length, 0);
    assert.equal(r.appliquees, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('planifier — détecte le wrapper hook AIAD mais pas un hook utilisateur', () => {
  const dir = tmp();
  try {
    // Créer un faux hook utilisateur (sans marqueur AIAD) puis un wrapper AIAD
    mkdirSync(join(dir, '.git', 'hooks'), { recursive: true });
    writeFileSync(join(dir, '.git', 'hooks', 'pre-commit'),
      '#!/bin/sh\necho "user hook"\n', 'utf-8');

    const actions1 = planifier(dir, {});
    // Le hook utilisateur ne doit PAS apparaître dans les actions
    assert.ok(!actions1.some((a) => a.path.endsWith('.git/hooks/pre-commit')));

    // Maintenant on remplace par un wrapper AIAD
    writeFileSync(join(dir, '.git', 'hooks', 'pre-commit'),
      '#!/bin/sh\n# AIAD SDD Mode\nexec true\n', 'utf-8');

    const actions2 = planifier(dir, {});
    assert.ok(actions2.some((a) => a.path.endsWith('.git/hooks/pre-commit')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('uninstall --force — préserve un .cursor/rules/perso.mdc utilisateur', silencer(async () => {
  const dir = tmp();
  try {
    await init(dir, { runtimes: ['cursor'] });
    // Règle Cursor utilisateur
    writeFileSync(join(dir, '.cursor', 'rules', 'perso.mdc'), '# Règle perso\n', 'utf-8');

    await uninstall(dir, { force: true });

    assert.ok(existsSync(join(dir, '.cursor', 'rules', 'perso.mdc')),
      'règle Cursor utilisateur supprimée à tort');
    assert.ok(!existsSync(join(dir, '.cursor', 'rules', 'aiad.mdc')),
      'règle AIAD non supprimée');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));
