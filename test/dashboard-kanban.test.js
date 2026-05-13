// Tests #131 MVP — Vue Kanban des SPECs.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { calculerKanban, pageKanban, computeKanban, kanbanPage, detecterConflitsParallelisme, rolesPourCard } from '../lib/dashboard/kanban.js';

function donnees({ specs = [], forward = [] } = {}) {
  return { specs, matrice: { forward } };
}

test('calculerKanban — projet vierge → 4 colonnes vides', () => {
  const cols = calculerKanban(donnees());
  assert.equal(cols.length, 4);
  assert.deepEqual(cols.map((c) => c.id), ['todo', 'in-progress', 'review', 'done']);
  for (const c of cols) assert.equal(c.cards.length, 0);
});

test('calculerKanban — dispatch statut → colonne', () => {
  const cols = calculerKanban(donnees({
    specs: [
      { id: 'SPEC-001', titre: 'A', statut: 'draft' },
      { id: 'SPEC-002', titre: 'B', statut: 'ready' },
      { id: 'SPEC-003', titre: 'C', statut: 'in-progress' },
      { id: 'SPEC-004', titre: 'D', statut: 'review' },
      { id: 'SPEC-005', titre: 'E', statut: 'validation' },
      { id: 'SPEC-006', titre: 'F', statut: 'done' },
      { id: 'SPEC-007', titre: 'G', statut: 'archived' }, // ignoré
    ],
  }));
  assert.equal(cols[0].cards.length, 2, 'todo : draft+ready');
  assert.equal(cols[1].cards.length, 1, 'in-progress');
  assert.equal(cols[2].cards.length, 2, 'review : review+validation');
  assert.equal(cols[3].cards.length, 1, 'done');
  // archived doit être absent
  const allIds = cols.flatMap((c) => c.cards.map((x) => x.id));
  assert.ok(!allIds.includes('SPEC-007'));
});

test('calculerKanban — cards exposent intent, governance, tests', () => {
  const cols = calculerKanban(donnees({
    specs: [{
      id: 'SPEC-001-x', titre: 'Auth', statut: 'in-progress',
      sqs: 4.5, governance: 'AIAD-RGPD,AIAD-AI-ACT', file: '.aiad/specs/SPEC-001-x.md',
    }],
    forward: [{
      intent: { id: 'INTENT-001' },
      specs: [{
        spec: { id: 'SPEC-001-x', titre: 'Auth' },
        tests: [{ path: 'a.test.ts' }, { path: 'b.test.ts' }],
        code: [{ path: 'src/a.ts' }],
      }],
    }],
  }));
  const card = cols[1].cards[0];
  assert.equal(card.id, 'SPEC-001-x');
  assert.equal(card.intentId, 'INTENT-001');
  assert.equal(card.sqs, 4.5);
  assert.deepEqual(card.governance, ['AIAD-RGPD', 'AIAD-AI-ACT']);
  assert.equal(card.testsCount, 2);
  assert.equal(card.codeCount, 1);
  assert.equal(card.file, '.aiad/specs/SPEC-001-x.md');
});

test('calculerKanban — tri stable par id dans chaque colonne', () => {
  const cols = calculerKanban(donnees({
    specs: [
      { id: 'SPEC-003', titre: 'C', statut: 'done' },
      { id: 'SPEC-001', titre: 'A', statut: 'done' },
      { id: 'SPEC-002', titre: 'B', statut: 'done' },
    ],
  }));
  assert.deepEqual(cols[3].cards.map((c) => c.id), ['SPEC-001', 'SPEC-002', 'SPEC-003']);
});

test('pageKanban — projet vierge → empty state', () => {
  const html = pageKanban({});
  assert.match(html, /Aucune SPEC à afficher/);
});

test('pageKanban — 4 colonnes rendues avec compteurs', () => {
  const html = pageKanban({
    kanban: [
      { id: 'todo', titre: 'To-Do', cards: [{ id: 'SPEC-001', titre: 'A', sqs: 4, governance: [], testsCount: 1, codeCount: 1 }] },
      { id: 'in-progress', titre: 'In-Progress', cards: [] },
      { id: 'review', titre: 'Review', cards: [] },
      { id: 'done', titre: 'Done', cards: [{ id: 'SPEC-002', titre: 'B', sqs: 5, governance: ['AIAD-RGPD'], testsCount: 3, codeCount: 2 }] },
    ],
  });
  assert.match(html, /To-Do/);
  assert.match(html, /In-Progress/);
  assert.match(html, /Review/);
  assert.match(html, /Done/);
  assert.match(html, /SPEC-001/);
  assert.match(html, /SPEC-002/);
  assert.match(html, /AIAD-RGPD/);
  assert.match(html, /SQS 5/);
  assert.match(html, /3 test\(s\)/);
});

test('pageKanban — card sans tests → badge "0 test" warn', () => {
  const html = pageKanban({
    kanban: [
      { id: 'todo', titre: 'To-Do', cards: [{ id: 'SPEC-X', titre: 'X', governance: [], testsCount: 0, codeCount: 1 }] },
      { id: 'in-progress', titre: 'In-Progress', cards: [] },
      { id: 'review', titre: 'Review', cards: [] },
      { id: 'done', titre: 'Done', cards: [] },
    ],
  });
  assert.match(html, /0 test/);
  assert.match(html, /badge-warn/);
});

test('Alias EN canoniques exposés', () => {
  assert.equal(computeKanban, calculerKanban);
  assert.equal(kanbanPage, pageKanban);
});

// ─── #187 Détection parallélisme ────────────────────────────────────────────

test('detecterConflitsParallelisme — < 2 SPECs in-progress → []', () => {
  assert.deepEqual(detecterConflitsParallelisme(donnees()), []);
  assert.deepEqual(detecterConflitsParallelisme(donnees({
    specs: [{ id: 'SPEC-1', statut: 'in-progress' }],
  })), []);
});

test('detecterConflitsParallelisme — 2 SPECs sans intersection → []', () => {
  const r = detecterConflitsParallelisme(donnees({
    specs: [
      { id: 'SPEC-1', statut: 'in-progress', parentIntent: 'INTENT-001' },
      { id: 'SPEC-2', statut: 'in-progress', parentIntent: 'INTENT-002' },
    ],
    forward: [
      { intent: { id: 'INTENT-001' }, specs: [{ spec: { id: 'SPEC-1' }, code: [{ path: 'a.ts' }] }] },
      { intent: { id: 'INTENT-002' }, specs: [{ spec: { id: 'SPEC-2' }, code: [{ path: 'b.ts' }] }] },
    ],
  }));
  assert.deepEqual(r, []);
});

test('detecterConflitsParallelisme — files intersection → conflit', () => {
  const r = detecterConflitsParallelisme(donnees({
    specs: [
      { id: 'SPEC-1', statut: 'in-progress', parentIntent: 'INTENT-001' },
      { id: 'SPEC-2', statut: 'in-progress', parentIntent: 'INTENT-002' },
    ],
    forward: [
      { intent: { id: 'INTENT-001' }, specs: [{ spec: { id: 'SPEC-1' }, code: [{ path: 'shared.ts' }, { path: 'a.ts' }] }] },
      { intent: { id: 'INTENT-002' }, specs: [{ spec: { id: 'SPEC-2' }, code: [{ path: 'shared.ts' }, { path: 'b.ts' }] }] },
    ],
  }));
  assert.equal(r.length, 1);
  assert.equal(r[0].raison, 'files-intersection');
  assert.deepEqual(r[0].filesShared, ['shared.ts']);
});

test('detecterConflitsParallelisme — même parentIntent → conflit', () => {
  const r = detecterConflitsParallelisme(donnees({
    specs: [
      { id: 'SPEC-1', statut: 'in-progress', parentIntent: 'INTENT-001' },
      { id: 'SPEC-2', statut: 'in-progress', parentIntent: 'INTENT-001' },
    ],
  }));
  assert.equal(r.length, 1);
  assert.equal(r[0].raison, 'same-intent');
  assert.equal(r[0].intent, 'INTENT-001');
});

test('detecterConflitsParallelisme — parallel_with explicite → suppression conflit', () => {
  const r = detecterConflitsParallelisme(donnees({
    specs: [
      { id: 'SPEC-1', statut: 'in-progress', parentIntent: 'INTENT-001', parallelWith: ['SPEC-2'] },
      { id: 'SPEC-2', statut: 'in-progress', parentIntent: 'INTENT-001' },
    ],
  }));
  assert.deepEqual(r, [], 'parallel_with explicite → pas de conflit');
});

test('detecterConflitsParallelisme — only in-progress count, ignore done/ready', () => {
  const r = detecterConflitsParallelisme(donnees({
    specs: [
      { id: 'SPEC-1', statut: 'in-progress', parentIntent: 'INTENT-001' },
      { id: 'SPEC-2', statut: 'done', parentIntent: 'INTENT-001' }, // ignoré
      { id: 'SPEC-3', statut: 'ready', parentIntent: 'INTENT-001' }, // ignoré
    ],
  }));
  assert.deepEqual(r, []);
});

test('pageKanban — bannière conflits affichée si donnees.kanbanConflits non vide', () => {
  const html = pageKanban({
    kanban: [
      { id: 'todo', titre: 'To-Do', cards: [] },
      { id: 'in-progress', titre: 'In-Progress', cards: [
        { id: 'SPEC-1', titre: 'A', governance: [], testsCount: 1, codeCount: 1 },
        { id: 'SPEC-2', titre: 'B', governance: [], testsCount: 1, codeCount: 1 },
      ] },
      { id: 'review', titre: 'Review', cards: [] },
      { id: 'done', titre: 'Done', cards: [] },
    ],
    kanbanConflits: [{ a: 'SPEC-1', b: 'SPEC-2', raison: 'files-intersection', filesShared: ['shared.ts'], intent: null }],
  });
  assert.match(html, /1 conflit\(s\) de parallélisme/);
  assert.match(html, /SPEC-1.*SPEC-2/s);
  assert.match(html, /shared\.ts/);
  assert.match(html, /parallel_with/);
});

// ─── #188 Lens role-aware ───────────────────────────────────────────────────

test('rolesPourCard — done → PM ; ready → PE', () => {
  assert.deepEqual(
    rolesPourCard({ statut: 'done', testsCount: 2, codeCount: 2, intentId: 'I1', governance: [] }).sort(),
    ['pm'],
  );
  assert.deepEqual(
    rolesPourCard({ statut: 'ready', testsCount: 1, codeCount: 1, intentId: 'I1', governance: [] }).sort(),
    ['pe'],
  );
});

test('rolesPourCard — gouvernance Tier 1 → AE', () => {
  const r = rolesPourCard({ statut: 'ready', testsCount: 1, codeCount: 1, intentId: 'I1', governance: ['AIAD-RGPD'] });
  assert.ok(r.includes('ae'));
  assert.ok(r.includes('pe'));
});

test('rolesPourCard — review → QA + PM', () => {
  const r = rolesPourCard({ statut: 'review', testsCount: 0, codeCount: 1, intentId: 'I1', governance: [] });
  assert.ok(r.includes('qa'));
  assert.ok(r.includes('pm'));
});

test('rolesPourCard — orphelin (pas d\'intent) → TL', () => {
  const r = rolesPourCard({ statut: 'in-progress', testsCount: 1, codeCount: 1, intentId: null, governance: [] });
  assert.ok(r.includes('tl'));
});

test('rolesPourCard — code sans tests → TL + QA', () => {
  const r = rolesPourCard({ statut: 'done', testsCount: 0, codeCount: 3, intentId: 'I1', governance: [] });
  assert.ok(r.includes('tl'));
  assert.ok(r.includes('qa'));
});

test('rolesPourCard — en conflit (ctx.conflits) → TL', () => {
  const r = rolesPourCard(
    { id: 'SPEC-X', statut: 'in-progress', testsCount: 2, codeCount: 2, intentId: 'I1', governance: [] },
    { conflits: [{ a: 'SPEC-X', b: 'SPEC-Y', raison: 'same-intent', intent: 'I1' }] },
  );
  assert.ok(r.includes('tl'));
});

test('pageKanban — sélecteur lens présent + data-roles sur cards', () => {
  const html = pageKanban({
    kanban: [
      { id: 'todo', titre: 'To-Do', cards: [{ id: 'SPEC-1', titre: 'A', statut: 'ready', governance: [], testsCount: 1, codeCount: 1, intentId: 'I1' }] },
      { id: 'in-progress', titre: 'In-Progress', cards: [] },
      { id: 'review', titre: 'Review', cards: [] },
      { id: 'done', titre: 'Done', cards: [{ id: 'SPEC-2', titre: 'B', statut: 'done', governance: ['AIAD-RGPD'], testsCount: 3, codeCount: 2, intentId: 'I1' }] },
    ],
    kanbanConflits: [],
  });
  assert.match(html, /class="kanban-lens"/);
  assert.match(html, /data-lens="pm"/);
  assert.match(html, /data-lens="pe"/);
  assert.match(html, /data-lens="ae"/);
  assert.match(html, /data-lens="qa"/);
  assert.match(html, /data-lens="tl"/);
  assert.match(html, /data-roles="pe"/); // SPEC-1 ready → pe
  assert.match(html, /data-roles="[^"]*pm[^"]*"/); // SPEC-2 done → pm
  assert.match(html, /data-roles="[^"]*ae[^"]*"/); // SPEC-2 AIAD-RGPD → ae
});

test('pageKanban — pas de bannière si pas de conflit', () => {
  const html = pageKanban({
    kanban: [
      { id: 'todo', titre: 'To-Do', cards: [{ id: 'SPEC-1', titre: 'A', governance: [], testsCount: 1, codeCount: 1 }] },
      { id: 'in-progress', titre: 'In-Progress', cards: [] },
      { id: 'review', titre: 'Review', cards: [] },
      { id: 'done', titre: 'Done', cards: [] },
    ],
    kanbanConflits: [],
  });
  assert.ok(!html.includes('conflit(s) de parallélisme'), 'pas de bannière quand 0 conflit');
});
