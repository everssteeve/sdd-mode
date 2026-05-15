// Tests #149 — Documentation DORA + Flow référencée par les bannières dashboard.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');

test('docs/dora-format.md — fichier présent + entête layout + sections critiques', () => {
  const path = join(REPO, 'docs', 'dora-format.md');
  assert.ok(existsSync(path), 'docs/dora-format.md doit exister (référencé par bannière DORA)');
  const c = readFileSync(path, 'utf-8');
  assert.match(c, /^---\nlayout: default/, 'frontmatter Jekyll attendu');
  assert.match(c, /lang: fr-FR/);
  assert.match(c, /aiad-sdd dora --record/);
  assert.match(c, /aiad-sdd dora --import-git/);
  assert.match(c, /YYYY-MM-DD-deploy-NN\.md/);
  assert.match(c, /cycle_time_days/);
  assert.match(c, /lead_time_days/);
  assert.match(c, /Change Failure Rate/);
});

test('docs/flow-format.md — fichier présent + 3 rituels documentés', () => {
  const path = join(REPO, 'docs', 'flow-format.md');
  assert.ok(existsSync(path), 'docs/flow-format.md doit exister (référencé par bannière Flow)');
  const c = readFileSync(path, 'utf-8');
  assert.match(c, /^---\nlayout: default/);
  // Les 3 rituels qui nourrissent Flow
  assert.match(c, /\/aiad standup/);
  assert.match(c, /\/sdd gate/);
  assert.match(c, /\/sdd drift-check/);
  // Format des 3 sous-dossiers metrics
  assert.match(c, /\.aiad\/metrics\/standup/);
  assert.match(c, /\.aiad\/metrics\/specs/);
  assert.match(c, /\.aiad\/metrics\/drift/);
});

test('Bannières dashboard DORA/Flow référencent bien ces URLs', () => {
  const render = readFileSync(join(REPO, 'lib', 'dashboard', 'render.js'), 'utf-8');
  assert.match(render, /aiad\.ovh\/docs\/dora-format/);
  assert.match(render, /aiad\.ovh\/docs\/flow-format/);
});
