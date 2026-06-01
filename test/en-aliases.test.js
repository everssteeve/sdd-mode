// Test que les alias EN sont bien exposés et pointent vers les fonctions FR.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

const ALIASES = [
  ['../lib/hooks.js', { installHooks: 'installerHooks', uninstallHooks: 'desinstallerHooks' }],
  ['../lib/governance-packs.js', { installPack: 'installerPack', listPacks: 'listerPacks', packExists: 'packExiste' }],
  ['../lib/migrate.js', { migrate: 'migrer', planMigrations: 'planifier' }],
  ['../lib/repl.js', { openRepl: 'ouvrirRepl', parseLine: 'parserLigne' }],
  ['../lib/skills.js', { listSkills: 'listerSkills', validateSkill: 'validerSkill', validateSkills: 'validerSkills' }],
  ['../lib/spec-suggester.js', { suggestSpecs: 'suggererSpecs' }],
  ['../lib/i18n.js', { listLanguages: 'listerLangues' }],
  ['../lib/sdd-trace.js', {
    parseAnnotations: 'parserAnnotations',
    buildMatrix: 'construireMatrice',
    listGitFiles: 'listerFichiersGit',
    scanSourceCode: 'scanCode',
    startWatch: 'demarrerWatch',
  }],
  ['../lib/dashboard.js', { collectData: 'collecterDonnees', watch: 'watcher' }],
  ['../lib/uninstall.js', { planUninstall: 'planifier' }],
];

for (const [chemin, mapping] of ALIASES) {
  test(`${chemin} — alias EN exposés et === aux fonctions FR`, async () => {
    const mod = await import(chemin);
    for (const [en, fr] of Object.entries(mapping)) {
      assert.equal(typeof mod[en], 'function', `${en} non exporté`);
      assert.equal(typeof mod[fr], 'function', `${fr} non exporté`);
      assert.equal(mod[en], mod[fr], `${en} ≠ ${fr} (alias mal câblé)`);
    }
  });
}
