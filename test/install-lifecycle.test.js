// Cycle de vie d'une installation sur un projet qui existait avant AIAD :
// réglages, CLAUDE.md et commandes de l'équipe doivent en sortir intacts, et
// les garde-fous doivent réellement s'exécuter.
//
// @intent INTENT-039
// @spec SPEC-039-1-installation-fiable
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { scriptsHooksCables } from '../lib/claude-settings.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(RACINE, 'bin', 'aiad-sdd.js');

function bac() {
  // Espace et accent dans le chemin : cas d'un poste Windows ou d'un Drive.
  const base = mkdtempSync(join(tmpdir(), 'aiad cycle é-'));
  const projet = join(base, 'mon projet');
  const home = join(base, 'home');
  mkdirSync(projet, { recursive: true });
  mkdirSync(home, { recursive: true });
  const env = { ...process.env, HOME: home, USERPROFILE: home, AIAD_OFFLINE: '1', NO_COLOR: '1' };
  delete env.CLAUDE_PROJECT_DIR;
  const lancer = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: projet, env, encoding: 'utf-8', ...opts });
  const cli = (...args) => lancer(process.execPath, [CLI, ...args]);
  const git = (...args) => lancer('git', args);
  git('init', '-q');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  return { base, projet, lancer, cli, git, nettoyer: () => rmSync(base, { recursive: true, force: true }) };
}

const REGLAGES = {
  permissions: { deny: ['Read(./.env)'] },
  hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo maison' }] }] },
};

function projetExistant(b) {
  writeFileSync(join(b.projet, 'package.json'), '{"name":"x","version":"1.0.0","type":"commonjs"}\n');
  mkdirSync(join(b.projet, '.claude', 'commands'), { recursive: true });
  writeFileSync(join(b.projet, '.claude', 'settings.json'), JSON.stringify(REGLAGES, null, 2) + '\n');
  writeFileSync(join(b.projet, 'CLAUDE.md'), '# Notes équipe\n\nAvant.\n');
  writeFileSync(join(b.projet, '.claude', 'commands', 'aiad-banque-custom.md'), 'commande du projet\n');
}

function arbre(dir, prefixe = '') {
  const out = {};
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git') continue;
    const rel = prefixe ? `${prefixe}/${e.name}` : e.name;
    if (e.isDirectory()) Object.assign(out, arbre(join(dir, e.name), rel));
    else out[rel] = readFileSync(join(dir, e.name), 'utf-8');
  }
  return out;
}

test('CA-003 — init sur un projet avec settings.json préexistant câble tous les hooks', () => {
  const b = bac();
  try {
    projetExistant(b);
    const r = b.cli('init');
    assert.equal(r.status, 0, r.stderr);
    const s = JSON.parse(readFileSync(join(b.projet, '.claude', 'settings.json'), 'utf-8'));
    assert.deepEqual(s.permissions, REGLAGES.permissions);
    assert.equal(s.hooks.PreToolUse[0].hooks[0].command, 'echo maison');
    const cables = scriptsHooksCables(s);
    for (const attendu of ['veto.js', 'drift-lock.js', 'jnsp-scan.js', 'discovery-gate.js', 'session-start.js', 'skill-usage.js']) {
      assert.ok(cables.includes(attendu), `hook non câblé : ${attendu}`);
    }
    // Ré-exécution : aucun changement.
    const avant = readFileSync(join(b.projet, '.claude', 'settings.json'), 'utf-8');
    b.cli('init');
    assert.equal(readFileSync(join(b.projet, '.claude', 'settings.json'), 'utf-8'), avant);
  } finally { b.nettoyer(); }
});

test('cas limite 1 — settings.json illisible : non modifié, anomalie signalée, code ≠ 0', () => {
  const b = bac();
  try {
    mkdirSync(join(b.projet, '.claude'), { recursive: true });
    writeFileSync(join(b.projet, '.claude', 'settings.json'), '{ pas du json');
    const r = b.cli('init');
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /JSON illisible/);
    assert.equal(readFileSync(join(b.projet, '.claude', 'settings.json'), 'utf-8'), '{ pas du json');
  } finally { b.nettoyer(); }
});

test('CA-006 — chaque hook s\'exécute dans un projet "type": "commonjs", chemin avec espace', () => {
  const b = bac();
  try {
    projetExistant(b);
    assert.equal(b.cli('init').status, 0);
    const hooks = readdirSync(join(b.projet, '.aiad', 'hooks')).filter((f) => f.endsWith('.js'));
    assert.ok(hooks.length >= 7);
    for (const h of hooks) {
      const r = b.lancer(process.execPath, [join(b.projet, '.aiad', 'hooks', h)], { input: '{}' });
      assert.doesNotMatch(r.stderr, /SyntaxError|Cannot use import|MODULE_NOT_FOUND/, `${h} : ${r.stderr}`);
      assert.ok(r.status === 0 || r.status === 2, `${h} : code ${r.status}`);
    }
  } finally { b.nettoyer(); }
});

test('CA-007 — veto sans CLI : commit refusé (code 2) avec un motif explicite ; autre commande ignorée', () => {
  const b = bac();
  try {
    projetExistant(b);
    assert.equal(b.cli('init').status, 0);
    const veto = join(b.projet, '.aiad', 'hooks', 'veto.js');
    // PATH réduit : ni `aiad-sdd` ni `npx` ne résolvent le paquet.
    const env = { ...process.env, HOME: join(b.base, 'home'), PATH: dirname(process.execPath), AIAD_HOOK_SILENT: '1' };
    const commit = spawnSync(process.execPath, [veto], {
      cwd: b.projet, env, encoding: 'utf-8',
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git commit -m x' } }),
    });
    assert.equal(commit.status, 2, 'fail-closed attendu, y compris avec AIAD_HOOK_SILENT');
    const decision = JSON.parse(commit.stdout);
    assert.equal(decision.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(decision.hookSpecificOutput.permissionDecisionReason, /non vérifié/);
    assert.match(commit.stderr, /non vérifié/);

    const autre = spawnSync(process.execPath, [veto], {
      cwd: b.projet, env, encoding: 'utf-8',
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls -la' } }),
    });
    assert.equal(autre.status, 0);
    assert.equal(autre.stdout, '');
  } finally { b.nettoyer(); }
});

test('CA-004 / CA-010 — update --dry-run laisse l\'arbre inchangé ; update resynchronise hooks et câblage', () => {
  const b = bac();
  try {
    projetExistant(b);
    assert.equal(b.cli('init').status, 0);
    // Simule un projet installé avant le correctif : script périmé, hooks décâblés.
    writeFileSync(join(b.projet, '.aiad', 'hooks', 'veto.js'), '// périmé\n');
    writeFileSync(join(b.projet, '.claude', 'settings.json'), JSON.stringify(REGLAGES, null, 2) + '\n');
    const avant = arbre(b.projet);

    const dry = b.cli('update', '--dry-run');
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /Aucun changement appliqué/);
    assert.deepEqual(arbre(b.projet), avant, 'update --dry-run a écrit');

    assert.equal(b.cli('update').status, 0);
    assert.equal(
      readFileSync(join(b.projet, '.aiad', 'hooks', 'veto.js'), 'utf-8'),
      readFileSync(join(RACINE, 'templates', '.aiad', 'hooks', 'veto.js'), 'utf-8'),
    );
    const s = JSON.parse(readFileSync(join(b.projet, '.claude', 'settings.json'), 'utf-8'));
    assert.ok(scriptsHooksCables(s).includes('veto.js'));
    assert.equal(s.hooks.PreToolUse[0].hooks[0].command, 'echo maison');
    assert.equal(b.cli('update', '--check').status, 0, 'update suivi de --check doit être propre');
  } finally { b.nettoyer(); }
});

test('CA-011 — uninstall rend les fichiers de l\'équipe intacts et ne laisse aucun hook AIAD', () => {
  const b = bac();
  try {
    projetExistant(b);
    const reglagesAvant = readFileSync(join(b.projet, '.claude', 'settings.json'), 'utf-8');
    assert.equal(b.cli('init').status, 0);
    // L'équipe écrit après la section SDD Mode.
    const claude = join(b.projet, 'CLAUDE.md');
    writeFileSync(claude, readFileSync(claude, 'utf-8') + '\n## Après\n\nTexte équipe après.\n');

    assert.equal(b.cli('uninstall', '--force').status, 0);
    assert.equal(b.cli('uninstall', '--purge', '--force').status, 0);

    assert.equal(readFileSync(claude, 'utf-8'), '# Notes équipe\n\nAvant.\n\n## Après\n\nTexte équipe après.\n');
    assert.equal(readFileSync(join(b.projet, '.claude', 'settings.json'), 'utf-8'), reglagesAvant);
    assert.equal(readFileSync(join(b.projet, '.claude', 'commands', 'aiad-banque-custom.md'), 'utf-8'), 'commande du projet\n');
    const restes = Object.keys(arbre(b.projet)).filter((f) => !['package.json', 'CLAUDE.md', '.claude/settings.json', '.claude/commands/aiad-banque-custom.md', '.gitignore'].includes(f));
    assert.deepEqual(restes, [], `résidus : ${restes.join(', ')}`);
  } finally { b.nettoyer(); }
});

test('uninstall sur un projet vierge : il ne reste rien de l\'installation', () => {
  const b = bac();
  try {
    assert.equal(b.cli('init').status, 0);
    assert.equal(b.cli('uninstall', '--purge', '--force').status, 0);
    const restes = Object.keys(arbre(b.projet)).filter((f) => f !== '.gitignore');
    assert.deepEqual(restes, [], `résidus : ${restes.join(', ')}`);
  } finally { b.nettoyer(); }
});

test('CA-008 — une sortie de plus de 64 Ko traverse un tube sans être coupée', () => {
  const b = bac();
  try {
    assert.equal(b.cli('init').status, 0);
    mkdirSync(join(b.projet, 'src'), { recursive: true });
    for (let i = 0; i < 900; i++) {
      writeFileSync(join(b.projet, 'src', `module-avec-un-nom-assez-long-${i}.js`), `// @spec SPEC-999-${i}-inexistante\nexport const v${i} = ${i};\n`);
    }
    const r = b.cli('trace', '--output-format', 'verdict');
    assert.ok(r.stdout.length > 70000, `sortie trop courte pour le test : ${r.stdout.length}`);
    const verdict = JSON.parse(r.stdout);
    assert.equal(verdict.verdict, 'FAIL');
    assert.equal(r.status, 1);
    assert.ok(verdict.gaps.length >= 900);
  } finally { b.nettoyer(); }
});

test('CA-009 — node_modules/ non ignoré par git : aucun écart n\'en provient', () => {
  const b = bac();
  try {
    assert.equal(b.cli('init').status, 0);
    mkdirSync(join(b.projet, 'node_modules', 'paquet'), { recursive: true });
    writeFileSync(join(b.projet, 'node_modules', 'paquet', 'index.js'), '// @spec SPEC-123-4-du-paquet\nmodule.exports = 1;\n');
    const r = b.cli('trace', '--output-format', 'verdict');
    const verdict = JSON.parse(r.stdout);
    const fuites = verdict.gaps.filter((g) => String(g.file || g.ref).includes('node_modules'));
    assert.deepEqual(fuites, []);
  } finally { b.nettoyer(); }
});
