// AIAD SDD Mode — `aiad-sdd reflect` (item #101).
//
// **Cap stratégique** : souveraineté + AI-augmented. Plutôt que faire
// tourner les rétrospectives sur un LLM cloud (Anthropic/OpenAI), AIAD
// s'appuie sur **Ollama local** (réutilise `appelerOllama` de `lib/score.js`)
// pour compiler les artefacts d'un sprint et proposer 3-5 axes
// d'amélioration **sans qu'aucune donnée projet ne quitte la machine**.
//
// **Périmètre par défaut** : 7 derniers jours, mais reconfigurable via
// `--since <ISO date>` ou `--branch <ref>`.
//
// **Données collectées** :
//   - Intents et SPECs modifiés/créés sur la fenêtre
//   - Facts journalisés dans `.aiad/facts/`
//   - Drifts détectés via `.aiad/metrics/traceability/`
//   - Métriques hook (latences p50/p95) si présentes
//
// **Réponse** : 3-5 axes structurés au format JSON :
//   { axes: [{ titre, observation, recommandation, priorite }] }
//
// fetch injectable (option `fetch`) pour tests sans Ollama réel.
//
// Documentation : https://aiad.ovh/reflect

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';
import { appelerOllama } from './score.js';
import { C, logHeader } from './term.js';

const FENETRE_DEFAUT_JOURS = 7;

// ─── Collecte ──────────────────────────────────────────────────────────────

/**
 * Liste les fichiers .md d'un dossier modifiés depuis `since` (Date).
 *
 * @param {string} racine
 * @param {string} sous — sous-dossier dans .aiad/ (ex: 'intents', 'specs', 'facts')
 * @param {Date} since
 * @returns {{ id: string, path: string, mtime: Date, frontmatter: object, body: string }[]}
 */
export function listerArtefactsRecents(racine, sous, since) {
  const dir = join(racine, '.aiad', sous);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    if (f.startsWith('_') || f.startsWith('spec-ears-template')) continue;
    const path = join(dir, f);
    let st;
    try { st = statSync(path); } catch { continue; }
    if (st.mtime < since) continue;
    const contenu = readFileSync(path, 'utf-8');
    const { data, body } = parseFrontmatter(contenu);
    out.push({
      id: f.replace(/\.md$/, ''),
      path,
      mtime: st.mtime,
      frontmatter: data,
      body,
    });
  }
  return out.sort((a, b) => a.mtime - b.mtime);
}

/**
 * Lit la dernière matrice de traçabilité JSON pour extraire les drifts.
 */
export function lireDrifts(racine) {
  const path = join(racine, '.aiad', 'metrics', 'traceability', 'matrix.json');
  if (!existsSync(path)) return [];
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    return Array.isArray(data.gaps) ? data.gaps : [];
  } catch { return []; }
}

/**
 * Lit les statistiques d'exécution du hook pre-commit (item #91).
 */
export function lireMetriquesHook(racine) {
  const path = join(racine, '.aiad', 'metrics', 'hook-runs.jsonl');
  if (!existsSync(path)) return null;
  try {
    const events = readFileSync(path, 'utf-8').split('\n')
      .filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
    if (events.length === 0) return null;
    const durations = events.map((e) => e.durationMs).sort((a, b) => a - b);
    const p = (q) => durations[Math.min(durations.length - 1, Math.floor(durations.length * q))];
    const fails = events.filter((e) => e.exitCode !== 0).length;
    return {
      total: events.length,
      p50: p(0.5),
      p95: p(0.95),
      ratioFail: events.length > 0 ? fails / events.length : 0,
    };
  } catch { return null; }
}

/**
 * Construit l'inventaire complet d'un sprint.
 *
 * @param {string} racine
 * @param {{ since?: Date, jours?: number }} [options]
 */
export function collecterSprint(racine, options = {}) {
  const since = options.since || new Date(Date.now() - (options.jours || FENETRE_DEFAUT_JOURS) * 24 * 3600 * 1000);
  return {
    since: since.toISOString(),
    intents: listerArtefactsRecents(racine, 'intents', since),
    specs: listerArtefactsRecents(racine, 'specs', since),
    facts: listerArtefactsRecents(racine, 'facts', since),
    drifts: lireDrifts(racine),
    hookMetrics: lireMetriquesHook(racine),
  };
}

// ─── Prompt Ollama ─────────────────────────────────────────────────────────

/**
 * Construit le prompt de rétrospective pour Ollama.
 *
 * Le prompt est entièrement en français, demande une réponse JSON stricte.
 *
 * @param {object} sprint — résultat de collecterSprint
 * @returns {string}
 */
export function construirePromptReflect(sprint) {
  const lignes = [];
  lignes.push('Tu es un coach AIAD spécialisé dans les rétrospectives Spec Driven Development.');
  lignes.push('Analyse les artefacts d\'un sprint et propose 3 à 5 axes d\'amélioration concrets.');
  lignes.push('');
  lignes.push(`# Sprint depuis ${sprint.since}`);
  lignes.push('');
  lignes.push(`## Intents (${sprint.intents.length})`);
  for (const it of sprint.intents.slice(0, 20)) {
    const t = it.frontmatter.title || it.frontmatter.titre || it.id;
    const extrait = (it.body || '').slice(0, 200).replace(/\s+/g, ' ').trim();
    lignes.push(`- **${it.id}** [${it.mtime.toISOString().slice(0, 10)}] ${t}`);
    if (extrait) lignes.push(`  > ${extrait}${it.body.length > 200 ? '…' : ''}`);
  }
  lignes.push('');
  lignes.push(`## SPECs (${sprint.specs.length})`);
  for (const sp of sprint.specs.slice(0, 20)) {
    const t = sp.frontmatter.title || sp.frontmatter.titre || sp.id;
    lignes.push(`- **${sp.id}** [${sp.mtime.toISOString().slice(0, 10)}] ${t}`);
  }
  lignes.push('');
  if (sprint.facts.length > 0) {
    lignes.push(`## Facts journalisés (${sprint.facts.length})`);
    for (const f of sprint.facts.slice(0, 10)) {
      const t = f.frontmatter.title || f.id;
      lignes.push(`- ${f.id} : ${t}`);
    }
    lignes.push('');
  }
  if (sprint.drifts.length > 0) {
    lignes.push(`## Drifts détectés (${sprint.drifts.length})`);
    for (const d of sprint.drifts.slice(0, 10)) {
      const desc = typeof d === 'string' ? d : (d.message || d.kind || JSON.stringify(d));
      lignes.push(`- ${desc}`);
    }
    lignes.push('');
  }
  if (sprint.hookMetrics) {
    lignes.push('## Métriques du hook pre-commit');
    lignes.push(`- ${sprint.hookMetrics.total} exécutions, p50=${sprint.hookMetrics.p50}ms, p95=${sprint.hookMetrics.p95}ms, ratio fail=${(sprint.hookMetrics.ratioFail * 100).toFixed(1)}%`);
    lignes.push('');
  }
  lignes.push('---');
  lignes.push('');
  lignes.push('Réponds STRICTEMENT au format JSON suivant (aucun texte avant/après) :');
  lignes.push('');
  lignes.push('{');
  lignes.push('  "axes": [');
  lignes.push('    { "titre": "string court", "observation": "constat factuel", "recommandation": "action concrète", "priorite": "haute|moyenne|basse" }');
  lignes.push('  ]');
  lignes.push('}');
  lignes.push('');
  lignes.push('Contraintes :');
  lignes.push('- 3 à 5 axes maximum');
  lignes.push('- Observations factuelles (cite des Intent/SPEC IDs si pertinent)');
  lignes.push('- Recommandations actionnables (verbes d\'action, échéance implicite ≤ sprint suivant)');
  lignes.push('- Priorise selon impact réel sur la qualité, pas sur la complexité');
  return lignes.join('\n');
}

// ─── Parsing réponse ───────────────────────────────────────────────────────

/**
 * Parse la réponse Ollama en structure d'axes. Robuste aux préambules.
 */
export function parserAxes(brut) {
  if (typeof brut !== 'string') throw new Error('Réponse Ollama vide.');
  // Cherche le premier { et essaie de parser le JSON jusqu'à la fin
  const debut = brut.indexOf('{');
  if (debut === -1) throw new Error('Réponse Ollama sans JSON détectable.');
  const candidat = brut.slice(debut);
  // Tente plusieurs longueurs : on coupe à la dernière `}`
  const fin = candidat.lastIndexOf('}');
  if (fin === -1) throw new Error('Réponse Ollama sans `}` final.');
  const json = candidat.slice(0, fin + 1);
  let data;
  try { data = JSON.parse(json); }
  catch (err) { throw new Error(`JSON Ollama invalide : ${err.message}`); }
  if (!Array.isArray(data.axes)) throw new Error('Champ `axes` manquant ou non-array.');
  // Normalisation
  return data.axes.slice(0, 5).map((a) => ({
    titre: String(a.titre || a.title || '').trim(),
    observation: String(a.observation || a.observation || '').trim(),
    recommandation: String(a.recommandation || a.recommendation || '').trim(),
    priorite: ['haute', 'moyenne', 'basse'].includes(a.priorite) ? a.priorite : 'moyenne',
  }));
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Exécute la rétrospective : collecte → prompt → Ollama → parse.
 *
 * @param {string} racine
 * @param {{ since?: string|Date, jours?: number, url?: string, model?: string, fetch?: Function, json?: boolean, out?: string }} [options]
 */
export async function reflect(racine, options = {}) {
  const since = options.since
    ? (typeof options.since === 'string' ? new Date(options.since) : options.since)
    : undefined;
  const sprint = collecterSprint(racine, { since, jours: options.jours });

  if (sprint.intents.length === 0 && sprint.specs.length === 0 && sprint.facts.length === 0) {
    if (options.json) {
      process.stdout.write(JSON.stringify({ axes: [], raison: 'aucun artefact dans la fenêtre' }, null, 2) + '\n');
      return { axes: [], raison: 'aucun artefact' };
    }
    console.log(`\n  ${C.gris}Aucun artefact (Intent/SPEC/Fact) modifié depuis ${sprint.since}.${C.reset}\n`);
    return { axes: [], raison: 'aucun artefact' };
  }

  const prompt = construirePromptReflect(sprint);
  const brut = await appelerOllama(prompt, {
    url: options.url, model: options.model, fetch: options.fetch,
  });
  const axes = parserAxes(brut);

  if (options.json) {
    process.stdout.write(JSON.stringify({ since: sprint.since, axes }, null, 2) + '\n');
    return { since: sprint.since, axes };
  }

  logHeader('AIAD SDD — Rétrospective (Ollama local)', `${axes.length} axe(s) d'amélioration · sprint depuis ${sprint.since.slice(0, 10)}`);
  for (const a of axes) {
    const couleur = a.priorite === 'haute' ? C.rouge : a.priorite === 'basse' ? C.gris : C.jaune;
    console.log(`\n  ${couleur}● ${a.priorite.toUpperCase()}${C.reset}  ${C.gras}${a.titre}${C.reset}`);
    console.log(`    ${C.gris}Observation${C.reset}     : ${a.observation}`);
    console.log(`    ${C.gris}Recommandation${C.reset}  : ${a.recommandation}`);
  }
  console.log('');
  return { since: sprint.since, axes };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  listerArtefactsRecents as listRecentArtifacts,
  lireDrifts as readDrifts,
  lireMetriquesHook as readHookMetrics,
  collecterSprint as collectSprint,
  construirePromptReflect as buildReflectPrompt,
  parserAxes as parseAxes,
  reflect as reflectSprint,
};

export const CONSTANTS = {
  FENETRE_DEFAUT_JOURS,
};
