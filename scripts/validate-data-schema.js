/**
 * Validates dashboard/data.json against lib/dashboard/schema/data-v2.schema.json.
 * Inline validation — zero runtime deps (JSON.parse + manual checks).
 * ESM — node scripts/validate-data-schema.js [path/to/data.json]
 *
 * Exit 0 → valid
 * Exit 1 → validation errors
 *
 * @intent INTENT-016
 * @spec SPEC-016-3
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const dataPath = process.argv[2] ?? join(ROOT, 'dashboard', 'data.json');

let data;
try {
  data = JSON.parse(readFileSync(dataPath, 'utf-8'));
} catch (e) {
  process.stderr.write(`[validate-data-schema] Cannot read/parse ${dataPath}: ${e.message}\n`);
  process.exit(1);
}

const errors = [];

// Required top-level keys
for (const key of ['_meta', 'projet', 'intents', 'specs']) {
  if (!(key in data)) errors.push(`Missing required key: "${key}"`);
}

// _meta checks
if (data._meta !== undefined) {
  const m = data._meta;
  if (typeof m.schema !== 'string' || m.schema !== 'aiad-sdd-dashboard') {
    errors.push(`_meta.schema must be "aiad-sdd-dashboard", got: ${JSON.stringify(m.schema)}`);
  }
  if (typeof m.schema_version !== 'string' || !/^\d+\.\d+$/.test(m.schema_version)) {
    errors.push(`_meta.schema_version must match "N.N", got: ${JSON.stringify(m.schema_version)}`);
  }
  if (typeof m.version !== 'string') {
    errors.push(`_meta.version must be a string`);
  }
  if (typeof m.generated !== 'string') {
    errors.push(`_meta.generated must be a string`);
  }
}

// intents must be an array
if ('intents' in data && !Array.isArray(data.intents)) {
  errors.push(`"intents" must be an array`);
}

// specs must be an array
if ('specs' in data && !Array.isArray(data.specs)) {
  errors.push(`"specs" must be an array`);
}

if (errors.length > 0) {
  process.stderr.write(`[validate-data-schema] ${dataPath} is INVALID:\n`);
  for (const e of errors) process.stderr.write(`  - ${e}\n`);
  process.exit(1);
}

process.stdout.write(`[validate-data-schema] ${dataPath} is valid (schema_version: ${data._meta.schema_version})\n`);
process.exit(0);
