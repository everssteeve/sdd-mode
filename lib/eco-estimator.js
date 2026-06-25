/**
 * @intent INTENT-030
 * @spec SPEC-030-1-eco-estimator
 * @governance AIAD-RGESN
 *
 * Algorithme EcoLogits porté en JS natif — estimation CO₂ des sessions LLM.
 * Source valeurs énergétiques : EcoLogits model database (Apache-2.0).
 * Les valeurs retournées sont des estimations indicatives, non certifiées.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_PATH = join(__dirname, 'eco-models.json');

// gCO₂eq/kWh — moyenne européenne 2024 (source EcoLogits / Electricity Maps)
const CARBON_INTENSITY_DEFAULT = 475;

const CO2_LABEL = 'estimation indicative (non certifiée)';

export class EcoModelsNotFoundError extends Error {
  constructor() {
    super(`eco-models.json introuvable : ${MODELS_PATH}`);
    this.name = 'EcoModelsNotFoundError';
    this.path = MODELS_PATH;
  }
}

// Fail-fast à l'import — pas au call-time
if (!existsSync(MODELS_PATH)) {
  throw new EcoModelsNotFoundError();
}

const models = JSON.parse(readFileSync(MODELS_PATH, 'utf8'));

function getCarbonIntensity() {
  const raw = process.env.AIAD_CARBON_INTENSITY_G_KWH;
  if (!raw) return CARBON_INTENSITY_DEFAULT;
  const val = Number(raw);
  if (!Number.isFinite(val) || val <= 0) {
    process.stderr.write(
      `[aiad-eco] AIAD_CARBON_INTENSITY_G_KWH="${raw}" invalide — valeur par défaut ${CARBON_INTENSITY_DEFAULT} gCO₂eq/kWh utilisée\n`
    );
    return CARBON_INTENSITY_DEFAULT;
  }
  return val;
}

/**
 * Estime l'impact CO₂ d'un appel LLM depuis le nombre de tokens.
 *
 * @spec SPEC-030-1-eco-estimator
 *
 * @param {{ model: string, inputTokens: number, outputTokens: number }} params
 * @returns {{ model, inputTokens, outputTokens, totalTokens, energyWh, co2g,
 *             co2Label, carbonIntensityUsed, method }}
 */
export function estimerImpact({ model, inputTokens, outputTokens }) {
  const safeInput = Math.max(0, Number(inputTokens) || 0);
  const safeOutput = Math.max(0, Number(outputTokens) || 0);
  const carbonIntensityUsed = getCarbonIntensity();

  const modelData = models[model];
  if (!modelData) {
    return {
      model,
      inputTokens: safeInput,
      outputTokens: safeOutput,
      totalTokens: safeInput + safeOutput,
      energyWh: null,
      co2g: null,
      co2Label: CO2_LABEL,
      carbonIntensityUsed,
      method: 'unknown',
    };
  }

  const energyWh =
    safeInput * modelData.energyPerInputToken +
    safeOutput * modelData.energyPerOutputToken;
  const co2g = energyWh * carbonIntensityUsed;

  return {
    model,
    inputTokens: safeInput,
    outputTokens: safeOutput,
    totalTokens: safeInput + safeOutput,
    energyWh,
    co2g,
    co2Label: CO2_LABEL,
    carbonIntensityUsed,
    method: 'estimated',
  };
}
