// Tests #128 — aiad-sdd self-update opt-in.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  lireVersionLocale, fetchVersionDistante, compareSemver, checkUpdate, estAutorise,
} from '../lib/self-update.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, '..', 'bin', 'aiad-sdd.js');

test('lireVersionLocale — retourne la version du package.json', () => {
  const v = lireVersionLocale();
  assert.match(v, /^\d+\.\d+\.\d+/);
});

test('compareSemver — ordres usuels', () => {
  assert.equal(compareSemver('1.0.0', '1.0.0'), 0);
  assert.equal(compareSemver('1.0.1', '1.0.0'), 1);
  assert.equal(compareSemver('1.0.0', '1.0.1'), -1);
  assert.equal(compareSemver('2.0.0', '1.99.99'), 1);
  assert.equal(compareSemver('1.14.0', '1.2.0'), 1, 'comparaison numérique (14 > 2)');
});

test('compareSemver — entrées invalides → traitées comme 0.0.0', () => {
  assert.equal(compareSemver('', ''), 0);
  assert.equal(compareSemver('abc', '0.0.0'), 0);
});

test('estAutorise — par défaut faux, explicite ou env=1 → true', () => {
  delete process.env.AIAD_UPDATE_CHECK;
  assert.equal(estAutorise(), false);
  assert.equal(estAutorise({ explicit: true }), true);
  process.env.AIAD_UPDATE_CHECK = '1';
  assert.equal(estAutorise(), true);
  delete process.env.AIAD_UPDATE_CHECK;
});

test('fetchVersionDistante — utilise le fetch injecté', async () => {
  const v = await fetchVersionDistante({
    fetch: async () => ({ ok: true, json: async () => ({ version: '99.0.0' }) }),
  });
  assert.equal(v, '99.0.0');
});

test('checkUpdate — local < distant → update-available avec action npm', async () => {
  const r = await checkUpdate({
    fetch: async () => ({ ok: true, json: async () => ({ version: '99.0.0' }) }),
  });
  assert.equal(r.status, 'update-available');
  assert.match(r.action, /npm install -g aiad-sdd@99\.0\.0/);
});

test('checkUpdate — local == distant → up-to-date', async () => {
  const local = lireVersionLocale();
  const r = await checkUpdate({
    fetch: async () => ({ ok: true, json: async () => ({ version: local }) }),
  });
  assert.equal(r.status, 'up-to-date');
  assert.equal(r.action, null);
});

test('checkUpdate — local > distant → ahead (dev en avance sur npm)', async () => {
  const r = await checkUpdate({
    fetch: async () => ({ ok: true, json: async () => ({ version: '0.0.1' }) }),
  });
  assert.equal(r.status, 'ahead');
  assert.equal(r.action, null);
});

test('checkUpdate — registry KO → status unknown, pas d\'exception', async () => {
  const r = await checkUpdate({
    fetch: async () => { throw new Error('ECONNREFUSED'); },
  });
  assert.equal(r.status, 'unknown');
  assert.match(r.error, /registry inaccessible/);
});

// CLI — la commande explicite est toujours autorisée (taper la commande
// est déjà l'opt-in). L'env AIAD_UPDATE_CHECK est réservé à un hook passif
// futur (vérification implicite au lancement d'autres commandes).

test('CLI `aiad-sdd self-update --json` → JSON valide avec status', () => {
  const r = spawnSync('node', [BIN, 'self-update', '--json'], { encoding: 'utf-8' });
  // status peut être up-to-date / update-available / ahead / unknown selon le registry réel
  assert.equal(r.status, 0, `stderr=${r.stderr}`);
  const data = JSON.parse(r.stdout);
  assert.ok(['up-to-date', 'update-available', 'ahead', 'unknown'].includes(data.status));
  assert.ok(data.locale, 'version locale exposée');
});
