// Tests d'intégration — génération des subagents de gouvernance Tier 1 (§3.1)
// par emit-rules : .claude/agents/AIAD-*.md, read-only + veto fail-closed.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { init } from '../lib/init.js';
import { emitRules } from '../lib/emit-rules.js';

function silencer(fn) {
  return async (...args) => {
    const o = { log: console.log, err: console.error, warn: console.warn };
    console.log = () => {}; console.error = () => {}; console.warn = () => {};
    try { return await fn(...args); }
    finally { console.log = o.log; console.error = o.err; console.warn = o.warn; }
  };
}

const TIER1 = ['AIAD-RGPD', 'AIAD-RGAA', 'AIAD-AI-ACT', 'AIAD-RGESN'];

test('emit-rules — génère les 4 subagents Tier 1 read-only', silencer(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-agents-'));
  try {
    await init(dir, {});
    await emitRules(dir, { runtimes: ['claude-code'] });

    for (const id of TIER1) {
      const p = join(dir, '.claude', 'agents', `${id}.md`);
      assert.ok(existsSync(p), `${id}.md doit être généré`);
      const c = readFileSync(p, 'utf-8');
      assert.ok(c.includes(`name: ${id}`), `${id}: frontmatter name`);
      assert.ok(/description: PROACTIVELY/.test(c), `${id}: auto-invocation PROACTIVELY`);
      assert.ok(/tools: Read, Grep, Glob/.test(c), `${id}: read-only tools`);
      assert.ok(/disallowedTools:.*Write/.test(c), `${id}: écriture interdite`);
      assert.ok(/memory: project/.test(c), `${id}: mémoire projet`);
      assert.ok(/paths:/.test(c), `${id}: scopé par paths`);
      assert.ok(/UNKNOWN.*VETO/.test(c), `${id}: fail-closed`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('emit-rules --check — détecte une divergence des agents Tier 1', silencer(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-agents-'));
  try {
    await init(dir, {});
    await emitRules(dir, { runtimes: ['claude-code'] });
    // Altère un agent généré → --check doit signaler le drift.
    const p = join(dir, '.claude', 'agents', 'AIAD-RGPD.md');
    const altere = readFileSync(p, 'utf-8') + '\nMODIF MANUELLE\n';
    const { writeFileSync } = await import('node:fs');
    writeFileSync(p, altere, 'utf-8');
    const stats = await emitRules(dir, { runtimes: ['claude-code'], check: true });
    assert.ok(stats.drifts.some((d) => /AIAD-RGPD/.test(d)), 'le drift agent doit être détecté');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));

test('agent Tier 1 — paths scopés par référentiel (RGAA ≠ RGPD)', silencer(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-agents-'));
  try {
    await init(dir, {});
    await emitRules(dir, { runtimes: ['claude-code'] });
    const rgaa = readFileSync(join(dir, '.claude', 'agents', 'AIAD-RGAA.md'), 'utf-8');
    const rgpd = readFileSync(join(dir, '.claude', 'agents', 'AIAD-RGPD.md'), 'utf-8');
    assert.ok(/components/.test(rgaa), 'RGAA scopé sur les composants UI');
    assert.ok(/auth|users|gdpr/.test(rgpd), 'RGPD scopé sur les zones de données');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}));
