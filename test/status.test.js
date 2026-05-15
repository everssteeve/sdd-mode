// Tests #224 — `aiad-sdd status` enrichi avec score santé globale.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../lib/init.js';
import { showStatus, collecterStatus } from '../lib/status.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-status-')); }

function silencerStdout(fn) {
  return async (...args) => {
    const origLog = console.log;
    const origErr = console.error;
    console.log = () => {};
    console.error = () => {};
    try { return await fn(...args); }
    finally { console.log = origLog; console.error = origErr; }
  };
}

test('showStatus — sans dashboard → santeGlobale=null', silencerStdout(async () => {
  const dir = tmp();
  try {
    await init(dir, { force: false });
    const data = await showStatus(dir, { json: true });
    assert.equal(data.santeGlobale, null);
    // (#260) _meta block cohérent avec dashboard/doctor/workspace
    assert.ok(data._meta);
    assert.equal(data._meta.schema, 'aiad-sdd-status');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('showStatus — avec dashboard/data.json → santeGlobale propagée', silencerStdout(async () => {
  const dir = tmp();
  try {
    await init(dir, { force: false });
    mkdirSync(join(dir, 'dashboard'), { recursive: true });
    writeFileSync(join(dir, 'dashboard', 'data.json'),
      JSON.stringify({ santeGlobale: { score: 82, niveau: 'sain', composantesDisponibles: 5, breakdown: [] } }));
    const data = await showStatus(dir, { json: true });
    assert.equal(data.santeGlobale.score, 82);
    assert.equal(data.santeGlobale.niveau, 'sain');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

// (#341) status JSON expose publicationContext (parallèle #339 brief, #340 doctor)
test('#341 showStatus — data.publicationContext exposé depuis data.json', silencerStdout(async () => {
  const dir = tmp();
  try {
    await init(dir, { force: false });
    mkdirSync(join(dir, 'dashboard'), { recursive: true });
    writeFileSync(join(dir, 'dashboard', 'data.json'),
      JSON.stringify({ sourceBase: 'https://github.com/o/r/blob/main', publicUrl: 'https://o.github.io/r' }));
    const data = await showStatus(dir, { json: true });
    assert.equal(data.publicationContext.sourceBase, 'https://github.com/o/r/blob/main');
    assert.equal(data.publicationContext.publicUrl, 'https://o.github.io/r');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('#341 showStatus — publicationContext vide quand dashboard absent', silencerStdout(async () => {
  const dir = tmp();
  try {
    await init(dir, { force: false });
    const data = await showStatus(dir, { json: true });
    assert.equal(data.publicationContext.sourceBase, '');
    assert.equal(data.publicationContext.publicUrl, '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('showStatus — JSON cassé → santeGlobale=null sans crash', silencerStdout(async () => {
  const dir = tmp();
  try {
    await init(dir, { force: false });
    mkdirSync(join(dir, 'dashboard'), { recursive: true });
    writeFileSync(join(dir, 'dashboard', 'data.json'), '{ not json');
    const data = await showStatus(dir, { json: true });
    assert.equal(data.santeGlobale, null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('showStatus — texte humain affiche le score quand dispo', silencerStdout(async () => {
  const dir = tmp();
  try {
    await init(dir, { force: false });
    mkdirSync(join(dir, 'dashboard'), { recursive: true });
    writeFileSync(join(dir, 'dashboard', 'data.json'),
      JSON.stringify({ santeGlobale: { score: 90, niveau: 'excellent', composantesDisponibles: 5, breakdown: [{},{},{},{},{}] } }));
    // Capture console output
    let captured = '';
    const origLog = console.log;
    console.log = (...args) => { captured += args.join(' ') + '\n'; };
    try {
      await showStatus(dir, { json: false });
    } finally { console.log = origLog; }
    assert.match(captured, /Santé projet/);
    assert.match(captured, /90\/100/);
    assert.match(captured, /excellent/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('showStatus — texte humain mention "Lance aiad-sdd dashboard" si pas calculé', silencerStdout(async () => {
  const dir = tmp();
  try {
    await init(dir, { force: false });
    let captured = '';
    const origLog = console.log;
    console.log = (...args) => { captured += args.join(' ') + '\n'; };
    try {
      await showStatus(dir, { json: false });
    } finally { console.log = origLog; }
    assert.match(captured, /Santé projet/);
    assert.match(captured, /non calculée/);
    assert.match(captured, /aiad-sdd dashboard/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('collecterStatus — projet non initialisé → initialise:false', () => {
  const dir = tmp();
  try {
    const data = collecterStatus(dir);
    assert.equal(data.initialise, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// (#302) status --markdown
import { formatterStatusMarkdown } from '../lib/status.js';

test('formatterStatusMarkdown — projet non initialisé → warning', () => {
  const md = formatterStatusMarkdown({ initialise: false });
  assert.match(md, /SDD Mode non initialisé/);
  assert.match(md, /aiad-sdd init/);
});

test('formatterStatusMarkdown — projet initialisé → table KPIs', () => {
  const md = formatterStatusMarkdown({
    initialise: true,
    projetDir: '/tmp/x',
    fondamentaux: {
      'PRD.md': { present: true, rempli: true },
      'ARCHITECTURE.md': { present: true, rempli: false },
      'AGENT-GUIDE.md': { present: false, rempli: false },
    },
    cycle: { intents: 12, specs: 18 },
    infrastructure: { gouvernanceCount: 5 },
    maturite: { score: 5, total: 5, label: 'Complet' },
    santeGlobale: { score: 80, niveau: 'sain' },
  });
  assert.match(md, /^## 📋 AIAD SDD — Status/m);
  assert.match(md, /🎯 Maturité.*5\/5.*Complet/);
  assert.match(md, /🟢 Santé.*80\/100.*sain/);
  assert.match(md, /📥 Intents \| 12/);
  assert.match(md, /📋 SPECs \| 18/);
  assert.match(md, /⚖ Gouvernance Tier 1 \| 5\/5/);
  // Fondamentaux : 3 lignes avec emojis distincts
  assert.match(md, /✅ `PRD\.md` rédigé/);
  assert.match(md, /⚠️ `ARCHITECTURE\.md` template/);
  assert.match(md, /❌ `AGENT-GUIDE\.md` absent/);
});

// (#347) Footer enrichi avec hyperlien dashboard si publicUrl
test('#347 formatterStatusMarkdown — footer `[dashboard](URL/index.html)` si publicUrl publié', () => {
  const md = formatterStatusMarkdown({
    initialise: true,
    projetDir: '/tmp/x',
    fondamentaux: {},
    cycle: { intents: 0, specs: 0 },
    infrastructure: { gouvernanceCount: 0 },
    publicationContext: { sourceBase: '', publicUrl: 'https://o.github.io/r' },
  });
  assert.match(md, /\[dashboard\]\(https:\/\/o\.github\.io\/r\/index\.html\)/);
});

test('#347 formatterStatusMarkdown — footer fallback si publicUrl vide', () => {
  const md = formatterStatusMarkdown({
    initialise: true,
    projetDir: '/tmp/x',
    fondamentaux: {},
    cycle: { intents: 0, specs: 0 },
    infrastructure: { gouvernanceCount: 0 },
    publicationContext: { sourceBase: '', publicUrl: '' },
  });
  assert.match(md, /`aiad-sdd dashboard --serve`/);
  assert.ok(!md.includes('[dashboard]('), 'pas de lien quand publicUrl vide');
});

test('formatterStatusMarkdown — santé attention → emoji 🟡', () => {
  const md = formatterStatusMarkdown({
    initialise: true,
    cycle: { intents: 0, specs: 0 },
    infrastructure: { gouvernanceCount: 0 },
    fondamentaux: {},
    santeGlobale: { score: 55, niveau: 'attention' },
  });
  assert.match(md, /🟡 Santé.*55\/100.*attention/);
});
