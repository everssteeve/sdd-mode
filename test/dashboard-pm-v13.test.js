// Tests #456 / #457 / #458 — Boucle 13 PM cockpit search/permalink/capacity :
//   - recherche globale cross-section
//   - permalinks par section
//   - capacity planner trimestriel

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { blocGlobalSearch, globalSearchBar } from '../lib/dashboard/global-search.js';
import { blocSectionPermalinks, sectionPermalinks } from '../lib/dashboard/section-permalinks.js';
import {
  lireCapacite, etatTrimestre, calculerCapacityPlanner, blocCapacityPlanner,
  readCapacity, quarterState, computeCapacityPlanner, capacityPlannerSection,
  CAPACITY_PAR_DEFAUT, DEFAULT_CAPACITY,
} from '../lib/dashboard/capacity-planner.js';

function tmpProjet() {
  const dir = join(tmpdir(), 'aiad-pm-v13-' + Math.random().toString(36).slice(2));
  mkdirSync(join(dir, '.aiad'), { recursive: true });
  return dir;
}

// ─── #456 — Recherche globale ───────────────────────────────────────────────

test('blocGlobalSearch — rend barre + input + kbd + clear + script', () => {
  const html = blocGlobalSearch();
  assert.ok(html.includes('pm-search-bar'));
  assert.ok(html.includes('id="pm-search-input"'));
  assert.ok(html.includes('⌘K'));
  assert.ok(html.includes('id="pm-search-clear"'));
  assert.ok(html.includes('id="pm-search-empty"'));
  assert.ok(html.includes('addEventListener'));
});

test('blocGlobalSearch — script gère raccourci Cmd+K et Escape', () => {
  const html = blocGlobalSearch();
  assert.ok(html.includes("e.key === 'k'") || html.includes('e.key === "k"'));
  assert.ok(html.includes("e.key === 'Escape'") || html.includes('e.key === "Escape"'));
});

test('blocGlobalSearch — sélecteurs d\'items filtrables inclusifs', () => {
  const html = blocGlobalSearch();
  // Quelques sélecteurs canoniques que la barre doit indexer
  assert.ok(html.includes('.roadmap-card'));
  assert.ok(html.includes('.deps-card'));
  assert.ok(html.includes('.risk-card'));
  assert.ok(html.includes('.persona-card'));
  assert.ok(html.includes('.tag-chip'));
  assert.ok(html.includes('section table tbody tr'));
});

// ─── #457 — Permalinks par section ──────────────────────────────────────────

test('blocSectionPermalinks — rend CSS + script', () => {
  const html = blocSectionPermalinks();
  assert.ok(html.includes('.pm-permalink'));
  assert.ok(html.includes('pm-permalink-toast'));
  assert.ok(html.includes('navigator.clipboard'));
});

test('blocSectionPermalinks — fallback execCommand si pas de clipboard', () => {
  const html = blocSectionPermalinks();
  assert.ok(html.includes('execCommand'));
});

test('blocSectionPermalinks — auto-scroll vers ancre si présente', () => {
  const html = blocSectionPermalinks();
  assert.ok(html.includes('window.location.hash'));
  assert.ok(html.includes('scrollIntoView'));
});

// ─── #458 — Capacity planner ────────────────────────────────────────────────

test('lireCapacite — default 10 si pas de PRD', () => {
  const dir = tmpProjet();
  try {
    const r = lireCapacite(dir);
    assert.equal(r.capacite, 10);
    assert.equal(r.source, 'défaut');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireCapacite — team_capacity_per_quarter frontmatter prime', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), `---
team_capacity_per_quarter: 8
---
# PRD
`);
    const r = lireCapacite(dir);
    assert.equal(r.capacite, 8);
    assert.ok(r.source.includes('frontmatter'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireCapacite — intents_per_pe * team_size si team_capacity_per_quarter absent', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), `---
intents_per_pe: 3
team_size: 4
---
# PRD
`);
    const r = lireCapacite(dir);
    assert.equal(r.capacite, 12);
    assert.ok(r.source.includes('Intents'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('etatTrimestre — 4 paliers selon ratio', () => {
  assert.equal(etatTrimestre(10, 10), 'sature');
  assert.equal(etatTrimestre(11, 10), 'sature');
  assert.equal(etatTrimestre(7, 10), 'plein');
  assert.equal(etatTrimestre(5, 10), 'sain');
  assert.equal(etatTrimestre(3, 10), 'sous-utilise');
});

test('etatTrimestre — capacité 0 → inconnu', () => {
  assert.equal(etatTrimestre(5, 0), 'inconnu');
});

test('calculerCapacityPlanner — comptage par trimestre + état + ratio', () => {
  const dir = tmpProjet();
  try {
    writeFileSync(join(dir, '.aiad', 'PRD.md'), `---
team_capacity_per_quarter: 3
---
# PRD
`);
    const now = Date.UTC(2026, 4, 15); // Q2-2026
    const donnees = { intents: [
      { id: 'A', statut: 'active', target: 'Q2-2026' },
      { id: 'B', statut: 'in-progress', target: 'Q2-2026' },
      { id: 'C', statut: 'draft', target: 'Q2-2026' },
      { id: 'D', statut: 'active', target: 'Q3-2026' },
      { id: 'E', statut: 'done', target: 'Q2-2026' }, // exclu (done)
    ]};
    const r = calculerCapacityPlanner(dir, donnees, { now });
    const q2 = r.buckets.find((b) => b.label === 'Q2-2026');
    assert.equal(q2.charge, 3);
    assert.equal(q2.etat, 'sature', 'capacité 3, charge 3 → saturé');
    const q3 = r.buckets.find((b) => b.label === 'Q3-2026');
    assert.equal(q3.charge, 1);
    // 1 / 3 = 0.33 → sous-utilisé (< 0.4)
    assert.equal(q3.etat, 'sous-utilise');
    assert.equal(r.totaux.satures, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerCapacityPlanner — Intents actifs sans target comptés en sansQuarter', () => {
  const dir = tmpProjet();
  try {
    const donnees = { intents: [
      { id: 'A', statut: 'active' }, // pas de target
      { id: 'B', statut: 'active', target: 'Q3-2026' },
    ]};
    const r = calculerCapacityPlanner(dir, donnees, { now: Date.UTC(2026, 4, 15) });
    assert.equal(r.totaux.sansQuarter, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('blocCapacityPlanner — rend grille colonnes + barres de progression', () => {
  const html = blocCapacityPlanner({ capacityPlanner: {
    capacite: 10, capaciteSource: 'défaut',
    buckets: [
      { quarter: { year: 2026, quarter: 2 }, label: 'Q2-2026', cle: 0, charge: 12, capacite: 10, ratio: 1.2, etat: 'sature',
        intents: [{ id: 'INTENT-A', titre: 't', statut: 'active', file: null }] },
      { quarter: { year: 2026, quarter: 3 }, label: 'Q3-2026', cle: 1, charge: 5, capacite: 10, ratio: 0.5, etat: 'sain',
        intents: [] },
    ],
    totaux: { satures: 1, sansQuarter: 2 },
  }});
  assert.ok(html.includes('Capacité par trimestre'));
  assert.ok(html.includes('cap-col'));
  assert.ok(html.includes('etat-sature'));
  assert.ok(html.includes('etat-sain'));
  assert.ok(html.includes('12 / 10'));
  assert.ok(html.includes('5 / 10'));
  assert.ok(html.includes('cap-bar-fill'));
  assert.ok(html.includes('2 Intent(s) actif(s) sans target'));
});

test('CAPACITY_PAR_DEFAUT — alias EN DEFAULT_CAPACITY', () => {
  assert.equal(CAPACITY_PAR_DEFAUT, DEFAULT_CAPACITY);
  assert.equal(CAPACITY_PAR_DEFAUT, 10);
});

// ─── Alias EN ────────────────────────────────────────────────────────────────

test('Alias EN — variantes EN', () => {
  assert.equal(typeof globalSearchBar, 'function');
  assert.equal(typeof sectionPermalinks, 'function');
  assert.equal(typeof readCapacity, 'function');
  assert.equal(typeof quarterState, 'function');
  assert.equal(typeof computeCapacityPlanner, 'function');
  assert.equal(typeof capacityPlannerSection, 'function');
});
