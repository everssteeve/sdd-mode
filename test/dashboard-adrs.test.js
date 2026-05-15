// Tests #138 — Extraction ADRs depuis ARCHITECTURE.md.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { extraireAdrs, pageAdrs, extractAdrs, adrsPage, scannerReferencesAdr, detecterDriftAdr } from '../lib/dashboard/adrs.js';
import { setSourceBase, lienSourceLigne } from '../lib/dashboard/render.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-adrs-')); }

function writeArchi(racine, contenu) {
  const dir = join(racine, '.aiad');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'ARCHITECTURE.md'), contenu, 'utf-8');
}

test('extraireAdrs — projet sans ARCHITECTURE.md → total 0', () => {
  const d = tmp();
  try {
    const r = extraireAdrs(d);
    assert.equal(r.total, 0);
    assert.equal(r.fichier, null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('extraireAdrs — détecte le pattern `- **ADR-NNN** : titre`', () => {
  const d = tmp();
  try {
    writeArchi(d, `# Architecture\n\n## Choix techniques\n\n- **ADR-001** : pas de NoSQL — Postgres suffit\n- **ADR-002** : rate limiting par IP hachée\n`);
    const r = extraireAdrs(d);
    assert.equal(r.total, 2);
    assert.equal(r.entrees[0].id, 'ADR-001');
    assert.match(r.entrees[0].titre, /pas de NoSQL/);
    assert.equal(r.entrees[0].section, 'Choix techniques');
    assert.equal(r.entrees[1].id, 'ADR-002');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('extraireAdrs — supporte plusieurs séparateurs (—, –, -, :)', () => {
  const d = tmp();
  try {
    writeArchi(d, `**ADR-A** — décision 1\n**ADR-B** : décision 2\n**ADR-C** – décision 3\n**ADR-D** - décision 4\n`);
    const r = extraireAdrs(d);
    assert.equal(r.total, 4);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('extraireAdrs — capture le corps multi-ligne (indenté ou bullet)', () => {
  const d = tmp();
  try {
    writeArchi(d, `- **ADR-001** : titre principal\n  Contexte : situation à clarifier\n  Conséquences : on évite la complexité\n\nUne ligne non indentée stoppe la capture.\n`);
    const r = extraireAdrs(d);
    assert.equal(r.total, 1);
    assert.match(r.entrees[0].corps, /Contexte/);
    assert.match(r.entrees[0].corps, /Conséquences/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('extraireAdrs — section parente prise du H2/H3 le plus proche', () => {
  const d = tmp();
  try {
    writeArchi(d, `# H1\n## Section A\n- **ADR-001** : choix A\n## Section B\n- **ADR-002** : choix B\n### Sous-section\n- **ADR-003** : choix C\n`);
    const r = extraireAdrs(d);
    assert.equal(r.entrees[0].section, 'Section A');
    assert.equal(r.entrees[1].section, 'Section B');
    assert.equal(r.entrees[2].section, 'Sous-section');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('extraireAdrs — fichier sans ADR → total 0 mais fichier exposé', () => {
  const d = tmp();
  try {
    writeArchi(d, `# Architecture\n\nTexte général sans décision formalisée.\n`);
    const r = extraireAdrs(d);
    assert.equal(r.total, 0);
    assert.ok(r.fichier);
    assert.match(r.fichier, /ARCHITECTURE\.md/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('extraireAdrs — option `fichier` permet de cibler un chemin custom', () => {
  const d = tmp();
  try {
    const custom = join(d, 'archi.md');
    writeFileSync(custom, '- **ADR-X1** : custom\n', 'utf-8');
    const r = extraireAdrs(d, { fichier: custom });
    assert.equal(r.total, 1);
    assert.equal(r.entrees[0].id, 'ADR-X1');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('pageAdrs — sans données → empty state amical', () => {
  const html = pageAdrs({});
  assert.match(html, /Aucun ADR détecté/);
  assert.match(html, /ARCHITECTURE\.md/);
});

// (#333) Empty state hyperlinké quand fichier scanné mais vide
test('#333 pageAdrs — empty state hyperlinks ARCHITECTURE.md quand adrs.fichier set', () => {
  setSourceBase('');
  const html = pageAdrs({ adrs: { fichier: '.aiad/ARCHITECTURE.md', total: 0, entrees: [] } });
  assert.match(html, /Aucun ADR détecté dans <a[^>]+href="\.\.\/\.aiad\/ARCHITECTURE\.md"/);
});

test('#333 pageAdrs — empty state text-only quand fichier absent (cas init)', () => {
  const html = pageAdrs({ adrs: null });
  assert.match(html, /Aucun ADR détecté dans <code>\.aiad\/ARCHITECTURE\.md<\/code>/);
});

test('pageAdrs — avec données → table + KPI + filtre/tri (#162)', () => {
  const html = pageAdrs({
    adrs: {
      fichier: '.aiad/ARCHITECTURE.md',
      total: 2,
      entrees: [
        { id: 'ADR-001', titre: 'choix A', section: 'Choix techniques', ligne: 5, corps: '' },
        { id: 'ADR-002', titre: 'choix B', section: 'Choix techniques', ligne: 8, corps: 'Contexte détaillé' },
      ],
    },
  });
  assert.match(html, /ADRs détectés.*<div class="value">2/s);
  assert.match(html, /ADR-001/);
  assert.match(html, /ADR-002/);
  assert.match(html, /Choix techniques/);
  assert.match(html, /Contexte détaillé/);
  // (#162) filtre input + table sortable
  assert.match(html, /<input type="search"[^>]*data-filter-target="tAdrs"/);
  assert.match(html, /<table id="tAdrs"[^>]*data-sortable="true"/);
  assert.match(html, /Filtrer par ID, décision, section/);
});

test('Alias EN canoniques exposés', () => {
  assert.equal(extractAdrs, extraireAdrs);
  assert.equal(adrsPage, pageAdrs);
});

// ─── #161 Drift architecture ────────────────────────────────────────────────

test('scannerReferencesAdr — projet sans code → []', () => {
  const d = tmp();
  try {
    assert.deepEqual(scannerReferencesAdr(d), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('scannerReferencesAdr — détecte @adr dans 3 langages', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'a.ts'), '// @adr ADR-001\nexport const x = 1;\n', 'utf-8');
    writeFileSync(join(d, 'b.py'), '# @adr ADR-002\nx = 1\n', 'utf-8');
    writeFileSync(join(d, 'c.go'), '/** @adr ADR-003 */\nfunc x() {}\n', 'utf-8');
    const r = scannerReferencesAdr(d);
    assert.equal(r.length, 3);
    const ids = r.map((x) => x.adrId).sort();
    assert.deepEqual(ids, ['ADR-001', 'ADR-002', 'ADR-003']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('scannerReferencesAdr — ignore node_modules, dist, .git', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, 'node_modules'));
    writeFileSync(join(d, 'node_modules', 'a.ts'), '// @adr ADR-999\n', 'utf-8');
    mkdirSync(join(d, 'dist'));
    writeFileSync(join(d, 'dist', 'a.ts'), '// @adr ADR-888\n', 'utf-8');
    writeFileSync(join(d, 'src.ts'), '// @adr ADR-001\n', 'utf-8');
    const r = scannerReferencesAdr(d);
    assert.equal(r.length, 1);
    assert.equal(r[0].adrId, 'ADR-001');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('detecterDriftAdr — toutes les références valides → total 0', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'a.ts'), '// @adr ADR-001\n', 'utf-8');
    const r = detecterDriftAdr(d, { entrees: [{ id: 'ADR-001' }] });
    assert.equal(r.total, 0);
    assert.equal(r.referencesTotal, 1);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('detecterDriftAdr — référence vers ADR inexistant → orphelin', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'a.ts'), '// @adr ADR-001\n// @adr ADR-999\n', 'utf-8');
    const r = detecterDriftAdr(d, { entrees: [{ id: 'ADR-001' }] });
    assert.equal(r.total, 1);
    assert.equal(r.orphelins[0].adrId, 'ADR-999');
    assert.match(r.orphelins[0].file, /a\.ts$/);
    assert.equal(r.orphelins[0].line, 2);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('pageAdrs — drift visible quand orphelins présents', () => {
  const html = pageAdrs({
    adrs: { fichier: '.aiad/ARCHITECTURE.md', total: 1, entrees: [{ id: 'ADR-001', titre: 'X', section: 'S', ligne: 5, corps: '' }] },
    adrsDrift: { referencesTotal: 2, total: 1, orphelins: [{ adrId: 'ADR-OBSOLETE', file: 'src/legacy.ts', line: 42 }] },
  });
  assert.match(html, /Drift Architecture.*1 référence/s);
  assert.match(html, /ADR-OBSOLETE/);
  assert.match(html, /src\/legacy\.ts/);
});

test('pageAdrs — drift vide mais avec références → badge OK', () => {
  const html = pageAdrs({
    adrs: { fichier: '.aiad/ARCHITECTURE.md', total: 1, entrees: [{ id: 'ADR-001', titre: 'X', section: 'S', ligne: 5, corps: '' }] },
    adrsDrift: { referencesTotal: 5, total: 0, orphelins: [] },
  });
  assert.match(html, /Aucun drift architecture/);
  assert.match(html, /5 référence/);
});

// ─── #309 Ligne de l'ADR hyperliée vers la source ───────────────────────────

test('#309 lienSourceLigne — sans sourceBase → href relatif `../FILE#LN`', () => {
  setSourceBase('');
  const html = lienSourceLigne('.aiad/ARCHITECTURE.md', 24);
  assert.match(html, /href="\.\.\/\.aiad\/ARCHITECTURE\.md#L24"/);
  assert.match(html, />L24</);
});

test('#309 lienSourceLigne — avec sourceBase → href absolu préfixé', () => {
  setSourceBase('https://github.com/org/repo/blob/main');
  const html = lienSourceLigne('.aiad/ARCHITECTURE.md', 24);
  assert.match(html, /href="https:\/\/github\.com\/org\/repo\/blob\/main\/\.aiad\/ARCHITECTURE\.md#L24"/);
  setSourceBase(''); // reset
});

test('#309 pageAdrs — chaque ligne `L<n>` est un `<a>` vers ARCHITECTURE.md#L<n>', () => {
  setSourceBase('');
  const html = pageAdrs({
    adrs: {
      fichier: '.aiad/ARCHITECTURE.md',
      total: 2,
      entrees: [
        { id: 'ADR-001', titre: 'choix A', section: 'S', ligne: 5, corps: '' },
        { id: 'ADR-002', titre: 'choix B', section: 'S', ligne: 24, corps: '' },
      ],
    },
  });
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/ARCHITECTURE\.md#L5"[^>]*>L5<\/a>/);
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/ARCHITECTURE\.md#L24"[^>]*>L24<\/a>/);
});

test('#309 pageAdrs — sourceBase actif → ARCHITECTURE.md préfixé', () => {
  setSourceBase('https://github.com/o/r/blob/main');
  try {
    const html = pageAdrs({
      adrs: {
        fichier: '.aiad/ARCHITECTURE.md',
        total: 1,
        entrees: [{ id: 'ADR-001', titre: 'choix A', section: 'S', ligne: 42, corps: '' }],
      },
    });
    assert.match(html, /href="https:\/\/github\.com\/o\/r\/blob\/main\/\.aiad\/ARCHITECTURE\.md#L42"/);
  } finally { setSourceBase(''); }
});

// (#351) ID column hyperlinks to ARCHITECTURE.md#LNN (same target as Ligne)
test('#351 pageAdrs — colonne ID devient hyperlien vers ARCHITECTURE.md#LNN', () => {
  setSourceBase('');
  const html = pageAdrs({
    adrs: {
      fichier: '.aiad/ARCHITECTURE.md',
      total: 1,
      entrees: [{ id: 'ADR-007', titre: 'OIDC', section: 'Auth', ligne: 24, corps: 'Détail' }],
    },
  });
  // ID cell hyperlié vers la même ligne que la cellule Ligne
  assert.match(html, /<td><a[^>]+href="\.\.\/\.aiad\/ARCHITECTURE\.md#L24"[^>]*>ADR-007<\/a><\/td>/);
  // Le contexte détaillé summary aussi hyperlié
  assert.match(html, /<summary><a[^>]+href="\.\.\/\.aiad\/ARCHITECTURE\.md#L24"[^>]*>ADR-007<\/a> — OIDC<\/summary>/);
});

// (#324) KPI footer "source FILE" hyperlié
test('#324 pageAdrs — KPI footer hyperlie le fichier source (au lieu de <code>texte</code>)', () => {
  setSourceBase('');
  const html = pageAdrs({
    adrs: {
      fichier: '.aiad/ARCHITECTURE.md',
      total: 1,
      entrees: [{ id: 'ADR-001', titre: 'X', section: 'S', ligne: 5, corps: '' }],
    },
  });
  // KPI delta line doit contenir un <a> pas juste <code>
  assert.match(html, /source <a[^>]+href="\.\.\/\.aiad\/ARCHITECTURE\.md"[^>]*>\.aiad\/ARCHITECTURE\.md<\/a>/);
});

test('#309 pageAdrs — drift orphelin : fichier + ligne pointent vers `FILE#LN`', () => {
  setSourceBase('');
  const html = pageAdrs({
    adrs: { fichier: '.aiad/ARCHITECTURE.md', total: 1, entrees: [{ id: 'ADR-001', titre: 'X', section: 'S', ligne: 5, corps: '' }] },
    adrsDrift: { referencesTotal: 1, total: 1, orphelins: [{ adrId: 'ADR-X', file: 'src/legacy.ts', line: 7 }] },
  });
  assert.match(html, /href="\.\.\/src\/legacy\.ts#L7"/);
  // Le texte L7 reste lisible
  assert.match(html, />L7<\/a>/);
});

test('pageAdrs — pas de @adr dans le code (referencesTotal=0) → section omise', () => {
  const html = pageAdrs({
    adrs: { fichier: '.aiad/ARCHITECTURE.md', total: 1, entrees: [{ id: 'ADR-001', titre: 'X', section: 'S', ligne: 5, corps: '' }] },
    adrsDrift: { referencesTotal: 0, total: 0, orphelins: [] },
  });
  assert.ok(!html.includes('Drift Architecture'), 'section omise quand 0 référence');
});
