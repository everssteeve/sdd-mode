// Tests #202 — Violations Gouvernance Tier 1 (cross-ref code/SPEC).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  calculerViolations, blocViolations,
  computeViolations, violationsSection,
} from '../lib/dashboard/violations.js';

function specInline(id, opts = {}) {
  return {
    id,
    file: `.aiad/specs/${id}.md`,
    statut: opts.statut || 'in-progress',
    governance: opts.governance || null,
  };
}

function codeInline(path, opts = {}) {
  return {
    path,
    isTest: false,
    annotated: true,
    annotations: {
      intents: [],
      specs: (opts.specs || []).map((id) => ({ id, line: 1 })),
      verifiedBy: [],
      governance: (opts.governance || []).map((tags) => ({ tags: tags.split(','), line: 5 })),
    },
  };
}

test('calculerViolations — projet vide → 0', () => {
  const r = calculerViolations(null, { specs: [] }, { codeScan: [] });
  assert.equal(r.total, 0);
  assert.equal(r.typeA.total, 0);
  assert.equal(r.typeB.total, 0);
});

test('calculerViolations — Type A : code @governance vs SPEC sans tag', () => {
  const r = calculerViolations(null, {
    specs: [specInline('SPEC-001-1', { governance: 'AIAD-AI-ACT' })],
  }, {
    codeScan: [codeInline('src/a.ts', { specs: ['SPEC-001-1'], governance: ['AIAD-RGPD'] })],
  });
  assert.equal(r.typeA.total, 1);
  assert.equal(r.typeA.entrees[0].tag, 'AIAD-RGPD');
  assert.equal(r.typeA.entrees[0].codeFile, 'src/a.ts');
  assert.equal(r.typeA.entrees[0].specId, 'SPEC-001-1');
});

test('calculerViolations — Type A : pas de violation si tag présent dans SPEC', () => {
  const r = calculerViolations(null, {
    specs: [specInline('SPEC-001-1', { governance: 'AIAD-RGPD,AIAD-AI-ACT' })],
  }, {
    codeScan: [codeInline('src/a.ts', { specs: ['SPEC-001-1'], governance: ['AIAD-RGPD'] })],
  });
  assert.equal(r.typeA.total, 0);
});

test('calculerViolations — Type A : hors Tier 1 ignoré', () => {
  const r = calculerViolations(null, {
    specs: [specInline('SPEC-001-1', { governance: 'AIAD-AI-ACT' })],
  }, {
    codeScan: [codeInline('src/a.ts', { specs: ['SPEC-001-1'], governance: ['AIAD-CUSTOM-XYZ'] })],
  });
  assert.equal(r.typeA.total, 0, 'tag hors TIER1 → ignoré');
});

test('calculerViolations — Type B : SPEC déclare tag, aucun code', () => {
  const r = calculerViolations(null, {
    specs: [specInline('SPEC-002-1', { statut: 'done', governance: 'AIAD-RGAA' })],
  }, {
    codeScan: [codeInline('src/b.ts', { specs: ['SPEC-002-1'], governance: [] })],
  });
  assert.equal(r.typeB.total, 1);
  assert.equal(r.typeB.entrees[0].tag, 'AIAD-RGAA');
  assert.equal(r.typeB.entrees[0].statut, 'done');
});

test('calculerViolations — Type B : SPEC draft ignorée', () => {
  const r = calculerViolations(null, {
    specs: [specInline('SPEC-003-1', { statut: 'draft', governance: 'AIAD-RGPD' })],
  }, { codeScan: [] });
  assert.equal(r.typeB.total, 0, 'draft non actif → exclu');
});

test('calculerViolations — Type B : satisfaite par tout fichier annoté', () => {
  const r = calculerViolations(null, {
    specs: [specInline('SPEC-004-1', { statut: 'in-progress', governance: 'AIAD-RGPD' })],
  }, {
    codeScan: [
      codeInline('src/c1.ts', { specs: ['SPEC-004-1'], governance: ['AIAD-RGPD'] }),
      codeInline('src/c2.ts', { specs: ['SPEC-004-1'], governance: [] }),
    ],
  });
  assert.equal(r.typeB.total, 0, 'au moins 1 fichier couvre → OK');
});

test('calculerViolations — Type A + Type B combinés + parTag agrégé', () => {
  const r = calculerViolations(null, {
    specs: [
      specInline('SPEC-A', { statut: 'done', governance: 'AIAD-RGPD' }),
      specInline('SPEC-B', { statut: 'in-progress', governance: 'AIAD-AI-ACT' }),
    ],
  }, {
    codeScan: [
      // SPEC-A : code dit RGAA, SPEC dit RGPD → A
      codeInline('src/a.ts', { specs: ['SPEC-A'], governance: ['AIAD-RGAA'] }),
      // SPEC-B : pas de code annoté → B pour AI-ACT
      codeInline('src/b.ts', { specs: ['SPEC-B'], governance: [] }),
      // SPEC-A : RGPD non couverte → B pour RGPD aussi (et code dit RGAA non déclaré)
    ],
  });
  assert.equal(r.typeA.total, 1, 'AIAD-RGAA non déclarée dans SPEC-A');
  assert.equal(r.typeB.total, 2, 'SPEC-A.RGPD + SPEC-B.AI-ACT non implémentées');
  assert.ok(r.parTag['AIAD-RGAA']);
  assert.ok(r.parTag['AIAD-RGPD']);
  assert.ok(r.parTag['AIAD-AI-ACT']);
});

test('calculerViolations — SPEC orpheline du code → Type A ignoré (gap existant)', () => {
  // Code annoté pour SPEC-INCONNUE → on n'attribue pas une violation Type A
  // (on n'a pas la SPEC pour comparer). Le gap est déjà capté par sdd-trace.
  const r = calculerViolations(null, {
    specs: [],
  }, {
    codeScan: [codeInline('src/x.ts', { specs: ['SPEC-FANTOME'], governance: ['AIAD-RGPD'] })],
  });
  assert.equal(r.typeA.total, 0);
});

test('calculerViolations — code sans @spec ignoré', () => {
  const r = calculerViolations(null, {
    specs: [specInline('SPEC-1', { governance: 'AIAD-AI-ACT' })],
  }, {
    codeScan: [codeInline('src/y.ts', { specs: [], governance: ['AIAD-RGPD'] })],
  });
  assert.equal(r.typeA.total, 0, 'pas attribuable sans @spec');
});

test('blocViolations — sans donnees → chaîne vide', () => {
  assert.equal(blocViolations({}), '');
});

test('blocViolations — 0 violations → section ok', () => {
  const html = blocViolations({ violations: { total: 0, typeA: { total: 0, entrees: [] }, typeB: { total: 0, entrees: [] }, parTag: {} } });
  assert.match(html, /Aucune violation gouvernance détectée/);
  assert.match(html, /Violations Tier 1.*0/);
});

test('blocViolations — Type A rendu en table', () => {
  const html = blocViolations({ violations: {
    total: 1,
    typeA: { total: 1, entrees: [{ tag: 'AIAD-RGPD', specId: 'SPEC-1', specFile: '.aiad/specs/SPEC-1.md', codeFile: 'src/a.ts', line: 5 }] },
    typeB: { total: 0, entrees: [] },
    parTag: { 'AIAD-RGPD': 1 },
  } });
  assert.match(html, /Annotations orphelines/);
  assert.match(html, /src\/a\.ts/);
  assert.match(html, /AIAD-RGPD/);
  assert.match(html, /L5/);
});

test('blocViolations — Type B rendu en table', () => {
  const html = blocViolations({ violations: {
    total: 1,
    typeA: { total: 0, entrees: [] },
    typeB: { total: 1, entrees: [{ tag: 'AIAD-AI-ACT', specId: 'SPEC-2', specFile: '.aiad/specs/SPEC-2.md', statut: 'done' }] },
    parTag: { 'AIAD-AI-ACT': 1 },
  } });
  assert.match(html, /SPECs non implémentées/);
  assert.match(html, /SPEC-2/);
  assert.match(html, /AIAD-AI-ACT/);
});

test('Alias EN canoniques', () => {
  assert.equal(computeViolations, calculerViolations);
  assert.equal(violationsSection, blocViolations);
});

// (#311) Type A violations : fichier + ligne hyperliés `#LNN`
test('#311 blocViolations — codeFile + line hyperliés vers `FILE#LNN`', () => {
  const html = blocViolations({ violations: {
    total: 1,
    typeA: { total: 1, entrees: [{ tag: 'AIAD-RGPD', specId: 'SPEC-1', specFile: '.aiad/specs/SPEC-1.md', codeFile: 'src/a.ts', line: 5 }] },
    typeB: { total: 0, entrees: [] },
    parTag: { 'AIAD-RGPD': 1 },
  } });
  assert.match(html, /href="\.\.\/src\/a\.ts#L5"/);
  assert.match(html, />L5<\/a>/);
});
