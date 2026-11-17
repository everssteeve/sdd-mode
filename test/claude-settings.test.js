// @intent INTENT-039
// @spec SPEC-039-1-installation-fiable
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estHookAiad, fusionnerHooksAiad, retirerHooksAiad, scriptsHooksCables } from '../lib/claude-settings.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const TPL = JSON.parse(readFileSync(join(RACINE, 'templates', '.claude', 'settings.json'), 'utf-8'));

const UTILISATEUR = {
  permissions: { deny: ['Read(./.env)'] },
  hooks: {
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo maison' }] }],
    Notification: [{ hooks: [{ type: 'command', command: 'say fini' }] }],
  },
};

test('CA-001 — fusion : hooks AIAD ajoutés, entrées utilisateur intactes et en premier', () => {
  const r = fusionnerHooksAiad(UTILISATEUR, TPL);
  assert.deepEqual(r.permissions, UTILISATEUR.permissions);
  assert.equal(r.hooks.PreToolUse[0].hooks[0].command, 'echo maison');
  assert.deepEqual(r.hooks.Notification, UTILISATEUR.hooks.Notification);
  assert.deepEqual(scriptsHooksCables(r), scriptsHooksCables(TPL));
  assert.ok(scriptsHooksCables(r).includes('veto.js'));
  assert.ok(scriptsHooksCables(r).includes('drift-lock.js'));
});

test('CA-001 — fusion idempotente : rejouée, elle ne produit aucun diff', () => {
  const une = fusionnerHooksAiad(UTILISATEUR, TPL);
  const deux = fusionnerHooksAiad(une, TPL);
  assert.equal(JSON.stringify(deux), JSON.stringify(une));
});

test('CA-001 — fusion sobre : aucune clé du gabarit imposée hors hooks et statusLine', () => {
  const r = fusionnerHooksAiad(UTILISATEUR, TPL);
  assert.deepEqual(Object.keys(r).sort(), ['hooks', 'permissions', 'statusLine']);
  const avecStatus = fusionnerHooksAiad({ statusLine: { type: 'command', command: 'echo moi' } }, TPL);
  assert.equal(avecStatus.statusLine.command, 'echo moi', 'le statusLine de l\'utilisateur prime');
});

test('CA-001 — fusion ne modifie pas l\'objet reçu', () => {
  const copie = structuredClone(UTILISATEUR);
  fusionnerHooksAiad(UTILISATEUR, TPL);
  assert.deepEqual(UTILISATEUR, copie);
});

test('CA-002 — retrait : seules les entrées AIAD partent', () => {
  const r = retirerHooksAiad(fusionnerHooksAiad(UTILISATEUR, TPL));
  assert.deepEqual(r, UTILISATEUR);
  assert.deepEqual(retirerHooksAiad(TPL).hooks, undefined);
  assert.deepEqual(scriptsHooksCables(retirerHooksAiad(TPL)), []);
});

test('CA-002 — un groupe mixte garde le hook de l\'utilisateur', () => {
  const mixte = { hooks: { Stop: [{ matcher: '*', hooks: [
    { type: 'command', command: 'echo moi' },
    { type: 'command', command: 'node "${CLAUDE_PROJECT_DIR}/.aiad/hooks/drift-lock.js"' },
  ] }] } };
  assert.deepEqual(retirerHooksAiad(mixte).hooks.Stop[0].hooks, [{ type: 'command', command: 'echo moi' }]);
});

test('estHookAiad — reconnaît la forme shell et la forme exec', () => {
  assert.equal(estHookAiad({ command: 'node "${CLAUDE_PROJECT_DIR}/.aiad/hooks/veto.js"' }), true);
  assert.equal(estHookAiad({ command: 'node', args: ['${CLAUDE_PROJECT_DIR}/.aiad/hooks/veto.js'] }), true);
  assert.equal(estHookAiad({ command: 'echo .aiad' }), false);
  assert.equal(estHookAiad(null), false);
});

test('CA-005 — gabarit : aucun chemin de projet non quoté, `if` porté par chaque hook', () => {
  const commandes = [TPL.statusLine.command];
  for (const groupes of Object.values(TPL.hooks)) {
    for (const g of groupes) {
      assert.equal('if' in g, false, 'le champ `if` appartient au hook, pas au groupe');
      assert.equal('asyncRewake' in g, false);
      for (const h of g.hooks) {
        commandes.push(h.command);
        assert.equal(h.asyncRewake, undefined, 'un hook d\'arrière-plan ne peut pas retenir une clôture');
      }
    }
  }
  for (const c of commandes) {
    assert.match(c, /^node "\$\{CLAUDE_PROJECT_DIR\}\/[^"]+"( |$)/, `chemin non quoté : ${c}`);
    assert.doesNotMatch(c, /\$\{CLAUDE_EFFORT\}/);
  }
  const veto = TPL.hooks.PreToolUse.flatMap((g) => g.hooks).find((h) => h.command.includes('veto.js'));
  assert.equal(veto.if, 'Bash(git commit *)');
});

test('gabarit : chaque script câblé existe dans templates/.aiad/hooks/', () => {
  const livres = readdirSync(join(RACINE, 'templates', '.aiad', 'hooks'));
  for (const s of scriptsHooksCables(TPL)) assert.ok(livres.includes(s), `script câblé absent : ${s}`);
  assert.ok(livres.includes('package.json'), 'package.json des hooks (type: module) manquant');
});

test('copies racine et gabarit des hooks identiques (pas de modèle périmé)', () => {
  for (const f of readdirSync(join(RACINE, 'templates', '.aiad', 'hooks'))) {
    assert.equal(
      readFileSync(join(RACINE, '.aiad', 'hooks', f), 'utf-8'),
      readFileSync(join(RACINE, 'templates', '.aiad', 'hooks', f), 'utf-8'),
      `divergence racine ↔ gabarit : ${f}`,
    );
  }
});
