// Tests `aiad-sdd init --interactive` — TUI guidée zero-dep (readline).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { EventEmitter } from 'node:events';
import {
  PROFILS,
  RUNTIMES,
  PACKS_GOUVERNANCE,
  parseChoixIndex,
  parseOuiNon,
  construireOptionsInit,
  lancerTui,
  // Aliases EN
  PROFILES,
  RUNTIME_TARGETS,
  GOVERNANCE_PACKS,
  parseChoiceIndex,
  parseYesNo,
  buildInitOptions,
  runTui,
} from '../lib/init-tui.js';

// ─── Catalogue de choix ─────────────────────────────────────────────────────

test('PROFILS — 2 profils (complet par défaut, minimal en option)', () => {
  assert.equal(PROFILS.length, 2);
  assert.equal(PROFILS[0].id, 'complet');
  assert.equal(PROFILS[1].id, 'minimal');
  for (const p of PROFILS) {
    assert.equal(typeof p.label, 'string');
    assert.ok(p.description.length > 20);
  }
});

test('RUNTIMES — couvre les 5 runtimes officiels + option "tous"', () => {
  const ids = RUNTIMES.map((r) => r.id);
  for (const r of ['claude-code', 'cursor', 'codex', 'copilot', 'gemini', 'tous']) {
    assert.ok(ids.includes(r), `runtime ${r} manquant`);
  }
});

test('PACKS_GOUVERNANCE — couvre les 4 packs disponibles + option "aucun"', () => {
  const ids = PACKS_GOUVERNANCE.map((p) => p.id);
  for (const p of ['eu-baseline', 'eu-financial', 'us-baseline', 'uk-baseline', 'aucun']) {
    assert.ok(ids.includes(p), `pack ${p} manquant`);
  }
});

// ─── Fonctions pures ────────────────────────────────────────────────────────

test('parseChoixIndex — Entrée vide → défaut', () => {
  assert.equal(parseChoixIndex('', PROFILS, 0), 0);
  assert.equal(parseChoixIndex('  ', PROFILS, 1), 1);
});

test('parseChoixIndex — index 1-based valide → retourne index 0-based', () => {
  assert.equal(parseChoixIndex('1', PROFILS, 0), 0);
  assert.equal(parseChoixIndex('2', PROFILS, 0), 1);
});

test('parseChoixIndex — saisie invalide → null', () => {
  assert.equal(parseChoixIndex('0', PROFILS, 0), null);
  assert.equal(parseChoixIndex('99', PROFILS, 0), null);
  assert.equal(parseChoixIndex('abc', PROFILS, 0), null);
  assert.equal(parseChoixIndex('-1', PROFILS, 0), null);
});

test('parseOuiNon — divers oui/non/défaut', () => {
  assert.equal(parseOuiNon('o', false), true);
  assert.equal(parseOuiNon('OUI', false), true);
  assert.equal(parseOuiNon('y', false), true);
  assert.equal(parseOuiNon('1', false), true);
  assert.equal(parseOuiNon('n', true), false);
  assert.equal(parseOuiNon('NON', true), false);
  assert.equal(parseOuiNon('no', true), false);
  assert.equal(parseOuiNon('0', true), false);
  assert.equal(parseOuiNon('', true), true);
  assert.equal(parseOuiNon('', false), false);
  assert.equal(parseOuiNon('peut-être', true), true); // garde le défaut
});

test('construireOptionsInit — minimal + claude-code + eu-baseline + hooks', () => {
  const r = construireOptionsInit({
    profilId: 'minimal',
    runtimeId: 'claude-code',
    packId: 'eu-baseline',
    hooks: true,
  });
  assert.equal(r.minimal, true);
  assert.deepEqual(r.runtimes, ['claude-code']);
  assert.equal(r.pack, 'eu-baseline');
  assert.equal(r.sansGouvernance, false);
  assert.equal(r.withGitHooks, true);
  assert.equal(r.force, false);
});

test('construireOptionsInit — complet + tous + aucun pack + sans hook', () => {
  const r = construireOptionsInit({
    profilId: 'complet',
    runtimeId: 'tous',
    packId: 'aucun',
    hooks: false,
  });
  assert.equal(r.minimal, false);
  assert.deepEqual(r.runtimes, ['claude-code', 'cursor', 'codex', 'copilot', 'gemini']);
  assert.equal(r.pack, null);
  assert.equal(r.sansGouvernance, true);
  assert.equal(r.withGitHooks, false);
});

test('construireOptionsInit — eu-financial conservé tel quel', () => {
  const r = construireOptionsInit({
    profilId: 'complet',
    runtimeId: 'cursor',
    packId: 'eu-financial',
    hooks: true,
  });
  assert.equal(r.pack, 'eu-financial');
  assert.deepEqual(r.runtimes, ['cursor']);
});

test('alias EN canoniques exportés', () => {
  assert.equal(PROFILES, PROFILS);
  assert.equal(RUNTIME_TARGETS, RUNTIMES);
  assert.equal(GOVERNANCE_PACKS, PACKS_GOUVERNANCE);
  assert.equal(parseChoiceIndex, parseChoixIndex);
  assert.equal(parseYesNo, parseOuiNon);
  assert.equal(buildInitOptions, construireOptionsInit);
  assert.equal(runTui, lancerTui);
});

// ─── lancerTui via Fake readline ────────────────────────────────────────────

/**
 * Fake readline.Interface qui répond séquentiellement à chaque `question()`.
 * Les promesses `question` sont résolues dans l'ordre des réponses fournies.
 */
function fakeReadline(reponses) {
  const queue = [...reponses];
  const rl = new EventEmitter();
  rl.question = (_q, cb) => {
    const r = queue.shift();
    setImmediate(() => cb(r ?? ''));
  };
  rl.close = () => {};
  return rl;
}

function silencieuxConsole(fn) {
  return async (...args) => {
    const orig = console.log;
    console.log = () => {};
    try { return await fn(...args); }
    finally { console.log = orig; }
  };
}

test('lancerTui — parcours par défaut (toutes Entrée) → minimal=false, claude-code, eu-baseline, hooks=true', silencieuxConsole(async () => {
  const rl = fakeReadline(['', '', '', '', '']); // 4 questions + confirmation
  const r = await lancerTui({ rl });
  assert.equal(r.minimal, false); // profil[0] = complet
  assert.deepEqual(r.runtimes, ['claude-code']);
  assert.equal(r.pack, 'eu-baseline');
  assert.equal(r.sansGouvernance, false);
  assert.equal(r.withGitHooks, true);
}));

test('lancerTui — parcours minimal+cursor+aucun+hooks=non', silencieuxConsole(async () => {
  const rl = fakeReadline(['2', '2', '5', 'n', 'o']); // minimal, cursor, aucun, pas hooks, confirme
  const r = await lancerTui({ rl });
  assert.equal(r.minimal, true);
  assert.deepEqual(r.runtimes, ['cursor']);
  assert.equal(r.pack, null);
  assert.equal(r.sansGouvernance, true);
  assert.equal(r.withGitHooks, false);
}));

test('lancerTui — choix invalide puis valide → boucle jusqu\'à validation', silencieuxConsole(async () => {
  const rl = fakeReadline(['99', 'abc', '1', '', '', '', '']); // 2 invalides puis 1, puis défauts, puis confirme
  const r = await lancerTui({ rl });
  assert.equal(r.minimal, false);
}));

test('lancerTui — confirmation finale "non" → retourne { annule: true }', silencieuxConsole(async () => {
  const rl = fakeReadline(['', '', '', '', 'n']);
  const r = await lancerTui({ rl });
  assert.equal(r.annule, true);
}));

test('lancerTui — eu-financial + tous + minimal', silencieuxConsole(async () => {
  // PACKS_GOUVERNANCE[1] = eu-financial → choix "2" sur question 3
  // RUNTIMES[5] = tous → choix "6" sur question 2
  // PROFILS[1] = minimal → choix "2" sur question 1
  const rl = fakeReadline(['2', '6', '2', '', '']);
  const r = await lancerTui({ rl });
  assert.equal(r.minimal, true);
  assert.equal(r.pack, 'eu-financial');
  assert.deepEqual(r.runtimes, ['claude-code', 'cursor', 'codex', 'copilot', 'gemini']);
}));
