#!/usr/bin/env node
// AIAD SDD — UserPromptSubmit hook : prérequis Discovery (§3.5 SPEC-B)
//
// Quand l'utilisateur invoque `/sdd spec` ou `/sdd exec`, ce hook rappelle —
// dans le contexte, au bon moment — que la phase Research/Discovery est un
// prérequis. Si la commande cible un Intent identifiable (INTENT-NNN dans le
// prompt), il interroge le verdict déterministe
// (`aiad-sdd discovery-check <id> --output-format verdict`, exit 0=prêt) et
// injecte le motif précis si la Research n'est pas prête.
//
// **Proportionnalité (§3.5 §9)** : par défaut le hook *injecte du contexte*
// (additionalContext), il ne BLOQUE pas — le passage en SPEC reste possible
// pour une intention triviale, tracé par le PE. Mode strict opt-in via
// `AIAD_DISCOVERY_STRICT=1` → `decision: block` si la Research n'est pas prête.
//
// Self-contained par portabilité. Bypass total : export AIAD_HOOK_SILENT=1
// Documentation : https://aiad.ovh

import process from 'node:process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// Déclencheurs : formes router `/sdd spec|exec` et alias plats rétro-compat.
const DECLENCHEUR = /\/sdd[\s-](spec|exec)\b/i;

function resoudreCli(projectDir) {
  const devBin = join(projectDir, 'bin', 'aiad-sdd.js');
  if (existsSync(devBin)) return { cmd: 'node', base: [devBin] };
  const localBin = join(projectDir, 'node_modules', '.bin', 'aiad-sdd');
  if (existsSync(localBin)) return { cmd: localBin, base: [] };
  return { cmd: 'npx', base: ['--no-install', 'aiad-sdd'] };
}

// Lit le prompt sur stdin (fd 0). Le harness fournit un JSON `{ prompt, … }` ;
// on tolère aussi du texte brut (appel manuel / test).
function lirePrompt() {
  let brut = '';
  try { brut = readFileSync(0, 'utf-8'); } catch { return ''; }
  try {
    const j = JSON.parse(brut || '{}');
    if (typeof j.prompt === 'string') return j.prompt;
  } catch { /* texte brut */ }
  return brut;
}

function emitContext(text) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text },
  }));
}

function main() {
  if (process.env.AIAD_HOOK_SILENT === '1') return 0;

  const prompt = lirePrompt();
  if (!DECLENCHEUR.test(prompt)) return 0;

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!existsSync(join(projectDir, '.aiad'))) return 0;

  const intentMatch = prompt.match(/INTENT-\d+/i);
  const intentId = intentMatch ? intentMatch[0].toUpperCase() : null;

  // Pas d'Intent identifiable → rappel générique du prérequis.
  if (!intentId) {
    emitContext(
      '[AIAD §3.5] Prérequis Discovery : avant de rédiger/lancer une SPEC, vérifie qu\'une Research liée existe ' +
      '(Discovery ancré dans le code, verdict GO/CONDITIONAL GO). Sinon lance `/sdd research`. ' +
      'Vérif machine : `npx aiad-sdd discovery-check <INTENT-NNN>`.');
    return 0;
  }

  const { cmd, base } = resoudreCli(projectDir);
  let stdout = '';
  let code = 0;
  try {
    stdout = execFileSync(cmd, [...base, 'discovery-check', intentId, '--output-format', 'verdict'],
      { cwd: projectDir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    stdout = (e && e.stdout) ? String(e.stdout) : '';
    code = (e && typeof e.status === 'number') ? e.status : 0;
  }

  if (code === 0) return 0; // Research prête — rien à rappeler.

  let env = {};
  try { env = JSON.parse(stdout.trim().split('\n').pop() || '{}'); } catch { /* ignore */ }
  const raison = env.raison || 'Research non prête pour cet Intent.';
  const verdict = env.verdict || (code === 1 ? 'FAIL' : 'JNSP');

  const strict = process.env.AIAD_DISCOVERY_STRICT === '1';
  if (strict) {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason:
        `Prérequis Discovery (§3.5) non satisfait pour ${intentId} : ${raison}\n` +
        `Lance \`/sdd research\` (verdict GO/CONDITIONAL GO requis) avant \`/sdd spec\` / \`/sdd exec\`.`,
    }));
    return 0;
  }

  emitContext(
    `[AIAD §3.5] Prérequis Discovery non satisfait pour ${intentId} (verdict ${verdict}) : ${raison} ` +
    'Avant de rédiger/lancer la SPEC, lance `/sdd research` pour ancrer l\'intention dans le code et trancher le GO/NO-GO. ' +
    'Pour une intention triviale, le PE peut court-circuiter explicitement en le traçant dans la SPEC.');
  return 0;
}

try {
  process.exit(main());
} catch {
  // Un hook qui plante ne doit jamais bloquer un prompt — sortie ouverte.
  process.exit(0);
}
