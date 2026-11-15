// Tests de la navigation par responsabilité et de la coquille de page (SPEC-037-1).
//
// @spec SPEC-037-1-dashboard-par-role

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ONGLETS, ONGLETS_ROLE, PAGES_NAV, ongletDe, pageActive, ongletDuLien } from '../lib/dashboard/navigation.js';
import { PAGES, layout, compterAlertesParOnglet } from '../lib/dashboard/render.js';
import { ROLE_AGENTS } from '../lib/agents-registry.js';

const DONNEES = { projet: { nom: 'Mon App', version: '1.2.3', genere: '2026-11-15T10:00:00.000Z', racine: '/nulle/part' } };

describe('dashboard — navigation par responsabilité', () => {
  test('CA-001 — 6 onglets : une vue d\'ensemble puis un onglet par rôle AIAD', () => {
    assert.deepEqual(ONGLETS.map((o) => o.id), ['global', 'pm', 'pe', 'ae', 'qa', 'tl']);
    assert.equal(ONGLETS[0].agent, null);
    assert.deepEqual(ONGLETS_ROLE.map((o) => o.agent), ROLE_AGENTS.map((r) => r.name));
    for (const o of ONGLETS_ROLE) {
      assert.equal(o.question, ROLE_AGENTS.find((r) => r.name === o.agent).question, `question alignée sur le registre : ${o.id}`);
    }
  });

  test('CA-002 — chaque page appartient à un seul onglet ; slugs et fichiers uniques', () => {
    const slugs = PAGES_NAV.map((p) => p.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    assert.equal(new Set(PAGES_NAV.map((p) => p.file)).size, slugs.length);
    assert.equal(PAGES, PAGES_NAV);
    for (const o of ONGLETS) assert.ok(o.pages.length >= 1);
    // Page d'accueil de chaque onglet de rôle = son cockpit.
    assert.deepEqual(ONGLETS_ROLE.map((o) => o.pages[0].file), ['pm.html', 'pe.html', 'ae.html', 'qa.html', 'tl.html']);
    // Aucune des 20 pages historiques n'a disparu.
    for (const s of ['today', 'inbox', 'index', 'pm', 'intents', 'specs', 'traceability', 'graph', 'metrics', 'qa', 'adrs', 'legal', 'governance', 'drifts', 'changelog', 'onboarding', 'kanban', 'sre', 'dpo', 'eco']) {
      assert.ok(slugs.includes(s), `page conservée : ${s}`);
    }
  });

  test('CA-003 — ongletDe / pageActive / ongletDuLien', () => {
    assert.equal(ongletDe('specs').id, 'pe');
    assert.equal(ongletDe('governance.html').id, 'ae');
    assert.equal(ongletDe('spec-012-1-garde-fous').id, 'pe');
    assert.equal(ongletDe('intent-INTENT-036-agents-de-role').id, 'pm');
    assert.equal(ongletDe('404').id, 'global');
    assert.equal(ongletDe(undefined).id, 'global');
    assert.equal(pageActive('spec-012-1-garde-fous'), 'specs');
    assert.equal(pageActive('intent-INTENT-001'), 'intents');
    assert.equal(pageActive('qa'), 'qa');
    assert.equal(ongletDuLien('legal.html#dpia'), 'qa');
    assert.equal(ongletDuLien('metrics.html?x=1'), 'tl');
  });

  test('CA-004 — layout : onglets, sous-navigation de l\'onglet courant, état actif', () => {
    const html = layout({ slug: 'kanban', titre: 'Kanban SPECs', sous: 'x', donnees: DONNEES, body: '<p>corps</p>' });
    assert.match(html, /<body data-onglet="pe">/);
    assert.match(html, /<nav class="tabs" aria-label="Responsabilités">/);
    for (const o of ONGLETS) assert.ok(html.includes(`data-onglet="${o.id}"`), `onglet ${o.id}`);
    assert.match(html, /class="tab active" data-onglet="pe" aria-current="true"/);
    // Sous-navigation : les pages du PE, pas celles des autres rôles.
    const sousNav = html.slice(html.indexOf('<nav class="subnav"'), html.indexOf('</nav>', html.indexOf('<nav class="subnav"')));
    assert.match(sousNav, /href="kanban\.html" class="active" aria-current="page"/);
    assert.ok(sousNav.includes('traceability.html') && sousNav.includes('pe.html'));
    assert.ok(!sousNav.includes('adrs.html') && !sousNav.includes('intents.html'));
    assert.match(sousNav, /Assistant <code>aiad-pe<\/code>/);
    assert.match(html, /<main id="contenu">/);
    assert.match(html, /class="skip-link" href="#contenu"/);
    assert.match(html, /<p>corps<\/p>/);
  });

  test('CA-004 — layout : vue d\'ensemble sans assistant ; page de détail rattachée à sa liste', () => {
    const index = layout({ slug: 'index', titre: 'Vue', sous: null, donnees: DONNEES, body: '' });
    assert.match(index, /<body data-onglet="global">/);
    assert.ok(!index.includes('subnav-agent'));
    const detail = layout({ slug: 'spec-001-1-x', titre: 'SPEC', sous: null, donnees: DONNEES, body: '' });
    assert.match(detail, /<body data-onglet="pe">/);
    assert.match(detail, /href="specs\.html" class="active"/);
  });

  test('CA-005 — layout : contenu échappé, données partielles tolérées', () => {
    const html = layout({ slug: 'index', titre: '<b>t</b>', sous: null, donnees: { projet: { nom: '<script>x</script>', genere: '2026-11-15T10:00:00.000Z' } }, body: '' });
    assert.ok(!html.includes('<script>x</script>'));
    assert.match(html, /&lt;b&gt;t&lt;\/b&gt;/);
    assert.deepEqual(compterAlertesParOnglet({}), {});
  });
});
