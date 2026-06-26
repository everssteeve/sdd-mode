/**
 * @intent INTENT-004
 * @spec SPEC-004-1-execution-phasee
 * @verified-by test/doctor.test.js
 */
// AIAD SDD Mode — Commande `doctor`.
//
// Diagnostic unifié d'un projet aiad-sdd. Vérifie en une passe ce que
// l'utilisateur devait jusque-là consulter dans plusieurs sortes (status,
// bench, emit-rules --check, lecture manuelle de config.yml). Renvoie un
// rapport humain (par défaut) ou JSON structuré (`--json`) consommable par
// CI / monitoring.
//
// Catégories de check :
//   1. structure   — .aiad/ présent, fondamentaux remplis vs templates
//   2. commandes   — .claude/commands/ + .claude/sdd/ + .claude/aiad/
//   3. gouvernance — 5 agents Tier 1 attendus (AI-ACT/RGPD/RGAA/RGESN/CRA)
//   4. multi-runtime — AGENTS.md + parité emit-rules --check (claude-code)
//   5. hooks       — pre-commit installé + mode (block/warn/off)
//   6. git         — repo Git présent, .gitignore couvre les artefacts
//   7. version     — version package locale, cohérence
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { C, log, logHeader } from './term.js';
import { emitRules } from './emit-rules.js';
import { scannerSunset } from './sunset.js';
import { computeLeadershipMetrics } from './leadership-metrics.js';
import { t } from './i18n.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function lirePackageVersion() {
  const pkgPath = join(__dirname, '..', 'package.json');
  return JSON.parse(readFileSync(pkgPath, 'utf-8')).version;
}

function existeFichier(...segments) {
  return existsSync(join(...segments));
}

function compterMd(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_')).length;
}

const SENTINELLES = {
  'PRD.md': '[Titre fonctionnel court]',
  'ARCHITECTURE.md': '[max 5 principes]',
  'AGENT-GUIDE.md': '[Nom du projet]',
};

function fondamentalRempli(racine, nom) {
  const chemin = join(racine, '.aiad', nom);
  if (!existsSync(chemin)) return { present: false, rempli: false };
  const contenu = readFileSync(chemin, 'utf-8');
  const sentinelle = SENTINELLES[nom];
  return {
    present: true,
    rempli: sentinelle ? !contenu.includes(sentinelle) : true,
  };
}

function lireConfigHookMode(racine) {
  const p = join(racine, '.aiad', 'config.yml');
  if (!existsSync(p)) return null;
  const m = readFileSync(p, 'utf-8').match(/pre_commit\s*:\s*(\w+)/i);
  return m ? m[1].toLowerCase() : null;
}

function detecterHookInstalle(racine) {
  for (const candidat of ['.git/hooks/pre-commit', '.husky/pre-commit']) {
    const p = join(racine, candidat);
    if (existsSync(p)) {
      try {
        const contenu = readFileSync(p, 'utf-8');
        if (contenu.includes('AIAD SDD Mode')) return candidat;
      } catch { /* ignore */ }
    }
  }
  return null;
}

/**
 * Construit le rapport de diagnostic. Pure (pas d'effet de bord, pas de log).
 *
 * @param {string} racine
 * @returns {Promise<object>}
 */
export async function diagnostiquer(racine) {
  const aiad = join(racine, '.aiad');
  const initialise = existsSync(aiad);

  const checks = [];

  // 1. Structure
  if (!initialise) {
    checks.push({ id: 'init', ok: false, message: '.aiad/ absent — lance `npx aiad-sdd init`' });
    return { ok: false, version: lirePackageVersion(), racine, checks };
  }

  for (const nom of ['PRD.md', 'ARCHITECTURE.md', 'AGENT-GUIDE.md']) {
    const f = fondamentalRempli(racine, nom);
    let etat;
    if (!f.present) etat = { ok: false, message: `${nom} absent` };
    else if (!f.rempli) etat = { ok: false, severity: 'warn', message: `${nom} contient encore le template par défaut` };
    else etat = { ok: true, message: `${nom} rédigé` };
    checks.push({ id: `fondamental:${nom}`, ...etat });
  }

  const nbIntents = compterMd(join(aiad, 'intents'));
  const nbSpecs = compterMd(join(aiad, 'specs'));
  checks.push({
    id: 'cycle:intents',
    ok: nbIntents > 0,
    severity: nbIntents > 0 ? null : 'info',
    message: `${nbIntents} Intent Statement(s)`,
  });
  checks.push({
    id: 'cycle:specs',
    ok: nbSpecs > 0,
    severity: nbSpecs > 0 ? null : 'info',
    message: `${nbSpecs} SPEC(s)`,
  });

  // 2. Commandes
  const aClaudeCmds = existsSync(join(racine, '.claude', 'commands'));
  checks.push({
    id: 'commands',
    ok: aClaudeCmds,
    message: aClaudeCmds ? 'commandes Claude Code installées' : '.claude/commands/ absent',
  });

  // 3. Gouvernance
  const gouvDir = join(aiad, 'gouvernance');
  const tier1Attendus = ['AIAD-AI-ACT', 'AIAD-RGPD', 'AIAD-RGAA', 'AIAD-RGESN', 'AIAD-CRA'];
  const tier1Presents = tier1Attendus.filter((id) => existeFichier(gouvDir, `${id}.md`));
  checks.push({
    id: 'gouvernance',
    ok: tier1Presents.length === tier1Attendus.length,
    severity: tier1Presents.length === 0 ? 'warn' : null,
    message: `${tier1Presents.length}/${tier1Attendus.length} agent(s) Tier 1 (${tier1Presents.join(', ') || 'aucun'})`,
  });

  // 4. Multi-runtime — parité emit-rules --check sur claude-code
  if (existsSync(join(aiad, 'AGENT-GUIDE.md'))) {
    try {
      // Capture stdout pour ne pas polluer le rapport
      const orig = process.stdout.write.bind(process.stdout);
      process.stdout.write = () => true;
      let stats;
      try {
        stats = await emitRules(racine, { runtimes: ['claude-code'], check: true });
      } finally {
        process.stdout.write = orig;
      }
      checks.push({
        id: 'emit-rules:parite',
        ok: stats.drifts.length === 0,
        message: stats.drifts.length === 0
          ? 'AGENTS.md + CLAUDE.md header synchronisés'
          : `${stats.drifts.length} fichier(s) divergent(s) — régénère via \`npx aiad-sdd emit-rules\``,
        details: stats.drifts,
      });
    } catch (err) {
      checks.push({ id: 'emit-rules:parite', ok: false, message: `emit-rules a échoué : ${err.message}` });
    }
  }

  // 5. Hooks pre-commit
  const hookCible = detecterHookInstalle(racine);
  const hookMode = lireConfigHookMode(racine) || 'block (défaut)';
  checks.push({
    id: 'hooks:pre-commit',
    ok: Boolean(hookCible),
    severity: hookCible ? null : 'info',
    message: hookCible
      ? `installé (${hookCible}, mode : ${hookMode})`
      : 'absent — `npx aiad-sdd hooks` pour activer le Drift Lock',
  });

  // 6. Git
  const aGit = existsSync(join(racine, '.git'));
  checks.push({
    id: 'git',
    ok: aGit,
    severity: aGit ? null : 'warn',
    message: aGit ? 'repo Git détecté' : 'pas de .git/ — la traçabilité Drift Lock requiert un repo',
  });

  // 7. Version package locale
  const versionLocale = lirePackageVersion();
  checks.push({
    id: 'version',
    ok: true,
    message: `aiad-sdd v${versionLocale}`,
  });

  // 8. Garde-fou GF5 (§4) — règles/skills à durée de vie limitée à réexaminer.
  try {
    const candidates = scannerSunset(racine, { versionCourante: versionLocale }).filter((e) => e.candidate);
    if (candidates.length > 0) {
      checks.push({
        id: 'sunset',
        ok: true,
        severity: 'info',
        message: `${candidates.length} règle(s)/skill(s) à réexaminer (sunset_when / review_at atteint) — \`aiad-sdd sunset\``,
      });
    }
  } catch { /* fail-safe : le scan d'obsolescence ne bloque jamais le doctor */ }

  const ok = checks.every((c) => c.ok || c.severity === 'info');

  // Métriques de leadership EU/FR — calculées toujours, exposées surtout
  // dans la sortie JSON (consommables CI / dashboards externes / OKR).
  let leadership = null;
  try { leadership = computeLeadershipMetrics(racine); } catch { /* fail-safe */ }

  return { ok, version: lirePackageVersion(), racine, checks, leadership };
}

// (#154) Checks supplémentaires opt-in : SBOM, DPIA, AI Act, sovereignty.
// Exposable en CI via `aiad-sdd doctor --supplementaire --json`. Charge le
// module supplementary uniquement quand activé (lazy import → coût zéro
// pour les utilisateurs qui n'en veulent pas).
async function diagnostiquerSupplementaire(racine) {
  const { collecterDonneesSupplementaires } = await import('./dashboard/collect-supplementary.js');
  let supp;
  try { supp = collecterDonneesSupplementaires(racine); }
  catch { return [{ id: 'supplementaire', ok: false, severity: 'warn', message: 'lecteurs supplémentaires en échec' }]; }

  const checks = [];

  // SBOM
  const sbom = supp.sbom;
  checks.push({
    id: 'supplementaire:sbom',
    ok: sbom.present,
    severity: sbom.present ? null : 'warn',
    message: sbom.present
      ? `SBOM ${sbom.format} ${sbom.specVersion || ''} · ${sbom.components} composant(s)`
      : 'SBOM absent — exécute `npx aiad-sdd sbom` pour générer sbom.cdx.json',
  });

  // DPIA
  const dpia = supp.dpia.latest;
  checks.push({
    id: 'supplementaire:dpia',
    ok: dpia && dpia.aCompleter === 0,
    severity: !dpia ? 'info' : dpia.aCompleter > 0 ? 'warn' : null,
    message: !dpia
      ? 'aucun DPIA généré (info, peut être hors scope RGPD)'
      : dpia.aCompleter > 0
        ? `${dpia.nom} : ${dpia.aCompleter} section(s) à compléter`
        : `${dpia.nom} : ${dpia.sectionsCount} sections complètes`,
  });

  // AI Act
  const ai = supp.aiAct.latest;
  checks.push({
    id: 'supplementaire:ai-act',
    ok: ai && ai.complete,
    severity: !ai ? 'info' : ai.aCompleter > 6 ? 'warn' : null,
    message: !ai
      ? 'aucun audit AI Act (info, peut être hors scope)'
      : ai.complete
        ? `${ai.nom} : Annexe IV complète (8/8)`
        : `${ai.nom} : ${ai.sectionsCount}/8 sections · ${ai.aCompleter} à compléter`,
  });

  // Sovereignty
  const sov = supp.sovereignty;
  checks.push({
    id: 'supplementaire:sovereignty',
    ok: sov.available && sov.score >= 60,
    severity: !sov.available ? 'info' : sov.score < 40 ? 'warn' : null,
    message: !sov.available
      ? 'score sovereignty indisponible'
      : `${sov.score}/${sov.maxScore} · ${sov.level}`,
  });

  return checks;
}

function symbole(check) {
  if (check.ok) return `${C.vert}✓${C.reset}`;
  if (check.severity === 'warn') return `${C.jaune}!${C.reset}`;
  if (check.severity === 'info') return `${C.cyan}-${C.reset}`;
  return `${C.rouge}✗${C.reset}`;
}

// (#221) Lit `dashboard/data.json#santeGlobale` si présent. Retourne null
// si dashboard pas encore généré. Fail-safe — JSON cassé → null.
export function lireSanteDepuisDashboard(racine, out = 'dashboard') {
  const chemin = join(racine, out, 'data.json');
  if (!existsSync(chemin)) return null;
  try {
    const d = JSON.parse(readFileSync(chemin, 'utf-8'));
    return d?.santeGlobale || null;
  } catch { return null; }
}

// (#340) Lit `dashboard/data.json#{sourceBase, publicUrl}` pour exposer le
// contexte de publication aux consumers du doctor JSON (parallèle #339 brief).
// Fail-safe : objet avec strings vides si data.json absent/cassé.
export function lirePublicationContextDepuisDashboard(racine, out = 'dashboard') {
  const chemin = join(racine, out, 'data.json');
  if (!existsSync(chemin)) return { sourceBase: '', publicUrl: '' };
  try {
    const d = JSON.parse(readFileSync(chemin, 'utf-8'));
    return {
      sourceBase: d?.sourceBase || '',
      publicUrl: d?.publicUrl || '',
    };
  } catch { return { sourceBase: '', publicUrl: '' }; }
}

// (#301) Markdown rendering pour PR descriptions et Slack.
export function formatterRapportMarkdown(rapport) {
  const lignes = [];
  lignes.push('## 🏥 AIAD SDD — Doctor');
  lignes.push('');
  const total = rapport.checks.length;
  const ok = rapport.checks.filter((c) => c.ok).length;
  const warn = rapport.checks.filter((c) => !c.ok && c.severity === 'info').length;
  const err = rapport.checks.filter((c) => !c.ok && c.severity !== 'info').length;
  const emoji = rapport.ok ? '✅' : err > 0 ? '❌' : '⚠️';
  lignes.push(`${emoji} **${ok}/${total} OK** · ${warn > 0 ? `⚠️ ${warn} info(s)` : ''}${err > 0 ? ` · ❌ ${err} erreur(s)` : ''}`.replace(/  +/g, ' ').trim());
  lignes.push('');
  if (rapport.santeGlobale?.score != null) {
    lignes.push(`📊 **Santé globale** : ${rapport.santeGlobale.score}/100 — ${rapport.santeGlobale.niveau || 'n/a'}`);
    lignes.push('');
  }
  if (rapport.santeStrictFail) {
    lignes.push(`> ❌ **Strict santé échoué** : score ${rapport.santeStrictFail.score} < seuil ${rapport.santeStrictFail.seuil}`);
    lignes.push('');
  }
  // Table : seulement les checks qui ne sont pas OK, pour rester one-pager.
  // Si tout est OK, juste un message de félicitation.
  const fails = rapport.checks.filter((c) => !c.ok);
  if (fails.length > 0) {
    lignes.push('| ID | Sévérité | Message |');
    lignes.push('|---|---|---|');
    for (const c of fails) {
      const sev = c.severity === 'info' ? '⚠️ info' : '❌ error';
      const msg = String(c.message || '').replace(/\|/g, '\\|').slice(0, 150);
      lignes.push(`| \`${c.id}\` | ${sev} | ${msg} |`);
    }
    lignes.push('');
  } else {
    lignes.push('_Tous les checks passent._');
    lignes.push('');
  }
  // (#346) Footer enrichi avec hyperlien dashboard si publicUrl publié
  // (symétrie #300 brief footer). Réutilise le contexte exposé en #340.
  const url = rapport.publicationContext?.publicUrl
    ? String(rapport.publicationContext.publicUrl).replace(/\/+$/, '')
    : null;
  const dashCell = url ? `[dashboard](${url}/index.html)` : '`aiad-sdd dashboard --serve`';
  lignes.push(`_Version : v${rapport.version} · racine : \`${rapport.racine}\` · ${dashCell}_`);
  return lignes.join('\n') + '\n';
}

export async function doctor(racine, options = {}) {
  const { json = false, supplementaire = false } = options;
  const rapport = await diagnostiquer(racine);

  // (#154) Checks supplémentaires opt-in. On les append au rapport et on
  // re-calcule le verdict global. Garde le rapport rétro-compatible quand
  // l'option est désactivée.
  if (supplementaire) {
    const extras = await diagnostiquerSupplementaire(racine);
    rapport.checks.push(...extras);
    rapport.ok = rapport.checks.every((c) => c.ok || c.severity === 'info');
  }

  // (#221) Score santé globale (#218) lu depuis dashboard/data.json.
  // Non-bloquant si dashboard pas encore généré.
  const sante = lireSanteDepuisDashboard(racine);
  if (sante) rapport.santeGlobale = sante;

  // (#340) publicationContext exposé symétriquement à brief --json (#339).
  // Toujours présent (champs "" si dashboard absent) pour faciliter le code
  // côté consumer.
  rapport.publicationContext = lirePublicationContextDepuisDashboard(racine);

  // (#221) Mode strict CI/CD : exit 1 si score < seuil.
  const seuilStrict = Number.isFinite(options.seuilSante) ? options.seuilSante : null;
  if (seuilStrict != null && sante?.score != null && sante.score < seuilStrict) {
    rapport.ok = false;
    rapport.santeStrictFail = { seuil: seuilStrict, score: sante.score };
  }

  if (json) {
    // (#258) Bloc `_meta` en tête pour cohérence avec dashboard data.json
    // (#253) et brief --json (#254). Le top-level `version` reste pour
    // back-compat des consumers existants.
    const { buildMeta } = await import('./meta.js');
    const rapportAvecMeta = {
      _meta: buildMeta({ schema: 'aiad-sdd-doctor' }),
      ...rapport,
    };
    process.stdout.write(JSON.stringify(rapportAvecMeta, null, 2) + '\n');
    return rapportAvecMeta;
  }

  // (#301) Markdown mode : table pasteable en PR description / Slack.
  if (options.markdown) {
    process.stdout.write(formatterRapportMarkdown(rapport));
    return rapport;
  }

  // (#307) --quiet : silent si rapport.ok, stderr messages sinon (CI minimal noise).
  if (options.quiet) {
    if (!rapport.ok) {
      const fails = rapport.checks.filter((c) => !c.ok && c.severity !== 'info');
      for (const c of fails) {
        process.stderr.write(`✗ ${c.id} — ${c.message}\n`);
      }
      if (rapport.santeStrictFail) {
        process.stderr.write(`✗ Strict santé échoué : score ${rapport.santeStrictFail.score} < seuil ${rapport.santeStrictFail.seuil}\n`);
      }
    }
    return rapport;
  }

  logHeader(t('doctor.title'), t('doctor.subtitle'));
  for (const c of rapport.checks) {
    log(symbole(c), `${C.gras}${c.id}${C.reset} ${C.gris}—${C.reset} ${c.message}`);
    if (Array.isArray(c.details) && c.details.length > 0) {
      for (const d of c.details) {
        log(' ', `${C.gris}• ${relative(racine, join(racine, d))}${C.reset}`);
      }
    }
  }

  const verdict = rapport.ok
    ? `${C.vert}${C.gras}  ${t('doctor.ok')}${C.reset}`
    : `${C.rouge}${C.gras}  ${t('doctor.errors')}${C.reset}`;
  console.log(`\n${verdict}\n`);

  // Métriques de leadership EU/FR — vue concise en mode texte.
  if (rapport.leadership) {
    const m = rapport.leadership;
    const pct = (r) => r == null ? '—' : `${Math.round(r * 100)}%`;
    console.log(`${C.gras}  ${t('doctor.metrics.title')}${C.reset}`);
    console.log('    ' + t('doctor.metrics.humanAuthorship', {
      pct: pct(m.humanAuthorshipRatio.ratio),
      sufficient: m.humanAuthorshipRatio.sufficient,
      total: m.humanAuthorshipRatio.total,
      seuil: m.humanAuthorshipRatio.seuilCharsMinimum,
    }));
    console.log('    ' + t('doctor.metrics.governance', {
      pct: pct(m.governanceCoverage.ratio),
      governed: m.governanceCoverage.governedFiles,
      sensitive: m.governanceCoverage.sensitiveFiles,
    }));
    console.log('    ' + t('doctor.metrics.trace', {
      pct: pct(m.traceCompleteness.ratio),
      complete: m.traceCompleteness.complete,
      total: m.traceCompleteness.total,
    }));
    const l = m.langueArtefacts;
    console.log('    ' + t('doctor.metrics.langue', {
      fr: l.fr, en: l.en, mixed: l.mixed, neutral: l.neutral, total: l.total,
    }) + '\n');
  }

  // (#221) Score santé globale (lu depuis dashboard/data.json)
  if (sante) {
    const niveauCouleur = sante.niveau === 'excellent' || sante.niveau === 'sain'
      ? C.vert
      : sante.niveau === 'attention'
      ? C.jaune || C.gris
      : C.rouge;
    console.log(`${C.gras}  Santé projet (#218)${C.reset}`);
    console.log(`    Score   : ${niveauCouleur}${C.gras}${sante.score}/100${C.reset} — ${sante.niveau || 'inconnu'} (${sante.composantesDisponibles}/${sante.breakdown?.length || 0} composantes)`);
    if (sante.breakdown) {
      for (const b of sante.breakdown.filter((x) => x.disponible)) {
        const pct = b.max > 0 ? Math.round((b.points / b.max) * 100) : 0;
        console.log(`      ${b.label.padEnd(28)} ${String(b.points).padStart(3)}/${b.max} ${C.gris}(${pct}%)${C.reset}`);
      }
    }
    if (rapport.santeStrictFail) {
      console.log(`    ${C.rouge}${C.gras}✗ Strict-santé échoué${C.reset} : score ${sante.score} < seuil ${rapport.santeStrictFail.seuil}`);
    }
    console.log('');
  } else if (seuilStrict != null) {
    console.log(`  ${C.jaune || C.gris}! --strict-sante=${seuilStrict} ignoré : dashboard/data.json absent. Lance d'abord ${C.gras}aiad-sdd dashboard${C.reset}.\n`);
  }

  return rapport;
}
