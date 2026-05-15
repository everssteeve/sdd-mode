// Tests `aiad-sdd ai-act audit` — pré-remplissage Annexe IV.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { audit } from '../lib/ai-act-audit.js';
import { init } from '../lib/init.js';

function silencer(fn) {
  return async (...args) => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { process.stdout.write = orig; }
  };
}

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-aiact-')); }

test('audit — sans .aiad/ → erreur claire', async () => {
  const d = tmp();
  try {
    await assert.rejects(audit(d, {}), /\.aiad\//);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('audit — projet init complet → rapport généré avec 8 sections Annexe IV', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    writeFileSync(join(d, 'package.json'), JSON.stringify({
      name: 'mon-projet-ia',
      version: '1.0.0',
      author: 'Test SAS <test@aiad.local>',
      description: 'Système de scoring crédit haut risque',
    }));

    const r = await audit(d, {});
    assert.ok(r.path);
    assert.ok(existsSync(r.path));
    const c = readFileSync(r.path, 'utf-8');
    // Frontmatter conforme
    assert.match(c, /^---$/m);
    assert.match(c, /reference: Règlement \(UE\) 2024\/1689/);
    // Les 8 sections de l'Annexe IV
    assert.match(c, /^## 1\. Description générale du système IA/m);
    assert.match(c, /^## 2\. Description détaillée du développement/m);
    assert.match(c, /^## 3\. Monitoring, fonctionnement et contrôle/m);
    assert.match(c, /^## 4\. Système de gestion des risques/m);
    assert.match(c, /^## 5\. Changements significatifs/m);
    assert.match(c, /^## 6\. Standards harmonisés appliqués/m);
    assert.match(c, /^## 7\. Déclaration UE de conformité/m);
    assert.match(c, /^## 8\. Système de monitoring post-marché/m);
    // Métadonnées projet incluses
    assert.match(c, /mon-projet-ia/);
    assert.match(c, /1\.0\.0/);
    assert.match(c, /Test SAS/);
    // Avertissement légal présent
    assert.match(c, /pas un substitut au travail légal/i);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('audit — détecte SPECs marquées governance: AIAD-AI-ACT', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    // Crée 2 SPECs : 1 marquée AI-ACT, 1 non
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-scoring.md'),
      '---\nparent_intent: INTENT-001\nstatus: ready\ngovernance: AIAD-AI-ACT,AIAD-RGPD\n---\n# Scoring crédit\n');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-2-ui.md'),
      '---\nparent_intent: INTENT-001\nstatus: ready\ngovernance: AIAD-RGAA\n---\n# UI\n');

    const r = await audit(d, {});
    const c = readFileSync(r.path, 'utf-8');
    assert.match(c, /SPEC-001-1-scoring/);
    assert.ok(!c.includes('SPEC-001-2-ui'), 'SPEC non-AI-ACT incluse à tort');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('audit — détecte code annoté @governance AIAD-AI-ACT', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    mkdirSync(join(d, 'src'), { recursive: true });
    writeFileSync(join(d, 'src', 'scoring.ts'),
      '// @spec SPEC-001-1\n// @governance AIAD-AI-ACT,AIAD-RGPD\nexport function score() {}\n');
    writeFileSync(join(d, 'src', 'ui.tsx'),
      '// @spec SPEC-001-2\n// @governance AIAD-RGAA\nexport function UI() {}\n');

    const r = await audit(d, {});
    const c = readFileSync(r.path, 'utf-8');
    assert.match(c, /src\/scoring\.ts/);
    // ui.tsx ne doit PAS apparaître (pas annoté AI-ACT)
    assert.ok(!c.includes('src/ui.tsx'));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('audit --dry-run — n\'écrit rien sur disque', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await audit(d, { dryRun: true });
    assert.ok(!existsSync(r.path), 'fichier créé malgré dry-run');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('audit --json — sortie JSON sur stdout sans écrire de fichier', async () => {
  const d = tmp();
  try {
    await silencer(() => init(d, {}))();
    const orig = process.stdout.write.bind(process.stdout);
    let buf = '';
    process.stdout.write = (chunk) => { buf += chunk; return true; };
    try {
      await audit(d, { json: true });
    } finally {
      process.stdout.write = orig;
    }
    const parsed = JSON.parse(buf);
    assert.ok('projet' in parsed);
    assert.ok('specs' in parsed);
    assert.ok('code' in parsed);
    assert.ok('agent' in parsed);
    assert.ok('dateAudit' in parsed);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('audit — agent AIAD-AI-ACT manquant → signalé en section 6', silencer(async () => {
  const d = tmp();
  try {
    await init(d, { sansGouvernance: true });
    const r = await audit(d, {});
    const c = readFileSync(r.path, 'utf-8');
    assert.match(c, /AIAD-AI-ACT manquant/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('audit — out custom respecté', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await audit(d, { out: 'mon-audit.md' });
    assert.ok(existsSync(join(d, 'mon-audit.md')));
    assert.ok(!existsSync(join(d, '.aiad', 'metrics', 'ai-act')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));
