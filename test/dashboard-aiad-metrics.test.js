// Tests du catalogue des métriques AIAD et de leur affichage (SPEC-038-1).
//
// @spec SPEC-038-1-metriques-aiad-dashboard

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, METRIQUES, ETATS, PEREMPTION_JOURS, RITUELS, calculerMetriquesAiad, syntheseCategories, signauxImmediats, etatRituels, etatPilotage } from '../lib/dashboard/aiad-metrics.js';
import { pageScorecard, blocSyntheseMetriques, blocMetriquesRole } from '../lib/dashboard/views/scorecard.js';
import { listerAlertes } from '../lib/dashboard/views/overview.js';
import { ONGLETS } from '../lib/dashboard/navigation.js';

const GENERE = '2026-11-15T12:00:00.000Z';
const fichier = (nom, data) => ({ nom, file: `.aiad/metrics/x/${nom}`, mtime: 0, data });

/** Données avec des fichiers de métriques par catégorie. */
function donnees(cats = {}, extra = {}) {
  const categories = {};
  for (const c of ['deployments', 'specs', 'standup', 'drift', 'retro', 'demo', 'sync-strat', 'tech-review', 'security', 'audit']) {
    categories[c] = { categorie: c, dir: null, fichiers: cats[c] || [] };
  }
  return {
    projet: { nom: 'App', genere: GENERE, racine: '/nulle/part' },
    specs: [], intents: [], facts: [], gouvernance: [],
    matrice: { gaps: { specsValideesNonImplementees: [] } },
    metrics: { categories, agregats: { deployments: {}, specs: { sqsMoyen: null }, standup: {}, drift: { driftsDetectes: 0, driftsResolus: 0 } } },
    ...extra,
  };
}
const par = (resultats, id) => resultats.find((r) => r.id === id);

describe('métriques AIAD — catalogue', () => {
  test('CA-001 — les cinq catégories du framework, puis DORA et Flow, chacune rattachée à un onglet', () => {
    assert.deepEqual(CATEGORIES.map((c) => c.id), ['productivite', 'qualite', 'efficacite-ia', 'outcomes', 'equipe', 'dora', 'flow']);
    const onglets = ONGLETS.map((o) => o.id);
    for (const c of CATEGORIES) assert.ok(onglets.includes(c.onglet), `${c.id} → onglet ${c.onglet}`);
    assert.deepEqual(Object.fromEntries(CATEGORIES.map((c) => [c.id, c.onglet])),
      { productivite: 'pe', qualite: 'qa', 'efficacite-ia': 'ae', outcomes: 'pm', equipe: 'global', dora: 'tl', flow: 'tl' });
  });

  test('CA-002 — nombre de métriques par catégorie conforme au framework (§ 7.1 à 7.5, 7.7)', () => {
    const n = (cat) => METRIQUES.filter((m) => m.cat === cat).length;
    assert.deepEqual([n('productivite'), n('qualite'), n('efficacite-ia'), n('outcomes'), n('equipe'), n('dora'), n('flow')], [5, 6, 7, 6, 5, 4, 5]);
    const ids = METRIQUES.map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
    for (const m of METRIQUES) {
      assert.ok(m.label && m.cible && m.frequence && m.alimenter, `${m.id} : libellé, cible, fréquence, alimentation`);
      assert.ok(['hebdo', 'mensuel', 'annuel', 'feature'].includes(m.frequence), `${m.id} : fréquence connue`);
    }
  });

  test('CA-003 — sans donnée : tout est « non mesuré », rien n\'est supposé', () => {
    for (const d of [donnees(), {}, undefined]) {
      const r = calculerMetriquesAiad(d);
      assert.equal(r.length, METRIQUES.length);
      const etats = new Set(r.map((x) => x.etat));
      assert.deepEqual([...etats].sort(), ['hors-dashboard', 'non-mesure']);
      assert.ok(r.every((x) => x.valeur === null));
      assert.ok(r.every((x) => ETATS.includes(x.etat)));
    }
  });

  test('CA-004 — turnover et jours de maladie : jamais collectés', () => {
    const d = donnees({ retro: [fichier('2026-11-10.md', { turnover_pct: 5, sick_days: 3, turnover: 5 })] });
    const r = calculerMetriquesAiad(d);
    for (const id of ['turnover', 'sick-days']) {
      assert.equal(par(r, id).etat, 'hors-dashboard');
      assert.equal(par(r, id).valeur, null);
    }
    assert.equal(syntheseCategories(r).find((c) => c.id === 'equipe').total, 3, 'hors dashboard : exclues du total suivi');
  });
});

describe('métriques AIAD — calcul', () => {
  test('CA-005 — productivité et DORA depuis les déploiements', () => {
    const d = donnees({ deployments: [
      fichier('2026-09-20-a.md', { status: 'success', cycle_time_days: 2, lead_time_days: 10 }),
      fichier('2026-10-01-b.md', { status: 'success', cycle_time_days: 2, lead_time_days: 12 }),
      fichier('2026-10-25-c.md', { status: 'hotfix', cycle_time_days: 1, lead_time_days: 8, mttr_hours: 3, mttd_hours: 30 }),
      fichier('2026-11-05-d.md', { status: 'success', cycle_time_days: 3, lead_time_days: 10 }),
      fichier('2026-11-12-e.md', { status: 'success', cycle_time_days: 2, lead_time_days: 10 }),
    ] });
    const r = calculerMetriquesAiad(d);
    assert.deepEqual([par(r, 'cycle-time').valeur, par(r, 'cycle-time').etat], [2, 'ok']);
    assert.deepEqual([par(r, 'lead-time').valeur, par(r, 'lead-time').etat], [10, 'ok']);
    // 30 derniers jours : d, e réussis (c est un correctif) ; 30 jours d'avant : a, b.
    assert.deepEqual([par(r, 'throughput').valeur, par(r, 'throughput').precedent, par(r, 'throughput').etat], [2, 2, 'ok']);
    assert.equal(par(r, 'deploy-success').texte, '80 %');
    assert.equal(par(r, 'deploy-success').etat, 'hors-cible');
    assert.equal(par(r, 'release-frequency').etat, 'mesure', 'cible non chiffrée : valeur informative');
    assert.deepEqual([par(r, 'dora-cfr').valeur, par(r, 'dora-cfr').etat], [20, 'hors-cible']);
    assert.deepEqual([par(r, 'dora-mttr').valeur, par(r, 'dora-mttr').etat], [3, 'ok']);
    // Sans incident : l'information est « aucun incident », pas « non mesuré ».
    const sansIncident = calculerMetriquesAiad(donnees({ deployments: [fichier('2026-11-12-e.md', { status: 'success' })] }));
    assert.deepEqual([par(sansIncident, 'mttr').texte, par(sansIncident, 'mttr').etat, par(sansIncident, 'mttd').etat], ['aucun incident', 'mesure', 'mesure']);
    assert.deepEqual([par(r, 'mttd').valeur, par(r, 'mttd').etat], [30, 'hors-cible']);
    assert.equal(par(r, 'flow-cycle-time').valeur, par(r, 'cycle-time').valeur);
    assert.equal(par(r, 'flow-efficiency').texte, '19,8 %', 'moyenne des ratios cycle / lead par déploiement');
  });

  test('CA-005 — Flow Efficiency : rapport des moyennes à défaut ; anomalie signalée ; non mesurée sans les deux durées', () => {
    const moyennes = donnees({ deployments: [fichier('2026-11-01-a.md', { status: 'success', cycle_time_days: 2 }), fichier('2026-11-02-b.md', { status: 'success', lead_time_days: 8 })] });
    assert.equal(par(calculerMetriquesAiad(moyennes), 'flow-efficiency').texte, '25 %');
    const incoherent = donnees({ deployments: [fichier('2026-11-01-a.md', { status: 'success', cycle_time_days: 80 }), fichier('2026-11-02-b.md', { status: 'success', lead_time_days: 4 })] });
    const fe = par(calculerMetriquesAiad(incoherent), 'flow-efficiency');
    assert.equal(fe.etat, 'hors-cible');
    assert.match(fe.texte, /incohérent — Cycle Time moyen \(80 j\) supérieur au Lead Time moyen \(4 j\)/);
    const sans = donnees({ deployments: [fichier('2026-11-01-a.md', { status: 'success', cycle_time_days: 80 })] });
    assert.equal(par(calculerMetriquesAiad(sans), 'flow-efficiency').etat, 'non-mesure');
  });

  test('CA-006 — seuils stricts : une valeur égale à la cible n\'est pas « dans la cible »', () => {
    const d = donnees({ deployments: [fichier('2026-11-01-a.md', { status: 'success', cycle_time_days: 3, lead_time_days: 14 })] });
    const r = calculerMetriquesAiad(d);
    assert.equal(par(r, 'cycle-time').etat, 'hors-cible', '< 3 jours');
    assert.equal(par(r, 'lead-time').etat, 'hors-cible', '< 2 semaines');
  });

  test('CA-007 — métriques déclarées en rétrospective : dernière valeur, null ignoré', () => {
    const d = donnees({ retro: [
      fichier('2026-10-15.md', { adoption_agents_pct: 70, satisfaction_equipe: 6, taux_premier_passage: 60 }),
      fichier('2026-11-12.md', { adoption_agents_pct: 95, satisfaction_equipe: 'null', taux_premier_passage: 75, iterations_par_feature: 2.5, satisfaction_pe: 8 }),
    ] });
    const r = calculerMetriquesAiad(d);
    assert.deepEqual([par(r, 'adoption-agents').valeur, par(r, 'adoption-agents').etat], [95, 'ok']);
    assert.equal(par(r, 'satisfaction-equipe').valeur, 6, 'un null ne remplace pas la dernière valeur déclarée');
    // … mais cette valeur date de 31 jours pour une métrique hebdomadaire : elle est à rafraîchir.
    assert.equal(par(r, 'satisfaction-equipe').etat, 'perimee');
    assert.equal(par(r, 'fts-agents').etat, 'ok');
    assert.equal(par(r, 'iterations-feature').texte, '2,5');
    assert.equal(par(r, 'satisfaction-pe').etat, 'hors-cible', '> 8 est strict');
    assert.equal(par(r, 'faux-positifs').etat, 'non-mesure');
  });

  test('CA-008 — tendances : comparées à la période précédente, « mesuré » sans antécédent', () => {
    const unSeul = donnees({ 'tech-review': [fichier('2026-11-01.md', { dette_items_count: 8 })] });
    assert.equal(par(calculerMetriquesAiad(unSeul), 'dette').etat, 'mesure');
    const hausse = donnees({ 'tech-review': [fichier('2026-10-01.md', { dette_items_count: 5 }), fichier('2026-11-01.md', { dette_items_count: 8 })] });
    assert.equal(par(calculerMetriquesAiad(hausse), 'dette').etat, 'hors-cible');
    const facts = donnees({}, { facts: [{ date: '2026-06-01' }, { date: '2026-06-20' }, { date: '2026-11-01' }] });
    const bugs = par(calculerMetriquesAiad(facts), 'bugs-prod');
    assert.deepEqual([bugs.valeur, bugs.precedent, bugs.etat], [1, 2, 'ok']);
  });

  test('CA-009 — qualité et outcomes : couverture, premier passage à la Gate, critères du PRD, NPS', () => {
    const d = donnees({
      specs: [fichier('2026-11-01-a.md', { attempts: 1 }), fichier('2026-11-02-b.md', { attempts: 2 }), fichier('2026-11-03-c.md', { attempts: 1 }), fichier('2026-11-04-d.md', { attempts: 1 })],
      demo: [fichier('2026-11-08.md', { nps_indicatif: 'non mesuré' }), fichier('2026-11-14.md', { nps_indicatif: 9 })],
      'sync-strat': [fichier('2026-11-10.md', { adoption_pct: 40, business_impact: '+12 % de devis signés' })],
    }, { couverture: { pct: 84.2, source: 'coverage/coverage-summary.json' }, outcomes: { criteres: [{ actuel: '3h', etat: 'ok' }, { actuel: '10', etat: 'bad' }, { actuel: null, etat: 'unknown' }] } });
    const r = calculerMetriquesAiad(d);
    assert.deepEqual([par(r, 'couverture').texte, par(r, 'couverture').etat], ['84,2 %', 'ok']);
    assert.deepEqual([par(r, 'first-time-success').valeur, par(r, 'first-time-success').etat], [75, 'ok']);
    assert.deepEqual([par(r, 'outcome-criteria').valeur, par(r, 'outcome-criteria').etat], [50, 'hors-cible']);
    assert.deepEqual([par(r, 'satisfaction-utilisateur').valeur, par(r, 'satisfaction-utilisateur').etat], [9, 'ok']);
    assert.equal(par(r, 'adoption-fonctionnalite').etat, 'hors-cible');
    assert.deepEqual([par(r, 'business-impact').texte, par(r, 'business-impact').etat], ['+12 % de devis signés', 'mesure']);
  });

  test('CA-010 — synthèse par catégorie', () => {
    const d = donnees({ deployments: [fichier('2026-11-12-e.md', { status: 'success', cycle_time_days: 5, lead_time_days: 10 })] });
    const s = syntheseCategories(calculerMetriquesAiad(d));
    const prod = s.find((c) => c.id === 'productivite');
    // Dans la cible : Lead Time, Throughput (1 contre 0), Success Rate. Hors cible : Cycle Time. Informative : Release Frequency.
    assert.deepEqual([prod.total, prod.mesurees, prod.ok, prod.horsCible], [5, 5, 3, 1]);
    assert.deepEqual(s.find((c) => c.id === 'efficacite-ia').mesurees, 0);
  });

  test('CA-011 — les trois signaux d\'action immédiate du framework', () => {
    assert.deepEqual(signauxImmediats(donnees()), []);
    const d = donnees({ deployments: [
      fichier('2026-10-01-a.md', { status: 'success', cycle_time_days: 2 }), fichier('2026-10-08-b.md', { status: 'success', cycle_time_days: 2 }),
      fichier('2026-11-01-c.md', { status: 'hotfix', cycle_time_days: 4 }), fichier('2026-11-08-d.md', { status: 'success', cycle_time_days: 5 }),
    ] });
    d.metrics.agregats.specs.sqsMoyen = 3.2;
    assert.deepEqual(signauxImmediats(d).map((s) => s.id), ['cycle-time-double', 'sqs-faible', 'cfr-eleve']);
    const alertes = listerAlertes(d).filter((a) => a.cible === 'scorecard.html' && a.gravite === 'bad');
    assert.equal(alertes.length, 3);
    // Pas de signal sur trop peu de déploiements.
    const peu = donnees({ deployments: [fichier('2026-10-01-a.md', { status: 'success', cycle_time_days: 1 }), fichier('2026-11-01-b.md', { status: 'success', cycle_time_days: 9 })] });
    assert.deepEqual(signauxImmediats(peu), []);
  });
});

describe('métriques AIAD — affichage', () => {
  const d = donnees({
    deployments: [fichier('2026-11-12-e.md', { status: 'success', cycle_time_days: 5, lead_time_days: 10 })],
    retro: [fichier('2026-11-12.md', { adoption_agents_pct: 95 })],
  });

  test('CA-012 — page : toutes les métriques, par catégorie, avec cible et état', () => {
    const html = pageScorecard(d);
    for (const c of CATEGORIES) assert.ok(html.includes(`<section id="${c.id}">`), `section ${c.id}`);
    assert.equal((html.match(/<tr data-freq=/g) || []).length, METRIQUES.length);
    assert.match(html, /Cycle Time<\/strong><\/td><td>5 j<\/td><td>&lt; 3 jours<\/td><td><span class="badge badge-bad">hors cible/);
    assert.match(html, /badge-ok">dans la cible/);
    // Non mesurée : pas de valeur, mais la façon de l'alimenter.
    assert.match(html, /Psychological Safety<\/strong><div class="muted"><code>npx aiad-sdd metrics record retro psychological_safety=…<\/code>/);
    assert.match(html, /Rituels qui alimentent les métriques/);
    assert.match(html, /Turnover<\/strong><div class="muted">donnée RH — suivie hors du dashboard/);
    assert.match(html, /Aucun des trois signaux n'est déclenché/);
    assert.match(html, /data-lens="hebdo"/);
  });

  test('CA-012 — page : données vides ou absentes tolérées', () => {
    for (const x of [donnees(), {}]) {
      const html = pageScorecard(x);
      assert.match(html, /non mesuré/);
      assert.ok(!html.includes('badge-ok">dans la cible'));
    }
  });

  test('CA-013 — synthèse de la vue d\'ensemble : une carte par catégorie, liée à sa section', () => {
    const html = blocSyntheseMetriques(d);
    for (const c of CATEGORIES) assert.ok(html.includes(`href="scorecard.html#${c.id}"`));
    assert.match(html, /Productivité<\/div><div class="pipe-n">5<small> \/ 5<\/small>/);
    assert.match(html, /non mesuré/);
  });

  test('CA-014 — cockpit : seulement les métriques de la responsabilité', () => {
    const pe = blocMetriquesRole(d, 'pe');
    assert.match(pe, /Vos métriques AIAD/);
    assert.ok(pe.includes('Cycle Time') && !pe.includes('Psychological Safety') && !pe.includes("Taux d'adoption"));
    const ae = blocMetriquesRole(d, 'ae');
    assert.ok(ae.includes('Taux d&#39;adoption des agents') || ae.includes("Taux d'adoption des agents"));
    const tl = blocMetriquesRole(d, 'tl');
    assert.ok(tl.includes('Change Failure Rate') && tl.includes('Flow Efficiency'));
    assert.match(blocMetriquesRole(d, 'pm'), /Atteinte des Outcome Criteria/);
    assert.match(blocMetriquesRole(d, 'qa'), /Couverture de tests/);
    assert.equal(blocMetriquesRole(d, 'inconnu'), '');
  });

  test('CA-015 — contenu des fichiers de métriques échappé', () => {
    const x = donnees({ 'sync-strat': [fichier('2026-11-10.md', { business_impact: '<img src=x onerror=alert(1)>' })] });
    const html = pageScorecard(x);
    assert.ok(!html.includes('<img src=x'));
    assert.match(html, /&lt;img src=x/);
  });
});

describe('métriques AIAD — instrumentation et fraîcheur (SPEC-038-2)', () => {
  test('CA-011 — mesuré sur git avant d\'être déclaré ; la source est indiquée', () => {
    const d = donnees({ retro: [fichier('2026-11-12.md', { adoption_agents_pct: 50, code_genere_pct: 40 })] },
      { activiteGit: { jours: 30, commits: 10, commitsAgent: 9, lignes: 1000, lignesAgent: 850 } });
    const r = calculerMetriquesAiad(d);
    assert.deepEqual([par(r, 'adoption-agents').valeur, par(r, 'adoption-agents').etat], [90, 'hors-cible']);
    assert.match(par(r, 'adoption-agents').source, /git — 9\/10 commits co-signés par un agent, 30 j/);
    assert.deepEqual([par(r, 'code-genere').valeur, par(r, 'code-genere').etat], [85, 'ok']);
    // Sans git : la valeur déclarée en rétrospective.
    const declare = calculerMetriquesAiad(donnees({ retro: [fichier('2026-11-12.md', { adoption_agents_pct: 95 })] }));
    assert.deepEqual([par(declare, 'adoption-agents').valeur, par(declare, 'adoption-agents').source], [95, 'déclaré — retro']);
  });

  test('CA-012 — dette : instantanés du dashboard, tendance sur le précédent', () => {
    const d = donnees({ 'tech-review': [fichier('2026-11-01.md', { dette_items_count: 40 })] }, { detteHistorique: [{ date: '2026-10-01', total: 2 }, { date: '2026-11-15', total: 5 }] });
    const dette = par(calculerMetriquesAiad(d), 'dette');
    assert.deepEqual([dette.valeur, dette.precedent, dette.etat], [5, 2, 'hors-cible']);
    assert.match(dette.source, /instantané du 2026-11-15/);
  });

  test('CA-013 — valeur déclarée trop ancienne : « à rafraîchir »', () => {
    assert.deepEqual(PEREMPTION_JOURS, { hebdo: 14, mensuel: 62, feature: 62, annuel: 730 });
    const d = donnees({ retro: [fichier('2026-10-20.md', { satisfaction_equipe: 9, satisfaction_pe: 9 })] });
    const r = calculerMetriquesAiad(d);
    // Satisfaction équipe est hebdomadaire : 26 jours > 14. Satisfaction PE est mensuelle : 26 jours ≤ 62.
    assert.deepEqual([par(r, 'satisfaction-equipe').etat, par(r, 'satisfaction-equipe').age], ['perimee', 26]);
    assert.equal(par(r, 'satisfaction-pe').etat, 'ok');
    assert.equal(syntheseCategories(r).find((c) => c.id === 'equipe').perimees, 1);
    assert.match(pageScorecard(d), /badge-warn">à rafraîchir/);
  });

  test('CA-014 — rituels : jamais tenu, à jour, en retard', () => {
    assert.deepEqual(RITUELS.map((r) => [r.id, r.cadence]), [['retro', 21], ['demo', 14], ['sync-strat', 35], ['tech-review', 35]]);
    const d = donnees({ retro: [fichier('2026-11-10.md', { specs_livrees: 2 })], demo: [fichier('2026-10-20.md', { nps_indicatif: 8 })] });
    const e = Object.fromEntries(etatRituels(d).map((r) => [r.id, [r.etat, r.joursDepuis]]));
    assert.deepEqual(e, { retro: ['a-jour', 5], demo: ['en-retard', 26], 'sync-strat': ['jamais', null], 'tech-review': ['jamais', null] });
    assert.deepEqual(etatRituels({}).map((r) => r.etat), ['jamais', 'jamais', 'jamais', 'jamais']);
  });

  test('CA-015 — pilotage : drift tant qu\'une métrique ne remonte pas ; alertes correspondantes', () => {
    const d = donnees({ demo: [fichier('2026-10-20.md', { nps_indicatif: 8 })] });
    const p = etatPilotage(d);
    assert.equal(p.drift, true);
    assert.equal(p.suivies, 36);
    assert.ok(p.nonMesurees.includes('satisfaction-equipe') && !p.nonMesurees.includes('satisfaction-utilisateur'));
    assert.deepEqual(p.rituelsEnRetard, ['demo']);
    const titres = listerAlertes(d).filter((a) => a.cible.startsWith('scorecard.html')).map((a) => a.titre);
    assert.ok(titres.some((t) => /métrique\(s\) AIAD ne remontent pas/.test(t)));
    assert.ok(titres.includes('Demo & Feedback en retard'));
    // Données non collectées (jeu partiel) : aucune alerte de pilotage.
    assert.deepEqual(listerAlertes({ specs: [], facts: [], intents: [], gouvernance: [], matrice: { gaps: { specsValideesNonImplementees: [] } }, metrics: { agregats: { drift: { driftsDetectes: 0, driftsResolus: 0 } } } }), []);
  });
});
