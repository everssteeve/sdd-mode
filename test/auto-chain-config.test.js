// Tests lib/auto-chain-config.js — CA-1 à CA-6 (SPEC-031-3).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lireConfigAutoChain, readAutoChainConfig } from '../lib/auto-chain-config.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-acc-')); }

function ecrireConfig(racine, contenu) {
  const dir = join(racine, '.aiad');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.yml'), contenu);
}

// ─── CA-1 : config absente → defaults ─────────────────────────────────────

test('CA-1a — .aiad/config.yml absent → defaults', () => {
  const d = tmp();
  try {
    assert.deepEqual(lireConfigAutoChain(d), { enabled: true, max_context_pct: 40 });
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('CA-1b — section auto_chain absente → defaults', () => {
  const d = tmp();
  try {
    ecrireConfig(d, 'hooks:\n  pre_commit: block\n');
    assert.deepEqual(lireConfigAutoChain(d), { enabled: true, max_context_pct: 40 });
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── CA-2 : valeurs présentes → lues ──────────────────────────────────────

test('CA-2 — auto_chain présent avec enabled: false et max_context_pct: 60', () => {
  const d = tmp();
  try {
    ecrireConfig(d, 'auto_chain:\n  enabled: false\n  max_context_pct: 60\n');
    assert.deepEqual(lireConfigAutoChain(d), { enabled: false, max_context_pct: 60 });
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── CA-3 : max_context_pct invalide → 40 + warning stderr ───────────────

test('CA-3 — max_context_pct: "invalid" → retourne 40, émet warning stderr', () => {
  const d = tmp();
  const messages = [];
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (msg, ...rest) => { messages.push(msg); return origWrite(msg, ...rest); };
  try {
    ecrireConfig(d, 'auto_chain:\n  enabled: true\n  max_context_pct: "invalid"\n');
    const result = lireConfigAutoChain(d);
    assert.equal(result.max_context_pct, 40);
    assert.ok(messages.some((m) => m.includes('max_context_pct')), 'warning stderr attendu');
  } finally {
    process.stderr.write = origWrite;
    rmSync(d, { recursive: true, force: true });
  }
});

test('CA-3b — max_context_pct hors [1, 100] → retourne 40, émet warning', () => {
  const d = tmp();
  const messages = [];
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (msg, ...rest) => { messages.push(msg); return origWrite(msg, ...rest); };
  try {
    ecrireConfig(d, 'auto_chain:\n  enabled: true\n  max_context_pct: 150\n');
    const result = lireConfigAutoChain(d);
    assert.equal(result.max_context_pct, 40);
    assert.ok(messages.some((m) => m.includes('max_context_pct')), 'warning stderr attendu');
  } finally {
    process.stderr.write = origWrite;
    rmSync(d, { recursive: true, force: true });
  }
});

// ─── CA-4 : template contient la section ──────────────────────────────────

test('CA-4 — templates/.aiad/config.yml contient auto_chain', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const templatePath = join(root, 'templates', '.aiad', 'config.yml');
  assert.ok(existsSync(templatePath), 'template config.yml absent');
  const contenu = readFileSync(templatePath, 'utf-8');
  assert.ok(contenu.includes('auto_chain:'), 'section auto_chain manquante dans le template');
  assert.ok(contenu.includes('enabled:'), 'clé enabled manquante dans le template');
  assert.ok(contenu.includes('max_context_pct:'), 'clé max_context_pct manquante dans le template');
});

// ─── CA-5 : .aiad/config.yml du repo contient auto_chain enabled: true ───

test('CA-5 — .aiad/config.yml du repo contient auto_chain avec enabled: true', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const configPath = join(root, '.aiad', 'config.yml');
  assert.ok(existsSync(configPath), '.aiad/config.yml absent');
  const contenu = readFileSync(configPath, 'utf-8');
  assert.ok(contenu.includes('auto_chain:'), 'section auto_chain manquante');
  assert.ok(contenu.includes('enabled: true'), 'enabled: true manquant');
});

// ─── CA-6 : alias EN disponible ───────────────────────────────────────────

test('CA-6 — alias EN readAutoChainConfig fonctionne', () => {
  const d = tmp();
  try {
    assert.deepEqual(readAutoChainConfig(d), { enabled: true, max_context_pct: 40 });
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── Cas limites supplémentaires ──────────────────────────────────────────

test('YAML malformé → defaults silencieux (pas de throw)', () => {
  const d = tmp();
  try {
    ecrireConfig(d, ':::malformed yaml:::\n  ----\n');
    assert.doesNotThrow(() => lireConfigAutoChain(d));
    assert.deepEqual(lireConfigAutoChain(d), { enabled: true, max_context_pct: 40 });
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('enabled non-booléen → default true + warning stderr', () => {
  const d = tmp();
  const messages = [];
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (msg, ...rest) => { messages.push(msg); return origWrite(msg, ...rest); };
  try {
    ecrireConfig(d, 'auto_chain:\n  enabled: "yes"\n  max_context_pct: 40\n');
    const result = lireConfigAutoChain(d);
    assert.equal(result.enabled, true);
    assert.ok(messages.some((m) => m.includes('enabled')), 'warning stderr attendu');
  } finally {
    process.stderr.write = origWrite;
    rmSync(d, { recursive: true, force: true });
  }
});
