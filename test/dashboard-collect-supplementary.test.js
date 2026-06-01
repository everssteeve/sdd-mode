// Tests #134 — Collecteurs supplémentaires : DPIA / AI Act / SBOM / Sovereignty / Hook stats.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  lireDpia, lireAiAct, lireSbom, lireSovereignty, lireHookStats,
  collecterDonneesSupplementaires,
  readDpia, readAiAct, readSbom, readSovereignty, readHookStats,
  collectSupplementaryData,
} from '../lib/dashboard/collect-supplementary.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-supp-')); }

function ecrire(p, contenu) {
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, contenu, 'utf-8');
}

test('lireDpia — dossier absent → total 0, latest null', () => {
  const d = tmp();
  try {
    const r = lireDpia(d);
    assert.equal(r.total, 0);
    assert.equal(r.latest, null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireDpia — parse sections + détecte sections "(à compléter)"', () => {
  const d = tmp();
  try {
    const path = join(d, '.aiad', 'metrics', 'rgpd', 'DPIA-2026-05-13.md');
    ecrire(path, `# DPIA\n## 1. Contexte\nOK\n## 2. Données traitées\n(à compléter)\n## 3. Risques\nIdentifiés\n`);
    const r = lireDpia(d);
    assert.equal(r.total, 1);
    assert.equal(r.latest.date, '2026-05-13');
    assert.equal(r.latest.sectionsCount, 3);
    assert.equal(r.latest.aCompleter, 1);
    assert.equal(r.latest.complete, false);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireDpia — tri par date descendante', () => {
  const d = tmp();
  try {
    ecrire(join(d, '.aiad', 'metrics', 'rgpd', 'DPIA-2026-04-01.md'), '## 1. X\n');
    ecrire(join(d, '.aiad', 'metrics', 'rgpd', 'DPIA-2026-05-13.md'), '## 1. X\n');
    const r = lireDpia(d);
    assert.equal(r.fichiers[0].date, '2026-05-13');
    assert.equal(r.fichiers[1].date, '2026-04-01');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireAiAct — 8 sections complètes → complete=true', () => {
  const d = tmp();
  try {
    const sections = Array.from({ length: 8 }, (_, i) => `## ${i + 1}. Section ${i + 1}\nOK\n`).join('\n');
    ecrire(join(d, '.aiad', 'metrics', 'ai-act', 'AUDIT-2026-05-13.md'), sections);
    const r = lireAiAct(d);
    assert.equal(r.latest.sectionsCount, 8);
    assert.equal(r.latest.aCompleter, 0);
    assert.equal(r.latest.complete, true);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireAiAct — moins de 8 sections → complete=false même sans (à compléter)', () => {
  const d = tmp();
  try {
    ecrire(join(d, '.aiad', 'metrics', 'ai-act', 'AUDIT-2026-05-13.md'), '## 1. Une section\nOK\n');
    const r = lireAiAct(d);
    assert.equal(r.latest.complete, false);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireSbom — sbom.cdx.json détecté, components comptés', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'sbom.cdx.json'), JSON.stringify({
      bomFormat: 'CycloneDX',
      specVersion: '1.5',
      components: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
    }), 'utf-8');
    const r = lireSbom(d);
    assert.equal(r.present, true);
    assert.equal(r.format, 'CycloneDX');
    assert.equal(r.specVersion, '1.5');
    assert.equal(r.components, 3);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireSbom — absent → present=false', () => {
  const d = tmp();
  try {
    const r = lireSbom(d);
    assert.equal(r.present, false);
    assert.equal(r.components, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireSbom — JSON invalide → present=true, format=invalid (pas de crash)', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'sbom.cdx.json'), '{ not json', 'utf-8');
    const r = lireSbom(d);
    assert.equal(r.present, true);
    assert.equal(r.format, 'invalid');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireSovereignty — projet sans .aiad → available=true mais score bas (pas de crash)', () => {
  const d = tmp();
  try {
    const r = lireSovereignty(d);
    assert.equal(r.available, true);
    assert.ok(typeof r.score === 'number');
    assert.ok(['Bronze', 'Silver', 'Gold', 'Platinum'].includes(r.level));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireHookStats — pas de hook-runs.jsonl → available=false count=0', () => {
  const d = tmp();
  try {
    const r = lireHookStats(d);
    assert.equal(r.available, false);
    assert.equal(r.count, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('collecterDonneesSupplementaires — façade renvoie les 5 clés', () => {
  const d = tmp();
  try {
    const r = collecterDonneesSupplementaires(d);
    assert.ok('dpia' in r);
    assert.ok('aiAct' in r);
    assert.ok('sbom' in r);
    assert.ok('sovereignty' in r);
    assert.ok('hookStats' in r);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('Alias EN canoniques exposés', () => {
  assert.equal(typeof readDpia, 'function');
  assert.equal(typeof readAiAct, 'function');
  assert.equal(typeof readSbom, 'function');
  assert.equal(typeof readSovereignty, 'function');
  assert.equal(typeof readHookStats, 'function');
  assert.equal(typeof collectSupplementaryData, 'function');
});
