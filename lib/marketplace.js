// AIAD SDD Mode — Marketplace de packs gouvernance verticaux premium.
//
// **Cap stratégique** : ne PAS embarquer les contenus réglementaires
// propriétaires (HDS, TISAX, DO-178C, IEC 62443 ont des licences
// restreintes et redistribution limitée). Le module fournit un **catalogue**
// + un **connecteur d'achat** orientant l'utilisateur vers le fournisseur.
//
// L'installation effective des packs achetés se fait via #46
// (`governance-marketplace.js#installCommunityPack` qui valide SHA-256 et
// `aiad-sdd gouvernance --pack-from <chemin>`).
//
// **4 verticaux livrés en catalogue** :
//   - eu-health (HDS, ISO 27799, MDR, IVDR)
//   - automotive (TISAX, UN R155, ISO 21434, ISO 26262)
//   - aerospace (DO-178C, DO-326A, ED-203A IA-aware, ARP-4754A)
//   - industrial (IEC 62443, NIS2, Machinery Regulation 2023/1230)
//
// Documentation : https://aiad.ovh/marketplace

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { C, log, logHeader } from './term.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CATALOGUE_PATH = join(__dirname, '..', 'templates', '.aiad', 'marketplace-catalogue.json');

// ─── Fonctions pures (testables) ────────────────────────────────────────────

/**
 * Charge le catalogue de packs verticaux depuis le JSON embarqué.
 *
 * @returns {{ packs: object[], version: number, updated: string }}
 */
export function chargerCatalogue() {
  if (!existsSync(CATALOGUE_PATH)) {
    return { packs: [], version: 0, updated: '' };
  }
  try {
    const data = JSON.parse(readFileSync(CATALOGUE_PATH, 'utf-8'));
    return {
      packs: Array.isArray(data.packs) ? data.packs : [],
      version: data._version || 0,
      updated: data._updated || '',
    };
  } catch {
    return { packs: [], version: 0, updated: '' };
  }
}

/**
 * Liste les packs disponibles, triés par secteur alphabétique.
 *
 * @param {object} [filters] — { secteur?, juridiction? }
 * @returns {object[]}
 */
export function listerPacksPremium(filters = {}) {
  const { packs } = chargerCatalogue();
  let out = packs;
  if (filters.secteur) {
    const s = filters.secteur.toLowerCase();
    out = out.filter((p) => (p.secteur || '').toLowerCase().includes(s));
  }
  if (filters.juridiction) {
    const j = filters.juridiction.toLowerCase();
    out = out.filter((p) => (p.juridiction || '').toLowerCase().includes(j));
  }
  return [...out].sort((a, b) => (a.secteur || '').localeCompare(b.secteur || ''));
}

/**
 * Cherche un pack par identifiant.
 */
export function trouverPack(id) {
  const { packs } = chargerCatalogue();
  return packs.find((p) => p.id === id) || null;
}

/**
 * Format humain d'un pack (Markdown).
 */
export function rendrePackMarkdown(pack) {
  const lignes = [];
  lignes.push(`## ${pack.title}`);
  lignes.push('');
  lignes.push(`**Secteur** : ${pack.secteur}  ·  **Juridiction** : ${pack.juridiction}`);
  lignes.push(`**ID** : \`${pack.id}\`  ·  **Modèle** : ${pack.modele}`);
  if (pack.prix_indicatif_eur) {
    lignes.push(`**Prix indicatif** : ${pack.prix_indicatif_eur}`);
  }
  lignes.push('');
  lignes.push(`**Cible** : ${pack.cible || '(non spécifié)'}`);
  lignes.push('');
  if (Array.isArray(pack.couverture) && pack.couverture.length > 0) {
    lignes.push('**Couverture réglementaire** :');
    for (const c of pack.couverture) lignes.push(`- ${c}`);
    lignes.push('');
  }
  if (Array.isArray(pack.agents_attendus) && pack.agents_attendus.length > 0) {
    lignes.push(`**Agents Tier 1 fournis** : ${pack.agents_attendus.map((a) => `\`${a}\``).join(', ')}`);
    lignes.push('');
  }
  if (pack.essai_gratuit && pack.essai_gratuit !== 'non') {
    lignes.push(`**Essai gratuit** : ${pack.essai_gratuit}`);
  }
  if (pack.fournisseur) {
    lignes.push('');
    lignes.push(`**Fournisseur** : ${pack.fournisseur.nom}`);
    if (pack.fournisseur.contact) lignes.push(`**Contact** : ${pack.fournisseur.contact}`);
    if (pack.fournisseur.url) lignes.push(`**URL** : ${pack.fournisseur.url}`);
  }
  if (pack.format_distribution) {
    lignes.push('');
    lignes.push(`**Format** : ${pack.format_distribution}`);
  }
  return lignes.join('\n');
}

// ─── CLI ────────────────────────────────────────────────────────────────────

/**
 * Affiche la liste des packs verticaux disponibles.
 */
export function afficherListe(filters = {}) {
  const packs = listerPacksPremium(filters);
  logHeader(
    'AIAD SDD — Marketplace verticaux premium',
    `${packs.length} pack(s) disponible(s)${filters.secteur || filters.juridiction ? ' (filtré)' : ''}`,
  );
  if (packs.length === 0) {
    console.log(`  ${C.jaune}~${C.reset} Aucun pack ne correspond aux filtres.`);
    return packs;
  }
  for (const p of packs) {
    console.log(`\n${C.cyan}${C.gras}  ${p.id}${C.reset}  ${p.secteur} — ${p.juridiction}`);
    console.log(`    ${p.title}`);
    console.log(`    ${C.gris}${p.cible || ''}${C.reset}`);
    if (p.prix_indicatif_eur) console.log(`    ${C.gris}Prix : ${p.prix_indicatif_eur}${C.reset}`);
    if (p.fournisseur && p.fournisseur.url) console.log(`    ${C.gris}→ ${p.fournisseur.url}${C.reset}`);
  }
  console.log(`
${C.gris}  Détails complets : aiad-sdd marketplace info <id>
  Installation après achat : aiad-sdd gouvernance --pack-from <chemin> (#46)
  Cap stratégique : contenus réglementaires non embarqués (licences restreintes).${C.reset}
`);
  return packs;
}

/**
 * Affiche les détails d'un pack précis.
 */
export function afficherInfo(id) {
  const pack = trouverPack(id);
  if (!pack) {
    const ids = listerPacksPremium().map((p) => p.id).join(', ');
    console.error(`\n  ${C.rouge}✗${C.reset} Pack inconnu : "${id}". Disponibles : ${ids}.\n`);
    return null;
  }
  logHeader('AIAD SDD — Marketplace', pack.title);
  console.log(rendrePackMarkdown(pack));
  console.log('');
  return pack;
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  chargerCatalogue as loadCatalogue,
  listerPacksPremium as listPremiumPacks,
  trouverPack as findPack,
  rendrePackMarkdown as renderPackMarkdown,
  afficherListe as showList,
  afficherInfo as showInfo,
};
