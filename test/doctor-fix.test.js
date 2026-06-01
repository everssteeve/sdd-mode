// Tests `lib/doctor-fix.js` — auto-réparation doctor (item #125).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  detecterFixes, appliquerFix, fix, CONSTANTS,
  // alias EN
  detectFixes, applyFix, runFix,
} from '../lib/doctor-fix.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-dfix-')); }

function silent(fn) {
  return (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

// ─── detecterFixes ────────────────────────────────────────────────────────

test('detecterFixes — projet vide → liste tous les dossiers requis', () => {
  const d = tmp();
  try {
    const fixes = detecterFixes(d);
    const kinds = fixes.map((f) => f.kind);
    assert.ok(kinds.includes('create-directory'));
    // 4 dossiers requis : intents, specs, gouvernance, metrics
    const dirs = fixes.filter((f) => f.kind === 'create-directory');
    assert.equal(dirs.length, 4);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('detecterFixes — dossiers déjà présents → pas de fix dossier', () => {
  const d = tmp();
  try {
    for (const sous of ['intents', 'specs', 'gouvernance', 'metrics']) {
      mkdirSync(join(d, '.aiad', sous), { recursive: true });
    }
    const fixes = detecterFixes(d);
    const dirs = fixes.filter((f) => f.kind === 'create-directory');
    assert.equal(dirs.length, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('detecterFixes — _index.md placeholders détectés si dossier existe', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    const fixes = detecterFixes(d);
    const indexes = fixes.filter((f) => f.kind === 'create-index');
    assert.equal(indexes.length, 2);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('detecterFixes — _index.md existant → pas de fix index', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', '_index.md'), '# Custom index');
    const fixes = detecterFixes(d);
    const indexes = fixes.filter((f) => f.kind === 'create-index' && f.path.includes('intents'));
    assert.equal(indexes.length, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('detecterFixes — Intent sans frontmatter → fix add-frontmatter', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'INT-001-mon-intent.md'), '# Sans frontmatter');
    const fixes = detecterFixes(d);
    const fm = fixes.filter((f) => f.kind === 'add-frontmatter');
    assert.equal(fm.length, 1);
    assert.match(fm[0].path, /INT-001/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('detecterFixes — Intent avec title → pas de fix frontmatter', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'INT-001-x.md'),
      '---\ntitle: Existant\n---\n# Body');
    const fixes = detecterFixes(d);
    const fm = fixes.filter((f) => f.kind === 'add-frontmatter');
    assert.equal(fm.length, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('detecterFixes — _index.md et spec-ears-template ignorés', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', '_index.md'), '# idx');
    writeFileSync(join(d, '.aiad', 'specs', 'spec-ears-template.md'), '# tpl');
    const fixes = detecterFixes(d);
    const fm = fixes.filter((f) => f.kind === 'add-frontmatter');
    assert.equal(fm.length, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('detecterFixes — fichiers non-INT/SPEC ignorés', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'README.md'), '# rdm');
    const fixes = detecterFixes(d);
    const fm = fixes.filter((f) => f.kind === 'add-frontmatter');
    assert.equal(fm.length, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── appliquerFix ────────────────────────────────────────────────────────

test('appliquerFix — create-directory crée le dossier', () => {
  const d = tmp();
  try {
    const r = appliquerFix(d, { kind: 'create-directory', path: '.aiad/intents', label: 'x' });
    assert.equal(r.applied, true);
    assert.ok(existsSync(join(d, '.aiad', 'intents')));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('appliquerFix — create-directory idempotent', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    const r = appliquerFix(d, { kind: 'create-directory', path: '.aiad/intents', label: 'x' });
    assert.equal(r.applied, false);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('appliquerFix — create-index écrit le placeholder', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    const r = appliquerFix(d, {
      kind: 'create-index', path: '.aiad/intents/_index.md',
      label: 'x', content: '# placeholder',
    });
    assert.equal(r.applied, true);
    assert.equal(readFileSync(join(d, '.aiad', 'intents', '_index.md'), 'utf-8'), '# placeholder');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('appliquerFix — add-frontmatter génère un title depuis le nom', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    const file = join(d, '.aiad', 'intents', 'INT-042-export-donnees.md');
    writeFileSync(file, '# Body sans frontmatter');
    const r = appliquerFix(d, {
      kind: 'add-frontmatter',
      path: '.aiad/intents/INT-042-export-donnees.md',
      label: 'x', file,
    });
    assert.equal(r.applied, true);
    const c = readFileSync(file, 'utf-8');
    assert.match(c, /title: ['"]?Export Donnees['"]?/);
    assert.match(c, /# Body sans frontmatter/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('appliquerFix — add-frontmatter préserve le body existant', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    const file = join(d, '.aiad', 'specs', 'SPEC-001-1-auth.md');
    const body = '# Heading\n\nContenu paragraphe.\n\n## Section\n\nDétails.';
    writeFileSync(file, body);
    appliquerFix(d, {
      kind: 'add-frontmatter',
      path: '.aiad/specs/SPEC-001-1-auth.md',
      label: 'x', file,
    });
    const c = readFileSync(file, 'utf-8');
    assert.match(c, /Heading/);
    assert.match(c, /Contenu paragraphe/);
    assert.match(c, /## Section/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('appliquerFix — kind inconnu → applied=false', () => {
  const d = tmp();
  try {
    const r = appliquerFix(d, { kind: 'mystery', path: 'x', label: 'x' });
    assert.equal(r.applied, false);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── fix (pipeline) ──────────────────────────────────────────────────────

test('fix — dry-run par défaut, ne touche rien', silent(() => {
  const d = tmp();
  try {
    const r = fix(d);
    assert.equal(r.dryRun, true);
    assert.ok(r.detected > 0);
    assert.equal(r.applied, 0);
    assert.ok(!existsSync(join(d, '.aiad', 'intents')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('fix --apply → crée effectivement les structures', silent(() => {
  const d = tmp();
  try {
    const r = fix(d, { apply: true });
    assert.equal(r.dryRun, false);
    assert.ok(r.applied > 0);
    assert.ok(existsSync(join(d, '.aiad', 'intents')));
    assert.ok(existsSync(join(d, '.aiad', 'specs')));
    assert.ok(existsSync(join(d, '.aiad', 'gouvernance')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('fix --apply idempotent (2 runs successifs)', silent(() => {
  const d = tmp();
  try {
    fix(d, { apply: true });
    const r2 = fix(d, { apply: true });
    // Au 2e run, aucun fix à appliquer (mais le dossier metrics pourrait
    // garder un _index manquant si pas créé). Le total détecté doit être 0.
    assert.equal(r2.detected, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('fix — projet propre → aucun fix', silent(() => {
  const d = tmp();
  try {
    for (const sous of ['intents', 'specs', 'gouvernance', 'metrics']) {
      mkdirSync(join(d, '.aiad', sous), { recursive: true });
    }
    writeFileSync(join(d, '.aiad', 'intents', '_index.md'), '# x');
    writeFileSync(join(d, '.aiad', 'specs', '_index.md'), '# x');
    const r = fix(d);
    assert.equal(r.detected, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('fix --json → JSON exploitable', () => {
  const d = tmp();
  try {
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { fix(d, { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.ok(typeof parsed.detected === 'number');
    assert.equal(parsed.dryRun, true);
    assert.ok(Array.isArray(parsed.fixes));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('fix — frontmatter d\'un Intent corrigé après --apply', silent(() => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'INT-001-x.md'), '# Body');
    fix(d, { apply: true });
    const c = readFileSync(join(d, '.aiad', 'intents', 'INT-001-x.md'), 'utf-8');
    assert.match(c, /^---/);
    assert.match(c, /title:/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(detectFixes, detecterFixes);
  assert.equal(applyFix, appliquerFix);
  assert.equal(runFix, fix);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.DOSSIERS_REQUIS.length, 4);
  assert.equal(CONSTANTS.INDEX_PLACEHOLDERS.length, 2);
});
