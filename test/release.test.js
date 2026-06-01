// Tests `scripts/release.js` — fonctions pures du pipeline de release.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  bumpVersion,
  parseCommit,
  genererSectionChangelog,
  insererSectionChangelog,
} from '../scripts/release.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', 'scripts', 'release.js');

// ─── bumpVersion ────────────────────────────────────────────────────────────

test('bumpVersion — patch incrémente le 3e nombre', () => {
  assert.equal(bumpVersion('1.2.3', 'patch'), '1.2.4');
  assert.equal(bumpVersion('0.0.0', 'patch'), '0.0.1');
});

test('bumpVersion — minor reset patch', () => {
  assert.equal(bumpVersion('1.2.3', 'minor'), '1.3.0');
  assert.equal(bumpVersion('1.0.99', 'minor'), '1.1.0');
});

test('bumpVersion — major reset minor + patch', () => {
  assert.equal(bumpVersion('1.2.3', 'major'), '2.0.0');
  assert.equal(bumpVersion('5.99.99', 'major'), '6.0.0');
});

test('bumpVersion — version explicite x.y.z passée telle quelle', () => {
  assert.equal(bumpVersion('1.0.0', '2.5.7'), '2.5.7');
  assert.equal(bumpVersion('1.0.0', '1.0.0-beta.1'), '1.0.0-beta.1');
});

test('bumpVersion — version courante invalide → erreur', () => {
  assert.throws(() => bumpVersion('not-semver', 'patch'), /invalide/);
  assert.throws(() => bumpVersion('1.2', 'patch'), /invalide/);
});

test('bumpVersion — kind inconnu → erreur', () => {
  assert.throws(() => bumpVersion('1.0.0', 'badbump'), /Type de bump inconnu/);
});

// ─── parseCommit ────────────────────────────────────────────────────────────

test('parseCommit — feat sans scope', () => {
  const r = parseCommit('feat: ajout de la commande X');
  assert.equal(r.type, 'feat');
  assert.equal(r.scope, null);
  assert.equal(r.breaking, false);
  assert.equal(r.subject, 'ajout de la commande X');
});

test('parseCommit — fix avec scope', () => {
  const r = parseCommit('fix(parser): bug Y');
  assert.equal(r.type, 'fix');
  assert.equal(r.scope, 'parser');
  assert.equal(r.subject, 'bug Y');
});

test('parseCommit — breaking change via !', () => {
  const r = parseCommit('feat!: API redesign');
  assert.equal(r.type, 'feat');
  assert.equal(r.breaking, true);
  assert.equal(r.subject, 'API redesign');
});

test('parseCommit — breaking + scope', () => {
  const r = parseCommit('feat(api)!: breaking change');
  assert.equal(r.scope, 'api');
  assert.equal(r.breaking, true);
});

test('parseCommit — types supportés', () => {
  for (const type of ['feat', 'fix', 'docs', 'refactor', 'perf', 'test', 'chore', 'build', 'ci', 'style', 'revert']) {
    const r = parseCommit(`${type}: subject`);
    assert.ok(r, `${type} non reconnu`);
    assert.equal(r.type, type);
  }
});

test('parseCommit — commit non conventionnel → null', () => {
  assert.equal(parseCommit('ajout sans préfixe'), null);
  assert.equal(parseCommit('Merge pull request #42'), null);
  assert.equal(parseCommit(''), null);
});

// ─── genererSectionChangelog ────────────────────────────────────────────────

test('genererSectionChangelog — vide → message explicite', () => {
  const s = genererSectionChangelog('1.2.3', '2026-05-10', []);
  assert.match(s, /## \[1\.2\.3\] — 2026-05-10/);
  assert.match(s, /Pas de commits conventionnels détectés/);
});

test('genererSectionChangelog — regroupe par section', () => {
  const commits = [
    { type: 'feat', scope: null, subject: 'A', breaking: false },
    { type: 'fix', scope: null, subject: 'B', breaking: false },
    { type: 'feat', scope: 'auth', subject: 'C', breaking: false },
    { type: 'docs', scope: null, subject: 'D', breaking: false },
  ];
  const s = genererSectionChangelog('1.0.0', '2026-05-10', commits);
  assert.match(s, /### Ajouté[\s\S]*- A[\s\S]*- \*\*auth\*\* : C/);
  assert.match(s, /### Corrigé[\s\S]*- B/);
  assert.match(s, /### Documentation[\s\S]*- D/);
});

test('genererSectionChangelog — breaking changes en tête', () => {
  const commits = [
    { type: 'feat', scope: null, subject: 'normal', breaking: false },
    { type: 'feat', scope: 'api', subject: 'redesign', breaking: true },
  ];
  const s = genererSectionChangelog('2.0.0', '2026-05-10', commits);
  // Breaking section vient avant Ajouté
  assert.ok(s.indexOf('⚠️ Breaking changes') < s.indexOf('### Ajouté'));
  assert.match(s, /\*\*api\*\* : redesign/);
});

test('genererSectionChangelog — section Ajouté n\'inclut pas les breaking', () => {
  const commits = [
    { type: 'feat', scope: null, subject: 'normal', breaking: false },
    { type: 'feat', scope: null, subject: 'redesign', breaking: true },
  ];
  const s = genererSectionChangelog('2.0.0', '2026-05-10', commits);
  // 'redesign' apparaît dans Breaking, pas dans Ajouté
  const ajouteSection = s.split('### Ajouté')[1] || '';
  assert.ok(!ajouteSection.includes('redesign'));
});

// ─── insererSectionChangelog ────────────────────────────────────────────────

test('insererSectionChangelog — insère avant la première section [version]', () => {
  const existant = `# Changelog

> Header

## [1.0.0] — 2025-01-01

- ancien
`;
  const section = '## [1.1.0] — 2026-05-10\n\n### Ajouté\n\n- nouveau';
  const r = insererSectionChangelog(existant, section);
  assert.ok(r.indexOf('## [1.1.0]') < r.indexOf('## [1.0.0]'));
});

test('insererSectionChangelog — pas de section existante → ajoute après header', () => {
  const existant = `# Changelog\n\nHeader uniquement.\n`;
  const section = '## [1.0.0] — 2026-05-10\n\n### Ajouté\n\n- new';
  const r = insererSectionChangelog(existant, section);
  assert.match(r, /^# Changelog/);
  assert.match(r, /## \[1\.0\.0\]/);
});

// ─── CLI usage (sans flags) ─────────────────────────────────────────────────

test('release.js — sans argument → usage + exit 1', () => {
  const r = spawnSync('node', [SCRIPT], { encoding: 'utf-8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Usage : node scripts\/release\.js/);
});

test('release.js — type de bump invalide → exit 1', () => {
  // L'erreur survient seulement après le check git, qu'on saute via --allow-dirty
  // Le bump avec "wat" sortira du pipeline.
  const r = spawnSync('node', [SCRIPT, 'wat', '--dry-run', '--skip-tests', '--allow-dirty'], { encoding: 'utf-8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /bump inconnu|wat/);
});
