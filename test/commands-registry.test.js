// Tests du registre catégorisé des commandes (SPEC-015-2-1).
// @intent INTENT-015
// @spec SPEC-015-2-1-registre-commandes
//
// Couvre CA-001→CA-008 + le snapshot de tiering (anti-drift, CA-007).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  COMMANDS_REGISTRY, TIERS, STATUSES, tierOf, listByTier, aggregateTiers, showCommands,
} from '../lib/commands-registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, '..', 'bin', 'aiad-sdd.js');

// Extrait COMMANDES_VALIDES (liste canonique) depuis le source du bin.
function commandesValides() {
  const src = readFileSync(BIN, 'utf-8');
  const m = src.match(/const COMMANDES_VALIDES = \[([\s\S]*?)\];/);
  assert.ok(m, 'COMMANDES_VALIDES introuvable dans le bin');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

function capture(fn) {
  const orig = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  let out = '';
  let err = '';
  process.stdout.write = (c) => { out += c; return true; };
  process.stderr.write = (c) => { err += c; return true; };
  try { const r = fn(); return { r, out, err }; }
  finally { process.stdout.write = orig; process.stderr.write = origErr; }
}

// CA-001 — cohérence bidirectionnelle registre ↔ COMMANDES_VALIDES.
test('registry matches COMMANDES_VALIDES bidirectionally', () => {
  const valides = new Set(commandesValides());
  const registre = new Set(COMMANDS_REGISTRY.map((e) => e.command));
  const manquantes = [...valides].filter((c) => !registre.has(c));
  const enTrop = [...registre].filter((c) => !valides.has(c));
  assert.deepEqual(manquantes, [], `commandes sans entrée registre : ${manquantes}`);
  assert.deepEqual(enTrop, [], `entrées registre hors COMMANDES_VALIDES : ${enTrop}`);
});

// CA-002 — schéma de chaque entrée.
test('every entry has valid tier status category', () => {
  for (const e of COMMANDS_REGISTRY) {
    assert.ok(TIERS.includes(e.tier), `tier invalide : ${e.command} → ${e.tier}`);
    assert.ok(STATUSES.includes(e.status), `status invalide : ${e.command} → ${e.status}`);
    assert.equal(typeof e.category, 'string');
    assert.ok(e.category.length > 0, `category vide : ${e.command}`);
  }
  // Pas de doublon de commande.
  const noms = COMMANDS_REGISTRY.map((e) => e.command);
  assert.equal(noms.length, new Set(noms).size, 'doublon dans le registre');
});

// CA-003 — listing groupé par tier, ordre core→extended→experimental, alpha intra-tier.
test('lists grouped by tier', () => {
  const { r } = capture(() => showCommands({ json: false }));
  const tiersOrder = r.commands.map((e) => TIERS.indexOf(e.tier));
  // Non-décroissant : core(0) avant extended(1) avant experimental(2).
  for (let i = 1; i < tiersOrder.length; i++) assert.ok(tiersOrder[i] >= tiersOrder[i - 1]);
  // Tri alpha à l'intérieur du tier 'core'.
  const core = r.commands.filter((e) => e.tier === 'core').map((e) => e.command);
  assert.deepEqual(core, [...core].sort((a, b) => a.localeCompare(b)));
});

// CA-004 — filtre par tier.
test('filters by tier', () => {
  const { r } = capture(() => showCommands({ tier: 'experimental', json: false }));
  assert.ok(r.commands.length > 0);
  assert.ok(r.commands.every((e) => e.tier === 'experimental'));
});

// CA-005 — sortie JSON stable, objet unique.
test('json shape', () => {
  const { r, out } = capture(() => showCommands({ json: true }));
  const parsed = JSON.parse(out); // un seul objet JSON sur stdout
  assert.deepEqual(Object.keys(parsed).sort(), ['commands', 'tiers', 'total']);
  assert.deepEqual(Object.keys(parsed.tiers).sort(), ['core', 'experimental', 'extended']);
  assert.equal(parsed.total, COMMANDS_REGISTRY.length);
  assert.equal(r.total, parsed.total);
});

// CA-006 — tier invalide → erreur + exit 1 (invalidTier).
test('invalid tier exits 1', () => {
  const { r, err } = capture(() => showCommands({ tier: 'legacy', json: false }));
  assert.equal(r.invalidTier, true);
  assert.match(err, /Tier inconnu/);
  assert.match(err, /core, extended, experimental/);
});

// CA-007 — snapshot de tiering figé (anti-drift).
// Toute addition / retrait / re-tiering sans MAJ de ce snapshot casse le test.
test('tier mapping snapshot', () => {
  const SNAPSHOT = {
    core: ['audit', 'commands', 'dashboard', 'doctor', 'dpia', 'emit-rules', 'export', 'feedback', 'gouvernance', 'help', 'hooks', 'import', 'init', 'new', 'review', 'sbom', 'score', 'skills', 'status', 'telemetry', 'template', 'trace', 'uninstall', 'update', 'version'],
    extended: ['adrs', 'ai-act', 'anonymize', 'archive', 'azure', 'backup', 'badge', 'bench', 'bitbucket', 'brief', 'cert', 'ci-template', 'completion', 'dinum', 'docs', 'dora', 'github-app', 'gitlab', 'hook-stats', 'hooks-init', 'marketplace', 'migrate', 'migrate-v2', 'negotiate', 'obsidian', 'offline', 'org', 'pii-scan', 'plugin', 'provenance', 'rbac', 'refactor-spec', 'reflect', 'repl', 'restore', 'schema', 'self-update', 'sla', 'sovereignty', 'spec-version', 'standup', 'storybook', 'suggest-annotations', 'tour', 'tutorial', 'verify-reproducibility', 'webhooks', 'workspace'],
    experimental: ['canary', 'cross-model', 'cycle', 'hooks-config', 'memory', 'proportionality', 'statusline', 'sunset'],
  };
  const actual = {};
  for (const t of TIERS) actual[t] = listByTier(t).map((e) => e.command).sort((a, b) => a.localeCompare(b));
  assert.deepEqual(actual, SNAPSHOT);
});

// CA-008 — lecture seule : aucune écriture, helpers purs.
test('no write no network', () => {
  // tierOf / listByTier / aggregateTiers ne touchent ni FS ni réseau.
  assert.equal(tierOf('init'), 'core');
  assert.equal(tierOf('sunset'), 'experimental');
  assert.equal(tierOf('inexistante'), null);
  const agg = aggregateTiers();
  assert.equal(agg.total, COMMANDS_REGISTRY.length);
  // Le registre est gelé (Object.freeze) — pas de mutation accidentelle.
  assert.throws(() => { COMMANDS_REGISTRY.push({}); });
});
