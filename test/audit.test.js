// Tests `lib/audit.js` — audit trail crypto-signé append-only.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  sha256, hmacSign,
  construireEvenement, signerEvenement, verifierSignature, verifierChaine,
  appendEvenement, lireLog, hashFichier, afficherLog, verifier,
  // alias EN
  buildEvent, signEvent, verifySignature, verifyChain,
  appendEvent, readLog, hashFile, showLog, verify,
} from '../lib/audit.js';

const SECRET = '0123456789abcdef-secret-test-32-chars';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-audit-')); }

function silenceLog(fn) {
  return (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

// ─── helpers crypto ────────────────────────────────────────────────────────

test('sha256 — hash déterministe préfixé', () => {
  const a = sha256('hello');
  const b = sha256('hello');
  assert.equal(a, b);
  assert.match(a, /^sha256:[0-9a-f]{64}$/);
});

test('hmacSign — signature déterministe préfixée', () => {
  const a = hmacSign('msg', SECRET);
  const b = hmacSign('msg', SECRET);
  assert.equal(a, b);
  assert.match(a, /^hmac-sha256:[0-9a-f]{64}$/);
});

// ─── construireEvenement ───────────────────────────────────────────────────

test('construireEvenement — événement valide avec champs requis', () => {
  const e = construireEvenement({
    action: 'modified',
    artifact: '.aiad/specs/SPEC-001-1-x.md',
    hashAvant: 'sha256:aaa',
    hashApres: 'sha256:bbb',
    actor: 'alice@test',
  });
  assert.equal(e.action, 'modified');
  assert.equal(e.artifact, '.aiad/specs/SPEC-001-1-x.md');
  assert.equal(e.actor, 'alice@test');
  assert.ok(e.hashChain);
  assert.ok(e.ts);
  assert.match(e.hashChain, /^sha256:/);
});

test('construireEvenement — action invalide → throw', () => {
  assert.throws(
    () => construireEvenement({ action: 'fake', artifact: 'x' }),
    /Action inconnue/,
  );
});

test('construireEvenement — artifact manquant → throw', () => {
  assert.throws(() => construireEvenement({ action: 'created' }), /artifact requis/);
});

test('construireEvenement — actor par défaut "anonyme"', () => {
  const e = construireEvenement({ action: 'created', artifact: 'x' });
  assert.equal(e.actor, 'anonyme');
});

test('construireEvenement — chaîne dépend du hashChainPrecedent', () => {
  const e1 = construireEvenement({
    action: 'created', artifact: 'x', ts: '2026-05-10T00:00:00Z',
    hashChainPrecedent: 'sha256:aaa',
  });
  const e2 = construireEvenement({
    action: 'created', artifact: 'x', ts: '2026-05-10T00:00:00Z',
    hashChainPrecedent: 'sha256:bbb',
  });
  assert.notEqual(e1.hashChain, e2.hashChain);
});

// ─── signerEvenement / verifierSignature ───────────────────────────────────

test('signerEvenement — secret < 16 chars → throw', () => {
  const e = construireEvenement({ action: 'created', artifact: 'x' });
  assert.throws(() => signerEvenement(e, 'short'), /≥ 16 caractères/);
});

test('signerEvenement + verifierSignature — round-trip', () => {
  const e = construireEvenement({ action: 'created', artifact: 'x' });
  signerEvenement(e, SECRET);
  assert.match(e.sig, /^hmac-sha256:/);
  const r = verifierSignature(e, SECRET);
  assert.equal(r.valid, true);
});

test('verifierSignature — secret différent → invalide', () => {
  const e = construireEvenement({ action: 'created', artifact: 'x' });
  signerEvenement(e, SECRET);
  const r = verifierSignature(e, 'autre-secret-de-32-chars-different');
  assert.equal(r.valid, false);
  assert.match(r.raison, /signature/);
});

test('verifierSignature — sig absente → invalide', () => {
  assert.equal(verifierSignature({ action: 'x' }, SECRET).valid, false);
});

// ─── verifierChaine ────────────────────────────────────────────────────────

test('verifierChaine — chaîne valide de 3 événements', () => {
  const e1 = construireEvenement({ action: 'created', artifact: 'a', ts: '2026-05-10T01:00:00Z' });
  signerEvenement(e1, SECRET);
  const e2 = construireEvenement({
    action: 'modified', artifact: 'a', ts: '2026-05-10T02:00:00Z',
    hashChainPrecedent: e1.hashChain,
  });
  signerEvenement(e2, SECRET);
  const e3 = construireEvenement({
    action: 'deleted', artifact: 'a', ts: '2026-05-10T03:00:00Z',
    hashChainPrecedent: e2.hashChain,
  });
  signerEvenement(e3, SECRET);

  const r = verifierChaine([e1, e2, e3], SECRET);
  assert.equal(r.valid, true);
  assert.equal(r.raisons.length, 0);
});

test('verifierChaine — événement modifié au milieu → détecté', () => {
  const e1 = construireEvenement({ action: 'created', artifact: 'a', ts: '2026-05-10T01:00:00Z' });
  signerEvenement(e1, SECRET);
  const e2 = construireEvenement({
    action: 'modified', artifact: 'a', ts: '2026-05-10T02:00:00Z',
    hashChainPrecedent: e1.hashChain,
  });
  signerEvenement(e2, SECRET);

  // Tampering : on modifie l'artefact sans recalculer hashChain
  e2.artifact = 'TAMPERED';

  const r = verifierChaine([e1, e2], SECRET);
  assert.equal(r.valid, false);
  assert.ok(r.raisons.some((m) => /hashChain invalide/.test(m)));
});

test('verifierChaine — événement supprimé au milieu → détecté', () => {
  const e1 = construireEvenement({ action: 'created', artifact: 'a', ts: '2026-05-10T01:00:00Z' });
  signerEvenement(e1, SECRET);
  const e2 = construireEvenement({
    action: 'modified', artifact: 'a', ts: '2026-05-10T02:00:00Z',
    hashChainPrecedent: e1.hashChain,
  });
  signerEvenement(e2, SECRET);
  const e3 = construireEvenement({
    action: 'deleted', artifact: 'a', ts: '2026-05-10T03:00:00Z',
    hashChainPrecedent: e2.hashChain,
  });
  signerEvenement(e3, SECRET);

  // Suppression de e2 → e3 ne match plus
  const r = verifierChaine([e1, e3], SECRET);
  assert.equal(r.valid, false);
});

test('verifierChaine — sans secret, vérifie juste la chaîne (pas les sigs)', () => {
  const e1 = construireEvenement({ action: 'created', artifact: 'a', ts: '2026-05-10T01:00:00Z' });
  // Pas de sig
  e1.sig = null;
  const r = verifierChaine([e1]);
  assert.equal(r.valid, true);
});

// ─── appendEvenement / lireLog ─────────────────────────────────────────────

test('appendEvenement — crée le dossier .aiad/audit et écrit JSONL', () => {
  const d = tmp();
  try {
    process.env.AIAD_AUDIT_SECRET = SECRET;
    appendEvenement(d, { action: 'created', artifact: '.aiad/intents/INT-001.md', actor: 'alice' });
    const path = join(d, '.aiad', 'audit', 'audit.jsonl');
    assert.ok(existsSync(path));
    const events = lireLog(d);
    assert.equal(events.length, 1);
    assert.equal(events[0].artifact, '.aiad/intents/INT-001.md');
    assert.match(events[0].sig, /^hmac-sha256:/);
  } finally {
    delete process.env.AIAD_AUDIT_SECRET;
    rmSync(d, { recursive: true, force: true });
  }
});

test('appendEvenement — sans secret → événement non signé (sig=null)', () => {
  const d = tmp();
  try {
    delete process.env.AIAD_AUDIT_SECRET;
    const e = appendEvenement(d, { action: 'created', artifact: 'x', actor: 'a' });
    assert.equal(e.sig, null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('appendEvenement — chaîne 3 événements valide', () => {
  const d = tmp();
  try {
    process.env.AIAD_AUDIT_SECRET = SECRET;
    appendEvenement(d, { action: 'created', artifact: 'a', actor: 'u' });
    appendEvenement(d, { action: 'modified', artifact: 'a', actor: 'u' });
    appendEvenement(d, { action: 'deleted', artifact: 'a', actor: 'u' });
    const events = lireLog(d);
    assert.equal(events.length, 3);
    const r = verifierChaine(events, SECRET);
    assert.equal(r.valid, true);
  } finally {
    delete process.env.AIAD_AUDIT_SECRET;
    rmSync(d, { recursive: true, force: true });
  }
});

test('appendEvenement --dry-run → aucune écriture', () => {
  const d = tmp();
  try {
    appendEvenement(d, { action: 'created', artifact: 'x', actor: 'u' }, { dryRun: true });
    const path = join(d, '.aiad', 'audit', 'audit.jsonl');
    assert.ok(!existsSync(path));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireLog — fichier absent → []', () => {
  const d = tmp();
  try {
    assert.deepEqual(lireLog(d), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireLog — ligne corrompue ignorée', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'audit'), { recursive: true });
    const path = join(d, '.aiad', 'audit', 'audit.jsonl');
    writeFileSync(path, '{"action":"created","artifact":"a","ts":"x","hashChain":"sha256:y"}\nNOT_JSON\n', 'utf-8');
    const events = lireLog(d);
    assert.equal(events.length, 1);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── tampering détecté via verifierChaine sur log JSONL réel ─────────────

test('tampering JSONL — modification d\'une ligne détectée par verify', () => {
  const d = tmp();
  try {
    process.env.AIAD_AUDIT_SECRET = SECRET;
    appendEvenement(d, { action: 'created', artifact: 'a', actor: 'u' });
    appendEvenement(d, { action: 'modified', artifact: 'a', actor: 'u' });
    appendEvenement(d, { action: 'deleted', artifact: 'a', actor: 'u' });

    // Tampering : on remplace la 2e ligne par un JSON modifié
    const path = join(d, '.aiad', 'audit', 'audit.jsonl');
    const lignes = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
    const ev2 = JSON.parse(lignes[1]);
    ev2.actor = 'mallory';
    lignes[1] = JSON.stringify(ev2);
    writeFileSync(path, lignes.join('\n') + '\n', 'utf-8');

    const events = lireLog(d);
    const r = verifierChaine(events, SECRET);
    assert.equal(r.valid, false);
    assert.ok(r.raisons.length >= 1);
  } finally {
    delete process.env.AIAD_AUDIT_SECRET;
    rmSync(d, { recursive: true, force: true });
  }
});

// ─── hashFichier ───────────────────────────────────────────────────────────

test('hashFichier — fichier inexistant → null', () => {
  const d = tmp();
  try {
    assert.equal(hashFichier(d, 'nope.md'), null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('hashFichier — calcule sha256 du contenu', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'a.md'), 'hello');
    const h = hashFichier(d, 'a.md');
    assert.equal(h, sha256('hello'));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── afficherLog / verifier (CLI) ──────────────────────────────────────────

test('afficherLog — texte humain', silenceLog(() => {
  const d = tmp();
  try {
    process.env.AIAD_AUDIT_SECRET = SECRET;
    appendEvenement(d, { action: 'created', artifact: 'a', actor: 'u' });
    const events = afficherLog(d);
    assert.equal(events.length, 1);
  } finally {
    delete process.env.AIAD_AUDIT_SECRET;
    rmSync(d, { recursive: true, force: true });
  }
}));

test('afficherLog --json → JSON sur stdout', () => {
  const d = tmp();
  try {
    process.env.AIAD_AUDIT_SECRET = SECRET;
    appendEvenement(d, { action: 'created', artifact: 'a', actor: 'u' });
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try {
      afficherLog(d, { json: true });
    } finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.total, 1);
    assert.ok(Array.isArray(parsed.events));
  } finally {
    delete process.env.AIAD_AUDIT_SECRET;
    rmSync(d, { recursive: true, force: true });
  }
});

test('verifier — log valide retourne valid=true', silenceLog(() => {
  const d = tmp();
  try {
    process.env.AIAD_AUDIT_SECRET = SECRET;
    appendEvenement(d, { action: 'created', artifact: 'a', actor: 'u' });
    const r = verifier(d);
    assert.equal(r.valid, true);
  } finally {
    delete process.env.AIAD_AUDIT_SECRET;
    rmSync(d, { recursive: true, force: true });
  }
}));

test('verifier — log corrompu retourne valid=false', silenceLog(() => {
  const d = tmp();
  try {
    process.env.AIAD_AUDIT_SECRET = SECRET;
    appendEvenement(d, { action: 'created', artifact: 'a', actor: 'u' });
    // Corruption directe
    const path = join(d, '.aiad', 'audit', 'audit.jsonl');
    const ligne = readFileSync(path, 'utf-8').split('\n')[0];
    const ev = JSON.parse(ligne);
    ev.artifact = 'TAMPERED';
    writeFileSync(path, JSON.stringify(ev) + '\n', 'utf-8');
    const r = verifier(d);
    assert.equal(r.valid, false);
  } finally {
    delete process.env.AIAD_AUDIT_SECRET;
    rmSync(d, { recursive: true, force: true });
  }
}));

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(buildEvent, construireEvenement);
  assert.equal(signEvent, signerEvenement);
  assert.equal(verifySignature, verifierSignature);
  assert.equal(verifyChain, verifierChaine);
  assert.equal(appendEvent, appendEvenement);
  assert.equal(readLog, lireLog);
  assert.equal(hashFile, hashFichier);
  assert.equal(showLog, afficherLog);
  assert.equal(verify, verifier);
});
