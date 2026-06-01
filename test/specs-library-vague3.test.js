// Tests templates SPECs vague 3 — multi-tenant + search + notifications (item #117).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerTemplatesSpec, templateSpecExiste, creerSpecDepuisTemplate } from '../lib/specs-library.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIBRARY_DIR = join(__dirname, '..', 'templates', '.aiad', 'specs-library');

function tmp() {
  const d = mkdtempSync(join(tmpdir(), 'aiad-sl3-'));
  mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
  writeFileSync(join(d, '.aiad', 'specs', '_index.md'), '# index');
  return d;
}

function silent(fn) {
  return async (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return await fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

const VAGUE_3 = ['multi-tenant-saas', 'search-elasticsearch', 'notifications-multi-channel'];

// ─── Présence catalogue ────────────────────────────────────────────────────

test('listerTemplatesSpec — couvre désormais ≥ 9 templates (vagues 1+2+3)', () => {
  const t = listerTemplatesSpec();
  assert.ok(t.length >= 9, `attendu ≥ 9, vu ${t.length}`);
  const ids = t.map((x) => x.id);
  for (const id of VAGUE_3) {
    assert.ok(ids.includes(id), `${id} absent`);
  }
});

test('templateSpecExiste — vague 3 reconnue', () => {
  for (const id of VAGUE_3) {
    assert.equal(templateSpecExiste(id), true, `${id} non détecté`);
  }
});

// ─── Structure obligatoire (alignement avec contrat existant) ─────────────

test('vague 3 — toutes les sections obligatoires', () => {
  const sections = [
    /## Contexte/,
    /## Critères d'acceptation/,
    /## Anti-patterns interdits/,
    /## Tests d'exemple/,
    /## Test de l'Étranger/,
    /## Gouvernance applicable/,
    /## Références/,
  ];
  for (const id of VAGUE_3) {
    const c = readFileSync(join(LIBRARY_DIR, `${id}.md`), 'utf-8');
    for (const re of sections) {
      assert.match(c, re, `${id} : section ${re} absente`);
    }
  }
});

test('vague 3 — annotations machine présentes dans les exemples', () => {
  for (const id of VAGUE_3) {
    const c = readFileSync(join(LIBRARY_DIR, `${id}.md`), 'utf-8');
    assert.match(c, /@spec \{\{spec_id\}\}/, `${id} : @spec absent`);
    assert.match(c, /@verified-by/, `${id} : @verified-by absent`);
    assert.match(c, /@governance/, `${id} : @governance absent`);
    assert.match(c, /@intent \{\{parent_intent\}\}/, `${id} : @intent absent`);
  }
});

test('vague 3 — frontmatter EARS + format + governance Tier 1', () => {
  for (const id of VAGUE_3) {
    const t = listerTemplatesSpec().find((x) => x.id === id);
    assert.ok(t);
    const c = readFileSync(t.path, 'utf-8');
    assert.match(c, /format: EARS/);
    assert.ok(t.governance.length >= 2, `${id} : devrait avoir ≥ 2 agents`);
    for (const g of t.governance) {
      assert.match(g, /^AIAD-/, `${id} : gouv ${g} ne commence pas par AIAD-`);
    }
  }
});

// ─── multi-tenant-saas — couverture spécifique ─────────────────────────────

test('multi-tenant-saas — 3 stratégies d\'isolation documentées', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'multi-tenant-saas.md'), 'utf-8');
  assert.match(c, /Pool partagé/);
  assert.match(c, /Schema par tenant/);
  assert.match(c, /Database par tenant/);
});

test('multi-tenant-saas — RLS PostgreSQL référencé', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'multi-tenant-saas.md'), 'utf-8');
  assert.match(c, /Row-Level Security|RLS/i);
  assert.match(c, /current_setting/);
});

test('multi-tenant-saas — purge tenant 30 jours + DPA + k-anonymity', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'multi-tenant-saas.md'), 'utf-8');
  assert.match(c, /30 jours/);
  assert.match(c, /DPA|Data Processing Agreement/);
  assert.match(c, /k-anonymity/);
});

test('multi-tenant-saas — critères R1-R8 présents', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'multi-tenant-saas.md'), 'utf-8');
  for (const r of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8']) {
    assert.match(c, new RegExp(`### ${r} —`));
  }
});

// ─── search-elasticsearch — couverture spécifique ─────────────────────────

test('search-elasticsearch — Right to Erasure + Rectification + Access', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'search-elasticsearch.md'), 'utf-8');
  assert.match(c, /Right to Erasure/);
  assert.match(c, /Right to Rectification|Article 16/);
  assert.match(c, /Right to Access|Article 15/);
});

test('search-elasticsearch — classification 4 niveaux', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'search-elasticsearch.md'), 'utf-8');
  for (const niveau of ['public', 'internal', 'sensitive', 'restricted']) {
    assert.match(c, new RegExp(`\`${niveau}\``));
  }
});

test('search-elasticsearch — sync suppressions < 5 min', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'search-elasticsearch.md'), 'utf-8');
  assert.match(c, /5 minutes/);
  assert.match(c, /DELETE \/index\/_doc/);
});

test('search-elasticsearch — critères R1-R9 présents', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'search-elasticsearch.md'), 'utf-8');
  for (const r of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9']) {
    assert.match(c, new RegExp(`### ${r} —`));
  }
});

// ─── notifications-multi-channel — couverture spécifique ──────────────────

test('notifications — 4 canaux + opt-in granulaire', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'notifications-multi-channel.md'), 'utf-8');
  for (const canal of ['Email', 'SMS', 'push', 'in-app']) {
    assert.match(c, new RegExp(canal, 'i'));
  }
  assert.match(c, /matrice.*canal.*catégorie/i);
});

test('notifications — opt-out 1-clic obligatoire + RFC 8058', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'notifications-multi-channel.md'), 'utf-8');
  assert.match(c, /1.?clic/);
  assert.match(c, /List-Unsubscribe/);
  assert.match(c, /RFC 8058/);
  assert.match(c, /STOP au/);
});

test('notifications — transactionnel séparé du marketing', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'notifications-multi-channel.md'), 'utf-8');
  assert.match(c, /transactionnelle.*marketing|même si.*opté out du marketing/i);
});

test('notifications — bounce hard + plainte FBL désactivent l\'envoi', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'notifications-multi-channel.md'), 'utf-8');
  assert.match(c, /bounce hard/i);
  assert.match(c, /\bFBL\b/);
});

test('notifications — RGAA accessibility emails', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'notifications-multi-channel.md'), 'utf-8');
  assert.match(c, /RGAA/);
  assert.match(c, /4\.5:1/);
  assert.match(c, /lang="fr"/);
});

test('notifications — critères R1-R9 présents', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'notifications-multi-channel.md'), 'utf-8');
  for (const r of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9']) {
    assert.match(c, new RegExp(`### ${r} —`));
  }
});

// ─── Round-trip interpolation ─────────────────────────────────────────────

test('creerSpecDepuisTemplate — vague 3 interpole correctement', silent(async () => {
  const d = tmp();
  try {
    for (const id of VAGUE_3) {
      const r = await creerSpecDepuisTemplate(d, id, {
        title: `SPEC ${id} test`,
        parent_intent: 'INT-100',
        service: 'demo',
      });
      assert.ok(existsSync(r.path));
      const c = readFileSync(r.path, 'utf-8');
      assert.match(c, new RegExp(`SPEC ${id} test`));
      assert.match(c, /INT-100/);
      assert.ok(!c.includes('{{title}}'));
      assert.ok(!c.includes('{{parent_intent}}'));
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
}));
