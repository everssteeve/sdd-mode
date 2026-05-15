// AIAD SDD Mode — Auto-complétion shell (item #107).
//
// **Cap stratégique** : `aiad-sdd` expose ~50 commandes — sans
// auto-complétion, la friction d'usage quotidien est élevée. Ce module
// génère des scripts à sourcer pour **bash**, **zsh** et **fish** qui :
//
//   1. complètent les noms de commandes (`init`, `trace`, `archive`…)
//   2. complètent les sous-commandes connues (`gitlab review`, `sla check`…)
//   3. complètent les flags fréquents (`--json`, `--dry-run`, `--out`…)
//   4. complètent dynamiquement les IDs Intent/SPEC depuis `.aiad/`
//      en déléguant à `aiad-sdd completion --complete "<line>"`.
//
// **Zero-dep** : pas de générateur externe (yargs/oclif/etc.) — uniquement
// du shell pur côté script + un module Node pour l'évaluation dynamique.
//
// Usage utilisateur :
//   aiad-sdd completion bash >> ~/.bashrc
//   aiad-sdd completion zsh  >> ~/.zshrc
//   aiad-sdd completion fish >  ~/.config/fish/completions/aiad-sdd.fish
//
// Documentation : https://aiad.ovh/completion

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { C, logHeader } from './term.js';

// ─── Structure des commandes ────────────────────────────────────────────────

/**
 * Description statique des commandes pour l'auto-complétion. Mise à jour
 * en parallèle de `bin/aiad-sdd.js` quand une nouvelle commande est ajoutée.
 *
 * `subs` : sous-commandes connues (ex. "gitlab review")
 * `flags` : flags les plus utiles à compléter
 * `dynamic` : type de candidat dynamique attendu en argument
 *   - 'intent' : ID Intent (INT-NNN)
 *   - 'spec' : ID SPEC (SPEC-NNN-N-slug)
 *   - 'archive-intent-or-spec' : Intent OU SPEC, ouvert OU archivé
 *   - null : aucune complétion dynamique
 */
export const STRUCTURE_CMD = {
  init: { subs: [], flags: ['--minimal', '--upgrade', '--runtime', '--with-git-hooks', '--force', '--dry-run', '-i', '--interactive'] },
  update: { subs: [], flags: ['--check', '--sans-gouvernance', '--dry-run'] },
  upgrade: { subs: [], flags: [] },
  gouvernance: { subs: ['lint'], flags: ['--pack', '--pack-from'] },
  hooks: { subs: [], flags: ['--uninstall', '--force'] },
  status: { subs: [], flags: ['--json', '--markdown'] },
  doctor: { subs: [], flags: ['--json', '--markdown', '--quiet', '--fix', '--supplementaire', '--strict-sante'] },
  brief: { subs: [], flags: ['--json', '--markdown', '--quiet', '--strict', '--strict-tests', '--diff', '--public-url', '--out'] },
  standup: { subs: [], flags: ['--json', '--markdown', '--lens', '--open', '--all', '--regen', '--serve', '--port', '--public-url'] },
  badge: { subs: [], flags: ['--type', '--all', '--out', '--dry-run', '--json', '--label', '--shields-endpoint'] },
  skills: { subs: ['validate'], flags: [] },
  repl: { subs: [], flags: [] },
  migrate: { subs: [], flags: ['--force', '--dry-run'] },
  workspace: { subs: ['doctor', 'trace'], flags: ['--json', '--markdown', '--quiet', '--config'] },
  'ai-act': { subs: ['audit'], flags: ['--out', '--json'] },
  sbom: { subs: [], flags: ['--out', '--json'] },
  'verify-reproducibility': { subs: [], flags: ['--expected', '--json'] },
  dpia: { subs: [], flags: ['--out', '--json'] },
  docs: { subs: [], flags: ['--check'] },
  telemetry: { subs: ['opt-in', 'opt-out', 'status'], flags: ['--json'] },
  uninstall: { subs: [], flags: ['--force', '--purge'] },
  bench: { subs: [], flags: ['--json'] },
  trace: { subs: [], flags: ['--format', '--out', '--json', '--fail-on-gap', '--quiet', '--watch', '--suggest', '--dry-run'] },
  dashboard: { subs: [], flags: ['--out', '--quiet', '--serve', '--watch', '--port', '--public-url', '--check', '--full', '--source-base'] },
  'emit-rules': { subs: [], flags: ['--runtime', '--check'] },
  new: { subs: [], flags: ['--list', '--force'] },
  import: { subs: [], flags: ['--from', '--force', '--dry-run'] },
  score: { subs: ['intent', 'spec'], flags: ['--json'], dynamic: 'intent-or-spec' },
  template: { subs: [], flags: ['--out'] },
  review: { subs: [], flags: ['--out', '--json'] },
  'suggest-annotations': { subs: [], flags: ['--json'] },
  export: { subs: ['openapi', 'confluence'], flags: ['--out', '--format', '--json', '--dry-run'] },
  storybook: { subs: [], flags: ['--out', '--dry-run', '--json'] },
  cert: { subs: ['matrix', 'exam', 'badge', 'verify'], flags: ['--niveau', '--candidat', '--axes', '--json'] },
  marketplace: { subs: ['list', 'info'], flags: [] },
  audit: { subs: ['log', 'verify', 'append'], flags: ['--json'] },
  provenance: { subs: ['generate', 'verify', 'sigstore'], flags: ['--out', '--dry-run', '--json'] },
  'hook-stats': { subs: [], flags: ['--json'] },
  dinum: { subs: ['publiccode', 'franceconnect', 'check'], flags: ['--out', '--from', '--niveau', '--lang', '--json', '--dry-run'] },
  sovereignty: { subs: [], flags: ['--check', '--json'] },
  adrs: { subs: [], flags: ['--json'] },
  dora: { subs: [], flags: ['--record', '--import-git', '--since', '--status', '--cycle', '--lead', '--release', '--commit', '--date', '--json'] },
  'self-update': { subs: [], flags: ['--json'] },
  gitlab: { subs: ['review', 'issue', 'wiki'], flags: ['--mr', '--branch', '--intent', '--spec', '--project', '--token', '--dry-run', '--json'] },
  azure: { subs: ['pr', 'work-item', 'wiki'], flags: ['--id', '--branch', '--intent', '--spec', '--org', '--project', '--repo', '--wiki', '--token', '--dry-run', '--json'] },
  webhooks: { subs: ['list', 'test', 'emit'], flags: ['--type', '--dry-run', '--json'] },
  reflect: { subs: [], flags: ['--since', '--jours', '--json'] },
  negotiate: { subs: [], flags: ['--out', '--json'], dynamic: 'intent' },
  'refactor-spec': { subs: [], flags: ['--ai', '--all', '--json'], dynamic: 'spec' },
  'spec-version': { subs: ['check', 'bump'], flags: ['--from', '--dry-run', '--json'], dynamic: 'spec' },
  archive: { subs: [], flags: ['--reason', '--list', '--restore', '--dry-run', '--json'], dynamic: 'archive-intent-or-spec' },
  sla: { subs: ['show', 'check', 'update'], flags: ['--dry-run', '--json'] },
  completion: { subs: ['bash', 'zsh', 'fish'], flags: ['--complete'] },
  help: { subs: [], flags: [] },
  version: { subs: [], flags: [] },
};

const SHELLS_VALIDES = ['bash', 'zsh', 'fish'];

// ─── Listing des candidats dynamiques ──────────────────────────────────────

/**
 * Liste les IDs Intent depuis `.aiad/intents/`.
 */
export function listerIntents(racine) {
  const dir = join(racine, '.aiad', 'intents');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && /^INT-/.test(f))
    .map((f) => f.replace(/\.md$/, ''));
}

/**
 * Liste les IDs SPEC depuis `.aiad/specs/`.
 */
export function listerSpecs(racine) {
  const dir = join(racine, '.aiad', 'specs');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && /^SPEC-/.test(f))
    .map((f) => f.replace(/\.md$/, ''));
}

/**
 * Liste les IDs Intent + SPEC, ouverts et archivés (utilisé par `archive`).
 */
export function listerArtefactsArchive(racine) {
  const out = [];
  for (const sous of ['intents', 'specs']) {
    for (const variante of [join(racine, '.aiad', sous), join(racine, '.aiad', sous, 'archive')]) {
      if (!existsSync(variante)) continue;
      for (const f of readdirSync(variante)) {
        if (f.endsWith('.md') && /^(INT|SPEC)-/.test(f)) {
          out.push(f.replace(/\.md$/, ''));
        }
      }
    }
  }
  return [...new Set(out)];
}

// ─── Completer (utilisé par les scripts shell) ─────────────────────────────

/**
 * Retourne la liste de candidats pour une ligne `aiad-sdd …` donnée.
 *
 * Stratégie simple :
 *   - 1 mot après `aiad-sdd` → noms de commandes
 *   - 2 mots, commande connue avec subs → sous-commandes
 *   - 2/3 mots, commande avec dynamic → IDs depuis .aiad/
 *   - mot commençant par `--` → flags de la commande
 *
 * @param {string} line — ligne complète (`aiad-sdd … <curseur>`)
 * @param {string} racine — racine projet pour candidats dynamiques
 * @returns {string[]}
 */
export function completer(line, racine) {
  const tokens = String(line || '').split(/\s+/).filter(Boolean);
  // On retire "aiad-sdd" si présent
  if (tokens[0] === 'aiad-sdd') tokens.shift();
  const courant = (line.endsWith(' ') ? '' : tokens[tokens.length - 1] || '');
  const dejaSaisis = line.endsWith(' ') ? tokens : tokens.slice(0, -1);

  // Position 1 : nom de commande
  if (dejaSaisis.length === 0) {
    return Object.keys(STRUCTURE_CMD).filter((c) => c.startsWith(courant));
  }
  const cmd = dejaSaisis[0];
  const meta = STRUCTURE_CMD[cmd];
  if (!meta) return [];

  // Flag mode
  if (courant.startsWith('--')) {
    return meta.flags.filter((f) => f.startsWith(courant));
  }

  // Position 2 : sous-commande connue ou candidat dynamique
  if (dejaSaisis.length === 1) {
    const candidats = [];
    for (const s of meta.subs) {
      if (s.startsWith(courant)) candidats.push(s);
    }
    if (meta.dynamic) {
      for (const id of candidatsDynamiques(meta.dynamic, racine)) {
        if (id.toLowerCase().startsWith(courant.toLowerCase())) candidats.push(id);
      }
    }
    return candidats;
  }

  // Position 3 : sous-sous-commande dynamique (ex. spec-version bump <SPEC-ID>)
  if (dejaSaisis.length === 2 && meta.dynamic) {
    return candidatsDynamiques(meta.dynamic, racine).filter((id) => id.toLowerCase().startsWith(courant.toLowerCase()));
  }

  return [];
}

function candidatsDynamiques(kind, racine) {
  if (kind === 'intent') return listerIntents(racine);
  if (kind === 'spec') return listerSpecs(racine);
  if (kind === 'intent-or-spec') return [...listerIntents(racine), ...listerSpecs(racine)];
  if (kind === 'archive-intent-or-spec') return listerArtefactsArchive(racine);
  return [];
}

// ─── Génération des scripts shell ──────────────────────────────────────────

/**
 * Génère le script bash.
 */
export function genererScriptBash() {
  return `# aiad-sdd bash completion (auto-généré par aiad-sdd completion bash)
_aiad_sdd_complete() {
  local line="\${COMP_LINE}"
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  # Délégation au CLI pour les complétions dynamiques (Intent/SPEC IDs)
  local results
  results=$(aiad-sdd completion --complete "$line" 2>/dev/null)
  COMPREPLY=( $(compgen -W "$results" -- "$cur") )
  return 0
}
complete -F _aiad_sdd_complete aiad-sdd
`;
}

/**
 * Génère le script zsh.
 *
 * Note : zsh accepte `compdef _aiad_sdd_complete aiad-sdd`. La fonction
 * de complétion zsh peut consommer la même API CLI que bash via
 * `compadd`, qui ajoute les candidats à la liste de complétion.
 */
export function genererScriptZsh() {
  return `# aiad-sdd zsh completion (auto-généré par aiad-sdd completion zsh)
# À sourcer dans ~/.zshrc ou placé dans \$fpath puis \`autoload -U _aiad_sdd\`
_aiad_sdd_complete() {
  local line="\${BUFFER}"
  local results
  results=("\${(@f)$(aiad-sdd completion --complete "$line" 2>/dev/null)}")
  compadd -- "\${results[@]}"
}
compdef _aiad_sdd_complete aiad-sdd
`;
}

/**
 * Génère le script fish.
 */
export function genererScriptFish() {
  return `# aiad-sdd fish completion (auto-généré par aiad-sdd completion fish)
# À placer dans ~/.config/fish/completions/aiad-sdd.fish
function __aiad_sdd_complete
  set -l line (commandline -cp)
  aiad-sdd completion --complete "$line" 2>/dev/null
end
complete -c aiad-sdd -f -a '(__aiad_sdd_complete)'
`;
}

/**
 * Renvoie le script pour un shell donné.
 */
export function scriptPour(shell) {
  if (!SHELLS_VALIDES.includes(shell)) {
    throw new Error(`Shell inconnu : "${shell}". Valides : ${SHELLS_VALIDES.join(', ')}.`);
  }
  if (shell === 'bash') return genererScriptBash();
  if (shell === 'zsh') return genererScriptZsh();
  return genererScriptFish();
}

// ─── CLI ────────────────────────────────────────────────────────────────────

export function emettre(racine, options = {}) {
  // Mode complétion dynamique : appelé par les scripts shell.
  if (options.complete !== undefined) {
    const candidats = completer(options.complete, racine);
    process.stdout.write(candidats.join('\n') + (candidats.length > 0 ? '\n' : ''));
    return candidats;
  }
  const shell = options.shell;
  if (!shell) {
    logHeader('AIAD SDD — Shell completion', 'Usage : aiad-sdd completion bash|zsh|fish');
    console.log('');
    console.log('  Bash : aiad-sdd completion bash >> ~/.bashrc');
    console.log('  Zsh  : aiad-sdd completion zsh  >> ~/.zshrc');
    console.log('  Fish : aiad-sdd completion fish >  ~/.config/fish/completions/aiad-sdd.fish');
    console.log('');
    return null;
  }
  const script = scriptPour(shell);
  process.stdout.write(script);
  return script;
}

// ─── Aliases EN canoniques ──────────────────────────────────────────────────

export {
  listerIntents as listIntents,
  listerSpecs as listSpecs,
  listerArtefactsArchive as listArchiveArtifacts,
  completer as complete,
  genererScriptBash as generateBashScript,
  genererScriptZsh as generateZshScript,
  genererScriptFish as generateFishScript,
  scriptPour as scriptFor,
  emettre as emit,
};

export const CONSTANTS = {
  SHELLS_VALIDES,
};
