// Tests packs gouvernance EU étendus — DE-BSI + ES-AEPD (vague 1).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKS, listerPacks, packExiste, installerPack } from '../lib/governance-packs.js';
import { init } from '../lib/init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKS_DIR = join(__dirname, '..', 'templates', '.aiad', 'gouvernance-packs');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-eu-ext-')); }

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

// ─── Pack registration ──────────────────────────────────────────────────────

test('listerPacks — expose ≥ 6 packs (eu-baseline + us + uk + eu-financial + de-bsi + es-aepd au minimum)', () => {
  const liste = listerPacks();
  assert.ok(liste.length >= 6, `attendu ≥ 6 packs, vu ${liste.length}`);
  for (const id of ['eu-baseline', 'us-baseline', 'uk-baseline', 'eu-financial', 'de-bsi', 'es-aepd']) {
    assert.ok(liste.find((p) => p.id === id), `${id} absent`);
  }
});

test('packExiste — discrimine les packs vague 1 (de-bsi, es-aepd) et invalides', () => {
  assert.equal(packExiste('de-bsi'), true);
  assert.equal(packExiste('es-aepd'), true);
  // Note : it-agid/nl-ap/be-apd livrés en vague 2 (#81/#82/#83) — voir
  // test/governance-eu-extended-vague2.test.js pour leurs tests dédiés.
  assert.equal(packExiste('inexistant-xyz'), false);
});

// ─── DE-BSI ─────────────────────────────────────────────────────────────────

test('de-bsi — 4 agents Tier 1 présents', () => {
  for (const f of ['AIAD-BSI-IT-GRUNDSCHUTZ.md', 'AIAD-BSI-C5.md', 'AIAD-DE-BDSG.md', 'AIAD-DE-BFDI-EMPLOYEE.md']) {
    assert.ok(existsSync(join(PACKS_DIR, 'de-bsi', f)), `${f} absent`);
  }
});

test('AIAD-BSI-IT-GRUNDSCHUTZ — référentiel + 3 niveaux + modules + BSIG §8b', () => {
  const c = readFileSync(join(PACKS_DIR, 'de-bsi', 'AIAD-BSI-IT-GRUNDSCHUTZ.md'), 'utf-8');
  assert.match(c, /BSI IT-Grundschutz/);
  assert.match(c, /Bundesamt für Sicherheit/);
  assert.match(c, /Basis.*Standard.*Kern/s);
  // Modules attendus
  assert.match(c, /CON\.|OPS\.|NET\.|SYS\.|APP\./);
  // Reporting BSIG §8b dans 24h
  assert.match(c, /BSIG.*§8b|§8b BSIG/);
  assert.match(c, /24 heures/);
});

test('AIAD-BSI-C5 — 17 chapitres + souveraineté EU + audit Type 2', () => {
  const c = readFileSync(join(PACKS_DIR, 'de-bsi', 'AIAD-BSI-C5.md'), 'utf-8');
  assert.match(c, /BSI C5/);
  assert.match(c, /Cloud Computing Compliance Criteria Catalogue/);
  // Chapitres référencés
  assert.match(c, /BCM|CRY|IDM|OPS/);
  // Localisation EU/EEE
  assert.match(c, /EU\/EEE|EEA|Espace économique/i);
  // Type 2 vs Type 1
  assert.match(c, /Type 2/);
});

test('AIAD-DE-BDSG — §38 DPO 20 personnes + §26 employeur + §22 sensibles', () => {
  const c = readFileSync(join(PACKS_DIR, 'de-bsi', 'AIAD-DE-BDSG.md'), 'utf-8');
  assert.match(c, /BDSG/);
  assert.match(c, /Bundesdatenschutzgesetz/);
  // §38 — DPO seuil 20 personnes (plus strict que RGPD Article 37)
  assert.match(c, /§38/);
  assert.match(c, /20 personnes/);
  // §26 — droit du travail
  assert.match(c, /§26/);
  // §22 — données sensibles
  assert.match(c, /§22/);
});

test('AIAD-DE-BFDI-EMPLOYEE — Betriebsrat + §87 BetrVG cogestion obligatoire', () => {
  const c = readFileSync(join(PACKS_DIR, 'de-bsi', 'AIAD-DE-BFDI-EMPLOYEE.md'), 'utf-8');
  assert.match(c, /Betriebsrat/);
  assert.match(c, /Betriebsvereinbarung/);
  assert.match(c, /§87 BetrVG/);
  assert.match(c, /BfDI/);
  // Article 22 RGPD (décisions auto)
  assert.match(c, /Article 22/);
});

// ─── ES-AEPD ────────────────────────────────────────────────────────────────

test('es-aepd — 4 agents Tier 1 présents', () => {
  for (const f of ['AIAD-AEPD.md', 'AIAD-LOPDGDD.md', 'AIAD-ENS.md', 'AIAD-CCN-STIC.md']) {
    assert.ok(existsSync(join(PACKS_DIR, 'es-aepd', f)), `${f} absent`);
  }
});

test('AIAD-AEPD — Guía cookies 2024 + AEPD top 3 EU + Schrems II', () => {
  const c = readFileSync(join(PACKS_DIR, 'es-aepd', 'AIAD-AEPD.md'), 'utf-8');
  assert.match(c, /AEPD/);
  assert.match(c, /Agencia Española de Protección de Datos/);
  assert.match(c, /Guía de cookies.*2024/);
  // 72h notification RGPD article 33
  assert.match(c, /72\s*heures/);
  // Schrems II
  assert.match(c, /Schrems II/);
});

test('AIAD-LOPDGDD — LO 3/2018 + droit à la déconnexion + DPO 16 secteurs', () => {
  const c = readFileSync(join(PACKS_DIR, 'es-aepd', 'AIAD-LOPDGDD.md'), 'utf-8');
  assert.match(c, /LOPDGDD/);
  assert.match(c, /Ley Orgánica 3\/2018/);
  // Article 88 — déconnexion
  assert.match(c, /Article 88/);
  assert.match(c, /déconnexion/i);
  // Article 34 DPO
  assert.match(c, /Article 34/);
  assert.match(c, /16 secteurs/);
});

test('AIAD-ENS — 5 dimensions CIDAT + 3 niveaux + RD 311/2022', () => {
  const c = readFileSync(join(PACKS_DIR, 'es-aepd', 'AIAD-ENS.md'), 'utf-8');
  assert.match(c, /ENS/);
  assert.match(c, /Esquema Nacional de Seguridad/);
  assert.match(c, /Real Decreto 311\/2022|RD 311\/2022/);
  // Dimensions CIDAT
  assert.match(c, /CIDAT|Confidentialité.*Intégrité.*Disponibilité.*Authenticité.*Traçabilité/s);
  // 3 niveaux
  assert.match(c, /BÁSICO.*MEDIO.*ALTO/s);
  // CCN-CERT
  assert.match(c, /CCN-CERT/);
});

test('AIAD-CCN-STIC — séries 600/800 + CPSTIC + ENAC', () => {
  const c = readFileSync(join(PACKS_DIR, 'es-aepd', 'AIAD-CCN-STIC.md'), 'utf-8');
  assert.match(c, /CCN-STIC/);
  // CPSTIC catalogue produits
  assert.match(c, /CPSTIC/);
  // Hardening / paramètres recommandés
  assert.match(c, /hardening|paramètres de configuration/i);
  // Cryptographie
  assert.match(c, /807/);
});

// ─── Sections obligatoires par agent ────────────────────────────────────────

test('chaque agent EU étendu — sections obligatoires (MISSION/DÉCLENCHEURS/TOUJOURS/JAMAIS/PROTOCOLE)', () => {
  const cibles = [
    ['de-bsi', 'AIAD-BSI-IT-GRUNDSCHUTZ.md'],
    ['de-bsi', 'AIAD-BSI-C5.md'],
    ['de-bsi', 'AIAD-DE-BDSG.md'],
    ['de-bsi', 'AIAD-DE-BFDI-EMPLOYEE.md'],
    ['es-aepd', 'AIAD-AEPD.md'],
    ['es-aepd', 'AIAD-LOPDGDD.md'],
    ['es-aepd', 'AIAD-ENS.md'],
    ['es-aepd', 'AIAD-CCN-STIC.md'],
  ];
  for (const [pack, agent] of cibles) {
    const c = readFileSync(join(PACKS_DIR, pack, agent), 'utf-8');
    assert.match(c, /## MISSION/, `${pack}/${agent} : MISSION absente`);
    assert.match(c, /## DÉCLENCHEURS/, `${pack}/${agent} : DÉCLENCHEURS absente`);
    assert.match(c, /## RÈGLES ABSOLUES — TOUJOURS/, `${pack}/${agent} : TOUJOURS absente`);
    assert.match(c, /## RÈGLES ABSOLUES — JAMAIS/, `${pack}/${agent} : JAMAIS absente`);
    assert.match(c, /## PROTOCOLE DE SIGNALEMENT/, `${pack}/${agent} : PROTOCOLE absent`);
    assert.match(c, /## ARTICULATION/, `${pack}/${agent} : ARTICULATION absente`);
    assert.match(c, /Tier 1/, `${pack}/${agent} : Tier 1 absent`);
    assert.match(c, /Droit de veto.*oui/i, `${pack}/${agent} : droit de veto absent`);
  }
});

// ─── Installation ───────────────────────────────────────────────────────────

test('installerPack de-bsi → 4 agents installés au-dessus de eu-baseline', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await installerPack(d, 'de-bsi', { silencieux: true });
    assert.equal(r.created, 4);
    const govDir = join(d, '.aiad', 'gouvernance');
    for (const f of ['AIAD-BSI-IT-GRUNDSCHUTZ.md', 'AIAD-BSI-C5.md', 'AIAD-DE-BDSG.md', 'AIAD-DE-BFDI-EMPLOYEE.md']) {
      assert.ok(existsSync(join(govDir, f)));
    }
    // eu-baseline préservé
    assert.ok(existsSync(join(govDir, 'AIAD-RGPD.md')));
    assert.ok(existsSync(join(govDir, 'AIAD-CRA.md')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerPack es-aepd → 4 agents installés', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await installerPack(d, 'es-aepd', { silencieux: true });
    assert.equal(r.created, 4);
    const govDir = join(d, '.aiad', 'gouvernance');
    for (const f of ['AIAD-AEPD.md', 'AIAD-LOPDGDD.md', 'AIAD-ENS.md', 'AIAD-CCN-STIC.md']) {
      assert.ok(existsSync(join(govDir, f)));
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
}));
