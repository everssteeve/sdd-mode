// Tests #131 MVP — Vue Kanban des SPECs.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { calculerKanban, pageKanban, computeKanban, kanbanPage, detecterConflitsParallelisme, rolesPourCard, calculerFocusAlertes, computeFocusAlerts, calculerFocusAlertesParLens, computeFocusAlertsByLens } from '../lib/dashboard/kanban.js';

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

// (#331) card.intentFile exposé pour hyperlien card → fichier Intent
test('#331 calculerKanban — card.intentFile exposé depuis matrice forward', () => {
  const cols = calculerKanban(donnees({
    specs: [{ id: 'SPEC-007-1', titre: 'X', statut: 'ready', file: '.aiad/specs/SPEC-007-1.md' }],
    forward: [{
      intent: { id: 'INTENT-007', file: '.aiad/intents/INTENT-007-auth.md' },
      specs: [{ spec: { id: 'SPEC-007-1' }, tests: [], code: [] }],
    }],
  }));
  const card = cols[0].cards[0];
  assert.equal(card.intentId, 'INTENT-007');
  assert.equal(card.intentFile, '.aiad/intents/INTENT-007-auth.md');
});

test('#331 pageKanban — `⤴ INTENT-N` rendu comme <a> vers le fichier Intent', () => {
  const cols = calculerKanban(donnees({
    specs: [{ id: 'SPEC-007-1', titre: 'X', statut: 'ready', file: '.aiad/specs/SPEC-007-1.md' }],
    forward: [{
      intent: { id: 'INTENT-007', file: '.aiad/intents/INTENT-007-auth.md' },
      specs: [{ spec: { id: 'SPEC-007-1' }, tests: [], code: [] }],
    }],
  }));
  const html = pageKanban({ kanban: cols });
  assert.match(html, /⤴ <a[^>]+href="\.\.\/\.aiad\/intents\/INTENT-007-auth\.md"[^>]*>INTENT-007<\/a>/);
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

// (#354) Conflit SPEC IDs + intent parent hyperliés via lookup donnees.specs/intents
test('#354 pageKanban — conflit SPEC IDs `SPECa ↔ SPECb` hyperliés via donnees.specs lookup', () => {
  const html = pageKanban({
    specs: [
      { id: 'SPEC-1', file: '.aiad/specs/SPEC-1.md' },
      { id: 'SPEC-2', file: '.aiad/specs/SPEC-2.md' },
    ],
    intents: [{ id: 'INTENT-001', file: '.aiad/intents/INTENT-001.md' }],
    kanban: [
      { id: 'todo', titre: 'To-Do', cards: [] },
      { id: 'in-progress', titre: 'In-Progress', cards: [
        { id: 'SPEC-1', titre: 'A', governance: [], testsCount: 1, codeCount: 1 },
        { id: 'SPEC-2', titre: 'B', governance: [], testsCount: 1, codeCount: 1 },
      ] },
      { id: 'review', titre: 'Review', cards: [] },
      { id: 'done', titre: 'Done', cards: [] },
    ],
    kanbanConflits: [{ a: 'SPEC-1', b: 'SPEC-2', raison: 'same-intent', intent: 'INTENT-001', filesShared: [] }],
  });
  // SPEC-1 et SPEC-2 hyperliés
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/specs\/SPEC-1\.md"[^>]*>SPEC-1<\/a>/);
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/specs\/SPEC-2\.md"[^>]*>SPEC-2<\/a>/);
  // Intent parent INTENT-001 hyperlié dans "même intent parent"
  assert.match(html, /même intent parent <a[^>]+href="\.\.\/\.aiad\/intents\/INTENT-001\.md"[^>]*>INTENT-001<\/a>/);
});

// (#332) Conflits filesShared hyperliés
test('#332 pageKanban — filesShared dans conflit rendu hyperlié vers la source', () => {
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
    kanbanConflits: [{ a: 'SPEC-1', b: 'SPEC-2', raison: 'files-intersection', filesShared: ['src/shared.ts'], intent: null }],
  });
  assert.match(html, /<a[^>]+href="\.\.\/src\/shared\.ts"[^>]*>src\/shared\.ts<\/a>/);
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

// (#279) Kanban search box
test('pageKanban — search box présente avec input type="search"', () => {
  const html = pageKanban({
    kanban: [{ id: 'todo', titre: 'To-Do', cards: [{ id: 'SPEC-1', titre: 'A', statut: 'ready', governance: [], testsCount: 1, codeCount: 1, intentId: 'I1' }] }],
    kanbanConflits: [],
  });
  assert.match(html, /<input type="search" id="kanban-search"/);
  assert.match(html, /placeholder="Rechercher SPEC \(ID ou titre\)/);
  assert.match(html, /aria-label="Rechercher dans le kanban"/);
});

test('pageKanban — script search filtre par data-id + textContent', () => {
  const html = pageKanban({
    kanban: [{ id: 'todo', titre: 'To-Do', cards: [{ id: 'SPEC-1', titre: 'A', statut: 'ready', governance: [], testsCount: 1, codeCount: 1, intentId: 'I1' }] }],
    kanbanConflits: [],
  });
  // Le JS handler doit lire l'input et matcher data-id + textContent
  assert.match(html, /getElementById\('kanban-search'\)/);
  assert.match(html, /getAttribute\('data-id'\)/);
  // Cmd+F / Ctrl+F → focus search
  assert.match(html, /e\.metaKey\|\|e\.ctrlKey/);
});

// ─── #189 Focus du jour ─────────────────────────────────────────────────────

test('calculerFocusAlertes — backlog vide → []', () => {
  assert.deepEqual(calculerFocusAlertes({ kanban: [], kanbanConflits: [] }), []);
});

test('calculerFocusAlertes — conflit présent → P1 en premier', () => {
  const r = calculerFocusAlertes({
    kanban: [
      { id: 'todo', cards: [] },
      { id: 'in-progress', cards: [
        { id: 'SPEC-A', statut: 'in-progress', testsCount: 1, codeCount: 1, governance: [] },
        { id: 'SPEC-B', statut: 'in-progress', testsCount: 1, codeCount: 1, governance: [] },
      ] },
      { id: 'review', cards: [] },
      { id: 'done', cards: [] },
    ],
    kanbanConflits: [{ a: 'SPEC-A', b: 'SPEC-B', raison: 'same-intent', intent: 'I1' }],
  });
  assert.ok(r.length >= 1);
  assert.equal(r[0].priorite, 'P1');
  assert.match(r[0].titre, /conflit/i);
});

test('calculerFocusAlertes — review en attente → P2', () => {
  const r = calculerFocusAlertes({
    kanban: [
      { id: 'todo', cards: [] },
      { id: 'in-progress', cards: [] },
      { id: 'review', cards: [{ id: 'SPEC-R1', statut: 'review', testsCount: 1, codeCount: 1, governance: [] }] },
      { id: 'done', cards: [] },
    ],
  });
  const p2 = r.find((a) => a.priorite === 'P2');
  assert.ok(p2, 'P2 review présent');
  assert.match(p2.titre, /à valider/);
});

test('calculerFocusAlertes — in-progress sans test → P3', () => {
  const r = calculerFocusAlertes({
    kanban: [
      { id: 'todo', cards: [] },
      { id: 'in-progress', cards: [{ id: 'SPEC-X', statut: 'in-progress', testsCount: 0, codeCount: 3, governance: [] }] },
      { id: 'review', cards: [] },
      { id: 'done', cards: [] },
    ],
  });
  const p3 = r.find((a) => a.priorite === 'P3');
  assert.ok(p3, 'P3 in-progress sans test présent');
  assert.match(p3.titre, /sans test/);
});

test('calculerFocusAlertes — Tier 1 sans tests → P4', () => {
  const r = calculerFocusAlertes({
    kanban: [
      { id: 'todo', cards: [] },
      { id: 'in-progress', cards: [{ id: 'SPEC-Y', statut: 'in-progress', testsCount: 0, codeCount: 1, governance: ['AIAD-RGPD'] }] },
      { id: 'review', cards: [] },
      { id: 'done', cards: [] },
    ],
  });
  const p4 = r.find((a) => a.priorite === 'P4');
  assert.ok(p4, 'P4 Tier 1 sans tests présent');
});

test('calculerFocusAlertes — ready dans todo → P5', () => {
  const r = calculerFocusAlertes({
    kanban: [
      { id: 'todo', cards: [{ id: 'SPEC-Z', statut: 'ready', testsCount: 0, codeCount: 0, governance: [] }] },
      { id: 'in-progress', cards: [] },
      { id: 'review', cards: [] },
      { id: 'done', cards: [] },
    ],
  });
  const p5 = r.find((a) => a.priorite === 'P5');
  assert.ok(p5, 'P5 ready présent');
});

test('calculerFocusAlertes — limite stricte à 3 alertes', () => {
  const r = calculerFocusAlertes({
    kanban: [
      { id: 'todo', cards: [{ id: 'SPEC-1', statut: 'ready', testsCount: 0, codeCount: 0, governance: [] }] },
      { id: 'in-progress', cards: [
        { id: 'SPEC-2', statut: 'in-progress', testsCount: 0, codeCount: 1, governance: ['AIAD-RGPD'] },
      ] },
      { id: 'review', cards: [{ id: 'SPEC-3', statut: 'review', testsCount: 1, codeCount: 1, governance: [] }] },
      { id: 'done', cards: [] },
    ],
    kanbanConflits: [{ a: 'SPEC-2', b: 'SPEC-1', raison: 'same-intent', intent: 'I1' }],
  });
  assert.equal(r.length, 3, 'maximum 3 alertes');
});

test('calculerFocusAlertes — lens=pm priorise P2', () => {
  const r = calculerFocusAlertes({
    kanban: [
      { id: 'todo', cards: [{ id: 'SPEC-1', statut: 'ready', testsCount: 0, codeCount: 0, governance: [] }] },
      { id: 'in-progress', cards: [] },
      { id: 'review', cards: [{ id: 'SPEC-2', statut: 'review', testsCount: 1, codeCount: 1, governance: [] }] },
      { id: 'done', cards: [] },
    ],
  }, 'pm');
  // PM doit avoir P2 en tête (review)
  assert.equal(r[0].priorite, 'P2');
});

test('pageKanban — focus banner injectée (hidden par défaut)', () => {
  const html = pageKanban({
    kanban: [
      { id: 'todo', titre: 'To-Do', cards: [{ id: 'SPEC-1', titre: 'A', statut: 'ready', governance: [], testsCount: 0, codeCount: 0 }] },
      { id: 'in-progress', titre: 'In-Progress', cards: [] },
      { id: 'review', titre: 'Review', cards: [] },
      { id: 'done', titre: 'Done', cards: [] },
    ],
    kanbanConflits: [],
  });
  assert.match(html, /focus-banner/);
  assert.match(html, /hidden/);
  assert.match(html, /Focus du jour/);
});

test('pageKanban — JS gère ?focus=today et masque draft/done', () => {
  const html = pageKanban({
    kanban: [
      { id: 'todo', titre: 'To-Do', cards: [{ id: 'SPEC-1', titre: 'A', statut: 'draft', governance: [], testsCount: 0, codeCount: 0 }] },
      { id: 'in-progress', titre: 'In-Progress', cards: [] },
      { id: 'review', titre: 'Review', cards: [] },
      { id: 'done', titre: 'Done', cards: [] },
    ],
    kanbanConflits: [],
  });
  assert.match(html, /focus=today/);
  assert.match(html, /data-statut="draft"/);
  assert.match(html, /applyFocus/);
});

test('Alias EN computeFocusAlerts === calculerFocusAlertes', () => {
  assert.equal(computeFocusAlerts, calculerFocusAlertes);
});

// ─── #190 Alertes lens-aware côté serveur ───────────────────────────────────

test('calculerFocusAlertesParLens — produit un objet pour chaque lens', () => {
  const r = calculerFocusAlertesParLens({
    kanban: [
      { id: 'todo', cards: [{ id: 'SPEC-1', statut: 'ready', testsCount: 0, codeCount: 0, governance: [] }] },
      { id: 'in-progress', cards: [] },
      { id: 'review', cards: [{ id: 'SPEC-2', statut: 'review', testsCount: 1, codeCount: 1, governance: [] }] },
      { id: 'done', cards: [] },
    ],
  });
  assert.deepEqual(Object.keys(r).sort(), ['ae', 'all', 'pe', 'pm', 'qa', 'tl']);
  for (const lens of ['all', 'pm', 'pe', 'ae', 'qa', 'tl']) {
    assert.ok(Array.isArray(r[lens]), `lens=${lens} → array`);
  }
});

test('calculerFocusAlertesParLens — PM prioritise P2 review', () => {
  const r = calculerFocusAlertesParLens({
    kanban: [
      { id: 'todo', cards: [{ id: 'SPEC-1', statut: 'ready', testsCount: 0, codeCount: 0, governance: [] }] },
      { id: 'in-progress', cards: [] },
      { id: 'review', cards: [{ id: 'SPEC-2', statut: 'review', testsCount: 1, codeCount: 1, governance: [] }] },
      { id: 'done', cards: [] },
    ],
  });
  assert.equal(r.pm[0].priorite, 'P2', 'PM voit P2 en tête');
  assert.equal(r.pe[0].priorite, 'P5', 'PE voit P5 en tête');
});

test('Alias EN computeFocusAlertsByLens', () => {
  assert.equal(computeFocusAlertsByLens, calculerFocusAlertesParLens);
});

test('pageKanban — 6 bannières lens-aware avec data-lens', () => {
  const html = pageKanban({
    kanban: [
      { id: 'todo', titre: 'To-Do', cards: [{ id: 'SPEC-1', titre: 'A', statut: 'ready', governance: [], testsCount: 0, codeCount: 0 }] },
      { id: 'in-progress', titre: 'In-Progress', cards: [] },
      { id: 'review', titre: 'Review', cards: [] },
      { id: 'done', titre: 'Done', cards: [] },
    ],
    kanbanConflits: [],
  });
  for (const lens of ['all', 'pm', 'pe', 'ae', 'qa', 'tl']) {
    assert.match(html, new RegExp(`focus-banner[^>]*data-lens="${lens}"`), `bannière data-lens=${lens}`);
  }
});

test('pageKanban — consomme donnees.focusAlertes si pré-calculé', () => {
  // Si donnees.focusAlertes est fourni (ex : depuis data.json), il est consommé.
  const html = pageKanban({
    kanban: [
      { id: 'todo', titre: 'To-Do', cards: [{ id: 'SPEC-Q', titre: 'Q', statut: 'ready', governance: [], testsCount: 0, codeCount: 0 }] },
      { id: 'in-progress', titre: 'In-Progress', cards: [] },
      { id: 'review', titre: 'Review', cards: [] },
      { id: 'done', titre: 'Done', cards: [] },
    ],
    kanbanConflits: [],
    focusAlertes: {
      all: [{ priorite: 'P9', titre: 'sentinelle-test', detail: 'd', action: 'a', cardIds: [], roles: ['pm'] }],
      pm: [{ priorite: 'P9', titre: 'sentinelle-test', detail: 'd', action: 'a', cardIds: [], roles: ['pm'] }],
      pe: [], ae: [], qa: [], tl: [],
    },
  });
  assert.match(html, /sentinelle-test/, 'donnees.focusAlertes consommé');
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
