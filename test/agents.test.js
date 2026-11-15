// Tests de `aiad-sdd agents` : validation de l'équipe, choix de l'assistant (SPEC-036-1).
//
// @spec SPEC-036-1-agents-de-role

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  validerEquipe, choisirAssistant, decrireEquipe, commandeAgents, decouperTools, delegationDe,
} from '../lib/agents.js';
import { ROLE_AGENTS, SUB_AGENTS } from '../lib/agents-registry.js';
import { verifierParite } from '../scripts/check-commands-parity.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(ROOT, 'bin', 'aiad-sdd.js');

/** Projet temporaire avec l'équipe livrée (agents + skills). */
function projet() {
  const d = mkdtempSync(join(tmpdir(), 'aiad-agents-'));
  cpSync(join(ROOT, 'templates', '.claude', 'agents'), join(d, '.claude', 'agents'), { recursive: true });
  cpSync(join(ROOT, 'templates', '.claude', 'skills'), join(d, '.claude', 'skills'), { recursive: true });
  return d;
}

function modifier(d, nom, fn) {
  const p = join(d, '.claude', 'agents', `${nom}.md`);
  writeFileSync(p, fn(readFileSync(p, 'utf-8')));
}

const raisonsDe = (r, nom) => r.results.find((x) => x.name === nom).raisons.join(' | ');

describe('agents — validerEquipe', () => {
  test('CA-006 — l\'équipe livrée est conforme au registre', () => {
    const d = projet();
    try {
      const r = validerEquipe(d);
      assert.equal(r.ok, true, JSON.stringify(r.results.filter((x) => !x.ok)));
      assert.equal(r.total, ROLE_AGENTS.length + SUB_AGENTS.length);
      assert.equal(r.valid, r.total);
      assert.equal(r.installed, true);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-006 — projet sans agents : non conforme, installed = false', () => {
    const d = mkdtempSync(join(tmpdir(), 'aiad-agents-'));
    try {
      const r = validerEquipe(d);
      assert.equal(r.ok, false);
      assert.equal(r.installed, false);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-007 — un rôle qui délègue au sous-agent d\'un autre rôle est refusé', () => {
    const d = projet();
    try {
      modifier(d, 'aiad-pm', (s) => s.replace('Agent(pm-discovery-analyst', 'Agent(pe-implementer, pm-discovery-analyst'));
      const r = validerEquipe(d);
      assert.equal(r.ok, false);
      assert.match(raisonsDe(r, 'aiad-pm'), /pe-implementer.*pas géré par ce rôle/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-007 — délégation non bornée (pas de Agent(...)) refusée', () => {
    const d = projet();
    try {
      modifier(d, 'aiad-qa', (s) => s.replace(/^tools: Agent\([^)]*\), /m, 'tools: '));
      assert.match(raisonsDe(validerEquipe(d), 'aiad-qa'), /délégation n'est pas bornée/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-008 — un sous-agent qui reçoit l\'outil Agent est refusé', () => {
    const d = projet();
    try {
      modifier(d, 'pe-code-reviewer', (s) => s.replace('tools: Read', 'tools: Agent, Read'));
      assert.match(raisonsDe(validerEquipe(d), 'pe-code-reviewer'), /ne doit pas disposer de l'outil Agent/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-008 — gestionnaire modifié, fichier absent, skill absente : signalés', () => {
    const d = projet();
    try {
      modifier(d, 'qa-test-author', (s) => s.replace('aiad-managed-by: aiad-qa', 'aiad-managed-by: aiad-pe'));
      rmSync(join(d, '.claude', 'agents', 'tl-debt-analyst.md'));
      rmSync(join(d, '.claude', 'skills', 'code-review'), { recursive: true });
      const r = validerEquipe(d);
      assert.match(raisonsDe(r, 'qa-test-author'), /aiad-managed-by.*attendu : aiad-qa/);
      assert.match(raisonsDe(r, 'tl-debt-analyst'), /Fichier absent/);
      assert.match(raisonsDe(r, 'pe-code-reviewer'), /Skill préchargée absente du projet : code-review/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-009 — sous-agent ajouté par le projet : accepté s\'il est rattaché et délégué', () => {
    const d = projet();
    try {
      const corps = '---\nname: pe-migrator\ndescription: "Plans and runs framework migrations for the Product Engineer."\ntools: Read, Grep\naiad-managed-by: aiad-pe\n---\n\n# x\n';
      writeFileSync(join(d, '.claude', 'agents', 'pe-migrator.md'), corps);
      let r = validerEquipe(d);
      assert.match(raisonsDe(r, 'aiad-pe'), /pe-migrator.*absent de la liste Agent/);
      modifier(d, 'aiad-pe', (s) => s.replace('Agent(pe-spec-writer', 'Agent(pe-migrator, pe-spec-writer'));
      r = validerEquipe(d);
      assert.equal(r.ok, true);
      // Gestionnaire inconnu → orphelin.
      writeFileSync(join(d, '.claude', 'agents', 'x-orphan.md'), corps.replace('pe-migrator', 'x-orphan').replace('aiad-pe', 'aiad-cto'));
      r = validerEquipe(d);
      assert.equal(r.ok, false);
      assert.deepEqual(r.orphans, ['x-orphan']);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('decouperTools / delegationDe', () => {
    assert.deepEqual(decouperTools('Agent(a, b), Read, Bash'), ['Agent(a, b)', 'Read', 'Bash']);
    assert.deepEqual(delegationDe('Agent(a, b), Read'), ['a', 'b']);
    assert.equal(delegationDe('Read, Grep'), null);
    assert.deepEqual(delegationDe('Agent, Read'), []);
  });
});

describe('agents — choisirAssistant', () => {
  test('CA-010 — use <rôle> écrit `agent` dans settings.local.json sans toucher au reste', () => {
    const d = projet();
    try {
      writeFileSync(join(d, '.claude', 'settings.local.json'), JSON.stringify({ permissions: { allow: ['Bash(ls)'] } }));
      const r = choisirAssistant(d, 'tl');
      assert.equal(r.ok, true);
      const reglages = JSON.parse(readFileSync(join(d, '.claude', 'settings.local.json'), 'utf-8'));
      assert.equal(reglages.agent, 'aiad-tech-lead');
      assert.deepEqual(reglages.permissions, { allow: ['Bash(ls)'] });
      assert.equal(choisirAssistant(d, undefined, { clear: true }).agent, null);
      assert.equal('agent' in JSON.parse(readFileSync(join(d, '.claude', 'settings.local.json'), 'utf-8')), false);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-010 — rôle inconnu, agent non installé, JSON invalide : refus sans écriture', () => {
    const d = mkdtempSync(join(tmpdir(), 'aiad-agents-'));
    try {
      assert.equal(choisirAssistant(d, 'cto').ok, false);
      assert.match(choisirAssistant(d, 'pe').message, /n'est pas installé/);
      assert.equal(existsSync(join(d, '.claude', 'settings.local.json')), false);
      mkdirSync(join(d, '.claude'), { recursive: true });
      writeFileSync(join(d, '.claude', 'settings.local.json'), '{oops');
      assert.match(choisirAssistant(d, 'pe').message, /illisible/);
      assert.equal(readFileSync(join(d, '.claude', 'settings.local.json'), 'utf-8'), '{oops');
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

describe('agents — CLI et intégration', () => {
  test('decrireEquipe — 5 rôles, tous les sous-agents, gouvernance administrée par aiad-ae', () => {
    const e = decrireEquipe();
    assert.equal(e.roles.length, 5);
    assert.equal(e.roles.flatMap((r) => r.subAgents).length, SUB_AGENTS.length);
    assert.equal(e.governance.managedBy, 'aiad-ae');
  });

  test('CA-011 — CLI : list --json, validate (exit 0 / 1), sous-commande inconnue', async () => {
    const d = projet();
    try {
      const run = (...args) => spawnSync(process.execPath, [BIN, 'agents', ...args], { cwd: d, encoding: 'utf-8' });
      const liste = run('list', '--json');
      assert.equal(liste.status, 0);
      assert.equal(JSON.parse(liste.stdout).roles.length, 5);
      assert.equal(run('validate').status, 0);
      const json = run('validate', '--json');
      assert.equal(JSON.parse(json.stdout).ok, true);
      assert.equal(run('use', 'qa').status, 0);
      assert.equal(run('use', 'none').status, 0);
      rmSync(join(d, '.claude', 'agents', 'aiad-pm.md'));
      assert.equal(run('validate').status, 1);
      assert.equal(await commandeAgents(d, 'inconnue'), 1);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-012 — parité dépôt ↔ livré étendue aux agents', () => {
    const r = verifierParite(ROOT);
    assert.equal(r.exitCode, 0, JSON.stringify(r.divergents));
  });

  test('CA-012 — les fichiers livrés ne relâchent pas la supervision', () => {
    for (const a of [...ROLE_AGENTS, ...SUB_AGENTS]) {
      const s = readFileSync(join(ROOT, 'templates', '.claude', 'agents', `${a.name}.md`), 'utf-8');
      assert.doesNotMatch(s, /permissionMode|bypassPermissions/, `${a.name} : aucun mode de permission imposé`);
      assert.match(s, /Contrat d'exécution/, `${a.name} : contrat d'exécution présent`);
    }
    for (const r of ROLE_AGENTS) {
      const s = readFileSync(join(ROOT, 'templates', '.claude', 'agents', `${r.name}.md`), 'utf-8');
      assert.match(s, /Décisions réservées à l'humain/, `${r.name} : décisions réservées à l'humain`);
    }
  });
});
