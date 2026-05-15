// Tests `lib/refactor-spec.js` — détection + découpage SPECs (item #103).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  compterLignes, compterCriteres, listerSections, evaluerSpec,
  chargerSpec, listerSpecs, proposerDecoupageStructurel,
  construirePromptDecoupage, parserDecoupageAI,
  refactorSpec, refactorAll, CONSTANTS,
  // alias EN
  countLines, countCriteria, listSections, evaluateSpec,
  loadSpec, listSpecs, proposeStructuralSplit,
  buildSplitPrompt, parseAiSplit, refactor, refactorAllSpecs,
} from '../lib/refactor-spec.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-rs-')); }
function silent(fn) {
  return async (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return await fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

function fakeOllamaFetch(reponse) {
  return async () => ({
    ok: true, status: 200,
    text: async () => JSON.stringify({ response: reponse }),
    json: async () => ({ response: reponse }),
  });
}

// ─── compterLignes / compterCriteres ───────────────────────────────────────

test('compterLignes — corps multi-ligne', () => {
  assert.equal(compterLignes('a\nb\nc'), 3);
  assert.equal(compterLignes(''), 1);
  assert.equal(compterLignes(null), 0);
});

test('compterCriteres — pattern EARS classique', () => {
  const body = `
WHEN user logs in THE SYSTEM SHALL respond.
IF token expired THEN THE SYSTEM SHALL refuse.
WHILE session active THE SYSTEM SHALL refresh.
WHERE token contains scope, THE SYSTEM SHALL grant.
`;
  assert.equal(compterCriteres(body), 4);
});

test('compterCriteres — pattern EARS francisé', () => {
  const body = `
QUAND l'utilisateur se connecte LE SYSTÈME DOIT répondre.
SI le token expire LE SYSTÈME DOIT refuser.
LORSQUE la session est active LE SYSTÈME DOIT rafraîchir.
`;
  assert.equal(compterCriteres(body), 3);
});

test('compterCriteres — bullets AC-N', () => {
  const body = `
- **AC-1** Premier critère
- **AC-2** Deuxième
- **AC-3** Troisième
`;
  assert.equal(compterCriteres(body), 3);
});

test('compterCriteres — bullets Critère N', () => {
  const body = `- **Critère 1** A\n- **Critère 2** B\n`;
  assert.equal(compterCriteres(body), 2);
});

test('compterCriteres — body non-string → 0', () => {
  assert.equal(compterCriteres(null), 0);
});

// ─── listerSections ────────────────────────────────────────────────────────

test('listerSections — H2 et H3 détectées', () => {
  const body = `
# H1 ignoré

## Premier H2
content

### Sous-section H3
content

## Deuxième H2
end
`;
  const s = listerSections(body);
  assert.equal(s.length, 3);
  assert.equal(s[0].level, 2);
  assert.equal(s[0].titre, 'Premier H2');
  assert.equal(s[1].level, 3);
  assert.equal(s[2].titre, 'Deuxième H2');
});

test('listerSections — fin de section calculée', () => {
  const body = '## A\nx\ny\n## B\nz';
  const s = listerSections(body);
  assert.equal(s[0].fin, 2);
  assert.equal(s[1].fin, 4);
});

test('listerSections — body vide → []', () => {
  assert.deepEqual(listerSections(''), []);
});

// ─── evaluerSpec ───────────────────────────────────────────────────────────

test('evaluerSpec — sous les seuils', () => {
  const body = '## A\nshort body\n\n## B\nshort.';
  const r = evaluerSpec(body);
  assert.equal(r.depasseLoc, false);
  assert.equal(r.depasseCriteres, false);
  assert.equal(r.doitRefactoriser, false);
});

test('evaluerSpec — > 200 LOC → flag depasseLoc', () => {
  const body = Array.from({ length: 250 }, () => 'line').join('\n');
  const r = evaluerSpec(body);
  assert.equal(r.depasseLoc, true);
  assert.equal(r.doitRefactoriser, true);
});

test('evaluerSpec — > 7 critères EARS → flag depasseCriteres', () => {
  const body = Array.from({ length: 10 },
    (_, i) => `WHEN x${i} THE SYSTEM SHALL y.`).join('\n');
  const r = evaluerSpec(body);
  assert.equal(r.criteres, 10);
  assert.equal(r.depasseCriteres, true);
});

// ─── chargerSpec / listerSpecs ─────────────────────────────────────────────

test('chargerSpec — dossier absent → throw', () => {
  const d = tmp();
  try {
    assert.throws(() => chargerSpec(d, 'SPEC-001-1-x'), /\.aiad\/specs\/ introuvable/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerSpec — fichier introuvable → throw', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    assert.throws(() => chargerSpec(d, 'SPEC-999'), /SPEC SPEC-999 introuvable/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerSpecs — filtre _index et template', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', '_index.md'), '');
    writeFileSync(join(d, '.aiad', 'specs', 'spec-ears-template.md'), '');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'), '');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-002-1-y.md'), '');
    const r = listerSpecs(d);
    assert.deepEqual(r.sort(), ['SPEC-001-1-x', 'SPEC-002-1-y']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── proposerDecoupageStructurel ──────────────────────────────────────────

test('proposerDecoupageStructurel — < 3 sections → []', () => {
  const spec = { id: 'SPEC-001-1-x', frontmatter: { title: 'T' }, body: '## A\nx\n## B\ny' };
  assert.deepEqual(proposerDecoupageStructurel(spec), []);
});

test('proposerDecoupageStructurel — 3 sections H2 → 3 sous-SPECs', () => {
  const spec = {
    id: 'SPEC-001-1-x',
    frontmatter: { title: 'Auth' },
    body: '## Login\nx\n## Logout\ny\n## Refresh\nz',
  };
  const r = proposerDecoupageStructurel(spec);
  assert.equal(r.length, 3);
  for (const s of r) {
    assert.match(s.id, /^SPEC-001-\d+-/);
    assert.match(s.titre, /^Auth — /);
    assert.ok(s.body.length > 0);
  }
});

test('proposerDecoupageStructurel — slug normalisé (accents, espaces)', () => {
  const spec = {
    id: 'SPEC-001-1-x',
    frontmatter: { title: 'T' },
    body: '## Création de compte\nx\n## Connexion sécurisée\ny\n## Récupération mot de passe\nz',
  };
  const r = proposerDecoupageStructurel(spec);
  assert.match(r[0].id, /SPEC-001-1-creation-de-compte/);
  assert.match(r[1].id, /SPEC-001-2-connexion-securisee/);
});

// ─── construirePromptDecoupage / parserDecoupageAI ────────────────────────

test('construirePromptDecoupage — instruction JSON + seuils inclus', () => {
  const spec = { id: 'X', frontmatter: { title: 'T' }, body: '...' };
  const ev = { loc: 250, criteres: 12 };
  const p = construirePromptDecoupage(spec, ev);
  assert.match(p, /250 lignes/);
  assert.match(p, /12 critères/);
  assert.match(p, /STRICTEMENT au format JSON/);
  assert.match(p, /"sousSpecs"/);
});

test('parserDecoupageAI — JSON valide normalisé', () => {
  const brut = JSON.stringify({
    sousSpecs: [
      { titre: 'A', perimetre: 'p1', criteres: ['c1', 'c2'] },
      { title: 'B', scope: 'p2', criteria: ['c3'] },
    ],
    rationale: 'ok',
  });
  const r = parserDecoupageAI(brut);
  assert.equal(r.sousSpecs.length, 2);
  assert.equal(r.sousSpecs[0].titre, 'A');
  assert.equal(r.sousSpecs[1].titre, 'B'); // alias title
  assert.equal(r.sousSpecs[1].perimetre, 'p2'); // alias scope
  assert.equal(r.rationale, 'ok');
});

test('parserDecoupageAI — JSON invalide → throw', () => {
  assert.throws(() => parserDecoupageAI('pas de JSON'), /sans JSON/);
});

test('parserDecoupageAI — sousSpecs absent → throw', () => {
  assert.throws(() => parserDecoupageAI('{}'), /sousSpecs manquant/);
});

// ─── refactorSpec (pipeline) ──────────────────────────────────────────────

test('refactorSpec — SPEC sous les seuils → message ✓', silent(async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'),
      '---\ntitle: T\n---\n## A\nshort\n## B\nshort');
    const r = await refactorSpec(d, 'SPEC-001-1-x');
    assert.equal(r.evaluation.doitRefactoriser, false);
    assert.equal(r.proposition.sousSpecs.length, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('refactorSpec — SPEC volumineuse mode structurel → découpage par sections', silent(async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    const longBody = ['---', 'title: Auth', '---'].concat(
      Array.from({ length: 250 }, () => 'line of body'),
      ['## Login', 'x', '## Logout', 'y', '## Refresh', 'z'],
    ).join('\n');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-042-1-auth.md'), longBody);
    const r = await refactorSpec(d, 'SPEC-042-1-auth');
    assert.equal(r.evaluation.doitRefactoriser, true);
    assert.equal(r.proposition.mode, 'structurel');
    assert.ok(r.proposition.sousSpecs.length >= 3);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('refactorSpec --ai → utilise Ollama mocké', silent(async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    const longBody = ['---', 'title: T', '---'].concat(
      Array.from({ length: 250 }, () => 'line'),
    ).join('\n');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-042-1-x.md'), longBody);
    const fakeReponse = JSON.stringify({
      sousSpecs: [
        { titre: 'A', perimetre: 'p', criteres: ['c1'] },
        { titre: 'B', perimetre: 'p2', criteres: ['c2'] },
      ],
      rationale: 'cohérence',
    });
    const r = await refactorSpec(d, 'SPEC-042-1-x', {
      ai: true, fetch: fakeOllamaFetch(fakeReponse),
    });
    assert.equal(r.proposition.mode, 'ai');
    assert.equal(r.proposition.sousSpecs.length, 2);
    assert.equal(r.proposition.rationale, 'cohérence');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('refactorSpec --ai avec Ollama indisponible → fallback structurel', silent(async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    const longBody = ['---', 'title: T', '---'].concat(
      Array.from({ length: 250 }, () => 'line'),
      ['## A', 'x', '## B', 'y', '## C', 'z'],
    ).join('\n');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'), longBody);
    const r = await refactorSpec(d, 'SPEC-001-1-x', {
      ai: true,
      fetch: () => { throw new Error('Ollama down'); },
    });
    assert.equal(r.proposition.mode, 'fallback-structurel');
    assert.match(r.proposition.rationale, /Ollama indisponible/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('refactorSpec --json → JSON exploitable', async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'),
      '---\ntitle: T\n---\n## A\nx');
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { await refactorSpec(d, 'SPEC-001-1-x', { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.spec, 'SPEC-001-1-x');
    assert.ok(parsed.evaluation);
    assert.ok(parsed.proposition);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── refactorAll ──────────────────────────────────────────────────────────

test('refactorAll — toutes sous seuils → liste vide', silent(async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'),
      '---\ntitle: T\n---\nshort');
    const r = await refactorAll(d);
    assert.equal(r.candidats.length, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('refactorAll — mixte → seules les volumineuses listées', silent(async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'),
      '---\ntitle: T\n---\nshort');
    const longBody = ['---', 'title: Big', '---'].concat(
      Array.from({ length: 250 }, () => 'line'),
    ).join('\n');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-002-1-big.md'), longBody);
    const r = await refactorAll(d);
    assert.equal(r.candidats.length, 1);
    assert.equal(r.candidats[0].id, 'SPEC-002-1-big');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(countLines, compterLignes);
  assert.equal(countCriteria, compterCriteres);
  assert.equal(listSections, listerSections);
  assert.equal(evaluateSpec, evaluerSpec);
  assert.equal(loadSpec, chargerSpec);
  assert.equal(listSpecs, listerSpecs);
  assert.equal(proposeStructuralSplit, proposerDecoupageStructurel);
  assert.equal(buildSplitPrompt, construirePromptDecoupage);
  assert.equal(parseAiSplit, parserDecoupageAI);
  assert.equal(refactor, refactorSpec);
  assert.equal(refactorAllSpecs, refactorAll);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.SEUIL_LOC, 200);
  assert.equal(CONSTANTS.SEUIL_CRITERES, 7);
  assert.equal(CONSTANTS.SEUIL_SECTIONS, 3);
});
