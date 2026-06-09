// AIAD SDD Mode — Memory native : promotion from logs + auto-curation (item §3.8).
//
// **Cap stratégique** : les Lessons Learned d'`AGENT-GUIDE.md` et les traces
// `.aiad/facts/` sont aujourd'hui un markdown que le modèle peut ignorer et que
// rien ne curate. L'analyse (§2.2 « Agent memory », §2.4) pose deux principes :
//   1. mémoire **from logs, pas from one transcript** — « make the button pink »
//      (un incident isolé) ≠ « tous les boutons roses » (une règle). On ne
//      promeut un apprentissage en mémoire que s'il **récurre** (seuil
//      d'occurrences sur plusieurs sources), jamais sur un cas unique.
//   2. **anti dock rot** — ne pas garder les artefacts livrés indéfiniment en
//      contexte chaud (cycle d'archivage, cf. `lib/archive.js`).
//
// **Human Authorship** : la promotion en mémoire est une décision — elle exige
// un **auteur humain** identifiable. Ce module *propose* (scan déterministe des
// logs) mais n'écrit jamais sans `auteur`. Il ne fabrique pas d'apprentissage.
//
// **Auto-curation** : on respecte la mécanique native (`MEMORY.md` ≤ 200 lignes ;
// au-delà → éclatement par thème + index). `curer()` calcule ce découpage.
//
// **Zero-dep**.
//
// @intent INTENT-007
// @spec SPEC-007-1-memory-native
// @verified-by test/memory.test.js
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';

/** Seuil de récurrence par défaut avant de proposer une promotion (from logs). */
export const SEUIL_PROMOTION_DEFAUT = 3;

/** Plafond de lignes du store avant éclatement par thème (mécanique native). */
export const MAX_LIGNES_DEFAUT = 200;

// Mots-outils ignorés dans la signature (FR + EN) — un apprentissage se
// reconnaît à ses mots porteurs, pas à sa grammaire.
const STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'au', 'aux',
  'en', 'dans', 'pour', 'sur', 'avec', 'sans', 'que', 'qui', 'est', 'sont',
  'pas', 'ne', 'se', 'sa', 'son', 'ses', 'ce', 'cet', 'cette', 'par', 'plus',
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are', 'and',
  'or', 'not', 'this', 'that', 'it', 'be', 'as', 'at', 'by',
]);

/**
 * Signature normalisée d'une observation : ensemble trié de mots porteurs.
 * Regroupe les paraphrases (« bouton rose » / « rose le bouton ») sous une même
 * clé pour compter la récurrence d'un *pattern*, pas d'une formulation.
 *
 * @param {string} texte
 * @returns {string}
 */
export function signatureObservation(texte) {
  return String(texte || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .sort()
    .slice(0, 8)
    .join(' ');
}

// ─── Collecte des observations (from logs) ──────────────────────────────────

/**
 * Scanne les sources de logs du projet et produit des observations
 * normalisées : `.aiad/facts/*.md` (écarts qualifiés) + drifts de la dernière
 * matrice de traçabilité. Chaque observation porte sa source (pour exiger la
 * récurrence *cross-sources*, pas la répétition d'un même fichier).
 *
 * @param {string} racine
 * @returns {{ signature: string, source: string, kind: string, extrait: string }[]}
 */
export function collecterObservations(racine) {
  const obs = [];

  // 1. Facts (.aiad/facts/*.md)
  const factsDir = join(racine, '.aiad', 'facts');
  if (existsSync(factsDir)) {
    for (const f of readdirSync(factsDir)) {
      if (!f.endsWith('.md') || f.startsWith('_')) continue;
      const { data, body } = parseFrontmatter(readFileSync(join(factsDir, f), 'utf-8'));
      const titre = data.title || data.titre || premiereLigneSignificative(body) || f;
      const base = `${data.category || data.categorie || data.type || ''} ${titre}`.trim();
      obs.push({ signature: signatureObservation(base), source: f.replace(/\.md$/, ''), kind: 'fact', extrait: String(titre).slice(0, 120) });
    }
  }

  // 2. Drifts (dernière matrice de traçabilité)
  const matrice = join(racine, '.aiad', 'metrics', 'traceability', 'matrix.json');
  if (existsSync(matrice)) {
    try {
      const data = JSON.parse(readFileSync(matrice, 'utf-8'));
      for (const g of Array.isArray(data.gaps) ? data.gaps : []) {
        const desc = typeof g === 'string' ? g : (g.message || g.kind || '');
        if (!desc) continue;
        obs.push({ signature: signatureObservation(`${g.kind || ''} ${desc}`), source: g.file || g.ref || desc, kind: 'drift', extrait: String(desc).slice(0, 120) });
      }
    } catch { /* matrice illisible → ignorée */ }
  }

  return obs;
}

function premiereLigneSignificative(body) {
  for (const l of String(body || '').split('\n')) {
    const t = l.replace(/^#+\s*/, '').trim();
    if (t && !t.startsWith('>')) return t;
  }
  return '';
}

// ─── Proposition de promotions (récurrence ≥ seuil) ─────────────────────────

/**
 * Regroupe les observations par signature et propose à la promotion celles qui
 * **récurrent** sur au moins `seuil` sources distinctes. Ne décide rien : la
 * promotion reste à la charge d'un humain (Human Authorship).
 *
 * @param {ReturnType<typeof collecterObservations>} observations
 * @param {{ seuil?: number }} [opts]
 * @returns {{ signature: string, occurrences: number, sources: string[], kinds: string[], exemples: string[] }[]}
 */
export function proposerPromotions(observations, { seuil = SEUIL_PROMOTION_DEFAUT } = {}) {
  const groupes = new Map();
  for (const o of observations || []) {
    if (!o.signature) continue;
    if (!groupes.has(o.signature)) groupes.set(o.signature, { sources: new Set(), kinds: new Set(), exemples: [] });
    const g = groupes.get(o.signature);
    g.sources.add(o.source);
    g.kinds.add(o.kind);
    if (g.exemples.length < 3 && !g.exemples.includes(o.extrait)) g.exemples.push(o.extrait);
  }
  const out = [];
  for (const [signature, g] of groupes) {
    const occurrences = g.sources.size; // récurrence cross-sources
    if (occurrences >= seuil) {
      out.push({ signature, occurrences, sources: [...g.sources], kinds: [...g.kinds], exemples: g.exemples });
    }
  }
  return out.sort((a, b) => b.occurrences - a.occurrences);
}

// ─── Promotion (écriture — exige un auteur humain) ──────────────────────────

/**
 * Rend une entrée de mémoire au format `MEMORY.md` (puce horodatée + sources).
 *
 * @param {object} candidat — sortie de {@link proposerPromotions}
 * @param {{ auteur: string, date?: string, lecon?: string }} meta
 * @returns {string}
 */
export function formatEntreeMemoire(candidat, { auteur, date, lecon } = {}) {
  const titre = lecon || candidat.exemples[0] || candidat.signature;
  const quand = date || new Date().toISOString().slice(0, 10);
  return [
    `- **${titre}** _(${candidat.occurrences}× — ${candidat.kinds.join('/')}, promu par ${auteur} le ${quand})_`,
    `  Sources : ${candidat.sources.slice(0, 6).join(', ')}${candidat.sources.length > 6 ? ', …' : ''}`,
  ].join('\n');
}

/**
 * Chemin du store de mémoire projet (versionné, partagé).
 *
 * @param {string} racine
 * @returns {string}
 */
export function cheminStore(racine) {
  return join(racine, '.aiad', 'memory', 'MEMORY.md');
}

/**
 * Promeut un candidat en mémoire. **Refuse fail-closed sans auteur humain**
 * (Human Authorship : la décision d'apprendre ne se délègue pas). Construit le
 * nouveau contenu du store sans effet de bord disque (l'appelant CLI écrit).
 *
 * @param {string} contenuStore — contenu actuel du `MEMORY.md` (vide si absent)
 * @param {object} candidat
 * @param {{ auteur: string, date?: string, lecon?: string }} meta
 * @returns {{ contenu: string, entree: string }}
 */
export function promouvoir(contenuStore, candidat, meta = {}) {
  if (!meta.auteur || !String(meta.auteur).trim()) {
    throw new Error('Promotion refusée : auteur humain requis (Human Authorship — la mémoire ne se fabrique pas seule).');
  }
  const entree = formatEntreeMemoire(candidat, meta);
  const base = contenuStore && contenuStore.trim()
    ? contenuStore.replace(/\s*$/, '')
    : '# MEMORY — Lessons Learned promues (from logs)\n\n> Mémoire projet auto-proposée, **promue par un humain** (cf. §3.8). Une entrée\n> n\'apparaît qu\'après récurrence sur plusieurs sources — jamais sur un cas isolé.\n';
  return { contenu: `${base}\n${entree}\n`, entree };
}

// ─── Auto-curation (éclatement > 200 lignes) ────────────────────────────────

/**
 * Calcule l'éclatement d'un store trop long. Sous le plafond → aucun découpage.
 * Au-delà → un fichier par thème (`## titre`) + index, à la manière native.
 *
 * @param {string} contenu
 * @param {{ maxLignes?: number }} [opts]
 * @returns {{ besoinSplit: boolean, lignes: number, index: string|null, themes: { slug: string, titre: string, contenu: string }[] }}
 */
export function curer(contenu, { maxLignes = MAX_LIGNES_DEFAUT } = {}) {
  const lignes = String(contenu || '').split('\n');
  if (lignes.length <= maxLignes) {
    return { besoinSplit: false, lignes: lignes.length, index: null, themes: [] };
  }

  // Découpe par thème : titres de niveau `## `. Le préambule (avant le 1er `##`)
  // est rattaché à l'index.
  const themes = [];
  let preambule = [];
  let courant = null;
  for (const l of lignes) {
    const m = l.match(/^##\s+(.*\S)\s*$/);
    if (m) {
      if (courant) themes.push(courant);
      courant = { titre: m[1], slug: slugifier(m[1]), lignes: [l] };
    } else if (courant) {
      courant.lignes.push(l);
    } else {
      preambule.push(l);
    }
  }
  if (courant) themes.push(courant);

  // Pas de thèmes `##` → on ne peut pas éclater proprement : on signale sans casser.
  if (themes.length === 0) {
    return { besoinSplit: true, lignes: lignes.length, index: null, themes: [] };
  }

  const index = [
    preambule.join('\n').replace(/\s*$/, ''),
    '',
    '## Index des thèmes',
    '',
    ...themes.map((t) => `- [${t.titre}](memory/${t.slug}.md)`),
    '',
  ].join('\n');

  return {
    besoinSplit: true,
    lignes: lignes.length,
    index,
    themes: themes.map((t) => ({ slug: t.slug, titre: t.titre, contenu: t.lignes.join('\n').replace(/\s*$/, '') + '\n' })),
  };
}

function slugifier(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'theme';
}

// ─── Aliases EN ─────────────────────────────────────────────────────────────

export {
  signatureObservation as observationSignature,
  collecterObservations as collectObservations,
  proposerPromotions as proposePromotions,
  promouvoir as promote,
  formatEntreeMemoire as formatMemoryEntry,
  curer as curate,
  cheminStore as storePath,
};
