// Tests `lib/tutorial.js` — tutoriels in-CLI multiples (item #126).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  TUTORIELS, listerTutoriels, tutorielExiste,
  executerTutoriel, afficherListe,
  // alias EN
  TUTORIALS, listTutorials, tutorialExists, runTutorial, showList,
} from '../lib/tutorial.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-tut-')); }

function silent(fn) {
  return (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

// ─── Catalogue ────────────────────────────────────────────────────────────

test('TUTORIELS — 4 tutoriels initiaux', () => {
  for (const id of ['auth-oidc', 'payment-pci', 'rag-llm', 'gdpr-data-export']) {
    assert.ok(TUTORIELS[id], `${id} absent`);
    assert.ok(TUTORIELS[id].title);
    assert.ok(TUTORIELS[id].intent.title);
    assert.ok(TUTORIELS[id].intent.body);
    assert.ok(TUTORIELS[id].specDomain);
    assert.ok(Array.isArray(TUTORIELS[id].workflow));
    assert.ok(TUTORIELS[id].workflow.length >= 4);
  }
});

test('TUTORIELS — chaque tutoriel a un Intent avec sections Pourquoi/Pour qui/Critère', () => {
  for (const id of Object.keys(TUTORIELS)) {
    const body = TUTORIELS[id].intent.body;
    assert.match(body, /## Pourquoi/);
    assert.match(body, /## Pour qui/);
    assert.match(body, /## Critère de succès/);
  }
});

test('TUTORIELS — workflow contient /sdd intent + spec + gate + exec', () => {
  for (const id of Object.keys(TUTORIELS)) {
    const cmds = TUTORIELS[id].workflow.join('\n');
    assert.match(cmds, /\/sdd intent/);
    assert.match(cmds, /\/sdd spec/);
    assert.match(cmds, /\/sdd gate/);
    assert.match(cmds, /\/sdd exec/);
  }
});

test('listerTutoriels — renvoie tous les tutoriels', () => {
  const r = listerTutoriels();
  assert.equal(r.length, 4);
  for (const t of r) {
    assert.ok(t.id);
    assert.ok(t.title);
    assert.ok(t.specDomain);
  }
});

test('tutorielExiste — true pour les 4 IDs, false pour autres', () => {
  for (const id of ['auth-oidc', 'payment-pci', 'rag-llm', 'gdpr-data-export']) {
    assert.equal(tutorielExiste(id), true);
  }
  assert.equal(tutorielExiste('inconnu'), false);
  assert.equal(tutorielExiste(''), false);
});

// ─── executerTutoriel ────────────────────────────────────────────────────

test('executerTutoriel — id inconnu → throw', () => {
  const d = tmp();
  try {
    assert.throws(() => executerTutoriel(d, 'inconnu'), /Tutoriel inconnu/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('executerTutoriel auth-oidc — crée Intent + SPEC + matrice', silent(() => {
  const d = tmp();
  try {
    const r = executerTutoriel(d, 'auth-oidc');
    assert.equal(r.tutoriel, 'auth-oidc');
    assert.ok(existsSync(join(d, r.intent)));
    assert.ok(existsSync(join(d, r.spec)));
    assert.ok(existsSync(join(d, r.matrice)));
    // Intent contient le titre du tutoriel
    const intentContent = readFileSync(join(d, r.intent), 'utf-8');
    assert.match(intentContent, /Permettre la connexion via un fournisseur OIDC/);
    assert.match(intentContent, /## Pourquoi/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('executerTutoriel — SPEC interpolée depuis le template specs-library', silent(() => {
  const d = tmp();
  try {
    const r = executerTutoriel(d, 'auth-oidc');
    const specContent = readFileSync(join(d, r.spec), 'utf-8');
    // {{title}} et {{parent_intent}} doivent être interpolés
    assert.ok(!specContent.includes('{{title}}'));
    assert.ok(!specContent.includes('{{parent_intent}}'));
    assert.match(specContent, /INT-001/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('executerTutoriel — matrice JSON valide avec 1 gap démo', silent(() => {
  const d = tmp();
  try {
    const r = executerTutoriel(d, 'payment-pci');
    const m = JSON.parse(readFileSync(join(d, r.matrice), 'utf-8'));
    assert.equal(m.intents[0].id, 'INT-001');
    assert.match(m.specs[0].id, /SPEC-001-1-payment-pci/);
    assert.equal(m.gaps.length, 1);
    assert.equal(m.gaps[0].kind, 'spec-without-code');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('executerTutoriel — chacun des 4 tutoriels termine sans crash', silent(() => {
  for (const id of ['auth-oidc', 'payment-pci', 'rag-llm', 'gdpr-data-export']) {
    const d = tmp();
    try {
      const r = executerTutoriel(d, id);
      assert.ok(existsSync(join(d, r.intent)));
      assert.ok(existsSync(join(d, r.spec)));
    } finally { rmSync(d, { recursive: true, force: true }); }
  }
}));

test('executerTutoriel --out custom → sortie alternative', silent(() => {
  const d = tmp();
  try {
    const r = executerTutoriel(d, 'auth-oidc', { out: 'demo-auth' });
    assert.equal(r.dir, 'demo-auth');
    assert.ok(existsSync(join(d, 'demo-auth', 'intents')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('executerTutoriel --json → sortie JSON exploitable', () => {
  const d = tmp();
  try {
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { executerTutoriel(d, 'rag-llm', { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.tutoriel, 'rag-llm');
    assert.ok(Array.isArray(parsed.workflow));
    assert.ok(parsed.intent);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── afficherListe ────────────────────────────────────────────────────────

test('afficherListe --json → JSON exploitable', () => {
  let captured = '';
  const orig = process.stdout.write;
  process.stdout.write = (chunk) => { captured += chunk; return true; };
  try { afficherListe({ json: true }); }
  finally { process.stdout.write = orig; }
  const parsed = JSON.parse(captured);
  assert.equal(parsed.tutoriels.length, 4);
});

test('afficherListe — sortie humaine smoke', silent(() => {
  const r = afficherListe();
  assert.equal(r.length, 4);
}));

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(TUTORIALS, TUTORIELS);
  assert.equal(listTutorials, listerTutoriels);
  assert.equal(tutorialExists, tutorielExiste);
  assert.equal(runTutorial, executerTutoriel);
  assert.equal(showList, afficherListe);
});
