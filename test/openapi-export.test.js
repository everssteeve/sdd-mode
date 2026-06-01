// Tests `lib/openapi-export.js` — export OpenAPI 3.1 depuis SPECs.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  lireSpecsApi,
  construirePaths,
  construireOperation,
  construireOpenApiDoc,
  versYaml,
  exporterOpenApi,
  // alias EN
  listApiSpecs,
  buildPaths,
  buildOperation,
  buildOpenApiDoc,
  toYaml,
  exportOpenApi,
} from '../lib/openapi-export.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-oapi-')); }

function silentLog(fn) {
  return async (...args) => {
    const orig = console.log;
    console.log = () => {};
    try { return await fn(...args); }
    finally { console.log = orig; }
  };
}

// ─── lireSpecsApi ───────────────────────────────────────────────────────────

test('lireSpecsApi — retourne uniquement les SPECs avec api: true', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/specs'), { recursive: true });
    writeFileSync(join(d, '.aiad/specs/SPEC-001-1-api.md'),
      '---\napi: true\napi_method: GET\napi_path: /a\n---\n# Body');
    writeFileSync(join(d, '.aiad/specs/SPEC-002-1-noapi.md'),
      '---\ntitle: Pas une API\n---\n# Body');
    writeFileSync(join(d, '.aiad/specs/SPEC-003-1-false.md'),
      '---\napi: false\n---\n# Body');
    const specs = lireSpecsApi(d);
    assert.equal(specs.length, 1);
    assert.equal(specs[0].id, 'SPEC-001-1-api');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireSpecsApi — dossier absent → []', () => {
  const d = tmp();
  try {
    assert.deepEqual(lireSpecsApi(d), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── construirePaths ────────────────────────────────────────────────────────

test('construirePaths — SPEC simple GET → entrée paths correcte', () => {
  const specs = [{
    id: 'SPEC-001-1-x',
    frontmatter: { api: true, api_method: 'GET', api_path: '/users', title: 'List users' },
    body: '## Section',
  }];
  const { paths, warnings } = construirePaths(specs);
  assert.deepEqual(Object.keys(paths), ['/users']);
  assert.deepEqual(Object.keys(paths['/users']), ['get']);
  assert.equal(warnings.length, 0);
});

test('construirePaths — api_methods[] (multiple méthodes même path)', () => {
  const specs = [{
    id: 'SPEC-001-1-x',
    frontmatter: { api: true, api_methods: ['GET', 'HEAD'], api_path: '/x' },
    body: '',
  }];
  const { paths } = construirePaths(specs);
  assert.deepEqual(Object.keys(paths['/x']).sort(), ['get', 'head']);
});

test('construirePaths — méthode invalide rejetée', () => {
  const specs = [{
    id: 'SPEC-001',
    frontmatter: { api: true, api_method: 'BREW', api_path: '/x' },
    body: '',
  }];
  const { warnings } = construirePaths(specs);
  // Le code lowercase la méthode → "brew" dans le warning
  assert.ok(warnings.some((w) => /brew/i.test(w)));
});

test('construirePaths — api_path manquant → warning + skip', () => {
  const specs = [{ id: 'SPEC-001', frontmatter: { api: true, api_method: 'GET' }, body: '' }];
  const { paths, warnings } = construirePaths(specs);
  assert.deepEqual(paths, {});
  assert.ok(warnings[0].includes('api_path manquant'));
});

test('construirePaths — api_method ET api_methods absents → warning', () => {
  const specs = [{ id: 'SPEC-001', frontmatter: { api: true, api_path: '/x' }, body: '' }];
  const { warnings } = construirePaths(specs);
  assert.ok(warnings[0].includes('api_method'));
});

// ─── construireOperation ────────────────────────────────────────────────────

test('construireOperation — operationId = spec.id, summary = api_summary || title', () => {
  const op = construireOperation({
    id: 'SPEC-042', frontmatter: { api_summary: 'Mon résumé' }, body: 'Corps',
  });
  assert.equal(op.operationId, 'SPEC-042');
  assert.equal(op.summary, 'Mon résumé');
  assert.equal(op.description, 'Corps');
});

test('construireOperation — fallback summary sur title si api_summary absent', () => {
  const op = construireOperation({
    id: 'SPEC-001', frontmatter: { title: 'Titre SPEC' }, body: '',
  });
  assert.equal(op.summary, 'Titre SPEC');
});

test('construireOperation — tags depuis api_tags', () => {
  const op = construireOperation({
    id: 'SPEC-001', frontmatter: { api_tags: ['users', 'auth'] }, body: '',
  });
  assert.deepEqual(op.tags, ['users', 'auth']);
});

test('construireOperation — requestBody si api_request_schema', () => {
  const op = construireOperation({
    id: 'SPEC-001',
    frontmatter: { api_request_schema: 'CreateUserRequest' },
    body: '',
  });
  assert.ok(op.requestBody);
  assert.equal(op.requestBody.required, true);
  assert.equal(op.requestBody.content['application/json'].schema.$ref, '#/components/schemas/CreateUserRequest');
});

test('construireOperation — api_request_required=false marque optional', () => {
  const op = construireOperation({
    id: 'SPEC-001',
    frontmatter: { api_request_schema: 'Q', api_request_required: false },
    body: '',
  });
  assert.equal(op.requestBody.required, false);
});

test('construireOperation — response status custom + schema', () => {
  const op = construireOperation({
    id: 'SPEC-001',
    frontmatter: { api_response_status: 201, api_response_schema: 'User' },
    body: '',
  });
  assert.ok(op.responses['201']);
  assert.equal(op.responses['201'].content['application/json'].schema.$ref, '#/components/schemas/User');
});

test('construireOperation — error statuses ajoutées', () => {
  const op = construireOperation({
    id: 'SPEC-001',
    frontmatter: { api_error_statuses: [401, 404, 500] },
    body: '',
  });
  for (const s of ['401', '404', '500']) {
    assert.ok(op.responses[s]);
  }
});

test('construireOperation — x-aiad-governance depuis governance frontmatter', () => {
  const op = construireOperation({
    id: 'SPEC-001',
    frontmatter: { governance: 'AIAD-RGPD,AIAD-CRA' },
    body: '',
  });
  assert.deepEqual(op['x-aiad-governance'], ['AIAD-RGPD', 'AIAD-CRA']);
});

// ─── construireOpenApiDoc ───────────────────────────────────────────────────

test('construireOpenApiDoc — document complet OpenAPI 3.1', () => {
  const specs = [{
    id: 'SPEC-001',
    frontmatter: { api: true, api_method: 'GET', api_path: '/x', title: 'X' },
    body: 'corps',
  }];
  const { doc } = construireOpenApiDoc(specs, { title: 'Mon API', version: '2.0.0' });
  assert.equal(doc.openapi, '3.1.0');
  assert.equal(doc.info.title, 'Mon API');
  assert.equal(doc.info.version, '2.0.0');
  assert.ok(doc.paths['/x']);
  assert.ok(doc.components.schemas);
});

test('construireOpenApiDoc — warning sur $ref non définis', () => {
  const specs = [{
    id: 'SPEC-001',
    frontmatter: { api: true, api_method: 'GET', api_path: '/x', api_response_schema: 'Inexistant' },
    body: '',
  }];
  const { warnings } = construireOpenApiDoc(specs);
  assert.ok(warnings.some((w) => w.includes('Inexistant')));
});

test('construireOpenApiDoc — server URL ajouté si fourni', () => {
  const { doc } = construireOpenApiDoc([], { server: 'https://api.example.com' });
  assert.deepEqual(doc.servers, [{ url: 'https://api.example.com' }]);
});

// ─── versYaml ───────────────────────────────────────────────────────────────

test('versYaml — primitives', () => {
  assert.equal(versYaml(null), 'null');
  assert.equal(versYaml(true), 'true');
  assert.equal(versYaml(42), '42');
});

test('versYaml — string simple sans quote', () => {
  assert.equal(versYaml('hello'), 'hello');
  assert.equal(versYaml('SPEC-001'), 'SPEC-001');
});

test('versYaml — string avec espaces / spéciaux quoté', () => {
  assert.equal(versYaml('hello world'), '"hello world"');
  assert.equal(versYaml('1.0.0'), '"1.0.0"');
  assert.equal(versYaml('true'), '"true"'); // quote pour ne pas confondre avec bool
});

test('versYaml — array simple', () => {
  const r = versYaml(['a', 'b', 'c']);
  assert.match(r, /^\n- a\n- b\n- c$/);
});

test('versYaml — array vide → []', () => {
  assert.equal(versYaml([]), '[]');
});

test('versYaml — objet simple', () => {
  const r = versYaml({ name: 'Alice', age: 30 });
  assert.match(r, /name: Alice/);
  assert.match(r, /age: 30/);
});

test('versYaml — objet imbriqué', () => {
  const r = versYaml({ outer: { inner: 'val' } });
  assert.match(r, /outer:\n {2}inner: val/);
});

// ─── alias EN ───────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(listApiSpecs, lireSpecsApi);
  assert.equal(buildPaths, construirePaths);
  assert.equal(buildOperation, construireOperation);
  assert.equal(buildOpenApiDoc, construireOpenApiDoc);
  assert.equal(toYaml, versYaml);
  assert.equal(exportOpenApi, exporterOpenApi);
});

// ─── Pipeline exporterOpenApi ──────────────────────────────────────────────

test('exporterOpenApi — sans .aiad/ → erreur', async () => {
  const d = tmp();
  try {
    await assert.rejects(exporterOpenApi(d), /\.aiad\//);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('exporterOpenApi — projet sans SPEC api → message + path null', silentLog(async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/specs'), { recursive: true });
    const r = await exporterOpenApi(d);
    assert.equal(r.path, null);
    assert.equal(Object.keys(r.doc.paths).length, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('exporterOpenApi — produit fichier YAML valide', silentLog(async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/specs'), { recursive: true });
    writeFileSync(join(d, '.aiad/specs/SPEC-001-1-x.md'),
      '---\napi: true\napi_method: GET\napi_path: /users\ntitle: List users\n---\n# Body');
    const r = await exporterOpenApi(d);
    assert.ok(r.path);
    assert.match(r.path, /openapi\.yaml$/);
    const c = readFileSync(r.path, 'utf-8');
    assert.match(c, /openapi: "3\.1\.0"/);
    assert.match(c, /"\/users":/);
    assert.match(c, /get:/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('exporterOpenApi — format JSON', silentLog(async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/specs'), { recursive: true });
    writeFileSync(join(d, '.aiad/specs/SPEC-001.md'),
      '---\napi: true\napi_method: POST\napi_path: /x\n---\nbody');
    const r = await exporterOpenApi(d, { format: 'json' });
    assert.match(r.path, /openapi\.json$/);
    const c = readFileSync(r.path, 'utf-8');
    const parsed = JSON.parse(c);
    assert.equal(parsed.openapi, '3.1.0');
    assert.ok(parsed.paths['/x'].post);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('exporterOpenApi --dry-run → aucun fichier écrit', silentLog(async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/specs'), { recursive: true });
    writeFileSync(join(d, '.aiad/specs/SPEC-001.md'),
      '---\napi: true\napi_method: GET\napi_path: /a\n---\nbody');
    const r = await exporterOpenApi(d, { dryRun: true });
    assert.ok(!existsSync(r.path), 'fichier écrit en dry-run');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('exporterOpenApi --json → JSON exploitable sur stdout', async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad/specs'), { recursive: true });
    writeFileSync(join(d, '.aiad/specs/SPEC-001.md'),
      '---\napi: true\napi_method: GET\napi_path: /a\n---\nbody');
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try {
      await exporterOpenApi(d, { json: true });
    } finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.specsCount, 1);
    assert.ok(parsed.doc.paths['/a']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
