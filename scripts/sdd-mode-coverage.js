#!/usr/bin/env node
// AIAD SDD Mode — Matrice de couverture de test exhaustive.
//
// Rejoue à la demande la question : « chaque élément du PRD rétro-ingénierié
// est-il couvert par un test, et chaque module de la codebase a-t-il un test
// associé ? ». Zero-dep, déterministe, évolutif : quand le PRD ou lib/ grossit,
// relancer ce script révèle les nouveaux trous sans mise à jour manuelle du
// script lui-même (seuls les fichiers d'overrides évoluent).
//
// Usage :
//   node scripts/sdd-mode-coverage.js              # rapport + exit 0/1
//   node scripts/sdd-mode-coverage.js --json        # rapport JSON seul (stdout)
//   node scripts/sdd-mode-coverage.js --write       # persiste sous .aiad/metrics/
//
// Contrat d'exit code (cohérent avec le reste du projet — voir lib/verdict.js) :
//   0 = COUVERT (aucun gap, aucun orphelin)
//   1 = GAP     (au moins un élément PRD ou fichier lib/ non couvert et non exempté)
//
// Philosophie JNSP : un élément non mécaniquement testable (vision, métriques
// produit, roadmap) n'est pas fabriqué comme "couvert" — il est déclaré
// `exempt` avec une raison, à l'image de `traceability: exempt` (INTENT-024).
//
// @intent INTENT-024
// @verified-by test/sdd-mode-e2e/coverage-tool.test.js

import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');
export const PRD_PATH = join(ROOT, 'docs', 'PRD-retro-engineering.md');
export const TEST_DIR = join(ROOT, 'test');
export const LIB_DIR = join(ROOT, 'lib');
export const OUT_DIR = join(ROOT, '.aiad', 'metrics', 'sdd-mode-coverage');
export const OVERRIDES_PATH = join(ROOT, 'test', 'sdd-mode-e2e', 'coverage-overrides.json');

// Sections stratégiques/narratives — non mécaniquement testables par CI.
// (vision produit, métriques d'outcome métier, historique de versions, annexe)
export const EXEMPT_SECTIONS = new Set([1, 6, 7, 8]);

// ─── Parsing PRD ────────────────────────────────────────────────────────────

// Découpe le PRD en éléments atomiques : lignes de tableau (hors en-tête/séparateur)
// et puces de premier niveau, rattachés à la section `## N.` en cours.
export function parsePrdElements(md) {
  const lines = md.split('\n');
  let section = null;
  let sub = '';
  let tableState = 'none'; // none -> header -> body
  const elements = [];
  let counter = 0;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(\d+)\.\s+(.*)/);
    if (h2) { section = { num: Number(h2[1]), title: h2[2].trim() }; tableState = 'none'; continue; }
    const h3 = line.match(/^###\s+(\S+)\s+(.*)/);
    if (h3) { sub = `${h3[1]} ${h3[2]}`.trim(); tableState = 'none'; continue; }
    if (!section) continue;

    if (/^\|/.test(line)) {
      if (/^\|[\s\-:|]+\|$/.test(line)) { tableState = tableState === 'header' ? 'body' : tableState; continue; }
      if (tableState === 'none') { tableState = 'header'; continue; } // ligne d'en-tête de tableau, ignorée
      if (tableState === 'body') {
        const cells = line.split('|').slice(1, -1).map((c) => c.trim());
        if (cells.length < 2) continue;
        counter += 1;
        elements.push({
          id: `PRD-${section.num}-${counter}`,
          section: section.num,
          sectionTitle: section.title,
          sub,
          kind: 'table-row',
          text: cells.join(' | '),
        });
      }
      continue;
    }
    tableState = 'none';

    const bullet = line.match(/^-\s+(.*)/);
    const numbered = line.match(/^\d+\.\s+\*\*(.*)/);
    const m = bullet || numbered;
    if (m && m[1].trim().length > 3) {
      counter += 1;
      elements.push({
        id: `PRD-${section.num}-${counter}`,
        section: section.num,
        sectionTitle: section.title,
        sub,
        kind: bullet ? 'bullet' : 'principle',
        text: m[1].trim(),
      });
    }
  }
  return elements;
}

// Extrait les tokens `code` d'un texte d'élément (noms de commandes, fichiers,
// scripts) — ce sont les ancres de matching les plus fiables.
export function extractTokens(text) {
  const tokens = [];
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[1].trim().split(/\s+/)[0];
    const base = raw.replace(/^\//, '').split('/').pop().replace(/\.(js|md|json)$/, '');
    if (base && base.length > 1) tokens.push(base.toLowerCase());
  }
  return [...new Set(tokens)];
}

// ─── Corpus de tests ────────────────────────────────────────────────────────

export function loadTestCorpus(testDir = TEST_DIR) {
  const files = readdirSync(testDir).filter((f) => f.endsWith('.test.js'));
  return files.map((f) => {
    const content = readFileSync(join(testDir, f), 'utf-8');
    return { file: f, name: f.replace(/\.test\.js$/, '').toLowerCase(), content: content.toLowerCase() };
  });
}

export function testsMatchingToken(token, corpus) {
  return corpus.filter((c) => c.name.includes(token) || c.content.includes(token)).map((c) => `test/${c.file}`);
}

// ─── Overrides (curation manuelle honnête : covered avec justification, ou exempt) ─

export function loadOverrides(path = OVERRIDES_PATH) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return {}; }
}

// ─── Évaluation de couverture PRD ───────────────────────────────────────────

export function evaluateElement(el, corpus, overrides) {
  if (EXEMPT_SECTIONS.has(el.section) && !overrides[el.id]) {
    return { ...el, status: 'exempt', reason: 'Section stratégique/narrative — non mécaniquement testable', tests: [] };
  }
  const override = overrides[el.id];
  if (override) {
    return { ...el, status: override.status, reason: override.reason || '', tests: override.tests || [] };
  }
  const tokens = extractTokens(el.text);
  const tests = [...new Set(tokens.flatMap((t) => testsMatchingToken(t, corpus)))];
  if (tests.length > 0) return { ...el, status: 'covered', reason: `Auto-matché sur ${tokens.join(', ')}`, tests };
  return { ...el, status: 'gap', reason: tokens.length ? `Aucun test pour : ${tokens.join(', ')}` : 'Pas d\'ancre `code` — nécessite un override manuel', tests: [] };
}

// ─── Couverture codebase (lib/**/*.js) ──────────────────────────────────────

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (entry.endsWith('.js')) out.push(p);
  }
  return out;
}

export function evaluateCodebase(corpus, libDir = LIB_DIR, overrides = {}) {
  const files = walk(libDir).map((p) => relative(ROOT, p).split(sep).join('/'));
  return files.map((relPath) => {
    const override = overrides[relPath];
    if (override) return { file: relPath, status: override.status, reason: override.reason || '', tests: override.tests || [] };
    const base = relPath.split('/').pop().replace(/\.js$/, '');
    const importPath = `../${relPath}`;
    const tests = corpus
      .filter((c) => c.content.includes(importPath.toLowerCase()) || c.name === base.toLowerCase())
      .map((c) => `test/${c.file}`);
    return { file: relPath, status: tests.length ? 'covered' : 'orphan', tests };
  });
}

// ─── Rapport ─────────────────────────────────────────────────────────────────

export function buildReport() {
  const md = readFileSync(PRD_PATH, 'utf-8');
  const elements = parsePrdElements(md);
  const corpus = loadTestCorpus();
  const overrides = loadOverrides();
  const prd = elements.map((el) => evaluateElement(el, corpus, overrides));
  const codebase = evaluateCodebase(corpus, LIB_DIR, overrides);

  const prdGaps = prd.filter((e) => e.status === 'gap');
  // `orphan-confirmed` = investigué manuellement (cf. overrides) et réellement
  // sans test — surfacé comme gap honnête plutôt que masqué.
  const codeOrphans = codebase.filter((c) => c.status === 'orphan' || c.status === 'orphan-confirmed');

  return {
    generatedFrom: relative(ROOT, PRD_PATH),
    prd: {
      total: prd.length,
      covered: prd.filter((e) => e.status === 'covered').length,
      exempt: prd.filter((e) => e.status === 'exempt').length,
      gap: prdGaps.length,
      elements: prd,
    },
    codebase: {
      total: codebase.length,
      covered: codebase.length - codeOrphans.length,
      orphan: codeOrphans.length,
      files: codebase,
    },
    pass: prdGaps.length === 0 && codeOrphans.length === 0,
  };
}

export function renderMarkdown(report) {
  const { prd, codebase } = report;
  const lines = [
    '# Rapport de couverture — SDD Mode',
    '',
    `Généré depuis \`${report.generatedFrom}\`. Verdict global : **${report.pass ? 'COUVERT' : 'GAP'}**.`,
    '',
    '## PRD',
    '',
    `- Éléments totaux : ${prd.total}`,
    `- Couverts : ${prd.covered}`,
    `- Exemptés (narratif/stratégique) : ${prd.exempt}`,
    `- Gaps : ${prd.gap}`,
    '',
  ];
  if (prd.gap > 0) {
    lines.push('### Gaps PRD', '');
    for (const e of prd.elements.filter((x) => x.status === 'gap')) {
      lines.push(`- \`${e.id}\` (§${e.section} ${e.sectionTitle}${e.sub ? ' / ' + e.sub : ''}) — ${e.text.slice(0, 100)} — _${e.reason}_`);
    }
    lines.push('');
  }
  lines.push('## Codebase (lib/**/*.js)', '', `- Fichiers totaux : ${codebase.total}`, `- Couverts : ${codebase.covered}`, `- Orphelins : ${codebase.orphan}`, '');
  if (codebase.orphan > 0) {
    lines.push('### Orphelins codebase', '');
    for (const f of codebase.files.filter((x) => x.status === 'orphan' || x.status === 'orphan-confirmed')) {
      lines.push(`- ${f.file}${f.reason ? ` — _${f.reason}_` : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const report = buildReport();

  if (args.includes('--write')) {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    writeFileSync(join(OUT_DIR, 'report.md'), renderMarkdown(report));
  }

  if (args.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderMarkdown(report));
  }

  process.exit(report.pass ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
