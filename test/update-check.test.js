// Tests `aiad-sdd update --check` — surface CI pour bloquer toute PR sur un
// projet dont les commandes / la gouvernance ont divergé du package installé.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { init } from '../lib/init.js';
import { update } from '../lib/update.js';

function silencer(fn) {
  return async (...args) => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { process.stdout.write = orig; }
  };
}

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-update-check-')); }

test('update --check — projet fraîchement init → 0 drift', silencer(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    const stats = await update(dir, { check: true });
    assert.equal(stats.drifts.length, 0, `drifts inattendus : ${stats.drifts.join(', ')}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('update --check — détecte une commande slash modifiée localement', silencer(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    // Patcher localement sdd-spec.md
    const path = join(dir, '.claude', 'commands', 'sdd.md');
    writeFileSync(path, readFileSync(path, 'utf-8') + '\n<!-- patch local -->\n', 'utf-8');

    const stats = await update(dir, { check: true });
    assert.ok(stats.drifts.length >= 1);
    assert.ok(stats.drifts.some((d) => d.endsWith('commands/sdd.md')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('update --check — détecte une commande slash manquante', silencer(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    rmSync(join(dir, '.claude', 'commands', 'aiad.md'), { force: true });

    const stats = await update(dir, { check: true });
    assert.ok(stats.drifts.some((d) => d.includes('aiad.md')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('update --check — détecte une gouvernance modifiée', silencer(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    const path = join(dir, '.aiad', 'gouvernance', 'AIAD-RGPD.md');
    writeFileSync(path, '# RGPD modifié localement\n', 'utf-8');

    const stats = await update(dir, { check: true });
    assert.ok(stats.drifts.some((d) => d.includes('AIAD-RGPD.md')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('update --check --sans-gouvernance — ignore la gouvernance', silencer(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    // Modifier la gouvernance localement
    writeFileSync(join(dir, '.aiad', 'gouvernance', 'AIAD-RGPD.md'), '# Patch\n', 'utf-8');

    const stats = await update(dir, { check: true, sansGouvernance: true });
    // Aucun drift attribué à AIAD-*
    assert.ok(!stats.drifts.some((d) => d.includes('AIAD-RGPD')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('update --check — n\'écrit rien sur disque (zero side-effect)', silencer(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    // Drift artificiel
    const path = join(dir, '.claude', 'commands', 'sdd.md');
    const original = readFileSync(path, 'utf-8') + '\n# patch\n';
    writeFileSync(path, original, 'utf-8');

    await update(dir, { check: true });

    // Le contenu local doit être strictement préservé
    assert.equal(readFileSync(path, 'utf-8'), original, 'fichier modifié par --check');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('update — retire les alias plats v1.x et signale le drift en --check (SPEC-036-2)', silencer(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    const alias = join(dir, '.claude', 'commands', 'sdd-spec.md');
    writeFileSync(alias, '---\nname: sdd-spec\ndescription: alias rétro-compatible → /sdd spec\n---\n', 'utf-8');
    const maison = join(dir, '.claude', 'commands', 'sdd-maison.md');
    writeFileSync(maison, '---\nname: sdd-maison\ndescription: commande du projet\n---\n', 'utf-8');

    const check = await update(dir, { check: true });
    assert.ok(check.drifts.includes('.claude/commands/sdd-spec.md'));
    assert.ok(existsSync(alias), '--check ne supprime rien');

    const stats = await update(dir, {});
    assert.equal(stats.removed, 1);
    assert.ok(!existsSync(alias));
    assert.ok(existsSync(maison), 'commande du projet préservée');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));
