// Tests #201 — Visibilité de l'audit trail sur governance.html.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { calculerAuditTrail, blocAuditTrail, computeAuditTrail, auditTrailSection } from '../lib/dashboard/audit-trail.js';
import { construireEvenement, signerEvenement } from '../lib/audit.js';

const SECRET = 'test-secret-key-with-enough-chars';

function tmpProjet() {
  return mkdtempSync(join(tmpdir(), 'aiad-audit-'));
}

function ecrireLog(racine, events) {
  const dir = join(racine, '.aiad', 'audit');
  mkdirSync(dir, { recursive: true });
  const lignes = events.map((e) => JSON.stringify(e)).join('\n');
  writeFileSync(join(dir, 'audit.jsonl'), lignes + '\n', 'utf-8');
}

function eventChaine(input, prev) {
  const e = construireEvenement({ ...input, hashChainPrecedent: prev });
  signerEvenement(e, SECRET);
  return e;
}

test('calculerAuditTrail — sans fichier → totaux à 0', () => {
  const r = calculerAuditTrail(tmpProjet());
  assert.equal(r.fichier, null);
  assert.equal(r.total, 0);
  assert.deepEqual(r.derniers, []);
  assert.deepEqual(r.chaine.raisons, []);
});

test('calculerAuditTrail — 1 événement → chaîne valide + total=1', () => {
  const racine = tmpProjet();
  try {
    const e1 = eventChaine({ action: 'created', artifact: '.aiad/specs/SPEC-1.md', actor: 'alice' }, null);
    ecrireLog(racine, [e1]);
    const r = calculerAuditTrail(racine);
    assert.equal(r.total, 1);
    assert.equal(r.chaine.valide, true);
    assert.equal(r.parAction.created, 1);
    assert.equal(r.derniers.length, 1);
    assert.equal(r.derniers[0].action, 'created');
    assert.equal(r.derniers[0].actor, 'alice');
    assert.equal(r.derniers[0].signe, true);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerAuditTrail — chaîne cassée détectée', () => {
  const racine = tmpProjet();
  try {
    const e1 = eventChaine({ action: 'created', artifact: 'a.md' }, null);
    const e2 = eventChaine({ action: 'modified', artifact: 'a.md' }, e1.hashChain);
    // Casse la chaîne : modifier hashChain de e2.
    e2.hashChain = 'sha256:bidon';
    ecrireLog(racine, [e1, e2]);
    const r = calculerAuditTrail(racine);
    assert.equal(r.chaine.valide, false);
    assert.ok(r.chaine.raisons.length > 0);
    assert.match(r.chaine.raisons[0], /hashChain invalide/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerAuditTrail — recents7j / recents30j calculés depuis ts', () => {
  const racine = tmpProjet();
  try {
    const now = Date.parse('2026-05-13T12:00:00Z');
    const e1 = eventChaine({ action: 'created', artifact: 'a.md', ts: new Date(now - 2 * 86_400_000).toISOString() }, null);
    const e2 = eventChaine({ action: 'modified', artifact: 'a.md', ts: new Date(now - 15 * 86_400_000).toISOString() }, e1.hashChain);
    const e3 = eventChaine({ action: 'modified', artifact: 'a.md', ts: new Date(now - 60 * 86_400_000).toISOString() }, e2.hashChain);
    ecrireLog(racine, [e1, e2, e3]);
    const r = calculerAuditTrail(racine, { now });
    assert.equal(r.recents7j, 1, 'seul e1 dans 7j');
    assert.equal(r.recents30j, 2, 'e1+e2 dans 30j');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerAuditTrail — parAction agrégé', () => {
  const racine = tmpProjet();
  try {
    let prev = null;
    const evs = [];
    for (const a of ['created', 'modified', 'modified', 'deleted', 'created']) {
      const e = eventChaine({ action: a, artifact: 'x.md' }, prev);
      evs.push(e);
      prev = e.hashChain;
    }
    ecrireLog(racine, evs);
    const r = calculerAuditTrail(racine);
    assert.equal(r.parAction.created, 2);
    assert.equal(r.parAction.modified, 2);
    assert.equal(r.parAction.deleted, 1);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerAuditTrail — derniers tronqués à 10, ordre décroissant', () => {
  const racine = tmpProjet();
  try {
    let prev = null;
    const evs = [];
    for (let i = 0; i < 15; i++) {
      const e = eventChaine({ action: 'created', artifact: `f${i}.md` }, prev);
      evs.push(e);
      prev = e.hashChain;
    }
    ecrireLog(racine, evs);
    const r = calculerAuditTrail(racine);
    assert.equal(r.derniers.length, 10);
    assert.equal(r.derniers[0].artifact, 'f14.md', 'le plus récent en tête');
    assert.equal(r.derniers[9].artifact, 'f5.md');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('calculerAuditTrail — hashChain tronqué (pas exposé en entier)', () => {
  const racine = tmpProjet();
  try {
    const e1 = eventChaine({ action: 'created', artifact: 'a.md' }, null);
    ecrireLog(racine, [e1]);
    const r = calculerAuditTrail(racine);
    const h = r.derniers[0].hashChain;
    assert.ok(h.endsWith('…'), 'tronqué');
    assert.ok(h.length < 40, 'court');
    assert.ok(!h.includes(e1.hashChain.slice(20)), 'pas le hash complet');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('blocAuditTrail — sans audit → chaîne vide', () => {
  assert.equal(blocAuditTrail({}), '');
  assert.equal(blocAuditTrail({ auditTrail: null }), '');
});

test('blocAuditTrail — fichier absent ET 0 événements → omis', () => {
  const html = blocAuditTrail({ auditTrail: {
    fichier: null, total: 0, parAction: {}, recents7j: 0, recents30j: 0,
    derniers: [], chaine: { valide: null, raisons: [] },
  } });
  assert.equal(html, '');
});

// (#353) Artifact column hyperliée si path-like
test('#353 blocAuditTrail — Artifact path-like hyperlié, ID arbitraire reste texte', () => {
  const html = blocAuditTrail({ auditTrail: {
    fichier: '.aiad/audit/audit.jsonl',
    total: 2, parAction: {},
    recents7j: 2, recents30j: 2,
    derniers: [
      { ts: '2026-05-14T12:00:00Z', actor: 'bob', action: 'created', artifact: '.aiad/specs/SPEC-007-1.md', hashChain: 'sha256:abc', signe: true },
      { ts: '2026-05-14T12:01:00Z', actor: 'bob', action: 'updated', artifact: 'INTENT-001', hashChain: 'sha256:def', signe: true },
    ],
    chaine: { valide: true, raisons: [] },
  } });
  // Path artifact → hyperlié
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/specs\/SPEC-007-1\.md"[^>]*>\.aiad\/specs\/SPEC-007-1\.md<\/a>/);
  // ID arbitraire → texte simple (pas de slash, pas d'extension)
  assert.match(html, /<td>INTENT-001<\/td>/);
});

// (#325) Intro "Source : <code>FILE</code>" → hyperlien
test('#325 blocAuditTrail — intro "Source" devient un <a> vers .aiad/audit/audit.jsonl', () => {
  const html = blocAuditTrail({ auditTrail: {
    fichier: '.aiad/audit/audit.jsonl',
    total: 1, parAction: { created: 1 },
    recents7j: 1, recents30j: 1,
    derniers: [{ ts: '2026-05-14T12:00:00Z', actor: 'bob', action: 'created', artifact: 'x.md', hashChain: 'sha256:abc', signe: true }],
    chaine: { valide: true, raisons: [] },
  } });
  assert.match(html, /Source : <a[^>]+href="\.\.\/\.aiad\/audit\/audit\.jsonl"[^>]*>\.aiad\/audit\/audit\.jsonl<\/a>/);
});

test('blocAuditTrail — chaîne valide → badge vert', () => {
  const html = blocAuditTrail({ auditTrail: {
    fichier: '.aiad/audit/audit.jsonl',
    total: 5, parAction: { created: 3, modified: 2 },
    recents7j: 2, recents30j: 5,
    derniers: [{ ts: '2026-05-13T12:00:00Z', actor: 'alice', action: 'created', artifact: 'a.md', hashChain: 'sha256:abc123…', signe: true }],
    chaine: { valide: true, raisons: [] },
  } });
  assert.match(html, /Audit Trail/);
  assert.match(html, /chaîne intègre/);
  assert.match(html, /<table>/);
  assert.match(html, /a\.md/);
});

test('blocAuditTrail — chaîne cassée → badge rouge + raisons', () => {
  const html = blocAuditTrail({ auditTrail: {
    fichier: '.aiad/audit/audit.jsonl',
    total: 2, parAction: {},
    recents7j: 0, recents30j: 0,
    derniers: [],
    chaine: { valide: false, raisons: ['L2 : hashChain invalide (attendu sha256:abc..., vu sha256:def...)'] },
  } });
  assert.match(html, /chaîne cassée/);
  assert.match(html, /Chaîne d'intégrité cassée/);
  assert.match(html, /hashChain invalide/);
  assert.match(html, /aiad-sdd audit verify/);
});

test('Alias EN canoniques', () => {
  assert.equal(computeAuditTrail, calculerAuditTrail);
  assert.equal(auditTrailSection, blocAuditTrail);
});
