#!/usr/bin/env node
// AIAD SDD — PreToolUse hook : garde-fou TODO-JNSP (§3.2)
//
// Bloque (permissionDecision: deny + exit 2) tout `git commit` tant qu'un
// marqueur de question agent→humain non tranchée subsiste dans le code stagé.
// Le `pre-commit.sh` reste le filet (défense en profondeur, hors-harness).
//
// Self-contained par portabilité (un hook embarqué ne peut importer lib/).
// La regex de marqueur est tenue alignée avec `lib/jnsp.js` par le test
// `test/jnsp.test.js` (JNSP_REGEX_SOURCE).
//
// Modulation par effort : `--effort high|max` étend le scan au working tree.
// Bypass : export AIAD_HOOK_SILENT=1
// Documentation : https://aiad.ovh

import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Token en morceaux → ce fichier ne se déclenche pas lui-même.
const TOKEN = 'TODO-' + 'JNSP';
const MARQUEUR = new RegExp(`(^|[^\`])\\s*(//|/\\*|<!--|--|#|;|%|\\*)\\s*${TOKEN}:`);

function git(args) {
  return execFileSync('git', args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function estFichierCode(chemin) {
  return chemin && !/\.(md|markdown|mdx)$/i.test(chemin);
}

// Lit le stdin Claude Code hook (JSON tool input) et renvoie la commande bash.
// Retourne '' si stdin est un terminal ou non-parseable (exécution hors harness).
function lireCommandeBash() {
  try {
    if (process.stdin.isTTY) return '';  // pas de pipe → hors harness
    const data = readFileSync('/dev/stdin', { encoding: 'utf-8' });
    if (!data.trim()) return '';
    const obj = JSON.parse(data);
    return (obj?.tool_input?.command ?? obj?.command ?? '').trim();
  } catch {
    return '';
  }
}

// Lit hook-bypass.yml et retourne la liste des patterns whitelistés.
function lireBypass() {
  try {
    const repo = git(['rev-parse', '--show-toplevel']).trim();
    const contenu = readFileSync(repo + '/.aiad/hook-bypass.yml', 'utf-8');
    return contenu.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && /^-\s/.test(l))
      .map(l => l.replace(/^-\s+/, '').replace(/^['"]|['"]$/g, '').trim())
      .filter(Boolean);
  } catch { return []; }
}

function globToRegex(pattern) {
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + esc.replace(/\*\*/g, '.+').replace(/\*/g, '[^/]+') + '$');
}

function estBypasse(chemin, patterns) {
  if (!patterns.length) return false;
  const base = chemin.split('/').pop();
  return patterns.some(p => {
    const rx = globToRegex(p);
    return p.includes('/') ? rx.test(chemin) : rx.test(base);
  });
}

function main() {
  if (process.env.AIAD_HOOK_SILENT === '1') return 0;

  // Ne scanner que sur git commit — lit l'input Claude Code via stdin.
  // Sans stdin (exécution hors harness ou outil non-Bash), on laisse passer.
  const commande = lireCommandeBash();
  if (commande && !/^\s*git\s+commit\b/.test(commande)) return 0;

  // Effort : --effort <niveau> (ou ${CLAUDE_EFFORT} substitué par le harness).
  const idx = process.argv.indexOf('--effort');
  const effort = (idx >= 0 ? process.argv[idx + 1] : process.env.CLAUDE_EFFORT || 'medium').toLowerCase();
  const large = effort === 'high' || effort === 'max' || effort === 'xhigh';

  const bypassPatterns = lireBypass();

  // Liste des fichiers concernés.
  let fichiers = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
    .split('\n').map((s) => s.trim()).filter(Boolean);
  if (large) {
    const wt = git(['diff', '--name-only', '--diff-filter=ACMR']).split('\n').map((s) => s.trim()).filter(Boolean);
    fichiers = [...new Set([...fichiers, ...wt])];
  }
  fichiers = fichiers
    .filter(estFichierCode)
    .filter(f => !estBypasse(f, bypassPatterns));
  if (fichiers.length === 0) return 0;

  const hits = [];
  for (const f of fichiers) {
    let contenu = '';
    try { contenu = git(['show', `:${f}`]); }
    catch { try { contenu = git(['show', `HEAD:${f}`]); } catch { contenu = ''; } }
    const lignes = contenu.split('\n');
    for (let i = 0; i < lignes.length; i++) {
      if (MARQUEUR.test(lignes[i])) hits.push(`  - ${f}:${i + 1} ${lignes[i].trim()}`);
    }
  }

  if (hits.length === 0) return 0;

  const liste = hits.slice(0, 20).join('\n') + (hits.length > 20 ? `\n  … (+${hits.length - 20} autres)` : '');
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `Garde-fou JNSP : ${hits.length} marqueur(s) ${TOKEN} non résolu(s) dans le code stagé.\n` +
        `${liste}\n` +
        `Tranche la question (remplace le marqueur par la décision humaine) avant de committer.`,
    },
  }));
  return 2;
}

try {
  process.exit(main());
} catch {
  // Un hook qui plante ne doit jamais bloquer spuriously — le pre-commit.sh
  // reste le filet. Sortie ouverte (exit 0).
  process.exit(0);
}
