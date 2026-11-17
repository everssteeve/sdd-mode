// Tests du registre des agents de rôle (SPEC-036-1).
//
// @spec SPEC-036-1-agents-de-role

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROLE_AGENTS, SUB_AGENTS, ROLE_SKILLS, GOVERNANCE_AGENTS, GOVERNANCE_MANAGER, HANDOFF_SKILL,
  sousAgentsDe, skillsDuRole, toolsDuRole, resoudreRole, fichiersAgents, fichiersSkillsDeRole,
} from '../lib/agents-registry.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('agents-registry', () => {
  test('CA-001 — exactement 5 agents de rôle, un par responsabilité AIAD', () => {
    assert.deepEqual(ROLE_AGENTS.map((r) => r.role), ['PM', 'PE', 'AE', 'QA', 'TL']);
    assert.deepEqual(
      ROLE_AGENTS.map((r) => r.name),
      ['aiad-pm', 'aiad-pe', 'aiad-ae', 'aiad-qa', 'aiad-tech-lead'],
    );
  });

  test('CA-002 — chaque sous-agent a un unique gestionnaire, qui est un agent de rôle', () => {
    const roles = new Set(ROLE_AGENTS.map((r) => r.name));
    const noms = SUB_AGENTS.map((s) => s.name);
    assert.equal(new Set(noms).size, noms.length, 'noms de sous-agents uniques');
    for (const s of SUB_AGENTS) {
      assert.ok(roles.has(s.owner), `${s.name} : gestionnaire ${s.owner} inconnu`);
    }
    for (const r of ROLE_AGENTS) {
      assert.ok(sousAgentsDe(r.name).length >= 1, `${r.name} gère au moins un sous-agent`);
    }
  });

  test('CA-002 — snapshot de la répartition des sous-agents par rôle', () => {
    assert.deepEqual(sousAgentsDe('aiad-pm'), ['pm-discovery-analyst', 'pm-backlog-curator', 'pm-outcome-analyst']);
    assert.deepEqual(sousAgentsDe('aiad-pe'), ['pe-spec-writer', 'pe-implementer', 'pe-code-reviewer', 'pe-drift-sentinel', 'pe-doc-writer']);
    assert.deepEqual(sousAgentsDe('aiad-ae'), ['ae-agent-configurator', 'ae-context-auditor', 'ae-agent-evaluator', 'ae-permissions-auditor']);
    assert.deepEqual(sousAgentsDe('aiad-qa'), ['qa-test-strategist', 'qa-test-author', 'qa-functional-validator', 'qa-exploratory-tester']);
    assert.deepEqual(sousAgentsDe('aiad-tech-lead'), ['tl-architecture-reviewer', 'tl-security-auditor', 'tl-performance-analyst', 'tl-debt-analyst', 'tl-release-engineer']);
  });

  test('CA-003 — aucun sous-agent ne reçoit l\'outil Agent ; les analystes n\'écrivent pas', () => {
    for (const s of SUB_AGENTS) {
      assert.ok(!/\b(Agent|Task)\b/.test(s.tools), `${s.name} ne doit pas déléguer`);
      const ecrit = /\b(Edit|Write)\b/.test(s.tools);
      if (!ecrit) {
        assert.match(s.disallowed, /Edit/, `${s.name} : Edit interdit explicitement`);
        assert.match(s.disallowed, /Write/, `${s.name} : Write interdit explicitement`);
      }
    }
  });

  test('CA-004 — la délégation d\'un rôle = ses sous-agents + la gouvernance Tier 1', () => {
    const tools = toolsDuRole('aiad-pe');
    assert.ok(tools.startsWith('Agent(pe-spec-writer, pe-implementer, pe-code-reviewer, pe-drift-sentinel, pe-doc-writer, AIAD-AI-ACT'));
    for (const g of GOVERNANCE_AGENTS) assert.ok(tools.includes(g));
    assert.ok(!tools.includes('qa-'), 'aucun sous-agent d\'un autre rôle');
    assert.equal(GOVERNANCE_MANAGER, 'aiad-ae');
  });

  test('CA-005 — toute skill référencée est livrée dans templates/', () => {
    const referencees = new Set([
      ...ROLE_AGENTS.flatMap((r) => skillsDuRole(r.name)),
      ...SUB_AGENTS.flatMap((s) => s.skills),
    ]);
    for (const s of referencees) {
      assert.ok(existsSync(join(ROOT, 'templates', '.claude', 'skills', s, 'SKILL.md')), `skill livrée : ${s}`);
    }
    for (const s of ROLE_SKILLS) {
      assert.ok(referencees.has(s), `skill de rôle utilisée par au moins un agent : ${s}`);
    }
    for (const r of ROLE_AGENTS) assert.ok(skillsDuRole(r.name).includes(HANDOFF_SKILL));
  });

  test('fichiers livrés : un fichier par agent et par skill de rôle', () => {
    for (const f of [...fichiersAgents(), ...fichiersSkillsDeRole()]) {
      assert.ok(existsSync(join(ROOT, 'templates', f)), `livré : ${f}`);
    }
    assert.equal(fichiersAgents().length, ROLE_AGENTS.length + SUB_AGENTS.length);
  });

  test('resoudreRole — accepte sigle, nom d\'agent et libellé', () => {
    assert.equal(resoudreRole('pe').name, 'aiad-pe');
    assert.equal(resoudreRole('TL').name, 'aiad-tech-lead');
    assert.equal(resoudreRole('tech-lead').name, 'aiad-tech-lead');
    assert.equal(resoudreRole('aiad-qa').name, 'aiad-qa');
    assert.equal(resoudreRole('product-manager').name, 'aiad-pm');
    assert.equal(resoudreRole('dev'), null);
    assert.equal(resoudreRole(''), null);
    assert.deepEqual(skillsDuRole('inconnu'), []);
  });
});
