// AIAD SDD Mode — Dashboard : sources instrumentées des métriques AIAD.
//
// Trois lectures qui font remonter des métriques sans saisie humaine :
//   - la couverture de tests, depuis le rapport que produit déjà l'outil de
//     test du projet ;
//   - la dette technique, depuis les instantanés quotidiens du dashboard ;
//   - l'activité git des 30 derniers jours, pour la part du travail passée
//     par les agents (commits co-signés par un agent).
//
// Chaque lecture est tolérante : source absente ou illisible → null, jamais
// d'exception, jamais de valeur supposée.
//
// @intent INTENT-038
// @spec SPEC-038-2-instrumentation-metriques
// @verified-by test/metrics-sources.test.js
// @governance AIAD-RGPD, AIAD-RGESN
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const lireJson = (chemin) => { try { return JSON.parse(readFileSync(chemin, 'utf-8')); } catch { return null; } };

/** Emplacements où un rapport de couverture est cherché, par ordre de priorité. */
export const SOURCES_COUVERTURE = Object.freeze([
  '.aiad/metrics/tests/coverage-summary.json',
  'coverage/coverage-summary.json',
  '.aiad/metrics/coverage/badge.json',
]);

/**
 * Couverture de lignes du projet.
 *
 * @returns {{ pct: number, source: string }|null}
 */
export function lireCouverture(racineProjet) {
  for (const rel of SOURCES_COUVERTURE) {
    const chemin = join(racineProjet, rel);
    if (!existsSync(chemin)) continue;
    const json = lireJson(chemin);
    if (!json) continue;
    const pct = json.total?.lines?.pct ?? (typeof json.message === 'string' ? Number.parseFloat(json.message) : null);
    if (typeof pct === 'number' && !Number.isNaN(pct)) return { pct, source: rel };
  }
  return null;
}

/**
 * Historique de la dette technique d'après les instantanés du dashboard
 * (`.aiad/metrics/tech-debt/AAAA-MM-JJ.json`) : TODO-JNSP ouverts + SPECs
 * trop grosses.
 *
 * @returns {{ date: string, total: number }[]} ordre chronologique
 */
export function lireHistoriqueDette(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'metrics', 'tech-debt');
  let fichiers = [];
  try { fichiers = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort(); } catch { return []; }
  const out = [];
  for (const f of fichiers) {
    const j = lireJson(join(dir, f));
    if (!j) continue;
    const total = (Number(j.jnsp) || 0) + (Number(j.specsGrosses) || 0);
    out.push({ date: f.slice(0, 10), total });
  }
  return out;
}

/** Signature d'un agent dans un co-auteur de commit. */
export const MOTIF_AGENT = /claude|anthropic|copilot|cursor|codex|openai|gemini|devin|aider|\bbot\b|\[bot\]|noreply@.*\bai\b/i;

/**
 * Analyse la sortie de `git log --numstat` formatée par `lireActiviteGit`.
 * Exportée pour être testée sans dépôt git.
 *
 * @returns {{ commits: number, commitsAgent: number, lignes: number, lignesAgent: number }}
 */
export function analyserJournalGit(sortie) {
  const r = { commits: 0, commitsAgent: 0, lignes: 0, lignesAgent: 0 };
  for (const bloc of String(sortie || '').split('\u001e').map((b) => b.trim()).filter(Boolean)) {
    const [entete, ...reste] = bloc.split('\u001f');
    const corps = reste.join('\u001f');
    const [messageEtTrailers, stats = ''] = corps.split('\u001d');
    const agent = MOTIF_AGENT.test(`${entete}\n${messageEtTrailers}`);
    let lignes = 0;
    for (const l of stats.split('\n')) {
      const m = l.match(/^(\d+)\t(\d+|-)\t/);
      if (m) lignes += Number(m[1]);
    }
    r.commits += 1;
    r.lignes += lignes;
    if (agent) { r.commitsAgent += 1; r.lignesAgent += lignes; }
  }
  return r;
}

/**
 * Activité git des `jours` derniers jours : part des commits et des lignes
 * ajoutées dont un co-auteur est un agent. Aucune identité n'est conservée :
 * seuls des totaux sortent de cette fonction.
 *
 * @returns {{ jours: number, commits: number, commitsAgent: number, lignes: number, lignesAgent: number }|null}
 */
export function lireActiviteGit(racineProjet, options = {}) {
  const jours = options.jours || 30;
  if (!existsSync(join(racineProjet, '.git'))) return null;
  try {
    const sortie = execFileSync('git', [
      'log', `--since=${jours}.days`, '--no-merges', '--numstat',
      '--format=%x1e%an <%ae>%x1f%(trailers:key=Co-authored-by,valueonly,separator=%x2C )%x1d',
    ], { cwd: racineProjet, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000, maxBuffer: 32 * 1024 * 1024 });
    const r = analyserJournalGit(sortie);
    return r.commits > 0 ? { jours, ...r } : null;
  } catch {
    return null;
  }
}

/**
 * Passages à l'Execution Gate lus dans l'historique des SPECs (table
 * « Historique des modifications » : une ligne datée qui mentionne la Gate).
 * Premier passage réussi = la première ligne de Gate porte « OUVERTE ».
 *
 * @returns {{ specs: number, premierPassage: number, passages: number }|null} null si aucune SPEC ne trace sa Gate
 */
export function lireHistoriqueGates(racineProjet) {
  const base = join(racineProjet, '.aiad', 'specs');
  const fichiers = [];
  const parcourir = (dir) => {
    let noms = [];
    try { noms = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const n of noms) {
      if (n.isDirectory()) parcourir(join(dir, n.name));
      else if (/^SPEC-.*\.md$/.test(n.name)) fichiers.push(join(dir, n.name));
    }
  };
  parcourir(base);
  let specs = 0; let premierPassage = 0; let passages = 0;
  for (const f of fichiers) {
    let contenu = '';
    try { contenu = readFileSync(f, 'utf-8'); } catch { continue; }
    const lignes = contenu.split('\n')
      .filter((l) => /^\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(l) && /\bGate\b/i.test(l))
      .sort();
    if (lignes.length === 0) continue;
    specs += 1;
    passages += lignes.length;
    if (/OUVERTE/i.test(lignes[0])) premierPassage += 1;
  }
  return specs > 0 ? { specs, premierPassage, passages } : null;
}

/**
 * Périmètre décidé par l'équipe : métriques déclarées non applicables au
 * projet (`.aiad/metrics/scope.json`). Chaque exclusion porte une raison, un
 * auteur humain et une date.
 *
 * @returns {Record<string, { raison: string, auteur: string, date: string }>}
 */
export function lirePerimetre(racineProjet) {
  const j = lireJson(join(racineProjet, '.aiad', 'metrics', 'scope.json'));
  const na = j && typeof j.non_applicables === 'object' && j.non_applicables ? j.non_applicables : {};
  const out = {};
  for (const [id, v] of Object.entries(na)) {
    if (v && typeof v.raison === 'string' && v.raison.trim() && typeof v.auteur === 'string' && v.auteur.trim()) {
      out[id] = { raison: v.raison.trim(), auteur: v.auteur.trim(), date: String(v.date || '') };
    }
  }
  return out;
}

/**
 * Reports décidés par un humain (`.aiad/metrics/scope.json`, clé `en_attente`) :
 * une métrique laissée sans valeur jusqu'à une échéance, avec raison et auteur.
 *
 * @returns {Record<string, { raison: string, auteur: string, date: string, jusqu: string }>}
 */
export function lireReports(racineProjet) {
  const j = lireJson(join(racineProjet, '.aiad', 'metrics', 'scope.json'));
  const src = j && typeof j.en_attente === 'object' && j.en_attente ? j.en_attente : {};
  const out = {};
  for (const [id, v] of Object.entries(src)) {
    if (v && typeof v.raison === 'string' && v.raison.trim() && typeof v.auteur === 'string' && v.auteur.trim() && /^\d{4}-\d{2}-\d{2}$/.test(String(v.jusqu || ''))) {
      out[id] = { raison: v.raison.trim(), auteur: v.auteur.trim(), date: String(v.date || ''), jusqu: v.jusqu };
    }
  }
  return out;
}
