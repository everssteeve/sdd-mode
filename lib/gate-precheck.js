// AIAD SDD Mode — Pré-contrôle déterministe de l'Execution Gate.
//
// **Cap stratégique** : la Gate SQS est jugée par le modèle (variance ±8-14 %,
// CANARY-010). La doctrine v1.9 lui demande en plus de vérifier le périmètre
// d'exécution d'un agent et le seuil d'arrêt des actions irréversibles. Ces
// vérifications sont faites ici, **hors contexte** (« computation
// off-context », `lib/verdict.js`), avant le scoring SQS.
//
// **Règle de l'auteur** : seule une déclaration structurée (section
// « Périmètre d'exécution de l'agent », format SPEC-033-2) peut fermer la Gate ;
// les mots-clés en prose ne produisent qu'un avertissement (non-régression sur
// les SPEC existantes).
//
// Ordre d'évaluation (la première règle qui s'applique donne le verdict) :
//   0. SPEC introuvable                                          → JNSP (exit 2)
//   1. Section absente → avertissements mots-clés                → PASS (exit 0)
//   2. Section « Non applicable »                                → PASS (exit 0)
//   3. Une des six lignes absente du tableau                     → JNSP (exit 2)
//   4. Action irréversible déclarée + seuil d'arrêt vide         → FAIL (exit 1)
//   5. Credentials / ressource partagée + isolation ou réseau vide → FAIL (exit 1)
//   6. Sinon                                                     → PASS (exit 0)
//
// **Zero-dep**.
//
// @intent INTENT-033
// @spec SPEC-033-3-gate-precheck
// @verified-by test/gate-precheck.test.js
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';
import { emitVerdict } from './verdict.js';

/** Libellé de la section (SPEC-033-2 §2, reconnue par libellé, pas par numéro). */
export const LIBELLE_SECTION = "Périmètre d'exécution de l'agent";

/** Les six lignes du tableau (SPEC-033-2 §2), dans l'ordre du gabarit. */
export const LIGNES = Object.freeze({
  isolation: 'Isolation',
  sorties: 'Sorties réseau autorisées',
  credentials: 'Credentials présents',
  ressources: 'Ressources partagées en écriture',
  irreversibles: 'Actions irréversibles possibles',
  seuil: "Seuil d'arrêt",
});

/** Mots-clés signalés quand la section est absente (avertissements seulement). */
export const MOTS_CLES = Object.freeze([
  'credential',
  'credentials',
  'secret',
  'token',
  'clé API',
  'API key',
  'mot de passe',
  'password',
  'irréversible',
  'paiement',
  'suppression définitive',
  'déploiement en production',
]);

// ─── Normalisation ──────────────────────────────────────────────────────────

/** Normalise un libellé : casse, apostrophes typographiques, emphase, espaces. */
function normaliserLibelle(s) {
  return String(s)
    .normalize('NFC')
    .replace(/[’‘`]/g, "'")
    .replace(/[*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Normalise une valeur pour la comparer à « aucun », « aucune » ou
 * « Non applicable » : casse, espaces (tous) et point final ignorés.
 */
export function normaliserValeur(s) {
  return String(s)
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\.+$/, '');
}

/** Vrai si la valeur est vide ou encore un placeholder entre crochets `[…]`. */
export function estVide(valeur) {
  const v = String(valeur ?? '').trim();
  return v === '' || /^\[.*\]$/s.test(v);
}

function egale(valeur, ...cibles) {
  const n = normaliserValeur(valeur);
  return cibles.some((c) => n === normaliserValeur(c));
}

// ─── Extraction de la section ───────────────────────────────────────────────

/**
 * Extrait les lignes de la section « Périmètre d'exécution de l'agent »
 * (titre Markdown de n'importe quel niveau contenant le libellé, casse et
 * numéro ignorés). Les titres situés dans un bloc de code clôturé ne sont pas
 * des titres. La section s'arrête au prochain titre de niveau ≤.
 *
 * @param {string} body
 * @returns {string[]|null} lignes du corps de la section, ou null si absente
 */
export function extraireSection(body) {
  const cible = normaliserLibelle(LIBELLE_SECTION);
  const lignes = body.split('\n');
  let dansFence = false;
  let niveau = 0;
  let out = null;
  for (const ligne of lignes) {
    if (/^\s*(```|~~~)/.test(ligne)) {
      dansFence = !dansFence;
      if (out) out.push(ligne);
      continue;
    }
    const m = !dansFence && ligne.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (m) {
      if (out) {
        if (m[1].length <= niveau) return out;
        out.push(ligne);
        continue;
      }
      if (normaliserLibelle(m[2]).includes(cible)) {
        niveau = m[1].length;
        out = [];
      }
      continue;
    }
    if (out) out.push(ligne);
  }
  return out;
}

/** Retire les commentaires HTML (y compris multi-lignes) d'un bloc. */
function sansCommentaires(texte) {
  return texte.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Lit les six lignes du tableau de déclaration.
 *
 * @param {string[]} lignesSection
 * @returns {Record<string, string>} clé interne (cf. {@link LIGNES}) → valeur brute
 */
export function lireTableau(lignesSection) {
  const index = new Map(Object.entries(LIGNES).map(([k, lib]) => [normaliserLibelle(lib), k]));
  const valeurs = {};
  for (const ligne of sansCommentaires(lignesSection.join('\n')).split('\n')) {
    const t = ligne.trim();
    if (!t.startsWith('|')) continue;
    const cellules = t.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
    if (cellules.length < 2) continue;
    const clef = index.get(normaliserLibelle(cellules[0]));
    if (!clef || Object.prototype.hasOwnProperty.call(valeurs, clef)) continue;
    valeurs[clef] = cellules.slice(1).join('|').trim();
  }
  return valeurs;
}

// ─── Mots-clés ──────────────────────────────────────────────────────────────

function regexMotCle(terme) {
  const motif = terme
    .split(/\s+/)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  // Mot entier Unicode (lettres accentuées comprises), sans casse.
  return new RegExp(`(?<![\\p{L}\\p{N}_])${motif}(?![\\p{L}\\p{N}_])`, 'iu');
}

/**
 * Mots-clés de {@link MOTS_CLES} présents dans le corps (mots entiers, sans casse).
 *
 * @param {string} body
 * @returns {string[]}
 */
export function motsClesTrouves(body) {
  return MOTS_CLES.filter((t) => regexMotCle(t).test(body));
}

// ─── Calcul du verdict ──────────────────────────────────────────────────────

/**
 * Calcule le verdict du pré-contrôle sur le contenu d'une SPEC.
 *
 * @param {string} contenu — Markdown complet de la SPEC
 * @returns {{ verdict: 'PASS'|'FAIL'|'JNSP',
 *   section: 'absente'|'non-applicable'|'declaree',
 *   manques: string[], lignesAbsentes: string[], avertissements: string[] }}
 */
export function calculerPrecheck(contenu) {
  const { body } = parseFrontmatter(contenu);
  const section = extraireSection(body);

  if (section === null) {
    const avertissements = motsClesTrouves(body).map(
      (t) => `Mot-clé « ${t} » présent sans section « ${LIBELLE_SECTION} » — vérifier si l'agent dispose de credentials, d'un accès en écriture partagé ou d'actions irréversibles.`,
    );
    return { verdict: 'PASS', section: 'absente', manques: [], lignesAbsentes: [], avertissements };
  }

  // Emphase et guillemets autour de la mention tolérés (« *Non applicable.* »).
  const contenuSection = sansCommentaires(section.join('\n')).replace(/[*_«»"]/g, '').trim();
  if (egale(contenuSection, 'Non applicable')) {
    return { verdict: 'PASS', section: 'non-applicable', manques: [], lignesAbsentes: [], avertissements: [] };
  }

  const v = lireTableau(section);

  // Règle 1 — tableau partiel : non jugeable (prioritaire sur un manque visible).
  const lignesAbsentes = Object.entries(LIGNES)
    .filter(([k]) => !Object.prototype.hasOwnProperty.call(v, k))
    .map(([, lib]) => lib);
  if (lignesAbsentes.length > 0) {
    return { verdict: 'JNSP', section: 'declaree', manques: [], lignesAbsentes, avertissements: [] };
  }

  // Règle 2 — action irréversible déclarée sans seuil d'arrêt.
  if (!estVide(v.irreversibles) && !egale(v.irreversibles, 'aucune') && estVide(v.seuil)) {
    return {
      verdict: 'FAIL',
      section: 'declaree',
      manques: [`« ${LIGNES.seuil} » vide alors qu'une action irréversible est déclarée (${v.irreversibles}).`],
      lignesAbsentes: [],
      avertissements: [],
    };
  }

  // Règle 3 — credentials ou ressource partagée sans isolation / sorties réseau.
  const declare = (val) => !estVide(val) && !egale(val, 'aucun', 'aucune');
  if (declare(v.credentials) || declare(v.ressources)) {
    const vides = ['isolation', 'sorties'].filter((k) => estVide(v[k]));
    if (vides.length > 0) {
      const motif = [declare(v.credentials) ? LIGNES.credentials : null, declare(v.ressources) ? LIGNES.ressources : null]
        .filter(Boolean)
        .join(' / ');
      return {
        verdict: 'FAIL',
        section: 'declaree',
        manques: vides.map((k) => `« ${LIGNES[k]} » vide alors que « ${motif} » déclare au moins un élément.`),
        lignesAbsentes: [],
        avertissements: [],
      };
    }
  }

  return { verdict: 'PASS', section: 'declaree', manques: [], lignesAbsentes: [], avertissements: [] };
}

// ─── Résolution de la SPEC ──────────────────────────────────────────────────

/**
 * Résout une SPEC par chemin de fichier, ou par identifiant dans
 * `.aiad/specs/` puis `.aiad/specs/archive/`.
 *
 * @param {string} projetDir
 * @param {string} cible — SPEC-NNN-x(-slug) ou chemin
 * @returns {{ path: string, contenu: string }|null}
 */
export function resoudreSpec(projetDir, cible) {
  if (!cible) return null;
  const chemin = resolve(projetDir, cible);
  try {
    if (existsSync(chemin) && statSync(chemin).isFile()) {
      return { path: chemin, contenu: readFileSync(chemin, 'utf-8') };
    }
  } catch { /* on tente la résolution par identifiant */ }

  const id = cible.replace(/\.md$/i, '').toLowerCase();
  for (const dir of [join(projetDir, '.aiad', 'specs'), join(projetDir, '.aiad', 'specs', 'archive')]) {
    if (!existsSync(dir)) continue;
    const fichiers = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
    const trouve = fichiers.find((f) => f.toLowerCase() === `${id}.md`)
      || fichiers.find((f) => f.toLowerCase().startsWith(`${id}-`));
    if (trouve) {
      const path = join(dir, trouve);
      return { path, contenu: readFileSync(path, 'utf-8') };
    }
  }
  return null;
}

// ─── Émission ───────────────────────────────────────────────────────────────

/**
 * Émet le verdict du pré-contrôle (enveloppe canonique + exit code). Sans
 * effet de bord process : retourne `{ code, enveloppe, ... }`.
 *
 * @param {string} projetDir
 * @param {string} cible — SPEC-id ou chemin
 * @param {{ json?: boolean, schema?: object, stream?: {write: Function} }} [opts]
 * @returns {{ code: 0|1|2, verdict: string, enveloppe: object, valide: boolean, erreurs: string[] }}
 */
export function emitGatePrecheck(projetDir, cible, { json = false, schema = null, stream = process.stdout } = {}) {
  const spec = resoudreSpec(projetDir, cible);
  if (!spec) {
    return emitVerdict({
      verdict: 'JNSP',
      payload: { spec: String(cible ?? ''), section: null, manques: [], lignesAbsentes: [], avertissements: [] },
      schema, json, stream,
    });
  }
  const r = calculerPrecheck(spec.contenu);
  return emitVerdict({
    verdict: r.verdict,
    payload: {
      spec: relative(projetDir, spec.path) || spec.path,
      section: r.section,
      manques: r.manques,
      lignesAbsentes: r.lignesAbsentes,
      avertissements: r.avertissements,
    },
    schema, json, stream,
  });
}

// ─── Aliases EN ─────────────────────────────────────────────────────────────

export {
  calculerPrecheck as computeGatePrecheck,
  resoudreSpec as resolveSpec,
  emitGatePrecheck as emitPrecheck,
};
