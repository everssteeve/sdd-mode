// AIAD SDD Mode — Dashboard : collecteurs supplémentaires (#134).
//
// Agrège les artefacts produits par diverses commandes CLI qui ne sont pas
// remontés par `collect.js` :
//   - DPIA (`.aiad/metrics/rgpd/DPIA-*.md`)
//   - Audit AI Act (`.aiad/metrics/ai-act/AUDIT-*.md`)
//   - SBOM (`sbom.cdx.json` CycloneDX à la racine du projet)
//   - Score de souveraineté (depuis `lib/sovereignty-score.js`)
//   - Hook stats (depuis `.aiad/metrics/hook-runs.jsonl`)
//
// Aucun effet de bord : ces lecteurs sont purs. Ils renvoient des objets
// JSON-sérialisables consommés par les pages dashboard (`legal.html` #139,
// `qa.html` #135, futurs widgets).
//
// Le module charge paresseusement `sovereignty-score` et `hook-sandbox` via
// import statique : ces deux modules ne dépendent pas de `collect.js`, donc
// aucun cycle d'import.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { computeSovereigntyScore } from '../sovereignty-score.js';
import { lireHistorique, calculerStats } from '../hook-sandbox.js';

function listerFichiersMd(dir, motif = /\.md$/) {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((n) => motif.test(n) && !n.startsWith('_'))
      .map((n) => join(dir, n));
  } catch {
    return [];
  }
}

function lireFichier(chemin) {
  try { return readFileSync(chemin, 'utf-8'); } catch { return null; }
}

// ─── DPIA ────────────────────────────────────────────────────────────────────
//
// Format attendu : `.aiad/metrics/rgpd/DPIA-YYYY-MM-DD.md` produit par la
// commande `/sdd security --dpia` ou équivalent. Les sections suivent un
// gabarit avec entêtes "## 1. Contexte", "## 2. Données traitées", etc.
//
// On extrait :
//   - date (dérivée du nom de fichier ou frontmatter `date:`)
//   - sections complétées vs sections "(à compléter)"
//   - nom du DPO si renseigné
// pour permettre à `legal.html` d'afficher le statut d'avancement.

export function lireDpia(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'metrics', 'rgpd');
  const fichiers = listerFichiersMd(dir, /^DPIA-.*\.md$/);
  if (!fichiers.length) return { fichiers: [], total: 0, latest: null };

  const entrees = fichiers.map((chemin) => {
    const contenu = lireFichier(chemin) || '';
    const nom = basename(chemin, '.md');
    const dateMatch = nom.match(/DPIA-(\d{4}-\d{2}-\d{2})/);
    const sections = [...contenu.matchAll(/^##\s+\d+\.\s+([^\n]+)$/gm)].map((m) => m[1].trim());
    const aCompleter = (contenu.match(/\(à compléter\)|\(to do\)/gi) || []).length;
    return {
      nom,
      file: relative(racineProjet, chemin),
      date: dateMatch ? dateMatch[1] : null,
      sections,
      sectionsCount: sections.length,
      aCompleter,
      complete: sections.length > 0 && aCompleter === 0,
    };
  });
  entrees.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { fichiers: entrees, total: entrees.length, latest: entrees[0] || null };
}

// ─── Audit AI Act ────────────────────────────────────────────────────────────
//
// Format attendu : `.aiad/metrics/ai-act/AUDIT-YYYY-MM-DD.md` produit par
// `lib/ai-act-audit.js#audit`. Pré-rempli avec les 8 sections de l'Annexe IV.

export function lireAiAct(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'metrics', 'ai-act');
  const fichiers = listerFichiersMd(dir, /^AUDIT-.*\.md$/);
  if (!fichiers.length) return { fichiers: [], total: 0, latest: null };

  const entrees = fichiers.map((chemin) => {
    const contenu = lireFichier(chemin) || '';
    const nom = basename(chemin, '.md');
    const dateMatch = nom.match(/AUDIT-(\d{4}-\d{2}-\d{2})/);
    const sections = [...contenu.matchAll(/^##\s+\d+\.\s+([^\n]+)$/gm)].map((m) => m[1].trim());
    const aCompleter = (contenu.match(/\(à compléter\)|\(to complete\)/gi) || []).length;
    return {
      nom,
      file: relative(racineProjet, chemin),
      date: dateMatch ? dateMatch[1] : null,
      sections,
      sectionsCount: sections.length,
      aCompleter,
      complete: sections.length === 8 && aCompleter === 0,
    };
  });
  entrees.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { fichiers: entrees, total: entrees.length, latest: entrees[0] || null };
}

// ─── SBOM ────────────────────────────────────────────────────────────────────
//
// Détecte un fichier CycloneDX (`sbom.cdx.json`) à la racine du projet.
// Compte les composants et expose la version du format.

export function lireSbom(racineProjet) {
  const candidats = ['sbom.cdx.json', 'bom.json', 'sbom.json'];
  for (const nom of candidats) {
    const chemin = join(racineProjet, nom);
    if (!existsSync(chemin)) continue;
    const contenu = lireFichier(chemin);
    if (!contenu) continue;
    let stats;
    try { stats = statSync(chemin); } catch { stats = null; }
    try {
      const data = JSON.parse(contenu);
      const components = Array.isArray(data.components) ? data.components : [];
      return {
        present: true,
        file: relative(racineProjet, chemin),
        format: data.bomFormat || 'unknown',
        specVersion: data.specVersion || null,
        components: components.length,
        mtime: stats ? stats.mtimeMs : null,
      };
    } catch {
      return { present: true, file: relative(racineProjet, chemin), format: 'invalid', specVersion: null, components: 0, mtime: stats?.mtimeMs ?? null };
    }
  }
  return { present: false, file: null, format: null, specVersion: null, components: 0, mtime: null };
}

// ─── Sovereignty ─────────────────────────────────────────────────────────────
//
// Délègue au calculateur de souveraineté existant. Erreur silencieuse →
// retour neutre (jamais d'exception qui casse le dashboard).

export function lireSovereignty(racineProjet) {
  try {
    const r = computeSovereigntyScore(racineProjet);
    return {
      available: true,
      score: r.score,
      maxScore: r.maxScore,
      level: r.level,
      levelColor: r.levelColor,
      dimensions: r.dimensions,
      recommendations: r.recommendations,
    };
  } catch {
    return { available: false, score: null, level: null };
  }
}

// ─── Hook stats ──────────────────────────────────────────────────────────────
//
// Lit `.aiad/metrics/hook-runs.jsonl` et calcule p50/p95/timeouts/fuites.

export function lireHookStats(racineProjet) {
  try {
    const events = lireHistorique(racineProjet);
    const stats = calculerStats(events);
    return { available: events.length > 0, ...stats };
  } catch {
    return { available: false, count: 0 };
  }
}

// ─── Façade ─────────────────────────────────────────────────────────────────

export function collecterDonneesSupplementaires(racineProjet) {
  return {
    dpia: lireDpia(racineProjet),
    aiAct: lireAiAct(racineProjet),
    sbom: lireSbom(racineProjet),
    sovereignty: lireSovereignty(racineProjet),
    hookStats: lireHookStats(racineProjet),
  };
}

// Alias EN canonique (convention #42)
export {
  collecterDonneesSupplementaires as collectSupplementaryData,
  lireDpia as readDpia,
  lireAiAct as readAiAct,
  lireSbom as readSbom,
  lireSovereignty as readSovereignty,
  lireHookStats as readHookStats,
};
