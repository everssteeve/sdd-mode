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
  // (#413) spec-version check — besoin d'une SPEC en .aiad/specs/ → fixture tmpdir.
  'spec-version check': null,
  // (#414) spec-version bump --dry-run — besoin d'une SPEC en .aiad/specs/ → fixture.
  'spec-version bump': null,
  // (#415) backup --dry-run — pas d'écriture, exige --password ≥ 8 chars.
  'backup': ['backup', '--password', 'aiad-conformity-test-password', '--dry-run', '--json'],
  // (#416) restore — fixture (créé backup d'abord, puis dry-run restore).
  'restore': null,
  // (#417) webhooks emit — émet événement réel avec --dry-run.
  'webhooks emit': ['webhooks', 'emit', '--type', 'spec.validated', '--dry-run', '--json'],
  // (#419) provenance generate — exige AIAD_PROVENANCE_SECRET + package.json → fixture.
  'provenance generate': null,
  // (#420) provenance verify — exige attestation pré-générée → fixture.
  'provenance verify': null,
  // (#421) cert badge — exige AIAD_CERT_SECRET env + --candidat → fixture.
  'cert badge': null,
  // (#422) cert verify — chain badge→verify dans même tmpdir + secret env.
  'cert verify': null,
  // (#423) refactor-spec — exige SPEC en .aiad/specs/ → fixture tmpdir.
  'refactor-spec': null,
  // (#424) obsidian --dry-run — pas d'écriture, exige .aiad/ → fixture bench.
  'obsidian': ['obsidian', '--dry-run', '--json'],
  // (#425) verify-reproducibility — content hash sha256 (lecture seule).
  'verify-reproducibility': ['verify-reproducibility', '--json'],
  // (#426) storybook — catalog commandes slash (lecture seule).
  'storybook': ['storybook', '--json'],
  // (#427) export openapi --dry-run — exporte OpenAPI depuis SPECs api:true.
  'export openapi': ['export', 'openapi', '--dry-run', '--json'],
  // (#429) export confluence --dry-run — preview publication Confluence.
  'export confluence': ['export', 'confluence', '--dry-run', '--json'],
  // (#430) anonymize — exige fichier records JSON → fixture tmpdir.
  'anonymize': null,
  // (#431) rbac init --dry-run — pas d'écriture (template), retourne path+dryRun.
  'rbac init': ['rbac', 'init', '--dry-run', '--json'],
  // (#432) review — exige git repo + .aiad/ → fixture chain (git init + commit + invoke).
  'review': null,
  // (#433) gitlab review / bitbucket pr / azure pr — fixtures git (3 sous-routes review-poster).
  'gitlab review': null,
  'bitbucket pr': null,
  'azure pr': null,
  // (#434) bench compare — historique vide → suffisant=false safe.
  'bench compare': ['bench', 'compare', '--since', '7', '--threshold', '0.1', '--json'],
  // (#435) ci-template install --dry-run — pose template forge github (pas d'écriture).
  'ci-template': ['ci-template', 'github', '--dry-run', '--json'],
  // (#436) dinum publiccode / franceconnect — DryRunPathResult partagé.
  'dinum publiccode': ['dinum', 'publiccode', '--dry-run', '--json'],
  'dinum franceconnect': ['dinum', 'franceconnect', '--dry-run', '--json'],
  // (#437) archive — exige .aiad/intents/ avec Intent → fixture tmpdir.
  'archive': null,
  // (#439) github-app setup + install (dry-run) — lecture seule + writer.
  'github-app setup': ['github-app', 'setup', '--json'],
  'github-app install': ['github-app', 'install', 'workflow', '--dry-run', '--json'],
  // (#440) archive --restore — exige Intent pré-archivé → fixture chain.
  'archive --restore': null,
  // (#441) marketplace list — catalogue packs (lecture seule, statique).
  'marketplace list': ['marketplace', 'list', '--json'],
  // (#442) marketplace info — détails pack aerospace (catalogue statique).
  'marketplace info': ['marketplace', 'info', 'aerospace', '--json'],
  // (#443) gouvernance --list — catalogue packs gouvernance (statique).
  'gouvernance --list': ['gouvernance', '--list', '--json'],
  // (#444) template --list — catalogue templates SPEC (statique).
  'template --list': ['template', '--list', '--json'],
  // (#445) new --list — catalogue templates projets (statique).
  'new --list': ['new', '--list', '--json'],
  // (#446) hooks-init --dry-run — pas d'écriture, retourne DryRunPathResult.
  'hooks-init': ['hooks-init', '--dry-run', '--json'],
  // (#447) dora --list — liste déploiements (lecture seule .aiad/metrics/deployments/).
  'dora --list': ['dora', '--list', '--json'],
  // (#449) bench history — historique cold-start persisté (lecture seule).
  'bench history': ['bench', 'history', '--json'],
  // (#450) offline log — tentatives HTTP bloquées (lecture seule .aiad/audit/offline-attempts.jsonl).
  'offline log': ['offline', 'log', '--json'],
  // (#451) plugin info — variant not-found (nom inconnu), found=false + available list.
  'plugin info': ['plugin', 'info', 'aiad-conformity-no-such-plugin', '--json'],
  // (#452) emit-rules --check — parité multi-runtime (lecture seule).
  'emit-rules --check': ['emit-rules', '--check', '--json'],
  // (#453) docs --check — drift DOCUMENTATION.md (lecture seule).
  'docs --check': ['docs', '--check', '--json'],
  // (#454) update --check — parité projet vs package (lecture seule).
  'update --check': ['update', '--check', '--json'],
  // (#455) migrate --dry-run — plan migrations sans écriture.
  'migrate': ['migrate', '--dry-run', '--json'],
  // (#456) completion --list — shells supportés (lecture statique).
  'completion --list': ['completion', '--list', '--json'],
  // (#457) provenance sigstore — commandes cosign (lecture statique).
  'provenance sigstore': ['provenance', 'sigstore', '--json'],
  // (#458) gitlab issue --dry-run — preview Issue depuis Intent bench INTENT-101.
  'gitlab issue --dry-run': ['gitlab', 'issue', '--intent', 'INTENT-101', '--dry-run', '--json'],
  // (#459) gitlab wiki --dry-run — preview Wiki depuis Intent bench INTENT-101.
  'gitlab wiki --dry-run': ['gitlab', 'wiki', '--intent', 'INTENT-101', '--dry-run', '--json'],
  // (#460) bitbucket issue --dry-run — miroir GitLab depuis Intent bench INTENT-101.
  'bitbucket issue --dry-run': ['bitbucket', 'issue', '--intent', 'INTENT-101', '--dry-run', '--json'],
  // (#461) azure work-item --dry-run — miroir multi-forge depuis Intent bench INTENT-101.
  'azure work-item --dry-run': ['azure', 'work-item', '--intent', 'INTENT-101', '--dry-run', '--json'],
  // (#462) azure wiki --dry-run — preview Azure Wiki depuis Intent bench INTENT-101.
  'azure wiki --dry-run': ['azure', 'wiki', '--intent', 'INTENT-101', '--dry-run', '--json'],
  // (#463) cert exam — sujet d'examen Praticien (génération statique pure).
  'cert exam': ['cert', 'exam', 'Praticien', '--json'],
  // (#464) cert matrix — matrice 5 niveaux × 6 axes (statique).
  'cert matrix': ['cert', 'matrix', '--json'],
  // (#465) org init --dry-run — preview création .aiad/org.yml (writer en mode preview).
  'org init --dry-run': ['org', 'init', '--dry-run', '--json'],
  // (#466) hooks status — état installation hooks (lecture seule).
  'hooks status': ['hooks', 'status', '--json'],
  // (#467) pii-scan --rules — catalogue règles détection PII (statique).
  'pii-scan --rules': ['pii-scan', '--rules', '--json'],
  // (#468) gouvernance info — détails d'un pack (variant found via fr-anssi).
  'gouvernance info': ['gouvernance', 'info', 'fr-anssi', '--json'],
  // (#469) template info — détails d'un template SPEC (variant found via auth-oidc).
  'template info': ['template', 'info', 'auth-oidc', '--json'],
  // (#470) new info — détails d'un template projet (variant found via fastapi-aiad).
  'new info': ['new', 'info', 'fastapi-aiad', '--json'],
  // (#471) ci-template info — détails d'une forge (variant found via github).
  'ci-template info': ['ci-template', 'info', 'github', '--json'],
  // (#472) tutorial info — détails d'un tutoriel (variant found via auth-oidc).
  'tutorial info': ['tutorial', 'info', 'auth-oidc', '--json'],
  // (#473) github-app info — détails d'un artefact GitHub App (variant found via workflow).
  'github-app info': ['github-app', 'info', 'workflow', '--json'],
  // (#474) webhooks types — catalogue des 10 types d'événements (statique).
  'webhooks types': ['webhooks', 'types', '--json'],
  // (#475) audit types — catalogue des 5 actions audit log (statique).
  'audit types': ['audit', 'types', '--json'],
  // (#476) dora types — catalogue des 3 statuts DORA (statique).
  'dora types': ['dora', 'types', '--json'],
  // (#477) cert axes — catalogue des 6 axes de certification AIAD (statique).
  'cert axes': ['cert', 'axes', '--json'],
  // (#478) score verdicts — catalogue des 4 verdicts scoring (statique).
  'score verdicts': ['score', 'verdicts', '--json'],
  // (#479) archive types — catalogue des 2 types d'artefacts archivables (statique).
  'archive types': ['archive', 'types', '--json'],
  // (#480) cert niveaux — catalogue des 5 niveaux de certification (statique).
  'cert niveaux': ['cert', 'niveaux', '--json'],
  // (#481) dinum criteria — catalogue des 9 critères Commun Numérique FR (statique).
  'dinum criteria': ['dinum', 'criteria', '--json'],
  // (#482) emit-rules runtimes — catalogue des 6 runtimes IA supportés (statique).
  'emit-rules runtimes': ['emit-rules', 'runtimes', '--json'],
  // (#483) sla policy — politique SLA par défaut AIAD (statique).
  'sla policy': ['sla', 'policy', '--json'],
  // (#484) gouvernance lint rules — catalogue des 3 règles de détection (statique).
  'gouvernance lint rules': ['gouvernance', 'lint', 'rules', '--json'],
  // (#485) dora metrics — catalogue des 4 métriques DORA standard (statique).
  'dora metrics': ['dora', 'metrics', '--json'],
  // (#486) bench metrics — catalogue des 6 métriques bench cold-start (statique).
  'bench metrics': ['bench', 'metrics', '--json'],
  // (#487) bench flow — catalogue des 5 Flow Metrics standard (statique).
  'bench flow': ['bench', 'flow', '--json'],
  // (#488) cert valeurs — 🎉 boucle 300 — les 7 valeurs fondamentales AIAD (statique).
  'cert valeurs': ['cert', 'valeurs', '--json'],
  // (#489) import sources — catalogue des 3 sources d'import AIAD (statique).
  'import sources': ['import', 'sources', '--json'],
  // (#490) sovereignty dimensions — catalogue des 5 dimensions Sovereignty Score (statique).
  'sovereignty dimensions': ['sovereignty', 'dimensions', '--json'],
  // (#491) sovereignty niveaux — catalogue des 4 niveaux Sovereignty Bronze→Platinum (statique).
  'sovereignty niveaux': ['sovereignty', 'niveaux', '--json'],
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

// (#433) Cas particulier : gitlab review / bitbucket pr / azure pr partagent
// le composant ReviewCommentPayload. Mêmes fixtures git (init + commit), 3 routes.
function execReviewPoster(routeKey, args) {
  const tmp = mkdtempSync(join(tmpdir(), 'aiad-conformity-reviewp-'));
  try {
    mkdirSync(join(tmp, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(tmp, '.aiad', 'intents', 'INT-001.md'), '---\nid: INT-001\ntitle: T\n---\n# T\n');
    const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 't@t.t',
      GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 't@t.t' };
    spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: tmp });
    spawnSync('git', ['add', '.aiad'], { cwd: tmp });
    spawnSync('git', ['commit', '-q', '-m', 'baseline'], { cwd: tmp, env: gitEnv });
    const schemaKeys = schemaTopKeys(routeKey);
    const payload = execJson(args, tmp);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `${routeKey} émet keys non-doc : ${JSON.stringify(missing)}`);
    const required = schemaRequired(routeKey);
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `${routeKey} : required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested(routeKey, payload), []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
test('#433 conformity — gitlab review : runtime keys ⊆ schema keys (git fixture)', () => {
  execReviewPoster('gitlab review', ['gitlab', 'review', '--mr', '1', '--dry-run', '--json']);
});
test('#433 conformity — bitbucket pr : runtime keys ⊆ schema keys (git fixture)', () => {
  execReviewPoster('bitbucket pr', ['bitbucket', 'pr', '--id', '1', '--dry-run', '--json']);
});
test('#433 conformity — azure pr : runtime keys ⊆ schema keys (git fixture)', () => {
  execReviewPoster('azure pr', ['azure', 'pr', '--id', '1', '--dry-run', '--json']);
});

// (#432) Cas particulier : review exige git repo + .aiad/ → fixture chain
// (git init + commit baseline + invoke review HEAD).
test('#432 conformity — review : runtime keys ⊆ schema keys (git fixture)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aiad-conformity-review-'));
  try {
    mkdirSync(join(tmp, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(tmp, '.aiad', 'intents', 'INT-001.md'), '---\nid: INT-001\ntitle: Test\n---\n\n# Test\n');
    const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 't@t.t',
      GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 't@t.t' };
    spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: tmp });
    spawnSync('git', ['add', '.aiad'], { cwd: tmp });
    spawnSync('git', ['commit', '-q', '-m', 'baseline'], { cwd: tmp, env: gitEnv });
    const schemaKeys = schemaTopKeys('review');
    const payload = execJson(['review', 'main', '--json'], tmp);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `review émet keys non-doc : ${JSON.stringify(missing)}`);
    const required = schemaRequired('review');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `review : required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested('review', payload), []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// (#440) Cas particulier : archive --restore exige artefact archivé → fixture chain.
test('#440 conformity — archive --restore : runtime keys ⊆ schema keys (chain archive→restore)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aiad-conformity-restore-arch-'));
  try {
    mkdirSync(join(tmp, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(tmp, '.aiad', 'intents', 'INT-001-test.md'), '---\nid: INT-001\ntitle: Test\n---\n\n# Test\n');
    execJson(['archive', 'INT-001', '--json'], tmp); // archive d'abord
    const schemaKeys = schemaTopKeys('archive --restore');
    const payload = execJson(['archive', '--restore', 'INT-001', '--dry-run', '--json'], tmp);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `archive --restore émet keys non-doc : ${JSON.stringify(missing)}`);
    const required = schemaRequired('archive --restore');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `archive --restore : required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested('archive --restore', payload), []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// (#437) Cas particulier : archive exige .aiad/intents/INT-XXX.md → fixture tmpdir.
test('#437 conformity — archive : runtime keys ⊆ schema keys (tmpdir + Intent)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aiad-conformity-archive-'));
  try {
    mkdirSync(join(tmp, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(tmp, '.aiad', 'intents', 'INT-001-test.md'), '---\nid: INT-001\ntitle: Test\n---\n\n# Test\n');
    const schemaKeys = schemaTopKeys('archive');
    const payload = execJson(['archive', 'INT-001', '--dry-run', '--json'], tmp);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `archive émet keys non-doc : ${JSON.stringify(missing)}`);
    const required = schemaRequired('archive');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `archive : required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested('archive', payload), []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// (#430) Cas particulier : anonymize exige fichier records JSON en --input → fixture.
test('#430 conformity — anonymize : runtime keys ⊆ schema keys (tmpdir + records.json)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aiad-conformity-anon-'));
  try {
    writeFileSync(join(tmp, 'records.json'), JSON.stringify([{ name: 'Alice', email: 'a@b.com', age: 30 }]) + '\n');
    const schemaKeys = schemaTopKeys('anonymize');
    const payload = execJson(['anonymize', '--input', 'records.json', '--json'], tmp);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `anonymize émet keys non-doc : ${JSON.stringify(missing)}`);
    const required = schemaRequired('anonymize');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `anonymize : required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested('anonymize', payload), []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// (#423) Cas particulier : refactor-spec exige .aiad/specs/SPEC-*.md → tmpdir fixture.
test('#423 conformity — refactor-spec : runtime keys ⊆ schema keys (tmpdir + SPEC)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aiad-conformity-refspec-'));
  try {
    mkdirSync(join(tmp, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(tmp, '.aiad', 'specs', 'SPEC-001-1-foo.md'),
      `---\nid: SPEC-001-1-foo\ntitle: Foo\nversion: 1.0.0\nstatus: draft\nparent_intent: INTENT-001\n---\n\n# Foo\n## Critères\n- AC-1\n`);
    const schemaKeys = schemaTopKeys('refactor-spec');
    const payload = execJson(['refactor-spec', 'SPEC-001-1-foo', '--dry-run', '--json'], tmp);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `refactor-spec émet keys non-doc : ${JSON.stringify(missing)}`);
    const required = schemaRequired('refactor-spec');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `refactor-spec : required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested('refactor-spec', payload), []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// (#422) Cas particulier : cert verify exige JWS pré-émis + AIAD_CERT_SECRET env.
// Chain badge→verify avec même secret.
test('#422 conformity — cert verify : runtime keys ⊆ schema keys (chain badge→verify)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aiad-conformity-certverify-'));
  try {
    const env = { AIAD_CERT_SECRET: 'this-is-cert-secret-32chars-min' };
    const badge = execJson(['cert', 'badge', '--niveau', 'Découvreur', '--candidat', 'Conformity', '--json'], tmp, env);
    const schemaKeys = schemaTopKeys('cert verify');
    const payload = execJson(['cert', 'verify', badge.jws, '--json'], tmp, env);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `cert verify émet keys non-doc : ${JSON.stringify(missing)}`);
    const required = schemaRequired('cert verify');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `cert verify : required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested('cert verify', payload), []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// (#421) Cas particulier : cert badge exige AIAD_CERT_SECRET env + --candidat.
// Pas de fixture FS (badge calcule depuis args + env, n'écrit pas).
test('#421 conformity — cert badge : runtime keys ⊆ schema keys (env override)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aiad-conformity-cert-'));
  try {
    const schemaKeys = schemaTopKeys('cert badge');
    const payload = execJson(
      ['cert', 'badge', '--niveau', 'Découvreur', '--candidat', 'Conformity Test', '--json'],
      tmp,
      { AIAD_CERT_SECRET: 'this-is-cert-secret-32chars-min' }
    );
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `cert badge émet keys non-doc : ${JSON.stringify(missing)}`);
    const required = schemaRequired('cert badge');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `cert badge : required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested('cert badge', payload), []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// (#420) Cas particulier : provenance verify exige attestation pré-générée.
// Fixture chain : generate puis verify dans le même tmpdir avec même secret.
test('#420 conformity — provenance verify : runtime keys ⊆ schema keys (chain generate→verify)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aiad-conformity-provverify-'));
  try {
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'test-pkg', version: '0.1.0' }) + '\n');
    const env = { AIAD_PROVENANCE_SECRET: 'this-is-a-test-secret-16chars' };
    execJson(['provenance', 'generate', '--json'], tmp, env); // génère attestation
    const schemaKeys = schemaTopKeys('provenance verify');
    const payload = execJson(['provenance', 'verify', '--json'], tmp, env);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `provenance verify émet keys non-doc : ${JSON.stringify(missing)}`);
    const required = schemaRequired('provenance verify');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `provenance verify : required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested('provenance verify', payload), []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// (#419) Cas particulier : provenance generate exige AIAD_PROVENANCE_SECRET env
// + package.json à la racine. Fixture tmpdir + env override + --dry-run.
test('#419 conformity — provenance generate : runtime keys ⊆ schema keys (tmpdir + env + pkg.json)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aiad-conformity-prov-'));
  try {
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'test-pkg', version: '0.1.0' }) + '\n');
    const schemaKeys = schemaTopKeys('provenance generate');
    const payload = execJson(
      ['provenance', 'generate', '--dry-run', '--json'],
      tmp,
      { AIAD_PROVENANCE_SECRET: 'this-is-a-test-secret-16chars' }
    );
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `provenance generate émet keys non-doc : ${JSON.stringify(missing)}`);
    const required = schemaRequired('provenance generate');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `provenance generate : required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested('provenance generate', payload), []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// (#416) Cas particulier : restore exige une archive .aiad-backup pré-créée.
// Fixture : créer backup réel puis dry-run restore depuis tmpdir vide.
test('#416 conformity — restore : runtime keys ⊆ schema keys (backup réel + dry-run restore)', () => {
  const src = mkdtempSync(join(tmpdir(), 'aiad-conformity-restore-src-'));
  const dst = mkdtempSync(join(tmpdir(), 'aiad-conformity-restore-dst-'));
  try {
    // Setup : copie .aiad du bench dans le source dir + créé backup réel.
    cpSync(join(BENCH, '.aiad'), join(src, '.aiad'), { recursive: true });
    const backupRes = execJson(['backup', '--password', 'aiad-conformity-test-password', '--json'], src);
    // backup retourne path relatif (e.g. "aiad-backup-2026-...aiad-backup")
    const archivePath = join(src, backupRes.path);
    cpSync(archivePath, join(dst, 'archive.aiad-backup'));
    // Restore dry-run dans dst (vide).
    const schemaKeys = schemaTopKeys('restore');
    const payload = execJson(['restore', '--archive', 'archive.aiad-backup', '--password', 'aiad-conformity-test-password', '--dry-run', '--json'], dst);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `restore émet keys non-doc : ${JSON.stringify(missing)}`);
    const required = schemaRequired('restore');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `restore : required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested('restore', payload), []);
  } finally {
    rmSync(src, { recursive: true, force: true });
    rmSync(dst, { recursive: true, force: true });
  }
});

// (#414) Cas particulier : spec-version bump exige .aiad/specs/SPEC-*.md
// → tmpdir + SPEC frontmatter + invoke en --dry-run (pas de réécriture).
test('#414 conformity — spec-version bump : runtime keys ⊆ schema keys (tmpdir + SPEC)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aiad-conformity-specbump-'));
  try {
    mkdirSync(join(tmp, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(tmp, '.aiad', 'specs', 'SPEC-001-1-foo.md'),
      `---\nid: SPEC-001-1-foo\ntitle: Foo\nversion: 1.0.0\nstatus: draft\nparent_intent: INTENT-001\n---\n\n# Foo\n`);
    const schemaKeys = schemaTopKeys('spec-version bump');
    const payload = execJson(['spec-version', 'bump', 'SPEC-001-1-foo', 'patch', '--dry-run', '--json'], tmp);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `spec-version bump émet keys non-doc : ${JSON.stringify(missing)}`);
    const required = schemaRequired('spec-version bump');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `spec-version bump : required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested('spec-version bump', payload), []);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// (#413) Cas particulier : spec-version check exige .aiad/specs/SPEC-*.md
// → tmpdir + SPEC frontmatter + invoke en `neuf` (sans git history).
test('#413 conformity — spec-version check : runtime keys ⊆ schema keys (tmpdir + SPEC)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aiad-conformity-specver-'));
  try {
    mkdirSync(join(tmp, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(tmp, '.aiad', 'specs', 'SPEC-001-1-foo.md'),
      `---\nid: SPEC-001-1-foo\ntitle: Foo\nversion: 1.0.0\nstatus: draft\nparent_intent: INTENT-001\n---\n\n# Foo\n`);
    const schemaKeys = schemaTopKeys('spec-version check');
    const payload = execJson(['spec-version', 'check', 'SPEC-001-1-foo', '--json'], tmp);
    const runtimeKeys = topLevelKeys(payload);
    const missing = runtimeKeys.filter((k) => !schemaKeys.includes(k));
    assert.deepEqual(missing, [], `spec-version check émet keys non-doc : ${JSON.stringify(missing)}`);
    const required = schemaRequired('spec-version check');
    const reqAbsents = required.filter((k) => !runtimeKeys.includes(k));
    assert.deepEqual(reqAbsents, [], `spec-version check : required absents : ${JSON.stringify(reqAbsents)}`);
    assert.deepEqual(checkNested('spec-version check', payload), []);
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
