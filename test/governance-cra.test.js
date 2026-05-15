// Tests agent Tier 1 AIAD-CRA — Cyber Resilience Act EU 2024/2847.
// Le CRA entre en application générale le 11 décembre 2027 ; l'agent est
// installé dès aujourd'hui pour anticiper la conformité.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { addGovernance } from '../lib/governance.js';
import { init } from '../lib/init.js';
import { doctor } from '../lib/doctor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CRA_TEMPLATE = join(__dirname, '..', 'templates', '.aiad', 'gouvernance', 'AIAD-CRA.md');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-cra-')); }

function silencer(fn) {
  return async (...args) => {
    const origLog = console.log;
    const origWrite = process.stdout.write.bind(process.stdout);
    console.log = () => {};
    process.stdout.write = () => true;
    try { return await fn(...args); }
    finally { console.log = origLog; process.stdout.write = origWrite; }
  };
}

test('AIAD-CRA — template présent dans le repo', () => {
  assert.ok(existsSync(CRA_TEMPLATE), 'AIAD-CRA.md absent du dossier templates');
});

test('AIAD-CRA — référence Règlement (UE) 2024/2847 explicite', () => {
  const c = readFileSync(CRA_TEMPLATE, 'utf-8');
  assert.match(c, /Règlement \(UE\) 2024\/2847/);
  assert.match(c, /Cyber Resilience Act/i);
});

test('AIAD-CRA — calendrier d\'application documenté (11 sept 2026 et 11 déc 2027)', () => {
  const c = readFileSync(CRA_TEMPLATE, 'utf-8');
  assert.match(c, /11 septembre 2026/);
  assert.match(c, /11 décembre 2027/);
});

test('AIAD-CRA — sanctions Article 64 documentées (15 M€, 2,5%)', () => {
  const c = readFileSync(CRA_TEMPLATE, 'utf-8');
  assert.match(c, /Article 64/);
  assert.match(c, /15 (millions €|M€)/);
  assert.match(c, /2,5\s*%/);
});

test('AIAD-CRA — 13 exigences essentielles Annexe I Partie I', () => {
  const c = readFileSync(CRA_TEMPLATE, 'utf-8');
  // Échantillon des thèmes attendus de l'Annexe I.I
  assert.match(c, /secure-by-design/i);
  assert.match(c, /Configuration sécurisée par défaut/i);
  assert.match(c, /Confidentialité/);
  assert.match(c, /Intégrité/);
  assert.match(c, /Minimisation des données/);
  assert.match(c, /Disponibilité/);
  assert.match(c, /Surface d'attaque/);
  assert.match(c, /Effacement sécurisé/);
  assert.match(c, /Mises à jour de sécurité/);
  assert.match(c, /Authentification/);
});

test('AIAD-CRA — 8 obligations gestion des vulnérabilités Annexe I Partie II', () => {
  const c = readFileSync(CRA_TEMPLATE, 'utf-8');
  assert.match(c, /SBOM/);
  assert.match(c, /CycloneDX/);
  assert.match(c, /Politique de divulgation responsable/);
  assert.match(c, /signer/i);
  assert.match(c, /SECURITY\.md/);
});

test('AIAD-CRA — Article 14 signalement (24h / 72h / 14j)', () => {
  const c = readFileSync(CRA_TEMPLATE, 'utf-8');
  assert.match(c, /Article 14/);
  assert.match(c, /24\s*(heures|h)/);
  assert.match(c, /72\s*(heures|h)/);
  assert.match(c, /14\s*jours/);
  assert.match(c, /ENISA/);
});

test('AIAD-CRA — sections obligatoires (MISSION, PROTOCOLE, ARTEFACTS)', () => {
  const c = readFileSync(CRA_TEMPLATE, 'utf-8');
  assert.match(c, /## MISSION DE CET AGENT/);
  assert.match(c, /## DÉCLENCHEURS/);
  assert.match(c, /## FORMAT DE SIGNALEMENT/);
  assert.match(c, /## CHECKLIST DE CONFORMITÉ CRA/);
  assert.match(c, /## ARTEFACTS OBLIGATOIRES/);
});

test('addGovernance — installe AIAD-CRA.md (5 agents Tier 1)', silencer(async () => {
  const d = tmp();
  try {
    await addGovernance(d, { silencieux: true });
    assert.ok(existsSync(join(d, '.aiad', 'gouvernance', 'AIAD-CRA.md')));
    assert.ok(existsSync(join(d, '.aiad', 'gouvernance', 'AIAD-AI-ACT.md')));
    assert.ok(existsSync(join(d, '.aiad', 'gouvernance', 'AIAD-RGPD.md')));
    assert.ok(existsSync(join(d, '.aiad', 'gouvernance', 'AIAD-RGAA.md')));
    assert.ok(existsSync(join(d, '.aiad', 'gouvernance', 'AIAD-RGESN.md')));
    // Index présente CRA
    const idx = readFileSync(join(d, '.aiad', 'gouvernance', '_index.md'), 'utf-8');
    assert.match(idx, /AIAD-CRA/);
    assert.match(idx, /Cyber Resilience Act/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('init complet → AIAD-CRA installé', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    assert.ok(existsSync(join(d, '.aiad', 'gouvernance', 'AIAD-CRA.md')));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));

test('doctor — accepte AIAD-CRA comme attendu (5 agents)', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await doctor(d, { json: true });
    // doctor ne doit pas signaler AIAD-CRA comme manquant
    const checks = JSON.stringify(r);
    assert.ok(!/AIAD-CRA.*manquant/i.test(checks), `AIAD-CRA signalé manquant : ${checks}`);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}));
