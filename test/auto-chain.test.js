// Tests lib/auto-chain.js — CA-1 à CA-7 (SPEC-031-2).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  evaluerChainage, evaluateChain,
  TRANSITIONS, CHAIN_TRANSITIONS,
} from '../lib/auto-chain.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-ac-')); }

function ecrireConfig(racine, autoChain) {
  const dir = join(racine, '.aiad');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.yml'), [
    'auto_chain:',
    `  enabled: ${autoChain.enabled}`,
    `  max_context_pct: ${autoChain.max_context_pct}`,
  ].join('\n') + '\n');
}

function mockStream() {
  const messages = [];
  return { write: (m) => { messages.push(m); return true; }, messages };
}

// ─── Registre TRANSITIONS ─────────────────────────────────────────────────

test('TRANSITIONS — immuable et contient les 5 transitions du cycle SDD', () => {
  assert.equal(Object.isFrozen(TRANSITIONS), true);
  const keys = ['spec', 'gate', 'exec', 'validate', 'drift-check'];
  for (const k of keys) assert.ok(k in TRANSITIONS, `${k} manquant`);
  assert.equal(TRANSITIONS.gate.confirmationRequise, true,  'gate requiert confirmation');
  assert.equal(TRANSITIONS.spec.confirmationRequise, false, 'spec ne requiert pas confirmation');
  assert.equal(TRANSITIONS.spec.next,         'gate');
  assert.equal(TRANSITIONS.gate.next,         'exec');
  assert.equal(TRANSITIONS.exec.next,         'validate');
  assert.equal(TRANSITIONS.validate.next,     'drift-check');
  assert.equal(TRANSITIONS['drift-check'].next, 'trace');
});

test('alias EN CHAIN_TRANSITIONS === TRANSITIONS', () => {
  assert.equal(CHAIN_TRANSITIONS, TRANSITIONS);
});

test('alias EN evaluateChain === evaluerChainage', () => {
  assert.equal(evaluateChain, evaluerChainage);
});

// ─── CA-1 : gate → exec avec confirmation requise ─────────────────────────

test('CA-1a — gate exit 0 + enabled + user "o" → exec déclenché', async () => {
  const d = tmp();
  const dispatched = [];
  const stream = mockStream();
  try {
    ecrireConfig(d, { enabled: true, max_context_pct: 40 });
    await evaluerChainage(d, { command: 'gate', exitCode: 0 }, {
      dispatcher: (cmd, args) => { dispatched.push({ cmd, args }); },
      confirmer: async () => 'o',
      stream,
    });
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].cmd, 'exec');
    assert.ok(stream.messages.some((m) => m.includes('confirmation requise')));
    assert.ok(stream.messages.some((m) => m.includes('Démarrage de exec')));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('CA-1b — gate exit 0 + user "N" → dispatcher non appelé', async () => {
  const d = tmp();
  const dispatched = [];
  try {
    ecrireConfig(d, { enabled: true, max_context_pct: 40 });
    await evaluerChainage(d, { command: 'gate', exitCode: 0 }, {
      dispatcher: (cmd) => { dispatched.push(cmd); },
      confirmer: async () => 'N',
      stream: mockStream(),
    });
    assert.equal(dispatched.length, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('CA-1c — gate exit 0 + user "" (vide) → dispatcher non appelé', async () => {
  const d = tmp();
  const dispatched = [];
  try {
    ecrireConfig(d, { enabled: true, max_context_pct: 40 });
    await evaluerChainage(d, { command: 'gate', exitCode: 0 }, {
      dispatcher: (cmd) => { dispatched.push(cmd); },
      confirmer: async () => '',
      stream: mockStream(),
    });
    assert.equal(dispatched.length, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── CA-2 : spec → gate sans prompt ──────────────────────────────────────

test('CA-2 — spec exit 0 + enabled → gate déclenché sans confirmation', async () => {
  const d = tmp();
  const dispatched = [];
  const stream = mockStream();
  try {
    ecrireConfig(d, { enabled: true, max_context_pct: 40 });
    await evaluerChainage(d, { command: 'spec', exitCode: 0 }, {
      dispatcher: (cmd) => { dispatched.push(cmd); },
      stream,
    });
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0], 'gate');
    assert.ok(!stream.messages.some((m) => m.includes('confirmation requise')));
    assert.ok(stream.messages.some((m) => m.includes('Démarrage de gate')));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── CA-3 : enabled: false → aucune transition ────────────────────────────

test('CA-3 — auto_chain.enabled: false → aucune transition pour toutes les commandes du cycle', async () => {
  const d = tmp();
  try {
    ecrireConfig(d, { enabled: false, max_context_pct: 40 });
    const cmds = ['spec', 'gate', 'exec', 'validate', 'drift-check'];
    for (const cmd of cmds) {
      const dispatched = [];
      await evaluerChainage(d, { command: cmd, exitCode: 0 }, {
        dispatcher: (c) => { dispatched.push(c); },
        confirmer: async () => 'o',
        stream: mockStream(),
      });
      assert.equal(dispatched.length, 0, `${cmd} ne doit pas déclencher de transition quand disabled`);
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── CA-4 : budget dépasse max_context_pct ───────────────────────────────

test('CA-4 — budget dépasse max_context_pct → warning stdout + dispatcher non appelé', async () => {
  const d = tmp();
  const dispatched = [];
  const stream = mockStream();
  try {
    ecrireConfig(d, { enabled: true, max_context_pct: 40 });
    await evaluerChainage(d, { command: 'spec', exitCode: 0 }, {
      dispatcher: (cmd) => { dispatched.push(cmd); },
      getBudget: () => 43,
      stream,
    });
    assert.equal(dispatched.length, 0);
    assert.ok(stream.messages.some((m) => m.includes('Chaînage suspendu')));
    assert.ok(stream.messages.some((m) => m.includes('43%')));
    assert.ok(stream.messages.some((m) => m.includes('Relancez manuellement')));
    assert.ok(stream.messages.some((m) => m.includes('npx aiad-sdd gate')));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('CA-4b — budget exactement égal à max_context_pct → bloqué (seuil strict)', async () => {
  const d = tmp();
  const dispatched = [];
  try {
    ecrireConfig(d, { enabled: true, max_context_pct: 40 });
    await evaluerChainage(d, { command: 'spec', exitCode: 0 }, {
      dispatcher: (cmd) => { dispatched.push(cmd); },
      getBudget: () => 40,
      stream: mockStream(),
    });
    assert.equal(dispatched.length, 0, 'seuil exact = bloqué');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── CA-5 : AIAD_COMMAND_HOOKS_DISABLED=1 ─────────────────────────────────

test('CA-5 — AIAD_COMMAND_HOOKS_DISABLED=1 → aucune transition déclenchée', async () => {
  const d = tmp();
  const dispatched = [];
  process.env.AIAD_COMMAND_HOOKS_DISABLED = '1';
  try {
    ecrireConfig(d, { enabled: true, max_context_pct: 40 });
    await evaluerChainage(d, { command: 'spec', exitCode: 0 }, {
      dispatcher: (cmd) => { dispatched.push(cmd); },
      confirmer: async () => 'o',
      stream: mockStream(),
    });
    assert.equal(dispatched.length, 0);
  } finally {
    delete process.env.AIAD_COMMAND_HOOKS_DISABLED;
    rmSync(d, { recursive: true, force: true });
  }
});

// ─── CA-6 : commandes hors registre ──────────────────────────────────────

test('CA-6 — fact/security/audit/context → aucune transition (commandes hors registre)', async () => {
  const d = tmp();
  try {
    ecrireConfig(d, { enabled: true, max_context_pct: 40 });
    const cmdsHorsRegistre = ['fact', 'security', 'audit', 'context', 'research', 'intent'];
    for (const cmd of cmdsHorsRegistre) {
      const dispatched = [];
      await evaluerChainage(d, { command: cmd, exitCode: 0 }, {
        dispatcher: (c) => { dispatched.push(c); },
        stream: mockStream(),
      });
      assert.equal(dispatched.length, 0, `${cmd} est hors registre et ne doit pas déclencher de transition`);
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── Cas limites supplémentaires ──────────────────────────────────────────

test('exitCode non 0 → aucune transition', async () => {
  const d = tmp();
  const dispatched = [];
  try {
    ecrireConfig(d, { enabled: true, max_context_pct: 40 });
    await evaluerChainage(d, { command: 'spec', exitCode: 1 }, {
      dispatcher: (cmd) => { dispatched.push(cmd); },
      stream: mockStream(),
    });
    assert.equal(dispatched.length, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('exitCode absent (défaut 0) — transition déclenchée si commande dans registre', async () => {
  const d = tmp();
  const dispatched = [];
  try {
    ecrireConfig(d, { enabled: true, max_context_pct: 40 });
    await evaluerChainage(d, { command: 'exec' }, {
      dispatcher: (cmd) => { dispatched.push(cmd); },
      stream: mockStream(),
    });
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0], 'validate');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('config absente → defaults (enabled: true) → transition déclenchée', async () => {
  const d = tmp(); // pas de config.yml
  const dispatched = [];
  try {
    await evaluerChainage(d, { command: 'exec', exitCode: 0 }, {
      dispatcher: (cmd) => { dispatched.push(cmd); },
      stream: mockStream(),
    });
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0], 'validate');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('toutes les transitions du cycle sont couvertes (exec→validate, validate→drift-check, drift-check→trace)', async () => {
  const d = tmp();
  const cases = [
    { command: 'exec',         expected: 'validate'    },
    { command: 'validate',     expected: 'drift-check' },
    { command: 'drift-check',  expected: 'trace'       },
  ];
  try {
    ecrireConfig(d, { enabled: true, max_context_pct: 40 });
    for (const { command, expected } of cases) {
      const dispatched = [];
      await evaluerChainage(d, { command, exitCode: 0 }, {
        dispatcher: (cmd) => { dispatched.push(cmd); },
        stream: mockStream(),
      });
      assert.equal(dispatched.length, 1);
      assert.equal(dispatched[0], expected, `${command} → ${expected}`);
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
});
