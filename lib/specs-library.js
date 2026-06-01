// AIAD SDD Mode — Bibliothèque de SPECs templates par domaine.
//
// `aiad-sdd template <domain> [--list]` génère une SPEC EARS pré-remplie
// avec frontmatter cohérent (gouvernance applicable, format EARS strict),
// critères d'acceptation R1-Rn, anti-patterns interdits, tests d'exemple
// et "Test de l'Étranger" à compléter.
//
// **Cap stratégique** : réduire le coût d'écriture d'une SPEC critique
// (auth, paiement, RAG, export RGPD) — ce sont les mêmes 80 % de
// considérations à chaque projet. Les templates capitalisent ce 80 %.
//
// **Domaines livrés (vague 1)** :
//   - auth-oidc        — OIDC Authorization Code + PKCE + state + nonce
//   - payment-pci      — paiement carte PCI-DSS SAQ A + PSD2 SCA + Dynamic Linking
//   - rag-llm          — Retrieval-Augmented Generation + AI Act + RGPD
//   - gdpr-data-export — Article 20 + Article 15 RGPD
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncFile } from './fs-ops.js';
import { C, log, logHeader } from './term.js';
import { parseFrontmatter } from './frontmatter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LIBRARY_DIR = join(__dirname, '..', 'templates', '.aiad', 'specs-library');

// ─── Catalogue ──────────────────────────────────────────────────────────────

/**
 * Charge le manifeste d'un domaine depuis le frontmatter du template.
 *
 * @param {string} domain
 * @returns {{ id: string, path: string, title: string, governance: string[], frontmatter: object } | null}
 */
function lireManifest(domain) {
  const path = join(LIBRARY_DIR, `${domain}.md`);
  if (!existsSync(path)) return null;
  try {
    const contenu = readFileSync(path, 'utf-8');
    const { data } = parseFrontmatter(contenu);
    return {
      id: domain,
      path,
      title: data.domain ? `Domaine ${data.domain}` : domain,
      governance: data.governance ? String(data.governance).split(',').map((s) => s.trim()).filter(Boolean) : [],
      frontmatter: data,
    };
  } catch { return null; }
}

/**
 * Liste les domaines disponibles (lecture du dossier templates/.aiad/specs-library/).
 */
export function listerTemplatesSpec() {
  if (!existsSync(LIBRARY_DIR)) return [];
  const out = [];
  for (const nom of readdirSync(LIBRARY_DIR)) {
    if (!nom.endsWith('.md') || !statSync(join(LIBRARY_DIR, nom)).isFile()) continue;
    const id = nom.replace(/\.md$/, '');
    const m = lireManifest(id);
    if (m) out.push(m);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function templateSpecExiste(domain) {
  return lireManifest(domain) !== null;
}

// ─── Création ───────────────────────────────────────────────────────────────

function pad3(n) { return String(n).padStart(3, '0'); }

/**
 * Calcule le prochain numéro SPEC libre dans le projet AIAD.
 */
function prochainNumeroSpec(racine) {
  const dir = join(racine, '.aiad', 'specs');
  if (!existsSync(dir)) return 1;
  const re = /^SPEC-(\d{3})/;
  let max = 0;
  for (const nom of readdirSync(dir)) {
    const m = nom.match(re);
    if (m) max = Math.max(max, Number.parseInt(m[1], 10));
  }
  return max + 1;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'sans-titre';
}

/**
 * Interpole les variables `{{var}}` dans le template.
 */
export function interpolerTemplate(contenu, vars) {
  return contenu.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{{${key}}}`;
  });
}

/**
 * Crée une SPEC à partir d'un template de domaine.
 *
 * @param {string} racine
 * @param {string} domain
 * @param {{ title?: string, parent_intent?: string, slug?: string, idp?: string, dryRun?: boolean, force?: boolean, out?: string }} [options]
 * @returns {Promise<{ specId: string, path: string, manifest: object }>}
 */
export async function creerSpecDepuisTemplate(racine, domain, options = {}) {
  const manifest = lireManifest(domain);
  if (!manifest) {
    const dispo = listerTemplatesSpec().map((m) => m.id).join(', ');
    throw new Error(`Domaine inconnu : "${domain}". Disponibles : ${dispo}`);
  }

  if (!existsSync(join(racine, '.aiad'))) {
    throw new Error(`.aiad/ introuvable. Lance \`aiad-sdd init\` d'abord.`);
  }

  const numero = prochainNumeroSpec(racine);
  const titre = options.title || `${domain} (à préciser)`;
  const slug = options.slug || slugify(titre);
  const parentIntent = options.parent_intent || 'INTENT-???';
  const specId = `SPEC-${pad3(numero)}-1-${slug}`;

  const tplBrut = readFileSync(manifest.path, 'utf-8');
  const contenu = interpolerTemplate(tplBrut, {
    spec_id: specId,
    title: titre,
    slug,
    parent_intent: parentIntent,
    idp: options.idp || 'IdP',
  });

  const dest = options.out
    ? join(racine, options.out)
    : join(racine, '.aiad', 'specs', `${specId}.md`);

  logHeader(
    `AIAD SDD — Template SPEC ${domain}`,
    manifest.governance.length ? `Gouvernance : ${manifest.governance.join(' · ')}` : '',
  );

  const result = syncFile(dest, contenu, { dryRun: options.dryRun });
  const sym = result === 'created' ? `${C.vert}+${C.reset}`
    : result === 'updated' ? `${C.cyan}↑${C.reset}`
    : `${C.jaune}~${C.reset}`;
  log(sym, `${dest.replace(racine + '/', '')}${options.dryRun ? ` ${C.gris}(dry-run)${C.reset}` : ''}`);

  console.log(`
${C.gras}  Prochaines étapes${C.reset}
    Édite ${C.cyan}${dest.replace(racine + '/', '')}${C.reset} : remplace les ${C.gris}*(à compléter)*${C.reset}
    Lie l'Intent parent (${C.cyan}${parentIntent}${C.reset}) si pas encore créé : ${C.cyan}/sdd intent${C.reset}
    Valide le squelette : ${C.cyan}/sdd gate${C.reset} (SQS ≥ 4/5)

${C.gris}  Test de l'Étranger : un développeur extérieur peut-il implémenter
  cette SPEC sans poser de question ? Liste les ambiguïtés à clarifier.${C.reset}
`);

  return { specId, path: dest, manifest };
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  listerTemplatesSpec as listSpecTemplates,
  templateSpecExiste as specTemplateExists,
  creerSpecDepuisTemplate as createSpecFromTemplate,
  interpolerTemplate as interpolateTemplate,
};
