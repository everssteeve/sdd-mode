// Tests `lib/bitbucket.js` — connecteur Bitbucket Cloud + Server (item #113).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  chargerConfig, appelerBitbucket, commenterPr, reviewPr,
  creerIssue, intentVersIssue, CONSTANTS,
  // alias EN
  loadConfig, callBitbucket, commentPr, reviewPullRequest,
  createIssue, intentToIssue,
} from '../lib/bitbucket.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-bb-')); }

function mockFetch(responses) {
  const calls = [];
  let i = 0;
  const fn = async (url, init) => {
    calls.push({ url, init });
    const r = responses[Math.min(i, responses.length - 1)];
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

const CLOUD_BASE = {
  mode: 'cloud',
  url: 'https://api.bitbucket.org/2.0',
  username: 'alice',
  appPassword: 'pwd',
  workspace: 'monorga',
  repo: 'my-repo',
};

const SERVER_BASE = {
  mode: 'server',
  url: 'https://bitbucket.corp.fr/rest/api/1.0',
  token: 'pat-tok',
  project: 'PROJ',
  repo: 'my-repo',
};

// ─── chargerConfig ────────────────────────────────────────────────────────

test('chargerConfig — Cloud par défaut', () => {
  const c = chargerConfig();
  assert.equal(c.mode, 'cloud');
  assert.equal(c.url, 'https://api.bitbucket.org/2.0');
});

test('chargerConfig — env Cloud', () => {
  process.env.BITBUCKET_USERNAME = 'u';
  process.env.BITBUCKET_APP_PASSWORD = 'p';
  process.env.BITBUCKET_WORKSPACE = 'w';
  try {
    const c = chargerConfig();
    assert.equal(c.username, 'u');
    assert.equal(c.appPassword, 'p');
    assert.equal(c.workspace, 'w');
  } finally {
    delete process.env.BITBUCKET_USERNAME;
    delete process.env.BITBUCKET_APP_PASSWORD;
    delete process.env.BITBUCKET_WORKSPACE;
  }
});

test('chargerConfig — Server via BITBUCKET_SERVER_URL', () => {
  process.env.BITBUCKET_SERVER_URL = 'https://bb.corp.fr/';
  process.env.BITBUCKET_TOKEN = 'tok';
  process.env.BITBUCKET_PROJECT = 'P';
  try {
    const c = chargerConfig();
    assert.equal(c.mode, 'server');
    assert.equal(c.url, 'https://bb.corp.fr/rest/api/1.0');
    assert.equal(c.token, 'tok');
    assert.equal(c.project, 'P');
  } finally {
    delete process.env.BITBUCKET_SERVER_URL;
    delete process.env.BITBUCKET_TOKEN;
    delete process.env.BITBUCKET_PROJECT;
  }
});

test('chargerConfig — options.server force Server', () => {
  const c = chargerConfig({ server: true, serverUrl: 'https://bb.example.com' });
  assert.equal(c.mode, 'server');
  assert.equal(c.url, 'https://bb.example.com/rest/api/1.0');
});

// ─── appelerBitbucket ─────────────────────────────────────────────────────

test('appelerBitbucket — Cloud Basic auth encodée', async () => {
  const fetchFn = mockFetch([{ status: 200, body: {} }]);
  await appelerBitbucket(CLOUD_BASE, { path: '/x' }, fetchFn);
  const auth = fetchFn.calls[0].init.headers.Authorization;
  assert.match(auth, /^Basic /);
  const decoded = Buffer.from(auth.replace('Basic ', ''), 'base64').toString();
  assert.equal(decoded, 'alice:pwd');
});

test('appelerBitbucket — Server Bearer auth', async () => {
  const fetchFn = mockFetch([{ status: 200, body: {} }]);
  await appelerBitbucket(SERVER_BASE, { path: '/x' }, fetchFn);
  assert.equal(fetchFn.calls[0].init.headers.Authorization, 'Bearer pat-tok');
});

test('appelerBitbucket — Cloud username manquant → throw', async () => {
  await assert.rejects(
    () => appelerBitbucket({ ...CLOUD_BASE, username: '' }, { path: '/x' },
      mockFetch([{ status: 200, body: {} }])),
    /BITBUCKET_USERNAME/,
  );
});

test('appelerBitbucket — Cloud app password manquant → message d\'aide', async () => {
  await assert.rejects(
    () => appelerBitbucket({ ...CLOUD_BASE, appPassword: '' }, { path: '/x' },
      mockFetch([{ status: 200, body: {} }])),
    /App password/,
  );
});

test('appelerBitbucket — Server token manquant → throw', async () => {
  await assert.rejects(
    () => appelerBitbucket({ ...SERVER_BASE, token: '' }, { path: '/x' },
      mockFetch([{ status: 200, body: {} }])),
    /BITBUCKET_TOKEN/,
  );
});

test('appelerBitbucket — repo manquant → throw (les deux modes)', async () => {
  await assert.rejects(
    () => appelerBitbucket({ ...CLOUD_BASE, repo: '' }, { path: '/x' },
      mockFetch([{ status: 200, body: {} }])),
    /BITBUCKET_REPO/,
  );
});

test('appelerBitbucket — erreur 4xx → throw', async () => {
  const fetchFn = mockFetch([{ status: 401, body: { error: { message: 'Unauthorized' } } }]);
  await assert.rejects(
    () => appelerBitbucket(CLOUD_BASE, { path: '/x' }, fetchFn),
    /Bitbucket API 401/,
  );
});

// ─── commenterPr ──────────────────────────────────────────────────────────

test('commenterPr — Cloud POST avec content.raw', async () => {
  const fetchFn = mockFetch([{ status: 201, body: { id: 99 } }]);
  await commenterPr(CLOUD_BASE, { prId: 42, body: 'hello' }, fetchFn);
  assert.match(fetchFn.calls[0].url, /\/repositories\/monorga\/my-repo\/pullrequests\/42\/comments$/);
  const sent = JSON.parse(fetchFn.calls[0].init.body);
  assert.equal(sent.content.raw, 'hello');
});

test('commenterPr — Server POST avec text', async () => {
  const fetchFn = mockFetch([{ status: 201, body: { id: 99 } }]);
  await commenterPr(SERVER_BASE, { prId: 42, body: 'hello' }, fetchFn);
  assert.match(fetchFn.calls[0].url, /\/projects\/PROJ\/repos\/my-repo\/pull-requests\/42\/comments$/);
  const sent = JSON.parse(fetchFn.calls[0].init.body);
  assert.equal(sent.text, 'hello');
});

test('commenterPr — prId manquant → throw', async () => {
  await assert.rejects(
    () => commenterPr(CLOUD_BASE, { body: 'x' },
      mockFetch([{ status: 200, body: {} }])),
    /prId requis/,
  );
});

test('commenterPr — body vide → throw', async () => {
  await assert.rejects(
    () => commenterPr(CLOUD_BASE, { prId: 1, body: '' },
      mockFetch([{ status: 200, body: {} }])),
    /body de commentaire requis/,
  );
});

// ─── creerIssue ──────────────────────────────────────────────────────────

test('creerIssue — Server → throw (pas d\'API native)', async () => {
  await assert.rejects(
    () => creerIssue(SERVER_BASE, { title: 'T' },
      mockFetch([{ status: 200, body: {} }])),
    /pas d'API Issues/,
  );
});

test('creerIssue — Cloud POST avec kind+priority par défaut', async () => {
  const fetchFn = mockFetch([{ status: 201, body: { id: 5 } }]);
  await creerIssue(CLOUD_BASE, { title: 'T', content: 'C' }, fetchFn);
  const sent = JSON.parse(fetchFn.calls[0].init.body);
  assert.equal(sent.title, 'T');
  assert.equal(sent.content.raw, 'C');
  assert.equal(sent.content.markup, 'markdown');
  assert.equal(sent.kind, 'task');
  assert.equal(sent.priority, 'minor');
});

test('creerIssue — kind invalide → throw', async () => {
  await assert.rejects(
    () => creerIssue(CLOUD_BASE, { title: 'T', kind: 'feature' },
      mockFetch([{ status: 200, body: {} }])),
    /Kind.*invalide/,
  );
});

test('creerIssue — priority invalide → throw', async () => {
  await assert.rejects(
    () => creerIssue(CLOUD_BASE, { title: 'T', priority: 'urgent' },
      mockFetch([{ status: 200, body: {} }])),
    /Priority.*invalide/,
  );
});

test('creerIssue — kind=bug + priority=critical accepté', async () => {
  const fetchFn = mockFetch([{ status: 201, body: { id: 6 } }]);
  await creerIssue(CLOUD_BASE, { title: 'T', kind: 'bug', priority: 'critical' }, fetchFn);
  const sent = JSON.parse(fetchFn.calls[0].init.body);
  assert.equal(sent.kind, 'bug');
  assert.equal(sent.priority, 'critical');
});

test('creerIssue — title manquant → throw', async () => {
  await assert.rejects(
    () => creerIssue(CLOUD_BASE, {},
      mockFetch([{ status: 200, body: {} }])),
    /title requis/,
  );
});

// ─── intentVersIssue ──────────────────────────────────────────────────────

test('intentVersIssue — id invalide → throw', () => {
  const d = tmp();
  try {
    assert.throws(() => intentVersIssue(d, 'wrong'), /intentId invalide/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('intentVersIssue — dossier absent → throw', () => {
  const d = tmp();
  try {
    assert.throws(() => intentVersIssue(d, 'INT-001'),
      /\.aiad\/intents\/ introuvable/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('intentVersIssue — extrait titre + body', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'INT-007-x.md'),
      '---\ntitle: Mon Intent\n---\nLe body de l\'intent.');
    const p = intentVersIssue(d, 'INT-007');
    assert.equal(p.title, 'Mon Intent');
    assert.match(p.content, /body de l'intent/);
    assert.match(p.content, /Issue créée depuis l'Intent/);
    assert.equal(p.kind, 'task');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── reviewPr (validation flags) ──────────────────────────────────────────

test('reviewPr — prId manquant → throw', async () => {
  await assert.rejects(() => reviewPr('/tmp', { branch: 'main' }), /--id <prId> requis/);
});

test('reviewPr — branch manquant → throw', async () => {
  await assert.rejects(() => reviewPr('/tmp', { prId: 1 }), /--branch <ref> requis/);
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(loadConfig, chargerConfig);
  assert.equal(callBitbucket, appelerBitbucket);
  assert.equal(commentPr, commenterPr);
  assert.equal(reviewPullRequest, reviewPr);
  assert.equal(createIssue, creerIssue);
  assert.equal(intentToIssue, intentVersIssue);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.CLOUD_DEFAULT_URL, 'https://api.bitbucket.org/2.0');
  assert.ok(CONSTANTS.KINDS_VALIDES.includes('bug'));
  assert.ok(CONSTANTS.KINDS_VALIDES.includes('task'));
  assert.ok(CONSTANTS.PRIORITES_VALIDES.includes('critical'));
});
