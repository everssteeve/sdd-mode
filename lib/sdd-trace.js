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

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, watch as fsWatch } from 'node:fs';
import { join, relative, dirname, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { C } from './term.js';
import { parseFrontmatter } from './frontmatter.js';
import { rendreSarif } from './sarif.js';
import { suggererSpecs } from './spec-suggester.js';
import { readCache, writeCache, isFresh } from './trace-cache.js';
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';

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

// Extensions reconnues. Le parser d'annotations fonctionne sur le texte
// ligne par ligne, donc il accepte n'importe quel commentaire `//` ou `#`
// ou bloc `/* */`. Élargir la liste = élargir le marché EU adressable
// (équipes Rust/Go/Java/Kotlin/C#/Ruby/Swift/Scala/PHP/Elixir).
const EXTENSIONS_CODE = new Set([
  // JS / TS — supportés depuis l'origine.
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  // Python.
  '.py',
  // Langages ajoutés en v1.14 (item #32 phase 2 du backlog).
  '.rs',                 // Rust
  '.go',                 // Go
  '.java', '.kt', '.kts',// JVM (Java, Kotlin, Kotlin Script)
  '.cs',                 // C# / .NET
  '.rb',                 // Ruby
  '.php',                // PHP
  '.swift',              // Swift
  '.scala', '.sc',       // Scala / scripts Scala
  '.ex', '.exs',         // Elixir
]);
const DOSSIERS_IGNORES = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.cache',
  'coverage', '__pycache__', '.venv', 'venv', '.tox', '.pytest_cache',
  'target', 'out', '.aiad', '.claude',
]);

export function estTest(chemin) {
  const base = chemin.toLowerCase();
  return (
    // Dossiers conventionnels (couvrent la plupart des langages)
    base.includes('/test/') ||
    base.includes('/tests/') ||
    base.includes('/__tests__/') ||
    base.includes('/spec/') ||
    base.includes('/specs/') ||
    base.includes('src/test/') ||      // Java / Kotlin / Scala (Maven/Gradle)
    base.includes('src/tests/') ||
    // JS / TS / Python : *.test.* / *.spec.*
    /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|py)$/.test(base) ||
    // Python : test_foo.py
    /(^|\/)test_[^/]+\.py$/.test(base) ||
    // Go : foo_test.go
    /_test\.go$/.test(base) ||
    // Rust : tests/*.rs ou foo_test.rs
    /_test\.rs$/.test(base) ||
    // Java / Kotlin / Scala / Swift : FooTest.java, FooTests.kt, FooSpec.scala
    /(test|tests|spec)\.(java|kt|kts|scala|sc|swift|cs)$/.test(base) ||
    // Ruby : foo_spec.rb / foo_test.rb
    /_(spec|test)\.rb$/.test(base) ||
    // PHP : FooTest.php
    /test\.php$/.test(base) ||
    // Elixir : *_test.exs
    /_test\.exs$/.test(base)
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

/**
 * Liste les fichiers de code via `git ls-files` quand un repo Git est présent.
 * Avantages :
 *   - Respecte le .gitignore du projet (vendor/, target/, build/, etc.)
 *   - Ne scanne pas les fichiers non-tracked (résultats déterministes)
 *   - Bien plus rapide qu'un walk récursif sur monorepos
 *
 * Retourne null si pas de repo, si git absent, ou si la commande échoue.
 *
 * @param {string} racineProjet
 * @returns {string[] | null}
 */
export function listerFichiersGit(racineProjet) {
  if (!existsSync(join(racineProjet, '.git'))) return null;
  let r;
  try {
    r = spawnSync('git', ['-C', racineProjet, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'buffer' });
  } catch { return null; }
  if (!r || r.status !== 0 || !r.stdout) return null;
  const fichiers = r.stdout.toString('utf-8').split('\0').filter(Boolean);
  return fichiers.filter((f) => EXTENSIONS_CODE.has(extname(f)));
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

// Les artefacts .aiad sont rédigés en Markdown — les champs apparaissent
// fréquemment encadrés de gras (`**Intent parent** : INTENT-001`) ou listés
// sans préfixe. On normalise en supprimant le formatage Markdown léger
// (astérisques de gras/italique, espaces insécables) avant d'extraire les
// champs avec un regex tolérant à la mise en forme.
function nettoyerMd(contenu) {
  return contenu
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/[  ]/g, ' ');
}

function lireIntents(racineProjet) {
  const dir = join(racineProjet, '.aiad', 'intents');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const nom of readdirSync(dir)) {
    if (!nom.endsWith('.md') || nom.startsWith('_')) continue;
    const m = nom.match(/^(INTENT-[A-Za-z0-9-]+)\.md$/);
    if (!m) continue;
    const chemin = join(dir, nom);
    const brut = readFileSync(chemin, 'utf-8');
    const { data, body } = parseFrontmatter(brut);
    const contenu = nettoyerMd(body);
    const titreM = contenu.match(/^#\s+(.+)$/m);
    const statutFrontmatter = data.status || data.statut;
    const statutM = !statutFrontmatter && contenu.match(/(?:^|\n)\s*(?:status|statut)\s*:\s*([a-z-]+)/i);
    out.push({
      id: m[1],
      file: relative(racineProjet, chemin),
      title: data.title || data.titre || (titreM ? titreM[1].trim() : m[1]),
      status: String(statutFrontmatter || (statutM ? statutM[1] : 'unknown')).toLowerCase(),
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
    const brut = readFileSync(chemin, 'utf-8');
    const { data, body } = parseFrontmatter(brut);
    const contenu = nettoyerMd(body);
    const titreM = contenu.match(/^#\s+(.+)$/m);
    // Frontmatter accepté pour le rattachement à l'Intent parent. Ordre de
    // précédence : clé canonique `parent_intent` > alias `intent_parent` /
    // `intentParent` (camelCase) > `intent` (forme courte, déjà utilisée par
    // confluence.js et spec-version.js) > `parent` (legacy) > `Intent parent`
    // (forme markdown brute). Fallback final : regex `**Intent parent** :`
    // dans le corps Markdown.
    const parentFromFm =
      data.parent_intent ||
      data.intent_parent ||
      data.intentParent ||
      data.intent ||
      data.parent ||
      data['Intent parent'];
    const intentM = !parentFromFm && contenu.match(/Intent\s+parent\s*:\s*(INTENT-[A-Za-z0-9-]+)/i);
    const statutFromFm = data.status || data.statut;
    const statutM = !statutFromFm && contenu.match(/(?:^|\n)\s*(?:statut|status)\s*:\s*([a-z-]+)/i);
    out.push({
      id: m[1],
      file: relative(racineProjet, chemin),
      title: data.title || data.titre || (titreM ? titreM[1].trim() : m[1]),
      parentIntent: parentFromFm || (intentM ? intentM[1] : null),
      status: String(statutFromFm || (statutM ? statutM[1] : 'unknown')).toLowerCase(),
    });
  }
  return out;
}

// ─── Helpers ID matching ─────────────────────────────────────────────────────
//
// Les fichiers sont nommés `INTENT-NNN-[slug].md` mais les références dans
// le code et les SPECs utilisent fréquemment la forme courte `INTENT-NNN`
// (cf. CLAUDE.md, sdd/intent.md slash command, repl.js usage). On normalise
// vers la forme courte pour le matching afin d'accepter les deux conventions
// sans imposer de migration aux artefacts existants.
//
// Préfixe numérique stable : `INTENT-\d+` ou `SPEC-\d+(-\d+)?`. Une référence
// matche si elle est égale à l'ID exact OU si elle partage le même préfixe.

export function shortIntentId(id) {
  if (typeof id !== 'string') return id;
  const m = id.match(/^(INTENT-\d+)/);
  return m ? m[1] : id;
}

export function shortSpecId(id) {
  if (typeof id !== 'string') return id;
  const m = id.match(/^(SPEC-\d+(?:-\d+)?)/);
  return m ? m[1] : id;
}

function intentMatch(refId, intentId) {
  if (refId === intentId) return true;
  return shortIntentId(refId) === shortIntentId(intentId);
}

function specMatch(refId, specId) {
  if (refId === specId) return true;
  return shortSpecId(refId) === shortSpecId(specId);
}

// ─── Scan code source ────────────────────────────────────────────────────────

export function scanCode(racineProjet, options = {}) {
  const { useCache = true } = options;
  const fichiers = [];
  // Stratégie 1 : repo Git → git ls-files (respecte .gitignore, rapide).
  // Stratégie 2 : fallback walk récursif avec liste d'exclusion hardcodée.
  const listeGit = listerFichiersGit(racineProjet);
  const cibles = listeGit ?? [...parcourir(racineProjet, racineProjet)];

  // Cache incrémental : si activé, on lit le cache, on y pioche les
  // entrées encore fraîches (mtime + size inchangés) et on ne re-parse
  // que les fichiers réellement modifiés. Le cache est ré-écrit à la fin.
  const cache = useCache ? readCache(racineProjet) : { version: 1, files: {} };
  const nouveauCache = { files: {} };

  for (const fichier of cibles) {
    let stat;
    try { stat = statSync(join(racineProjet, fichier)); }
    catch { continue; }
    const meta = { mtimeMs: stat.mtimeMs, size: stat.size };

    let entry;
    if (useCache && isFresh(cache.files[fichier], meta)) {
      // Cache HIT : on réutilise les annotations parsées.
      entry = {
        path: fichier,
        isTest: cache.files[fichier].isTest,
        annotations: cache.files[fichier].annotations,
        annotated: cache.files[fichier].annotated,
      };
    } else {
      // Cache MISS : on parse réellement le fichier.
      let contenu;
      try { contenu = readFileSync(join(racineProjet, fichier), 'utf-8'); }
      catch { continue; }
      const ann = parserAnnotations(contenu, fichier);
      const aDesAnnotations =
        ann.intents.length || ann.specs.length || ann.verifiedBy.length || ann.governance.length;
      entry = {
        path: fichier,
        isTest: estTest(fichier),
        annotations: ann,
        annotated: Boolean(aDesAnnotations),
      };
    }

    fichiers.push(entry);
    nouveauCache.files[fichier] = {
      mtimeMs: meta.mtimeMs,
      size: meta.size,
      isTest: entry.isTest,
      annotated: entry.annotated,
      annotations: entry.annotations,
    };
  }

  // Réécriture du cache (best-effort — silencieux sur erreur).
  if (useCache) writeCache(racineProjet, nouveauCache);

  return fichiers;
}

/**
 * Variante asynchrone qui parallélise le scan via Worker threads quand le
 * nombre de cibles dépasse `parallelThreshold` (défaut 50 000 fichiers).
 * Sous le seuil, retombe sur `scanCode()` synchrone (overhead Worker > gain).
 *
 * @param {string} racineProjet
 * @param {{ useCache?: boolean, parallelThreshold?: number, maxWorkers?: number }} [options]
 * @returns {Promise<object[]>}
 */
export async function scanCodeAsync(racineProjet, options = {}) {
  const {
    useCache = true,
    parallelThreshold = 50000,
    maxWorkers = Math.min(cpus().length, 8),
  } = options;

  const listeGit = listerFichiersGit(racineProjet);
  const cibles = listeGit ?? [...parcourir(racineProjet, racineProjet)];

  // Sous le seuil → scan synchrone (overhead Worker = ~30 ms / worker, donc
  // gain = parsing × parallelisme − overhead. Sur < 50k, séquentiel reste
  // gagnant).
  if (cibles.length < parallelThreshold || maxWorkers <= 1) {
    return scanCode(racineProjet, { useCache });
  }

  const cache = useCache ? readCache(racineProjet) : { version: 1, files: {} };

  // Découpe en N chunks équilibrés.
  const tailleChunk = Math.ceil(cibles.length / maxWorkers);
  const chunks = [];
  for (let i = 0; i < cibles.length; i += tailleChunk) {
    chunks.push(cibles.slice(i, i + tailleChunk));
  }

  const workerPath = fileURLToPath(new URL('./trace-worker.js', import.meta.url));

  const resultats = await Promise.all(chunks.map((chunk) => {
    // Sous-cache restreint au chunk (évite de copier 100k entrées × N).
    const sousCache = {};
    for (const f of chunk) if (cache.files[f]) sousCache[f] = cache.files[f];
    return new Promise((resolve, reject) => {
      const w = new Worker(workerPath, {
        workerData: { racine: racineProjet, chunk, cache: sousCache },
      });
      w.once('message', (msg) => {
        w.terminate();
        if (msg && msg.error) reject(new Error(msg.error));
        else resolve(msg);
      });
      w.once('error', (err) => { w.terminate(); reject(err); });
    });
  }));

  // Fusion des résultats.
  const entries = [];
  const nouveauCache = { files: {} };
  for (const r of resultats) {
    entries.push(...r.entries);
    Object.assign(nouveauCache.files, r.cacheUpdates);
  }
  if (useCache) writeCache(racineProjet, nouveauCache);
  return entries;
}

// ─── Construction du modèle de traçabilité ──────────────────────────────────

export function construireMatrice(racineProjet) {
  const intents = lireIntents(racineProjet);
  const specs = lireSpecs(racineProjet);
  const fichiers = scanCode(racineProjet);

  const codeFiles = fichiers.filter((f) => !f.isTest);
  const testFiles = fichiers.filter((f) => f.isTest);

  // Index : SPEC (clé courte SPEC-NNN-N) → fichiers code annotés
  // Les clés sont normalisées via shortSpecId() pour accepter `@spec SPEC-NNN-N`
  // et `@spec SPEC-NNN-N-slug` indifféremment (cf. helpers ID matching).
  const codeParSpec = new Map();
  // Index : SPEC (clé courte) → fichiers test annotés (via @spec dans un test)
  const testsParSpec = new Map();
  // Index : path → tests qui le mentionnent via @verified-by
  const testsParPathCode = new Map();

  for (const f of codeFiles) {
    for (const s of f.annotations.specs) {
      const key = shortSpecId(s.id);
      if (!codeParSpec.has(key)) codeParSpec.set(key, []);
      codeParSpec.get(key).push({ path: f.path, line: s.line });
    }
  }
  for (const t of testFiles) {
    for (const s of t.annotations.specs) {
      const key = shortSpecId(s.id);
      if (!testsParSpec.has(key)) testsParSpec.set(key, []);
      testsParSpec.get(key).push({ path: t.path, line: s.line });
    }
  }
  for (const f of codeFiles) {
    for (const v of f.annotations.verifiedBy) {
      if (!testsParPathCode.has(f.path)) testsParPathCode.set(f.path, []);
      testsParPathCode.get(f.path).push({ test: v.path, line: v.line });
    }
  }

  // Forward : Intent → SPECs → Code → Tests
  // Le matching parentIntent ↔ intent.id accepte la forme courte
  // (`INTENT-NNN`) ou la forme complète (`INTENT-NNN-slug`) — cf. helpers.
  const forward = intents.map((intent) => {
    const specsLies = specs.filter((s) => s.parentIntent && intentMatch(s.parentIntent, intent.id));
    return {
      intent,
      specs: specsLies.map((spec) => {
        const specKey = shortSpecId(spec.id);
        const code = codeParSpec.get(specKey) || [];
        const testsViaSpec = testsParSpec.get(specKey) || [];
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
      const spec = specs.find((x) => specMatch(s.id, x.id));
      const intent = spec?.parentIntent ? intents.find((i) => intentMatch(spec.parentIntent, i.id)) : null;
      const code = codeParSpec.get(shortSpecId(s.id)) || [];
      entries.push({ test: { path: t.path, line: s.line }, spec, intent, code });
    }
    if (entries.length === 0) {
      entries.push({ test: { path: t.path, line: 0 }, spec: null, intent: null, code: [] });
    }
    return entries;
  });

  // Détection des gaps
  const gaps = {
    intentsSansSpec: intents.filter((i) => !specs.some((s) => s.parentIntent && intentMatch(s.parentIntent, i.id))),
    specsSansCode: specs
      .filter((s) => s.status !== 'draft' && s.status !== 'review')
      .filter((s) => !codeParSpec.has(shortSpecId(s.id))),
    specsValideesNonImplementees: specs
      .filter((s) => ['ready', 'in-progress', 'validation', 'done'].includes(s.status))
      .filter((s) => !codeParSpec.has(shortSpecId(s.id))),
    codeSansSpec: codeFiles.filter((f) => f.annotations.specs.length === 0),
    codeSansTests: codeFiles
      .filter((f) => f.annotations.specs.length > 0)
      .filter((f) => {
        const testsLinkes = f.annotations.specs.flatMap((s) => testsParSpec.get(shortSpecId(s.id)) || []);
        const testsViaCode = testsParPathCode.get(f.path) || [];
        return testsLinkes.length === 0 && testsViaCode.length === 0;
      }),
    intentsOrphelinsSurCode: [],
    specsOrphelinsSurCode: [],
  };

  // SPECs/Intents référencés dans le code mais absents des artefacts.
  // Comparaison sur les formes courtes pour accepter `INTENT-001` ↔
  // `INTENT-001-slug` et `SPEC-001-1` ↔ `SPEC-001-1-slug`.
  const specsConnus = new Set(specs.map((s) => shortSpecId(s.id)));
  const intentsConnus = new Set(intents.map((i) => shortIntentId(i.id)));
  for (const f of codeFiles) {
    for (const s of f.annotations.specs) {
      if (!specsConnus.has(shortSpecId(s.id))) {
        gaps.specsOrphelinsSurCode.push({ id: s.id, file: f.path, line: s.line });
      }
    }
    for (const i of f.annotations.intents) {
      if (!intentsConnus.has(shortIntentId(i.id))) {
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

/**
 * Génère la matrice de traçabilité dans le dossier .aiad/metrics/traceability/
 * (ou un autre via `out`). Accepte un objet d'options pour rester
 * indépendant du parser CLI.
 *
 * Mode `watch: true` — surveille `.aiad/intents/`, `.aiad/specs/` et le code
 * source du projet (extensions reconnues), régénère sur changement avec
 * debounce 200ms. Garde le process vivant jusqu'à SIGINT.
 *
 * @param {string} projetDir
 * @param {{
 *   out?: string,
 *   formats?: string[],
 *   quiet?: boolean,
 *   failOnGap?: boolean,
 *   json?: boolean,
 *   watch?: boolean,
 * }} [options]
 */
export async function trace(projetDir, options = {}) {
  const aiadDir = join(projetDir, '.aiad');
  if (!existsSync(aiadDir)) {
    console.error(`${C.rouge}  Pas de dossier .aiad/ — initialisez le projet avec 'npx aiad-sdd init'.${C.reset}`);
    process.exit(1);
  }

  const {
    out: outDirArg,
    formats = ['md', 'json', 'html', 'sarif'],
    quiet = false,
    failOnGap = false,
    json: jsonStdout = false,
    watch = false,
    suggest = false,
    dryRun = false,
  } = options;
  const outDir = outDirArg ? join(projetDir, outDirArg) : join(aiadDir, 'metrics', 'traceability');
  const verbose = !quiet;

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
  if (formats.includes('sarif')) {
    const p = join(outDir, 'trace.sarif');
    writeFileSync(p, JSON.stringify(rendreSarif(modele), null, 2), 'utf-8');
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

  // Mode --suggest : crée des squelettes EARS pour les SPECs orphelines.
  if (suggest) {
    const r = suggererSpecs(projetDir, modele, { dryRun });
    if (verbose) {
      const suffixe = dryRun ? `${C.gris} (dry-run)${C.reset}` : '';
      if (r.created.length === 0 && r.existing.length === 0) {
        console.log(`  ${C.gris}Aucune SPEC orpheline détectée — rien à suggérer.${C.reset}\n`);
      } else {
        console.log(`  ${C.gras}Squelettes EARS suggérés${suffixe}${C.reset}`);
        for (const id of r.created) console.log(`    ${C.vert}+${C.reset} .aiad/specs/${id}.md`);
        for (const id of r.existing) console.log(`    ${C.gris}~${C.reset} .aiad/specs/${id}.md (déjà présent, conservé)`);
        console.log('');
      }
    }
    // En mode dry-run, on n'enchaîne pas le failOnGap (l'utilisateur veut l'aperçu).
    if (dryRun) return modele;
  }

  if (failOnGap && compterGapsBloquants(modele) > 0) {
    console.error(`${C.rouge}  Gap(s) bloquant(s) détecté(s) — exit 1.${C.reset}\n`);
    process.exit(1);
  }

  // Mode watch : reste vivant et régénère à chaque changement.
  if (watch) {
    if (verbose) {
      console.log(`  ${C.cyan}⏵${C.reset} Watch actif — modifie .aiad/intents/, .aiad/specs/ ou ton code pour voir la matrice se régénérer.`);
      console.log(`  ${C.gris}Ctrl+C pour arrêter.${C.reset}\n`);
    }
    const stop = demarrerWatch(projetDir, async () => {
      try {
        const m = construireMatrice(projetDir);
        for (const f of formats) {
          if (f === 'md') writeFileSync(join(outDir, 'trace.md'), rendreMarkdown(m), 'utf-8');
          else if (f === 'json') writeFileSync(join(outDir, 'trace.json'), JSON.stringify(m, null, 2), 'utf-8');
          else if (f === 'html') writeFileSync(join(outDir, 'trace.html'), rendreHtml(m), 'utf-8');
          else if (f === 'sarif') writeFileSync(join(outDir, 'trace.sarif'), JSON.stringify(rendreSarif(m), null, 2), 'utf-8');
        }
        const total = compterGaps(m);
        const couleur = total === 0 ? C.vert : C.jaune;
        console.log(`  ${C.cyan}↻${C.reset} Matrice régénérée — ${couleur}${total} gap(s)${C.reset}, ${m.summary.specs} SPEC(s), ${m.summary.codeFiles} fichier(s) code.`);
      } catch (err) {
        console.error(`  ${C.rouge}✗${C.reset} Régénération échouée : ${err.message}`);
      }
    });
    const arret = () => {
      console.log(`\n  ${C.gris}Arrêt du watch.${C.reset}`);
      stop();
      process.exit(0);
    };
    process.on('SIGINT', arret);
    process.on('SIGTERM', arret);
    await new Promise(() => {}); // bloque jusqu'à signal
  }

  return modele;
}

// Démarre un watcher fs sur les sources de la traçabilité (intents, specs,
// code applicatif) avec debounce + filtrage des artefacts générés. Retourne
// une fonction `stop()`.
export function demarrerWatch(projetDir, onChange, { debounceMs = 200 } = {}) {
  const aiadDir = join(projetDir, '.aiad');
  let timer = null;
  const trigger = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; onChange(); }, debounceMs);
  };

  const ignorer = (filename) => {
    if (!filename) return false;
    return (
      /\.lock$/.test(filename) ||
      /^metrics\//.test(filename) ||           // sortie de trace elle-même
      /^\.git\//.test(filename) ||
      /node_modules\//.test(filename) ||
      /\.swp$|~$|\.tmp$/i.test(filename) ||
      /\.DS_Store$/.test(filename)
    );
  };

  // Watcher 1 : `.aiad/` recursive (intents, specs).
  let watcherAiad;
  try {
    watcherAiad = fsWatch(aiadDir, { recursive: true }, (_evt, filename) => {
      if (ignorer(filename)) return;
      trigger();
    });
  } catch { /* ENOENT possible si init en cours */ }

  // Watcher 2 : racine projet recursive — pour le code applicatif.
  let watcherRoot;
  try {
    watcherRoot = fsWatch(projetDir, { recursive: true }, (_evt, filename) => {
      if (ignorer(filename)) return;
      // Ne déclenche que sur fichiers code reconnus
      if (!filename) return;
      const ext = extname(filename);
      if (!EXTENSIONS_CODE.has(ext)) return;
      trigger();
    });
  } catch { /* ignore — fallback ok */ }

  return () => {
    if (timer) clearTimeout(timer);
    try { watcherAiad?.close(); } catch { /* ignore */ }
    try { watcherRoot?.close(); } catch { /* ignore */ }
  };
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

// ─── Alias EN canoniques (item #42) ─────────────────────────────────────────
//
// Le parser et le builder de matrice étaient déjà en mix FR/EN. On expose
// des noms purement anglais en supplément pour les contributeurs externes.
export {
  parserAnnotations as parseAnnotations,
  construireMatrice as buildMatrix,
  listerFichiersGit as listGitFiles,
  scanCode as scanSourceCode,
  demarrerWatch as startWatch,
};
