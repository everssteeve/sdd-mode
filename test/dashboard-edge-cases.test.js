// Tests #211 — Edge case tracking pour persona QA.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  extraireEdgeCases, calculerEdgeCases, blocEdgeCases, tokeniser, scannerAnnotationsCouverture,
  extractEdgeCases, computeEdgeCases, edgeCasesSection, tokenize, scanCoverAnnotations,
} from '../lib/dashboard/edge-cases.js';

function tmpProjet() {
  return mkdtempSync(join(tmpdir(), 'aiad-edge-'));
}

test('extraireEdgeCases — sans section → []', () => {
  assert.deepEqual(extraireEdgeCases('# SPEC\n\n## Scope\nA.\n'), []);
});

test('extraireEdgeCases — section "## Cas limites" + items', () => {
  const cas = extraireEdgeCases(`# SPEC

## Cas limites
- URL > 2048 char → 400
- Slug collision → retry
- UTF-8 multi-byte → encoder

## Tests`);
  assert.equal(cas.length, 3);
  assert.match(cas[0].texte, /2048/);
  assert.ok(cas[0].keywords.length > 0);
  assert.equal(cas[0].ligne, 4);
});

test('extraireEdgeCases — alias EN "## Edge cases"', () => {
  const cas = extraireEdgeCases(`## Edge cases
- A
- B`);
  assert.equal(cas.length, 2);
});

test('extraireEdgeCases — variantes "Corner cases" / "Cas particuliers"', () => {
  assert.equal(extraireEdgeCases(`## Corner cases\n- A`).length, 1);
  assert.equal(extraireEdgeCases(`## Cas particuliers\n- B`).length, 1);
});

test('extraireEdgeCases — s\'arrête à la H2 suivante', () => {
  const cas = extraireEdgeCases(`## Cas limites
- A
- B

## Tests
- T1
- T2`);
  assert.equal(cas.length, 2);
});

test('extraireEdgeCases — ignore lignes non-items', () => {
  const cas = extraireEdgeCases(`## Cas limites
Texte libre à ignorer.

- A (vrai item)
> blockquote ignoré
- B`);
  assert.equal(cas.length, 2);
});

test('tokeniser — ignore stop words FR/EN + mots < 4 chars', () => {
  const t = tokeniser('Le slug avec collision dans la base de données');
  assert.ok(t.includes('slug'));
  assert.ok(t.includes('collision'));
  assert.ok(!t.includes('le'));
  assert.ok(!t.includes('la'));
  assert.ok(!t.includes('de'));
});

test('tokeniser — chaîne vide → []', () => {
  assert.deepEqual(tokeniser(''), []);
  assert.deepEqual(tokeniser(null), []);
});

test('calculerEdgeCases — projet vide → 0', () => {
  const r = calculerEdgeCases(tmpProjet(), { specs: [], matrice: { forward: [] } });
  assert.equal(r.totalItems, 0);
  assert.equal(r.totalSpecs, 0);
  assert.equal(r.ratio, null);
});

test('calculerEdgeCases — SPECs sans section ignorées', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-1.md'),
      `# SPEC\n\n## Scope\n\nA.\n`);
    const r = calculerEdgeCases(racine, {
      specs: [{ id: 'SPEC-1', file: '.aiad/specs/SPEC-1.md' }],
      matrice: { forward: [] },
    });
    assert.equal(r.totalSpecs, 0);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerEdgeCases — coverage par keyword matching', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-1.md'),
      `## Cas limites
- URL trop longue (> 2048 chars) → 400 Bad Request
- Collision sur slug existant → retry puis 500
- Charset UTF-8 multibyte chinois → accepter`);
    mkdirSync(join(racine, 'tests'), { recursive: true });
    // Test couvre les 2 premiers mais pas le 3e
    writeFileSync(join(racine, 'tests', 'shorten.test.ts'),
      `describe('shorten', () => {
  it('rejects URL longer than 2048 chars', () => {});
  it('handles slug collision via retry', () => {});
});`);
    const r = calculerEdgeCases(racine, {
      specs: [{ id: 'SPEC-1', file: '.aiad/specs/SPEC-1.md', statut: 'done' }],
      matrice: { forward: [
        { specs: [{ spec: { id: 'SPEC-1' }, tests: [{ path: 'tests/shorten.test.ts' }] }] },
      ] },
    });
    assert.equal(r.totalSpecs, 1);
    assert.equal(r.totalItems, 3);
    assert.ok(r.totalCovered >= 2, `>= 2 cas couverts (URL + collision), got ${r.totalCovered}`);
    assert.ok(r.totalCovered < 3, 'le 3e (chinois) ne devrait pas être couvert');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerEdgeCases — SPEC sans test → tous non couverts', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-X.md'),
      `## Cas limites\n- Cas A spécifique\n- Cas B particulier`);
    const r = calculerEdgeCases(racine, {
      specs: [{ id: 'SPEC-X', file: '.aiad/specs/SPEC-X.md', statut: 'ready' }],
      matrice: { forward: [{ specs: [{ spec: { id: 'SPEC-X' }, tests: [] }] }] },
    });
    assert.equal(r.totalCovered, 0);
    assert.equal(r.totalItems, 2);
    assert.equal(r.ratio, 0);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerEdgeCases — tri SPECs par gaps décroissants', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad', 'specs'), { recursive: true });
    // SPEC-A : 3 cas, 0 couvert (gap=3)
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-A.md'),
      `## Cas limites\n- vide1\n- vide2\n- vide3`);
    // SPEC-B : 5 cas, 4 couverts (gap=1)
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-B.md'),
      `## Cas limites\n- Collision\n- Conflict\n- Duplicate\n- Timeout\n- NonCouvert`);
    mkdirSync(join(racine, 'tests'), { recursive: true });
    writeFileSync(join(racine, 'tests', 'spec-b.test.ts'),
      `test('collision handles correctly');
test('conflict detected');
test('duplicate skipped');
test('timeout respected');`);
    const r = calculerEdgeCases(racine, {
      specs: [
        { id: 'SPEC-A', file: '.aiad/specs/SPEC-A.md', statut: 'ready' },
        { id: 'SPEC-B', file: '.aiad/specs/SPEC-B.md', statut: 'done' },
      ],
      matrice: { forward: [
        { specs: [
          { spec: { id: 'SPEC-A' }, tests: [] },
          { spec: { id: 'SPEC-B' }, tests: [{ path: 'tests/spec-b.test.ts' }] },
        ] },
      ] },
    });
    assert.equal(r.byspec[0].id, 'SPEC-A', 'SPEC-A avec gap=3 en tête');
    assert.equal(r.byspec[1].id, 'SPEC-B');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('blocEdgeCases — sans données → chaîne vide', () => {
  assert.equal(blocEdgeCases({}), '');
  assert.equal(blocEdgeCases({ edgeCases: { totalSpecs: 0 } }), '');
});

test('blocEdgeCases — rendu avec KPIs + cards SPECs', () => {
  const html = blocEdgeCases({ edgeCases: {
    totalItems: 5, totalCovered: 3, totalSpecs: 2, ratio: 0.6,
    byspec: [
      { id: 'SPEC-1', file: '.aiad/specs/SPEC-1.md', statut: 'ready', testsCount: 2, totalItems: 3, covered: 1,
        items: [
          { texte: 'URL trop longue', couvert: true, matchedKeywords: ['longue'] },
          { texte: 'Slug collision', couvert: false, matchedKeywords: [] },
          { texte: 'Encoding UTF-8', couvert: false, matchedKeywords: [] },
        ],
      },
      { id: 'SPEC-2', file: '.aiad/specs/SPEC-2.md', statut: 'done', testsCount: 1, totalItems: 2, covered: 2,
        items: [
          { texte: 'A', couvert: true, matchedKeywords: ['keyword1'] },
          { texte: 'B', couvert: true, matchedKeywords: ['keyword2'] },
        ],
      },
    ],
  } });
  assert.match(html, /Edge cases.*3\/5/);
  assert.match(html, /badge-warn">60%/);
  assert.match(html, /SPEC-1.*1\/3 cas couverts/s);
  assert.match(html, /badge-warn[^>]*>à tester/);
  assert.match(html, /badge-ok[^>]*>couvert/);
});

test('Alias EN canoniques', () => {
  assert.equal(extractEdgeCases, extraireEdgeCases);
  assert.equal(computeEdgeCases, calculerEdgeCases);
  assert.equal(edgeCasesSection, blocEdgeCases);
  assert.equal(tokenize, tokeniser);
  assert.equal(scanCoverAnnotations, scannerAnnotationsCouverture);
});

// (#314) Hyperlinks SPEC + ligne sur chaque edge case
test('#314 blocEdgeCases — SPEC id hyperlié vers fichier + items vers #LNN', () => {
  const html = blocEdgeCases({ edgeCases: {
    totalItems: 2, totalCovered: 0, totalSpecs: 1, ratio: 0,
    byspec: [
      { id: 'SPEC-7', file: '.aiad/specs/SPEC-7.md', statut: 'ready', testsCount: 0, totalItems: 2, covered: 0,
        items: [
          { texte: 'concurrent writes', ligne: 42, couvert: false, matchedKeywords: [] },
          { texte: 'timeout retries', ligne: 47, couvert: false, matchedKeywords: [] },
        ],
      },
    ],
  } });
  // SPEC summary cliquable vers SPEC-7.md
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/specs\/SPEC-7\.md"[^>]*>SPEC-7<\/a>/);
  // Chaque item lié à sa ligne dans la SPEC
  assert.match(html, /href="\.\.\/\.aiad\/specs\/SPEC-7\.md#L42"/);
  assert.match(html, /href="\.\.\/\.aiad\/specs\/SPEC-7\.md#L47"/);
});

test('#314 blocEdgeCases — sans s.file → fallback `<code>` sans lien (garde-fou)', () => {
  const html = blocEdgeCases({ edgeCases: {
    totalItems: 1, totalCovered: 0, totalSpecs: 1, ratio: 0,
    byspec: [
      { id: 'SPEC-X', file: null, statut: 'draft', testsCount: 0, totalItems: 1, covered: 0,
        items: [{ texte: 'edge A', ligne: null, couvert: false, matchedKeywords: [] }],
      },
    ],
  } });
  assert.match(html, /<code>SPEC-X<\/code>/);
  // pas de href #L… pour items sans ligne
  assert.ok(!html.includes('#L'), 'aucun anchor quand ligne absente');
});

// ─── #212 Annotations explicites @covers-edge-case ──────────────────────────

test('scannerAnnotationsCouverture — extrait SPEC:texte du contenu test', () => {
  const annotations = scannerAnnotationsCouverture([
    `// @covers-edge-case SPEC-001-1: URL > 2048 char\n// some code`,
    `// @covers-edge-case SPEC-007-2-routing: 0 fuite cross-tenant`,
  ]);
  assert.equal(annotations.size, 2);
  assert.ok(annotations.get('SPEC-001-1').has('url > 2048 char'));
  assert.ok(annotations.get('SPEC-007-2').has('0 fuite cross-tenant'));
});

test('scannerAnnotationsCouverture — plusieurs annotations même SPEC', () => {
  const a = scannerAnnotationsCouverture([
    `// @covers-edge-case SPEC-001-1: URL > 2048\n// @covers-edge-case SPEC-001-1: Slug collision`,
  ]);
  assert.equal(a.size, 1);
  assert.equal(a.get('SPEC-001-1').size, 2);
});

test('scannerAnnotationsCouverture — sans annotation → Map vide', () => {
  const a = scannerAnnotationsCouverture(['plain test content']);
  assert.equal(a.size, 0);
});

test('calculerEdgeCases — annotation explicite override l\'heuristique keyword', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-1.md'),
      `## Cas limites\n- URL avec UTF-8 (caractères chinois) → accepter et encoder`);
    mkdirSync(join(racine, 'tests'), { recursive: true });
    // Le test ne contient pas les keywords du cas, MAIS pose l'annotation
    writeFileSync(join(racine, 'tests', 'spec1.test.ts'),
      `// @covers-edge-case SPEC-1: URL avec UTF-8\nimport { test } from 'node:test';\ntest('chinese url encoding', () => {});`);
    const r = calculerEdgeCases(racine, {
      specs: [{ id: 'SPEC-1', file: '.aiad/specs/SPEC-1.md', statut: 'done' }],
      matrice: { forward: [{ specs: [{ spec: { id: 'SPEC-1' }, tests: [{ path: 'tests/spec1.test.ts' }] }] }] },
    });
    assert.equal(r.totalCovered, 1, 'annotation explicite couvre');
    assert.equal(r.byspec[0].items[0].explicite, true);
    assert.match(r.byspec[0].items[0].matchedKeywords[0], /^@covers:/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerEdgeCases — annotation suffixe long-id reconnue (SPEC-NNN-N-slug)', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-007-2-routing.md'),
      `## Cas limites\n- 0 fuite cross-tenant`);
    mkdirSync(join(racine, 'tests'), { recursive: true });
    writeFileSync(join(racine, 'tests', 't.ts'),
      `// @covers-edge-case SPEC-007-2-routing: 0 fuite\ntest('isolation', () => {});`);
    const r = calculerEdgeCases(racine, {
      specs: [{ id: 'SPEC-007-2-routing', file: '.aiad/specs/SPEC-007-2-routing.md', statut: 'done' }],
      matrice: { forward: [{ specs: [{ spec: { id: 'SPEC-007-2-routing' }, tests: [{ path: 'tests/t.ts' }] }] }] },
    });
    assert.equal(r.totalCovered, 1);
    assert.equal(r.byspec[0].items[0].explicite, true);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerEdgeCases — sans annotation, fallback keyword préservé', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-K.md'),
      `## Cas limites\n- Collision sur slug existant`);
    mkdirSync(join(racine, 'tests'), { recursive: true });
    writeFileSync(join(racine, 'tests', 'k.ts'),
      `test('handles slug collision', () => {});`);
    const r = calculerEdgeCases(racine, {
      specs: [{ id: 'SPEC-K', file: '.aiad/specs/SPEC-K.md', statut: 'ready' }],
      matrice: { forward: [{ specs: [{ spec: { id: 'SPEC-K' }, tests: [{ path: 'tests/k.ts' }] }] }] },
    });
    assert.equal(r.totalCovered, 1);
    assert.equal(r.byspec[0].items[0].explicite, false);
    assert.ok(r.byspec[0].items[0].matchedKeywords.includes('collision'));
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('blocEdgeCases — badge "couvert (explicite)" rendu quand annotation', () => {
  const html = blocEdgeCases({ edgeCases: {
    totalItems: 1, totalCovered: 1, totalSpecs: 1, ratio: 1,
    byspec: [{
      id: 'SPEC-1', file: '.aiad/specs/SPEC-1.md', statut: 'done', testsCount: 1, totalItems: 1, covered: 1,
      items: [{ texte: 'UTF-8 chinois', couvert: true, explicite: true, matchedKeywords: ['@covers:utf-8 chinois'] }],
    }],
  } });
  assert.match(html, /couvert \(explicite\)/);
  assert.match(html, /@covers:/);
});
