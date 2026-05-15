// Tests `lib/org-config.js` — configuration org-level (item #122).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseYaml, trouverConfig, chargerConfig, verifierConformite,
  afficherConfig, templateConfig, verifier, CONSTANTS,
  // alias EN
  parseYamlMinimal, findConfig, loadConfig, checkCompliance,
  showConfig, configTemplate, check,
} from '../lib/org-config.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-org-')); }

function ecrireConfig(racine, contenu, ext = 'yml') {
  const dir = join(racine, '.aiad');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `org.${ext}`), contenu, 'utf-8');
}

function silent(fn) {
  return (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

// ─── parseYaml ────────────────────────────────────────────────────────────

test('parseYaml — scalaires de base', () => {
  const y = `
name: test
count: 42
enabled: true
disabled: false
empty: null
`;
  const r = parseYaml(y);
  assert.equal(r.name, 'test');
  assert.equal(r.count, 42);
  assert.equal(r.enabled, true);
  assert.equal(r.disabled, false);
  assert.equal(r.empty, null);
});

test('parseYaml — strings quotées', () => {
  const y = `
withSpaces: "Mon nom avec espaces"
single: 'autre valeur'
`;
  const r = parseYaml(y);
  assert.equal(r.withSpaces, 'Mon nom avec espaces');
  assert.equal(r.single, 'autre valeur');
});

test('parseYaml — listes simples', () => {
  const y = `
packs:
  - eu-baseline
  - fr-anssi
  - de-bsi
`;
  const r = parseYaml(y);
  assert.deepEqual(r.packs, ['eu-baseline', 'fr-anssi', 'de-bsi']);
});

test('parseYaml — objet imbriqué 1 niveau', () => {
  const y = `
owners:
  intents: equipe-produit
  specs: equipe-tech
`;
  const r = parseYaml(y);
  assert.deepEqual(r.owners, { intents: 'equipe-produit', specs: 'equipe-tech' });
});

test('parseYaml — commentaires ignorés', () => {
  const y = `
# Commentaire en haut
name: test  # trailing comment
# Autre
count: 7
`;
  const r = parseYaml(y);
  assert.equal(r.name, 'test');
  assert.equal(r.count, 7);
});

test('parseYaml — input invalide → {}', () => {
  assert.deepEqual(parseYaml(null), {});
  assert.deepEqual(parseYaml(undefined), {});
  assert.deepEqual(parseYaml(123), {});
});

test('parseYaml — bloc vide → null', () => {
  const y = 'empty:\n\nnext: ok\n';
  const r = parseYaml(y);
  assert.equal(r.empty, null);
  assert.equal(r.next, 'ok');
});

// ─── trouverConfig ────────────────────────────────────────────────────────

test('trouverConfig — aucun fichier → null', () => {
  const d = tmp();
  try {
    assert.equal(trouverConfig(d), null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('trouverConfig — .aiad/org.yml détecté', () => {
  const d = tmp();
  try {
    ecrireConfig(d, 'name: x');
    const path = trouverConfig(d);
    assert.ok(path);
    assert.match(path, /org\.yml$/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('trouverConfig — .aiad/org.json détecté en fallback', () => {
  const d = tmp();
  try {
    ecrireConfig(d, '{"orgName":"x"}', 'json');
    const path = trouverConfig(d);
    assert.match(path, /org\.json$/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('trouverConfig — remontée ascendante (monorepo)', () => {
  const d = tmp();
  try {
    ecrireConfig(d, 'name: parent');
    mkdirSync(join(d, 'projet-a'), { recursive: true });
    const path = trouverConfig(join(d, 'projet-a'));
    assert.ok(path);
    assert.match(path, /aiad\/org\.yml$/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── chargerConfig ────────────────────────────────────────────────────────

test('chargerConfig — aucun fichier → { config: null, source: null }', () => {
  const d = tmp();
  try {
    const r = chargerConfig(d);
    assert.equal(r.config, null);
    assert.equal(r.source, null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerConfig — YAML chargé et parsé', () => {
  const d = tmp();
  try {
    ecrireConfig(d, 'orgName: ACME\nminSovereigntyScore: 80\nrequiredPacks:\n  - eu-baseline\n');
    const r = chargerConfig(d);
    assert.equal(r.config.orgName, 'ACME');
    assert.equal(r.config.minSovereigntyScore, 80);
    assert.deepEqual(r.config.requiredPacks, ['eu-baseline']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerConfig — JSON aussi supporté', () => {
  const d = tmp();
  try {
    ecrireConfig(d, JSON.stringify({ orgName: 'JSON-ACME', minSovereigntyScore: 50 }), 'json');
    const r = chargerConfig(d);
    assert.equal(r.config.orgName, 'JSON-ACME');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerConfig — JSON invalide → throw', () => {
  const d = tmp();
  try {
    ecrireConfig(d, 'NOT JSON', 'json');
    assert.throws(() => chargerConfig(d), /JSON invalide/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('chargerConfig — env AIAD_ORG_CONFIG override', () => {
  const d = tmp();
  try {
    const cible = join(d, 'custom.yml');
    writeFileSync(cible, 'orgName: env-loaded\n');
    process.env.AIAD_ORG_CONFIG = cible;
    const r = chargerConfig(d);
    assert.equal(r.config.orgName, 'env-loaded');
  } finally {
    delete process.env.AIAD_ORG_CONFIG;
    rmSync(d, { recursive: true, force: true });
  }
});

test('chargerConfig — options.configPath prioritaire', () => {
  const d = tmp();
  try {
    const cible = join(d, 'explicit.yml');
    writeFileSync(cible, 'orgName: explicit\n');
    const r = chargerConfig(d, { configPath: cible });
    assert.equal(r.config.orgName, 'explicit');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── verifierConformite ──────────────────────────────────────────────────

test('verifierConformite — config null → valid', () => {
  const r = verifierConformite({ governanceFiles: [], sovereigntyScore: 0, runtimes: [] }, null);
  assert.equal(r.valid, true);
});

test('verifierConformite — pack eu-baseline absent → violation', () => {
  const r = verifierConformite(
    { governanceFiles: [], sovereigntyScore: 100, runtimes: [] },
    { requiredPacks: ['eu-baseline'] },
  );
  assert.equal(r.valid, false);
  assert.equal(r.violations[0].rule, 'requiredPacks');
});

test('verifierConformite — pack eu-baseline présent → ok', () => {
  const r = verifierConformite(
    { governanceFiles: ['AIAD-RGPD.md'], sovereigntyScore: 100, runtimes: [] },
    { requiredPacks: ['eu-baseline'] },
  );
  assert.equal(r.valid, true);
});

test('verifierConformite — pack inconnu → violation explicite', () => {
  const r = verifierConformite(
    { governanceFiles: [], sovereigntyScore: 100, runtimes: [] },
    { requiredPacks: ['unknown-pack'] },
  );
  assert.equal(r.valid, false);
  assert.match(r.violations[0].message, /inconnu/);
});

test('verifierConformite — agent requis absent → violation', () => {
  const r = verifierConformite(
    { governanceFiles: ['AIAD-RGPD.md'], sovereigntyScore: 100, runtimes: [] },
    { requiredAgents: ['AIAD-AI-ACT'] },
  );
  assert.equal(r.valid, false);
});

test('verifierConformite — sovereignty score < min → violation', () => {
  const r = verifierConformite(
    { governanceFiles: [], sovereigntyScore: 40, runtimes: [] },
    { minSovereigntyScore: 70 },
  );
  assert.equal(r.valid, false);
  assert.match(r.violations[0].message, /Sovereignty Score/);
});

test('verifierConformite — runtime non whitelisté → violation', () => {
  const r = verifierConformite(
    { governanceFiles: [], sovereigntyScore: 100, runtimes: ['shadow-ide'] },
    { allowedRuntimes: ['claude-code', 'cursor'] },
  );
  assert.equal(r.valid, false);
  assert.match(r.violations[0].message, /non autorisé/);
});

test('verifierConformite — toutes règles respectées → valid', () => {
  const r = verifierConformite(
    {
      governanceFiles: ['AIAD-AI-ACT.md', 'AIAD-RGPD.md', 'AIAD-RGS.md', 'AIAD-CRA.md'],
      sovereigntyScore: 85,
      runtimes: ['claude-code'],
    },
    {
      requiredPacks: ['eu-baseline', 'fr-anssi'],
      requiredAgents: ['AIAD-CRA'],
      minSovereigntyScore: 70,
      allowedRuntimes: ['claude-code', 'cursor'],
    },
  );
  assert.equal(r.valid, true);
});

// ─── templateConfig ───────────────────────────────────────────────────────

test('templateConfig — contient sections clés + commentaires', () => {
  const t = templateConfig();
  assert.match(t, /orgName:/);
  assert.match(t, /minSovereigntyScore:/);
  assert.match(t, /requiredPacks:/);
  assert.match(t, /requiredAgents:/);
  assert.match(t, /allowedRuntimes:/);
  assert.match(t, /strict:/);
});

test('templateConfig — parseable par parseYaml', () => {
  const t = templateConfig();
  const parsed = parseYaml(t);
  assert.equal(parsed.minSovereigntyScore, 70);
  assert.ok(Array.isArray(parsed.requiredPacks));
});

// ─── verifier (pipeline) ─────────────────────────────────────────────────

test('verifier — pas de config → valid (no-op)', silent(() => {
  const d = tmp();
  try {
    const r = verifier(d, { governanceFiles: [], sovereigntyScore: 0, runtimes: [] });
    assert.equal(r.valid, true);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('verifier — config + violations → valid=false + strict propagé', silent(() => {
  const d = tmp();
  try {
    ecrireConfig(d, 'strict: true\nrequiredAgents:\n  - AIAD-RGPD\n');
    const r = verifier(d, { governanceFiles: [], sovereigntyScore: 0, runtimes: [] });
    assert.equal(r.valid, false);
    assert.equal(r.strict, true);
    assert.equal(r.violations.length, 1);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('verifier --json → sortie structurée', () => {
  const d = tmp();
  try {
    ecrireConfig(d, 'requiredAgents:\n  - AIAD-RGPD\n');
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try {
      verifier(d, { governanceFiles: ['AIAD-RGPD.md'], sovereigntyScore: 100, runtimes: [] }, { json: true });
    } finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.valid, true);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── afficherConfig ──────────────────────────────────────────────────────

test('afficherConfig --json → JSON exploitable', () => {
  const d = tmp();
  try {
    ecrireConfig(d, 'orgName: X');
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { afficherConfig(d, { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.config.orgName, 'X');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(parseYamlMinimal, parseYaml);
  assert.equal(findConfig, trouverConfig);
  assert.equal(loadConfig, chargerConfig);
  assert.equal(checkCompliance, verifierConformite);
  assert.equal(showConfig, afficherConfig);
  assert.equal(configTemplate, templateConfig);
  assert.equal(check, verifier);
});

test('CONSTANTS — exposées', () => {
  assert.equal(CONSTANTS.CONFIG_NAME_YAML, 'org.yml');
  assert.equal(CONSTANTS.CONFIG_NAME_JSON, 'org.json');
});
