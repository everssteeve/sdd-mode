// Tests REPL — fonctions pures (parsing + commandes), sans la boucle
// interactive (qui dépend de readline et bloquerait les tests).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { COMMANDES, parserLigne } from '../lib/repl.js';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-repl-'));
  mkdirSync(join(dir, '.aiad', 'intents'), { recursive: true });
  mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
  return dir;
}

test('parserLigne — commande seule', () => {
  assert.deepEqual(parserLigne('help'), { nom: 'help', args: {} });
  assert.deepEqual(parserLigne('  status  '), { nom: 'status', args: {} });
  assert.deepEqual(parserLigne(''), { nom: '', args: {} });
});

test('parserLigne — args key=value', () => {
  const r = parserLigne('intent id=INTENT-001 author=Alice');
  assert.equal(r.nom, 'intent');
  assert.equal(r.args.id, 'INTENT-001');
  assert.equal(r.args.author, 'Alice');
});

test('parserLigne — args avec quotes (espaces préservés)', () => {
  const r = parserLigne('spec parent=INTENT-007 titre="Mon flow auth complet"');
  assert.equal(r.nom, 'spec');
  assert.equal(r.args.parent, 'INTENT-007');
  assert.equal(r.args.titre, 'Mon flow auth complet');
});

test('COMMANDES.help — liste toutes les commandes', () => {
  const out = COMMANDES.help.exec();
  for (const nom of ['status', 'trace', 'doctor', 'intent', 'spec', 'help']) {
    assert.ok(out.includes(nom), `commande ${nom} absente de help`);
  }
});

test('COMMANDES.status — projet vierge → message clair', () => {
  const d = mkdtempSync(join(tmpdir(), 'aiad-repl-virgin-'));
  try {
    const out = COMMANDES.status.exec({ racine: d });
    assert.match(out, /non initialisé/i);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('COMMANDES.intent — crée INTENT-001 incrémental', async () => {
  const d = fixture();
  try {
    const out1 = await COMMANDES.intent.exec({ racine: d }, { titre: 'Premier' });
    assert.match(out1, /INTENT-001 créé/);
    assert.ok(existsSync(join(d, '.aiad', 'intents', 'INTENT-001.md')));

    // Second appel → INTENT-002
    const out2 = await COMMANDES.intent.exec({ racine: d }, { titre: 'Deuxième' });
    assert.match(out2, /INTENT-002 créé/);
    assert.ok(existsSync(join(d, '.aiad', 'intents', 'INTENT-002.md')));

    // Vérifie le contenu : frontmatter + corps
    const c = readFileSync(join(d, '.aiad', 'intents', 'INTENT-001.md'), 'utf-8');
    assert.match(c, /^---$/m);
    assert.match(c, /title:/);
    assert.match(c, /status: active/);
    assert.match(c, /^# Premier/m);
    assert.match(c, /## Problème/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('COMMANDES.intent — refuse de réécrire un Intent existant', async () => {
  const d = fixture();
  try {
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-042.md'), '# Existant\n', 'utf-8');
    const out = await COMMANDES.intent.exec({ racine: d }, { id: 'INTENT-042' });
    assert.match(out, /existe déjà/);
    assert.equal(readFileSync(join(d, '.aiad', 'intents', 'INTENT-042.md'), 'utf-8'), '# Existant\n');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('COMMANDES.spec — exige `parent=INTENT-NNN`', async () => {
  const d = fixture();
  try {
    const out = await COMMANDES.spec.exec({ racine: d }, {});
    assert.match(out, /Usage/);
    assert.match(out, /parent=INTENT/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('COMMANDES.spec — crée SPEC-NNN-1-slug avec parent_intent', async () => {
  const d = fixture();
  try {
    const out = await COMMANDES.spec.exec({ racine: d }, {
      parent: 'INTENT-007',
      slug: 'login-flow',
      titre: 'Flow login OIDC',
    });
    assert.match(out, /SPEC-007-1-login-flow/);
    const fichier = join(d, '.aiad', 'specs', 'SPEC-007-1-login-flow.md');
    assert.ok(existsSync(fichier));
    const c = readFileSync(fichier, 'utf-8');
    assert.match(c, /parent_intent: INTENT-007/);
    assert.match(c, /status: draft/);
    assert.match(c, /^# Flow login OIDC/m);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('COMMANDES.spec — incrément du numéro pour le même parent', async () => {
  const d = fixture();
  try {
    await COMMANDES.spec.exec({ racine: d }, { parent: 'INTENT-007', slug: 'a' });
    const out = await COMMANDES.spec.exec({ racine: d }, { parent: 'INTENT-007', slug: 'b' });
    assert.match(out, /SPEC-007-2-b/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('COMMANDES.trace — synthèse rapide sans écriture sur disque', () => {
  const d = fixture();
  try {
    const out = COMMANDES.trace.exec({ racine: d });
    assert.match(out, /Intents:/);
    assert.match(out, /SPECs:/);
    assert.match(out, /Gaps:/);
    // Pas de fichier généré
    assert.ok(!existsSync(join(d, '.aiad', 'metrics', 'traceability', 'trace.md')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
