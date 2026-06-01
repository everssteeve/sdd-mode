// Tests des templates SPECs vague 2 — observability + billing (item #116).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerTemplatesSpec, templateSpecExiste, creerSpecDepuisTemplate } from '../lib/specs-library.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIBRARY_DIR = join(__dirname, '..', 'templates', '.aiad', 'specs-library');

function tmp() {
  const d = mkdtempSync(join(tmpdir(), 'aiad-sl2-'));
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

// ─── Présence ─────────────────────────────────────────────────────────────

test('listerTemplatesSpec — couvre désormais ≥ 6 templates', () => {
  const t = listerTemplatesSpec();
  assert.ok(t.length >= 6, `attendu ≥ 6, vu ${t.length}`);
  const ids = t.map((x) => x.id);
  for (const attendu of ['auth-oidc', 'gdpr-data-export', 'payment-pci', 'rag-llm', 'observability-otel', 'billing-stripe-tax']) {
    assert.ok(ids.includes(attendu), `template ${attendu} absent`);
  }
});

test('templateSpecExiste — vague 2 reconnue', () => {
  assert.equal(templateSpecExiste('observability-otel'), true);
  assert.equal(templateSpecExiste('billing-stripe-tax'), true);
});

// ─── observability-otel ───────────────────────────────────────────────────

test('observability-otel — frontmatter gouvernance RGPD+RGESN+CRA', () => {
  const t = listerTemplatesSpec().find((x) => x.id === 'observability-otel');
  assert.ok(t);
  assert.ok(t.governance.includes('AIAD-RGPD'));
  assert.ok(t.governance.includes('AIAD-RGESN'));
  assert.ok(t.governance.includes('AIAD-CRA'));
});

test('observability-otel — contenu couvre traces+metrics+logs+retention', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'observability-otel.md'), 'utf-8');
  assert.match(c, /OpenTelemetry/);
  assert.match(c, /OTLP\/(gRPC|HTTP)/);
  assert.match(c, /échantillonnage/i);
  assert.match(c, /\bRED\b/);
  assert.match(c, /\bUSE\b/);
  assert.match(c, /PII/);
  assert.match(c, /\bREDACTED\b/);
});

test('observability-otel — politique de retention différenciée', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'observability-otel.md'), 'utf-8');
  assert.match(c, /Traces.*7 jours/i);
  assert.match(c, /Metrics.*13 mois/i);
  assert.match(c, /Logs applicatifs.*30 jours/i);
  assert.match(c, /Logs de sécurité.*1 an/i);
});

test('observability-otel — critères EARS R1-R8 présents', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'observability-otel.md'), 'utf-8');
  for (const r of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8']) {
    assert.match(c, new RegExp(`### ${r} —`));
  }
  // Vérifier mot-clé EARS dans plusieurs critères
  const earsMatches = c.match(/\*\*(WHEN|WHILE|THE SYSTEM SHALL)\*\*/g);
  assert.ok(earsMatches && earsMatches.length >= 8);
});

test('observability-otel — anti-patterns explicites', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'observability-otel.md'), 'utf-8');
  assert.match(c, /## Anti-patterns interdits/);
  assert.match(c, /JAMAIS.*payloads complets/i);
  assert.match(c, /JAMAIS.*SaaS hors EU/i);
});

// ─── billing-stripe-tax ───────────────────────────────────────────────────

test('billing-stripe-tax — frontmatter gouvernance RGPD + CRA', () => {
  const t = listerTemplatesSpec().find((x) => x.id === 'billing-stripe-tax');
  assert.ok(t);
  assert.ok(t.governance.includes('AIAD-RGPD'));
  assert.ok(t.governance.includes('AIAD-CRA'));
});

test('billing-stripe-tax — couvre OSS + IOSS + VIES + Stripe Tax', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'billing-stripe-tax.md'), 'utf-8');
  assert.match(c, /\bOSS\b/);
  assert.match(c, /\bIOSS\b/);
  assert.match(c, /\bVIES\b/);
  assert.match(c, /Stripe Tax/);
  assert.match(c, /reverse charge/i);
});

test('billing-stripe-tax — retention 10 ans + numéros séquentiels', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'billing-stripe-tax.md'), 'utf-8');
  assert.match(c, /10 ans/);
  assert.match(c, /séquentiel|séquence/i);
  assert.match(c, /Article 1741|CGI/);
});

test('billing-stripe-tax — webhook signature + idempotence', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'billing-stripe-tax.md'), 'utf-8');
  assert.match(c, /Stripe-Signature/);
  assert.match(c, /HMAC-SHA256/);
  assert.match(c, /idempoten/i);
});

test('billing-stripe-tax — critères EARS R1-R9 présents', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'billing-stripe-tax.md'), 'utf-8');
  for (const r of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9']) {
    assert.match(c, new RegExp(`### ${r} —`));
  }
});

test('billing-stripe-tax — anti-patterns PCI-DSS + TVA en dur', () => {
  const c = readFileSync(join(LIBRARY_DIR, 'billing-stripe-tax.md'), 'utf-8');
  assert.match(c, /JAMAIS.*calculer la TVA en local/i);
  assert.match(c, /JAMAIS.*numéro de carte/i);
  assert.match(c, /JAMAIS.*séquence des numéros/i);
});

// ─── creerSpecDepuisTemplate — round-trip avec interpolation ─────────────

test('creerSpecDepuisTemplate — observability-otel interpole le titre + intent', silent(async () => {
  const d = tmp();
  try {
    const r = await creerSpecDepuisTemplate(d, 'observability-otel', {
      title: 'Mon SPEC observabilité',
      parent_intent: 'INT-042',
      service: 'api-orders',
    });
    assert.ok(r.path);
    assert.ok(existsSync(r.path));
    const c = readFileSync(r.path, 'utf-8');
    assert.match(c, /title: "Mon SPEC observabilité"/);
    assert.match(c, /parent_intent: "INT-042"/);
    assert.ok(!c.includes('{{title}}'));
    assert.ok(!c.includes('{{parent_intent}}'));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('creerSpecDepuisTemplate — billing-stripe-tax interpole correctement', silent(async () => {
  const d = tmp();
  try {
    const r = await creerSpecDepuisTemplate(d, 'billing-stripe-tax', {
      title: 'Facturation SaaS Bisounours',
      parent_intent: 'INT-007',
      service: 'billing-service',
    });
    const c = readFileSync(r.path, 'utf-8');
    assert.match(c, /Facturation SaaS Bisounours/);
    assert.match(c, /INT-007/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

// ─── Test de cohérence transversale ──────────────────────────────────────

test('tous les templates vague 2 contiennent une section "Test de l\'Étranger"', () => {
  for (const id of ['observability-otel', 'billing-stripe-tax']) {
    const c = readFileSync(join(LIBRARY_DIR, `${id}.md`), 'utf-8');
    assert.match(c, /## Test de l'Étranger/, `${id} sans section`);
  }
});

test('tous les templates vague 2 ont une section Tests d\'exemple avec annotations', () => {
  for (const id of ['observability-otel', 'billing-stripe-tax']) {
    const c = readFileSync(join(LIBRARY_DIR, `${id}.md`), 'utf-8');
    assert.match(c, /## Tests d'exemple/, `${id} sans section`);
    assert.match(c, /@spec \{\{spec_id\}\}/, `${id} sans @spec`);
    assert.match(c, /@verified-by/, `${id} sans @verified-by`);
    assert.match(c, /@governance/, `${id} sans @governance`);
  }
});

test('tous les templates vague 2 listent leurs références', () => {
  for (const id of ['observability-otel', 'billing-stripe-tax']) {
    const c = readFileSync(join(LIBRARY_DIR, `${id}.md`), 'utf-8');
    assert.match(c, /## Références/, `${id} sans section références`);
  }
});
