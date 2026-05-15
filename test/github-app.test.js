// Tests `lib/github-app.js` — GitHub App + Action native (item #115).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  lireArtefact, listerArtefacts, installerArtefact, setup, CONSTANTS,
  // alias EN
  readArtifact, listArtifacts, installArtifact, showSetup,
} from '../lib/github-app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates', '.github');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-gha-')); }
function silent(fn) {
  return (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

// ─── Artefacts catalogue ──────────────────────────────────────────────────

test('CONSTANTS — workflow + manifest définis', () => {
  assert.ok(CONSTANTS.ARTEFACTS.workflow);
  assert.ok(CONSTANTS.ARTEFACTS.manifest);
});

test('templates source existent sur disque', () => {
  for (const id of ['workflow', 'manifest']) {
    const path = join(TEMPLATES_DIR, CONSTANTS.ARTEFACTS[id].source);
    assert.ok(existsSync(path), `${CONSTANTS.ARTEFACTS[id].source} manquant`);
  }
});

test('listerArtefacts — tableau avec id + meta', () => {
  const r = listerArtefacts();
  assert.equal(r.length, 2);
  assert.ok(r.find((a) => a.id === 'workflow'));
  assert.ok(r.find((a) => a.id === 'manifest'));
});

// ─── lireArtefact ─────────────────────────────────────────────────────────

test('lireArtefact — inconnu → throw', () => {
  assert.throws(() => lireArtefact('unknown'), /Artefact inconnu/);
});

test('lireArtefact — workflow contient les étapes AIAD attendues', () => {
  const c = lireArtefact('workflow');
  assert.match(c, /name: AIAD — PR review/);
  assert.match(c, /aiad-sdd review/);
  assert.match(c, /aiad-sdd sovereignty/);
  assert.match(c, /aiad-sdd trace/);
  assert.match(c, /pull-requests: write/);
  assert.match(c, /actions\/github-script/);
});

test('lireArtefact — manifest contient permissions minimales', () => {
  const c = lireArtefact('manifest');
  assert.match(c, /^name: AIAD SDD/m);
  assert.match(c, /default_permissions:/);
  assert.match(c, /pull_requests: write/);
  assert.match(c, /contents: read/);
  assert.match(c, /default_events:/);
  assert.match(c, /- pull_request/);
});

// ─── installerArtefact ────────────────────────────────────────────────────

test('installerArtefact — workflow écrit dans .github/workflows/', silent(() => {
  const d = tmp();
  try {
    const r = installerArtefact(d, 'workflow');
    assert.equal(r.action, 'created');
    assert.ok(existsSync(join(d, '.github', 'workflows', 'aiad-pr-review.yml')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerArtefact — manifest écrit dans .github/', silent(() => {
  const d = tmp();
  try {
    const r = installerArtefact(d, 'manifest');
    assert.equal(r.action, 'created');
    assert.ok(existsSync(join(d, '.github', 'aiad-app-manifest.yml')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerArtefact — artefact inconnu → throw', () => {
  const d = tmp();
  try {
    assert.throws(() => installerArtefact(d, 'unknown'), /Artefact inconnu/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('installerArtefact — fichier existant sans --force → skipped', silent(() => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.github'), { recursive: true });
    writeFileSync(join(d, '.github', 'aiad-app-manifest.yml'), 'EXISTING');
    const r = installerArtefact(d, 'manifest');
    assert.equal(r.action, 'skipped');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerArtefact --force → overwrites', silent(() => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.github'), { recursive: true });
    writeFileSync(join(d, '.github', 'aiad-app-manifest.yml'), 'EXISTING');
    const r = installerArtefact(d, 'manifest', { force: true });
    assert.equal(r.action, 'overwritten');
    const contenu = readFileSync(join(d, '.github', 'aiad-app-manifest.yml'), 'utf-8');
    assert.match(contenu, /name: AIAD SDD/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerArtefact --out custom → cible alternative', silent(() => {
  const d = tmp();
  try {
    installerArtefact(d, 'workflow', { out: 'custom-dir/my-workflow.yml' });
    assert.ok(existsSync(join(d, 'custom-dir', 'my-workflow.yml')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerArtefact --dry-run → pas d\'écriture', silent(() => {
  const d = tmp();
  try {
    const r = installerArtefact(d, 'manifest', { dryRun: true });
    assert.equal(r.action, 'created');
    assert.ok(!existsSync(join(d, '.github', 'aiad-app-manifest.yml')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerArtefact --json → JSON exploitable', () => {
  const d = tmp();
  try {
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { installerArtefact(d, 'workflow', { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.artefact, 'workflow');
    assert.equal(parsed.action, 'created');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── setup ────────────────────────────────────────────────────────────────

test('setup — affichage humain montre les 2 voies', silent(() => {
  setup();
}));

test('setup --json → JSON avec catalog', () => {
  let captured = '';
  const orig = process.stdout.write;
  process.stdout.write = (chunk) => { captured += chunk; return true; };
  try { setup({ json: true }); }
  finally { process.stdout.write = orig; }
  const parsed = JSON.parse(captured);
  assert.ok(parsed.artefacts.length === 2);
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(readArtifact, lireArtefact);
  assert.equal(listArtifacts, listerArtefacts);
  assert.equal(installArtifact, installerArtefact);
  assert.equal(showSetup, setup);
});
