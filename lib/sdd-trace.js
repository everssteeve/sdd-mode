// AIAD SDD Mode — sdd-trace
//
// Évolution #6 : transforme le Drift Lock du rituel humain à la mesure
// algorithmique. Scanne les annotations machine-vérifiables (@intent,
// @spec, @verified-by, @governance) dans le code source et croise avec
// .aiad/intents/ + .aiad/specs/ pour produire :
//   1. matrice Forward  : Intent → SPEC → Code → Tests
//   2. matrice Backward : Tests → Code → SPEC → Intent
//   3. liste des gaps   : orphelins, non-implémentés, non-tracés
//
// Outputs : Markdown + JSON (CI) + HTML interactif.
//
// Documentation : https://aiad.ovh

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, dirname, extname } from 'node:path';

const C = {
  vert: '\x1b[32m',
  jaune: '\x1b[33m',
  rouge: '\x1b[31m',
  cyan: '\x1b[36m',
  gris: '\x1b[90m',
  gras: '\x1b[1m',
  reset: '\x1b[0m',
};

// ─── Convention d'annotations ────────────────────────────────────────────────
//
// Tags reconnus :
//   @intent       INTENT-NNN[-slug]
//   @spec         SPEC-NNN-NN-slug          (un fichier peut en référencer plusieurs)
//   @verified-by  chemin/relatif/test.ts    (un fichier peut en référencer plusieurs)
//   @governance   AIAD-AI-ACT,AIAD-RGPD     (liste séparée par virgules)
//
// Acceptés dans :
//   - JSDoc           /** @spec SPEC-042-1-flow-auth */
//   - Commentaires    // @spec SPEC-042-1-flow-auth
//   - Docstrings Py   """ @spec SPEC-042-1-flow-auth """
//   - Hash Python     # @spec SPEC-042-1-flow-auth
//
// Format ID :
//   INTENT-\d{3,}(-[a-z0-9-]+)?
//   SPEC-\d{3,}(-\d+)?(-[a-z0-9-]+)?

export const ANNOTATION_REGEX = {
  intent: /@intent\s+(INTENT-[A-Za-z0-9-]+)/g,
  spec: /@spec\s+(SPEC-[A-Za-z0-9-]+)/g,
  verifiedBy: /@verified-by\s+([^\s\n*#]+)/g,
  governance: /@governance\s+([A-Za-z0-9_,-]+)/g,
};

const EXTENSIONS_CODE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py']);
const DOSSIERS_IGNORES = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.cache',
  'coverage', '__pycache__', '.venv', 'venv', '.tox', '.pytest_cache',
  'target', 'out', '.aiad', '.claude',
]);

function estTest(chemin) {
  const base = chemin.toLowerCase();
  return (
    base.includes('/test/') ||
    base.includes('/tests/') ||
    base.includes('/__tests__/') ||
    base.includes('/spec/') ||
    /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|py)$/.test(base) ||
    /(^|\/)test_[^/]+\.py$/.test(base)
  );
}

function* parcourir(dir, base = dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const nom of entries) {
    if (DOSSIERS_IGNORES.has(nom) || nom.startsWith('.')) continue;
    const chemin = join(dir, nom);
    let st;
    try { st = statSync(chemin); } catch { continue; }
    if (st.isDirectory()) {
      yield* parcourir(chemin, base);
    } else if (st.isFile() && EXTENSIONS_CODE.has(extname(nom))) {
      yield relative(base, chemin);
    }
  }
}

// ─── Parser d'annotations ────────────────────────────────────────────────────

export function parserAnnotations(contenu, cheminRelatif) {
  const result = {
    intents: [],     // [{id, line}]
    specs: [],       // [{id, line}]
    verifiedBy: [],  // [{path, line}]
    governance: [],  // [{tags: [...], line}]
  };

  const lignes = contenu.split('\n');
  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];

    let m;
    ANNOTATION_REGEX.intent.lastIndex = 0;
    while ((m = ANNOTATION_REGEX.intent.exec(ligne)) !== null) {
      result.intents.push({ id: m[1], line: i + 1 });
    }
    ANNOTATION_REGEX.spec.lastIndex = 0;
    while ((m = ANNOTATION_REGEX.spec.exec(ligne)) !== null) {
      result.specs.push({ id: m[1], line: i + 1 });
    }
    ANNOTATION_REGEX.verifiedBy.lastIndex = 0;
    while ((m = ANNOTATION_REGEX.verifiedBy.exec(ligne)) !== null) {
      result.verifiedBy.push({ path: m[1], line: i + 1 });
    }
    ANNOTATION_REGEX.governance.lastIndex = 0;
    while ((m = ANNOTATION_REGEX.governance.exec(ligne)) !== null) {
      const tags = m[1].split(',').map((s) => s.trim()).filter(Boolean);
      result.governance.push({ tags, line: i + 1 });
    }
  }

  return result;
}

// ─── Lecture artefacts AIAD (intents + specs) ────────────────────────────────

function lireIntents(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'intents');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const nom of readdirSync(dir)) {
    if (!nom.endsWith('.md') || nom.startsWith('_')) continue;
    const m = nom.match(/^(INTENT-[A-Za-z0-9-]+)\.md$/);
    if (!m) continue;
    const chemin = join(dir, nom);
    const contenu = readFileSync(chemin, 'utf-8');
    const titreM = contenu.match(/^#\s+(.+)$/m);
    const statutM = contenu.match(/(?:^|\n)\s*(?:status|statut|Statut)\s*:\s*([a-z]+)/i);
    out.push({
      id: m[1],
      file: relative(racineProjet, chemin),
      title: titreM ? titreM[1].trim() : m[1],
      status: statutM ? statutM[1].toLowerCase() : 'unknown',
    });
  }
  return out;
}

function lireSpecs(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'specs');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const nom of readdirSync(dir)) {
    if (!nom.endsWith('.md') || nom.startsWith('_')) continue;
    const m = nom.match(/^(SPEC-[A-Za-z0-9-]+)\.md$/);
    if (!m) continue;
    const chemin = join(dir, nom);
    const contenu = readFileSync(chemin, 'utf-8');
    const titreM = contenu.match(/^#\s+(.+)$/m);
    const intentM = contenu.match(/Intent\s*parent\s*:\s*(INTENT-[A-Za-z0-9-]+)/i);
    const statutM = contenu.match(/(?:^|\n)\s*(?:Statut|status)\s*:\s*([a-z-]+)/i);
    out.push({
      id: m[1],
      file: relative(racineProjet, chemin),
      title: titreM ? titreM[1].trim() : m[1],
      parentIntent: intentM ? intentM[1] : null,
      status: statutM ? statutM[1].toLowerCase() : 'unknown',
    });
  }
  return out;
}

// ─── Scan code source ────────────────────────────────────────────────────────

function scanCode(racineProjet) {
  const fichiers = [];
  for (const fichier of parcourir(racineProjet, racineProjet)) {
    let contenu;
    try { contenu = readFileSync(join(racineProjet, fichier), 'utf-8'); } catch { continue; }
    const ann = parserAnnotations(contenu, fichier);
    const aDesAnnotations =
      ann.intents.length || ann.specs.length || ann.verifiedBy.length || ann.governance.length;
    fichiers.push({
      path: fichier,
      isTest: estTest(fichier),
      annotations: ann,
      annotated: Boolean(aDesAnnotations),
    });
  }
  return fichiers;
}

// ─── Construction du modèle de traçabilité ──────────────────────────────────

export function construireMatrice(racineProjet) {
  const intents = lireIntents(racineProjet);
  const specs = lireSpecs(racineProjet);
  const fichiers = scanCode(racineProjet);

  const codeFiles = fichiers.filter((f) => !f.isTest);
  const testFiles = fichiers.filter((f) => f.isTest);

  // Index : SPEC → fichiers code annotés
  const codeParSpec = new Map();
  // Index : SPEC → fichiers test annotés (via @spec dans un test)
  const testsParSpec = new Map();
  // Index : path → tests qui le mentionnent via @verified-by
  const testsParPathCode = new Map();

  for (const f of codeFiles) {
    for (const s of f.annotations.specs) {
      if (!codeParSpec.has(s.id)) codeParSpec.set(s.id, []);
      codeParSpec.get(s.id).push({ path: f.path, line: s.line });
    }
  }
  for (const t of testFiles) {
    for (const s of t.annotations.specs) {
      if (!testsParSpec.has(s.id)) testsParSpec.set(s.id, []);
      testsParSpec.get(s.id).push({ path: t.path, line: s.line });
    }
  }
  for (const f of codeFiles) {
    for (const v of f.annotations.verifiedBy) {
      if (!testsParPathCode.has(f.path)) testsParPathCode.set(f.path, []);
      testsParPathCode.get(f.path).push({ test: v.path, line: v.line });
    }
  }

  // Forward : Intent → SPECs → Code → Tests
  const forward = intents.map((intent) => {
    const specsLies = specs.filter((s) => s.parentIntent === intent.id);
    return {
      intent,
      specs: specsLies.map((spec) => {
        const code = codeParSpec.get(spec.id) || [];
        const testsViaSpec = testsParSpec.get(spec.id) || [];
        const testsViaCode = code.flatMap((c) => testsParPathCode.get(c.path) || []);
        const dedup = new Map();
        for (const t of testsViaSpec) {
          if (!dedup.has(t.path)) dedup.set(t.path, { path: t.path, line: t.line });
        }
        for (const t of testsViaCode) {
          if (!dedup.has(t.test)) dedup.set(t.test, { path: t.test, line: t.line, viaCode: true });
        }
        return { spec, code, tests: [...dedup.values()] };
      }),
    };
  });

  // Backward : Tests → Code → SPEC → Intent
  const backward = testFiles.flatMap((t) => {
    const entries = [];
    for (const s of t.annotations.specs) {
      const spec = specs.find((x) => x.id === s.id);
      const intent = spec?.parentIntent ? intents.find((i) => i.id === spec.parentIntent) : null;
      const code = codeParSpec.get(s.id) || [];
      entries.push({ test: { path: t.path, line: s.line }, spec, intent, code });
    }
    if (entries.length === 0) {
      entries.push({ test: { path: t.path, line: 0 }, spec: null, intent: null, code: [] });
    }
    return entries;
  });

  // Détection des gaps
  const gaps = {
    intentsSansSpec: intents.filter((i) => !specs.some((s) => s.parentIntent === i.id)),
    specsSansCode: specs
      .filter((s) => s.status !== 'draft' && s.status !== 'review')
      .filter((s) => !codeParSpec.has(s.id)),
    specsValideesNonImplementees: specs
      .filter((s) => ['ready', 'in-progress', 'validation', 'done'].includes(s.status))
      .filter((s) => !codeParSpec.has(s.id)),
    codeSansSpec: codeFiles.filter((f) => f.annotations.specs.length === 0),
    codeSansTests: codeFiles
      .filter((f) => f.annotations.specs.length > 0)
      .filter((f) => {
        const testsLinkes = f.annotations.specs.flatMap((s) => testsParSpec.get(s.id) || []);
        const testsViaCode = testsParPathCode.get(f.path) || [];
        return testsLinkes.length === 0 && testsViaCode.length === 0;
      }),
    intentsOrphelinsSurCode: [],
    specsOrphelinsSurCode: [],
  };

  // SPECs/Intents référencés dans le code mais absents des artefacts
  const specsConnus = new Set(specs.map((s) => s.id));
  const intentsConnus = new Set(intents.map((i) => i.id));
  for (const f of codeFiles) {
    for (const s of f.annotations.specs) {
      if (!specsConnus.has(s.id)) {
        gaps.specsOrphelinsSurCode.push({ id: s.id, file: f.path, line: s.line });
      }
    }
    for (const i of f.annotations.intents) {
      if (!intentsConnus.has(i.id)) {
        gaps.intentsOrphelinsSurCode.push({ id: i.id, file: f.path, line: i.line });
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      intents: intents.length,
      specs: specs.length,
      codeFiles: codeFiles.length,
      annotatedCodeFiles: codeFiles.filter((f) => f.annotated).length,
      testFiles: testFiles.length,
      annotatedTestFiles: testFiles.filter((f) => f.annotated).length,
    },
    forward,
    backward,
    gaps,
  };
}

// ─── Rendus ──────────────────────────────────────────────────────────────────

function rendreMarkdown(modele) {
  const L = [];
  L.push(`# SDD Trace — Matrice de traçabilité`);
  L.push('');
  L.push(`> Généré le ${modele.generatedAt}`);
  L.push('');
  L.push(`## Synthèse`);
  L.push('');
  L.push(`| Métrique | Valeur |`);
  L.push(`|----------|--------|`);
  L.push(`| Intents | ${modele.summary.intents} |`);
  L.push(`| SPECs | ${modele.summary.specs} |`);
  L.push(`| Fichiers code | ${modele.summary.codeFiles} (annotés : ${modele.summary.annotatedCodeFiles}) |`);
  L.push(`| Fichiers test | ${modele.summary.testFiles} (annotés : ${modele.summary.annotatedTestFiles}) |`);
  L.push('');

  L.push(`## Matrice Forward — Intent → SPEC → Code → Tests`);
  L.push('');
  L.push(`| Intent | SPEC | Code | Tests | Verdict |`);
  L.push(`|--------|------|------|-------|---------|`);
  for (const row of modele.forward) {
    if (row.specs.length === 0) {
      L.push(`| ${row.intent.id} | _(aucune SPEC)_ | — | — | ❌ orphelin |`);
      continue;
    }
    for (const s of row.specs) {
      const code = s.code.length ? s.code.map((c) => `\`${c.path}\``).join('<br/>') : '_(aucun)_';
      const tests = s.tests.length ? s.tests.map((t) => `\`${t.path}\``).join('<br/>') : '_(aucun)_';
      let verdict = '✅';
      if (s.code.length === 0) verdict = '⚠ non-implémentée';
      else if (s.tests.length === 0) verdict = '⚠ non-testée';
      L.push(`| ${row.intent.id} | ${s.spec.id} | ${code} | ${tests} | ${verdict} |`);
    }
  }
  L.push('');

  L.push(`## Matrice Backward — Tests → Code → SPEC → Intent`);
  L.push('');
  L.push(`| Test | SPEC | Intent | Code couvert |`);
  L.push(`|------|------|--------|--------------|`);
  for (const row of modele.backward) {
    const code = row.code.length ? row.code.map((c) => `\`${c.path}\``).join('<br/>') : '_(aucun)_';
    L.push(`| \`${row.test.path}\` | ${row.spec ? row.spec.id : '❌ non-tracé'} | ${row.intent ? row.intent.id : '—'} | ${code} |`);
  }
  L.push('');

  L.push(`## Gaps détectés`);
  L.push('');
  L.push(`### Orphelins`);
  L.push(`- Intents sans SPEC : **${modele.gaps.intentsSansSpec.length}**`);
  for (const x of modele.gaps.intentsSansSpec) L.push(`  - ${x.id} — ${x.title}`);
  L.push(`- SPECs sans code (hors draft/review) : **${modele.gaps.specsSansCode.length}**`);
  for (const x of modele.gaps.specsSansCode) L.push(`  - ${x.id} (statut : ${x.status})`);
  L.push(`- SPECs orphelins référencés dans le code : **${modele.gaps.specsOrphelinsSurCode.length}**`);
  for (const x of modele.gaps.specsOrphelinsSurCode) L.push(`  - ${x.id} → ${x.file}:${x.line}`);
  L.push(`- Intents orphelins référencés dans le code : **${modele.gaps.intentsOrphelinsSurCode.length}**`);
  for (const x of modele.gaps.intentsOrphelinsSurCode) L.push(`  - ${x.id} → ${x.file}:${x.line}`);
  L.push('');
  L.push(`### Non-implémentés`);
  L.push(`- SPECs validées sans code (statut ready/in-progress/validation/done) : **${modele.gaps.specsValideesNonImplementees.length}**`);
  for (const x of modele.gaps.specsValideesNonImplementees) L.push(`  - ${x.id} (statut : ${x.status})`);
  L.push('');
  L.push(`### Non-tracés`);
  L.push(`- Code sans \`@spec\` : **${modele.gaps.codeSansSpec.length}**`);
  for (const f of modele.gaps.codeSansSpec.slice(0, 50)) L.push(`  - ${f.path}`);
  if (modele.gaps.codeSansSpec.length > 50) L.push(`  - … (+${modele.gaps.codeSansSpec.length - 50} autres)`);
  L.push(`- Code annoté sans tests liés : **${modele.gaps.codeSansTests.length}**`);
  for (const f of modele.gaps.codeSansTests) L.push(`  - ${f.path}`);
  L.push('');

  return L.join('\n');
}

function rendreHtml(modele) {
  const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const rowsForward = modele.forward.flatMap((row) => {
    if (row.specs.length === 0) {
      return [`<tr><td>${escape(row.intent.id)}</td><td><em>(aucune SPEC)</em></td><td>—</td><td>—</td><td class="bad">❌ orphelin</td></tr>`];
    }
    return row.specs.map((s) => {
      const code = s.code.length ? s.code.map((c) => `<code>${escape(c.path)}</code>`).join('<br/>') : '<em>(aucun)</em>';
      const tests = s.tests.length ? s.tests.map((t) => `<code>${escape(t.path)}</code>`).join('<br/>') : '<em>(aucun)</em>';
      let verdict = '<span class="ok">✅</span>';
      let cls = 'ok';
      if (s.code.length === 0) { verdict = '<span class="warn">⚠ non-implémentée</span>'; cls = 'warn'; }
      else if (s.tests.length === 0) { verdict = '<span class="warn">⚠ non-testée</span>'; cls = 'warn'; }
      return `<tr class="${cls}"><td>${escape(row.intent.id)}</td><td>${escape(s.spec.id)}</td><td>${code}</td><td>${tests}</td><td>${verdict}</td></tr>`;
    });
  }).join('\n');

  const rowsBackward = modele.backward.map((row) => {
    const code = row.code.length ? row.code.map((c) => `<code>${escape(c.path)}</code>`).join('<br/>') : '<em>(aucun)</em>';
    const cls = row.spec ? 'ok' : 'bad';
    return `<tr class="${cls}"><td><code>${escape(row.test.path)}</code></td><td>${row.spec ? escape(row.spec.id) : '<span class="bad">❌ non-tracé</span>'}</td><td>${row.intent ? escape(row.intent.id) : '—'}</td><td>${code}</td></tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<title>SDD Trace — Matrice de traçabilité</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 2rem; max-width: 1200px; }
  h1, h2 { border-bottom: 1px solid #ccc; padding-bottom: .25rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { padding: .35rem .5rem; border: 1px solid #ddd; vertical-align: top; font-size: .9rem; }
  th { background: #f7f7f7; text-align: left; }
  code { background: #f0f0f0; padding: 0 .25rem; border-radius: 3px; font-size: .85em; }
  .ok { background: #f6fff6; }
  .warn { background: #fffbe6; }
  .bad { background: #ffeaea; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: .75rem; margin: 1rem 0; }
  .stat { padding: .75rem; border: 1px solid #ddd; border-radius: 4px; }
  .stat .v { font-size: 1.5rem; font-weight: bold; }
  .stat .k { color: #666; font-size: .85rem; }
  .filter { margin: .5rem 0 1rem; }
  input[type=search] { padding: .35rem .5rem; width: 320px; max-width: 100%; }
</style>
</head>
<body>
<h1>SDD Trace</h1>
<p><em>Généré le ${escape(modele.generatedAt)}</em></p>

<div class="stats">
  <div class="stat"><div class="v">${modele.summary.intents}</div><div class="k">Intents</div></div>
  <div class="stat"><div class="v">${modele.summary.specs}</div><div class="k">SPECs</div></div>
  <div class="stat"><div class="v">${modele.summary.annotatedCodeFiles} / ${modele.summary.codeFiles}</div><div class="k">Code annoté</div></div>
  <div class="stat"><div class="v">${modele.summary.annotatedTestFiles} / ${modele.summary.testFiles}</div><div class="k">Tests annotés</div></div>
  <div class="stat"><div class="v">${modele.gaps.codeSansSpec.length}</div><div class="k">Code sans @spec</div></div>
  <div class="stat"><div class="v">${modele.gaps.specsValideesNonImplementees.length}</div><div class="k">SPECs non-implémentées</div></div>
</div>

<h2>Matrice Forward</h2>
<div class="filter"><input type="search" id="qfwd" placeholder="Filtrer Forward…" /></div>
<table id="fwd"><thead><tr><th>Intent</th><th>SPEC</th><th>Code</th><th>Tests</th><th>Verdict</th></tr></thead><tbody>
${rowsForward}
</tbody></table>

<h2>Matrice Backward</h2>
<div class="filter"><input type="search" id="qbwd" placeholder="Filtrer Backward…" /></div>
<table id="bwd"><thead><tr><th>Test</th><th>SPEC</th><th>Intent</th><th>Code couvert</th></tr></thead><tbody>
${rowsBackward}
</tbody></table>

<script>
function bindFilter(inputId, tableId) {
  const input = document.getElementById(inputId);
  const table = document.getElementById(tableId);
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    for (const tr of table.tBodies[0].rows) {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    }
  });
}
bindFilter('qfwd', 'fwd');
bindFilter('qbwd', 'bwd');
</script>
</body>
</html>
`;
}

// ─── CLI entry point ─────────────────────────────────────────────────────────

function valeurFlag(args, nom) {
  const idx = args.indexOf(nom);
  if (idx === -1) return null;
  const v = args[idx + 1];
  if (!v || v.startsWith('--')) return null;
  return v;
}

export async function trace(projetDir, args = []) {
  const aiadDir = join(projetDir, '.aiad');
  if (!existsSync(aiadDir)) {
    console.error(`${C.rouge}  Pas de dossier .aiad/ — initialisez le projet avec 'npx aiad-sdd init'.${C.reset}`);
    process.exit(1);
  }

  const outDirArg = valeurFlag(args, '--out');
  const outDir = outDirArg
    ? join(projetDir, outDirArg)
    : join(aiadDir, 'metrics', 'traceability');
  const formats = (valeurFlag(args, '--format') || 'md,json,html').split(',').map((s) => s.trim());
  const verbose = !args.includes('--quiet');
  const failOnGap = args.includes('--fail-on-gap');
  const jsonStdout = args.includes('--json');

  const modele = construireMatrice(projetDir);

  if (jsonStdout) {
    process.stdout.write(JSON.stringify(modele, null, 2) + '\n');
    return modele;
  }

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const ecrits = [];
  if (formats.includes('md')) {
    const p = join(outDir, 'trace.md');
    writeFileSync(p, rendreMarkdown(modele), 'utf-8');
    ecrits.push(p);
  }
  if (formats.includes('json')) {
    const p = join(outDir, 'trace.json');
    writeFileSync(p, JSON.stringify(modele, null, 2), 'utf-8');
    ecrits.push(p);
  }
  if (formats.includes('html')) {
    const p = join(outDir, 'trace.html');
    writeFileSync(p, rendreHtml(modele), 'utf-8');
    ecrits.push(p);
  }

  if (verbose) {
    console.log(`\n${C.cyan}${C.gras}  AIAD SDD Trace — Matrice de traçabilité${C.reset}\n`);
    console.log(`  ${C.gras}Synthèse${C.reset}`);
    console.log(`    Intents       : ${modele.summary.intents}`);
    console.log(`    SPECs         : ${modele.summary.specs}`);
    console.log(`    Code annoté   : ${modele.summary.annotatedCodeFiles} / ${modele.summary.codeFiles}`);
    console.log(`    Tests annotés : ${modele.summary.annotatedTestFiles} / ${modele.summary.testFiles}`);

    const totalGaps = compterGaps(modele);
    const couleurGap = totalGaps === 0 ? C.vert : C.jaune;
    console.log(`\n  ${C.gras}Gaps${C.reset}`);
    console.log(`    Intents sans SPEC                      : ${couleurGap}${modele.gaps.intentsSansSpec.length}${C.reset}`);
    console.log(`    SPECs sans code                        : ${couleurGap}${modele.gaps.specsSansCode.length}${C.reset}`);
    console.log(`    SPECs validées non-implémentées        : ${couleurGap}${modele.gaps.specsValideesNonImplementees.length}${C.reset}`);
    console.log(`    SPECs orphelins référencés dans code   : ${couleurGap}${modele.gaps.specsOrphelinsSurCode.length}${C.reset}`);
    console.log(`    Intents orphelins référencés dans code : ${couleurGap}${modele.gaps.intentsOrphelinsSurCode.length}${C.reset}`);
    console.log(`    Code sans @spec                        : ${couleurGap}${modele.gaps.codeSansSpec.length}${C.reset}`);
    console.log(`    Code annoté sans tests                 : ${couleurGap}${modele.gaps.codeSansTests.length}${C.reset}`);

    console.log(`\n  ${C.gras}Outputs${C.reset}`);
    for (const p of ecrits) {
      console.log(`    ${C.vert}+${C.reset} ${relative(projetDir, p)}`);
    }
    console.log('');
  }

  if (failOnGap && compterGapsBloquants(modele) > 0) {
    console.error(`${C.rouge}  Gap(s) bloquant(s) détecté(s) — exit 1.${C.reset}\n`);
    process.exit(1);
  }

  return modele;
}

function compterGaps(m) {
  return (
    m.gaps.intentsSansSpec.length +
    m.gaps.specsSansCode.length +
    m.gaps.specsValideesNonImplementees.length +
    m.gaps.specsOrphelinsSurCode.length +
    m.gaps.intentsOrphelinsSurCode.length +
    m.gaps.codeSansSpec.length +
    m.gaps.codeSansTests.length
  );
}

function compterGapsBloquants(m) {
  // En CI, on bloque sur les vrais drifts machine-vérifiables (et non sur
  // l'absence d'annotation : ça dépend du périmètre adopté). Évolution #6
  // criticité 1 : SPEC validée sans code, SPEC référencée par le code mais
  // absente des artefacts, et symétriquement Intent.
  return (
    m.gaps.specsValideesNonImplementees.length +
    m.gaps.specsOrphelinsSurCode.length +
    m.gaps.intentsOrphelinsSurCode.length
  );
}
