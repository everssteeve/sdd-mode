// AIAD SDD Mode — Matrice SLA maintenance & sécurité (item #106).
//
// **Cap stratégique** : un SaaS / CLI distribué a besoin d'une politique
// de support **explicite et opposable** : quelle version est supportée
// jusqu'à quand, quelle est la fréquence de patch, quel est le préavis
// de dépréciation. Sans cette matrice, les utilisateurs (et notamment
// les acheteurs publics EU exigeant un audit fournisseur) ne peuvent
// pas calibrer leur risque de mise à jour.
//
// **Politique par défaut** :
//   - **Current major** (ex. 1.x) : supporté pour 12 mois minimum après
//     publication, fenêtre étendue à 18 mois si pas de major suivant.
//   - **Previous major** (ex. 0.x) : security-only pendant 6 mois après
//     la sortie du major suivant — fenêtre d'overlap.
//   - **Pre-release / older** : non supporté.
//
// **Fenêtres de patch** :
//   - Critique (RCE, supply-chain) : **< 72h** après reproduction.
//   - Élevé (lecture/écriture arbitraire) : **< 30j** ou prochain release.
//   - Moyen / Bas : prochain minor.
//
// **Dépréciation** : préavis **6 mois minimum** annoncé via CHANGELOG +
// release notes GitHub + warning CLI à l'exécution sur version dépréciée.
//
// **Source** : tags git `v*` + package.json + politique embarquée. Une
// politique custom peut être définie dans `.aiad/sla.yml` (optionnel).
//
// Documentation : https://aiad.ovh/sla

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { C, logHeader } from './term.js';

const SECURITY_MD = 'SECURITY.md';
const MARQUEUR_DEBUT = '<!-- AIAD-SLA-START -->';
const MARQUEUR_FIN = '<!-- AIAD-SLA-END -->';

// Politique par défaut, exprimée en jours (interprétée à partir de la date de release).
export const POLITIQUE_DEFAUT = {
  currentMajorSupportDays: 365,         // 12 mois
  currentMajorExtendedDays: 540,        // 18 mois si pas de major suivant
  previousMajorOverlapDays: 180,        // 6 mois après sortie major suivant
  deprecationNoticeDays: 180,           // 6 mois préavis dépréciation
  patchWindows: {
    critique: '< 72 heures',
    eleve: '< 30 jours ou prochain release',
    moyen: 'prochain minor',
    bas: 'prochain minor',
  },
};

// ─── Lecture sources ───────────────────────────────────────────────────────

/**
 * Liste les tags git `vX.Y.Z` triés par version croissante.
 *
 * @returns {{ version: string, major: number, minor: number, patch: number, date?: string }[]}
 */
export function listerTagsVersions(racine) {
  const r = spawnSync('git', ['tag', '--list', 'v*', '--format=%(refname:strip=2) %(creatordate:short)'], {
    cwd: racine, encoding: 'utf-8',
  });
  if (r.status !== 0) return [];
  const out = [];
  for (const ligne of r.stdout.split('\n')) {
    const m = ligne.match(/^(v?)(\d+)\.(\d+)\.(\d+)\s+(\d{4}-\d{2}-\d{2})?/);
    if (!m) continue;
    out.push({
      version: `${m[2]}.${m[3]}.${m[4]}`,
      major: +m[2],
      minor: +m[3],
      patch: +m[4],
      date: m[5] || null,
    });
  }
  return out.sort((a, b) => {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    return a.patch - b.patch;
  });
}

/**
 * Renvoie la version courante depuis package.json.
 */
export function lireVersionCourante(racine) {
  const path = join(racine, 'package.json');
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')).version || null; }
  catch { return null; }
}

// ─── Construction de la matrice ────────────────────────────────────────────

function ajouterJours(date, jours) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

function premiereSortieDuMajor(tags, major) {
  const dans = tags.filter((t) => t.major === major).sort((a, b) => {
    if (a.minor !== b.minor) return a.minor - b.minor;
    return a.patch - b.patch;
  });
  return dans[0]?.date || null;
}

/**
 * Construit la matrice SLA depuis les tags + politique.
 *
 * @param {object} input
 * @param {{ version: string, major: number, date?: string }[]} input.tags
 * @param {string|null} input.versionCourante
 * @param {object} [input.politique]
 * @param {string} [input.aujourdhui] — ISO YYYY-MM-DD (utile pour tests)
 */
export function construireMatrice(input) {
  const politique = { ...POLITIQUE_DEFAUT, ...(input.politique || {}) };
  const tags = input.tags || [];
  const today = input.aujourdhui || new Date().toISOString().slice(0, 10);
  const courant = input.versionCourante;
  const courantMajor = courant ? parseInt(courant.split('.')[0], 10) : null;

  // Liste les majors connus (depuis tags + version courante)
  const majors = new Set(tags.map((t) => t.major));
  if (courantMajor !== null && !Number.isNaN(courantMajor)) majors.add(courantMajor);
  const majorsArr = [...majors].sort((a, b) => a - b);
  const dernierMajor = majorsArr[majorsArr.length - 1] ?? null;

  const versions = [];
  for (const major of majorsArr) {
    const sortie = premiereSortieDuMajor(tags, major);
    let supportedUntil = null;
    let status = 'unsupported';
    if (major === dernierMajor) {
      // Major actuel : supporté
      status = 'supported';
      supportedUntil = sortie ? ajouterJours(sortie, politique.currentMajorSupportDays) : null;
    } else if (major === dernierMajor - 1) {
      // Major précédent : security-only sur la fenêtre overlap
      const sortieSuivant = premiereSortieDuMajor(tags, major + 1);
      if (sortieSuivant) {
        supportedUntil = ajouterJours(sortieSuivant, politique.previousMajorOverlapDays);
        status = (supportedUntil >= today) ? 'security-only' : 'unsupported';
      } else {
        status = 'security-only';
        supportedUntil = sortie ? ajouterJours(sortie, politique.currentMajorExtendedDays) : null;
      }
    }
    versions.push({
      major,
      versionRange: `${major}.x`,
      releaseDate: sortie,
      supportedUntil,
      status,
    });
  }

  return {
    generatedAt: today,
    versionCourante: courant,
    politique: {
      currentMajorSupportDays: politique.currentMajorSupportDays,
      previousMajorOverlapDays: politique.previousMajorOverlapDays,
      deprecationNoticeDays: politique.deprecationNoticeDays,
      patchWindows: politique.patchWindows,
    },
    versions,
  };
}

// ─── Validation ────────────────────────────────────────────────────────────

/**
 * Vérifie qu'aucune version `supported` n'est expirée par rapport à la date.
 */
export function validerMatrice(matrice) {
  const today = matrice.generatedAt;
  const issues = [];
  for (const v of matrice.versions) {
    if (v.status === 'supported' && v.supportedUntil && v.supportedUntil < today) {
      issues.push(`Version ${v.versionRange} marquée supported mais supportedUntil ${v.supportedUntil} < ${today}`);
    }
    if (v.status === 'security-only' && v.supportedUntil && v.supportedUntil < today) {
      issues.push(`Version ${v.versionRange} security-only expirée (${v.supportedUntil})`);
    }
  }
  return { valid: issues.length === 0, issues };
}

// ─── Rendu Markdown ────────────────────────────────────────────────────────

const STATUS_LABEL = {
  supported: '✅ Supportée (full)',
  'security-only': '🛡️ Security-only',
  unsupported: '❌ Non supportée',
};

/**
 * Rend la matrice SLA en Markdown injectable dans SECURITY.md.
 */
export function rendreMatriceMarkdown(matrice) {
  const lignes = [];
  lignes.push(MARQUEUR_DEBUT);
  lignes.push('## SLA — Matrice de maintenance & sécurité');
  lignes.push('');
  lignes.push(`> _Section générée par \`aiad-sdd sla update\` le ${matrice.generatedAt}. Ne pas éditer manuellement (utilise \`aiad-sdd sla update\` pour rafraîchir)._`);
  lignes.push('');
  lignes.push('### Versions supportées');
  lignes.push('');
  lignes.push('| Version | Première release | Support jusqu\'à | Statut |');
  lignes.push('|---------|------------------|-----------------|--------|');
  for (const v of matrice.versions) {
    lignes.push(`| ${v.versionRange} | ${v.releaseDate || '—'} | ${v.supportedUntil || '—'} | ${STATUS_LABEL[v.status] || v.status} |`);
  }
  lignes.push('');
  lignes.push('### Politique de support');
  lignes.push('');
  lignes.push(`- **Current major** : ${matrice.politique.currentMajorSupportDays} jours minimum après première release du major.`);
  lignes.push(`- **Previous major** : ${matrice.politique.previousMajorOverlapDays} jours d'overlap *security-only* après release du major suivant.`);
  lignes.push(`- **Préavis de dépréciation** : ${matrice.politique.deprecationNoticeDays} jours minimum, annoncé via CHANGELOG + release notes.`);
  lignes.push('');
  lignes.push('### Fenêtres de patch');
  lignes.push('');
  lignes.push('| Sévérité | Délai |');
  lignes.push('|----------|-------|');
  lignes.push(`| Critique (RCE, supply-chain) | ${matrice.politique.patchWindows.critique} |`);
  lignes.push(`| Élevé (lecture/écriture arbitraire) | ${matrice.politique.patchWindows.eleve} |`);
  lignes.push(`| Moyen | ${matrice.politique.patchWindows.moyen} |`);
  lignes.push(`| Bas | ${matrice.politique.patchWindows.bas} |`);
  lignes.push('');
  lignes.push('### Politique de dépréciation');
  lignes.push('');
  lignes.push('1. **Annonce** : flag d\'une fonctionnalité comme dépréciée dans une release minor (CHANGELOG + warning CLI).');
  lignes.push(`2. **Préavis** : minimum **${matrice.politique.deprecationNoticeDays} jours** entre annonce et retrait.`);
  lignes.push('3. **Migration** : guide de migration publié à l\'annonce, exemples avant/après.');
  lignes.push('4. **Retrait** : suppression effective dans la version major suivante uniquement.');
  lignes.push('');
  lignes.push(MARQUEUR_FIN);
  return lignes.join('\n');
}

// ─── Injection idempotente dans SECURITY.md ────────────────────────────────

/**
 * Injecte ou remplace le bloc SLA dans SECURITY.md (idempotent via marqueurs).
 */
export function injecterDansSecurity(racine, blocMarkdown, options = {}) {
  const path = join(racine, SECURITY_MD);
  if (!existsSync(path)) {
    if (!options.dryRun) writeFileSync(path, blocMarkdown + '\n', 'utf-8');
    return { action: 'created', path };
  }
  const contenu = readFileSync(path, 'utf-8');
  const debut = contenu.indexOf(MARQUEUR_DEBUT);
  const fin = contenu.indexOf(MARQUEUR_FIN);
  let nouveau;
  let action;
  if (debut !== -1 && fin !== -1 && fin > debut) {
    // Remplace le bloc existant
    const finComplet = fin + MARQUEUR_FIN.length;
    nouveau = contenu.slice(0, debut) + blocMarkdown + contenu.slice(finComplet);
    action = 'updated';
  } else {
    // Append en fin de fichier
    nouveau = contenu.replace(/\n+$/, '') + '\n\n' + blocMarkdown + '\n';
    action = 'appended';
  }
  if (!options.dryRun) writeFileSync(path, nouveau, 'utf-8');
  return { action, path };
}

// ─── Pipeline CLI ──────────────────────────────────────────────────────────

/**
 * Sous-commande `show` : génère et affiche la matrice (sans toucher SECURITY.md).
 */
export function show(racine, options = {}) {
  const tags = listerTagsVersions(racine);
  const versionCourante = lireVersionCourante(racine);
  const matrice = construireMatrice({
    tags, versionCourante, aujourdhui: options.aujourdhui,
  });

  if (options.json) {
    process.stdout.write(JSON.stringify(matrice, null, 2) + '\n');
    return matrice;
  }
  logHeader('AIAD SDD — SLA matrix', `Generated ${matrice.generatedAt} · current ${versionCourante || 'inconnue'}`);
  for (const v of matrice.versions) {
    const couleur = v.status === 'supported' ? C.vert
      : v.status === 'security-only' ? C.jaune
      : C.gris;
    console.log(`  ${couleur}● ${v.versionRange.padEnd(8)}${C.reset} ${v.releaseDate || '—'} → ${v.supportedUntil || '—'}  ${C.gris}(${v.status})${C.reset}`);
  }
  console.log('');
  return matrice;
}

/**
 * Sous-commande `check` : retourne exit 1 si SLA inconsistant.
 */
export function check(racine, options = {}) {
  const tags = listerTagsVersions(racine);
  const versionCourante = lireVersionCourante(racine);
  const matrice = construireMatrice({
    tags, versionCourante, aujourdhui: options.aujourdhui,
  });
  const validation = validerMatrice(matrice);
  if (options.json) {
    process.stdout.write(JSON.stringify({ matrice, validation }, null, 2) + '\n');
    return validation;
  }
  if (validation.valid) {
    console.log(`\n  ${C.vert}✓${C.reset} SLA cohérent (${matrice.versions.length} version(s) connue(s)).\n`);
  } else {
    console.error(`\n  ${C.rouge}✗${C.reset} SLA inconsistant :`);
    for (const i of validation.issues) console.error(`    - ${i}`);
    console.error('');
  }
  return validation;
}

/**
 * Sous-commande `update` : (re)génère le bloc et l'injecte dans SECURITY.md.
 */
export function update(racine, options = {}) {
  const tags = listerTagsVersions(racine);
  const versionCourante = lireVersionCourante(racine);
  const matrice = construireMatrice({
    tags, versionCourante, aujourdhui: options.aujourdhui,
  });
  const bloc = rendreMatriceMarkdown(matrice);
  const r = injecterDansSecurity(racine, bloc, { dryRun: options.dryRun });
  if (options.json) {
    process.stdout.write(JSON.stringify({
      action: r.action,
      path: SECURITY_MD,
      versions: matrice.versions.length,
      dryRun: Boolean(options.dryRun),
    }, null, 2) + '\n');
    return { matrice, action: r.action };
  }
  logHeader('AIAD SDD — SLA update', `${SECURITY_MD} ${r.action}${options.dryRun ? ' (dry-run)' : ''}`);
  console.log(`  ${C.vert}✓${C.reset} ${matrice.versions.length} version(s) dans la matrice.\n`);
  return { matrice, action: r.action };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  listerTagsVersions as listVersionTags,
  lireVersionCourante as readCurrentVersion,
  construireMatrice as buildMatrix,
  validerMatrice as validateMatrix,
  rendreMatriceMarkdown as renderMatrixMarkdown,
  injecterDansSecurity as injectIntoSecurity,
  show as showSla,
  check as checkSla,
  update as updateSla,
};

export const CONSTANTS = {
  SECURITY_MD,
  MARQUEUR_DEBUT,
  MARQUEUR_FIN,
};
