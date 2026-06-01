// AIAD SDD Mode — Commande `brief` (#228).
//
// Résumé console one-pager du projet : maturité + santé globale + top 3
// alertes focus + 3 derniers rituels. Conçu pour le rituel standup
// quotidien ou pour CI matin (« où en est le projet en 1 écran ? »).
//
// Source de vérité : `dashboard/data.json` (lecture seule, pas de calcul
// onéreux). Si absent → message clair "lance aiad-sdd dashboard d'abord".

import { existsSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { C } from './term.js';

// Lit `dashboard/data.json`. Retourne null si absent ou JSON cassé.
export function lireDashboardData(racineProjet, outDir = 'dashboard') {
  const chemin = join(racineProjet, outDir, 'data.json');
  if (!existsSync(chemin)) return null;
  try { return JSON.parse(readFileSync(chemin, 'utf-8')); }
  catch { return null; }
}

// Extrait les 3 sources clés du résumé. Retourne un objet plat
// JSON-sérialisable pour `--json`.
export function calculerBrief(donnees) {
  if (!donnees) return null;
  const projet = donnees.projet?.nom || donnees.projet?.title || basename(donnees.projet?.racine || '') || '(sans nom)';
  const maturite = donnees.maturite || null;
  const sante = donnees.santeGlobale || null;
  // Top 3 alertes focus (#190 → focusAlertes.all)
  const focusAlertes = donnees.focusAlertes?.all || [];
  const alertes = focusAlertes.slice(0, 3).map((a) => ({
    priorite: a.priorite,
    titre: a.titre,
    action: a.action,
  }));
  // 3 derniers rituels — réutilise donnees.metrics.categories
  // (lireRituels n'est pas appelé ici pour éviter import circulaire ;
  // on duplique brièvement la lecture)
  const cats = donnees.metrics?.categories || {};
  const rituels = [];
  for (const [type, cfg] of Object.entries({
    standup: 'Standup', demo: 'Demo', retro: 'Rétro',
    'sync-strat': 'Sync stratégique', 'tech-review': 'Tech Review',
  })) {
    const fichiers = cats[type]?.fichiers || [];
    for (const f of fichiers) {
      rituels.push({ type, titre: cfg, date: f.mtime, file: f.file });
    }
  }
  rituels.sort((a, b) => (b.date || 0) - (a.date || 0));

  // (#254 + #262) `_meta` propre au brief. version/generated reflètent la
  // génération du dashboard source (= moment où data.json a été créé) pour
  // que le consumer puisse corréler avec un build CI. `source` capture le
  // schema d'origine (toujours dashboard pour brief). Permet à un Slack-bot
  // de discriminer "this is a brief" vs "this is a dashboard dump".
  // (#293) `_meta.stale = true` si âge > TTL (cohérent #292 markdown callout).
  let stale = false;
  let ageHours = null;
  if (donnees._meta?.generated) {
    const ageMs = Date.now() - new Date(donnees._meta.generated).getTime();
    ageHours = Math.round(ageMs / 3600000);
    const envTtl = Number(process.env.AIAD_DASHBOARD_TTL_HOURS);
    const ttlH = Number.isFinite(envTtl) && envTtl > 0 ? envTtl : 24;
    stale = ageHours >= ttlH;
  }
  const metaBrief = donnees._meta ? {
    schema: 'aiad-sdd-brief',
    version: donnees._meta.version,
    generated: donnees._meta.generated,
    ageHours,
    stale,
    source: { schema: donnees._meta.schema, slim: donnees._meta.slim },
  } : null;
  return {
    ...(metaBrief ? { _meta: metaBrief } : {}),
    projet,
    maturite: maturite ? {
      score: maturite.score, total: maturite.total, label: maturite.label,
      raisonPlafond: maturite.raisonPlafond || null,
    } : null,
    sante: sante ? {
      score: sante.score, niveau: sante.niveau,
      composantesDisponibles: sante.composantesDisponibles,
      // (#283) Breakdown 5 dimensions pour Slack-bot rich rendering :
      // permet de pointer la dimension la plus faible. Léger (5 entrées
      // d'objets simples), pas d'impact sur la taille du brief.
      breakdown: Array.isArray(sante.breakdown) ? sante.breakdown.map((b) => ({
        id: b.id, label: b.label, points: b.points, max: b.max,
        ratio: b.ratio, disponible: b.disponible,
      })) : [],
    } : null,
    // (#339) publicationContext exposé pour les consumers Slack-bot/Notion
    // sync : avec sourceBase + publicUrl, on peut reconstruire les URLs de
    // SPECs/Intents mentionnés dans les alertes sans re-lire data.json.
    publicationContext: {
      sourceBase: donnees.sourceBase || '',
      publicUrl: donnees.publicUrl || '',
    },
    alertes,
    rituels: rituels.slice(0, 3),
    counts: {
      intents: (donnees.intents || []).length,
      specs: (donnees.specs || []).length,
      violations: donnees.violations?.total || 0,
      // (#280) Somme des tests via qa.coverage (ratio code↔tests par SPEC).
      // Métrique utile pour Slack-bot : "N tests covering M SPECs".
      tests: (donnees.qa?.coverage || []).reduce((sum, c) => sum + (Number.isFinite(c.tests) ? c.tests : 0), 0),
      // (#281) SPECs avec qa.coverage.tests === 0. Signal CI : "alerte
      // N SPECs sans tests" — push pour ajouter une suite de tests.
      // Filtre les `band === 'na'` (SPECs vides/non applicables).
      specsSansTests: (donnees.qa?.coverage || []).filter((c) => (c.tests || 0) === 0 && c.band !== 'na').length,
    },
  };
}

// Rendu console.
function couleurNiveau(niveau) {
  if (niveau === 'excellent' || niveau === 'sain') return C.vert;
  if (niveau === 'attention') return C.jaune || C.gris;
  return C.rouge;
}

export function afficherBrief(brief) {
  if (!brief) {
    console.log(`\n  ${C.jaune || C.gris}! dashboard/data.json absent.${C.reset} Lance ${C.cyan}aiad-sdd dashboard${C.reset} pour activer ce brief.\n`);
    return;
  }
  console.log(`\n${C.cyan}${C.gras}  AIAD SDD Mode — Brief projet${C.reset}`);
  console.log(`${C.gris}  ${brief.projet}${C.reset}\n`);

  // Bloc santé + maturité
  if (brief.sante) {
    const couleur = couleurNiveau(brief.sante.niveau);
    console.log(`  ${C.gras}Santé${C.reset}     ${couleur}${C.gras}${brief.sante.score}/100${C.reset} ${C.gris}— ${brief.sante.niveau} (${brief.sante.composantesDisponibles} composantes)${C.reset}`);
  }
  if (brief.maturite) {
    console.log(`  ${C.gras}Maturité${C.reset}  ${C.cyan}${brief.maturite.score}/${brief.maturite.total}${C.reset} ${C.gris}— ${brief.maturite.label}${brief.maturite.raisonPlafond ? ' · plafonné: ' + brief.maturite.raisonPlafond : ''}${C.reset}`);
  }
  // Counts
  const c = brief.counts;
  console.log(`  ${C.gras}Volume${C.reset}    ${C.cyan}${c.intents}${C.reset} Intent(s) · ${C.cyan}${c.specs}${C.reset} SPEC(s) · ${c.violations > 0 ? C.rouge : C.vert}${c.violations}${C.reset} violation(s) Tier 1\n`);

  // Top 3 alertes focus
  if (brief.alertes.length > 0) {
    console.log(`  ${C.gras}Focus du jour${C.reset}`);
    for (const a of brief.alertes) {
      console.log(`    ${C.jaune || C.gris}${a.priorite}${C.reset} ${a.titre}`);
      if (a.action) console.log(`      ${C.gris}→ ${a.action}${C.reset}`);
    }
    console.log('');
  } else {
    console.log(`  ${C.vert}✓ Pas d'alerte focus prioritaire.${C.reset}\n`);
  }

  // 3 derniers rituels
  if (brief.rituels.length > 0) {
    console.log(`  ${C.gras}Derniers rituels${C.reset}`);
    for (const r of brief.rituels) {
      const date = r.date ? new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '—';
      console.log(`    ${C.gris}${date}${C.reset}  ${r.titre}`);
    }
    console.log('');
  }
  console.log(`  ${C.gris}Détail : aiad-sdd dashboard --serve · aiad-sdd doctor${C.reset}\n`);
}

// (#295) Calcule le delta entre 2 briefs (current vs previous).
// Retourne un objet avec deltas par champ. Helper pure pour faciliter
// tests + composition (markdown render lit ce delta).
//   {
//     sante: { score: 75, scorePrev: 70, scoreDelta: +5 },
//     counts: { intents: { current: 15, prev: 14, delta: +1 }, ... },
//   }
export function calculerDelta(current, previous) {
  if (!current || !previous) return null;
  const out = { sante: null, counts: {} };
  if (current.sante?.score != null && previous.sante?.score != null) {
    out.sante = {
      score: current.sante.score,
      scorePrev: previous.sante.score,
      scoreDelta: current.sante.score - previous.sante.score,
    };
  }
  const keys = ['intents', 'specs', 'tests', 'violations', 'specsSansTests'];
  for (const k of keys) {
    const cur = current.counts?.[k];
    const prev = previous.counts?.[k];
    if (typeof cur === 'number' && typeof prev === 'number') {
      out.counts[k] = { current: cur, prev, delta: cur - prev };
    }
  }
  return out;
}

// Façade orchestrant lecture + calcul + affichage.
// (#229) Option `strict: N` → ajoute un champ `strictFail` au résultat si
// santé < N. Le CLI lit ce champ pour exit 1. Si dashboard absent, le mode
// strict force aussi un échec (« on n'a pas pu valider »).
export function brief(racineProjet, options = {}) {
  const donnees = lireDashboardData(racineProjet, options.out);
  const result = calculerBrief(donnees);

  const seuil = Number.isFinite(options.strict) ? options.strict : null;
  if (seuil != null) {
    if (!result) {
      // Dashboard absent → CI doit échouer (impossible de juger santé)
      const r2 = { strictFail: { raison: 'dashboard-absent', seuil } };
      if (options.json) {
        process.stdout.write(JSON.stringify(r2, null, 2) + '\n');
      } else if (options.markdown) {
        process.stdout.write(formatterMarkdown(null));
      } else {
        afficherBrief(null);
        console.log(`  ${escapeRedFor('✗')} ${boldFor('Strict échoué')} : dashboard absent (seuil ${seuil}).\n`);
      }
      return r2;
    }
    const score = result.sante?.score;
    if (score == null || score < seuil) {
      result.strictFail = { raison: score == null ? 'sante-absente' : 'sous-seuil', seuil, score };
    }
  }

  // (#299) --strict-tests=N : exit 1 si counts.tests < N. Parallèle à
  // --strict pour santé. Producteur de signal CI : "ce projet doit avoir
  // au moins N tests pour être mergeable". Cumulable avec --strict.
  const seuilTests = Number.isFinite(options.strictTests) ? options.strictTests : null;
  if (seuilTests != null && result) {
    const t = result.counts?.tests;
    if (t == null || t < seuilTests) {
      result.strictTestsFail = { raison: t == null ? 'tests-absents' : 'sous-seuil', seuil: seuilTests, tests: t };
    }
  }

  // (#295) Diff vs snapshot précédent (weekly trend, CI delta-check).
  // Fail-safe : si le fichier diff est absent/cassé, on log un warning
  // sur stderr et on continue sans delta (pas d'exit 1).
  if (result && options.diff) {
    try {
      const cheminDiff = String(options.diff).startsWith('/')
        ? options.diff
        : join(racineProjet, options.diff);
      const prev = JSON.parse(readFileSync(cheminDiff, 'utf-8'));
      result.delta = calculerDelta(result, prev);
    } catch (err) {
      process.stderr.write(`  ⚠ --diff: impossible de lire ${options.diff} (${err.message})\n`);
    }
  }

  if (options.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return result;
  }
  if (options.markdown) {
    // (#269) Sortie Markdown : pasteable Slack/Teams/Notion/PR description.
    // (#300) publicUrl propagé pour hyperlien footer vers dashboard publié.
    process.stdout.write(formatterMarkdown(result, { publicUrl: options.publicUrl }));
    return result;
  }
  // (#306) --quiet : silent si tous les checks strict passent (CI minimal
  // noise). Print uniquement les strictFail messages d'erreur sur stderr.
  // Sans strict actif et quiet → silent total (mais sans output → user
  // utilisera --json/--markdown s'il veut quelque chose).
  if (options.quiet) {
    if (result?.strictFail) {
      process.stderr.write(`✗ Strict échoué : score ${result.strictFail.score ?? '—'} < seuil ${result.strictFail.seuil}.\n`);
    }
    if (result?.strictTestsFail) {
      process.stderr.write(`✗ Strict tests échoué : tests ${result.strictTestsFail.tests ?? '—'} < seuil ${result.strictTestsFail.seuil}.\n`);
    }
    return result;
  }
  afficherBrief(result);
  if (result?.strictFail) {
    console.log(`  ${escapeRedFor('✗')} ${boldFor('Strict échoué')} : score ${result.strictFail.score ?? '—'} < seuil ${result.strictFail.seuil}.\n`);
  }
  if (result?.strictTestsFail) {
    console.log(`  ${escapeRedFor('✗')} ${boldFor('Strict tests échoué')} : tests ${result.strictTestsFail.tests ?? '—'} < seuil ${result.strictTestsFail.seuil}.\n`);
  }
  return result;
}

// (#269) Rend le brief en Markdown pasteable (Slack/Teams/Notion/PR/Issue).
// Inclut emojis santé + tables + lien dashboard pour navigation.
// (#300) opts.publicUrl : si défini, footer inclut un hyperlien vers le
// dashboard publié → Slack reader clique pour le détail complet.
export function formatterMarkdown(brief, opts = {}) {
  if (!brief) {
    return '> ⚠️ Dashboard absent — lance `aiad-sdd dashboard` puis re-essaie.\n';
  }
  const lignes = [];
  lignes.push(`## 📊 Brief AIAD — ${brief.projet}`);
  lignes.push('');
  // Bloc santé + maturité en table
  const niveau = brief.sante?.niveau;
  const emoji = niveau === 'excellent' || niveau === 'sain' ? '🟢'
    : niveau === 'attention' ? '🟡'
    : niveau === 'critique' ? '🔴' : '⚪';
  lignes.push('| Métrique | Valeur |');
  lignes.push('|---|---|');
  if (brief.sante) {
    lignes.push(`| ${emoji} Santé | **${brief.sante.score}/100** — ${brief.sante.niveau} (${brief.sante.composantesDisponibles} composantes) |`);
  }
  if (brief.maturite) {
    const plafond = brief.maturite.raisonPlafond ? ` · plafonné: ${brief.maturite.raisonPlafond}` : '';
    lignes.push(`| 🎯 Maturité | **${brief.maturite.score}/${brief.maturite.total}** — ${brief.maturite.label}${plafond} |`);
  }
  lignes.push(`| 📥 Intents | ${brief.counts.intents} |`);
  lignes.push(`| 📋 SPECs | ${brief.counts.specs} |`);
  if (brief.counts.tests > 0) {
    lignes.push(`| 🧪 Tests | ${brief.counts.tests} |`);
  }
  // (#281) Ligne SPECs sans tests si >0 (signal critique pour CI/QA).
  if (brief.counts.specsSansTests > 0) {
    lignes.push(`| ⚠️ SPECs sans tests | ${brief.counts.specsSansTests} |`);
  }
  const vio = brief.counts.violations;
  lignes.push(`| ${vio > 0 ? '⚠️' : '✅'} Violations Tier 1 | ${vio} |`);
  lignes.push('');
  // (#295) Bloc delta si comparé via --diff. Arrows ↑↓→ par métrique.
  if (brief.delta) {
    const d = brief.delta;
    const parts = [];
    if (d.sante && d.sante.scoreDelta !== 0) {
      const arrow = d.sante.scoreDelta > 0 ? '↑' : '↓';
      const sign = d.sante.scoreDelta > 0 ? '+' : '';
      parts.push(`Santé ${arrow} ${sign}${d.sante.scoreDelta}`);
    }
    for (const [k, info] of Object.entries(d.counts || {})) {
      if (info.delta !== 0) {
        const arrow = info.delta > 0 ? '↑' : '↓';
        const sign = info.delta > 0 ? '+' : '';
        parts.push(`${k} ${arrow} ${sign}${info.delta}`);
      }
    }
    if (parts.length > 0) {
      lignes.push(`> 📈 **Évolution depuis dernier brief** : ${parts.join(' · ')}`);
      lignes.push('');
    }
  }
  // (#288) Callout dimension la plus faible si breakdown disponible.
  // Aide PM à pointer où investir l'effort de la semaine. Filtre les
  // dimensions non disponibles (ratio null) et celles déjà à 100%.
  const bd = brief.sante?.breakdown || [];
  const bdMesurables = bd.filter((b) => b.disponible !== false && typeof b.ratio === 'number' && b.ratio < 1);
  if (bdMesurables.length > 0) {
    const faible = [...bdMesurables].sort((a, b) => a.ratio - b.ratio)[0];
    const pct = Math.round(faible.ratio * 100);
    lignes.push(`> 🎯 **Focus dimension** : ${faible.label} — ${faible.points}/${faible.max} (${pct}%)`);
    lignes.push('');
  }
  // Top 3 alertes focus
  if (brief.alertes.length > 0) {
    lignes.push('### 🎯 Focus du jour');
    lignes.push('');
    for (const a of brief.alertes) {
      lignes.push(`- **${a.priorite}** ${a.titre}`);
      if (a.action) lignes.push(`  - → _${a.action}_`);
    }
    lignes.push('');
  } else {
    lignes.push('### ✅ Pas d\'alerte focus prioritaire');
    lignes.push('');
  }
  // 3 derniers rituels
  if (brief.rituels.length > 0) {
    lignes.push('### 📅 Derniers rituels');
    lignes.push('');
    for (const r of brief.rituels) {
      const date = r.date ? new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '—';
      lignes.push(`- ${date} · ${r.titre}`);
    }
    lignes.push('');
  }
  // Strict fail (si présent)
  if (brief.strictFail) {
    const reason = brief.strictFail.score != null
      ? `score ${brief.strictFail.score} < seuil ${brief.strictFail.seuil}`
      : `raison ${brief.strictFail.raison}`;
    lignes.push(`> ❌ **Strict échoué** : ${reason}`);
    lignes.push('');
  }
  // (#299) Strict tests fail
  if (brief.strictTestsFail) {
    const reason = brief.strictTestsFail.tests != null
      ? `tests ${brief.strictTestsFail.tests} < seuil ${brief.strictTestsFail.seuil}`
      : `raison ${brief.strictTestsFail.raison}`;
    lignes.push(`> ❌ **Strict tests échoué** : ${reason}`);
    lignes.push('');
  }
  // (#287) Footer freshness : indique au consumer Slack/Notion l'âge des
  // données pour décider si re-générer ou pas. Format FR localisé pour
  // lisibilité humaine ("13/05/2026 23:05" plutôt qu'ISO).
  // (#292) Stale warning : si âge > TTL (défaut 24h, env AIAD_DASHBOARD_TTL_HOURS
  // comme #145), insère un callout d'alerte AVANT le footer.
  if (brief._meta?.generated) {
    const dt = new Date(brief._meta.generated);
    const ageMs = Date.now() - dt.getTime();
    const ageH = Math.round(ageMs / 3600000);
    const envTtl = Number(process.env.AIAD_DASHBOARD_TTL_HOURS);
    const ttlH = Number.isFinite(envTtl) && envTtl > 0 ? envTtl : 24;
    if (ageH >= ttlH) {
      // Stale callout — formaté pour visibilité Slack
      const ageLabel = ageH < 48 ? `${ageH} h` : `${Math.round(ageH / 24)} j`;
      // L'inséré entre le dernier bloc et le footer (chercher index footer)
      lignes.push(`> ⚠️ **Données âgées de ${ageLabel}** — relance \`aiad-sdd dashboard\` pour rafraîchir (TTL ${ttlH}h).`);
      lignes.push('');
    }
    const fmt = dt.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    // (#300) Si publicUrl défini, le footer inclut un hyperlien Markdown.
    const url = opts.publicUrl ? String(opts.publicUrl).replace(/\/+$/, '') : null;
    const detail = url ? `[dashboard](${url}/index.html)` : '`aiad-sdd dashboard --serve`';
    lignes.push(`_Détail : ${detail} · \`aiad-sdd doctor\` · Généré ${fmt}_`);
  } else {
    const url = opts.publicUrl ? String(opts.publicUrl).replace(/\/+$/, '') : null;
    const detail = url ? `[dashboard](${url}/index.html)` : '`aiad-sdd dashboard --serve`';
    lignes.push(`_Détail : ${detail} · \`aiad-sdd doctor\`_`);
  }
  return lignes.join('\n') + '\n';
}

// Helpers locaux pour éviter import circulaire term.js → brief.
function escapeRedFor(s) { return `${C.rouge}${s}${C.reset}`; }
function boldFor(s) { return `${C.gras}${s}${C.reset}`; }

// Alias EN canoniques (#42)
export {
  lireDashboardData as readDashboardData,
  calculerBrief as computeBrief,
  afficherBrief as renderBrief,
  formatterMarkdown as renderMarkdown,
  calculerDelta as computeDelta,
  brief as briefEN,
};
