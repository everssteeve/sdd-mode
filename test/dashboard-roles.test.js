// Tests des cockpits par responsabilité et de la vue d'ensemble (SPEC-037-1).
//
// @spec SPEC-037-1-dashboard-par-role

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocAssistant, resumeRoles, pagePe, pageAe, pageTl } from '../lib/dashboard/views/roles.js';
import { pageOverview } from '../lib/dashboard/views/overview.js';
import { SUB_AGENTS } from '../lib/agents-registry.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Jeu de données minimal mais complet, sur un projet temporaire. */
function donnees(racine, surcharge = {}) {
  return {
    projet: { nom: 'Mon App', version: '0.3.0', racine, genere: '2026-11-15T10:00:00.000Z' },
    fondamentaux: [{ nom: 'ARCHITECTURE.md', chemin: '.aiad/ARCHITECTURE.md', titre: 'Archi', present: true, rempli: true, tailleKo: 2 }],
    intents: [{ id: 'INTENT-001', titre: 'A', statut: 'active', date: '2026-11-10' }, { id: 'INTENT-002', titre: 'B', statut: 'draft', date: '2026-11-12' }],
    specs: [
      { id: 'SPEC-001-1-a', titre: 'Alpha', parentIntent: 'INTENT-001', statut: 'ready', sqs: 5 },
      { id: 'SPEC-001-2-b', titre: 'Beta <x>', parentIntent: 'INTENT-001', statut: 'draft', sqs: 3 },
      { id: 'SPEC-001-3-c', titre: 'Gamma', parentIntent: 'INTENT-001', statut: 'done', sqs: 4 },
      { id: 'spec-template', titre: 'SPEC-[NNN]', statut: 'draft', sqs: null },
    ],
    gouvernance: [{ id: 'AIAD-RGPD', present: true }, { id: 'AIAD-RGAA', present: false }],
    facts: [{ id: 'FACT-001', titre: 'Écart', gravite: 'major', statut: 'open' }, { id: 'FACT-002', titre: 'Clos', gravite: 'minor', statut: 'closed' }],
    changelog: { entrees: [] },
    metrics: { categories: {}, agregats: { deployments: { total: 4, success: 3, leadTimeMoyen: 2 }, drift: { driftsDetectes: 0, driftsResolus: 0 } } },
    matrice: {
      summary: { codeFiles: 10, annotatedCodeFiles: 4 },
      gaps: { intentsSansSpec: [], specsSansCode: [], specsValideesNonImplementees: [], specsOrphelinsSurCode: [], intentsOrphelinsSurCode: [], codeSansSpec: { total: 6 }, codeSansTests: [], earsSpecsSansTests: [] },
    },
    signaux: {},
    supplementaire: {},
    maturite: { score: 3, total: 5, label: 'Structuré', cls: 'maturite-info' },
    ...surcharge,
  };
}

describe('dashboard — cockpits par responsabilité', () => {
  test('CA-010 — blocAssistant : agent de rôle, commande, sous-agents du registre', () => {
    const html = blocAssistant('pe');
    assert.match(html, /Votre assistant : <code>aiad-pe<\/code>/);
    assert.match(html, /claude --agent aiad-pe/);
    for (const s of SUB_AGENTS.filter((x) => x.owner === 'aiad-pe')) assert.ok(html.includes(s.name));
    assert.ok(!html.includes('qa-test-author'), 'aucun sous-agent d\'un autre rôle');
    assert.match(html, /Les décisions restent les vôtres/);
    assert.equal(blocAssistant('global'), '');
    assert.equal(blocAssistant('inconnu'), '');
  });

  test('CA-011 — resumeRoles : 5 rôles, 3 chiffres chacun, alertes ventilées par onglet', () => {
    const d = mkdtempSync(join(tmpdir(), 'aiad-roles-'));
    try {
      const roles = resumeRoles(donnees(d));
      assert.deepEqual(roles.map((r) => r.id), ['pm', 'pe', 'ae', 'qa', 'tl']);
      for (const r of roles) assert.equal(r.chiffres.length, 3, `3 chiffres pour ${r.id}`);
      const pe = roles.find((r) => r.id === 'pe');
      assert.deepEqual(pe.chiffres, [['SPECs en cours', '2'], ['Code tracé', '40 %'], ['Facts ouverts', '1']]);
      // SQS faible → specs.html (PE) ; fact majeur → drifts.html (PE) ; gouvernance manquante → governance.html (AE).
      assert.deepEqual(pe.alertes, { bad: 0, warn: 2 });
      assert.deepEqual(roles.find((r) => r.id === 'ae').alertes, { bad: 1, warn: 0 });
      // Équipe d'agents non installée dans ce projet : non mesuré, pas de valeur inventée.
      assert.equal(roles.find((r) => r.id === 'ae').chiffres[0][1], '—');
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-011 — données vides : aucun plantage, tirets', () => {
    const roles = resumeRoles({});
    assert.equal(roles.length, 5);
    assert.ok(roles.every((r) => r.alertes.bad === 0 && r.alertes.warn === 0));
    assert.match(pagePe({}), /Aucune SPEC en cours/);
    assert.match(pageAe({}), /équipe non installée/);
    assert.match(pageTl({}), /Cohérence|ARCHITECTURE\.md/);
  });

  test('CA-012 — pagePe : chiffres dérivés des données, gabarits exclus, contenu échappé', () => {
    const d = mkdtempSync(join(tmpdir(), 'aiad-roles-'));
    try {
      const html = pagePe(donnees(d));
      assert.match(html, /SPECs en cours <span class="count">2<\/span>/);
      assert.ok(!html.includes('spec-template'), 'gabarit de SPEC exclu');
      assert.ok(html.includes('Beta &lt;x&gt;') && !html.includes('Beta <x>'));
      assert.match(html, /4\.0\/5/, 'SQS moyen (5+3+4)/3');
      assert.match(html, /4\/10 fichiers annotés @spec/);
      assert.match(html, /SQS faible sur SPEC-001-2-b/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-013 — pageAe : conformité de l\'équipe lue dans le projet', () => {
    const d = mkdtempSync(join(tmpdir(), 'aiad-roles-'));
    try {
      cpSync(join(ROOT, 'templates', '.claude', 'agents'), join(d, '.claude', 'agents'), { recursive: true });
      cpSync(join(ROOT, 'templates', '.claude', 'skills'), join(d, '.claude', 'skills'), { recursive: true });
      let html = pageAe(donnees(d));
      assert.match(html, /26\/26/);
      assert.ok(!html.includes('écart(s)'));
      rmSync(join(d, '.claude', 'agents', 'pe-code-reviewer.md'));
      html = pageAe(donnees(d));
      assert.match(html, /25\/26/);
      assert.match(html, /1 écart\(s\)/);
      assert.match(html, /Ce qui n'est pas mesuré ici/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-014 — pageTl : architecture, déploiements, dette', () => {
    const d = mkdtempSync(join(tmpdir(), 'aiad-roles-'));
    try {
      const html = pageTl(donnees(d));
      assert.match(html, /rédigé/);
      assert.match(html, /75 % réussis/);
      assert.match(html, /2 j/);
      assert.match(html, /Dette technique/);
      assert.match(html, /claude --agent aiad-tech-lead/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-015 — vue d\'ensemble : héros, cycle, cinq cartes de rôle liées à leur cockpit', () => {
    const d = mkdtempSync(join(tmpdir(), 'aiad-roles-'));
    try {
      const html = pageOverview(donnees(d));
      assert.match(html, /class="hero"/);
      assert.match(html, /Application en cours de développement/);
      assert.match(html, /Mon App/);
      assert.match(html, /Le cycle en un coup d'œil/);
      assert.equal((html.match(/class="pipe-step/g) || []).length, 6);
      for (const [id, file] of [['pm', 'pm.html'], ['pe', 'pe.html'], ['ae', 'ae.html'], ['qa', 'qa.html'], ['tl', 'tl.html']]) {
        assert.ok(html.includes(`class="role-card" data-onglet="${id}" href="${file}"`), `carte ${id}`);
      }
      assert.match(html, /3 signal\(s\) à traiter, dont 1 critique\(s\)/);
      // Les sections historiques restent présentes.
      assert.match(html, /Artefacts fondamentaux/);
      assert.match(html, /Maturité du projet/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});
