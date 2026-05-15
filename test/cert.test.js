// Tests `lib/cert.js` — programme certification AIAD.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  NIVEAUX, AXES, MATRICE,
  base64urlEncode, base64urlDecode,
  construirePayload, signerBadge, verifierBadge,
  genererSujetExam, rendreMatriceMarkdown,
  // alias EN
  LEVELS, AXES_LIST, MATRIX,
  buildPayload, signBadge, verifyBadge,
  generateExamSubject, renderMatrixMarkdown,
} from '../lib/cert.js';

const SECRET = '0123456789abcdef-secret-de-test-32-chars';

// ─── Matrice statique ───────────────────────────────────────────────────────

test('NIVEAUX — 5 niveaux dans l\'ordre Découvreur → Architecte', () => {
  assert.deepEqual(NIVEAUX, ['Découvreur', 'Praticien', 'Confirmé', 'Expert', 'Architecte']);
});

test('AXES — 6 axes avec id + label', () => {
  assert.equal(AXES.length, 6);
  for (const a of AXES) {
    assert.ok(a.id);
    assert.ok(a.label);
  }
  const ids = AXES.map((a) => a.id);
  for (const id of ['intent', 'spec', 'drift', 'gouvernance', 'multi-runtime', 'metriques']) {
    assert.ok(ids.includes(id), `axe ${id} absent`);
  }
});

test('MATRICE — 5 niveaux × 6 axes complets', () => {
  for (const niveau of NIVEAUX) {
    assert.ok(MATRICE[niveau], `niveau ${niveau} absent`);
    for (const axe of AXES) {
      const critere = MATRICE[niveau][axe.id];
      assert.ok(typeof critere === 'string' && critere.length > 30, `${niveau}/${axe.id} : critère trop court`);
    }
  }
});

test('MATRICE — progression cohérente Découvreur → Architecte (longueur croissante moyenne attendue)', () => {
  // Test souple : on vérifie juste que chaque niveau est différent du suivant
  for (const axe of AXES) {
    const seen = new Set();
    for (const niveau of NIVEAUX) {
      seen.add(MATRICE[niveau][axe.id]);
    }
    assert.equal(seen.size, NIVEAUX.length, `${axe.id} : critères dupliqués entre niveaux`);
  }
});

// ─── base64url ──────────────────────────────────────────────────────────────

test('base64urlEncode/Decode — round-trip ASCII', () => {
  const input = 'Hello, AIAD World';
  const enc = base64urlEncode(input);
  // Pas de = ni + ni /
  assert.ok(!enc.includes('='));
  assert.ok(!enc.includes('+'));
  assert.ok(!enc.includes('/'));
  assert.equal(base64urlDecode(enc), input);
});

test('base64urlEncode/Decode — round-trip UTF-8 (accents français)', () => {
  const input = 'Découvreur — Architecte / Confirmé';
  assert.equal(base64urlDecode(base64urlEncode(input)), input);
});

// ─── construirePayload ──────────────────────────────────────────────────────

test('construirePayload — payload valide avec champs obligatoires', () => {
  const p = construirePayload({
    candidat: 'Test User',
    niveau: 'Praticien',
    axes: ['intent', 'spec'],
  });
  assert.equal(p.iss, 'AIAD SDD');
  assert.equal(p.sub, 'Test User');
  assert.equal(p.niveau, 'Praticien');
  assert.deepEqual(p.axes, ['intent', 'spec']);
  assert.equal(p.fmt, 'aiad-cert-v1');
  assert.ok(typeof p.iat === 'number');
  assert.ok(p.exp > p.iat);
  // Validité 3 ans (avec marge 1h pour les tests)
  assert.ok(p.exp - p.iat >= 3 * 365 * 24 * 3600 - 3600);
});

test('construirePayload — niveau invalide → erreur', () => {
  assert.throws(
    () => construirePayload({ candidat: 'X', niveau: 'Inexistant', axes: ['intent'] }),
    /Niveau invalide/,
  );
});

test('construirePayload — axes vides → erreur', () => {
  assert.throws(
    () => construirePayload({ candidat: 'X', niveau: 'Praticien', axes: [] }),
    /tableau non vide/,
  );
});

test('construirePayload — axes inconnus → erreur listant les invalides', () => {
  assert.throws(
    () => construirePayload({ candidat: 'X', niveau: 'Praticien', axes: ['intent', 'fake-axis'] }),
    /fake-axis/,
  );
});

test('construirePayload — issuer custom', () => {
  const p = construirePayload({
    candidat: 'X', niveau: 'Praticien', axes: ['intent'],
    issuer: 'Mon Organisation',
  });
  assert.equal(p.iss, 'Mon Organisation');
});

// ─── signer + vérifier ─────────────────────────────────────────────────────

test('signerBadge — produit JWS compact 3 parties séparées par .', () => {
  const p = construirePayload({ candidat: 'X', niveau: 'Praticien', axes: ['intent'] });
  const jws = signerBadge(p, SECRET);
  const parts = jws.split('.');
  assert.equal(parts.length, 3);
});

test('signerBadge — secret trop court → erreur', () => {
  const p = construirePayload({ candidat: 'X', niveau: 'Praticien', axes: ['intent'] });
  assert.throws(() => signerBadge(p, 'court'), /≥ 16 caractères/);
});

test('verifierBadge — round-trip complet (sign → verify)', () => {
  const p = construirePayload({ candidat: 'Steeve', niveau: 'Confirmé', axes: ['intent', 'spec', 'drift'] });
  const jws = signerBadge(p, SECRET);
  const r = verifierBadge(jws, SECRET);
  assert.equal(r.valid, true);
  assert.equal(r.payload.sub, 'Steeve');
  assert.equal(r.payload.niveau, 'Confirmé');
  assert.deepEqual(r.payload.axes, ['intent', 'spec', 'drift']);
});

test('verifierBadge — secret différent → invalide', () => {
  const p = construirePayload({ candidat: 'X', niveau: 'Praticien', axes: ['intent'] });
  const jws = signerBadge(p, SECRET);
  const r = verifierBadge(jws, 'autre-secret-de-32-chars-vide-de-sens');
  assert.equal(r.valid, false);
  assert.match(r.raison, /signature/i);
});

test('verifierBadge — JWS malformé (2 parties) → invalide', () => {
  const r = verifierBadge('header.payload', SECRET);
  assert.equal(r.valid, false);
  assert.match(r.raison, /format JWS invalide/);
});

test('verifierBadge — payload altéré → signature invalide (anti-tampering)', () => {
  const p = construirePayload({ candidat: 'A', niveau: 'Praticien', axes: ['intent'] });
  const jws = signerBadge(p, SECRET);
  const parts = jws.split('.');
  // Falsification : on remplace le payload par un payload qui prétend Architecte
  const fauxPayload = base64urlEncode(JSON.stringify({ ...p, niveau: 'Architecte' }));
  const jwsFalsifie = `${parts[0]}.${fauxPayload}.${parts[2]}`;
  const r = verifierBadge(jwsFalsifie, SECRET);
  assert.equal(r.valid, false);
});

test('verifierBadge — badge expiré → invalide', () => {
  // Construit un badge avec exp dans le passé en bypassant construirePayload
  const now = Math.floor(Date.now() / 1000);
  const payloadExpire = {
    iss: 'AIAD SDD', sub: 'Old', niveau: 'Praticien',
    axes: ['intent'], iat: now - 4 * 365 * 24 * 3600, exp: now - 100,
    examPasse: '2022-01-01', fmt: 'aiad-cert-v1',
  };
  const jws = signerBadge(payloadExpire, SECRET);
  const r = verifierBadge(jws, SECRET);
  assert.equal(r.valid, false);
  assert.match(r.raison, /expiré/i);
});

test('verifierBadge — fmt inconnu → invalide', () => {
  const payload = {
    iss: 'X', sub: 'X', niveau: 'Praticien', axes: ['intent'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    fmt: 'autre-format',
  };
  const jws = signerBadge(payload, SECRET);
  const r = verifierBadge(jws, SECRET);
  assert.equal(r.valid, false);
  assert.match(r.raison, /format/i);
});

// ─── genererSujetExam ──────────────────────────────────────────────────────

test('genererSujetExam — produit un Markdown structuré pour Praticien', () => {
  const r = genererSujetExam('Praticien');
  assert.equal(r.niveau, 'Praticien');
  assert.match(r.sujet, /^# Examen pratique AIAD/m);
  assert.match(r.sujet, /Compétences évaluées/);
  assert.match(r.sujet, /Épreuves/);
  // Les 6 épreuves
  for (const ep of ['Épreuve 1', 'Épreuve 2', 'Épreuve 3', 'Épreuve 4', 'Épreuve 5', 'Épreuve 6']) {
    assert.match(r.sujet, new RegExp(ep));
  }
  assert.equal(r.axesEvalues.length, 6);
});

test('genererSujetExam — adapte les critères au niveau', () => {
  const dec = genererSujetExam('Découvreur');
  const arch = genererSujetExam('Architecte');
  // Critère niveau Architecte spécifique mentionné
  assert.match(arch.sujet, /≥ 50 développeurs|monorepo|régulateur/);
  // Critère niveau Découvreur plus simple
  assert.match(dec.sujet, /premier Intent Statement|≥ 50 caractères/);
});

test('genererSujetExam — niveau invalide → erreur', () => {
  assert.throws(() => genererSujetExam('Inexistant'), /Niveau invalide/);
});

// ─── rendreMatriceMarkdown ─────────────────────────────────────────────────

test('rendreMatriceMarkdown — produit un document complet 5 × 6', () => {
  const md = rendreMatriceMarkdown();
  assert.match(md, /^# Matrice de compétences AIAD/m);
  for (const niveau of NIVEAUX) {
    assert.match(md, new RegExp(`## Niveau — ${niveau}`));
  }
  for (const axe of AXES) {
    // Les 6 axes apparaissent au moins 5 fois (1 fois par niveau)
    const occurrences = (md.match(new RegExp(`### ${axe.label.replace(/[/\\]/g, '\\$&')}`, 'g')) || []).length;
    assert.equal(occurrences, NIVEAUX.length, `${axe.label} : ${occurrences} occurrences au lieu de ${NIVEAUX.length}`);
  }
});

// ─── alias EN ───────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(LEVELS, NIVEAUX);
  assert.equal(AXES_LIST, AXES);
  assert.equal(MATRIX, MATRICE);
  assert.equal(buildPayload, construirePayload);
  assert.equal(signBadge, signerBadge);
  assert.equal(verifyBadge, verifierBadge);
  assert.equal(generateExamSubject, genererSujetExam);
  assert.equal(renderMatrixMarkdown, rendreMatriceMarkdown);
});
