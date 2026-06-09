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
  } else {
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

/**
 * Liste les artefacts livrés et clos (status `done`) candidats à l'archivage
 * hors contexte chaud. Ne déplace rien — *propose* (l'archivage reste une
 * action explicite). Les SPECs encore référencées par du code vivant sont
 * marquées `safe: false` (les archiver creuserait un gap de traçabilité).
 *
 * @param {string} racine
 * @returns {{ id: string, kind: string, fichier: string, status: string, title: string, safe: boolean, raison: string }[]}
 */
export function listerLivrables(racine) {
  // Index léger des @spec encore présents dans le code (pour le flag `safe`).
  const specsVivantes = scannerSpecsVivantes(racine);
  const out = [];
  for (const sousDossier of SOUS_DOSSIERS_LIVRABLES) {
    const dir = join(racine, '.aiad', sousDossier);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md') || f.startsWith('_')) continue;
      const { data } = parseFrontmatter(readFileSync(join(dir, f), 'utf-8'));
      const status = String(data.status || '').toLowerCase();
      if (!STATUTS_LIVRES.has(status)) continue;
      const id = f.replace(/\.md$/, '');
      const reference = sousDossier === 'specs' && specsVivantes.has(idCourt(id));
      const archivable = sousDossier !== 'research'; // research hors TYPES_ARTEFACTS
      out.push({
        id,
        kind: sousDossier,
        fichier: f,
        status,
        title: data.title || data.titre || id,
        safe: archivable && !reference,
        raison: reference
          ? 'SPEC encore référencée par du code vivant (@spec) — archiver creuserait un gap.'
          : !archivable
            ? 'Artefact research : archiver à la main (hors périmètre archive).'
            : 'Livré et clos — archivable hors contexte chaud.',
      });
    }
  }
  return out;
}

function idCourt(id) {
  // SPEC-006-1-canary → SPEC-006-1 (clé d'annotation @spec, sans slug).
  const m = String(id).toUpperCase().match(/^(SPEC-\d+-\d+)/);
  return m ? m[1] : String(id).toUpperCase();
}

function scannerSpecsVivantes(racine) {
  const vivantes = new Set();
  const libDir = join(racine, 'lib');
  const scan = (dir) => {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isDirectory()) { scan(p); continue; }
      if (!/\.(js|ts|py)$/.test(f.name)) continue;
      let contenu;
      try { contenu = readFileSync(p, 'utf-8'); } catch { continue; }
      for (const m of contenu.matchAll(/@spec\s+(SPEC-\d+-\d+)/g)) vivantes.add(m[1].toUpperCase());
    }
  };
  scan(libDir);
  return vivantes;
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  listerLivrables as listDelivered,
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
