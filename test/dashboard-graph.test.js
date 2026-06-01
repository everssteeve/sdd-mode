// Tests `lib/dashboard/graph.js` — Knowledge Graph D3 force-directed.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialiserGraphe, statsGraphe, pageGraph } from '../lib/dashboard/graph.js';
import { dashboard } from '../lib/dashboard.js';
import { init } from '../lib/init.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-graph-')); }

function silentLog(fn) {
  return async (...args) => {
    const orig = console.log;
    console.log = () => {};
    try { return await fn(...args); }
    finally { console.log = orig; }
  };
}

// ─── serialiserGraphe ───────────────────────────────────────────────────────

test('serialiserGraphe — données vides → graphe vide', () => {
  const r = serialiserGraphe({});
  assert.deepEqual(r.nodes, []);
  assert.deepEqual(r.links, []);
});

test('serialiserGraphe — Intents et SPECs créent des nœuds typés', () => {
  const r = serialiserGraphe({
    intents: [
      { id: 'INTENT-001', title: 'Auth', body: 'Pourquoi détaillé sur 60 caractères pour passer le seuil.', status: 'active' },
    ],
    specs: [
      { id: 'SPEC-001-1-auth', title: 'OIDC', parent_intent: 'INTENT-001', status: 'ready' },
    ],
  });
  assert.equal(r.nodes.length, 2);
  const intent = r.nodes.find((n) => n.id === 'INTENT-001');
  const spec = r.nodes.find((n) => n.id === 'SPEC-001-1-auth');
  assert.equal(intent.type, 'intent');
  assert.equal(intent.humanAuthorship, true); // body ≥ 50 chars
  assert.equal(spec.type, 'spec');
  // Lien parent
  assert.equal(r.links.length, 1);
  assert.equal(r.links[0].source, 'SPEC-001-1-auth');
  assert.equal(r.links[0].target, 'INTENT-001');
  assert.equal(r.links[0].type, 'parent');
});

test('serialiserGraphe — gouvernance crée des nœuds + arêtes', () => {
  const r = serialiserGraphe({
    specs: [
      { id: 'SPEC-001-1-x', governance: ['AIAD-RGPD', 'AIAD-CRA'] },
    ],
  });
  // 1 spec + 2 agents
  assert.equal(r.nodes.length, 3);
  const types = r.nodes.map((n) => n.type).sort();
  assert.deepEqual(types, ['governance', 'governance', 'spec']);
  // 2 arêtes governance
  const govLinks = r.links.filter((l) => l.type === 'governance');
  assert.equal(govLinks.length, 2);
});

test('serialiserGraphe — fichiers code annotés créent des nœuds + arêtes @spec', () => {
  const r = serialiserGraphe({
    specs: [{ id: 'SPEC-001-1-x' }],
    codeFiles: [
      {
        path: 'src/x.ts',
        isTest: false,
        annotated: true,
        annotations: {
          specs: [{ id: 'SPEC-001-1-x' }],
          intents: [],
          verifiedBy: [],
          governance: [],
        },
      },
    ],
  });
  const code = r.nodes.find((n) => n.id === 'code:src/x.ts');
  assert.ok(code);
  assert.equal(code.type, 'code');
  assert.equal(code.annotated, true);
  // Arête @spec
  const specLink = r.links.find((l) => l.type === 'spec');
  assert.ok(specLink);
  assert.equal(specLink.source, 'code:src/x.ts');
  assert.equal(specLink.target, 'SPEC-001-1-x');
});

test('serialiserGraphe — fichiers test annotés ont type="test"', () => {
  const r = serialiserGraphe({
    codeFiles: [
      { path: 'tests/x.test.ts', isTest: true, annotated: true, annotations: { specs: [], intents: [], verifiedBy: [], governance: [] } },
    ],
  });
  assert.equal(r.nodes[0].type, 'test');
});

test('serialiserGraphe — SPECs orphelines ajoutées avec flag orphan', () => {
  const r = serialiserGraphe({
    specs: [
      { id: 'SPEC-001-1-x', parent_intent: 'INTENT-INEXISTANT' },
    ],
  });
  const orphan = r.nodes.find((n) => n.id === 'INTENT-INEXISTANT');
  assert.ok(orphan);
  assert.equal(orphan.orphan, true);
});

test('serialiserGraphe — déduplication des nœuds', () => {
  const r = serialiserGraphe({
    specs: [
      { id: 'SPEC-001-1-x', governance: ['AIAD-RGPD'] },
      { id: 'SPEC-002-1-y', governance: ['AIAD-RGPD'] },
    ],
  });
  const govNodes = r.nodes.filter((n) => n.type === 'governance');
  assert.equal(govNodes.length, 1, `attendu 1 nœud RGPD dédupliqué, vu ${govNodes.length}`);
});

// ─── statsGraphe ────────────────────────────────────────────────────────────

test('statsGraphe — compte par type + orphelins', () => {
  const graphe = {
    nodes: [
      { id: 'i1', type: 'intent' },
      { id: 's1', type: 'spec' },
      { id: 's2', type: 'spec', orphan: true },
      { id: 'c1', type: 'code' },
      { id: 'g1', type: 'governance' },
    ],
    links: [{ source: 's1', target: 'i1' }],
  };
  const stats = statsGraphe(graphe);
  assert.equal(stats.nodes, 5);
  assert.equal(stats.links, 1);
  assert.equal(stats.orphans, 1);
  assert.equal(stats.counts.intent, 1);
  assert.equal(stats.counts.spec, 2);
  assert.equal(stats.counts.code, 1);
  assert.equal(stats.counts.governance, 1);
});

// ─── pageGraph ──────────────────────────────────────────────────────────────

test('pageGraph — produit un HTML body avec D3 + canvas + filtres', () => {
  const html = pageGraph({
    intents: [{ id: 'INTENT-001', title: 'Auth' }],
    specs: [{ id: 'SPEC-001-1-x', parent_intent: 'INTENT-001', governance: ['AIAD-RGPD'] }],
    codeFiles: [],
  });
  assert.match(html, /class="graph-section"/);
  assert.match(html, /id="graph-canvas"/);
  assert.match(html, /cdn\.jsdelivr\.net\/npm\/d3@7/);
  // (#248) SRI integrity retirée (hash devenait obsolète à chaque republish)
  assert.doesNotMatch(html, /integrity="sha384-/);
  // Filtres pour les 5 types
  for (const type of ['intent', 'spec', 'code', 'test', 'governance']) {
    assert.match(html, new RegExp(`data-type="${type}"`));
  }
  // Recherche présente
  assert.match(html, /id="graph-search"/);
  // Légende avec couleurs
  assert.match(html, /Légende/);
});

test('pageGraph — embarque les données JSON valides', () => {
  const html = pageGraph({
    intents: [{ id: 'INTENT-001', title: 'A', body: 'X'.repeat(60) }],
    specs: [],
    codeFiles: [],
  });
  // Le JSON est inline dans `const data = …;`
  const match = html.match(/const data = (\{[\s\S]*?\});/);
  assert.ok(match, 'data JSON absent');
  const data = JSON.parse(match[1]);
  assert.equal(data.nodes.length, 1);
  assert.equal(data.nodes[0].id, 'INTENT-001');
});

test('pageGraph — fallback gracieux si D3 indisponible', () => {
  const html = pageGraph({});
  assert.match(html, /D3\.js indisponible/);
});

// ─── Intégration avec le dashboard complet ──────────────────────────────────

test('dashboard — page graph.html générée avec slug graph et nav inclus', silentLog(async () => {
  const d = tmp();
  try {
    await init(d, {});
    const r = await dashboard(d, { quiet: true });
    assert.ok(r.pages.some((p) => p.endsWith('graph.html')), 'graph.html absent du résultat');
    const html = readFileSync(join(d, 'dashboard', 'graph.html'), 'utf-8');
    assert.match(html, /Graphe de connaissances/);
    // Navigation contient le lien graphe
    assert.match(html, /href="graph\.html"/);
    // CDN D3
    assert.match(html, /d3@7/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('PAGES inclut graph (entre traceability et metrics)', async () => {
  const { PAGES } = await import('../lib/dashboard/render.js');
  const slugs = PAGES.map((p) => p.slug);
  const idxTrace = slugs.indexOf('traceability');
  const idxGraph = slugs.indexOf('graph');
  const idxMetrics = slugs.indexOf('metrics');
  assert.ok(idxGraph > idxTrace, 'graph avant traceability');
  assert.ok(idxGraph < idxMetrics, 'graph après metrics');
});
