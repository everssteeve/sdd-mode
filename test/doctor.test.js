// Tests pour `aiad-sdd doctor` — diagnostic unifié.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { init } from '../lib/init.js';
import { diagnostiquer, doctor, lireSanteDepuisDashboard, lirePublicationContextDepuisDashboard } from '../lib/doctor.js';

// (#222) Mock console.log/error/warn au lieu de process.stdout.write —
// préserve le canal de communication du test runner en mode
// `--test-isolation=process` (le runner publie ses résultats TAP/JSON sur
// stdout). Le code applicatif (term.js, console.log) passe par console.*,
// donc on intercepte la couche au-dessus.
function silencerStdout(fn) {
  return async (...args) => {
    const origLog = console.log;
    const origErr = console.error;
    const origWarn = console.warn;
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
    try { return await fn(...args); }
    finally {
      console.log = origLog;
      console.error = origErr;
      console.warn = origWarn;
    }
  };
}

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-doctor-')); }
function trouverCheck(rapport, id) { return rapport.checks.find((c) => c.id === id); }

test('doctor — projet vierge → init manquant + ok=false', silencerStdout(async () => {
  const dir = tmp();
  try {
    const r = await diagnostiquer(dir);
    assert.equal(r.ok, false);
    assert.equal(r.checks.length, 1);
    assert.equal(r.checks[0].id, 'init');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('doctor — init complet → tous les checks structurels OK', silencerStdout(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    const r = await diagnostiquer(dir);

    assert.equal(trouverCheck(r, 'commands').ok, true);
    assert.equal(trouverCheck(r, 'gouvernance').ok, true);
    assert.equal(trouverCheck(r, 'emit-rules:parite').ok, true);

    // PRD/ARCHI/GUIDE sont au template par défaut (sentinelles présentes) → warn
    const prd = trouverCheck(r, 'fondamental:PRD.md');
    assert.equal(prd.severity, 'warn');
    assert.match(prd.message, /template/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('doctor — fondamentaux remplis → check passe en OK', silencerStdout(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    // Personnaliser les 3 fondamentaux (sentinelle supprimée)
    writeFileSync(join(dir, '.aiad', 'PRD.md'), '# Mon PRD\nréel\n', 'utf-8');
    writeFileSync(join(dir, '.aiad', 'ARCHITECTURE.md'), '# Mon archi\nréelle\n', 'utf-8');
    writeFileSync(join(dir, '.aiad', 'AGENT-GUIDE.md'), '# Mon guide\nréel\n', 'utf-8');

    const r = await diagnostiquer(dir);
    assert.equal(trouverCheck(r, 'fondamental:PRD.md').ok, true);
    assert.equal(trouverCheck(r, 'fondamental:ARCHITECTURE.md').ok, true);
    assert.equal(trouverCheck(r, 'fondamental:AGENT-GUIDE.md').ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('doctor — divergence emit-rules détectée', silencerStdout(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    // Patcher AGENTS.md → divergence avec source
    const agentsPath = join(dir, 'AGENTS.md');
    writeFileSync(agentsPath, readFileSync(agentsPath, 'utf-8') + '\n<!-- patch sauvage -->\n', 'utf-8');

    const r = await diagnostiquer(dir);
    const c = trouverCheck(r, 'emit-rules:parite');
    assert.equal(c.ok, false);
    assert.match(c.message, /divergent|divergent\(s\)/);
    assert.ok(Array.isArray(c.details) && c.details.length >= 1);
    assert.ok(c.details.includes('AGENTS.md'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('doctor --sans-gouvernance → check gouvernance signale 0/5', silencerStdout(async () => {
  const dir = tmp();
  try {
    await init(dir, { sansGouvernance: true });
    const r = await diagnostiquer(dir);
    const c = trouverCheck(r, 'gouvernance');
    assert.equal(c.ok, false);
    assert.match(c.message, /0\/5/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('doctor — sortie JSON via doctor() avec json=true', silencerStdout(async () => {
  const dir = tmp();
  try {
    await init(dir, {});

    // Capture stdout en collectant les chunks
    const origWrite = process.stdout.write.bind(process.stdout);
    let buffer = '';
    process.stdout.write = (chunk) => { buffer += chunk; return true; };
    try {
      await doctor(dir, { json: true });
    } finally {
      process.stdout.write = origWrite;
    }
    const parsed = JSON.parse(buffer);
    assert.equal(typeof parsed.ok, 'boolean');
    assert.ok(Array.isArray(parsed.checks));
    assert.ok(parsed.checks.length > 0);
    assert.equal(typeof parsed.version, 'string');
    // (#258) _meta block en tête, cohérent avec dashboard/brief
    assert.ok(parsed._meta, '_meta absent');
    assert.equal(parsed._meta.schema, 'aiad-sdd-doctor');
    assert.match(parsed._meta.version, /^\d+\.\d+\.\d+/);
    assert.match(parsed._meta.generated, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('doctor — détecte hook absent comme info (pas erreur)', silencerStdout(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    const r = await diagnostiquer(dir);
    const c = trouverCheck(r, 'hooks:pre-commit');
    assert.equal(c.ok, false);
    assert.equal(c.severity, 'info'); // pas un échec, juste une suggestion
    assert.match(c.message, /aiad-sdd hooks/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('doctor — détecte un hook AIAD installé', silencerStdout(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    // Simuler un hook installé
    mkdirSync(join(dir, '.git', 'hooks'), { recursive: true });
    writeFileSync(
      join(dir, '.git', 'hooks', 'pre-commit'),
      '#!/bin/sh\n# AIAD SDD Mode\nexec true\n',
      'utf-8',
    );
    const r = await diagnostiquer(dir);
    const c = trouverCheck(r, 'hooks:pre-commit');
    assert.equal(c.ok, true);
    assert.match(c.message, /installé/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

// ─── #221 Santé globale dans doctor ─────────────────────────────────────────

// (#340) lirePublicationContextDepuisDashboard — symétrie #339 brief
test('#340 lirePublicationContextDepuisDashboard — extrait sourceBase + publicUrl', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-doctor-pubctx-'));
  try {
    mkdirSync(join(dir, 'dashboard'), { recursive: true });
    writeFileSync(join(dir, 'dashboard', 'data.json'),
      JSON.stringify({ sourceBase: 'https://github.com/o/r/blob/main', publicUrl: 'https://o.github.io/r' }));
    const ctx = lirePublicationContextDepuisDashboard(dir);
    assert.equal(ctx.sourceBase, 'https://github.com/o/r/blob/main');
    assert.equal(ctx.publicUrl, 'https://o.github.io/r');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('#340 lirePublicationContextDepuisDashboard — sans data.json → strings vides', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-doctor-pubctx-'));
  try {
    const ctx = lirePublicationContextDepuisDashboard(dir);
    assert.equal(ctx.sourceBase, '');
    assert.equal(ctx.publicUrl, '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireSanteDepuisDashboard — sans dashboard/data.json → null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-doctor-sante-'));
  try {
    assert.equal(lireSanteDepuisDashboard(dir), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireSanteDepuisDashboard — extrait santeGlobale du JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-doctor-sante-'));
  try {
    mkdirSync(join(dir, 'dashboard'), { recursive: true });
    writeFileSync(join(dir, 'dashboard', 'data.json'),
      JSON.stringify({ santeGlobale: { score: 75, niveau: 'sain' } }));
    const s = lireSanteDepuisDashboard(dir);
    assert.equal(s.score, 75);
    assert.equal(s.niveau, 'sain');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireSanteDepuisDashboard — JSON cassé → null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-doctor-sante-'));
  try {
    mkdirSync(join(dir, 'dashboard'), { recursive: true });
    writeFileSync(join(dir, 'dashboard', 'data.json'), '{ not json');
    assert.equal(lireSanteDepuisDashboard(dir), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireSanteDepuisDashboard — out dir personnalisé', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-doctor-sante-'));
  try {
    mkdirSync(join(dir, 'mydash'), { recursive: true });
    writeFileSync(join(dir, 'mydash', 'data.json'), JSON.stringify({ santeGlobale: { score: 50 } }));
    assert.equal(lireSanteDepuisDashboard(dir, 'mydash').score, 50);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('doctor --strict-sante=N → exit 1 si score < N', silencerStdout(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-doctor-strict-'));
  try {
    await init(dir, { force: false });
    // Pré-seed dashboard/data.json avec santé 60
    mkdirSync(join(dir, 'dashboard'), { recursive: true });
    writeFileSync(join(dir, 'dashboard', 'data.json'),
      JSON.stringify({ santeGlobale: { score: 60, niveau: 'attention', breakdown: [], composantesDisponibles: 3 } }));
    const r = await doctor(dir, { seuilSante: 80 });
    assert.equal(r.ok, false, 'rapport.ok=false si score < seuil');
    assert.ok(r.santeStrictFail, 'champ santeStrictFail présent');
    assert.equal(r.santeStrictFail.seuil, 80);
    assert.equal(r.santeStrictFail.score, 60);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('doctor --strict-sante=N → ok si score >= seuil', silencerStdout(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-doctor-strict-'));
  try {
    await init(dir, { force: false });
    mkdirSync(join(dir, 'dashboard'), { recursive: true });
    writeFileSync(join(dir, 'dashboard', 'data.json'),
      JSON.stringify({ santeGlobale: { score: 85, niveau: 'sain', breakdown: [], composantesDisponibles: 5 } }));
    const r = await doctor(dir, { seuilSante: 70 });
    assert.equal(r.santeStrictFail, undefined, 'pas de fail si score >= seuil');
    assert.equal(r.santeGlobale.score, 85);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('doctor — santeGlobale ajouté au rapport JSON si dashboard généré', silencerStdout(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-doctor-sante-'));
  try {
    await init(dir, { force: false });
    mkdirSync(join(dir, 'dashboard'), { recursive: true });
    writeFileSync(join(dir, 'dashboard', 'data.json'),
      JSON.stringify({ santeGlobale: { score: 90, niveau: 'excellent' } }));
    const r = await doctor(dir);
    assert.equal(r.santeGlobale.score, 90);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

// (#301) doctor --markdown
import { formatterRapportMarkdown } from '../lib/doctor.js';

test('formatterRapportMarkdown — projet OK → message félicitation', () => {
  const md = formatterRapportMarkdown({
    ok: true,
    version: '1.14.0',
    racine: '/tmp/x',
    checks: [
      { id: 'a', ok: true, message: 'OK' },
      { id: 'b', ok: true, message: 'OK' },
    ],
  });
  assert.match(md, /^## 🏥 AIAD SDD — Doctor/m);
  assert.match(md, /✅ \*\*2\/2 OK\*\*/);
  assert.match(md, /Tous les checks passent/);
});

// (#346) Footer enrichi avec hyperlien dashboard si publicUrl
test('#346 formatterRapportMarkdown — footer inclut `[dashboard](URL/index.html)` si publicUrl publié', () => {
  const md = formatterRapportMarkdown({
    ok: true,
    version: '1.14.0',
    racine: '/tmp/x',
    checks: [{ id: 'a', ok: true, message: 'OK' }],
    publicationContext: { sourceBase: '', publicUrl: 'https://o.github.io/r' },
  });
  assert.match(md, /\[dashboard\]\(https:\/\/o\.github\.io\/r\/index\.html\)/);
});

test('#346 formatterRapportMarkdown — footer fallback `aiad-sdd dashboard --serve` si pas de publicUrl', () => {
  const md = formatterRapportMarkdown({
    ok: true,
    version: '1.14.0',
    racine: '/tmp/x',
    checks: [{ id: 'a', ok: true, message: 'OK' }],
    publicationContext: { sourceBase: '', publicUrl: '' },
  });
  assert.match(md, /`aiad-sdd dashboard --serve`/);
  assert.ok(!md.includes('[dashboard]('), 'pas de lien quand publicUrl vide');
});

test('formatterRapportMarkdown — fails → table avec sévérité', () => {
  const md = formatterRapportMarkdown({
    ok: false,
    version: '1.14.0',
    racine: '/tmp/x',
    checks: [
      { id: 'a', ok: true, message: 'OK' },
      { id: 'b', ok: false, severity: 'info', message: 'hint' },
      { id: 'c', ok: false, message: 'erreur critique' },
    ],
  });
  assert.match(md, /❌ \*\*1\/3 OK\*\* · ⚠️ 1 info\(s\) · ❌ 1 erreur\(s\)/);
  assert.match(md, /\| `b` \| ⚠️ info \| hint \|/);
  assert.match(md, /\| `c` \| ❌ error \| erreur critique \|/);
  // Le check OK ne doit pas être dans la table (focus sur les fails)
  assert.doesNotMatch(md, /\| `a` \|/);
});

test('formatterRapportMarkdown — santeGlobale + santeStrictFail rendus', () => {
  const md = formatterRapportMarkdown({
    ok: false,
    version: '1.14.0',
    racine: '/tmp/x',
    checks: [],
    santeGlobale: { score: 60, niveau: 'attention' },
    santeStrictFail: { seuil: 80, score: 60 },
  });
  assert.match(md, /Santé globale.*60\/100.*attention/);
  assert.match(md, /Strict santé échoué.*60 < seuil 80/);
});

// (#307) doctor --quiet
import { spawnSync as spawnSyncQ } from 'node:child_process';
import { fileURLToPath as fuQ } from 'node:url';
import { dirname as dnQ } from 'node:path';
const BIN_DR = join(dnQ(fuQ(import.meta.url)), '..', 'bin', 'aiad-sdd.js');

test('CLI doctor --quiet (init complet) → silent ou stderr clean si fails non-info', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-doctor-quiet-'));
  try {
    await init(dir, {});
    const r = spawnSyncQ('node', [BIN_DR, 'doctor', '--quiet'], { cwd: dir, encoding: 'utf8' });
    // exit 0 ou 1 (selon fails non-info), mais stdout doit être vide
    assert.equal(r.stdout.trim(), '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI doctor --quiet --strict-sante=999 (fail) → stderr message + exit 1', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-doctor-quiet-'));
  try {
    await init(dir, {});
    mkdirSync(join(dir, 'dashboard'), { recursive: true });
    writeFileSync(join(dir, 'dashboard', 'data.json'),
      JSON.stringify({ santeGlobale: { score: 50, niveau: 'attention' } }));
    const r = spawnSyncQ('node', [BIN_DR, 'doctor', '--quiet', '--strict-sante=80'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.equal(r.stdout.trim(), '');
    assert.match(r.stderr, /Strict santé échoué.*50.*80/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
