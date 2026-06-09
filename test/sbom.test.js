// Tests `aiad-sdd sbom` — génération SBOM CycloneDX v1.5.
// Anticipation Cyber Resilience Act EU 2024/2847 (compliance 2027).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSbom, genererSbom } from '../lib/sbom.js';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'aiad-sbom-'));
}

function projetSimple(dir, extras = {}) {
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'mon-projet',
        version: '1.2.3',
        description: 'Projet test SBOM',
        license: 'MIT',
        author: 'Steeve <test@example.com>',
        ...extras,
      },
      null,
      2,
    ),
  );
}

test('buildSbom — produit un document CycloneDX v1.5 valide', () => {
  const dir = tmp();
  try {
    projetSimple(dir);
    const sbom = buildSbom(dir);
    assert.equal(sbom.bomFormat, 'CycloneDX');
    assert.equal(sbom.specVersion, '1.5');
    assert.equal(sbom.version, 1);
    assert.match(sbom.serialNumber, /^urn:uuid:[0-9a-f-]+$/);
    assert.ok(sbom.metadata.timestamp.match(/^\d{4}-\d{2}-\d{2}T/));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSbom — métadonnées projet correctes (nom, version, licence)', () => {
  const dir = tmp();
  try {
    projetSimple(dir);
    const sbom = buildSbom(dir);
    assert.equal(sbom.metadata.component.name, 'mon-projet');
    assert.equal(sbom.metadata.component.version, '1.2.3');
    assert.equal(sbom.metadata.component.type, 'application');
    assert.equal(sbom.metadata.component.licenses[0].license.id, 'MIT');
    assert.match(sbom.metadata.component.purl, /^pkg:npm\/mon-projet@1\.2\.3/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSbom — outil générateur identifié comme aiad-sdd', () => {
  const dir = tmp();
  try {
    projetSimple(dir);
    const sbom = buildSbom(dir);
    const tool = sbom.metadata.tools[0];
    assert.equal(tool.vendor, 'AIAD');
    assert.equal(tool.name, 'aiad-sdd');
    assert.match(tool.version, /^\d+\.\d+\.\d+/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSbom — sans lockfile : composants depuis package.json', () => {
  const dir = tmp();
  try {
    projetSimple(dir, {
      dependencies: { lodash: '^4.17.21' },
      devDependencies: { typescript: '~5.0.0' },
    });
    const sbom = buildSbom(dir);
    assert.equal(sbom.components.length, 2);
    const lodash = sbom.components.find((c) => c.name === 'lodash');
    assert.ok(lodash, 'lodash absent');
    assert.equal(lodash.scope, 'required');
    assert.equal(lodash.version, '4.17.21');
    const ts = sbom.components.find((c) => c.name === 'typescript');
    assert.equal(ts.scope, 'optional'); // dev → optional CycloneDX
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSbom — avec lockfile : extrait composants + hashes integrity', () => {
  const dir = tmp();
  try {
    projetSimple(dir, { dependencies: { 'left-pad': '1.3.0' } });
    writeFileSync(
      join(dir, 'package-lock.json'),
      JSON.stringify(
        {
          name: 'mon-projet',
          version: '1.2.3',
          lockfileVersion: 3,
          packages: {
            '': {
              name: 'mon-projet',
              version: '1.2.3',
              dependencies: { 'left-pad': '1.3.0' },
            },
            'node_modules/left-pad': {
              version: '1.3.0',
              resolved: 'https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz',
              integrity: 'sha512-XI5MPzVNApjAyhQzphX8BkmKsKUxD4LdyK24iZeQGinBN9yTQT3bFlCBy/aVx2HrNcqQGsdot8ghrjyrvMCoEA==',
              license: 'WTFPL',
            },
          },
        },
        null,
        2,
      ),
    );
    const sbom = buildSbom(dir);
    assert.equal(sbom.components.length, 1);
    const lp = sbom.components[0];
    assert.equal(lp.name, 'left-pad');
    assert.equal(lp.version, '1.3.0');
    assert.equal(lp.licenses[0].license.id, 'WTFPL');
    assert.ok(lp.hashes && lp.hashes.length === 1);
    assert.equal(lp.hashes[0].alg, 'SHA-512');
    assert.match(lp.hashes[0].content, /^[0-9a-f]+$/);
    assert.ok(lp.externalReferences[0].url.includes('registry.npmjs.org'));
    // graphe de dépendances
    assert.ok(sbom.dependencies.length >= 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSbom — package.json absent : erreur explicite', () => {
  const dir = tmp();
  try {
    assert.throws(() => buildSbom(dir), /package\.json/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('genererSbom — écrit sbom.cdx.json par défaut', async () => {
  const dir = tmp();
  try {
    projetSimple(dir);
    const origLog = console.log;
    console.log = () => {};
    try {
      const r = await genererSbom(dir);
      assert.equal(r.path, join(dir, 'sbom.cdx.json'));
      assert.ok(existsSync(r.path), 'fichier non créé');
      const c = JSON.parse(readFileSync(r.path, 'utf-8'));
      assert.equal(c.bomFormat, 'CycloneDX');
    } finally {
      console.log = origLog;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('genererSbom — option --out personnalise le chemin', async () => {
  const dir = tmp();
  try {
    projetSimple(dir);
    mkdirSync(join(dir, 'compliance'));
    const origLog = console.log;
    console.log = () => {};
    try {
      const r = await genererSbom(dir, { out: 'compliance/bom.json' });
      assert.equal(r.path, join(dir, 'compliance/bom.json'));
      assert.ok(existsSync(r.path));
    } finally {
      console.log = origLog;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('genererSbom — mode --json écrit sur stdout sans fichier', async () => {
  const dir = tmp();
  try {
    projetSimple(dir);
    let captured = '';
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk) => {
      captured += chunk;
      return true;
    };
    try {
      const r = await genererSbom(dir, { json: true });
      assert.equal(r.path, null);
      assert.ok(!existsSync(join(dir, 'sbom.cdx.json')), 'fichier ne devrait pas être écrit');
      const parsed = JSON.parse(captured);
      assert.equal(parsed.bomFormat, 'CycloneDX');
    } finally {
      process.stdout.write = origWrite;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('genererSbom — dry-run n\'écrit rien sur disque', async () => {
  const dir = tmp();
  try {
    projetSimple(dir);
    const origLog = console.log;
    console.log = () => {};
    try {
      await genererSbom(dir, { dryRun: true });
      assert.ok(!existsSync(join(dir, 'sbom.cdx.json')), 'dry-run a écrit le fichier');
    } finally {
      console.log = origLog;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSbom — gère licence absente sans crash', () => {
  const dir = tmp();
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'sans-licence', version: '0.0.1' }),
    );
    const sbom = buildSbom(dir);
    assert.equal(sbom.metadata.component.licenses.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSbom — purl conforme spec npm (pkg:npm/<name>@<version>)', () => {
  const dir = tmp();
  try {
    projetSimple(dir, { dependencies: { '@scope/pkg': '1.0.0' } });
    const sbom = buildSbom(dir);
    const c = sbom.components[0];
    assert.match(c.purl, /^pkg:npm\/.+@.+/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ─── Mutation kills ciblés : composantsDepuisLockfile + normaliseLicense ─────

function avecLockfile(dir, packages) {
  projetSimple(dir, { dependencies: { 'left-pad': '1.3.0' } });
  writeFileSync(
    join(dir, 'package-lock.json'),
    JSON.stringify({ name: 'mon-projet', version: '1.2.3', lockfileVersion: 3, packages }, null, 2),
  );
}

test('buildSbom — bom-ref/purl d\'un composant lockfile portent la version exacte (kill ||→&&)', () => {
  const dir = tmp();
  try {
    avecLockfile(dir, {
      '': { name: 'mon-projet', version: '1.2.3', dependencies: { 'left-pad': '1.3.0' } },
      'node_modules/left-pad': { version: '1.3.0' },
    });
    const lp = buildSbom(dir).components.find((c) => c.name === 'left-pad');
    assert.equal(lp['bom-ref'], 'pkg:npm/left-pad@1.3.0');
    assert.equal(lp.purl, 'pkg:npm/left-pad@1.3.0');
    assert.equal(lp.version, '1.3.0');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSbom — version absente d\'un composant lockfile → "unknown" (kill ||→&&)', () => {
  const dir = tmp();
  try {
    avecLockfile(dir, {
      '': { name: 'mon-projet', version: '1.2.3' },
      'node_modules/sans-version': {},
    });
    const c = buildSbom(dir).components.find((x) => x.name === 'sans-version');
    assert.equal(c.version, 'unknown');
    assert.equal(c['bom-ref'], 'pkg:npm/sans-version@unknown');
    assert.equal(c.purl, 'pkg:npm/sans-version@unknown');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSbom — entrées node_modules cachées (.bin, .cache) exclues (kill !nom || startsWith)', () => {
  const dir = tmp();
  try {
    avecLockfile(dir, {
      '': { name: 'mon-projet', version: '1.2.3' },
      'node_modules/.package-lock.json': { version: '0.0.0' },
      'node_modules/.bin': { version: '0.0.0' },
      'node_modules/real-dep': { version: '2.0.0' },
    });
    const noms = buildSbom(dir).components.map((c) => c.name);
    assert.ok(noms.includes('real-dep'));
    assert.ok(!noms.some((n) => n.startsWith('.')), `composant caché présent : ${noms}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSbom — licence objet {type} normalisée en id (kill === / &&)', () => {
  const dir = tmp();
  try {
    avecLockfile(dir, {
      '': { name: 'mon-projet', version: '1.2.3' },
      'node_modules/obj-license': { version: '1.0.0', license: { type: 'Apache-2.0' } },
    });
    const c = buildSbom(dir).components.find((x) => x.name === 'obj-license');
    assert.equal(c.licenses[0].license.id, 'Apache-2.0');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSbom — licence objet sans type → "unknown" (kill &&→||)', () => {
  const dir = tmp();
  try {
    avecLockfile(dir, {
      '': { name: 'mon-projet', version: '1.2.3' },
      'node_modules/obj-vide': { version: '1.0.0', license: {} },
    });
    const c = buildSbom(dir).components.find((x) => x.name === 'obj-vide');
    assert.equal(c.licenses[0].license.name, 'unknown');
    assert.equal(c.licenses[0].license.id, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSbom — description projet présente reportée dans metadata (kill ||→&&)', () => {
  const dir = tmp();
  try {
    projetSimple(dir, { description: 'Une description bien précise' });
    const sbom = buildSbom(dir);
    assert.equal(sbom.metadata.component.description, 'Une description bien précise');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSbom — lockfile sans racine ("" absent) → dependencies vide sans crash (kill &&→||)', () => {
  const dir = tmp();
  try {
    avecLockfile(dir, {
      'node_modules/orphan': { version: '1.0.0' },
    });
    const sbom = buildSbom(dir);
    assert.deepEqual(sbom.dependencies, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
