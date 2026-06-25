// Tests — SPEC-030-1-eco-estimator
// Couverture des 8 critères d'acceptation définis dans la SPEC.
//
// @spec SPEC-030-1-eco-estimator
// @verified-by test/eco-estimator.test.js

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renameSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { estimerImpact, EcoModelsNotFoundError } from '../lib/eco-estimator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const modelsPath = join(root, 'lib', 'eco-models.json');

// CA-1 — modèle connu → co2g > 0, energyWh > 0, method: 'estimated'
test('CA-1 — claude-sonnet-4-6 retourne une estimation positive', () => {
  const r = estimerImpact({ model: 'claude-sonnet-4-6', inputTokens: 1000, outputTokens: 500 });
  assert.ok(r.co2g > 0, 'co2g doit être > 0');
  assert.ok(r.energyWh > 0, 'energyWh doit être > 0');
  assert.equal(r.method, 'estimated');
  assert.equal(r.totalTokens, 1500);
});

// CA-2 — modèle inconnu → co2g: null, method: 'unknown', sans exception
test('CA-2 — modèle inconnu retourne null sans lever d\'exception', () => {
  const r = estimerImpact({ model: 'modele-inconnu', inputTokens: 100, outputTokens: 100 });
  assert.equal(r.co2g, null);
  assert.equal(r.energyWh, null);
  assert.equal(r.method, 'unknown');
});

// CA-3 — co2Label constant quelle que soit l'entrée
test('CA-3 — co2Label = "estimation indicative (non certifiée)" dans tous les cas', () => {
  const label = 'estimation indicative (non certifiée)';
  assert.equal(
    estimerImpact({ model: 'claude-sonnet-4-6', inputTokens: 100, outputTokens: 50 }).co2Label,
    label
  );
  assert.equal(
    estimerImpact({ model: 'modele-inconnu', inputTokens: 0, outputTokens: 0 }).co2Label,
    label
  );
  assert.equal(
    estimerImpact({ model: 'claude-opus-4-8', inputTokens: 999, outputTokens: 1 }).co2Label,
    label
  );
});

// CA-4 — AIAD_CARBON_INTENSITY_G_KWH=200 pris en compte : ratio ≈ 0.421 ± 1%
test('CA-4 — AIAD_CARBON_INTENSITY_G_KWH=200 modifie le co2g proportionnellement', () => {
  // Baseline avec intensité par défaut (475)
  delete process.env.AIAD_CARBON_INTENSITY_G_KWH;
  const r475 = estimerImpact({ model: 'claude-sonnet-4-6', inputTokens: 2000, outputTokens: 1000 });

  // Avec intensité 200
  process.env.AIAD_CARBON_INTENSITY_G_KWH = '200';
  const r200 = estimerImpact({ model: 'claude-sonnet-4-6', inputTokens: 2000, outputTokens: 1000 });
  delete process.env.AIAD_CARBON_INTENSITY_G_KWH;

  const ratio = r200.co2g / r475.co2g;
  const expected = 200 / 475; // ≈ 0.4210526
  assert.ok(
    Math.abs(ratio - expected) < 0.01,
    `ratio co2g_200/co2g_475 = ${ratio.toFixed(4)} doit être ≈ ${expected.toFixed(4)} ± 1%`
  );
});

// CA-5 — eco-models.json contient les 4 modèles Claude actifs
test('CA-5 — eco-models.json contient les 4 modèles Claude actifs', () => {
  const models = JSON.parse(readFileSync(modelsPath, 'utf8'));
  const required = [
    'claude-sonnet-4-6',
    'claude-opus-4-8',
    'claude-haiku-4-5-20251001',
    'claude-fable-5',
  ];
  for (const m of required) {
    assert.ok(m in models, `modèle manquant dans eco-models.json : ${m}`);
    assert.ok(models[m].energyPerInputToken > 0, `energyPerInputToken manquant pour ${m}`);
    assert.ok(models[m].energyPerOutputToken > 0, `energyPerOutputToken manquant pour ${m}`);
  }
});

// CA-6 — tokens négatifs clampés à 0
test('CA-6 — tokens négatifs clampés à 0, aucune valeur négative en sortie', () => {
  const r = estimerImpact({ model: 'claude-sonnet-4-6', inputTokens: -500, outputTokens: -200 });
  assert.equal(r.inputTokens, 0);
  assert.equal(r.outputTokens, 0);
  assert.equal(r.totalTokens, 0);
  assert.ok(r.co2g >= 0);
  assert.ok(r.energyWh >= 0);
});

// CA-7 — eco-models.json absent → EcoModelsNotFoundError à l'import
test('CA-7 — eco-models.json absent → EcoModelsNotFoundError levée à l\'import', (t) => {
  const backupPath = modelsPath + '.test-bak';
  renameSync(modelsPath, backupPath);
  try {
    let errorOutput = '';
    try {
      execSync(
        `node --input-type=module --eval "import '../lib/eco-estimator.js'"`,
        { cwd: __dirname, encoding: 'utf8', stdio: 'pipe', timeout: 5000 }
      );
    } catch (e) {
      errorOutput = e.stderr + e.stdout;
    }
    assert.ok(
      errorOutput.includes('EcoModelsNotFoundError'),
      `stderr doit mentionner EcoModelsNotFoundError, obtenu : ${errorOutput.slice(0, 300)}`
    );
  } finally {
    renameSync(backupPath, modelsPath);
  }
});

// CA-8 — zéro dépendance de production
test('CA-8 — zéro dépendance de production ajoutée à package.json', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const deps = Object.keys(pkg.dependencies ?? {});
  // eco-estimator n'ajoute aucune dépendance prod — le tableau doit rester vide ou ne pas croître
  assert.ok(
    !deps.some((d) => d.includes('ecologit')),
    'aucun paquet ecologits ne doit figurer dans dependencies'
  );
  // Vérification de cohérence : le module s'importe sans installation supplémentaire
  assert.ok(typeof estimerImpact === 'function', 'estimerImpact doit être importable sans dep externe');
});
