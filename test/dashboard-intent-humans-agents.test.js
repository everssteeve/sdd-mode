// @spec SPEC-018-4-bilan-humains-agents
// @verified-by test/dashboard-intent-humans-agents.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculerBilanHumainsAgents, blocBilanHumainsAgents } from '../lib/dashboard/intent-humans-agents.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function donnees(intents = [], specs = []) {
  return { intents, specs };
}

const INTENT_HUMAIN_AGENT = {
  id: 'INTENT-001', titre: 'Intent A', statut: 'active',
  auteur: 'Steeve Evers', executor: 'Claude Sonnet 4.6', validator: null,
};
const INTENT_HUMAIN_NULL = {
  id: 'INTENT-002', titre: 'Intent B', statut: 'in-progress',
  auteur: 'Alice Martin', executor: null, validator: null,
};
const INTENT_TOUT_NULL = {
  id: 'INTENT-003', titre: 'Intent C', statut: 'draft',
  auteur: null, executor: null, validator: null,
};
const INTENT_ARCHIVED = {
  id: 'INTENT-004', titre: 'Intent D', statut: 'archived',
  auteur: 'Bob', executor: null, validator: null,
};

// ─── CA-001 : collect.js — executor/validator nullable ────────────────────────

describe('collect.js — champs executor/validator', () => {
  it('CA-001 : intent sans executor retourne executor.nom=null, type=inconnu', () => {
    const bilan = calculerBilanHumainsAgents(donnees([INTENT_HUMAIN_NULL]));
    assert.equal(bilan[0].executor.nom, null);
    assert.equal(bilan[0].executor.type, 'inconnu');
  });

  it('CA-001 : intent sans validator retourne validator.nom=null, type=inconnu', () => {
    const bilan = calculerBilanHumainsAgents(donnees([INTENT_HUMAIN_NULL]));
    assert.equal(bilan[0].validator.nom, null);
    assert.equal(bilan[0].validator.type, 'inconnu');
  });
});

// ─── CA-002 : calculerBilanHumainsAgents ─────────────────────────────────────

describe('calculerBilanHumainsAgents()', () => {
  it('CA-002 : retourne un item par Intent non archivé', () => {
    const bilan = calculerBilanHumainsAgents(donnees([INTENT_HUMAIN_AGENT, INTENT_HUMAIN_NULL, INTENT_ARCHIVED]));
    assert.equal(bilan.length, 2);
    assert.ok(bilan.every(b => b.statut !== 'archived'));
  });

  it('CA-002 : chaque item a formulateur, executor, validator avec nom et type', () => {
    const bilan = calculerBilanHumainsAgents(donnees([INTENT_HUMAIN_AGENT]));
    const item = bilan[0];
    assert.ok('nom' in item.formulateur && 'type' in item.formulateur);
    assert.ok('nom' in item.executor && 'type' in item.executor);
    assert.ok('nom' in item.validator && 'type' in item.validator);
  });
});

// ─── CA-003 : classification agent ───────────────────────────────────────────

describe('classification agent IA', () => {
  it('CA-003 : "Claude Sonnet 4.6" → type agent', () => {
    const bilan = calculerBilanHumainsAgents(donnees([INTENT_HUMAIN_AGENT]));
    assert.equal(bilan[0].executor.type, 'agent');
  });

  it('CA-003 : "Steeve Evers" → type human', () => {
    const bilan = calculerBilanHumainsAgents(donnees([INTENT_HUMAIN_AGENT]));
    assert.equal(bilan[0].formulateur.type, 'human');
  });

  it('CA-003 : "GPT-4o" → type agent', () => {
    const bilan = calculerBilanHumainsAgents(donnees([{ ...INTENT_HUMAIN_AGENT, executor: 'GPT-4o' }]));
    assert.equal(bilan[0].executor.type, 'agent');
  });

  it('CA-003 : "Gemini 1.5" → type agent', () => {
    const bilan = calculerBilanHumainsAgents(donnees([{ ...INTENT_HUMAIN_AGENT, executor: 'Gemini 1.5' }]));
    assert.equal(bilan[0].executor.type, 'agent');
  });
});

// ─── CA-004 : champ absent → inconnu ─────────────────────────────────────────

describe('champ absent → inconnu', () => {
  it('CA-004 : auteur null → { nom: null, type: inconnu }', () => {
    const bilan = calculerBilanHumainsAgents(donnees([INTENT_TOUT_NULL]));
    assert.deepEqual(bilan[0].formulateur, { nom: null, type: 'inconnu' });
  });

  it('CA-004 : executor null → { nom: null, type: inconnu }', () => {
    const bilan = calculerBilanHumainsAgents(donnees([INTENT_TOUT_NULL]));
    assert.deepEqual(bilan[0].executor, { nom: null, type: 'inconnu' });
  });
});

// ─── CA-007 : test unitaire — 3 Intents ──────────────────────────────────────

describe('test de l\'Étranger — 3 Intents', () => {
  it('CA-007 : auteur humain + executor agent → types corrects', () => {
    const bilan = calculerBilanHumainsAgents(donnees([INTENT_HUMAIN_AGENT]));
    assert.equal(bilan[0].formulateur.type, 'human');
    assert.equal(bilan[0].executor.type, 'agent');
  });

  it('CA-007 : auteur humain + executor null → types corrects', () => {
    const bilan = calculerBilanHumainsAgents(donnees([INTENT_HUMAIN_NULL]));
    assert.equal(bilan[0].formulateur.type, 'human');
    assert.equal(bilan[0].executor.type, 'inconnu');
  });

  it('CA-007 : tout null → tous inconnu', () => {
    const bilan = calculerBilanHumainsAgents(donnees([INTENT_TOUT_NULL]));
    assert.equal(bilan[0].formulateur.type, 'inconnu');
    assert.equal(bilan[0].executor.type, 'inconnu');
    assert.equal(bilan[0].validator.type, 'inconnu');
  });
});

// ─── agentsGouvernance depuis specs ──────────────────────────────────────────

describe('agentsGouvernance depuis specs', () => {
  it('Intent sans SPECs liées → agentsGouvernance = []', () => {
    const bilan = calculerBilanHumainsAgents(donnees([INTENT_HUMAIN_AGENT], []));
    assert.deepEqual(bilan[0].agentsGouvernance, []);
  });

  it('SPEC liée avec @governance → tags remontés dans agentsGouvernance', () => {
    const specs = [{ id: 'SPEC-001-1', parentIntent: 'INTENT-001', governanceTags: ['AIAD-RGPD', 'AIAD-RGAA'] }];
    const bilan = calculerBilanHumainsAgents(donnees([INTENT_HUMAIN_AGENT], specs));
    assert.ok(bilan[0].agentsGouvernance.includes('AIAD-RGPD'));
    assert.ok(bilan[0].agentsGouvernance.includes('AIAD-RGAA'));
  });

  it('Plusieurs SPECs → gouvernance dédupliquée', () => {
    const specs = [
      { id: 'SPEC-001-1', parentIntent: 'INTENT-001', governanceTags: ['AIAD-RGPD'] },
      { id: 'SPEC-001-2', parentIntent: 'INTENT-001', governanceTags: ['AIAD-RGPD', 'AIAD-RGAA'] },
    ];
    const bilan = calculerBilanHumainsAgents(donnees([INTENT_HUMAIN_AGENT], specs));
    const uniq = new Set(bilan[0].agentsGouvernance);
    assert.equal(uniq.size, bilan[0].agentsGouvernance.length);
  });
});

// ─── CA-005 : blocBilanHumainsAgents() HTML ──────────────────────────────────

describe('blocBilanHumainsAgents() — structure HTML', () => {
  it('CA-005 : produit un <table> avec <caption>', () => {
    const html = blocBilanHumainsAgents(donnees([INTENT_HUMAIN_AGENT]));
    assert.ok(html.includes('<table>'), 'manque <table>');
    assert.ok(html.includes('<caption>Bilan humains / agents par Intent</caption>'));
  });

  it('CA-005 : <thead> présent', () => {
    const html = blocBilanHumainsAgents(donnees([INTENT_HUMAIN_AGENT]));
    assert.ok(html.includes('<thead>'));
  });

  it('CA-005 : <th scope="col"> sur chaque colonne', () => {
    const html = blocBilanHumainsAgents(donnees([INTENT_HUMAIN_AGENT]));
    const matches = html.match(/<th scope="col">/g);
    assert.ok(matches && matches.length >= 5, `attendu ≥5 th[scope=col], trouvé ${matches?.length ?? 0}`);
  });

  it('cellule — pour champ null', () => {
    const html = blocBilanHumainsAgents(donnees([INTENT_HUMAIN_NULL]));
    assert.ok(html.includes('<td>—</td>'));
  });

  it('badge "Agent IA" pour executor Claude', () => {
    const html = blocBilanHumainsAgents(donnees([INTENT_HUMAIN_AGENT]));
    assert.ok(html.includes('Agent IA'));
  });

  it('badge "Humain" pour auteur humain', () => {
    const html = blocBilanHumainsAgents(donnees([INTENT_HUMAIN_AGENT]));
    assert.ok(html.includes('Humain'));
  });

  it('0 Intent → état vide affiché', () => {
    const html = blocBilanHumainsAgents(donnees([]));
    assert.ok(html.includes('Aucun Intent'));
    assert.ok(!html.includes('<table>'));
  });
});
