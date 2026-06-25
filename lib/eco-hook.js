#!/usr/bin/env node
/**
 * @intent INTENT-030
 * @spec SPEC-030-2-hook-stop
 * @governance AIAD-RGESN
 *
 * Hook Stop du harness Claude Code — capture tokens + modèle, estime le CO₂
 * via eco-estimator.js et persiste le résultat dans .aiad/metrics/hook-runs.jsonl.
 * Fail-open : toujours exit 0, erreurs sur stderr uniquement.
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CO2_LABEL = 'estimation indicative (non certifiée)';
export const DEFAULT_METRICS_DIR = join(ROOT, '.aiad', 'metrics');

async function readStream(stream) {
  let result = '';
  for await (const chunk of stream) result += chunk;
  return result.trim();
}

export async function buildEntry({ payload = {}, env = process.env } = {}) {
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

  return {
    ts: new Date().toISOString(),
    event: 'session-stop',
    sessionId,
    model,
    ecoMetrics,
  };
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

  const entry = await buildEntry({ payload, env });

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
