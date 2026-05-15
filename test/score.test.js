// Tests `lib/score.js` — scoring local via Ollama (mock fetch).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CRITERES_SPEC,
  CRITERES_INTENT,
  construirePrompt,
  parserReponseScore,
  chargerArtefact,
  appelerOllama,
  scorerArtefact,
  verdict,
  // alias EN
  buildPrompt,
  parseScoreResponse,
  loadArtifact,
  callOllama,
  scoreArtifact,
  SPEC_CRITERIA,
  INTENT_CRITERIA,
} from '../lib/score.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-score-')); }

function silencer(fn) {
  return async (...args) => {
    const origLog = console.log;
    const origWrite = process.stdout.write.bind(process.stdout);
    console.log = () => {};
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { console.log = origLog; process.stdout.write = origWrite; }
  };
}

// ─── Critères ───────────────────────────────────────────────────────────────

test('CRITERES_SPEC — 5 critères avec key/label/description', () => {
  assert.equal(CRITERES_SPEC.length, 5);
  for (const c of CRITERES_SPEC) {
    assert.equal(typeof c.key, 'string');
    assert.equal(typeof c.label, 'string');
    assert.ok(c.description.length > 20);
  }
  const keys = CRITERES_SPEC.map((c) => c.key);
  for (const k of ['clarte', 'testabilite', 'atomicite', 'observabilite', 'alignementIntent']) {
    assert.ok(keys.includes(k), `${k} absent`);
  }
});

test('CRITERES_INTENT — 4 critères', () => {
  assert.equal(CRITERES_INTENT.length, 4);
  const keys = CRITERES_INTENT.map((c) => c.key);
  for (const k of ['pourquoi', 'consequence', 'frontiere', 'humanAuthorship']) {
    assert.ok(keys.includes(k));
  }
});

// ─── construirePrompt ───────────────────────────────────────────────────────

test('construirePrompt — inclut le contenu de l\'artefact + JSON schéma', () => {
  const p = construirePrompt('spec', '# SPEC-001\n\nContenu de la spec.', CRITERES_SPEC);
  assert.match(p, /Product Engineer/i);
  assert.match(p, /Contenu de la spec/);
  assert.match(p, /clarte/);
  assert.match(p, /testabilite/);
  assert.match(p, /JSON valide/);
  assert.match(p, /feedback/);
});

test('construirePrompt — différencie SPEC vs Intent dans l\'intro', () => {
  const ps = construirePrompt('spec', 'x', CRITERES_SPEC);
  const pi = construirePrompt('intent', 'x', CRITERES_INTENT);
  assert.match(ps, /Spec Driven Development/i);
  assert.match(pi, /Intent Driven Development|Intent Statement/i);
});

test('construirePrompt — tronque le contenu à 4000 caractères', () => {
  const long = 'X'.repeat(10000);
  const p = construirePrompt('spec', long, CRITERES_SPEC);
  // Le prompt total doit être < 10000 + intro
  assert.ok(p.length < 6000, `prompt trop long : ${p.length}`);
});

// ─── parserReponseScore ────────────────────────────────────────────────────

test('parserReponseScore — JSON pur valide', () => {
  const brut = JSON.stringify({
    clarte: 4, testabilite: 5, atomicite: 3, observabilite: 4, alignementIntent: 5,
    feedback: 'Bonne clarté, atomicité à améliorer.',
  });
  const r = parserReponseScore(brut, CRITERES_SPEC);
  assert.equal(r.scores.clarte, 4);
  assert.equal(r.scores.atomicite, 3);
  assert.equal(r.total, 21);
  assert.equal(r.max, 25);
  assert.match(r.feedback, /clarté/);
});

test('parserReponseScore — extrait JSON depuis du texte parasite', () => {
  const brut = `Voici l'analyse :
${JSON.stringify({ clarte: 3, testabilite: 3, atomicite: 3, observabilite: 3, alignementIntent: 3, feedback: 'OK' })}
Fin de l'analyse.`;
  const r = parserReponseScore(brut, CRITERES_SPEC);
  assert.equal(r.total, 15);
});

test('parserReponseScore — pas de JSON → erreur', () => {
  assert.throws(() => parserReponseScore('aucun JSON ici', CRITERES_SPEC), /non-JSON/);
});

test('parserReponseScore — JSON malformé → erreur', () => {
  // Pas de } final → la regex ne matche pas → erreur "non-JSON"
  assert.throws(() => parserReponseScore('{ "clarte": 1, ', CRITERES_SPEC), /non-JSON|invalide/);
  // Avec } mais malformé → erreur "invalide" via JSON.parse
  assert.throws(() => parserReponseScore('{ "clarte": 1, }', CRITERES_SPEC), /invalide|non-JSON/);
});

test('parserReponseScore — score hors borne → erreur', () => {
  const brut = JSON.stringify({
    clarte: 7, testabilite: 5, atomicite: 3, observabilite: 4, alignementIntent: 5,
    feedback: 'X',
  });
  assert.throws(() => parserReponseScore(brut, CRITERES_SPEC), /Score "clarte" invalide/);
});

test('parserReponseScore — score non-entier → erreur', () => {
  const brut = JSON.stringify({
    clarte: 4.5, testabilite: 5, atomicite: 3, observabilite: 4, alignementIntent: 5,
  });
  assert.throws(() => parserReponseScore(brut, CRITERES_SPEC), /clarte.*invalide/);
});

test('parserReponseScore — feedback manquant → string vide', () => {
  const brut = JSON.stringify({
    clarte: 4, testabilite: 5, atomicite: 3, observabilite: 4, alignementIntent: 5,
  });
  const r = parserReponseScore(brut, CRITERES_SPEC);
  assert.equal(r.feedback, '');
});

// ─── verdict ─────────────────────────────────────────────────────────────────

test('verdict — Excellent ≥ 85%', () => {
  const v = verdict(22, 25); // 88%
  assert.equal(v.label, 'Excellent');
});

test('verdict — Bon entre 70 et 85%', () => {
  const v = verdict(20, 25); // 80%
  assert.equal(v.label, 'Bon');
});

test('verdict — À retravailler entre 50 et 70%', () => {
  const v = verdict(15, 25); // 60%
  assert.equal(v.label, 'À retravailler');
});

test('verdict — Insuffisant < 50%', () => {
  const v = verdict(10, 25); // 40%
  assert.equal(v.label, 'Insuffisant');
});

// ─── chargerArtefact ────────────────────────────────────────────────────────

test('chargerArtefact — SPEC par ID exact', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/specs'), { recursive: true });
    writeFileSync(join(d, '.aiad/specs/SPEC-001-1-auth.md'), '---\ntitle: Auth\n---\n\nCorps de la spec.\n');
    const r = chargerArtefact(d, 'spec', 'SPEC-001-1-auth');
    assert.equal(r.frontmatter.title, 'Auth');
    assert.match(r.body, /Corps de la spec/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerArtefact — SPEC par préfixe (SPEC-001-1 résout sur le slug complet)', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/specs'), { recursive: true });
    writeFileSync(join(d, '.aiad/specs/SPEC-001-1-foo.md'), '---\n---\nbody');
    const r = chargerArtefact(d, 'spec', 'SPEC-001-1');
    assert.match(r.path, /SPEC-001-1-foo\.md$/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerArtefact — Intent par ID', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/intents'), { recursive: true });
    writeFileSync(join(d, '.aiad/intents/INTENT-042.md'), '# INTENT-042\nbody');
    const r = chargerArtefact(d, 'intent', 'INTENT-042');
    assert.match(r.contenu, /INTENT-042/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerArtefact — artefact absent → erreur', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/specs'), { recursive: true });
    assert.throws(() => chargerArtefact(d, 'spec', 'SPEC-999'), /introuvable/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerArtefact — dossier absent → erreur', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad'));
    assert.throws(() => chargerArtefact(d, 'spec', 'SPEC-001'), /absent/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── appelerOllama avec fetch mocké ─────────────────────────────────────────

function fakeFetchOk(reponseModele) {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({ response: reponseModele }),
  });
}

function fakeFetchKo(status, body) {
  return async () => ({
    ok: false,
    status,
    text: async () => body,
  });
}

test('appelerOllama — chemin nominal retourne le champ response', async () => {
  const r = await appelerOllama('prompt test', { fetch: fakeFetchOk('réponse modèle'), url: 'http://fake', model: 'tinyllama' });
  assert.equal(r, 'réponse modèle');
});

test('appelerOllama — HTTP non-OK → erreur explicite', async () => {
  await assert.rejects(
    appelerOllama('p', { fetch: fakeFetchKo(503, 'service unavailable') }),
    /Ollama HTTP 503/,
  );
});

test('appelerOllama — réponse sans champ response → erreur', async () => {
  const fakeFetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
  await assert.rejects(appelerOllama('p', { fetch: fakeFetch }), /sans champ/);
});

test('appelerOllama — utilise AIAD_OLLAMA_URL/MODEL si options absentes', async () => {
  let urlVue = '';
  let bodyVu = '';
  const fakeFetch = async (url, opts) => {
    urlVue = url;
    bodyVu = opts.body;
    return { ok: true, status: 200, json: async () => ({ response: 'x' }) };
  };
  const oldUrl = process.env.AIAD_OLLAMA_URL;
  const oldModel = process.env.AIAD_OLLAMA_MODEL;
  process.env.AIAD_OLLAMA_URL = 'http://override';
  process.env.AIAD_OLLAMA_MODEL = 'mistral:7b';
  try {
    await appelerOllama('p', { fetch: fakeFetch });
    assert.equal(urlVue, 'http://override/api/generate');
    assert.match(bodyVu, /"model":"mistral:7b"/);
  } finally {
    if (oldUrl !== undefined) process.env.AIAD_OLLAMA_URL = oldUrl; else delete process.env.AIAD_OLLAMA_URL;
    if (oldModel !== undefined) process.env.AIAD_OLLAMA_MODEL = oldModel; else delete process.env.AIAD_OLLAMA_MODEL;
  }
});

// ─── scorerArtefact pipeline complet ────────────────────────────────────────

test('scorerArtefact — pipeline SPEC complet via fetch mocké', silencer(async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/specs'), { recursive: true });
    writeFileSync(join(d, '.aiad/specs/SPEC-001-1-x.md'), '---\ntitle: X\n---\nCorps');
    const reponse = JSON.stringify({
      clarte: 4, testabilite: 4, atomicite: 4, observabilite: 4, alignementIntent: 4,
      feedback: 'Solide.',
    });
    const r = await scorerArtefact(d, 'spec', 'SPEC-001-1-x', { fetch: fakeFetchOk(reponse) });
    assert.equal(r.total, 20);
    assert.equal(r.max, 25);
    assert.equal(r.verdict.label, 'Bon');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('scorerArtefact — type inconnu → erreur', async () => {
  await assert.rejects(scorerArtefact('/tmp', 'foo', 'INTENT-001', {}), /Type inconnu/);
});

test('scorerArtefact — mode --json écrit JSON sur stdout', async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/intents'), { recursive: true });
    writeFileSync(join(d, '.aiad/intents/INTENT-001.md'), '# INTENT-001\nbody');
    const reponse = JSON.stringify({
      pourquoi: 5, consequence: 4, frontiere: 3, humanAuthorship: 5,
      feedback: 'Bonne intention.',
    });
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try {
      await scorerArtefact(d, 'intent', 'INTENT-001', { fetch: fakeFetchOk(reponse), json: true });
    } finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.id, 'INTENT-001');
    assert.equal(parsed.type, 'intent');
    assert.equal(parsed.total, 17);
    assert.equal(parsed.max, 20);
    // 17/20 = 85% exact → Excellent (seuil ≥ 0.85)
    assert.equal(parsed.verdict, 'Excellent');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── Aliases EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(buildPrompt, construirePrompt);
  assert.equal(parseScoreResponse, parserReponseScore);
  assert.equal(loadArtifact, chargerArtefact);
  assert.equal(callOllama, appelerOllama);
  assert.equal(scoreArtifact, scorerArtefact);
  assert.equal(SPEC_CRITERIA, CRITERES_SPEC);
  assert.equal(INTENT_CRITERIA, CRITERES_INTENT);
});
