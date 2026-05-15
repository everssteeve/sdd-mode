// Tests `lib/confluence.js` — connecteur Confluence (item #97).
// fetch est injecté pour ne JAMAIS appeler Confluence réel.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  chargerConfig, appelerConfluence, escapeXml, markdownVersStorage,
  trouverPage, publierPage, exporterArborescence, CONSTANTS,
  // alias EN
  loadConfig, callConfluence, markdownToStorage,
  findPage, publishPage, exportTree,
} from '../lib/confluence.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-conf-')); }

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
  url: 'https://myorg.atlassian.net/wiki',
  domain: 'myorg',
  email: 'user@example.com',
  token: 'tok',
  spaceId: '12345',
  spaceKey: 'AIAD',
};

// ─── chargerConfig ──────────────────────────────────────────────────────────

test('chargerConfig — domain → URL atlassian.net/wiki', () => {
  const c = chargerConfig({ domain: 'foo' });
  assert.equal(c.url, 'https://foo.atlassian.net/wiki');
});

test('chargerConfig — env variables', () => {
  process.env.CONFLUENCE_DOMAIN = 'envdomain';
  process.env.CONFLUENCE_EMAIL = 'env@example.com';
  process.env.CONFLUENCE_TOKEN = 'envtoken';
  process.env.CONFLUENCE_SPACE = 'ENVSPACE';
  try {
    const c = chargerConfig();
    assert.equal(c.email, 'env@example.com');
    assert.equal(c.token, 'envtoken');
    assert.equal(c.spaceKey, 'ENVSPACE');
  } finally {
    delete process.env.CONFLUENCE_DOMAIN;
    delete process.env.CONFLUENCE_EMAIL;
    delete process.env.CONFLUENCE_TOKEN;
    delete process.env.CONFLUENCE_SPACE;
  }
});

test('chargerConfig — options prioritaires', () => {
  process.env.CONFLUENCE_TOKEN = 'env';
  try {
    const c = chargerConfig({ token: 'opt' });
    assert.equal(c.token, 'opt');
  } finally { delete process.env.CONFLUENCE_TOKEN; }
});

// ─── appelerConfluence ─────────────────────────────────────────────────────

test('appelerConfluence — token absent → throw', async () => {
  await assert.rejects(
    () => appelerConfluence({ url: 'https://x', email: 'e', token: '' },
      { path: '/x' }, mockFetch([{ status: 200, body: {} }])),
    /CONFLUENCE_TOKEN absent/,
  );
});

test('appelerConfluence — Authorization Basic', async () => {
  const fetchFn = mockFetch([{ status: 200, body: {} }]);
  await appelerConfluence(CONFIG_BASE, { path: '/api/v2/pages' }, fetchFn);
  const auth = fetchFn.calls[0].init.headers.Authorization;
  assert.match(auth, /^Basic /);
  // base64("user@example.com:tok")
  const decoded = Buffer.from(auth.replace('Basic ', ''), 'base64').toString();
  assert.equal(decoded, 'user@example.com:tok');
});

test('appelerConfluence — query encodée', async () => {
  const fetchFn = mockFetch([{ status: 200, body: { results: [] } }]);
  await appelerConfluence(CONFIG_BASE, {
    path: '/api/v2/pages',
    query: { 'space-id': '123', title: 'Mon Titre & test' },
  }, fetchFn);
  assert.match(fetchFn.calls[0].url, /space-id=123/);
  assert.match(fetchFn.calls[0].url, /title=Mon%20Titre%20%26%20test/);
});

test('appelerConfluence — erreur 4xx → throw', async () => {
  const fetchFn = mockFetch([{ status: 401, body: { message: 'Unauthorized' } }]);
  await assert.rejects(
    () => appelerConfluence(CONFIG_BASE, { path: '/x' }, fetchFn),
    /Confluence API 401/,
  );
});

// ─── escapeXml ─────────────────────────────────────────────────────────────

test('escapeXml — caractères dangereux échappés', () => {
  assert.equal(escapeXml('a<b>&"\''), 'a&lt;b&gt;&amp;&quot;&apos;');
});

test('escapeXml — string vide / null', () => {
  assert.equal(escapeXml(''), '');
  assert.equal(escapeXml(null), 'null');
});

// ─── markdownVersStorage ───────────────────────────────────────────────────

test('markdownVersStorage — vide → string vide', () => {
  assert.equal(markdownVersStorage(''), '');
  assert.equal(markdownVersStorage(null), '');
});

test('markdownVersStorage — titres niveau 1-4', () => {
  const out = markdownVersStorage('# H1\n## H2\n### H3\n#### H4');
  assert.match(out, /<h1>H1<\/h1>/);
  assert.match(out, /<h2>H2<\/h2>/);
  assert.match(out, /<h3>H3<\/h3>/);
  assert.match(out, /<h4>H4<\/h4>/);
});

test('markdownVersStorage — paragraphe + gras + italique + code inline', () => {
  const out = markdownVersStorage('Mot **gras** et *italique* avec `code`.');
  assert.match(out, /<strong>gras<\/strong>/);
  assert.match(out, /<em>italique<\/em>/);
  assert.match(out, /<code>code<\/code>/);
});

test('markdownVersStorage — liste non ordonnée', () => {
  const out = markdownVersStorage('- a\n- b\n- c');
  assert.match(out, /<ul>/);
  assert.match(out, /<li>a<\/li>/);
  assert.match(out, /<li>c<\/li>/);
  assert.match(out, /<\/ul>/);
});

test('markdownVersStorage — code block → macro Confluence', () => {
  const out = markdownVersStorage('```js\nconst x = 1;\n```');
  assert.match(out, /<ac:structured-macro ac:name="code">/);
  assert.match(out, /ac:parameter ac:name="language">js</);
  assert.match(out, /<!\[CDATA\[const x = 1;\]\]>/);
});

test('markdownVersStorage — lien Markdown → <a href>', () => {
  const out = markdownVersStorage('Voir [docs](https://aiad.ovh).');
  assert.match(out, /<a href="https:\/\/aiad\.ovh">docs<\/a>/);
});

test('markdownVersStorage — horizontal rule', () => {
  const out = markdownVersStorage('a\n\n---\n\nb');
  assert.match(out, /<hr\/>/);
});

test('markdownVersStorage — XSS protection (XML escaped)', () => {
  const out = markdownVersStorage('Texte <script>alert(1)</script>');
  assert.ok(!out.includes('<script>'));
  assert.match(out, /&lt;script&gt;/);
});

// ─── trouverPage ───────────────────────────────────────────────────────────

test('trouverPage — résultat trouvé', async () => {
  const fetchFn = mockFetch([{ status: 200, body: {
    results: [{ id: '999', title: 'Mon Titre', version: { number: 3 } }],
  } }]);
  const r = await trouverPage(CONFIG_BASE, { spaceId: '12345', title: 'Mon Titre' }, fetchFn);
  assert.equal(r.id, '999');
  assert.equal(r.version.number, 3);
});

test('trouverPage — aucun résultat → null', async () => {
  const fetchFn = mockFetch([{ status: 200, body: { results: [] } }]);
  const r = await trouverPage(CONFIG_BASE, { spaceId: '12345', title: 'Absent' }, fetchFn);
  assert.equal(r, null);
});

// ─── publierPage ───────────────────────────────────────────────────────────

test('publierPage — espace absent → throw', async () => {
  await assert.rejects(
    () => publierPage(
      { ...CONFIG_BASE, spaceId: '', spaceKey: '' },
      { title: 'T', content: 'C' },
      mockFetch([{ status: 200, body: {} }]),
    ),
    /CONFLUENCE_SPACE_ID ou CONFLUENCE_SPACE/,
  );
});

test('publierPage — page absente → POST + action created', async () => {
  // 1) GET /api/v2/pages?space-id=...&title=... → results vides
  // 2) POST /api/v2/pages → 200 avec {id, ...}
  const fetchFn = mockFetch([
    { status: 200, body: { results: [] } },
    { status: 200, body: { id: '111', title: 'New' } },
  ]);
  const r = await publierPage(CONFIG_BASE, { title: 'New', content: '<p>hi</p>' }, fetchFn);
  assert.equal(r.action, 'created');
  assert.equal(r.page.id, '111');
  assert.equal(fetchFn.calls[0].init.method, 'GET');
  assert.equal(fetchFn.calls[1].init.method, 'POST');
  const sent = JSON.parse(fetchFn.calls[1].init.body);
  assert.equal(sent.spaceId, '12345');
  assert.equal(sent.title, 'New');
  assert.equal(sent.body.representation, 'storage');
});

test('publierPage — page existante → PUT + version incrémentée', async () => {
  const fetchFn = mockFetch([
    { status: 200, body: { results: [{ id: '222', version: { number: 5 } }] } },
    { status: 200, body: { id: '222', version: { number: 6 } } },
  ]);
  const r = await publierPage(CONFIG_BASE, { title: 'Existant', content: '<p>v6</p>' }, fetchFn);
  assert.equal(r.action, 'updated');
  assert.equal(fetchFn.calls[1].init.method, 'PUT');
  const sent = JSON.parse(fetchFn.calls[1].init.body);
  assert.equal(sent.version.number, 6);
  assert.match(fetchFn.calls[1].url, /\/api\/v2\/pages\/222$/);
});

test('publierPage — résolution spaceKey → spaceId si absent', async () => {
  const config = { ...CONFIG_BASE, spaceId: '' };
  const fetchFn = mockFetch([
    { status: 200, body: { results: [{ id: '99' }] } },     // GET /spaces?keys=AIAD
    { status: 200, body: { results: [] } },                  // GET /pages
    { status: 200, body: { id: '333' } },                    // POST /pages
  ]);
  const r = await publierPage(config, { title: 'X', content: 'c' }, fetchFn);
  assert.equal(r.action, 'created');
  assert.match(fetchFn.calls[0].url, /\/spaces\?keys=AIAD/);
  // Le POST doit utiliser spaceId='99'
  const sent = JSON.parse(fetchFn.calls[2].init.body);
  assert.equal(sent.spaceId, '99');
});

test('publierPage — spaceKey introuvable → throw', async () => {
  const config = { ...CONFIG_BASE, spaceId: '' };
  const fetchFn = mockFetch([{ status: 200, body: { results: [] } }]);
  await assert.rejects(
    () => publierPage(config, { title: 'T', content: 'c' }, fetchFn),
    /space "AIAD" introuvable/,
  );
});

// ─── exporterArborescence ──────────────────────────────────────────────────

test('exporterArborescence --dry-run → root + intent + spec sans appel réseau', async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'INT-001.md'),
      '---\ntitle: Mon Intent\n---\nBody intent');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'),
      '---\ntitle: Ma SPEC\nintent: INT-001\n---\nBody spec');
    const fetchFn = mockFetch([{ status: 200, body: {} }]);
    const r = await exporterArborescence(d, {
      domain: 'x', email: 'e@x', token: 't', spaceId: '1',
      dryRun: true,
      fetchFn,
    });
    assert.equal(r.total, 3);
    assert.equal(r.pages[0].kind, 'root');
    assert.equal(r.pages[1].kind, 'intent');
    assert.equal(r.pages[2].kind, 'spec');
    // Aucun appel réseau effectué
    assert.equal(fetchFn.calls.length, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('exporterArborescence — projet sans intents → 1 page racine', async () => {
  const d = tmp();
  try {
    const r = await exporterArborescence(d, {
      domain: 'x', email: 'e@x', token: 't', spaceId: '1',
      dryRun: true,
    });
    assert.equal(r.total, 1);
    assert.equal(r.pages[0].kind, 'root');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('exporterArborescence — IGNORE _index.md et spec-ears-template', async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', '_index.md'), '# index');
    writeFileSync(join(d, '.aiad', 'specs', 'spec-ears-template.md'), '# tpl');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'),
      '---\ntitle: Réelle\n---\nB');
    const r = await exporterArborescence(d, {
      domain: 'x', email: 'e@x', token: 't', spaceId: '1',
      dryRun: true,
    });
    // 1 root + 1 spec = 2 (les fichiers _index et template ignorés)
    assert.equal(r.total, 2);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(loadConfig, chargerConfig);
  assert.equal(callConfluence, appelerConfluence);
  assert.equal(markdownToStorage, markdownVersStorage);
  assert.equal(findPage, trouverPage);
  assert.equal(publishPage, publierPage);
  assert.equal(exportTree, exporterArborescence);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.TIMEOUT_MS, 15000);
});
