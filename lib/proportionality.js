// AIAD SDD Mode — Proportionnalité « léger par défaut » (garde-fou GF3, §4).
//
// **Cap stratégique** : convergence Karpathy/Dex/Matt — *léger par défaut,
// lourd seulement si l'ambiguïté coûte cher*. SDD ne doit ni sur-ingénierer une
// intention triviale (façon « better send a PR ») ni sous-spécifier une
// intention à fort risque (sécurité, paiement, conformité). Ce module évalue le
// **poids** d'un Intent et recommande le chemin (court vs lourd) consommé par la
// phase Research (§3.5) et l'exécution phasée (§3.6).
//
// **Human Authorship** : un `weight:` déclaré dans le frontmatter de l'Intent
// **prime** sur la détection automatique (la décision appartient à l'humain ;
// la machine ne fait que proposer une heuristique conservatrice). En cas de
// signal de risque, on penche vers le **lourd** (fail-safe : mieux vaut
// sur-spécifier une zone sensible que la laisser ambiguë).
//
// **Zero-dep**.
//
// @intent INTENT-012
// @spec SPEC-012-1-garde-fous
// @verified-by test/proportionality.test.js
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';

/** Poids possibles d'une intention. */
export const POIDS = ['light', 'heavy'];

// Signaux de **risque** → chemin lourd (EARS + Research complète + Gate stricte).
// Domaines où l'ambiguïté coûte cher (sécurité, paiement, conformité, données).
const SIGNAUX_LOURDS = [
  /\bs[ée]curit[ée]\b/i, /\bauth(entification|orisation)?\b/i, /\bmot de passe\b/i, /\bpassword\b/i,
  /\btoken\b/i, /\bchiffr|crypto|encryption\b/i, /\bsecret\b/i,
  /\bpaiement|paypal|stripe|carte bancaire|facturation|billing\b/i,
  /\brgpd|gdpr|donn[ée]es personnelles|pii|privacy\b/i,
  /\bconformit[ée]|ai[ -]?act|rgaa|rgesn|compliance\b/i,
  /\bm[ée]dical|sant[ée]|health\b/i,
  /\birr[ée]versible|suppression d[eé]finitive|migration de donn[ée]es|destruct/i,
];

// Signaux **légers** → chemin court (intention simple/réversible).
const SIGNAUX_LEGERS = [
  /\btypo|coquille\b/i, /\blibell[ée]|label|wording|copy\b/i, /\bcouleur|color|style|css\b/i,
  /\brenommage|rename\b/i, /\bdocumentation|readme|commentaire\b/i, /\blien|link\b/i,
  /\br[ée]versible\b/i,
];

/**
 * Évalue le poids d'une intention à partir de son texte et de son frontmatter.
 * Un `weight:` humain prime ; sinon heuristique : un signal lourd → heavy ;
 * sinon light (léger par défaut).
 *
 * @param {{ title?: string, body?: string, frontmatter?: object }} intent
 * @returns {{ weight: 'light'|'heavy', source: 'humain'|'heuristique', raison: string, signaux: string[], cheminRecommande: string }}
 */
export function evaluerPoids({ title = '', body = '', frontmatter = {} } = {}) {
  const declare = String(frontmatter.weight || '').toLowerCase();
  if (POIDS.includes(declare)) {
    return mk(declare, 'humain', `Poids déclaré dans le frontmatter (\`weight: ${declare}\`).`, []);
  }

  const texte = `${title}\n${body}`;
  const lourds = SIGNAUX_LOURDS.filter((re) => re.test(texte)).map((re) => extraire(texte, re));
  if (lourds.length > 0) {
    return mk('heavy', 'heuristique', `Signal(aux) de risque détecté(s) — l'ambiguïté coûterait cher.`, lourds);
  }
  const legers = SIGNAUX_LEGERS.filter((re) => re.test(texte)).map((re) => extraire(texte, re));
  return mk('light', 'heuristique', legers.length ? 'Intention simple/réversible.' : 'Aucun signal de risque — léger par défaut.', legers);
}

function extraire(texte, re) {
  const m = texte.match(re);
  return m ? m[0].toLowerCase() : '';
}

function mk(weight, source, raison, signaux) {
  const cheminRecommande = weight === 'heavy'
    ? 'Chemin lourd : Research complète (Discovery ancré) + SPEC EARS + Execution Gate stricte.'
    : 'Chemin court : Research allégée (court-circuit tracé admis) + SPEC prose + Gate standard.';
  return { weight, source, raison, signaux: signaux.filter(Boolean), cheminRecommande };
}

// ─── Chargement d'un Intent ─────────────────────────────────────────────────

/**
 * Charge et évalue un Intent par identifiant dans `.aiad/intents/`.
 *
 * @param {string} racine
 * @param {string} intentId — INTENT-NNN(-slug) ou NNN
 * @returns {(ReturnType<typeof evaluerPoids> & { intent: string })|null}
 */
export function evaluerIntent(racine, intentId) {
  const dir = join(racine, '.aiad', 'intents');
  if (!existsSync(dir)) return null;
  const prefixe = (/^INTENT-/i.test(intentId) ? intentId : `INTENT-${intentId}`).toLowerCase();
  const fichier = readdirSync(dir).find((f) => f.endsWith('.md') && f !== '_index.md' && f.toLowerCase().startsWith(prefixe));
  if (!fichier) return null;
  const { data, body } = parseFrontmatter(readFileSync(join(dir, fichier), 'utf-8'));
  const r = evaluerPoids({ title: data.title || data.titre || '', body, frontmatter: data });
  return { intent: fichier.replace(/\.md$/, ''), ...r };
}

// ─── Aliases EN ─────────────────────────────────────────────────────────────

export {
  evaluerPoids as assessWeight,
  evaluerIntent as assessIntent,
};
