// Tests d'intégration — génération des règles à chargement ciblé `paths:`
// (.claude/rules/*.md) par emit-rules + réglages de budget (push → pull, §3.7).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { init } from '../lib/init.js';
import { emitRules, GLOBS_RULES, nomRule } from '../lib/emit-rules.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function silencer(fn) {
  return async (...args) => {
    const o = { log: console.log, err: console.error, warn: console.warn };
    console.log = () => {}; console.error = () => {}; console.warn = () => {};
    try { return await fn(...args); }
    finally { console.log = o.log; console.error = o.err; console.warn = o.warn; }
  };
}

const TIER1 = ['AIAD-RGPD', 'AIAD-RGAA', 'AIAD-AI-ACT', 'AIAD-RGESN'];

test('nomRule — AIAD-RGPD → rgpd, AIAD-AI-ACT → ai-act', () => {
  assert.equal(nomRule('AIAD-RGPD'), 'rgpd');
  assert.equal(nomRule('AIAD-AI-ACT'), 'ai-act');
  assert.equal(nomRule('AIAD-RGESN'), 'rgesn');
});

test('emit-rules — génère les 4 règles .claude/rules/*.md avec paths:', silencer(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-rules-'));
  try {
    await init(dir, {});
    await emitRules(dir, { runtimes: ['claude-code'] });
    for (const id of TIER1) {
      const p = join(dir, '.claude', 'rules', `${nomRule(id)}.md`);
      assert.ok(existsSync(p), `${nomRule(id)}.md doit être généré`);
      const c = readFileSync(p, 'utf-8');
      assert.ok(/^---\npaths:/m.test(c) || c.startsWith('---\npaths:'), `${id}: frontmatter paths:`);
      // Chaque glob de la zone doit apparaître dans le frontmatter.
      for (const g of GLOBS_RULES[id]) {
        assert.ok(c.includes(g), `${id}: glob ${g} présent`);
      }
      // Rappelle que le vrai garde-fou reste enforced (complémentarité §3.1).
      assert.ok(/enforced/i.test(c), `${id}: mentionne la couche enforced`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('règle RGPD ≠ RGAA — paths scopés par zone de risque', silencer(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-rules-'));
  try {
    await init(dir, {});
    await emitRules(dir, { runtimes: ['claude-code'] });
    const rgpd = readFileSync(join(dir, '.claude', 'rules', 'rgpd.md'), 'utf-8');
    const rgaa = readFileSync(join(dir, '.claude', 'rules', 'rgaa.md'), 'utf-8');
    assert.ok(/auth|users|gdpr/.test(rgpd), 'RGPD scopé données');
    assert.ok(/components|\.vue/.test(rgaa), 'RGAA scopé UI');
    // RGESN resserré sur les fichiers de ressources/deps (pas **/* qui = toujours).
    const rgesn = readFileSync(join(dir, '.claude', 'rules', 'rgesn.md'), 'utf-8');
    assert.ok(/package\.json|Dockerfile|\.lock/.test(rgesn), 'RGESN scopé ressources/deps');
    assert.ok(!/- "\*\*\/\*"/.test(rgesn.split('---')[1] || ''), 'RGESN ne charge pas sur **/*');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

test('emit-rules --check — détecte une divergence des règles pull', silencer(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-rules-'));
  try {
    await init(dir, {});
    await emitRules(dir, { runtimes: ['claude-code'] });
    const p = join(dir, '.claude', 'rules', 'rgpd.md');
    writeFileSync(p, readFileSync(p, 'utf-8') + '\nMODIF MANUELLE\n', 'utf-8');
    const stats = await emitRules(dir, { runtimes: ['claude-code'], check: true });
    assert.ok(stats.drifts.some((d) => /rules.*rgpd/.test(d)), 'drift de règle détecté');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}));

// ─── Réglages de budget (settings.json émis) ────────────────────────────────

test('settings.json — réglages de budget §3.7 présents et valides', () => {
  const p = join(__dirname, '..', 'templates', '.claude', 'settings.json');
  const s = JSON.parse(readFileSync(p, 'utf-8'));
  assert.equal(s.env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE, '65');
  assert.equal(s.skillListingMaxDescChars, 1536);
  assert.equal(s.skillListingBudgetFraction, 0.01);
});
