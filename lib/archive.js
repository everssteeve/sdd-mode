// AIAD SDD Mode — Archivage des artefacts obsolètes (item #105).
//
// **Cap stratégique** : un projet long-terme accumule des Intents et
// SPECs qui deviennent obsolètes (refonte, renoncement, dépréciation).
// Les supprimer perd l'historique de raison ; les laisser visibles
// pollue la matrice de traçabilité et alourdit le contexte agent.
//
// **Solution** : un statut `archived` explicite, un sous-dossier
// `archive/` dédié, un audit trail complet.
//
// **Comportement** :
//   - `aiad-sdd archive <ID> [--reason "..."]` :
//     1. Déplace `.aiad/<sous>/ID.md` vers `.aiad/<sous>/archive/ID.md`.
//     2. Patche le frontmatter : `status: archived`, `archivedAt`,
//        `archivedBy` (depuis git config), `archivedReason`.
//     3. Append événement signé HMAC dans le log audit (item #89).
//     4. Émet le webhook `intent.deleted` ou `spec.deleted` (item #98).
//   - `aiad-sdd archive --list` liste les artefacts archivés.
//   - `aiad-sdd archive --restore <ID>` annule l'archivage.
//
// La matrice de traçabilité (`aiad-sdd trace`) ignore par défaut le
// dossier `archive/` — ils n'apparaissent ni en orpheline, ni en
// drift, ni dans le scoring.
//
// Documentation : https://aiad.ovh/archive

import {
  existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync, rmSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter.js';
import { appendEvenement, hashFichier } from './audit.js';
import { emettre as emitWebhook } from './webhooks.js';
import { C, logHeader } from './term.js';

const SOUS_DOSSIERS = ['intents', 'specs'];

// ─── Détection du type d'artefact ───────────────────────────────────────────

/**
 * Devine le sous-dossier (`intents` ou `specs`) à partir de l'ID.
 *
 * @param {string} id
 */
export const TYPES_ARTEFACTS = [
  { kind: 'intents', prefixes: ['INTENT-', 'INT-'], format: 'INT-NNN ou INTENT-NNN-slug' },
  { kind: 'specs', prefixes: ['SPEC-'], format: 'SPEC-NNN-N-slug' },
];

export function detecterSousDossier(id) {
  const up = String(id || '').toUpperCase();
  for (const t of TYPES_ARTEFACTS) {
    if (t.prefixes.some((p) => up.startsWith(p))) return t.kind;
  }
  throw new Error(`ID inconnu : "${id}". Attendu : INT-NNN, INTENT-NNN ou SPEC-NNN-N-slug.`);
}

/**
 * Localise le fichier d'un artefact (ouvert ou archivé).
 *
 * @param {string} racine
 * @param {string} id
 * @returns {{ id: string, sousDossier: string, fichier: string, ouvertPath: string|null, archivePath: string|null }}
 */
export function localiserArtefact(racine, id) {
  const sousDossier = detecterSousDossier(id);
  const dirOuvert = join(racine, '.aiad', sousDossier);
  const dirArchive = join(dirOuvert, 'archive');
  const idUp = id.toUpperCase();

  function chercher(dir) {
    if (!existsSync(dir)) return null;
    const liste = readdirSync(dir).filter((f) => f.endsWith('.md'));
    return liste.find((f) => f.toUpperCase().startsWith(idUp)) || null;
  }
  const fichierOuvert = chercher(dirOuvert);
  const fichierArchive = chercher(dirArchive);
  return {
    id: idUp,
    sousDossier,
    fichier: fichierOuvert || fichierArchive || null,
    ouvertPath: fichierOuvert ? join(dirOuvert, fichierOuvert) : null,
    archivePath: fichierArchive ? join(dirArchive, fichierArchive) : null,
  };
}

/**
 * Récupère l'identité git courante (best-effort).
 *
 * Base légale (RGPD Art. 6.1.f) : intérêt légitime — traçabilité des opérations d'archivage.
 * Données : git user.email (identité du PE ayant archivé l'artefact).
 * Conservation : durée de vie du fichier archivé (suppression manuelle via `archive restore`).
 * Périmètre : outil interne PE, non transmis à des tiers.
 */
function detecterActeur(racine) {
  try {
    const r = spawnSync('git', ['config', 'user.email'], { cwd: racine, encoding: 'utf-8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  } catch { /* ignore */ }
  return 'anonyme';
}

// ─── Frontmatter mutations ─────────────────────────────────────────────────

/**
 * Patch le frontmatter d'un artefact pour archivage.
 *
 * @param {object} frontmatter
 * @param {{ acteur?: string, raison?: string, ts?: string }} info
 */
export function patcherFrontmatterArchivage(frontmatter, info = {}) {
  const f = { ...(frontmatter || {}) };
  f.status = 'archived';
  f.archivedAt = info.ts || new Date().toISOString();
  if (info.acteur) f.archivedBy = info.acteur;
  if (info.raison) f.archivedReason = info.raison;
  return f;
}

/**
 * Patch le frontmatter pour restauration (inverse de l'archivage).
 */
export function patcherFrontmatterRestauration(frontmatter) {
  const f = { ...(frontmatter || {}) };
  delete f.status;
  delete f.archivedAt;
  delete f.archivedBy;
  delete f.archivedReason;
  return f;
}

// ─── Pipeline archive ─────────────────────────────────────────────────────

/**
 * Archive un artefact.
 *
 * @param {string} racine
 * @param {string} id
 * @param {{ raison?: string, dryRun?: boolean, json?: boolean, audit?: boolean, webhook?: boolean, fetch?: Function }} [options]
 */
export async function archiver(racine, id, options = {}) {
  const loc = localiserArtefact(racine, id);
  if (!loc.fichier) throw new Error(`Artefact ${id} introuvable dans .aiad/${loc.sousDossier}/.`);
  if (loc.archivePath && !loc.ouvertPath) {
    throw new Error(`Artefact ${id} est déjà archivé.`);
  }

  const acteur = detecterActeur(racine);
  const ts = new Date().toISOString();
  const contenu = readFileSync(loc.ouvertPath, 'utf-8');
  const { data, body } = parseFrontmatter(contenu);
  const fmPatched = patcherFrontmatterArchivage(data, {
    acteur, raison: options.raison, ts,
  });
  const nouveau = stringifyFrontmatter(fmPatched) + body;

  const dirArchive = join(racine, '.aiad', loc.sousDossier, 'archive');
  const archivePath = join(dirArchive, loc.fichier);

  if (options.dryRun) {
    if (options.json) {
      process.stdout.write(JSON.stringify({
        id: loc.id, dryRun: true, archivePath: archivePath.replace(racine + '/', ''),
      }, null, 2) + '\n');
    } else {
      console.log(`\n  (dry-run) Archiverait ${C.cyan}${loc.fichier}${C.reset} → ${C.cyan}.aiad/${loc.sousDossier}/archive/${loc.fichier}${C.reset}.\n`);
    }
    return { archived: false, dryRun: true, id: loc.id, archivePath };
  }

  // 1. Réécrit le frontmatter sur le fichier ouvert
  writeFileSync(loc.ouvertPath, nouveau, 'utf-8');
  // 2. Crée le dossier archive si besoin
  if (!existsSync(dirArchive)) mkdirSync(dirArchive, { recursive: true });
  // 3. Déplace
  renameSync(loc.ouvertPath, archivePath);

  // 4. Audit trail (best-effort, ne casse jamais l'archivage)
  if (options.audit !== false) {
    try {
      appendEvenement(racine, {
        action: 'archived',
        artifact: `.aiad/${loc.sousDossier}/archive/${loc.fichier}`,
        actor: acteur,
        hashAvant: hashFichier(racine, `.aiad/${loc.sousDossier}/${loc.fichier}`),
        hashApres: hashFichier(racine, `.aiad/${loc.sousDossier}/archive/${loc.fichier}`),
      });
    } catch { /* ignore */ }
  }

  // 5. Webhook (best-effort)
  if (options.webhook !== false) {
    try {
      const eventType = loc.sousDossier === 'intents' ? 'intent.deleted' : 'spec.deleted';
      await emitWebhook(racine, {
        type: eventType,
        source: 'aiad-sdd archive',
        data: { id: loc.id, raison: options.raison || null, archivedBy: acteur },
      }, { fetchFn: options.fetch });
    } catch { /* ignore */ }
  }

  if (options.json) {
    process.stdout.write(JSON.stringify({
      id: loc.id, archived: true,
      archivePath: archivePath.replace(racine + '/', ''),
      archivedBy: acteur,
      archivedAt: ts,
    }, null, 2) + '\n');
  } else if (!options.silent) {
    logHeader(`AIAD SDD — Archive ${loc.id}`, `Déplacé vers .aiad/${loc.sousDossier}/archive/${loc.fichier}`);
    console.log(`  ${C.vert}✓${C.reset} archivedBy : ${acteur}`);
    if (options.raison) console.log(`  ${C.gris}Raison : ${options.raison}${C.reset}`);
    console.log('');
  }
  return { archived: true, id: loc.id, archivePath, archivedBy: acteur, archivedAt: ts };
}

// ─── Restauration ─────────────────────────────────────────────────────────

/**
 * Annule l'archivage d'un artefact.
 */
export async function restaurer(racine, id, options = {}) {
  const loc = localiserArtefact(racine, id);
  if (!loc.archivePath) throw new Error(`Artefact ${id} non archivé.`);
  if (loc.ouvertPath) throw new Error(`Artefact ${id} existe déjà ouvert (collision).`);

  const dirOuvert = join(racine, '.aiad', loc.sousDossier);
  const ouvertPath = join(dirOuvert, loc.fichier);

  if (options.dryRun) {
    if (options.json) {
      process.stdout.write(JSON.stringify({ id: loc.id, dryRun: true }, null, 2) + '\n');
    } else {
      console.log(`\n  (dry-run) Restaurerait ${loc.fichier} dans .aiad/${loc.sousDossier}/.\n`);
    }
    return { restored: false, dryRun: true, id: loc.id };
  }

  const contenu = readFileSync(loc.archivePath, 'utf-8');
  const { data, body } = parseFrontmatter(contenu);
  const fmRestaure = patcherFrontmatterRestauration(data);
  const nouveau = stringifyFrontmatter(fmRestaure) + body;
  writeFileSync(loc.archivePath, nouveau, 'utf-8');
  renameSync(loc.archivePath, ouvertPath);

  // Nettoyer le dossier archive s'il est vide
  try {
    const dirArchive = dirname(loc.archivePath);
    if (existsSync(dirArchive) && readdirSync(dirArchive).length === 0) {
      rmSync(dirArchive, { recursive: true });
    }
  } catch { /* ignore */ }

  if (options.json) {
    process.stdout.write(JSON.stringify({ id: loc.id, restored: true }, null, 2) + '\n');
  } else {
    console.log(`\n  ${C.vert}✓${C.reset} ${loc.id} restauré dans ${C.cyan}.aiad/${loc.sousDossier}/${loc.fichier}${C.reset}.\n`);
  }
  return { restored: true, id: loc.id };
}

// ─── Listing ──────────────────────────────────────────────────────────────

/**
 * Liste tous les artefacts archivés.
 *
 * @returns {{ id: string, sousDossier: string, fichier: string, archivedAt?: string, archivedBy?: string, archivedReason?: string }[]}
 */
export function listerArchives(racine) {
  const out = [];
  for (const sousDossier of SOUS_DOSSIERS) {
    const dir = join(racine, '.aiad', sousDossier, 'archive');
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const contenu = readFileSync(join(dir, f), 'utf-8');
      const { data } = parseFrontmatter(contenu);
      out.push({
        id: f.replace(/\.md$/, '').toUpperCase().split('-').slice(0, 2).join('-'),
        sousDossier,
        fichier: f,
        archivedAt: data.archivedAt || null,
        archivedBy: data.archivedBy || null,
        archivedReason: data.archivedReason || null,
      });
    }
  }
  return out;
}

/**
 * CLI : affiche la liste des archives.
 */
export function afficherListe(racine, options = {}) {
  const liste = listerArchives(racine);
  if (options.json) {
    process.stdout.write(JSON.stringify({ total: liste.length, archives: liste }, null, 2) + '\n');
    return liste;
  }
  logHeader('AIAD SDD — Archives', `${liste.length} artefact(s) archivé(s)`);
  if (liste.length === 0) {
    console.log(`  ${C.gris}~ Aucune archive.${C.reset}\n`);
    return liste;
  }
  for (const a of liste) {
    console.log(`  ${C.cyan}${a.fichier}${C.reset}  ${C.gris}[${a.sousDossier}]${C.reset}`);
    if (a.archivedBy) console.log(`    par ${a.archivedBy}${a.archivedAt ? ` @ ${a.archivedAt.slice(0, 19).replace('T', ' ')}` : ''}`);
    if (a.archivedReason) console.log(`    ${C.gris}${a.archivedReason}${C.reset}`);
  }
  console.log('');
  return liste;
}

// ─── Cycle anti dock rot : artefacts livrés/clos (§3.8 SPEC-B) ──────────────

// Sous-dossiers balayés pour la détection des livrables (intents/specs gérés
// par l'archivage ; research listé mais archivé à la main car hors TYPES_ARTEFACTS).
const SOUS_DOSSIERS_LIVRABLES = ['intents', 'specs', 'research'];

// Statuts considérés comme « clos et livré » → candidats à la sortie du
// contexte chaud (anti dock rot, cf. §2.4). On reste conservateur : `done`
// uniquement (un artefact `active`/`in-progress` reste chaud).
const STATUTS_LIVRES = new Set(['done', 'delivered', 'livre', 'livré', 'closed', 'clos']);

// Statuts considérés comme terminés pour les sous-SPECs d'un parent `split`.
const STATUTS_TERMINES = new Set([...STATUTS_LIVRES, 'archived']);

/**
 * Liste les sous-SPECs d'une SPEC parente `split`.
 * Cherche dans specsDir (racine) et specsDir/archive les fichiers dont le nom
 * commence par parentShortId suivi d'une lettre (ex. SPEC-013-1a, SPEC-013-1b).
 *
 * @spec SPEC-026-2-archive-done-split-orphelins
 * @param {string} parentShortId  ex. "SPEC-013-1"
 * @param {string} specsDir       chemin vers .aiad/specs/
 * @returns {{ fichier: string, status: string }[]}
 */
function listerSousSpecs(parentShortId, specsDir) {
  const re = new RegExp(`^${parentShortId}[a-z]`, 'i');
  const sous = [];
  for (const loc of [specsDir, join(specsDir, 'archive')]) {
    if (!existsSync(loc)) continue;
    for (const f of readdirSync(loc)) {
      if (!f.endsWith('.md') || f.startsWith('_')) continue;
      if (!re.test(f)) continue;
      const { data } = parseFrontmatter(readFileSync(join(loc, f), 'utf-8'));
      sous.push({ fichier: f, status: String(data.status || '').toLowerCase() });
    }
  }
  return sous;
}

/**
 * Liste les artefacts livrés et clos (status `done`) candidats à l'archivage
 * hors contexte chaud, ainsi que les SPECs parentes `split` dont toutes les
 * sous-SPECs sont terminées. Ne déplace rien — *propose* (l'archivage reste
 * une action explicite).
 *
 * @spec SPEC-026-1-archive-done
 * @spec SPEC-026-2-archive-done-split-orphelins
 * @intent INTENT-026
 * @param {string} racine
 * @returns {{ id: string, kind: string, fichier: string, status: string, title: string, safe: boolean, raison: string }[]}
 */
export function listerLivrables(racine) {
  const out = [];
  for (const sousDossier of SOUS_DOSSIERS_LIVRABLES) {
    const dir = join(racine, '.aiad', sousDossier);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md') || f.startsWith('_')) continue;
      const contenuSpec = readFileSync(join(dir, f), 'utf-8');
      const { data, body } = parseFrontmatter(contenuSpec);
      let status = String(data.status || '').toLowerCase();
      // Fallback: specs written without YAML frontmatter use **Statut** : done in body
      if (!status && body) {
        const m = body.match(/^\*\*Statut\*\*\s*:\s*(\S+)/m);
        if (m) status = m[1].toLowerCase().replace(/[^a-zéàêîèùâûôë]/g, '');
      }

      let eligible = STATUTS_LIVRES.has(status);
      let raisonCustom = null;

      // SPECs parentes `split` : éligibles si toutes leurs sous-SPECs sont terminées.
      if (!eligible && status === 'split' && sousDossier === 'specs') {
        const parentShortId = (data.id ? String(data.id) : null)
          ?? (f.match(/^(SPEC-\d+-\d+)/i)?.[1] ?? null);
        if (parentShortId) {
          const sous = listerSousSpecs(parentShortId, dir);
          if (sous.length > 0 && sous.every((s) => STATUTS_TERMINES.has(s.status))) {
            eligible = true;
            raisonCustom = 'Toutes sous-SPECs livrées — archivable.';
          }
        }
      }

      if (!eligible) continue;

      const id = f.replace(/\.md$/, '');
      // @spec annotations are permanent tracability markers; since construireMatrice()
      // includes archive/ in specsConnus (fix 78d3b9b), archiving a referenced spec
      // no longer produces orphan gaps — the reference check is no longer needed.
      const archivable = sousDossier !== 'research'; // research hors TYPES_ARTEFACTS
      out.push({
        id,
        kind: sousDossier,
        fichier: f,
        status,
        title: data.title || data.titre || id,
        safe: archivable,
        raison: raisonCustom ?? (archivable
          ? 'Livré et clos — archivable.'
          : 'Artefact research : archiver à la main (hors périmètre archive).'),
      });
    }
  }
  return out;
}

/**
 * Détecte les fichiers artefacts (intents / specs) présents à la racine du
 * sous-dossier mais dont le frontmatter indique `status: archived`. Ces
 * fichiers ont été copiés en archive/ sans suppression de l'original.
 * Retourne une liste informative — aucun déplacement n'est effectué.
 *
 * @spec SPEC-026-2-archive-done-split-orphelins
 * @intent INTENT-026
 * @param {string} racine
 * @returns {{ id: string, kind: string, fichier: string, titre: string, raison: string }[]}
 */
export function listerOrphelins(racine) {
  const out = [];
  for (const sousDossier of ['intents', 'specs']) {
    const dir = join(racine, '.aiad', sousDossier);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md') || f.startsWith('_')) continue;
      const { data } = parseFrontmatter(readFileSync(join(dir, f), 'utf-8'));
      if (String(data.status || '').toLowerCase() !== 'archived') continue;
      out.push({
        id: f.replace(/\.md$/, ''),
        kind: sousDossier,
        fichier: f,
        titre: data.title || data.titre || f.replace(/\.md$/, ''),
        raison: "Statut archived dans le frontmatter mais fichier hors archive/ — supprimer manuellement ou via `git rm`.",
      });
    }
  }
  return out;
}

/**
 * Archive tous les artefacts éligibles (safe: true, status: done).
 *
 * @spec SPEC-026-1-archive-done
 * @intent INTENT-026
 * @param {string} racine
 * @param {{ raison?: string, dryRun?: boolean }} [options]
 * @returns {{ total: number, archived: number, skipped: number, items: object[] }}
 */
export async function archiverTous(racine, options = {}) {
  const { raison = 'archive done', dryRun = true } = options;
  const candidats = listerLivrables(racine).filter((a) => a.safe);
  let archived = 0;
  const items = [];
  for (const a of candidats) {
    const r = await archiver(racine, a.id, { raison, dryRun, silent: true });
    items.push({ ...r, id: a.id, title: a.title, kind: a.kind, fichier: a.fichier });
    if (r.archived) archived++;
  }
  return { total: candidats.length, archived, skipped: 0, items };
}


// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  listerLivrables as listDelivered,
  listerOrphelins as listOrphans,
  detecterSousDossier as detectKind,
  localiserArtefact as locateArtifact,
  patcherFrontmatterArchivage as patchArchiveFrontmatter,
  patcherFrontmatterRestauration as patchRestoreFrontmatter,
  archiver as archive,
  restaurer as restore,
  listerArchives as listArchives,
  afficherListe as showArchives,
};

export const CONSTANTS = {
  SOUS_DOSSIERS,
};
