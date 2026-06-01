// Tests `lib/rbac.js` — RBAC léger sur artefacts (item #124).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  chargerTeams, equipesPourEmail, lireOwnership, verifierChangement,
  listerFichiersStages, detecterAuteur, verifier, templateTeams,
  whoami, init, check, CONSTANTS,
  // alias EN
  loadTeams, teamsForEmail, readOwnership, verifyChange,
  listStagedFiles, detectAuthor, checkRbac, teamsTemplate,
  whoAmI, initTeams, checkCli,
} from '../lib/rbac.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-rbac-')); }

function silent(fn) {
  return (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

function setupTeams(racine, contenu) {
  const dir = join(racine, '.aiad', 'rbac');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'teams.yml'), contenu, 'utf-8');
}

function initGit(d) {
  spawnSync('git', ['init', '-q'], { cwd: d });
  spawnSync('git', ['config', 'user.email', 'alice@corp.fr'], { cwd: d });
  spawnSync('git', ['config', 'user.name', 'Alice'], { cwd: d });
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: d });
}

function ecrireSpec(racine, nom, frontmatter, body = 'Body') {
  const dir = join(racine, '.aiad', 'specs');
  mkdirSync(dir, { recursive: true });
  const fm = frontmatter ? `---\n${frontmatter}\n---\n` : '';
  writeFileSync(join(dir, nom), fm + body, 'utf-8');
}

// ─── chargerTeams ─────────────────────────────────────────────────────────

test('chargerTeams — fichier absent → {}', () => {
  const d = tmp();
  try { assert.deepEqual(chargerTeams(d), {}); }
  finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerTeams — YAML parsé en mapping team → members', () => {
  const d = tmp();
  try {
    setupTeams(d, `
equipe-produit:
  - alice@corp.fr
  - bob@corp.fr
equipe-tech:
  - carol@corp.fr
`);
    const r = chargerTeams(d);
    assert.deepEqual(r['equipe-produit'], ['alice@corp.fr', 'bob@corp.fr']);
    assert.deepEqual(r['equipe-tech'], ['carol@corp.fr']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerTeams — membres sans @ filtrés', () => {
  const d = tmp();
  try {
    setupTeams(d, `
equipe-x:
  - alice@corp.fr
  - bad-no-arobase
  - bob@corp.fr
`);
    const r = chargerTeams(d);
    assert.deepEqual(r['equipe-x'], ['alice@corp.fr', 'bob@corp.fr']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── equipesPourEmail ─────────────────────────────────────────────────────

test('equipesPourEmail — match unique', () => {
  const teams = { 'eq-a': ['alice@corp.fr'], 'eq-b': ['bob@corp.fr'] };
  assert.deepEqual(equipesPourEmail(teams, 'alice@corp.fr'), ['eq-a']);
});

test('equipesPourEmail — match multiple', () => {
  const teams = { 'eq-a': ['alice@corp.fr'], 'eq-b': ['alice@corp.fr'] };
  const r = equipesPourEmail(teams, 'alice@corp.fr');
  assert.equal(r.length, 2);
  assert.ok(r.includes('eq-a'));
  assert.ok(r.includes('eq-b'));
});

test('equipesPourEmail — case-insensitive', () => {
  const teams = { 'eq-a': ['Alice@CORP.fr'] };
  assert.deepEqual(equipesPourEmail(teams, 'alice@corp.fr'), ['eq-a']);
});

test('equipesPourEmail — email vide ou invalide → []', () => {
  const teams = { 'eq-a': ['x@y.z'] };
  assert.deepEqual(equipesPourEmail(teams, ''), []);
  assert.deepEqual(equipesPourEmail(teams, 'not-an-email'), []);
});

// ─── lireOwnership ────────────────────────────────────────────────────────

test('lireOwnership — frontmatter vide → owner null + reviewers []', () => {
  assert.deepEqual(lireOwnership('# Body'), { owner: null, reviewers: [] });
});

test('lireOwnership — owner string', () => {
  const c = '---\nowner: equipe-paiements\n---\n# Body';
  assert.deepEqual(lireOwnership(c), { owner: 'equipe-paiements', reviewers: [] });
});

test('lireOwnership — reviewers tableau', () => {
  const c = '---\nowner: x\nreviewers: [equipe-securite, equipe-juridique]\n---\nBody';
  const r = lireOwnership(c);
  assert.deepEqual(r.reviewers, ['equipe-securite', 'equipe-juridique']);
});

test('lireOwnership — reviewers string CSV', () => {
  const c = '---\nreviewers: equipe-securite, equipe-juridique\n---\n';
  const r = lireOwnership(c);
  assert.deepEqual(r.reviewers, ['equipe-securite', 'equipe-juridique']);
});

// ─── verifierChangement ──────────────────────────────────────────────────

test('verifierChangement — pas d\'ownership + non strict → valid', () => {
  const r = verifierChangement({ owner: null, reviewers: [] }, ['eq-a']);
  assert.equal(r.valid, true);
});

test('verifierChangement — pas d\'ownership + strict → violation', () => {
  const r = verifierChangement({ owner: null, reviewers: [] }, [], { strict: true });
  assert.equal(r.valid, false);
  assert.match(r.raison, /strict/);
});

test('verifierChangement — owner OK si auteur dans l\'équipe', () => {
  const r = verifierChangement({ owner: 'eq-a', reviewers: [] }, ['eq-a']);
  assert.equal(r.valid, true);
});

test('verifierChangement — owner non OK si auteur hors équipe', () => {
  const r = verifierChangement({ owner: 'eq-a', reviewers: [] }, ['eq-b']);
  assert.equal(r.valid, false);
  assert.match(r.raison, /n'appartient pas/);
});

test('verifierChangement — reviewers présents mais owner absent → valid (reviewers ≠ pre-commit)', () => {
  const r = verifierChangement({ owner: null, reviewers: ['eq-securite'] }, ['eq-a']);
  // Reviewers seuls : pas bloquant au pre-commit (vérif post-merge via CI)
  assert.equal(r.valid, true);
});

// ─── listerFichiersStages + verifier ─────────────────────────────────────

test('listerFichiersStages — repo non-git → []', () => {
  const d = tmp();
  try { assert.deepEqual(listerFichiersStages(d), []); }
  finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerFichiersStages — restreint à intents/specs', () => {
  const d = tmp();
  try {
    initGit(d);
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    mkdirSync(join(d, 'src'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'), 'x');
    writeFileSync(join(d, 'src', 'app.ts'), 'x');
    spawnSync('git', ['add', '-A'], { cwd: d });
    const r = listerFichiersStages(d);
    assert.deepEqual(r, ['.aiad/specs/SPEC-001-1-x.md']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('detecterAuteur — git user.email', () => {
  const d = tmp();
  try {
    initGit(d);
    assert.equal(detecterAuteur(d), 'alice@corp.fr');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── verifier (pipeline) ─────────────────────────────────────────────────

test('verifier — pas de stagés → valid', () => {
  const d = tmp();
  try {
    initGit(d);
    const r = verifier(d);
    assert.equal(r.valid, true);
    assert.equal(r.stages, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('verifier — SPEC sans ownership → valid (non strict)', () => {
  const d = tmp();
  try {
    initGit(d);
    ecrireSpec(d, 'SPEC-001-1-x.md');
    spawnSync('git', ['add', '-A'], { cwd: d });
    const r = verifier(d);
    assert.equal(r.valid, true);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('verifier — SPEC owner mais auteur hors équipe → violation', () => {
  const d = tmp();
  try {
    initGit(d);
    setupTeams(d, 'equipe-paiements:\n  - carol@corp.fr\n');
    ecrireSpec(d, 'SPEC-001-1-x.md', 'owner: equipe-paiements');
    spawnSync('git', ['add', '-A'], { cwd: d });
    const r = verifier(d);
    assert.equal(r.valid, false);
    assert.equal(r.violations.length, 1);
    assert.match(r.violations[0].raison, /equipe-paiements/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('verifier — SPEC owner avec auteur OK → valid', () => {
  const d = tmp();
  try {
    initGit(d);
    setupTeams(d, 'equipe-paiements:\n  - alice@corp.fr\n');
    ecrireSpec(d, 'SPEC-001-1-x.md', 'owner: equipe-paiements');
    spawnSync('git', ['add', '-A'], { cwd: d });
    const r = verifier(d);
    assert.equal(r.valid, true);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('verifier — strict mode + SPEC sans ownership → violation', () => {
  const d = tmp();
  try {
    initGit(d);
    ecrireSpec(d, 'SPEC-001-1-x.md');
    spawnSync('git', ['add', '-A'], { cwd: d });
    const r = verifier(d, { strict: true });
    assert.equal(r.valid, false);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('verifier — author option override git config', () => {
  const d = tmp();
  try {
    initGit(d);
    setupTeams(d, 'eq-a:\n  - eve@corp.fr\n');
    ecrireSpec(d, 'SPEC-001-1-x.md', 'owner: eq-a');
    spawnSync('git', ['add', '-A'], { cwd: d });
    // Alice n'est pas dans eq-a → violation
    const r1 = verifier(d);
    assert.equal(r1.valid, false);
    // Mais en passant eve via override
    const r2 = verifier(d, { author: 'eve@corp.fr' });
    assert.equal(r2.valid, true);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── templateTeams + init ────────────────────────────────────────────────

test('templateTeams — contient sections clés + parseable', () => {
  const t = templateTeams();
  assert.match(t, /equipe-produit:/);
  assert.match(t, /equipe-securite:/);
  assert.match(t, /alice@corp\.fr/);
});

test('init — crée .aiad/rbac/teams.yml', () => {
  const d = tmp();
  try {
    const r = init(d);
    assert.match(r.path, /teams\.yml$/);
    assert.ok(existsSync(join(d, '.aiad', 'rbac', 'teams.yml')));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('init — fichier existant sans --force → throw', () => {
  const d = tmp();
  try {
    setupTeams(d, 'x: []');
    assert.throws(() => init(d), /existe déjà/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('init --force → écrase', () => {
  const d = tmp();
  try {
    setupTeams(d, 'x: []');
    init(d, { force: true });
    const c = readFileSync(join(d, '.aiad', 'rbac', 'teams.yml'), 'utf-8');
    assert.match(c, /equipe-produit/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── whoami / check (CLI) ────────────────────────────────────────────────

test('whoami --json → email + teams', () => {
  const d = tmp();
  try {
    initGit(d);
    setupTeams(d, 'eq-a:\n  - alice@corp.fr\n');
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { whoami(d, { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.email, 'alice@corp.fr');
    assert.deepEqual(parsed.teams, ['eq-a']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('check --json → format structuré', () => {
  const d = tmp();
  try {
    initGit(d);
    setupTeams(d, 'eq-a:\n  - alice@corp.fr\n');
    ecrireSpec(d, 'SPEC-001-1-x.md', 'owner: eq-a');
    spawnSync('git', ['add', '-A'], { cwd: d });
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { check(d, { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.stages, 1);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(loadTeams, chargerTeams);
  assert.equal(teamsForEmail, equipesPourEmail);
  assert.equal(readOwnership, lireOwnership);
  assert.equal(verifyChange, verifierChangement);
  assert.equal(listStagedFiles, listerFichiersStages);
  assert.equal(detectAuthor, detecterAuteur);
  assert.equal(checkRbac, verifier);
  assert.equal(teamsTemplate, templateTeams);
  assert.equal(whoAmI, whoami);
  assert.equal(initTeams, init);
  assert.equal(checkCli, check);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.TEAMS_PATH, '.aiad/rbac/teams.yml');
});
