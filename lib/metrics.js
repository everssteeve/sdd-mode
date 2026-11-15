// AIAD SDD Mode — Métriques AIAD : enregistrement outillé et état de pilotage.
//
// `aiad-sdd metrics` :
//   status            — où en sont les métriques du framework (mesurées, dans
//                       la cible, à rafraîchir, non mesurées) et les rituels ;
//   check             — même calcul, exit 1 si le pilotage est en drift :
//                       une métrique ne remonte pas, une valeur est périmée
//                       ou un rituel est en retard ;
//   record <cat> k=v… — écrit un fichier de métriques valide dans
//                       `.aiad/metrics/<cat>/`, clés et valeurs contrôlées ;
//   keys [cat]        — les clés acceptées ;
//   exclude <id> raison=… auteur=… — déclare une métrique non applicable au
//                       projet (décision humaine tracée) ; include <id> l'annule.
//
// L'enregistrement est déterministe : les rituels (`/aiad retro`,
// `/aiad sync-strat`, `/aiad demo`, `/aiad tech-review`) et `/sdd gate`
// l'appellent au lieu d'écrire le fichier à la main. Les valeurs déclarées
// viennent des humains ; la commande les contrôle, elle ne les invente pas.
//
// @intent INTENT-038
// @spec SPEC-038-2-instrumentation-metriques
// @verified-by test/metrics.test.js
// @governance AIAD-RGPD
//
// Documentation : https://aiad.ovh

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { C, log, logHeader } from './term.js';
import { enrichir } from './dashboard/model/index.js';
import { CATEGORIES, METRIQUES, calculerMetriquesAiad, syntheseCategories, etatRituels, etatPilotage } from './dashboard/aiad-metrics.js';

const PCT = { type: 'nombre', min: 0, max: 100 };
const NOTE = { type: 'nombre', min: 0, max: 10 };
const N = { type: 'nombre', min: 0 };
const TEXTE = { type: 'texte' };

/** Clés acceptées par catégorie de `.aiad/metrics/`. */
export const CLES = Object.freeze({
  retro: {
    iteration: TEXTE, specs_livrees: N, taux_premier_passage: PCT, sqs_moyen: { type: 'nombre', min: 0, max: 5 }, drifts_detectes: N,
    lessons_learned_ajoutes: N, human_learnings_ajoutes: N, actions_count: N,
    adoption_agents_pct: PCT, agents_first_time_success_pct: PCT, code_genere_pct: PCT, iterations_par_feature: N,
    faux_positifs_pct: PCT, resolution_agents_heures: N, satisfaction_pe: NOTE,
    satisfaction_equipe: NOTE, psychological_safety: NOTE, temps_flow_heures: { type: 'nombre', min: 0, max: 24 },
  },
  'sync-strat': {
    intents_actifs: N, intents_at_risk: N, intents_revised: N, decisions_count: N, backlog_size: N,
    adoption_pct: PCT, time_to_value_min: N, retention_pct: PCT, business_impact: TEXTE,
  },
  demo: { features_demo_count: N, feedbacks_count: N, feedbacks_positifs: N, feedbacks_negatifs: N, decisions_count: N, nps_indicatif: NOTE },
  'tech-review': { dette_items_count: N, dette_critique_count: N, adrs_added: N, adrs_revised: N, actions_count: N, composants_en_attention: N, composants_critiques: N },
  standup: { wip: N, blocages_count: N, actions_count: N },
  specs: {
    spec_id: { ...TEXTE, requis: true }, intent_id: TEXTE, sqs_score: { type: 'nombre', min: 0, max: 5 },
    gate_result: { type: 'enum', valeurs: ['open', 'closed'], requis: true }, attempts: { type: 'nombre', min: 1 },
    critere_etranger: { type: 'enum', valeurs: ['pass', 'fail', 'partial'] },
  },
  validations: {
    spec_id: { ...TEXTE, requis: true }, verdict: { type: 'enum', valeurs: ['valide', 'corrections', 'echec'], requis: true }, attempts: { type: 'nombre', min: 1 },
  },
  deployments: {
    status: { type: 'enum', valeurs: ['success', 'hotfix', 'failed', 'failure'], requis: true }, spec_id: TEXTE, version: TEXTE,
    cycle_time_days: N, lead_time_days: N, mttr_hours: N, mttd_hours: N,
  },
});

/** Clés refusées quelle que soit la catégorie : données RH et de santé. */
export const CLES_INTERDITES = Object.freeze(['turnover', 'turnover_pct', 'sick_days', 'jours_maladie', 'arrets_maladie']);

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** Découpe `clé=valeur` ; la valeur peut contenir des `=`. */
export function lirePaires(args) {
  const paires = {};
  const erreurs = [];
  for (const a of args || []) {
    const i = String(a).indexOf('=');
    if (i <= 0) { erreurs.push(`Argument illisible : « ${a} » (attendu : clé=valeur).`); continue; }
    paires[a.slice(0, i).trim()] = a.slice(i + 1).trim();
  }
  return { paires, erreurs };
}

function controler(categorie, paires) {
  const schema = CLES[categorie];
  const erreurs = [];
  const valeurs = {};
  for (const [cle, brut] of Object.entries(paires)) {
    if (CLES_INTERDITES.includes(cle)) { erreurs.push(`« ${cle} » est une donnée RH ou de santé : elle ne s'enregistre pas dans .aiad/metrics/.`); continue; }
    const regle = schema[cle];
    if (!regle) { erreurs.push(`Clé inconnue pour ${categorie} : « ${cle} ». Voir \`aiad-sdd metrics keys ${categorie}\`.`); continue; }
    if (brut === 'null' || brut === '') { valeurs[cle] = null; continue; }
    if (regle.type === 'nombre') {
      const v = Number(String(brut).replace(',', '.'));
      if (Number.isNaN(v)) { erreurs.push(`« ${cle} » attend un nombre (reçu : « ${brut} »).`); continue; }
      if (regle.min !== undefined && v < regle.min) { erreurs.push(`« ${cle} » doit être ≥ ${regle.min} (reçu : ${v}).`); continue; }
      if (regle.max !== undefined && v > regle.max) { erreurs.push(`« ${cle} » doit être ≤ ${regle.max} (reçu : ${v}).`); continue; }
      valeurs[cle] = v;
    } else if (regle.type === 'enum') {
      if (!regle.valeurs.includes(brut)) { erreurs.push(`« ${cle} » attend ${regle.valeurs.join(' | ')} (reçu : « ${brut} »).`); continue; }
      valeurs[cle] = brut;
    } else {
      valeurs[cle] = String(brut).replace(/[\r\n]+/g, ' ');
    }
  }
  for (const [cle, regle] of Object.entries(schema)) {
    if (regle.requis && (valeurs[cle] === undefined || valeurs[cle] === null)) erreurs.push(`« ${cle} » est requis pour ${categorie}.`);
  }
  return { valeurs, erreurs };
}

/** Nombre de passages déjà enregistrés à la Gate pour une SPEC. */
function passagesGate(dir, specId) {
  let n = 0;
  try {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      if (new RegExp(`^spec_id:\\s*${specId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm').test(readFileSync(join(dir, f), 'utf-8'))) n++;
    }
  } catch { /* dossier absent */ }
  return n;
}

/**
 * Écrit un fichier de métriques. N'écrase jamais un fichier existant.
 *
 * @param {string} racine
 * @param {string} categorie
 * @param {Record<string, string>} paires valeurs brutes (`clé → texte`)
 * @param {{ date?: string }} [options] date AAAA-MM-JJ (défaut : aujourd'hui)
 * @returns {{ ok: boolean, fichier: string|null, valeurs: Record<string, unknown>, erreurs: string[] }}
 */
export function enregistrerMetriques(racine, categorie, paires, options = {}) {
  if (!CLES[categorie]) {
    return { ok: false, fichier: null, valeurs: {}, erreurs: [`Catégorie inconnue : « ${categorie || ''} ». Catégories : ${Object.keys(CLES).join(', ')}.`] };
  }
  if (!existsSync(join(racine, '.aiad'))) {
    return { ok: false, fichier: null, valeurs: {}, erreurs: ['Pas de dossier .aiad/ — initialise le projet avec `npx aiad-sdd init`.'] };
  }
  const { valeurs, erreurs } = controler(categorie, paires || {});
  if (Object.keys(paires || {}).length === 0) erreurs.push('Aucune métrique fournie (attendu : clé=valeur …).');
  const date = options.date || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) erreurs.push(`Date invalide : « ${date} » (attendu : AAAA-MM-JJ).`);
  if (erreurs.length) return { ok: false, fichier: null, valeurs, erreurs };

  const dir = join(racine, '.aiad', 'metrics', categorie);
  if ((categorie === 'specs' || categorie === 'validations') && valeurs.attempts === undefined) valeurs.attempts = passagesGate(dir, valeurs.spec_id) + 1;
  const suffixe = categorie === 'specs' || categorie === 'validations' ? `-${slug(valeurs.spec_id)}`
    : (categorie === 'deployments' ? `-${slug(valeurs.spec_id || valeurs.version || 'deploy')}` : '');
  mkdirSync(dir, { recursive: true });
  let nom = `${date}${suffixe}.md`;
  for (let i = 2; existsSync(join(dir, nom)); i++) nom = `${date}${suffixe}-${i}.md`;
  const type = { specs: 'spec_gate', deployments: 'deployment', validations: 'validation' }[categorie] || categorie;
  const lignes = Object.entries(valeurs).map(([k, v]) => `${k}: ${v === null ? 'null' : v}`);
  writeFileSync(join(dir, nom), `---\ndate: ${date}\ntype: ${type}\n---\n\n${lignes.join('\n')}\n`, 'utf-8');
  return { ok: true, fichier: `.aiad/metrics/${categorie}/${nom}`, valeurs, erreurs: [] };
}

/**
 * Déclare une métrique non applicable au projet — ou la réintègre.
 * Décision humaine : une raison et un auteur sont exigés, et tracés dans
 * `.aiad/metrics/scope.json`.
 *
 * @param {string} racine
 * @param {string} id identifiant de métrique (`aiad-sdd metrics status --json`)
 * @param {{ raison?: string, auteur?: string, inclure?: boolean, date?: string }} options
 * @returns {{ ok: boolean, erreurs: string[], non_applicables: Record<string, unknown> }}
 */
export function definirPerimetre(racine, id, options = {}) {
  const chemin = join(racine, '.aiad', 'metrics', 'scope.json');
  let scope = { non_applicables: {} };
  if (existsSync(chemin)) {
    try { scope = JSON.parse(readFileSync(chemin, 'utf-8')); } catch { return { ok: false, erreurs: ['scope.json illisible (JSON invalide) — aucun changement.'], non_applicables: {} }; }
    if (!scope || typeof scope.non_applicables !== 'object' || !scope.non_applicables) scope = { non_applicables: {} };
  }
  const erreurs = [];
  const def = METRIQUES.find((m) => m.id === id);
  if (!existsSync(join(racine, '.aiad'))) erreurs.push('Pas de dossier .aiad/ — initialise le projet avec `npx aiad-sdd init`.');
  if (!def) erreurs.push(`Métrique inconnue : « ${id || ''} ». Voir \`aiad-sdd metrics status --json\`.`);
  else if (def.horsDashboard) erreurs.push(`« ${id} » n'est pas collectée par le dashboard : rien à exclure.`);
  if (!options.inclure) {
    if (!String(options.raison || '').trim()) erreurs.push('Une raison est requise (raison="…").');
    if (!String(options.auteur || '').trim()) erreurs.push('Un auteur humain est requis (auteur="…") : écarter une métrique est une décision.');
  }
  if (erreurs.length) return { ok: false, erreurs, non_applicables: scope.non_applicables };
  if (options.inclure) delete scope.non_applicables[id];
  else scope.non_applicables[id] = { raison: String(options.raison).trim(), auteur: String(options.auteur).trim(), date: options.date || new Date().toISOString().slice(0, 10) };
  mkdirSync(join(racine, '.aiad', 'metrics'), { recursive: true });
  writeFileSync(chemin, JSON.stringify({ non_applicables: scope.non_applicables }, null, 2) + '\n', 'utf-8');
  return { ok: true, erreurs: [], non_applicables: scope.non_applicables };
}

/** État complet, pour `status --json`, `check` et les intégrations. */
export async function etatMetriques(racine) {
  const donnees = await enrichir(racine);
  const metriques = calculerMetriquesAiad(donnees);
  return {
    pilotage: etatPilotage(donnees),
    categories: syntheseCategories(metriques).map(({ id, titre, total, mesurees, ok, horsCible, perimees }) => ({ id, titre, total, mesurees, ok, horsCible, perimees })),
    rituels: etatRituels(donnees),
    metriques: metriques.map(({ id, cat, label, cible, etat, texte, source, age }) => ({ id, cat, label, cible, etat, valeur: texte, source, age })),
  };
}

function afficherEtat(e) {
  const p = e.pilotage;
  const mesurees = p.suivies - p.nonMesurees.length;
  logHeader('AIAD SDD Mode — Métriques AIAD', `${mesurees} / ${p.suivies} métriques remontent`);
  for (const c of e.categories) {
    const sym = c.mesurees === c.total ? `${C.vert}✓${C.reset}` : (c.mesurees === 0 ? `${C.rouge}✗${C.reset}` : `${C.jaune}~${C.reset}`);
    log(sym, `${C.gras}${c.titre.padEnd(14)}${C.reset} ${c.mesurees}/${c.total} mesurée(s) · ${c.ok} dans la cible · ${c.horsCible} hors cible${c.perimees ? ` · ${c.perimees} à rafraîchir` : ''}`);
  }
  console.log(`\n${C.gras}  Rituels${C.reset}\n`);
  for (const r of e.rituels) {
    const [sym, texte] = r.etat === 'a-jour' ? [`${C.vert}✓${C.reset}`, `il y a ${r.joursDepuis} j`]
      : (r.etat === 'en-retard' ? [`${C.rouge}✗${C.reset}`, `en retard — dernier il y a ${r.joursDepuis} j (cadence ${r.cadence} j)`] : [`${C.gris}-${C.reset}`, 'jamais enregistré']);
    log(sym, `${r.titre} ${C.gris}(${r.commande}, alimente : ${r.alimente})${C.reset} — ${texte}`);
  }
  if (p.nonMesurees.length) console.log(`\n  ${C.gris}Sans donnée : ${p.nonMesurees.join(', ')}${C.reset}`);
  if (p.perimees.length) console.log(`  ${C.gris}À rafraîchir : ${p.perimees.join(', ')}${C.reset}`);
  console.log(p.drift
    ? `\n${C.jaune}${C.gras}  ⚠ Pilotage en drift : des métriques ne remontent pas dans le dashboard.${C.reset}\n  ${C.gris}Détail et moyens d'alimentation : aiad-sdd dashboard → page « Métriques AIAD ».${C.reset}\n`
    : `\n${C.vert}${C.gras}  ✓ Toutes les métriques suivies remontent.${C.reset}\n`);
}

/**
 * Point d'entrée CLI : `aiad-sdd metrics [status|check|record|keys] …`.
 *
 * @returns {Promise<number>} code de sortie
 */
export async function commandeMetrics(racine, sub, args = [], options = {}) {
  const { json = false } = options;

  if (!sub || sub === 'status' || sub === 'check') {
    if (!existsSync(join(racine, '.aiad'))) { console.error('\n  Pas de dossier .aiad/ — initialise le projet avec `npx aiad-sdd init`.\n'); return 1; }
    const e = await etatMetriques(racine);
    if (json) process.stdout.write(JSON.stringify(e, null, 2) + '\n');
    else afficherEtat(e);
    return sub === 'check' && e.pilotage.drift ? 1 : 0;
  }

  if (sub === 'record') {
    const [categorie, ...reste] = args;
    const { paires, erreurs } = lirePaires(reste);
    const r = erreurs.length ? { ok: false, fichier: null, valeurs: {}, erreurs } : enregistrerMetriques(racine, categorie, paires);
    if (json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    else if (r.ok) console.log(`\n  ${C.vert}✓${C.reset} ${Object.keys(r.valeurs).length} métrique(s) enregistrée(s) dans ${r.fichier}\n`);
    else console.error(`\n${r.erreurs.map((m) => `  ${C.rouge}✗${C.reset} ${m}`).join('\n')}\n`);
    return r.ok ? 0 : 1;
  }

  if (sub === 'exclude' || sub === 'include') {
    const [id, ...reste] = args;
    const { paires, erreurs } = lirePaires(reste);
    const r = erreurs.length ? { ok: false, erreurs, non_applicables: {} }
      : definirPerimetre(racine, id, { raison: paires.raison, auteur: paires.auteur, inclure: sub === 'include' });
    if (json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    else if (r.ok) console.log(`\n  ${C.vert}✓${C.reset} ${id} ${sub === 'include' ? 'réintégrée au suivi' : 'déclarée non applicable'} (.aiad/metrics/scope.json)\n`);
    else console.error(`\n${r.erreurs.map((m) => `  ${C.rouge}✗${C.reset} ${m}`).join('\n')}\n`);
    return r.ok ? 0 : 1;
  }

  if (sub === 'keys') {
    const cats = args[0] ? [args[0]] : Object.keys(CLES);
    if (args[0] && !CLES[args[0]]) { console.error(`\n  Catégorie inconnue : « ${args[0]} ». Catégories : ${Object.keys(CLES).join(', ')}.\n`); return 1; }
    const out = Object.fromEntries(cats.map((c) => [c, CLES[c]]));
    if (json) process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    else for (const c of cats) console.log(`\n  ${C.gras}${c}${C.reset}\n    ${Object.entries(CLES[c]).map(([k, r]) => `${k}${r.requis ? '*' : ''}`).join(', ')}`);
    if (!json) console.log(`\n  ${C.gris}* requis · catégories suivies : ${CATEGORIES.map((c) => c.titre).join(', ')}${C.reset}\n`);
    return 0;
  }

  console.error(`\n  Sous-commande inconnue : "${sub}"\n  Disponible : aiad-sdd metrics status | check | record <catégorie> clé=valeur … | keys [catégorie] | exclude <id> raison=… auteur=… | include <id>\n`);
  return 1;
}
