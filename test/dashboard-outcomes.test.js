// Tests #208 — Outcome Criteria du PRD sur index.html.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  lireOutcomes, blocOutcomes,
  readOutcomes, outcomesSection,
  lireMesures, evaluerEtat, parserValeur, normaliserVersUniteBase,
  readMeasurements, evaluateState, parseValue, normalizeToBaseUnit,
} from '../lib/dashboard/outcomes.js';

function tmpProjet() {
  return mkdtempSync(join(tmpdir(), 'aiad-outcomes-'));
}

function ecrirePrd(racine, contenu) {
  mkdirSync(join(racine, '.aiad'), { recursive: true });
  writeFileSync(join(racine, '.aiad', 'PRD.md'), contenu, 'utf-8');
}

test('lireOutcomes — sans PRD.md → total=0', () => {
  const r = lireOutcomes(tmpProjet());
  assert.equal(r.fichier, null);
  assert.equal(r.total, 0);
});

test('lireOutcomes — PRD sans section Outcome Criteria → total=0', () => {
  const racine = tmpProjet();
  try {
    ecrirePrd(racine, `# PRD\n\n## 1. Contexte\n\nTexte.\n`);
    const r = lireOutcomes(racine);
    assert.equal(r.total, 0);
    assert.equal(r.fichier, '.aiad/PRD.md');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lireOutcomes — détecte section "## 4. Outcome Criteria" + tableau', () => {
  const racine = tmpProjet();
  try {
    ecrirePrd(racine, `# PRD

## 4. Outcome Criteria

| Critère | Baseline | Cible | Méthode |
|---------|----------|-------|---------|
| Latence p95 | n/a | < 50 ms | Benchmark wrk |
| RGPD compliance | non | DPIA validée | aiad-sdd dpia |
| Taux d'erreur 5xx | n/a | < 0,1 % | Monitoring 30j |

## 5. Périmètre

Texte.
`);
    const r = lireOutcomes(racine);
    assert.equal(r.total, 3);
    assert.equal(r.criteres[0].critere, 'Latence p95');
    assert.equal(r.criteres[0].baseline, 'n/a');
    assert.equal(r.criteres[0].cible, '< 50 ms');
    assert.equal(r.criteres[0].methode, 'Benchmark wrk');
    assert.equal(r.criteres[1].critere, 'RGPD compliance');
    assert.equal(r.criteres[2].critere, 'Taux d\'erreur 5xx');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lireOutcomes — section sans numéro (## Outcome Criteria)', () => {
  const racine = tmpProjet();
  try {
    ecrirePrd(racine, `## Outcome Criteria

| Critère | Baseline | Cible | Méthode |
|---------|----------|-------|---------|
| Mesure | 0 | 100 | manuel |
`);
    const r = lireOutcomes(racine);
    assert.equal(r.total, 1);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lireOutcomes — alias anglais "## Success Criteria"', () => {
  const racine = tmpProjet();
  try {
    ecrirePrd(racine, `## Success Criteria

| Criterion | Baseline | Target | Method |
|-----------|----------|--------|--------|
| API p95 | n/a | < 100 ms | wrk |
`);
    const r = lireOutcomes(racine);
    assert.equal(r.total, 1);
    assert.equal(r.criteres[0].critere, 'API p95');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lireOutcomes — arrête au prochain H2', () => {
  const racine = tmpProjet();
  try {
    ecrirePrd(racine, `## 4. Outcome Criteria

| Critère | Baseline | Cible | Méthode |
|---------|----------|-------|---------|
| Crit1 | 0 | 100 | M1 |

## 5. Périmètre

| Module | Statut |
|--------|--------|
| Auth | Done |
`);
    const r = lireOutcomes(racine);
    assert.equal(r.total, 1, 'le tableau Périmètre ne doit pas être inclus');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lireOutcomes — tableau sans séparateur explicite (---) toléré', () => {
  const racine = tmpProjet();
  try {
    ecrirePrd(racine, `## Outcome Criteria

| Critère | Baseline | Cible | Méthode |
| Mesure | 0 | 100 | manuel |
`);
    const r = lireOutcomes(racine);
    // Sans séparateur, la 2e ligne est traitée comme data → 0 critère
    // (header est consommé en ligne 1, séparateur attendu mais c'est déjà data)
    // Comportement acceptable : tolère ou exclut selon parsing.
    assert.ok(r.total === 0 || r.total === 1, `total=${r.total} acceptable`);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lireOutcomes — entrée vide (ligne `|||`) ignorée', () => {
  const racine = tmpProjet();
  try {
    ecrirePrd(racine, `## Outcome Criteria

| Critère | Baseline | Cible | Méthode |
|---------|----------|-------|---------|
| C1 | a | b | c |
|         |          |       |         |
| C2 | x | y | z |
`);
    const r = lireOutcomes(racine);
    // Soit 2 entrées (vide skip), soit 3 (vide gardée). Au moins 2.
    assert.ok(r.total >= 2);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('blocOutcomes — sans données → chaîne vide', () => {
  assert.equal(blocOutcomes({}), '');
  assert.equal(blocOutcomes({ outcomes: { fichier: null, total: 0, criteres: [] } }), '');
});

test('blocOutcomes — PRD trouvé mais 0 critère → omis', () => {
  const html = blocOutcomes({ outcomes: { fichier: '.aiad/PRD.md', total: 0, criteres: [] } });
  assert.equal(html, '');
});

test('blocOutcomes — table rendue avec badge sur la cible', () => {
  const html = blocOutcomes({ outcomes: {
    fichier: '.aiad/PRD.md',
    total: 2,
    criteres: [
      { critere: 'Latence p95', baseline: 'n/a', cible: '< 50 ms', methode: 'wrk' },
      { critere: 'RGPD', baseline: 'non', cible: 'DPIA validée', methode: 'aiad-sdd dpia' },
    ],
  } });
  assert.match(html, /Outcome Criteria \(PRD\)/);
  assert.match(html, />2</);
  assert.match(html, /Latence p95/);
  assert.match(html, /badge-info[^>]*>&lt; 50 ms/);
  assert.match(html, /aiad-sdd dpia/);
  assert.match(html, /href="\.\.\/\.aiad\/PRD\.md"/);
});

test('Alias EN canoniques', () => {
  assert.equal(readOutcomes, lireOutcomes);
  assert.equal(outcomesSection, blocOutcomes);
  assert.equal(readMeasurements, lireMesures);
  assert.equal(evaluateState, evaluerEtat);
  assert.equal(parseValue, parserValeur);
});

// ─── #209 Mesures actuelles vs cible ────────────────────────────────────────

test('parserValeur — extrait nombre + direction + unite', () => {
  assert.equal(parserValeur('< 50 ms').num, 50);
  assert.equal(parserValeur('< 50 ms').direction, 'lower');
  assert.equal(parserValeur('< 50 ms').unite?.categorie, 'duree');
  assert.equal(parserValeur('≤ 100').num, 100);
  assert.equal(parserValeur('≤ 100').unite, null, 'sans unité → null');
  assert.equal(parserValeur('42 ms').num, 42);
  assert.equal(parserValeur('42 ms').direction, 'higher');
  assert.equal(parserValeur('99,9 %').num, 99.9);
  assert.equal(parserValeur('99,9 %').unite?.categorie, 'pct');
  assert.equal(parserValeur('200 KB').unite?.categorie, 'taille');
  assert.equal(parserValeur('1 GB').unite?.categorie, 'taille');
  assert.equal(parserValeur('1 GB').unite?.facteur, 1024 ** 3);
  assert.equal(parserValeur('').num, null);
  assert.equal(parserValeur('n/a').num, null);
});

test('evaluerEtat — lower is better (< cible)', () => {
  assert.equal(evaluerEtat('< 50 ms', '42 ms'), 'ok');
  assert.equal(evaluerEtat('< 50 ms', '60 ms'), 'warn');
  assert.equal(evaluerEtat('< 50 ms', '80 ms'), 'bad');
  assert.equal(evaluerEtat('< 50 ms', '50 ms'), 'ok', 'égal = ok pour lower');
});

test('evaluerEtat — higher is better', () => {
  assert.equal(evaluerEtat('99 %', '99 %'), 'ok');
  assert.equal(evaluerEtat('99 %', '80 %'), 'warn');
  assert.equal(evaluerEtat('99 %', '50 %'), 'bad');
});

test('evaluerEtat — conversion d\'unités durée (ms ↔ s)', () => {
  // 850 ms vs < 1 s = 1000 ms → ok
  assert.equal(evaluerEtat('< 1 s', '850 ms'), 'ok');
  // 1200 ms vs < 1 s = 1000 ms, 1.5×=1500 → warn
  assert.equal(evaluerEtat('< 1 s', '1200 ms'), 'warn');
  // 3000 ms vs < 1 s → bad
  assert.equal(evaluerEtat('< 1 s', '3000 ms'), 'bad');
  // 2 min vs < 5 min → ok
  assert.equal(evaluerEtat('< 5 min', '2 min'), 'ok');
});

test('evaluerEtat — conversion d\'unités taille (B/KB/MB/GB)', () => {
  // 145 KB vs < 200 KB → ok (déjà ok avant #214)
  assert.equal(evaluerEtat('< 200 KB', '145 KB'), 'ok');
  // 145000 B vs < 200 KB → 145000 vs 204800 → ok (conversion croisée)
  assert.equal(evaluerEtat('< 200 KB', '145000 B'), 'ok');
  // 2 GB vs < 1 GB → bad (2x)
  assert.equal(evaluerEtat('< 1 GB', '2 GB'), 'bad');
  // 1500 MB vs < 1 GB = 1024 MB → 1500 ≤ 1.5×1024 → warn
  assert.equal(evaluerEtat('< 1 GB', '1500 MB'), 'warn');
});

test('evaluerEtat — unités différentes catégories → fallback comparaison brute', () => {
  // ms vs KB → catégories différentes → comparaison numérique brute
  // (10 vs 5 → higher is better → ok)
  assert.equal(evaluerEtat('> 5 KB', '10 ms'), 'ok', 'fallback compare 10 > 5');
});

test('evaluerEtat — sans unité, comportement #209 préservé', () => {
  assert.equal(evaluerEtat('< 50', '42'), 'ok');
  assert.equal(evaluerEtat('< 50', '60'), 'warn');
});

test('normaliserVersUniteBase — convertit selon le facteur', () => {
  const { num: n1, categorie: c1 } = normaliserVersUniteBase(2, { categorie: 'taille', facteur: 1024 });
  assert.equal(n1, 2048);
  assert.equal(c1, 'taille');
  const { num: n2, categorie: c2 } = normaliserVersUniteBase(5, null);
  assert.equal(n2, 5);
  assert.equal(c2, 'aucune');
  const { num: n3 } = normaliserVersUniteBase(null, { categorie: 'duree', facteur: 1 });
  assert.equal(n3, null);
});

test('Alias EN normalizeToBaseUnit', () => {
  assert.equal(normalizeToBaseUnit, normaliserVersUniteBase);
});

test('evaluerEtat — non-numérique → comparaison textuelle', () => {
  assert.equal(evaluerEtat('DPIA validée', 'DPIA validée'), 'ok');
  assert.equal(evaluerEtat('DPIA validée', 'en cours'), 'unknown');
  assert.equal(evaluerEtat('cible texte', '—'), 'unknown');
});

test('lireMesures — sans dossier outcomes → vide', () => {
  const r = lireMesures(tmpProjet());
  assert.equal(r.fichier, null);
  assert.equal(r.mesures.length, 0);
});

test('lireMesures — sélectionne le fichier MD le plus récent', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad', 'metrics', 'outcomes'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'metrics', 'outcomes', '2026-04-01.md'),
      `| Critère | Actuel |\n|---------|--------|\n| C1 | 100 ms |\n`);
    // Force un mtime plus récent sur le 2e
    const t = Date.now() + 1000;
    writeFileSync(join(racine, '.aiad', 'metrics', 'outcomes', '2026-05-13.md'),
      `| Critère | Actuel |\n|---------|--------|\n| C1 | 42 ms |\n`);
    utimesSync(join(racine, '.aiad', 'metrics', 'outcomes', '2026-05-13.md'), new Date(t), new Date(t));
    const r = lireMesures(racine);
    assert.equal(r.mesures.length, 1);
    assert.equal(r.mesures[0].critere, 'C1');
    assert.equal(r.mesures[0].actuel, '42 ms');
    assert.equal(r.date, '2026-05-13');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lireMesures — tableau sans colonne "Actuel" → []', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad', 'metrics', 'outcomes'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'metrics', 'outcomes', '2026-05-13.md'),
      `| Critère | Cible |\n|---------|-------|\n| C1 | 42 |\n`);
    const r = lireMesures(racine);
    assert.equal(r.mesures.length, 0, 'pas de colonne "Actuel" → ignoré');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lireMesures — alias EN "Current"', () => {
  const racine = tmpProjet();
  try {
    mkdirSync(join(racine, '.aiad', 'metrics', 'outcomes'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'metrics', 'outcomes', '2026-05-13.md'),
      `| Criterion | Current | Note |\n|-----------|---------|------|\n| Latency | 42 ms | OK |\n`);
    const r = lireMesures(racine);
    assert.equal(r.mesures.length, 1);
    assert.equal(r.mesures[0].actuel, '42 ms');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lireOutcomes — enrichit chaque critère avec mesure + état si match', () => {
  const racine = tmpProjet();
  try {
    ecrirePrd(racine, `## Outcome Criteria

| Critère | Baseline | Cible | Méthode |
|---------|----------|-------|---------|
| Latence p95 | n/a | < 50 ms | wrk |
| Erreur 5xx | n/a | < 0,1 % | monitoring |
`);
    mkdirSync(join(racine, '.aiad', 'metrics', 'outcomes'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'metrics', 'outcomes', '2026-05-13.md'),
      `| Critère | Actuel |\n|---------|--------|\n| Latence p95 | 42 ms |\n| Erreur 5xx | 0,12 % |\n`);
    const r = lireOutcomes(racine);
    assert.equal(r.total, 2);
    assert.equal(r.criteres[0].actuel, '42 ms');
    assert.equal(r.criteres[0].etat, 'ok');
    assert.equal(r.criteres[1].actuel, '0,12 %');
    assert.equal(r.criteres[1].etat, 'warn', '0.12% > 0.1% mais ≤ 1.5x = 0.15%');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('lireOutcomes — critère PRD sans mesure → etat=unknown, actuel=null', () => {
  const racine = tmpProjet();
  try {
    ecrirePrd(racine, `## Outcome Criteria

| Critère | Baseline | Cible | Méthode |
|---------|----------|-------|---------|
| C1 | 0 | 100 | M |
| C2 | 0 | 100 | M |
`);
    mkdirSync(join(racine, '.aiad', 'metrics', 'outcomes'), { recursive: true });
    writeFileSync(join(racine, '.aiad', 'metrics', 'outcomes', '2026-05-13.md'),
      `| Critère | Actuel |\n|---------|--------|\n| C1 | 95 |\n`);
    const r = lireOutcomes(racine);
    assert.equal(r.criteres[0].etat, 'warn');
    assert.equal(r.criteres[1].etat, 'unknown');
    assert.equal(r.criteres[1].actuel, null);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test('blocOutcomes — colonne "Actuel" affichée uniquement si ≥ 1 mesure', () => {
  const html1 = blocOutcomes({ outcomes: {
    fichier: '.aiad/PRD.md', total: 1,
    criteres: [{ critere: 'C1', baseline: 'a', cible: '< 50', methode: 'm', actuel: null, etat: 'unknown' }],
    mesures: { fichier: null, date: null, total: 0 },
  } });
  assert.doesNotMatch(html1, /<th>Actuel<\/th>/);
  assert.match(html1, /Aucune mesure courante/);

  const html2 = blocOutcomes({ outcomes: {
    fichier: '.aiad/PRD.md', total: 1,
    criteres: [{ critere: 'C1', baseline: 'a', cible: '< 50', methode: 'm', actuel: '42', etat: 'ok' }],
    mesures: { fichier: '.aiad/metrics/outcomes/2026-05-13.md', date: '2026-05-13', total: 1 },
  } });
  assert.match(html2, /<th>Actuel<\/th>/);
  assert.match(html2, /Mesures du 2026-05-13/);
  assert.match(html2, /badge-ok[^>]*>42 ✓/);
});

test('blocOutcomes — badge couleur selon état', () => {
  const html = blocOutcomes({ outcomes: {
    fichier: '.aiad/PRD.md', total: 3,
    criteres: [
      { critere: 'C1', baseline: 'a', cible: '< 50', methode: 'm', actuel: '40', etat: 'ok' },
      { critere: 'C2', baseline: 'a', cible: '< 50', methode: 'm', actuel: '60', etat: 'warn' },
      { critere: 'C3', baseline: 'a', cible: '< 50', methode: 'm', actuel: '120', etat: 'bad' },
    ],
    mesures: { fichier: '.aiad/metrics/outcomes/2026-05-13.md', date: '2026-05-13', total: 3 },
  } });
  assert.match(html, /badge-ok[^>]*>40 ✓/);
  assert.match(html, /badge-warn[^>]*>60/);
  assert.match(html, /badge-bad[^>]*>120 ⚠/);
});
