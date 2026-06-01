// Tests `lib/review.js` — diff Intent/SPEC entre branches Git.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  categoriserFichiers,
  extraireGouvernance,
  calculerImpactGouvernance,
  genererRapportMarkdown,
  comparerBranches,
  listerArtefactsRef,
  lireFichierRef,
  // alias EN
  compareBranches,
  categorizeFiles,
  extractGovernance,
  computeGovernanceImpact,
  generateMarkdownReport,
  listArtifactsAtRef,
  readFileAtRef,
  reviewBranch,
} from '../lib/review.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-review-')); }

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

function setupRepo(d) {
  git(['init', '-q', '-b', 'main'], d);
  git(['config', 'user.email', 'test@aiad.local'], d);
  git(['config', 'user.name', 'Test'], d);
  git(['config', 'commit.gpgsign', 'false'], d);
}

function commitAll(d, msg) {
  git(['add', '-A'], d);
  git(['commit', '-q', '-m', msg], d);
}

// ─── categoriserFichiers ────────────────────────────────────────────────────

test('categoriserFichiers — added/deleted/unchanged corrects', () => {
  const r = categoriserFichiers(['a.md', 'b.md'], ['b.md', 'c.md'], () => false);
  assert.deepEqual(r.added, ['c.md']);
  assert.deepEqual(r.deleted, ['a.md']);
  assert.deepEqual(r.modified, []);
  assert.deepEqual(r.unchanged, ['b.md']);
});

test('categoriserFichiers — modified détecté via comparateur', () => {
  const cmp = (f) => f === 'changed.md';
  const r = categoriserFichiers(['changed.md', 'stable.md'], ['changed.md', 'stable.md'], cmp);
  assert.deepEqual(r.modified, ['changed.md']);
  assert.deepEqual(r.unchanged, ['stable.md']);
});

test('categoriserFichiers — listes vides → tout vide', () => {
  const r = categoriserFichiers([], [], () => false);
  assert.deepEqual(r, { added: [], modified: [], deleted: [], unchanged: [] });
});

// ─── extraireGouvernance ────────────────────────────────────────────────────

test('extraireGouvernance — frontmatter string virgule', () => {
  const c = '---\ngovernance: AIAD-RGPD,AIAD-CRA\n---\n# Body';
  assert.deepEqual(extraireGouvernance(c), ['AIAD-RGPD', 'AIAD-CRA']);
});

test('extraireGouvernance — frontmatter array YAML', () => {
  const c = '---\ngovernance:\n  - AIAD-RGPD\n  - AIAD-AI-ACT\n---\n# Body';
  const r = extraireGouvernance(c);
  assert.ok(r.includes('AIAD-RGPD'));
  assert.ok(r.includes('AIAD-AI-ACT'));
});

test('extraireGouvernance — pas de frontmatter → []', () => {
  assert.deepEqual(extraireGouvernance('# Just markdown'), []);
});

test('extraireGouvernance — frontmatter sans governance → []', () => {
  assert.deepEqual(extraireGouvernance('---\ntitle: X\n---\n'), []);
});

test('extraireGouvernance — input non-string → []', () => {
  assert.deepEqual(extraireGouvernance(null), []);
  assert.deepEqual(extraireGouvernance(undefined), []);
  assert.deepEqual(extraireGouvernance(42), []);
});

// ─── calculerImpactGouvernance ──────────────────────────────────────────────

test('calculerImpactGouvernance — union avant + après', () => {
  const specs = [
    { avant: '---\ngovernance: AIAD-RGPD\n---', apres: '---\ngovernance: AIAD-RGPD,AIAD-CRA\n---' },
  ];
  const r = calculerImpactGouvernance(specs);
  assert.deepEqual(r, ['AIAD-CRA', 'AIAD-RGPD']);
});

test('calculerImpactGouvernance — déduplication entre specs', () => {
  const specs = [
    { avant: null, apres: '---\ngovernance: AIAD-RGPD\n---' },
    { avant: null, apres: '---\ngovernance: AIAD-RGPD\n---' },
  ];
  assert.deepEqual(calculerImpactGouvernance(specs), ['AIAD-RGPD']);
});

test('calculerImpactGouvernance — tri alphabétique', () => {
  const specs = [
    { avant: '---\ngovernance: AIAD-Z,AIAD-A,AIAD-M\n---', apres: null },
  ];
  assert.deepEqual(calculerImpactGouvernance(specs), ['AIAD-A', 'AIAD-M', 'AIAD-Z']);
});

// ─── genererRapportMarkdown ─────────────────────────────────────────────────

test('genererRapportMarkdown — rien à signaler → message explicite', () => {
  const r = genererRapportMarkdown({
    target: 'main',
    intents: { added: [], modified: [], deleted: [], unchanged: [] },
    specs: { added: [], modified: [], deleted: [], unchanged: [] },
    specsTouchees: [],
    gouvernanceImpactee: [],
  });
  assert.match(r, /AIAD SDD — Review vs `main`/);
  assert.match(r, /Aucune modification d'artefact AIAD/);
});

test('genererRapportMarkdown — sections quand modifs présentes', () => {
  const r = genererRapportMarkdown({
    target: 'main',
    intents: { added: ['.aiad/intents/INTENT-001.md'], modified: [], deleted: [], unchanged: [] },
    specs: { added: ['.aiad/specs/SPEC-001-1-x.md'], modified: [], deleted: [], unchanged: [] },
    specsTouchees: [
      { path: '.aiad/specs/SPEC-001-1-x.md', type: 'added', avant: null, apres: '---\ngovernance: AIAD-RGPD\n---' },
    ],
    gouvernanceImpactee: ['AIAD-RGPD'],
  });
  assert.match(r, /## Synthèse/);
  assert.match(r, /## Intents touchés/);
  assert.match(r, /## SPECs touchées/);
  assert.match(r, /## Agents Tier 1 à re-consulter/);
  assert.match(r, /AIAD-RGPD/);
  assert.match(r, /## Recommandations/);
  assert.match(r, /aiad-sdd dpia/);
});

test('genererRapportMarkdown — recommandations conditionnelles', () => {
  // Sans gouvernance, pas de recommandation dpia
  const r = genererRapportMarkdown({
    target: 'main',
    intents: { added: [], modified: [], deleted: [], unchanged: [] },
    specs: { added: ['.aiad/specs/SPEC-x.md'], modified: [], deleted: [], unchanged: [] },
    specsTouchees: [{ path: '.aiad/specs/SPEC-x.md', type: 'added', avant: null, apres: '---\n---' }],
    gouvernanceImpactee: [],
  });
  assert.ok(!r.includes('aiad-sdd dpia'), 'dpia signalé sans gouvernance RGPD');
  assert.match(r, /aiad-sdd trace/);
});

// ─── alias EN ───────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(compareBranches, comparerBranches);
  assert.equal(categorizeFiles, categoriserFichiers);
  assert.equal(extractGovernance, extraireGouvernance);
  assert.equal(computeGovernanceImpact, calculerImpactGouvernance);
  assert.equal(generateMarkdownReport, genererRapportMarkdown);
  assert.equal(listArtifactsAtRef, listerArtefactsRef);
  assert.equal(readFileAtRef, lireFichierRef);
});

// ─── Intégration Git réelle ─────────────────────────────────────────────────

test('comparerBranches — repo non-Git → erreur explicite', () => {
  const d = tmp();
  try {
    assert.throws(() => comparerBranches(d, 'main'), /repo Git/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('comparerBranches — détecte SPEC ajoutée sur la branche courante', () => {
  const d = tmp();
  try {
    setupRepo(d);
    mkdirSync(join(d, '.aiad/specs'), { recursive: true });
    writeFileSync(join(d, 'README.md'), 'init');
    commitAll(d, 'init');
    git(['checkout', '-q', '-b', 'feat/x'], d);
    writeFileSync(join(d, '.aiad/specs/SPEC-001-1-foo.md'),
      '---\ntitle: Foo\ngovernance: AIAD-RGPD\n---\n# SPEC');
    commitAll(d, 'feat: add SPEC foo');

    const r = comparerBranches(d, 'main');
    assert.equal(r.target, 'main');
    assert.equal(r.specs.added.length, 1);
    assert.match(r.specs.added[0], /SPEC-001-1-foo\.md$/);
    assert.equal(r.specs.modified.length, 0);
    assert.equal(r.specs.deleted.length, 0);
    assert.deepEqual(r.gouvernanceImpactee, ['AIAD-RGPD']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('comparerBranches — détecte SPEC modifiée + change de gouvernance', () => {
  const d = tmp();
  try {
    setupRepo(d);
    mkdirSync(join(d, '.aiad/specs'), { recursive: true });
    writeFileSync(join(d, '.aiad/specs/SPEC-001-1-x.md'),
      '---\ngovernance: AIAD-RGPD\n---\n# v1');
    commitAll(d, 'init');

    git(['checkout', '-q', '-b', 'feat/edit'], d);
    writeFileSync(join(d, '.aiad/specs/SPEC-001-1-x.md'),
      '---\ngovernance: AIAD-RGPD,AIAD-CRA\n---\n# v2 modifiée');
    commitAll(d, 'feat: extend governance');

    const r = comparerBranches(d, 'main');
    assert.equal(r.specs.modified.length, 1);
    // Gouvernance avant (RGPD) ET après (RGPD+CRA) sont signalés
    assert.ok(r.gouvernanceImpactee.includes('AIAD-RGPD'));
    assert.ok(r.gouvernanceImpactee.includes('AIAD-CRA'));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('comparerBranches — pas de modif AIAD → tout vide', () => {
  const d = tmp();
  try {
    setupRepo(d);
    writeFileSync(join(d, 'README.md'), 'init');
    commitAll(d, 'init');
    git(['checkout', '-q', '-b', 'feat/code-only'], d);
    writeFileSync(join(d, 'src.js'), 'export const x = 1;');
    git(['add', '-A'], d);
    commitAll(d, 'feat: code only');

    const r = comparerBranches(d, 'main');
    assert.equal(r.specs.added.length, 0);
    assert.equal(r.specs.modified.length, 0);
    assert.equal(r.intents.added.length, 0);
    assert.equal(r.gouvernanceImpactee.length, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerArtefactsRef — filtre archive/ et template', () => {
  const d = tmp();
  try {
    setupRepo(d);
    mkdirSync(join(d, '.aiad/specs/archive'), { recursive: true });
    mkdirSync(join(d, '.aiad/intents'), { recursive: true });
    writeFileSync(join(d, '.aiad/specs/SPEC-001-1-x.md'), 'x');
    writeFileSync(join(d, '.aiad/specs/archive/old.md'), 'old');
    writeFileSync(join(d, '.aiad/specs/spec-ears-template.md'), 'tpl');
    writeFileSync(join(d, '.aiad/intents/INTENT-001.md'), 'i');
    commitAll(d, 'init');

    const r = listerArtefactsRef(d, 'HEAD');
    assert.deepEqual(r.specs, ['.aiad/specs/SPEC-001-1-x.md']);
    assert.deepEqual(r.intents, ['.aiad/intents/INTENT-001.md']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireFichierRef — ref invalide → null', () => {
  const d = tmp();
  try {
    setupRepo(d);
    writeFileSync(join(d, 'a.md'), 'content');
    commitAll(d, 'init');
    assert.equal(lireFichierRef(d, 'nonexistent-ref', 'a.md'), null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
