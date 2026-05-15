// AIAD SDD Mode — Kit d'adoption gouvernementale FR (item #93).
//
// **Cap stratégique** : faciliter l'adoption d'AIAD par l'administration
// française (services de l'État, collectivités, opérateurs publics) en
// fournissant *out-of-the-box* :
//
//   1. **publiccode.yml** — format obligatoire depuis 2023 pour publier
//      sur https://code.gouv.fr (DINUM, Mission logiciels libres).
//   2. **Kit FranceConnect / FranceConnect+** — skeleton OIDC + niveaux
//      eIDAS (substantiel / élevé) + scopes + redirect URIs.
//   3. **Check Commun Numérique de l'État** — accessibilité (RGAA),
//      réversibilité, sobriété (RGESN), open source, gouvernance.
//   4. **AIPD pré-soumise** — réutilise lib/dpia.js (Article 35 RGPD)
//      formaté pour le dépôt préalable CNIL / AIPD-FR DINUM.
//
// **Zero-dep** : sérialiseur YAML maison, parsing minimal de package.json,
// inspection des annotations machine `@governance AIAD-RGPD`.
//
// Documentation : https://aiad.ovh/dinum
//
// Référentiels :
//   - publiccode.yml — https://yml.publiccode.tools/schema.html (v0.4)
//   - code.gouv.fr — https://code.gouv.fr/sill/about (Mission logiciels libres)
//   - FranceConnect — https://partenaires.franceconnect.gouv.fr/
//   - eIDAS niveaux — https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32015R1502

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { C, logHeader } from './term.js';

// ─── publiccode.yml (DINUM / code.gouv.fr) ─────────────────────────────────

const CATEGORIES_AIAD = ['development-tools', 'project-management', 'continuous-integration'];

/**
 * Échappe une chaîne YAML (zero-dep) : guillemets simples si caractères
 * spéciaux, sinon plain. Pas de support des newlines (à utiliser via
 * literal block plutôt).
 */
function yamlString(s) {
  if (s === null || s === undefined) return '""';
  const str = String(s);
  if (str === '') return '""';
  if (/^[A-Za-z0-9_./:@-]+$/.test(str)) return str;
  return "'" + str.replace(/'/g, "''") + "'";
}

/**
 * Construit un document publiccode.yml v0.4 depuis le package.json.
 *
 * @param {{ name: string, version: string, description?: string, license?: string, repository?: string|object, homepage?: string, author?: string|object, keywords?: string[] }} pkg
 * @param {{ longDescription?: string, agency?: string, primaryLang?: string, languages?: string[] }} [meta]
 * @returns {string} contenu YAML
 */
export function construirePublicCode(pkg, meta = {}) {
  if (!pkg || typeof pkg.name !== 'string') {
    throw new Error('package.json invalide : champ name requis.');
  }
  const lang = meta.primaryLang || 'fr';
  const langs = Array.isArray(meta.languages) && meta.languages.length > 0
    ? meta.languages
    : ['fr', 'en'];
  const repoUrl = typeof pkg.repository === 'string'
    ? pkg.repository
    : (pkg.repository && pkg.repository.url) || '';
  const repoUrlClean = repoUrl.replace(/^git\+/, '').replace(/\.git$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const longDesc = (meta.longDescription || pkg.description || '').replace(/\n/g, ' ');
  const features = Array.isArray(pkg.keywords) && pkg.keywords.length > 0
    ? pkg.keywords.slice(0, 8)
    : ['SDD', 'Spec Driven Development', 'gouvernance', 'EU AI Act'];

  const lignes = [];
  lignes.push('publiccodeYmlVersion: ' + yamlString('0.4'));
  lignes.push('name: ' + yamlString(pkg.name));
  lignes.push('url: ' + yamlString(repoUrlClean));
  if (pkg.homepage) lignes.push('landingURL: ' + yamlString(pkg.homepage));
  lignes.push('softwareVersion: ' + yamlString(pkg.version || '0.0.0'));
  lignes.push('releaseDate: ' + yamlString(today));
  lignes.push('platforms:');
  for (const p of ['linux', 'mac', 'windows']) lignes.push('  - ' + yamlString(p));
  lignes.push('categories:');
  for (const c of CATEGORIES_AIAD) lignes.push('  - ' + yamlString(c));
  lignes.push('developmentStatus: ' + yamlString('stable'));
  lignes.push('softwareType: ' + yamlString('standalone/desktop'));
  lignes.push('description:');
  lignes.push('  ' + lang + ':');
  lignes.push('    shortDescription: ' + yamlString(pkg.description || pkg.name));
  if (longDesc) {
    lignes.push('    longDescription: |');
    for (const l of longDesc.split('. ').filter(Boolean)) {
      lignes.push('      ' + l + (l.endsWith('.') ? '' : '.'));
    }
  }
  lignes.push('    features:');
  for (const f of features) lignes.push('      - ' + yamlString(f));
  lignes.push('legal:');
  lignes.push('  license: ' + yamlString(pkg.license || 'MIT'));
  if (meta.repoOwner) lignes.push('  repoOwner: ' + yamlString(meta.repoOwner));
  lignes.push('maintenance:');
  lignes.push('  type: ' + yamlString(meta.agency ? 'internal' : 'community'));
  lignes.push('  contacts:');
  const author = typeof pkg.author === 'string'
    ? { name: pkg.author }
    : (pkg.author || { name: 'AIAD Maintainers' });
  lignes.push('    - name: ' + yamlString(author.name || 'AIAD Maintainers'));
  if (author.email) lignes.push('      email: ' + yamlString(author.email));
  lignes.push('localisation:');
  lignes.push('  localisationReady: true');
  lignes.push('  availableLanguages:');
  for (const l of langs) lignes.push('    - ' + yamlString(l));
  if (meta.agency) {
    lignes.push('intendedAudience:');
    lignes.push('  countries:');
    lignes.push('    - ' + yamlString('fr'));
    lignes.push('  scope:');
    lignes.push('    - ' + yamlString('government'));
  }

  return lignes.join('\n') + '\n';
}

// ─── FranceConnect skeleton ─────────────────────────────────────────────────

const FRANCECONNECT_NIVEAUX = {
  faible: { label: 'eIDAS faible', acr: 'eidas1', usages: 'Authentification simple, données non-sensibles' },
  substantiel: { label: 'eIDAS substantiel', acr: 'eidas2', usages: 'FranceConnect — services courants' },
  eleve: { label: 'eIDAS élevé', acr: 'eidas3', usages: 'FranceConnect+ — données sensibles, signatures' },
};

const FRANCECONNECT_SCOPES = {
  identite_pivot: 'Nom, prénoms, date et lieu de naissance, sexe',
  given_name: 'Prénoms',
  family_name: 'Nom de naissance',
  preferred_username: 'Nom d\'usage',
  birthdate: 'Date de naissance',
  birthplace: 'Lieu de naissance',
  birthcountry: 'Pays de naissance',
  gender: 'Sexe',
  email: 'Adresse e-mail',
  address: 'Adresse postale',
  phone_number: 'Numéro de téléphone',
};

/**
 * Construit un kit de configuration FranceConnect en Markdown.
 *
 * @param {{ niveau?: 'faible'|'substantiel'|'eleve', clientId?: string, redirectUris?: string[], scopes?: string[] }} [options]
 * @returns {string}
 */
export function construireKitFranceConnect(options = {}) {
  const niveauKey = options.niveau || 'substantiel';
  const niveau = FRANCECONNECT_NIVEAUX[niveauKey];
  if (!niveau) {
    throw new Error(`Niveau inconnu : "${niveauKey}". Disponibles : faible, substantiel, eleve.`);
  }
  const scopes = Array.isArray(options.scopes) && options.scopes.length > 0
    ? options.scopes
    : ['openid', 'identite_pivot'];
  const lignes = [];
  lignes.push('# Kit d\'intégration FranceConnect — généré par aiad-sdd dinum franceconnect');
  lignes.push('');
  lignes.push(`> Niveau eIDAS ciblé : **${niveau.label}** (acr_values=\`${niveau.acr}\`).`);
  lignes.push(`> Usage : ${niveau.usages}.`);
  lignes.push('');
  lignes.push('## 1. Inscription du fournisseur de service (FS)');
  lignes.push('');
  lignes.push('1. Création d\'un compte sur https://partenaires.franceconnect.gouv.fr/');
  lignes.push('2. Déclaration du fournisseur de service avec :');
  lignes.push('   - Nom de l\'organisme et SIRET');
  lignes.push('   - Démonstration du besoin légitime (AIPD ou base juridique RGPD claire)');
  lignes.push('   - URL de production + URL de recette');
  lignes.push('   - Niveau eIDAS demandé (substantiel pour FranceConnect, élevé pour FranceConnect+)');
  lignes.push('3. Récupération des `client_id` et `client_secret` (un par environnement)');
  lignes.push('');
  lignes.push('## 2. Configuration OIDC');
  lignes.push('');
  lignes.push('```env');
  lignes.push('FRANCECONNECT_CLIENT_ID=' + (options.clientId || '<à remplir>'));
  lignes.push('FRANCECONNECT_CLIENT_SECRET=<secret>');
  lignes.push('FRANCECONNECT_DISCOVERY_URL=https://app.franceconnect.gouv.fr/api/v1/.well-known/openid-configuration');
  lignes.push('FRANCECONNECT_ACR_VALUES=' + niveau.acr);
  lignes.push('FRANCECONNECT_SCOPES=' + scopes.join(' '));
  lignes.push('```');
  lignes.push('');
  lignes.push('## 3. Redirect URIs déclarés');
  lignes.push('');
  const uris = Array.isArray(options.redirectUris) && options.redirectUris.length > 0
    ? options.redirectUris
    : ['https://votre-service.gouv.fr/callback', 'https://votre-service.gouv.fr/logout-callback'];
  for (const u of uris) lignes.push(`- \`${u}\``);
  lignes.push('');
  lignes.push('## 4. Scopes demandés');
  lignes.push('');
  for (const s of scopes) {
    const desc = FRANCECONNECT_SCOPES[s] || (s === 'openid' ? 'OpenID Connect — identifiant pivot' : 'Scope custom');
    lignes.push(`- \`${s}\` — ${desc}`);
  }
  lignes.push('');
  lignes.push('## 5. Conformité');
  lignes.push('');
  lignes.push('- **AIPD** soumise (`aiad-sdd dpia`) avant intégration en production.');
  lignes.push('- **Charte d\'identification** signée avec la DINUM.');
  lignes.push('- **Mention CNIL** ajoutée sur les pages où le bouton FranceConnect apparaît.');
  lignes.push('- **Tests d\'intégration** validés en recette par le partenaire avant activation prod.');
  lignes.push('- **Bouton officiel** utilisé exclusivement (charte graphique DINUM, ne pas re-styler).');
  lignes.push('');
  lignes.push('## 6. Liens utiles');
  lignes.push('');
  lignes.push('- Portail partenaires : https://partenaires.franceconnect.gouv.fr/');
  lignes.push('- Documentation FS : https://partenaires.franceconnect.gouv.fr/monfs/documentation-fs');
  lignes.push('- FranceConnect+ (eIDAS élevé) : https://franceconnect.gouv.fr/france-connect-plus');
  lignes.push('- Charte graphique : https://partenaires.franceconnect.gouv.fr/monfs/documentation-fournisseur-service-bouton-fc');
  lignes.push('');
  return lignes.join('\n');
}

// ─── Check Commun Numérique de l'État ──────────────────────────────────────

const COMMUN_NUMERIQUE_CRITERES = [
  { id: 'open-source', label: 'Code open source publié', fn: (ctx) => Boolean(ctx.repoUrl) },
  { id: 'license-libre', label: 'Licence libre (MIT, Apache-2.0, EUPL-1.2, AGPL-3.0)', fn: (ctx) => /^(MIT|Apache-2\.0|EUPL-1\.2|AGPL-3\.0|GPL-3\.0)/i.test(ctx.license || '') },
  { id: 'rgaa', label: 'Conformité RGAA déclarée (AIAD-RGAA présent)', fn: (ctx) => ctx.governanceFiles.includes('AIAD-RGAA.md') },
  { id: 'rgpd', label: 'Conformité RGPD déclarée (AIAD-RGPD + AIPD)', fn: (ctx) => ctx.governanceFiles.includes('AIAD-RGPD.md') },
  { id: 'rgesn', label: 'Sobriété numérique déclarée (AIAD-RGESN)', fn: (ctx) => ctx.governanceFiles.includes('AIAD-RGESN.md') },
  { id: 'reversibilite', label: 'Réversibilité (formats ouverts, export documenté)', fn: (ctx) => ctx.hasReversibility },
  { id: 'gouvernance', label: 'Gouvernance documentée (CONTRIBUTING.md ou .aiad/governance/)', fn: (ctx) => ctx.hasGovernance },
  { id: 'security-md', label: 'SECURITY.md publié (responsible disclosure)', fn: (ctx) => ctx.hasSecurityMd },
  { id: 'publiccode', label: 'publiccode.yml présent (référencement code.gouv.fr)', fn: (ctx) => ctx.hasPublicCode },
];

/**
 * Évalue les critères du Commun Numérique de l'État sur le projet.
 *
 * @param {string} racine
 * @returns {{ critere: string, label: string, ok: boolean }[]}
 */
export function evaluerCommunNumerique(racine) {
  const pkgPath = join(racine, 'package.json');
  let pkg = {};
  if (existsSync(pkgPath)) {
    try { pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')); } catch { /* ignore */ }
  }
  const repoUrl = typeof pkg.repository === 'string'
    ? pkg.repository
    : (pkg.repository && pkg.repository.url) || '';

  const govDir = join(racine, '.aiad', 'gouvernance');
  const governanceFiles = existsSync(govDir) ? readdirSync(govDir) : [];

  const ctx = {
    license: pkg.license || '',
    repoUrl,
    governanceFiles,
    hasReversibility: existsSync(join(racine, 'REVERSIBILITY.md'))
      || existsSync(join(racine, '.aiad', 'reversibility.md'))
      || (pkg.scripts && Boolean(pkg.scripts.export)),
    hasGovernance: existsSync(join(racine, 'CONTRIBUTING.md'))
      || existsSync(join(racine, '.aiad', 'gouvernance')),
    hasSecurityMd: existsSync(join(racine, 'SECURITY.md')),
    hasPublicCode: existsSync(join(racine, 'publiccode.yml')),
  };

  return COMMUN_NUMERIQUE_CRITERES.map((c) => ({
    critere: c.id,
    label: c.label,
    ok: Boolean(c.fn(ctx)),
  }));
}

// ─── Pipeline CLI ───────────────────────────────────────────────────────────

/**
 * Sous-commande `aiad-sdd dinum publiccode`.
 */
export function genererPublicCode(racine, options = {}) {
  const pkgPath = join(racine, 'package.json');
  if (!existsSync(pkgPath)) {
    throw new Error('package.json introuvable à la racine du projet.');
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const yaml = construirePublicCode(pkg, {
    agency: options.agency,
    primaryLang: options.lang || 'fr',
  });
  const outRel = options.out || 'publiccode.yml';
  const outAbs = join(racine, outRel);
  if (!options.dryRun) writeFileSync(outAbs, yaml, 'utf-8');

  if (options.json) {
    process.stdout.write(JSON.stringify({ path: outRel, dryRun: Boolean(options.dryRun) }, null, 2) + '\n');
    return { path: outAbs, content: yaml };
  }
  logHeader('AIAD SDD — DINUM · publiccode.yml v0.4', `Référencement code.gouv.fr`);
  console.log(`  ${C.vert}✓${C.reset} ${options.dryRun ? '(dry-run, non écrit)' : `Écrit dans ${C.cyan}${outRel}${C.reset}`}`);
  console.log(`  ${C.gris}Soumission : https://code.gouv.fr/sill/about — déposer le fichier puis ouvrir une issue.${C.reset}\n`);
  return { path: outAbs, content: yaml };
}

/**
 * Sous-commande `aiad-sdd dinum franceconnect`.
 */
export function genererFranceConnect(racine, options = {}) {
  const md = construireKitFranceConnect({
    niveau: options.niveau,
    clientId: options.clientId,
    redirectUris: options.redirectUris,
    scopes: options.scopes,
  });
  const outRel = options.out || '.aiad/dinum/franceconnect.md';
  const outAbs = join(racine, outRel);
  if (!options.dryRun) {
    if (!existsSync(dirname(outAbs))) mkdirSync(dirname(outAbs), { recursive: true });
    writeFileSync(outAbs, md, 'utf-8');
  }
  if (options.json) {
    process.stdout.write(JSON.stringify({ path: outRel, dryRun: Boolean(options.dryRun) }, null, 2) + '\n');
    return { path: outAbs, content: md };
  }
  logHeader('AIAD SDD — DINUM · Kit FranceConnect', `Skeleton OIDC + scopes + niveaux eIDAS`);
  console.log(`  ${C.vert}✓${C.reset} ${options.dryRun ? '(dry-run, non écrit)' : `Écrit dans ${C.cyan}${outRel}${C.reset}`}`);
  console.log(`  ${C.gris}Inscription FS : https://partenaires.franceconnect.gouv.fr/${C.reset}\n`);
  return { path: outAbs, content: md };
}

/**
 * Sous-commande `aiad-sdd dinum check` — Commun Numérique de l'État.
 */
export function checkCommunNumerique(racine, options = {}) {
  const evaluation = evaluerCommunNumerique(racine);
  const reussis = evaluation.filter((e) => e.ok).length;
  const total = evaluation.length;
  const score = Math.round((reussis / total) * 100);

  if (options.json) {
    process.stdout.write(JSON.stringify({
      score, reussis, total,
      criteres: evaluation,
    }, null, 2) + '\n');
    return { score, evaluation };
  }
  logHeader(
    'AIAD SDD — DINUM · Commun Numérique de l\'État',
    `Score : ${reussis}/${total} (${score}%)`,
  );
  for (const e of evaluation) {
    const sym = e.ok ? `${C.vert}✓${C.reset}` : `${C.rouge}✗${C.reset}`;
    console.log(`  ${sym} ${e.label}`);
  }
  console.log('');
  if (score < 100) {
    console.log(`  ${C.gris}Conseil : viser ≥ 80% avant soumission code.gouv.fr.${C.reset}\n`);
  }
  return { score, evaluation };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  construirePublicCode as buildPublicCode,
  construireKitFranceConnect as buildFranceConnectKit,
  evaluerCommunNumerique as evaluateCommonsScore,
  genererPublicCode as generatePublicCode,
  genererFranceConnect as generateFranceConnect,
  checkCommunNumerique as checkCommons,
};

export const CONSTANTS = {
  FRANCECONNECT_NIVEAUX,
  FRANCECONNECT_SCOPES,
  COMMUN_NUMERIQUE_CRITERES: COMMUN_NUMERIQUE_CRITERES.map((c) => ({ id: c.id, label: c.label })),
};
