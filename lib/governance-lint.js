// AIAD SDD Mode — Linter de gouvernance.
//
// Détecte les **contradictions inter-agents Tier 1** : si un agent dit
// `TOUJOURS X` et un autre dit `JAMAIS X`, c'est un conflit qui doit être
// arbitré humainement (juriste / DPO / RSSI). Le linter ne décide pas, il
// signale.
//
// **Algorithme** :
//   1. Charge tous les `.aiad/gouvernance/AIAD-*.md`.
//   2. Extrait les règles `TOUJOURS` et `JAMAIS` (lignes commençant par
//      `- **TOUJOURS**` ou `- **JAMAIS**`).
//   3. Tokenise chaque règle en mots-clés (sans stop words FR/EN, lowercase).
//   4. Pour chaque paire (TOUJOURS de A, JAMAIS de B), calcule la similarité
//      Jaccard.
//   5. Si la similarité ≥ 0.6 ET ≥ 3 mots-clés en commun → conflit potentiel.
//
// **Détecte aussi** :
//   - Règles strictement dupliquées dans le même agent (cohérence interne).
//   - Agents Tier 1 manquants (référencés dans des SPECs mais pas installés).
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { C, log, logHeader } from './term.js';

// ─── Stop words ─────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  // FR
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux',
  'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car',
  'à', 'a', 'avec', 'sans', 'dans', 'sur', 'sous', 'pour', 'par', 'en',
  'que', 'qui', 'quoi', 'dont', 'où',
  'ce', 'cet', 'cette', 'ces',
  'son', 'sa', 'ses', 'leur', 'leurs', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
  'est', 'sont', 'être', 'été', 'avoir', 'eu', 'ai', 'as', 'a',
  'ne', 'pas', 'plus', 'tout', 'tous', 'toute', 'toutes',
  'si', 'comme', 'aussi', 'alors',
  'jamais', 'toujours',
  // EN
  'the', 'a', 'an', 'and', 'or', 'but', 'so', 'nor', 'for', 'yet',
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'as',
  'this', 'that', 'these', 'those',
  'never', 'always',
]);

// ─── Fonctions pures ────────────────────────────────────────────────────────

/**
 * Tokenise une règle en mots-clés normalisés (sans stop words, ≥ 3 chars).
 *
 * @param {string} regle
 * @returns {string[]}
 */
export function tokenizer(regle) {
  return String(regle)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\*\*[^*]+\*\*/g, ' ') // retire les **TOUJOURS** / **JAMAIS**
    .replace(/`[^`]+`/g, ' ') // retire les `code spans`
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

/**
 * Similarité Jaccard entre deux ensembles de tokens.
 */
export function similariteJaccard(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Extrait les règles TOUJOURS / JAMAIS d'un agent Tier 1.
 *
 * Convention attendue : section `## RÈGLES ABSOLUES — TOUJOURS` puis
 * lignes `- **TOUJOURS**`, idem pour JAMAIS. Tolère aussi les variantes
 * `**ALWAYS**` / `**NEVER**` (anglais).
 *
 * @param {string} contenu
 * @returns {{ toujours: string[], jamais: string[] }}
 */
export function extraireRegles(contenu) {
  const toujours = [];
  const jamais = [];
  const lignes = String(contenu).split('\n');
  for (const ligne of lignes) {
    const trim = ligne.trim();
    if (!trim.startsWith('-')) continue;
    if (/\*\*(TOUJOURS|ALWAYS)\*\*/i.test(trim)) {
      toujours.push(trim);
    } else if (/\*\*(JAMAIS|NEVER)\*\*/i.test(trim)) {
      jamais.push(trim);
    }
  }
  return { toujours, jamais };
}

/**
 * Charge un agent Tier 1 depuis `.aiad/gouvernance/AIAD-X.md`.
 *
 * @param {string} racine
 * @returns {{ id: string, path: string, regles: { toujours: string[], jamais: string[] } }[]}
 */
export function chargerAgents(racine) {
  const dir = join(racine, '.aiad', 'gouvernance');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const nom of readdirSync(dir)) {
    if (!/^AIAD-.+\.md$/.test(nom) || nom === '_index.md') continue;
    const path = join(dir, nom);
    const contenu = readFileSync(path, 'utf-8');
    out.push({
      id: nom.replace(/\.md$/, ''),
      path,
      regles: extraireRegles(contenu),
    });
  }
  return out;
}

/**
 * Détecte les conflits entre TOUJOURS de A et JAMAIS de B (et inversement).
 * Renvoie les paires avec leur similarité Jaccard et les tokens communs.
 *
 * @param {object[]} agents
 * @param {{ seuilSimilarite?: number, minTokensCommuns?: number }} [options]
 * @returns {{ a: string, b: string, regleA: string, regleB: string, similarite: number, tokensCommuns: string[] }[]}
 */
export function detecterConflits(agents, options = {}) {
  const { seuilSimilarite = 0.6, minTokensCommuns = 3 } = options;
  const conflits = [];

  // Comparaison croisée : TOUJOURS de A vs JAMAIS de B (A ≠ B)
  for (const a of agents) {
    for (const b of agents) {
      if (a.id === b.id) continue;
      for (const tA of a.regles.toujours) {
        const tokensA = tokenizer(tA);
        for (const jB of b.regles.jamais) {
          const tokensB = tokenizer(jB);
          const inter = tokensA.filter((t) => tokensB.includes(t));
          if (inter.length < minTokensCommuns) continue;
          const sim = similariteJaccard(tokensA, tokensB);
          if (sim >= seuilSimilarite) {
            conflits.push({
              a: a.id, b: b.id,
              regleA: tA, regleB: jB,
              similarite: sim,
              tokensCommuns: inter,
            });
          }
        }
      }
    }
  }

  // Déduplication symétrique : garde une seule représentation par paire.
  const vus = new Set();
  return conflits.filter((c) => {
    const key = [c.a, c.b, c.regleA, c.regleB].sort().join('|');
    if (vus.has(key)) return false;
    vus.add(key);
    return true;
  });
}

/**
 * Détecte les règles dupliquées **à l'intérieur** d'un même agent.
 *
 * @param {object} agent
 * @returns {{ regle: string, type: 'TOUJOURS'|'JAMAIS' }[]}
 */
export function detecterDoublons(agent) {
  const out = [];
  for (const type of ['toujours', 'jamais']) {
    const seen = new Set();
    for (const r of agent.regles[type]) {
      const sig = tokenizer(r).sort().join(' ');
      if (sig.length === 0) continue;
      if (seen.has(sig)) {
        out.push({ regle: r, type: type.toUpperCase() });
      } else {
        seen.add(sig);
      }
    }
  }
  return out;
}

/**
 * Détecte les agents Tier 1 manquants : référencés dans `governance:` du
 * frontmatter d'une SPEC, mais absents du dossier `gouvernance/`.
 *
 * @param {string} racine
 * @returns {{ agent: string, references: string[] }[]}
 */
export function detecterAgentsManquants(racine) {
  const govDir = join(racine, '.aiad', 'gouvernance');
  const installes = new Set();
  if (existsSync(govDir)) {
    for (const f of readdirSync(govDir)) {
      const m = f.match(/^(AIAD-.+)\.md$/);
      if (m) installes.add(m[1]);
    }
  }
  const specsDir = join(racine, '.aiad', 'specs');
  if (!existsSync(specsDir)) return [];

  const referenceParAgent = new Map();
  for (const f of readdirSync(specsDir)) {
    if (!f.endsWith('.md') || f.startsWith('_') || f.startsWith('spec-ears-template')) continue;
    const c = readFileSync(join(specsDir, f), 'utf-8');
    const m = c.match(/^governance:\s*([^\n]+)/m);
    if (!m) continue;
    const refs = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    for (const ref of refs) {
      if (!installes.has(ref)) {
        const arr = referenceParAgent.get(ref) || [];
        arr.push(f.replace(/\.md$/, ''));
        referenceParAgent.set(ref, arr);
      }
    }
  }
  return [...referenceParAgent.entries()].map(([agent, references]) => ({ agent, references }));
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Exécute le linter complet sur le projet courant.
 *
 * @param {string} racine
 * @param {{ json?: boolean, seuilSimilarite?: number }} [options]
 * @returns {Promise<{ conflits: object[], doublons: object[], manquants: object[], ok: boolean }>}
 */
export async function lintGouvernance(racine, options = {}) {
  const { json = false, seuilSimilarite = 0.6 } = options;

  if (!existsSync(join(racine, '.aiad'))) {
    throw new Error(`.aiad/ introuvable. Lance \`aiad-sdd init\` d'abord.`);
  }

  const agents = chargerAgents(racine);
  const conflits = detecterConflits(agents, { seuilSimilarite });
  const doublons = agents.flatMap((a) => detecterDoublons(a).map((d) => ({ agent: a.id, ...d })));
  const manquants = detecterAgentsManquants(racine);

  const ok = conflits.length === 0 && doublons.length === 0 && manquants.length === 0;
  const result = { conflits, doublons, manquants, ok, agents: agents.length };

  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return result;
  }

  logHeader('AIAD SDD — Linter de gouvernance', `${agents.length} agents Tier 1 chargés`);

  if (manquants.length) {
    console.log(`\n${C.gras}  Agents manquants (référencés dans SPECs mais absents)${C.reset}`);
    for (const m of manquants) {
      console.log(`  ${C.rouge}✗${C.reset} ${m.agent} → référencé par : ${m.references.join(', ')}`);
    }
  }

  if (doublons.length) {
    console.log(`\n${C.gras}  Doublons internes${C.reset}`);
    for (const d of doublons) {
      console.log(`  ${C.jaune}~${C.reset} ${d.agent} (${d.type}) ${d.regle.slice(0, 80)}…`);
    }
  }

  if (conflits.length) {
    console.log(`\n${C.gras}  Conflits TOUJOURS / JAMAIS inter-agents${C.reset}`);
    for (const c of conflits) {
      console.log(`  ${C.rouge}✗${C.reset} ${c.a} ↔ ${c.b}  (similarité ${c.similarite.toFixed(2)})`);
      console.log(`    ${C.gris}TOUJOURS (${c.a}):${C.reset} ${c.regleA.slice(0, 100)}`);
      console.log(`    ${C.gris}JAMAIS  (${c.b}):${C.reset} ${c.regleB.slice(0, 100)}`);
      console.log(`    ${C.gris}Tokens communs : ${c.tokensCommuns.slice(0, 5).join(', ')}${C.reset}`);
    }
  }

  if (ok) {
    console.log(`\n  ${C.vert}✓${C.reset} Aucune contradiction détectée. ${agents.length} agents cohérents.\n`);
  } else {
    console.log(`\n  ${C.rouge}✗${C.reset} ${conflits.length} conflit(s), ${doublons.length} doublon(s), ${manquants.length} agent(s) manquant(s).\n`);
  }

  return result;
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  tokenizer as tokenize,
  similariteJaccard as jaccardSimilarity,
  extraireRegles as extractRules,
  chargerAgents as loadAgents,
  detecterConflits as detectConflicts,
  detecterDoublons as detectDuplicates,
  detecterAgentsManquants as detectMissingAgents,
  lintGouvernance as lintGovernance,
};
