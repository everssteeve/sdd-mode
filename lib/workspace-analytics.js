// AIAD SDD Mode — Workspace cross-org analytics (item #123).
//
// **Cap stratégique** : une direction technique avec 10+ projets AIAD a
// besoin d'une **vue d'ensemble agrégée** : où sont les projets faibles
// en souveraineté ? Quels packs gouvernance sont les plus déployés ?
// Quelle est la vélocité Intent → SPEC moyenne ? Quel pourcentage de
// projets souffre de drifts ?
//
// Ce module étend `lib/workspace.js` (#27) avec des **analytics
// cross-projets** spécifiques, lisibles en CLI ou exportables en JSON
// pour dashboards externes.
//
// **Métriques calculées** :
//   - `sovereigntyMoyen` : score EU Sovereignty moyen, médiane, min, max.
//   - `topPacks` : top 5 packs gouvernance par fréquence d'installation.
//   - `topAgentsTier1` : top 5 agents AIAD-* les plus présents.
//   - `velociteIntentSpec` : ratio SPECs / Intents moyen (>= 1 = bonne
//     couverture spécification).
//   - `driftRate` : % de projets avec ≥ 1 gap traçabilité.
//   - `juridictionsCouvertes` : ensemble agrégé des juridictions EU
//     présentes dans le workspace.
//
// **Zero-dep** : réutilise `sovereignty-score.js`, lit `.aiad/` direct.
//
// Documentation : https://aiad.ovh/workspace-analytics

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorkspace } from './workspace.js';
import { computeSovereigntyScore } from './sovereignty-score.js';
import { C, logHeader } from './term.js';

// ─── Analyse projet ───────────────────────────────────────────────────────

/**
 * Analyse un projet AIAD et produit ses métriques.
 *
 * @param {string} projectPath — chemin absolu vers la racine du projet
 * @param {string} [name]
 * @returns {Promise<{
 *   name: string,
 *   path: string,
 *   exists: boolean,
 *   sovereignty?: { score: number, level: string },
 *   governance: { agents: string[], packs: string[] },
 *   intents: number,
 *   specs: number,
 *   velocite: number|null,
 *   driftCount: number,
 * }>}
 */
export async function analyserProjet(projectPath, name = '') {
  const aiadDir = join(projectPath, '.aiad');
  if (!existsSync(aiadDir)) {
    return {
      name: name || projectPath, path: projectPath, exists: false,
      governance: { agents: [], packs: [] },
      intents: 0, specs: 0, velocite: null, driftCount: 0,
    };
  }
  let sovereignty = null;
  try {
    const s = computeSovereigntyScore(projectPath);
    sovereignty = { score: s.score, level: s.level };
  } catch { /* ignore */ }
  const govDir = join(aiadDir, 'gouvernance');
  const agents = existsSync(govDir)
    ? readdirSync(govDir).filter((f) => /^AIAD-.+\.md$/.test(f))
    : [];
  const packs = detecterPacks(agents);
  const intentsDir = join(aiadDir, 'intents');
  const specsDir = join(aiadDir, 'specs');
  const intents = existsSync(intentsDir)
    ? readdirSync(intentsDir).filter((f) => /^INT-.+\.md$/.test(f)).length
    : 0;
  const specs = existsSync(specsDir)
    ? readdirSync(specsDir).filter((f) => /^SPEC-.+\.md$/.test(f)).length
    : 0;
  let driftCount = 0;
  const matrixPath = join(aiadDir, 'metrics', 'traceability', 'matrix.json');
  if (existsSync(matrixPath)) {
    try {
      const { readFileSync } = await import('node:fs');
      const data = JSON.parse(readFileSync(matrixPath, 'utf-8'));
      driftCount = Array.isArray(data.gaps) ? data.gaps.length : 0;
    } catch { /* ignore */ }
  }
  return {
    name: name || projectPath, path: projectPath, exists: true,
    sovereignty,
    governance: { agents, packs },
    intents, specs,
    velocite: intents > 0 ? specs / intents : null,
    driftCount,
  };
}

/**
 * Détecte les packs installés à partir des agents Tier 1 présents.
 *
 * @param {string[]} agents — basenames des fichiers AIAD-*.md
 * @returns {string[]}
 */
export function detecterPacks(agents) {
  const set = new Set();
  if (['AIAD-AI-ACT.md', 'AIAD-RGPD.md', 'AIAD-RGAA.md', 'AIAD-RGESN.md']
    .every((a) => agents.includes(a))) set.add('eu-baseline');
  if (agents.includes('AIAD-CRA.md')) set.add('eu-baseline');
  if (agents.some((a) => ['AIAD-RGS.md', 'AIAD-PASSI.md', 'AIAD-SECNUMCLOUD.md', 'AIAD-HOMOLOGATION.md'].includes(a))) {
    set.add('fr-anssi');
  }
  if (agents.some((a) => /BSI|BDSG|C5/.test(a))) set.add('de-bsi');
  if (agents.some((a) => /AEPD|LOPDGDD|ENS/.test(a))) set.add('es-aepd');
  if (agents.some((a) => /AGID|CAD|PAGOPA/.test(a))) set.add('it-agid');
  if (agents.some((a) => /^AIAD-AP\.md$|UAVG|BIO/.test(a))) set.add('nl-ap');
  if (agents.some((a) => /^AIAD-APD\.md$|CCT81/.test(a))) set.add('be-apd');
  if (agents.some((a) => /CH-FADP|NLPD/.test(a))) set.add('ch-fadp');
  if (agents.some((a) => /DORA|PSD2|MICA|SFDR/.test(a))) set.add('eu-financial');
  if (agents.some((a) => /\bDSA\b/.test(a))) set.add('eu-platforms');
  if (agents.some((a) => /ISO-42001/.test(a))) set.add('iso-standards');
  if (agents.some((a) => /JP-APPI|SG-PDPA|AU-PRIVACY/.test(a))) set.add('apac-baseline');
  if (agents.some((a) => /BR-LGPD|MX-LFPDPPP/.test(a))) set.add('latam-baseline');
  return [...set];
}

// ─── Agrégation cross-org ──────────────────────────────────────────────────

/**
 * Calcule les analytics agrégées sur un ensemble de projets.
 *
 * @param {object[]} projets — rapports `analyserProjet`
 * @returns {{
 *   total: number, available: number,
 *   sovereignty: { moyenne: number, mediane: number, min: number, max: number, parProjet: object[] },
 *   topPacks: { id: string, count: number }[],
 *   topAgents: { id: string, count: number }[],
 *   velocite: { moyenne: number|null, projetsAvecIntents: number },
 *   driftRate: number,
 *   juridictionsCouvertes: string[],
 * }}
 */
export function agreger(projets) {
  const dispos = projets.filter((p) => p.exists);
  const total = projets.length;
  const available = dispos.length;
  if (available === 0) {
    return {
      total, available: 0,
      sovereignty: { moyenne: 0, mediane: 0, min: 0, max: 0, parProjet: [] },
      topPacks: [],
      topAgents: [],
      velocite: { moyenne: null, projetsAvecIntents: 0 },
      driftRate: 0,
      juridictionsCouvertes: [],
    };
  }

  // Sovereignty
  const scores = dispos
    .filter((p) => p.sovereignty)
    .map((p) => p.sovereignty.score)
    .sort((a, b) => a - b);
  const moyenne = scores.length === 0 ? 0
    : scores.reduce((s, n) => s + n, 0) / scores.length;
  const mediane = scores.length === 0 ? 0
    : scores[Math.floor(scores.length / 2)];

  // Top packs (fréquence sur projets dispos)
  const packsCount = new Map();
  for (const p of dispos) {
    for (const pack of p.governance.packs) {
      packsCount.set(pack, (packsCount.get(pack) || 0) + 1);
    }
  }
  const topPacks = [...packsCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ id, count }));

  // Top agents (fréquence)
  const agentsCount = new Map();
  for (const p of dispos) {
    for (const a of p.governance.agents) {
      agentsCount.set(a, (agentsCount.get(a) || 0) + 1);
    }
  }
  const topAgents = [...agentsCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ id, count }));

  // Vélocité Intent→SPEC (uniquement projets avec Intents)
  const avecIntents = dispos.filter((p) => p.intents > 0);
  const velociteMoyenne = avecIntents.length === 0 ? null
    : avecIntents.reduce((s, p) => s + (p.velocite || 0), 0) / avecIntents.length;

  // Drift rate (% projets avec ≥ 1 gap)
  const avecDrifts = dispos.filter((p) => p.driftCount > 0).length;
  const driftRate = available > 0 ? avecDrifts / available : 0;

  // Juridictions couvertes (union via packs)
  const PACK_JURIDICTIONS = {
    'eu-baseline': ['eu'], 'fr-anssi': ['fr'], 'de-bsi': ['de'],
    'es-aepd': ['es'], 'it-agid': ['it'], 'nl-ap': ['nl'],
    'be-apd': ['be'], 'ch-fadp': ['ch'],
    'eu-financial': ['eu'], 'eu-platforms': ['eu'],
    'apac-baseline': ['jp', 'sg', 'au'],
    'latam-baseline': ['br', 'mx'],
  };
  const juris = new Set();
  for (const p of dispos) {
    for (const pack of p.governance.packs) {
      for (const j of PACK_JURIDICTIONS[pack] || []) juris.add(j);
    }
  }

  return {
    total, available,
    sovereignty: {
      moyenne: Math.round(moyenne * 10) / 10,
      mediane,
      min: scores[0] ?? 0,
      max: scores[scores.length - 1] ?? 0,
      parProjet: dispos.map((p) => ({
        name: p.name,
        score: p.sovereignty?.score ?? null,
        level: p.sovereignty?.level ?? null,
      })),
    },
    topPacks,
    topAgents,
    velocite: {
      moyenne: velociteMoyenne === null ? null : Math.round(velociteMoyenne * 100) / 100,
      projetsAvecIntents: avecIntents.length,
    },
    driftRate: Math.round(driftRate * 100) / 100,
    juridictionsCouvertes: [...juris].sort(),
  };
}

// ─── Pipeline ──────────────────────────────────────────────────────────────

/**
 * Exécute les analytics complètes sur un workspace.
 *
 * @param {string} racineWorkspace
 * @param {{ config?: string, json?: boolean }} [options]
 */
export async function analyserWorkspace(racineWorkspace, options = {}) {
  const cheminConfig = join(racineWorkspace, options.config || 'aiad-workspace.json');
  const ws = loadWorkspace(cheminConfig);

  const projets = [];
  for (const p of ws.projects) {
    const path = join(racineWorkspace, p.path);
    projets.push(await analyserProjet(path, p.name));
  }
  const analytics = agreger(projets);

  if (options.json) {
    // (#259) _meta cohérent avec workspace doctor/trace.
    const { buildMeta } = await import('./meta.js');
    process.stdout.write(JSON.stringify({
      _meta: buildMeta({ schema: 'aiad-sdd-workspace', action: 'analytics' }),
      workspace: { name: ws.name, description: ws.description },
      analytics,
      projets,
    }, null, 2) + '\n');
    return { analytics, projets };
  }

  logHeader(
    `AIAD SDD — Workspace analytics : ${ws.name}`,
    `${analytics.available}/${analytics.total} projet(s) avec .aiad/`,
  );
  console.log('');
  console.log(`  ${C.gras}Sovereignty Score${C.reset}`);
  console.log(`    Moyenne : ${analytics.sovereignty.moyenne}  ·  Médiane : ${analytics.sovereignty.mediane}  ·  Min : ${analytics.sovereignty.min}  ·  Max : ${analytics.sovereignty.max}`);
  if (analytics.topPacks.length > 0) {
    console.log(`\n  ${C.gras}Top packs gouvernance${C.reset}`);
    for (const p of analytics.topPacks) {
      console.log(`    ${C.cyan}${p.id.padEnd(22)}${C.reset} ${p.count} projet(s)`);
    }
  }
  if (analytics.topAgents.length > 0) {
    console.log(`\n  ${C.gras}Top agents Tier 1${C.reset}`);
    for (const a of analytics.topAgents) {
      console.log(`    ${C.cyan}${a.id.padEnd(34)}${C.reset} ${a.count}`);
    }
  }
  console.log('');
  console.log(`  ${C.gras}Vélocité Intent→SPEC${C.reset} : ${analytics.velocite.moyenne ?? '—'} (sur ${analytics.velocite.projetsAvecIntents} projet[s] avec Intents)`);
  console.log(`  ${C.gras}Drift rate${C.reset}            : ${(analytics.driftRate * 100).toFixed(0)}% des projets`);
  console.log(`  ${C.gras}Juridictions couvertes${C.reset} : ${analytics.juridictionsCouvertes.join(', ') || '(aucune)'}`);
  console.log('');
  return { analytics, projets };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  analyserProjet as analyzeProject,
  detecterPacks as detectPacks,
  agreger as aggregate,
  analyserWorkspace as analyzeWorkspace,
};
