// AIAD SDD Mode — Marketplace de packs gouvernance.
//
// Étend `governance-packs.js` (3 packs intégrés : eu/us/uk-baseline) vers un
// **registre communautaire** : un pack tiers est un dossier qui contient :
//
//   <pack>/
//   ├── aiad-pack.json    ← manifest (id, titre, description, juridiction, agents[])
//   ├── AIAD-FR-ASN.md    ← fichier d'agent Tier 1
//   ├── AIAD-DE-BSI.md
//   └── AIAD-XX-...md
//
// Format du manifest :
//
//   {
//     "id": "fr-asn",
//     "title": "Pack ANSSI / Référentiels FR",
//     "description": "Référentiel National de Cybersécurité (RGS), PASSI, …",
//     "jurisdiction": "France",
//     "version": "1.0.0",
//     "author": "Communauté AIAD-FR",
//     "agents": ["AIAD-FR-RGS.md", "AIAD-FR-PASSI.md"],
//     "checksum": "sha256-<hex>"   // optionnel mais recommandé
//   }
//
// **Validation cryptographique** : `checksum` = SHA-256 du manifest **sans
// le champ checksum** + concaténation des fichiers d'agents triés. Si le
// pack est livré avec un checksum, on le vérifie avant installation. Sans
// checksum, on installe en mode `--unsafe` uniquement (déconseillé).
//
// Source d'un pack tiers :
//   - dossier local : `aiad-sdd gouvernance --pack-from /path/to/pack`
//   - HTTPS via tarball : à venir (rester zero-dep en attendant)
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { C, log, logHeader } from './term.js';
import { copyFile, ensureDir } from './fs-ops.js';

// ─── Lecture / validation du pack tiers ─────────────────────────────────────

export function loadCommunityPack(packDir) {
  if (!existsSync(packDir)) {
    throw new Error(`Pack introuvable : ${packDir}`);
  }
  if (!statSync(packDir).isDirectory()) {
    throw new Error(`${packDir} n'est pas un dossier.`);
  }
  const manifestPath = join(packDir, 'aiad-pack.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest manquant : ${manifestPath}. Format attendu : aiad-pack.json.`);
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (err) {
    throw new Error(`Manifest invalide JSON : ${err.message}`);
  }
  for (const champ of ['id', 'title', 'description', 'jurisdiction', 'version', 'agents']) {
    if (manifest[champ] === undefined) {
      throw new Error(`Manifest incomplet : champ "${champ}" manquant.`);
    }
  }
  if (!Array.isArray(manifest.agents) || manifest.agents.length === 0) {
    throw new Error(`Manifest invalide : "agents" doit être un tableau non vide.`);
  }
  // Vérifie que chaque agent référencé existe et que le nom est un AIAD-*.md
  for (const a of manifest.agents) {
    if (typeof a !== 'string' || !/^AIAD-[A-Z0-9-]+\.md$/.test(a)) {
      throw new Error(`Agent invalide : "${a}". Attendu : AIAD-XXX.md.`);
    }
    const p = join(packDir, a);
    if (!existsSync(p)) {
      throw new Error(`Agent référencé absent : ${a}`);
    }
  }
  return { manifest, packDir };
}

/**
 * Calcule le checksum SHA-256 d'un pack à partir du manifest (sans le
 * champ `checksum`) et des contenus d'agents triés par nom.
 *
 * @param {{ manifest: object, packDir: string }} pack
 * @returns {string} sha256-<64 hex>
 */
export function computePackChecksum(pack) {
  const { manifest, packDir } = pack;
  const h = createHash('sha256');
  // Manifest sans le champ checksum
  const sans = { ...manifest };
  delete sans.checksum;
  h.update(JSON.stringify(sans, Object.keys(sans).sort()));
  // Agents triés alphabétiquement pour déterminisme
  const agentsTries = [...manifest.agents].sort();
  for (const a of agentsTries) {
    h.update('\n--' + a + '--\n');
    h.update(readFileSync(join(packDir, a)));
  }
  return 'sha256-' + h.digest('hex');
}

/**
 * Vérifie le checksum d'un pack si présent. Retourne :
 *   { ok: true, source: 'verified' } si le manifest a un checksum et qu'il match
 *   { ok: true, source: 'unsigned' } si pas de checksum (acceptable avec --unsafe)
 *   { ok: false, expected, actual } si le checksum diverge
 *
 * @returns {{ ok: boolean, source?: string, expected?: string, actual?: string }}
 */
export function verifyPackChecksum(pack) {
  const fourni = pack.manifest.checksum;
  if (!fourni) return { ok: true, source: 'unsigned' };
  const calcule = computePackChecksum(pack);
  if (calcule === fourni) return { ok: true, source: 'verified' };
  return { ok: false, expected: fourni, actual: calcule };
}

// ─── Installation ───────────────────────────────────────────────────────────

/**
 * Installe un pack communautaire dans `.aiad/gouvernance/`.
 *
 * @param {string} racine
 * @param {string} packDir — chemin local du pack
 * @param {{ force?: boolean, dryRun?: boolean, unsafe?: boolean, silent?: boolean }} [options]
 * @returns {Promise<{ pack: object, agents: string[], created: number, updated: number, preserved: number, source: string }>}
 */
export async function installCommunityPack(racine, packDir, options = {}) {
  const { force = false, dryRun = false, unsafe = false, silent = false } = options;
  const pack = loadCommunityPack(packDir);
  const verif = verifyPackChecksum(pack);

  if (!verif.ok) {
    throw new Error(
      `Checksum invalide pour le pack "${pack.manifest.id}".\n` +
      `  Attendu : ${verif.expected}\n` +
      `  Calculé : ${verif.actual}\n` +
      `  Le pack a été altéré ou le manifest contient un mauvais checksum. Refus d'installation.`,
    );
  }

  if (verif.source === 'unsigned' && !unsafe) {
    throw new Error(
      `Pack "${pack.manifest.id}" sans checksum. Refus par défaut.\n` +
      `  Pour forcer (déconseillé) : ajoute --unsafe à la commande.\n` +
      `  Pour signer : ajoute "checksum" calculé via \`computePackChecksum\` au manifest.`,
    );
  }

  if (!silent) {
    logHeader(
      `Marketplace — Pack ${pack.manifest.title}`,
      `${pack.manifest.description}\n  Juridiction : ${pack.manifest.jurisdiction}\n  Auteur : ${pack.manifest.author || 'inconnu'}\n  Version : ${pack.manifest.version}\n  Signature : ${verif.source === 'verified' ? `${C.vert}vérifiée (sha256)${C.reset}` : `${C.jaune}NON SIGNÉ — installation forcée${C.reset}`}`,
    );
  }

  const destDir = join(racine, '.aiad', 'gouvernance');
  ensureDir(destDir, { dryRun });

  const stats = { created: 0, updated: 0, preserved: 0, unchanged: 0 };
  const agents = [];

  for (const f of pack.manifest.agents) {
    const src = join(packDir, f);
    const dst = join(destDir, f);
    const result = copyFile(src, dst, { force, preserve: !force, dryRun });
    stats[result] = (stats[result] || 0) + 1;
    agents.push(f.replace(/\.md$/, ''));
    if (!silent) {
      const sym = result === 'created' ? `${C.vert}+${C.reset}`
        : result === 'updated' ? `${C.cyan}↑${C.reset}`
        : result === 'preserved' ? `${C.jaune}~${C.reset}`
        : `${C.vert}✓${C.reset}`;
      const suffixe = dryRun ? ` ${C.gris}(dry-run)${C.reset}` : '';
      log(sym, `${f}${suffixe} ${C.gris}(${result})${C.reset}`);
    }
  }

  if (!silent) {
    console.log(`
${C.gras}  Pack ${pack.manifest.id} installé${dryRun ? ' (aperçu)' : ''}${C.reset}
  ${C.vert}+${C.reset} ${stats.created}    ${C.cyan}↑${C.reset} ${stats.updated}    ${C.jaune}~${C.reset} ${stats.preserved} préservé(s)
`);
  }

  return { pack: pack.manifest.id, agents, ...stats, source: verif.source };
}
