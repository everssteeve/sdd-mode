// Tests `lib/sunset.js` — règles à durée de vie limitée (GF5, §4).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  comparerVersions,
  estCandidate,
  scannerSunset,
  // alias EN
  compareVersions,
  scanSunset,
} from '../lib/sunset.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'sunset-')); }

// ─── Comparaison de versions ────────────────────────────────────────────────

test('comparerVersions — sémantique avec/ sans préfixe v', () => {
  assert.equal(comparerVersions('v2.1.0', 'v2.1.168'), -1);
  assert.equal(comparerVersions('2.2.0', '2.1.999'), 1);
  assert.equal(compareVersions('v1.0.0', '1.0.0'), 0);
});

// ─── Candidate ──────────────────────────────────────────────────────────────

test('estCandidate — review_at atteint → candidate', () => {
  const r = estCandidate({ review_at: 'v2.1.0' }, 'v2.1.168');
  assert.equal(r.candidate, true);
  assert.ok(/review_at/.test(r.raison));
});

test('estCandidate — review_at futur → non candidate', () => {
  assert.equal(estCandidate({ review_at: 'v3.0.0' }, 'v2.1.168').candidate, false);
});

test('estCandidate — sunset_when présent → candidate (à réexaminer)', () => {
  assert.equal(estCandidate({ sunset_when: 'le modèle pose les annotations' }, 'v1.0.0').candidate, true);
});

test('estCandidate — aucune métadonnée → non candidate', () => {
  assert.equal(estCandidate({}, 'v9.9.9').candidate, false);
});

// ─── Scan ───────────────────────────────────────────────────────────────────

test('scannerSunset — repère skills/rules avec métadonnée + statut', () => {
  const d = tmp();
  // skill avec review_at atteint
  mkdirSync(join(d, '.claude', 'skills', 'grill-me'), { recursive: true });
  writeFileSync(join(d, '.claude', 'skills', 'grill-me', 'SKILL.md'), '---\nname: grill-me\nreview_at: v2.0.0\nsunset_when: natif\n---\n# x');
  // rule sans métadonnée → ignorée
  mkdirSync(join(d, '.claude', 'rules'), { recursive: true });
  writeFileSync(join(d, '.claude', 'rules', 'rgpd.md'), '---\npaths: ["**/*"]\n---\n# rgpd');
  // skill sans métadonnée → ignorée
  mkdirSync(join(d, '.claude', 'skills', 'autre'), { recursive: true });
  writeFileSync(join(d, '.claude', 'skills', 'autre', 'SKILL.md'), '---\nname: autre\n---\n# y');

  const liste = scanSunset(d, { versionCourante: 'v2.1.168' });
  assert.equal(liste.length, 1);
  assert.equal(liste[0].nom, 'grill-me');
  assert.equal(liste[0].kind, 'skill');
  assert.equal(liste[0].candidate, true);
  rmSync(d, { recursive: true, force: true });
});

test('scannerSunset — projet vide → liste vide', () => {
  assert.deepEqual(scannerSunset('/nope-xyz'), []);
});
