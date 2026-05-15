// Tests #139 — Page Legal/Compliance.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { listerPacksInstalles, pageLegal, listInstalledPacks, legalPage } from '../lib/dashboard/legal.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-legal-')); }

test('listerPacksInstalles — dossier absent → []', () => {
  const d = tmp();
  try {
    assert.deepEqual(listerPacksInstalles(d), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerPacksInstalles — détecte les dossiers contenant des AIAD-*.md', () => {
  const d = tmp();
  try {
    const base = join(d, '.aiad', 'gouvernance-packs');
    mkdirSync(join(base, 'fr-anssi'), { recursive: true });
    writeFileSync(join(base, 'fr-anssi', 'AIAD-RGS.md'), '# RGS\n', 'utf-8');
    writeFileSync(join(base, 'fr-anssi', 'AIAD-CNIL.md'), '# CNIL\n', 'utf-8');
    mkdirSync(join(base, 'eu-financial'), { recursive: true });
    writeFileSync(join(base, 'eu-financial', 'AIAD-DORA.md'), '# DORA\n', 'utf-8');
    mkdirSync(join(base, 'empty-pack'), { recursive: true }); // ignoré
    mkdirSync(join(base, 'no-aiad-files'), { recursive: true });
    writeFileSync(join(base, 'no-aiad-files', 'README.md'), 'docs', 'utf-8'); // ignoré
    const r = listerPacksInstalles(d);
    assert.equal(r.length, 2);
    const ids = r.map((p) => p.id).sort();
    assert.deepEqual(ids, ['eu-financial', 'fr-anssi']);
    const fr = r.find((p) => p.id === 'fr-anssi');
    assert.deepEqual(fr.agents.sort(), ['AIAD-CNIL', 'AIAD-RGS']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// (#164) Filtrage via marketplace-catalogue.json
test('listerPacksInstalles — marketplace-catalogue sans installed → fallback FS', () => {
  const d = tmp();
  try {
    const base = join(d, '.aiad', 'gouvernance-packs');
    mkdirSync(join(base, 'fr-anssi'), { recursive: true });
    writeFileSync(join(base, 'fr-anssi', 'AIAD-RGS.md'), '# RGS\n');
    mkdirSync(join(base, 'us-baseline'), { recursive: true });
    writeFileSync(join(base, 'us-baseline', 'AIAD-SOC2.md'), '# SOC2\n');
    // Catalogue présent mais aucun pack avec installed: true → fallback
    writeFileSync(join(d, '.aiad', 'marketplace-catalogue.json'), JSON.stringify({
      packs: [{ id: 'eu-health', title: 'Santé' }, { id: 'fr-anssi', title: 'ANSSI' }],
    }));
    const r = listerPacksInstalles(d);
    assert.equal(r.length, 2, 'sans installed marker → tous les packs scannés');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerPacksInstalles — marketplace-catalogue avec installed → filtre actif', () => {
  const d = tmp();
  try {
    const base = join(d, '.aiad', 'gouvernance-packs');
    for (const id of ['fr-anssi', 'us-baseline', 'eu-platforms']) {
      mkdirSync(join(base, id), { recursive: true });
      writeFileSync(join(base, id, 'AIAD-X.md'), '# X\n');
    }
    writeFileSync(join(d, '.aiad', 'marketplace-catalogue.json'), JSON.stringify({
      packs: [
        { id: 'fr-anssi', installed: true },
        { id: 'us-baseline', installed: false },
        { id: 'eu-platforms', installed: true },
      ],
    }));
    const r = listerPacksInstalles(d);
    const ids = r.map((p) => p.id).sort();
    assert.deepEqual(ids, ['eu-platforms', 'fr-anssi'], 'seuls les packs installed: true');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerPacksInstalles — alias selected/subscribed acceptés (#164)', () => {
  const d = tmp();
  try {
    const base = join(d, '.aiad', 'gouvernance-packs');
    for (const id of ['p1', 'p2', 'p3']) {
      mkdirSync(join(base, id), { recursive: true });
      writeFileSync(join(base, id, 'AIAD-X.md'), '# X\n');
    }
    writeFileSync(join(d, '.aiad', 'marketplace-catalogue.json'), JSON.stringify({
      packs: [{ id: 'p1', selected: true }, { id: 'p2', subscribed: true }, { id: 'p3' }],
    }));
    const r = listerPacksInstalles(d);
    assert.equal(r.length, 2);
    assert.deepEqual(r.map((p) => p.id).sort(), ['p1', 'p2']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerPacksInstalles — JSON catalogue corrompu → fallback FS (fail-safe)', () => {
  const d = tmp();
  try {
    const base = join(d, '.aiad', 'gouvernance-packs');
    mkdirSync(join(base, 'fr-anssi'), { recursive: true });
    writeFileSync(join(base, 'fr-anssi', 'AIAD-RGS.md'), '# RGS\n');
    writeFileSync(join(d, '.aiad', 'marketplace-catalogue.json'), '{ malformé', 'utf-8');
    const r = listerPacksInstalles(d);
    assert.equal(r.length, 1, 'JSON cassé → fallback FS');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('pageLegal — projet sans supplementaire → 4 empty states amicales', () => {
  const html = pageLegal({});
  assert.match(html, /AI Act \(Annexe IV\)/);
  assert.match(html, /Aucun audit AI Act|0/);
  assert.match(html, /Aucun DPIA|0/);
  assert.match(html, /Packs juridictionnels/);
});

test('pageLegal — audit AI Act complet (8/8) → label ok', () => {
  const html = pageLegal({
    supplementaire: {
      aiAct: {
        total: 1,
        latest: { sectionsCount: 8, aCompleter: 0, complete: true, file: '.aiad/metrics/ai-act/AUDIT-2026-05-13.md', sections: Array.from({ length: 8 }, (_, i) => `Section ${i + 1}`) },
        fichiers: [],
      },
    },
    legalPacks: [],
  });
  assert.match(html, /Audit complet/);
  assert.match(html, /8\/8 sections/);
});

test('pageLegal — DPIA avec sections "à compléter" → badge warn + liste sections', () => {
  const html = pageLegal({
    supplementaire: {
      dpia: {
        total: 1,
        latest: {
          date: '2026-05-13',
          sectionsCount: 3,
          aCompleter: 3,
          complete: false,
          file: '.aiad/metrics/rgpd/DPIA-2026-05-13.md',
          sections: ['1. Contexte', '2. Données traitées', '3. Risques'],
        },
        fichiers: [
          { file: '.aiad/metrics/rgpd/DPIA-2026-05-13.md', date: '2026-05-13', sectionsCount: 3, aCompleter: 3 },
        ],
      },
    },
    legalPacks: [],
  });
  assert.match(html, /à compléter par le DPO/);
  assert.match(html, /badge warn">3/);
  // #166 — Sections détaillées exposées dans un <details>
  assert.match(html, /Sections du DPIA le plus récent/);
  assert.match(html, /1\. Contexte/);
  assert.match(html, /2\. Données traitées/);
  assert.match(html, /3\. Risques/);
});

test('pageLegal — sovereignty Gold/Platinum → cls ok', () => {
  const html = pageLegal({
    supplementaire: {
      sovereignty: { available: true, score: 85, maxScore: 100, level: 'Gold', dimensions: { juridictions: { score: 20 }, agentsTier1: { score: 15 } } },
    },
    legalPacks: [],
  });
  assert.match(html, /Gold/);
  assert.match(html, /85\/100/);
});

test('pageLegal — packs installés → table avec agents', () => {
  const html = pageLegal({
    legalPacks: [
      { id: 'fr-anssi', agents: ['AIAD-RGS', 'AIAD-CNIL'], file: '.aiad/gouvernance-packs/fr-anssi' },
      { id: 'eu-financial', agents: ['AIAD-DORA', 'AIAD-PSD2'], file: '.aiad/gouvernance-packs/eu-financial' },
    ],
  });
  assert.match(html, /2 installé\(s\)/);
  assert.match(html, /fr-anssi/);
  assert.match(html, /AIAD-DORA/);
});

// (#352) Pack agents Tier 1 hyperliés vers gouvernance/AIAD-XXX.md quand installés localement
test('#352 pageLegal — agents Tier 1 d\'un pack hyperliés vers .aiad/gouvernance/AIAD-X.md (quand fichier présent)', () => {
  const html = pageLegal({
    legalPacks: [{ id: 'fr-anssi', agents: ['AIAD-RGS', 'AIAD-RGPD'], file: '.aiad/gouvernance-packs/fr-anssi' }],
    gouvernance: [
      // AIAD-RGS pas installé localement (file null) → reste <code>
      { id: 'AIAD-RGS', present: false, file: null },
      // AIAD-RGPD installé localement → hyperlié
      { id: 'AIAD-RGPD', present: true, file: '.aiad/gouvernance/AIAD-RGPD.md' },
    ],
  });
  // AIAD-RGPD hyperlié
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/gouvernance\/AIAD-RGPD\.md"[^>]*>AIAD-RGPD<\/a>/);
  // AIAD-RGS reste <code> (pas installé)
  assert.match(html, /<code>AIAD-RGS<\/code>/);
});

test('Alias EN canoniques exposés', () => {
  assert.equal(listInstalledPacks, listerPacksInstalles);
  assert.equal(legalPage, pageLegal);
});
