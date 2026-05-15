// Tests `lib/sla.js` — matrice SLA support/sécurité (item #106).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  POLITIQUE_DEFAUT, listerTagsVersions, lireVersionCourante,
  construireMatrice, validerMatrice, rendreMatriceMarkdown,
  injecterDansSecurity, show, check, update, CONSTANTS,
  // alias EN
  listVersionTags, readCurrentVersion, buildMatrix, validateMatrix,
  renderMatrixMarkdown, injectIntoSecurity, showSla, checkSla, updateSla,
} from '../lib/sla.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-sla-')); }
function silent(fn) {
  return (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

// ─── lireVersionCourante ──────────────────────────────────────────────────

test('lireVersionCourante — package.json absent → null', () => {
  const d = tmp();
  try {
    assert.equal(lireVersionCourante(d), null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireVersionCourante — extrait version', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({ version: '1.14.0' }));
    assert.equal(lireVersionCourante(d), '1.14.0');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── construireMatrice ────────────────────────────────────────────────────

test('construireMatrice — version courante seule (pas de tags) → 1 entrée', () => {
  const m = construireMatrice({
    tags: [],
    versionCourante: '1.0.0',
    aujourdhui: '2026-05-10',
  });
  assert.equal(m.versions.length, 1);
  assert.equal(m.versions[0].major, 1);
  assert.equal(m.versions[0].versionRange, '1.x');
  assert.equal(m.versions[0].status, 'supported');
});

test('construireMatrice — current major + previous major (security-only)', () => {
  const tags = [
    { version: '0.5.0', major: 0, minor: 5, patch: 0, date: '2025-01-01' },
    { version: '1.0.0', major: 1, minor: 0, patch: 0, date: '2025-06-01' },
    { version: '1.2.0', major: 1, minor: 2, patch: 0, date: '2025-09-01' },
  ];
  const m = construireMatrice({
    tags, versionCourante: '1.2.0', aujourdhui: '2025-09-15',
  });
  assert.equal(m.versions.length, 2);
  const v0 = m.versions.find((v) => v.major === 0);
  const v1 = m.versions.find((v) => v.major === 1);
  assert.equal(v1.status, 'supported');
  assert.equal(v0.status, 'security-only');
  assert.equal(v0.supportedUntil, '2025-11-28');  // 2025-06-01 + 180j
});

test('construireMatrice — previous major hors fenêtre overlap → unsupported', () => {
  const tags = [
    { version: '0.5.0', major: 0, minor: 5, patch: 0, date: '2024-01-01' },
    { version: '1.0.0', major: 1, minor: 0, patch: 0, date: '2024-06-01' },
  ];
  const m = construireMatrice({
    tags, versionCourante: '1.0.0', aujourdhui: '2026-05-10',  // bien après 6 mois
  });
  const v0 = m.versions.find((v) => v.major === 0);
  assert.equal(v0.status, 'unsupported');
});

test('construireMatrice — current major fenêtre 12 mois calculée', () => {
  const m = construireMatrice({
    tags: [{ version: '1.0.0', major: 1, minor: 0, patch: 0, date: '2026-01-01' }],
    versionCourante: '1.0.0',
    aujourdhui: '2026-05-10',
  });
  // 2026-01-01 + 365j = 2027-01-01
  assert.equal(m.versions[0].supportedUntil, '2027-01-01');
});

test('construireMatrice — politique custom override', () => {
  const m = construireMatrice({
    tags: [{ version: '1.0.0', major: 1, minor: 0, patch: 0, date: '2026-01-01' }],
    versionCourante: '1.0.0',
    aujourdhui: '2026-05-10',
    politique: { currentMajorSupportDays: 730 },  // 24 mois
  });
  assert.equal(m.versions[0].supportedUntil, '2028-01-01');
});

test('construireMatrice — generatedAt = aujourdhui', () => {
  const m = construireMatrice({
    tags: [], versionCourante: '1.0.0', aujourdhui: '2026-05-10',
  });
  assert.equal(m.generatedAt, '2026-05-10');
});

test('construireMatrice — politique exposée dans output', () => {
  const m = construireMatrice({
    tags: [], versionCourante: '1.0.0', aujourdhui: '2026-05-10',
  });
  assert.equal(m.politique.currentMajorSupportDays, 365);
  assert.ok(m.politique.patchWindows.critique);
});

// ─── validerMatrice ────────────────────────────────────────────────────────

test('validerMatrice — toutes versions actives → valid', () => {
  const m = {
    generatedAt: '2026-05-10',
    versions: [
      { major: 1, status: 'supported', supportedUntil: '2027-01-01', versionRange: '1.x' },
    ],
  };
  assert.equal(validerMatrice(m).valid, true);
});

test('validerMatrice — supportée mais expirée → issue', () => {
  const m = {
    generatedAt: '2026-05-10',
    versions: [
      { major: 1, status: 'supported', supportedUntil: '2025-01-01', versionRange: '1.x' },
    ],
  };
  const r = validerMatrice(m);
  assert.equal(r.valid, false);
  assert.match(r.issues[0], /supported/);
});

test('validerMatrice — unsupported expirées ignorées', () => {
  const m = {
    generatedAt: '2026-05-10',
    versions: [
      { major: 0, status: 'unsupported', supportedUntil: '2024-01-01', versionRange: '0.x' },
    ],
  };
  assert.equal(validerMatrice(m).valid, true);
});

// ─── rendreMatriceMarkdown ─────────────────────────────────────────────────

test('rendreMatriceMarkdown — contient tableaux + marqueurs', () => {
  const m = construireMatrice({
    tags: [{ version: '1.0.0', major: 1, minor: 0, patch: 0, date: '2026-01-01' }],
    versionCourante: '1.0.0',
    aujourdhui: '2026-05-10',
  });
  const md = rendreMatriceMarkdown(m);
  assert.match(md, /<!-- AIAD-SLA-START -->/);
  assert.match(md, /<!-- AIAD-SLA-END -->/);
  assert.match(md, /## SLA — Matrice/);
  assert.match(md, /Versions supportées/);
  assert.match(md, /Politique de support/);
  assert.match(md, /Fenêtres de patch/);
  assert.match(md, /Politique de dépréciation/);
  assert.match(md, /1\.x.*2026-01-01/);
});

test('rendreMatriceMarkdown — statuts traduits avec emoji', () => {
  const m = {
    generatedAt: '2026-05-10',
    politique: POLITIQUE_DEFAUT,
    versions: [
      { major: 1, versionRange: '1.x', releaseDate: '2026-01-01', supportedUntil: '2027-01-01', status: 'supported' },
      { major: 0, versionRange: '0.x', releaseDate: '2025-01-01', supportedUntil: '2026-06-01', status: 'security-only' },
    ],
  };
  const md = rendreMatriceMarkdown(m);
  assert.match(md, /Supportée/);
  assert.match(md, /Security-only/);
});

// ─── injecterDansSecurity ─────────────────────────────────────────────────

test('injecterDansSecurity — fichier absent → created', () => {
  const d = tmp();
  try {
    const r = injecterDansSecurity(d, '<!-- AIAD-SLA-START -->\nNew\n<!-- AIAD-SLA-END -->');
    assert.equal(r.action, 'created');
    assert.ok(existsSync(join(d, 'SECURITY.md')));
    assert.match(readFileSync(join(d, 'SECURITY.md'), 'utf-8'), /<!-- AIAD-SLA-START -->/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('injecterDansSecurity — bloc existant → updated (idempotent)', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'SECURITY.md'),
      '# Security\n\n<!-- AIAD-SLA-START -->\n## OLD\n<!-- AIAD-SLA-END -->\n\nFooter');
    const nouveau = '<!-- AIAD-SLA-START -->\n## NEW\n<!-- AIAD-SLA-END -->';
    const r = injecterDansSecurity(d, nouveau);
    assert.equal(r.action, 'updated');
    const contenu = readFileSync(join(d, 'SECURITY.md'), 'utf-8');
    assert.match(contenu, /## NEW/);
    assert.ok(!contenu.includes('## OLD'));
    // Préserve le contenu autour
    assert.match(contenu, /^# Security/);
    assert.match(contenu, /Footer/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('injecterDansSecurity — pas de marqueurs → appended', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'SECURITY.md'), '# Security\n\nContent\n');
    const bloc = '<!-- AIAD-SLA-START -->\n## NEW\n<!-- AIAD-SLA-END -->';
    const r = injecterDansSecurity(d, bloc);
    assert.equal(r.action, 'appended');
    const contenu = readFileSync(join(d, 'SECURITY.md'), 'utf-8');
    assert.match(contenu, /^# Security[\s\S]*## NEW/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('injecterDansSecurity --dry-run → pas d\'écriture', () => {
  const d = tmp();
  try {
    injecterDansSecurity(d, 'X', { dryRun: true });
    assert.ok(!existsSync(join(d, 'SECURITY.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── CLI sub-commandes ─────────────────────────────────────────────────────

test('show — sortie JSON exploitable', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({ version: '1.0.0' }));
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { show(d, { json: true, aujourdhui: '2026-05-10' }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.ok(parsed.versions.length >= 1);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('check — projet vierge → valid (pas de version expirée)', silent(() => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({ version: '1.0.0' }));
    const r = check(d, { aujourdhui: '2026-05-10' });
    assert.equal(r.valid, true);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('update — crée SECURITY.md avec bloc SLA', silent(() => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({ version: '1.0.0' }));
    update(d, { aujourdhui: '2026-05-10' });
    const contenu = readFileSync(join(d, 'SECURITY.md'), 'utf-8');
    assert.match(contenu, /<!-- AIAD-SLA-START -->/);
    assert.match(contenu, /## SLA — Matrice/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('update --dry-run → SECURITY.md non créé', silent(() => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({ version: '1.0.0' }));
    update(d, { dryRun: true, aujourdhui: '2026-05-10' });
    assert.ok(!existsSync(join(d, 'SECURITY.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('update — idempotent (2 appels successifs)', silent(() => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({ version: '1.0.0' }));
    update(d, { aujourdhui: '2026-05-10' });
    const after1 = readFileSync(join(d, 'SECURITY.md'), 'utf-8');
    update(d, { aujourdhui: '2026-05-10' });
    const after2 = readFileSync(join(d, 'SECURITY.md'), 'utf-8');
    assert.equal(after1, after2);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(listVersionTags, listerTagsVersions);
  assert.equal(readCurrentVersion, lireVersionCourante);
  assert.equal(buildMatrix, construireMatrice);
  assert.equal(validateMatrix, validerMatrice);
  assert.equal(renderMatrixMarkdown, rendreMatriceMarkdown);
  assert.equal(injectIntoSecurity, injecterDansSecurity);
  assert.equal(showSla, show);
  assert.equal(checkSla, check);
  assert.equal(updateSla, update);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.SECURITY_MD, 'SECURITY.md');
  assert.match(CONSTANTS.MARQUEUR_DEBUT, /AIAD-SLA-START/);
  assert.match(CONSTANTS.MARQUEUR_FIN, /AIAD-SLA-END/);
});
