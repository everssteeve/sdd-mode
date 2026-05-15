// Tests `lib/provenance.js` — attestation SLSA Provenance v1.0 signée HMAC.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  digestsFichiers, construireStatement, signerStatement,
  verifierAttestation, bundleSigstoreCommande,
  // alias EN
  fileDigests, buildStatement, signStatement, verifyAttestation, sigstoreBundleCommand,
} from '../lib/provenance.js';

const SECRET = '0123456789abcdef-prov-secret-32chars';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-prov-')); }

// ─── digestsFichiers ───────────────────────────────────────────────────────

test('digestsFichiers — sha256 par fichier', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'a.txt'), 'hello');
    writeFileSync(join(d, 'b.txt'), 'world');
    const r = digestsFichiers(d, [{ path: 'a.txt' }, { path: 'b.txt' }]);
    assert.equal(r.length, 2);
    for (const s of r) {
      assert.ok(s.name);
      assert.match(s.digest.sha256, /^[0-9a-f]{64}$/);
    }
    assert.notEqual(r[0].digest.sha256, r[1].digest.sha256);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── construireStatement ───────────────────────────────────────────────────

test('construireStatement — format in-toto + SLSA v1.0', () => {
  const subject = [{ name: 'a.txt', digest: { sha256: 'a'.repeat(64) } }];
  const stmt = construireStatement({ subject, commit: 'abc123', tag: 'v1.0.0' });
  assert.equal(stmt._type, 'https://in-toto.io/Statement/v1');
  assert.equal(stmt.predicateType, 'https://slsa.dev/provenance/v1');
  assert.deepEqual(stmt.subject, subject);
  assert.ok(stmt.predicate.buildDefinition);
  assert.equal(stmt.predicate.buildDefinition.externalParameters.commit, 'abc123');
  assert.equal(stmt.predicate.buildDefinition.externalParameters.tag, 'v1.0.0');
  assert.ok(stmt.predicate.runDetails.builder.id);
  assert.ok(stmt.predicate.runDetails.metadata.invocationId);
});

test('construireStatement — subject vide → throw', () => {
  assert.throws(() => construireStatement({ subject: [] }), /subject requis/);
});

test('construireStatement — subject sans digest.sha256 → throw', () => {
  assert.throws(
    () => construireStatement({ subject: [{ name: 'a.txt', digest: {} }] }),
    /digest\.sha256 requis/,
  );
});

test('construireStatement — builderId custom + version aiad', () => {
  const stmt = construireStatement({
    subject: [{ name: 'x', digest: { sha256: 'a'.repeat(64) } }],
    builderId: 'https://example.com/builder',
    aiadVersion: '1.14.0',
  });
  assert.equal(stmt.predicate.runDetails.builder.id, 'https://example.com/builder');
  assert.equal(stmt.predicate.runDetails.builder.version['aiad-sdd'], '1.14.0');
});

// ─── signerStatement / verifierAttestation ─────────────────────────────────

test('signerStatement — secret < 16 → throw', () => {
  const stmt = construireStatement({ subject: [{ name: 'x', digest: { sha256: 'a'.repeat(64) } }] });
  assert.throws(() => signerStatement(stmt, 'short'), /≥ 16 caractères/);
});

test('signerStatement + verifierAttestation — round-trip OK (sans racine)', () => {
  const stmt = construireStatement({ subject: [{ name: 'x', digest: { sha256: 'a'.repeat(64) } }] });
  const att = signerStatement(stmt, SECRET);
  assert.equal(att.signature.algorithm, 'hmac-sha256');
  assert.match(att.signature.value, /^[0-9a-f]{64}$/);
  const r = verifierAttestation(att, SECRET);
  assert.equal(r.valid, true);
});

test('verifierAttestation — secret différent → invalide', () => {
  const stmt = construireStatement({ subject: [{ name: 'x', digest: { sha256: 'a'.repeat(64) } }] });
  const att = signerStatement(stmt, SECRET);
  const r = verifierAttestation(att, 'autre-secret-de-32-chars-different');
  assert.equal(r.valid, false);
  assert.ok(r.raisons.some((m) => /HMAC/.test(m)));
});

test('verifierAttestation — statement altéré → signature invalide', () => {
  const stmt = construireStatement({ subject: [{ name: 'x', digest: { sha256: 'a'.repeat(64) } }] });
  const att = signerStatement(stmt, SECRET);
  // Tampering : on modifie le subject sans recalculer la signature
  att.statement.subject[0].name = 'TAMPERED';
  const r = verifierAttestation(att, SECRET);
  assert.equal(r.valid, false);
});

test('verifierAttestation — sans secret → mode warning (raison explicite)', () => {
  const stmt = construireStatement({ subject: [{ name: 'x', digest: { sha256: 'a'.repeat(64) } }] });
  const att = signerStatement(stmt, SECRET);
  const r = verifierAttestation(att, null);
  assert.equal(r.valid, false);
  assert.ok(r.raisons.some((m) => /AIAD_PROVENANCE_SECRET absent/.test(m)));
});

test('verifierAttestation — fichier modifié sur disque → digest invalide', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'a.txt'), 'hello');
    const subject = digestsFichiers(d, [{ path: 'a.txt' }]);
    const stmt = construireStatement({ subject });
    const att = signerStatement(stmt, SECRET);

    // Modification du fichier sur disque APRÈS signature
    writeFileSync(join(d, 'a.txt'), 'tampered');

    const r = verifierAttestation(att, SECRET, d);
    assert.equal(r.valid, false);
    assert.ok(r.raisons.some((m) => /digest sha256 a changé/.test(m)));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('verifierAttestation — fichier subject absent → raison explicite', () => {
  const d = tmp();
  try {
    const stmt = construireStatement({
      subject: [{ name: 'absent.txt', digest: { sha256: 'a'.repeat(64) } }],
    });
    const att = signerStatement(stmt, SECRET);
    const r = verifierAttestation(att, SECRET, d);
    assert.equal(r.valid, false);
    assert.ok(r.raisons.some((m) => /introuvable sur disque/.test(m)));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('verifierAttestation — format invalide → invalide', () => {
  const r = verifierAttestation({ broken: true }, SECRET);
  assert.equal(r.valid, false);
  assert.match(r.raisons[0], /format/);
});

test('verifierAttestation — _type ou predicateType incorrects', () => {
  const stmt = {
    _type: 'wrong-type',
    predicateType: 'wrong-predicate',
    subject: [{ name: 'x', digest: { sha256: 'a'.repeat(64) } }],
    predicate: {},
  };
  const att = signerStatement(stmt, SECRET);
  const r = verifierAttestation(att, SECRET);
  assert.equal(r.valid, false);
  assert.ok(r.raisons.some((m) => /_type attendu/.test(m)));
  assert.ok(r.raisons.some((m) => /predicateType attendu/.test(m)));
});

// ─── bundleSigstoreCommande ────────────────────────────────────────────────

test('bundleSigstoreCommande — produit script cosign valide', () => {
  const cmd = bundleSigstoreCommande('/x');
  assert.match(cmd, /cosign attest-blob/);
  assert.match(cmd, /--predicate \.aiad\/provenance\/attestation\.json/);
  assert.match(cmd, /--type slsaprovenance1/);
  assert.match(cmd, /cosign verify-blob-attestation/);
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(fileDigests, digestsFichiers);
  assert.equal(buildStatement, construireStatement);
  assert.equal(signStatement, signerStatement);
  assert.equal(verifyAttestation, verifierAttestation);
  assert.equal(sigstoreBundleCommand, bundleSigstoreCommande);
});
