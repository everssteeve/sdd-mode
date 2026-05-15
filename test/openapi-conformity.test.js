// (#373) Test générique : pour chaque "safe route" du CATALOGUE, invoque
// la commande --json et assert que les top-level keys runtime sont **un
// sous-ensemble** des keys déclarées dans le schema OpenAPI.
//
// **Pattern** : `missing = real - schema` doit être vide. (`extra = schema -
// real` est acceptable — optional fields documentés non-instanciés.)
//
// **Safe routes** : commandes qui peuvent être invoquées en CI sans effet
// de bord (pas de --record, pas de écriture .aiad/, lecture seule sur le
// repo cwd). Le test utilise `cwd: bench/scenario-autonomous-run/url-shortener`
// pour avoir un projet AIAD complet à introspecter.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { CATALOGUE, COMPONENT_SCHEMAS } from '../lib/cli-schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, '..', 'bin', 'aiad-sdd.js');
const BENCH = join(__dirname, '..', 'bench', 'scenario-autonomous-run', 'url-shortener');

/**
 * Mappe une CATALOGUE key vers ses arguments CLI à invoquer.
 * `null` signale une route non-testable (ex. dora --record qui crée des fichiers).
 */
const SAFE_INVOCATIONS = {
  'status': ['status', '--json'],
  'doctor': ['doctor', '--json'],
  // (#375) trace --json sort la matrice sur stdout (le fichier
  // .aiad/metrics/traceability/trace.json est aussi écrit, side-effect
  // tolérable car bench le contient déjà).
  'trace': ['trace', '--json'], // $ref → TraceabilityMatrix
  // (#383) sbom — 100ms environ, acceptable en CI.
  'sbom': ['sbom', '--json'],
  'dpia': ['dpia', '--json'],
  'sovereignty': ['sovereignty', '--json'], // $ref → SovereigntyScore (#374)
  'adrs': ['adrs', '--json'],
  'sla': ['sla', '--json'], // $ref → SlaMatrix (#374)
  'hook-stats': ['hook-stats', '--json'], // $ref → HookStats (#374)
  'reflect': ['reflect', '--json', '--since', '2030-01-01'], // future date → early-return
  'webhooks list': ['webhooks', 'list', '--json'],
  'offline status': null, // dépend d'env var AIAD_OFFLINE
  'brief': ['brief', '--json'],
  'workspace doctor': null, // exige aiad-workspace.json
  'dora record': null, // crée fichier deploy
  'dora import-git': null, // dépend de git tags
  'standup': ['standup', '--json'],
  'standup all': ['standup', '--json', '--all'],
  'ci-template list': ['ci-template', '--list', '--json'],
  'dashboard check': ['dashboard', '--check', '--json'],
  // (#375) audit verify / archive --list — lecture seule, pas de side-effect.
  'audit verify': ['audit', 'verify', '--json'],
  'archive --list': ['archive', '--list', '--json'],
  // (#382) audit log + pii-scan — lecture seule, sortie courte.
  'audit log': ['audit', 'log', '--json'],
  'pii-scan': ['pii-scan', '--json'],
  // (#385) bench — métriques de taille routers, lecture seule.
  'bench': ['bench', '--json'],
  // (#390) gouvernance lint — lecture seule.
  'gouvernance lint': ['gouvernance', 'lint', '--json'],
  // (#391) telemetry status — opt-in tracking config.
  'telemetry status': ['telemetry', 'status', '--json'],
  // (#392) self-update — registry vs locale comparison.
  'self-update': ['self-update', '--json'],
  // (#393) dinum check — score Commun Numérique de l'État FR.
  'dinum check': ['dinum', 'check', '--json'],
  // (#394) migrate-v2 — dry-run squelette migration AIAD v1 → v2.
  'migrate-v2': ['migrate-v2', '--json'],
  // (#395) ai-act audit — Annexe IV EU AI Act pré-remplissage.
  'ai-act audit': ['ai-act', 'audit', '--json'],
  // (#396) rbac whoami — identité git + équipes RBAC.
  'rbac whoami': ['rbac', 'whoami', '--json'],
  // (#397) plugin list — plugins AIAD installés.
  'plugin list': ['plugin', 'list', '--json'],
  // (#399) rbac check — validation pre-commit RBAC.
  'rbac check': ['rbac', 'check', '--json'],
  // (#400) skills validate — .claude/skills/ frontmatter + body sanity.
  'skills validate': ['skills', 'validate', '--json'],
  // (#401) org show — config org-wide effective.
  'org show': ['org', 'show', '--json'],
  // (#402) org check — conformité projet vs policies org-wide.
  'org check': ['org', 'check', '--json'],
  // (#403) doctor --fix — application automatique de fixes sains.
  'doctor --fix': ['doctor', '--fix', '--json'],
  // (#404) schema — méta-route OpenAPI generator self-describe.
  'schema': ['schema', '--dry-run', '--json'],
  // (#405) tour — créé .aiad-tour/ → fixture tmpdir séparée.
  'tour': null,
  // (#406) webhooks test — émet événement test avec --dry-run.
  'webhooks test': ['webhooks', 'test', '--dry-run', '--json'],
  // (#407) audit append — écrit dans .aiad/audit/audit.jsonl → fixture tmpdir.
  'audit append': null,
  // (#409) sla check — vérifie cohérence SLA matrix (lecture seule).
  'sla check': ['sla', 'check', '--json'],
  // (#410) sla update --dry-run — pas d'écriture, retourne action/path/versions/dryRun.
  'sla update': ['sla', 'update', '--dry-run', '--json'],
  // (#411) badge --dry-run — pas d'écriture SVG, path=null.
  'badge': ['badge', '--dry-run', '--json'],
  // (#412) tutorial — liste des 4 tutoriels spécialisés.
  'tutorial': ['tutorial', '--json'],
};

function execJson(args, cwd, env) {
  // Accepte exit 0 (OK), 1 (fail métier, doctor en CI), 2 (JNSP) — tous
  // produisent un JSON valide sur stdout. Échec hard si stdout n'est pas
  // parsable (e.g. crash réel). `env` permet d'override AIAD_OFFLINE etc.
  const spawnEnv = env ? { ...process.env, ...env } : undefined;
  const r = spawnSync('node', [BIN, ...args], { cwd, encoding: 'utf-8', env: spawnEnv });
  try {
    return JSON.parse(r.stdout);
  } catch {
    throw new Error(`exit ${r.status} — stdout pas JSON parsable. stderr=${r.stderr.slice(0, 200)}`);
  }
}

/**
 * Extrait les top-level keys d'un payload (hors _meta qui est documenté
 * séparément par AiadMeta).
 */
function topLevelKeys(payload) {
  return Object.keys(payload).filter((k) => k !== '_meta').sort();
}

/**
 * Top-level properties documentées dans le schema d'une route. Si le schema
 * pointe via `$ref`, on résout depuis COMPONENT_SCHEMAS (#374). Retourne
 * null seulement si la ref est inconnue (mauvais component).
 */
function schemaTopKeys(routeKey) {
  return Object.keys(resolveSchema(routeKey).properties || {}).sort();
}

/**
 * (#377) Champs `required` documentés dans le schema d'une route.
 */
function schemaRequired(routeKey) {
  return resolveSchema(routeKey).required || [];
}

function resolveSchema(routeKey) {
  let schema = CATALOGUE[routeKey].schema;
  if (schema.$ref) {
    const name = schema.$ref.replace('#/components/schemas/', '');
    schema = COMPONENT_SCHEMAS[name] || {};
  }
  return schema;
}

/**
 * (#387) Enum des schemas autorisés (`_meta.schema`).
 */
const AIAD_META_SCHEMA_ENUM = COMPONENT_SCHEMAS.AiadMeta.properties.schema.enum;

/**
 * (#387) Si le payload contient un bloc `_meta`, sa valeur `schema` doit être
 * dans l'enum AiadMeta. Retourne un string d'erreur ou null si OK.
 */
function checkMetaSchema(payload) {
  if (!payload || !payload._meta) return null;
  const value = payload._meta.schema;
  if (!value) return '_meta.schema absent';
  if (!AIAD_META_SCHEMA_ENUM.includes(value)) {
    return `_meta.schema="${value}" hors enum AiadMeta (${JSON.stringify(AIAD_META_SCHEMA_ENUM)})`;
  }
  return null;
}

/**
 * (#384) Check nested depth 1 : pour chaque top-level property qui est un
 * object (avec properties) ET que le runtime émet comme object, vérifie
 * runtime sub-keys ⊆ schema sub-keys.
 *
 * Retourne un array de strings "path.key : missing=[...]" (vide si tout OK).
 */
function checkNested(routeKey, payload) {
  const schema = resolveSchema(routeKey);
  const violations = [];
  for (const [key, propSchema] of Object.entries(schema.properties || {})) {
    if (propSchema.$ref || propSchema.type !== 'object' || !propSchema.properties) continue;
    const runtimeVal = payload[key];
    if (runtimeVal == null || typeof runtimeVal !== 'object' || Array.isArray(runtimeVal)) continue;
    const subSchemaKeys = Object.keys(propSchema.properties);
    const subRuntimeKeys = Object.keys(runtimeVal);
    const missing = subRuntimeKeys.filter((k) => !subSchemaKeys.includes(k));
    if (missing.length > 0) {
      violations.push(`${key} : missing=${JSON.stringify(missing)} (schema sub-keys: ${JSON.stringify(subSchemaKeys)})`);
    }
  }
  return violations;
}

for (const [routeKey, args] of Object.entries(SAFE_INVOCATIONS)) {
  if (args === null) continue; // route non-testable

  test(`#373 conformity — ${routeKey} : runtime keys ⊆ schema keys`, () => {
    const schemaKeys = schemaTopKeys(routeKey);
    const payload = execJson(args, BENCH);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `${routeKey} émet des keys non-documentées : ${JSON.stringify(missing)}. Schema keys : ${JSON.stringify(schemaKeys)}`);
    // (#377) Vérifie que tous les champs `required` du schema sont
    // effectivement présents dans le payload runtime.
    const required = schemaRequired(routeKey);
    const requiredManquants = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(requiredManquants, [], `${routeKey} : champs required absents en runtime : ${JSON.stringify(requiredManquants)}. Tous les required : ${JSON.stringify(required)}`);
    // (#384) Check nested depth 1.
    const nestedViolations = checkNested(routeKey, payload);
    assert.deepEqual(nestedViolations, [], `${routeKey} : nested drift depth 1 : ${nestedViolations.join(' ; ')}`);
    // (#387) Si payload contient `_meta`, schema doit être dans l'enum.
    const metaErr = checkMetaSchema(payload);
    assert.equal(metaErr, null, `${routeKey} : ${metaErr}`);
  });
}

// (#381) Cas particulier : offline status dépend de AIAD_OFFLINE env.
test('#381 conformity — offline status : runtime keys ⊆ schema keys (AIAD_OFFLINE=1)', () => {
  const schemaKeys = schemaTopKeys('offline status');
  const payload = execJson(['offline', 'status', '--json'], BENCH, { AIAD_OFFLINE: '1' });
  const runtimeKeys = topLevelKeys(payload);
  const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
  assert.deepEqual(missing, [], `offline status émet keys non-doc : ${JSON.stringify(missing)}`);
  const required = schemaRequired('offline status');
  const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
  assert.deepEqual(reqAbsents, [], `offline status : required absents : ${JSON.stringify(reqAbsents)}`);
  assert.deepEqual(checkNested('offline status', payload), []);
});

// (#389) workspace trace : même fixture que workspace doctor.
test('#389 conformity — workspace trace : runtime keys ⊆ schema keys (avec fixture)', () => {
  const ws = mkdtempSync(join(tmpdir(), 'aiad-conformity-wstrace-'));
  try {
    const projDir = join(ws, 'proj');
    mkdirSync(projDir, { recursive: true });
    cpSync(join(BENCH, '.aiad'), join(projDir, '.aiad'), { recursive: true });
    writeFileSync(join(ws, 'aiad-workspace.json'), JSON.stringify({
      name: 'test', projects: [{ name: 'proj', path: './proj' }],
    }));
    const schemaKeys = schemaTopKeys('workspace trace');
    const payload = execJson(['workspace', 'trace', '--json'], ws);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `workspace trace : ${JSON.stringify(missing)}`);
    const required = schemaRequired('workspace trace');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `workspace trace required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested('workspace trace', payload), []);
  } finally { rmSync(ws, { recursive: true, force: true }); }
});

// (#386) workspace analytics : même fixture que workspace doctor.
test('#386 conformity — workspace analytics : runtime keys ⊆ schema keys (avec fixture)', () => {
  const ws = mkdtempSync(join(tmpdir(), 'aiad-conformity-an-'));
  try {
    const projDir = join(ws, 'proj');
    mkdirSync(projDir, { recursive: true });
    cpSync(join(BENCH, '.aiad'), join(projDir, '.aiad'), { recursive: true });
    writeFileSync(join(ws, 'aiad-workspace.json'), JSON.stringify({
      name: 'test', projects: [{ name: 'proj', path: './proj' }],
    }));
    const schemaKeys = schemaTopKeys('workspace analytics');
    const payload = execJson(['workspace', 'analytics', '--json'], ws);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `workspace analytics : ${JSON.stringify(missing)}`);
    const required = schemaRequired('workspace analytics');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `workspace analytics required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested('workspace analytics', payload), []);
  } finally { rmSync(ws, { recursive: true, force: true }); }
});

// (#380) Cas particulier : dora import-git lit les tags git pour créer
// des deploys → tmpdir + git init + 1 tag.
test('#380 conformity — dora import-git : runtime keys ⊆ schema keys (tmpdir + git tag)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aiad-conformity-doragit-'));
  try {
    mkdirSync(join(tmp, '.aiad', 'metrics', 'deployments'), { recursive: true });
    writeFileSync(join(tmp, 'a.txt'), 'x');
    // git init + 1 commit + 1 tag
    const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x' };
    spawnSync('git', ['init', '-q'], { cwd: tmp });
    spawnSync('git', ['add', 'a.txt'], { cwd: tmp });
    spawnSync('git', ['commit', '-q', '-m', 'init'], { cwd: tmp, env: gitEnv });
    spawnSync('git', ['tag', 'v1.0.0'], { cwd: tmp });
    const schemaKeys = schemaTopKeys('dora import-git');
    const payload = execJson(['dora', '--import-git', '--json'], tmp);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `dora import-git émet keys non-doc : ${JSON.stringify(missing)}`);
    const required = schemaRequired('dora import-git');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `dora import-git : required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested('dora import-git', payload), []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// (#407) Cas particulier : audit append écrit dans .aiad/audit/audit.jsonl
// → tmpdir fixture pour ne pas polluer l'audit log du bench.
test('#407 conformity — audit append : runtime keys ⊆ schema keys (tmpdir fixture)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aiad-conformity-audit-'));
  try {
    mkdirSync(join(tmp, '.aiad', 'audit'), { recursive: true });
    const schemaKeys = schemaTopKeys('audit append');
    const payload = execJson(['audit', 'append', 'created', 'INTENT-001.md', '--json'], tmp);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `audit append émet keys non-doc : ${JSON.stringify(missing)}`);
    const required = schemaRequired('audit append');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `audit append : required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested('audit append', payload), []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// (#405) Cas particulier : tour crée .aiad-tour/ → tmpdir fixture.
test('#405 conformity — tour : runtime keys ⊆ schema keys (avec fixture .aiad-tour/)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aiad-conformity-tour-'));
  try {
    const schemaKeys = schemaTopKeys('tour');
    const payload = execJson(['tour', '--non-interactive', '--json'], tmp);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `tour émet keys non-doc : ${JSON.stringify(missing)}`);
    const required = schemaRequired('tour');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `tour : required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested('tour', payload), []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// (#379) Cas particulier : dora record crée un fichier deploy → tmpdir
// fixture pour ne pas polluer .aiad/metrics/deployments/ du bench.
test('#379 conformity — dora record : runtime keys ⊆ schema keys (avec fixture)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aiad-conformity-dora-'));
  try {
    mkdirSync(join(tmp, '.aiad', 'metrics', 'deployments'), { recursive: true });
    const schemaKeys = schemaTopKeys('dora record');
    const payload = execJson(['dora', '--record', '--status=success', '--release=conformity-test', '--json'], tmp);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `dora record émet keys non-doc : ${JSON.stringify(missing)}`);
    const required = schemaRequired('dora record');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `dora record : required absents : ${JSON.stringify(reqAbsents)}`);
    // (#384) nested depth 1
    assert.deepEqual(checkNested('dora record', payload), []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// (#376) Cas particulier : workspace doctor a besoin d'un workspace fixture.
// On crée un tmpdir avec aiad-workspace.json + 1 projet (copie du bench .aiad),
// invoque la commande depuis le tmpdir, puis cleanup.
test('#376 conformity — workspace doctor : runtime keys ⊆ schema keys (avec fixture)', () => {
  const ws = mkdtempSync(join(tmpdir(), 'aiad-conformity-ws-'));
  try {
    const projDir = join(ws, 'proj');
    mkdirSync(projDir, { recursive: true });
    cpSync(join(BENCH, '.aiad'), join(projDir, '.aiad'), { recursive: true });
    writeFileSync(join(ws, 'aiad-workspace.json'), JSON.stringify({
      name: 'conformity-test',
      projects: [{ name: 'proj', path: './proj' }],
    }));
    const schemaKeys = schemaTopKeys('workspace doctor');
    const payload = execJson(['workspace', 'doctor', '--json'], ws);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `workspace doctor émet des keys non-documentées : ${JSON.stringify(missing)}. Schema : ${JSON.stringify(schemaKeys)}`);
    // (#377) required check
    const required = schemaRequired('workspace doctor');
    const requiredManquants = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(requiredManquants, [], `workspace doctor : required absents : ${JSON.stringify(requiredManquants)}`);
    assert.deepEqual(checkNested('workspace doctor', payload), []);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
});
