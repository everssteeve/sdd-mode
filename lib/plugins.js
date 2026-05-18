// AIAD SDD Mode — Plugin system (item #119).
//
// **Cap stratégique** : permettre à la communauté d'étendre AIAD sans
// forker. Un **plugin** est un package npm ou un dossier local qui expose
// un manifeste `aiad-plugin.json` standardisé déclarant :
//
//   - **Commandes** custom (sous-commandes additionnelles)
//   - **Templates SPECs** custom (réutilisables via `aiad-sdd template`)
//   - **Hooks** beforeCommand / afterCommand (audit, métriques, gates org)
//
// **Manifest schema** (`aiad-plugin.json` à la racine du package) :
//   {
//     "aiadPluginVersion": 1,
//     "name": "@org/aiad-plugin-foo",
//     "version": "1.0.0",
//     "description": "...",
//     "commands":      [{ "name": "foo-cmd", "entry": "./cmd.js" }],
//     "specTemplates": [{ "domain": "foo-domain", "file": "./tpl.md" }],
//     "hooks":         { "beforeCommand": "./before.js", "afterCommand": "./after.js" }
//   }
//
// **Discovery** : 2 emplacements :
//   1. `node_modules/<package>/aiad-plugin.json` — plugins installés via npm
//   2. `.aiad/plugins/<id>/aiad-plugin.json` — plugins locaux (dev)
//
// **Sécurité** : un plugin peut exécuter du code arbitraire. AIAD documente
// le risque ; **l'utilisateur audite** le code avant d'installer.
// `AIAD_PLUGINS_DISABLED=1` désactive entièrement le système.
//
// **Zero-dep** : `fs/path` natifs, pas de `require.resolve` externe.
//
// Documentation : https://aiad.ovh/plugins

import { existsSync, readFileSync, readdirSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { C, logHeader } from './term.js';

const MANIFEST_FILENAME = 'aiad-plugin.json';
const LOCAL_PLUGINS_DIR = '.aiad/plugins';
const MANIFEST_VERSION = 1;

// ─── Discovery ─────────────────────────────────────────────────────────────

/**
 * Scanne node_modules à la recherche de plugins AIAD.
 * Un plugin = un package qui contient `aiad-plugin.json` à sa racine.
 *
 * Niveau 1 + niveau 2 (scoped packages comme @org/aiad-plugin-foo).
 */
export function decouvrirNodeModules(racine) {
  const out = [];
  const nm = join(racine, 'node_modules');
  if (!existsSync(nm)) return out;
  let entries = [];
  try { entries = readdirSync(nm); } catch { return out; }
  for (const e of entries) {
    if (e.startsWith('.')) continue;
    if (e.startsWith('@')) {
      // Scoped : itérer le sous-dossier
      let sub = [];
      try { sub = readdirSync(join(nm, e)); } catch { continue; }
      for (const s of sub) {
        const manifestPath = join(nm, e, s, MANIFEST_FILENAME);
        if (existsSync(manifestPath)) {
          out.push({ source: 'npm', path: join(nm, e, s), manifestPath });
        }
      }
    } else {
      const manifestPath = join(nm, e, MANIFEST_FILENAME);
      if (existsSync(manifestPath)) {
        out.push({ source: 'npm', path: join(nm, e), manifestPath });
      }
    }
  }
  return out;
}

/**
 * Scanne `.aiad/plugins/` pour les plugins locaux.
 */
export function decouvrirLocaux(racine) {
  const out = [];
  const dir = join(racine, LOCAL_PLUGINS_DIR);
  if (!existsSync(dir)) return out;
  let entries = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (e.startsWith('.')) continue;
    const manifestPath = join(dir, e, MANIFEST_FILENAME);
    if (existsSync(manifestPath)) {
      out.push({ source: 'local', path: join(dir, e), manifestPath });
    }
  }
  return out;
}

/**
 * Découverte agrégée + chargement des manifestes.
 *
 * @param {string} racine
 * @returns {{ name: string, version?: string, source: string, path: string, manifest: object }[]}
 */
export function decouvrirPlugins(racine) {
  if (process.env.AIAD_PLUGINS_DISABLED === '1') return [];
  const trouves = [
    ...decouvrirNodeModules(racine),
    ...decouvrirLocaux(racine),
  ];
  const out = [];
  for (const t of trouves) {
    try {
      const m = chargerManifest(t.manifestPath);
      out.push({
        name: m.name,
        version: m.version,
        source: t.source,
        path: t.path,
        manifest: m,
      });
    } catch { /* manifest invalide → ignoré */ }
  }
  return out;
}

// ─── Manifest ──────────────────────────────────────────────────────────────

/**
 * Charge un manifeste depuis le disque + valide la structure minimale.
 *
 * @param {string} manifestPath
 * @returns {object}
 */
export function chargerManifest(manifestPath) {
  const contenu = readFileSync(manifestPath, 'utf-8');
  let m;
  try { m = JSON.parse(contenu); }
  catch (err) { throw new Error(`Manifest JSON invalide : ${err.message}`); }
  validerManifest(m);
  return m;
}

/**
 * Valide la structure d'un manifeste plugin.
 */
export function validerManifest(m) {
  if (!m || typeof m !== 'object') throw new Error('Manifest doit être un objet.');
  if (m.aiadPluginVersion !== MANIFEST_VERSION) {
    throw new Error(`aiadPluginVersion ${m.aiadPluginVersion} non supportée (attendu ${MANIFEST_VERSION}).`);
  }
  if (typeof m.name !== 'string' || m.name.length === 0) {
    throw new Error('name requis (string).');
  }
  if (m.commands !== undefined && !Array.isArray(m.commands)) {
    throw new Error('commands doit être un tableau.');
  }
  for (const c of m.commands || []) {
    if (!c.name || typeof c.name !== 'string') {
      throw new Error('Command sans name.');
    }
    if (!c.entry || typeof c.entry !== 'string') {
      throw new Error(`Command "${c.name}" sans entry.`);
    }
    if (!c.entry.startsWith('./')) {
      throw new Error(`Command entry doit être relatif au plugin (./...) : "${c.entry}".`);
    }
  }
  if (m.specTemplates !== undefined && !Array.isArray(m.specTemplates)) {
    throw new Error('specTemplates doit être un tableau.');
  }
  for (const t of m.specTemplates || []) {
    if (!t.domain || !t.file) throw new Error('specTemplate sans domain ou file.');
  }
  if (m.hooks !== undefined && (typeof m.hooks !== 'object' || Array.isArray(m.hooks))) {
    throw new Error('hooks doit être un objet.');
  }
  return true;
}

// ─── Agrégation ───────────────────────────────────────────────────────────

/**
 * Liste les commandes additionnelles fournies par les plugins.
 *
 * @param {object[]} plugins — résultat de decouvrirPlugins
 * @returns {{ name: string, entry: string, plugin: string }[]}
 */
export function listerCommandesPlugins(plugins) {
  const out = [];
  for (const p of plugins) {
    for (const c of p.manifest.commands || []) {
      out.push({
        name: c.name,
        entry: join(p.path, c.entry),
        plugin: p.name,
      });
    }
  }
  return out;
}

/**
 * Liste les templates SPEC additionnels.
 */
export function listerTemplatesPlugins(plugins) {
  const out = [];
  for (const p of plugins) {
    for (const t of p.manifest.specTemplates || []) {
      out.push({
        domain: t.domain,
        file: join(p.path, t.file),
        plugin: p.name,
      });
    }
  }
  return out;
}

// ─── Hooks beforeCommand / afterCommand ────────────────────────────────────

/**
 * Exécute les hooks d'un type donné en parallèle (best-effort, ne casse
 * jamais le pipeline AIAD principal).
 *
 * @param {object[]} plugins
 * @param {'beforeCommand'|'afterCommand'} type
 * @param {object} ctx — { command, args, racine, … }
 */
export async function executerHooks(plugins, type, ctx) {
  const promesses = [];
  for (const p of plugins) {
    const hookRel = p.manifest.hooks && p.manifest.hooks[type];
    if (!hookRel) continue;
    promesses.push((async () => {
      try {
        const hookPath = join(p.path, hookRel);
        const mod = await import(hookPath);
        const fn = mod.default || mod[type];
        if (typeof fn === 'function') await fn(ctx);
      } catch { /* swallow */ }
    })());
  }
  await Promise.all(promesses);
}

// ─── Install / Uninstall (local) ──────────────────────────────────────────

/**
 * Installe un plugin local en copiant le dossier vers `.aiad/plugins/<id>/`.
 *
 * @param {string} racine
 * @param {string} sourceDir — dossier source contenant aiad-plugin.json
 * @param {{ id?: string, dryRun?: boolean, force?: boolean }} [options]
 */
export function installerLocal(racine, sourceDir, options = {}) {
  const manifestPath = join(sourceDir, MANIFEST_FILENAME);
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest absent : ${manifestPath}.`);
  }
  const manifest = chargerManifest(manifestPath);
  const id = options.id || manifest.name.replace(/^@.*?\//, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const dest = join(racine, LOCAL_PLUGINS_DIR, id);

  if (existsSync(dest) && !options.force) {
    throw new Error(`Plugin "${id}" déjà installé. Utiliser --force pour écraser.`);
  }

  if (!options.dryRun) {
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    if (!existsSync(join(racine, LOCAL_PLUGINS_DIR))) {
      mkdirSync(join(racine, LOCAL_PLUGINS_DIR), { recursive: true });
    }
    cpSync(sourceDir, dest, { recursive: true });
  }
  return { id, dest, manifest, action: existsSync(dest) ? 'overwritten' : 'created', dryRun: Boolean(options.dryRun) };
}

/**
 * Désinstalle un plugin local.
 */
export function desinstallerLocal(racine, id, options = {}) {
  const dest = join(racine, LOCAL_PLUGINS_DIR, id);
  if (!existsSync(dest)) {
    throw new Error(`Plugin local "${id}" introuvable.`);
  }
  if (!options.dryRun) rmSync(dest, { recursive: true, force: true });
  return { id, dryRun: Boolean(options.dryRun) };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

export function afficherListe(racine, options = {}) {
  const plugins = decouvrirPlugins(racine);
  if (options.json) {
    process.stdout.write(JSON.stringify({
      total: plugins.length,
      plugins: plugins.map((p) => ({
        name: p.name, version: p.version, source: p.source,
        commands: (p.manifest.commands || []).map((c) => c.name),
        specTemplates: (p.manifest.specTemplates || []).map((t) => t.domain),
        hooks: Object.keys(p.manifest.hooks || {}),
      })),
    }, null, 2) + '\n');
    return plugins;
  }
  logHeader(
    'AIAD SDD — Plugins',
    `${plugins.length} plugin(s) détecté(s)${process.env.AIAD_PLUGINS_DISABLED === '1' ? ' (désactivé via env)' : ''}`,
  );
  if (plugins.length === 0) {
    console.log(`  ${C.gris}~ Aucun plugin. Pour en installer un :${C.reset}`);
    console.log(`    npm install <aiad-plugin>             # installation npm`);
    console.log(`    aiad-sdd plugin install <local-path>  # installation locale\n`);
    return plugins;
  }
  for (const p of plugins) {
    const cmds = (p.manifest.commands || []).map((c) => c.name);
    const tpls = (p.manifest.specTemplates || []).map((t) => t.domain);
    const hks = Object.keys(p.manifest.hooks || {});
    console.log(`  ${C.cyan}${p.name}${C.reset}  ${C.gris}${p.version || 'v?'} · ${p.source}${C.reset}`);
    if (cmds.length) console.log(`    commandes : ${cmds.join(', ')}`);
    if (tpls.length) console.log(`    templates : ${tpls.join(', ')}`);
    if (hks.length) console.log(`    hooks     : ${hks.join(', ')}`);
  }
  console.log('');
  return plugins;
}

export function afficherInfo(racine, name, options = {}) {
  const plugins = decouvrirPlugins(racine);
  const p = plugins.find((x) => x.name === name);
  if (!p) {
    if (options.json) {
      process.stdout.write(JSON.stringify({ name, found: false, available: plugins.map((x) => x.name) }, null, 2) + '\n');
      return null;
    }
    throw new Error(`Plugin "${name}" introuvable. Lance \`aiad-sdd plugin list\`.`);
  }
  if (options.json) {
    process.stdout.write(JSON.stringify({ name: p.name, found: true, plugin: p }, null, 2) + '\n');
    return p;
  }
  logHeader(`AIAD SDD — Plugin ${p.name}`, `${p.version || 'v?'} · ${p.source} · ${p.path}`);
  console.log(`  ${p.manifest.description || ''}`);
  console.log('');
  for (const c of p.manifest.commands || []) {
    console.log(`  ${C.cyan}commande${C.reset} : ${c.name} → ${c.entry}`);
  }
  for (const t of p.manifest.specTemplates || []) {
    console.log(`  ${C.cyan}template${C.reset} : ${t.domain} → ${t.file}`);
  }
  for (const [k, v] of Object.entries(p.manifest.hooks || {})) {
    console.log(`  ${C.cyan}hook${C.reset}     : ${k} → ${v}`);
  }
  console.log('');
  return p;
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  decouvrirPlugins as discoverPlugins,
  decouvrirNodeModules as discoverNodeModules,
  decouvrirLocaux as discoverLocal,
  chargerManifest as loadManifest,
  validerManifest as validateManifest,
  listerCommandesPlugins as listPluginCommands,
  listerTemplatesPlugins as listPluginTemplates,
  executerHooks as executeHooks,
  installerLocal as installLocal,
  desinstallerLocal as uninstallLocal,
  afficherListe as showList,
  afficherInfo as showInfo,
};

export const CONSTANTS = {
  MANIFEST_FILENAME,
  LOCAL_PLUGINS_DIR,
  MANIFEST_VERSION,
};
