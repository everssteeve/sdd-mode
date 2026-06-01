// Tests #423 / #424 / #425 — Boucle 2 PM cockpit :
//   - couverture PRD (personas + user stories)
//   - velocity Intents/mois + SPECs/semaine
//   - recherche full-text dans Intent body (data-search-blob)

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  lirePersonasPrd, lireUserStoriesPrd, calculerCouverturePrd,
  intentSertPersona, intentSertUs, blocCouverturePrd,
  computePrdCoverage, prdCoverageSection,
} from '../lib/dashboard/prd-coverage.js';

import {
  bucketsMois, bucketsSemaines, calculerVelocity, blocVelocity,
  computeVelocity, velocitySection,
} from '../lib/dashboard/velocity.js';

import { searchBlobIntent } from '../lib/dashboard/pm.js';

function tmpProjet() {
  const dir = join(tmpdir(), 'aiad-pm-v2-' + Math.random().toString(36).slice(2));
  mkdirSync(join(dir, '.aiad'), { recursive: true });
  return dir;
}

const PRD_DEMO = `# PRD : test

## 3. Personas et Use Cases

| Persona | Besoin | Résultat |
|---------|--------|----------|
| Marketing EU | tracker links | URL courte |
| RSSI | audit conformité | dashboard |
| Acheteur SMB | plan annuel | facture |

## 4. Outcome Criteria

| Critère | Baseline | Cible | Méthode |
|---------|----------|-------|---------|
| Latence | 100 | 50 | sondes |

## 6. User Stories

\`\`\`
US-001 | MUST   | Marketing EU peut créer URL → Outcome : Latence < 50ms
US-002 | SHOULD | Acheteur SMB peut payer → Outcome : Conversion > 70 %
US-003 | COULD  | RSSI peut auditer → Outcome : Logs export
\`\`\`

## 7. Suite
`;

// ─── #423 — PRD coverage parsing ─────────────────────────────────────────────

test('lirePersonasPrd — extrait les 3 personas de la table §3', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), PRD_DEMO);
    const r = lirePersonasPrd(dir);
    assert.equal(r.total, 3);
    assert.deepEqual(r.personas.map((p) => p.nom), ['Marketing EU', 'RSSI', 'Acheteur SMB']);
    assert.equal(r.personas[0].besoin, 'tracker links');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lirePersonasPrd — pas de PRD → vide', () => {
  const dir = tmpProjet();
  try {
    const r = lirePersonasPrd(dir);
    assert.equal(r.total, 0);
    assert.equal(r.fichier, null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireUserStoriesPrd — extrait les 3 US du bloc fenced', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), PRD_DEMO);
    const r = lireUserStoriesPrd(dir);
    assert.equal(r.total, 3);
    assert.deepEqual(r.userStories.map((u) => u.id), ['US-001', 'US-002', 'US-003']);
    assert.equal(r.userStories[0].priorite, 'MUST');
    assert.ok(r.userStories[0].action.includes('Marketing EU'));
    assert.ok(r.userStories[0].outcome.includes('Latence'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ─── #423 — Heuristique de matching Intent ↔ persona/US ─────────────────────

test('intentSertPersona — frontmatter explicite prime', () => {
  const intent = { titre: 'X', personas: ['Marketing EU'], sections: {} };
  const persona = { nom: 'Marketing EU' };
  assert.equal(intentSertPersona(intent, persona), true);
});

test('intentSertPersona — heuristique body (tous tokens multi-mot)', () => {
  const intent = {
    titre: 'Conversion checkout',
    sections: { pourQui: 'Acheteurs récurrents EU segment SMB' },
  };
  assert.equal(intentSertPersona(intent, { nom: 'Acheteur SMB' }), true);
  assert.equal(intentSertPersona(intent, { nom: 'RSSI' }), false);
});

test('intentSertPersona — sans sections → no match', () => {
  assert.equal(intentSertPersona({ titre: 'X' }, { nom: 'Marketing EU' }), false);
});

test('intentSertUs — id US-NNN dans body', () => {
  const intent = { titre: 'X', sections: { objectif: 'Implémenter US-001 et US-002' } };
  assert.equal(intentSertUs(intent, { id: 'US-001' }), true);
  assert.equal(intentSertUs(intent, { id: 'US-003' }), false);
});

test('intentSertUs — frontmatter user_stories', () => {
  const intent = { titre: 'X', user_stories: ['US-005'], sections: {} };
  assert.equal(intentSertUs(intent, { id: 'US-005' }), true);
});

test('calculerCouverturePrd — orchestre personas + US + intents', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), PRD_DEMO);
    const donnees = {
      intents: [
        { id: 'INTENT-001', titre: 'Conv', sections: { pourQui: 'Acheteurs SMB EU', objectif: 'Voir US-002.' } },
        { id: 'INTENT-002', titre: 'Audit', personas: ['RSSI'], sections: {} },
      ],
    };
    const c = calculerCouverturePrd(dir, donnees);
    assert.equal(c.personas.length, 3);
    assert.equal(c.totaux.personasCouvertes, 2, 'Acheteur SMB + RSSI matchés');
    assert.equal(c.totaux.userStories, 3);
    assert.equal(c.totaux.userStoriesCouvertes, 1, 'US-002 seul matché');
    const acheteur = c.personas.find((p) => p.nom === 'Acheteur SMB');
    assert.equal(acheteur.count, 1);
    assert.equal(acheteur.intents[0].id, 'INTENT-001');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('blocCouverturePrd — rendu vide si pas de PRD', () => {
  const html = blocCouverturePrd({ prdCoverage: { personas: [], userStories: [], totaux: {} } });
  assert.equal(html, '');
});

test('blocCouverturePrd — rendu complet avec tables', () => {
  const html = blocCouverturePrd({
    prdCoverage: {
      fichier: '.aiad/PRD.md',
      personas: [{ nom: 'A', besoin: 'b', count: 2, intents: [{ id: 'INTENT-001' }, { id: 'INTENT-002' }] }],
      userStories: [{ id: 'US-001', priorite: 'MUST', action: 'a', count: 0, intents: [] }],
      totaux: { personas: 1, personasCouvertes: 1, userStories: 1, userStoriesCouvertes: 0 },
    },
  });
  assert.ok(html.includes('Couverture PRD'));
  assert.ok(html.includes('1/1 personas'));
  assert.ok(html.includes('0/1 US'));
  assert.ok(html.includes('INTENT-001'));
  assert.ok(html.includes('US-001'));
  assert.ok(html.includes('MUST'));
});

// ─── #424 — Velocity buckets ────────────────────────────────────────────────

test('bucketsMois — 6 buckets, dispatch correct du done', () => {
  // 2026-05-15 12:00 UTC → bucket "2026-05"
  const now = Date.UTC(2026, 4, 15, 12, 0);
  const items = [
    { statut: 'done', mtime: Date.UTC(2026, 4, 10) },
    { statut: 'done', mtime: Date.UTC(2026, 4, 14) },
    { statut: 'done', mtime: Date.UTC(2026, 2, 5) }, // mars 2026
    { statut: 'in-progress', mtime: now }, // ignoré (pas done)
  ];
  const b = bucketsMois(items, { now, mois: 6 });
  assert.equal(b.length, 6);
  assert.equal(b[b.length - 1].count, 2, 'mai → 2');
  assert.equal(b[b.length - 3].count, 1, 'mars → 1');
});

test('bucketsSemaines — 12 buckets, ts strictement croissants', () => {
  const now = Date.UTC(2026, 4, 15);
  const b = bucketsSemaines([], { now, semaines: 12 });
  assert.equal(b.length, 12);
  for (let i = 1; i < b.length; i++) {
    assert.ok(b[i].ts > b[i - 1].ts);
  }
});

test('calculerVelocity — totaux + tendance', () => {
  const now = Date.UTC(2026, 4, 15);
  const donnees = {
    intents: [
      { statut: 'done', mtime: Date.UTC(2026, 4, 1) },
      { statut: 'done', mtime: Date.UTC(2026, 3, 28) },
      { statut: 'draft', mtime: now },
    ],
    specs: [
      { statut: 'done', mtime: Date.UTC(2026, 4, 12) },
      { statut: 'done', mtime: Date.UTC(2026, 4, 5) },
    ],
  };
  const v = calculerVelocity(donnees, { now });
  assert.equal(v.totaux.intentsDone, 2);
  assert.equal(v.totaux.specsDone, 2);
  assert.ok(['up', 'down', 'flat', 'unknown'].includes(v.tendanceIntents.sens));
});

test('blocVelocity — rendu empty state si zéro done', () => {
  const html = blocVelocity({
    velocity: {
      intentsParMois: [{ count: 0 }], specsParSemaine: [{ count: 0 }],
      totaux: { intentsDone: 0, specsDone: 0, moisCouverts: 1, semainesCouvertes: 1 },
      tendanceIntents: { sens: 'unknown' }, tendanceSpecs: { sens: 'unknown' },
    },
  });
  assert.ok(html.includes('aucun done dans la fenêtre'));
});

test('blocVelocity — rendu avec SVG quand done > 0', () => {
  const html = blocVelocity({
    velocity: {
      intentsParMois: [{ key: '2026-05', label: 'mai', count: 2, ts: 0 }],
      specsParSemaine: [{ key: '2026-W20', label: 'S20', count: 1, ts: 0 }],
      totaux: { intentsDone: 2, specsDone: 1, moisCouverts: 1, semainesCouvertes: 1 },
      tendanceIntents: { sens: 'up', delta: 2 },
      tendanceSpecs: { sens: 'flat', delta: 0 },
    },
  });
  assert.ok(html.includes('Vélocité'));
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('+2'), 'badge tendance up');
});

// ─── #425 — Recherche full-text via data-search-blob ────────────────────────

test('searchBlobIntent — concatène les 5 sections en lowercase', () => {
  const blob = searchBlobIntent({
    sections: {
      pourquoi: 'Sprint 12',
      objectif: 'Conversion > 70 %',
      contraintes: 'RGPD',
    },
  });
  assert.ok(blob.includes('sprint 12'));
  assert.ok(blob.includes('conversion'));
  assert.ok(blob.includes('rgpd'));
  // Pas de POURQUOI majuscule (lowercase appliqué)
  assert.ok(!blob.includes('Sprint'));
});

test('searchBlobIntent — vide si pas de sections', () => {
  assert.equal(searchBlobIntent({}), '');
  assert.equal(searchBlobIntent({ sections: null }), '');
  assert.equal(searchBlobIntent(null), '');
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — computePrdCoverage / prdCoverageSection / computeVelocity / velocitySection', () => {
  assert.equal(typeof computePrdCoverage, 'function');
  assert.equal(typeof prdCoverageSection, 'function');
  assert.equal(typeof computeVelocity, 'function');
  assert.equal(typeof velocitySection, 'function');
});
