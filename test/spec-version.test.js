// Tests `lib/spec-version.js` — versioning sémantique SPEC (item #104).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseVersion, compareVersions, bumpVersion,
  lireVersion, chargerSpec, extraireCriteres, detectBreaking, validerBump,
  bumpSpec, CONSTANTS,
  // alias EN
  parseSemver, compareSemver, bumpSemver,
  readVersion, loadSpec, extractCriteria, detectBreakingChanges, validateBump,
  bumpSpecVersion,
} from '../lib/spec-version.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-sv-')); }
function silent(fn) {
  return async (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return await fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

// ─── parseVersion ──────────────────────────────────────────────────────────

test('parseVersion — formes valides', () => {
  assert.deepEqual(parseVersion('1.0.0'), { major: 1, minor: 0, patch: 0 });
  assert.deepEqual(parseVersion('12.34.56'), { major: 12, minor: 34, patch: 56 });
});

test('parseVersion — formes invalides → null', () => {
  assert.equal(parseVersion('1.0'), null);
  assert.equal(parseVersion('v1.0.0'), null);
  assert.equal(parseVersion('1.0.0-beta'), null);
  assert.equal(parseVersion(null), null);
  assert.equal(parseVersion(42), null);
});

// ─── compareVersions ──────────────────────────────────────────────────────

test('compareVersions — ordre', () => {
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('1.0.0', '1.0.1'), -1);
  assert.equal(compareVersions('1.1.0', '1.0.9'), 1);
  assert.equal(compareVersions('2.0.0', '1.99.99'), 1);
});

test('compareVersions — version invalide → throw', () => {
  assert.throws(() => compareVersions('xxx', '1.0.0'), /invalide/);
});

// ─── bumpVersion ───────────────────────────────────────────────────────────

test('bumpVersion — major reset minor/patch', () => {
  assert.equal(bumpVersion('1.5.3', 'major'), '2.0.0');
});

test('bumpVersion — minor reset patch', () => {
  assert.equal(bumpVersion('1.5.3', 'minor'), '1.6.0');
});

test('bumpVersion — patch incrémente patch', () => {
  assert.equal(bumpVersion('1.5.3', 'patch'), '1.5.4');
});

test('bumpVersion — kind inconnu → throw', () => {
  assert.throws(() => bumpVersion('1.0.0', 'release'), /Type de bump/);
});

test('bumpVersion — version invalide → traite comme 0.0.0', () => {
  assert.equal(bumpVersion('garbage', 'major'), '1.0.0');
});

// ─── lireVersion / chargerSpec ────────────────────────────────────────────

test('lireVersion — frontmatter sans version → 1.0.0 par défaut', () => {
  assert.equal(lireVersion({ frontmatter: {} }), '1.0.0');
  assert.equal(lireVersion({ frontmatter: { version: 'invalid' } }), '1.0.0');
});

test('lireVersion — version valide retournée', () => {
  assert.equal(lireVersion({ frontmatter: { version: '2.3.4' } }), '2.3.4');
});

test('chargerSpec — version par défaut si frontmatter absent', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'),
      '---\ntitle: T\n---\nbody');
    const s = chargerSpec(d, 'SPEC-001-1-x');
    assert.equal(s.version, '1.0.0');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerSpec — version frontmatter respectée', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'),
      '---\ntitle: T\nversion: 2.1.0\n---\nbody');
    const s = chargerSpec(d, 'SPEC-001-1-x');
    assert.equal(s.version, '2.1.0');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── extraireCriteres ─────────────────────────────────────────────────────

test('extraireCriteres — patterns EARS détectés et normalisés', () => {
  const body = `
WHEN user logs in THE SYSTEM SHALL respond.
QUAND token expire LE SYSTÈME DOIT refuser.
- **AC-1** Premier
- **Critère 2** Deuxième
`;
  const c = extraireCriteres(body);
  assert.ok(c.length >= 4);
});

test('extraireCriteres — texte sans critère → []', () => {
  assert.deepEqual(extraireCriteres('Juste un paragraphe descriptif.'), []);
});

test('extraireCriteres — déduplication par texte normalisé', () => {
  const body = `
WHEN x THE SYSTEM SHALL y.
WHEN  x   THE SYSTEM SHALL y.
`;
  assert.equal(extraireCriteres(body).length, 1);
});

// ─── detectBreaking ───────────────────────────────────────────────────────

test('detectBreaking — critère retiré → breaking', () => {
  const avant = { frontmatter: {}, body: 'WHEN a THE SYSTEM SHALL b.' };
  const apres = { frontmatter: {}, body: '' };
  const d = detectBreaking(avant, apres);
  assert.equal(d.breaking.length, 1);
  assert.equal(d.breaking[0].kind, 'criterion-removed');
  assert.equal(d.needsBumpKind, 'major');
});

test('detectBreaking — critère ajouté → addition (minor)', () => {
  const avant = { frontmatter: {}, body: '' };
  const apres = { frontmatter: {}, body: 'WHEN a THE SYSTEM SHALL b.' };
  const d = detectBreaking(avant, apres);
  assert.equal(d.breaking.length, 0);
  assert.equal(d.additions.length, 1);
  assert.equal(d.needsBumpKind, 'minor');
});

test('detectBreaking — critères identiques → patch', () => {
  const c = 'WHEN a THE SYSTEM SHALL b.';
  const d = detectBreaking({ frontmatter: {}, body: c }, { frontmatter: {}, body: c });
  assert.equal(d.breaking.length, 0);
  assert.equal(d.additions.length, 0);
  assert.equal(d.needsBumpKind, 'patch');
});

test('detectBreaking — api: true → false → breaking', () => {
  const d = detectBreaking(
    { frontmatter: { api: true }, body: '' },
    { frontmatter: { api: false }, body: '' },
  );
  assert.ok(d.breaking.find((b) => b.kind === 'api-removed'));
});

test('detectBreaking — intent changé → breaking', () => {
  const d = detectBreaking(
    { frontmatter: { intent: 'INT-001' }, body: '' },
    { frontmatter: { intent: 'INT-002' }, body: '' },
  );
  assert.ok(d.breaking.find((b) => b.kind === 'intent-changed'));
});

test('detectBreaking — governance Tier 1 retiré → breaking', () => {
  const d = detectBreaking(
    { frontmatter: { governance: 'AIAD-RGPD,AIAD-AI-ACT' }, body: '' },
    { frontmatter: { governance: 'AIAD-RGPD' }, body: '' },
  );
  assert.ok(d.breaking.find((b) => b.kind === 'governance-removed'));
});

// ─── validerBump ──────────────────────────────────────────────────────────

test('validerBump — version régressive → invalide', () => {
  const r = validerBump('2.0.0', '1.0.0', { breaking: [], additions: [], needsBumpKind: 'patch' });
  assert.equal(r.valid, false);
  assert.match(r.raison, /> version précédente/);
});

test('validerBump — breaking → exige major', () => {
  const r = validerBump('1.0.0', '1.1.0', { breaking: [{}], additions: [], needsBumpKind: 'major' });
  assert.equal(r.valid, false);
  assert.match(r.raison, /MAJOR requis/);
  assert.equal(r.attendu, '2.0.0');
});

test('validerBump — addition → exige minor minimum', () => {
  const r = validerBump('1.0.0', '1.0.1', { breaking: [], additions: [{}], needsBumpKind: 'minor' });
  assert.equal(r.valid, false);
  assert.match(r.raison, /MINOR requis/);
  assert.equal(r.attendu, '1.1.0');
});

test('validerBump — bump cohérent → valide', () => {
  const r1 = validerBump('1.0.0', '2.0.0', { breaking: [{}], additions: [], needsBumpKind: 'major' });
  assert.equal(r1.valid, true);
  const r2 = validerBump('1.0.0', '1.1.0', { breaking: [], additions: [{}], needsBumpKind: 'minor' });
  assert.equal(r2.valid, true);
  const r3 = validerBump('1.0.0', '1.0.1', { breaking: [], additions: [], needsBumpKind: 'patch' });
  assert.equal(r3.valid, true);
});

test('validerBump — major bump quand seul minor requis → toléré (sur-spec)', () => {
  const r = validerBump('1.0.0', '2.0.0', { breaking: [], additions: [{}], needsBumpKind: 'minor' });
  assert.equal(r.valid, true);
});

// ─── bumpSpec (pipeline) ──────────────────────────────────────────────────

test('bumpSpec — réécrit le frontmatter avec nouvelle version', silent(() => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'),
      '---\ntitle: T\nversion: 1.0.0\n---\nbody');
    const r = bumpSpec(d, 'SPEC-001-1-x', 'minor');
    assert.equal(r.ancienne, '1.0.0');
    assert.equal(r.nouvelle, '1.1.0');
    const contenu = readFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'), 'utf-8');
    assert.match(contenu, /version: "?1\.1\.0"?/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('bumpSpec --dry-run → fichier non modifié', silent(() => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    const original = '---\ntitle: T\nversion: 1.0.0\n---\nbody';
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'), original);
    bumpSpec(d, 'SPEC-001-1-x', 'major', { dryRun: true });
    const contenu = readFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'), 'utf-8');
    assert.equal(contenu, original);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('bumpSpec — frontmatter sans version → bump depuis défaut 1.0.0', silent(() => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'),
      '---\ntitle: T\n---\nbody');
    const r = bumpSpec(d, 'SPEC-001-1-x', 'major');
    assert.equal(r.ancienne, '1.0.0');
    assert.equal(r.nouvelle, '2.0.0');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('bumpSpec --json → sortie JSON', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'),
      '---\ntitle: T\nversion: 1.0.0\n---\nbody');
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { bumpSpec(d, 'SPEC-001-1-x', 'patch', { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.spec, 'SPEC-001-1-x');
    assert.equal(parsed.nouvelle, '1.0.1');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(parseSemver, parseVersion);
  assert.equal(compareSemver, compareVersions);
  assert.equal(bumpSemver, bumpVersion);
  assert.equal(readVersion, lireVersion);
  assert.equal(loadSpec, chargerSpec);
  assert.equal(extractCriteria, extraireCriteres);
  assert.equal(detectBreakingChanges, detectBreaking);
  assert.equal(validateBump, validerBump);
  assert.equal(bumpSpecVersion, bumpSpec);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.VERSION_DEFAUT, '1.0.0');
});
