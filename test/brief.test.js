// Tests #228 — Commande `aiad-sdd brief`.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  lireDashboardData, calculerBrief, afficherBrief, brief, formatterMarkdown, calculerDelta,
  readDashboardData, computeBrief, renderBrief, briefEN, renderMarkdown, computeDelta,
} from '../lib/brief.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-brief-')); }

function silencer(fn) {
  return async (...args) => {
    const origLog = console.log;
    console.log = () => {};
    try { return await fn(...args); }
    finally { console.log = origLog; }
  };
}

test('lireDashboardData — sans data.json → null', () => {
  assert.equal(lireDashboardData(tmp()), null);
});

test('lireDashboardData — extrait JSON valide', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'),
      JSON.stringify({ santeGlobale: { score: 80 } }));
    const r = lireDashboardData(dir);
    assert.equal(r.santeGlobale.score, 80);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireDashboardData — JSON cassé → null', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), '{ not json');
    assert.equal(lireDashboardData(dir), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerBrief — null → null', () => {
  assert.equal(calculerBrief(null), null);
});

test('calculerBrief — extrait santé + maturité + counts', () => {
  const b = calculerBrief({
    projet: { nom: 'test' },
    maturite: { score: 4, total: 5, label: 'Actif' },
    santeGlobale: { score: 78, niveau: 'sain', composantesDisponibles: 5 },
    intents: [{ id: 'I1' }, { id: 'I2' }],
    specs: [{ id: 'S1' }, { id: 'S2' }, { id: 'S3' }],
    violations: { total: 2 },
    focusAlertes: { all: [] },
  });
  assert.equal(b.projet, 'test');
  assert.equal(b.maturite.score, 4);
  assert.equal(b.sante.score, 78);
  assert.equal(b.counts.intents, 2);
  assert.equal(b.counts.specs, 3);
  assert.equal(b.counts.violations, 2);
  // (#280) counts.tests = 0 si pas de qa.coverage
  assert.equal(b.counts.tests, 0);
});

// (#339) publicationContext expose sourceBase + publicUrl
test('#339 calculerBrief — publicationContext expose sourceBase + publicUrl depuis data.json', () => {
  const b = calculerBrief({
    projet: { nom: 'test' }, intents: [], specs: [], focusAlertes: { all: [] },
    sourceBase: 'https://github.com/o/r/blob/main',
    publicUrl: 'https://o.github.io/r',
  });
  assert.equal(b.publicationContext.sourceBase, 'https://github.com/o/r/blob/main');
  assert.equal(b.publicationContext.publicUrl, 'https://o.github.io/r');
});

test('#339 calculerBrief — publicationContext = "" quand non configuré', () => {
  const b = calculerBrief({
    projet: { nom: 'test' }, intents: [], specs: [], focusAlertes: { all: [] },
  });
  assert.equal(b.publicationContext.sourceBase, '');
  assert.equal(b.publicationContext.publicUrl, '');
});

// (#293) _meta.stale flag pour consumers
test('calculerBrief — _meta.stale=true si âge > TTL défaut 24h', () => {
  const stale = new Date(Date.now() - 30 * 3600000).toISOString();
  const r = calculerBrief({
    _meta: { schema: 'aiad-sdd-dashboard', version: '1.14.0', slim: false, generated: stale },
    projet: { nom: 'x' },
  });
  assert.equal(r._meta.stale, true);
  assert.ok(r._meta.ageHours >= 30 && r._meta.ageHours <= 31);
});

test('calculerBrief — _meta.stale=false si frais', () => {
  const recent = new Date(Date.now() - 1 * 3600000).toISOString();
  const r = calculerBrief({
    _meta: { schema: 'aiad-sdd-dashboard', version: '1.14.0', slim: false, generated: recent },
    projet: { nom: 'x' },
  });
  assert.equal(r._meta.stale, false);
});

// (#283) Sante breakdown propagé pour Slack-bot rich rendering
test('calculerBrief — propage sante.breakdown (5 dimensions composite)', () => {
  const b = calculerBrief({
    projet: { nom: 'x' },
    santeGlobale: {
      score: 72, niveau: 'sain', composantesDisponibles: 5,
      breakdown: [
        { id: 'maturite', label: 'Maturité', points: 20, max: 20, ratio: 1, disponible: true },
        { id: 'edgeCases', label: 'Edge cases', points: 4, max: 20, ratio: 0.22, disponible: true },
      ],
    },
  });
  assert.ok(Array.isArray(b.sante.breakdown));
  assert.equal(b.sante.breakdown.length, 2);
  assert.equal(b.sante.breakdown[0].id, 'maturite');
  assert.equal(b.sante.breakdown[1].points, 4);
});

test('calculerBrief — breakdown absent → tableau vide', () => {
  const b = calculerBrief({
    projet: { nom: 'x' },
    santeGlobale: { score: 72, niveau: 'sain', composantesDisponibles: 5 },
  });
  assert.deepEqual(b.sante.breakdown, []);
});

// (#280) Tests count via qa.coverage
test('calculerBrief — counts.tests = somme des qa.coverage[].tests', () => {
  const b = calculerBrief({
    projet: { nom: 'x' },
    qa: { coverage: [
      { id: 'SPEC-1', tests: 3 },
      { id: 'SPEC-2', tests: 2 },
      { id: 'SPEC-3', tests: 1 },
      { id: 'SPEC-4', tests: 0 }, // ne pète pas
    ]},
  });
  assert.equal(b.counts.tests, 6);
});

// (#281) SPECs sans tests
test('calculerBrief — counts.specsSansTests compte tests===0 (hors band na)', () => {
  const b = calculerBrief({
    projet: { nom: 'x' },
    qa: { coverage: [
      { id: 'S1', tests: 3, band: 'ok' },
      { id: 'S2', tests: 0, band: 'partiel' }, // compté
      { id: 'S3', tests: 0, band: 'na' }, // exclu (non applicable)
      { id: 'S4', tests: 1, band: 'ok' },
      { id: 'S5', tests: 0, band: 'partiel' }, // compté
    ]},
  });
  assert.equal(b.counts.specsSansTests, 2);
});

test('formatterMarkdown — ligne ⚠️ SPECs sans tests si > 0', () => {
  const md = formatterMarkdown({
    projet: 'x', sante: { score: 80, niveau: 'sain' }, alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0, tests: 10, specsSansTests: 3 },
  });
  assert.match(md, /⚠️ SPECs sans tests \| 3/);
});

test('formatterMarkdown — pas de ligne specsSansTests si 0', () => {
  const md = formatterMarkdown({
    projet: 'x', sante: { score: 80 }, alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0, tests: 10, specsSansTests: 0 },
  });
  assert.doesNotMatch(md, /SPECs sans tests/);
});

// (#288) Markdown callout : dimension la plus faible
test('formatterMarkdown — callout Focus dimension si breakdown a items <100%', () => {
  const md = formatterMarkdown({
    projet: 'x',
    sante: { score: 72, niveau: 'sain', breakdown: [
      { id: 'maturite', label: 'Maturité', points: 20, max: 20, ratio: 1, disponible: true },
      { id: 'edgeCases', label: 'Edge cases couverts', points: 4, max: 20, ratio: 0.22, disponible: true },
      { id: 'violations', label: 'Conformité Tier 1', points: 13, max: 20, ratio: 0.64, disponible: true },
    ]},
    alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0, tests: 0, specsSansTests: 0 },
  });
  // Plus faible = edgeCases (22%)
  assert.match(md, /🎯 \*\*Focus dimension\*\* : Edge cases couverts — 4\/20 \(22%\)/);
});

test('formatterMarkdown — pas de callout si toutes dimensions à 100%', () => {
  const md = formatterMarkdown({
    projet: 'x',
    sante: { score: 100, niveau: 'excellent', breakdown: [
      { id: 'maturite', label: 'Maturité', points: 20, max: 20, ratio: 1, disponible: true },
      { id: 'governance', label: 'Gouvernance', points: 20, max: 20, ratio: 1, disponible: true },
    ]},
    alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0, tests: 0, specsSansTests: 0 },
  });
  assert.doesNotMatch(md, /Focus dimension/);
});

test('formatterMarkdown — ignore dimensions non disponibles (ratio null)', () => {
  const md = formatterMarkdown({
    projet: 'x',
    sante: { score: 75, breakdown: [
      { id: 'maturite', label: 'Maturité', points: 15, max: 20, ratio: 0.75, disponible: true },
      { id: 'edgeCases', label: 'Edge cases', points: 0, max: 20, ratio: null, disponible: false },
    ]},
    alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0, tests: 0, specsSansTests: 0 },
  });
  // edgeCases (ratio:null) doit être ignoré → faible = maturite (75%)
  assert.match(md, /Focus dimension.*Maturité/);
  assert.doesNotMatch(md, /Focus dimension.*Edge cases/);
});

// (#287) Footer freshness avec _meta.generated
test('formatterMarkdown — footer affiche date génération formatée FR si _meta.generated présent', () => {
  const md = formatterMarkdown({
    _meta: { generated: '2026-05-13T20:00:00.000Z' },
    projet: 'x', sante: { score: 80, niveau: 'sain' }, alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0, tests: 0, specsSansTests: 0 },
  });
  // Format FR : DD/MM/YYYY HH:MM
  assert.match(md, /Généré 13\/05\/2026 \d{2}:\d{2}/);
});

test('formatterMarkdown — sans _meta.generated, footer simple (back-compat)', () => {
  const md = formatterMarkdown({
    projet: 'x', sante: { score: 80 }, alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0, tests: 0, specsSansTests: 0 },
  });
  assert.match(md, /_Détail :/);
  assert.doesNotMatch(md, /Généré /);
});

// (#292) Stale callout si âge > TTL
test('formatterMarkdown — callout stale si âge > 24h défaut', () => {
  // _meta.generated = il y a 26 heures
  const stale = new Date(Date.now() - 26 * 3600000).toISOString();
  const md = formatterMarkdown({
    _meta: { generated: stale },
    projet: 'x', sante: { score: 80, niveau: 'sain' }, alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0, tests: 0, specsSansTests: 0 },
  });
  assert.match(md, /⚠️ \*\*Données âgées de 26 h\*\*/);
  assert.match(md, /TTL 24h/);
});

test('formatterMarkdown — stale 3 jours affiche en jours, pas en heures', () => {
  const stale = new Date(Date.now() - 72 * 3600000).toISOString();
  const md = formatterMarkdown({
    _meta: { generated: stale },
    projet: 'x', sante: { score: 80 }, alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0, tests: 0, specsSansTests: 0 },
  });
  assert.match(md, /Données âgées de 3 j/);
});

test('formatterMarkdown — pas de stale callout si frais', () => {
  const recent = new Date(Date.now() - 1 * 3600000).toISOString(); // 1h
  const md = formatterMarkdown({
    _meta: { generated: recent },
    projet: 'x', sante: { score: 80 }, alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0, tests: 0, specsSansTests: 0 },
  });
  assert.doesNotMatch(md, /Données âgées/);
});

test('formatterMarkdown — ligne 🧪 Tests si counts.tests > 0', () => {
  const md = formatterMarkdown({
    projet: 'x', sante: { score: 80, niveau: 'sain' }, alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0, tests: 42 },
  });
  assert.match(md, /🧪 Tests \| 42/);
});

test('formatterMarkdown — pas de ligne Tests si counts.tests = 0', () => {
  const md = formatterMarkdown({
    projet: 'x', sante: { score: 80 }, alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0, tests: 0 },
  });
  assert.doesNotMatch(md, /🧪 Tests/);
});

test('calculerBrief — top 3 alertes focus depuis focusAlertes.all', () => {
  const b = calculerBrief({
    projet: { nom: 'x' },
    focusAlertes: { all: [
      { priorite: 'P1', titre: 'A1', action: 'do A1' },
      { priorite: 'P2', titre: 'A2', action: 'do A2' },
      { priorite: 'P3', titre: 'A3', action: 'do A3' },
      { priorite: 'P4', titre: 'A4', action: 'do A4' },
    ] },
  });
  assert.equal(b.alertes.length, 3);
  assert.equal(b.alertes[0].priorite, 'P1');
  assert.equal(b.alertes[2].priorite, 'P3');
});

test('calculerBrief — top 3 rituels triés desc par mtime', () => {
  const b = calculerBrief({
    projet: { nom: 'x' },
    metrics: { categories: {
      standup: { fichiers: [{ mtime: 1000, file: 's1.md' }, { mtime: 3000, file: 's3.md' }] },
      demo: { fichiers: [{ mtime: 2000, file: 'd2.md' }] },
      'tech-review': { fichiers: [{ mtime: 4000, file: 'tr.md' }] },
    } },
  });
  assert.equal(b.rituels.length, 3);
  assert.equal(b.rituels[0].type, 'tech-review'); // plus récent
  assert.equal(b.rituels[1].type, 'standup');
  assert.equal(b.rituels[2].type, 'demo');
});

test('calculerBrief — projet sans nom → "(sans nom)"', () => {
  const b = calculerBrief({ projet: {} });
  assert.equal(b.projet, '(sans nom)');
});

test('afficherBrief — null → message "lance aiad-sdd dashboard"', silencer(async () => {
  let captured = '';
  const orig = console.log;
  console.log = (...args) => { captured += args.join(' ') + '\n'; };
  try { afficherBrief(null); }
  finally { console.log = orig; }
  assert.match(captured, /dashboard\/data\.json absent/);
  assert.match(captured, /aiad-sdd dashboard/);
}));

test('afficherBrief — affiche les sections clés', silencer(async () => {
  let captured = '';
  const orig = console.log;
  console.log = (...args) => { captured += args.join(' ') + '\n'; };
  try {
    afficherBrief({
      projet: 'demo',
      maturite: { score: 5, total: 5, label: 'Complet' },
      sante: { score: 92, niveau: 'excellent', composantesDisponibles: 5 },
      alertes: [{ priorite: 'P1', titre: 'Conflit', action: 'PM arbitre' }],
      rituels: [{ type: 'standup', titre: 'Standup', date: Date.UTC(2026, 4, 13) }],
      counts: { intents: 10, specs: 15, violations: 0 },
    });
  } finally { console.log = orig; }
  // Strip ANSI codes pour les matches structurels (les libs term.js ajoutent
  // des codes couleur entre les tokens, ex: "10\x1B[0m Intent(s)").
  const plain = captured.replace(/\x1B\[\d+m/g, '');
  assert.match(plain, /Brief projet/);
  assert.match(plain, /demo/);
  assert.match(plain, /92\/100/);
  assert.match(plain, /5\/5/);
  assert.match(plain, /Focus du jour/);
  assert.match(plain, /Conflit/);
  assert.match(plain, /Derniers rituels/);
  assert.match(plain, /Standup/);
  assert.match(plain, /10 Intent\(s\)/);
}));

test('afficherBrief — aucune alerte → message "Pas d\'alerte"', silencer(async () => {
  let captured = '';
  const orig = console.log;
  console.log = (...args) => { captured += args.join(' ') + '\n'; };
  try {
    afficherBrief({
      projet: 'clean',
      maturite: null, sante: null,
      alertes: [], rituels: [],
      counts: { intents: 0, specs: 0, violations: 0 },
    });
  } finally { console.log = orig; }
  assert.match(captured, /Pas d'alerte focus prioritaire/);
}));

test('brief() — sans dashboard → JSON null', silencer(async () => {
  const dir = tmp();
  try {
    let captured = '';
    const origW = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s) => { captured += s; return true; };
    try { brief(dir, { json: true }); }
    finally { process.stdout.write = origW; }
    assert.equal(JSON.parse(captured), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('Alias EN canoniques', () => {
  assert.equal(readDashboardData, lireDashboardData);
  assert.equal(computeBrief, calculerBrief);
  assert.equal(renderBrief, afficherBrief);
  assert.equal(briefEN, brief);
});

// ─── CLI E2E ────────────────────────────────────────────────────────────────

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'aiad-sdd.js');

test('CLI brief --json — sans dashboard → null', () => {
  const dir = tmp();
  try {
    const r = spawnSync('node', [BIN, 'brief', '--json'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(JSON.parse(r.stdout), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI brief --json — avec data.json → résumé structuré', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      projet: { nom: 'demo' },
      maturite: { score: 4, total: 5, label: 'Actif' },
      santeGlobale: { score: 80, niveau: 'sain', composantesDisponibles: 5 },
      intents: [], specs: [], violations: { total: 1 },
    }));
    const r = spawnSync('node', [BIN, 'brief', '--json'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    const j = JSON.parse(r.stdout);
    assert.equal(j.projet, 'demo');
    assert.equal(j.sante.score, 80);
    assert.equal(j.maturite.score, 4);
    assert.equal(j.counts.violations, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI brief — texte humain', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      projet: { nom: 'demo' },
      maturite: { score: 5, total: 5, label: 'Complet' },
      santeGlobale: { score: 92, niveau: 'excellent', composantesDisponibles: 5 },
      intents: [], specs: [], violations: { total: 0 },
    }));
    const r = spawnSync('node', [BIN, 'brief'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Brief projet/);
    assert.match(r.stdout, /demo/);
    assert.match(r.stdout, /92\/100/);
    assert.match(r.stdout, /Complet/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ─── #269 brief --markdown ─────────────────────────────────────────────────

test('formatterMarkdown — null donne hint "Dashboard absent"', () => {
  const md = formatterMarkdown(null);
  assert.match(md, /Dashboard absent/);
  assert.match(md, /aiad-sdd dashboard/);
});

test('formatterMarkdown — projet complet → header + table + sections', () => {
  const brief = {
    projet: 'demo',
    maturite: { score: 5, total: 5, label: 'Complet' },
    sante: { score: 85, niveau: 'excellent', composantesDisponibles: 5 },
    alertes: [{ priorite: 'P5', titre: '16 SPECs prêtes', action: 'PE — démarrer prochaine' }],
    rituels: [{ type: 'standup', titre: 'Standup', date: Date.now(), file: 'standup.md' }],
    counts: { intents: 15, specs: 18, violations: 3 },
  };
  const md = formatterMarkdown(brief);
  assert.match(md, /^## 📊 Brief AIAD — demo/);
  assert.match(md, /\| Métrique \| Valeur \|/); // table header
  assert.match(md, /🟢 Santé.*85\/100.*excellent/);
  assert.match(md, /🎯 Maturité.*5\/5.*Complet/);
  assert.match(md, /⚠️ Violations Tier 1 \| 3/);
  assert.match(md, /### 🎯 Focus du jour/);
  assert.match(md, /\*\*P5\*\* 16 SPECs prêtes/);
  assert.match(md, /### 📅 Derniers rituels/);
});

test('formatterMarkdown — santé attention → emoji 🟡', () => {
  const md = formatterMarkdown({
    projet: 'x', sante: { score: 60, niveau: 'attention', composantesDisponibles: 5 },
    alertes: [], rituels: [], counts: { intents: 0, specs: 0, violations: 0 },
  });
  assert.match(md, /🟡 Santé/);
});

test('formatterMarkdown — santé critique → emoji 🔴', () => {
  const md = formatterMarkdown({
    projet: 'x', sante: { score: 30, niveau: 'critique', composantesDisponibles: 5 },
    alertes: [], rituels: [], counts: { intents: 0, specs: 0, violations: 0 },
  });
  assert.match(md, /🔴 Santé/);
});

test('formatterMarkdown — 0 violations → emoji ✅', () => {
  const md = formatterMarkdown({
    projet: 'x', sante: { score: 90, niveau: 'excellent' }, alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0 },
  });
  assert.match(md, /✅ Violations Tier 1 \| 0/);
});

test('formatterMarkdown — aucune alerte → "Pas d\'alerte focus prioritaire"', () => {
  const md = formatterMarkdown({
    projet: 'x', sante: { score: 90 }, alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0 },
  });
  assert.match(md, /Pas d'alerte focus prioritaire/);
});

test('formatterMarkdown — strictFail rendu en callout', () => {
  const md = formatterMarkdown({
    projet: 'x', sante: { score: 60, niveau: 'attention' }, alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0 },
    strictFail: { raison: 'sous-seuil', seuil: 80, score: 60 },
  });
  assert.match(md, /Strict échoué.*score 60 < seuil 80/);
});

test('CLI brief --markdown produit du Markdown sur stdout', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      projet: { nom: 'demo' },
      maturite: { score: 5, total: 5, label: 'Complet' },
      santeGlobale: { score: 85, niveau: 'excellent', composantesDisponibles: 5 },
      intents: [], specs: [], violations: { total: 0 },
    }));
    const r = spawnSync('node', [BIN, 'brief', '--markdown'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /^## 📊 Brief AIAD — demo/);
    assert.match(r.stdout, /Métrique.*Valeur/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Alias EN renderMarkdown', () => {
  assert.equal(renderMarkdown, formatterMarkdown);
});

// ─── #254 + #262 _meta brief ────────────────────────────────────────────────

test('calculerBrief — produit son propre _meta.schema=aiad-sdd-brief avec source dashboard', () => {
  const r = calculerBrief({
    _meta: { schema: 'aiad-sdd-dashboard', version: '1.14.0', slim: true, generated: '2026-05-13T20:00:00.000Z' },
    projet: { nom: 'x' },
    maturite: { score: 5, total: 5, label: 'Complet' },
    santeGlobale: { score: 80, niveau: 'sain', composantesDisponibles: 5 },
  });
  assert.ok(r._meta);
  // (#262) Schema propre, plus la propagation aveugle
  assert.equal(r._meta.schema, 'aiad-sdd-brief');
  // version + generated hérités de la source (pour corréler au build CI)
  assert.equal(r._meta.version, '1.14.0');
  assert.equal(r._meta.generated, '2026-05-13T20:00:00.000Z');
  // source.schema préservé pour traçabilité
  assert.equal(r._meta.source.schema, 'aiad-sdd-dashboard');
  // (#293) stale + ageHours présents
  assert.equal(typeof r._meta.stale, 'boolean');
  assert.equal(typeof r._meta.ageHours, 'number');
  assert.equal(r._meta.source.slim, true);
});

test('calculerBrief — sans _meta dans donnees → champ absent (pas null)', () => {
  const r = calculerBrief({
    projet: { nom: 'x' },
    maturite: { score: 5, total: 5, label: 'Complet' },
    santeGlobale: { score: 80, niveau: 'sain', composantesDisponibles: 5 },
  });
  assert.equal('_meta' in r, false, '_meta absent quand donnees._meta inexistant');
});

// ─── #229 brief --strict ────────────────────────────────────────────────────

test('brief() — --strict=N avec santé < N → strictFail dans le résultat', silencer(async () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      projet: { nom: 'x' },
      santeGlobale: { score: 60, niveau: 'attention', composantesDisponibles: 5 },
    }));
    const r = brief(dir, { strict: 80 });
    assert.ok(r.strictFail);
    assert.equal(r.strictFail.seuil, 80);
    assert.equal(r.strictFail.score, 60);
    assert.equal(r.strictFail.raison, 'sous-seuil');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('brief() — --strict=N avec santé >= N → pas de strictFail', silencer(async () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      projet: { nom: 'x' },
      santeGlobale: { score: 85, niveau: 'excellent', composantesDisponibles: 5 },
    }));
    const r = brief(dir, { strict: 80 });
    assert.equal(r.strictFail, undefined);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('brief() — --strict=N sans dashboard → strictFail raison=dashboard-absent', silencer(async () => {
  const dir = tmp();
  try {
    const r = brief(dir, { strict: 50 });
    assert.ok(r.strictFail);
    assert.equal(r.strictFail.raison, 'dashboard-absent');
    assert.equal(r.strictFail.seuil, 50);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('CLI brief --strict=80 avec santé < 80 → exit 1', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      projet: { nom: 'x' },
      santeGlobale: { score: 60, niveau: 'attention', composantesDisponibles: 5 },
    }));
    const r = spawnSync('node', [BIN, 'brief', '--strict=80'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /Strict échoué/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI brief --strict=80 avec santé >= 80 → exit 0', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      projet: { nom: 'x' },
      santeGlobale: { score: 92, niveau: 'excellent', composantesDisponibles: 5 },
    }));
    const r = spawnSync('node', [BIN, 'brief', '--strict=80'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI brief --strict=50 sans dashboard → exit 1', () => {
  const dir = tmp();
  try {
    const r = spawnSync('node', [BIN, 'brief', '--strict=50'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /dashboard absent/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ─── #295 brief --diff ──────────────────────────────────────────────────────

test('calculerDelta — null inputs → null', () => {
  assert.equal(calculerDelta(null, null), null);
  assert.equal(calculerDelta({}, null), null);
});

test('calculerDelta — sante.scoreDelta correct', () => {
  const d = calculerDelta(
    { sante: { score: 75 }, counts: {} },
    { sante: { score: 70 }, counts: {} },
  );
  assert.equal(d.sante.scoreDelta, 5);
  assert.equal(d.sante.score, 75);
  assert.equal(d.sante.scorePrev, 70);
});

test('calculerDelta — counts deltas par métrique', () => {
  const d = calculerDelta(
    { counts: { intents: 15, specs: 18, tests: 22, violations: 6 } },
    { counts: { intents: 14, specs: 18, tests: 20, violations: 8 } },
  );
  assert.equal(d.counts.intents.delta, 1);
  assert.equal(d.counts.specs.delta, 0);
  assert.equal(d.counts.tests.delta, 2);
  assert.equal(d.counts.violations.delta, -2);
});

test('calculerDelta — métriques absentes d\'un côté → ignorées', () => {
  const d = calculerDelta(
    { counts: { intents: 15 } },
    { counts: {} },
  );
  assert.equal(d.counts.intents, undefined);
});

test('formatterMarkdown — bloc Évolution si delta présent', () => {
  const md = formatterMarkdown({
    projet: 'x', sante: { score: 75 }, alertes: [], rituels: [],
    counts: { intents: 15, specs: 18, violations: 6, tests: 22, specsSansTests: 0 },
    delta: {
      sante: { score: 75, scorePrev: 70, scoreDelta: 5 },
      counts: {
        tests: { current: 22, prev: 20, delta: 2 },
        violations: { current: 6, prev: 8, delta: -2 },
      },
    },
  });
  assert.match(md, /📈 \*\*Évolution depuis dernier brief\*\*/);
  assert.match(md, /Santé ↑ \+5/);
  assert.match(md, /tests ↑ \+2/);
  assert.match(md, /violations ↓ -2/);
});

test('formatterMarkdown — pas de bloc Évolution si tous deltas = 0', () => {
  const md = formatterMarkdown({
    projet: 'x', sante: { score: 75 }, alertes: [], rituels: [],
    counts: { intents: 15, specs: 18, violations: 6, tests: 22, specsSansTests: 0 },
    delta: {
      sante: { score: 75, scorePrev: 75, scoreDelta: 0 },
      counts: { tests: { current: 22, prev: 22, delta: 0 } },
    },
  });
  assert.doesNotMatch(md, /Évolution/);
});

test('Alias EN computeDelta', () => {
  assert.equal(computeDelta, calculerDelta);
});

// ─── #299 brief --strict-tests ─────────────────────────────────────────────

test('brief() — --strict-tests=N : strictTestsFail si tests < N', silencer(async () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      projet: { nom: 'x' },
      santeGlobale: { score: 80, niveau: 'sain', composantesDisponibles: 5 },
      qa: { coverage: [
        { id: 'S1', tests: 5, band: 'ok' },
      ]},
    }));
    const r = brief(dir, { strictTests: 10 });
    assert.ok(r.strictTestsFail);
    assert.equal(r.strictTestsFail.seuil, 10);
    assert.equal(r.strictTestsFail.tests, 5);
    assert.equal(r.strictTestsFail.raison, 'sous-seuil');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('brief() — --strict-tests=N : pas de strictTestsFail si tests >= N', silencer(async () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      projet: { nom: 'x' },
      santeGlobale: { score: 80, niveau: 'sain', composantesDisponibles: 5 },
      qa: { coverage: [{ id: 'S1', tests: 20, band: 'ok' }] },
    }));
    const r = brief(dir, { strictTests: 10 });
    assert.equal(r.strictTestsFail, undefined);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('CLI brief --strict-tests=20 → exit 1 si tests < 20', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      projet: { nom: 'x' },
      santeGlobale: { score: 80, niveau: 'sain', composantesDisponibles: 5 },
      qa: { coverage: [{ id: 'S1', tests: 5, band: 'ok' }] },
    }));
    const r = spawnSync('node', [BIN, 'brief', '--strict-tests=20'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /Strict tests échoué/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI brief --strict=80 + --strict-tests=10 → exit 1 si EITHER fail', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      projet: { nom: 'x' },
      santeGlobale: { score: 90, niveau: 'excellent', composantesDisponibles: 5 },  // passe santé
      qa: { coverage: [{ id: 'S1', tests: 3, band: 'ok' }] },  // fail tests
    }));
    const r = spawnSync('node', [BIN, 'brief', '--strict=80', '--strict-tests=10'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /Strict tests échoué/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ─── #300 brief --public-url → footer hyperlien ─────────────────────────────

test('formatterMarkdown — footer sans publicUrl → backtick code', () => {
  const md = formatterMarkdown({
    _meta: { generated: new Date(Date.now() - 1000).toISOString() },
    projet: 'x', sante: { score: 80, niveau: 'sain' }, alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0, tests: 0, specsSansTests: 0 },
  });
  assert.match(md, /`aiad-sdd dashboard --serve`/);
  assert.doesNotMatch(md, /\[dashboard\]\(http/);
});

test('formatterMarkdown — footer avec publicUrl → hyperlien Markdown', () => {
  const md = formatterMarkdown({
    _meta: { generated: new Date(Date.now() - 1000).toISOString() },
    projet: 'x', sante: { score: 80, niveau: 'sain' }, alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0, tests: 0, specsSansTests: 0 },
  }, { publicUrl: 'https://aiad.ovh/dashboard' });
  assert.match(md, /\[dashboard\]\(https:\/\/aiad\.ovh\/dashboard\/index\.html\)/);
});

test('formatterMarkdown — publicUrl trailing slash strippé', () => {
  const md = formatterMarkdown({
    _meta: { generated: new Date(Date.now() - 1000).toISOString() },
    projet: 'x', sante: { score: 80 }, alertes: [], rituels: [],
    counts: { intents: 0, specs: 0, violations: 0, tests: 0, specsSansTests: 0 },
  }, { publicUrl: 'https://x.com/d/' });
  assert.match(md, /\[dashboard\]\(https:\/\/x\.com\/d\/index\.html\)/);
  assert.doesNotMatch(md, /\/d\/\/index/);
});

test('CLI brief --markdown --public-url=URL → hyperlien dans footer', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      _meta: { schema: 'aiad-sdd-dashboard', version: '1.14.0', generated: new Date().toISOString() },
      projet: { nom: 'demo' },
      maturite: { score: 5, total: 5, label: 'Complet' },
      santeGlobale: { score: 85, niveau: 'excellent', composantesDisponibles: 5 },
    }));
    const r = spawnSync('node', [BIN, 'brief', '--markdown', '--public-url=https://demo.aiad.ovh'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /\[dashboard\]\(https:\/\/demo\.aiad\.ovh\/index\.html\)/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ─── #306 brief --quiet ─────────────────────────────────────────────────────

test('CLI brief --quiet (no strict) → silent + exit 0', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      projet: { nom: 'x' },
      santeGlobale: { score: 80, niveau: 'sain', composantesDisponibles: 5 },
    }));
    const r = spawnSync('node', [BIN, 'brief', '--quiet'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '');
    assert.equal(r.stderr.trim(), '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI brief --quiet --strict=80 (pass) → silent + exit 0', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      projet: { nom: 'x' },
      santeGlobale: { score: 85, niveau: 'sain', composantesDisponibles: 5 },
    }));
    const r = spawnSync('node', [BIN, 'brief', '--quiet', '--strict=80'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '');
    assert.equal(r.stderr.trim(), '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI brief --quiet --strict=80 (fail) → stderr message + exit 1', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      projet: { nom: 'x' },
      santeGlobale: { score: 60, niveau: 'attention', composantesDisponibles: 5 },
    }));
    const r = spawnSync('node', [BIN, 'brief', '--quiet', '--strict=80'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.equal(r.stdout.trim(), '');
    assert.match(r.stderr, /Strict échoué.*60.*80/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
