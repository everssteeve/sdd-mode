// Tests #191 — Raccourci CLI standup (URL Kanban focus-mode).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildStandupUrl, tousLesLiens, normaliserLens, STANDUP_ROLES, buildStandupURL, dashboardEstStale, dashboardIsStale } from '../lib/standup-url.js';

function tmpProjet() {
  return mkdtempSync(join(tmpdir(), 'aiad-standup-url-'));
}

test('normaliserLens — valeurs autorisées', () => {
  for (const r of ['pm', 'pe', 'ae', 'qa', 'tl', 'all']) {
    assert.equal(normaliserLens(r), r);
  }
  assert.equal(normaliserLens('PM'), 'pm', 'casse insensible');
  assert.equal(normaliserLens(undefined), 'all', 'défaut all');
  assert.equal(normaliserLens(''), 'all', 'chaîne vide → all');
});

test('normaliserLens — valeur invalide → throw INVALID_LENS', () => {
  try {
    normaliserLens('product');
    assert.fail('aurait dû lever');
  } catch (e) {
    assert.equal(e.code, 'INVALID_LENS');
    assert.match(e.message, /product/);
  }
});

test('buildStandupUrl — lens pe, focus par défaut', () => {
  const racine = tmpProjet();
  try {
    const r = buildStandupUrl({ lens: 'pe', cwd: racine });
    assert.equal(r.lens, 'pe');
    assert.equal(r.focus, true);
    assert.equal(r.relative, 'dashboard/kanban.html?lens=pe&focus=today');
    assert.match(r.absolute, /^file:\/\/.*\/dashboard\/kanban\.html\?lens=pe&focus=today$/);
    assert.equal(r.exists, false);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('buildStandupUrl — lens=all sans paramètre lens dans l\'URL', () => {
  const r = buildStandupUrl({ lens: 'all', cwd: tmpProjet() });
  assert.equal(r.relative, 'dashboard/kanban.html?focus=today');
});

test('buildStandupUrl — focus:false produit URL nue', () => {
  const r = buildStandupUrl({ lens: 'pm', focus: false, cwd: tmpProjet() });
  assert.equal(r.relative, 'dashboard/kanban.html?lens=pm');
});

test('buildStandupUrl — outDir custom', () => {
  const r = buildStandupUrl({ lens: 'qa', outDir: 'build/dash', cwd: tmpProjet() });
  assert.equal(r.relative, 'build/dash/kanban.html?lens=qa&focus=today');
});

test('buildStandupUrl — exists=true si kanban.html présent', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, 'dashboard'));
    writeFileSync(join(racine, 'dashboard', 'kanban.html'), '<html></html>');
    const r = buildStandupUrl({ lens: 'tl', cwd: racine });
    assert.equal(r.exists, true);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('buildStandupUrl — serverUrl produit aussi l\'URL HTTP', () => {
  const r = buildStandupUrl({ lens: 'ae', serverUrl: 'http://127.0.0.1:8080', cwd: tmpProjet() });
  assert.equal(r.serverUrl, 'http://127.0.0.1:8080/kanban.html?lens=ae&focus=today');
});

test('buildStandupUrl — serverUrl avec trailing slash normalisé', () => {
  const r = buildStandupUrl({ lens: 'ae', serverUrl: 'http://x:1/', cwd: tmpProjet() });
  assert.equal(r.serverUrl, 'http://x:1/kanban.html?lens=ae&focus=today');
});

// (#256) publicUrl : URL Slack/Teams-shareable
test('buildStandupUrl — publicUrl produit URL absolue HTTPS', () => {
  const r = buildStandupUrl({ lens: 'pm', publicUrl: 'https://aiad.ovh/dash', cwd: tmpProjet() });
  assert.equal(r.publicUrl, 'https://aiad.ovh/dash/kanban.html?lens=pm&focus=today');
});

test('buildStandupUrl — publicUrl avec trailing slash normalisé', () => {
  const r = buildStandupUrl({ lens: 'qa', publicUrl: 'https://x.com/d/', cwd: tmpProjet() });
  assert.equal(r.publicUrl, 'https://x.com/d/kanban.html?lens=qa&focus=today');
});

test('buildStandupUrl — sans publicUrl, champ absent', () => {
  const r = buildStandupUrl({ lens: 'pm', cwd: tmpProjet() });
  assert.equal('publicUrl' in r, false);
});

test('tousLesLiens — propage publicUrl à chaque lens', () => {
  const liens = tousLesLiens({ publicUrl: 'https://x.com', cwd: tmpProjet() });
  for (const l of liens) {
    assert.ok(l.publicUrl);
    assert.match(l.publicUrl, /^https:\/\/x\.com\/kanban\.html\?lens=/);
  }
});

test('tousLesLiens — 5 rôles (PM/PE/AE/QA/TL) sans all', () => {
  const liens = tousLesLiens({ cwd: tmpProjet() });
  assert.equal(liens.length, 5);
  assert.deepEqual(liens.map((l) => l.lens), ['pm', 'pe', 'ae', 'qa', 'tl']);
});

test('STANDUP_ROLES + alias EN', () => {
  assert.deepEqual(STANDUP_ROLES, ['all', 'pm', 'pe', 'ae', 'qa', 'tl']);
  assert.equal(buildStandupURL, buildStandupUrl);
});

// ─── CLI E2E ────────────────────────────────────────────────────────────────

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'aiad-sdd.js');

test('CLI aiad-sdd standup --lens=pe --json → JSON valide', () => {
  const racine = tmpProjet();
  try {
    const r = spawnSync('node', [BIN, 'standup', '--lens=pe', '--json'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 0, `exit code 0, got ${r.status}: ${r.stderr}`);
    const j = JSON.parse(r.stdout);
    assert.equal(j.lens, 'pe');
    assert.equal(j.focus, true);
    assert.equal(j.relative, 'dashboard/kanban.html?lens=pe&focus=today');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('CLI aiad-sdd standup (défaut all) → texte humain', () => {
  const racine = tmpProjet();
  try {
    const r = spawnSync('node', [BIN, 'standup'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /lens ALL/);
    assert.match(r.stdout, /Relatif : dashboard\/kanban\.html\?focus=today/);
    assert.match(r.stdout, /kanban\.html introuvable/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('CLI aiad-sdd standup --all → 5 URLs', () => {
  const racine = tmpProjet();
  try {
    const r = spawnSync('node', [BIN, 'standup', '--all'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /PM\s+→ dashboard\/kanban\.html\?lens=pm&focus=today/);
    assert.match(r.stdout, /PE\s+→/);
    assert.match(r.stdout, /TL\s+→ dashboard\/kanban\.html\?lens=tl&focus=today/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

// (#270) standup --all --markdown
test('CLI standup --all --markdown → bloc Slack pasteable', () => {
  const racine = tmpProjet();
  try {
    const r = spawnSync('node', [BIN, 'standup', '--all', '--markdown'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /^## 🎯 Standup focus du jour/m);
    assert.match(r.stdout, /\| Rôle \| Kanban focus \|/);
    assert.match(r.stdout, /\*\*PM \(Product Manager\)\*\*/);
    assert.match(r.stdout, /\*\*TL \(Tech Lead\)\*\*/);
    // Pas de bruit console (les "  PM → ..." du mode texte ne doivent pas apparaître)
    assert.doesNotMatch(r.stdout, /^    PM /m);
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

test('CLI standup --all --markdown --public-url → URLs absolues', () => {
  const racine = tmpProjet();
  try {
    const r = spawnSync('node', [BIN, 'standup', '--all', '--markdown', '--public-url=https://demo.x/d'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /https:\/\/demo\.x\/d\/kanban\.html\?lens=pm/);
    assert.match(r.stdout, /https:\/\/demo\.x\/d\/kanban\.html\?lens=tl/);
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

test('CLI aiad-sdd standup --lens=invalid → exit 1', () => {
  const r = spawnSync('node', [BIN, 'standup', '--lens=product'], { cwd: tmpProjet(), encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Lens invalide/);
});

test('CLI aiad-sdd standup --lens=qa quand kanban.html existe → exists=true', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, 'dashboard'));
    writeFileSync(join(racine, 'dashboard', 'kanban.html'), '<html></html>');
    const r = spawnSync('node', [BIN, 'standup', '--lens=qa', '--json'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 0);
    const j = JSON.parse(r.stdout);
    assert.equal(j.exists, true);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('CLI aiad-sdd standup --all --json → liens[5] + stale', () => {
  const racine = tmpProjet();
  try {
    const r = spawnSync('node', [BIN, 'standup', '--all', '--json'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 0);
    const j = JSON.parse(r.stdout);
    assert.ok(Array.isArray(j.liens));
    assert.equal(j.liens.length, 5);
    assert.equal(j.liens[0].lens, 'pm');
    assert.ok(j.stale, 'champ stale présent');
    // (#297) _meta cohérent avec écosystème
    assert.equal(j._meta.schema, 'aiad-sdd-standup');
    assert.equal(j._meta.action, 'all');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

// ─── #193 Détection stale ────────────────────────────────────────────────────

function preparerProjet({ withKanban = true, withAiad = true } = {}) {
  const racine = tmpProjet();
  if (withKanban) {
    mkdirSync(join(racine, 'dashboard'));
    writeFileSync(join(racine, 'dashboard', 'kanban.html'), '<html></html>');
  }
  if (withAiad) {
    mkdirSync(join(racine, '.aiad'));
    mkdirSync(join(racine, '.aiad', 'specs'));
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-001-x.md'), '# spec');
  }
  return racine;
}

test('dashboardEstStale — kanban absent → stale=false raison=kanban-absent', () => {
  const racine = preparerProjet({ withKanban: false });
  try {
    const r = dashboardEstStale({ cwd: racine });
    assert.equal(r.stale, false);
    assert.equal(r.raison, 'kanban-absent');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('dashboardEstStale — .aiad absent → stale=false raison=aiad-absent', () => {
  const racine = preparerProjet({ withAiad: false });
  try {
    const r = dashboardEstStale({ cwd: racine });
    assert.equal(r.stale, false);
    assert.equal(r.raison, 'aiad-absent');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('dashboardEstStale — kanban plus récent → stale=false raison=a-jour', () => {
  const racine = preparerProjet();
  try {
    // Force kanban.html à mtime > spec
    const futur = new Date(Date.now() + 10_000);
    utimesSync(join(racine, 'dashboard', 'kanban.html'), futur, futur);
    const r = dashboardEstStale({ cwd: racine });
    assert.equal(r.stale, false);
    assert.equal(r.raison, 'a-jour');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('dashboardEstStale — spec plus récente → stale=true raison=aiad-plus-recent', () => {
  const racine = preparerProjet();
  try {
    const futur = new Date(Date.now() + 60_000);
    utimesSync(join(racine, '.aiad', 'specs', 'SPEC-001-x.md'), futur, futur);
    const r = dashboardEstStale({ cwd: racine });
    assert.equal(r.stale, true);
    assert.equal(r.raison, 'aiad-plus-recent');
    assert.ok(r.ecartSecondes >= 0);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('dashboardEstStale — outDir custom respecté', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, 'mydash'));
    writeFileSync(join(racine, 'mydash', 'kanban.html'), '<html></html>');
    mkdirSync(join(racine, '.aiad'));
    mkdirSync(join(racine, '.aiad', 'specs'));
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-1.md'), '#');
    const futur = new Date(Date.now() + 60_000);
    utimesSync(join(racine, '.aiad', 'specs', 'SPEC-1.md'), futur, futur);
    const r = dashboardEstStale({ cwd: racine, outDir: 'mydash' });
    assert.equal(r.stale, true);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('Alias EN dashboardIsStale === dashboardEstStale', () => {
  assert.equal(dashboardIsStale, dashboardEstStale);
});

test('CLI aiad-sdd standup → warning stale quand .aiad/ plus récent', () => {
  const racine = preparerProjet();
  try {
    const futur = new Date(Date.now() + 60_000);
    utimesSync(join(racine, '.aiad', 'specs', 'SPEC-001-x.md'), futur, futur);
    const r = spawnSync('node', [BIN, 'standup', '--lens=pm'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Dashboard périmé/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('CLI aiad-sdd standup --json → stale dans la sortie', () => {
  const racine = preparerProjet();
  try {
    const futur = new Date(Date.now() + 60_000);
    utimesSync(join(racine, '.aiad', 'specs', 'SPEC-001-x.md'), futur, futur);
    const r = spawnSync('node', [BIN, 'standup', '--lens=pe', '--json'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 0);
    const j = JSON.parse(r.stdout);
    assert.equal(j.stale.stale, true);
    // (#297) _meta single mode
    assert.equal(j._meta.schema, 'aiad-sdd-standup');
    assert.equal(j._meta.action, 'single');
    assert.equal(j.stale.raison, 'aiad-plus-recent');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('CLI aiad-sdd standup --all → warning stale en bloc', () => {
  const racine = preparerProjet();
  try {
    const futur = new Date(Date.now() + 60_000);
    utimesSync(join(racine, '.aiad', 'specs', 'SPEC-001-x.md'), futur, futur);
    const r = spawnSync('node', [BIN, 'standup', '--all'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Dashboard périmé/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

// ─── #194 Feedback --regen ───────────────────────────────────────────────────

test('CLI aiad-sdd standup --regen → affiche "✓ Dashboard régénéré" + JSON expose regen', () => {
  const racine = preparerProjet();
  try {
    // Ajoute le minimum pour que dashboard() ne crashe pas : créer un Intent
    mkdirSync(join(racine, '.aiad', 'intents'));
    writeFileSync(join(racine, '.aiad', 'intents', 'INTENT-001-x.md'), '---\nid: INTENT-001\ntitre: Test\nstatut: validated\n---\n');
    writeFileSync(join(racine, '.aiad', 'specs', 'SPEC-001-1-x.md'), '---\nid: SPEC-001-1-x\nparentIntent: INTENT-001\ntitre: Test\nstatut: ready\n---\n');
    // Rend la spec plus récente que kanban.html
    const futur = new Date(Date.now() + 60_000);
    utimesSync(join(racine, '.aiad', 'specs', 'SPEC-001-1-x.md'), futur, futur);
    // Texte
    const r = spawnSync('node', [BIN, 'standup', '--lens=pm', '--regen'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /✓ Dashboard régénéré \(\d+ pages, \d+ms\)/);
    assert.doesNotMatch(r.stdout, /Dashboard périmé/, 'warning supprimé après regen');
    // JSON
    const futur2 = new Date(Date.now() + 120_000);
    utimesSync(join(racine, '.aiad', 'specs', 'SPEC-001-1-x.md'), futur2, futur2);
    const r2 = spawnSync('node', [BIN, 'standup', '--lens=pe', '--regen', '--json'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r2.status, 0, r2.stderr);
    const j = JSON.parse(r2.stdout);
    assert.ok(j.regen, 'champ regen présent');
    assert.ok(typeof j.regen.pages === 'number');
    assert.ok(j.regen.pages > 0);
    assert.ok(typeof j.regen.dureeMs === 'number');
    assert.equal(j.stale.stale, false, 'stale=false après regen');
    assert.equal(j.stale.raison, 'regen-effectue');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('CLI aiad-sdd standup --regen sans staleness → pas de feedback (no-op)', () => {
  const racine = preparerProjet();
  try {
    // kanban plus récent → pas stale → --regen no-op
    const futur = new Date(Date.now() + 60_000);
    utimesSync(join(racine, 'dashboard', 'kanban.html'), futur, futur);
    const r = spawnSync('node', [BIN, 'standup', '--lens=pm', '--regen'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.doesNotMatch(r.stdout, /✓ Dashboard régénéré/, 'pas de regen si déjà à jour');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

// ─── #192 --serve ────────────────────────────────────────────────────────────
// Tests in-process : on importe serveDashboard et on vérifie l'intégration
// avec buildStandupUrl(serverUrl). Le démarrage du process CLI complet est
// difficile à tester car il appelle `await new Promise(() => {})`.

test('buildStandupUrl + serverUrl → URL HTTP servable pour le focus standup', () => {
  const r = buildStandupUrl({ lens: 'pe', serverUrl: 'http://127.0.0.1:18794', cwd: tmpProjet() });
  assert.equal(r.serverUrl, 'http://127.0.0.1:18794/kanban.html?lens=pe&focus=today');
});

test('serveDashboard + buildStandupUrl → roundtrip HTTP 200 sur kanban.html', async () => {
  const { serveDashboard } = await import('../lib/dashboard/server.js');
  const racine = preparerProjet();
  try {
    const { server, url, port } = await serveDashboard(join(racine, 'dashboard'), { port: 18795 });
    try {
      const lien = buildStandupUrl({ lens: 'qa', cwd: racine, serverUrl: url.replace(/\/$/, '') });
      assert.match(lien.serverUrl, /^http:\/\/127\.0\.0\.1:18795\/kanban\.html\?lens=qa&focus=today$/);
      const resp = await fetch(`http://127.0.0.1:${port}/kanban.html`);
      assert.equal(resp.status, 200);
      const html = await resp.text();
      assert.equal(html, '<html></html>'); // contenu de preparerProjet
    } finally {
      await new Promise((r) => server.close(r));
    }
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('CLI aiad-sdd standup --serve sans kanban.html → exit 1', () => {
  const racine = tmpProjet();
  try {
    const r = spawnSync('node', [BIN, 'standup', '--lens=pe', '--serve', '--port=18793'], { cwd: racine, encoding: 'utf8', timeout: 2000 });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /kanban\.html introuvable/);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('CLI aiad-sdd standup --out=custom-dir produit le bon préfixe', () => {
  const racine = tmpProjet();
  try {
    const r = spawnSync('node', [BIN, 'standup', '--lens=tl', '--out=custom-dir', '--json'], { cwd: racine, encoding: 'utf8' });
    assert.equal(r.status, 0);
    const j = JSON.parse(r.stdout);
    assert.equal(j.relative, 'custom-dir/kanban.html?lens=tl&focus=today');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});
