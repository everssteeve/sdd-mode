// Tests `scripts/release.js` — fonctions pures du pipeline de release.
//
// @spec SPEC-034-2-controle-drift-doctrine (contrôle doctrine avant bump : CA-007 / CA-007b)

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
  parseFlags,
  controlerDoctrine,
  main,
} from '../scripts/release.js';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { CORRESPONDANCES, syncDoctrine } from '../scripts/sync-doctrine.js';

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

// ─── parseFlags (mutation kill : L176-L182) ─────────────────────────────────

test('parseFlags — sans argument → tous les flags à false, kind null', () => {
  const f = parseFlags([]);
  assert.equal(f.kind, null);
  assert.equal(f.dryRun, false);
  assert.equal(f.push, false);
  assert.equal(f.allowDirty, false);
  assert.equal(f.skipTests, false);
});

test('parseFlags — premier positionnel non-flag → kind', () => {
  assert.equal(parseFlags(['patch']).kind, 'patch');
  // un second positionnel ne réécrit pas kind
  assert.equal(parseFlags(['minor', 'major']).kind, 'minor');
});

test('parseFlags — --dry-run active uniquement dryRun', () => {
  const f = parseFlags(['--dry-run']);
  assert.equal(f.dryRun, true);
  assert.equal(f.push, false);
  assert.equal(f.allowDirty, false);
  assert.equal(f.skipTests, false);
  assert.equal(f.kind, null);
});

test('parseFlags — --push active uniquement push', () => {
  const f = parseFlags(['--push']);
  assert.equal(f.push, true);
  assert.equal(f.dryRun, false);
  assert.equal(f.allowDirty, false);
  assert.equal(f.skipTests, false);
});

test('parseFlags — --allow-dirty active uniquement allowDirty', () => {
  const f = parseFlags(['--allow-dirty']);
  assert.equal(f.allowDirty, true);
  assert.equal(f.dryRun, false);
  assert.equal(f.push, false);
  assert.equal(f.skipTests, false);
});

test('parseFlags — --skip-tests active uniquement skipTests', () => {
  const f = parseFlags(['--skip-tests']);
  assert.equal(f.skipTests, true);
  assert.equal(f.dryRun, false);
  assert.equal(f.push, false);
  assert.equal(f.allowDirty, false);
});

test('parseFlags — combinaison kind + tous les flags', () => {
  const f = parseFlags(['major', '--dry-run', '--push', '--allow-dirty', '--skip-tests']);
  assert.equal(f.kind, 'major');
  assert.equal(f.dryRun, true);
  assert.equal(f.push, true);
  assert.equal(f.allowDirty, true);
  assert.equal(f.skipTests, true);
});

// ─── Contrôle doctrine avant release (SPEC-034-2) ───────────────────────────

const PKG = `${JSON.stringify({ name: 'fixture', version: '1.0.0' }, null, 2)}\n`;

/** Dépôt fixture : package.json + doctrine synchronisée depuis une source fixture. */
async function fixtureRelease() {
  const src = mkdtempSync(join(tmpdir(), 'aiad-release-src-'));
  for (const c of CORRESPONDANCES) {
    mkdirSync(dirname(join(src, c.source)), { recursive: true });
    writeFileSync(join(src, c.source), `# ${c.source}\n`, 'utf-8');
  }
  writeFileSync(join(src, '20_conception/framework/frameworkAIAD.md'), '# Guide AIAD — Framework v1.9\n', 'utf-8');
  const racine = mkdtempSync(join(tmpdir(), 'aiad-release-depot-'));
  writeFileSync(join(racine, 'package.json'), PKG, 'utf-8');
  await syncDoctrine({ source: src, racine, emit: false, log: () => {} });
  return { src, racine, nettoyer: () => { rmSync(src, { recursive: true, force: true }); rmSync(racine, { recursive: true, force: true }); } };
}

async function silencieux(fn) {
  const [log, err] = [console.log, console.error];
  const sortie = [];
  console.log = (...a) => sortie.push(a.join(' '));
  console.error = (...a) => sortie.push(a.join(' '));
  try { return { code: await fn(), sortie: sortie.join('\n') }; } finally { console.log = log; console.error = err; }
}

test('controlerDoctrine — AIAD_DOCTRINE_SOURCE non défini → ko sans appeler le contrôle', () => {
  let appele = false;
  const r = controlerDoctrine({ env: {}, verifier: () => { appele = true; return 0; } });
  assert.equal(r.ok, false);
  assert.equal(r.code, null);
  assert.match(r.message, /AIAD_DOCTRINE_SOURCE/);
  assert.equal(appele, false);
});

test('controlerDoctrine — passe --source et la racine au contrôle ; 0 → ok, 1/2 → ko', () => {
  let recu;
  const ok = controlerDoctrine({ env: { AIAD_DOCTRINE_SOURCE: '/drive/md' }, racine: '/depot', verifier: (a, c) => { recu = [a, c]; return 0; } });
  assert.deepEqual(recu, [['--source', '/drive/md'], { racine: '/depot' }]);
  assert.equal(ok.ok, true);
  for (const code of [1, 2]) {
    const ko = controlerDoctrine({ env: { AIAD_DOCTRINE_SOURCE: '/drive/md' }, verifier: () => code });
    assert.equal(ko.ok, false);
    assert.equal(ko.code, code);
  }
});

test('CA-007b — AIAD_DOCTRINE_SOURCE non défini → release arrêtée avant de modifier package.json', async () => {
  const f = await fixtureRelease();
  try {
    const { code, sortie } = await silencieux(() => main(['patch', '--allow-dirty', '--skip-tests'], { env: {}, racine: f.racine }));
    assert.equal(code, 1);
    assert.match(sortie, /AIAD_DOCTRINE_SOURCE non défini/);
    assert.equal(readFileSync(join(f.racine, 'package.json'), 'utf-8'), PKG);
  } finally { f.nettoyer(); }
});

test('CA-007 — Drive en drift (contenu) → release arrêtée avant de modifier package.json', async () => {
  const f = await fixtureRelease();
  try {
    writeFileSync(join(f.src, '20_conception/gouvernance/AIAD-RGPD.md'), '# RGPD modifié sur le Drive\n', 'utf-8');
    const { code, sortie } = await silencieux(() => main(['patch', '--allow-dirty', '--skip-tests'], { env: { AIAD_DOCTRINE_SOURCE: f.src }, racine: f.racine }));
    assert.equal(code, 1);
    assert.match(sortie, /AIAD-RGPD\.md/);
    assert.match(sortie, /exit 1/);
    assert.equal(readFileSync(join(f.racine, 'package.json'), 'utf-8'), PKG);
  } finally { f.nettoyer(); }
});

test('CA-007 — source Drive inaccessible (exit 2) → release arrêtée avant de modifier package.json', async () => {
  const f = await fixtureRelease();
  try {
    const { code, sortie } = await silencieux(() => main(['minor', '--allow-dirty', '--skip-tests'], { env: { AIAD_DOCTRINE_SOURCE: join(f.src, 'absent') }, racine: f.racine }));
    assert.equal(code, 1);
    assert.match(sortie, /exit 2/);
    assert.equal(readFileSync(join(f.racine, 'package.json'), 'utf-8'), PKG);
  } finally { f.nettoyer(); }
});

test('--dry-run exécute aussi le contrôle doctrine (lecture seule) et s\'arrête sans source', async () => {
  let appele = false;
  const { code } = await silencieux(() => main(['patch', '--dry-run', '--allow-dirty', '--skip-tests'], {
    env: {}, verifierDoctrine: () => { appele = true; return 0; },
  }));
  assert.equal(code, 1);
  assert.equal(appele, false);
  const r = await silencieux(() => main(['patch', '--dry-run', '--allow-dirty', '--skip-tests'], {
    env: { AIAD_DOCTRINE_SOURCE: '/drive/md' }, verifierDoctrine: () => { appele = true; return 1; },
  }));
  assert.equal(r.code, 1);
  assert.equal(appele, true);
});

test('contrôle doctrine conforme → la release poursuit (bump écrit dans package.json)', async () => {
  const f = await fixtureRelease();
  try {
    // Vrai contrôle (Drive fixture = lock). Le pipeline s'arrête ensuite à
    // l'étape CHANGELOG (pas de dépôt git) : seul le bump nous intéresse ici.
    const r = await silencieux(() => main(['patch', '--allow-dirty', '--skip-tests'], { env: { AIAD_DOCTRINE_SOURCE: f.src }, racine: f.racine })
      .catch(() => 'arrêt après bump'));
    assert.match(r.sortie, /Doctrine conforme au Drive publié/);
    assert.equal(JSON.parse(readFileSync(join(f.racine, 'package.json'), 'utf-8')).version, '1.0.1');
  } finally { f.nettoyer(); }
});
