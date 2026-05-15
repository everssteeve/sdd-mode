// AIAD SDD Mode — Suggestion automatique de SPEC depuis le code annoté.
//
// Quand un fichier code porte `@spec SPEC-XXX-N-slug` mais qu'aucun
// `.aiad/specs/SPEC-XXX-N-slug.md` n'existe, ce module génère un squelette
// EARS prérempli avec :
//   - frontmatter `parent_intent` (deviné depuis l'Intent annoté sur le
//     même fichier ou l'Intent actif),
//   - `status: draft` (la SPEC doit passer la Gate avant exécution),
//   - liste des fichiers code rattachés à cette SPEC,
//   - template EARS R1-R7 vide à compléter par l'humain.
//
// Hard rule : on ne **complète JAMAIS** automatiquement le contenu du
// pourquoi (ce serait violer le principe Human Authorship). On crée un
// squelette qui force l'humain à formuler l'intention.
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { syncFile } from './fs-ops.js';
import { parseFrontmatter } from './frontmatter.js';

// Devine le `parent_intent` :
//   1. Si le code annote un `@intent INTENT-NNN` à proximité, on l'utilise.
//   2. Sinon, on cherche l'Intent actif dans `.aiad/intents/_index.md`.
//   3. Sinon, on laisse `parent_intent: TODO`.
function devinerParentIntent(racine, fichiersCode) {
  // 1. cherche dans les fichiers code rattachés à la SPEC
  for (const f of fichiersCode) {
    try {
      const contenu = readFileSync(join(racine, f.path), 'utf-8');
      const m = contenu.match(/@intent\s+(INTENT-[A-Za-z0-9-]+)/);
      if (m) return m[1];
    } catch { /* ignore */ }
  }
  // 2. Intent actif via _index.md
  const indexPath = join(racine, '.aiad', 'intents', '_index.md');
  if (existsSync(indexPath)) {
    const md = readFileSync(indexPath, 'utf-8');
    for (const ligne of md.split('\n')) {
      if (!ligne.includes('|') || !ligne.includes('INTENT-')) continue;
      const cols = ligne.split('|').map((s) => s.trim());
      const id = cols.find((c) => /^INTENT-/.test(c));
      const statut = cols[cols.length - 2] || '';
      if (id && statut.toLowerCase() === 'active') return id;
    }
  }
  // 3. Intent existant le plus récent
  const dir = join(racine, '.aiad', 'intents');
  if (existsSync(dir)) {
    const noms = readdirSync(dir).filter((f) => /^INTENT-\d+/.test(f) && f.endsWith('.md')).sort();
    if (noms.length) return noms[noms.length - 1].match(/^INTENT-\d+/)[0];
  }
  return 'TODO';
}

function deriverTitre(specId) {
  // SPEC-042-1-flow-auth → "Flow auth" (capitalize, dash → space)
  const m = specId.match(/^SPEC-\d+(?:-\d+)?(?:-(.+))?$/);
  if (!m || !m[1]) return specId;
  const slug = m[1].replace(/-/g, ' ');
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

function genererSquelette(specId, parentIntent, fichiersCode) {
  const titre = deriverTitre(specId);
  const lignesFichiers = fichiersCode.length === 0
    ? ['- *(aucun fichier code rattaché — vérifier les annotations `@spec`)*']
    : fichiersCode.map((f) => `- \`${f.path}\`${f.line ? `:${f.line}` : ''}`);

  return `---
title: ${titre}
parent_intent: ${parentIntent}
status: draft
format: EARS
generated-by: aiad-sdd trace --suggest
---

# ${titre}

> ⚠️ **Squelette généré** par \`aiad-sdd trace --suggest\` à partir des annotations \`@spec ${specId}\` trouvées dans le code. **À compléter avant \`/sdd gate\`** — la Gate refusera tant que le SQS n'atteint pas 4/5.

## Intent parent

${parentIntent === 'TODO' ? '*(Aucun Intent actif trouvé — crée d\'abord un Intent Statement via `/sdd intent` puis remplace `TODO` ci-dessus.)*' : `Voir [\`.aiad/intents/${parentIntent}.md\`](../intents/${parentIntent}.md).`}

## Code rattaché

${lignesFichiers.join('\n')}

## Critères d'acceptation (format EARS)

> Format EARS = Easy Approach to Requirements Syntax. Linter strict R1-R7
> appliqué par \`/sdd gate\` quand \`Format : EARS\`. À compléter par
> l'humain — l'agent SDD ne complète JAMAIS le pourquoi automatiquement.

- **(à compléter)** WHEN <déclencheur observable>, the system SHALL <comportement vérifiable>.
- **(à compléter)** WHILE <condition continue>, the system SHALL <comportement>.
- **(à compléter)** IF <condition>, THEN the system SHALL <comportement>.
- **(à compléter)** WHERE <feature/contexte>, the system SHALL <comportement>.

## Test de l'Étranger

> Un développeur extérieur au projet, lisant uniquement cette SPEC, doit pouvoir construire l'implémentation. À compléter par l'humain.

## Gouvernance applicable

*(Si le code touche un domaine sensible, ajouter ici les agents Tier 1 concernés : AIAD-RGPD, AIAD-AI-ACT, AIAD-RGAA, AIAD-RGESN.)*

---

*SPEC squelettée le ${new Date().toISOString().slice(0, 10)} — à compléter avant validation.*
`;
}

/**
 * Suggère des SPECs squelettées pour les SPECs orphelines référencées dans
 * le code mais absentes de `.aiad/specs/`.
 *
 * @param {string} racine
 * @param {object} matrice — sortie de `construireMatrice`
 * @param {{ dryRun?: boolean }} [options]
 * @returns {{ created: string[], existing: string[] }}
 */
export function suggererSpecs(racine, matrice, options = {}) {
  const { dryRun = false } = options;
  const created = [];
  const existing = [];

  // Regroupe les orphelins par specId (un même ID peut être cité plusieurs fois).
  const parId = new Map();
  for (const o of (matrice?.gaps?.specsOrphelinsSurCode || [])) {
    if (!parId.has(o.id)) parId.set(o.id, []);
    parId.get(o.id).push({ path: o.file, line: o.line });
  }

  for (const [specId, fichiersCode] of parId) {
    const dest = join(racine, '.aiad', 'specs', `${specId}.md`);
    if (existsSync(dest)) {
      // Ne réécrit jamais une SPEC existante (préservation utilisateur).
      existing.push(specId);
      continue;
    }
    const parentIntent = devinerParentIntent(racine, fichiersCode);
    const contenu = genererSquelette(specId, parentIntent, fichiersCode);
    const result = syncFile(dest, contenu, { dryRun });
    if (result === 'created' || result === 'updated') created.push(specId);
  }

  return { created, existing };
}

// ─── Alias EN canoniques (item #42) ─────────────────────────────────────────
export {
  suggererSpecs as suggestSpecs,
};
