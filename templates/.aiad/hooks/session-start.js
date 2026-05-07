#!/usr/bin/env node
// AIAD SDD — SessionStart hook
//
// Injecte dans le contexte Claude Code, à chaque ouverture de session :
//   1. l'Intent Statement actif (statut active / in-progress)
//   2. la SPEC en cours et son statut Gate (SQS)
//   3. les agents de gouvernance disponibles
//
// Cohérence valeurs AIAD :
//   • Primauté de l'Intention Humaine — l'agent ne démarre jamais sans rappel de l'Intent
//   • Sobriété Intentionnelle — ≤ 300 tokens injectés (vs charger PRD/SPEC complets)
//
// Bypass : export AIAD_HOOK_SILENT=1
// Documentation : https://aiad.ovh

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const MAX_INTENTS = 2;
const MAX_SPECS = 3;

function safeRead(path) {
  try { return readFileSync(path, 'utf-8'); } catch { return null; }
}

function parseTable(md, prefix) {
  const re = new RegExp(`\\b${prefix}-\\d+`, 'i');
  return md.split('\n')
    .filter(line => line.trim().startsWith('|') && re.test(line))
    .map(line => line.split('|').map(cell => cell.trim()));
}

function isActiveIntentStatus(s) {
  return /^(active|in[- ]progress)$/i.test((s || '').toLowerCase());
}

function isOpenSpecStatus(s) {
  return /^(ready|in[- ]progress|review|validation)$/i.test((s || '').toLowerCase());
}

function gateLabel(sqs) {
  const num = parseInt(String(sqs).match(/\d+/)?.[0] || '0', 10);
  if (num >= 4) return 'Gate ouverte';
  if (num > 0) return 'Gate fermée';
  return 'Gate non évaluée';
}

function emit(text) {
  if (!text) { process.exit(0); }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: text,
    },
  }));
}

function main() {
  if (process.env.AIAD_HOOK_SILENT === '1') return;

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const aiadDir = join(projectDir, '.aiad');
  if (!existsSync(aiadDir)) return;

  const lines = [];

  const intentsIndex = safeRead(join(aiadDir, 'intents', '_index.md'));
  const intentRows = intentsIndex ? parseTable(intentsIndex, 'INTENT') : [];
  const activeIntents = intentRows.filter(r => isActiveIntentStatus(r[6]));

  if (!activeIntents.length) {
    lines.push('[AIAD] Aucun Intent actif. Suggestion : lance /sdd intent pour capturer une intention humaine avant de coder.');
  } else {
    for (const row of activeIntents.slice(0, MAX_INTENTS)) {
      const id = row[1];
      const title = row[2] || '(sans titre)';
      lines.push(`[AIAD] Intent actif : ${id} — "${title}"`);
    }
    if (activeIntents.length > MAX_INTENTS) {
      lines.push(`[AIAD] +${activeIntents.length - MAX_INTENTS} autre(s) Intent(s) actif(s) — voir .aiad/intents/_index.md`);
    }

    const specsIndex = safeRead(join(aiadDir, 'specs', '_index.md'));
    if (specsIndex) {
      const activeIds = new Set(activeIntents.map(r => r[1]));
      const openSpecs = parseTable(specsIndex, 'SPEC').filter(r => {
        const parent = (r[3] || '').match(/INTENT-\d+/)?.[0];
        return parent && activeIds.has(parent) && isOpenSpecStatus(r[5]);
      });
      for (const row of openSpecs.slice(0, MAX_SPECS)) {
        const id = row[1];
        const sqs = row[4] || 'n/a';
        lines.push(`[AIAD] SPEC en cours : ${id} (SQS ${sqs}, ${gateLabel(sqs)})`);
      }
      if (openSpecs.length > MAX_SPECS) {
        lines.push(`[AIAD] +${openSpecs.length - MAX_SPECS} autre(s) SPEC(s) ouverte(s) — voir .aiad/specs/_index.md`);
      }
    }
  }

  const govDir = join(aiadDir, 'gouvernance');
  if (existsSync(govDir)) {
    const labels = {
      'AIAD-AI-ACT.md': 'AI-Act',
      'AIAD-RGPD.md': 'RGPD',
      'AIAD-RGAA.md': 'RGAA',
      'AIAD-RGESN.md': 'RGESN',
    };
    const present = readdirSync(govDir).filter(f => labels[f]).map(f => labels[f]);
    if (present.length) {
      lines.push(`[AIAD] Gouvernance applicable : ${present.join(', ')}`);
    }
  }

  emit(lines.join('\n'));
}

try {
  main();
} catch {
  // Un hook qui plante ne doit jamais bloquer la session — sortie silencieuse.
  process.exit(0);
}
