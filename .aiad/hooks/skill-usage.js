#!/usr/bin/env node
// AIAD SDD — PreToolUse(Skill) hook : mesure d'usage des skills (§3.11 SPEC-B).
//
// Journalise chaque invocation de skill dans `.aiad/metrics/skill-usage.jsonl`
// pour savoir lesquelles servent réellement (Sobriété Intentionnelle : retirer
// les inutilisées). **Jamais bloquant** : la mesure ne doit pas gêner le flux —
// toute erreur est avalée, exit 0.
//
// Bypass : export AIAD_HOOK_SILENT=1. Self-contained par portabilité.
// Documentation : https://aiad.ovh

import process from 'node:process';
import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Toggle par environnement (§3.13) : hooks-config.json + .local.json (override).
function hookDesactive(projectDir, nom) {
  const TOG = { disablePreToolUseHook: ['jnsp-scan', 'skill-usage'], disableSkillUsageHook: ['skill-usage'] };
  let c = {};
  for (const f of ['hooks-config.json', 'hooks-config.local.json']) {
    try { const p = join(projectDir, '.aiad', f); if (existsSync(p)) c = { ...c, ...JSON.parse(readFileSync(p, 'utf-8')) }; } catch { /* ignore */ }
  }
  for (const [k, hooks] of Object.entries(TOG)) if (c[k] === true && hooks.includes(nom)) return true;
  return false;
}

function main() {
  if (process.env.AIAD_HOOK_SILENT === '1') return 0;
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!existsSync(join(projectDir, '.aiad'))) return 0;
  if (hookDesactive(projectDir, 'skill-usage')) return 0;

  let stdin = '';
  try { stdin = readFileSync(0, 'utf-8'); } catch { /* pas de stdin */ }
  let payload = {};
  try { payload = JSON.parse(stdin || '{}'); } catch { /* ignore */ }

  // Le nom de la skill se trouve dans tool_input (forme variable selon version).
  const ti = payload.tool_input || payload.toolInput || {};
  const skill = ti.skill || ti.name || ti.command || payload.skill || 'inconnue';

  const ligne = JSON.stringify({
    ts: new Date().toISOString(),
    skill: String(skill),
    tool: payload.tool_name || payload.toolName || 'Skill',
    session: payload.session_id || null,
  });

  try {
    const dir = join(projectDir, '.aiad', 'metrics');
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'skill-usage.jsonl'), ligne + '\n');
  } catch { /* mesure best-effort */ }
  return 0;
}

try { process.exit(main()); } catch { process.exit(0); }
