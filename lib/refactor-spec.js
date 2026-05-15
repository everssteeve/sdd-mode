// AIAD SDD Mode — `aiad-sdd refactor-spec` (item #103).
//
// **Cas d'usage** : une SPEC qui dépasse les seuils raisonnables (longueur,
// nombre de critères EARS) devient impossible à maintenir et casse le
// principe "Activation par tâche" du Context Engineering Budget : si la
// SPEC ne tient plus dans le contexte agent, elle doit être **découpée**.
//
// **Heuristiques** :
//   - LOC body > 200 → trop longue
//   - Critères EARS > 7 → trop dense
//   - Sections H2/H3 ≥ 3 → découpage thématique possible
//
// **Stratégie de découpage** :
//   - Mode **structurel** (défaut, zero-dep) : regroupe les critères par
//     section H2/H3 et propose N sous-SPECs avec titres dérivés des
//     sections.
//   - Mode **AI-augmented** (`--ai`) : Ollama local propose un découpage
//     sémantique justifié, retombe sur le structurel si Ollama indispo.
//
// Documentation : https://aiad.ovh/refactor-spec

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';
import { appelerOllama } from './score.js';
import { C, logHeader } from './term.js';

const SEUIL_LOC = 200;
const SEUIL_CRITERES = 7;
const SEUIL_SECTIONS = 3;

// ─── Détection ──────────────────────────────────────────────────────────────

/**
 * Compte les lignes effectives du body (hors lignes vides en début/fin).
 */
export function compterLignes(body) {
  if (typeof body !== 'string') return 0;
  return body.split('\n').length;
}

/**
 * Compte les critères EARS du body :
 *   `WHEN ... THE SYSTEM SHALL ...`
 *   `IF ... THEN THE SYSTEM SHALL ...`
 *   `WHILE ... THE SYSTEM SHALL ...`
 *   `WHERE ... THE SYSTEM SHALL ...`
 * Ainsi que les patterns francisés équivalents (`QUAND ... LE SYSTÈME DOIT`)
 * et les puces "**AC-N**" ou "Critère N".
 */
export function compterCriteres(body) {
  if (typeof body !== 'string') return 0;
  let total = 0;
  const patterns = [
    /\b(WHEN|IF|WHILE|WHERE)\b[^.\n]*\b(THE SYSTEM SHALL|SHALL)\b/gi,
    /\b(QUAND|SI|TANT QUE|LORSQUE|OÙ)\b[^.\n]*\b(LE SYSTÈME DOIT|DOIT)\b/gi,
    /^\s*-\s*\*\*AC-\d+\*\*/gim,
    /^\s*-?\s*\*\*Critère\s+\d+\*\*/gim,
  ];
  for (const re of patterns) {
    const m = body.match(re);
    if (m) total += m.length;
  }
  return total;
}

/**
 * Liste les sections H2/H3 du body (pour proposer un découpage).
 *
 * @param {string} body
 * @returns {{ level: number, titre: string, ligne: number, fin?: number }[]}
 */
export function listerSections(body) {
  if (typeof body !== 'string') return [];
  const lignes = body.split('\n');
  const sections = [];
  for (let i = 0; i < lignes.length; i++) {
    const m = lignes[i].match(/^(#{2,3})\s+(.+?)\s*$/);
    if (m) sections.push({ level: m[1].length, titre: m[2].trim(), ligne: i });
  }
  // Calcule la fin de chaque section (ligne juste avant la section suivante)
  for (let i = 0; i < sections.length; i++) {
    sections[i].fin = (i + 1 < sections.length) ? sections[i + 1].ligne - 1 : lignes.length - 1;
  }
  return sections;
}

/**
 * Évalue une SPEC et indique si refactoring nécessaire.
 *
 * @param {string} body
 * @param {object} [frontmatter]
 * @returns {{ loc: number, criteres: number, sections: object[], depasseLoc: boolean, depasseCriteres: boolean, doitRefactoriser: boolean }}
 */
export function evaluerSpec(body, frontmatter = {}) {
  const loc = compterLignes(body);
  const criteres = compterCriteres(body);
  const sections = listerSections(body);
  return {
    loc,
    criteres,
    sections,
    depasseLoc: loc > SEUIL_LOC,
    depasseCriteres: criteres > SEUIL_CRITERES,
    doitRefactoriser: loc > SEUIL_LOC || criteres > SEUIL_CRITERES,
  };
}

// ─── Lecture des SPECs ─────────────────────────────────────────────────────

/**
 * Charge une SPEC par ID depuis `.aiad/specs/`.
 */
export function chargerSpec(racine, specId) {
  const dir = join(racine, '.aiad', 'specs');
  if (!existsSync(dir)) throw new Error(`.aiad/specs/ introuvable.`);
  const list = readdirSync(dir);
  const idUp = specId.toUpperCase();
  const fichier = list.find((f) => f.toUpperCase().startsWith(idUp));
  if (!fichier) throw new Error(`SPEC ${specId} introuvable dans ${dir}.`);
  const path = join(dir, fichier);
  const contenu = readFileSync(path, 'utf-8');
  const { data, body } = parseFrontmatter(contenu);
  return { id: specId, path, fichier, frontmatter: data, body };
}

/**
 * Liste toutes les SPECs (utile pour --all).
 */
export function listerSpecs(racine) {
  const dir = join(racine, '.aiad', 'specs');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_') && !f.startsWith('spec-ears-template'))
    .map((f) => f.replace(/\.md$/, ''));
}

// ─── Découpage structurel ───────────────────────────────────────────────────

/**
 * Propose un découpage à partir des sections H2 du body.
 *
 * Stratégie :
 *   - On regroupe les critères par section H2.
 *   - Chaque H2 produit une sous-SPEC dont :
 *       - id  = SPEC-NNN-K-slug (slug dérivé du titre H2)
 *       - titre = "<spec-titre> — <h2-titre>"
 *       - body  = section + sections H3 imbriquées
 *
 * @param {{ id: string, frontmatter: object, body: string }} spec
 * @returns {{ id: string, titre: string, body: string }[]}
 */
export function proposerDecoupageStructurel(spec) {
  const sections = listerSections(spec.body).filter((s) => s.level === 2);
  if (sections.length < SEUIL_SECTIONS) return [];
  const lignes = spec.body.split('\n');
  const titreParent = spec.frontmatter.title || spec.frontmatter.titre || spec.id;
  // Retire le suffixe version+slug : "SPEC-001-1-auth" → "SPEC-001".
  // Le slug doit commencer par une lettre pour ne pas dévorer "001-1-x".
  const baseId = spec.id.replace(/-\d+-[a-z][a-z0-9-]*$/i, '');

  const out = [];
  for (let k = 0; k < sections.length; k++) {
    const s = sections[k];
    const slug = s.titre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
    const blocLignes = lignes.slice(s.ligne, s.fin + 1);
    out.push({
      id: `${baseId}-${k + 1}-${slug || 'section'}`,
      titre: `${titreParent} — ${s.titre}`,
      body: blocLignes.join('\n').trim(),
    });
  }
  return out;
}

// ─── Découpage AI-augmented ────────────────────────────────────────────────

/**
 * Construit un prompt pour Ollama afin de proposer un découpage sémantique.
 */
export function construirePromptDecoupage(spec, evaluation) {
  const lignes = [];
  lignes.push('Tu es un architecte SPEC AIAD spécialisé dans le découpage des spécifications volumineuses.');
  lignes.push(`La SPEC suivante dépasse les seuils : ${evaluation.loc} lignes (seuil ${SEUIL_LOC}), ${evaluation.criteres} critères (seuil ${SEUIL_CRITERES}).`);
  lignes.push('');
  lignes.push(`# ${spec.frontmatter.title || spec.id}`);
  lignes.push('');
  lignes.push(spec.body);
  lignes.push('');
  lignes.push('---');
  lignes.push('');
  lignes.push('Propose un découpage en 2 à 5 sous-SPECs cohérentes, chacune ≤ 7 critères. Réponds STRICTEMENT au format JSON suivant :');
  lignes.push('');
  lignes.push('{');
  lignes.push('  "sousSpecs": [');
  lignes.push('    { "titre": "string court", "perimetre": "ce qui est couvert", "criteres": ["bullet 1", "bullet 2"] }');
  lignes.push('  ],');
  lignes.push('  "rationale": "explication brève du découpage"');
  lignes.push('}');
  return lignes.join('\n');
}

export function parserDecoupageAI(brut) {
  if (typeof brut !== 'string') throw new Error('Réponse Ollama vide.');
  const debut = brut.indexOf('{');
  if (debut === -1) throw new Error('Réponse Ollama sans JSON.');
  const candidat = brut.slice(debut);
  const fin = candidat.lastIndexOf('}');
  let data;
  try { data = JSON.parse(candidat.slice(0, fin + 1)); }
  catch (err) { throw new Error(`JSON Ollama invalide : ${err.message}`); }
  if (!Array.isArray(data.sousSpecs)) throw new Error('Champ sousSpecs manquant.');
  return {
    sousSpecs: data.sousSpecs.slice(0, 5).map((s) => ({
      titre: String(s.titre || s.title || '').trim(),
      perimetre: String(s.perimetre || s.scope || '').trim(),
      criteres: Array.isArray(s.criteres || s.criteria) ? (s.criteres || s.criteria).map((c) => String(c).trim()) : [],
    })),
    rationale: String(data.rationale || '').trim(),
  };
}

// ─── Pipeline ──────────────────────────────────────────────────────────────

/**
 * Refactor une SPEC précise.
 *
 * @param {string} racine
 * @param {string} specId
 * @param {{ ai?: boolean, fetch?: Function, json?: boolean, url?: string, model?: string }} [options]
 */
export async function refactorSpec(racine, specId, options = {}) {
  const spec = chargerSpec(racine, specId);
  const evaluation = evaluerSpec(spec.body, spec.frontmatter);

  let proposition;
  if (options.ai) {
    try {
      const brut = await appelerOllama(construirePromptDecoupage(spec, evaluation), {
        url: options.url, model: options.model, fetch: options.fetch,
      });
      proposition = { mode: 'ai', ...parserDecoupageAI(brut) };
    } catch (err) {
      // Fallback structurel
      const sousSpecs = proposerDecoupageStructurel(spec).map((s) => ({
        titre: s.titre, perimetre: '(découpage structurel par sections H2)', criteres: [],
      }));
      proposition = {
        mode: 'fallback-structurel',
        sousSpecs,
        rationale: `Ollama indisponible (${err.message}) — découpage par sections H2.`,
      };
    }
  } else {
    const sousSpecs = proposerDecoupageStructurel(spec).map((s) => ({
      titre: s.titre, perimetre: '(découpage structurel par sections H2)', criteres: [],
    }));
    proposition = {
      mode: 'structurel',
      sousSpecs,
      rationale: sousSpecs.length === 0
        ? `Aucune section H2 ≥ ${SEUIL_SECTIONS} détectée — un découpage manuel est nécessaire (utilise --ai pour suggestion sémantique).`
        : `Découpage proposé sur ${sousSpecs.length} sections H2.`,
    };
  }

  const resultat = { spec: spec.id, evaluation, proposition };

  if (options.json) {
    process.stdout.write(JSON.stringify(resultat, null, 2) + '\n');
    return resultat;
  }

  logHeader(
    `AIAD SDD — Refactor SPEC ${spec.id}`,
    `${evaluation.loc} lignes · ${evaluation.criteres} critères · ${evaluation.sections.length} sections H2/H3`,
  );
  if (!evaluation.doitRefactoriser) {
    console.log(`\n  ${C.vert}✓${C.reset} La SPEC est sous les seuils (LOC ≤ ${SEUIL_LOC}, critères ≤ ${SEUIL_CRITERES}).\n`);
    return resultat;
  }
  console.log('');
  console.log(`  ${evaluation.depasseLoc ? C.rouge + '✗' : C.vert + '✓'}${C.reset} Lignes : ${evaluation.loc} (seuil ${SEUIL_LOC})`);
  console.log(`  ${evaluation.depasseCriteres ? C.rouge + '✗' : C.vert + '✓'}${C.reset} Critères : ${evaluation.criteres} (seuil ${SEUIL_CRITERES})`);
  console.log('');
  console.log(`  ${C.gras}Découpage proposé${C.reset} (${proposition.mode}) :`);
  if (proposition.sousSpecs.length === 0) {
    console.log(`    ${C.jaune}~ Aucune sous-SPEC suggérée. ${proposition.rationale}${C.reset}`);
  } else {
    for (const s of proposition.sousSpecs) {
      console.log(`    ${C.cyan}→${C.reset} ${s.titre}`);
      if (s.perimetre) console.log(`      ${C.gris}${s.perimetre}${C.reset}`);
    }
  }
  if (proposition.rationale) console.log(`\n  ${C.gris}${proposition.rationale}${C.reset}`);
  console.log('');
  return resultat;
}

/**
 * Refactor toutes les SPECs détectées comme volumineuses.
 */
export async function refactorAll(racine, options = {}) {
  const ids = listerSpecs(racine);
  const evaluations = [];
  for (const id of ids) {
    try {
      const spec = chargerSpec(racine, id);
      const evaluation = evaluerSpec(spec.body, spec.frontmatter);
      if (evaluation.doitRefactoriser) {
        evaluations.push({ id, ...evaluation });
      }
    } catch { /* ignore */ }
  }
  if (options.json) {
    process.stdout.write(JSON.stringify({ candidats: evaluations }, null, 2) + '\n');
    return { candidats: evaluations };
  }
  logHeader('AIAD SDD — Refactor SPECs', `${evaluations.length} SPEC(s) au-dessus des seuils sur ${ids.length} totales`);
  if (evaluations.length === 0) {
    console.log(`  ${C.vert}✓${C.reset} Toutes les SPECs sont sous les seuils.\n`);
    return { candidats: [] };
  }
  for (const e of evaluations) {
    console.log(`  ${C.rouge}●${C.reset} ${e.id}  ${C.gris}(${e.loc} lignes, ${e.criteres} critères)${C.reset}`);
  }
  console.log(`\n  ${C.gris}Détail par SPEC : aiad-sdd refactor-spec <ID>${C.reset}\n`);
  return { candidats: evaluations };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  compterLignes as countLines,
  compterCriteres as countCriteria,
  listerSections as listSections,
  evaluerSpec as evaluateSpec,
  chargerSpec as loadSpec,
  listerSpecs as listSpecs,
  proposerDecoupageStructurel as proposeStructuralSplit,
  construirePromptDecoupage as buildSplitPrompt,
  parserDecoupageAI as parseAiSplit,
  refactorSpec as refactor,
  refactorAll as refactorAllSpecs,
};

export const CONSTANTS = {
  SEUIL_LOC,
  SEUIL_CRITERES,
  SEUIL_SECTIONS,
};
