#!/usr/bin/env node
// AIAD SDD — Stop hook : Drift Lock enforced (§3.3)
//
// À la clôture d'une session/agent, exécute le verdict de traçabilité
// déterministe (`aiad-sdd trace --output-format verdict`, exit 0/1/2) et
// REFUSE la clôture (decision: block + exit 2) tant qu'un gap bloquant
// (FAIL) ou une traçabilité indécidable (JNSP) subsiste, en rendant au
// modèle la liste des annotations à poser. Hook synchrone : un hook
// d'arrière-plan ne peut pas retenir une clôture.
//
// Anti-boucle : si la clôture est déjà relancée par un hook Stop
// (`stop_hook_active`), on laisse clôturer et on prévient l'humain.
//
// « Merger sans Drift Check » devient mécaniquement impossible.
//
// Si la CLI ne produit aucun verdict (paquet absent du projet), le hook ne
// bloque pas : il prévient l'humain (systemMessage) et laisse clôturer.
//
// Self-contained par portabilité. Bypass : export AIAD_HOOK_SILENT=1
// Documentation : https://aiad.ovh

import process from 'node:process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// Toggle par environnement (§3.13) : hooks-config.json + .local.json (override).
// Fail-safe : en cas de doute, le hook tourne. La gouvernance (veto) n'est pas
// togglable ici (cf. lib/hooks-config.js).
function hookDesactive(projectDir, nom) {
  const TOG = {
    disablePreToolUseHook: ['jnsp-scan', 'skill-usage'], disableStopHook: ['drift-lock'],
    disableUserPromptSubmitHook: ['discovery-gate'], disableSessionStartHook: ['session-start'],
    disableDriftLockHook: ['drift-lock'], disableJnspHook: ['jnsp-scan'],
    disableDiscoveryGateHook: ['discovery-gate'], disableSkillUsageHook: ['skill-usage'],
  };
  let c = {};
  for (const f of ['hooks-config.json', 'hooks-config.local.json']) {
    try { const p = join(projectDir, '.aiad', f); if (existsSync(p)) c = { ...c, ...JSON.parse(readFileSync(p, 'utf-8')) }; } catch { /* ignore */ }
  }
  for (const [k, hooks] of Object.entries(TOG)) if (c[k] === true && hooks.includes(nom)) return true;
  return false;
}

function resoudreCli(projectDir) {
  const devBin = join(projectDir, 'bin', 'aiad-sdd.js');
  if (existsSync(devBin)) return { cmd: 'node', base: [devBin] };
  const localBin = join(projectDir, 'node_modules', '.bin', 'aiad-sdd');
  if (existsSync(localBin)) return { cmd: localBin, base: [] };
  return { cmd: 'npx', base: ['--no-install', 'aiad-sdd'] };
}

// Entrée du hook (JSON sur stdin). {} hors harness ou si illisible.
function lireEntree() {
  try {
    if (process.stdin.isTTY) return {};
    const data = readFileSync(0, { encoding: 'utf-8' });
    return data.trim() ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function main() {
  if (process.env.AIAD_HOOK_SILENT === '1') return 0;
  const entree = lireEntree();

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!existsSync(join(projectDir, '.aiad'))) return 0;
  if (hookDesactive(projectDir, 'drift-lock')) return 0;

  const { cmd, base } = resoudreCli(projectDir);
  const args = [...base, 'trace', '--output-format', 'verdict'];

  let stdout = '';
  let code = 0;
  try {
    stdout = execFileSync(cmd, args, { cwd: projectDir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    // execFileSync lève sur exit ≠ 0 : on récupère stdout + status.
    stdout = (e && e.stdout) ? String(e.stdout) : '';
    code = (e && typeof e.status === 'number') ? e.status : 1;
  }

  if (code === 0) return 0; // PASS — clôture autorisée.

  let enveloppe = {};
  try { enveloppe = JSON.parse(stdout.trim().split('\n').pop() || '{}'); } catch { /* ignore */ }

  // Aucun verdict produit : la CLI n'a pas pu s'exécuter (paquet non installé
  // dans le projet, `npx --no-install` en échec, plantage). Ce n'est ni un gap
  // ni une traçabilité indécidable : le hook n'a rien mesuré. Bloquer ici
  // réveillerait le modèle sans rien qu'il puisse corriger (boucle de clôture).
  // On laisse clôturer et on prévient l'humain ; le pre-commit et la CI
  // `sdd-trace` restent les garde-fous.
  if (typeof enveloppe.verdict !== 'string') {
    process.stdout.write(JSON.stringify({
      systemMessage: stdout.trim() === ''
        ? 'Drift Lock non vérifié : la CLI aiad-sdd est introuvable dans le projet. '
          + 'Installe-la (npm install --save-dev aiad-sdd) pour réactiver le contrôle à la clôture.'
        : 'Drift Lock non vérifié : la CLI aiad-sdd a répondu, mais son verdict est illisible. '
          + 'Lance `aiad-sdd trace --output-format verdict` pour diagnostiquer.',
    }));
    return 0;
  }
  const verdict = enveloppe.verdict;
  if (entree.stop_hook_active === true) {
    process.stdout.write(JSON.stringify({
      systemMessage: `Drift Lock — verdict ${verdict} toujours présent après une relance : clôture autorisée pour éviter une boucle. `
        + 'Le pre-commit et la CI restent bloquants ; lance `aiad-sdd trace` pour voir les écarts.',
    }));
    return 0;
  }
  const bloquants = Array.isArray(enveloppe.gaps) ? enveloppe.gaps.filter((g) => g.blocking) : [];
  const liste = bloquants.slice(0, 15).map((g) => `  - [${g.kind}] ${g.ref}${g.file ? ` (${g.file})` : ''}`).join('\n');

  const raison = verdict === 'JNSP'
    ? `Drift Lock — INDÉCIDABLE : aucune annotation @spec trouvée sur le code applicatif. Pose les annotations @spec (et @verified-by) avant de clôturer.`
    : `Drift Lock — ${bloquants.length} gap(s) bloquant(s) de traçabilité :\n${liste}\nSynchronise SPEC + code (annotations @spec) puis relance la clôture.`;

  process.stdout.write(JSON.stringify({ decision: 'block', reason: raison }));
  return 2;
}

try {
  process.exit(main());
} catch {
  // Filet : un hook qui plante ne bloque pas la clôture (le pre-commit et la
  // CI sdd-trace restent les garde-fous).
  process.exit(0);
}
