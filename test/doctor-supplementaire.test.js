// Tests #154 — `doctor --supplementaire` : checks SBOM/DPIA/AI Act/sovereignty.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { init } from '../lib/init.js';
import { doctor } from '../lib/doctor.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-doctor-supp-')); }

async function setupAiad(dir) {
  await init(dir, { quiet: true });
}

test('doctor() sans --supplementaire → checks classiques uniquement', async () => {
  const dir = tmp();
  try {
    await setupAiad(dir);
    const r = await doctor(dir, { json: true });
    const ids = r.checks.map((c) => c.id);
    assert.ok(!ids.some((i) => i.startsWith('supplementaire:')), 'pas de checks supplementaire par défaut');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('doctor({ supplementaire: true }) → 4 nouveaux checks SBOM/DPIA/AI Act/Sovereignty', async () => {
  const dir = tmp();
  try {
    await setupAiad(dir);
    const r = await doctor(dir, { json: true, supplementaire: true });
    const ids = r.checks.map((c) => c.id);
    for (const expected of ['supplementaire:sbom', 'supplementaire:dpia', 'supplementaire:ai-act', 'supplementaire:sovereignty']) {
      assert.ok(ids.includes(expected), `${expected} attendu`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('doctor supplementaire — SBOM absent → check warn', async () => {
  const dir = tmp();
  try {
    await setupAiad(dir);
    const r = await doctor(dir, { json: true, supplementaire: true });
    const sbom = r.checks.find((c) => c.id === 'supplementaire:sbom');
    assert.equal(sbom.ok, false);
    assert.equal(sbom.severity, 'warn');
    assert.match(sbom.message, /SBOM absent/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('doctor supplementaire — SBOM présent → check ok avec count', async () => {
  const dir = tmp();
  try {
    await setupAiad(dir);
    writeFileSync(join(dir, 'sbom.cdx.json'), JSON.stringify({
      bomFormat: 'CycloneDX',
      specVersion: '1.5',
      components: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
    }), 'utf-8');
    const r = await doctor(dir, { json: true, supplementaire: true });
    const sbom = r.checks.find((c) => c.id === 'supplementaire:sbom');
    assert.equal(sbom.ok, true);
    assert.match(sbom.message, /3 composant/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('doctor supplementaire — DPIA absent → severity info (pas warn)', async () => {
  const dir = tmp();
  try {
    await setupAiad(dir);
    const r = await doctor(dir, { json: true, supplementaire: true });
    const dpia = r.checks.find((c) => c.id === 'supplementaire:dpia');
    assert.equal(dpia.severity, 'info'); // tolérant : hors scope RGPD possible
    assert.match(dpia.message, /aucun DPIA généré/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('doctor supplementaire — AI Act > 6 placeholders → warn', async () => {
  const dir = tmp();
  try {
    await setupAiad(dir);
    mkdirSync(join(dir, '.aiad', 'metrics', 'ai-act'), { recursive: true });
    // 8 sections avec 7 "(à compléter)"
    const sections = Array.from({ length: 8 }, (_, i) => `## ${i + 1}. Section ${i + 1}\n${i < 7 ? '(à compléter)' : 'OK'}\n`).join('\n');
    writeFileSync(join(dir, '.aiad', 'metrics', 'ai-act', 'AUDIT-2026-05-13.md'), sections, 'utf-8');
    const r = await doctor(dir, { json: true, supplementaire: true });
    const ai = r.checks.find((c) => c.id === 'supplementaire:ai-act');
    assert.equal(ai.severity, 'warn');
    assert.match(ai.message, /7 à compléter/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('doctor supplementaire — sortie JSON inclut leadership ET supplementaire', async () => {
  const dir = tmp();
  try {
    await setupAiad(dir);
    const origWrite = process.stdout.write.bind(process.stdout);
    let buf = '';
    process.stdout.write = (chunk) => { buf += chunk; return true; };
    try { await doctor(dir, { json: true, supplementaire: true }); }
    finally { process.stdout.write = origWrite; }
    const parsed = JSON.parse(buf);
    assert.ok(parsed.leadership, 'leadership présent (existant)');
    assert.ok(parsed.checks.some((c) => c.id.startsWith('supplementaire:')), 'checks supplementaire présents');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
