// Tests `lib/negotiate.js` — médiation entre 2 Intents (item #102).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  chargerIntent, construirePromptNegotiate, parserNegotiation,
  rendreMediationMarkdown, negotiate, CONSTANTS,
  // alias EN
  loadIntent, buildNegotiatePrompt, parseNegotiation,
  renderMediationMarkdown, negotiateIntents,
} from '../lib/negotiate.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-neg-')); }

function setupIntents(d, intents) {
  mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
  for (const it of intents) {
    writeFileSync(
      join(d, '.aiad', 'intents', `${it.id}.md`),
      `---\ntitle: ${it.title}\n---\n${it.body || ''}`,
    );
  }
}

function silent(fn) {
  return async (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return await fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

function fakeOllamaFetch(reponse) {
  return async () => ({
    ok: true, status: 200,
    text: async () => JSON.stringify({ response: reponse }),
    json: async () => ({ response: reponse }),
  });
}

const REPONSE_FAKE = JSON.stringify({
  compatibilite: 0.6,
  conflits: [
    { axe: 'Vélocité vs accessibilité', intentA: 'Livrer vite', intentB: 'WCAG AAA', severite: 'haute' },
  ],
  intentCommun: {
    titre: 'Livrer rapidement avec accessibilité progressive',
    body: 'En tant qu\'équipe produit, livrer une expérience accessible incrementalement, respectant WCAG AA dès la v1 et progressant vers AAA.',
  },
  arbitrages: [
    { point: 'Niveau WCAG cible v1', decision: 'AA non négociable, AAA au sprint suivant', rationale: 'Compromis viable sans bloquer la livraison.' },
  ],
});

// ─── chargerIntent ─────────────────────────────────────────────────────────

test('chargerIntent — format invalide → throw', () => {
  const d = tmp();
  try {
    assert.throws(() => chargerIntent(d, 'wrong'), /Format Intent invalide/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerIntent — dossier absent → throw', () => {
  const d = tmp();
  try {
    assert.throws(() => chargerIntent(d, 'INT-001'), /\.aiad\/intents\/ introuvable/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerIntent — Intent absent → throw', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    assert.throws(() => chargerIntent(d, 'INT-999'), /Intent INT-999 introuvable/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerIntent — extrait id, title, body, frontmatter', () => {
  const d = tmp();
  try {
    setupIntents(d, [{ id: 'INT-001', title: 'Mon Intent', body: 'Le corps.' }]);
    const it = chargerIntent(d, 'INT-001');
    assert.equal(it.id, 'INT-001');
    assert.equal(it.title, 'Mon Intent');
    assert.equal(it.body, 'Le corps.');
    assert.match(it.path, /INT-001\.md$/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerIntent — ID en minuscules accepté', () => {
  const d = tmp();
  try {
    setupIntents(d, [{ id: 'INT-001', title: 'T' }]);
    const it = chargerIntent(d, 'int-001');
    assert.equal(it.id, 'INT-001');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── construirePromptNegotiate ─────────────────────────────────────────────

test('construirePromptNegotiate — inclut les 2 Intents et instruction JSON', () => {
  const a = { id: 'INT-001', title: 'A', body: 'Body A' };
  const b = { id: 'INT-002', title: 'B', body: 'Body B' };
  const p = construirePromptNegotiate(a, b);
  assert.match(p, /Intent A.*INT-001/s);
  assert.match(p, /Intent B.*INT-002/s);
  assert.match(p, /Body A/);
  assert.match(p, /Body B/);
  assert.match(p, /STRICTEMENT au format JSON/);
  assert.match(p, /"intentCommun"/);
  assert.match(p, /"compatibilite"/);
  assert.match(p, /"arbitrages"/);
});

test('construirePromptNegotiate — bodies vides gérés', () => {
  const a = { id: 'INT-001', title: 'A', body: '' };
  const b = { id: 'INT-002', title: 'B', body: '' };
  const p = construirePromptNegotiate(a, b);
  assert.match(p, /\(corps vide\)/);
});

// ─── parserNegotiation ────────────────────────────────────────────────────

test('parserNegotiation — JSON valide complet', () => {
  const r = parserNegotiation(REPONSE_FAKE);
  assert.equal(r.compatibilite, 0.6);
  assert.equal(r.conflits.length, 1);
  assert.equal(r.conflits[0].severite, 'haute');
  assert.match(r.intentCommun.titre, /accessibilité/);
  assert.equal(r.arbitrages.length, 1);
});

test('parserNegotiation — préambule avant JSON ignoré', () => {
  const brut = 'Voici la médiation :\n\n' + REPONSE_FAKE;
  const r = parserNegotiation(brut);
  assert.equal(r.compatibilite, 0.6);
});

test('parserNegotiation — compatibilite hors [0,1] → clampée', () => {
  const r = parserNegotiation(JSON.stringify({
    compatibilite: 1.5,
    conflits: [], arbitrages: [],
    intentCommun: { titre: 'T', body: 'B' },
  }));
  assert.equal(r.compatibilite, 1);

  const r2 = parserNegotiation(JSON.stringify({
    compatibilite: -0.3,
    conflits: [], arbitrages: [],
    intentCommun: { titre: 'T', body: 'B' },
  }));
  assert.equal(r2.compatibilite, 0);
});

test('parserNegotiation — sévérité invalide → moyenne par défaut', () => {
  const r = parserNegotiation(JSON.stringify({
    compatibilite: 0.5,
    conflits: [{ axe: 'x', intentA: 'a', intentB: 'b', severite: 'invalide' }],
    intentCommun: { titre: 'T', body: 'B' },
  }));
  assert.equal(r.conflits[0].severite, 'moyenne');
});

test('parserNegotiation — alias EN (title, axis, intent_a) acceptés', () => {
  const r = parserNegotiation(JSON.stringify({
    compatibilite: 0.5,
    conflits: [{ axis: 'a', intent_a: 'X', intent_b: 'Y' }],
    intentCommun: { title: 'T-en', body: 'B' },
  }));
  assert.equal(r.intentCommun.titre, 'T-en');
  assert.equal(r.conflits[0].axe, 'a');
  assert.equal(r.conflits[0].intentA, 'X');
});

test('parserNegotiation — plafond 5 conflits + 5 arbitrages', () => {
  const make = (k) => Array.from({ length: 10 }, (_, i) => ({ axe: 'a' + i, point: 'p' + i }));
  const r = parserNegotiation(JSON.stringify({
    compatibilite: 0.5,
    conflits: make(),
    arbitrages: make(),
    intentCommun: { titre: 'T', body: 'B' },
  }));
  assert.equal(r.conflits.length, 5);
  assert.equal(r.arbitrages.length, 5);
});

test('parserNegotiation — vide → throw', () => {
  assert.throws(() => parserNegotiation(''), /vide/);
});

test('parserNegotiation — sans intentCommun → throw', () => {
  assert.throws(
    () => parserNegotiation(JSON.stringify({ compatibilite: 0.5 })),
    /intentCommun.*manquant/,
  );
});

test('parserNegotiation — JSON invalide → throw', () => {
  assert.throws(() => parserNegotiation('pas de JSON'), /sans JSON détectable/);
});

// ─── rendreMediationMarkdown ───────────────────────────────────────────────

test('rendreMediationMarkdown — produit un Markdown structuré', () => {
  const a = { id: 'INT-001', title: 'A' };
  const b = { id: 'INT-002', title: 'B' };
  const md = rendreMediationMarkdown(a, b, parserNegotiation(REPONSE_FAKE));
  assert.match(md, /^# Médiation AIAD — INT-001 ↔ INT-002/m);
  assert.match(md, /Compatibilité.*60%/);
  assert.match(md, /## Intent commun proposé/);
  assert.match(md, /## Conflits détectés/);
  assert.match(md, /## Arbitrages/);
  assert.match(md, /aiad-sdd negotiate INT-001 INT-002/);
});

test('rendreMediationMarkdown — pas de section conflits si vide', () => {
  const a = { id: 'A', title: 'A' };
  const b = { id: 'B', title: 'B' };
  const md = rendreMediationMarkdown(a, b, {
    compatibilite: 1, conflits: [], arbitrages: [],
    intentCommun: { titre: 'T', body: 'B' },
  });
  assert.ok(!md.includes('## Conflits'));
  assert.ok(!md.includes('## Arbitrages'));
});

// ─── negotiate (pipeline) ──────────────────────────────────────────────────

test('negotiate — IDs identiques → throw', async () => {
  await assert.rejects(
    () => negotiate('/tmp', 'INT-001', 'INT-001', { fetch: fakeOllamaFetch(REPONSE_FAKE) }),
    /doivent être différents/,
  );
});

test('negotiate — IDs manquants → throw', async () => {
  await assert.rejects(() => negotiate('/tmp'), /2 IDs Intent requis/);
});

test('negotiate — pipeline complet avec 2 Intents (Ollama mocké)', silent(async () => {
  const d = tmp();
  try {
    setupIntents(d, [
      { id: 'INT-001', title: 'Vitesse', body: 'Livrer rapidement.' },
      { id: 'INT-002', title: 'Accessibilité', body: 'WCAG AAA partout.' },
    ]);
    const r = await negotiate(d, 'INT-001', 'INT-002', { fetch: fakeOllamaFetch(REPONSE_FAKE) });
    assert.equal(r.intentA.id, 'INT-001');
    assert.equal(r.intentB.id, 'INT-002');
    assert.equal(r.mediation.compatibilite, 0.6);
    assert.match(r.markdown, /^# Médiation AIAD/m);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('negotiate --out → écrit le Markdown', silent(async () => {
  const d = tmp();
  try {
    setupIntents(d, [
      { id: 'INT-001', title: 'A', body: 'a' },
      { id: 'INT-002', title: 'B', body: 'b' },
    ]);
    await negotiate(d, 'INT-001', 'INT-002', {
      fetch: fakeOllamaFetch(REPONSE_FAKE),
      out: '.aiad/mediations/INT-001-vs-INT-002.md',
    });
    const path = join(d, '.aiad', 'mediations', 'INT-001-vs-INT-002.md');
    assert.ok(existsSync(path));
    assert.match(readFileSync(path, 'utf-8'), /Médiation AIAD/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('negotiate --json → JSON exploitable', async () => {
  const d = tmp();
  try {
    setupIntents(d, [
      { id: 'INT-001', title: 'A', body: 'a' },
      { id: 'INT-002', title: 'B', body: 'b' },
    ]);
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try {
      await negotiate(d, 'INT-001', 'INT-002', {
        fetch: fakeOllamaFetch(REPONSE_FAKE), json: true,
      });
    } finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.a, 'INT-001');
    assert.equal(parsed.b, 'INT-002');
    assert.equal(parsed.compatibilite, 0.6);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(loadIntent, chargerIntent);
  assert.equal(buildNegotiatePrompt, construirePromptNegotiate);
  assert.equal(parseNegotiation, parserNegotiation);
  assert.equal(renderMediationMarkdown, rendreMediationMarkdown);
  assert.equal(negotiateIntents, negotiate);
});

test('CONSTANTS — exposées', () => {
  assert.deepEqual(CONSTANTS.SEVERITES, ['haute', 'moyenne', 'basse']);
});
