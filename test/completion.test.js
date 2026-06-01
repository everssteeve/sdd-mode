// Tests `lib/completion.js` — auto-complétion shell (item #107).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  STRUCTURE_CMD, listerIntents, listerSpecs, listerArtefactsArchive,
  completer, genererScriptBash, genererScriptZsh, genererScriptFish,
  scriptPour, emettre, CONSTANTS,
  // alias EN
  listIntents, listSpecs, listArchiveArtifacts,
  complete, generateBashScript, generateZshScript, generateFishScript,
  scriptFor, emit,
} from '../lib/completion.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-comp-')); }

function ecrireIntent(d, id) {
  mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
  writeFileSync(join(d, '.aiad', 'intents', `${id}.md`), '# x');
}
function ecrireSpec(d, id) {
  mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
  writeFileSync(join(d, '.aiad', 'specs', `${id}.md`), '# x');
}

// ─── STRUCTURE_CMD ─────────────────────────────────────────────────────────

test('STRUCTURE_CMD — couvre les commandes principales', () => {
  for (const cmd of ['init', 'trace', 'gitlab', 'azure', 'archive', 'sla', 'sovereignty']) {
    assert.ok(STRUCTURE_CMD[cmd], `${cmd} absent de STRUCTURE_CMD`);
  }
});

test('STRUCTURE_CMD — `gitlab` a des sous-commandes review/issue/wiki', () => {
  const m = STRUCTURE_CMD.gitlab;
  for (const s of ['review', 'issue', 'wiki']) {
    assert.ok(m.subs.includes(s), `sous-commande ${s} absente`);
  }
});

test('STRUCTURE_CMD — `archive` a un completer dynamique', () => {
  assert.equal(STRUCTURE_CMD.archive.dynamic, 'archive-intent-or-spec');
});

// (#329) STRUCTURE_CMD à jour avec brief/standup/badge + flags publication chain
test('#329 STRUCTURE_CMD — brief/standup/badge présents avec leurs flags', () => {
  assert.ok(STRUCTURE_CMD.brief, 'brief absent');
  assert.ok(STRUCTURE_CMD.standup, 'standup absent');
  assert.ok(STRUCTURE_CMD.badge, 'badge absent');
  // Flags publication chain documentés
  assert.ok(STRUCTURE_CMD.brief.flags.includes('--markdown'), 'brief --markdown manquant');
  assert.ok(STRUCTURE_CMD.brief.flags.includes('--quiet'), 'brief --quiet manquant');
  assert.ok(STRUCTURE_CMD.brief.flags.includes('--public-url'), 'brief --public-url manquant');
  assert.ok(STRUCTURE_CMD.standup.flags.includes('--lens'), 'standup --lens manquant');
  assert.ok(STRUCTURE_CMD.badge.flags.includes('--shields-endpoint'), 'badge --shields-endpoint manquant');
});

test('#329 STRUCTURE_CMD — dashboard couvre tous les flags publication', () => {
  const flags = STRUCTURE_CMD.dashboard.flags;
  for (const f of ['--public-url', '--check', '--full', '--source-base', '--quiet', '--serve', '--watch', '--port']) {
    assert.ok(flags.includes(f), `${f} manquant sur dashboard`);
  }
});

test('#329 STRUCTURE_CMD — doctor/workspace ont --markdown + --quiet', () => {
  assert.ok(STRUCTURE_CMD.doctor.flags.includes('--markdown'), 'doctor --markdown manquant');
  assert.ok(STRUCTURE_CMD.doctor.flags.includes('--quiet'), 'doctor --quiet manquant');
  assert.ok(STRUCTURE_CMD.workspace.flags.includes('--markdown'), 'workspace --markdown manquant');
  assert.ok(STRUCTURE_CMD.workspace.flags.includes('--quiet'), 'workspace --quiet manquant');
});

// ─── listerIntents / listerSpecs ───────────────────────────────────────────

test('listerIntents — dossier absent → []', () => {
  const d = tmp();
  try { assert.deepEqual(listerIntents(d), []); }
  finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerIntents — filtre INT-* uniquement', () => {
  const d = tmp();
  try {
    ecrireIntent(d, 'INT-001');
    ecrireIntent(d, 'INT-002');
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', '_index.md'), 'idx');
    writeFileSync(join(d, '.aiad', 'intents', 'README.md'), 'r');
    const r = listerIntents(d);
    assert.deepEqual(r.sort(), ['INT-001', 'INT-002']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerSpecs — filtre SPEC-* uniquement', () => {
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-001-1-x');
    ecrireSpec(d, 'SPEC-002-1-y');
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'spec-ears-template.md'), 't');
    const r = listerSpecs(d);
    assert.deepEqual(r.sort(), ['SPEC-001-1-x', 'SPEC-002-1-y']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerArtefactsArchive — combine ouverts + archivés (déduplication)', () => {
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-001-1-x');
    mkdirSync(join(d, '.aiad', 'specs', 'archive'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'archive', 'SPEC-002-1-y.md'), 'x');
    ecrireIntent(d, 'INT-007');
    const r = listerArtefactsArchive(d);
    assert.deepEqual(r.sort(), ['INT-007', 'SPEC-001-1-x', 'SPEC-002-1-y']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── completer ─────────────────────────────────────────────────────────────

test('completer — ligne vide → toutes les commandes', () => {
  const d = tmp();
  try {
    const r = completer('aiad-sdd ', d);
    assert.ok(r.includes('init'));
    assert.ok(r.includes('trace'));
    assert.ok(r.includes('archive'));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('completer — préfixe partiel filtre les commandes', () => {
  const d = tmp();
  try {
    const r = completer('aiad-sdd dash', d);
    assert.deepEqual(r, ['dashboard']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('completer — sous-commande après une commande connue', () => {
  const d = tmp();
  try {
    const r = completer('aiad-sdd gitlab ', d);
    for (const s of ['review', 'issue', 'wiki']) {
      assert.ok(r.includes(s), `${s} manquant`);
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('completer — flags après --', () => {
  const d = tmp();
  try {
    const r = completer('aiad-sdd archive --', d);
    assert.ok(r.includes('--reason'));
    assert.ok(r.includes('--restore'));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('completer — flag avec préfixe filtré', () => {
  const d = tmp();
  try {
    const r = completer('aiad-sdd trace --fa', d);
    assert.ok(r.includes('--fail-on-gap'));
    assert.ok(!r.includes('--json'));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('completer — IDs Intent/SPEC dynamiques pour `archive`', () => {
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-042-1-auth');
    ecrireIntent(d, 'INT-007');
    const r = completer('aiad-sdd archive ', d);
    assert.ok(r.includes('SPEC-042-1-auth'));
    assert.ok(r.includes('INT-007'));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('completer — préfixe SPEC- filtre les IDs', () => {
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-042-1-auth');
    ecrireIntent(d, 'INT-007');
    const r = completer('aiad-sdd archive SPEC-', d);
    assert.deepEqual(r, ['SPEC-042-1-auth']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('completer — `negotiate` complète Intent IDs', () => {
  const d = tmp();
  try {
    ecrireIntent(d, 'INT-001');
    ecrireIntent(d, 'INT-002');
    const r = completer('aiad-sdd negotiate ', d);
    assert.ok(r.includes('INT-001'));
    assert.ok(r.includes('INT-002'));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('completer — sous-commande spec-version + ID en 3e position', () => {
  const d = tmp();
  try {
    ecrireSpec(d, 'SPEC-001-1-auth');
    const r = completer('aiad-sdd spec-version check ', d);
    assert.ok(r.includes('SPEC-001-1-auth'));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('completer — commande inconnue → []', () => {
  const d = tmp();
  try {
    assert.deepEqual(completer('aiad-sdd whatever ', d), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── Génération scripts ────────────────────────────────────────────────────

test('genererScriptBash — contient complete -F', () => {
  const s = genererScriptBash();
  assert.match(s, /complete -F _aiad_sdd_complete aiad-sdd/);
  assert.match(s, /COMPREPLY/);
  assert.match(s, /aiad-sdd completion --complete/);
});

test('genererScriptZsh — utilise compdef', () => {
  const s = genererScriptZsh();
  assert.match(s, /compdef _aiad_sdd_complete aiad-sdd/);
  assert.match(s, /compadd/);
});

test('genererScriptFish — utilise complete -c', () => {
  const s = genererScriptFish();
  assert.match(s, /complete -c aiad-sdd/);
  assert.match(s, /__aiad_sdd_complete/);
});

test('scriptPour — shell inconnu → throw', () => {
  assert.throws(() => scriptPour('powershell'), /Shell inconnu/);
});

test('scriptPour — bash/zsh/fish OK', () => {
  for (const sh of ['bash', 'zsh', 'fish']) {
    const s = scriptPour(sh);
    assert.ok(s.length > 50);
  }
});

// ─── emettre (CLI) ─────────────────────────────────────────────────────────

test('emettre — sans shell affiche aide', () => {
  const d = tmp();
  try {
    const ol = console.log;
    let out = '';
    console.log = (msg) => { out += msg + '\n'; };
    try {
      const r = emettre(d, {});
      assert.equal(r, null);
    } finally { console.log = ol; }
    assert.match(out, /Shell completion/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('emettre --complete → écrit les candidats sur stdout', () => {
  const d = tmp();
  try {
    ecrireIntent(d, 'INT-001');
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { emettre(d, { complete: 'aiad-sdd negotiate ' }); }
    finally { process.stdout.write = orig; }
    assert.match(captured, /INT-001/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('emettre shell=bash → écrit le script bash', () => {
  const d = tmp();
  try {
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { emettre(d, { shell: 'bash' }); }
    finally { process.stdout.write = orig; }
    assert.match(captured, /complete -F _aiad_sdd_complete/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(listIntents, listerIntents);
  assert.equal(listSpecs, listerSpecs);
  assert.equal(listArchiveArtifacts, listerArtefactsArchive);
  assert.equal(complete, completer);
  assert.equal(generateBashScript, genererScriptBash);
  assert.equal(generateZshScript, genererScriptZsh);
  assert.equal(generateFishScript, genererScriptFish);
  assert.equal(scriptFor, scriptPour);
  assert.equal(emit, emettre);
});

test('CONSTANTS — exposées', () => {
  assert.deepEqual(CONSTANTS.SHELLS_VALIDES, ['bash', 'zsh', 'fish']);
});
