// AIAD SDD Mode — Scoring local d'Intent / SPEC via Ollama.
//
// **Cap stratégique** : 100 % local, **aucune fuite** de SPEC vers une API
// tierce (OpenAI / Anthropic / Mistral cloud / etc.). Le scoring s'appuie
// sur un modèle Ollama local (https://ollama.com) — l'utilisateur reste
// souverain de ses artefacts confidentiels.
//
// **Cas d'usage** : avant `/sdd gate`, scorer rapidement la qualité d'une
// SPEC (clarté, testabilité, atomicité, observabilité, alignement Intent)
// pour orienter le rédacteur vers les axes à améliorer.
//
// **Zero-dep** : utilise uniquement `fetch` natif Node 18+, lecture des
// fichiers Intent/SPEC, prompt structuré qui exige une réponse JSON.
//
// **Configuration** (variables d'environnement) :
//   - `AIAD_OLLAMA_URL`   : endpoint Ollama (défaut http://127.0.0.1:11434)
//   - `AIAD_OLLAMA_MODEL` : modèle à utiliser (défaut llama3.1:8b)
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { C, log, logHeader } from './term.js';
import { parseFrontmatter } from './frontmatter.js';

const URL_DEFAUT = 'http://127.0.0.1:11434';
const MODELE_DEFAUT = 'llama3.1:8b';

// ─── Critères de scoring ────────────────────────────────────────────────────

export const CRITERES_SPEC = [
  { key: 'clarte', label: 'Clarté', description: "La SPEC est-elle compréhensible sans ambiguïté par un dev qui ne connaît pas le contexte ?" },
  { key: 'testabilite', label: 'Testabilité', description: "Les critères d'acceptation sont-ils observables et mesurables ?" },
  { key: 'atomicite', label: 'Atomicité', description: "La SPEC adresse-t-elle une seule responsabilité (une seule raison de changer) ?" },
  { key: 'observabilite', label: 'Observabilité', description: "Les effets de bord (logs, métriques) sont-ils explicités ?" },
  { key: 'alignementIntent', label: 'Alignement Intent', description: "La SPEC répond-elle exactement à son Intent parent ?" },
];

export const CRITERES_INTENT = [
  { key: 'pourquoi', label: 'Pourquoi explicite', description: "L'Intent explique-t-il clairement le problème métier ou utilisateur ?" },
  { key: 'consequence', label: 'Conséquence si rien', description: "L'Intent décrit-il ce qui se passe si on ne fait rien ?" },
  { key: 'frontiere', label: 'Frontière', description: "L'Intent dit-il aussi ce qu'il N'inclut PAS ?" },
  { key: 'humanAuthorship', label: 'Authorship humain', description: "L'Intent ressemble-t-il à un texte d'humain (≥ 50 caractères, pas template) ?" },
];

// ─── Fonctions pures ────────────────────────────────────────────────────────

/**
 * Construit le prompt envoyé à Ollama pour scorer un artefact.
 * Demande explicitement une réponse JSON pour rendre le parsing déterministe.
 *
 * @param {'intent'|'spec'} type
 * @param {string} contenu — corps Markdown de l'artefact
 * @param {object[]} criteres
 * @returns {string}
 */
export function construirePrompt(type, contenu, criteres) {
  const intro = type === 'spec'
    ? "Tu es un Product Engineer expert en Spec Driven Development (SDD). Tu vas scorer une SPEC technique selon 5 critères de qualité."
    : "Tu es un Product Engineer expert en Intent Driven Development. Tu vas scorer un Intent Statement (le pourquoi) selon 4 critères.";
  const lignes = [];
  lignes.push(intro);
  lignes.push('');
  lignes.push(`Voici l'artefact à scorer :`);
  lignes.push('"""');
  lignes.push(contenu.slice(0, 4000)); // limite raisonnable pour les LLM 8k
  lignes.push('"""');
  lignes.push('');
  lignes.push('Critères de scoring (chacun de 0 à 5, entier) :');
  for (const c of criteres) {
    lignes.push(`- **${c.key}** (${c.label}) : ${c.description}`);
  }
  lignes.push('');
  lignes.push('Réponds STRICTEMENT par un objet JSON valide, sans texte avant ni après. Schéma attendu :');
  lignes.push('```json');
  lignes.push('{');
  lignes.push(`  ${criteres.map((c) => `"${c.key}": <0-5>`).join(',\n  ')},`);
  lignes.push('  "feedback": "Une phrase courte expliquant les 1-2 axes les plus faibles."');
  lignes.push('}');
  lignes.push('```');
  return lignes.join('\n');
}

/**
 * Parse la réponse Ollama en validant le format JSON et les bornes 0-5.
 *
 * @param {string} brut
 * @param {object[]} criteres
 * @returns {{ scores: Record<string, number>, feedback: string, total: number, max: number }}
 */
export function parserReponseScore(brut, criteres) {
  let json;
  // Extraction du JSON (le LLM peut entourer de texte malgré la consigne).
  const match = String(brut).match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Réponse non-JSON : "${String(brut).slice(0, 100)}…"`);
  try { json = JSON.parse(match[0]); }
  catch (e) { throw new Error(`JSON invalide : ${e.message}`); }

  const scores = {};
  let total = 0;
  for (const c of criteres) {
    const v = json[c.key];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 5) {
      throw new Error(`Score "${c.key}" invalide : ${v} (attendu entier 0-5)`);
    }
    scores[c.key] = v;
    total += v;
  }
  return {
    scores,
    feedback: typeof json.feedback === 'string' ? json.feedback : '',
    total,
    max: criteres.length * 5,
  };
}

/**
 * Charge un Intent ou une SPEC depuis le projet.
 *
 * @param {string} racine
 * @param {'intent'|'spec'} type
 * @param {string} id — INTENT-NNN ou SPEC-NNN-N-slug
 * @returns {{ path: string, contenu: string, frontmatter: object, body: string }}
 */
export function chargerArtefact(racine, type, id) {
  const dir = join(racine, '.aiad', type === 'spec' ? 'specs' : 'intents');
  if (!existsSync(dir)) throw new Error(`Dossier ${type === 'spec' ? 'specs' : 'intents'}/ absent dans .aiad/`);

  // Recherche fichier <id>.md OU fichier dont le préfixe matche `id`.
  let path = join(dir, `${id}.md`);
  if (!existsSync(path)) {
    const candidat = readdirSync(dir).find((f) => f.startsWith(id) && f.endsWith('.md'));
    if (!candidat) throw new Error(`Artefact ${id} introuvable dans ${dir}/`);
    path = join(dir, candidat);
  }
  const contenu = readFileSync(path, 'utf-8');
  const { data, body } = parseFrontmatter(contenu);
  return { path, contenu, frontmatter: data, body };
}

/**
 * Verdict humain à partir du score total / max.
 */
export function verdict(total, max) {
  const pct = total / max;
  if (pct >= 0.85) return { sym: '✓', label: 'Excellent', couleur: 'vert' };
  if (pct >= 0.7) return { sym: '✓', label: 'Bon', couleur: 'cyan' };
  if (pct >= 0.5) return { sym: '⚠', label: 'À retravailler', couleur: 'jaune' };
  return { sym: '✗', label: 'Insuffisant', couleur: 'rouge' };
}

// ─── Appel Ollama ───────────────────────────────────────────────────────────

/**
 * Appelle Ollama (HTTP) sur `/api/generate` en mode non-streaming.
 *
 * @param {string} prompt
 * @param {{ url?: string, model?: string, fetch?: Function }} [options]
 * @returns {Promise<string>} réponse brute du modèle
 */
export async function appelerOllama(prompt, options = {}) {
  const url = options.url || process.env.AIAD_OLLAMA_URL || URL_DEFAUT;
  const model = options.model || process.env.AIAD_OLLAMA_MODEL || MODELE_DEFAUT;
  const fetchFn = options.fetch || fetch; // injectable pour tests

  const reponse = await fetchFn(`${url}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.1 } }),
  });
  if (!reponse.ok) {
    throw new Error(`Ollama HTTP ${reponse.status} : ${await reponse.text()}`);
  }
  const data = await reponse.json();
  if (typeof data.response !== 'string') {
    throw new Error('Réponse Ollama sans champ `response` string.');
  }
  return data.response;
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Exécute le scoring complet sur un Intent ou SPEC.
 *
 * @param {string} racine
 * @param {'intent'|'spec'} type
 * @param {string} id
 * @param {{ url?: string, model?: string, json?: boolean, fetch?: Function }} [options]
 * @returns {Promise<{ id: string, type: string, scores: object, total: number, max: number, feedback: string }>}
 */
export async function scorerArtefact(racine, type, id, options = {}) {
  if (!['intent', 'spec'].includes(type)) {
    throw new Error(`Type inconnu : "${type}". Attendu : intent | spec.`);
  }
  const artefact = chargerArtefact(racine, type, id);
  const criteres = type === 'spec' ? CRITERES_SPEC : CRITERES_INTENT;
  const prompt = construirePrompt(type, artefact.body || artefact.contenu, criteres);
  const brut = await appelerOllama(prompt, options);
  const result = parserReponseScore(brut, criteres);
  const v = verdict(result.total, result.max);

  if (options.json) {
    process.stdout.write(JSON.stringify({
      id, type, path: artefact.path,
      scores: result.scores, feedback: result.feedback,
      total: result.total, max: result.max,
      verdict: v.label,
    }, null, 2) + '\n');
    return { id, type, ...result, verdict: v };
  }

  logHeader(
    `AIAD SDD — Scoring ${type.toUpperCase()} ${id}`,
    `Modèle : ${options.model || process.env.AIAD_OLLAMA_MODEL || MODELE_DEFAUT} (Ollama local — souverain)`,
  );

  for (const c of criteres) {
    const score = result.scores[c.key];
    const barre = '█'.repeat(score) + '·'.repeat(5 - score);
    log(`${C.cyan}${barre}${C.reset}`, `${c.label.padEnd(22)} ${score}/5`);
  }
  console.log(`
${C.gras}  Total : ${result.total}/${result.max} (${Math.round(100 * result.total / result.max)}%) — ${C[v.couleur]}${v.sym} ${v.label}${C.reset}${C.reset}

${C.gris}  ${result.feedback}${C.reset}
`);

  return { id, type, ...result, verdict: v };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  construirePrompt as buildPrompt,
  parserReponseScore as parseScoreResponse,
  chargerArtefact as loadArtifact,
  appelerOllama as callOllama,
  scorerArtefact as scoreArtifact,
  CRITERES_SPEC as SPEC_CRITERIA,
  CRITERES_INTENT as INTENT_CRITERIA,
};
