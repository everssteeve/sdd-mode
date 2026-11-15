// Tests du retrait des alias plats (v2.0).
//
// @spec SPEC-036-2-retrait-alias-plats

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerAliasPlats, retirerAliasPlats, MARQUEUR_ALIAS, COMMANDES_CONSERVEES } from '../lib/alias-retirement.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALIAS = `---\nname: sdd-spec\ndescription: ${MARQUEUR_ALIAS} → /sdd spec (déprécié, retiré en v2)\n---\n`;

function projet(fichiers) {
  const d = mkdtempSync(join(tmpdir(), 'aiad-alias-'));
  for (const [rel, contenu] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(d, rel)), { recursive: true });
    writeFileSync(join(d, rel), contenu);
  }
  return d;
}

describe('alias-retirement', () => {
  test('CA-001 — le package ne livre plus que les routers et l\'aide', () => {
    for (const base of ['templates/.claude/commands', '.claude/commands']) {
      assert.deepEqual(readdirSync(join(ROOT, base)).sort(), [...COMMANDES_CONSERVEES].sort());
    }
  });

  test('CA-002 — un alias livré (marqueur) est retiré ; routers et aide conservés', () => {
    const d = projet({
      '.claude/commands/sdd-spec.md': ALIAS,
      '.claude/commands/aiad-status.md': ALIAS.replace('sdd-spec', 'aiad-status'),
      '.claude/commands/sdd.md': 'router',
      '.claude/commands/aiad.md': 'router',
      '.claude/commands/aiad-help.md': 'aide',
    });
    try {
      assert.deepEqual(retirerAliasPlats(d), ['.claude/commands/aiad-status.md', '.claude/commands/sdd-spec.md']);
      assert.deepEqual(readdirSync(join(d, '.claude', 'commands')).sort(), ['aiad-help.md', 'aiad.md', 'sdd.md']);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-003 — une commande écrite par le projet n\'est jamais supprimée', () => {
    const d = projet({
      '.claude/commands/sdd-deploy.md': '---\nname: sdd-deploy\ndescription: commande maison\n---\n',
      '.claude/commands/deploy.md': ALIAS,
    });
    try {
      assert.deepEqual(retirerAliasPlats(d), []);
      assert.ok(existsSync(join(d, '.claude', 'commands', 'sdd-deploy.md')));
      assert.ok(existsSync(join(d, '.claude', 'commands', 'deploy.md')), 'hors préfixe sdd-/aiad- : jamais touché');
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-004 — commande du profil minimal : conservée seule, retirée quand le router la remplace', () => {
    const minimal = readFileSync(join(ROOT, 'templates', 'minimal', '.claude', 'commands', 'sdd-spec.md'), 'utf-8');
    const d = projet({ '.claude/commands/sdd-spec.md': minimal, '.claude/commands/sdd-gate.md': minimal + '\nadapté par le projet\n' });
    try {
      assert.deepEqual(listerAliasPlats(d), [], 'profil minimal : rien à retirer');
      mkdirSync(join(d, '.claude', 'sdd'), { recursive: true });
      writeFileSync(join(d, '.claude', 'sdd', 'spec.md'), 'corps');
      writeFileSync(join(d, '.claude', 'sdd', 'gate.md'), 'corps');
      assert.deepEqual(listerAliasPlats(d), [{ fichier: '.claude/commands/sdd-spec.md', motif: 'minimal-remplacé' }]);
      retirerAliasPlats(d);
      assert.ok(!existsSync(join(d, '.claude', 'commands', 'sdd-spec.md')));
      assert.ok(existsSync(join(d, '.claude', 'commands', 'sdd-gate.md')), 'version modifiée par le projet : conservée');
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-005 — mode check : liste sans supprimer ; projet sans .claude : liste vide', () => {
    const d = projet({ '.claude/commands/sdd-spec.md': ALIAS });
    const vide = mkdtempSync(join(tmpdir(), 'aiad-alias-'));
    try {
      assert.deepEqual(retirerAliasPlats(d, { check: true }), ['.claude/commands/sdd-spec.md']);
      assert.ok(existsSync(join(d, '.claude', 'commands', 'sdd-spec.md')));
      assert.deepEqual(retirerAliasPlats(vide), []);
    } finally { rmSync(d, { recursive: true, force: true }); rmSync(vide, { recursive: true, force: true }); }
  });
});
