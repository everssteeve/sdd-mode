// Tests `lib/azure-devops.js` — connecteur Azure DevOps (item #96).
// fetch est injecté pour ne JAMAIS appeler Azure DevOps réel.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  chargerConfig, appelerAzure, commenterPr, reviewPr,
  creerWorkItem, intentVersWorkItem, publierWiki, artefactVersWiki,
  CONSTANTS,
  // alias EN
  loadConfig, callAzure, commentPr, reviewPullRequest,
  createWorkItem, intentToWorkItem, publishWiki, artifactToWiki,
} from '../lib/azure-devops.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-az-')); }

function mockFetch(responses) {
  const calls = [];
  let i = 0;
  const fn = async (url, init) => {
    calls.push({ url, init });
    const r = responses[i] || responses[responses.length - 1];
    i++;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: async () => typeof r.body === 'string' ? r.body : JSON.stringify(r.body || {}),
    };
  };
  fn.calls = calls;
  return fn;
}

const CONFIG_BASE = {
  url: 'https://dev.azure.com',
  org: 'myorg',
  project: 'MyProject',
  repo: 'my-repo',
  wiki: 'MyProject.wiki',
  token: 'pat',
};

// ─── chargerConfig ──────────────────────────────────────────────────────────

test('chargerConfig — defaults + env', () => {
  process.env.AZURE_DEVOPS_ORG = 'envorg';
  process.env.AZURE_DEVOPS_PROJECT = 'envproj';
  try {
    const c = chargerConfig();
    assert.equal(c.url, 'https://dev.azure.com');
    assert.equal(c.org, 'envorg');
    assert.equal(c.project, 'envproj');
  } finally {
    delete process.env.AZURE_DEVOPS_ORG;
    delete process.env.AZURE_DEVOPS_PROJECT;
  }
});

test('chargerConfig — options prioritaires sur env', () => {
  process.env.AZURE_DEVOPS_ORG = 'env';
  try {
    const c = chargerConfig({ org: 'opt', project: 'p', token: 't' });
    assert.equal(c.org, 'opt');
    assert.equal(c.token, 't');
  } finally { delete process.env.AZURE_DEVOPS_ORG; }
});

test('chargerConfig — strip trailing slashes URL', () => {
  const c = chargerConfig({ url: 'https://dev.azure.com//' });
  assert.equal(c.url, 'https://dev.azure.com');
});

// ─── appelerAzure ──────────────────────────────────────────────────────────

test('appelerAzure — token absent → throw', async () => {
  await assert.rejects(
    () => appelerAzure({ ...CONFIG_BASE, token: '' }, { path: '/x' }, mockFetch([{ status: 200, body: {} }])),
    /AZURE_DEVOPS_TOKEN absent/,
  );
});

test('appelerAzure — Authorization Basic encodée', async () => {
  const fetchFn = mockFetch([{ status: 200, body: {} }]);
  await appelerAzure(CONFIG_BASE, { path: '/_apis/test' }, fetchFn);
  const auth = fetchFn.calls[0].init.headers.Authorization;
  assert.match(auth, /^Basic /);
  // base64(":pat") = "OnBhdA=="
  assert.equal(auth, 'Basic OnBhdA==');
});

test('appelerAzure — api-version ajoutée si absente', async () => {
  const fetchFn = mockFetch([{ status: 200, body: {} }]);
  await appelerAzure(CONFIG_BASE, { path: '/_apis/test' }, fetchFn);
  assert.match(fetchFn.calls[0].url, /api-version=7\.1/);
});

test('appelerAzure — api-version conservée si déjà fournie', async () => {
  const fetchFn = mockFetch([{ status: 200, body: {} }]);
  await appelerAzure(CONFIG_BASE, { path: '/_apis/test?api-version=6.0' }, fetchFn);
  assert.match(fetchFn.calls[0].url, /api-version=6\.0/);
});

test('appelerAzure — URL complète org/projet', async () => {
  const fetchFn = mockFetch([{ status: 200, body: { ok: true } }]);
  await appelerAzure(CONFIG_BASE, { path: '/MyProject/_apis/wit/workitems' }, fetchFn);
  assert.match(fetchFn.calls[0].url, /^https:\/\/dev\.azure\.com\/myorg\/MyProject\/_apis\/wit\/workitems/);
});

test('appelerAzure — POST avec contentType custom (json-patch)', async () => {
  const fetchFn = mockFetch([{ status: 200, body: { id: 1 } }]);
  await appelerAzure(CONFIG_BASE, {
    method: 'POST', path: '/x', body: [{ op: 'add' }],
    contentType: 'application/json-patch+json',
  }, fetchFn);
  assert.equal(fetchFn.calls[0].init.headers['Content-Type'], 'application/json-patch+json');
});

test('appelerAzure — erreur 4xx → throw avec status', async () => {
  const fetchFn = mockFetch([{ status: 401, body: { message: 'Unauthorized' } }]);
  await assert.rejects(
    () => appelerAzure(CONFIG_BASE, { path: '/x' }, fetchFn),
    /Azure DevOps API 401.*Unauthorized/,
  );
});

// ─── commenterPr ────────────────────────────────────────────────────────────

test('commenterPr — repo absent → throw', async () => {
  await assert.rejects(
    () => commenterPr({ ...CONFIG_BASE, repo: '' }, { prId: 1, body: 'x' },
      mockFetch([{ status: 200, body: {} }])),
    /AZURE_DEVOPS_REPO absent/,
  );
});

test('commenterPr — prId absent → throw', async () => {
  await assert.rejects(
    () => commenterPr(CONFIG_BASE, { body: 'x' }, mockFetch([{ status: 200, body: {} }])),
    /prId requis/,
  );
});

test('commenterPr — body vide → throw', async () => {
  await assert.rejects(
    () => commenterPr(CONFIG_BASE, { prId: 1, body: '' }, mockFetch([{ status: 200, body: {} }])),
    /body de commentaire requis/,
  );
});

test('commenterPr — POST sur /pullRequests/:id/threads avec status active', async () => {
  const fetchFn = mockFetch([{ status: 200, body: { id: 99 } }]);
  await commenterPr(CONFIG_BASE, { prId: 42, body: 'review' }, fetchFn);
  assert.match(fetchFn.calls[0].url, /\/git\/repositories\/my-repo\/pullRequests\/42\/threads/);
  const sent = JSON.parse(fetchFn.calls[0].init.body);
  assert.equal(sent.comments[0].content, 'review');
  assert.equal(sent.status, 1); // active
});

// ─── creerWorkItem ──────────────────────────────────────────────────────────

test('creerWorkItem — type inconnu → throw', async () => {
  await assert.rejects(
    () => creerWorkItem(CONFIG_BASE, { type: 'Unknown', title: 'T' },
      mockFetch([{ status: 200, body: {} }])),
    /Type Work Item inconnu/,
  );
});

test('creerWorkItem — title absent → throw', async () => {
  await assert.rejects(
    () => creerWorkItem(CONFIG_BASE, {}, mockFetch([{ status: 200, body: {} }])),
    /title requis/,
  );
});

test('creerWorkItem — JSON Patch + endpoint $UserStory', async () => {
  const fetchFn = mockFetch([{ status: 200, body: { id: 1234 } }]);
  await creerWorkItem(CONFIG_BASE, {
    title: 'T', description: 'D', tags: ['aiad', 'intent-1'],
  }, fetchFn);
  assert.match(fetchFn.calls[0].url, /\/MyProject\/_apis\/wit\/workitems\/\$UserStory/);
  assert.equal(fetchFn.calls[0].init.headers['Content-Type'], 'application/json-patch+json');
  const patch = JSON.parse(fetchFn.calls[0].init.body);
  assert.ok(Array.isArray(patch));
  assert.equal(patch[0].path, '/fields/System.Title');
  assert.equal(patch[0].value, 'T');
  assert.ok(patch.find((p) => p.path === '/fields/System.Description'));
  assert.ok(patch.find((p) => p.path === '/fields/System.Tags' && p.value === 'aiad; intent-1'));
});

test('creerWorkItem — type Bug → endpoint $Bug', async () => {
  const fetchFn = mockFetch([{ status: 200, body: { id: 1 } }]);
  await creerWorkItem(CONFIG_BASE, { type: 'Bug', title: 'T' }, fetchFn);
  assert.match(fetchFn.calls[0].url, /\$Bug/);
});

// ─── intentVersWorkItem ─────────────────────────────────────────────────────

test('intentVersWorkItem — id invalide → throw', () => {
  const d = tmp();
  try {
    assert.throws(() => intentVersWorkItem(d, 'wrong'), /intentId invalide/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('intentVersWorkItem — extrait titre + body + tags', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'INT-007-x.md'),
      '---\ntitle: Mon Intent\n---\nLe corps de l\'intent.');
    const p = intentVersWorkItem(d, 'INT-007');
    assert.equal(p.type, 'UserStory');
    assert.equal(p.title, 'Mon Intent');
    assert.match(p.description, /corps de l'intent/);
    assert.ok(p.tags.includes('aiad'));
    assert.ok(p.tags.includes('intent-int-007'));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── publierWiki / artefactVersWiki ────────────────────────────────────────

test('publierWiki — wiki absent → throw', async () => {
  await assert.rejects(
    () => publierWiki({ ...CONFIG_BASE, wiki: '' }, { path: '/p', content: 'c' },
      mockFetch([{ status: 200, body: {} }])),
    /AZURE_DEVOPS_WIKI absent/,
  );
});

test('publierWiki — path absent → throw', async () => {
  await assert.rejects(
    () => publierWiki(CONFIG_BASE, { content: 'c' }, mockFetch([{ status: 200, body: {} }])),
    /path requis/,
  );
});

test('publierWiki — PUT path query-encoded + content body', async () => {
  const fetchFn = mockFetch([{ status: 200, body: {} }]);
  await publierWiki(CONFIG_BASE, { path: '/AIAD/INT-001', content: '# Hi' }, fetchFn);
  assert.equal(fetchFn.calls[0].init.method, 'PUT');
  assert.match(fetchFn.calls[0].url, /path=%2FAIAD%2FINT-001/);
  const sent = JSON.parse(fetchFn.calls[0].init.body);
  assert.equal(sent.content, '# Hi');
});

test('publierWiki — status 200 → action updated', async () => {
  const fetchFn = mockFetch([{ status: 200, body: {} }]);
  const r = await publierWiki(CONFIG_BASE, { path: '/p', content: 'c' }, fetchFn);
  assert.equal(r.action, 'updated');
});

test('publierWiki — status 201 → action created', async () => {
  const fetchFn = mockFetch([{ status: 201, body: {} }]);
  const r = await publierWiki(CONFIG_BASE, { path: '/p', content: 'c' }, fetchFn);
  assert.equal(r.action, 'created');
});

test('artefactVersWiki — Intent → path /AIAD/intents/INT-NNN', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'INT-007-x.md'),
      '---\ntitle: My Intent\n---\nBody');
    const r = artefactVersWiki(d, { kind: 'intent', id: 'INT-007' });
    assert.equal(r.path, '/AIAD/intents/INT-007');
    assert.equal(r.title, 'My Intent');
    assert.match(r.content, /^# My Intent/);
    assert.match(r.content, /Body/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('artefactVersWiki — SPEC introuvable → throw', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    assert.throws(() => artefactVersWiki(d, { kind: 'spec', id: 'SPEC-999' }),
      /spec SPEC-999 introuvable/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── reviewPr (validation flags) ───────────────────────────────────────────

test('reviewPr — prId absent → throw', async () => {
  await assert.rejects(() => reviewPr('/tmp', { branch: 'main' }), /--id <prId> requis/);
});

test('reviewPr — branch absent → throw', async () => {
  await assert.rejects(() => reviewPr('/tmp', { prId: 1 }), /--branch <ref> requis/);
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(loadConfig, chargerConfig);
  assert.equal(callAzure, appelerAzure);
  assert.equal(commentPr, commenterPr);
  assert.equal(reviewPullRequest, reviewPr);
  assert.equal(createWorkItem, creerWorkItem);
  assert.equal(intentToWorkItem, intentVersWorkItem);
  assert.equal(publishWiki, publierWiki);
  assert.equal(artifactToWiki, artefactVersWiki);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.AZURE_DEFAULT_ORG_URL, 'https://dev.azure.com');
  assert.equal(CONSTANTS.AZURE_API_VERSION, '7.1');
  assert.ok(CONSTANTS.WORK_ITEM_TYPES.includes('UserStory'));
  assert.ok(CONSTANTS.WORK_ITEM_TYPES.includes('Bug'));
});
