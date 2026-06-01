// AIAD SDD Mode — Benchmark continu + régression alerts (item #127).
//
// **Cap stratégique** : `aiad-sdd bench` (#9 lib/coldstart.js) mesure le
// poids du cold-start system prompt. Sans historique, impossible de
// **détecter une régression** : un commit ajoute 200 tokens sans s'en
// rendre compte. Ce module ajoute :
//
//   1. **Persistance JSONL** dans `.aiad/metrics/bench-history.jsonl` —
//      append-only, un run par ligne avec timestamp.
//   2. **Comparaison fenêtre récente vs ancienne** — exit 1 si la
//      régression sur `apresTokens` dépasse un seuil (défaut 20%).
//
// **Granularité** : on track `apresTokens` (état stable, post-router) en
// indicateur principal — c'est ce que paie réellement chaque cold-start
// agent. Les `routers.count` et `alias.count` sont aussi loggés pour
// contexte.
//
// **Usage typique en CI** :
//   ```yaml
//   - run: npx aiad-sdd bench --persist
//   - run: npx aiad-sdd bench compare --since 14 --threshold 0.2 || true
//   ```
//
// **Zero-dep** : fs/JSON natifs.
//
// Documentation : https://aiad.ovh/bench-history

import { existsSync, readFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { C, logHeader } from './term.js';

const LOG_PATH = '.aiad/metrics/bench-history.jsonl';
const SEUIL_REGRESSION_DEFAUT = 0.2; // +20 % sur apresTokens
const SINCE_DEFAUT_JOURS = 14;

// ─── Persistance ──────────────────────────────────────────────────────────

/**
 * Ajoute un run au log historique.
 *
 * @param {string} racine
 * @param {object} resultatBench — sortie de `bench()` de coldstart.js
 * @returns {{ path: string, entry: object }}
 */
export function appendRun(racine, resultatBench) {
  const path = join(racine, LOG_PATH);
  if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
  const entry = {
    ts: new Date().toISOString(),
    apresTokens: resultatBench.apresTokens || 0,
    apresBytes: resultatBench.apresBytes || 0,
    transitionTokens: resultatBench.transitionTokens || 0,
    avantTokens: resultatBench.avantTokens || 0,
    routersCount: resultatBench.routers?.count || 0,
    aliasCount: resultatBench.alias?.count || 0,
  };
  appendFileSync(path, JSON.stringify(entry) + '\n', 'utf-8');
  return { path: LOG_PATH, entry };
}

/**
 * Lit l'historique complet.
 */
export function lireHistorique(racine) {
  const path = join(racine, LOG_PATH);
  if (!existsSync(path)) return [];
  const out = [];
  for (const ligne of readFileSync(path, 'utf-8').split('\n').filter(Boolean)) {
    try { out.push(JSON.parse(ligne)); }
    catch { /* corrompu, ignoré */ }
  }
  return out;
}

// ─── Comparaison ──────────────────────────────────────────────────────────

/**
 * Compare la **fenêtre récente** (N derniers jours) à la **fenêtre
 * antérieure** (de même longueur, juste avant).
 *
 * Une régression est détectée si la moyenne `apresTokens` récente est
 * **supérieure** de plus de `threshold` (ratio, défaut 0.2 = 20%) à la
 * moyenne antérieure.
 *
 * @param {object[]} historique
 * @param {{ since?: number, threshold?: number, now?: Date }} [options]
 * @returns {{
 *   recents: object[], anciens: object[],
 *   moyenneRecente: number, moyenneAncienne: number,
 *   delta: number, ratio: number,
 *   regression: boolean, suffisant: boolean
 * }}
 */
export function comparer(historique, options = {}) {
  const sinceJours = options.since ?? SINCE_DEFAUT_JOURS;
  const seuil = options.threshold ?? SEUIL_REGRESSION_DEFAUT;
  const now = options.now || new Date();

  const limiteRecente = new Date(now.getTime() - sinceJours * 24 * 3600 * 1000);
  const limiteAncienne = new Date(limiteRecente.getTime() - sinceJours * 24 * 3600 * 1000);

  const recents = [];
  const anciens = [];
  for (const e of historique) {
    const t = new Date(e.ts);
    if (Number.isNaN(t.getTime())) continue;
    if (t >= limiteRecente && t <= now) recents.push(e);
    else if (t >= limiteAncienne && t < limiteRecente) anciens.push(e);
  }

  const suffisant = recents.length >= 2 && anciens.length >= 2;
  if (!suffisant) {
    return {
      recents, anciens,
      moyenneRecente: 0, moyenneAncienne: 0,
      delta: 0, ratio: 0, regression: false, suffisant: false,
    };
  }

  const moyenne = (arr) => arr.reduce((s, e) => s + (e.apresTokens || 0), 0) / arr.length;
  const moyenneRecente = moyenne(recents);
  const moyenneAncienne = moyenne(anciens);
  const delta = moyenneRecente - moyenneAncienne;
  const ratio = moyenneAncienne > 0 ? delta / moyenneAncienne : 0;
  const regression = ratio > seuil;

  return {
    recents, anciens,
    moyenneRecente: Math.round(moyenneRecente * 10) / 10,
    moyenneAncienne: Math.round(moyenneAncienne * 10) / 10,
    delta: Math.round(delta * 10) / 10,
    ratio: Math.round(ratio * 1000) / 1000,
    regression,
    suffisant,
  };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

/**
 * Affiche le résultat de la comparaison.
 *
 * @param {string} racine
 * @param {{ since?: number, threshold?: number, json?: boolean }} [options]
 * @returns {object}
 */
export function compareCli(racine, options = {}) {
  const historique = lireHistorique(racine);
  const r = comparer(historique, options);

  if (options.json) {
    process.stdout.write(JSON.stringify({
      totalRuns: historique.length,
      since: options.since ?? SINCE_DEFAUT_JOURS,
      threshold: options.threshold ?? SEUIL_REGRESSION_DEFAUT,
      ...r,
    }, null, 2) + '\n');
    return r;
  }

  logHeader(
    'AIAD SDD — Bench history compare',
    `${historique.length} run(s) loggés · fenêtre ${options.since ?? SINCE_DEFAUT_JOURS} jours`,
  );
  if (!r.suffisant) {
    console.log(`  ${C.gris}~ Données insuffisantes (≥ 2 runs récents ET ≥ 2 anciens requis).${C.reset}`);
    console.log(`    Recents : ${r.recents.length} · Anciens : ${r.anciens.length}\n`);
    console.log(`  ${C.gris}Pour alimenter : aiad-sdd bench --persist (CI à chaque commit/PR).${C.reset}\n`);
    return r;
  }
  const couleur = r.regression ? C.rouge : C.vert;
  console.log(`  ${couleur}● ${r.regression ? 'RÉGRESSION DÉTECTÉE' : 'Stable'}${C.reset}`);
  console.log(`    Ancien (moy.) : ${r.moyenneAncienne} tokens`);
  console.log(`    Récent (moy.) : ${r.moyenneRecente} tokens`);
  console.log(`    Delta         : ${r.delta > 0 ? '+' : ''}${r.delta} (${(r.ratio * 100).toFixed(1)}%)`);
  console.log(`    Seuil         : ${((options.threshold ?? SEUIL_REGRESSION_DEFAUT) * 100).toFixed(0)}%`);
  console.log('');
  return r;
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  appendRun as logRun,
  lireHistorique as readHistory,
  comparer as compare,
  compareCli as compareCommand,
};

export const CONSTANTS = {
  LOG_PATH,
  SEUIL_REGRESSION_DEFAUT,
  SINCE_DEFAUT_JOURS,
};
