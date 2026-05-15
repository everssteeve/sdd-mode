// AIAD SDD Mode — Squelette de migration v1 → v2 (#129).
//
// PRÉPARATION : v2 n'est pas encore défini. Ce module pose les fondations
// d'un mécanisme de migration générique qui sera étoffé quand un breaking
// change AIAD majeur arrivera (ex : refonte des frontmatters, restructuration
// de `.aiad/`, changement de format SPEC).
//
// Différences avec `lib/migrate.js` :
//   - `migrate.js` : migrations *mineures* entre versions courantes
//     (v1.6→v1.10→v1.14), idempotentes, structurelles. Toujours appelables.
//   - `migrate-v2.js` : migration *majeure* avec breaking changes
//     (v1.x→v2.x), appelée une fois quand on bascule de major version.
//     Doit produire un plan détaillé avant d'appliquer (dry-run par défaut).
//
// Architecture :
//   1. `detecter(racine)` lit `.aiad/` et retourne la version détectée +
//      les marqueurs trouvés (frontmatter, structure).
//   2. `lister(versionSource, versionCible)` renvoie le tableau de
//      transforms à appliquer pour passer de A à B. Chaque transform est
//      un objet `{id, titre, decrit, applique}` pur.
//   3. `migrate(racine, opts)` orchestre : détection → plan → application
//      (si `--apply`) → rapport.
//
// Mode par défaut : DRY-RUN. Aucun fichier touché tant que `--apply` n'est
// pas passé. Cette politique est volontaire pour préserver les artefacts
// d'intention (Human Authorship) en cas de bug dans une transform.

import { existsSync, readdirSync, readFileSync, writeFileSync, statSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const KEEP_BACKUPS_DEFAUT = 5;

// Marqueurs structurels par version. Ce tableau est étoffé à chaque release
// majeure pour permettre la détection précise du point de départ.
const MARQUEURS_VERSION = [
  { version: 'v1.6+',  test: (r) => existsSync(join(r, '.aiad', 'facts')) },
  { version: 'v1.10+', test: (r) => existsSync(join(r, '.aiad', 'metrics', 'traceability')) },
  { version: 'v1.14+', test: (r) => existsSync(join(r, '.aiad', 'metrics', 'standup')) },
];

// Registre extensible des transforms v1 → v2. Vide tant que v2 n'est pas
// défini. Chaque transform DOIT être :
//   - id        : slug court, stable (ex: 'frontmatter-status-rename')
//   - titre     : libellé humain
//   - decrit    : retourne le diff sous forme `{fichier, avant, apres}[]`
//                 (mode dry-run — ne touche rien)
//   - applique  : applique réellement le diff (mode --apply)
//
// Convention : les transforms sont *idempotentes*. Relancer ne casse rien.
export const TRANSFORMS_V2 = [];

// ─── Transforms candidates (#206) ────────────────────────────────────────────
//
// Définies pour être testées et auditables avant d'être enregistrées dans
// `TRANSFORMS_V2`. À l'activation v2, le mainteneur push manuellement.
// Politique Human Authorship : c'est l'humain qui décide quand pousser.

/**
 * Rewrite `^intent:` → `^parent_intent:` dans le frontmatter d'une SPEC.
 * Tolère les variantes de casse et les espaces, mais N'AFFECTE QUE le
 * frontmatter (entre les deux `---`). Idempotent : skip si un
 * `parent_intent:` existe déjà.
 *
 * @param {string} contenu fichier markdown complet
 * @returns {{contenu: string, change: boolean, ligne: number}}
 */
export function rewriteIntentToParentIntent(contenu) {
  // Accepte frontmatter terminé par `\n---\n` OU `\n---` en fin de fichier.
  const m = contenu.match(/^(---\s*\n)([\s\S]*?)(\n---\s*(?:\n|$))/);
  if (!m) return { contenu, change: false, ligne: -1 };
  const lignes = m[2].split('\n');
  // Idempotence stricte : si déjà parent_intent: présent, ne touche pas.
  if (lignes.some((l) => /^\s*parent_intent:/i.test(l))) {
    return { contenu, change: false, ligne: -1 };
  }
  let change = false;
  let ligne = -1;
  for (let i = 0; i < lignes.length; i++) {
    const kv = lignes[i].match(/^(\s*)intent:(\s.+)$/i);
    if (!kv) continue;
    lignes[i] = `${kv[1]}parent_intent:${kv[2]}`;
    change = true;
    ligne = i + 2; // ligne dans le fichier (offset --- + base 1)
    break;
  }
  if (!change) return { contenu, change: false, ligne: -1 };
  const nouveau = m[1] + lignes.join('\n') + m[3] + contenu.slice(m[0].length);
  return { contenu: nouveau, change: true, ligne };
}

// Détecte les SPECs utilisant les conventions legacy `intent:` / `parent:`
// dans `.aiad/specs/`. Utile pour : (a) le dashboard pour signaler le drift,
// (b) la transform v2 pour produire un plan, (c) un futur warning CLI.
export function detecterConventionLegacy(racine) {
  const dir = join(racine, '.aiad', 'specs');
  if (!existsSync(dir)) return { total: 0, entrees: [] };
  let entries;
  try { entries = readdirSync(dir); } catch { return { total: 0, entrees: [] }; }
  const out = [];
  for (const nom of entries) {
    if (!nom.endsWith('.md') || nom.startsWith('_')) continue;
    const p = join(dir, nom);
    let contenu;
    try { contenu = readFileSync(p, 'utf-8'); } catch { continue; }
    const fmMatch = contenu.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
    if (!fmMatch) continue;
    const fm = fmMatch[1];
    if (/^\s*parent_intent:/im.test(fm)) continue; // déjà canonique
    if (/^\s*intent:\s/im.test(fm)) {
      out.push({ file: `.aiad/specs/${nom}`, convention: 'intent', canonique: 'parent_intent' });
    } else if (/^\s*parent:\s/im.test(fm)) {
      out.push({ file: `.aiad/specs/${nom}`, convention: 'parent', canonique: 'parent_intent' });
    }
  }
  return { total: out.length, entrees: out };
}

// Builder de la transform "intent-to-parent-intent" — prêt à pousser dans
// TRANSFORMS_V2 quand v2 sera déclenchée. Non auto-registrée volontairement.
export const TRANSFORM_INTENT_TO_PARENT_INTENT = {
  id: 'frontmatter-intent-rename',
  titre: 'Renommer `intent:` legacy → `parent_intent:` dans les SPECs (#206)',
  decrit(racine) {
    const legacy = detecterConventionLegacy(racine);
    return legacy.entrees
      .filter((e) => e.convention === 'intent')
      .map((e) => ({ fichier: e.file, avant: 'intent:', apres: 'parent_intent:' }));
  },
  applique(racine) {
    const legacy = detecterConventionLegacy(racine);
    for (const e of legacy.entrees) {
      if (e.convention !== 'intent') continue;
      const p = join(racine, e.file);
      let contenu;
      try { contenu = readFileSync(p, 'utf-8'); } catch { continue; }
      const result = rewriteIntentToParentIntent(contenu);
      if (result.change) {
        try { writeFileSync(p, result.contenu, 'utf-8'); } catch { /* skip */ }
      }
    }
  },
};

export function detecter(racine) {
  const aiadDir = join(racine, '.aiad');
  if (!existsSync(aiadDir)) {
    return { exists: false, version: null, marqueurs: [], fichiers: 0 };
  }
  const marqueurs = [];
  for (const m of MARQUEURS_VERSION) {
    if (m.test(racine)) marqueurs.push(m.version);
  }
  // Best-guess : la version la plus avancée détectée.
  const version = marqueurs.length > 0 ? marqueurs[marqueurs.length - 1] : 'v1.x';
  // Compte rapide des fichiers d'artefact pour donner un ordre de grandeur.
  let fichiers = 0;
  for (const sub of ['intents', 'specs', 'gouvernance']) {
    const dir = join(aiadDir, sub);
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const e of entries) if (e.isFile() && e.name.endsWith('.md')) fichiers += 1;
    } catch { /* ignore */ }
  }
  return { exists: true, version, marqueurs, fichiers };
}

export function lister(versionSource = 'v1.x', versionCible = 'v2.0') {
  // Tant que v2 n'est pas défini, le plan est vide. Cette fonction reste
  // une fonction pure ; à v2.0 elle filtrera TRANSFORMS_V2 selon les
  // versions de départ/arrivée.
  void versionSource; void versionCible;
  return TRANSFORMS_V2.slice();
}

// ─── Backup / Rollback (#195) ────────────────────────────────────────────────
//
// Snapshot directory-based (zero-dep, pas de tar.gz) :
//   .aiad/migrations/v2-backup-<ISO-timestamp>/  ← copie récursive de .aiad/
//
// Stratégie volontaire : un dossier-snapshot reste lisible et restorable
// sans outil externe. Le coût en disque est compensé par le pruning
// automatique (`keep` derniers).

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function copierRecursif(srcDir, dstDir, exclude = []) {
  ensureDir(dstDir);
  let entries;
  try { entries = readdirSync(srcDir, { withFileTypes: true }); }
  catch { return 0; }
  let n = 0;
  for (const e of entries) {
    if (exclude.includes(e.name)) continue;
    const src = join(srcDir, e.name);
    const dst = join(dstDir, e.name);
    if (e.isDirectory()) {
      n += copierRecursif(src, dst, exclude);
    } else if (e.isFile()) {
      try { copyFileSync(src, dst); n += 1; } catch { /* skip */ }
    }
  }
  return n;
}

function horodatageISO(d = new Date()) {
  // 2026-05-13T17-05-13-000Z (sûr pour les noms de fichiers)
  return d.toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, 'Z');
}

export function creerBackup(racine, opts = {}) {
  const source = join(racine, '.aiad');
  if (!existsSync(source)) {
    return { ok: false, raison: 'aiad-absent', dir: null, files: 0 };
  }
  const ts = opts.timestamp || horodatageISO();
  const dir = join(racine, '.aiad', 'migrations', `v2-backup-${ts}`);
  // Exclure le dossier `migrations` pour éviter une copie récursive infinie
  // (on snapshot `.aiad/` mais on est *dans* `.aiad/migrations/`).
  const files = copierRecursif(source, dir, ['migrations']);
  return { ok: true, dir, files, timestamp: ts };
}

export function listerBackups(racine) {
  const dir = join(racine, '.aiad', 'migrations');
  if (!existsSync(dir)) return [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return []; }
  return entries
    .filter((e) => e.isDirectory() && e.name.startsWith('v2-backup-'))
    .map((e) => ({
      name: e.name,
      timestamp: e.name.slice('v2-backup-'.length),
      dir: join(dir, e.name),
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function prunerBackups(racine, opts = {}) {
  const keep = Number.isFinite(opts.keep) ? opts.keep : KEEP_BACKUPS_DEFAUT;
  const dryRun = Boolean(opts.dryRun);
  const backups = listerBackups(racine);
  if (backups.length <= keep) return { pruned: [], kept: backups.length };
  const aPruner = backups.slice(0, backups.length - keep); // les plus vieux
  for (const b of aPruner) {
    if (!dryRun) {
      try { rmSync(b.dir, { recursive: true, force: true }); }
      catch { /* skip */ }
    }
  }
  return { pruned: aPruner.map((b) => b.name), kept: keep };
}

export function restoreBackup(racine, backup) {
  if (!backup || !backup.dir || !existsSync(backup.dir)) {
    return { ok: false, raison: 'backup-introuvable' };
  }
  const cible = join(racine, '.aiad');
  // Wipe `.aiad/` sauf `migrations/` (qui contient nos backups).
  let entries;
  try { entries = readdirSync(cible, { withFileTypes: true }); }
  catch { return { ok: false, raison: 'aiad-illisible' }; }
  for (const e of entries) {
    if (e.name === 'migrations') continue;
    const p = join(cible, e.name);
    try { rmSync(p, { recursive: true, force: true }); }
    catch { /* skip */ }
  }
  // Restore depuis le backup.
  const files = copierRecursif(backup.dir, cible);
  return { ok: true, files };
}

export async function migrate(racine, opts = {}) {
  const detection = detecter(racine);
  if (!detection.exists) {
    return {
      ok: false,
      raison: 'aiad-absent',
      message: 'Pas de dossier .aiad/ — initialisez le projet avec `aiad-sdd init`.',
      detection,
      plan: [],
      appliquees: [],
      erreurs: [],
    };
  }
  const transforms = lister(detection.version, opts.cible || 'v2.0');
  const dryRun = !opts.apply;
  const plan = transforms.map((t) => ({
    id: t.id,
    titre: t.titre,
    diff: typeof t.decrit === 'function' ? safeDecrit(t, racine) : [],
  }));

  if (dryRun) {
    return {
      ok: true,
      mode: 'dry-run',
      message: transforms.length === 0
        ? 'Aucune migration disponible : v2 n\'est pas encore définie. Ce squelette est prêt à recevoir les transforms quand un breaking change AIAD arrivera.'
        : `${transforms.length} migration(s) prévue(s). Relance avec --apply pour les exécuter.`,
      detection,
      plan,
      appliquees: [],
      erreurs: [],
    };
  }

  // (#195) Backup pré-apply systématique avant la 1ère transform — assure
  // qu'on peut toujours revenir en arrière. Skip si pas de transforms ou
  // si opts.skipBackup explicite (utile pour tests qui ne veulent pas
  // toucher au FS).
  let backup = null;
  if (transforms.length > 0 && opts.skipBackup !== true) {
    backup = creerBackup(racine, { timestamp: opts.timestamp });
  }

  const appliquees = [];
  const erreurs = [];
  for (const t of transforms) {
    try {
      if (typeof t.applique !== 'function') {
        erreurs.push({ id: t.id, raison: 'applique-absent' });
        continue;
      }
      const before = Date.now();
      await t.applique(racine, plan.find((p) => p.id === t.id)?.diff || []);
      appliquees.push({ id: t.id, dureeMs: Date.now() - before });
    } catch (e) {
      erreurs.push({ id: t.id, raison: 'erreur', message: e.message });
    }
  }

  // (#195) Rollback transactionnel si demandé et au moins 1 erreur.
  let rollback = null;
  if (erreurs.length > 0 && opts.rollbackOnError && backup?.ok) {
    rollback = restoreBackup(racine, backup);
  }

  // (#195) Pruning des vieux backups (sauf si on vient de rollback,
  // pour ne pas effacer ce qu'on vient de recréer).
  let prune = null;
  if (backup?.ok && !rollback) {
    prune = prunerBackups(racine, { keep: Number.isFinite(opts.keepBackups) ? opts.keepBackups : KEEP_BACKUPS_DEFAUT });
  }

  return {
    ok: erreurs.length === 0,
    mode: 'apply',
    message: erreurs.length === 0
      ? `${appliquees.length} migration(s) appliquée(s).`
      : rollback?.ok
      ? `${appliquees.length} appliquée(s), ${erreurs.length} erreur(s) — rollback effectué (${rollback.files} fichier(s) restauré(s)).`
      : `${appliquees.length} appliquée(s), ${erreurs.length} erreur(s).`,
    detection,
    plan,
    appliquees,
    erreurs,
    backup,
    rollback,
    prune,
  };
}

function safeDecrit(transform, racine) {
  try { return transform.decrit(racine) || []; } catch { return []; }
}

void readFileSync; void statSync; // réservés pour usage par les transforms

// Alias EN canoniques.
export {
  detecter as detect,
  lister as list,
  migrate as migrateV2,
  creerBackup as createBackup,
  listerBackups as listBackups,
  prunerBackups as pruneBackups,
  restoreBackup as restoreBackupEN,
  detecterConventionLegacy as detectLegacyConvention,
  rewriteIntentToParentIntent as rewriteIntentToParentIntentEN,
};
