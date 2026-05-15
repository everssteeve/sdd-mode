// Tests `lib/dinum.js` — kit d'adoption gouvernementale FR (item #93).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  construirePublicCode, construireKitFranceConnect, evaluerCommunNumerique,
  genererPublicCode, genererFranceConnect, checkCommunNumerique, CONSTANTS,
  // alias EN
  buildPublicCode, buildFranceConnectKit, evaluateCommonsScore,
  generatePublicCode, generateFranceConnect, checkCommons,
} from '../lib/dinum.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-dinum-')); }
function silent(fn) {
  return (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

// ─── construirePublicCode ──────────────────────────────────────────────────

test('construirePublicCode — produit un YAML v0.4 valide', () => {
  const yaml = construirePublicCode({
    name: 'mon-service',
    version: '1.0.0',
    description: 'Service public test.',
    license: 'MIT',
    repository: 'https://github.com/agency/mon-service.git',
  });
  assert.match(yaml, /^publiccodeYmlVersion: '?0\.4'?/m);
  assert.match(yaml, /name: mon-service/);
  assert.match(yaml, /softwareVersion: '?1\.0\.0'?/);
  assert.match(yaml, /license: MIT/);
  assert.match(yaml, /url: '?https:\/\/github\.com\/agency\/mon-service'?/);
  assert.match(yaml, /platforms:/);
  assert.match(yaml, /  - linux/);
  assert.match(yaml, /  - mac/);
  assert.match(yaml, /  - windows/);
  assert.match(yaml, /developmentStatus: stable/);
});

test('construirePublicCode — package.json invalide → throw', () => {
  assert.throws(() => construirePublicCode(null), /package\.json invalide/);
  assert.throws(() => construirePublicCode({}), /package\.json invalide/);
});

test('construirePublicCode — repository objet et nettoyage URL git+', () => {
  const yaml = construirePublicCode({
    name: 'x', version: '1', description: 'd', license: 'EUPL-1.2',
    repository: { type: 'git', url: 'git+https://github.com/agency/x.git' },
  });
  assert.match(yaml, /url: '?https:\/\/github\.com\/agency\/x'?/);
  assert.match(yaml, /license: EUPL-1\.2/);
});

test('construirePublicCode — meta.agency ajoute intendedAudience FR', () => {
  const yaml = construirePublicCode(
    { name: 'x', version: '1' },
    { agency: 'DINUM' },
  );
  assert.match(yaml, /intendedAudience:/);
  assert.match(yaml, /  countries:/);
  assert.match(yaml, /    - fr/);
  assert.match(yaml, /scope:[\s\S]*government/);
});

test('construirePublicCode — features depuis keywords', () => {
  const yaml = construirePublicCode({
    name: 'x', version: '1',
    keywords: ['kw1', 'kw2', 'kw3'],
  });
  assert.match(yaml, /  - kw1/);
  assert.match(yaml, /  - kw2/);
});

test('construirePublicCode — author objet avec email', () => {
  const yaml = construirePublicCode({
    name: 'x', version: '1',
    author: { name: 'Alice', email: 'alice@gouv.fr' },
  });
  assert.match(yaml, /name: Alice/);
  assert.match(yaml, /email: alice@gouv\.fr/);
});

// ─── construireKitFranceConnect ────────────────────────────────────────────

test('construireKitFranceConnect — niveau substantiel par défaut', () => {
  const md = construireKitFranceConnect();
  assert.match(md, /eIDAS substantiel/);
  assert.match(md, /acr_values=`eidas2`/);
  assert.match(md, /partenaires\.franceconnect\.gouv\.fr/);
});

test('construireKitFranceConnect — niveau eleve → FranceConnect+ eidas3', () => {
  const md = construireKitFranceConnect({ niveau: 'eleve' });
  assert.match(md, /eIDAS élevé/);
  assert.match(md, /eidas3/);
  assert.match(md, /FranceConnect\+/);
});

test('construireKitFranceConnect — niveau inconnu → throw', () => {
  assert.throws(
    () => construireKitFranceConnect({ niveau: 'fake' }),
    /Niveau inconnu/,
  );
});

test('construireKitFranceConnect — clientId + redirectUris custom', () => {
  const md = construireKitFranceConnect({
    clientId: 'abc-123',
    redirectUris: ['https://x.fr/cb', 'https://x.fr/logout'],
  });
  assert.match(md, /CLIENT_ID=abc-123/);
  assert.match(md, /https:\/\/x\.fr\/cb/);
  assert.match(md, /https:\/\/x\.fr\/logout/);
});

test('construireKitFranceConnect — scopes custom + descriptions', () => {
  const md = construireKitFranceConnect({
    scopes: ['openid', 'identite_pivot', 'email'],
  });
  assert.match(md, /Adresse e-mail/);
  assert.match(md, /Nom, prénoms/);
});

test('construireKitFranceConnect — sections obligatoires présentes', () => {
  const md = construireKitFranceConnect();
  for (const titre of [
    /## 1\. Inscription du fournisseur/,
    /## 2\. Configuration OIDC/,
    /## 3\. Redirect URIs/,
    /## 4\. Scopes demandés/,
    /## 5\. Conformité/,
    /## 6\. Liens utiles/,
  ]) {
    assert.match(md, titre);
  }
});

// ─── evaluerCommunNumerique ────────────────────────────────────────────────

test('evaluerCommunNumerique — projet vide → score faible', () => {
  const d = tmp();
  try {
    const r = evaluerCommunNumerique(d);
    assert.equal(r.length, 9);
    const ok = r.filter((c) => c.ok).length;
    assert.ok(ok <= 2, `attendu ≤ 2 critères ok pour projet vide, vu ${ok}`);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('evaluerCommunNumerique — projet AIAD-conforme → score élevé', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({
      name: 'x', version: '1', license: 'MIT',
      repository: { url: 'https://github.com/x/y' },
    }));
    writeFileSync(join(d, 'SECURITY.md'), '# Security policy');
    writeFileSync(join(d, 'CONTRIBUTING.md'), '# Contributing');
    writeFileSync(join(d, 'publiccode.yml'), 'publiccodeYmlVersion: 0.4');
    mkdirSync(join(d, '.aiad', 'gouvernance'), { recursive: true });
    for (const f of ['AIAD-RGAA.md', 'AIAD-RGPD.md', 'AIAD-RGESN.md']) {
      writeFileSync(join(d, '.aiad', 'gouvernance', f), '# x');
    }
    writeFileSync(join(d, 'REVERSIBILITY.md'), '# Reversibility');
    const r = evaluerCommunNumerique(d);
    const ok = r.filter((c) => c.ok).length;
    assert.ok(ok >= 8, `attendu ≥ 8 critères ok, vu ${ok} (${r.filter(c => !c.ok).map(c => c.critere).join(', ')})`);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('evaluerCommunNumerique — license non-libre détectée comme non conforme', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({
      name: 'x', version: '1', license: 'Proprietary',
    }));
    const r = evaluerCommunNumerique(d);
    const license = r.find((c) => c.critere === 'license-libre');
    assert.equal(license.ok, false);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── Pipelines CLI ─────────────────────────────────────────────────────────

test('genererPublicCode — écrit publiccode.yml à la racine', silent(() => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({
      name: 'svc', version: '1.0.0', description: 'X', license: 'MIT',
    }));
    const r = genererPublicCode(d);
    assert.ok(existsSync(r.path));
    assert.match(readFileSync(r.path, 'utf-8'), /publiccodeYmlVersion: '?0\.4/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('genererPublicCode --dry-run → aucune écriture', silent(() => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({ name: 'x', version: '1' }));
    const r = genererPublicCode(d, { dryRun: true });
    assert.ok(!existsSync(r.path));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('genererPublicCode --json → stdout JSON', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({ name: 'x', version: '1' }));
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { genererPublicCode(d, { json: true, dryRun: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.ok(parsed.path);
    assert.equal(parsed.dryRun, true);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('genererPublicCode — package.json absent → throw', () => {
  const d = tmp();
  try {
    assert.throws(() => genererPublicCode(d), /package\.json introuvable/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('genererFranceConnect — écrit dans .aiad/dinum/', silent(() => {
  const d = tmp();
  try {
    const r = genererFranceConnect(d);
    assert.ok(existsSync(r.path));
    assert.match(readFileSync(r.path, 'utf-8'), /Kit d'intégration FranceConnect/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('checkCommunNumerique — projet vide → score faible (CLI silent)', silent(() => {
  const d = tmp();
  try {
    const r = checkCommunNumerique(d);
    assert.ok(r.score < 60, `attendu < 60, vu ${r.score}`);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('checkCommunNumerique --json → JSON exploitable', () => {
  const d = tmp();
  try {
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { checkCommunNumerique(d, { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.ok(typeof parsed.score === 'number');
    assert.ok(parsed.total === 9);
    assert.ok(Array.isArray(parsed.criteres));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(buildPublicCode, construirePublicCode);
  assert.equal(buildFranceConnectKit, construireKitFranceConnect);
  assert.equal(evaluateCommonsScore, evaluerCommunNumerique);
  assert.equal(generatePublicCode, genererPublicCode);
  assert.equal(generateFranceConnect, genererFranceConnect);
  assert.equal(checkCommons, checkCommunNumerique);
});

test('CONSTANTS — exposées', () => {
  assert.ok(CONSTANTS.FRANCECONNECT_NIVEAUX);
  assert.equal(Object.keys(CONSTANTS.FRANCECONNECT_NIVEAUX).length, 3);
  assert.ok(CONSTANTS.FRANCECONNECT_SCOPES);
  assert.ok(Array.isArray(CONSTANTS.COMMUN_NUMERIQUE_CRITERES));
  assert.equal(CONSTANTS.COMMUN_NUMERIQUE_CRITERES.length, 9);
});
