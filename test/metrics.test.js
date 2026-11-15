// Tests de `aiad-sdd metrics` : enregistrement contrôlé et état de pilotage (SPEC-038-2).
//
// @spec SPEC-038-2-instrumentation-metriques

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { enregistrerMetriques, definirPerimetre, lirePaires, etatMetriques, commandeMetrics, CLES, CLES_INTERDITES } from '../lib/metrics.js';
import { parserKv } from '../lib/dashboard/collect.js';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'aiad-sdd.js');

function projet() {
  const d = mkdtempSync(join(tmpdir(), 'aiad-metrics-'));
  mkdirSync(join(d, '.aiad'), { recursive: true });
  return d;
}
const lire = (d, rel) => readFileSync(join(d, rel), 'utf-8');

describe('metrics — enregistrement', () => {
  test('CA-005 — écrit un fichier lisible par le dashboard, clés et valeurs contrôlées', () => {
    const d = projet();
    try {
      const r = enregistrerMetriques(d, 'retro', { adoption_agents_pct: '92', satisfaction_equipe: '7,5', temps_flow_heures: 'null', iteration: 'S12' }, { date: '2026-11-15' });
      assert.equal(r.ok, true, r.erreurs.join(' | '));
      assert.equal(r.fichier, '.aiad/metrics/retro/2026-11-15.md');
      const kv = parserKv(lire(d, r.fichier));
      assert.equal(kv.adoption_agents_pct, 92);
      assert.equal(kv.satisfaction_equipe, 7.5);
      assert.equal(kv.temps_flow_heures, 'null');
      assert.equal(kv.type, 'retro');
      assert.equal(String(kv.date), '2026-11-15');
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-006 — refus motivés, sans rien écrire', () => {
    const d = projet();
    try {
      const cas = [
        ['inconnue', { a: '1' }, /Catégorie inconnue/],
        ['retro', { turnover_pct: '8' }, /donnée RH ou de santé/],
        ['retro', { sick_days: '3' }, /donnée RH ou de santé/],
        ['retro', { humeur: '8' }, /Clé inconnue pour retro/],
        ['retro', { adoption_agents_pct: 'beaucoup' }, /attend un nombre/],
        ['retro', { adoption_agents_pct: '140' }, /doit être ≤ 100/],
        ['retro', { satisfaction_equipe: '-1' }, /doit être ≥ 0/],
        ['retro', {}, /Aucune métrique fournie/],
        ['specs', { sqs_score: '4', gate_result: 'open' }, /« spec_id » est requis/],
        ['specs', { spec_id: 'SPEC-001-1-a', gate_result: 'peut-être' }, /attend open \| closed/],
        ['deployments', { cycle_time_days: '2' }, /« status » est requis/],
      ];
      for (const [cat, paires, motif] of cas) {
        const r = enregistrerMetriques(d, cat, paires);
        assert.equal(r.ok, false, `${cat} ${JSON.stringify(paires)}`);
        assert.match(r.erreurs.join(' | '), motif);
      }
      assert.match(enregistrerMetriques(d, 'retro', { satisfaction_pe: '8' }, { date: '15/11/2026' }).erreurs[0], /Date invalide/);
      assert.equal(existsSync(join(d, '.aiad', 'metrics')), false, 'rien écrit');
      const sans = mkdtempSync(join(tmpdir(), 'aiad-metrics-'));
      assert.match(enregistrerMetriques(sans, 'retro', { satisfaction_pe: '8' }).erreurs[0], /Pas de dossier \.aiad/);
      rmSync(sans, { recursive: true, force: true });
      for (const c of CLES_INTERDITES) for (const cat of Object.keys(CLES)) assert.equal(c in CLES[cat], false, `${c} absente de ${cat}`);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-007 — Gate : le nombre de passages est compté par la commande', () => {
    const d = projet();
    try {
      const un = enregistrerMetriques(d, 'specs', { spec_id: 'SPEC-001-1-a', sqs_score: '3', gate_result: 'closed' }, { date: '2026-11-10' });
      const deux = enregistrerMetriques(d, 'specs', { spec_id: 'SPEC-001-1-a', sqs_score: '5', gate_result: 'open' }, { date: '2026-11-12' });
      const autre = enregistrerMetriques(d, 'specs', { spec_id: 'SPEC-001-1-ab', sqs_score: '5', gate_result: 'open' }, { date: '2026-11-12' });
      assert.deepEqual([un.valeurs.attempts, deux.valeurs.attempts, autre.valeurs.attempts], [1, 2, 1]);
      assert.equal(un.fichier, '.aiad/metrics/specs/2026-11-10-spec-001-1-a.md');
      assert.equal(parserKv(lire(d, deux.fichier)).attempts, 2);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-008 — jamais d\'écrasement : deuxième fichier du jour suffixé', () => {
    const d = projet();
    try {
      const a = enregistrerMetriques(d, 'demo', { nps_indicatif: '8' }, { date: '2026-11-15' });
      const b = enregistrerMetriques(d, 'demo', { nps_indicatif: '9' }, { date: '2026-11-15' });
      assert.deepEqual([a.fichier, b.fichier], ['.aiad/metrics/demo/2026-11-15.md', '.aiad/metrics/demo/2026-11-15-2.md']);
      assert.equal(readdirSync(join(d, '.aiad', 'metrics', 'demo')).length, 2);
      const dep = enregistrerMetriques(d, 'deployments', { status: 'hotfix', version: '1.2.0', mttr_hours: '3', mttd_hours: '1' }, { date: '2026-11-15' });
      assert.equal(dep.fichier, '.aiad/metrics/deployments/2026-11-15-1.2.0.md');
      assert.equal(parserKv(lire(d, dep.fichier)).type, 'deployment');
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('lirePaires — clé=valeur, valeur avec « = », argument illisible', () => {
    assert.deepEqual(lirePaires(['a=1', 'business_impact=x = y']).paires, { a: '1', business_impact: 'x = y' });
    assert.equal(lirePaires(['sansegal', '=vide']).erreurs.length, 2);
    assert.deepEqual(lirePaires(undefined), { paires: {}, erreurs: [] });
  });
});

describe('metrics — état de pilotage', () => {
  test('CA-009 — ce qui est enregistré remonte ; le drift tombe à mesure', async () => {
    const d = projet();
    try {
      const avant = await etatMetriques(d);
      assert.equal(avant.pilotage.drift, true);
      assert.equal(avant.pilotage.nonMesurees.length, avant.pilotage.suivies, 'projet vide : rien ne remonte');
      assert.deepEqual(avant.pilotage.rituelsJamais, ['retro', 'demo', 'sync-strat', 'tech-review']);

      const auj = new Date().toISOString().slice(0, 10);
      enregistrerMetriques(d, 'retro', { satisfaction_equipe: '8', psychological_safety: '9', temps_flow_heures: '5' }, { date: auj });
      enregistrerMetriques(d, 'specs', { spec_id: 'SPEC-001-1-a', sqs_score: '5', gate_result: 'open' }, { date: auj });
      const apres = await etatMetriques(d);
      const etat = (id) => apres.metriques.find((m) => m.id === id).etat;
      assert.deepEqual([etat('satisfaction-equipe'), etat('psychological-safety'), etat('temps-flow'), etat('first-time-success')], ['ok', 'ok', 'ok', 'ok']);
      assert.equal(apres.categories.find((c) => c.id === 'equipe').mesurees, 3);
      assert.ok(apres.pilotage.nonMesurees.length < avant.pilotage.nonMesurees.length);
      assert.equal(apres.rituels.find((r) => r.id === 'retro').etat, 'a-jour');
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-010 — CLI : record, status --json, check (exit 1 en drift), keys, erreurs', async () => {
    const d = projet();
    try {
      const run = (...args) => spawnSync(process.execPath, [BIN, 'metrics', ...args], { cwd: d, encoding: 'utf-8' });
      assert.equal(run('record', 'demo', 'nps_indicatif=9').status, 0);
      const refus = run('record', 'retro', 'turnover_pct=4');
      assert.equal(refus.status, 1);
      assert.match(refus.stderr, /donnée RH ou de santé/);
      assert.equal(run('record', 'retro', 'sansegal').status, 1);
      const etat = JSON.parse(run('status', '--json').stdout);
      assert.equal(etat.metriques.find((m) => m.id === 'satisfaction-utilisateur').etat, 'ok');
      assert.equal(run('status').status, 0, 'status informe sans échouer');
      assert.equal(run('check').status, 1, 'des métriques ne remontent pas');
      assert.match(run('keys', 'retro').stdout, /satisfaction_equipe/);
      assert.equal(run('keys', 'inconnue').status, 1);
      assert.equal(await commandeMetrics(d, 'inconnue'), 1);
      const sans = mkdtempSync(join(tmpdir(), 'aiad-metrics-'));
      assert.equal(await commandeMetrics(sans, 'status'), 1);
      rmSync(sans, { recursive: true, force: true });
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

describe('metrics — validations et périmètre (SPEC-038-2)', () => {
  test('CA-016 — validations : premier passage des agents et itérations par fonctionnalité', async () => {
    const d = projet();
    try {
      const auj = new Date().toISOString().slice(0, 10);
      enregistrerMetriques(d, 'validations', { spec_id: 'SPEC-001-1-a', verdict: 'corrections' }, { date: auj });
      const deux = enregistrerMetriques(d, 'validations', { spec_id: 'SPEC-001-1-a', verdict: 'valide' }, { date: auj });
      enregistrerMetriques(d, 'validations', { spec_id: 'SPEC-001-2-b', verdict: 'valide' }, { date: auj });
      assert.equal(deux.valeurs.attempts, 2);
      assert.equal(enregistrerMetriques(d, 'validations', { spec_id: 'SPEC-001-3-c', verdict: 'jnsp' }).ok, false);
      const e = await etatMetriques(d);
      const m = (id) => e.metriques.find((x) => x.id === id);
      // SPEC a : corrections puis validée (2 passages) ; SPEC b : validée du premier coup.
      assert.deepEqual([m('fts-agents').valeur, m('fts-agents').etat], ['50 %', 'hors-cible']);
      assert.deepEqual([m('iterations-feature').valeur, m('iterations-feature').etat], ['1,5', 'ok']);
      assert.match(m('fts-agents').source, /enregistrements \/sdd validate — 2 SPEC/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-017 — périmètre : écarter une métrique exige une raison et un auteur ; elle sort du suivi', async () => {
    const d = projet();
    try {
      assert.match(definirPerimetre(d, 'retention', {}).erreurs.join(' | '), /raison est requise.*auteur humain est requis/);
      assert.match(definirPerimetre(d, 'inconnue', { raison: 'x', auteur: 'y' }).erreurs[0], /Métrique inconnue/);
      assert.match(definirPerimetre(d, 'turnover', { raison: 'x', auteur: 'y' }).erreurs[0], /n'est pas collectée/);
      assert.equal(existsSync(join(d, '.aiad', 'metrics', 'scope.json')), false);

      const avant = (await etatMetriques(d)).pilotage.suivies;
      const r = definirPerimetre(d, 'retention', { raison: 'outil open source sans compte utilisateur', auteur: 'Ada', date: '2026-11-15' });
      assert.equal(r.ok, true);
      const e = await etatMetriques(d);
      const m = e.metriques.find((x) => x.id === 'retention');
      assert.equal(m.etat, 'non-applicable');
      assert.match(m.source, /outil open source sans compte utilisateur — décidé par Ada, 2026-11-15/);
      assert.equal(e.pilotage.suivies, avant - 1);
      assert.ok(!e.pilotage.nonMesurees.includes('retention'));

      assert.equal(definirPerimetre(d, 'retention', { inclure: true }).ok, true);
      assert.equal((await etatMetriques(d)).pilotage.suivies, avant);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-017 — CLI exclude / include ; exclusion sans auteur ignorée à la lecture', async () => {
    const d = projet();
    try {
      const run = (...args) => spawnSync(process.execPath, [BIN, 'metrics', ...args], { cwd: d, encoding: 'utf-8' });
      assert.equal(run('exclude', 'time-to-value', 'raison=pas de parcours utilisateur').status, 1, 'auteur manquant');
      assert.equal(run('exclude', 'time-to-value', 'raison=pas de parcours utilisateur', 'auteur=Ada').status, 0);
      assert.equal(run('include', 'time-to-value').status, 0);
      mkdirSync(join(d, '.aiad', 'metrics'), { recursive: true });
      writeFileSync(join(d, '.aiad', 'metrics', 'scope.json'), JSON.stringify({ non_applicables: { retention: { raison: 'sans auteur' } } }));
      assert.equal((await etatMetriques(d)).metriques.find((x) => x.id === 'retention').etat, 'non-mesure');
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});
