/**
 * @spec SPEC-030-4-dashboard-eco
 * Tests : collecterEcoMetrics + pageEco + blocWidgetEco
 * Framework : node:test (natif)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { collecterEcoMetrics, pageEco, blocWidgetEco } from '../lib/eco-dashboard.js';

function tmpProjet(lignes = []) {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-eco-'));
  const metricsDir = join(racine, '.aiad', 'metrics');
  mkdirSync(metricsDir, { recursive: true });
  if (lignes.length > 0) {
    writeFileSync(join(metricsDir, 'hook-runs.jsonl'), lignes.join('\n') + '\n', 'utf-8');
  }
  return racine;
}

function entreeEco(overrides = {}) {
  return JSON.stringify({
    startedAt: '2026-06-01T10:00:00Z',
    ecoMetrics: {
      model: 'claude-sonnet-4-6',
      totalTokens: 5000,
      co2g: 0.12,
      method: 'estimated',
      ...overrides.ecoMetrics,
    },
    ...overrides,
  });
}

// ── Critère 3 : hook-runs.jsonl absent → Aucune donnée, pas d'exception ───────

test('absent : pas de hook-runs.jsonl → sessionCount 0, pas d\'exception', () => {
  const racine = mkdtempSync(join(tmpdir(), 'aiad-eco-absent-'));
  mkdirSync(join(racine, '.aiad', 'metrics'), { recursive: true });
  try {
    const eco = collecterEcoMetrics(racine);
    assert.equal(eco.sessionCount, 0);
    assert.equal(eco.co2Total30, null);
    assert.equal(eco.tendance, null);
    assert.deepEqual(eco.sessions, []);
  } finally {
    rmSync(racine, { recursive: true });
  }
});

test('absent : blocWidgetEco affiche "Aucune donnée"', () => {
  const eco = collecterEcoMetrics('/chemin/inexistant');
  const html = blocWidgetEco(eco);
  assert.ok(html.includes('Aucune donnée'), 'message "Aucune donnée" attendu');
});

test('absent : pageEco affiche "Aucune donnée"', () => {
  const html = pageEco({ ecoMetrics: { sessionCount: 0, sessions: [] } });
  assert.ok(html.includes('Aucune donnée'), 'message "Aucune donnée" attendu');
});

// ── Critère : 0 entrées ecoMetrics dans le fichier ────────────────────────────

test('0 ecoMetrics dans le fichier → sessionCount 0', () => {
  const racine = tmpProjet([
    JSON.stringify({ startedAt: '2026-06-01T10:00:00Z', exitCode: 0 }),
    JSON.stringify({ startedAt: '2026-06-02T10:00:00Z', exitCode: 1 }),
  ]);
  try {
    const eco = collecterEcoMetrics(racine);
    assert.equal(eco.sessionCount, 0);
  } finally {
    rmSync(racine, { recursive: true });
  }
});

// ── Critère 4 : < 15 sessions → tendance null ─────────────────────────────────

test('< 15 sessions → tendance null', () => {
  const lignes = Array.from({ length: 10 }, (_, i) =>
    entreeEco({ startedAt: `2026-06-${String(i + 1).padStart(2, '0')}T10:00:00Z` })
  );
  const racine = tmpProjet(lignes);
  try {
    const eco = collecterEcoMetrics(racine);
    assert.equal(eco.sessionCount, 10);
    assert.equal(eco.tendance, null, 'tendance doit être null avec < 15 sessions');
  } finally {
    rmSync(racine, { recursive: true });
  }
});

test('< 15 sessions → pageEco affiche "Données insuffisantes"', () => {
  const lignes = Array.from({ length: 5 }, () => entreeEco());
  const racine = tmpProjet(lignes);
  try {
    const eco = collecterEcoMetrics(racine);
    const html = pageEco({ ecoMetrics: eco });
    assert.ok(
      html.includes('Données insuffisantes pour calculer la tendance'),
      'message "Données insuffisantes" attendu'
    );
  } finally {
    rmSync(racine, { recursive: true });
  }
});

// ── Critère : lignes malformées ignorées silencieusement ─────────────────────

test('ligne malformée ignorée, les valides traitées', () => {
  const lignes = [
    'pas du json {{{',
    entreeEco({ ecoMetrics: { co2g: 0.5, totalTokens: 1000, method: 'estimated', model: 'x' } }),
    '{"startedAt":"2026-06-01","ecoMetrics":"invalide"}', // ecoMetrics non-object mais présent
    entreeEco({ ecoMetrics: { co2g: 0.3, totalTokens: 2000, method: 'estimated', model: 'x' } }),
  ];
  const racine = tmpProjet(lignes);
  try {
    const eco = collecterEcoMetrics(racine);
    // Les 2 entrées valides + 1 avec ecoMetrics string (présent mais inutilisable)
    assert.ok(eco.sessionCount >= 2, 'au moins 2 sessions valides');
    assert.ok(eco.co2Total30 != null, 'co2Total30 non nul');
  } finally {
    rmSync(racine, { recursive: true });
  }
});

// ── Critère : co2g null ignoré dans la somme ─────────────────────────────────

test('co2g null ignoré dans la somme, sessionsAvecCo2 décompté', () => {
  const lignes = [
    entreeEco({ ecoMetrics: { co2g: null, totalTokens: 1000, method: 'unknown', model: 'x' } }),
    entreeEco({ ecoMetrics: { co2g: 0.4, totalTokens: 2000, method: 'estimated', model: 'x' } }),
  ];
  const racine = tmpProjet(lignes);
  try {
    const eco = collecterEcoMetrics(racine);
    assert.equal(eco.sessionsAvecCo2, 1, 'une seule session avec co2g non null');
    assert.equal(eco.co2Total30, 0.4);
    assert.equal(eco.sessionCount, 2);
  } finally {
    rmSync(racine, { recursive: true });
  }
});

// ── Critère : toutes method:'unknown' → co2Total null dans le résumé ─────────

test('toutes method unknown → sessionsAvecCo2 0 si co2g null', () => {
  const lignes = Array.from({ length: 3 }, () =>
    entreeEco({ ecoMetrics: { co2g: null, totalTokens: 500, method: 'unknown', model: null } })
  );
  const racine = tmpProjet(lignes);
  try {
    const eco = collecterEcoMetrics(racine);
    assert.equal(eco.sessionsAvecCo2, 0);
    assert.equal(eco.co2Total30, null);
  } finally {
    rmSync(racine, { recursive: true });
  }
});

// ── Critère 5 : RGAA — th scope="col" sur chaque colonne ─────────────────────

test('RGAA : pageEco contient <th scope="col"> sur toutes les colonnes du tableau', () => {
  const lignes = Array.from({ length: 3 }, (_, i) =>
    entreeEco({ startedAt: `2026-06-${String(i + 1).padStart(2, '0')}T10:00:00Z` })
  );
  const racine = tmpProjet(lignes);
  try {
    const eco = collecterEcoMetrics(racine);
    const html = pageEco({ ecoMetrics: eco });
    const cols = ['Date', 'Modèle', 'Tokens', 'CO₂ (g)', 'Méthode'];
    for (const col of cols) {
      assert.ok(
        html.includes(`scope="col"`) && html.includes(col),
        `th scope="col" attendu pour colonne "${col}"`
      );
    }
    const scopeColCount = (html.match(/scope="col"/g) || []).length;
    assert.ok(scopeColCount >= 5, `au moins 5 th scope="col" (trouvé : ${scopeColCount})`);
  } finally {
    rmSync(racine, { recursive: true });
  }
});

// ── Critère 2 : widget metrics.html contient le libellé obligatoire ───────────

test('blocWidgetEco contient le libellé "estimation indicative (non certifiée)"', () => {
  const lignes = Array.from({ length: 3 }, () => entreeEco());
  const racine = tmpProjet(lignes);
  try {
    const eco = collecterEcoMetrics(racine);
    const html = blocWidgetEco(eco);
    assert.ok(
      html.includes('estimation indicative (non certifiée)'),
      'libellé obligatoire absent du widget'
    );
  } finally {
    rmSync(racine, { recursive: true });
  }
});

// ── Critère : calculs corrects sur cas normal (≥ 15 sessions) ────────────────

test('cas normal ≥ 15 sessions : calculs co2Total30, co2Moyenne, tendance', () => {
  // 20 sessions : 10 avec co2g=0.1, 10 avec co2g=0.3
  const lignes = [
    ...Array.from({ length: 10 }, () =>
      entreeEco({ ecoMetrics: { co2g: 0.1, totalTokens: 1000, method: 'estimated', model: 'x' } })
    ),
    ...Array.from({ length: 10 }, () =>
      entreeEco({ ecoMetrics: { co2g: 0.3, totalTokens: 2000, method: 'estimated', model: 'x' } })
    ),
  ];
  const racine = tmpProjet(lignes);
  try {
    const eco = collecterEcoMetrics(racine);
    assert.equal(eco.sessionCount, 20);
    assert.ok(eco.tendance !== null, 'tendance non null avec ≥ 15 sessions');
    // sessions 1-10 → co2 = 1.0 ; sessions 11-20 → co2 = 3.0 → tendance = +200%
    assert.equal(eco.tendance, 200, `tendance attendue 200%, reçue ${eco.tendance}`);
    assert.ok(Math.abs(eco.co2Total30 - 4.0) < 0.001, `co2Total30 attendu ≈ 4.0 (reçu ${eco.co2Total30})`);
    assert.ok(Math.abs(eco.co2Moyenne - 0.2) < 0.001);
    assert.equal(eco.sessionEstimees, 20);
  } finally {
    rmSync(racine, { recursive: true });
  }
});
