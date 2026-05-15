// Tests de validation de l'Action GitHub `aiad-sdd-action`.
// On vérifie la structure du YAML composite : champs requis, modes
// supportés, sécurité (pas d'install global, pas de curl pipe, etc.).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACTION_PATH = join(__dirname, '..', '.github', 'actions', 'aiad-sdd', 'action.yml');
const README_PATH = join(__dirname, '..', '.github', 'actions', 'aiad-sdd', 'README.md');

test('action.yml — fichier présent et structurellement valide', () => {
  assert.ok(existsSync(ACTION_PATH), 'action.yml absent');
  const yaml = readFileSync(ACTION_PATH, 'utf-8');
  // Vérifie la présence des champs requis pour une composite action.
  assert.match(yaml, /^name:/m);
  assert.match(yaml, /^description:/m);
  assert.match(yaml, /^runs:/m);
  assert.match(yaml, /using:\s*['"]?composite['"]?/);
  assert.match(yaml, /^inputs:/m);
});

test('action.yml — supporte les 6 modes d\'exécution', () => {
  const yaml = readFileSync(ACTION_PATH, 'utf-8');
  for (const mode of ['checks)', 'trace)', 'docs)', 'doctor)', 'doctor-json)', 'all)']) {
    assert.match(yaml, new RegExp(`\\b${mode.replace(')', '\\)')}`, 'g'), `mode ${mode} absent`);
  }
});

test('action.yml — appelle `npx -y aiad-sdd@$VERSION` (pas d\'install global)', () => {
  const yaml = readFileSync(ACTION_PATH, 'utf-8');
  assert.match(yaml, /npx -y "aiad-sdd@\$VERSION"/);
  // Pas de `npm install -g aiad-sdd` (mauvaise pratique côté CI)
  assert.ok(!/npm install -g/.test(yaml), 'install global détecté');
  // Pas de pipe vers bash
  assert.ok(!/curl[^|]*\| ?bash/.test(yaml), 'curl|bash détecté');
});

test('action.yml — désactive la couleur en CI (NO_COLOR)', () => {
  const yaml = readFileSync(ACTION_PATH, 'utf-8');
  assert.match(yaml, /AIAD_NO_COLOR:/);
});

test('action.yml — expose un output `sarif-path`', () => {
  const yaml = readFileSync(ACTION_PATH, 'utf-8');
  assert.match(yaml, /^outputs:/m);
  assert.match(yaml, /sarif-path:/);
});

test('action.yml — branding visible (icon + color)', () => {
  const yaml = readFileSync(ACTION_PATH, 'utf-8');
  assert.match(yaml, /branding:/);
  assert.match(yaml, /icon:\s*['"]check-circle['"]/);
});

test('action.yml — upload SARIF conditionnel sur input', () => {
  const yaml = readFileSync(ACTION_PATH, 'utf-8');
  assert.match(yaml, /github\/codeql-action\/upload-sarif@v3/);
  // L'upload doit être gated par `if: inputs.upload-sarif == 'true'`
  assert.match(yaml, /inputs\.upload-sarif\s*==\s*['"]true['"]/);
});

test('README — documente les 6 modes + permissions GitHub requises', () => {
  assert.ok(existsSync(README_PATH), 'README.md absent');
  const md = readFileSync(README_PATH, 'utf-8');
  for (const mode of ['checks', 'trace', 'docs', 'doctor', 'doctor-json', 'all']) {
    assert.ok(md.includes('`' + mode + '`'), `mode ${mode} non documenté`);
  }
  // Exemple d'usage
  assert.match(md, /uses: everssteeve\/sdd-mode\/\.github\/actions\/aiad-sdd@/);
  // Permissions Code Scanning
  assert.match(md, /security-events:\s*write/);
});
