// AIAD SDD Mode — `aiad-sdd negotiate` (item #102).
//
// **Cas d'usage** : deux équipes proposent des Intents qui touchent
// le même périmètre métier mais avec des angles potentiellement
// contradictoires (ex. vélocité de livraison vs accessibilité totale).
// `negotiate` médie via **Ollama local** : compare les deux Intents,
// détecte les conflits, propose un **Intent commun** unifié et des
// **arbitrages** explicites pour les points de divergence.
//
// **Souverain** : Ollama local (réutilise `appelerOllama` de
// `lib/score.js`), fetch injectable pour les tests, pas de fuite de
// données projet.
//
// **Format de sortie** :
//   {
//     conflits: [{ axe, intentA, intentB, severite }],
//     intentCommun: { titre, body },
//     arbitrages: [{ point, decision, rationale }],
//     compatibilite: 0..1
//   }
//
// Documentation : https://aiad.ovh/negotiate

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';
import { appelerOllama } from './score.js';
import { C, logHeader } from './term.js';

// ─── Lecture des Intents ───────────────────────────────────────────────────

/**
 * Charge un Intent par ID depuis `.aiad/intents/`.
 *
 * @param {string} racine
 * @param {string} intentId — ex. "INT-042"
 * @returns {{ id: string, path: string, title: string, body: string, frontmatter: object }}
 */
export function chargerIntent(racine, intentId) {
  if (!/^INT-\d+/i.test(intentId)) {
    throw new Error(`Format Intent invalide : "${intentId}". Attendu : INT-NNN.`);
  }
  const dir = join(racine, '.aiad', 'intents');
  if (!existsSync(dir)) throw new Error(`.aiad/intents/ introuvable.`);
  const list = readdirSync(dir);
  const idUp = intentId.toUpperCase();
  const fichier = list.find((f) => f.toUpperCase().startsWith(idUp));
  if (!fichier) throw new Error(`Intent ${intentId} introuvable dans ${dir}.`);
  const path = join(dir, fichier);
  const contenu = readFileSync(path, 'utf-8');
  const { data, body } = parseFrontmatter(contenu);
  return {
    id: idUp,
    path,
    title: data.title || data.titre || idUp,
    body: body.trim(),
    frontmatter: data,
  };
}

// ─── Prompt Ollama ─────────────────────────────────────────────────────────

/**
 * Construit le prompt de négociation.
 *
 * @param {object} intentA
 * @param {object} intentB
 * @returns {string}
 */
export function construirePromptNegotiate(intentA, intentB) {
  const lignes = [];
  lignes.push('Tu es un facilitateur AIAD spécialisé dans la médiation entre Intents.');
  lignes.push('Deux équipes proposent les Intents suivants. Détecte les conflits, propose');
  lignes.push('un Intent commun unifié et des arbitrages explicites pour les divergences.');
  lignes.push('');
  lignes.push(`# Intent A — ${intentA.id}`);
  lignes.push(`**Titre** : ${intentA.title}`);
  lignes.push('');
  lignes.push(intentA.body || '(corps vide)');
  lignes.push('');
  lignes.push(`# Intent B — ${intentB.id}`);
  lignes.push(`**Titre** : ${intentB.title}`);
  lignes.push('');
  lignes.push(intentB.body || '(corps vide)');
  lignes.push('');
  lignes.push('---');
  lignes.push('');
  lignes.push('Réponds STRICTEMENT au format JSON suivant (aucun texte avant/après) :');
  lignes.push('');
  lignes.push('{');
  lignes.push('  "compatibilite": 0.0,');
  lignes.push('  "conflits": [');
  lignes.push('    { "axe": "string court", "intentA": "position A", "intentB": "position B", "severite": "haute|moyenne|basse" }');
  lignes.push('  ],');
  lignes.push('  "intentCommun": {');
  lignes.push('    "titre": "formulation unifiée respectant les deux Intents",');
  lignes.push('    "body": "intent statement complet en un paragraphe Pourquoi/Pour qui/Critères de succès"');
  lignes.push('  },');
  lignes.push('  "arbitrages": [');
  lignes.push('    { "point": "axe en conflit", "decision": "choix retenu", "rationale": "explication brève" }');
  lignes.push('  ]');
  lignes.push('}');
  lignes.push('');
  lignes.push('Contraintes :');
  lignes.push('- `compatibilite` : ratio entre 0 (incompatibles) et 1 (alignés) basé sur le pourcentage d\'objectifs partagés.');
  lignes.push('- 0 à 5 conflits maximum.');
  lignes.push('- L\'Intent commun doit préserver l\'Intent humain de chaque équipe sans diluer l\'intention.');
  lignes.push('- Chaque arbitrage trace explicitement quel Intent est privilégié sur l\'axe et pourquoi.');
  lignes.push('- Réponse en français, ton neutre et factuel.');
  return lignes.join('\n');
}

// ─── Parsing ───────────────────────────────────────────────────────────────

const SEVERITES = ['haute', 'moyenne', 'basse'];

/**
 * Parse la réponse Ollama (robuste aux préambules).
 */
export function parserNegotiation(brut) {
  if (typeof brut !== 'string' || brut.length === 0) {
    throw new Error('Réponse Ollama vide.');
  }
  const debut = brut.indexOf('{');
  if (debut === -1) throw new Error('Réponse Ollama sans JSON détectable.');
  const candidat = brut.slice(debut);
  const fin = candidat.lastIndexOf('}');
  if (fin === -1) throw new Error('Réponse Ollama sans `}` final.');
  let data;
  try { data = JSON.parse(candidat.slice(0, fin + 1)); }
  catch (err) { throw new Error(`JSON Ollama invalide : ${err.message}`); }
  if (!data.intentCommun || typeof data.intentCommun !== 'object') {
    throw new Error('Champ `intentCommun` manquant.');
  }

  const compat = typeof data.compatibilite === 'number' ? data.compatibilite : 0.5;
  return {
    compatibilite: Math.max(0, Math.min(1, compat)),
    conflits: Array.isArray(data.conflits) ? data.conflits.slice(0, 5).map((c) => ({
      axe: String(c.axe || c.axis || '').trim(),
      intentA: String(c.intentA || c.intent_a || '').trim(),
      intentB: String(c.intentB || c.intent_b || '').trim(),
      severite: SEVERITES.includes(c.severite) ? c.severite : 'moyenne',
    })) : [],
    intentCommun: {
      titre: String(data.intentCommun.titre || data.intentCommun.title || '').trim(),
      body: String(data.intentCommun.body || '').trim(),
    },
    arbitrages: Array.isArray(data.arbitrages) ? data.arbitrages.slice(0, 5).map((a) => ({
      point: String(a.point || '').trim(),
      decision: String(a.decision || '').trim(),
      rationale: String(a.rationale || a.rationnel || '').trim(),
    })) : [],
  };
}

// ─── Rendu Markdown ────────────────────────────────────────────────────────

/**
 * Rend la médiation en Markdown réutilisable (ex. PR comment, dossier
 * interne d'arbitrage).
 */
export function rendreMediationMarkdown(intentA, intentB, mediation) {
  const lignes = [];
  lignes.push(`# Médiation AIAD — ${intentA.id} ↔ ${intentB.id}`);
  lignes.push('');
  lignes.push(`**Compatibilité** : ${(mediation.compatibilite * 100).toFixed(0)}%`);
  lignes.push('');
  lignes.push('## Intent commun proposé');
  lignes.push('');
  lignes.push(`**Titre** : ${mediation.intentCommun.titre}`);
  lignes.push('');
  lignes.push(mediation.intentCommun.body);
  lignes.push('');
  if (mediation.conflits.length > 0) {
    lignes.push(`## Conflits détectés (${mediation.conflits.length})`);
    lignes.push('');
    lignes.push('| Axe | ' + intentA.id + ' | ' + intentB.id + ' | Sévérité |');
    lignes.push('|-----|-' + '-'.repeat(intentA.id.length) + '-|-' + '-'.repeat(intentB.id.length) + '-|----------|');
    for (const c of mediation.conflits) {
      lignes.push(`| ${c.axe} | ${c.intentA} | ${c.intentB} | ${c.severite} |`);
    }
    lignes.push('');
  }
  if (mediation.arbitrages.length > 0) {
    lignes.push(`## Arbitrages (${mediation.arbitrages.length})`);
    lignes.push('');
    for (const a of mediation.arbitrages) {
      lignes.push(`### ${a.point}`);
      lignes.push('');
      lignes.push(`**Décision** : ${a.decision}`);
      lignes.push('');
      lignes.push(`**Justification** : ${a.rationale}`);
      lignes.push('');
    }
  }
  lignes.push('---');
  lignes.push('');
  lignes.push(`_Médiation générée par \`aiad-sdd negotiate ${intentA.id} ${intentB.id}\` via Ollama local (souverain). Validation humaine requise — l'IA propose, l'humain décide._`);
  return lignes.join('\n');
}

// ─── Pipeline ──────────────────────────────────────────────────────────────

/**
 * Pipeline complet : charger 2 Intents → prompt → Ollama → parse → rendu.
 *
 * @param {string} racine
 * @param {string} idA
 * @param {string} idB
 * @param {{ url?: string, model?: string, fetch?: Function, json?: boolean, out?: string }} [options]
 */
export async function negotiate(racine, idA, idB, options = {}) {
  if (!idA || !idB) throw new Error('2 IDs Intent requis : aiad-sdd negotiate <INT-A> <INT-B>.');
  if (idA.toUpperCase() === idB.toUpperCase()) {
    throw new Error('Les deux Intents doivent être différents.');
  }
  const intentA = chargerIntent(racine, idA);
  const intentB = chargerIntent(racine, idB);
  const prompt = construirePromptNegotiate(intentA, intentB);
  const brut = await appelerOllama(prompt, {
    url: options.url, model: options.model, fetch: options.fetch,
  });
  const mediation = parserNegotiation(brut);
  const markdown = rendreMediationMarkdown(intentA, intentB, mediation);

  if (options.out) {
    const outAbs = join(racine, options.out);
    if (!existsSync(dirname(outAbs))) mkdirSync(dirname(outAbs), { recursive: true });
    writeFileSync(outAbs, markdown, 'utf-8');
  }
  if (options.json) {
    process.stdout.write(JSON.stringify({
      a: intentA.id, b: intentB.id,
      ...mediation,
    }, null, 2) + '\n');
    return { intentA, intentB, mediation, markdown };
  }
  logHeader(
    `AIAD SDD — Négociation ${intentA.id} ↔ ${intentB.id}`,
    `Compatibilité ${(mediation.compatibilite * 100).toFixed(0)}% · ${mediation.conflits.length} conflit(s) · ${mediation.arbitrages.length} arbitrage(s)`,
  );
  console.log('');
  console.log(`  ${C.gras}Intent commun proposé${C.reset}`);
  console.log(`  ${C.cyan}${mediation.intentCommun.titre}${C.reset}`);
  if (mediation.intentCommun.body) {
    console.log(`  ${C.gris}${mediation.intentCommun.body}${C.reset}`);
  }
  if (mediation.conflits.length > 0) {
    console.log('');
    console.log(`  ${C.gras}Conflits${C.reset}`);
    for (const c of mediation.conflits) {
      const couleur = c.severite === 'haute' ? C.rouge : c.severite === 'basse' ? C.gris : C.jaune;
      console.log(`    ${couleur}● ${c.severite.toUpperCase()}${C.reset}  ${c.axe}`);
      console.log(`      A : ${c.intentA}`);
      console.log(`      B : ${c.intentB}`);
    }
  }
  if (mediation.arbitrages.length > 0) {
    console.log('');
    console.log(`  ${C.gras}Arbitrages proposés${C.reset}`);
    for (const a of mediation.arbitrages) {
      console.log(`    ${C.vert}→${C.reset} ${a.point} : ${a.decision}`);
      console.log(`      ${C.gris}${a.rationale}${C.reset}`);
    }
  }
  if (options.out) {
    console.log('');
    console.log(`  ${C.gris}Markdown écrit dans ${options.out}.${C.reset}`);
  }
  console.log('');
  return { intentA, intentB, mediation, markdown };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  chargerIntent as loadIntent,
  construirePromptNegotiate as buildNegotiatePrompt,
  parserNegotiation as parseNegotiation,
  rendreMediationMarkdown as renderMediationMarkdown,
  negotiate as negotiateIntents,
};

export const CONSTANTS = {
  SEVERITES,
};
