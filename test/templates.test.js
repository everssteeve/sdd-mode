// Tests `aiad-sdd new <template>` — bootstrap projets clés-en-main.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, existsSync, rmSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listerTemplates, templateExiste, creerProjet, listTemplates, createProject } from '../lib/templates.js';
import { setLang } from '../lib/i18n.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-tpl-')); }

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

test('listerTemplates — retourne au moins node-aiad et fastapi-aiad triés alphabétiquement', () => {
  const liste = listerTemplates();
  assert.ok(liste.length >= 2, `attendu ≥ 2 templates, vu ${liste.length}`);
  const ids = liste.map((t) => t.id);
  assert.ok(ids.includes('node-aiad'), 'node-aiad absent');
  assert.ok(ids.includes('fastapi-aiad'), 'fastapi-aiad absent');
  // Tri alpha
  for (let i = 1; i < liste.length; i++) {
    assert.ok(liste[i - 1].id <= liste[i].id, 'liste non triée');
  }
});

test('listerTemplates — chaque template porte les champs obligatoires du manifest', () => {
  for (const t of listerTemplates()) {
    assert.equal(typeof t.id, 'string');
    assert.equal(typeof t.title, 'string');
    assert.equal(typeof t.description, 'string');
    assert.ok(t.description.length > 30, `${t.id} : description trop courte`);
    assert.equal(typeof t.target, 'string');
    assert.ok(['node', 'python', 'rust', 'go'].includes(t.target), `target inconnu : ${t.target}`);
  }
});

test('templateExiste — discrimine valides / invalides', () => {
  assert.equal(templateExiste('node-aiad'), true);
  assert.equal(templateExiste('fastapi-aiad'), true);
  assert.equal(templateExiste('unknown-template'), false);
  assert.equal(templateExiste(''), false);
});

test('alias EN canoniques — listTemplates / templateExists / createProject exportés', () => {
  assert.equal(typeof listTemplates, 'function');
  assert.equal(listTemplates, listerTemplates);
  assert.equal(typeof createProject, 'function');
  assert.equal(createProject, creerProjet);
});

test('creerProjet node-aiad — crée package.json, src/, test/, AIAD préinstallé', silencer(async () => {
  const d = tmp();
  try {
    const dest = join(d, 'mon-app');
    const r = await creerProjet('node-aiad', dest);
    assert.equal(r.template.id, 'node-aiad');
    assert.equal(r.destDir, dest);
    // Fichiers du template
    assert.ok(existsSync(join(dest, 'package.json')));
    assert.ok(existsSync(join(dest, 'src/index.js')));
    assert.ok(existsSync(join(dest, 'test/index.test.js')));
    assert.ok(existsSync(join(dest, 'README.md')));
    assert.ok(existsSync(join(dest, '.gitignore')));
    // AIAD préinstallé
    assert.ok(existsSync(join(dest, '.aiad/AGENT-GUIDE.md')));
    assert.ok(existsSync(join(dest, '.claude/commands')) || existsSync(join(dest, '.claude/skills')));
    assert.ok(existsSync(join(dest, 'AGENTS.md')));
    assert.ok(existsSync(join(dest, 'CLAUDE.md')));
    // package.json correctement interpolé
    const pkg = JSON.parse(readFileSync(join(dest, 'package.json'), 'utf-8'));
    assert.equal(pkg.name, 'node-aiad'); // valeur par défaut = id template
    assert.equal(pkg.type, 'module');
    assert.equal(pkg.engines.node, '>=18');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('creerProjet — interpole {{name}}, {{description}}, {{license}}', silencer(async () => {
  const d = tmp();
  try {
    const dest = join(d, 'app');
    await creerProjet('node-aiad', dest, {
      name: 'mon-projet-fr',
      description: 'Description personnalisée',
      license: 'Apache-2.0',
    });
    const pkg = JSON.parse(readFileSync(join(dest, 'package.json'), 'utf-8'));
    assert.equal(pkg.name, 'mon-projet-fr');
    assert.equal(pkg.description, 'Description personnalisée');
    assert.equal(pkg.license, 'Apache-2.0');
    const readme = readFileSync(join(dest, 'README.md'), 'utf-8');
    assert.match(readme, /^# mon-projet-fr/);
    assert.match(readme, /Description personnalisée/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('creerProjet fastapi-aiad — crée pyproject.toml + app/main.py + tests/', silencer(async () => {
  const d = tmp();
  try {
    const dest = join(d, 'fastapi-app');
    const r = await creerProjet('fastapi-aiad', dest);
    assert.equal(r.template.id, 'fastapi-aiad');
    assert.equal(r.template.target, 'python');
    assert.ok(existsSync(join(dest, 'pyproject.toml')));
    assert.ok(existsSync(join(dest, 'app/main.py')));
    assert.ok(existsSync(join(dest, 'app/__init__.py')));
    assert.ok(existsSync(join(dest, 'tests/test_main.py')));
    // Vérification interpolation pyproject.toml
    const pyproject = readFileSync(join(dest, 'pyproject.toml'), 'utf-8');
    assert.match(pyproject, /name = "fastapi-aiad"/);
    assert.match(pyproject, /requires-python = ">=3\.11"/);
    assert.match(pyproject, /fastapi>=0\.115/);
    // AIAD préinstallé
    assert.ok(existsSync(join(dest, '.aiad/AGENT-GUIDE.md')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('creerProjet — template inconnu lève une erreur explicite', async () => {
  const d = tmp();
  // Force FR : le message d'erreur est localisé (t()), et la locale ambiante
  // du runner (ex. LC_ALL=en_US sur macOS CI) ne doit pas rendre le test flaky.
  setLang('fr');
  try {
    await assert.rejects(
      creerProjet('non-existant', join(d, 'x')),
      /Template inconnu : "non-existant"/,
    );
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('creerProjet — refuse un dossier non vide sans --force', silencer(async () => {
  const d = tmp();
  // Force FR : message localisé (cf. test précédent).
  setLang('fr');
  try {
    const dest = join(d, 'plein');
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(dest, 'existant.txt'), 'déjà là');
    await assert.rejects(
      creerProjet('node-aiad', dest),
      /n'est pas vide/,
    );
    // Avec force : ça passe
    await creerProjet('node-aiad', dest, { force: true });
    assert.ok(existsSync(join(dest, 'package.json')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('creerProjet --dry-run → rien sur disque', silencer(async () => {
  const d = tmp();
  try {
    const dest = join(d, 'preview');
    await creerProjet('node-aiad', dest, { dryRun: true, sansInit: true });
    // dossier potentiellement créé pour init mais aucun fichier template écrit
    if (existsSync(dest)) {
      const contenu = readdirSync(dest);
      // syncFile en dry-run n'écrit pas les fichiers
      assert.ok(!contenu.includes('package.json'), 'package.json créé en dry-run');
    }
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('creerProjet — sansInit option : pas de .aiad/ créé', silencer(async () => {
  const d = tmp();
  try {
    const dest = join(d, 'sansaiad');
    await creerProjet('node-aiad', dest, { sansInit: true });
    assert.ok(existsSync(join(dest, 'package.json')), 'fichiers template absents');
    assert.ok(!existsSync(join(dest, '.aiad')), '.aiad/ créé malgré sansInit');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('node-aiad — src/index.js porte annotations @intent / @spec / @verified-by', () => {
  const path = join('templates', 'projects', 'node-aiad', 'src', 'index.js');
  const c = readFileSync(path, 'utf-8');
  assert.match(c, /@intent INTENT-/);
  assert.match(c, /@spec SPEC-/);
  assert.match(c, /@verified-by/);
});

test('fastapi-aiad — app/main.py porte annotations @intent / @spec / @verified-by', () => {
  const path = join('templates', 'projects', 'fastapi-aiad', 'app', 'main.py');
  const c = readFileSync(path, 'utf-8');
  assert.match(c, /@intent INTENT-/);
  assert.match(c, /@spec SPEC-/);
  assert.match(c, /@verified-by/);
});
