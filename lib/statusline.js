// AIAD SDD Mode — statusLine native + état SDD live (item §3.11 SPEC-A).
//
// **Cap stratégique** : brancher l'observabilité sur les primitives natives
// plutôt que sur des commandes maison. Claude Code passe sur stdin un JSON
// (`cost`, `context_window.used_percentage`, `effort.level`, `model`, `github`)
// à la commande déclarée dans `settings.statusLine.command`. On enrichit cette
// ligne d'un **état SDD** lu du projet : SPEC active, état de Gate (via SQS),
// prochaine étape du cycle (§3.9). L'objectif est de garder le PE conscient,
// à chaque tour, d'où il en est dans le cycle — sans ouvrir une commande.
//
// **Pur & zero-dep** : `construireStatusline` ne fait aucune I/O (testable) ;
// `etatSdd` lit le projet ; le CLI lit stdin et écrit la ligne.
//
// @intent INTENT-009
// @spec SPEC-009-1-observabilite-native
// @verified-by test/statusline.test.js
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Lit la note de session depuis `.aiad/session-note` (une ligne, ~60 chars max).
 * @param {string} projetDir
 * @returns {string|null}
 */
export function lireNoteSession(projetDir) {
  const f = join(projetDir, '.aiad', 'session-note');
  if (!existsSync(f)) return null;
  const line = readFileSync(f, 'utf-8').split('\n')[0].trim();
  return line || null;
}

/** Statuts de SPEC considérés « actifs » (en cours de cycle), par priorité. */
const STATUTS_ACTIFS = ['in-progress', 'validation', 'ready', 'review'];

/**
 * Lit l'état SDD du projet : SPEC active (statut le plus avancé du cycle) + SQS.
 * Parse la table de `.aiad/specs/_index.md` (robuste aux colonnes en clair).
 *
 * @param {string} projetDir
 * @returns {{ spec: string|null, sqs: number|null, statut: string|null }}
 */
export function etatSdd(projetDir) {
  const idx = join(projetDir, '.aiad', 'specs', '_index.md');
  if (!existsSync(idx)) return { spec: null, sqs: null, statut: null };
  let meilleur = null;
  for (const ligne of readFileSync(idx, 'utf-8').split('\n')) {
    const m = ligne.match(/^\|\s*(SPEC-[\w-]+)\s*\|/);
    if (!m) continue;
    const cols = ligne.split('|').map((c) => c.trim());
    // cols: ['', id, titre, intent, format, sqs, statut, pr, '']
    const id = m[1];
    const sqs = Number(cols[5]);
    const statut = (cols[6] || '').toLowerCase();
    const rang = STATUTS_ACTIFS.indexOf(statut);
    if (rang < 0) continue;
    if (!meilleur || rang < meilleur.rang) {
      meilleur = { spec: id, sqs: Number.isFinite(sqs) ? sqs : null, statut, rang };
    }
  }
  return meilleur ? { spec: meilleur.spec, sqs: meilleur.sqs, statut: meilleur.statut } : { spec: null, sqs: null, statut: null };
}

/**
 * Prochaine étape du cycle de l'Intent parent d'une SPEC, si un graphe existe
 * (§3.9). Best-effort : retourne `null` si absent.
 *
 * @param {string} projetDir
 * @param {string|null} specId
 * @returns {string|null}
 */
export function prochaineEtapeCycle(projetDir, specId) {
  const dir = join(projetDir, '.aiad', 'cycle');
  if (!specId || !existsSync(dir)) return null;
  // SPEC-006-1-x → INTENT parent inconnu ici ; on prend le 1er graphe non complet.
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const g = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
      const suivante = g.etapes?.find((e) => e.status !== 'done');
      if (suivante) return suivante.name;
    } catch { /* ignore */ }
  }
  return null;
}

/**
 * Construit la ligne de statut à partir du JSON Claude Code (stdin) et de
 * l'état SDD. Pur. Segments séparés par `│`, ASCII-safe.
 *
 * @param {object} cc — JSON stdin Claude Code (peut être {})
 * @param {{ spec: string|null, sqs: number|null, statut: string|null, etape?: string|null }} sdd
 * @returns {string}
 */
export function construireStatusline(cc = {}, sdd = {}) {
  const seg = [];

  // Note de session (rappel humain — premier segment, toujours visible).
  if (sdd.note) seg.push(`📌 ${sdd.note}`);

  // SPEC active + état de Gate (déduit du SQS : ≥ 4 = Gate franchissable).
  if (sdd.spec) {
    let gate = '–';
    if (typeof sdd.sqs === 'number') gate = sdd.sqs >= 4 ? '✅' : '⚠';
    seg.push(`${sdd.spec} │ Gate ${gate}`);
    if (sdd.etape) seg.push(`étape ${sdd.etape}`);
  } else {
    seg.push('SDD');
  }

  // % de contexte (seuil opérationnel 60-70 % — alerte au-delà).
  const pct = cc?.context_window?.used_percentage;
  if (typeof pct === 'number') {
    const mark = pct >= 70 ? '⚠' : '';
    seg.push(`ctx ${Math.round(pct)}%${mark}`);
  }

  // Raisonnement étendu actif.
  if (cc?.thinking?.enabled) seg.push('🧠');

  // Effort + modèle.
  const effort = cc?.effort?.level;
  if (effort) seg.push(`effort ${effort}`);
  const modele = cc?.model?.display_name || cc?.model?.id;
  if (modele) seg.push(String(modele));

  // Rate limit 5h (alerte si > 80 %).
  const rl = cc?.rate_limits?.five_hour?.used_percentage;
  if (typeof rl === 'number') {
    const mark = rl >= 80 ? '⚠' : '';
    seg.push(`quota ${rl}%${mark}`);
  }

  // Coût cumulé de session (si exposé).
  const cout = cc?.cost?.total_cost_usd;
  if (typeof cout === 'number' && cout > 0) seg.push(`$${cout.toFixed(2)}`);

  return seg.join(' │ ');
}

/**
 * Lit le JSON stdin Claude Code (tolérant : {} si vide/illisible).
 *
 * @param {string} brut
 * @returns {object}
 */
export function parserStdin(brut) {
  if (!brut || !brut.trim()) return {};
  try { return JSON.parse(brut); } catch { return {}; }
}

// ─── Aliases EN ─────────────────────────────────────────────────────────────

export {
  etatSdd as sddState,
  prochaineEtapeCycle as nextCycleStep,
  construireStatusline as buildStatusline,
  parserStdin as parseStdin,
};
