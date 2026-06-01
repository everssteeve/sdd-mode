// Tests `lib/webhooks.js` — webhooks sortants signés HMAC (item #98).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import {
  uuidV4, resoudreSecret, signerPayload, verifierSignature,
  chargerConfig, sauverConfig, souscriptionsPourEvent, construireEvenement,
  emettreVersSouscription, emettre, listerSouscriptions, emettreTest,
  CONSTANTS,
  // alias EN
  uuid, resolveSecret, signPayload, verifySignature,
  loadConfig, saveConfig, subscriptionsForEvent, buildEvent,
  deliverToSubscription, emit, listSubscriptions, emitTest,
} from '../lib/webhooks.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-wh-')); }

function silent(fn) {
  return async (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return await fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

function mockFetch(responses) {
  const calls = [];
  let i = 0;
  const fn = async (url, init) => {
    calls.push({ url, init });
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    if (r.throw) throw new Error(r.throw);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: async () => r.body || '',
    };
  };
  fn.calls = calls;
  return fn;
}

// ─── uuidV4 ────────────────────────────────────────────────────────────────

test('uuidV4 — format RFC 4122 + version 4', () => {
  const id = uuidV4();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('uuidV4 — différents à chaque appel', () => {
  assert.notEqual(uuidV4(), uuidV4());
});

// ─── resoudreSecret ────────────────────────────────────────────────────────

test('resoudreSecret — chaîne directe retournée telle quelle', () => {
  assert.equal(resoudreSecret('mon-secret'), 'mon-secret');
  assert.equal(resoudreSecret(''), '');
  assert.equal(resoudreSecret(null), '');
});

test('resoudreSecret — $ENV → expansion', () => {
  process.env.MY_TEST_SECRET = 'expanded-value';
  try {
    assert.equal(resoudreSecret('$MY_TEST_SECRET'), 'expanded-value');
  } finally { delete process.env.MY_TEST_SECRET; }
});

test('resoudreSecret — $ENV absent → string vide', () => {
  delete process.env.MISSING_VAR_XYZ;
  assert.equal(resoudreSecret('$MISSING_VAR_XYZ'), '');
});

// ─── signerPayload + verifierSignature ─────────────────────────────────────

test('signerPayload — secret manquant → throw', () => {
  assert.throws(() => signerPayload({ x: 1 }, ''), /Secret HMAC requis/);
});

test('signerPayload — format sha256=<hex>', () => {
  const sig = signerPayload({ a: 1 }, 'secret');
  assert.match(sig, /^sha256=[0-9a-f]{64}$/);
});

test('signerPayload — déterministe pour même payload + secret', () => {
  const a = signerPayload({ a: 1, b: 'x' }, 'secret');
  const b = signerPayload({ a: 1, b: 'x' }, 'secret');
  assert.equal(a, b);
});

test('signerPayload — change si secret différent', () => {
  assert.notEqual(signerPayload({ a: 1 }, 'k1'), signerPayload({ a: 1 }, 'k2'));
});

test('signerPayload — accepte une string brute', () => {
  const corps = JSON.stringify({ x: 1 });
  const sig1 = signerPayload(corps, 's');
  const sig2 = signerPayload({ x: 1 }, 's');
  assert.equal(sig1, sig2);
});

test('verifierSignature — round-trip OK', () => {
  const payload = { event: 'test', data: 42 };
  const sig = signerPayload(payload, 'k');
  assert.equal(verifierSignature(payload, 'k', sig), true);
});

test('verifierSignature — secret incorrect → false', () => {
  const sig = signerPayload({ a: 1 }, 'k');
  assert.equal(verifierSignature({ a: 1 }, 'wrong', sig), false);
});

test('verifierSignature — secret vide → false (pas de throw)', () => {
  assert.equal(verifierSignature({ a: 1 }, '', 'sha256=x'), false);
});

// ─── chargerConfig / sauverConfig ──────────────────────────────────────────

test('chargerConfig — fichier absent → subscriptions vides', () => {
  const d = tmp();
  try {
    const c = chargerConfig(d);
    assert.deepEqual(c.subscriptions, []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerConfig + sauverConfig — round-trip', () => {
  const d = tmp();
  try {
    const cfg = {
      subscriptions: [
        { url: 'https://x', events: ['intent.created'], secret: 's' },
      ],
    };
    sauverConfig(d, cfg);
    const c = chargerConfig(d);
    assert.deepEqual(c, cfg);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerConfig — JSON corrompu → subscriptions vides', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'webhooks.json'), 'NOT JSON');
    assert.deepEqual(chargerConfig(d).subscriptions, []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── souscriptionsPourEvent ────────────────────────────────────────────────

test('souscriptionsPourEvent — events explicites', () => {
  const subs = [
    { url: 'a', events: ['intent.created'] },
    { url: 'b', events: ['governance.veto'] },
  ];
  assert.equal(souscriptionsPourEvent(subs, 'intent.created').length, 1);
  assert.equal(souscriptionsPourEvent(subs, 'intent.created')[0].url, 'a');
});

test('souscriptionsPourEvent — wildcard *', () => {
  const subs = [{ url: 'all', events: ['*'] }];
  assert.equal(souscriptionsPourEvent(subs, 'governance.veto').length, 1);
});

test('souscriptionsPourEvent — sans events → reçoit tout', () => {
  const subs = [{ url: 'no-events' }, { url: 'empty', events: [] }];
  assert.equal(souscriptionsPourEvent(subs, 'spec.validated').length, 2);
});

// ─── construireEvenement ──────────────────────────────────────────────────

test('construireEvenement — type valide → événement complet', () => {
  const e = construireEvenement({ type: 'intent.created', data: { id: 'INT-001' } });
  assert.equal(e.type, 'intent.created');
  assert.match(e.id, /^[0-9a-f]{8}-/);
  assert.match(e.occurredAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(e.data, { id: 'INT-001' });
});

test('construireEvenement — type manquant → throw', () => {
  assert.throws(() => construireEvenement({}), /type d'événement requis/);
});

test('construireEvenement — type inconnu → throw', () => {
  assert.throws(
    () => construireEvenement({ type: 'foo.bar' }),
    /Type d'événement inconnu/,
  );
});

// ─── emettreVersSouscription ──────────────────────────────────────────────

test('emettreVersSouscription — POST 200 → ok', async () => {
  const fetchFn = mockFetch([{ status: 200 }]);
  const r = await emettreVersSouscription(
    { id: '1', type: 'spec.validated', data: {} },
    { url: 'https://x.example' },
    fetchFn,
  );
  assert.equal(r.ok, true);
  assert.equal(r.status, 200);
  assert.equal(fetchFn.calls[0].init.method, 'POST');
  assert.equal(fetchFn.calls[0].init.headers['X-AIAD-Event'], 'spec.validated');
  assert.equal(fetchFn.calls[0].init.headers['X-AIAD-Delivery'], '1');
});

test('emettreVersSouscription — secret → header X-AIAD-Signature', async () => {
  const fetchFn = mockFetch([{ status: 200 }]);
  await emettreVersSouscription(
    { id: '1', type: 'spec.validated' },
    { url: 'https://x', secret: 'topsecret' },
    fetchFn,
  );
  const sig = fetchFn.calls[0].init.headers['X-AIAD-Signature'];
  assert.match(sig, /^sha256=/);
  // Vérification : reproduit la signature
  const corps = fetchFn.calls[0].init.body;
  const expected = 'sha256=' + createHmac('sha256', 'topsecret').update(corps).digest('hex');
  assert.equal(sig, expected);
});

test('emettreVersSouscription — pas de secret → pas de signature', async () => {
  const fetchFn = mockFetch([{ status: 200 }]);
  await emettreVersSouscription(
    { id: '1', type: 'spec.validated' },
    { url: 'https://x' },
    fetchFn,
  );
  assert.equal(fetchFn.calls[0].init.headers['X-AIAD-Signature'], undefined);
});

test('emettreVersSouscription — headers custom appliqués', async () => {
  const fetchFn = mockFetch([{ status: 200 }]);
  await emettreVersSouscription(
    { id: '1', type: 'spec.validated' },
    { url: 'https://x', headers: { 'X-Custom': 'val' } },
    fetchFn,
  );
  assert.equal(fetchFn.calls[0].init.headers['X-Custom'], 'val');
});

test('emettreVersSouscription — 4xx → pas de retry', async () => {
  const fetchFn = mockFetch([{ status: 400 }]);
  const r = await emettreVersSouscription(
    { id: '1', type: 'spec.validated' },
    { url: 'https://x' },
    fetchFn,
  );
  assert.equal(r.ok, false);
  assert.equal(fetchFn.calls.length, 1);
});

test('emettreVersSouscription — 5xx → retry MAX_RETRIES fois', async () => {
  const fetchFn = mockFetch([{ status: 500 }, { status: 500 }, { status: 500 }]);
  const r = await emettreVersSouscription(
    { id: '1', type: 'spec.validated' },
    { url: 'https://x' },
    fetchFn,
  );
  assert.equal(r.ok, false);
  // 1 tentative initiale + 2 retries
  assert.equal(fetchFn.calls.length, 3);
});

test('emettreVersSouscription — 5xx puis 200 → succès après retry', async () => {
  const fetchFn = mockFetch([{ status: 500 }, { status: 200 }]);
  const r = await emettreVersSouscription(
    { id: '1', type: 'spec.validated' },
    { url: 'https://x' },
    fetchFn,
  );
  assert.equal(r.ok, true);
  assert.equal(r.status, 200);
});

test('emettreVersSouscription — url absente → ok=false', async () => {
  const r = await emettreVersSouscription(
    { id: '1', type: 'spec.validated' },
    { url: '' },
    mockFetch([{ status: 200 }]),
  );
  assert.equal(r.ok, false);
});

// ─── emettre (pipeline complet) ────────────────────────────────────────────

test('emettre --dry-run → aucune requête mais deliveries listées', async () => {
  const d = tmp();
  try {
    sauverConfig(d, { subscriptions: [
      { url: 'https://a', events: ['intent.created'] },
      { url: 'https://b', events: ['*'] },
    ]});
    const fetchFn = mockFetch([{ status: 200 }]);
    const r = await emettre(d, { type: 'intent.created' }, { dryRun: true, fetchFn });
    assert.equal(r.deliveries.length, 2);
    assert.equal(r.deliveries[0].dryRun, true);
    assert.equal(fetchFn.calls.length, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('emettre — événement sans souscription correspondante → 0 livraison', async () => {
  const d = tmp();
  try {
    sauverConfig(d, { subscriptions: [
      { url: 'https://a', events: ['governance.veto'] },
    ]});
    const r = await emettre(d, { type: 'spec.validated' }, { dryRun: true });
    assert.equal(r.deliveries.length, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('emettre — échec → entrée dans webhooks-failures.jsonl', async () => {
  const d = tmp();
  try {
    sauverConfig(d, { subscriptions: [{ url: 'https://x' }] });
    const fetchFn = mockFetch([{ status: 500 }, { status: 500 }, { status: 500 }]);
    await emettre(d, { type: 'audit.violation' }, { fetchFn });
    const failuresPath = join(d, '.aiad', 'metrics', 'webhooks-failures.jsonl');
    assert.ok(existsSync(failuresPath));
    const ligne = JSON.parse(readFileSync(failuresPath, 'utf-8').trim());
    assert.equal(ligne.eventType, 'audit.violation');
    assert.equal(ligne.url, 'https://x');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('emettre — succès → pas de log d\'échec', async () => {
  const d = tmp();
  try {
    sauverConfig(d, { subscriptions: [{ url: 'https://x' }] });
    const fetchFn = mockFetch([{ status: 200 }]);
    await emettre(d, { type: 'audit.violation' }, { fetchFn });
    const failuresPath = join(d, '.aiad', 'metrics', 'webhooks-failures.jsonl');
    assert.ok(!existsSync(failuresPath));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── listerSouscriptions / emettreTest ────────────────────────────────────

test('listerSouscriptions — sortie humaine smoke', silent(() => {
  const d = tmp();
  try {
    sauverConfig(d, { subscriptions: [{ url: 'https://x', events: ['*'] }] });
    const r = listerSouscriptions(d);
    assert.equal(r.subscriptions.length, 1);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('listerSouscriptions --json', () => {
  const d = tmp();
  try {
    sauverConfig(d, { subscriptions: [{ url: 'https://y' }] });
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { listerSouscriptions(d, { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.subscriptions.length, 1);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('emettreTest — émet event spec.validated par défaut', async () => {
  const d = tmp();
  try {
    sauverConfig(d, { subscriptions: [{ url: 'https://x' }] });
    const fetchFn = mockFetch([{ status: 200 }]);
    const r = await emettreTest(d, { fetchFn });
    assert.equal(r.event.type, 'spec.validated');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(uuid, uuidV4);
  assert.equal(resolveSecret, resoudreSecret);
  assert.equal(signPayload, signerPayload);
  assert.equal(verifySignature, verifierSignature);
  assert.equal(loadConfig, chargerConfig);
  assert.equal(saveConfig, sauverConfig);
  assert.equal(subscriptionsForEvent, souscriptionsPourEvent);
  assert.equal(buildEvent, construireEvenement);
  assert.equal(deliverToSubscription, emettreVersSouscription);
  assert.equal(emit, emettre);
  assert.equal(listSubscriptions, listerSouscriptions);
  assert.equal(emitTest, emettreTest);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.CONFIG_PATH, '.aiad/webhooks.json');
  assert.equal(CONSTANTS.MAX_RETRIES, 2);
  assert.ok(CONSTANTS.EVENTS_VALIDES.includes('governance.veto'));
  assert.ok(CONSTANTS.EVENTS_VALIDES.includes('audit.violation'));
});
