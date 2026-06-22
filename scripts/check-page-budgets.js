/**
 * @spec SPEC-016-4-rgesn-budgets
 * @intent INTENT-016
 * @governance AIAD-RGESN
 *
 * node scripts/check-page-budgets.js [--root <path>]
 * exit 0 → tous dans les budgets (ou perf-budgets.md absent)
 * exit 1 → au moins un dépassement ou page déclarée manquante
 */
import { statSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lirePerfBudgets } from '../lib/dashboard/perf-budgets.js';

export const AVERT_ABSENT = 'perf-budgets.md absent — vérification ignorée';

function tailleDir(dirPath) {
  if (!existsSync(dirPath)) return null;
  return readdirSync(dirPath).reduce((s, f) => {
    try { return s + statSync(join(dirPath, f)).size; }
    catch { return s; }
  }, 0);
}

function tailleGlob(racine, pattern) {
  const parts = pattern.split('/');
  const dir = join(racine, ...parts.slice(0, -1));
  const re = new RegExp('^' + parts.at(-1).replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => re.test(f))
    .map((f) => join(dir, f));
}

export function verifierBudgets(racine) {
  const result = lirePerfBudgets(racine);
  if (!result.fichier) {
    return { exitCode: 0, avertissement: AVERT_ABSENT, lignes: [] };
  }

  let exitCode = 0;
  const lignes = [];

  for (const item of result.budgets) {
    if (!item.fichier) continue;
    const budgetKo = parseFloat(item.budget);
    if (isNaN(budgetKo)) continue;

    // Directory (assets/)
    if (item.fichier.endsWith('/')) {
      const dirPath = join(racine, item.fichier);
      const bytes = tailleDir(dirPath);
      if (bytes === null) {
        lignes.push({ label: item.fichier, tailleKo: null, budgetKo, depasse: false, manquant: true });
        exitCode = 1;
        continue;
      }
      const tailleKo = bytes / 1024;
      const depasse = tailleKo > budgetKo;
      if (depasse) exitCode = 1;
      lignes.push({ label: item.fichier, tailleKo, budgetKo, depasse });
      continue;
    }

    // Glob (intent-pages)
    if (item.fichier.includes('*')) {
      const files = tailleGlob(racine, item.fichier);
      if (files.length === 0) continue;
      let maxKo = 0;
      for (const fp of files) {
        try { maxKo = Math.max(maxKo, statSync(fp).size / 1024); }
        catch { /* skip unreadable */ }
      }
      const depasse = maxKo > budgetKo;
      if (depasse) exitCode = 1;
      lignes.push({ label: item.fichier, tailleKo: maxKo, budgetKo, depasse, glob: true });
      continue;
    }

    // Regular file
    const filePath = join(racine, item.fichier);
    if (!existsSync(filePath)) {
      lignes.push({ label: item.fichier, tailleKo: null, budgetKo, depasse: false, manquant: true });
      exitCode = 1;
      continue;
    }
    const tailleKo = statSync(filePath).size / 1024;
    const depasse = tailleKo > budgetKo;
    if (depasse) exitCode = 1;
    lignes.push({ label: item.fichier, tailleKo, budgetKo, depasse });
  }

  return { exitCode, lignes };
}

function afficher({ avertissement, lignes }) {
  if (avertissement) {
    process.stderr.write(avertissement + '\n');
    return;
  }
  const W = { label: 45, taille: 16, budget: 10 };
  const sep = '-'.repeat(W.label + W.taille + W.budget + 6);
  console.log(`${'Page'.padEnd(W.label)}${'Taille réelle'.padEnd(W.taille)}${'Budget'.padEnd(W.budget)}Statut`);
  console.log(sep);
  for (const l of lignes) {
    const taille = l.manquant ? '—' : `${l.tailleKo.toFixed(1)} KB${l.glob ? ' max' : ''}`;
    const budget = `${l.budgetKo} KB`;
    let statut;
    if (l.manquant) statut = `⚠ MANQUANT ${l.label}`;
    else if (l.depasse) statut = `⚠ DÉPASSEMENT (+${(l.tailleKo - l.budgetKo).toFixed(1)} KB)`;
    else statut = 'OK';
    console.log(`${l.label.padEnd(W.label)}${taille.padEnd(W.taille)}${budget.padEnd(W.budget)}${statut}`);
  }
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const rootIdx = process.argv.indexOf('--root');
  const racine = rootIdx >= 0
    ? resolve(process.argv[rootIdx + 1])
    : resolve(dirname(__filename), '..');
  const result = verifierBudgets(racine);
  afficher(result);
  process.exit(result.exitCode);
}
