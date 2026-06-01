// Tests snippets VS Code AIAD — extension #36 + #72.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RACINE = join(__dirname, '..');
const EXT = join(RACINE, 'vscode-extension');

// ─── Snippets file ──────────────────────────────────────────────────────────

test('snippets/aiad.code-snippets — fichier présent et JSON valide', () => {
  const path = join(EXT, 'snippets', 'aiad.code-snippets');
  assert.ok(existsSync(path), 'fichier snippets absent');
  const c = readFileSync(path, 'utf-8');
  // Doit être JSON parseable
  let data;
  assert.doesNotThrow(() => { data = JSON.parse(c); });
  assert.ok(typeof data === 'object');
});

test('snippets — couvre les 14 commandes /sdd', () => {
  const data = JSON.parse(readFileSync(join(EXT, 'snippets', 'aiad.code-snippets'), 'utf-8'));
  const sddCmds = ['init', 'intent', 'spec', 'gate', 'exec', 'validate', 'drift-check',
    'trace', 'split', 'resume', 'context', 'fact', 'security', 'audit'];
  for (const cmd of sddCmds) {
    const cle = `AIAD — /sdd ${cmd}`;
    assert.ok(data[cle], `Snippet "/sdd ${cmd}" absent`);
    assert.ok(Array.isArray(data[cle].body));
    assert.match(data[cle].body[0], new RegExp(`^/sdd ${cmd.replace('-', '\\-')}`));
  }
});

test('snippets — couvre les 15 commandes /aiad', () => {
  const data = JSON.parse(readFileSync(join(EXT, 'snippets', 'aiad.code-snippets'), 'utf-8'));
  const aiadCmds = ['init', 'onboard', 'status', 'health', 'gouvernance', 'tech-review',
    'standup', 'demo', 'retro', 'intention', 'sync-strat', 'dashboard',
    'dashboard-html', 'dora', 'flow'];
  for (const cmd of aiadCmds) {
    const cle = `AIAD — /aiad ${cmd}`;
    assert.ok(data[cle], `Snippet "/aiad ${cmd}" absent`);
  }
});

test('snippets — annotations machine (intent/spec/verified-by/governance)', () => {
  const data = JSON.parse(readFileSync(join(EXT, 'snippets', 'aiad.code-snippets'), 'utf-8'));
  for (const tag of ['intent', 'spec', 'verified-by', 'governance']) {
    const cle = `AIAD — annotation @${tag}`;
    assert.ok(data[cle], `Annotation @${tag} absente`);
  }
});

test('snippets — squelettes Intent + SPEC EARS complets', () => {
  const data = JSON.parse(readFileSync(join(EXT, 'snippets', 'aiad.code-snippets'), 'utf-8'));
  const intent = data['AIAD — squelette Intent Statement'];
  const spec = data['AIAD — squelette SPEC EARS'];
  assert.ok(intent);
  assert.ok(spec);
  // Squelette Intent : présence des 4 sections critiques
  const intentBody = intent.body.join('\n');
  for (const section of ['Pourquoi', 'Conséquence si rien', 'Frontière', 'Indicateur de succès']) {
    assert.match(intentBody, new RegExp(section), `section ${section} absente du squelette Intent`);
  }
  // Squelette SPEC : EARS R1 + Test de l'Étranger
  const specBody = spec.body.join('\n');
  assert.match(specBody, /format: EARS/);
  assert.match(specBody, /R1 —/);
  assert.match(specBody, /WHEN/);
  assert.match(specBody, /THE SYSTEM SHALL/);
  assert.match(specBody, /Test de l'Étranger/);
});

test('snippets — chaque entrée a prefix + body + description (sauf _doc)', () => {
  const data = JSON.parse(readFileSync(join(EXT, 'snippets', 'aiad.code-snippets'), 'utf-8'));
  for (const [cle, valeur] of Object.entries(data)) {
    if (cle.startsWith('_')) continue; // _doc
    assert.ok(valeur.prefix, `${cle} : prefix manquant`);
    assert.ok(valeur.body, `${cle} : body manquant`);
    assert.ok(valeur.description, `${cle} : description manquante`);
  }
});

test('snippets — au moins 35 entrées (14 sdd + 15 aiad + 4 annotations + 2 squelettes)', () => {
  const data = JSON.parse(readFileSync(join(EXT, 'snippets', 'aiad.code-snippets'), 'utf-8'));
  const entries = Object.keys(data).filter((k) => !k.startsWith('_'));
  assert.ok(entries.length >= 35, `attendu ≥ 35 snippets, vu ${entries.length}`);
});

// ─── Manifest VS Code ───────────────────────────────────────────────────────

test('manifest — déclare snippets pour markdown + ≥ 5 langages code', () => {
  const pkg = JSON.parse(readFileSync(join(EXT, 'package.json'), 'utf-8'));
  assert.ok(Array.isArray(pkg.contributes.snippets));
  const langs = pkg.contributes.snippets.map((s) => s.language);
  assert.ok(langs.includes('markdown'));
  // ≥ 5 langages code (TS/JS/Python/Rust/Go/Java/...)
  const codeLangs = langs.filter((l) => l !== 'markdown');
  assert.ok(codeLangs.length >= 5, `attendu ≥ 5 langages code, vu ${codeLangs.length}`);
});

test('manifest — toutes les entrées snippets pointent sur le même fichier', () => {
  const pkg = JSON.parse(readFileSync(join(EXT, 'package.json'), 'utf-8'));
  for (const s of pkg.contributes.snippets) {
    assert.equal(s.path, './snippets/aiad.code-snippets');
  }
});

test('manifest — palette commandes étendue (≥ 8 commandes AIAD ...)', () => {
  const pkg = JSON.parse(readFileSync(join(EXT, 'package.json'), 'utf-8'));
  const ids = pkg.contributes.commands.map((c) => c.command);
  // Commandes initiales + nouvelles palette
  for (const cmd of ['aiad.refresh', 'aiad.openTrace', 'aiad.runDoctor',
    'aiad.runStatus', 'aiad.runTrace', 'aiad.runDashboard',
    'aiad.runSbom', 'aiad.runDpia', 'aiad.runAiActAudit', 'aiad.runGouvernanceLint',
    'aiad.openRepl']) {
    assert.ok(ids.includes(cmd), `commande palette ${cmd} absente`);
  }
  assert.ok(pkg.contributes.commands.length >= 8);
});

test('manifest — chaque commande a un title qui commence par "AIAD"', () => {
  const pkg = JSON.parse(readFileSync(join(EXT, 'package.json'), 'utf-8'));
  for (const cmd of pkg.contributes.commands) {
    assert.match(cmd.title, /^AIAD /);
  }
});

// ─── Tarball whitelist ──────────────────────────────────────────────────────

test('snippets exclus du tarball npm (artefact VS Code uniquement)', () => {
  const pkg = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf-8'));
  // package.json#files whitelist — ne contient pas vscode-extension/
  for (const entry of pkg.files || []) {
    assert.ok(!entry.includes('vscode-extension'), `vscode-extension exposée dans tarball : ${entry}`);
  }
});
