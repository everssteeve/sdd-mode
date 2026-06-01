// Tests #213 — Performance budgets pour persona Tech Lead.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  lirePerfBudgets, blocPerfBudgets,
  readPerfBudgets, perfBudgetsSection,
} from '../lib/dashboard/perf-budgets.js';

function tmpProjet() {
  return mkdtempSync(join(tmpdir(), 'aiad-perf-'));
}

function ecrirePerfFile(racine, contenu) {
  mkdirSync(join(racine, '.aiad'), { recursive: true });
  writeFileSync(join(racine, '.aiad', 'perf-budgets.md'), contenu, 'utf-8');
}

test('lirePerfBudgets — sans fichier → total=0', () => {
  const r = lirePerfBudgets(tmpProjet());
  assert.equal(r.fichier, null);
  assert.equal(r.total, 0);
});

test('lirePerfBudgets — parse tableau Metric/Budget/Actuel/Date', () => {
  const racine = tmpProjet();
  try {
    ecrirePerfFile(racine, `# Performance budgets

| Metric           | Budget   | Actuel  | Date       |
|------------------|----------|---------|------------|
| Bundle main      | < 200 KB | 145 KB  | 2026-05-13 |
| API p95          | < 200 ms | 180 ms  | 2026-05-13 |
| Hot path /shorten| < 30 ms  | 12 ms   | 2026-05-13 |
`);
    const r = lirePerfBudgets(racine);
    assert.equal(r.total, 3);
    assert.equal(r.budgets[0].metric, 'Bundle main');
    assert.equal(r.budgets[0].budget, '< 200 KB');
    assert.equal(r.budgets[0].actuel, '145 KB');
    assert.equal(r.budgets[0].date, '2026-05-13');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lirePerfBudgets — état calculé via evaluerEtat', () => {
  const racine = tmpProjet();
  try {
    ecrirePerfFile(racine, `| Metric | Budget | Actuel |
|---|---|---|
| M1 | < 100 | 50 |
| M2 | < 100 | 120 |
| M3 | < 100 | 300 |
`);
    const r = lirePerfBudgets(racine);
    assert.equal(r.budgets[0].etat, 'ok', '50 < 100');
    assert.equal(r.budgets[1].etat, 'warn', '120 <= 100*1.5');
    assert.equal(r.budgets[2].etat, 'bad', '300 > 100*1.5');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lirePerfBudgets — Actuel absent → etat=unknown', () => {
  const racine = tmpProjet();
  try {
    ecrirePerfFile(racine, `| Metric | Budget |
|---|---|
| M1 | < 100 |
`);
    const r = lirePerfBudgets(racine);
    assert.equal(r.total, 1);
    assert.equal(r.budgets[0].actuel, null);
    assert.equal(r.budgets[0].etat, 'unknown');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lirePerfBudgets — colonnes alias EN (Target/Current)', () => {
  const racine = tmpProjet();
  try {
    ecrirePerfFile(racine, `| Metric | Target | Current |
|---|---|---|
| Bundle | < 200 KB | 145 KB |
`);
    const r = lirePerfBudgets(racine);
    assert.equal(r.total, 1);
    assert.equal(r.budgets[0].budget, '< 200 KB');
    assert.equal(r.budgets[0].actuel, '145 KB');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lirePerfBudgets — colonnes manquantes (pas Metric) → []', () => {
  const racine = tmpProjet();
  try {
    ecrirePerfFile(racine, `| Cap | Limit |
|---|---|
| A | < 100 |
`);
    const r = lirePerfBudgets(racine);
    assert.equal(r.total, 0, 'pas de colonne Metric → ignoré');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lirePerfBudgets — frontmatter YAML toléré', () => {
  const racine = tmpProjet();
  try {
    ecrirePerfFile(racine, `---
auteur: TL
date: 2026-05-13
---

# Perf budgets

| Metric | Budget | Actuel |
|---|---|---|
| Bundle | < 200 KB | 145 KB |
`);
    const r = lirePerfBudgets(racine);
    assert.equal(r.total, 1);
    assert.equal(r.budgets[0].metric, 'Bundle');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('blocPerfBudgets — sans données → chaîne vide', () => {
  assert.equal(blocPerfBudgets({}), '');
  assert.equal(blocPerfBudgets({ perfBudgets: { fichier: null, total: 0 } }), '');
});

test('blocPerfBudgets — rendu KPI + badges colorés', () => {
  const html = blocPerfBudgets({ perfBudgets: {
    fichier: '.aiad/perf-budgets.md', total: 3,
    budgets: [
      { metric: 'Bundle', budget: '< 200 KB', actuel: '145 KB', date: '2026-05-13', etat: 'ok' },
      { metric: 'API p95', budget: '< 200 ms', actuel: '250 ms', date: '2026-05-13', etat: 'warn' },
      { metric: 'Cold start', budget: '< 1 s', actuel: '3 s', date: '2026-05-13', etat: 'bad' },
    ],
  } });
  assert.match(html, /Performance budgets.*1\/3/, '1 ok sur 3 total');
  assert.match(html, /Bundle/);
  assert.match(html, /badge-ok[^>]*>145 KB ✓/);
  assert.match(html, /badge-warn[^>]*>250 ms/);
  assert.match(html, /badge-bad[^>]*>3 s ⚠/);
  assert.match(html, /href="\.\.\/\.aiad\/perf-budgets\.md"/);
});

test('blocPerfBudgets — actuel null → "—" muted', () => {
  const html = blocPerfBudgets({ perfBudgets: {
    fichier: '.aiad/perf-budgets.md', total: 1,
    budgets: [{ metric: 'TBM', budget: '< 100', actuel: null, date: null, etat: 'unknown' }],
  } });
  assert.match(html, /class="muted"[^>]*>—/);
});

test('Alias EN canoniques', () => {
  assert.equal(readPerfBudgets, lirePerfBudgets);
  assert.equal(perfBudgetsSection, blocPerfBudgets);
});
