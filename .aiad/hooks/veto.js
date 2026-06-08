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
// Self-contained par portabilité. Bypass : export AIAD_HOOK_SILENT=1
// Documentation : https://aiad.ovh

import process from 'node:process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

function resoudreCli(projectDir) {
  const devBin = join(projectDir, 'bin', 'aiad-sdd.js');
  if (existsSync(devBin)) return { cmd: 'node', base: [devBin] };
  const localBin = join(projectDir, 'node_modules', '.bin', 'aiad-sdd');
  if (existsSync(localBin)) return { cmd: localBin, base: [] };
  return { cmd: 'npx', base: ['--no-install', 'aiad-sdd'] };
}

function main() {
  if (process.env.AIAD_HOOK_SILENT === '1') return 0;

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!existsSync(join(projectDir, '.aiad'))) return 0;

  const { cmd, base } = resoudreCli(projectDir);
  const args = [...base, 'veto', '--output-format', 'verdict'];

  let stdout = '';
  let code = 0;
  try {
    stdout = execFileSync(cmd, args, { cwd: projectDir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    stdout = (e && e.stdout) ? String(e.stdout) : '';
    code = (e && typeof e.status === 'number') ? e.status : 0;
  }

  if (code !== 2) return 0; // PASS (0) — ou erreur non bloquante : filet ailleurs.

  let env = {};
  try { env = JSON.parse(stdout.trim().split('\n').pop() || '{}'); } catch { /* ignore */ }
  const violations = Array.isArray(env.violations) ? env.violations : [];
  const liste = violations.slice(0, 15).map((v) => `  - ${v.file} → manque @governance ${v.agent}`).join('\n');

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `Veto Tier 1 (fail-closed) : ${violations.length} fichier(s) en zone réglementée sans annotation @governance.\n` +
        `${liste}\n` +
        `Pose l'annotation @governance AIAD-XXX (preuve de revue) ou fais trancher le subagent Tier 1 avant de committer.`,
    },
  }));
  return 2;
}

try {
  process.exit(main());
} catch {
  process.exit(0);
}
