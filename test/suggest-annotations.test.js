// Tests `lib/suggest-annotations.js` — suggestions d'annotations via Ollama.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  lireSpecsDisponibles,
  lireAgentsDisponibles,
  construirePromptAnnotations,
  parserSuggestions,
  genererBlocAnnotations,
  suggererAnnotations,
  // alias EN
  listAvailableSpecs,
  listAvailableAgents,
  buildAnnotationPrompt,
  parseSuggestions,
  generateAnnotationBlock,
  suggestAnnotations,
} from '../lib/suggest-annotations.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-sa-')); }

function silentLog(fn) {
  return async (...args) => {
    const orig = console.log;
    console.log = () => {};
    try { return await fn(...args); }
    finally { console.log = orig; }
  };
}

// ─── Lecture du contexte ────────────────────────────────────────────────────

test('lireSpecsDisponibles — extrait id + title depuis frontmatter', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/specs'), { recursive: true });
    writeFileSync(join(d, '.aiad/specs/SPEC-001-1-auth.md'),
      '---\ntitle: Authentification OIDC\n---\n# corps');
    writeFileSync(join(d, '.aiad/specs/SPEC-002-1-pay.md'),
      '---\ntitle: Paiement carte\n---\n# corps');
    writeFileSync(join(d, '.aiad/specs/spec-ears-template.md'), '---\n---\ntemplate ignoré');
    const specs = lireSpecsDisponibles(d);
    assert.equal(specs.length, 2);
    const auth = specs.find((s) => s.id === 'SPEC-001-1-auth');
    assert.equal(auth.title, 'Authentification OIDC');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireSpecsDisponibles — dossier absent → []', () => {
  const d = tmp();
  try {
    assert.deepEqual(lireSpecsDisponibles(d), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireAgentsDisponibles — liste les AIAD-*.md (sans _index)', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/gouvernance'), { recursive: true });
    writeFileSync(join(d, '.aiad/gouvernance/AIAD-RGPD.md'), 'x');
    writeFileSync(join(d, '.aiad/gouvernance/AIAD-CRA.md'), 'x');
    writeFileSync(join(d, '.aiad/gouvernance/_index.md'), 'index');
    writeFileSync(join(d, '.aiad/gouvernance/README.md'), 'readme'); // pas AIAD-
    const agents = lireAgentsDisponibles(d);
    assert.deepEqual(agents.sort(), ['AIAD-CRA', 'AIAD-RGPD']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── construirePromptAnnotations ────────────────────────────────────────────

test('construirePromptAnnotations — inclut chemin + extrait + SPECs + agents + JSON schéma', () => {
  const p = construirePromptAnnotations(
    'src/auth.ts',
    'export function login() { return null; }',
    [{ id: 'SPEC-001-1-auth', title: 'Auth OIDC' }],
    ['AIAD-RGPD', 'AIAD-CRA'],
  );
  assert.match(p, /src\/auth\.ts/);
  assert.match(p, /export function login/);
  assert.match(p, /SPEC-001-1-auth : Auth OIDC/);
  assert.match(p, /AIAD-RGPD, AIAD-CRA/);
  assert.match(p, /JSON valide/);
  assert.match(p, /"specs": \["SPEC/);
});

test('construirePromptAnnotations — pas de SPEC → instruction agents seulement', () => {
  const p = construirePromptAnnotations('src/x.ts', 'code', [], ['AIAD-RGPD']);
  assert.match(p, /Aucune SPEC disponible/);
  assert.match(p, /AIAD-RGPD/);
});

test('construirePromptAnnotations — tronque à 4000 chars', () => {
  const long = 'X'.repeat(10000);
  const p = construirePromptAnnotations('a.ts', long, [], []);
  assert.ok(p.length < 6000, `prompt trop long : ${p.length}`);
});

test('construirePromptAnnotations — tronque la liste de SPECs à 50', () => {
  const specs = Array.from({ length: 80 }, (_, i) => ({
    id: `SPEC-${String(i).padStart(3, '0')}-1-x`,
    title: `Spec ${i}`,
  }));
  const p = construirePromptAnnotations('a.ts', 'x', specs, []);
  // Seules les 50 premières apparaissent + un "+30 autres"
  const occurrences = (p.match(/SPEC-/g) || []).length;
  assert.ok(occurrences <= 60, `attendu ≤ 60, vu ${occurrences}`);
  assert.match(p, /\+30 autres/);
});

// ─── parserSuggestions ──────────────────────────────────────────────────────

test('parserSuggestions — JSON valide complet', () => {
  const brut = JSON.stringify({
    specs: ['SPEC-001-1-auth'],
    governance: ['AIAD-RGPD'],
    verified_by: ['tests/auth.test.ts'],
    confidence: 80,
    reasoning: 'Code d\'authentification OIDC.',
  });
  const r = parserSuggestions(
    brut,
    [{ id: 'SPEC-001-1-auth', title: 'Auth' }],
    ['AIAD-RGPD'],
  );
  assert.deepEqual(r.specs, ['SPEC-001-1-auth']);
  assert.deepEqual(r.governance, ['AIAD-RGPD']);
  assert.equal(r.confidence, 80);
  assert.match(r.reasoning, /authentification/i);
});

test('parserSuggestions — rejette les SPECs hallucinées (non existantes)', () => {
  const brut = JSON.stringify({
    specs: ['SPEC-001-1-real', 'SPEC-999-9-fake'],
    governance: [],
    confidence: 60,
  });
  const r = parserSuggestions(brut, [{ id: 'SPEC-001-1-real', title: 'X' }], []);
  assert.deepEqual(r.specs, ['SPEC-001-1-real']);
  assert.deepEqual(r.ignored.specs, ['SPEC-999-9-fake']);
});

test('parserSuggestions — rejette les agents inconnus', () => {
  const brut = JSON.stringify({
    specs: [],
    governance: ['AIAD-RGPD', 'AIAD-INVENTÉ'],
  });
  const r = parserSuggestions(brut, [], ['AIAD-RGPD']);
  assert.deepEqual(r.governance, ['AIAD-RGPD']);
  assert.deepEqual(r.ignored.governance, ['AIAD-INVENTÉ']);
});

test('parserSuggestions — confidence borné [0,100]', () => {
  for (const [val, expected] of [[150, 100], [-10, 0], ['haut', 50], [undefined, 50]]) {
    const brut = JSON.stringify({ specs: [], governance: [], confidence: val });
    assert.equal(parserSuggestions(brut, [], []).confidence, expected);
  }
});

test('parserSuggestions — extrait JSON depuis texte parasite', () => {
  const brut = `Voici l'analyse :
${JSON.stringify({ specs: [], governance: [], confidence: 70 })}
Fin.`;
  const r = parserSuggestions(brut, [], []);
  assert.equal(r.confidence, 70);
});

test('parserSuggestions — pas de JSON → erreur', () => {
  assert.throws(() => parserSuggestions('aucun JSON ici', [], []), /non-JSON/);
});

test('parserSuggestions — JSON malformé → erreur', () => {
  assert.throws(() => parserSuggestions('{ "specs": [', [], []), /non-JSON|invalide/);
});

test('parserSuggestions — verified_by tronqué à 5 entrées', () => {
  const brut = JSON.stringify({
    specs: [], governance: [],
    verified_by: ['t1', 't2', 't3', 't4', 't5', 't6', 't7'],
  });
  const r = parserSuggestions(brut, [], []);
  assert.equal(r.verified_by.length, 5);
});

// ─── genererBlocAnnotations ─────────────────────────────────────────────────

test('genererBlocAnnotations — JSDoc complet avec specs/governance/verified_by', () => {
  const r = genererBlocAnnotations({
    specs: ['SPEC-001-1-x', 'SPEC-002-1-y'],
    governance: ['AIAD-RGPD', 'AIAD-CRA'],
    verified_by: ['tests/x.test.ts'],
  });
  assert.match(r, /^\/\*\*$/m);
  assert.match(r, /@spec SPEC-001-1-x/);
  assert.match(r, /@spec SPEC-002-1-y/);
  assert.match(r, /@verified-by tests\/x\.test\.ts/);
  assert.match(r, /@governance AIAD-RGPD,AIAD-CRA/);
  assert.match(r, /\*\/\s*$/);
});

test('genererBlocAnnotations — style Python (#)', () => {
  const r = genererBlocAnnotations({
    specs: ['SPEC-001-1-x'],
    governance: ['AIAD-RGPD'],
    verified_by: [],
  }, { comment: 'py' });
  assert.match(r, /# @spec SPEC-001-1-x/);
  assert.match(r, /# @governance AIAD-RGPD/);
  assert.ok(!r.includes('/**'));
});

test('genererBlocAnnotations — vide si rien à annoter', () => {
  const r = genererBlocAnnotations({ specs: [], governance: [], verified_by: [] });
  assert.equal(r, '');
});

// ─── alias EN ───────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(listAvailableSpecs, lireSpecsDisponibles);
  assert.equal(listAvailableAgents, lireAgentsDisponibles);
  assert.equal(buildAnnotationPrompt, construirePromptAnnotations);
  assert.equal(parseSuggestions, parserSuggestions);
  assert.equal(generateAnnotationBlock, genererBlocAnnotations);
  assert.equal(suggestAnnotations, suggererAnnotations);
});

// ─── Pipeline avec fetch mocké ──────────────────────────────────────────────

function fakeFetchOk(reponse) {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({ response: reponse }),
  });
}

test('suggererAnnotations — pipeline complet via fetch mocké', silentLog(async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/specs'), { recursive: true });
    mkdirSync(join(d, '.aiad/gouvernance'), { recursive: true });
    writeFileSync(join(d, '.aiad/specs/SPEC-001-1-auth.md'), '---\ntitle: Auth\n---\n# spec');
    writeFileSync(join(d, '.aiad/gouvernance/AIAD-RGPD.md'), '# rgpd');
    writeFileSync(join(d, 'src.ts'), 'export function login() {}');

    const reponse = JSON.stringify({
      specs: ['SPEC-001-1-auth'],
      governance: ['AIAD-RGPD'],
      verified_by: ['tests/auth.test.ts'],
      confidence: 75,
      reasoning: 'Code d\'auth.',
    });
    const r = await suggererAnnotations(d, 'src.ts', { fetch: fakeFetchOk(reponse) });
    assert.equal(r.suggestions.confidence, 75);
    assert.deepEqual(r.suggestions.specs, ['SPEC-001-1-auth']);
    assert.deepEqual(r.suggestions.governance, ['AIAD-RGPD']);
    assert.match(r.bloc, /@spec SPEC-001-1-auth/);
    assert.match(r.bloc, /@governance AIAD-RGPD/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('suggererAnnotations — fichier absent → erreur explicite', async () => {
  const d = tmp();
  try {
    await assert.rejects(
      suggererAnnotations(d, 'inexistant.ts', { fetch: fakeFetchOk('{}') }),
      /introuvable/,
    );
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('suggererAnnotations --json → JSON exploitable sur stdout', async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/specs'), { recursive: true });
    writeFileSync(join(d, '.aiad/specs/SPEC-001-1-x.md'), '---\ntitle: X\n---\n');
    writeFileSync(join(d, 'a.py'), 'def f(): pass');
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try {
      const reponse = JSON.stringify({ specs: ['SPEC-001-1-x'], governance: [], confidence: 60 });
      await suggererAnnotations(d, 'a.py', { fetch: fakeFetchOk(reponse), json: true });
    } finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.file, 'a.py');
    assert.deepEqual(parsed.suggestions.specs, ['SPEC-001-1-x']);
    // Style Python (commentaires #)
    assert.match(parsed.block, /^# @spec/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('suggererAnnotations — détection style commentaire selon extension', silentLog(async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/specs'), { recursive: true });
    writeFileSync(join(d, '.aiad/specs/SPEC-001-1-x.md'), '---\ntitle: X\n---\n');
    writeFileSync(join(d, 'a.py'), 'pass');
    writeFileSync(join(d, 'b.ts'), 'x');
    writeFileSync(join(d, 'c.sh'), 'echo');

    const reponse = JSON.stringify({ specs: ['SPEC-001-1-x'], governance: [], confidence: 60 });

    const py = await suggererAnnotations(d, 'a.py', { fetch: fakeFetchOk(reponse) });
    assert.match(py.bloc, /^# @spec/);
    const ts = await suggererAnnotations(d, 'b.ts', { fetch: fakeFetchOk(reponse) });
    assert.match(ts.bloc, /\/\*\*/);
    const sh = await suggererAnnotations(d, 'c.sh', { fetch: fakeFetchOk(reponse) });
    assert.match(sh.bloc, /^# @spec/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));
