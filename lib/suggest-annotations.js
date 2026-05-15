// AIAD SDD Mode — Suggestions d'annotations via Ollama local.
//
// **Cas d'usage** : un projet existant adopte AIAD et a déjà beaucoup de
// code non annoté. L'utilisateur veut un coup de pouce pour annoter
// rapidement les fichiers les plus critiques avec `@spec`/`@governance`/
// `@verified-by` cohérents avec le contexte projet (SPECs déjà rédigées,
// agents Tier 1 installés).
//
// **Cap stratégique souverain** : 100 % local via Ollama (#64). Aucune
// fuite de code propriétaire vers une API tierce. **Human Authorship
// préservé** : le LLM SUGGÈRE, l'humain VALIDE. Les suggestions sont
// affichées en mode aperçu — l'humain copie-colle ce qu'il valide.
//
// **Pipeline** :
//   1. Lit le contexte projet : SPECs (avec frontmatter title), Intents,
//      agents Tier 1 installés.
//   2. Construit un prompt structuré qui demande au LLM un objet JSON :
//        { specs: [...], governance: [...], confidence: 0-100 }
//   3. Parse + valide les IDs suggérés contre le contexte (un SPEC suggéré
//      qui n'existe pas est rejeté).
//   4. Affiche le bloc d'annotations recommandé (l'humain copie).
//
// **Configuration** : mêmes variables que `lib/score.js` (`AIAD_OLLAMA_URL`,
// `AIAD_OLLAMA_MODEL`).
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { C, log, logHeader } from './term.js';
import { parseFrontmatter } from './frontmatter.js';
import { appelerOllama } from './score.js';

// ─── Collecte du contexte projet ────────────────────────────────────────────

/**
 * Liste les SPECs disponibles avec leur titre (pour aider le LLM à choisir).
 *
 * @param {string} racine
 * @returns {{ id: string, title: string }[]}
 */
export function lireSpecsDisponibles(racine) {
  const dir = join(racine, '.aiad', 'specs');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const nom of readdirSync(dir)) {
    if (!nom.endsWith('.md') || nom.startsWith('_') || nom.startsWith('spec-ears-template')) continue;
    const m = nom.match(/^(SPEC-[A-Za-z0-9-]+)\.md$/);
    if (!m) continue;
    try {
      const contenu = readFileSync(join(dir, nom), 'utf-8');
      const { data } = parseFrontmatter(contenu);
      out.push({ id: m[1], title: data.title || data.titre || m[1] });
    } catch { /* ignore */ }
  }
  return out;
}

/**
 * Liste les agents de gouvernance Tier 1 installés.
 */
export function lireAgentsDisponibles(racine) {
  const dir = join(racine, '.aiad', 'gouvernance');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^AIAD-.+\.md$/.test(f) && f !== '_index.md')
    .map((f) => f.replace(/\.md$/, ''))
    .sort();
}

// ─── Fonctions pures (testables) ────────────────────────────────────────────

/**
 * Construit le prompt envoyé à Ollama. Demande explicitement une réponse
 * JSON pour rendre le parsing déterministe.
 *
 * @param {string} cheminCode
 * @param {string} extraitCode — préfixe / contexte du fichier (≤ 4000 chars)
 * @param {{ id: string, title: string }[]} specs
 * @param {string[]} agents
 * @returns {string}
 */
export function construirePromptAnnotations(cheminCode, extraitCode, specs, agents) {
  const lignes = [];
  lignes.push("Tu es un Product Engineer expert en AIAD SDD Mode (Spec Driven Development).");
  lignes.push("Ta mission : suggérer des annotations machine pour un fichier code existant.");
  lignes.push("");
  lignes.push("Annotations possibles :");
  lignes.push("- @intent INTENT-NNN");
  lignes.push("- @spec SPEC-NNN-N-slug    (un fichier peut référencer plusieurs SPECs)");
  lignes.push("- @verified-by chemin/test  (chemins relatifs)");
  lignes.push("- @governance AIAD-X,AIAD-Y (agents Tier 1)");
  lignes.push("");
  lignes.push(`Fichier à annoter : \`${cheminCode}\``);
  lignes.push("");
  lignes.push('"""');
  lignes.push(extraitCode.slice(0, 4000));
  lignes.push('"""');
  lignes.push("");
  if (specs.length > 0) {
    lignes.push("SPECs déjà rédigées dans le projet (utilise UNIQUEMENT celles-ci) :");
    for (const s of specs.slice(0, 50)) {
      lignes.push(`- ${s.id} : ${s.title}`);
    }
    if (specs.length > 50) lignes.push(`- (+${specs.length - 50} autres SPECs)`);
  } else {
    lignes.push("Aucune SPEC disponible. Suggère au minimum les agents de gouvernance applicables.");
  }
  lignes.push("");
  if (agents.length > 0) {
    lignes.push(`Agents Tier 1 installés : ${agents.join(', ')}`);
  }
  lignes.push("");
  lignes.push("Réponds STRICTEMENT par un objet JSON valide, sans texte avant ni après. Schéma :");
  lignes.push("```json");
  lignes.push("{");
  lignes.push('  "specs": ["SPEC-001-1-slug", ...],');
  lignes.push('  "governance": ["AIAD-RGPD", ...],');
  lignes.push('  "verified_by": ["tests/path/file.test.ts", ...],');
  lignes.push('  "confidence": 0-100,');
  lignes.push('  "reasoning": "Une phrase courte expliquant le choix."');
  lignes.push("}");
  lignes.push("```");
  lignes.push("");
  lignes.push("Si le fichier ne correspond à AUCUNE SPEC connue, mets `\"specs\": []` et explique pourquoi dans `reasoning`.");
  return lignes.join('\n');
}

/**
 * Parse la réponse Ollama et valide les IDs contre le contexte projet.
 *
 * @param {string} brut
 * @param {{ id: string, title: string }[]} specsDisponibles
 * @param {string[]} agentsDisponibles
 * @returns {{ specs: string[], governance: string[], verified_by: string[], confidence: number, reasoning: string, ignored: { specs: string[], governance: string[] } }}
 */
export function parserSuggestions(brut, specsDisponibles, agentsDisponibles) {
  const match = String(brut).match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Réponse non-JSON : "${String(brut).slice(0, 100)}…"`);
  let json;
  try { json = JSON.parse(match[0]); }
  catch (e) { throw new Error(`JSON invalide : ${e.message}`); }

  const specsValides = new Set(specsDisponibles.map((s) => s.id));
  const agentsValides = new Set(agentsDisponibles);

  // Filtrage par existence : on rejette les IDs hallucinés.
  const specs = (json.specs || []).filter((s) => typeof s === 'string');
  const specsRetenues = specs.filter((s) => specsValides.has(s));
  const specsIgnorees = specs.filter((s) => !specsValides.has(s));

  const gov = (json.governance || []).filter((s) => typeof s === 'string');
  const govRetenus = gov.filter((g) => agentsValides.has(g));
  const govIgnores = gov.filter((g) => !agentsValides.has(g));

  const verifiedBy = (json.verified_by || []).filter((s) => typeof s === 'string').slice(0, 5);

  let confidence = Number(json.confidence);
  if (!Number.isFinite(confidence)) confidence = 50;
  if (confidence < 0) confidence = 0;
  if (confidence > 100) confidence = 100;

  return {
    specs: specsRetenues,
    governance: govRetenus,
    verified_by: verifiedBy,
    confidence,
    reasoning: typeof json.reasoning === 'string' ? json.reasoning : '',
    ignored: {
      specs: specsIgnorees,
      governance: govIgnores,
    },
  };
}

/**
 * Construit le bloc d'annotations à coller dans le code (style JSDoc ou
 * commentaire ligne selon le langage).
 *
 * @param {object} suggestions
 * @param {{ comment?: 'js'|'py'|'sh' }} [options]
 * @returns {string}
 */
export function genererBlocAnnotations(suggestions, options = {}) {
  const { specs, governance, verified_by } = suggestions;
  if (specs.length === 0 && governance.length === 0 && verified_by.length === 0) {
    return '';
  }
  const style = options.comment || 'js';
  const lignes = [];
  if (style === 'js') {
    lignes.push('/**');
    for (const s of specs) lignes.push(` * @spec ${s}`);
    for (const v of verified_by) lignes.push(` * @verified-by ${v}`);
    if (governance.length) lignes.push(` * @governance ${governance.join(',')}`);
    lignes.push(' */');
  } else {
    const prefix = style === 'sh' ? '# ' : '# ';
    for (const s of specs) lignes.push(`${prefix}@spec ${s}`);
    for (const v of verified_by) lignes.push(`${prefix}@verified-by ${v}`);
    if (governance.length) lignes.push(`${prefix}@governance ${governance.join(',')}`);
  }
  return lignes.join('\n');
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

function detecterStyleCommentaire(cheminCode) {
  const ext = cheminCode.split('.').pop().toLowerCase();
  if (['py', 'rb'].includes(ext)) return 'py';
  if (['sh', 'bash'].includes(ext)) return 'sh';
  return 'js';
}

/**
 * Suggère des annotations pour un fichier de code.
 *
 * @param {string} racine
 * @param {string} cheminRelatif — chemin du fichier dans le projet
 * @param {{ url?: string, model?: string, fetch?: Function, json?: boolean }} [options]
 * @returns {Promise<{ chemin: string, suggestions: object, bloc: string }>}
 */
export async function suggererAnnotations(racine, cheminRelatif, options = {}) {
  const cheminAbsolu = join(racine, cheminRelatif);
  if (!existsSync(cheminAbsolu)) {
    throw new Error(`Fichier introuvable : ${cheminRelatif}`);
  }
  const code = readFileSync(cheminAbsolu, 'utf-8');
  const specs = lireSpecsDisponibles(racine);
  const agents = lireAgentsDisponibles(racine);

  const prompt = construirePromptAnnotations(cheminRelatif, code, specs, agents);
  const brut = await appelerOllama(prompt, options);
  const suggestions = parserSuggestions(brut, specs, agents);
  const bloc = genererBlocAnnotations(suggestions, {
    comment: detecterStyleCommentaire(cheminRelatif),
  });

  if (options.json) {
    process.stdout.write(JSON.stringify({
      file: cheminRelatif,
      suggestions,
      block: bloc,
    }, null, 2) + '\n');
    return { chemin: cheminRelatif, suggestions, bloc };
  }

  logHeader(
    `AIAD SDD — Suggestions d'annotations`,
    `${cheminRelatif} (Ollama local, Human Authorship préservé)`,
  );

  console.log(`  ${C.gras}Confiance${C.reset} : ${suggestions.confidence}%`);
  if (suggestions.reasoning) console.log(`  ${C.gris}${suggestions.reasoning}${C.reset}`);
  console.log('');

  if (suggestions.specs.length === 0 && suggestions.governance.length === 0) {
    console.log(`  ${C.jaune}~${C.reset} Aucune suggestion fiable. Le LLM n'a pas trouvé de SPEC ou agent applicable au contexte.`);
    if (suggestions.ignored.specs.length) {
      console.log(`    ${C.gris}SPECs hallucinées (rejetées) : ${suggestions.ignored.specs.join(', ')}${C.reset}`);
    }
  } else {
    console.log(`  ${C.gras}Bloc proposé (à valider et coller manuellement)${C.reset} :\n`);
    console.log(bloc.split('\n').map((l) => '    ' + l).join('\n'));
  }

  if (suggestions.ignored.specs.length || suggestions.ignored.governance.length) {
    console.log(`\n  ${C.gris}Rejets (IDs inexistants dans le projet) :${C.reset}`);
    if (suggestions.ignored.specs.length) console.log(`    ${C.gris}- SPECs : ${suggestions.ignored.specs.join(', ')}${C.reset}`);
    if (suggestions.ignored.governance.length) console.log(`    ${C.gris}- agents : ${suggestions.ignored.governance.join(', ')}${C.reset}`);
  }

  console.log(`\n  ${C.gris}⚠ Human Authorship : valide chaque ligne avant intégration.${C.reset}\n`);
  return { chemin: cheminRelatif, suggestions, bloc };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  lireSpecsDisponibles as listAvailableSpecs,
  lireAgentsDisponibles as listAvailableAgents,
  construirePromptAnnotations as buildAnnotationPrompt,
  parserSuggestions as parseSuggestions,
  genererBlocAnnotations as generateAnnotationBlock,
  suggererAnnotations as suggestAnnotations,
};
