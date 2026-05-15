// Tests `lib/gitlab.js` — connecteur GitLab natif (item #95).
// fetch est injecté pour ne JAMAIS appeler GitLab réel.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  chargerConfig, appelerGitLab, commenterMr, reviewMr,
  creerIssue, intentVersIssue, publierWiki, artefactVersWiki,
  CONSTANTS,
  // alias EN
  loadConfig, callGitLab, commentMr, reviewMergeRequest,
  createIssue, intentToIssue, publishWiki, artifactToWiki,
} from '../lib/gitlab.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-gl-')); }

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

// ─── chargerConfig ──────────────────────────────────────────────────────────

test('chargerConfig — valeurs par défaut', () => {
  const c = chargerConfig();
  assert.equal(c.url, 'https://gitlab.com');
  assert.equal(c.token, '');
  assert.equal(c.projectId, '');
});

test('chargerConfig — options explicites prioritaires sur env', () => {
  process.env.GITLAB_URL = 'https://env.gitlab.example';
  process.env.GITLAB_TOKEN = 'env-token';
  try {
    const c = chargerConfig({ url: 'https://opt.example/', token: 'opt' });
    assert.equal(c.url, 'https://opt.example');
    assert.equal(c.token, 'opt');
  } finally {
    delete process.env.GITLAB_URL;
    delete process.env.GITLAB_TOKEN;
  }
});

test('chargerConfig — strip trailing slash', () => {
  const c = chargerConfig({ url: 'https://gitlab.example.com////' });
  assert.equal(c.url, 'https://gitlab.example.com');
});

// ─── appelerGitLab ──────────────────────────────────────────────────────────

test('appelerGitLab — token absent → throw', async () => {
  const fetchFn = mockFetch([{ status: 200, body: {} }]);
  await assert.rejects(
    () => appelerGitLab({ url: 'https://x', token: '' }, { path: '/x' }, fetchFn),
    /GITLAB_TOKEN absent/,
  );
});

test('appelerGitLab — GET succès → status 200 + body parsé', async () => {
  const fetchFn = mockFetch([{ status: 200, body: { id: 42 } }]);
  const r = await appelerGitLab(
    { url: 'https://gitlab.example.com', token: 'tok' },
    { path: '/projects/1' },
    fetchFn,
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.id, 42);
  assert.equal(fetchFn.calls.length, 1);
  assert.match(fetchFn.calls[0].url, /\/api\/v4\/projects\/1$/);
  assert.equal(fetchFn.calls[0].init.method, 'GET');
  assert.equal(fetchFn.calls[0].init.headers['PRIVATE-TOKEN'], 'tok');
});

test('appelerGitLab — POST → body sérialisé JSON', async () => {
  const fetchFn = mockFetch([{ status: 201, body: { id: 100 } }]);
  await appelerGitLab(
    { url: 'https://x', token: 't' },
    { method: 'POST', path: '/x', body: { foo: 'bar' } },
    fetchFn,
  );
  assert.equal(fetchFn.calls[0].init.method, 'POST');
  assert.equal(fetchFn.calls[0].init.body, JSON.stringify({ foo: 'bar' }));
});

test('appelerGitLab — erreur 4xx → throw avec status', async () => {
  const fetchFn = mockFetch([{ status: 401, body: { message: '401 Unauthorized' } }]);
  await assert.rejects(
    () => appelerGitLab({ url: 'https://x', token: 't' }, { path: '/y' }, fetchFn),
    /GitLab API 401.*Unauthorized/i,
  );
});

test('appelerGitLab — fetch absent → throw', async () => {
  // Provoque l'erreur en passant fetchFn explicitement à `null`
  const orig = globalThis.fetch;
  globalThis.fetch = undefined;
  try {
    await assert.rejects(
      () => appelerGitLab({ url: 'https://x', token: 't' }, { path: '/y' }),
      /fetch natif indisponible/,
    );
  } finally { globalThis.fetch = orig; }
});

// ─── commenterMr ────────────────────────────────────────────────────────────

test('commenterMr — projectId absent → throw', async () => {
  await assert.rejects(
    () => commenterMr({ url: 'https://x', token: 't', projectId: '' },
      { mrIid: 1, body: 'x' }, mockFetch([{ status: 200, body: {} }])),
    /projectId GitLab absent/,
  );
});

test('commenterMr — mrIid manquant → throw', async () => {
  await assert.rejects(
    () => commenterMr({ url: 'https://x', token: 't', projectId: '1' },
      { body: 'x' }, mockFetch([{ status: 200, body: {} }])),
    /mrIid requis/,
  );
});

test('commenterMr — body vide → throw', async () => {
  await assert.rejects(
    () => commenterMr({ url: 'https://x', token: 't', projectId: '1' },
      { mrIid: 1, body: '' }, mockFetch([{ status: 200, body: {} }])),
    /body de commentaire requis/,
  );
});

test('commenterMr — POST sur le bon endpoint', async () => {
  const fetchFn = mockFetch([{ status: 201, body: { id: 99 } }]);
  await commenterMr(
    { url: 'https://gitlab.example', token: 'tok', projectId: 'group/project' },
    { mrIid: 42, body: 'hello' },
    fetchFn,
  );
  // projectId encodé : group%2Fproject
  assert.match(fetchFn.calls[0].url, /\/projects\/group%2Fproject\/merge_requests\/42\/notes$/);
  assert.equal(JSON.parse(fetchFn.calls[0].init.body).body, 'hello');
});

// ─── creerIssue + intentVersIssue ──────────────────────────────────────────

test('creerIssue — POST avec labels concaténés', async () => {
  const fetchFn = mockFetch([{ status: 201, body: { iid: 5, web_url: 'https://x' } }]);
  const r = await creerIssue(
    { url: 'https://x', token: 't', projectId: '1' },
    { title: 'T', description: 'D', labels: ['a', 'b'] },
    fetchFn,
  );
  assert.equal(r.iid, 5);
  const sent = JSON.parse(fetchFn.calls[0].init.body);
  assert.equal(sent.labels, 'a,b');
});

test('intentVersIssue — id invalide → throw', () => {
  const d = tmp();
  try {
    assert.throws(() => intentVersIssue(d, 'not-an-id'), /intentId invalide/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('intentVersIssue — dossier absent → throw', () => {
  const d = tmp();
  try {
    assert.throws(() => intentVersIssue(d, 'INT-001'), /\.aiad\/intents\/ introuvable/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('intentVersIssue — fichier absent → throw avec id explicite', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    assert.throws(() => intentVersIssue(d, 'INT-999'), /Intent INT-999 introuvable/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('intentVersIssue — extrait titre + body + labels', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'INT-042-data-export.md'),
      '---\ntitle: Permettre l\'export des données utilisateur\n---\n\nLes utilisateurs doivent pouvoir récupérer une copie complète de leurs données.');
    const payload = intentVersIssue(d, 'INT-042');
    assert.match(payload.title, /Permettre l'export/);
    assert.match(payload.description, /utilisateurs doivent/);
    assert.match(payload.description, /Issue créée depuis l'Intent/);
    assert.ok(payload.labels.includes('aiad-intent'));
    assert.ok(payload.labels.includes('intent:int-042'));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── publierWiki / artefactVersWiki ────────────────────────────────────────

test('publierWiki — slug absent → throw', async () => {
  await assert.rejects(
    () => publierWiki({ url: 'https://x', token: 't', projectId: '1' },
      { title: 'T', content: 'C' }, mockFetch([{ status: 200, body: {} }])),
    /slug requis/,
  );
});

test('publierWiki — PUT 200 → action updated', async () => {
  const fetchFn = mockFetch([{ status: 200, body: { slug: 'intents/INT-001' } }]);
  const r = await publierWiki(
    { url: 'https://x', token: 't', projectId: '1' },
    { slug: 'intents/INT-001', title: 'T', content: 'C' },
    fetchFn,
  );
  assert.equal(r.action, 'updated');
  assert.equal(fetchFn.calls[0].init.method, 'PUT');
});

test('publierWiki — PUT 404 → fallback POST → action created', async () => {
  const fetchFn = mockFetch([
    { status: 404, body: { message: '404 Not Found' } },
    { status: 201, body: { slug: 'intents/INT-001' } },
  ]);
  const r = await publierWiki(
    { url: 'https://x', token: 't', projectId: '1' },
    { slug: 'intents/INT-001', title: 'T', content: 'C' },
    fetchFn,
  );
  assert.equal(r.action, 'created');
  assert.equal(fetchFn.calls[0].init.method, 'PUT');
  assert.equal(fetchFn.calls[1].init.method, 'POST');
});

test('publierWiki — PUT 500 → propagation erreur (pas de fallback)', async () => {
  const fetchFn = mockFetch([{ status: 500, body: { message: 'Internal Server Error' } }]);
  await assert.rejects(
    () => publierWiki({ url: 'https://x', token: 't', projectId: '1' },
      { slug: 's', title: 'T', content: 'C' }, fetchFn),
    /GitLab API 500/,
  );
});

test('artefactVersWiki — Intent → slug intents/INT-NNN', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'INT-007-x.md'),
      '---\ntitle: Foo\n---\nBody');
    const r = artefactVersWiki(d, { kind: 'intent', id: 'INT-007' });
    assert.equal(r.slug, 'intents/INT-007');
    assert.equal(r.title, 'Foo');
    assert.match(r.content, /Body/);
    assert.match(r.content, /Page synchronisée/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('artefactVersWiki — SPEC → slug specs/SPEC-NNN-N-slug', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-auth.md'),
      '---\ntitle: Auth\n---\nSpec body');
    const r = artefactVersWiki(d, { kind: 'spec', id: 'SPEC-001-1-auth' });
    assert.equal(r.slug, 'specs/SPEC-001-1-AUTH');
    assert.equal(r.title, 'Auth');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── reviewMr (dry-run, pas de réseau) ─────────────────────────────────────

test('reviewMr — mrIid absent → throw', async () => {
  await assert.rejects(
    () => reviewMr('/tmp', { branch: 'main' }),
    /--mr <iid> requis/,
  );
});

test('reviewMr — branch absent → throw', async () => {
  await assert.rejects(
    () => reviewMr('/tmp', { mrIid: 1 }),
    /--branch <ref> requis/,
  );
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(loadConfig, chargerConfig);
  assert.equal(callGitLab, appelerGitLab);
  assert.equal(commentMr, commenterMr);
  assert.equal(reviewMergeRequest, reviewMr);
  assert.equal(createIssue, creerIssue);
  assert.equal(intentToIssue, intentVersIssue);
  assert.equal(publishWiki, publierWiki);
  assert.equal(artifactToWiki, artefactVersWiki);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.GITLAB_DEFAULT_URL, 'https://gitlab.com');
  assert.equal(CONSTANTS.TIMEOUT_MS, 15000);
});
