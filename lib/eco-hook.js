#!/usr/bin/env node
/**
 * @intent INTENT-030
 * @spec SPEC-030-2-hook-stop
 * @spec SPEC-021-1-attribution-tokens-artefact
 * @governance AIAD-RGESN
 *
 * Hook Stop du harness Claude Code — capture tokens + modèle, estime le CO₂
 * via eco-estimator.js et persiste le résultat dans .aiad/metrics/hook-runs.jsonl.
 * Fail-open : toujours exit 0, erreurs sur stderr uniquement.
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CO2_LABEL = 'estimation indicative (non certifiée)';
export const DEFAULT_METRICS_DIR = join(ROOT, '.aiad', 'metrics');

/**
 * Lit .aiad/metrics/active-artifact.json et renvoie l'objet (ou {} si absent/corrompu).
 * Fail-open : cohérent avec eco-hook.js:79.
 */
function _lireEtatArtefact(metricsDir) {
  try {
    const raw = readFileSync(join(metricsDir, 'active-artifact.json'), 'utf8');
    const data = JSON.parse(raw);
    return typeof data === 'object' && data !== null ? data : {};
  } catch {
    return {};
  }
}

async function readStream(stream) {
  let result = '';
  for await (const chunk of stream) result += chunk;
  return result.trim();
}

export async function buildEntry({ payload = {}, env = process.env, metricsDir = DEFAULT_METRICS_DIR } = {}) {
  const usage = payload.usage ?? {};
  const inputTokens = Number(usage.input_tokens) || 0;
  const outputTokens = Number(usage.output_tokens) || 0;
  const sessionId = payload.session_id ?? '';
  const model = env.CLAUDE_MODEL ?? env.ANTHROPIC_MODEL ?? 'unknown';

  let ecoMetrics = {
    co2g: null,
    energyWh: null,
    totalTokens: inputTokens + outputTokens,
    method: 'unknown',
    co2Label: CO2_LABEL,
  };

  try {
    const { estimerImpact } = await import('./eco-estimator.js');
    const r = estimerImpact({ model, inputTokens, outputTokens });
    ecoMetrics = {
      co2g: r.co2g,
      energyWh: r.energyWh,
      totalTokens: r.totalTokens,
      method: r.method,
      co2Label: r.co2Label,
    };
  } catch (err) {
    process.stderr.write(`[aiad-eco] ${err.message}\n`);
  }

  // Résolution de l'artefact actif (CA-001/CA-002/CA-003) — best-effort, fail-open
  let specId = env.AIAD_CURRENT_SPEC || null;
  let intentId = env.AIAD_CURRENT_INTENT || null;
  if (!specId || !intentId) {
    const etat = _lireEtatArtefact(metricsDir);
    if (!specId) specId = etat.specId || null;
    if (!intentId) intentId = etat.intentId || null;
  }

  const entry = {
    ts: new Date().toISOString(),
    event: 'session-stop',
    sessionId,
    model,
    ecoMetrics,
  };
  if (specId) entry.specId = specId;
  if (intentId) entry.intentId = intentId;
  return entry;
}

export async function persistEntry(entry, metricsDir = DEFAULT_METRICS_DIR) {
  mkdirSync(metricsDir, { recursive: true });
  appendFileSync(join(metricsDir, 'hook-runs.jsonl'), JSON.stringify(entry) + '\n', 'utf8');
}

export async function run({
  stdin = process.stdin,
  metricsDir = DEFAULT_METRICS_DIR,
  env = process.env,
} = {}) {
  let payload = {};
  try {
    const raw = await readStream(stdin);
    if (raw) payload = JSON.parse(raw);
  } catch {
    // Payload non-JSON ou stdin vide — silent, fail-open
  }

  const entry = await buildEntry({ payload, env, metricsDir });

  try {
    await persistEntry(entry, metricsDir);
  } catch (err) {
    process.stderr.write(`[aiad-eco] écriture impossible : ${err.message}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run()
    .catch((err) => {
      process.stderr.write(`[aiad-eco] erreur non fatale : ${err.message}\n`);
    })
    .finally(() => process.exit(0));
}
