// Tests `aiad-sdd import` — migration depuis Spec Kit / Kiro.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detecter, importer, detect, importFromExternal } from '../lib/import.js';
import { init } from '../lib/init.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-import-')); }

function silencer(fn) {
  return async (...args) => {
    const origLog = console.log;
    const origWrite = process.stdout.write.bind(process.stdout);
    console.log = () => {};
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { console.log = origLog; process.stdout.write = origWrite; }
  };
}

function fixtureSpecKit(racine, feature = 'login', avecPlan = true, avecTasks = true) {
  const dir = join(racine, 'specs', feature);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'spec.md'), `# ${feature}\n\nDescription importée.\n`);
  if (avecPlan) writeFileSync(join(dir, 'plan.md'), `# Plan\n\nÉtapes...\n`);
  if (avecTasks) writeFileSync(join(dir, 'tasks.md'), `# Tasks\n\n- [ ] T1\n`);
}

function fixtureKiro(racine, feature = 'checkout') {
  const sd = join(racine, '.kiro', 'specs', feature);
  mkdirSync(sd, { recursive: true });
  writeFileSync(join(sd, 'requirements.md'), `# ${feature} requirements\n\nL'utilisateur peut...\n`);
  writeFileSync(join(sd, 'design.md'), `# ${feature} design\n\nArchitecture...\n`);
  writeFileSync(join(sd, 'tasks.md'), `# ${feature} tasks\n\n- T1\n- T2\n`);

  const sg = join(racine, '.kiro', 'steering');
  mkdirSync(sg, { recursive: true });
  writeFileSync(join(sg, 'style.md'), `# Style\n\nFrançais court.\n`);
  writeFileSync(join(sg, 'tech.md'), `# Tech\n\nNode 22.\n`);
}

// ─── Détection ──────────────────────────────────────────────────────────────

test('detecter — répertoire vide → null', () => {
  const d = tmp();
  try { assert.equal(detecter(d), null); }
  finally { rmSync(d, { recursive: true, force: true }); }
});

test('detecter — Spec Kit via specs/<name>/spec.md', () => {
  const d = tmp();
  try {
    fixtureSpecKit(d);
    assert.equal(detecter(d), 'spec-kit');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('detecter — Spec Kit via .specify/ (CLI marker)', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.specify'));
    assert.equal(detecter(d), 'spec-kit');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('detecter — Kiro via .kiro/specs/', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.kiro', 'specs'), { recursive: true });
    assert.equal(detecter(d), 'kiro');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('detecter — Kiro via .kiro/steering/', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.kiro', 'steering'), { recursive: true });
    assert.equal(detecter(d), 'kiro');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('detecter — Kiro prime sur Spec Kit (les deux présents)', () => {
  const d = tmp();
  try {
    fixtureSpecKit(d);
    mkdirSync(join(d, '.kiro', 'specs'), { recursive: true });
    assert.equal(detecter(d), 'kiro');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('alias EN — detect / importFromExternal exportés', () => {
  assert.equal(detect, detecter);
  assert.equal(importFromExternal, importer);
});

// ─── Import Spec Kit ────────────────────────────────────────────────────────

test('importer spec-kit — produit SPEC-001-1-<slug>.md avec frontmatter source', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    fixtureSpecKit(d, 'user-login');
    const r = await importer(d);
    assert.equal(r.source, 'spec-kit');
    assert.equal(r.stats.specs, 1);
    assert.equal(r.stats.intents, 0);
    const path = join(d, '.aiad', 'specs', 'SPEC-001-1-user-login.md');
    assert.ok(existsSync(path));
    const c = readFileSync(path, 'utf-8');
    assert.match(c, /source: spec-kit/);
    assert.match(c, /source-dir: specs\/user-login/);
    assert.match(c, /## Spécification/);
    assert.match(c, /## Plan technique/);
    assert.match(c, /## Tâches/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('importer spec-kit — sans plan/tasks, ne crée que la section Spécification', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    fixtureSpecKit(d, 'minimal', false, false);
    const r = await importer(d);
    assert.equal(r.stats.specs, 1);
    const c = readFileSync(join(d, '.aiad/specs/SPEC-001-1-minimal.md'), 'utf-8');
    assert.match(c, /## Spécification/);
    assert.ok(!/## Plan technique/.test(c), 'plan non attendu');
    assert.ok(!/## Tâches/.test(c), 'tâches non attendues');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('importer spec-kit — multiple SPECs incrémente le numéro', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    fixtureSpecKit(d, 'feat-a');
    fixtureSpecKit(d, 'feat-b');
    fixtureSpecKit(d, 'feat-c');
    const r = await importer(d);
    assert.equal(r.stats.specs, 3);
    // Numéros incrémentés (ordre alphabétique des dossiers)
    const fichiers = readFileSync(join(d, '.aiad', 'specs', '_index.md'), 'utf-8'); // ne fait que vérifier que le dossier est rempli
    assert.ok(fichiers); // simplement non-null
    for (const id of ['SPEC-001-1-feat-a', 'SPEC-002-1-feat-b', 'SPEC-003-1-feat-c']) {
      assert.ok(existsSync(join(d, '.aiad', 'specs', `${id}.md`)), `${id} absent`);
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

// ─── Import Kiro ────────────────────────────────────────────────────────────

test('importer kiro — produit Intent + SPEC + steering fusionné', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    fixtureKiro(d, 'paiement');
    const r = await importer(d);
    assert.equal(r.source, 'kiro');
    assert.equal(r.stats.intents, 1);
    assert.equal(r.stats.specs, 1);
    assert.equal(r.stats.steering, true);

    const intent = readFileSync(join(d, '.aiad/intents/INTENT-001.md'), 'utf-8');
    assert.match(intent, /source: kiro/);
    assert.match(intent, /## Pourquoi \(à compléter\)/);
    assert.match(intent, /## Exigences importées/);

    const spec = readFileSync(join(d, '.aiad/specs/SPEC-001-1-paiement.md'), 'utf-8');
    assert.match(spec, /parent_intent: INTENT-001/);
    assert.match(spec, /## Design technique/);
    assert.match(spec, /## Tâches/);

    const guide = readFileSync(join(d, '.aiad/AGENT-GUIDE.md'), 'utf-8');
    assert.match(guide, /## Steering importé depuis Kiro/);
    assert.match(guide, /Style/);
    assert.match(guide, /Tech/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('importer kiro — re-import ne duplique pas le steering', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    fixtureKiro(d);
    await importer(d);
    await importer(d, { force: true });
    const guide = readFileSync(join(d, '.aiad/AGENT-GUIDE.md'), 'utf-8');
    const occurrences = (guide.match(/## Steering importé depuis Kiro/g) || []).length;
    assert.equal(occurrences, 1, 'steering dupliqué');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

// ─── Idempotence + force ────────────────────────────────────────────────────

test('importer — préserve les SPECs existantes sans --force', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    fixtureSpecKit(d, 'auth');
    await importer(d);
    const path = join(d, '.aiad/specs/SPEC-001-1-auth.md');
    const original = readFileSync(path, 'utf-8');
    // Modifier le source pour pouvoir détecter l'écrasement
    writeFileSync(join(d, 'specs/auth/spec.md'), '# auth\n\nVersion modifiée.\n');
    await importer(d);
    const apres = readFileSync(path, 'utf-8');
    assert.equal(apres, original, 'SPEC importée écrasée sans --force');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('importer --force → réimporte par-dessus', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    fixtureSpecKit(d, 'auth');
    await importer(d);
    writeFileSync(join(d, 'specs/auth/spec.md'), '# auth\n\nVersion 2.\n');
    await importer(d, { force: true });
    const c = readFileSync(join(d, '.aiad/specs/SPEC-001-1-auth.md'), 'utf-8');
    assert.match(c, /Version 2/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('importer --dry-run → aucun fichier écrit', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    fixtureSpecKit(d, 'preview');
    await importer(d, { dryRun: true });
    assert.ok(!existsSync(join(d, '.aiad/specs/SPEC-001-1-preview.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

// ─── Erreurs ────────────────────────────────────────────────────────────────

test('importer — sans .aiad/ → erreur explicite', async () => {
  const d = tmp();
  try {
    fixtureSpecKit(d);
    await assert.rejects(importer(d), /\.aiad\//);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('importer — auto-détection vide → erreur explicite', async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad'));
    await assert.rejects(importer(d), /Aucune structure/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('importer --from inconnu → erreur', async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad'));
    await assert.rejects(importer(d, { from: 'wat' }), /Source inconnue/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('importer --from forcé écrase l\'auto-détection', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    fixtureKiro(d, 'k');
    fixtureSpecKit(d, 'sk');
    // Auto-détection retournerait kiro, on force spec-kit
    const r = await importer(d, { from: 'spec-kit' });
    assert.equal(r.source, 'spec-kit');
    assert.equal(r.stats.intents, 0);
    assert.equal(r.stats.specs, 1);
    assert.ok(existsSync(join(d, '.aiad/specs/SPEC-001-1-sk.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));
