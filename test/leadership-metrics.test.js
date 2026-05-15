// Tests métriques de leadership EU/FR.
// Calcul pur, vérifie chaque indicateur isolément + l'agrégation
// `computeLeadershipMetrics` exposée dans `doctor --json`.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  calculerHumanAuthorship, calculerGovernanceCoverage, calculerTraceCompleteness,
  calculerLangueArtefacts, computeLeadershipMetrics,
  enregistrerSnapshotLeadership, lireHistoireLeadership, blocLeadership,
} from '../lib/leadership-metrics.js';
import { construireMatrice } from '../lib/sdd-trace.js';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-leader-'));
  mkdirSync(join(dir, '.aiad', 'intents'), { recursive: true });
  mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
  return dir;
}

test('humanAuthorshipRatio — Intent vide / court / suffisant', () => {
  const d = fixture();
  try {
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-001.md'), '# Vide\n', 'utf-8');
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-002.md'), '# T\n\nx', 'utf-8'); // 5 chars body
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-003.md'),
      '# Auth\n\nLes utilisateurs doivent pouvoir se connecter de façon sécurisée et durable.\n', 'utf-8');

    const r = calculerHumanAuthorship(d);
    assert.equal(r.total, 3);
    assert.equal(r.sufficient, 1, 'seul l\'Intent 003 dépasse 50 chars');
    assert.equal(r.ratio, 1 / 3);
    assert.equal(r.seuilCharsMinimum, 50);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('humanAuthorshipRatio — projet vierge → ratio null', () => {
  const d = fixture();
  try {
    const r = calculerHumanAuthorship(d);
    assert.equal(r.total, 0);
    assert.equal(r.ratio, null);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('governanceCoverage — fichier sensible annoté @governance compté', () => {
  const d = fixture();
  try {
    mkdirSync(join(d, 'src', 'auth'), { recursive: true });
    mkdirSync(join(d, 'src', 'helpers'), { recursive: true });
    // sensible + annoté → couvert
    writeFileSync(join(d, 'src', 'auth', 'login.ts'),
      '// @spec SPEC-001-1\n// @governance AIAD-RGPD\nexport {};\n', 'utf-8');
    // sensible mais NON annoté → non couvert
    writeFileSync(join(d, 'src', 'auth', 'session.ts'),
      '// @spec SPEC-001-2\nexport {};\n', 'utf-8');
    // hors chemin sensible → ignoré dans le calcul
    writeFileSync(join(d, 'src', 'helpers', 'utils.ts'),
      '// @spec SPEC-001-3\nexport {};\n', 'utf-8');

    const r = calculerGovernanceCoverage(d);
    assert.equal(r.sensitiveFiles, 2);
    assert.equal(r.governedFiles, 1);
    assert.equal(r.ratio, 0.5);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('traceCompleteness — SPECs avec code+tests vs incomplètes', () => {
  const d = fixture();
  try {
    mkdirSync(join(d, 'src'), { recursive: true });
    mkdirSync(join(d, 'tests'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-001.md'), `---
status: active
---

# I
`, 'utf-8');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-complet.md'), `---
parent_intent: INTENT-001
status: ready
---

# Spec complète
`, 'utf-8');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-2-incomplet.md'), `---
parent_intent: INTENT-001
status: ready
---

# Spec sans test
`, 'utf-8');

    writeFileSync(join(d, 'src', 'a.ts'), '// @spec SPEC-001-1-complet\nexport {};\n');
    writeFileSync(join(d, 'src', 'b.ts'), '// @spec SPEC-001-2-incomplet\nexport {};\n');
    writeFileSync(join(d, 'tests', 'a.test.ts'), '// @spec SPEC-001-1-complet\n');
    // pas de test pour SPEC-001-2

    const matrice = construireMatrice(d);
    const r = calculerTraceCompleteness(matrice);
    assert.equal(r.total, 2);
    assert.equal(r.complete, 1);
    assert.equal(r.ratio, 0.5);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('langueArtefacts — classe FR / EN / mixed / neutral', () => {
  const d = fixture();
  try {
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-001.md'), '# Authentifier les utilisateurs avec un compte sécurisé\n', 'utf-8');
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-002.md'), '# Authenticate users with a secure account\n', 'utf-8');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-mix.md'), '# Login flow et auth des utilisateurs\n', 'utf-8');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-2-tech.md'), '# OAuth2 PKCE\n', 'utf-8');

    const r = calculerLangueArtefacts(d);
    assert.equal(r.total, 4);
    // L'Intent FR doit clairement classer FR
    assert.ok(r.fr >= 1, `FR=${r.fr}`);
    assert.ok(r.en >= 1, `EN=${r.en}`);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('langueArtefacts — projet vierge → tous zéros', () => {
  const d = fixture();
  try {
    const r = calculerLangueArtefacts(d);
    assert.deepEqual(r, { fr: 0, en: 0, mixed: 0, neutral: 0, total: 0 });
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('computeLeadershipMetrics — agrégation 4 indicateurs présents', () => {
  const d = fixture();
  try {
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-001.md'),
      '# Une intention\n\nDescription suffisamment longue pour passer le seuil de 50 caractères imposé.\n', 'utf-8');

    const r = computeLeadershipMetrics(d);
    assert.ok(r.humanAuthorshipRatio);
    assert.ok(r.governanceCoverage);
    assert.ok(r.traceCompleteness);
    assert.ok(r.langueArtefacts);
    assert.equal(r.humanAuthorshipRatio.total, 1);
    assert.equal(r.humanAuthorshipRatio.sufficient, 1);
    assert.equal(r.humanAuthorshipRatio.ratio, 1);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('doctor --json — inclut le bloc `leadership`', async () => {
  const { init } = await import('../lib/init.js');
  const { doctor } = await import('../lib/doctor.js');
  const dir = mkdtempSync(join(tmpdir(), 'aiad-doctor-leader-'));
  try {
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try { await init(dir, {}); }
    finally { process.stdout.write = origWrite; }

    let buf = '';
    process.stdout.write = (chunk) => { buf += chunk; return true; };
    try { await doctor(dir, { json: true }); }
    finally { process.stdout.write = origWrite; }

    const parsed = JSON.parse(buf);
    assert.ok(parsed.leadership, 'champ leadership absent');
    assert.ok('humanAuthorshipRatio' in parsed.leadership);
    assert.ok('governanceCoverage' in parsed.leadership);
    assert.ok('traceCompleteness' in parsed.leadership);
    assert.ok('langueArtefacts' in parsed.leadership);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ─── #169 Historique mensuel ─────────────────────────────────────────────────

test('enregistrerSnapshotLeadership — écrit YYYY-MM.json avec ratios', () => {
  const d = fixture();
  try {
    const r = enregistrerSnapshotLeadership(d, {
      humanAuthorshipRatio: { ratio: 0.85 },
      governanceCoverage: { ratio: 0.6 },
      traceCompleteness: { ratio: 0.95 },
      langueArtefacts: { fr: 10, en: 0, mixed: 0, neutral: 5, total: 15 },
    }, { mois: '2026-05' });
    assert.match(r.file, /2026-05\.json$/);
    const payload = JSON.parse(readFileSync(r.file, 'utf-8'));
    assert.equal(payload.humanAuthorshipRatio, 0.85);
    assert.equal(payload.governanceCoverage, 0.6);
    assert.equal(payload.traceCompleteness, 0.95);
    assert.equal(payload.langueArtefacts.fr, 10);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('enregistrerSnapshotLeadership — idempotent (re-écrit le même mois)', () => {
  const d = fixture();
  try {
    enregistrerSnapshotLeadership(d, { humanAuthorshipRatio: { ratio: 0.5 } }, { mois: '2026-05' });
    enregistrerSnapshotLeadership(d, { humanAuthorshipRatio: { ratio: 0.7 } }, { mois: '2026-05' });
    const h = lireHistoireLeadership(d);
    assert.equal(h.length, 1);
    assert.equal(h[0].humanAuthorshipRatio, 0.7, 'la 2e écriture écrase la 1ère');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireHistoireLeadership — dossier absent → []', () => {
  const d = fixture();
  try {
    assert.deepEqual(lireHistoireLeadership(d), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireHistoireLeadership — tri ascendant + limite derniersMois', () => {
  const d = fixture();
  try {
    for (const mois of ['2026-03', '2026-01', '2026-05', '2026-04', '2026-02']) {
      enregistrerSnapshotLeadership(d, { humanAuthorshipRatio: { ratio: 0.5 } }, { mois });
    }
    const h = lireHistoireLeadership(d, { derniersMois: 3 });
    assert.equal(h.length, 3);
    assert.deepEqual(h.map((x) => x.mois), ['2026-03', '2026-04', '2026-05']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('blocLeadership — sparkline rendue si ≥ 2 points historiques (#169)', () => {
  const html = blocLeadership({
    signaux: {
      leadership: {
        humanAuthorshipRatio: { ratio: 0.85, sufficient: 17, total: 20 },
        governanceCoverage: { ratio: null, sensitiveFiles: 0, governedFiles: 0 },
        traceCompleteness: { ratio: 0.9, complete: 9, total: 10 },
        langueArtefacts: { fr: 10, en: 0, mixed: 0, neutral: 5 },
      },
      leadershipHistory: [
        { mois: '2026-03', humanAuthorshipRatio: 0.7, governanceCoverage: null, traceCompleteness: 0.6 },
        { mois: '2026-04', humanAuthorshipRatio: 0.8, governanceCoverage: null, traceCompleteness: 0.75 },
        { mois: '2026-05', humanAuthorshipRatio: 0.85, governanceCoverage: null, traceCompleteness: 0.9 },
      ],
    },
  });
  assert.match(html, /Évolution sur 3 mois \(de 2026-03 à 2026-05\)/);
  // sparklines SVG sur HA et TC (mais pas GC car null)
  assert.match(html, /<svg class="spark"/);
  const sparkCount = (html.match(/<svg class="spark"/g) || []).length;
  assert.ok(sparkCount >= 2, `attendu ≥2 sparklines, vu ${sparkCount}`);
});

test('blocLeadership — pas d\'historique → pas de sparkline ni de légende', () => {
  const html = blocLeadership({
    signaux: {
      leadership: {
        humanAuthorshipRatio: { ratio: 0.85, sufficient: 17, total: 20 },
        governanceCoverage: { ratio: 0.5, sensitiveFiles: 10, governedFiles: 5 },
        traceCompleteness: { ratio: 0.9, complete: 9, total: 10 },
        langueArtefacts: { fr: 10 },
      },
    },
  });
  assert.ok(!html.includes('Évolution sur'), 'pas de légende historique');
  assert.ok(!html.includes('<svg class="spark"'), 'pas de sparkline');
});
