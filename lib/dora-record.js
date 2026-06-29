// AIAD SDD Mode — Enregistrement déploiement DORA (#150).
//
// Écrit un fichier `.aiad/metrics/deployments/YYYY-MM-DD-deploy-NN.md` avec
// les clés DORA standard (`status`, `cycle_time_days`, `lead_time_days`,
// `version`, `commit`) que `lib/dashboard/collect.js#lireMetrics` ingère.
//
// Cible : équipes qui déploient plusieurs fois par jour et ne veulent pas
// rédiger un fichier Markdown à la main. Aussi consommable depuis la CI
// (`aiad-sdd dora --record --status=success --cycle=N --lead=N --version=v1.2`).

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';

export const STATUTS_VALIDES = ['success', 'hotfix', 'failed'];
const _STATUTS_SET = new Set(STATUTS_VALIDES);

/**
 * @typedef {object} DeployRecord
 * @property {string} status   - 'success' | 'hotfix' | 'failed'
 * @property {number} [cycleTimeDays]
 * @property {number} [leadTimeDays]
 * @property {string} [version]
 * @property {string} [commit]
 * @property {string} [date]  - YYYY-MM-DD, défaut = today
 */

export function recordDeployment(racineProjet, input) {
  const status = String(input.status || '').toLowerCase();
  if (!_STATUTS_SET.has(status)) {
    throw new Error(`status invalide : "${input.status}" — attendu success|hotfix|failed`);
  }
  const date = input.date || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`date invalide : "${date}" — attendu YYYY-MM-DD`);
  }

  const dir = join(racineProjet, '.aiad', 'metrics', 'deployments');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Numérotation séquentielle dans la journée (deploy-01, deploy-02, …)
  const existing = readdirSync(dir).filter((n) => n.startsWith(date + '-deploy-'));
  const nn = String(existing.length + 1).padStart(2, '0');
  const nom = `${date}-deploy-${nn}.md`;
  const chemin = join(dir, nom);

  const champs = [];
  champs.push(`# Déploiement ${date} (${status})`);
  champs.push('');
  champs.push(`- status: ${status}`);
  if (typeof input.cycleTimeDays === 'number' && !isNaN(input.cycleTimeDays)) {
    champs.push(`- cycle_time_days: ${input.cycleTimeDays}`);
  }
  if (typeof input.leadTimeDays === 'number' && !isNaN(input.leadTimeDays)) {
    champs.push(`- lead_time_days: ${input.leadTimeDays}`);
  }
  if (input.version) champs.push(`- version: ${input.version}`);
  if (input.commit) champs.push(`- commit: ${input.commit}`);
  champs.push('');

  writeFileSync(chemin, champs.join('\n'), 'utf-8');
  return { file: chemin, nom, date, nn, status };
}

// ─── Liste des déploiements existants (#447) ────────────────────────────────
//
// Parcourt `.aiad/metrics/deployments/` et parse chaque fichier Markdown
// pour reconstruire les champs (status, version, commit, cycle/lead time).
// Retourne array trié par date desc (plus récent en premier).
export function listerDeploys(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'metrics', 'deployments');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const nom of readdirSync(dir).sort().reverse()) {
    if (!nom.endsWith('.md')) continue;
    const m = nom.match(/^(\d{4}-\d{2}-\d{2})-deploy-(\d+)\.md$/);
    if (!m) continue;
    const [, date, nn] = m;
    const contenu = readFileSync(join(dir, nom), 'utf-8');
    const champs = { date, nn, nom };
    for (const ligne of contenu.split('\n')) {
      const km = ligne.match(/^- (status|cycle_time_days|lead_time_days|version|commit): (.+)$/);
      if (!km) continue;
      const [, key, val] = km;
      if (key === 'cycle_time_days' || key === 'lead_time_days') champs[key === 'cycle_time_days' ? 'cycleTimeDays' : 'leadTimeDays'] = Number(val);
      else champs[key] = val;
    }
    out.push(champs);
  }
  return out;
}

// ─── Import depuis tags Git (#185) ──────────────────────────────────────────
//
// Parcourt les tags Git par ordre chronologique. Pour chaque tag :
//   - date = tag creator date
//   - cycle_time_days = jours entre ce tag et le précédent (0 pour le 1er)
//   - status = 'hotfix' si le nom du tag contient /hotfix|patch/i, sinon 'success'
//   - version = nom du tag
//   - commit = sha court du commit pointé
// Tags filtrables via `since` (YYYY-MM-DD).
//
// Pas de tag ou pas de repo Git → tableau vide (l'appelant décide).

import { execSync, spawnSync } from 'node:child_process';

export function listerTagsGit(racineProjet, opts = {}) {
  const since = opts.since; // YYYY-MM-DD
  let raw;
  try {
    // Format : SHA|ISO-date|tagname (séparateur | pour parse simple)
    raw = execSync(
      'git for-each-ref --format="%(objectname:short)|%(creatordate:iso-strict)|%(refname:short)" --sort=creatordate refs/tags',
      { cwd: racineProjet, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
  } catch {
    return []; // pas de repo ou pas de tag → liste vide
  }
  const tags = [];
  for (const ligne of raw.split('\n')) {
    const l = ligne.trim().replace(/^"|"$/g, '');
    if (!l) continue;
    const [commit, iso, name] = l.split('|');
    if (!commit || !iso || !name) continue;
    if (since) {
      const day = iso.slice(0, 10);
      if (day < since) continue;
    }
    tags.push({ commit, iso, name });
  }
  return tags;
}

export function importDeploysFromGit(racineProjet, opts = {}) {
  const tags = listerTagsGit(racineProjet, opts);
  const out = [];
  for (let i = 0; i < tags.length; i++) {
    const t = tags[i];
    const prev = i === 0 ? null : tags[i - 1];
    const dateTag = new Date(t.iso);
    const date = dateTag.toISOString().slice(0, 10);
    const cycleTimeDays = prev
      ? Math.round((dateTag - new Date(prev.iso)) / 86400000 * 10) / 10
      : 0;
    const status = /hotfix|patch/i.test(t.name) ? 'hotfix' : 'success';
    const r = recordDeployment(racineProjet, {
      status,
      cycleTimeDays,
      version: t.name,
      commit: t.commit,
      date,
    });
    out.push({ ...r, tag: t.name });
  }
  return out;
}

// ─── Calcul automatique cycle_time_days depuis validated_at (SPEC-027-2) ─────

/**
 * @spec SPEC-027-2-calculate-cycle-time
 * @intent INTENT-027
 * @verified-by test/dora-auto.test.js
 * @governance AIAD-RGESN
 *
 * @param {string} racineProjet
 * @param {Date} deployDate
 * @returns {number|null} cycle_time_days arrondi à 1 décimale, ou null si aucun validated_at trouvé
 */
export function calculateCycleTimeDaysFromSpec(racineProjet, deployDate) {
  const dirs = [
    join(racineProjet, '.aiad', 'specs'),
    join(racineProjet, '.aiad', 'specs', 'archive'),
  ];
  let mostRecent = null;
  for (const dir of dirs) {
    let files;
    try {
      files = readdirSync(dir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      let contenu;
      try {
        contenu = readFileSync(join(dir, f), 'utf8');
      } catch {
        process.stderr.write(`aiad-sdd dora --auto: impossible de lire ${join(dir, f)}\n`);
        continue;
      }
      const { data } = parseFrontmatter(contenu);
      if (!data.validated_at) continue;
      const ts = new Date(data.validated_at);
      if (isNaN(ts.getTime())) continue;
      if (mostRecent === null || ts > mostRecent) mostRecent = ts;
    }
  }
  if (mostRecent === null) return null;
  const diffMs = Number(deployDate) - Number(mostRecent);
  const days = Math.round((diffMs / 86400000) * 10) / 10;
  return days < 0 ? 0 : days;
}

// Alias EN canonique
export {
  recordDeployment as recordDeploy,
  importDeploysFromGit as importFromGit,
  listerTagsGit as listGitTags,
  calculateCycleTimeDaysFromSpec as calcCycleTimeFromSpec,
};
