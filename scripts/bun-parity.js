#!/usr/bin/env node
// AIAD SDD Mode — Script de matrice Bun feature parity (item #111).
//
// **Objectif** : exécuter une **batterie de ~30 commandes safe** côté
// Node ET côté Bun, comparer les exit codes + signatures de sortie, et
// produire un rapport markdown `docs/bun-parity.md` qui sert de
// référence vivante.
//
// **Commande safe** :
//   - n'écrit pas dans le projet courant (utilise un dossier temporaire
//     ou des flags `--dry-run` / `--json`).
//   - n'émet aucune requête réseau.
//   - termine en moins de 5 secondes.
//
// **Sortie** :
//   - rapport markdown lisible
//   - code de sortie : 0 si toutes parités OK, 1 si divergences
//
// Usage :
//   node scripts/bun-parity.js                  # rapport sur stdout
//   node scripts/bun-parity.js --out docs/bun-parity.md
//   node scripts/bun-parity.js --json           # rapport JSON
//   node scripts/bun-parity.js --check          # exit 1 si divergence

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { parseArgs } from 'node:util';

const ROOT = process.cwd();
const BIN = join(ROOT, 'bin', 'aiad-sdd.js');
const TIMEOUT_MS = 15000;

// ─── Liste des commandes à tester ──────────────────────────────────────────

/**
 * Chaque entrée :
 *   - id : nom court pour le rapport
 *   - args : tableau d'arguments à passer (sans `aiad-sdd`)
 *   - setup?(dir) : prépare un dossier temporaire (init projet AIAD, etc.)
 *   - expect : `'success'` | `'exit-nonzero-ok'` (certaines commandes
 *              retournent 1 quand pas de projet AIAD initialisé, ce qui
 *              est conforme — on tolère).
 *   - signature?(stdout) : extrait un substring qui doit apparaître dans
 *              les deux runtimes (pour comparer la sortie).
 */
export const COMMANDES = [
  { id: 'version', args: ['--version'], expect: 'success', signature: (o) => o.includes('Commandes') || o.includes('aiad-sdd') },
  { id: 'help', args: ['help'], expect: 'success', signature: (o) => o.includes('Commandes') },
  { id: 'status', args: ['status'], expect: 'any' },
  { id: 'doctor-json', args: ['doctor', '--json'], expect: 'any', signature: (o) => o.startsWith('{') || o.startsWith('[') },
  { id: 'trace-json', args: ['trace', '--json', '--quiet'], expect: 'any', signature: (o) => o.startsWith('{') || o.includes('intents') },
  { id: 'sbom-json', args: ['sbom', '--json'], expect: 'success', signature: (o) => o.startsWith('{') },
  { id: 'dpia-json', args: ['dpia', '--json'], expect: 'success' },
  { id: 'verify-reproducibility', args: ['verify-reproducibility', '--json'], expect: 'success', signature: (o) => o.includes('"hash"') },
  { id: 'skills-validate', args: ['skills', 'validate'], expect: 'any' },
  { id: 'telemetry-status-json', args: ['telemetry', 'status', '--json'], expect: 'success', signature: (o) => o.startsWith('{') },
  { id: 'hook-stats-json', args: ['hook-stats', '--json'], expect: 'success', signature: (o) => o.includes('stats') },
  { id: 'sovereignty-json', args: ['sovereignty', '--json'], expect: 'success', signature: (o) => o.includes('score') },
  { id: 'sla-show-json', args: ['sla', 'show', '--json'], expect: 'success' },
  { id: 'audit-log-json', args: ['audit', 'log', '--json'], expect: 'success' },
  { id: 'audit-verify-json', args: ['audit', 'verify', '--json'], expect: 'success' },
  { id: 'archive-list-json', args: ['archive', '--list', '--json'], expect: 'success', signature: (o) => o.includes('archives') },
  { id: 'marketplace-list', args: ['marketplace', 'list'], expect: 'success' },
  { id: 'cert-matrix', args: ['cert', 'matrix'], expect: 'success', signature: (o) => o.includes('Matrice de compétences') },
  { id: 'completion-bash', args: ['completion', 'bash'], expect: 'success', signature: (o) => o.includes('_aiad_sdd_complete') },
  { id: 'completion-zsh', args: ['completion', 'zsh'], expect: 'success', signature: (o) => o.includes('compdef') },
  { id: 'completion-fish', args: ['completion', 'fish'], expect: 'success', signature: (o) => o.includes('complete -c aiad-sdd') },
  { id: 'pii-scan-json', args: ['pii-scan', '--json'], expect: 'success', signature: (o) => o.includes('findings') },
  // `bench` exige `.claude/commands/` (présent après `aiad-sdd init`, absent
  // d'un checkout CI du dépôt) ; il peut donc légitimement sortir en exit 1.
  // La parité reste vérifiée via l'égalité des exit codes Node/Bun.
  { id: 'bench', args: ['bench'], expect: 'any' },
];

// ─── Exécution d'une commande sous un runtime donné ───────────────────────

/**
 * @param {string} runtime - 'node' | 'bun'
 * @param {string[]} args
 * @param {string} cwd
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
export function executerSousRuntime(runtime, args, cwd) {
  const r = spawnSync(runtime, [BIN, ...args], {
    cwd, encoding: 'utf-8', timeout: TIMEOUT_MS,
  });
  return {
    status: r.status === null ? -1 : r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

// ─── Comparaison ──────────────────────────────────────────────────────────

/**
 * Compare deux exécutions et retourne un verdict.
 */
export function comparer(node, bun, expect, signature) {
  // Status code : tolère 'any' si la commande peut légitimement échouer
  if (expect === 'success' && node.status !== 0) {
    return { match: false, raison: `Node a échoué (exit ${node.status})` };
  }
  if (expect === 'success' && bun.status !== 0) {
    return { match: false, raison: `Bun a échoué (exit ${bun.status})` };
  }
  if (node.status !== bun.status) {
    return { match: false, raison: `Exit codes différents : node=${node.status}, bun=${bun.status}` };
  }
  if (typeof signature === 'function') {
    const okNode = signature(node.stdout);
    const okBun = signature(bun.stdout);
    if (okNode !== okBun) {
      return { match: false, raison: `Signature de sortie divergente : node=${okNode}, bun=${okBun}` };
    }
    if (!okNode) {
      return { match: false, raison: 'Signature absente dans les deux runtimes' };
    }
  }
  return { match: true };
}

// ─── Pipeline ──────────────────────────────────────────────────────────────

function detecterBun() {
  const r = spawnSync('bun', ['--version'], { encoding: 'utf-8' });
  return r.status === 0;
}

/**
 * Exécute la matrice complète et retourne le rapport.
 *
 * @param {{ withBun?: boolean }} [options]
 */
export function executerMatrice(options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-bun-'));
  // Setup minimal : un .aiad/ vide pour que les commandes qui en ont besoin
  // (status, archive, etc.) ne crashent pas.
  mkdirSync(join(dir, '.aiad', 'intents'), { recursive: true });
  mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
  writeFileSync(join(dir, '.aiad', 'intents', '_index.md'), '# index');
  writeFileSync(join(dir, '.aiad', 'specs', '_index.md'), '# index');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'bun-parity-fixture', version: '1.0.0' }));

  const withBun = options.withBun !== false && detecterBun();

  const resultats = [];
  for (const cmd of COMMANDES) {
    const node = executerSousRuntime('node', cmd.args, dir);
    let bun = null;
    let verdict = { match: true, raison: '(bun absent)' };
    if (withBun) {
      bun = executerSousRuntime('bun', cmd.args, dir);
      verdict = comparer(node, bun, cmd.expect, cmd.signature);
    }
    resultats.push({
      id: cmd.id,
      args: cmd.args,
      nodeStatus: node.status,
      bunStatus: bun ? bun.status : null,
      match: verdict.match,
      raison: verdict.raison,
    });
  }
  rmSync(dir, { recursive: true, force: true });

  const total = resultats.length;
  const ok = resultats.filter((r) => r.match).length;
  return {
    bunDetecte: withBun,
    total,
    ok,
    divergences: total - ok,
    resultats,
  };
}

// ─── Rendu Markdown ───────────────────────────────────────────────────────

export function rendreRapport(rapport) {
  const lignes = [];
  lignes.push('# Bun feature parity report');
  lignes.push('');
  lignes.push(`> Rapport généré par \`scripts/bun-parity.js\` le ${new Date().toISOString().slice(0, 10)}.`);
  lignes.push('');
  lignes.push(`- **Total commandes testées** : ${rapport.total}`);
  lignes.push(`- **Match** : ${rapport.ok}/${rapport.total}`);
  lignes.push(`- **Divergences** : ${rapport.divergences}`);
  lignes.push(`- **Bun détecté** : ${rapport.bunDetecte ? '✅' : '❌ (skip)'}`);
  lignes.push('');
  lignes.push('## Détails');
  lignes.push('');
  lignes.push('| Commande | Args | Node | Bun | Match |');
  lignes.push('|----------|------|:----:|:---:|:-----:|');
  for (const r of rapport.resultats) {
    const args = '`' + r.args.join(' ') + '`';
    const node = r.nodeStatus === 0 ? '✅' : `❌ (${r.nodeStatus})`;
    const bun = r.bunStatus === null ? '—' : (r.bunStatus === 0 ? '✅' : `❌ (${r.bunStatus})`);
    const match = r.match ? '✅' : `❌ ${r.raison || ''}`;
    lignes.push(`| \`${r.id}\` | ${args} | ${node} | ${bun} | ${match} |`);
  }
  lignes.push('');
  if (rapport.divergences > 0) {
    lignes.push('## Divergences observées');
    lignes.push('');
    for (const r of rapport.resultats.filter((x) => !x.match)) {
      lignes.push(`- **${r.id}** : ${r.raison}`);
    }
    lignes.push('');
  }
  lignes.push('## Méthodologie');
  lignes.push('');
  lignes.push('Chaque commande est exécutée dans un même dossier temporaire avec un `.aiad/` minimal.');
  lignes.push('On compare : (1) exit code Node vs Bun, (2) une signature texte attendue dans la sortie.');
  lignes.push('Les commandes qui peuvent légitimement échouer (ex. `trace` sans Intent) ont `expect: any`.');
  return lignes.join('\n') + '\n';
}

// ─── Main ─────────────────────────────────────────────────────────────────

import { fileURLToPath } from 'node:url';

const estMain = (() => {
  try { return process.argv[1] === fileURLToPath(import.meta.url); }
  catch { return false; }
})();

if (estMain) {
  const argv = process.argv.slice(2);
  const args = parseArgs({
    args: argv,
    options: {
      out: { type: 'string' },
      json: { type: 'boolean' },
      check: { type: 'boolean' },
      'no-bun': { type: 'boolean' },
    },
    allowPositionals: true,
    strict: false,
  });
  const rapport = executerMatrice({ withBun: !args.values['no-bun'] });
  if (args.values.json) {
    process.stdout.write(JSON.stringify(rapport, null, 2) + '\n');
  } else {
    const md = rendreRapport(rapport);
    if (args.values.out) {
      const outDir = dirname(args.values.out);
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      writeFileSync(args.values.out, md, 'utf-8');
      console.log(`✓ Rapport écrit dans ${args.values.out} (${rapport.ok}/${rapport.total} match)`);
    } else {
      process.stdout.write(md);
    }
  }
  if (args.values.check && rapport.divergences > 0) {
    process.exit(1);
  }
}
