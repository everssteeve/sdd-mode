// AIAD SDD Mode — Dashboard : catalogue et calcul des métriques AIAD.
//
// Le framework AIAD (§ 7) définit cinq catégories de métriques — Productivité,
// Qualité, Efficacité IA, Outcomes, Équipe — et intègre DORA et Flow. Ce module
// en est le catalogue : chaque métrique porte sa cible, sa fréquence, la
// responsabilité qui la suit, et la façon de la calculer depuis
// `.aiad/metrics/`.
//
// Règle d'honnêteté : une métrique sans donnée est « non mesurée ». Elle
// reste affichée, avec la manière de l'alimenter — jamais avec une valeur
// supposée. Deux métriques d'équipe (turnover, jours de maladie) relèvent de
// données RH sensibles : le dashboard ne les collecte pas.
//
// Sobriété (RGESN) : calcul pur sur les données déjà collectées, zéro I/O.
//
// @intent INTENT-038
// @spec SPEC-038-1-metriques-aiad-dashboard
// @verified-by test/dashboard-aiad-metrics.test.js
// @governance AIAD-RGPD, AIAD-RGESN
//
// Documentation : https://aiad.ovh

/** Catégories, dans l'ordre du framework, avec l'onglet de la responsabilité qui les suit. */
export const CATEGORIES = Object.freeze([
  { id: 'productivite', titre: 'Productivité', onglet: 'pe', resume: "La capacité de l'équipe à livrer de la valeur rapidement." },
  { id: 'qualite', titre: 'Qualité', onglet: 'qa', resume: 'La robustesse du code et la fiabilité du produit.' },
  { id: 'efficacite-ia', titre: 'Efficacité IA', onglet: 'ae', resume: "La performance de l'écosystème d'agents." },
  { id: 'outcomes', titre: 'Outcomes', onglet: 'pm', resume: 'La valeur réelle livrée aux utilisateurs.' },
  { id: 'equipe', titre: 'Équipe', onglet: 'global', resume: "Le bien-être et l'engagement de l'équipe — valeurs agrégées, jamais individuelles." },
  { id: 'dora', titre: 'DORA', onglet: 'tl', resume: 'Les quatre indicateurs de performance de livraison.' },
  { id: 'flow', titre: 'Flow', onglet: 'tl', resume: 'Les cinq indicateurs de flux.' },
]);

const JOUR = 86400000;
const num = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : (typeof v === 'string' && /^-?\d+(?:[.,]\d+)?/.test(v.trim()) ? Number.parseFloat(v.replace(',', '.')) : null));
const moy = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Contexte de calcul : accès daté aux fichiers de `.aiad/metrics/<catégorie>/`. */
function contexte(donnees) {
  const cats = donnees?.metrics?.categories || {};
  const maintenant = Date.parse(donnees?.projet?.genere || '') || Date.now();
  const dater = (f) => {
    const d = f.data || {};
    const brut = d.date || d.deployed_at || (String(f.nom || '').match(/^\d{4}-\d{2}-\d{2}/) || [])[0];
    return Date.parse(brut) || f.mtime || 0;
  };
  const fichiers = (cat) => [...(cats[cat]?.fichiers || [])].map((f) => ({ data: f.data || {}, date: dater(f) })).sort((a, b) => a.date - b.date);
  const valeurs = (cat, cle) => fichiers(cat).map((f) => num(f.data[cle])).filter((v) => v !== null);
  return {
    donnees,
    maintenant,
    fichiers,
    valeurs,
    moyenne: (cat, cle) => moy(valeurs(cat, cle)),
    /** Dernière valeur numérique d'une clé (et la précédente, pour une tendance). */
    dernier: (cat, cle) => {
      const v = fichiers(cat).map((f) => ({ v: num(f.data[cle]), date: f.date })).filter((x) => x.v !== null);
      if (!v.length) return null;
      const d = v[v.length - 1];
      return { valeur: d.v, precedent: v.length > 1 ? v[v.length - 2].v : null, date: d.date || null, source: `déclaré — ${cat}` };
    },
    /** Nombre de fichiers datés dans [maintenant − debut, maintenant − fin[ (en jours), filtrés. */
    compter: (cat, debut, fin, filtre = () => true) => fichiers(cat)
      .filter((f) => f.date > maintenant - debut * JOUR && f.date <= maintenant - fin * JOUR && filtre(f.data)).length,
  };
}

const deploiements = (c) => c.fichiers('deployments');
const reussi = (d) => d.status === 'success';
const echec = (d) => d.status === 'hotfix' || d.status === 'failure' || d.status === 'failed';
const retro = (cle) => (c) => c.dernier('retro', cle);
const strat = (cle) => (c) => c.dernier('sync-strat', cle);
const ALIM_RETRO = (cle) => `\`npx aiad-sdd metrics record retro ${cle}=…\` en rétrospective`;
const ALIM_STRAT = (cle) => `\`npx aiad-sdd metrics record sync-strat ${cle}=…\` en synchronisation stratégique`;
const ALIM_DEPLOY = 'un fichier par mise en production dans `.aiad/metrics/deployments/` (`/aiad dora`)';

function debit(c) {
  if (deploiements(c).length === 0) return null;
  return { valeur: c.compter('deployments', 30, 0, reussi), precedent: c.compter('deployments', 60, 30, reussi) };
}
function frequence(c) {
  if (deploiements(c).length === 0) return null;
  return { valeur: Math.round((c.compter('deployments', 30, 0) / (30 / 7)) * 10) / 10 };
}
function tauxEchec(c) {
  const d = deploiements(c);
  return d.length ? { valeur: (d.filter((f) => echec(f.data)).length / d.length) * 100 } : null;
}
const cycleTime = (c) => (c.moyenne('deployments', 'cycle_time_days') === null ? null : { valeur: c.moyenne('deployments', 'cycle_time_days') });
const leadTime = (c) => (c.moyenne('deployments', 'lead_time_days') === null ? null : { valeur: c.moyenne('deployments', 'lead_time_days') });
/** Délai moyen sur les déploiements en échec ; « aucun incident » quand il n'y en a eu aucun. */
function delaiIncident(cle) {
  return (c) => {
    const v = c.moyenne('deployments', cle);
    if (v !== null) return { valeur: v };
    const d = deploiements(c);
    return d.length && !d.some((f) => echec(f.data)) ? { valeur: null, texte: 'aucun incident' } : null;
  };
}
const mttr = delaiIncident('mttr_hours');

/** Part du travail passée par les agents, mesurée sur git ; à défaut, déclarée en rétrospective. */
function adoptionAgents(c) {
  const g = c.donnees?.activiteGit;
  if (g && g.commits > 0) return { valeur: (g.commitsAgent / g.commits) * 100, source: `git — ${g.commitsAgent}/${g.commits} commits co-signés par un agent, ${g.jours} j` };
  return c.dernier('retro', 'adoption_agents_pct');
}
function codeGenere(c) {
  const g = c.donnees?.activiteGit;
  if (g && g.lignes > 0) return { valeur: (g.lignesAgent / g.lignes) * 100, source: `git — lignes ajoutées dans des commits co-signés par un agent, ${g.jours} j` };
  return c.dernier('retro', 'code_genere_pct');
}
/** Dette : instantanés du dashboard (TODO-JNSP + SPECs trop grosses) ; à défaut, inventaire de Tech Review. */
function dette(c) {
  const h = c.donnees?.detteHistorique || [];
  if (h.length) {
    const d = h[h.length - 1];
    return { valeur: d.total, precedent: h.length > 1 ? h[h.length - 2].total : null, source: `instantané du ${d.date} — TODO-JNSP + SPECs trop grosses` };
  }
  return c.dernier('tech-review', 'dette_items_count');
}
function couverture(c) {
  const cv = c.donnees?.couverture;
  return cv && typeof cv.pct === 'number' ? { valeur: cv.pct, source: cv.source } : null;
}

/** Premier passage à la Gate : enregistrements `/sdd gate`, sinon historique des SPECs, sinon rétrospective. */
function premierPassageGate(c) {
  const dernierParSpec = new Map();
  c.fichiers('specs').forEach((f, i) => { if (num(f.data.attempts) !== null) dernierParSpec.set(String(f.data.spec_id || `#${i}`), num(f.data.attempts)); });
  if (dernierParSpec.size) {
    const v = [...dernierParSpec.values()];
    return { valeur: (v.filter((a) => a === 1).length / v.length) * 100, source: `enregistrements /sdd gate — ${v.length} SPEC(s)` };
  }
  const h = c.donnees?.gatesHistorique;
  if (h && h.specs > 0) return { valeur: (h.premierPassage / h.specs) * 100, source: `historique des SPECs — ${h.premierPassage}/${h.specs} ouvertes au premier passage` };
  return c.dernier('retro', 'taux_premier_passage');
}
/** Validations enregistrées par `/sdd validate` : une SPEC validée du premier coup = succès de l'agent au premier essai. */
function validationsParSpec(c) {
  const parSpec = new Map();
  for (const f of c.fichiers('validations')) {
    if (!f.data.spec_id) continue;
    const id = String(f.data.spec_id);
    if (!parSpec.has(id)) parSpec.set(id, []);
    parSpec.get(id).push({ verdict: String(f.data.verdict || ''), passage: num(f.data.attempts) ?? parSpec.get(id).length + 1 });
  }
  // Ordre des passages : deux validations du même jour se départagent par leur numéro de passage.
  for (const [id, v] of parSpec) parSpec.set(id, v.sort((a, b) => a.passage - b.passage).map((x) => x.verdict));
  return parSpec;
}
function premierPassageAgents(c) {
  const v = validationsParSpec(c);
  if (v.size) return { valeur: ([...v.values()].filter((x) => x[0] === 'valide').length / v.size) * 100, source: `enregistrements /sdd validate — ${v.size} SPEC(s)` };
  return c.dernier('retro', 'agents_first_time_success_pct') || c.dernier('retro', 'taux_premier_passage');
}
function iterationsParFeature(c) {
  const v = validationsParSpec(c);
  if (v.size) return { valeur: moy([...v.values()].map((x) => x.length)), source: `enregistrements /sdd validate — ${v.size} SPEC(s)` };
  return c.dernier('retro', 'iterations_par_feature');
}

/** Temps actif / temps total, sur les seuls déploiements qui portent les deux durées. */
function efficaciteFlux(c) {
  const ratios = deploiements(c)
    .map((f) => [num(f.data.cycle_time_days), num(f.data.lead_time_days)])
    .filter(([ct, lt]) => ct !== null && lt !== null && lt > 0 && ct <= lt)
    .map(([ct, lt]) => (ct / lt) * 100);
  if (ratios.length) return { valeur: moy(ratios) };
  // À défaut de déploiement portant les deux durées : rapport des moyennes (§ 7.7 du framework).
  const ct = c.moyenne('deployments', 'cycle_time_days');
  const lt = c.moyenne('deployments', 'lead_time_days');
  if (ct === null || lt === null || lt <= 0) return null;
  if (ct > lt) return { valeur: null, anomalie: true, texte: `incohérent — Cycle Time moyen (${arrondi(ct)} j) supérieur au Lead Time moyen (${arrondi(lt)} j)`, source: 'moyennes des déploiements' };
  return { valeur: (ct / lt) * 100, source: 'rapport des moyennes Cycle Time / Lead Time' };
}

/**
 * Métriques : `{ id, cat, label, cible, frequence, regle, unite, calc, alimenter }`.
 * `regle` : `{ op: '<' | '>', seuil }`, `{ tendance: 'baisse' | 'hausse' }` (comparée
 * à la période précédente) ou null (valeur informative). `horsDashboard` :
 * métrique du framework que l'outil ne collecte pas.
 */
export const METRIQUES = Object.freeze([
  // ── 7.1 Productivité ───────────────────────────────────────────────────
  { id: 'cycle-time', cat: 'productivite', label: 'Cycle Time', cible: '< 3 jours', frequence: 'hebdo', regle: { op: '<', seuil: 3 }, unite: ' j', calc: cycleTime, alimenter: `\`cycle_time_days\` — ${ALIM_DEPLOY}` },
  { id: 'lead-time', cat: 'productivite', label: 'Lead Time', cible: '< 2 semaines', frequence: 'hebdo', regle: { op: '<', seuil: 14 }, unite: ' j', calc: leadTime, alimenter: `\`lead_time_days\` — ${ALIM_DEPLOY}` },
  { id: 'throughput', cat: 'productivite', label: 'Throughput', cible: 'Stable ou en hausse', frequence: 'hebdo', regle: { tendance: 'hausse' }, unite: ' / 30 j', calc: debit, alimenter: ALIM_DEPLOY },
  { id: 'release-frequency', cat: 'productivite', label: 'Release Frequency', cible: 'Quotidien (idéal)', frequence: 'hebdo', regle: null, unite: ' / semaine', calc: frequence, alimenter: ALIM_DEPLOY },
  { id: 'deploy-success', cat: 'productivite', label: 'Deployment Success Rate', cible: '> 95 %', frequence: 'hebdo', regle: { op: '>', seuil: 95 }, unite: ' %', calc: (c) => { const d = deploiements(c); return d.length ? { valeur: (d.filter((f) => reussi(f.data)).length / d.length) * 100 } : null; }, alimenter: `\`status\` — ${ALIM_DEPLOY}` },
  // ── 7.2 Qualité ────────────────────────────────────────────────────────
  { id: 'couverture', cat: 'qualite', label: 'Couverture de tests', cible: '> 80 % backend, > 70 % frontend', frequence: 'hebdo', regle: { op: '>', seuil: 80 }, unite: ' %', calc: couverture, alimenter: 'rapport de couverture de l\'outil de test (`coverage/coverage-summary.json`) — lu automatiquement' },
  { id: 'bugs-prod', cat: 'qualite', label: 'Bugs en production', cible: 'Tendance en baisse (−20 % / trimestre)', frequence: 'hebdo', regle: { tendance: 'baisse' }, unite: ' / 90 j', calc: (c) => { const f = (c.donnees?.facts || []).map((x) => Date.parse(x.date)).filter(Boolean); if (!f.length) return null; const n = (a, b) => f.filter((d) => d > c.maintenant - a * JOUR && d <= c.maintenant - b * JOUR).length; return { valeur: n(90, 0), precedent: n(180, 90) }; }, alimenter: 'un FACT daté par écart constaté (`/sdd fact`)' },
  { id: 'mttd', cat: 'qualite', label: 'Mean Time To Detect (MTTD)', cible: '< 24 h', frequence: 'mensuel', regle: { op: '<', seuil: 24 }, unite: ' h', calc: delaiIncident('mttd_hours'), alimenter: '`npx aiad-sdd metrics record deployments status=hotfix mttd_hours=…`' },
  { id: 'mttr', cat: 'qualite', label: 'Mean Time To Repair (MTTR)', cible: '< 4 h', frequence: 'mensuel', regle: { op: '<', seuil: 4 }, unite: ' h', calc: mttr, alimenter: '`npx aiad-sdd metrics record deployments status=hotfix mttr_hours=…`' },
  { id: 'dette', cat: 'qualite', label: 'Dette technique', cible: 'Stable ou en baisse', frequence: 'mensuel', regle: { tendance: 'baisse' }, unite: ' élément(s)', calc: dette, alimenter: 'instantané quotidien du dashboard — automatique ; ou `dette_items_count` en Tech Review' },
  { id: 'first-time-success', cat: 'qualite', label: 'First-Time Success Rate', cible: '> 70 %', frequence: 'hebdo', regle: { op: '>', seuil: 70 }, unite: ' %', calc: premierPassageGate, alimenter: 'historique des SPECs (lignes « Gate ») — automatique ; ou `npx aiad-sdd metrics record specs spec_id=… sqs_score=… gate_result=…` à chaque `/sdd gate`' },
  // ── 7.3 Efficacité IA ──────────────────────────────────────────────────
  { id: 'adoption-agents', cat: 'efficacite-ia', label: "Taux d'adoption des agents", cible: '> 90 %', frequence: 'hebdo', regle: { op: '>', seuil: 90 }, unite: ' %', calc: adoptionAgents, alimenter: 'historique git (commits co-signés par un agent) — automatique ; ou ' + ALIM_RETRO('adoption_agents_pct') },
  { id: 'fts-agents', cat: 'efficacite-ia', label: 'First-Time Success Rate (agents)', cible: '> 70 %', frequence: 'hebdo', regle: { op: '>', seuil: 70 }, unite: ' %', calc: premierPassageAgents, alimenter: '`npx aiad-sdd metrics record validations spec_id=… verdict=…` à chaque `/sdd validate` ; ou ' + ALIM_RETRO('taux_premier_passage') },
  { id: 'code-genere', cat: 'efficacite-ia', label: 'Ratio code généré / manuel', cible: '> 80 / 20', frequence: 'hebdo', regle: { op: '>', seuil: 80 }, unite: ' % généré', calc: codeGenere, alimenter: 'historique git (lignes des commits co-signés par un agent) — automatique ; ou ' + ALIM_RETRO('code_genere_pct') },
  { id: 'iterations-feature', cat: 'efficacite-ia', label: 'Itérations moyennes par feature', cible: '< 3', frequence: 'hebdo', regle: { op: '<', seuil: 3 }, unite: '', calc: iterationsParFeature, alimenter: '`npx aiad-sdd metrics record validations spec_id=… verdict=…` à chaque `/sdd validate` ; ou ' + ALIM_RETRO('iterations_par_feature') },
  { id: 'faux-positifs', cat: 'efficacite-ia', label: 'Taux de faux positifs (agents)', cible: '< 20 %', frequence: 'mensuel', regle: { op: '<', seuil: 20 }, unite: ' %', calc: retro('faux_positifs_pct'), alimenter: ALIM_RETRO('faux_positifs_pct') },
  { id: 'resolution-agents', cat: 'efficacite-ia', label: 'Temps de résolution des problèmes agents', cible: '< 2 h', frequence: 'mensuel', regle: { op: '<', seuil: 2 }, unite: ' h', calc: retro('resolution_agents_heures'), alimenter: ALIM_RETRO('resolution_agents_heures') },
  { id: 'satisfaction-pe', cat: 'efficacite-ia', label: "Satisfaction PE sur l'écosystème", cible: '> 8 / 10', frequence: 'mensuel', regle: { op: '>', seuil: 8 }, unite: ' / 10', calc: retro('satisfaction_pe'), alimenter: ALIM_RETRO('satisfaction_pe') },
  // ── 7.4 Outcomes ───────────────────────────────────────────────────────
  { id: 'outcome-criteria', cat: 'outcomes', label: 'Atteinte des Outcome Criteria', cible: '> 70 %', frequence: 'mensuel', regle: { op: '>', seuil: 70 }, unite: ' %', calc: (c) => { const cr = (c.donnees?.outcomes?.criteres || []).filter((x) => x.actuel != null); return cr.length ? { valeur: (cr.filter((x) => x.etat === 'ok').length / cr.length) * 100 } : null; }, alimenter: 'mesures courantes dans `.aiad/metrics/outcomes/` (critères du PRD)' },
  { id: 'satisfaction-utilisateur', cat: 'outcomes', label: 'Satisfaction utilisateur (NPS, CSAT)', cible: '> 8 / 10', frequence: 'mensuel', regle: { op: '>', seuil: 8 }, unite: ' / 10', calc: (c) => c.dernier('demo', 'nps_indicatif'), alimenter: '`npx aiad-sdd metrics record demo nps_indicatif=…` en démo' },
  { id: 'adoption-fonctionnalite', cat: 'outcomes', label: 'Adoption fonctionnalité', cible: '> 60 % en 1 mois', frequence: 'feature', regle: { op: '>', seuil: 60 }, unite: ' %', calc: strat('adoption_pct'), alimenter: ALIM_STRAT('adoption_pct') },
  { id: 'time-to-value', cat: 'outcomes', label: 'Time to Value', cible: '< 5 min (selon produit)', frequence: 'mensuel', regle: { op: '<', seuil: 5 }, unite: ' min', calc: strat('time_to_value_min'), alimenter: ALIM_STRAT('time_to_value_min') },
  { id: 'retention', cat: 'outcomes', label: 'Retention Rate', cible: '> 80 % (selon produit)', frequence: 'mensuel', regle: { op: '>', seuil: 80 }, unite: ' %', calc: strat('retention_pct'), alimenter: ALIM_STRAT('retention_pct') },
  { id: 'business-impact', cat: 'outcomes', label: 'Business Impact', cible: 'Variable selon contexte', frequence: 'mensuel', regle: null, unite: '', calc: (c) => { const f = c.fichiers('sync-strat').map((x) => x.data.business_impact).filter((v) => v != null && v !== ''); return f.length ? { valeur: null, texte: String(f[f.length - 1]) } : null; }, alimenter: ALIM_STRAT('business_impact') },
  // ── 7.5 Équipe ─────────────────────────────────────────────────────────
  { id: 'satisfaction-equipe', cat: 'equipe', label: 'Satisfaction équipe', cible: '> 7 / 10', frequence: 'hebdo', regle: { op: '>', seuil: 7 }, unite: ' / 10', calc: retro('satisfaction_equipe'), alimenter: ALIM_RETRO('satisfaction_equipe') },
  { id: 'psychological-safety', cat: 'equipe', label: 'Psychological Safety', cible: '> 8 / 10', frequence: 'mensuel', regle: { op: '>', seuil: 8 }, unite: ' / 10', calc: retro('psychological_safety'), alimenter: ALIM_RETRO('psychological_safety') },
  { id: 'temps-flow', cat: 'equipe', label: 'Temps en flow', cible: '> 4 h / jour', frequence: 'hebdo', regle: { op: '>', seuil: 4 }, unite: ' h / jour', calc: retro('temps_flow_heures'), alimenter: ALIM_RETRO('temps_flow_heures') },
  { id: 'turnover', cat: 'equipe', label: 'Turnover', cible: '< 10 % / an', frequence: 'annuel', regle: null, unite: '', horsDashboard: true, calc: () => null, alimenter: 'donnée RH — suivie hors du dashboard' },
  { id: 'sick-days', cat: 'equipe', label: 'Sick Days', cible: 'Baseline stable', frequence: 'mensuel', regle: null, unite: '', horsDashboard: true, calc: () => null, alimenter: 'donnée de santé — suivie hors du dashboard' },
  // ── 7.7 DORA ───────────────────────────────────────────────────────────
  { id: 'dora-frequency', cat: 'dora', label: 'Deployment Frequency', cible: 'Quotidien (idéal)', frequence: 'hebdo', regle: null, unite: ' / semaine', calc: frequence, alimenter: ALIM_DEPLOY },
  { id: 'dora-lead-time', cat: 'dora', label: 'Lead Time for Changes', cible: '< 2 semaines', frequence: 'mensuel', regle: { op: '<', seuil: 14 }, unite: ' j', calc: leadTime, alimenter: `\`lead_time_days\` — ${ALIM_DEPLOY}` },
  { id: 'dora-cfr', cat: 'dora', label: 'Change Failure Rate', cible: '< 15 %', frequence: 'hebdo', regle: { op: '<', seuil: 15 }, unite: ' %', calc: tauxEchec, alimenter: `\`status: failure | hotfix\` — ${ALIM_DEPLOY}` },
  { id: 'dora-mttr', cat: 'dora', label: 'MTTR', cible: '< 4 h', frequence: 'mensuel', regle: { op: '<', seuil: 4 }, unite: ' h', calc: mttr, alimenter: '`npx aiad-sdd metrics record deployments status=hotfix mttr_hours=…`' },
  // ── 7.7 Flow ───────────────────────────────────────────────────────────
  { id: 'flow-cycle-time', cat: 'flow', label: 'Cycle Time', cible: '< 3 jours', frequence: 'hebdo', regle: { op: '<', seuil: 3 }, unite: ' j', calc: cycleTime, alimenter: `\`cycle_time_days\` — ${ALIM_DEPLOY}` },
  { id: 'flow-lead-time', cat: 'flow', label: 'Lead Time', cible: '< 2 semaines', frequence: 'mensuel', regle: { op: '<', seuil: 14 }, unite: ' j', calc: leadTime, alimenter: `\`lead_time_days\` — ${ALIM_DEPLOY}` },
  { id: 'flow-throughput', cat: 'flow', label: 'Throughput', cible: 'Stable ou en hausse', frequence: 'hebdo', regle: { tendance: 'hausse' }, unite: ' / 30 j', calc: debit, alimenter: ALIM_DEPLOY },
  { id: 'flow-wip', cat: 'flow', label: 'WIP', cible: 'Limité — à fixer par l\'équipe', frequence: 'hebdo', regle: null, unite: ' SPEC(s)', calc: (c) => (c.moyenne('standup', 'wip') === null ? null : { valeur: c.moyenne('standup', 'wip') }), alimenter: '`wip` à chaque `/aiad standup`' },
  { id: 'flow-efficiency', cat: 'flow', label: 'Flow Efficiency', cible: 'En hausse', frequence: 'mensuel', regle: null, unite: ' %', calc: efficaciteFlux, alimenter: `\`cycle_time_days\` et \`lead_time_days\` dans le même fichier — ${ALIM_DEPLOY}` },
]);

/** États possibles d'une métrique calculée. */
export const ETATS = Object.freeze(['ok', 'hors-cible', 'mesure', 'perimee', 'non-mesure', 'non-applicable', 'hors-dashboard']);

/** Âge (jours) au-delà duquel une valeur déclarée est « à rafraîchir » : deux périodes de sa fréquence. */
export const PEREMPTION_JOURS = Object.freeze({ hebdo: 14, mensuel: 62, feature: 62, annuel: 730 });

function evaluer(regle, valeur, precedent) {
  if (valeur === null || valeur === undefined) return 'mesure';
  if (!regle) return 'mesure';
  if (regle.op === '<') return valeur < regle.seuil ? 'ok' : 'hors-cible';
  if (regle.op === '>') return valeur > regle.seuil ? 'ok' : 'hors-cible';
  if (regle.tendance) {
    if (precedent === null || precedent === undefined) return 'mesure';
    if (regle.tendance === 'baisse') return valeur <= precedent ? 'ok' : 'hors-cible';
    return valeur >= precedent ? 'ok' : 'hors-cible';
  }
  return 'mesure';
}

const arrondi = (v) => (Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toString().replace('.', ','));

/**
 * Calcule toutes les métriques AIAD depuis les données collectées.
 *
 * @returns {{ id: string, cat: string, label: string, cible: string, frequence: string, alimenter: string, etat: string, valeur: number|null, precedent: number|null, texte: string, source: string|null, age: number|null }[]}
 */
export function calculerMetriquesAiad(donnees) {
  const c = contexte(donnees);
  return METRIQUES.map((m) => {
    const base = { id: m.id, cat: m.cat, label: m.label, cible: m.cible, frequence: m.frequence, alimenter: m.alimenter };
    if (m.horsDashboard) return { ...base, etat: 'hors-dashboard', valeur: null, precedent: null, texte: 'non collecté', source: null, age: null };
    const exclue = c.donnees?.perimetreMetriques?.[m.id];
    if (exclue) return { ...base, etat: 'non-applicable', valeur: null, precedent: null, texte: 'non applicable', source: `${exclue.raison} — décidé par ${exclue.auteur}${exclue.date ? `, ${exclue.date}` : ''}`, age: null };
    let r = null;
    try { r = m.calc(c); } catch { r = null; }
    if (!r) return { ...base, etat: 'non-mesure', valeur: null, precedent: null, texte: '—', source: null, age: null };
    const valeur = r.valeur ?? null;
    const precedent = r.precedent ?? null;
    const texte = r.texte || `${arrondi(valeur)}${m.unite}`;
    const age = r.date ? Math.floor((c.maintenant - r.date) / JOUR) : null;
    const perimee = age !== null && age > (PEREMPTION_JOURS[m.frequence] || 62);
    return {
      ...base,
      etat: perimee ? 'perimee' : (r.anomalie ? 'hors-cible' : evaluer(m.regle, valeur, precedent)),
      valeur,
      precedent,
      texte,
      source: r.source || null,
      age,
    };
  });
}

/** Synthèse par catégorie : mesurées, dans la cible, hors cible. */
export function syntheseCategories(resultats) {
  return CATEGORIES.map((cat) => {
    const ms = resultats.filter((r) => r.cat === cat.id);
    const suivies = ms.filter((r) => r.etat !== 'hors-dashboard' && r.etat !== 'non-applicable');
    return {
      ...cat,
      total: suivies.length,
      mesurees: suivies.filter((r) => r.etat !== 'non-mesure').length,
      perimees: suivies.filter((r) => r.etat === 'perimee').length,
      ok: suivies.filter((r) => r.etat === 'ok').length,
      horsCible: suivies.filter((r) => r.etat === 'hors-cible').length,
    };
  });
}

/**
 * Les trois signaux du framework qui déclenchent une action immédiate (§ 7.6) :
 * Cycle Time qui double, score qualité des SPECs < 3,5 / 5, Change Failure Rate > 15 %.
 *
 * @returns {{ id: string, titre: string, detail: string }[]}
 */
export function signauxImmediats(donnees) {
  const c = contexte(donnees);
  const out = [];
  const ct = c.valeurs('deployments', 'cycle_time_days');
  if (ct.length >= 4) {
    const mi = Math.floor(ct.length / 2);
    const avant = moy(ct.slice(0, mi));
    const apres = moy(ct.slice(mi));
    if (avant > 0 && apres >= avant * 2) out.push({ id: 'cycle-time-double', titre: 'Cycle Time doublé', detail: `${arrondi(avant)} j → ${arrondi(apres)} j sur les derniers déploiements` });
  }
  const sqs = donnees?.metrics?.agregats?.specs?.sqsMoyen;
  if (typeof sqs === 'number' && sqs < 3.5) out.push({ id: 'sqs-faible', titre: 'Score qualité des SPECs sous 3,5 / 5', detail: `SQS moyen : ${arrondi(sqs)} / 5` });
  const cfr = tauxEchec(c);
  if (cfr && cfr.valeur > 15) out.push({ id: 'cfr-eleve', titre: 'Change Failure Rate au-dessus de 15 %', detail: `${arrondi(cfr.valeur)} % des déploiements en échec ou correctif` });
  return out;
}

/** Rituels qui alimentent les métriques déclarées, avec leur cadence maximale tolérée (jours). */
export const RITUELS = Object.freeze([
  { id: 'retro', titre: 'Rétrospective', commande: '/aiad retro', cadence: 21, alimente: 'Efficacité IA, Équipe' },
  { id: 'demo', titre: 'Demo & Feedback', commande: '/aiad demo', cadence: 14, alimente: 'Satisfaction utilisateur' },
  { id: 'sync-strat', titre: 'Synchronisation Alignement Stratégique', commande: '/aiad sync-strat', cadence: 35, alimente: 'Outcomes' },
  { id: 'tech-review', titre: 'Tech Review', commande: '/aiad tech-review', cadence: 35, alimente: 'Dette technique' },
]);

/**
 * État des rituels : dernier compte rendu enregistré et retard éventuel.
 * Un rituel jamais enregistré est « jamais tenu » — pas « en retard ».
 *
 * @returns {{ id: string, titre: string, commande: string, cadence: number, alimente: string, dernier: string|null, joursDepuis: number|null, etat: 'a-jour' | 'en-retard' | 'jamais' }[]}
 */
export function etatRituels(donnees) {
  const c = contexte(donnees);
  return RITUELS.map((r) => {
    const f = c.fichiers(r.id).filter((x) => x.date > 0);
    if (f.length === 0) return { ...r, dernier: null, joursDepuis: null, etat: 'jamais' };
    const date = f[f.length - 1].date;
    const joursDepuis = Math.max(0, Math.floor((c.maintenant - date) / JOUR));
    return { ...r, dernier: new Date(date).toISOString().slice(0, 10), joursDepuis, etat: joursDepuis > r.cadence ? 'en-retard' : 'a-jour' };
  });
}

/**
 * Le critère de drift d'INTENT-038, calculé : métriques qui ne remontent pas
 * (non mesurées), valeurs périmées, rituels en retard ou jamais tenus.
 *
 * @returns {{ drift: boolean, suivies: number, nonMesurees: string[], perimees: string[], rituelsEnRetard: string[], rituelsJamais: string[] }}
 */
export function etatPilotage(donnees) {
  const r = calculerMetriquesAiad(donnees).filter((x) => x.etat !== 'hors-dashboard' && x.etat !== 'non-applicable');
  const rituels = etatRituels(donnees);
  const nonMesurees = r.filter((x) => x.etat === 'non-mesure').map((x) => x.id);
  const perimees = r.filter((x) => x.etat === 'perimee').map((x) => x.id);
  const rituelsEnRetard = rituels.filter((x) => x.etat === 'en-retard').map((x) => x.id);
  const rituelsJamais = rituels.filter((x) => x.etat === 'jamais').map((x) => x.id);
  return { drift: nonMesurees.length + perimees.length + rituelsEnRetard.length > 0, suivies: r.length, nonMesurees, perimees, rituelsEnRetard, rituelsJamais };
}
