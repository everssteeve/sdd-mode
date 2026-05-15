// Tests `SECURITY.md` — politique de divulgation responsable.
// Vérifie la présence des sections clés attendues par les acheteurs EU
// (audits supply-chain) et la conformité au modèle CERT/CC.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SECURITY_PATH = join(__dirname, '..', 'SECURITY.md');

test('SECURITY.md — fichier présent à la racine', () => {
  assert.ok(existsSync(SECURITY_PATH), 'SECURITY.md absent');
});

test('SECURITY.md — TL;DR avec canal de signalement', () => {
  const c = readFileSync(SECURITY_PATH, 'utf-8');
  assert.match(c, /TL;DR/);
  assert.match(c, /GitHub Security Advisories/i);
  assert.match(c, /evers\.steeve@gmail\.com/);
});

test('SECURITY.md — matrice versions supportées', () => {
  const c = readFileSync(SECURITY_PATH, 'utf-8');
  assert.match(c, /Versions supportées/i);
  assert.match(c, /1\.14\.x/);
});

test('SECURITY.md — surface d\'attaque documentée', () => {
  const c = readFileSync(SECURITY_PATH, 'utf-8');
  assert.match(c, /Surface d'attaque/i);
  // Mentions techniques attendues
  assert.match(c, /zero-dep/i);
  assert.match(c, /path traversal/i);
  assert.match(c, /supply chain/i);
  assert.match(c, /Marketplace/);
});

test('SECURITY.md — SLA explicite (72h, 7j, 30j)', () => {
  const c = readFileSync(SECURITY_PATH, 'utf-8');
  assert.match(c, /72\s*h/i);
  assert.match(c, /7\s*jours/i);
  assert.match(c, /30\s*jours/i);
});

test('SECURITY.md — process disclosure coordonnée 6 étapes', () => {
  const c = readFileSync(SECURITY_PATH, 'utf-8');
  assert.match(c, /Réception/i);
  assert.match(c, /Triage/i);
  assert.match(c, /Patch/i);
  assert.match(c, /Validation/i);
  assert.match(c, /Release/i);
  assert.match(c, /Disclosure/i);
});

test('SECURITY.md — référence Cyber Resilience Act EU 2024/2847', () => {
  const c = readFileSync(SECURITY_PATH, 'utf-8');
  assert.match(c, /Cyber Resilience Act/i);
  assert.match(c, /2024\/2847/);
});

test('SECURITY.md — bonnes pratiques utilisateur (sans dépendance fantôme)', () => {
  const c = readFileSync(SECURITY_PATH, 'utf-8');
  assert.match(c, /Bonnes pratiques/i);
  assert.match(c, /provenance/i);
  assert.match(c, /update --check/);
});
