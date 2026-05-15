// Tests unitaires des pages de rendu du dashboard.
// Cible #136 : honnêteté DORA — pas de cadrans vides quand aucune donnée.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { pageMetrics, pageOverview, listerAlertes, freshnessBadge, blocQueueQa, kpiSbom, kpiSovereignty, kpiHookStats, kpiViolations, lienSource, setSourceBase, hrefSource, pageTraceability, pageChangelog } from '../lib/dashboard/render.js';

function donneesVides() {
  return {
    projet: { nom: 'demo' },
    fondamentaux: [
      { nom: 'PRD.md', present: true, rempli: true, tailleKo: 1 },
      { nom: 'ARCHITECTURE.md', present: true, rempli: true, tailleKo: 1 },
      { nom: 'AGENT-GUIDE.md', present: true, rempli: true, tailleKo: 1 },
    ],
    intents: [],
    specs: [],
    gouvernance: [],
    facts: [],
    changelog: { entrees: [], file: null },
    maturite: { score: 3, total: 5, label: 'Opérationnel', cls: 'maturite-info' },
    matrice: { forward: {}, backward: {}, gaps: { intentsSansSpec: [], specsSansCode: [], specsValideesNonImplementees: [], specsOrphelinsSurCode: [], intentsOrphelinsSurCode: [], codeSansSpec: [], codeSansTests: [] }, stats: { intents: 0, specs: 0, codeFiles: 0 } },
    metrics: {
      categories: {
        deployments: { categorie: 'deployments', dir: '.aiad/metrics/deployments', fichiers: [] },
        specs: { categorie: 'specs', dir: '.aiad/metrics/specs', fichiers: [] },
        standup: { categorie: 'standup', dir: '.aiad/metrics/standup', fichiers: [] },
        drift: { categorie: 'drift', dir: '.aiad/metrics/drift', fichiers: [] },
        retro: { categorie: 'retro', dir: '.aiad/metrics/retro', fichiers: [] },
        demo: { categorie: 'demo', dir: '.aiad/metrics/demo', fichiers: [] },
        'sync-strat': { categorie: 'sync-strat', dir: '.aiad/metrics/sync-strat', fichiers: [] },
        'tech-review': { categorie: 'tech-review', dir: '.aiad/metrics/tech-review', fichiers: [] },
        security: { categorie: 'security', dir: '.aiad/metrics/security', fichiers: [] },
        audit: { categorie: 'audit', dir: '.aiad/metrics/audit', fichiers: [] },
      },
      agregats: {
        deployments: { total: 0, success: 0, hotfix: 0, cycleTimeMoyen: null, leadTimeMoyen: null },
        specs: { total: 0, sqsMoyen: null, gateFirstPass: 0 },
        standup: { total: 0, wipMoyen: null },
        drift: { total: 0, driftsDetectes: 0, driftsResolus: 0 },
      },
    },
  };
}

test('pageMetrics — DORA vide → bannière + guide, pas de cadrans —', () => {
  // Force totalAvecMetrics > 0 sinon l'early-return masque le test.
  const d = donneesVides();
  d.metrics.categories.security.fichiers.push({ nom: 'sec.md', file: '.aiad/metrics/security/sec.md', mtime: Date.now(), data: { score: 8 } });
  const html = pageMetrics(d);
  assert.match(html, /Données DORA absentes/);
  assert.match(html, /aiad dora/);
  assert.match(html, /aiad\.ovh\/docs\/dora-format/);
  // Aucun cadran fantôme : pas de `<div class="kpi">` dans la section DORA
  const sectionDora = html.split('<h2>DORA</h2>')[1].split('<section>')[0];
  assert.ok(!sectionDora.includes('<div class="kpi">'), 'Pas de cadran KPI dans DORA quand vide');
  assert.ok(!sectionDora.includes('class="kpis"'), 'Pas de grille KPI dans DORA quand vide');
});

// (#349) Metrics tableauCats : filename hyperlié vers la source
test('#349 pageMetrics — fichier de catégorie hyperlié via lienSource (f.file)', () => {
  setSourceBase('');
  const d = donneesVides();
  d.metrics.categories.security.fichiers.push({
    nom: 'sec-2026-05-14.md',
    file: '.aiad/metrics/security/sec-2026-05-14.md',
    mtime: Date.now(),
    data: { score: 8 },
  });
  const html = pageMetrics(d);
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/metrics\/security\/sec-2026-05-14\.md"[^>]*>sec-2026-05-14\.md<\/a>/);
});

test('pageMetrics — Flow & Qualité vide → bannière dédiée', () => {
  const d = donneesVides();
  // Ajout d'un fichier audit pour passer l'early-return globale
  d.metrics.categories.audit.fichiers.push({ nom: 'a.md', file: '.aiad/metrics/audit/a.md', mtime: Date.now(), data: { verdict: 'pass' } });
  const html = pageMetrics(d);
  assert.match(html, /Données Flow & Qualité absentes/);
  assert.match(html, /aiad standup/);
  assert.match(html, /aiad\.ovh\/docs\/flow-format/);
  const sectionFlow = html.split('Flow &amp; Qualité')[1] || html.split('Flow & Qualité')[1] || '';
  const sectionFlowSliced = sectionFlow.split('<section>')[0];
  assert.ok(!sectionFlowSliced.includes('<div class="kpi">'), 'Pas de cadran KPI dans Flow quand vide');
});

test('pageMetrics — données DORA présentes → KPI rendus, pas de bannière', () => {
  const d = donneesVides();
  d.metrics.categories.deployments.fichiers.push({
    nom: '2026-05-12-deploy-01.md',
    file: '.aiad/metrics/deployments/2026-05-12-deploy-01.md',
    mtime: Date.now(),
    data: { status: 'success', cycle_time_days: 3.5, lead_time_days: 7 },
  });
  d.metrics.agregats.deployments = { total: 1, success: 1, hotfix: 0, cycleTimeMoyen: 3.5, leadTimeMoyen: 7 };
  const html = pageMetrics(d);
  assert.ok(!html.includes('Données DORA absentes'), 'Pas de bannière quand des deploys existent');
  assert.match(html, /Cycle Time moyen/);
  assert.match(html, /Change Failure Rate/);
});

test('pageMetrics — totalAvecMetrics = 0 → message global (pas de bannières DORA/Flow séparées)', () => {
  const d = donneesVides();
  const html = pageMetrics(d);
  // (#181) le message reformulé garde "Aucune autre donnée…"
  assert.match(html, /Aucune autre donnée métrique persistée/);
  assert.ok(!html.includes('Données DORA absentes'));
});

// (#181) Quand un projet n'a aucune métrique persistée mais a quand même
// des Intents/SPECs et signaux.leadership, le bloc Leadership doit
// s'afficher avant le message "Aucune autre donnée".
test('pageMetrics — leadership visible même quand totalAvecMetrics === 0 (#181)', () => {
  const d = donneesVides();
  d.signaux = { leadership: {
    humanAuthorshipRatio: { ratio: 0.8, sufficient: 8, total: 10 },
    governanceCoverage: { ratio: null, sensitiveFiles: 0, governedFiles: 0 },
    traceCompleteness: { ratio: 0.5, complete: 5, total: 10 },
    langueArtefacts: { fr: 5, en: 0, mixed: 0, neutral: 0 },
  } };
  const html = pageMetrics(d);
  // Leadership rendu malgré l'early-return
  assert.match(html, /Leadership EU\/FR/);
  assert.match(html, /Human Authorship/);
  assert.match(html, /<div class="value">80%/);
  // Message d'invitation à alimenter DORA/Flow reste présent
  assert.match(html, /Aucune autre donnée métrique persistée/);
});

test('pageMetrics — sans leadership ET sans métriques → uniquement message "Aucune"', () => {
  const html = pageMetrics(donneesVides());
  // Sans signaux.leadership, le bloc Leadership est vide (sa propre garde)
  // donc on ne voit que le message "Aucune autre…"
  assert.match(html, /Aucune autre donnée métrique persistée/);
  // Pas de section Leadership rendue
  assert.ok(!html.includes('Leadership EU/FR'));
});

// ─── Alertes legal (#153 / #165) ─────────────────────────────────────────────

function donneesPourAlertes(supp = {}, legalPacks = []) {
  return {
    specs: [], facts: [], intents: [], gouvernance: [],
    matrice: { gaps: { specsValideesNonImplementees: [] } },
    metrics: { agregats: { drift: { driftsDetectes: 0, driftsResolus: 0 } } },
    supplementaire: supp,
    legalPacks,
  };
}

test('listerAlertes — DPIA incomplet 1..10 → alerte warn legal.html (#153/#167)', () => {
  const d = donneesPourAlertes({
    dpia: { latest: { nom: 'DPIA-2026-05-13', sectionsCount: 7, aCompleter: 3 } },
  });
  const a = listerAlertes(d);
  const dpiaAlerte = a.find((x) => x.titre.startsWith('DPIA incomplet'));
  assert.ok(dpiaAlerte, 'alerte DPIA absente');
  assert.equal(dpiaAlerte.cible, 'legal.html');
  assert.equal(dpiaAlerte.gravite, 'warn');
});

test('listerAlertes — DPIA > 10 sections à compléter → bad (#167)', () => {
  const d = donneesPourAlertes({
    dpia: { latest: { nom: 'DPIA-X', sectionsCount: 20, aCompleter: 15 } },
  });
  const a = listerAlertes(d);
  const dpiaAlerte = a.find((x) => x.titre.startsWith('DPIA incomplet'));
  assert.equal(dpiaAlerte.gravite, 'bad');
  assert.match(dpiaAlerte.detail, /chantier DPO conséquent/);
  assert.match(dpiaAlerte.action, /priorité/);
});

test('listerAlertes — DPIA complet (aCompleter 0) → pas d\'alerte', () => {
  const d = donneesPourAlertes({
    dpia: { latest: { nom: 'DPIA-2026-05-13', sectionsCount: 7, aCompleter: 0 } },
  });
  assert.ok(!listerAlertes(d).some((x) => x.titre.startsWith('DPIA incomplet')));
});

test('listerAlertes — AI Act 1..6 placeholders → warn (#153/#167)', () => {
  const d = donneesPourAlertes({
    aiAct: { latest: { nom: 'AUDIT-2026-05-13', sectionsCount: 8, aCompleter: 4 } },
  });
  const a = listerAlertes(d);
  const act = a.find((x) => x.titre.startsWith('AI Act Annexe IV'));
  assert.ok(act);
  assert.equal(act.cible, 'legal.html');
  assert.equal(act.gravite, 'warn');
});

test('listerAlertes — AI Act > 6 placeholders → bad avec message bloquant (#167)', () => {
  const d = donneesPourAlertes({
    aiAct: { latest: { nom: 'AUDIT-X', sectionsCount: 8, aCompleter: 7 } },
  });
  const a = listerAlertes(d);
  const act = a.find((x) => x.titre.startsWith('AI Act Annexe IV'));
  assert.equal(act.gravite, 'bad');
  assert.match(act.detail, /risque conformité élevé/);
  assert.match(act.action, /mise sur le marché EU bloquée/);
});

test('listerAlertes — combinaison à risque AI Act incomplet + pack eu-financial → alerte bad (#165)', () => {
  const d = donneesPourAlertes({
    aiAct: { latest: { nom: 'AUDIT-X', sectionsCount: 8, aCompleter: 6 } },
  }, [{ id: 'eu-financial', agents: ['AIAD-DORA'], file: '.aiad/gouvernance-packs/eu-financial' }]);
  const a = listerAlertes(d);
  const risque = a.find((x) => x.titre.startsWith('Risque conformité EU élevé'));
  assert.ok(risque, 'alerte combinée absente');
  assert.equal(risque.gravite, 'bad');
  assert.match(risque.titre, /eu-financial/);
});

test('listerAlertes — pack eu-platforms ET aCompleter > 5 → alerte croisée (#165)', () => {
  const d = donneesPourAlertes({
    aiAct: { latest: { nom: 'X', sectionsCount: 8, aCompleter: 8 } },
  }, [{ id: 'eu-platforms', agents: ['AIAD-DSA'], file: '.aiad/gouvernance-packs/eu-platforms' }]);
  const a = listerAlertes(d);
  assert.ok(a.some((x) => x.titre.startsWith('Risque conformité EU élevé')));
});

test('listerAlertes — pack EU mais aCompleter ≤ 5 → pas d\'alerte croisée', () => {
  const d = donneesPourAlertes({
    aiAct: { latest: { nom: 'X', sectionsCount: 8, aCompleter: 3 } },
  }, [{ id: 'eu-financial', agents: ['AIAD-DORA'], file: '.aiad/gouvernance-packs/eu-financial' }]);
  assert.ok(!listerAlertes(d).some((x) => x.titre.startsWith('Risque conformité EU élevé')));
});

test('listerAlertes — aCompleter > 5 mais pack EU absent → pas d\'alerte croisée', () => {
  const d = donneesPourAlertes({
    aiAct: { latest: { nom: 'X', sectionsCount: 8, aCompleter: 8 } },
  }, [{ id: 'fr-anssi', agents: ['AIAD-RGS'], file: '.aiad/gouvernance-packs/fr-anssi' }]);
  assert.ok(!listerAlertes(d).some((x) => x.titre.startsWith('Risque conformité EU élevé')));
});

// (#168) Quand on dépasse 5 alertes, le rendu repliable activé
function donneesAvecNAlertes(n, gravite = 'warn') {
  // Génère des facts majeurs/critiques (selon gravite) pour produire N alertes.
  // listerAlertes en émet 1 par fact ouvert.
  return {
    specs: [], intents: [], gouvernance: [],
    matrice: { gaps: { specsValideesNonImplementees: [] } },
    metrics: { agregats: { drift: { driftsDetectes: 0, driftsResolus: 0 } } },
    facts: Array.from({ length: n }, (_, i) => ({
      id: `FACT-${i + 1}`,
      titre: `Fact ${i + 1}`,
      statut: 'open',
      gravite: gravite === 'bad' ? 'critical' : 'major',
    })),
  };
}

test('pageOverview — 6 alertes warn → 5 visibles + 1 repliée dans <details>', () => {
  const html = pageOverview({
    ...donneesAvecNAlertes(6, 'warn'),
    projet: { nom: 'demo' },
    fondamentaux: [
      { nom: 'PRD.md', present: true, rempli: true, tailleKo: 1 },
      { nom: 'ARCHITECTURE.md', present: true, rempli: true, tailleKo: 1 },
      { nom: 'AGENT-GUIDE.md', present: true, rempli: true, tailleKo: 1 },
    ],
    maturite: { score: 3, total: 5, label: 'Op', cls: 'maturite-info' },
    matrice: { forward: [], backward: [], gaps: { intentsSansSpec: [], specsSansCode: [], specsValideesNonImplementees: [], specsOrphelinsSurCode: [], intentsOrphelinsSurCode: [], codeSansSpec: [], codeSansTests: [] }, stats: { intents: 0, specs: 0, codeFiles: 0 } },
    facts: Array.from({ length: 6 }, (_, i) => ({ id: `FACT-${i + 1}`, titre: `Fact ${i + 1}`, statut: 'open', gravite: 'major' })),
    changelog: { entrees: [] },
    specs: [],
  });
  assert.match(html, /Alertes <span class="count">6 signal\(s\)/);
  assert.match(html, /<details/);
  assert.match(html, /\+ 1 autre\(s\) alerte\(s\)/);
});

test('pageOverview — ≤ 5 alertes → pas de <details> (rendu direct)', () => {
  const html = pageOverview({
    projet: { nom: 'demo' },
    fondamentaux: [
      { nom: 'PRD.md', present: true, rempli: true, tailleKo: 1 },
      { nom: 'ARCHITECTURE.md', present: true, rempli: true, tailleKo: 1 },
      { nom: 'AGENT-GUIDE.md', present: true, rempli: true, tailleKo: 1 },
    ],
    maturite: { score: 3, total: 5, label: 'Op', cls: 'maturite-info' },
    matrice: { forward: [], backward: [], gaps: { intentsSansSpec: [], specsSansCode: [], specsValideesNonImplementees: [], specsOrphelinsSurCode: [], intentsOrphelinsSurCode: [], codeSansSpec: [], codeSansTests: [] }, stats: { intents: 0, specs: 0, codeFiles: 0 } },
    facts: Array.from({ length: 3 }, (_, i) => ({ id: `FACT-${i + 1}`, titre: `Fact ${i + 1}`, statut: 'open', gravite: 'major' })),
    changelog: { entrees: [] },
    specs: [],
    intents: [],
    gouvernance: [],
    metrics: { agregats: { drift: { driftsDetectes: 0, driftsResolus: 0 } } },
  });
  assert.ok(!html.includes('autre(s) alerte(s)'), 'pas de message "autres alertes" attendu');
  assert.ok(!html.match(/<details[^>]*>\s*<summary><strong>\+/), 'pas de <details> de repli');
});

test('pageOverview — alertes triées par gravité (bad d\'abord), repliée = priorité moindre', () => {
  const facts = [
    ...Array.from({ length: 5 }, (_, i) => ({ id: `WARN-${i + 1}`, titre: `Major ${i + 1}`, statut: 'open', gravite: 'major' })),
    { id: 'CRIT-1', titre: 'Critical au-delà du seuil', statut: 'open', gravite: 'critical' },
  ];
  const html = pageOverview({
    projet: { nom: 'demo' },
    fondamentaux: [],
    maturite: { score: 0, total: 5, label: '—', cls: 'maturite-bad' },
    matrice: { forward: [], backward: [], gaps: { intentsSansSpec: [], specsSansCode: [], specsValideesNonImplementees: [], specsOrphelinsSurCode: [], intentsOrphelinsSurCode: [], codeSansSpec: [], codeSansTests: [] }, stats: { intents: 0, specs: 0, codeFiles: 0 } },
    facts,
    changelog: { entrees: [] },
    specs: [], intents: [], gouvernance: [],
    metrics: { agregats: { drift: { driftsDetectes: 0, driftsResolus: 0 } } },
  });
  // CRIT-1 doit être visible dans la première section, pas dans le <details>
  const splitOnDetails = html.split('<details');
  assert.ok(splitOnDetails.length >= 2, '<details> attendu (6 alertes > 5)');
  const avantDetails = splitOnDetails[0];
  assert.match(avantDetails, /CRIT-1|Critical au-delà du seuil/, 'critical doit être en haut');
});

// ─── Leadership metrics dans metrics.html (#146 / #151) ──────────────────────

function donneesAvecLeadership(lead) {
  const d = donneesVides();
  d.signaux = { leadership: lead };
  // Force passage du early-return
  d.metrics.categories.security.fichiers.push({ nom: 's.md', file: '.aiad/metrics/security/s.md', mtime: Date.now(), data: {} });
  return d;
}

test('pageMetrics — leadership absent (pas de signaux) → section non rendue', () => {
  const d = donneesVides();
  d.metrics.categories.security.fichiers.push({ nom: 's.md', file: '.aiad/metrics/security/s.md', mtime: Date.now(), data: {} });
  const html = pageMetrics(d);
  assert.ok(!html.includes('Leadership EU/FR'));
});

test('pageMetrics — leadership avec ratios → 4 KPI rendus', () => {
  const d = donneesAvecLeadership({
    humanAuthorshipRatio: { ratio: 1.0, sufficient: 14, total: 14 },
    governanceCoverage: { ratio: null, sensitiveFiles: 0, governedFiles: 0 },
    traceCompleteness: { ratio: 0.94, complete: 16, total: 17 },
    langueArtefacts: { fr: 13, en: 0, mixed: 0, neutral: 18 },
  });
  const html = pageMetrics(d);
  assert.match(html, /Leadership EU\/FR/);
  assert.match(html, /Human Authorship/);
  assert.match(html, /<div class="value">100%/);
  assert.match(html, /Governance Coverage/);
  assert.match(html, /<div class="value">—/);
  assert.match(html, /Trace Completeness/);
  assert.match(html, /<div class="value">94%/);
  assert.match(html, /FR 13/);
});

test('pageMetrics — leadership ratios → classes cls correctes (bad/warn/ok)', () => {
  const html = pageMetrics(donneesAvecLeadership({
    humanAuthorshipRatio: { ratio: 0.9, sufficient: 9, total: 10 },   // ok
    governanceCoverage: { ratio: 0.6, sensitiveFiles: 10, governedFiles: 6 }, // warn
    traceCompleteness: { ratio: 0.3, complete: 3, total: 10 },        // bad
    langueArtefacts: { fr: 5, en: 0, mixed: 0, neutral: 0 },
  }));
  // Présence des 3 classes (l'ordre est ok, warn, bad)
  const section = html.split('Leadership EU/FR')[1].split('</section>')[0];
  assert.ok(section.includes('kpi ok"'), 'classe ok absente');
  assert.ok(section.includes('kpi warn"'), 'classe warn absente');
  assert.ok(section.includes('kpi bad"'), 'classe bad absente');
});

// #170 — UX claire quand total === 0 (pas de 0/0 confusant)
test('pageOverview — leadership rendu sur index.html aussi (#223)', () => {
  const html = pageOverview({
    projet: { nom: 'demo' },
    fondamentaux: [
      { nom: 'PRD.md', present: true, rempli: true, tailleKo: 1 },
      { nom: 'ARCHITECTURE.md', present: true, rempli: true, tailleKo: 1 },
      { nom: 'AGENT-GUIDE.md', present: true, rempli: true, tailleKo: 1 },
    ],
    maturite: { score: 5, total: 5, label: 'Complet', cls: 'maturite-ok' },
    matrice: { forward: [], backward: [], gaps: { intentsSansSpec: [], specsSansCode: [], specsValideesNonImplementees: [], specsOrphelinsSurCode: [], intentsOrphelinsSurCode: [], codeSansSpec: [], codeSansTests: [] }, stats: { intents: 0, specs: 0, codeFiles: 0 } },
    facts: [], changelog: { entrees: [] },
    specs: [], intents: [], gouvernance: [],
    metrics: { agregats: { drift: { driftsDetectes: 0, driftsResolus: 0 } } },
    signaux: { leadership: {
      humanAuthorshipRatio: { ratio: 0.95, sufficient: 19, total: 20 },
      governanceCoverage: { ratio: 0.8, governedFiles: 4, sensitiveFiles: 5 },
      traceCompleteness: { ratio: 0.7, complete: 7, total: 10 },
      langueArtefacts: { fr: 15, en: 5, mixed: 2, neutral: 8 },
    } },
  });
  assert.match(html, /Leadership EU\/FR/);
  assert.match(html, /Human Authorship/);
  assert.match(html, /Governance Coverage/);
  assert.match(html, /Trace Completeness/);
  // doit être positionné après santeGlobale et avant outcomes
  // (santeGlobale est null ici → ignoré, mais Leadership doit toujours être présent)
});

test('blocLeadership — total Intents 0 → "Pas encore d\'Intent" au lieu de "0/0"', () => {
  const html = pageMetrics(donneesAvecLeadership({
    humanAuthorshipRatio: { ratio: null, sufficient: 0, total: 0 },
    governanceCoverage: { ratio: null, sensitiveFiles: 0, governedFiles: 0 },
    traceCompleteness: { ratio: null, complete: 0, total: 0 },
    langueArtefacts: { fr: 0, en: 0, mixed: 0, neutral: 0 },
  }));
  assert.match(html, /Pas encore d'Intent/);
  assert.match(html, /Aucun fichier sensible détecté/);
  assert.match(html, /Pas encore de SPEC/);
  assert.match(html, /Aucun artefact à classer/);
  // Plus aucune occurrence de "0/0"
  assert.ok(!html.match(/>0\/0 /), 'pas de 0/0 confusant dans les delta');
});

// ─── Badge fraîcheur (#145) ──────────────────────────────────────────────────

test('freshnessBadge — < 1h → badge-ok "à l\'instant" ou "il y a N min"', () => {
  const iso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const html = freshnessBadge(iso);
  assert.match(html, /badge-ok/);
  assert.match(html, /il y a 5 min/);
});

test('freshnessBadge — entre 6h et 24h → badge-warn "à régénérer"', () => {
  const iso = new Date(Date.now() - 10 * 3600 * 1000).toISOString();
  const html = freshnessBadge(iso);
  assert.match(html, /badge-warn/);
  assert.match(html, /il y a 10 h/);
  assert.match(html, /à régénérer/);
});

test('freshnessBadge — > 24h → badge-bad "données obsolètes"', () => {
  const iso = new Date(Date.now() - 3 * 86400 * 1000).toISOString();
  const html = freshnessBadge(iso);
  assert.match(html, /badge-bad/);
  assert.match(html, /il y a 3 j/);
  assert.match(html, /données obsolètes/);
});

test('freshnessBadge — < 30s → "à l\'instant"', () => {
  const iso = new Date(Date.now() - 5 * 1000).toISOString();
  const html = freshnessBadge(iso);
  assert.match(html, /à l&#39;instant|à l'instant/);
});

test('freshnessBadge — entrée invalide → chaîne vide (pas de crash)', () => {
  assert.equal(freshnessBadge(null), '');
  assert.equal(freshnessBadge(''), '');
  assert.equal(freshnessBadge('not-a-date'), '');
  assert.equal(freshnessBadge(undefined), '');
});

test('freshnessBadge — tooltip explique comment rafraîchir + click-to-copy (#177)', () => {
  const iso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const html = freshnessBadge(iso);
  assert.match(html, /title="[^"]*Cliquer pour copier/);
  assert.match(html, /data-copy="npx aiad-sdd dashboard"/);
  assert.match(html, /role="button"/);
  assert.match(html, /tabindex="0"/);
});

test('freshnessBadge — TTL custom 168h (rituel hebdo) → 50h reste ok (#178)', () => {
  const iso = new Date(Date.now() - 50 * 3600 * 1000).toISOString();
  // Avec TTL par défaut (24h) → bad
  assert.match(freshnessBadge(iso), /badge-bad/);
  // Avec TTL 168h (rituel hebdo) : warn dès 42h (168/4), bad ≥ 168h.
  // 50h > 42h → warn, pas bad
  const html = freshnessBadge(iso, { ttlHours: 168 });
  assert.match(html, /badge-warn/);
  assert.match(html, /à régénérer/);
  assert.match(html, /TTL 168h/);
});

test('freshnessBadge — TTL custom 1h (équipe live) → 30 min reste ok, 50 min warn (#178)', () => {
  const iso30 = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  // 30 min → ok (< 60 min branche)
  assert.match(freshnessBadge(iso30, { ttlHours: 1 }), /badge-ok/);
});

test('freshnessBadge — env AIAD_DASHBOARD_TTL_HOURS lue (#178)', () => {
  const prev = process.env.AIAD_DASHBOARD_TTL_HOURS;
  process.env.AIAD_DASHBOARD_TTL_HOURS = '168';
  try {
    const iso = new Date(Date.now() - 100 * 3600 * 1000).toISOString();
    // 100h < 168h (TTL) mais > 42h (warn palier) → warn
    const html = freshnessBadge(iso);
    assert.match(html, /badge-warn/);
    assert.match(html, /TTL 168h/);
  } finally {
    if (prev === undefined) delete process.env.AIAD_DASHBOARD_TTL_HOURS;
    else process.env.AIAD_DASHBOARD_TTL_HOURS = prev;
  }
});

test('freshnessBadge — env invalide ignorée → défaut 24h appliqué', () => {
  const prev = process.env.AIAD_DASHBOARD_TTL_HOURS;
  process.env.AIAD_DASHBOARD_TTL_HOURS = 'not-a-number';
  try {
    const iso = new Date(Date.now() - 30 * 3600 * 1000).toISOString();
    // 30h > 24h (défaut) → bad
    assert.match(freshnessBadge(iso), /badge-bad/);
  } finally {
    if (prev === undefined) delete process.env.AIAD_DASHBOARD_TTL_HOURS;
    else process.env.AIAD_DASHBOARD_TTL_HOURS = prev;
  }
});

// ─── Widget Queue QA dans metrics.html (#157) ────────────────────────────────

test('blocQueueQa — pas de qa fourni → chaîne vide', () => {
  assert.equal(blocQueueQa({}), '');
  assert.equal(blocQueueQa({ qa: null }), '');
});

test('blocQueueQa — queue vide partout → chaîne vide (caché)', () => {
  const html = blocQueueQa({ qa: {
    queueReadySansTests: [],
    audit: { CORRECTIONS: 0 },
    ears: { aRelinter: 0 },
  } });
  assert.equal(html, '');
});

test('blocQueueQa — specs ready sans test → widget warn + lien qa.html', () => {
  const html = blocQueueQa({ qa: {
    queueReadySansTests: [{ id: 'SPEC-001' }, { id: 'SPEC-002' }, { id: 'SPEC-003' }],
    audit: { CORRECTIONS: 0 },
    ears: { aRelinter: 0 },
  } });
  assert.match(html, /Queue QA active — 3 action/);
  assert.match(html, /SPEC\(s\) ready sans test/);
  assert.match(html, /href="qa\.html"/);
  assert.match(html, /alerte-warn/);
});

test('blocQueueQa — mix queue + corrections + EARS → 3 segments visibles', () => {
  const html = blocQueueQa({ qa: {
    queueReadySansTests: [{ id: 'A' }, { id: 'B' }],
    audit: { CORRECTIONS: 1 },
    ears: { aRelinter: 4 },
  } });
  assert.match(html, /7 action\(s\)/);
  assert.match(html, /2.*SPEC\(s\) ready sans test/);
  assert.match(html, /1.*audit\(s\) avec CORRECTIONS/);
  assert.match(html, /4.*SPEC\(s\) EARS à re-linter/);
});

test('pageMetrics — widget Queue QA inséré quand applicable', () => {
  const d = donneesVides();
  d.qa = {
    queueReadySansTests: [{ id: 'X' }],
    audit: { CORRECTIONS: 0 },
    ears: { aRelinter: 0 },
  };
  // Force passage du early-return
  d.metrics.categories.security.fichiers.push({ nom: 's.md', file: '.aiad/metrics/security/s.md', mtime: Date.now(), data: {} });
  const html = pageMetrics(d);
  assert.match(html, /Queue QA active/);
  // Affiché AVANT la section DORA
  const idxQueue = html.indexOf('Queue QA active');
  const idxDora = html.indexOf('<h2>DORA</h2>');
  assert.ok(idxQueue < idxDora, `widget Queue QA doit précéder DORA (queue=${idxQueue}, dora=${idxDora})`);
});

// ─── #152 KPI SBOM sur index ─────────────────────────────────────────────────

test('kpiSbom — pas de SBOM → chaîne vide', () => {
  assert.equal(kpiSbom({}), '');
  assert.equal(kpiSbom({ supplementaire: { sbom: { present: false } } }), '');
});

test('kpiSbom — SBOM avec ≤ 50 composants → ok, "sous le seuil"', () => {
  const html = kpiSbom({ supplementaire: { sbom: { present: true, components: 30 } } });
  assert.match(html, /kpi ok/);
  assert.match(html, /<div class="value">30<\/div>/);
  assert.match(html, /sous le seuil/);
  assert.match(html, /href="legal\.html"/);
});

test('kpiSbom — 51..200 composants → warn, "audit recommandé"', () => {
  const html = kpiSbom({ supplementaire: { sbom: { present: true, components: 150 } } });
  assert.match(html, /kpi warn/);
  assert.match(html, /<div class="value">150<\/div>/);
  assert.match(html, /audit recommandé/);
});

test('kpiSbom — > 200 composants → bad', () => {
  const html = kpiSbom({ supplementaire: { sbom: { present: true, components: 300 } } });
  assert.match(html, /kpi bad/);
  assert.match(html, /<div class="value">300<\/div>/);
});

// ─── #225 KPI Souveraineté sur index ────────────────────────────────────────

test('kpiSovereignty — sovereignty non disponible → chaîne vide', () => {
  assert.equal(kpiSovereignty({}), '');
  assert.equal(kpiSovereignty({ supplementaire: { sovereignty: { available: false } } }), '');
});

test('kpiSovereignty — Platinum → kpi ok + lien legal', () => {
  const html = kpiSovereignty({ supplementaire: { sovereignty: {
    available: true, score: 92, maxScore: 100, level: 'Platinum',
  } } });
  assert.match(html, /kpi ok/);
  assert.match(html, /<div class="value">92<span[^>]*>\/100<\/span>/);
  assert.match(html, /Platinum/);
  assert.match(html, /href="legal\.html"/);
});

test('kpiSovereignty — Gold → kpi ok', () => {
  const html = kpiSovereignty({ supplementaire: { sovereignty: {
    available: true, score: 75, maxScore: 100, level: 'Gold',
  } } });
  assert.match(html, /kpi ok/);
  assert.match(html, /Gold/);
});

test('kpiSovereignty — Silver → kpi warn', () => {
  const html = kpiSovereignty({ supplementaire: { sovereignty: {
    available: true, score: 55, maxScore: 100, level: 'Silver',
  } } });
  assert.match(html, /kpi warn/);
  assert.match(html, /Silver/);
});

test('kpiSovereignty — Bronze → kpi bad', () => {
  const html = kpiSovereignty({ supplementaire: { sovereignty: {
    available: true, score: 30, maxScore: 100, level: 'Bronze',
  } } });
  assert.match(html, /kpi bad/);
  assert.match(html, /Bronze/);
});

test('kpiSovereignty — score absent → "—"', () => {
  const html = kpiSovereignty({ supplementaire: { sovereignty: {
    available: true, score: null, maxScore: 100, level: 'Unknown',
  } } });
  assert.match(html, /<div class="value">—/);
});

// ─── #226 KPI Hook pre-commit sur index ─────────────────────────────────────

test('kpiHookStats — non disponible → chaîne vide', () => {
  assert.equal(kpiHookStats({}), '');
  assert.equal(kpiHookStats({ supplementaire: { hookStats: { available: false } } }), '');
});

test('kpiHookStats — santé sain → kpi ok + lien sre.html', () => {
  const html = kpiHookStats({ supplementaire: { hookStats: {
    available: true, count: 42, p95: 180, sante: 'sain',
  } } });
  assert.match(html, /kpi ok/);
  assert.match(html, /<div class="value">180/);
  assert.match(html, /sain/);
  assert.match(html, /42 run\(s\)/);
  assert.match(html, /href="sre\.html"/);
});

test('kpiHookStats — santé attention → kpi warn (terme réel de hook-sandbox.js)', () => {
  const html = kpiHookStats({ supplementaire: { hookStats: {
    available: true, count: 100, p95: 1800, sante: 'attention',
  } } });
  assert.match(html, /kpi warn/);
  assert.match(html, /attention/);
});

test('kpiHookStats — santé dégradé (alias toléré) → kpi warn', () => {
  const html = kpiHookStats({ supplementaire: { hookStats: {
    available: true, count: 100, p95: 1800, sante: 'dégradé',
  } } });
  assert.match(html, /kpi warn/);
});

test('kpiHookStats — santé critique → kpi bad', () => {
  const html = kpiHookStats({ supplementaire: { hookStats: {
    available: true, count: 50, p95: 5000, sante: 'critique',
  } } });
  assert.match(html, /kpi bad/);
  assert.match(html, /critique/);
});

test('kpiHookStats — p95 absent → "—"', () => {
  const html = kpiHookStats({ supplementaire: { hookStats: {
    available: true, count: 1, p95: null, sante: 'sain',
  } } });
  assert.match(html, /<div class="value">—/);
});

// ─── #227 KPI Violations Tier 1 sur index ───────────────────────────────────

test('kpiViolations — sans violations data → chaîne vide', () => {
  assert.equal(kpiViolations({}), '');
});

test('kpiViolations — total 0 → kpi ok "aucune dérive"', () => {
  const html = kpiViolations({ violations: { total: 0, typeA: { total: 0 }, typeB: { total: 0 } } });
  assert.match(html, /kpi ok/);
  assert.match(html, /<div class="value">0<\/div>/);
  assert.match(html, /aucune dérive Tier 1/);
  assert.match(html, /href="governance\.html"/);
});

test('kpiViolations — 1..3 violations → kpi warn', () => {
  const html = kpiViolations({ violations: { total: 2, typeA: { total: 1 }, typeB: { total: 1 } } });
  assert.match(html, /kpi warn/);
  assert.match(html, /<div class="value">2<\/div>/);
  assert.match(html, /1 orpheline\(s\)/);
  assert.match(html, /1 non implémentée\(s\)/);
});

test('kpiViolations — > 3 violations → kpi bad', () => {
  const html = kpiViolations({ violations: { total: 7, typeA: { total: 3 }, typeB: { total: 4 } } });
  assert.match(html, /kpi bad/);
  assert.match(html, /<div class="value">7<\/div>/);
  assert.match(html, /3 orpheline\(s\)/);
});

// (#312) lienSource accepte texte custom + respecte sourceBase
test('#312 lienSource(file) → texte = file par défaut + href relatif', () => {
  setSourceBase('');
  const html = lienSource('src/auth.ts');
  assert.match(html, /href="\.\.\/src\/auth\.ts"/);
  assert.match(html, />src\/auth\.ts</);
});

test('#312 lienSource(file, texte) → texte custom préservé (échappé)', () => {
  setSourceBase('');
  const html = lienSource('.aiad/dpia/2026-Q1.md', 'DPIA Q1 2026');
  assert.match(html, /href="\.\.\/\.aiad\/dpia\/2026-Q1\.md"/);
  assert.match(html, />DPIA Q1 2026</);
  // title reste le path
  assert.match(html, /title="Ouvrir \.aiad\/dpia\/2026-Q1\.md"/);
});

test('#312 lienSource avec sourceBase → préfixe absolu', () => {
  setSourceBase('https://github.com/o/r/blob/main');
  try {
    const html = lienSource('src/auth.ts', 'auth module');
    assert.match(html, /href="https:\/\/github\.com\/o\/r\/blob\/main\/src\/auth\.ts"/);
    assert.match(html, />auth module</);
  } finally { setSourceBase(''); }
});

test('#312 lienSource(null) → chaîne vide (garde-fou)', () => {
  setSourceBase('');
  assert.equal(lienSource(null), '');
  assert.equal(lienSource(''), '');
});

// (#327) Catalog tables : Intent + SPEC + FACT IDs deviennent hyperliés
import { pageIntents, pageSpecs } from '../lib/dashboard/render.js';

// (#332) pageChangelog header source hyperlié
test('#332 pageChangelog — header "source : FILE" devient un <a>', () => {
  setSourceBase('');
  const html = pageChangelog({
    changelog: {
      file: '.aiad/CHANGELOG-ARTEFACTS.md',
      entrees: [{ date: '2026-05-14', artefact: 'PRD.md', type: 'update', auteur: 'alice', raison: 'pricing change', impact: 'low' }],
    },
  });
  assert.match(html, /source : <a[^>]+href="\.\.\/\.aiad\/CHANGELOG-ARTEFACTS\.md"[^>]*>\.aiad\/CHANGELOG-ARTEFACTS\.md<\/a>/);
});

// (#330) pageOverview recentSpecs table : SPEC ID hyperlié
test('#330 pageOverview recentSpecs — SPEC ID cell devient hyperlien vers fichier', () => {
  setSourceBase('');
  const donnees = donneesVides();
  donnees.specs = [{ id: 'SPEC-007-1', titre: 'OIDC', file: '.aiad/specs/SPEC-007-1-oidc.md', statut: 'ready', sqs: 4.5 }];
  const html = pageOverview(donnees);
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/specs\/SPEC-007-1-oidc\.md"[^>]*>SPEC-007-1<\/a>/);
});

test('#327 pageIntents — ID cell devient un <a> vers le fichier Intent', () => {
  setSourceBase('');
  const donnees = {
    intents: [{ id: 'INTENT-007', titre: 'Auth', file: '.aiad/intents/INTENT-007-auth.md', statut: 'active', auteur: 'alice', date: '2026-05-14' }],
    specsParIntent: new Map([['INTENT-007', [{ id: 'SPEC-007-1', file: '.aiad/specs/SPEC-007-1-oidc.md' }]]]),
  };
  const html = pageIntents(donnees);
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/intents\/INTENT-007-auth\.md"[^>]*>INTENT-007<\/a>/);
  // SPEC liée aussi hyperliée
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/specs\/SPEC-007-1-oidc\.md"[^>]*>SPEC-007-1<\/a>/);
});

test('#327 pageSpecs — ID + Intent parent hyperliés', () => {
  setSourceBase('');
  const donnees = {
    intents: [{ id: 'INTENT-007', file: '.aiad/intents/INTENT-007-auth.md' }],
    specs: [{ id: 'SPEC-007-1', titre: 'OIDC', file: '.aiad/specs/SPEC-007-1-oidc.md', parentIntent: 'INTENT-007', format: 'ears', sqs: 4.5, statut: 'ready', date: '2026-05-14' }],
  };
  const html = pageSpecs(donnees);
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/specs\/SPEC-007-1-oidc\.md"[^>]*>SPEC-007-1<\/a>/);
  // Intent parent cell pointe vers INTENT-007-auth.md
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/intents\/INTENT-007-auth\.md"[^>]*>INTENT-007<\/a>/);
});

// (#326) Traceability matrix : Intent/SPEC IDs + code/test paths hyperliés
test('#326 pageTraceability — Intent + SPEC IDs et paths code/test deviennent <a> hyperliés', () => {
  setSourceBase('');
  const donnees = {
    matrice: {
      summary: { intents: 1, specs: 1, codeFiles: 1, testFiles: 1 },
      forward: [{
        intent: { id: 'INTENT-007', file: '.aiad/intents/INTENT-007-auth.md' },
        specs: [{
          spec: { id: 'SPEC-007-1', title: 'OIDC flow', file: '.aiad/specs/SPEC-007-1-oidc.md' },
          code: [{ path: 'src/auth/oidc.ts', line: 12 }],
          tests: [{ path: 'tests/auth/oidc.test.ts', line: 5 }],
        }],
      }],
      backward: [{
        test: { path: 'tests/auth/oidc.test.ts', line: 5 },
        spec: { id: 'SPEC-007-1', file: '.aiad/specs/SPEC-007-1-oidc.md' },
        intent: { id: 'INTENT-007', file: '.aiad/intents/INTENT-007-auth.md' },
        code: [{ path: 'src/auth/oidc.ts', line: 12 }],
      }],
      gaps: { intentsSansSpec: [], specsSansCode: [], specsValideesNonImplementees: [], specsOrphelinsSurCode: [], intentsOrphelinsSurCode: [], codeSansSpec: [], codeSansTests: [] },
    },
  };
  const html = pageTraceability(donnees);
  // Intent ID linké vers le fichier .md
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/intents\/INTENT-007-auth\.md"[^>]*>INTENT-007<\/a>/);
  // SPEC ID linké vers le fichier .md
  assert.match(html, /<a[^>]+href="\.\.\/\.aiad\/specs\/SPEC-007-1-oidc\.md"[^>]*>SPEC-007-1<\/a>/);
  // Code path linké à la ligne précise (#L12)
  assert.match(html, /href="\.\.\/src\/auth\/oidc\.ts#L12"/);
  // Test path linké à la ligne précise (#L5)
  assert.match(html, /href="\.\.\/tests\/auth\/oidc\.test\.ts#L5"/);
});

test('#326 pageTraceability — sans intent.file fallback <code> (garde-fou)', () => {
  setSourceBase('');
  const donnees = {
    matrice: {
      summary: { intents: 1, specs: 0 },
      forward: [{ intent: { id: 'INTENT-X', file: null }, specs: [] }],
      backward: [],
      gaps: { intentsSansSpec: [], specsSansCode: [], specsValideesNonImplementees: [], specsOrphelinsSurCode: [], intentsOrphelinsSurCode: [], codeSansSpec: [], codeSansTests: [] },
    },
  };
  const html = pageTraceability(donnees);
  assert.match(html, /<code>INTENT-X<\/code>/);
  assert.ok(!html.includes('INTENT-X.md'), 'pas de lien quand file absent');
});

// (#313) hrefSource — URL brute pour wrappers custom
test('#313 hrefSource(file) → URL relative `../FILE` sans wrapper', () => {
  setSourceBase('');
  assert.equal(hrefSource('src/a.ts'), '../src/a.ts');
  assert.equal(hrefSource('.aiad/specs/SPEC-1.md'), '../.aiad/specs/SPEC-1.md');
});

test('#313 hrefSource avec sourceBase → URL absolue', () => {
  setSourceBase('https://github.com/o/r/blob/main');
  try {
    assert.equal(hrefSource('src/a.ts'), 'https://github.com/o/r/blob/main/src/a.ts');
  } finally { setSourceBase(''); }
});

test('#313 hrefSource(file, ligne) → anchor #LNN ajouté', () => {
  setSourceBase('');
  assert.equal(hrefSource('src/a.ts', 42), '../src/a.ts#L42');
  setSourceBase('https://gh/x/y/blob/main');
  try {
    assert.equal(hrefSource('src/a.ts', 42), 'https://gh/x/y/blob/main/src/a.ts#L42');
  } finally { setSourceBase(''); }
});

test('#313 hrefSource(null) → chaîne vide', () => {
  assert.equal(hrefSource(null), '');
  assert.equal(hrefSource(''), '');
});
