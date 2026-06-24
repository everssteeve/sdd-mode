// Tests du module dashboard/collect.js — lecture pure des artefacts.
// Maintenant testable sans charger la pipeline de rendu HTML.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  extraireChamp, extraireTitre, parserKv, lireFondamentaux,
  lireIntents, lireSpecs, lireGouvernance, lireFacts, lireChangelog,
  calculerMaturite, collecterDonnees,
} from '../lib/dashboard/collect.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-collect-')); }

function setupAiad(d) {
  mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
  mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
  mkdirSync(join(d, '.aiad', 'gouvernance'), { recursive: true });
}

test('extraireChamp — formats variés', () => {
  assert.equal(extraireChamp('Auteur: Alice', 'Auteur'), 'Alice');
  assert.equal(extraireChamp('**Auteur** : Bob', 'Auteur'), 'Bob');
  assert.equal(extraireChamp('Statut : "ready"\n', 'Statut'), 'ready');
  assert.equal(extraireChamp(null, 'X'), null);
  assert.equal(extraireChamp('vide', 'Inexistant'), null);
});

test('extraireTitre — capture le H1', () => {
  assert.equal(extraireTitre('# Mon titre\n\ncorps'), 'Mon titre');
  assert.equal(extraireTitre('Pas de h1'), null);
  assert.equal(extraireTitre(null), null);
});

test('parserKv — types automatiques (number/bool/string)', () => {
  const r = parserKv('cycle_time_days: 3.5\nstatus: success\nactive: true\nflag: false');
  assert.equal(r.cycle_time_days, 3.5);
  assert.equal(r.status, 'success');
  assert.equal(r.active, true);
  assert.equal(r.flag, false);
});

test('lireFondamentaux — détecte sentinelles vs rédigé', () => {
  const d = tmp();
  try {
    setupAiad(d);
    writeFileSync(join(d, '.aiad', 'PRD.md'), '# [Titre fonctionnel court]\n', 'utf-8'); // template
    writeFileSync(join(d, '.aiad', 'ARCHITECTURE.md'), '# Mon archi\n5 principes ici\n', 'utf-8'); // rempli
    // AGENT-GUIDE.md absent
    const f = lireFondamentaux(d);
    const prd = f.find((x) => x.nom === 'PRD.md');
    const archi = f.find((x) => x.nom === 'ARCHITECTURE.md');
    const guide = f.find((x) => x.nom === 'AGENT-GUIDE.md');
    assert.equal(prd.present, true);
    assert.equal(prd.rempli, false);
    assert.equal(archi.rempli, true);
    assert.equal(guide.present, false);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('lireIntents / lireSpecs — extraction id + parent', () => {
  const d = tmp();
  try {
    setupAiad(d);
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-001.md'),
      '# Auth users\n\nstatus: active\nauteur: Alice\n', 'utf-8');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-login.md'),
      '# Login\n\n**Intent parent** : INTENT-001\nStatut: ready\nSQS: 4.2\n', 'utf-8');

    const intents = lireIntents(d);
    assert.equal(intents.length, 1);
    assert.equal(intents[0].id, 'INTENT-001');
    assert.equal(intents[0].titre, 'Auth users');
    assert.equal(intents[0].statut, 'active');

    const specs = lireSpecs(d);
    assert.equal(specs.length, 1);
    assert.equal(specs[0].id, 'SPEC-001-1-login');
    assert.equal(specs[0].parentIntent, 'INTENT-001');
    assert.equal(specs[0].statut, 'ready');
    assert.equal(specs[0].sqs, '4.2');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

// CA-010 — SPEC-026-1-archive-done : lireIntents/lireSpecs excluent archive/
test('lireIntents — CA-010 exclut les fichiers dans archive/', () => {
  const d = tmp();
  try {
    setupAiad(d);
    mkdirSync(join(d, '.aiad', 'intents', 'archive'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'archive', 'INTENT-OLD-archived.md'), '# Old\nstatus: archived\n', 'utf-8');
    writeFileSync(join(d, '.aiad', 'intents', 'INTENT-001-active.md'), '# Active\nstatus: active\n', 'utf-8');
    const intents = lireIntents(d);
    assert.equal(intents.length, 1);
    assert.equal(intents[0].id, 'INTENT-001-active');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('lireSpecs — CA-010 exclut les fichiers dans archive/', () => {
  const d = tmp();
  try {
    setupAiad(d);
    mkdirSync(join(d, '.aiad', 'specs', 'archive'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'archive', 'SPEC-OLD-1-archived.md'), '# Old\nstatus: archived\n', 'utf-8');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-042-1-active.md'), '# Active\nstatus: done\n', 'utf-8');
    const specs = lireSpecs(d);
    assert.equal(specs.length, 1);
    assert.equal(specs[0].id, 'SPEC-042-1-active');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('lireSpecs — exclut le template EARS', () => {
  const d = tmp();
  try {
    setupAiad(d);
    writeFileSync(join(d, '.aiad', 'specs', 'spec-ears-template.md'), '# Template\n', 'utf-8');
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-042-1-real.md'), '# Real\n', 'utf-8');
    const specs = lireSpecs(d);
    assert.equal(specs.length, 1);
    assert.equal(specs[0].id, 'SPEC-042-1-real');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('lireGouvernance — 5 agents Tier 1 attendus dont CRA, présents/absents distingués', () => {
  const d = tmp();
  try {
    setupAiad(d);
    writeFileSync(join(d, '.aiad', 'gouvernance', 'AIAD-RGPD.md'), '# RGPD\n', 'utf-8');
    writeFileSync(join(d, '.aiad', 'gouvernance', 'AIAD-RGAA.md'), '# RGAA\n', 'utf-8');
    writeFileSync(join(d, '.aiad', 'gouvernance', 'AIAD-CRA.md'), '# CRA\n', 'utf-8');
    const r = lireGouvernance(d);
    assert.equal(r.length, 5);
    const rgpd = r.find((x) => x.id === 'AIAD-RGPD');
    const rgesn = r.find((x) => x.id === 'AIAD-RGESN');
    const cra = r.find((x) => x.id === 'AIAD-CRA');
    assert.equal(rgpd.present, true);
    assert.equal(rgesn.present, false);
    assert.equal(cra.present, true);
    assert.match(rgpd.referentiel, /RGPD/);
    assert.match(cra.referentiel, /Cyber Resilience|2024\/2847/);
    assert.match(cra.declenche, /UE|SBOM|vulnérabilités/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('lireChangelog — parse les entrées "## YYYY-MM-DD — artefact — type"', () => {
  const d = tmp();
  try {
    setupAiad(d);
    writeFileSync(join(d, '.aiad', 'CHANGELOG-ARTEFACTS.md'),
      `# Changelog

## 2026-05-09 — SPEC-001 — création

**Auteur** : Alice
**Raison** : Nouveau flow auth

## 2026-05-08 — INTENT-002 — mise à jour

**Auteur** : Bob
`, 'utf-8');
    const cl = lireChangelog(d);
    assert.equal(cl.entrees.length, 2);
    assert.equal(cl.entrees[0].date, '2026-05-09');
    assert.equal(cl.entrees[0].artefact, 'SPEC-001');
    assert.equal(cl.entrees[0].auteur, 'Alice');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('calculerMaturite — score 0..5 avec niveaux nommés', () => {
  const r0 = calculerMaturite({ fondamentaux: [], intents: [], specs: [] });
  assert.equal(r0.score, 0);
  assert.equal(r0.label, 'Non initialisé');

  const r5 = calculerMaturite({
    fondamentaux: [
      { nom: 'PRD.md', rempli: true },
      { nom: 'ARCHITECTURE.md', rempli: true },
      { nom: 'AGENT-GUIDE.md', rempli: true },
    ],
    intents: [{}],
    specs: [{}],
  });
  assert.equal(r5.score, 5);
  assert.equal(r5.label, 'Complet');
});

// Pondération #133 — un projet en init nominal peut avoir 5 artefacts mais
// pas encore de leadership metrics ni de Drift Lock VCS ; le score doit
// refléter cette immaturité de fait.
test('calculerMaturite — plafond 3/5 si ≥2 leadership metrics indéfinies', () => {
  const donneesPleines = {
    fondamentaux: [
      { nom: 'PRD.md', rempli: true },
      { nom: 'ARCHITECTURE.md', rempli: true },
      { nom: 'AGENT-GUIDE.md', rempli: true },
    ],
    intents: [{}],
    specs: [{}],
  };
  const signaux = {
    git: true,
    hooks: true,
    leadership: {
      humanAuthorshipRatio: { ratio: null },
      governanceCoverage: { ratio: null },
      traceCompleteness: { ratio: 0.5 },
    },
  };
  const r = calculerMaturite(donneesPleines, signaux);
  assert.equal(r.score, 3, 'score plafonné à 3');
  assert.equal(r.scoreBrut, 5);
  assert.equal(r.plafond, 3);
  assert.match(r.raisonPlafond, /leadership|indéfinies/);
});

test('calculerMaturite — plafond 4/5 sans git+hooks (leadership OK)', () => {
  const donneesPleines = {
    fondamentaux: [
      { nom: 'PRD.md', rempli: true },
      { nom: 'ARCHITECTURE.md', rempli: true },
      { nom: 'AGENT-GUIDE.md', rempli: true },
    ],
    intents: [{}],
    specs: [{}],
  };
  const signauxSansGit = {
    git: false,
    hooks: false,
    leadership: {
      humanAuthorshipRatio: { ratio: 0.9 },
      governanceCoverage: { ratio: 0.5 },
      traceCompleteness: { ratio: 0.8 },
    },
  };
  const r = calculerMaturite(donneesPleines, signauxSansGit);
  assert.equal(r.score, 4, 'score plafonné à 4 sans git+hooks');
  assert.equal(r.plafond, 4);
  assert.match(r.raisonPlafond, /git|hook/);
});

test('calculerMaturite — score 5/5 inchangé avec leadership + git + hooks complets', () => {
  const donneesPleines = {
    fondamentaux: [
      { nom: 'PRD.md', rempli: true },
      { nom: 'ARCHITECTURE.md', rempli: true },
      { nom: 'AGENT-GUIDE.md', rempli: true },
    ],
    intents: [{}],
    specs: [{}],
  };
  const signauxParfaits = {
    git: true,
    hooks: true,
    leadership: {
      humanAuthorshipRatio: { ratio: 1.0 },
      governanceCoverage: { ratio: 0.7 },
      traceCompleteness: { ratio: 0.9 },
    },
  };
  const r = calculerMaturite(donneesPleines, signauxParfaits);
  assert.equal(r.score, 5);
  assert.equal(r.plafond, 5);
  assert.equal(r.raisonPlafond, null);
});

test('calculerMaturite — sans signaux : rétrocompat (pas de plafond)', () => {
  const r = calculerMaturite({
    fondamentaux: [
      { nom: 'PRD.md', rempli: true },
      { nom: 'ARCHITECTURE.md', rempli: true },
      { nom: 'AGENT-GUIDE.md', rempli: true },
    ],
    intents: [{}],
    specs: [{}],
  });
  assert.equal(r.score, 5);
  assert.equal(r.plafond, 5);
});

test('collecterDonnees — modèle complet sur projet vide', () => {
  const d = tmp();
  try {
    setupAiad(d);
    const r = collecterDonnees(d);
    assert.ok(r.projet);
    assert.equal(r.intents.length, 0);
    assert.equal(r.specs.length, 0);
    assert.equal(r.gouvernance.length, 5);
    assert.ok(r.maturite);
    assert.ok(r.matrice);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
