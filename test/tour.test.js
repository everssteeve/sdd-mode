// Tests `lib/tour.js` — guided tour interactif (item #108).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ETAPES, tour, CONSTANTS,
  // alias EN
  STEPS, guidedTour,
} from '../lib/tour.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-tour-')); }
function silent(fn) {
  return async (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return await fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

// ─── ETAPES ────────────────────────────────────────────────────────────────

test('ETAPES — 6 étapes définies (welcome → done)', () => {
  assert.equal(ETAPES.length, 6);
  const ids = ETAPES.map((e) => e.id);
  for (const expected of ['welcome', 'intent', 'spec', 'gate', 'trace', 'done']) {
    assert.ok(ids.includes(expected), `étape ${expected} manquante`);
  }
});

test('ETAPES — chaque étape a un intro non vide', () => {
  for (const e of ETAPES) {
    assert.ok(Array.isArray(e.intro) && e.intro.length > 0,
      `${e.id} : intro manquant`);
  }
});

test('ETAPES — étapes interactives ont un prompt + défaut', () => {
  for (const e of ETAPES) {
    if (e.prompt) {
      assert.ok(typeof e.defaut === 'string' && e.defaut.length > 0,
        `${e.id} : prompt sans défaut`);
    }
  }
});

// ─── tour (mode non-interactif) ────────────────────────────────────────────

test('tour --non-interactive → exécute toutes les étapes avec les défauts', silent(async () => {
  const d = tmp();
  try {
    const r = await tour(d, { nonInteractive: true });
    assert.equal(r.intent, 'INT-001');
    assert.equal(r.spec, 'SPEC-001-1-export-donnees');
    assert.equal(r.gateScore, 4);
    assert.equal(r.gateValid, true);
    assert.ok(r.fichiers.length >= 3);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('tour — Intent file écrit avec frontmatter + body', silent(async () => {
  const d = tmp();
  try {
    await tour(d, { nonInteractive: true });
    const path = join(d, '.aiad-tour', 'intents', 'INT-001.md');
    assert.ok(existsSync(path));
    const c = readFileSync(path, 'utf-8');
    assert.match(c, /---/);
    assert.match(c, /title:/);
    assert.match(c, /author: tour-aiad-sdd/);
    assert.match(c, /^# /m);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('tour — SPEC file écrit avec critères EARS', silent(async () => {
  const d = tmp();
  try {
    await tour(d, { nonInteractive: true });
    const path = join(d, '.aiad-tour', 'specs', 'SPEC-001-1-export-donnees.md');
    assert.ok(existsSync(path));
    const c = readFileSync(path, 'utf-8');
    assert.match(c, /intent: INT-001/);
    assert.match(c, /governance: AIAD-RGPD/);
    assert.match(c, /WHEN.*THE SYSTEM SHALL/);
    assert.match(c, /AC-1/);
    assert.match(c, /AC-2/);
    assert.match(c, /AC-3/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('tour — matrice traçabilité écrite avec 1 gap démo', silent(async () => {
  const d = tmp();
  try {
    await tour(d, { nonInteractive: true });
    const path = join(d, '.aiad-tour', 'metrics', 'traceability', 'matrix.json');
    assert.ok(existsSync(path));
    const m = JSON.parse(readFileSync(path, 'utf-8'));
    assert.equal(m.intents[0].id, 'INT-001');
    assert.equal(m.specs[0].id, 'SPEC-001-1-export-donnees');
    assert.equal(m.gaps.length, 1);
    assert.equal(m.gaps[0].kind, 'spec-without-code');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('tour --out custom → sortie dans le dossier choisi', silent(async () => {
  const d = tmp();
  try {
    const r = await tour(d, { nonInteractive: true, out: 'demo-aiad' });
    assert.equal(r.dir, 'demo-aiad');
    assert.ok(existsSync(join(d, 'demo-aiad', 'intents', 'INT-001.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('tour --json → sortie JSON parsable', async () => {
  const d = tmp();
  try {
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { await tour(d, { nonInteractive: true, json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.intent, 'INT-001');
    assert.equal(parsed.spec, 'SPEC-001-1-export-donnees');
    assert.ok(Array.isArray(parsed.fichiers));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── Tests avec readline injecté ───────────────────────────────────────────

function fakeReadline(reponses) {
  let i = 0;
  const closes = [];
  return {
    question: (_q, cb) => {
      const r = reponses[i] !== undefined ? reponses[i] : '';
      i++;
      process.nextTick(() => cb(r));
    },
    close: () => { closes.push(true); },
    closes,
  };
}

test('tour — readline injecté, réponses custom prises en compte', silent(async () => {
  const d = tmp();
  try {
    const rl = fakeReadline([
      'Ma valeur Intent custom',
      'Ma valeur SPEC custom',
      '5',
    ]);
    const r = await tour(d, { rl });
    assert.equal(r.gateScore, 5);
    // L'intent doit contenir la réponse custom
    const intent = readFileSync(
      join(d, '.aiad-tour', 'intents', 'INT-001.md'), 'utf-8',
    );
    assert.match(intent, /Ma valeur Intent custom/);
    // La SPEC doit contenir la réponse custom
    const spec = readFileSync(
      join(d, '.aiad-tour', 'specs', 'SPEC-001-1-export-donnees.md'), 'utf-8',
    );
    assert.match(spec, /Ma valeur SPEC custom/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('tour — réponse vide → utilise le défaut', silent(async () => {
  const d = tmp();
  try {
    const rl = fakeReadline(['', '', '']);
    const r = await tour(d, { rl });
    assert.equal(r.gateScore, 4); // défaut
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('tour — score < 4 → Gate fermée (gateValid false)', silent(async () => {
  const d = tmp();
  try {
    const rl = fakeReadline(['Intent', 'SPEC', '2']);
    const r = await tour(d, { rl });
    assert.equal(r.gateScore, 2);
    assert.equal(r.gateValid, false);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(STEPS, ETAPES);
  assert.equal(guidedTour, tour);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.SORTIE_DEFAUT, '.aiad-tour');
});
