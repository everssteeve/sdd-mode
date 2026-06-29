// AIAD SDD Mode — Mode workspace multi-projet.
//
// Cible : ESN et grands groupes européens qui gèrent un portefeuille de
// produits AIAD (5 à 50 projets typiquement). Permet d'agréger en un seul
// passage la santé de tous les projets, sans avoir à chaque fois à se
// déplacer manuellement dans chaque dossier.
//
// Format de configuration : `aiad-workspace.json` à la racine du workspace.
// JSON volontairement (pas YAML) pour rester zero-dep et déterministe :
//
//   {
//     "name": "ACME Group",
//     "description": "Tous les produits du groupe ACME.",
//     "projects": [
//       { "name": "backend", "path": "./services/backend" },
//       { "name": "frontend", "path": "./apps/web" },
//       { "name": "mobile", "path": "./apps/mobile" }
//     ]
//   }
//
// Chaque projet est invoqué via les modules existants — pas de
// réimplémentation. Si un projet n'a pas `.aiad/`, il est marqué "skipped".
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { C, log, logHeader } from './term.js';
import { diagnostiquer, lirePublicationContextDepuisDashboard } from './doctor.js';
import { construireMatrice } from './sdd-trace.js';

/**
 * Charge un fichier de configuration workspace JSON.
 *
 * @param {string} cheminConfig
 * @returns {{ name: string, description?: string, projects: { name: string, path: string }[] }}
 */
export function loadWorkspace(cheminConfig) {
  if (!existsSync(cheminConfig)) {
    throw new Error(`Configuration workspace introuvable : ${cheminConfig}`);
  }
  let data;
  try {
    data = JSON.parse(readFileSync(cheminConfig, 'utf-8'));
  } catch (err) {
    throw new Error(`JSON invalide dans ${cheminConfig} : ${err.message}`);
  }
  if (!Array.isArray(data.projects)) {
    throw new Error(`Configuration ${cheminConfig} invalide : champ "projects" manquant ou non-tableau.`);
  }
  for (const p of data.projects) {
    if (!p.name || !p.path) {
      throw new Error(`Projet invalide dans ${cheminConfig} : chaque projet requiert "name" et "path".`);
    }
  }
  return {
    name: data.name || 'workspace',
    description: data.description || '',
    projects: data.projects,
  };
}

/**
 * Calcule les indicateurs agrégés sur tous les projets analysés.
 * Reçoit un tableau de rapports `{ name, ok, status: 'analyzed'|'skipped'|'error', doctor?, matrix? }`.
 *
 * @returns {{ total: number, analyzed: number, skipped: number, errored: number, healthy: number, totals: { intents: number, specs: number, gaps: number } }}
 */
export function aggregateReports(rapports) {
  let analyzed = 0, skipped = 0, errored = 0, healthy = 0;
  let intents = 0, specs = 0, gaps = 0;
  for (const r of rapports) {
    if (r.status === 'analyzed') {
      analyzed++;
      if (r.ok) healthy++;
      if (r.matrix) {
        intents += r.matrix.summary?.intents || 0;
        specs += r.matrix.summary?.specs || 0;
        const g = r.matrix.gaps || {};
        gaps += (g.intentsSansSpec?.length || 0)
          + (g.specsSansCode?.length || 0)
          + (g.specsValideesNonImplementees?.length || 0)
          + (g.specsOrphelinsSurCode?.length || 0)
          + (g.intentsOrphelinsSurCode?.length || 0)
          + (g.codeSansSpec?.total || 0)
          + (g.codeSansTests?.length || 0);
      }
    } else if (r.status === 'skipped') {
      skipped++;
    } else {
      errored++;
    }
  }
  return {
    total: rapports.length,
    analyzed,
    skipped,
    errored,
    healthy,
    totals: { intents, specs, gaps },
  };
}

/**
 * Exécute une action sur chaque projet du workspace.
 *
 * @param {string} racineWorkspace
 * @param {'doctor' | 'trace'} action
 * @param {{ config?: string, json?: boolean }} [options]
 * @returns {Promise<{ workspace: object, reports: object[], summary: object }>}
 */
// (#303) Markdown rendering pour PR descriptions multi-projet.
export function formatterWorkspaceMarkdown(result, action) {
  const lignes = [];
  lignes.push(`## 🗂 AIAD SDD — Workspace ${action}`);
  if (result.workspace?.name) lignes.push(`### ${result.workspace.name}`);
  lignes.push('');
  const s = result.summary || {};
  const emoji = s.healthy === s.analyzed && s.errored === 0 ? '✅' : s.errored > 0 ? '❌' : '⚠️';
  lignes.push(`${emoji} **${s.analyzed ?? 0}/${s.total ?? 0} projets analysés** · 🟢 ${s.healthy ?? 0} sains · ⏭ ${s.skipped ?? 0} skipped · ❌ ${s.errored ?? 0} en erreur`);
  lignes.push('');
  if (s.totals && (s.totals.intents > 0 || s.totals.specs > 0)) {
    lignes.push(`📊 Cumul : **${s.totals.intents}** Intents · **${s.totals.specs}** SPECs · ${s.totals.gaps ?? 0} gaps`);
    lignes.push('');
  }
  if (Array.isArray(result.reports) && result.reports.length > 0) {
    lignes.push('| Projet | Statut | Détail |');
    lignes.push('|---|---|---|');
    for (const r of result.reports) {
      const statut = r.status === 'analyzed' && r.ok ? '🟢 sain'
        : r.status === 'analyzed' ? '🟡 attention'
        : r.status === 'skipped' ? '⏭ skipped'
        : '❌ erreur';
      const detail = r.error
        ? String(r.error).replace(/\|/g, '\\|').slice(0, 100)
        : r.matrix?.summary ? `${r.matrix.summary.intents} intents · ${r.matrix.summary.specs} specs`
        : r.reason || '';
      lignes.push(`| **${r.name}** | ${statut} | ${detail} |`);
    }
    lignes.push('');
  }
  return lignes.join('\n') + '\n';
}

export async function runWorkspace(racineWorkspace, action, options = {}) {
  const { config = 'aiad-workspace.json', json = false } = options;
  const cheminConfig = resolve(racineWorkspace, config);
  const workspace = loadWorkspace(cheminConfig);

  // (#303) En mode --markdown ou --json, on n'imprime aucune sortie
  // intermédiaire — le consumer (Slack-bot/CI) capte stdout entier.
  if (!json && !options.markdown && !options.quiet) {
    logHeader(`AIAD SDD — Workspace ${workspace.name}`,
      `${workspace.projects.length} projet(s) — action : ${action}`);
  }

  const reports = [];
  for (const p of workspace.projects) {
    const projetDir = resolve(racineWorkspace, p.path);
    const aiad = join(projetDir, '.aiad');
    if (!existsSync(aiad)) {
      reports.push({ name: p.name, path: p.path, status: 'skipped', reason: '.aiad/ absent' });
      if (!json && !options.markdown && !options.quiet) log(`${C.gris}-${C.reset}`, `${C.gras}${p.name}${C.reset} ${C.gris}— skipped (pas de .aiad/)${C.reset}`);
      continue;
    }
    try {
      if (action === 'doctor') {
        // Capture stdout pendant diagnostiquer pour ne pas polluer la sortie workspace.
        // Mais diagnostiquer est pure (pas d'I/O console), donc OK.
        const doctorReport = await diagnostiquer(projetDir);
        // (#342) publicationContext par projet pour permettre aux consumers
        // workspace (Slack-bot multi-org / Notion sync) de hyperlier les
        // IDs/SPECs de chaque projet vers leur source. Chaîne #339-#341.
        const publicationContext = lirePublicationContextDepuisDashboard(projetDir);
        reports.push({
          name: p.name,
          path: p.path,
          status: 'analyzed',
          ok: doctorReport.ok,
          doctor: doctorReport,
          publicationContext,
        });
        if (!json && !options.markdown && !options.quiet) {
          const sym = doctorReport.ok ? `${C.vert}✓${C.reset}` : `${C.rouge}✗${C.reset}`;
          log(sym, `${C.gras}${p.name}${C.reset} ${C.gris}— ${doctorReport.ok ? 'sain' : 'anomalies'} (${doctorReport.checks.length} checks)${C.reset}`);
        }
      } else if (action === 'trace') {
        const matrix = construireMatrice(projetDir);
        reports.push({
          name: p.name,
          path: p.path,
          status: 'analyzed',
          ok: true,
          matrix,
        });
        if (!json && !options.markdown && !options.quiet) {
          log(`${C.cyan}↻${C.reset}`, `${C.gras}${p.name}${C.reset} ${C.gris}— ${matrix.summary.intents} Intents · ${matrix.summary.specs} SPECs · ${matrix.summary.codeFiles} fichiers${C.reset}`);
        }
      } else {
        throw new Error(`Action inconnue : "${action}". Disponibles : doctor, trace.`);
      }
    } catch (err) {
      reports.push({ name: p.name, path: p.path, status: 'error', error: err.message });
      if (!json && !options.markdown && !options.quiet) log(`${C.rouge}✗${C.reset}`, `${C.gras}${p.name}${C.reset} ${C.gris}— erreur : ${err.message}${C.reset}`);
    }
  }

  const summary = aggregateReports(reports);
  const result = { workspace: { name: workspace.name, description: workspace.description }, reports, summary };

  if (json) {
    // (#259) _meta block en tête pour cohérence avec dashboard/doctor/brief.
    // schema sous-namespace `aiad-sdd-workspace` distingue d'un dashboard
    // single-project. action exposée car le payload diffère entre doctor/trace.
    const { buildMeta } = await import('./meta.js');
    const withMeta = { _meta: buildMeta({ schema: 'aiad-sdd-workspace', action }), ...result };
    process.stdout.write(JSON.stringify(withMeta, null, 2) + '\n');
    return withMeta;
  }

  // (#303) Markdown mode : table multi-projet pasteable PR/Slack.
  if (options.markdown) {
    process.stdout.write(formatterWorkspaceMarkdown(result, action));
    return result;
  }

  // (#308) --quiet : silent si tous projets healthy, stderr par fail.
  if (options.quiet) {
    if (summary.errored > 0) {
      for (const r of reports) {
        if (r.status === 'error') process.stderr.write(`✗ ${r.name} — ${r.error}\n`);
      }
    }
    if (action === 'doctor' && summary.healthy < summary.analyzed) {
      for (const r of reports) {
        if (r.status === 'analyzed' && !r.ok) process.stderr.write(`✗ ${r.name} — anomalies détectées\n`);
      }
    }
    return result;
  }

  console.log(`
${C.gras}  Synthèse${C.reset}
    Projets analysés : ${C.cyan}${summary.analyzed}${C.reset} / ${summary.total} (${summary.skipped} skipped · ${summary.errored} en erreur)
    Sains            : ${summary.analyzed > 0 && summary.healthy === summary.analyzed ? C.vert : C.jaune}${summary.healthy}/${summary.analyzed}${C.reset}
    Intents totaux   : ${C.cyan}${summary.totals.intents}${C.reset}
    SPECs totales    : ${C.cyan}${summary.totals.specs}${C.reset}
    Gaps cumulés     : ${summary.totals.gaps === 0 ? C.vert : C.jaune}${summary.totals.gaps}${C.reset}
`);

  return result;
}
