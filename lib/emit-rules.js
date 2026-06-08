// AIAD SDD Mode — emit-rules
//
// Évolution #8 : multi-runtime via une source amont unique.
//
// Source de vérité : .aiad/AGENT-GUIDE.md + .aiad/gouvernance/*.md + Intent actif.
// Cibles dérivées :
//   - AGENTS.md                              (standard inter-outils)
//   - CLAUDE.md                              (header de cohérence injecté en tête)
//   - .cursor/rules/aiad.mdc                 (frontmatter MDC, alwaysApply: true)
//   - .cursor/rules/aiad-rgpd.mdc            (Tier 1, scopé via globs)
//   - .cursor/rules/aiad-rgaa.mdc
//   - .cursor/rules/aiad-ai-act.mdc
//   - .cursor/rules/aiad-rgesn.mdc
//   - .codex/AGENT.md                        (optionnel)
//   - GEMINI.md                              (optionnel)
//
// Idempotence : hash SHA-256 des entrées en frontmatter (source-hash). En mode
// --check, on régénère en mémoire et on diffe — exit 1 si divergence.
//
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { C, log, logCreation, logOk, logSkip, logDrift } from './term.js';
import { syncFile as mettreAJour } from './fs-ops.js';
import { avecLock } from './lockfile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const RUNTIMES_VALIDES = ['claude-code', 'cursor', 'codex', 'copilot', 'gemini', 'all'];

function lirePackageVersion() {
  const pkgPath = join(__dirname, '..', 'package.json');
  return JSON.parse(readFileSync(pkgPath, 'utf-8')).version;
}

function sha256(s) {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

// Variante locale — libellé "(régénéré)" spécifique à emit-rules, plus
// parlant que le standard term.js "(synchronisé)" pour cette commande.
function logMaj(p) { log(`${C.cyan}↑${C.reset}`, `${p} ${C.gris}(régénéré)${C.reset}`); }

// ─── Lecture des sources ────────────────────────────────────────────────────

function lireAgentGuide(projetDir) {
  const p = join(projetDir, '.aiad', 'AGENT-GUIDE.md');
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf-8');
}

function lireGouvernance(projetDir) {
  const dir = join(projetDir, '.aiad', 'gouvernance');
  if (!existsSync(dir)) return {};
  const out = {};
  for (const nom of readdirSync(dir)) {
    if (!nom.startsWith('AIAD-') || !nom.endsWith('.md')) continue;
    const id = nom.replace('.md', ''); // AIAD-RGPD, AIAD-RGAA, …
    out[id] = readFileSync(join(dir, nom), 'utf-8');
  }
  return out;
}

/**
 * Identifie l'Intent actif le plus récent. Stratégie :
 *   1. parser .aiad/intents/_index.md (colonne Statut == 'active')
 *   2. fallback : dernier fichier INTENT-NNN-*.md dans .aiad/intents/
 *
 * Retourne { id, titre, source } ou null.
 */
function lireIntentActif(projetDir) {
  const dir = join(projetDir, '.aiad', 'intents');
  if (!existsSync(dir)) return null;

  // 1. _index.md
  const indexPath = join(dir, '_index.md');
  if (existsSync(indexPath)) {
    const md = readFileSync(indexPath, 'utf-8');
    const lignes = md.split('\n').filter((l) => l.trim().startsWith('|') && l.includes('INTENT-'));
    for (const ligne of lignes) {
      const cols = ligne.split('|').map((s) => s.trim());
      const id = cols.find((c) => /^INTENT-/.test(c));
      const statut = cols[cols.length - 2] || '';
      if (id && statut.toLowerCase() === 'active') {
        return { id, titre: cols[2] || '', source: '_index.md' };
      }
    }
  }

  // 2. fallback : dernier fichier
  const fichiers = readdirSync(dir)
    .filter((f) => /^INTENT-\d+/.test(f) && f.endsWith('.md'))
    .sort();
  if (fichiers.length === 0) return null;
  const dernier = fichiers[fichiers.length - 1];
  const id = dernier.replace(/\.md$/, '').match(/^INTENT-\d+/)?.[0];
  return id ? { id, titre: dernier, source: dernier } : null;
}

// ─── Extraction sémantique depuis AGENT-GUIDE ───────────────────────────────

/**
 * Extrait les blocs « TOUJOURS », « JAMAIS » et « INCERTITUDE » depuis AGENT-GUIDE.md.
 * INCERTITUDE = règles de fail-closed quand l'agent ne sait pas (sortie JNSP).
 * Retourne { toujours: string[], jamais: string[], incertitude: string[] }.
 */
export function extraireReglesAbsolues(agentGuide) {
  const out = { toujours: [], jamais: [], incertitude: [] };
  if (!agentGuide) return out;

  const sectionRegles = agentGuide.match(/##\s*RÈGLES ABSOLUES[\s\S]*?(?=\n##\s|\n---|\Z)/i);
  if (!sectionRegles) return out;

  const bloc = sectionRegles[0];
  const extraire = (regex) => {
    const m = bloc.match(regex);
    if (!m) return [];
    return m[0]
      .split('\n')
      .filter((l) => l.trim().startsWith('-'))
      .map((l) => l.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean);
  };

  // Limite de section : prochain `###` ou fin de bloc. On utilise `$` (fin de
  // string en mode non-multiline) plutôt que `\Z` qui n'existe pas en JS — la
  // forme historique `\Z` capturait littéralement le caractère "Z" et ne
  // fonctionnait qu'avec un sous-titre suivant.
  out.toujours = extraire(/###\s*TOUJOURS[\s\S]*?(?=\n###|$)/);
  out.jamais = extraire(/###\s*JAMAIS[\s\S]*?(?=\n###|$)/);
  // INCERTITUDE accepte un titre avec sous-libellé optionnel (ex. « INCERTITUDE — Dire "je ne sais pas" »).
  out.incertitude = extraire(/###\s*INCERTITUDE[^\n]*\n[\s\S]*?(?=\n###|$)/);
  return out;
}

function extraireIdentite(agentGuide) {
  if (!agentGuide) return { nom: '', description: '', domaine: '', mission: '' };
  const section = agentGuide.match(/##\s*IDENTITÉ DU PROJET[\s\S]*?(?=\n##\s|\Z)/i)?.[0] || '';
  const champ = (label) => {
    const re = new RegExp(`\\*\\*${label}\\*\\*\\s*:\\s*(.+)`, 'i');
    return section.match(re)?.[1].trim() || '';
  };
  return {
    nom: champ('Nom'),
    description: champ('Description'),
    domaine: champ('Domaine métier'),
    mission: champ('Mission'),
  };
}

// ─── Constantes runtime ─────────────────────────────────────────────────────

const HEADER_REGEN_HTML = '<!-- DO NOT EDIT — regenerate via /aiad-emit-rules -->';
const HEADER_REGEN_HASH = '# DO NOT EDIT — regenerate via /aiad-emit-rules';

// Globs Cursor par agent Tier 1 (heuristiques par défaut, le projet peut les
// surcharger en éditant le frontmatter régénéré sera réécrit — mais source-hash
// reste stable tant que les sources ne bougent pas).
export const GLOBS_TIER1 = {
  'AIAD-RGPD': ['**/api/**', '**/auth/**', '**/users/**', '**/account/**', '**/gdpr/**'],
  'AIAD-RGAA': ['**/components/**', '**/pages/**', '**/views/**', '**/app/**/*.tsx', '**/app/**/*.jsx', '**/*.vue'],
  'AIAD-AI-ACT': ['**/ai/**', '**/ml/**', '**/llm/**', '**/models/**', '**/agents/**'],
  'AIAD-RGESN': ['**/*'], // toujours pertinent (sobriété)
};

const DESCRIPTIONS_TIER1 = {
  'AIAD-RGPD': 'AIAD-RGPD — Privacy by Design (RGPD + ePrivacy)',
  'AIAD-RGAA': 'AIAD-RGAA — Accessibilité numérique (RGAA 4.1 / WCAG 2.1)',
  'AIAD-AI-ACT': 'AIAD-AI-ACT — Conformité EU AI Act (Règlement 2024/1689)',
  'AIAD-RGESN': 'AIAD-RGESN — Écoconception numérique (RGESN v2)',
};

// Globs de chargement `paths:` des règles `.claude/rules/` (pull — §3.7). La
// gouvernance ne se charge à froid que sur les fichiers de sa zone de risque,
// au lieu d'être poussée en permanence. Pour RGPD/RGAA/AI-ACT on réutilise les
// zones du veto Tier 1 ; RGESN (écoconception) est resserré sur les fichiers où
// se concentrent les décisions de ressources/dépendances (sinon `**/*` = chargé
// partout = aucun gain de budget). La source reste `.aiad/gouvernance/`.
export const GLOBS_RULES = {
  'AIAD-RGPD': GLOBS_TIER1['AIAD-RGPD'],
  'AIAD-RGAA': GLOBS_TIER1['AIAD-RGAA'],
  'AIAD-AI-ACT': GLOBS_TIER1['AIAD-AI-ACT'],
  'AIAD-RGESN': ['**/package.json', '**/*.lock', '**/Dockerfile*', '**/*.config.*', '**/vite.*', '**/webpack.*', '**/*.yml', '**/*.yaml'],
};

/** AIAD-RGPD → rgpd, AIAD-AI-ACT → ai-act (nom de fichier de règle). */
export function nomRule(agentId) {
  return agentId.replace(/^AIAD-/, '').toLowerCase();
}

// Fallback utilisé si l'AGENT-GUIDE local ne déclare pas de section INCERTITUDE.
// Maintient le contrat « tous les runtimes reçoivent la consigne JNSP »
// même quand le projet n'a pas encore régénéré son template.
const INCERTITUDE_DEFAUT = [
  'Dire `JNSP` (Je Ne Sais Pas) est un signal valide, pas un échec — préférer une réponse honnête à une réponse confiante mais inventée',
  'Si l\'intention n\'est pas formulée par un humain identifiable → JNSP, demander plutôt que paraphraser',
  'Si un critère ne peut pas être testé sans ambiguïté → JNSP, ne pas le scorer "OK"',
  'Si la gouvernance Tier 1 ne peut pas être tranchée → `UNKNOWN` = VETO par défaut (fail-closed)',
  'Si les annotations `@spec` sont absentes → `INCONNU` plutôt que "pas de drift"',
  'Dans le code : poser `// TODO-' + 'JNSP: <question>` ; le pre-commit bloque si présent',
];

// Helpers de rendu (DRY entre les 5 générateurs).
function formaterPuces(liste, fallback) {
  const items = liste && liste.length ? liste : fallback;
  return items.map((l) => `- ${l}`).join('\n');
}

function genererSectionIncertitudeMd(incertitude, { titre = 'Règles absolues — INCERTITUDE (Dire "je ne sais pas")' } = {}) {
  return `## ${titre}

${formaterPuces(incertitude, INCERTITUDE_DEFAUT)}`;
}

// ─── Génération des cibles ──────────────────────────────────────────────────

function frontmatterMdc({ description, globs, alwaysApply, intentId, tier, version, sourceHash }) {
  const lignes = [
    '---',
    `description: ${description}`,
    `globs: ${JSON.stringify(globs)}`,
    `alwaysApply: ${alwaysApply}`,
  ];
  if (intentId) lignes.push(`intent_id: ${intentId}`);
  if (tier !== undefined && tier !== null) lignes.push(`tier: ${tier}`);
  lignes.push(`generated-by: aiad-emit-rules v${version}`);
  lignes.push(`source-hash: ${sourceHash}`);
  lignes.push('---');
  return lignes.join('\n');
}

function genererAgentsMd({ identite, regles, intent, governance, version, sourceHash }) {
  const ids = Object.keys(governance).filter((k) => k.startsWith('AIAD-'));
  const fmt = (l) => `- ${l}`;
  return `${HEADER_REGEN_HTML}
---
generated-by: aiad-emit-rules v${version}
source-hash: ${sourceHash}
${intent ? `intent_id: ${intent.id}\n` : ''}---

# AGENTS.md

> Standard inter-outils (Claude Code, Cursor, Codex, Copilot, Gemini, …).
> Source de vérité : \`.aiad/AGENT-GUIDE.md\` + \`.aiad/gouvernance/\`.
> Régénéré par \`npx aiad-sdd emit-rules\` — toute modification manuelle sera écrasée.

## Identité

${identite.nom ? `**Projet** : ${identite.nom}` : '**Projet** : (à définir dans .aiad/AGENT-GUIDE.md)'}
${identite.description ? `**Description** : ${identite.description}` : ''}
${identite.domaine ? `**Domaine** : ${identite.domaine}` : ''}
${identite.mission ? `**Mission** : ${identite.mission}` : ''}

Tu es un **Product Engineer** au sens AIAD : gardien de l'intention tout au long du cycle de développement, en orchestrant des agents IA pour la réaliser sans la trahir.

## Principe fondamental — Human Authorship

La paternité de l'intention ne se délègue pas. Tu exécutes avec excellence, mais l'intention appartient toujours à l'humain. **En cas de doute sur l'intention, tu DEMANDES — tu n'inventes pas.**

## Cycle SDD

\`\`\`
Intent Statement → Research (GO/NO-GO) → SPEC → Execution Gate (SQS ≥ 4/5) → Exécution → Validation → Drift Lock
\`\`\`

${intent ? `### Intent actif\n\n- **${intent.id}** ${intent.titre ? `— ${intent.titre}` : ''}\n` : ''}

## Architecture documentaire

\`\`\`
.aiad/
├── PRD.md                  ← Vision produit
├── ARCHITECTURE.md         ← Standards techniques
├── AGENT-GUIDE.md          ← Contexte permanent + Lessons / Human Learnings
├── gouvernance/            ← Agents Tier 1 avec droit de veto
├── intents/                ← Intent Statements (POURQUOI)
├── specs/                  ← SPECs techniques (COMMENT)
├── facts/                  ← Traces /sdd fact
└── metrics/                ← traceability/, security/, audit/
\`\`\`

## Annotations machine-vérifiables (Drift Lock)

Tu DOIS poser ces annotations dans tout code applicatif :

| Tag | Format | Cardinalité |
|-----|--------|-------------|
| \`@intent\` | \`INTENT-NNN\` | 0..1 |
| \`@spec\` | \`SPEC-NNN-N-slug\` | **1..n** (obligatoire) |
| \`@verified-by\` | chemin relatif vers un test | 0..n |
| \`@governance\` | \`AIAD-RGPD,AIAD-AI-ACT,…\` | 0..1 |

Acceptés en JSDoc, commentaires \`//\` / \`#\`, docstrings Python.

## Règles absolues — TOUJOURS

${regles.toujours.length ? regles.toujours.map(fmt).join('\n') : '- Lire \`.aiad/AGENT-GUIDE.md\` en début de session\n- Synchroniser SPEC + code dans la même PR (Drift Lock)'}

## Règles absolues — JAMAIS

${regles.jamais.length ? regles.jamais.map(fmt).join('\n') : '- Coder sans SPEC validée (SQS ≥ 4/5)\n- Inventer une intention — toujours demander à l\'humain\n- Ignorer un veto d\'un agent de gouvernance Tier 1'}

${genererSectionIncertitudeMd(regles.incertitude)}

## Gouvernance Tier 1 (droit de veto)

| Agent | Déclenché quand… |
|-------|-------------------|
${ids.includes('AIAD-AI-ACT') ? '| **AIAD-AI-ACT** | Le code implique un composant IA (ML, LLM, scoring, recommandation) |\n' : ''}${ids.includes('AIAD-RGPD') ? '| **AIAD-RGPD** | Le code traite des données personnelles |\n' : ''}${ids.includes('AIAD-RGAA') ? '| **AIAD-RGAA** | Le code produit une interface utilisateur |\n' : ''}${ids.includes('AIAD-RGESN') ? '| **AIAD-RGESN** | Toute décision technique (performance, ressources, dépendances) |\n' : ''}
En cas de conflit SPEC ↔ gouvernance, **la gouvernance prévaut**.

## Outils

- \`npx aiad-sdd trace\` → matrice Intent ↔ SPEC ↔ Code ↔ Tests
- \`npx aiad-sdd emit-rules\` → régénère AGENTS.md, CLAUDE.md, .cursor/rules/, …
- \`npx aiad-sdd status\` → état du projet SDD

---

*Framework AIAD v${version} — aiad.ovh — Open Source*
`;
}

const CLAUDE_HEADER_START = '<!-- aiad-emit-rules:start -->';
const CLAUDE_HEADER_END = '<!-- aiad-emit-rules:end -->';

function genererClaudeMdHeader({ version, sourceHash, intent }) {
  const lignes = [
    CLAUDE_HEADER_START,
    HEADER_REGEN_HTML,
    `<!-- generated-by: aiad-emit-rules v${version} -->`,
    `<!-- source-hash: ${sourceHash} -->`,
  ];
  if (intent) lignes.push(`<!-- intent_id: ${intent.id} -->`);
  lignes.push('');
  lignes.push('> Ce fichier est synchronisé avec `AGENTS.md`, `.cursor/rules/` et `.codex/` via `npx aiad-sdd emit-rules`.');
  lignes.push('> La logique CLAUDE.md complète est conservée ci-dessous — seul ce header est régénéré.');
  lignes.push('>');
  lignes.push('> **Garde-fou JNSP** — En cas d\'incertitude (intention floue, critère non testable, gouvernance non décidable), tu DOIS répondre `JNSP : <question pour l\'humain>` plutôt qu\'inventer. Détail dans `AGENTS.md` section « INCERTITUDE ».');
  lignes.push(CLAUDE_HEADER_END);
  lignes.push('');
  return lignes.join('\n');
}

function genererCursorAiadMdc({ identite, regles, intent, version, sourceHash }) {
  const fm = frontmatterMdc({
    description: 'AIAD SDD — Product Engineer mindset (always-on)',
    globs: ['**/*'],
    alwaysApply: true,
    intentId: intent?.id || null,
    tier: null,
    version,
    sourceHash,
  });
  return `${fm}

${HEADER_REGEN_HTML}

# AIAD SDD — Cursor rules

Tu es un **Product Engineer** au sens AIAD. La paternité de l'intention ne se délègue pas — en cas de doute, tu **DEMANDES**.

${identite.nom ? `**Projet** : ${identite.nom}\n` : ''}${intent ? `**Intent actif** : ${intent.id}${intent.titre ? ` — ${intent.titre}` : ''}\n` : ''}

## Cycle SDD à respecter

\`Intent → Research (GO/NO-GO) → SPEC → Gate (SQS ≥ 4/5) → Exécution → Validation → Drift Lock\`

## Annotations obligatoires sur tout code

\`\`\`ts
/**
 * @intent INTENT-NNN
 * @spec SPEC-NNN-N-slug
 * @verified-by tests/path/file.test.ts
 * @governance AIAD-RGPD
 */
\`\`\`

## TOUJOURS

${regles.toujours.length ? regles.toujours.map((l) => `- ${l}`).join('\n') : '- Lire `.aiad/AGENT-GUIDE.md` en début de session\n- Synchroniser SPEC + code dans la même PR'}

## JAMAIS

${regles.jamais.length ? regles.jamais.map((l) => `- ${l}`).join('\n') : '- Coder sans SPEC validée (SQS ≥ 4/5)\n- Inventer une intention'}

${genererSectionIncertitudeMd(regles.incertitude, { titre: 'INCERTITUDE (Dire "je ne sais pas")' })}

## Gouvernance Tier 1 (droit de veto)

Quatre agents avec règles dédiées dans \`.cursor/rules/aiad-*.mdc\` (scopés via globs) :

- \`aiad-ai-act.mdc\` → composants IA (ML, LLM, scoring)
- \`aiad-rgpd.mdc\` → données personnelles
- \`aiad-rgaa.mdc\` → interfaces utilisateur
- \`aiad-rgesn.mdc\` → ressources serveur / performance

En conflit SPEC ↔ gouvernance, **la gouvernance prévaut**.

---

*Régénéré par \`npx aiad-sdd emit-rules\`. Source : \`.aiad/AGENT-GUIDE.md\`.*
`;
}

function condenserGouvernance(contenu, agentId) {
  // Extrait les sections « MISSION » + « RÈGLES ABSOLUES » + « JAMAIS » pour
  // un fichier .mdc condensé. Le fichier source complet reste dans
  // .aiad/gouvernance/ — la version Cursor est volontairement courte (Cursor
  // charge le fichier dans le contexte dès que les globs matchent).
  if (!contenu) return '';
  const sections = [];
  const mission = contenu.match(/##\s*MISSION[\s\S]*?(?=\n##\s|\n---|\Z)/i)?.[0];
  if (mission) sections.push(mission);
  const reglesToujours = contenu.match(/##\s*RÈGLES ABSOLUES\s*[—-]\s*TOUJOURS[\s\S]*?(?=\n##\s|\n---|\Z)/i)?.[0]
    || contenu.match(/##\s*RÈGLES ABSOLUES[\s\S]*?(?=\n##\s|\n---|\Z)/i)?.[0];
  if (reglesToujours) sections.push(reglesToujours);
  const jamais = contenu.match(/##\s*RÈGLES ABSOLUES\s*[—-]\s*JAMAIS[\s\S]*?(?=\n##\s|\n---|\Z)/i)?.[0];
  if (jamais) sections.push(jamais);
  const protocole = contenu.match(/##\s*PROTOCOLE DE SIGNALEMENT[\s\S]*?(?=\n##\s|\n---|\Z)/i)?.[0];
  if (protocole) sections.push(protocole);

  if (sections.length === 0) {
    // Fallback : 80 premières lignes du fichier source
    return contenu.split('\n').slice(0, 80).join('\n');
  }
  return sections.join('\n\n');
}

function genererCursorTier1Mdc(agentId, contenuSource, { intent, version, sourceHash }) {
  const fm = frontmatterMdc({
    description: DESCRIPTIONS_TIER1[agentId] || `${agentId} — règle de gouvernance Tier 1`,
    globs: GLOBS_TIER1[agentId] || ['**/*'],
    alwaysApply: false,
    intentId: intent?.id || null,
    tier: 1,
    version,
    sourceHash,
  });
  const condense = condenserGouvernance(contenuSource, agentId);
  return `${fm}

${HEADER_REGEN_HTML}

# ${agentId} — règle Cursor (Tier 1, droit de veto)

> Source : \`.aiad/gouvernance/${agentId}.md\` (référentiel complet — consulter en cas de doute).
> Cette version est **condensée** pour rester dans le budget contextuel de Cursor.

${condense}

---

*Régénéré par \`npx aiad-sdd emit-rules\`. Pour le détail légal complet, lire \`.aiad/gouvernance/${agentId}.md\`.*
`;
}

/**
 * Génère un subagent Claude Code de gouvernance Tier 1 (§3.1).
 *
 * Rend le droit de veto *enforced* par construction : l'agent est **read-only**
 * (`tools: Read, Grep, Glob` + `disallowedTools` d'écriture), auto-invoqué via
 * `description: PROACTIVELY`, scopé par `paths:` (mêmes globs que Cursor), et
 * doté d'une mémoire `project` versionnée (jurisprudence). Fail-closed : un
 * verdict `UNKNOWN` vaut VETO.
 *
 * @param {string} agentId
 * @param {string} contenuSource — contenu brut de `.aiad/gouvernance/<id>.md`
 * @param {{ intent: object|null, version: string, sourceHash: string }} ctx
 * @returns {string}
 */
function genererClaudeAgent(agentId, contenuSource, { intent, version, sourceHash }) {
  const globs = GLOBS_TIER1[agentId] || ['**/*'];
  const desc = `PROACTIVELY review any change touching its scope for ${DESCRIPTIONS_TIER1[agentId] || agentId} compliance. Read-only veto. Fail-closed: UNKNOWN = VETO.`;
  const condense = condenserGouvernance(contenuSource, agentId);
  const fm = [
    '---',
    `name: ${agentId}`,
    `description: ${desc}`,
    'tools: Read, Grep, Glob',
    'disallowedTools: Edit, Write, Bash, NotebookEdit',
    'model: inherit',
    'memory: project',
    `paths: ${JSON.stringify(globs)}`,
    `generated-by: aiad-emit-rules v${version}`,
    `source-hash: ${sourceHash}`,
    intent ? `intent_id: ${intent.id}` : null,
    '---',
  ].filter((l) => l !== null).join('\n');
  return `${fm}

${HEADER_REGEN_HTML}

# ${agentId} — Subagent de gouvernance Tier 1 (droit de veto)

## Execution Contract (non-negotiable)

- Tu es **lecture seule** : tu ne peux ni éditer, ni écrire, ni exécuter de commande. Ton verdict est consultatif pour le modèle mais **bloquant** au niveau du hook \`PreToolUse\`/\`Stop\`.
- Verdict ∈ { \`CONFORME\`, \`NON-CONFORME\`, \`UNKNOWN\` }. **\`UNKNOWN\` ⇒ VETO** (fail-closed).
- Tu cites une **evidence** (\`fichier:ligne\`) pour chaque verdict.
- Tu ne réécris jamais l'intention humaine : en cas de doute, tu poses une question (JNSP).

> Source : \`.aiad/gouvernance/${agentId}.md\` (référentiel légal complet — consulter en cas de doute).
> Version condensée pour le budget contextuel ; régénérée par \`npx aiad-sdd emit-rules\`.

${condense}

---

*Régénéré par \`npx aiad-sdd emit-rules\` depuis \`.aiad/gouvernance/${agentId}.md\` (source unique). Ne pas éditer à la main.*
`;
}

/**
 * Génère une règle `.claude/rules/<nom>.md` à chargement `paths:` (pull §3.7).
 * Chargée à froid uniquement quand un fichier de la zone de risque est touché —
 * complète (sans remplacer) le veto enforced (hook `PreToolUse`/`Stop` + subagent
 * read-only). Source unique : `.aiad/gouvernance/<agentId>.md`.
 *
 * @param {string} agentId — AIAD-RGPD | AIAD-RGAA | AIAD-AI-ACT | AIAD-RGESN
 * @param {string} contenuSource
 * @param {{ version: string, sourceHash: string }} ctx
 * @returns {string}
 */
function genererClaudeRule(agentId, contenuSource, { version, sourceHash }) {
  const globs = GLOBS_RULES[agentId] || ['**/*'];
  const condense = condenserGouvernance(contenuSource, agentId);
  const pathsYaml = globs.map((g) => `  - ${JSON.stringify(g)}`).join('\n');
  const fm = [
    '---',
    'paths:',
    pathsYaml,
    `generated-by: aiad-emit-rules v${version}`,
    `source-hash: ${sourceHash}`,
    '---',
  ].join('\n');
  return `${fm}

${HEADER_REGEN_HTML}

# ${DESCRIPTIONS_TIER1[agentId] || agentId} — règle à chargement ciblé (pull §3.7)

> Cette règle ne se charge à froid que sur les fichiers de sa zone de risque
> (frontmatter \`paths:\`). C'est de l'**advisory** allégé : le vrai garde-fou
> reste **enforced** par le hook \`PreToolUse\`/\`Stop\` et le subagent read-only
> \`.claude/agents/${agentId}.md\` (\`UNKNOWN = VETO\`, fail-closed).
> Source unique : \`.aiad/gouvernance/${agentId}.md\` — ne pas éditer à la main.

${condense}

---

*Régénéré par \`npx aiad-sdd emit-rules\` depuis \`.aiad/gouvernance/${agentId}.md\`.*
`;
}

function genererCodexAgent({ identite, regles, intent, version, sourceHash }) {
  return `${HEADER_REGEN_HTML}
---
generated-by: aiad-emit-rules v${version}
source-hash: ${sourceHash}
${intent ? `intent_id: ${intent.id}\n` : ''}---

# Codex Agent — AIAD SDD

${identite.nom ? `**Projet** : ${identite.nom}\n` : ''}**Cycle** : Intent → Research → SPEC → Gate → Exécution → Validation → Drift Lock

## Règles absolues

### TOUJOURS
${regles.toujours.length ? regles.toujours.map((l) => `- ${l}`).join('\n') : '- Lire `.aiad/AGENT-GUIDE.md`'}

### JAMAIS
${regles.jamais.length ? regles.jamais.map((l) => `- ${l}`).join('\n') : '- Coder sans SPEC validée'}

### INCERTITUDE (Dire "je ne sais pas")
${formaterPuces(regles.incertitude, INCERTITUDE_DEFAUT)}

## Annotations obligatoires

\`@intent\`, \`@spec\` (1..n), \`@verified-by\`, \`@governance\` — voir \`AGENTS.md\`.

## Gouvernance Tier 1

Voir \`.aiad/gouvernance/\` — droit de veto en cas de conflit.

---
*Régénéré par \`npx aiad-sdd emit-rules\`.*
`;
}

function genererGeminiMd({ identite, regles, intent, version, sourceHash }) {
  return `${HEADER_REGEN_HTML}
<!-- generated-by: aiad-emit-rules v${version} -->
<!-- source-hash: ${sourceHash} -->
${intent ? `<!-- intent_id: ${intent.id} -->\n` : ''}
# GEMINI.md — AIAD SDD

${identite.nom ? `**Projet** : ${identite.nom}\n` : ''}
Tu suis le cycle SDD AIAD : **Intent → Research → SPEC → Gate → Exécution → Validation → Drift Lock**.

## TOUJOURS
${regles.toujours.length ? regles.toujours.map((l) => `- ${l}`).join('\n') : '- Lire `.aiad/AGENT-GUIDE.md`'}

## JAMAIS
${regles.jamais.length ? regles.jamais.map((l) => `- ${l}`).join('\n') : '- Coder sans SPEC validée'}

## INCERTITUDE (Dire "je ne sais pas")
${formaterPuces(regles.incertitude, INCERTITUDE_DEFAUT)}

Voir \`AGENTS.md\` (source canonique) et \`.aiad/gouvernance/\` (Tier 1).

---
*Régénéré par \`npx aiad-sdd emit-rules\`.*
`;
}

// ─── Pipeline complet ───────────────────────────────────────────────────────

function calculerSourceHash({ agentGuide, governance, intent }) {
  const h = createHash('sha256');
  h.update(agentGuide || '');
  for (const k of Object.keys(governance).sort()) {
    h.update(`\n--${k}--\n`);
    h.update(governance[k]);
  }
  if (intent) h.update(`\n--intent--\n${intent.id}|${intent.titre || ''}`);
  return h.digest('hex').slice(0, 16);
}

function ecrireOuVerifier(destination, contenu, { check, projetDir, stats, dryRun = false }) {
  const rel = relative(projetDir, destination);
  if (check) {
    if (!existsSync(destination)) {
      logDrift(`${rel} (manquant)`);
      stats.drifts.push(rel);
      return;
    }
    const existant = readFileSync(destination, 'utf-8');
    if (existant === contenu) {
      logOk(rel);
      stats.unchanged++;
    } else {
      logDrift(rel);
      stats.drifts.push(rel);
    }
    return;
  }

  const result = mettreAJour(destination, contenu, { dryRun });
  const suffixe = dryRun ? `${C.gris} (dry-run)${C.reset}` : '';
  if (result === 'created') { logCreation(rel + suffixe); stats.created++; }
  else if (result === 'updated') { logMaj(rel + suffixe); stats.updated++; }
  else { logOk(rel + suffixe); stats.unchanged++; }
}

function maybeInjecterHeaderClaudeMd(projetDir, header, { check, stats, dryRun = false }) {
  const dest = join(projetDir, 'CLAUDE.md');
  const rel = relative(projetDir, dest);
  if (!existsSync(dest)) {
    // Pas de CLAUDE.md à toucher — emit-rules ne crée pas de CLAUDE.md tout
    // seul (c'est le rôle de `init`). On signale simplement.
    logSkip(rel, 'absent — `aiad-sdd init` d\'abord');
    return;
  }
  const contenu = readFileSync(dest, 'utf-8');

  // Idempotence : on délimite le header avec deux sentinels.
  const reBloc = new RegExp(
    `${CLAUDE_HEADER_START}[\\s\\S]*?${CLAUDE_HEADER_END}\\n*`,
    'm'
  );
  let nouveau;
  if (reBloc.test(contenu)) {
    nouveau = contenu.replace(reBloc, header);
  } else {
    nouveau = header + contenu;
  }

  if (check) {
    if (contenu === nouveau) { logOk(rel); stats.unchanged++; return; }
    logDrift(rel);
    stats.drifts.push(rel);
    return;
  }
  if (contenu === nouveau) { logOk(rel); stats.unchanged++; return; }
  if (!dryRun) writeFileSync(dest, nouveau, 'utf-8');
  const suffixe = dryRun ? `${C.gris} (dry-run)${C.reset}` : '';
  logMaj(rel + suffixe);
  stats.updated++;
}

// ─── Entrée publique ────────────────────────────────────────────────────────

export async function emitRules(projetDir, options = {}) {
  const {
    runtimes = ['all'],
    check = false,
    force = false, // réservé pour parité — emit-rules régénère toujours
    dryRun = false,
    skipLock = false, // réservé aux tests qui veulent observer l'attente
  } = options;

  // En mode --check ou --dry-run, on ne touche à rien sur disque → pas
  // besoin de lock. Sinon on protège la régénération via un verrou.
  if (check || dryRun || skipLock) {
    return _emitRulesImpl(projetDir, { runtimes, check, force, dryRun });
  }
  const lockPath = join(projetDir, '.aiad', '.emit-rules.lock');
  return avecLock(lockPath, () =>
    _emitRulesImpl(projetDir, { runtimes, check, force, dryRun }),
  );
}

async function _emitRulesImpl(projetDir, options = {}) {
  const {
    runtimes = ['all'],
    check = false,
    force = false,
    dryRun = false,
  } = options;

  // Validation runtimes
  for (const r of runtimes) {
    if (!RUNTIMES_VALIDES.includes(r)) {
      throw new Error(
        `Runtime inconnu : "${r}". Valeurs acceptées : ${RUNTIMES_VALIDES.join(', ')}`,
      );
    }
  }
  const allRuntimes = runtimes.includes('all');
  const wants = (r) => allRuntimes || runtimes.includes(r);

  const version = lirePackageVersion();
  const agentGuide = lireAgentGuide(projetDir);
  const governance = lireGouvernance(projetDir);
  const intent = lireIntentActif(projetDir);

  if (!agentGuide) {
    throw new Error(
      ".aiad/AGENT-GUIDE.md introuvable. Lance `npx aiad-sdd init` d'abord.",
    );
  }

  const sourceHash = calculerSourceHash({ agentGuide, governance, intent });
  const identite = extraireIdentite(agentGuide);
  const regles = extraireReglesAbsolues(agentGuide);

  const ctx = { identite, regles, intent, governance, version, sourceHash };

  console.log(`
${C.cyan}${C.gras}  AIAD SDD Mode — emit-rules v${version}${C.reset}
${C.gris}  ${check ? 'Vérification de parité' : 'Régénération multi-runtime'} (source-hash: ${sourceHash})${C.reset}
${C.gris}  Cibles : ${runtimes.join(', ')}${intent ? `   Intent actif : ${intent.id}` : ''}${C.reset}
`);

  const stats = { created: 0, updated: 0, unchanged: 0, drifts: [] };

  // 1. AGENTS.md (toujours, source canonique multi-outils)
  console.log(`\n${C.gras}  AGENTS.md (standard inter-outils)${C.reset}\n`);
  ecrireOuVerifier(
    join(projetDir, 'AGENTS.md'),
    genererAgentsMd(ctx),
    { check, projetDir, stats, dryRun }
  );

  // 2. Claude Code — header de cohérence + subagents de gouvernance Tier 1
  if (wants('claude-code')) {
    console.log(`\n${C.gras}  Claude Code (CLAUDE.md header)${C.reset}\n`);
    maybeInjecterHeaderClaudeMd(
      projetDir,
      genererClaudeMdHeader(ctx),
      { check, stats, dryRun }
    );

    // Subagents Tier 1 enforced (§3.1) : read-only + veto fail-closed.
    console.log(`\n${C.gras}  Claude Code (.claude/agents/AIAD-*.md — Tier 1)${C.reset}\n`);
    for (const agentId of ['AIAD-RGPD', 'AIAD-RGAA', 'AIAD-AI-ACT', 'AIAD-RGESN']) {
      if (!governance[agentId]) {
        logSkip(`.claude/agents/${agentId}.md`, 'gouvernance absente');
        continue;
      }
      ecrireOuVerifier(
        join(projetDir, '.claude', 'agents', `${agentId}.md`),
        genererClaudeAgent(agentId, governance[agentId], ctx),
        { check, projetDir, stats, dryRun }
      );
    }

    // Règles à chargement ciblé `paths:` (pull §3.7) : gouvernance advisory
    // chargée à froid uniquement sur sa zone de risque. Complète le veto enforced.
    console.log(`\n${C.gras}  Claude Code (.claude/rules/*.md — pull paths:)${C.reset}\n`);
    for (const agentId of ['AIAD-RGPD', 'AIAD-RGAA', 'AIAD-AI-ACT', 'AIAD-RGESN']) {
      if (!governance[agentId]) {
        logSkip(`.claude/rules/${nomRule(agentId)}.md`, 'gouvernance absente');
        continue;
      }
      ecrireOuVerifier(
        join(projetDir, '.claude', 'rules', `${nomRule(agentId)}.md`),
        genererClaudeRule(agentId, governance[agentId], ctx),
        { check, projetDir, stats, dryRun }
      );
    }
  }

  // 3. Cursor — règle principale + 4 règles Tier 1
  if (wants('cursor')) {
    console.log(`\n${C.gras}  Cursor (.cursor/rules/*.mdc)${C.reset}\n`);
    ecrireOuVerifier(
      join(projetDir, '.cursor', 'rules', 'aiad.mdc'),
      genererCursorAiadMdc(ctx),
      { check, projetDir, stats, dryRun }
    );
    for (const agentId of ['AIAD-RGPD', 'AIAD-RGAA', 'AIAD-AI-ACT', 'AIAD-RGESN']) {
      if (!governance[agentId]) {
        logSkip(`.cursor/rules/${agentId.toLowerCase()}.mdc`, 'gouvernance absente');
        continue;
      }
      ecrireOuVerifier(
        join(projetDir, '.cursor', 'rules', `${agentId.toLowerCase()}.mdc`),
        genererCursorTier1Mdc(agentId, governance[agentId], ctx),
        { check, projetDir, stats, dryRun }
      );
    }
  }

  // 4. Codex — optionnel
  if (wants('codex')) {
    console.log(`\n${C.gras}  Codex (.codex/AGENT.md)${C.reset}\n`);
    ecrireOuVerifier(
      join(projetDir, '.codex', 'AGENT.md'),
      genererCodexAgent(ctx),
      { check, projetDir, stats, dryRun }
    );
  }

  // 5. Copilot — délégué à AGENTS.md (Copilot lit AGENTS.md natively depuis 2025)
  if (wants('copilot')) {
    console.log(`\n${C.gras}  GitHub Copilot${C.reset}\n`);
    log(`${C.vert}↪${C.reset}`, `AGENTS.md ${C.gris}(Copilot lit AGENTS.md depuis 2025 — pas de fichier dédié)${C.reset}`);
  }

  // 6. Gemini — optionnel
  if (wants('gemini')) {
    console.log(`\n${C.gras}  Gemini (GEMINI.md)${C.reset}\n`);
    ecrireOuVerifier(
      join(projetDir, 'GEMINI.md'),
      genererGeminiMd(ctx),
      { check, projetDir, stats, dryRun }
    );
  }

  // Résumé
  if (check) {
    if (stats.drifts.length > 0) {
      console.log(`
${C.rouge}${C.gras}  ✗ Divergence détectée (${stats.drifts.length} fichier(s))${C.reset}

${stats.drifts.map((d) => `    - ${d}`).join('\n')}

${C.gris}  Régénère avec :  ${C.reset}${C.cyan}npx aiad-sdd emit-rules${C.reset}
`);
      // L'exit code est décidé par l'appelant (bin/aiad-sdd.js) qui consulte
      // stats.drifts. Cela rend la fonction testable sans tuer le process.
    } else {
      console.log(`
${C.vert}${C.gras}  ✓ Tous les fichiers émis sont synchronisés avec AGENT-GUIDE.${C.reset}

  ${C.vert}✓${C.reset} ${stats.unchanged} à jour    source-hash: ${sourceHash}

  ${C.gris}aiad-sdd v${version} — aiad.ovh${C.reset}
`);
    }
    return stats;
  }

  console.log(`
${C.cyan}${C.gras}  emit-rules terminé !${C.reset}

  ${C.vert}+${C.reset} ${stats.created} créé(s)    ${C.cyan}↑${C.reset} ${stats.updated} régénéré(s)    ${C.vert}✓${C.reset} ${stats.unchanged} inchangé(s)

${C.gras}  AIAD est désormais source amont — Claude Code, Cursor, Codex, Copilot${C.reset}
${C.gras}  et Gemini lisent les mêmes règles dérivées de \`.aiad/AGENT-GUIDE.md\`.${C.reset}

${C.gras}  Pour vérifier la parité en CI :${C.reset}  ${C.cyan}npx aiad-sdd emit-rules --check${C.reset}

  ${C.gris}aiad-sdd v${version} — aiad.ovh${C.reset}
`);

  return stats;
}
