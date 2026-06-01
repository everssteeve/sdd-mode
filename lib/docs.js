// AIAD SDD Mode — Documentation utilisateur générée et toujours synchrone.
//
// Critère leadership EU/FR : la doc reste **toujours à jour à 100 %** sans
// intervention manuelle. Mécanisme inspiré d'`emit-rules` :
//   - sources de vérité multiples (bin, sous-commandes slash, skills,
//     gouvernance, conventions d'annotations) ;
//   - sortie unique (`DOCUMENTATION.md` ou autre via --out) avec frontmatter
//     `source-hash` SHA-256 des entrées ;
//   - mode `--check` : exit 1 si divergence (consommable CI).
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { C, log, logHeader } from './term.js';
import { syncFile } from './fs-ops.js';
import { parseFrontmatter } from './frontmatter.js';
import { ANNOTATION_REGEX } from './sdd-trace.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const TEMPLATES = join(ROOT, 'templates');

const SENTINEL_HEADER = '<!-- DO NOT EDIT — regenerate via aiad-sdd docs -->';

function lirePackageVersion() {
  return JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).version;
}

// ─── Lecture des sources ────────────────────────────────────────────────────

function lireBin() {
  const bin = readFileSync(join(ROOT, 'bin', 'aiad-sdd.js'), 'utf-8');
  // Extrait le contenu de la constante `AIDE` qui contient la matrice
  // commandes / flags. Délimité par `const AIDE = \`...\`;`.
  const m = bin.match(/const AIDE = `([\s\S]*?)`;/);
  if (!m) return '';
  // Interpole le seul ${VERSION} présent dans le template literal source.
  return m[1].replace(/\$\{VERSION\}/g, lirePackageVersion());
}

function lireSousCommandes(dossier) {
  const dir = join(TEMPLATES, '.claude', dossier);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((nom) => {
      const contenu = readFileSync(join(dir, nom), 'utf-8');
      const { data } = parseFrontmatter(contenu);
      // Le titre H1 ou le nom du fichier
      const titreM = contenu.match(/^#\s+(.+)$/m);
      // Premier paragraphe non-vide après le titre
      const apresTitre = titreM ? contenu.slice(contenu.indexOf(titreM[0]) + titreM[0].length) : contenu;
      const para = apresTitre.split(/\n\n+/).map((p) => p.trim()).find((p) => p && !p.startsWith('#'));
      return {
        slug: nom.replace(/\.md$/, ''),
        titre: titreM ? titreM[1].trim() : nom,
        description: data.description || (para ? para.split('\n')[0] : '').slice(0, 200),
      };
    });
}

function lireSkills() {
  const dir = join(TEMPLATES, '.claude', 'skills');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const nom of readdirSync(dir).sort()) {
    const sf = join(dir, nom, 'SKILL.md');
    if (!existsSync(sf)) continue;
    const contenu = readFileSync(sf, 'utf-8');
    const { data } = parseFrontmatter(contenu);
    out.push({
      name: data.name || nom,
      description: data.description || '',
    });
  }
  return out;
}

function lireGouvernance() {
  const dir = join(TEMPLATES, '.aiad', 'gouvernance');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith('AIAD-') && f.endsWith('.md'))
    .sort()
    .map((nom) => {
      const contenu = readFileSync(join(dir, nom), 'utf-8');
      const m = contenu.match(/Référentiel\*?\*?\s*:\s*([^\n]+)/);
      const decl = contenu.match(/Périmètre\*?\*?\s*:\s*([^\n]+)/);
      return {
        id: nom.replace(/\.md$/, ''),
        referentiel: m ? m[1].trim().replace(/\*\*/g, '') : '',
        perimetre: decl ? decl[1].trim().replace(/\*\*/g, '') : '',
      };
    });
}

function lireAnnotations() {
  return Object.keys(ANNOTATION_REGEX).map((tag) => ({
    tag: '@' + (tag === 'verifiedBy' ? 'verified-by' : tag.toLowerCase()),
    description: {
      intent: 'Lien vers un Intent Statement (`INTENT-NNN`). Cardinalité 0..1.',
      spec: 'Lien vers une SPEC (`SPEC-NNN-N-slug`). Cardinalité **1..n** sur tout code applicatif.',
      verifiedBy: 'Chemin relatif vers un test qui couvre ce fichier. Cardinalité 0..n.',
      governance: 'Liste d\'agents Tier 1 invoqués (`AIAD-RGPD,AIAD-AI-ACT`, …). Cardinalité 0..1.',
    }[tag],
  }));
}

// ─── Génération du Markdown ─────────────────────────────────────────────────

function genererMarkdown(donnees) {
  const { version, sourceHash, bin, sddCmds, aiadCmds, skills, gouvernance, annotations } = donnees;
  const lignes = [];

  lignes.push(SENTINEL_HEADER);
  lignes.push('---');
  lignes.push(`title: aiad-sdd — Documentation utilisateur`);
  lignes.push(`generated-by: aiad-sdd docs`);
  lignes.push(`version: ${version}`);
  lignes.push(`source-hash: ${sourceHash}`);
  lignes.push('---');
  lignes.push('');
  lignes.push(`# aiad-sdd — Documentation utilisateur (v${version})`);
  lignes.push('');
  lignes.push('> Cette documentation est **régénérée à chaque changement** des sources de vérité (CLI, commandes slash, skills, gouvernance, conventions d\'annotations). Toute édition manuelle sera écrasée. Pour modifier le contenu : édite la source puis relance `npx aiad-sdd docs`. Le mode `npx aiad-sdd docs --check` est utilisable en CI pour bloquer les PR qui désynchronisent la doc.');
  lignes.push('');

  // Sommaire
  lignes.push('## Sommaire');
  lignes.push('');
  lignes.push('1. [Interface en ligne de commande](#1-interface-en-ligne-de-commande)');
  lignes.push('2. [Commandes slash SDD](#2-commandes-slash-sdd)');
  lignes.push('3. [Commandes slash AIAD](#3-commandes-slash-aiad)');
  lignes.push('4. [Skills auto-déclenchées](#4-skills-auto-déclenchées)');
  lignes.push('5. [Gouvernance Tier 1](#5-gouvernance-tier-1)');
  lignes.push('6. [Annotations machine-vérifiables](#6-annotations-machine-vérifiables)');
  lignes.push('');

  // 1. CLI
  lignes.push('## 1. Interface en ligne de commande');
  lignes.push('');
  lignes.push('Sortie de `aiad-sdd help` (extraite du bin pour rester à jour) :');
  lignes.push('');
  lignes.push('```');
  lignes.push(bin.trim());
  lignes.push('```');
  lignes.push('');

  // 2. SDD slash commands
  lignes.push('## 2. Commandes slash SDD');
  lignes.push('');
  lignes.push('Disponibles via `/sdd <sub>` dans Claude Code après `aiad-sdd init`.');
  lignes.push('');
  lignes.push('| Commande | Description |');
  lignes.push('|----------|-------------|');
  for (const c of sddCmds) {
    lignes.push(`| \`/sdd ${c.slug.replace(/^sdd-/, '')}\` ([\`${c.slug}.md\`](./templates/.claude/sdd/${c.slug.replace(/^sdd-/, '')}.md)) | ${escapeTab(c.description || c.titre)} |`);
  }
  lignes.push('');

  // 3. AIAD slash commands
  lignes.push('## 3. Commandes slash AIAD');
  lignes.push('');
  lignes.push('Disponibles via `/aiad <sub>` (rituels, métriques, multi-runtime).');
  lignes.push('');
  lignes.push('| Commande | Description |');
  lignes.push('|----------|-------------|');
  for (const c of aiadCmds) {
    lignes.push(`| \`/aiad ${c.slug.replace(/^aiad-/, '')}\` | ${escapeTab(c.description || c.titre)} |`);
  }
  lignes.push('');

  // 4. Skills
  lignes.push('## 4. Skills auto-déclenchées');
  lignes.push('');
  lignes.push('Claude Code charge dynamiquement ces skills selon leur `description`. Validable via `aiad-sdd skills validate`.');
  lignes.push('');
  lignes.push('| Skill | Déclencheur (description frontmatter) |');
  lignes.push('|-------|----------------------------------------|');
  for (const s of skills) {
    lignes.push(`| **${s.name}** | ${escapeTab(s.description)} |`);
  }
  lignes.push('');

  // 5. Gouvernance
  lignes.push('## 5. Gouvernance Tier 1');
  lignes.push('');
  lignes.push('Pack par défaut : `eu-baseline`. Autres packs disponibles via `aiad-sdd gouvernance --pack <id>` (`us-baseline`, `uk-baseline`).');
  lignes.push('');
  lignes.push('| Agent | Périmètre | Référentiel |');
  lignes.push('|-------|-----------|-------------|');
  for (const g of gouvernance) {
    lignes.push(`| **${g.id}** | ${escapeTab(g.perimetre)} | ${escapeTab(g.referentiel)} |`);
  }
  lignes.push('');

  // 6. Annotations
  lignes.push('## 6. Annotations machine-vérifiables');
  lignes.push('');
  lignes.push('Conventions reconnues par `aiad-sdd trace` (regex stables exportées par `lib/sdd-trace.js#ANNOTATION_REGEX`).');
  lignes.push('');
  lignes.push('| Tag | Description |');
  lignes.push('|-----|-------------|');
  for (const a of annotations) {
    lignes.push(`| \`${a.tag}\` | ${a.description} |`);
  }
  lignes.push('');

  lignes.push('---');
  lignes.push('');
  lignes.push(`*Document régénéré automatiquement — source-hash \`${sourceHash}\`, package v${version}.*`);
  lignes.push('');

  return lignes.join('\n');
}

function escapeTab(s) {
  return String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 250);
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

function calculerSourceHash(entrees) {
  const h = createHash('sha256');
  for (const cle of Object.keys(entrees).sort()) {
    h.update(`\n--${cle}--\n`);
    h.update(JSON.stringify(entrees[cle]));
  }
  return h.digest('hex').slice(0, 16);
}

function collecter() {
  const version = lirePackageVersion();
  const bin = lireBin();
  const sddCmds = lireSousCommandes('sdd');
  const aiadCmds = lireSousCommandes('aiad');
  const skills = lireSkills();
  const gouvernance = lireGouvernance();
  const annotations = lireAnnotations();
  const sourceHash = calculerSourceHash({
    bin, sddCmds, aiadCmds, skills, gouvernance,
    annotationsKeys: Object.keys(ANNOTATION_REGEX),
  });
  return { version, sourceHash, bin, sddCmds, aiadCmds, skills, gouvernance, annotations };
}

/**
 * Génère ou vérifie la doc utilisateur.
 *
 * @param {string} racine - racine du projet (où DOCUMENTATION.md sera écrit).
 * @param {{ check?: boolean, out?: string }} [options]
 * @returns {Promise<{ ok: boolean, drift: boolean, path: string, hash: string }>}
 */
export async function docs(racine, options = {}) {
  const { check = false, out = 'DOCUMENTATION.md' } = options;
  const dest = join(racine, out);
  const donnees = collecter();
  const contenu = genererMarkdown(donnees);

  logHeader(
    `AIAD SDD Mode — Documentation${check ? ' (--check)' : ''}`,
    `source-hash : ${donnees.sourceHash}`,
  );

  if (check) {
    if (!existsSync(dest)) {
      log(`${C.rouge}✗${C.reset}`, `${relative(racine, dest)} (manquant)`);
      console.log(`\n${C.rouge}${C.gras}  ✗ DOCUMENTATION.md absente — lance \`aiad-sdd docs\` pour la générer.${C.reset}\n`);
      return { ok: false, drift: true, path: dest, hash: donnees.sourceHash };
    }
    const existant = readFileSync(dest, 'utf-8');
    if (existant === contenu) {
      log(`${C.vert}✓${C.reset}`, `${relative(racine, dest)} (synchronisée)`);
      console.log(`\n${C.vert}${C.gras}  ✓ Documentation à jour.${C.reset}\n`);
      return { ok: true, drift: false, path: dest, hash: donnees.sourceHash };
    }
    log(`${C.rouge}✗${C.reset}`, `${relative(racine, dest)} (divergence)`);
    console.log(`
${C.rouge}${C.gras}  ✗ Documentation désynchronisée — une source a changé sans régénération.${C.reset}
${C.gris}  Régénère avec :  ${C.reset}${C.cyan}npx aiad-sdd docs${C.reset}
`);
    return { ok: false, drift: true, path: dest, hash: donnees.sourceHash };
  }

  const result = syncFile(dest, contenu);
  const sym = result === 'created' ? `${C.vert}+${C.reset}`
    : result === 'updated' ? `${C.cyan}↑${C.reset}`
    : `${C.vert}✓${C.reset}`;
  log(sym, `${relative(racine, dest)} (${result})`);
  console.log(`
${C.vert}${C.gras}  ✓ Documentation régénérée.${C.reset}
${C.gris}  ${donnees.sddCmds.length} commande(s) /sdd · ${donnees.aiadCmds.length} commande(s) /aiad · ${donnees.skills.length} skill(s) · ${donnees.gouvernance.length} agent(s) Tier 1.${C.reset}
`);

  return { ok: true, drift: false, path: dest, hash: donnees.sourceHash };
}

// ─── Exports utilitaires (pour tests) ───────────────────────────────────────

export { collecter as _collecter, genererMarkdown as _genererMarkdown, calculerSourceHash as _calculerSourceHash };
