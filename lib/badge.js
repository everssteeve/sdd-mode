// AIAD SDD Mode — Commande `badge` (#230, #231).
//
// Génère un badge SVG (style shields.io) pour README.md à partir de
// `dashboard/data.json`. Trois types (#231) :
//   sante      (défaut) → santeGlobale.score    /100 + niveau
//   maturite             → maturite.score/total + label
//   violations           → violations.total Tier 1 (#202)
//
// Couleurs cohérentes avec dashboard :
//   excellent ≥85 → #4c1 (vert)
//   sain     ≥70 → #97ca00 (vert clair)
//   attention ≥50 → #dfb317 (jaune-orange)
//   critique  <50 → #e05d44 (rouge)
//
// Pas de dashboard → badge "AIAD … : non calculé" gris.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const COULEURS = {
  excellent: '#4c1',
  sain: '#97ca00',
  attention: '#dfb317',
  critique: '#e05d44',
  inconnu: '#9f9f9f',
};

export const TYPES_VALIDES = ['sante', 'maturite', 'violations'];

// Largeur approximative d'un texte rendu en Verdana 11px.
function largeurTexte(s) {
  return Math.max(20, Math.round(s.length * 6.5 + 10));
}

// Calcule la couleur depuis niveau (priorité) ou depuis score (fallback).
export function couleurBadge(niveau, score) {
  if (niveau && COULEURS[niveau]) return COULEURS[niveau];
  if (typeof score === 'number') {
    if (score >= 85) return COULEURS.excellent;
    if (score >= 70) return COULEURS.sain;
    if (score >= 50) return COULEURS.attention;
    return COULEURS.critique;
  }
  return COULEURS.inconnu;
}

// Lit `dashboard/data.json` brut (ou null si absent/cassé).
function lireData(racineProjet, outDir = 'dashboard') {
  const chemin = join(racineProjet, outDir, 'data.json');
  if (!existsSync(chemin)) return null;
  try { return JSON.parse(readFileSync(chemin, 'utf-8')); }
  catch { return null; }
}

// Lit la santé globale. Retourne {score, niveau} ou null. (#230 back-compat)
export function lireSante(racineProjet, outDir = 'dashboard') {
  const d = lireData(racineProjet, outDir);
  const s = d?.santeGlobale;
  if (!s || typeof s.score !== 'number') return null;
  return { score: s.score, niveau: s.niveau || null };
}

// (#231) Extrait `{label, message, couleur}` selon le type.
// Retourne null si la donnée source est absente — l'appelant rend alors
// "non calculé" gris.
export function calculerContenuBadge(racineProjet, type = 'sante', outDir = 'dashboard') {
  const d = lireData(racineProjet, outDir);
  if (!d) return null;

  if (type === 'sante') {
    const s = d.santeGlobale;
    if (!s || typeof s.score !== 'number') return null;
    return {
      label: 'AIAD SDD',
      message: `${s.score}/100${s.niveau ? ' ' + s.niveau : ''}`,
      couleur: couleurBadge(s.niveau, s.score),
      score: s.score,
      niveau: s.niveau || null,
    };
  }

  if (type === 'maturite') {
    const m = d.maturite;
    if (!m || typeof m.score !== 'number' || typeof m.total !== 'number') return null;
    // Score 5/5 → excellent, 4/5 → sain, 3/5 → attention, ≤2/5 → critique.
    let niveau = 'critique';
    if (m.score === m.total) niveau = 'excellent';
    else if (m.score >= m.total - 1) niveau = 'sain';
    else if (m.score >= Math.ceil(m.total / 2)) niveau = 'attention';
    return {
      label: 'AIAD Maturité',
      message: `${m.score}/${m.total}${m.label ? ' ' + m.label : ''}`,
      couleur: couleurBadge(niveau),
    };
  }

  if (type === 'violations') {
    const v = d.violations;
    if (!v || typeof v.total !== 'number') return null;
    // 0 → excellent, 1-3 → attention, >3 → critique.
    let niveau = 'excellent';
    let suffixe = 'aucune dérive';
    if (v.total > 0) {
      niveau = v.total > 3 ? 'critique' : 'attention';
      suffixe = `${v.total} Tier 1`;
    }
    return {
      label: 'AIAD Violations',
      message: suffixe,
      couleur: couleurBadge(niveau),
    };
  }

  return null;
}

// Génère le SVG. Style flat, compatible shields.io.
// Accepte deux signatures (back-compat #230) :
//   genererSvg({score, niveau}, opts)            → ancien usage santé
//   genererSvg({label, message, couleur}, opts)  → nouveau (typed)
export function genererSvg(donnees, options = {}) {
  let label; let message; let couleur;
  if (!donnees) {
    label = options.label || 'AIAD SDD';
    message = 'non calculé';
    couleur = COULEURS.inconnu;
  } else if (donnees.message != null && donnees.couleur != null) {
    // Forme typée (#231)
    label = options.label || donnees.label || 'AIAD SDD';
    message = donnees.message;
    couleur = donnees.couleur;
  } else {
    // Forme santé legacy (#230)
    label = options.label || 'AIAD SDD';
    message = `${donnees.score}/100${donnees.niveau ? ' ' + donnees.niveau : ''}`;
    couleur = couleurBadge(donnees.niveau, donnees.score);
  }
  const lW = largeurTexte(label);
  const mW = largeurTexte(message);
  const W = lW + mW;
  const id = options.id || 'aiad-badge';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="20" role="img" aria-label="${escapeXml(label)}: ${escapeXml(message)}">
  <title>${escapeXml(label)}: ${escapeXml(message)}</title>
  <linearGradient id="${id}-g" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="${id}-c"><rect width="${W}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#${id}-c)">
    <rect width="${lW}" height="20" fill="#555"/>
    <rect x="${lW}" width="${mW}" height="20" fill="${couleur}"/>
    <rect width="${W}" height="20" fill="url(#${id}-g)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lW / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(label)}</text>
    <text x="${lW / 2}" y="14">${escapeXml(label)}</text>
    <text x="${lW + mW / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(message)}</text>
    <text x="${lW + mW / 2}" y="14">${escapeXml(message)}</text>
  </g>
</svg>`;
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[c]));
}

// Chemin par défaut selon le type.
// (#242) `dir` doit suivre `--out` du dashboard (ex: "public"). Par défaut
// "dashboard" pour back-compat. Avant cette correction, les badges étaient
// toujours écrits dans `dashboard/` même si l'utilisateur avait demandé
// `dashboard --out=public` → badges et HTML découplés.
function cheminDefaut(racine, type, dir = 'dashboard') {
  if (type === 'sante') return join(racine, dir, 'badge.svg');
  return join(racine, dir, `badge-${type}.svg`);
}

// Façade orchestrale.
// options.type    : 'sante' (défaut) | 'maturite' | 'violations'
// options.out     : chemin SVG (défaut dashboard/badge[-type].svg)
// options.dataDir : dossier contenant data.json (défaut "dashboard")
// options.dryRun  : ne pas écrire, renvoyer juste le SVG
// options.label   : libellé custom
export function genererBadge(racineProjet, options = {}) {
  const type = options.type || 'sante';
  if (!TYPES_VALIDES.includes(type)) {
    throw new Error(`Type de badge inconnu : "${type}". Valides : ${TYPES_VALIDES.join(', ')}`);
  }
  const contenu = calculerContenuBadge(racineProjet, type, options.dataDir || 'dashboard');
  const svg = genererSvg(contenu, { label: options.label });
  if (options.dryRun) return { svg, donnees: contenu, type };
  const cheminOut = options.out
    ? (options.out.startsWith('/') ? options.out : join(racineProjet, options.out))
    : cheminDefaut(racineProjet, type, options.dataDir || 'dashboard');
  mkdirSync(dirname(cheminOut), { recursive: true });
  writeFileSync(cheminOut, svg, 'utf-8');
  return { svg, donnees: contenu, type, path: cheminOut };
}

// (#231) Génère les 3 badges d'un coup. Utile pour `--all`.
export function genererTousLesBadges(racineProjet, options = {}) {
  return TYPES_VALIDES.map((type) => genererBadge(racineProjet, { ...options, type }));
}

// (#284) Génère un objet JSON conforme au format **shields.io endpoint**
// (https://shields.io/badges/endpoint-badge). Un user qui héberge ce JSON
// (gist GitHub, repo public, S3) peut intégrer dans son README :
//     ![](https://img.shields.io/endpoint?url=<url-encoded-of-host>)
// → shields.io render dynamiquement le badge à chaque visite, lisant
// toujours le dernier JSON publié → live badge sans CI re-commit.
//
// Spec attendue : { schemaVersion: 1, label, message, color, ?cacheSeconds }
// Couleurs : shields accepte hex sans `#` OU keywords (green, brightgreen,
// yellow, orange, red, lightgrey, blue). On envoie le hex sans `#`.
export function genererShieldsEndpoint(racineProjet, options = {}) {
  const type = options.type || 'sante';
  if (!TYPES_VALIDES.includes(type)) {
    throw new Error(`Type de badge inconnu : "${type}". Valides : ${TYPES_VALIDES.join(', ')}`);
  }
  const contenu = calculerContenuBadge(racineProjet, type, options.dataDir || 'dashboard');
  const label = options.label || (contenu ? contenu.label : 'AIAD SDD');
  const message = contenu ? contenu.message : 'non calculé';
  const couleur = contenu ? contenu.couleur : '#9f9f9f';
  return {
    schemaVersion: 1,
    label,
    message,
    color: couleur.startsWith('#') ? couleur.slice(1) : couleur,
    // Cache 5min côté shields = équilibre fraîcheur vs charge serveur.
    cacheSeconds: 300,
  };
}

// Alias EN canoniques.
export {
  lireSante as readHealth,
  genererSvg as renderSvg,
  genererBadge as generateBadge,
  couleurBadge as badgeColor,
  calculerContenuBadge as computeBadgeContent,
  genererTousLesBadges as generateAllBadges,
  genererShieldsEndpoint as generateShieldsEndpoint,
};
