// AIAD SDD Mode — Dashboard : helpers communs pour les modules history (#220).
//
// Factorise la logique dupliquée entre les 3 modules `*-history.js` créés
// chronologiquement :
//   - tech-debt-history.js   (#198)
//   - outcomes-history.js    (#210)
//   - sante-globale-history.js (#219)
//
// Chacun a sa propre forme de snapshot JSON mais partage :
//   1. La sélection de fichiers `.aiad/metrics/<sous-dossier>/YYYY-MM-DD.json`
//   2. Le tri chronologique ascendant
//   3. Le pruning par rétention (config projet `.aiad/config.json`)
//   4. Le bucketing hebdomadaire UTC avec "dernier par semaine"
//
// Les modules existants restent les *propriétaires* de leur logique métier
// (forme du snapshot, façades publiques, tests dédiés) — ce fichier est un
// utilitaire interne préfixé `_` (convention privée du dossier).

import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const PATTERN_FICHIER = /^(\d{4}-\d{2}-\d{2})\.json$/;
const RETENTION_DEFAUT_J = 180; // 6 mois — couvre 2 quarters de review

// Lit `.aiad/config.json#dashboard.retentionJours`. Fallback 180j si absent
// ou JSON cassé. Partagé entre tous les modules history.
export function lireRetention(racineProjet) {
  const chemin = join(racineProjet, '.aiad', 'config.json');
  if (!existsSync(chemin)) return RETENTION_DEFAUT_J;
  try {
    const cfg = JSON.parse(readFileSync(chemin, 'utf-8')) || {};
    const v = cfg?.dashboard?.retentionJours;
    return Number.isFinite(v) && v > 0 ? v : RETENTION_DEFAUT_J;
  } catch { return RETENTION_DEFAUT_J; }
}

// Garantit qu'un dossier d'historique existe (mkdir -p). Idempotent.
export function ensureHistoryDir(racineProjet, sousChemin) {
  const dir = Array.isArray(sousChemin)
    ? join(racineProjet, ...sousChemin)
    : join(racineProjet, sousChemin);
  if (!existsSync(dir)) {
    try { mkdirSync(dir, { recursive: true }); } catch { /* never throws */ }
  }
  return dir;
}

// Lit tous les snapshots du dossier, retourne `[...data]` trié chronologique
// asc. Fichiers hors pattern `YYYY-MM-DD.json` ignorés, JSON cassé ignoré.
//
//   - sousChemin : string OU [string] passé à `path.join(racineProjet, ...)`
//   - opts.injecteDate : si true (défaut), garantit que chaque entrée a un
//     champ `date` (extraction depuis le nom si absent dans le payload).
export function lireHistorique(racineProjet, sousChemin, opts = {}) {
  const injecteDate = opts.injecteDate !== false;
  const dir = Array.isArray(sousChemin)
    ? join(racineProjet, ...sousChemin)
    : join(racineProjet, sousChemin);
  if (!existsSync(dir)) return [];
  let entries;
  try { entries = readdirSync(dir); } catch { return []; }
  const out = [];
  for (const nom of entries) {
    const m = nom.match(PATTERN_FICHIER);
    if (!m) continue;
    try {
      const data = JSON.parse(readFileSync(join(dir, nom), 'utf-8'));
      if (!data || typeof data !== 'object') continue;
      if (injecteDate && !data.date) data.date = m[1];
      out.push(data);
    } catch { /* ignore */ }
  }
  out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return out;
}

// Supprime les snapshots > `retentionJours` OU < `before` (mutuellement
// exclusifs, before prend précédence). Retourne `{pruned, kept}`.
//
//   - opts.before : 'YYYY-MM-DD' (suppression stricte <)
//   - opts.retentionJours : seuil en jours
//   - opts.now : timestamp ms de référence (défaut Date.now())
//   - opts.dryRun : ne supprime pas, retourne juste la liste
export function pruneHistorique(racineProjet, sousChemin, opts = {}) {
  const dir = Array.isArray(sousChemin)
    ? join(racineProjet, ...sousChemin)
    : join(racineProjet, sousChemin);
  if (!existsSync(dir)) return { pruned: [], kept: 0 };
  const retentionJours = Number.isFinite(opts.retentionJours) ? opts.retentionJours : null;
  const before = opts.before || null;
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const dryRun = Boolean(opts.dryRun);
  let entries;
  try { entries = readdirSync(dir); } catch { return { pruned: [], kept: 0 }; }
  const pruned = [];
  let kept = 0;
  for (const nom of entries) {
    const m = nom.match(PATTERN_FICHIER);
    if (!m) continue;
    const date = m[1];
    let supprimer = false;
    if (before) {
      supprimer = String(date).localeCompare(String(before)) < 0;
    } else if (retentionJours != null) {
      const t = Date.parse(date + 'T00:00:00Z');
      if (!Number.isFinite(t)) continue;
      const ageJ = Math.floor((now - t) / 86_400_000);
      supprimer = ageJ > retentionJours;
    }
    if (supprimer) {
      if (!dryRun) {
        try { unlinkSync(join(dir, nom)); } catch { /* skip */ }
      }
      pruned.push(date);
    } else {
      kept += 1;
    }
  }
  pruned.sort();
  return { pruned, kept };
}

// Découpe une liste de points horodatés en N buckets hebdomadaires UTC
// se terminant à `now`. Lundi de chaque semaine = `getUTCDay() === 1`.
//
//   - points       : [{date: 'YYYY-MM-DD', ...}, ...] tri non requis
//   - opts.weeks   : N semaines (défaut 4)
//   - opts.now     : timestamp ms de référence (défaut Date.now())
//   - opts.extract : (snapshot) => valeurExtraite — par défaut: snapshot lui-même
//   - opts.baseEntry : objet à merger dans chaque bucket vide (forme)
//
// Stratégie de réduction : dernier point/semaine prend (par ordre de tri
// `date` ascendant dans `points`). Cohérent avec les 3 modules existants.
export function bucketsHebdomadaires(points, opts = {}) {
  const weeks = Number.isFinite(opts.weeks) ? opts.weeks : 4;
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const extract = typeof opts.extract === 'function' ? opts.extract : (p) => p;
  const baseEntry = opts.baseEntry || {};

  // Lundi UTC de la semaine de `now`
  const ref = new Date(now);
  const dow = (ref.getUTCDay() + 6) % 7;
  ref.setUTCDate(ref.getUTCDate() - dow);
  ref.setUTCHours(0, 0, 0, 0);

  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const debut = new Date(ref.getTime() - i * 7 * 86_400_000);
    const fin = new Date(debut.getTime() + 7 * 86_400_000);
    const dansSemaine = points.filter((p) => {
      const t = Date.parse(String(p.date) + 'T00:00:00Z');
      return Number.isFinite(t) && t >= debut.getTime() && t < fin.getTime();
    });
    const dernier = dansSemaine.length > 0 ? dansSemaine[dansSemaine.length - 1] : null;
    const valeur = dernier ? extract(dernier) : null;
    buckets.push({
      semaine: debut.toISOString().slice(0, 10),
      samples: dansSemaine.length,
      ...baseEntry,
      ...(valeur && typeof valeur === 'object' ? valeur : { valeur }),
    });
  }
  return buckets;
}

// Alias EN canoniques (#42)
export {
  lireRetention as readRetention,
  ensureHistoryDir as ensureHistoryDirEN,
  lireHistorique as readHistory,
  pruneHistorique as pruneHistory,
  bucketsHebdomadaires as weeklyBuckets,
};
