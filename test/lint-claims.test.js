// Tests `scripts/lint-claims.js` — garde-fou anti-régression des claims (SPEC-014-2).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  mentions50KNonQualifiees,
  claimsNonSources,
} from '../scripts/lint-claims.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', 'scripts', 'lint-claims.js');

// ─── mentions50KNonQualifiees ────────────────────────────────────────────────

test('50K qualifié sur la même ligne → aucune violation', () => {
  const c = 'budget > ≈ 50K (heuristique de sobriété assumée, cf. FACT-001) → découper';
  assert.deepEqual(mentions50KNonQualifiees(c), []);
});

test('50K qualifié sur la ligne suivante (wrap) → aucune violation', () => {
  const c = '- Au-dessus de ≈ 50K tokens projetés → réduire. Le 50K est\n  une heuristique de sobriété assumée : non sourcée.';
  assert.deepEqual(mentions50KNonQualifiees(c), []);
});

test('50K nu → violation localisée', () => {
  const c = 'ligne ok\n   - Vérifier < 50K tokens (seuil context rot)\nfin';
  const v = mentions50KNonQualifiees(c);
  assert.equal(v.length, 1);
  assert.equal(v[0].ligne, 2);
});

test('variante "50 000" nue → violation', () => {
  assert.equal(mentions50KNonQualifiees('plafond de 50 000 tokens').length, 1);
});

test('aucune mention 50K → aucune violation', () => {
  assert.deepEqual(mentions50KNonQualifiees('rien à signaler ici'), []);
});

// ─── claimsNonSources ────────────────────────────────────────────────────────

test('claim 41,7 % avec R2Code → sourcé', () => {
  assert.deepEqual(claimsNonSources('−41,7 % de tokens (R2Code, arXiv avril 2026)'), []);
});

test('claim 41,7 % sans R2Code → non sourcé', () => {
  assert.deepEqual(claimsNonSources('on observe −41,7 % de tokens'), ['−41,7 % (R2Code)']);
});

test('claim 96 % sans Strands → non sourcé', () => {
  assert.deepEqual(claimsNonSources('−96 % de tokens mesurés'), ['−96 % (AWS Strands)']);
});

test('aucun chiffre de claim → rien à signaler', () => {
  assert.deepEqual(claimsNonSources('texte neutre sans chiffre'), []);
});

// ─── Intégration : le repo réel passe le lint ────────────────────────────────

test('lint-claims sur le repo réel → exit 0', () => {
  const r = spawnSync('node', [SCRIPT], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
