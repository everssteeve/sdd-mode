// AIAD SDD Mode — Génération SBOM CycloneDX v1.5.
//
// Software Bill of Materials = inventaire lisible-machine de tous les
// composants du projet (dépendances directes + transitives, versions,
// licences, hashes). **Cyber Resilience Act EU 2024/2847** imposera le SBOM
// dès 2027 pour tout produit logiciel commercialisé en EU. Le générer dès
// maintenant est un avantage compétitif clair.
//
// Format ciblé : **CycloneDX v1.5** (https://cyclonedx.org/), reconnu par
// les outils EU de scan de vulnérabilités (Dependency-Track, OSS Review
// Toolkit, GitHub Advanced Security).
//
// Sources de données :
//   - `package.json` du projet courant (métadonnées + deps déclarées)
//   - `package-lock.json` (versions exactes de l'arbre transitif)
//   - `node_modules/<dep>/package.json` (licences si lockfile absent)
//
// Hashes : SHA-256 du tarball npm (lu dans `package-lock.json#integrity`).
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { syncFile } from './fs-ops.js';
import { C, log, logHeader } from './term.js';
import { t } from './i18n.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function lirePackage(racine) {
  const p = join(racine, 'package.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
}

function lireLockfile(racine) {
  const p = join(racine, 'package-lock.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
}

/**
 * Construit la liste des composants depuis package-lock.json (npm v7+).
 * Format `lockfile.packages` : map "node_modules/foo" → { version, integrity, license }.
 *
 * @param {object} lockfile
 * @returns {object[]} composants CycloneDX
 */
function composantsDepuisLockfile(lockfile) {
  const out = [];
  const packages = lockfile.packages || {};
  for (const [chemin, info] of Object.entries(packages)) {
    if (chemin === '') continue; // root project, déjà dans metadata.component
    const nom = chemin.replace(/^.*node_modules\//, '');
    if (!nom || nom.startsWith('.')) continue;
    const composant = {
      type: 'library',
      'bom-ref': `pkg:npm/${nom}@${info.version || 'unknown'}`,
      name: nom,
      version: info.version || 'unknown',
      purl: `pkg:npm/${nom}@${info.version || 'unknown'}`,
    };
    if (info.license) {
      composant.licenses = [normaliseLicense(info.license)];
    }
    if (info.integrity) {
      // Format SRI : sha512-base64==. CycloneDX attend hex.
      const m = info.integrity.match(/^(sha\d+)-([A-Za-z0-9+/=]+)$/);
      if (m) {
        const alg = m[1].toUpperCase().replace('SHA', 'SHA-');
        const hex = Buffer.from(m[2], 'base64').toString('hex');
        composant.hashes = [{ alg, content: hex }];
      }
    }
    if (info.resolved) {
      composant.externalReferences = [{ type: 'distribution', url: info.resolved }];
    }
    out.push(composant);
  }
  return out;
}

function normaliseLicense(licenseField) {
  if (typeof licenseField === 'string') {
    return { license: { id: licenseField } };
  }
  if (Array.isArray(licenseField)) {
    return { license: { id: licenseField[0] } };
  }
  if (typeof licenseField === 'object' && licenseField.type) {
    return { license: { id: licenseField.type } };
  }
  return { license: { name: 'unknown' } };
}

/**
 * Construit la liste depuis `package.json#dependencies` quand le lockfile
 * est absent. Ranges sémantiques préservés (moins précis mais valide).
 */
function composantsDepuisPackageJson(pkg) {
  const out = [];
  const ajouter = (deps, scope) => {
    for (const [nom, range] of Object.entries(deps || {})) {
      out.push({
        type: 'library',
        'bom-ref': `pkg:npm/${nom}@${range}`,
        name: nom,
        version: range.replace(/^[\^~]/, ''),
        purl: `pkg:npm/${nom}@${encodeURIComponent(range)}`,
        scope: scope === 'dev' ? 'optional' : 'required',
      });
    }
  };
  ajouter(pkg.dependencies, 'prod');
  ajouter(pkg.devDependencies, 'dev');
  ajouter(pkg.peerDependencies, 'peer');
  return out;
}

/**
 * Construit le document SBOM CycloneDX v1.5 en mémoire.
 *
 * @param {string} racine
 * @returns {object} document SBOM JSON-sérialisable
 */
export function buildSbom(racine) {
  const pkg = lirePackage(racine);
  if (!pkg) {
    throw new Error(t('sbom.errorNoPackage', { racine }));
  }

  // Métadonnées propres à aiad-sdd (le générateur)
  const aiadVersion = (() => {
    try {
      const ownPkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
      return ownPkg.version;
    } catch { return '1.14.0'; }
  })();

  const lockfile = lireLockfile(racine);
  const components = lockfile
    ? composantsDepuisLockfile(lockfile)
    : composantsDepuisPackageJson(pkg);

  // bom-ref unique pour le composant principal
  const projectRef = `pkg:npm/${pkg.name || 'project'}@${pkg.version || '0.0.0'}`;

  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${cryptoRandomUuid()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: 'AIAD',
          name: 'aiad-sdd',
          version: aiadVersion,
        },
      ],
      component: {
        type: 'application',
        'bom-ref': projectRef,
        name: pkg.name || 'project',
        version: pkg.version || '0.0.0',
        description: pkg.description || '',
        licenses: pkg.license ? [normaliseLicense(pkg.license)] : [],
        purl: projectRef,
      },
      authors: pkg.author ? [{ name: String(pkg.author) }] : [],
    },
    components,
    dependencies: lockfile ? extraireGraphe(lockfile, projectRef) : [],
  };
}

function extraireGraphe(lockfile, projectRef) {
  const deps = [];
  const root = lockfile.packages?.[''];
  if (root && root.dependencies) {
    deps.push({
      ref: projectRef,
      dependsOn: Object.keys(root.dependencies).map((nom) => `pkg:npm/${nom}@${root.dependencies[nom]}`),
    });
  }
  return deps;
}

function cryptoRandomUuid() {
  return randomUUID();
}

/**
 * Génère ou affiche le SBOM CycloneDX v1.5.
 *
 * @param {string} racine
 * @param {{ out?: string, json?: boolean, dryRun?: boolean }} [options]
 * @returns {Promise<{ path: string|null, sbom: object }>}
 */
export async function genererSbom(racine, options = {}) {
  const { out, json = false, dryRun = false } = options;
  const sbom = buildSbom(racine);

  if (json) {
    process.stdout.write(JSON.stringify(sbom, null, 2) + '\n');
    return { path: null, sbom };
  }

  const dest = out ? join(racine, out) : join(racine, 'sbom.cdx.json');
  const contenu = JSON.stringify(sbom, null, 2);

  logHeader(t('sbom.title'), t('sbom.subtitle'));

  const result = syncFile(dest, contenu, { dryRun });
  const sym = result === 'created' ? `${C.vert}+${C.reset}`
    : result === 'updated' ? `${C.cyan}↑${C.reset}`
    : `${C.vert}✓${C.reset}`;
  log(sym, `${dest.replace(racine + '/', '')}${dryRun ? ` ${C.gris}(dry-run)${C.reset}` : ''}`);

  console.log(`
${C.gras}  ${t('sbom.summary.title')}${C.reset}
    ${t('sbom.summary.component')} : ${C.cyan}${sbom.metadata.component.name}@${sbom.metadata.component.version}${C.reset}
    ${t('sbom.summary.components')}    : ${C.cyan}${sbom.components.length}${C.reset}
    ${t('sbom.summary.format')}              : CycloneDX v${sbom.specVersion}
    ${t('sbom.summary.tool')}    : aiad-sdd v${sbom.metadata.tools[0].version}

${C.gris}  ${t('sbom.compatHint')}${C.reset}
${C.gris}  ${t('sbom.refHint')}${C.reset}
`);

  return { path: dest, sbom };
}
