#!/usr/bin/env node
// AIAD SDD — PreToolUse hook : veto Tier 1 enforced (§3.1 levier 3)
//
// Avant un `git commit`, exécute le veto déterministe
// (`aiad-sdd veto --output-format verdict`, exit 0=PASS / 2=VETO) et REFUSE
// le commit (permissionDecision: deny + exit 2) si du code touche une zone
// réglementée Tier 1 (RGPD/RGAA/AI-ACT) sans annotation `@governance`.
// Fail-closed : UNKNOWN = VETO. Le subagent read-only tranche la conformité ;
// ce hook garantit qu'aucun changement réglementé ne passe sans preuve de revue.
//
// Self-contained par portabilité.
//
// @intent INTENT-015
// @spec SPEC-015-3-matrice-garde-fous
// @governance AIAD-AI-ACT,AIAD-RGPD,AIAD-RGAA
//
// NON-BYPASSABLE (C3 de RESEARCH-018) : le veto Tier 1 fail-closed n'honore
// PAS `AIAD_HOOK_SILENT` — contrairement aux hooks advisory. Le dernier
// recours reste `git commit --no-verify` (hors-harness, tracé). L'audit
// `test/guardrails.test.js` échoue si un early-return `AIAD_HOOK_SILENT`
// réapparaît ici.
// Documentation : https://aiad.ovh

import process from 'node:process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// Lit l'entrée du hook (JSON sur stdin) et renvoie la commande Bash visée.
// Retourne '' hors harness (terminal) ou si l'entrée est illisible.
function lireCommandeBash() {
  try {
    if (process.stdin.isTTY) return '';
    const data = readFileSync(0, { encoding: 'utf-8' });
    if (!data.trim()) return '';
    const obj = JSON.parse(data);
    return String(obj?.tool_input?.command ?? obj?.command ?? '').trim();
  } catch {
    return '';
  }
}

function refuser(raison) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: raison,
    },
  }));
  process.stderr.write(raison + '\n');
  return 2;
}

function resoudreCli(projectDir) {
  const devBin = join(projectDir, 'bin', 'aiad-sdd.js');
  if (existsSync(devBin)) return { cmd: 'node', base: [devBin] };
  const localBin = join(projectDir, 'node_modules', '.bin', 'aiad-sdd');
  if (existsSync(localBin)) return { cmd: localBin, base: [] };
  return { cmd: 'npx', base: ['--no-install', 'aiad-sdd'] };
}

function main() {
  // Pas de bypass `AIAD_HOOK_SILENT` ici : le veto Tier 1 est non-bypassable
  // (C3 de SPEC-015-3). Garde anti-régression : test/guardrails.test.js.
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!existsSync(join(projectDir, '.aiad'))) return 0;

  // Le veto ne concerne que `git commit`. Le filtre `if` du settings.json le
  // garantit déjà ; on le refait ici pour ne dépendre d'aucune version du harness.
  const commande = lireCommandeBash();
  if (commande && !/(^|[;&|]\s*)git\s+(-[^\s]+\s+)*commit\b/.test(commande)) return 0;

  const { cmd, base } = resoudreCli(projectDir);
  const args = [...base, 'veto', '--output-format', 'verdict'];

  let stdout = '';
  let code = 0;
  try {
    stdout = execFileSync(cmd, args, { cwd: projectDir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    stdout = (e && e.stdout) ? String(e.stdout) : '';
    code = (e && typeof e.status === 'number') ? e.status : 1;
  }

  let env = null;
  try { env = JSON.parse(stdout.trim().split('\n').pop() || 'null'); } catch { env = null; }
  const verdict = env && typeof env.verdict === 'string' ? env.verdict : null;

  // Fail-closed : sans verdict lisible, rien n'a été vérifié → refus.
  // (CLI absente du projet, plantage, sortie illisible.)
  if (!verdict) {
    return refuser(
      'Veto Tier 1 non vérifié : la CLI aiad-sdd est introuvable ou n\'a produit aucun verdict.\n' +
      'Installe-la dans le projet (npm install --save-dev aiad-sdd) puis recommence.\n' +
      'Un humain peut passer outre, hors agent, avec `git commit --no-verify` (tracé).'
    );
  }

  if (code === 0 && verdict === 'PASS') return 0;

  const violations = Array.isArray(env.violations) ? env.violations : [];
  const liste = violations.slice(0, 15).map((v) => `  - ${v.file} → revue ${v.agent} requise`).join('\n');
  return refuser(
    `Veto Tier 1 (fail-closed) : ${violations.length} fichier(s) en zone réglementée sans revue de gouvernance tracée.\n` +
    `${liste}\n` +
    'Ne pose pas toi-même l\'annotation @governance : elle atteste une revue. ' +
    'Demande à l\'humain responsable de faire trancher l\'agent de gouvernance concerné et de valider le résultat.'
  );
}

let codeSortie;
try {
  codeSortie = main();
} catch {
  // Fail-closed : une erreur interne du veto ne vaut jamais autorisation.
  codeSortie = refuser('Veto Tier 1 non vérifié : erreur interne du hook. Un humain peut passer outre avec `git commit --no-verify`.');
}
process.exitCode = codeSortie;
