// Tests `aiad-sdd dpia` — pré-remplissage AIPD Article 35 RGPD.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dpia } from '../lib/dpia.js';
import { init } from '../lib/init.js';

function silencer(fn) {
  return async (...args) => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { process.stdout.write = orig; }
  };
}

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-dpia-')); }

test('dpia — sans .aiad/ → erreur claire', async () => {
  const d = tmp();
  try {
    await assert.rejects(dpia(d, {}), /\.aiad\//);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('dpia — projet init complet → rapport généré avec 9 sections AIPD', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    writeFileSync(join(d, 'package.json'), JSON.stringify({
      name: 'app-rh',
      version: '2.1.0',
      author: 'Acme Corp <dpo@acme.fr>',
      description: 'Application RH avec gestion des données salariés',
    }));

    const r = await dpia(d, {});
    assert.ok(r.path, 'path absent');
    assert.ok(existsSync(r.path));
    const c = readFileSync(r.path, 'utf-8');
    // Frontmatter conforme RGPD
    assert.match(c, /^---$/m);
    assert.match(c, /reference: Règlement \(UE\) 2016\/679/);
    assert.match(c, /Article 35/);
    // Les 9 sections de l'AIPD CNIL
    assert.match(c, /^## 1\. Description du traitement/m);
    assert.match(c, /^## 2\. Évaluation de la nécessité et proportionnalité/m);
    assert.match(c, /^## 3\. Évaluation des risques pour les droits et libertés/m);
    assert.match(c, /^## 4\. Mesures techniques et organisationnelles/m);
    assert.match(c, /^## 5\. Consultation du DPO/m);
    assert.match(c, /^## 6\. Consultation préalable de la CNIL/m);
    assert.match(c, /^## 7\. Validation et signature/m);
    assert.match(c, /^## 8\. Plan d'action et monitoring/m);
    assert.match(c, /^## 9\. Annexes/m);
    // Méthode CNIL — 3 risques génériques
    assert.match(c, /Accès illégitime/);
    assert.match(c, /Modification non désirée/);
    assert.match(c, /Disparition/);
    // Métadonnées projet
    assert.match(c, /app-rh/);
    assert.match(c, /2\.1\.0/);
    assert.match(c, /Acme Corp/);
    // Avertissement légal présent
    assert.match(c, /pas un substitut/i);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('dpia — chemin de sortie par défaut .aiad/metrics/rgpd/DPIA-YYYY-MM-DD.md', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await dpia(d, {});
    assert.match(r.path, /\.aiad\/metrics\/rgpd\/DPIA-\d{4}-\d{2}-\d{2}\.md$/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('dpia — détecte SPECs marquées governance: AIAD-RGPD', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    // 2 SPECs marquées RGPD, 1 non.
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-export.md'),
      '---\nparent_intent: INTENT-001\nstatus: ready\ngovernance: AIAD-RGPD\ntitle: Export RGPD\n---\n# Export RGPD\n');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-2-effacement.md'),
      '---\nparent_intent: INTENT-001\nstatus: validated\ngovernance: AIAD-RGPD,AIAD-AI-ACT\ntitle: Effacement\n---\n# Effacement\n');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-3-ui.md'),
      '---\nparent_intent: INTENT-001\nstatus: ready\ngovernance: AIAD-RGAA\ntitle: UI\n---\n# UI\n');

    const r = await dpia(d, {});
    const c = readFileSync(r.path, 'utf-8');
    assert.match(c, /SPEC-001-1-export/);
    assert.match(c, /SPEC-001-2-effacement/);
    // SPEC-001-3 (RGAA seul) ne doit PAS apparaître dans la liste
    assert.ok(!/SPEC-001-3-ui/.test(c), 'SPEC RGAA listée à tort');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('dpia — détecte code annoté @governance AIAD-RGPD', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    writeFileSync(join(d, 'auth.ts'), '// @spec SPEC-001-1\n// @governance AIAD-RGPD\nexport function login() {}\n');
    writeFileSync(join(d, 'ui.ts'), '// @spec SPEC-001-3\n// @governance AIAD-RGAA\nexport function btn() {}\n');

    const r = await dpia(d, {});
    const c = readFileSync(r.path, 'utf-8');
    assert.match(c, /auth\.ts/);
    assert.ok(!/ui\.ts/.test(c), 'fichier RGAA listé à tort');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('dpia — agent AIAD-RGPD installé → flag installé', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await dpia(d, {});
    const c = readFileSync(r.path, 'utf-8');
    assert.match(c, /Installé dans/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('dpia — agent AIAD-RGPD manquant → message warning', silencer(async () => {
  const d = tmp();
  try {
    await init(d, { sansGouvernance: true });
    const r = await dpia(d, {});
    const c = readFileSync(r.path, 'utf-8');
    assert.match(c, /AIAD-RGPD manquant/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('dpia — dry-run n\'écrit rien sur disque', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await dpia(d, { dryRun: true });
    assert.ok(!existsSync(r.path), 'dry-run a écrit le fichier');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('dpia — option --json écrit JSON exploitable, sans fichier', async () => {
  const d = tmp();
  try {
    await init(d, {});
    let captured = '';
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk) => {
      captured += chunk;
      return true;
    };
    try {
      const r = await dpia(d, { json: true });
      assert.equal(r.path, null);
      const parsed = JSON.parse(captured);
      assert.equal(typeof parsed.date, 'string');
      assert.match(parsed.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(Array.isArray(parsed.specs));
      assert.ok(Array.isArray(parsed.code));
      assert.equal(parsed.agent.installed, true);
    } finally {
      process.stdout.write = origWrite;
    }
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('dpia — option --out custom respectée', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await dpia(d, { out: 'compliance/dpia.md' });
    assert.equal(r.path, join(d, 'compliance/dpia.md'));
    assert.ok(existsSync(r.path));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));
