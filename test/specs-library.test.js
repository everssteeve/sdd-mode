// Tests `lib/specs-library.js` — bibliothèque de SPECs templates par domaine.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listerTemplatesSpec,
  templateSpecExiste,
  creerSpecDepuisTemplate,
  interpolerTemplate,
  // alias EN
  listSpecTemplates,
  specTemplateExists,
  createSpecFromTemplate,
  interpolateTemplate,
} from '../lib/specs-library.js';
import { init } from '../lib/init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIBRARY_DIR = join(__dirname, '..', 'templates', '.aiad', 'specs-library');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-tpl-spec-')); }

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

// ─── Catalogue ──────────────────────────────────────────────────────────────

test('listerTemplatesSpec — retourne ≥ 4 domaines (vague 1)', () => {
  const liste = listerTemplatesSpec();
  assert.ok(liste.length >= 4, `attendu ≥ 4, vu ${liste.length}`);
  const ids = liste.map((t) => t.id);
  for (const id of ['auth-oidc', 'payment-pci', 'rag-llm', 'gdpr-data-export']) {
    assert.ok(ids.includes(id), `${id} absent`);
  }
});

test('listerTemplatesSpec — tri alphabétique', () => {
  const ids = listerTemplatesSpec().map((t) => t.id);
  for (let i = 1; i < ids.length; i++) {
    assert.ok(ids[i - 1] <= ids[i], 'liste non triée');
  }
});

test('listerTemplatesSpec — chaque template porte governance[]', () => {
  for (const t of listerTemplatesSpec()) {
    assert.ok(Array.isArray(t.governance));
    assert.ok(t.governance.length >= 1, `${t.id} sans gouvernance`);
    for (const g of t.governance) {
      assert.match(g, /^AIAD-/, `gouvernance "${g}" ne commence pas par AIAD-`);
    }
  }
});

test('templateSpecExiste — discrimine valides / invalides', () => {
  assert.equal(templateSpecExiste('auth-oidc'), true);
  assert.equal(templateSpecExiste('payment-pci'), true);
  assert.equal(templateSpecExiste('inexistant-xyz'), false);
  assert.equal(templateSpecExiste(''), false);
});

// ─── Templates : qualité du contenu ─────────────────────────────────────────

test('auth-oidc — frontmatter EARS + RGPD + CRA + critères R1-R7', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'auth-oidc.md'), 'utf-8');
  assert.match(c, /format: EARS/);
  assert.match(c, /governance: AIAD-RGPD,AIAD-CRA/);
  // Critères EARS R1 à R7
  for (const r of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']) {
    assert.match(c, new RegExp(`### ${r} —`), `${r} absent`);
  }
  // Vocabulaire OIDC
  assert.match(c, /Authorization Code|PKCE/);
  assert.match(c, /code_challenge|S256/);
  assert.match(c, /JWKS/);
});

test('payment-pci — PCI-DSS SAQ A + SCA + Dynamic Linking + webhook idempotent', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'payment-pci.md'), 'utf-8');
  assert.match(c, /governance: AIAD-RGPD,AIAD-CRA,AIAD-PSD2/);
  assert.match(c, /PCI-DSS|SAQ A/);
  assert.match(c, /SCA|3D Secure|3DS 2/);
  assert.match(c, /Dynamic Linking/);
  assert.match(c, /idempotent/);
  assert.match(c, /Article 96|DORA Article 18/);
});

test('rag-llm — AI Act + Article 50 + ACL retrieval + Article 22 RGPD', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'rag-llm.md'), 'utf-8');
  assert.match(c, /governance: AIAD-AI-ACT,AIAD-RGPD,AIAD-RGESN/);
  assert.match(c, /RAG|Retrieval-Augmented Generation/i);
  assert.match(c, /Article 50/);
  assert.match(c, /Article 22 RGPD|Article 14 AI Act/);
  // ACL au chunk
  assert.match(c, /ACL|contrôle d'accès/i);
  // Citation vérifiable + "Je ne sais pas"
  assert.match(c, /Je ne sais pas/);
});

test('gdpr-data-export — Article 20 + Article 15 + délai 30 jours + formats JSON/CSV/README', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'gdpr-data-export.md'), 'utf-8');
  assert.match(c, /governance: AIAD-RGPD/);
  assert.match(c, /Article 20|portabilité/);
  assert.match(c, /Article 15|droit d'accès/);
  assert.match(c, /30 jours/);
  assert.match(c, /data\.json/);
  assert.match(c, /data\.csv/);
  assert.match(c, /README\.md/);
});

test('chaque template — sections obligatoires (Contexte, Critères, Anti-patterns, Tests, Test de l\'Étranger)', () => {
  for (const t of listerTemplatesSpec()) {
    const c = readFileSync(t.path, 'utf-8');
    assert.match(c, /## Contexte/, `${t.id} : Contexte absente`);
    assert.match(c, /## Critères d'acceptation/, `${t.id} : Critères absents`);
    assert.match(c, /## Anti-patterns interdits/, `${t.id} : Anti-patterns absents`);
    assert.match(c, /## Tests d'exemple/, `${t.id} : Tests absents`);
    assert.match(c, /## Test de l'Étranger/, `${t.id} : Test de l'Étranger absent`);
    assert.match(c, /## Gouvernance applicable/, `${t.id} : Gouvernance applicable absente`);
  }
});

test('chaque template — porte les annotations machine dans les exemples de tests', () => {
  for (const t of listerTemplatesSpec()) {
    const c = readFileSync(t.path, 'utf-8');
    assert.match(c, /@spec \{\{spec_id\}\}/, `${t.id} : @spec absent`);
    assert.match(c, /@verified-by/, `${t.id} : @verified-by absent`);
    assert.match(c, /@governance/, `${t.id} : @governance absent`);
  }
});

// ─── interpolerTemplate ─────────────────────────────────────────────────────

test('interpolerTemplate — remplace toutes les {{vars}} fournies', () => {
  const r = interpolerTemplate('Hello {{name}}, version {{version}}', {
    name: 'AIAD', version: '1.14.0',
  });
  assert.equal(r, 'Hello AIAD, version 1.14.0');
});

test('interpolerTemplate — variable manquante → préserve le marqueur', () => {
  const r = interpolerTemplate('Hello {{name}}', {});
  assert.equal(r, 'Hello {{name}}');
});

test('interpolerTemplate — variable utilisée plusieurs fois', () => {
  const r = interpolerTemplate('{{x}} = {{x}} = {{x}}', { x: '42' });
  assert.equal(r, '42 = 42 = 42');
});

// ─── creerSpecDepuisTemplate ────────────────────────────────────────────────

test('creerSpecDepuisTemplate — domaine inconnu → erreur', async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad'));
    await assert.rejects(
      creerSpecDepuisTemplate(d, 'inconnu', {}),
      /Domaine inconnu/,
    );
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('creerSpecDepuisTemplate — sans .aiad/ → erreur', async () => {
  const d = tmp();
  try {
    await assert.rejects(
      creerSpecDepuisTemplate(d, 'auth-oidc', {}),
      /\.aiad\//,
    );
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('creerSpecDepuisTemplate auth-oidc — crée SPEC-001-1-<slug>.md interpolé', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await creerSpecDepuisTemplate(d, 'auth-oidc', {
      title: 'Connexion utilisateur via Keycloak',
      parent_intent: 'INTENT-042',
      idp: 'Keycloak',
    });
    assert.match(r.specId, /^SPEC-001-1-/);
    assert.ok(existsSync(r.path));
    const c = readFileSync(r.path, 'utf-8');
    // Variables interpolées
    assert.match(c, /title: "Connexion utilisateur via Keycloak"/);
    assert.match(c, /parent_intent: "INTENT-042"/);
    assert.match(c, /Se connecter avec Keycloak/);
    // L'ID de la SPEC apparaît dans le titre
    assert.match(c, new RegExp(`# ${r.specId}`));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('creerSpecDepuisTemplate — auto-incrémente le numéro SPEC', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r1 = await creerSpecDepuisTemplate(d, 'auth-oidc', { title: 'A' });
    const r2 = await creerSpecDepuisTemplate(d, 'gdpr-data-export', { title: 'B' });
    assert.match(r1.specId, /^SPEC-001-/);
    assert.match(r2.specId, /^SPEC-002-/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('creerSpecDepuisTemplate — slug par défaut depuis le titre', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await creerSpecDepuisTemplate(d, 'rag-llm', {
      title: 'Recherche documentaire intelligente',
    });
    assert.match(r.specId, /recherche-documentaire-intelligente/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('creerSpecDepuisTemplate --dry-run → aucun fichier écrit', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await creerSpecDepuisTemplate(d, 'payment-pci', {
      title: 'Paiement carte',
      dryRun: true,
    });
    assert.ok(!existsSync(r.path), 'fichier créé en dry-run');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('creerSpecDepuisTemplate --out custom respecté', silencer(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await creerSpecDepuisTemplate(d, 'auth-oidc', {
      title: 'Auth',
      out: '.aiad/specs/custom-name.md',
    });
    assert.equal(r.path, join(d, '.aiad/specs/custom-name.md'));
    assert.ok(existsSync(r.path));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

// ─── Aliases EN ──────────────────────────────────────────────────────────────

test('alias EN — listSpecTemplates / specTemplateExists / createSpecFromTemplate / interpolateTemplate', () => {
  assert.equal(listSpecTemplates, listerTemplatesSpec);
  assert.equal(specTemplateExists, templateSpecExiste);
  assert.equal(createSpecFromTemplate, creerSpecDepuisTemplate);
  assert.equal(interpolateTemplate, interpolerTemplate);
});
