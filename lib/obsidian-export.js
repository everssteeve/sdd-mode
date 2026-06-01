// AIAD SDD Mode — Export Obsidian Vault (#85 MVP).
//
// Obsidian lit nativement les fichiers Markdown. Plutôt qu'un plugin
// Obsidian custom (lourd, lifecycle bundler), on livre un export CLI qui
// produit un Vault prêt à ouvrir dans Obsidian, avec :
//
//   - Wiki-links `[[INTENT-001-x]]` injectés là où le frontmatter cite
//     `parent_intent: INTENT-001` (et inversement côté Intent)
//   - Map of Content (MOC) `_index.md` qui liste tous les artefacts par
//     catégorie avec liens cliquables
//   - README adapté Obsidian (rappel : Graph view → Ctrl+G, backlinks
//     panel, etc.)
//
// Architecture extensible : un futur "vrai" plugin Obsidian (#85 follow-up)
// pourra réutiliser les mêmes transformations.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, basename, relative } from 'node:path';

const SOURCES = [
  // path relatif depuis `.aiad/` → catégorie dans le Vault
  { src: 'intents', cat: 'Intents' },
  { src: 'specs', cat: 'SPECs' },
  { src: 'gouvernance', cat: 'Gouvernance' },
  { src: 'facts', cat: 'Facts' },
];

// Fichiers à la racine de `.aiad/` à copier tels quels (artefacts pivots).
const PIVOTS = ['PRD.md', 'ARCHITECTURE.md', 'AGENT-GUIDE.md'];

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

// Extrait le shortId depuis un nom de fichier `INTENT-001-slug.md` ou un id
// frontmatter `INTENT-001`. Retourne `INTENT-001` (sans slug).
function shortId(s) {
  if (!s) return null;
  const m = String(s).match(/(INTENT|SPEC)-(\d+(?:-\d+)?)/i);
  return m ? `${m[1].toUpperCase()}-${m[2]}` : null;
}

// Lit le frontmatter YAML simpliste d'un fichier (clé: valeur sur 1 ligne).
function parserFrontmatter(contenu) {
  const m = contenu.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!m) return { fields: {}, body: contenu, fmEnd: 0 };
  const fields = {};
  for (const ligne of m[1].split('\n')) {
    const kv = ligne.match(/^([a-zA-Z_-]+):\s*(.+?)\s*$/);
    if (kv) fields[kv[1].toLowerCase()] = kv[2].trim();
  }
  return { fields, body: contenu.slice(m[0].length), fmEnd: m[0].length };
}

// Index fichier → id-court pour résoudre les wiki-links.
function indexerFichiers(racineAiad) {
  const index = {}; // shortId → { fullName (sans .md), category }
  for (const { src, cat } of SOURCES) {
    const dir = join(racineAiad, src);
    if (!existsSync(dir)) continue;
    let entries;
    try { entries = readdirSync(dir); } catch { continue; }
    for (const nom of entries) {
      if (!nom.endsWith('.md') || nom.startsWith('_')) continue;
      const sId = shortId(nom);
      const fullName = nom.slice(0, -3); // sans .md
      if (sId) index[sId] = { fullName, category: cat, file: nom };
      // Indexe aussi par le nom complet pour résolution directe
      index[fullName] = { fullName, category: cat, file: nom };
    }
  }
  return index;
}

// Transforme un fichier Markdown pour Obsidian : injecte des wiki-links
// `[[<id>]]` dans une section "## Liens" en tête du body si le frontmatter
// déclare des relations (`parent_intent`, `governance`, `parent`).
function transformerPourObsidian(contenu, index) {
  const { fields, body } = parserFrontmatter(contenu);
  const liens = new Set();

  // parent_intent : INTENT-001 ou INTENT-001-slug. Alias supportés :
  // `parent_intent` (convention v1.10+), `parent` (legacy), `intent`
  // (convention courte observée sur certains projets type scenario-autonomous-run).
  const parents = [fields['parent_intent'], fields['parent'], fields['intent']].filter(Boolean);
  for (const p of parents) {
    const sId = shortId(p);
    if (sId && index[sId]) liens.add(index[sId].fullName);
  }
  // governance : AIAD-RGPD,AIAD-AI-ACT
  if (fields['governance']) {
    for (const tag of fields['governance'].split(/[,;]/).map((x) => x.trim()).filter(Boolean)) {
      if (index[tag]) liens.add(index[tag].fullName);
    }
  }

  // Construction de la section "Liens"
  let section = '';
  if (liens.size > 0) {
    section = `\n> [!info] Liens AIAD\n`;
    for (const l of [...liens].sort()) {
      section += `> - [[${l}]]\n`;
    }
    section += '\n';
  }

  // Reconstruction : frontmatter intact + section liens + body original
  const fmMatch = contenu.match(/^---\s*\n[\s\S]*?\n---\s*\n/);
  const fm = fmMatch ? fmMatch[0] : '';
  return fm + section + body;
}

// Génère le `_index.md` (Map of Content) à la racine du Vault.
function genererMoc(racineAiad, index) {
  const sectionsContenu = {};
  for (const cat of SOURCES.map((s) => s.cat).concat(['Pivots'])) sectionsContenu[cat] = [];

  // Artefacts pivots à la racine
  for (const p of PIVOTS) {
    if (existsSync(join(racineAiad, p))) {
      sectionsContenu['Pivots'].push(`- [[${p.slice(0, -3)}]]`);
    }
  }

  // Sources catégorisées
  for (const { src, cat } of SOURCES) {
    const dir = join(racineAiad, src);
    if (!existsSync(dir)) continue;
    let entries;
    try { entries = readdirSync(dir); } catch { continue; }
    for (const nom of entries.filter((n) => n.endsWith('.md') && !n.startsWith('_')).sort()) {
      sectionsContenu[cat].push(`- [[${nom.slice(0, -3)}]]`);
    }
  }

  let moc = `# AIAD Vault — Map of Content\n\n`;
  moc += `> Vault Obsidian généré automatiquement depuis \`.aiad/\` via \`aiad-sdd obsidian\`.\n`;
  moc += `> Ouvre la **Graph view** (Ctrl+G / Cmd+G) pour visualiser les liens Intent ↔ SPEC ↔ Gouvernance.\n\n`;
  for (const cat of ['Pivots', ...SOURCES.map((s) => s.cat)]) {
    if (!sectionsContenu[cat] || sectionsContenu[cat].length === 0) continue;
    moc += `## ${cat} (${sectionsContenu[cat].length})\n\n`;
    moc += sectionsContenu[cat].join('\n') + '\n\n';
  }
  return moc;
}

function genererReadme() {
  return `# AIAD Vault (généré)

Ce dossier est un **Vault Obsidian** régénéré depuis \`.aiad/\` par \`aiad-sdd obsidian\`.

## Premier usage

1. Ouvre Obsidian
2. **Open another vault** → sélectionne ce dossier
3. Active \`Settings → Files & Links → Use Wikilinks\` (par défaut activé)
4. Lance la **Graph view** : \`Ctrl+G\` (\`Cmd+G\` sur macOS)

## Convention

Chaque fichier conserve son frontmatter AIAD intact. Une section \`> [!info] Liens AIAD\` est injectée en tête du body avec des wiki-links \`[[...]]\` vers :

- L'Intent parent (\`parent_intent: INTENT-NNN\`)
- Les agents de gouvernance déclarés (\`governance: AIAD-RGPD,AIAD-AI-ACT\`)

Cela rend les **backlinks** Obsidian opérationnels sans plugin custom : panneau de droite → Backlinks pour voir qui pointe vers ce fichier.

## Régénération

Ce vault est **éphémère**. Régénère-le à chaque changement notable dans \`.aiad/\` :

\`\`\`bash
aiad-sdd obsidian --out vault/
\`\`\`

⚠️ \`aiad-sdd obsidian\` écrase le contenu existant — n'édite **jamais** ce vault à la main. Source de vérité : \`.aiad/\`.

## Carte du vault

Le fichier [[_index]] (Map of Content) liste tous les artefacts par catégorie.
`;
}

export function exporterObsidian(racineProjet, opts = {}) {
  const racineAiad = join(racineProjet, '.aiad');
  if (!existsSync(racineAiad)) {
    return { ok: false, raison: 'aiad-absent', files: 0, dir: null };
  }
  const outDir = opts.out
    ? (opts.out.startsWith('/') ? opts.out : join(racineProjet, opts.out))
    : join(racineProjet, 'obsidian-vault');

  if (opts.dryRun) {
    return { ok: true, mode: 'dry-run', dir: outDir, files: 0, message: 'Aperçu uniquement, aucun fichier écrit.' };
  }

  ensureDir(outDir);
  const index = indexerFichiers(racineAiad);
  let files = 0;

  // Copie + transforme les sources catégorisées (intents, specs, gouvernance, facts)
  for (const { src, cat } of SOURCES) {
    void cat;
    const dir = join(racineAiad, src);
    if (!existsSync(dir)) continue;
    const cible = join(outDir, src);
    ensureDir(cible);
    let entries;
    try { entries = readdirSync(dir); } catch { continue; }
    for (const nom of entries) {
      if (!nom.endsWith('.md') || nom.startsWith('_')) continue;
      const srcPath = join(dir, nom);
      let contenu;
      try { contenu = readFileSync(srcPath, 'utf-8'); } catch { continue; }
      const transforme = transformerPourObsidian(contenu, index);
      writeFileSync(join(cible, nom), transforme, 'utf-8');
      files += 1;
    }
  }

  // Copie les pivots tels quels (PRD, ARCHITECTURE, AGENT-GUIDE)
  for (const p of PIVOTS) {
    const srcPath = join(racineAiad, p);
    if (!existsSync(srcPath)) continue;
    try {
      const contenu = readFileSync(srcPath, 'utf-8');
      const transforme = transformerPourObsidian(contenu, index);
      writeFileSync(join(outDir, p), transforme, 'utf-8');
      files += 1;
    } catch { /* skip */ }
  }

  // MOC + README
  writeFileSync(join(outDir, '_index.md'), genererMoc(racineAiad, index), 'utf-8');
  writeFileSync(join(outDir, 'README.md'), genererReadme(), 'utf-8');
  files += 2;

  return {
    ok: true,
    mode: 'apply',
    dir: relative(racineProjet, outDir),
    files,
    artefacts: Object.keys(index).length,
  };
}

// Alias EN canoniques (#42)
export {
  exporterObsidian as exportObsidian,
  transformerPourObsidian as transformForObsidian,
  indexerFichiers as indexFiles,
  shortId as shortIdEN,
};

// Exports pour tests directs
export { transformerPourObsidian, indexerFichiers, shortId, parserFrontmatter };
