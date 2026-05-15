// Tests de concurrence pour `emit-rules`.
// Vérifie que deux invocations parallèles ne corrompent pas les fichiers
// dérivés, et que le lock est bien créé/relâché dans .aiad/.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { init } from '../lib/init.js';
import { emitRules } from '../lib/emit-rules.js';

function silencer(fn) {
  return async (...args) => {
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { process.stdout.write = orig; }
  };
}

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-emit-conc-')); }

test('emit-rules — le lock est créé pendant la régénération puis libéré', silencer(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    await emitRules(dir, { runtimes: ['claude-code'] });
    // Après run : le lock doit avoir été libéré
    assert.ok(!existsSync(join(dir, '.aiad', '.emit-rules.lock')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('emit-rules — invocations parallèles produisent un AGENTS.md cohérent', silencer(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    // 3 invocations simultanées
    await Promise.all([
      emitRules(dir, { runtimes: ['claude-code'] }),
      emitRules(dir, { runtimes: ['claude-code'] }),
      emitRules(dir, { runtimes: ['claude-code'] }),
    ]);
    // Lock libéré
    assert.ok(!existsSync(join(dir, '.aiad', '.emit-rules.lock')));
    // AGENTS.md valide (contient bien les sentinels d'idempotence)
    const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
    assert.match(agents, /source-hash:/);
    assert.match(agents, /AGENTS\.md/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('emit-rules --check — pas de lock créé (lecture seule)', silencer(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    await emitRules(dir, { runtimes: ['claude-code'], check: true });
    assert.ok(!existsSync(join(dir, '.aiad', '.emit-rules.lock')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('emit-rules --dry-run — pas de lock créé', silencer(async () => {
  const dir = tmp();
  try {
    await init(dir, {});
    await emitRules(dir, { runtimes: ['claude-code'], dryRun: true });
    assert.ok(!existsSync(join(dir, '.aiad', '.emit-rules.lock')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));
