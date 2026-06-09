#!/usr/bin/env node
// AIAD SDD — statusLine (§3.11) : ligne de statut live (SPEC active, Gate,
// étape de cycle, % contexte, effort). Déclaré via settings.statusLine.command.
//
// Shell-out vers `aiad-sdd statusline` (source unique = lib/statusline.js) en
// lui transmettant le JSON Claude Code reçu sur stdin. Jamais bloquant : toute
// erreur retombe sur une ligne minimale.
//
// Self-contained par portabilité. Documentation : https://aiad.ovh

import process from 'node:process';
import { existsSync, readFileSync } from 'node:fs';
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
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  let stdin = '';
  try { stdin = readFileSync(0, 'utf-8'); } catch { /* pas de stdin */ }
  if (!existsSync(join(projectDir, '.aiad'))) { process.stdout.write('SDD\n'); return; }
  const { cmd, base } = resoudreCli(projectDir);
  try {
    const out = execFileSync(cmd, [...base, 'statusline'], { cwd: projectDir, input: stdin, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    process.stdout.write(out.trim() + '\n');
  } catch {
    process.stdout.write('SDD\n');
  }
}

try { main(); } catch { process.stdout.write('SDD\n'); }
