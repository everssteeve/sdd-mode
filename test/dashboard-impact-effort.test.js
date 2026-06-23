// @spec SPEC-018-5-impact-effort-en-attente
// @verified-by test/dashboard-impact-effort.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculerImpactEffortEnAttente, blocImpactEffortEnAttente } from '../lib/dashboard/rice-matrix.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function point(id, statut, impact = 5, effort = 2) {
  return { id, titre: `${id} title`, statut, impact, effort, quadrant: 'quick-wins' };
}

function riceMatrix(points) {
  return { points, totaux: {} };
}

const CINQ_INTENTS = [
  point('INTENT-001', 'done',        8, 3),
  point('INTENT-002', 'done',        6, 4),
  point('INTENT-003', 'active',      7, 2),
  point('INTENT-004', 'draft',       5, 2),   // → doit apparaître
  point('INTENT-005', 'deferred',    4, 1),   // → doit apparaître
];

// ─── CA-001 : filtre statuts exclus ──────────────────────────────────────────

describe('calculerImpactEffortEnAttente() — filtre', () => {
  it('CA-001 : exclut done, archived, active, in-progress', () => {
    const data = calculerImpactEffortEnAttente({ riceMatrix: riceMatrix(CINQ_INTENTS) });
    const ids = data.items.map(i => i.id);
    assert.ok(!ids.includes('INTENT-001'), 'done doit être exclu');
    assert.ok(!ids.includes('INTENT-002'), 'done doit être exclu');
    assert.ok(!ids.includes('INTENT-003'), 'active doit être exclu');
  });

  it('CA-001 : conserve draft et deferred', () => {
    const data = calculerImpactEffortEnAttente({ riceMatrix: riceMatrix(CINQ_INTENTS) });
    const ids = data.items.map(i => i.id);
    assert.ok(ids.includes('INTENT-004'), 'draft doit être inclus');
    assert.ok(ids.includes('INTENT-005'), 'deferred doit être inclus');
  });

  it('CA-001 : exclut in-progress', () => {
    const pts = [point('INTENT-A', 'in-progress', 7, 3), point('INTENT-B', 'draft', 5, 2)];
    const data = calculerImpactEffortEnAttente({ riceMatrix: riceMatrix(pts) });
    assert.equal(data.items.length, 1);
    assert.equal(data.items[0].id, 'INTENT-B');
  });
});

// ─── CA-003 : 5 Intents → exactement 2 items ─────────────────────────────────

describe('CA-003 — 5 Intents → 2 en attente', () => {
  it('retourne exactement 2 items pour le jeu de 5 Intents', () => {
    const data = calculerImpactEffortEnAttente({ riceMatrix: riceMatrix(CINQ_INTENTS) });
    assert.equal(data.items.length, 2);
    assert.equal(data.total, 2);
  });
});

// ─── CA-002 : tri scoreRice décroissant ───────────────────────────────────────

describe('CA-002 — tri scoreRice décroissant', () => {
  it('items triés par scoreRice desc', () => {
    const pts = [
      point('LOW',  'draft', 2, 4),  // scoreRice = 0.5
      point('HIGH', 'draft', 8, 2),  // scoreRice = 4.0
      point('MID',  'draft', 5, 2),  // scoreRice = 2.5
    ];
    const data = calculerImpactEffortEnAttente({ riceMatrix: riceMatrix(pts) });
    assert.equal(data.items[0].id, 'HIGH');
    assert.equal(data.items[1].id, 'MID');
    assert.equal(data.items[2].id, 'LOW');
  });
});

// ─── CA-004 : riceMatrix absent ───────────────────────────────────────────────

describe('CA-004 — riceMatrix absent', () => {
  it('retourne { items: [], total: 0, message: "..." } sans erreur', () => {
    const data = calculerImpactEffortEnAttente({});
    assert.equal(data.items.length, 0);
    assert.equal(data.total, 0);
    assert.ok(data.message && data.message.length > 0);
  });

  it('riceMatrix = null → même comportement', () => {
    const data = calculerImpactEffortEnAttente({ riceMatrix: null });
    assert.equal(data.items.length, 0);
  });
});

// ─── scoreRice et champs mappés ───────────────────────────────────────────────

describe('champs scoreImpact / scoreEffort / scoreRice / quadrant', () => {
  it('scoreImpact et scoreEffort mappés depuis impact/effort', () => {
    const pts = [point('INTENT-X', 'draft', 7, 3)];
    const data = calculerImpactEffortEnAttente({ riceMatrix: riceMatrix(pts) });
    assert.equal(data.items[0].scoreImpact, 7);
    assert.equal(data.items[0].scoreEffort, 3);
  });

  it('scoreRice = impact / effort', () => {
    const pts = [point('INTENT-X', 'draft', 6, 3)];
    const data = calculerImpactEffortEnAttente({ riceMatrix: riceMatrix(pts) });
    assert.equal(data.items[0].scoreRice, 2);
  });

  it('quadrant normalisé en singulier (quick-win, big-bet, fill-in, time-sink)', () => {
    const QUAD_MAP = {
      'quick-wins': 'quick-win', 'big-bets': 'big-bet',
      'fill-ins': 'fill-in', 'time-sinks': 'time-sink',
    };
    for (const [plural, singular] of Object.entries(QUAD_MAP)) {
      const pts = [{ id: 'X', titre: 'T', statut: 'draft', impact: 5, effort: 2, quadrant: plural }];
      const data = calculerImpactEffortEnAttente({ riceMatrix: riceMatrix(pts) });
      assert.equal(data.items[0].quadrant, singular, `${plural} → ${singular}`);
    }
  });
});

// ─── CA-005 : message 0 items ─────────────────────────────────────────────────

describe('message si 0 items', () => {
  it('message non null si 0 items', () => {
    const pts = [point('INTENT-A', 'done', 7, 2)];
    const data = calculerImpactEffortEnAttente({ riceMatrix: riceMatrix(pts) });
    assert.equal(data.items.length, 0);
    assert.ok(data.message !== null);
  });
});

// ─── CA-005 : blocImpactEffortEnAttente() HTML ────────────────────────────────

describe('blocImpactEffortEnAttente() — structure HTML', () => {
  const donnees = { riceMatrix: riceMatrix(CINQ_INTENTS) };

  it('CA-005 : produit un <table> avec <caption>', () => {
    const html = blocImpactEffortEnAttente(donnees);
    assert.ok(html.includes('<table>'), 'manque <table>');
    assert.ok(html.includes('<caption>Intents en attente — Impact × Effort</caption>'));
  });

  it('CA-005 : <thead> présent', () => {
    const html = blocImpactEffortEnAttente(donnees);
    assert.ok(html.includes('<thead>'));
  });

  it('CA-005 : <th scope="col"> sur chaque colonne (5)', () => {
    const html = blocImpactEffortEnAttente(donnees);
    const matches = html.match(/<th scope="col">/g);
    assert.ok(matches && matches.length >= 5, `attendu ≥5 th[scope=col], trouvé ${matches?.length ?? 0}`);
  });

  it('CA-006 : 0 items → message textuel, pas de <table> vide', () => {
    const htmlVide = blocImpactEffortEnAttente({ riceMatrix: riceMatrix([point('A', 'done')]) });
    assert.ok(!htmlVide.includes('<table>'), 'ne doit pas afficher <table> si 0 items');
    assert.ok(htmlVide.includes('Aucun Intent'), 'doit afficher un message');
  });
});
