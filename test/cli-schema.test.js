// Tests `lib/cli-schema.js` — OpenAPI 3.1 des sorties JSON (item #121).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CATALOGUE, COMPONENT_SCHEMAS,
  construireOpenApi, validerOpenApi, genererSchema, CONSTANTS,
  // alias EN
  buildOpenApi, validateOpenApi, generateSchema,
} from '../lib/cli-schema.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-sch-')); }

// ─── CATALOGUE ────────────────────────────────────────────────────────────

test('CATALOGUE — couvre les commandes principales --json', () => {
  for (const cmd of ['status', 'doctor', 'trace', 'sbom', 'sovereignty', 'sla', 'audit log', 'pii-scan']) {
    assert.ok(CATALOGUE[cmd], `${cmd} absent du catalogue`);
    assert.ok(CATALOGUE[cmd].summary);
    assert.ok(CATALOGUE[cmd].schema);
  }
});

test('CATALOGUE — au moins 12 commandes documentées', () => {
  assert.ok(Object.keys(CATALOGUE).length >= 12);
});

test('COMPONENT_SCHEMAS — schemas réutilisables présents', () => {
  for (const s of ['TraceabilityMatrix', 'SovereigntyScore', 'SlaMatrix', 'AuditEvent', 'ArchivedArtifact', 'HookStats', 'ReflectAxis', 'AiadMeta', 'PublicationContext']) {
    assert.ok(COMPONENT_SCHEMAS[s], `${s} absent`);
  }
});

// (#372) dashboard check route — 3 props validation simple
test('#372 CATALOGUE — dashboard check route présente', async () => {
  const m = await import('../lib/cli-schema.js');
  assert.ok(m.CATALOGUE['dashboard check'], 'dashboard check route absente');
  assert.deepEqual(m.CATALOGUE['dashboard check'].schema.required, ['ok', 'errors', 'pages']);
});

// (#371) workspace doctor summary.totals (cumul cross-projet)
test('#371 CATALOGUE.workspace doctor — summary.totals (intents/specs/gaps) présent', async () => {
  const m = await import('../lib/cli-schema.js');
  const summary = m.CATALOGUE['workspace doctor'].schema.properties.summary;
  assert.ok(summary.properties.totals, 'summary.totals absent');
  for (const k of ['intents', 'specs', 'gaps']) {
    assert.ok(summary.properties.totals.properties[k], `summary.totals.${k} absent`);
  }
});

// (#370) SovereigntyScore 5 dimensions sub-shapes détaillées
test('#370 COMPONENT_SCHEMAS.SovereigntyScore — 5 dimensions ont sub-fields typés', () => {
  const dims = COMPONENT_SCHEMAS.SovereigntyScore.properties.dimensions.properties;
  // juridictions
  for (const k of ['score', 'juridictions', 'packs']) {
    assert.ok(dims.juridictions.properties[k], `juridictions.${k} absent`);
  }
  // agentsTier1
  for (const k of ['score', 'baseline', 'prime', 'agents']) {
    assert.ok(dims.agentsTier1.properties[k], `agentsTier1.${k} absent`);
  }
  // langueFr (7 counts)
  for (const k of ['score', 'ratioFr', 'total', 'fr', 'en', 'mixed', 'neutral']) {
    assert.ok(dims.langueFr.properties[k], `langueFr.${k} absent`);
  }
  // autorites + hebergement
  assert.ok(dims.autorites.properties.autorites);
  assert.ok(dims.hebergement.properties.sources);
});

// (#367) ci-template list route — dernière route enum AiadMeta documentée
test('#367 CATALOGUE — ci-template list route présente avec 6 forges enum', async () => {
  const m = await import('../lib/cli-schema.js');
  assert.ok(m.CATALOGUE['ci-template list'], 'ci-template list route absente');
  const forgeIdEnum = m.CATALOGUE['ci-template list'].schema.properties.forges.items.properties.id.enum;
  assert.deepEqual(forgeIdEnum, ['github', 'gitlab', 'jenkins', 'drone', 'bitbucket', 'azure']);
});

// (#366) standup routes (single + all) ajoutées au CATALOGUE
test('#366 CATALOGUE — standup + standup all routes présentes', async () => {
  const m = await import('../lib/cli-schema.js');
  assert.ok(m.CATALOGUE.standup, 'standup route absente');
  assert.ok(m.CATALOGUE['standup all'], 'standup all route absente');
  // single: 5 props required
  assert.deepEqual(m.CATALOGUE.standup.schema.required, ['lens', 'focus', 'relative', 'absolute', 'exists']);
  // all: liens array
  assert.equal(m.CATALOGUE['standup all'].schema.properties.liens.type, 'array');
});

// (#365) dora routes (record + import-git) ajoutées au CATALOGUE
test('#365 CATALOGUE — dora record + dora import-git routes présentes', async () => {
  const m = await import('../lib/cli-schema.js');
  assert.ok(m.CATALOGUE['dora record'], 'dora record route absente');
  assert.ok(m.CATALOGUE['dora import-git'], 'dora import-git route absente');
  // dora record : 5 props
  for (const k of ['date', 'file', 'nn', 'nom', 'status']) {
    assert.ok(m.CATALOGUE['dora record'].schema.properties[k], `dora record.${k} absent`);
  }
  // dora import-git : imported array
  assert.equal(m.CATALOGUE['dora import-git'].schema.properties.imported.type, 'array');
});

test('#365 construireOpenApi — paths /cli/dora/record + /cli/dora/import-git générés', async () => {
  const m = await import('../lib/cli-schema.js');
  const doc = m.construireOpenApi();
  assert.ok(doc.paths['/cli/dora/record'], '/cli/dora/record absent');
  assert.ok(doc.paths['/cli/dora/import-git'], '/cli/dora/import-git absent');
});

// (#364) doctor route schema complété — racine + santeGlobale + version ajoutés
test('#364 CATALOGUE.doctor — 7 propriétés runtime documentées', async () => {
  const m = await import('../lib/cli-schema.js');
  const schema = m.CATALOGUE.doctor.schema;
  for (const k of ['ok', 'version', 'racine', 'checks', 'leadership', 'santeGlobale', 'publicationContext']) {
    assert.ok(schema.properties[k], `${k} absent du schema doctor`);
  }
  // required élargi
  assert.deepEqual(schema.required, ['ok', 'version', 'racine', 'checks']);
});

// (#363) status route schema corrigé — vraie shape 8 fields runtime
test('#363 CATALOGUE.status — schema reflète vraie shape (8 fields runtime)', async () => {
  const m = await import('../lib/cli-schema.js');
  const schema = m.CATALOGUE.status.schema;
  for (const k of ['initialise', 'projetDir', 'fondamentaux', 'cycle', 'infrastructure', 'maturite', 'santeGlobale', 'publicationContext']) {
    assert.ok(schema.properties[k], `${k} absent du schema status`);
  }
  // Anciens fields (valid, intents, specs, gouvernance) ne doivent plus être au top-level
  assert.ok(!schema.properties.valid, 'valid ne doit plus être au schema');
  // `intents`/`specs` étaient au top-level, sont maintenant sous `cycle`
  assert.ok(!schema.properties.intents, 'intents (top-level) ne doit plus être au schema — utiliser cycle.intents');
  assert.ok(!schema.properties.gouvernance, 'gouvernance (top-level) ne doit plus être au schema — utiliser infrastructure.gouvernanceCount');
});

// (#362) DPIA route schema corrigé — vraie shape `date, project, specs, code, agent, summary`
test('#362 CATALOGUE.dpia — schema reflète vraie shape (date/project/specs/code/agent/summary)', async () => {
  const m = await import('../lib/cli-schema.js');
  const schema = m.CATALOGUE.dpia.schema;
  for (const k of ['date', 'project', 'specs', 'code', 'agent', 'summary']) {
    assert.ok(schema.properties[k], `${k} absent du schema dpia`);
  }
  // Ancien schema avait 'path' et 'sections' — vérifier qu'ils ne sont plus là
  assert.ok(!schema.properties.path, 'path ne doit plus être au schema');
  assert.ok(!schema.properties.sections, 'sections ne doit plus être au schema');
});

// (#361) LeadershipMetrics : 4 sous-objets détaillés
test('#361 COMPONENT_SCHEMAS.LeadershipMetrics — 4 dimensions avec sub-fields détaillés', () => {
  const schema = COMPONENT_SCHEMAS.LeadershipMetrics;
  // humanAuthorshipRatio
  const har = schema.properties.humanAuthorshipRatio;
  for (const k of ['total', 'sufficient', 'ratio', 'seuilCharsMinimum']) {
    assert.ok(har.properties[k], `humanAuthorshipRatio.${k} absent`);
  }
  // governanceCoverage
  const gc = schema.properties.governanceCoverage;
  for (const k of ['sensitiveFiles', 'governedFiles', 'ratio']) {
    assert.ok(gc.properties[k], `governanceCoverage.${k} absent`);
  }
  // langueArtefacts (5 langues)
  const la = schema.properties.langueArtefacts;
  for (const k of ['fr', 'en', 'mixed', 'neutral', 'total']) {
    assert.ok(la.properties[k], `langueArtefacts.${k} absent`);
  }
});

// (#360) SlaMatrix : politique object exposé (4 sub-fields)
test('#360 COMPONENT_SCHEMAS.SlaMatrix — politique object + required = 4 fields', () => {
  const schema = COMPONENT_SCHEMAS.SlaMatrix;
  assert.deepEqual(schema.required, ['generatedAt', 'versionCourante', 'politique', 'versions']);
  assert.ok(schema.properties.politique, 'politique absent');
  assert.equal(schema.properties.politique.type, 'object');
  for (const k of ['currentMajorSupportDays', 'previousMajorOverlapDays', 'deprecationNoticeDays', 'patchWindows']) {
    assert.ok(schema.properties.politique.properties[k], `politique.${k} absent`);
  }
});

// (#359) reflect schema : raison field for early-return path
test('#359 CATALOGUE.reflect — raison field exposé pour early-return path', async () => {
  const m = await import('../lib/cli-schema.js');
  const schema = m.CATALOGUE.reflect.schema;
  assert.ok(schema.properties.raison, 'raison absent du schema reflect');
  assert.equal(schema.properties.raison.type, 'string');
  // raison NE doit PAS être required (présent seulement si axes vide)
  assert.ok(!schema.required.includes('raison'), 'raison ne doit pas être required');
});

// (#358) HookStats : recent array exposé (10 derniers events)
test('#358 COMPONENT_SCHEMAS.HookStats — recent array + stats required', () => {
  const schema = COMPONENT_SCHEMAS.HookStats;
  assert.deepEqual(schema.required, ['stats', 'recent']);
  assert.equal(schema.properties.recent.type, 'array');
  assert.ok(schema.properties.recent.items.properties.ts, 'recent items missing ts');
  assert.ok(schema.properties.recent.items.properties.durationMs, 'recent items missing durationMs');
});

// (#357 + #407) AuditEvent : 7 required fields + sig nullable optional.
// Note (#407) : runtime audit append émet TOUJOURS sig (= null si pas de secret HMAC),
// donc sig est `['string', 'null']`. La règle "sig absent si non signé" est invalide
// — révélée par la boucle conformity sur audit append.
test('#357 COMPONENT_SCHEMAS.AuditEvent — required = 7 fields (cohérence avec construireEvenement)', () => {
  const schema = COMPONENT_SCHEMAS.AuditEvent;
  for (const f of ['ts', 'actor', 'action', 'artifact', 'hashAvant', 'hashApres', 'hashChain']) {
    assert.ok(schema.required.includes(f), `${f} non required`);
  }
  // sig est nullable (null si pas de secret AIAD_AUDIT_SECRET, string sinon) et optionnel
  assert.deepEqual(schema.properties.sig.type, ['string', 'null']);
  assert.ok(!schema.required.includes('sig'), 'sig optionnel dans schema (toléré absent dans des contextes futurs)');
});

// (#356) SovereigntyScore expose levelColor (cyan/jaune/gris/rouge)
test('#356 COMPONENT_SCHEMAS.SovereigntyScore — levelColor exposé avec enum', () => {
  const schema = COMPONENT_SCHEMAS.SovereigntyScore;
  assert.ok(schema.properties.levelColor, 'levelColor absent');
  assert.equal(schema.properties.levelColor.type, 'string');
  assert.deepEqual(schema.properties.levelColor.enum, ['cyan', 'jaune', 'gris', 'rouge']);
});

// (#355) TraceabilityMatrix reflète la vraie shape de aiad-sdd trace
test('#355 COMPONENT_SCHEMAS.TraceabilityMatrix — match shape réelle (summary/forward/backward/gaps)', () => {
  const schema = COMPONENT_SCHEMAS.TraceabilityMatrix;
  // Champs présents (vrai contrat)
  for (const k of ['summary', 'forward', 'backward', 'gaps']) {
    assert.ok(schema.properties[k], `${k} absent`);
  }
  // gaps doit être un object (pas array — bug fix #355)
  assert.equal(schema.properties.gaps.type, 'object');
  // forward + backward arrays
  assert.equal(schema.properties.forward.type, 'array');
  assert.equal(schema.properties.backward.type, 'array');
  // summary contient les KPIs typiques
  assert.equal(schema.properties.summary.properties.intents.type, 'integer');
  assert.equal(schema.properties.summary.properties.codeFiles.type, 'integer');
});

// (#345) brief + workspace doctor routes ajoutées au CATALOGUE
test('#345 CATALOGUE — brief + workspace doctor routes présentes avec PublicationContext', async () => {
  const m = await import('../lib/cli-schema.js');
  assert.ok(m.CATALOGUE.brief, 'brief route absente');
  assert.ok(m.CATALOGUE['workspace doctor'], 'workspace doctor route absente');
  // PublicationContext référencé sur les 2
  assert.equal(m.CATALOGUE.brief.schema.properties.publicationContext.$ref,
    '#/components/schemas/PublicationContext');
  assert.equal(m.CATALOGUE['workspace doctor'].schema.properties.reports.items.properties.publicationContext.$ref,
    '#/components/schemas/PublicationContext');
});

test('#345 construireOpenApi — paths /cli/brief + /cli/workspace/doctor générés', async () => {
  const m = await import('../lib/cli-schema.js');
  const doc = m.construireOpenApi();
  assert.ok(doc.paths['/cli/brief'], '/cli/brief absent');
  assert.ok(doc.paths['/cli/workspace/doctor'], '/cli/workspace/doctor absent');
});

// (#344) PublicationContext wired in status + doctor route schemas
test('#344 construireOpenApi — status + doctor exposent publicationContext via $ref', async () => {
  const m = await import('../lib/cli-schema.js');
  const doc = m.construireOpenApi();
  for (const route of ['/cli/status', '/cli/doctor']) {
    const schema = doc.paths[route]?.get?.responses?.['200']?.content?.['application/json']?.schema;
    const inner = schema.allOf[1]; // [0] = metaWrapper, [1] = command-specific
    const ref = inner.properties?.publicationContext?.$ref;
    assert.equal(ref, '#/components/schemas/PublicationContext', `${route} : $ref manquant ou incorrect`);
  }
});

// (#343) PublicationContext documente le contrat exposé par brief/doctor/status/workspace
test('#343 COMPONENT_SCHEMAS.PublicationContext — sourceBase + publicUrl required', () => {
  const schema = COMPONENT_SCHEMAS.PublicationContext;
  assert.ok(schema, 'PublicationContext absent');
  assert.equal(schema.type, 'object');
  assert.deepEqual(schema.required, ['sourceBase', 'publicUrl']);
  assert.equal(schema.properties.sourceBase.type, 'string');
  assert.equal(schema.properties.publicUrl.type, 'string');
  assert.match(schema.description, /brief.*doctor.*status.*workspace/);
});

// (#274) Chaque route response wrap son schéma avec _meta requis via allOf.
test('construireOpenApi — chaque route response wrap son schéma avec _meta requis', () => {
  const doc = construireOpenApi();
  for (const [path, methods] of Object.entries(doc.paths)) {
    const schema = methods.get?.responses?.['200']?.content?.['application/json']?.schema;
    assert.ok(schema, `${path} : pas de schéma`);
    // allOf wrap : 1ère entrée doit être le metaWrapper avec _meta requis
    assert.ok(Array.isArray(schema.allOf), `${path} : schéma pas wrapped allOf`);
    const wrapper = schema.allOf[0];
    assert.ok(wrapper.required?.includes('_meta'), `${path} : _meta pas required`);
    assert.equal(wrapper.properties?._meta?.$ref, '#/components/schemas/AiadMeta');
  }
});

// (#273) AiadMeta documente les 9 schémas _meta de l'écosystème.
test('COMPONENT_SCHEMAS.AiadMeta — enum schema couvre les 9 sous-namespaces', () => {
  const schema = COMPONENT_SCHEMAS.AiadMeta;
  assert.ok(schema.properties.schema.enum, 'enum absent');
  const enumList = schema.properties.schema.enum;
  for (const ns of [
    'aiad-sdd-dashboard', 'aiad-sdd-dashboard-check', 'aiad-sdd-brief',
    'aiad-sdd-doctor', 'aiad-sdd-status', 'aiad-sdd-workspace',
    'aiad-sdd-trace', 'aiad-sdd-sovereignty', 'aiad-sdd-dora',
    'aiad-sdd-hook-stats', 'aiad-sdd-standup',
    'aiad-sdd-adrs', 'aiad-sdd-ci-template',
  ]) {
    assert.ok(enumList.includes(ns), `enum doit inclure ${ns}`);
  }
  // Champs documentés (action, slim, source pour sous-cas)
  assert.ok(schema.properties.action, 'action absent');
  assert.ok(schema.properties.slim, 'slim absent');
  assert.ok(schema.properties.source, 'source absent');
});

// ─── construireOpenApi ────────────────────────────────────────────────────

test('construireOpenApi — structure OpenAPI 3.1', () => {
  const doc = construireOpenApi();
  assert.equal(doc.openapi, '3.1.0');
  assert.ok(doc.info.title);
  assert.ok(doc.info.version);
  assert.ok(doc.paths);
  assert.ok(doc.components.schemas);
});

test('construireOpenApi — un path par commande catalogue', () => {
  const doc = construireOpenApi();
  for (const cmd of Object.keys(CATALOGUE)) {
    const path = '/cli/' + cmd.replace(/\s+/g, '/');
    assert.ok(doc.paths[path], `path ${path} manquant`);
  }
});

test('construireOpenApi — chaque path a operationId + responses.200', () => {
  const doc = construireOpenApi();
  for (const [p, op] of Object.entries(doc.paths)) {
    assert.ok(op.get.operationId, `${p} : operationId manquant`);
    assert.ok(op.get.responses['200'], `${p} : 200 manquant`);
    assert.ok(op.get.tags.includes('cli'));
  }
});

test('construireOpenApi — components.schemas inclut tous COMPONENT_SCHEMAS', () => {
  const doc = construireOpenApi();
  for (const k of Object.keys(COMPONENT_SCHEMAS)) {
    assert.ok(doc.components.schemas[k], `${k} absent`);
  }
});

test('construireOpenApi — info.contact + license présents', () => {
  const doc = construireOpenApi();
  assert.ok(doc.info.contact);
  assert.equal(doc.info.license.name, 'MIT');
});

test('construireOpenApi — info override custom', () => {
  const doc = construireOpenApi({ info: { title: 'Override', version: '99.0' } });
  assert.equal(doc.info.title, 'Override');
  assert.equal(doc.info.version, '99.0');
});

test('construireOpenApi — catalogue custom', () => {
  const doc = construireOpenApi({
    catalogue: { 'my-cmd': { summary: 'X', schema: { type: 'string' } } },
    components: {},
  });
  assert.ok(doc.paths['/cli/my-cmd']);
  assert.equal(Object.keys(doc.paths).length, 1);
});

// ─── validerOpenApi ───────────────────────────────────────────────────────

test('validerOpenApi — doc généré valide', () => {
  const r = validerOpenApi(construireOpenApi());
  assert.equal(r.valid, true);
  assert.deepEqual(r.raisons, []);
});

test('validerOpenApi — openapi != 3.1.0 → invalide', () => {
  const r = validerOpenApi({ openapi: '3.0.0', info: { title: 'x', version: '1' }, paths: { '/x': { get: { responses: { '200': {} } } } }, components: { schemas: {} } });
  assert.equal(r.valid, false);
  assert.ok(r.raisons.some((m) => /3\.1\.0/.test(m)));
});

test('validerOpenApi — info incomplet → invalide', () => {
  const r = validerOpenApi({ openapi: '3.1.0', info: { title: 'x' }, paths: { '/x': { get: { responses: { '200': {} } } } }, components: { schemas: {} } });
  assert.equal(r.valid, false);
});

test('validerOpenApi — paths vide → invalide', () => {
  const r = validerOpenApi({ openapi: '3.1.0', info: { title: 'x', version: '1' }, paths: {}, components: { schemas: {} } });
  assert.equal(r.valid, false);
  assert.ok(r.raisons.some((m) => /paths/.test(m)));
});

test('validerOpenApi — path sans 200 → invalide', () => {
  const r = validerOpenApi({
    openapi: '3.1.0', info: { title: 'x', version: '1' },
    paths: { '/x': { get: { responses: {} } } },
    components: { schemas: {} },
  });
  assert.equal(r.valid, false);
});

test('validerOpenApi — doc null → invalide', () => {
  const r = validerOpenApi(null);
  assert.equal(r.valid, false);
});

// ─── genererSchema (pipeline) ─────────────────────────────────────────────

test('genererSchema — écrit YAML par défaut', () => {
  const d = tmp();
  try {
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { genererSchema(d, { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.match(parsed.path, /\.yaml$/);
    assert.equal(parsed.format, 'yaml');
    assert.ok(parsed.paths >= 12);
    assert.ok(parsed.schemas >= 8);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('genererSchema --format json → produit JSON', () => {
  const d = tmp();
  try {
    const r = genererSchema(d, { format: 'json', json: false });
    assert.ok(existsSync(r.path));
    assert.match(r.path, /\.json$/);
    // Le JSON doit être parsable
    const contenu = readFileSync(r.path, 'utf-8');
    const doc = JSON.parse(contenu);
    assert.equal(doc.openapi, '3.1.0');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('genererSchema — YAML valide structurellement', () => {
  const d = tmp();
  try {
    const r = genererSchema(d, { format: 'yaml', json: false });
    const contenu = readFileSync(r.path, 'utf-8');
    assert.match(contenu, /openapi: ["']?3\.1\.0["']?/);
    assert.match(contenu, /paths:/);
    assert.match(contenu, /components:/);
    assert.match(contenu, /schemas:/);
    assert.match(contenu, /\/cli\/status/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('genererSchema --out custom → cible alternative', () => {
  const d = tmp();
  try {
    const r = genererSchema(d, { out: 'docs/openapi.yaml', json: false });
    assert.match(r.path, /docs\/openapi\.yaml$/);
    assert.ok(existsSync(r.path));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('genererSchema --dry-run → pas d\'écriture', () => {
  const d = tmp();
  try {
    const r = genererSchema(d, { dryRun: true, json: false });
    assert.ok(!existsSync(r.path));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('genererSchema --json → output JSON minimal', () => {
  const d = tmp();
  try {
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { genererSchema(d, { json: true, dryRun: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.dryRun, true);
    assert.ok(parsed.paths);
    assert.ok(parsed.schemas);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(buildOpenApi, construireOpenApi);
  assert.equal(validateOpenApi, validerOpenApi);
  assert.equal(generateSchema, genererSchema);
});

test('CONSTANTS — exposées', () => {
  assert.ok(CONSTANTS.CATALOGUE_KEYS.length >= 12);
  assert.ok(CONSTANTS.COMPONENTS_KEYS.length >= 8);
});
