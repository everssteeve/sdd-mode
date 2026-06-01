// Tests `lib/offline.js` — mode air-gapped (item #112).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  estOffline, urlEstLocale, verifierUrl, wrapperFetch, installerGarde,
  lireLog, loggerTentative, status, afficherLog, CONSTANTS,
  // alias EN
  isOffline, urlIsLocal, verifyUrl, wrapFetch, installGuard,
  readLog, logAttempt, showStatus, showLog,
} from '../lib/offline.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-off-')); }
function silent(fn) {
  return (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

function withEnv(env, fn) {
  const orig = { ...env };
  const sauvegarde = {};
  for (const k of Object.keys(env)) {
    sauvegarde[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  try { return fn(); }
  finally {
    for (const k of Object.keys(orig)) {
      if (sauvegarde[k] === undefined) delete process.env[k];
      else process.env[k] = sauvegarde[k];
    }
  }
}

// ─── estOffline ────────────────────────────────────────────────────────────

test('estOffline — env=1 → true', () => {
  withEnv({ AIAD_OFFLINE: '1' }, () => {
    const d = tmp();
    try { assert.equal(estOffline(d), true); }
    finally { rmSync(d, { recursive: true, force: true }); }
  });
});

test('estOffline — env=true|yes|on → true', () => {
  for (const v of ['true', 'yes', 'on', 'TRUE']) {
    withEnv({ AIAD_OFFLINE: v }, () => {
      assert.equal(estOffline(tmp()), true);
    });
  }
});

test('estOffline — env=0|false|off → false', () => {
  for (const v of ['0', 'false', 'off']) {
    withEnv({ AIAD_OFFLINE: v }, () => {
      assert.equal(estOffline(tmp()), false);
    });
  }
});

test('estOffline — config.yml offline: true', () => {
  withEnv({ AIAD_OFFLINE: undefined }, () => {
    const d = tmp();
    try {
      mkdirSync(join(d, '.aiad'), { recursive: true });
      writeFileSync(join(d, '.aiad', 'config.yml'), 'offline: true\n');
      assert.equal(estOffline(d), true);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

test('estOffline — env=off override config=true', () => {
  withEnv({ AIAD_OFFLINE: 'off' }, () => {
    const d = tmp();
    try {
      mkdirSync(join(d, '.aiad'), { recursive: true });
      writeFileSync(join(d, '.aiad', 'config.yml'), 'offline: true\n');
      assert.equal(estOffline(d), false);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

test('estOffline — pas de config ni env → false', () => {
  withEnv({ AIAD_OFFLINE: undefined }, () => {
    assert.equal(estOffline(tmp()), false);
  });
});

// ─── urlEstLocale ─────────────────────────────────────────────────────────

test('urlEstLocale — localhost / 127.0.0.1 / ::1', () => {
  assert.equal(urlEstLocale('http://localhost'), true);
  assert.equal(urlEstLocale('http://localhost:8080/x'), true);
  assert.equal(urlEstLocale('http://127.0.0.1:11434/api'), true);
  assert.equal(urlEstLocale('http://[::1]/'), true);
});

test('urlEstLocale — RFC 1918 IPv4', () => {
  assert.equal(urlEstLocale('http://10.0.0.1/x'), true);
  assert.equal(urlEstLocale('http://10.255.255.255'), true);
  assert.equal(urlEstLocale('http://172.16.0.1'), true);
  assert.equal(urlEstLocale('http://172.31.255.254'), true);
  assert.equal(urlEstLocale('http://192.168.1.1'), true);
});

test('urlEstLocale — TLD internes', () => {
  assert.equal(urlEstLocale('http://service.local'), true);
  assert.equal(urlEstLocale('http://gateway.internal/x'), true);
  assert.equal(urlEstLocale('http://x.intra/x'), true);
});

test('urlEstLocale — IPv4 publique → false', () => {
  assert.equal(urlEstLocale('https://8.8.8.8/'), false);
  assert.equal(urlEstLocale('http://172.32.0.1'), false); // hors 172.16-31
  assert.equal(urlEstLocale('https://93.184.216.34/'), false);
});

test('urlEstLocale — domaine public → false', () => {
  assert.equal(urlEstLocale('https://gitlab.com/api/v4'), false);
  assert.equal(urlEstLocale('https://api.openai.com'), false);
});

test('urlEstLocale — IPv6 ULA fc00::/7 → true', () => {
  assert.equal(urlEstLocale('http://[fc00::1]/'), true);
  assert.equal(urlEstLocale('http://[fd12:3456:789a::1]/'), true);
});

test('urlEstLocale — allowlist AIAD_OFFLINE_ALLOWLIST', () => {
  withEnv({ AIAD_OFFLINE_ALLOWLIST: 'gitlab.corp.fr,internal.example.com' }, () => {
    assert.equal(urlEstLocale('https://gitlab.corp.fr/api'), true);
    assert.equal(urlEstLocale('https://api.internal.example.com'), true);
    assert.equal(urlEstLocale('https://other.example.com'), false);
  });
});

test('urlEstLocale — URL malformée → false', () => {
  assert.equal(urlEstLocale('pas-une-url'), false);
  assert.equal(urlEstLocale(''), false);
  assert.equal(urlEstLocale(null), false);
});

// ─── verifierUrl ──────────────────────────────────────────────────────────

test('verifierUrl — offline OFF → ne bloque jamais', () => {
  withEnv({ AIAD_OFFLINE: undefined }, () => {
    verifierUrl('https://api.openai.com'); // ne throw pas
  });
});

test('verifierUrl — offline ON + URL publique → throw', () => {
  withEnv({ AIAD_OFFLINE: '1' }, () => {
    const d = tmp();
    try {
      assert.throws(
        () => verifierUrl('https://api.openai.com', { racine: d }),
        /AIAD_OFFLINE=1.*bloquée/,
      );
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

test('verifierUrl — offline ON + URL locale → pas bloquée', () => {
  withEnv({ AIAD_OFFLINE: '1' }, () => {
    verifierUrl('http://localhost:11434/api/generate');
    verifierUrl('http://127.0.0.1/x');
  });
});

test('verifierUrl — tentative bloquée loguée dans audit', () => {
  withEnv({ AIAD_OFFLINE: '1' }, () => {
    const d = tmp();
    try {
      try { verifierUrl('https://evil.example/x', { racine: d, contexte: 'test' }); }
      catch { /* expected */ }
      const log = lireLog(d);
      assert.equal(log.length, 1);
      assert.equal(log[0].url, 'https://evil.example/x');
      assert.equal(log[0].contexte, 'test');
      assert.equal(log[0].bloque, true);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

// ─── wrapperFetch / installerGarde ────────────────────────────────────────

test('wrapperFetch — original requis fonction', () => {
  assert.throws(() => wrapperFetch(null), /fetch original requis/);
  assert.throws(() => wrapperFetch('string'), /fetch original requis/);
});

test('wrapperFetch — offline OFF → délègue à l\'original', async () => {
  withEnv({ AIAD_OFFLINE: undefined }, async () => {
    let appele = false;
    const original = async (url) => { appele = true; return { ok: true, url }; };
    const wrapped = wrapperFetch(original);
    const r = await wrapped('https://api.openai.com');
    assert.equal(appele, true);
    assert.equal(r.url, 'https://api.openai.com');
  });
});

test('wrapperFetch — offline ON + URL publique → throw + pas d\'appel', async () => {
  await new Promise((resolve) => {
    withEnv({ AIAD_OFFLINE: '1' }, async () => {
      const d = tmp();
      try {
        let appele = false;
        const original = async () => { appele = true; return { ok: true }; };
        const wrapped = wrapperFetch(original, { racine: d });
        await assert.rejects(
          () => wrapped('https://api.openai.com'),
          /AIAD_OFFLINE=1/,
        );
        assert.equal(appele, false);
      } finally {
        rmSync(d, { recursive: true, force: true });
        resolve();
      }
    });
  });
});

test('wrapperFetch — offline ON + URL locale → laisse passer', async () => {
  await new Promise((resolve) => {
    withEnv({ AIAD_OFFLINE: '1' }, async () => {
      const d = tmp();
      try {
        let appele = false;
        const original = async () => { appele = true; return { ok: true }; };
        const wrapped = wrapperFetch(original, { racine: d });
        await wrapped('http://localhost:11434/x');
        assert.equal(appele, true);
      } finally {
        rmSync(d, { recursive: true, force: true });
        resolve();
      }
    });
  });
});

test('installerGarde — offline OFF → noop, retourne false', () => {
  withEnv({ AIAD_OFFLINE: undefined }, () => {
    const before = globalThis.fetch;
    const r = installerGarde(tmp());
    assert.equal(r, false);
    assert.equal(globalThis.fetch, before);
  });
});

test('installerGarde — idempotent (deuxième appel = no-op)', async () => {
  await new Promise((resolve) => {
    withEnv({ AIAD_OFFLINE: '1' }, () => {
      const before = globalThis.fetch;
      try {
        installerGarde(tmp());
        const wrapped1 = globalThis.fetch;
        installerGarde(tmp()); // doit être idempotent
        assert.equal(globalThis.fetch, wrapped1);
      } finally {
        globalThis.fetch = before;
        resolve();
      }
    });
  });
});

// ─── lireLog / status / afficherLog ───────────────────────────────────────

test('lireLog — fichier absent → []', () => {
  assert.deepEqual(lireLog(tmp()), []);
});

test('lireLog — ligne corrompue ignorée', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad', 'audit'), { recursive: true });
    writeFileSync(
      join(d, '.aiad', 'audit', 'offline-attempts.jsonl'),
      '{"url":"x","bloque":true}\nNOT_JSON\n{"url":"y"}\n',
    );
    assert.equal(lireLog(d).length, 2);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('status --json → JSON avec offline + attempts', () => {
  withEnv({ AIAD_OFFLINE: '1' }, () => {
    const d = tmp();
    try {
      let captured = '';
      const orig = process.stdout.write;
      process.stdout.write = (chunk) => { captured += chunk; return true; };
      try { status(d, { json: true }); }
      finally { process.stdout.write = orig; }
      const parsed = JSON.parse(captured);
      assert.equal(parsed.offline, true);
      assert.equal(parsed.attempts, 0);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

test('status — affichage humain OFF', silent(() => {
  withEnv({ AIAD_OFFLINE: undefined }, () => {
    const r = status(tmp());
    assert.equal(r.offline, false);
  });
}));

test('afficherLog --json → JSON avec attempts', () => {
  const d = tmp();
  try {
    loggerTentative(d, { url: 'https://x', contexte: 'test', bloque: true });
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { afficherLog(d, { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.total, 1);
    assert.equal(parsed.attempts[0].url, 'https://x');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(isOffline, estOffline);
  assert.equal(urlIsLocal, urlEstLocale);
  assert.equal(verifyUrl, verifierUrl);
  assert.equal(wrapFetch, wrapperFetch);
  assert.equal(installGuard, installerGarde);
  assert.equal(readLog, lireLog);
  assert.equal(logAttempt, loggerTentative);
  assert.equal(showStatus, status);
  assert.equal(showLog, afficherLog);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.LOG_PATH, '.aiad/audit/offline-attempts.jsonl');
  assert.ok(CONSTANTS.LOCAL_HOSTS.includes('localhost'));
  assert.ok(CONSTANTS.TLD_INTERNES.includes('.local'));
});
