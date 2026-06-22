// Tests d'intégration de `dashboard()` après éclatement collect/server/assets.
// Vérifie que le rendu HTML continue à émettre les fichiers attendus, que le
// CSS et le JS sont bien copiés en assets/, et que la page d'accueil
// référence bien la maturité.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { init } from '../lib/init.js';
import { dashboard } from '../lib/dashboard.js';
import { CSS, APP_JS } from '../lib/dashboard/assets.js';

// (#176) init() accepte désormais `quiet: true` qui supprime tous ses logs
// dans son propre scope (try/finally). Plus besoin de silencer global qui
// corrompait le bookkeeping de node:test (sous-tests muets dans TAP).

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-dash-')); }

test('dashboard — émet 12 pages + assets + data.json après init complet', async () => {
  const dir = tmp();
  try {
    await init(dir, { quiet: true });
    const r = await dashboard(dir, { quiet: true });

    const expected = [
      'index.html', 'intents.html', 'specs.html', 'traceability.html',
      'graph.html', 'metrics.html', 'qa.html', 'adrs.html', 'legal.html',
      'governance.html', 'drifts.html', 'changelog.html',
    ];
    for (const f of expected) {
      assert.ok(existsSync(join(r.outDir, f)), `page manquante : ${f}`);
    }

    // Assets externalisés
    const css = readFileSync(join(r.outDir, 'assets', 'style.css'), 'utf-8');
    const js = readFileSync(join(r.outDir, 'assets', 'app.js'), 'utf-8');
    assert.equal(css, CSS, 'style.css ≠ CSS source');
    assert.equal(js, APP_JS, 'app.js ≠ APP_JS source');

    // data.json sérialisable
    const data = JSON.parse(readFileSync(join(r.outDir, 'data.json'), 'utf-8'));
    assert.ok(data.projet);
    assert.ok(data.maturite);
    assert.equal(data.gouvernance.length, 5);
    assert.ok(data.gouvernance.find((g) => g.id === 'AIAD-CRA'), 'AIAD-CRA absent de la gouvernance');

    // index.html référence le CSS et le JS
    const index = readFileSync(join(r.outDir, 'index.html'), 'utf-8');
    assert.match(index, /assets\/style\.css/);
    assert.match(index, /assets\/app\.js/);

    // (#237) favicon.svg écrit + référencé dans <head>
    assert.ok(existsSync(join(r.outDir, 'favicon.svg')), 'favicon.svg manquant');
    assert.match(index, /<link rel="icon" href="favicon\.svg" type="image\/svg\+xml"/);

    // (#238) meta share tags Open Graph + Twitter + theme-color
    assert.match(index, /<meta name="description"/);
    assert.match(index, /<meta name="theme-color"/);
    assert.match(index, /property="og:title"/);
    assert.match(index, /property="og:image" content="badge\.svg"/);
    assert.match(index, /name="twitter:card"/);

    // (#239) sitemap.xml + robots.txt présents pour SEO/Pages
    assert.ok(existsSync(join(r.outDir, 'sitemap.xml')), 'sitemap.xml manquant');
    assert.ok(existsSync(join(r.outDir, 'robots.txt')), 'robots.txt manquant');
    const sitemap = readFileSync(join(r.outDir, 'sitemap.xml'), 'utf-8');
    assert.match(sitemap, /<urlset/);
    assert.match(sitemap, /index\.html/);

    // (#289) shields-endpoints.json (3 endpoints conformes shields.io)
    assert.ok(existsSync(join(r.outDir, 'shields-endpoints.json')), 'shields-endpoints.json manquant');
    const eps = JSON.parse(readFileSync(join(r.outDir, 'shields-endpoints.json'), 'utf-8'));
    assert.equal(eps.length, 3);
    assert.deepEqual(eps.map((e) => e.type), ['sante', 'maturite', 'violations']);
    assert.equal(eps[0].schemaVersion, 1);

    // (#241) manifest.webmanifest présent + référencé dans <head>
    assert.ok(existsSync(join(r.outDir, 'manifest.webmanifest')), 'manifest.webmanifest manquant');
    assert.match(index, /<link rel="manifest" href="manifest\.webmanifest"/);
    const manifest = JSON.parse(readFileSync(join(r.outDir, 'manifest.webmanifest'), 'utf-8'));
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.icons[0].src, 'favicon.svg');

    // (#243) .nojekyll présent pour GitHub Pages
    assert.ok(existsSync(join(r.outDir, '.nojekyll')), '.nojekyll manquant');
    assert.equal(readFileSync(join(r.outDir, '.nojekyll'), 'utf-8'), '');

    // (#249) 404.html présent + utilise le layout (nav + branding)
    assert.ok(existsSync(join(r.outDir, '404.html')), '404.html manquant');
    const p404 = readFileSync(join(r.outDir, '404.html'), 'utf-8');
    assert.match(p404, /Page introuvable/);
    assert.match(p404, /href="index\.html"/);
    assert.match(p404, /<nav class="side">/);
    assert.match(p404, /manifest\.webmanifest/);

    // (#271) Footer mentionne la version AIAD pour debug cross-version
    assert.match(index, /Framework AIAD v\d+\.\d+\.\d+/);
    assert.match(index, /href="https:\/\/aiad\.ovh"/);

    // (#272) <meta name="aiad-version"> pour discovery DOM programmatique
    assert.match(index, /<meta name="aiad-version" content="\d+\.\d+\.\d+"/);

    // (#244 + #246) CSP meta tag présent dans <head>
    assert.match(index, /<meta http-equiv="Content-Security-Policy"/);
    assert.match(index, /default-src 'self'/);
    assert.match(index, /script-src 'self' 'unsafe-inline' https:\/\/cdn\.jsdelivr\.net/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// (#253) _meta section dans data.json
// @spec SPEC-016-3
test('dashboard — data.json contient _meta en tête (schema/version/slim/generated)', async () => {
  const dir = tmp();
  try {
    await init(dir, { quiet: true });
    const r = await dashboard(dir, { quiet: true });
    const raw = readFileSync(join(r.outDir, 'data.json'), 'utf-8');
    // _meta doit être la première clé (premiers caractères après l'accolade)
    assert.match(raw.slice(0, 50), /^\{\s*"_meta"\s*:/);
    const data = JSON.parse(raw);
    assert.equal(data._meta.schema, 'aiad-sdd-dashboard');
    assert.equal(data._meta.schema_version, '2.0');
    assert.match(data._meta.version, /^\d+\.\d+\.\d+/);
    assert.equal(data._meta.slim, true);
    assert.match(data._meta.generated, /^\d{4}-\d{2}-\d{2}T/);
    // _schema doit être présent avec les pointeurs de schéma
    assert.ok(data._schema, '_schema absent de data.json');
    assert.equal(data._schema.local, 'lib/dashboard/schema/data-v2.schema.json');
    assert.equal(data._schema.url, 'https://aiad.ovh/schema/data-v2.schema.json');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('dashboard --full : _meta.slim=false', async () => {
  const dir = tmp();
  try {
    await init(dir, { quiet: true });
    const r = await dashboard(dir, { quiet: true, full: true });
    const data = JSON.parse(readFileSync(join(r.outDir, 'data.json'), 'utf-8'));
    assert.equal(data._meta.slim, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// (#252) data.json slim par défaut, --full pour audit complet
test('dashboard — data.json tronque matrice.gaps.codeSansSpec à 100 entrées + sidecar _total', async () => {
  const dir = tmp();
  try {
    await init(dir, { quiet: true });
    // Crée 150 fichiers .js qui n'auront pas d'annotation @spec → produit
    // un gap codeSansSpec > 100.
    const codeDir = join(dir, 'src');
    mkdirSync(codeDir, { recursive: true });
    for (let i = 0; i < 150; i++) {
      writeFileSync(join(codeDir, `f${i}.js`), `// no spec\nexport const x${i} = ${i};\n`);
    }
    const r = await dashboard(dir, { quiet: true });
    const slim = JSON.parse(readFileSync(join(r.outDir, 'data.json'), 'utf-8'));
    const codeSansSpec = slim.matrice?.gaps?.codeSansSpec;
    if (Array.isArray(codeSansSpec) && slim.matrice.gaps.codeSansSpec_truncated) {
      assert.equal(codeSansSpec.length, 100, 'défaut tronqué à 100');
      assert.ok(slim.matrice.gaps.codeSansSpec_total > 100, 'sidecar _total présent');
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('dashboard --full : data.json sans troncature', async () => {
  const dir = tmp();
  try {
    await init(dir, { quiet: true });
    const codeDir = join(dir, 'src');
    mkdirSync(codeDir, { recursive: true });
    for (let i = 0; i < 150; i++) {
      writeFileSync(join(codeDir, `f${i}.js`), `// no spec\nexport const x${i} = ${i};\n`);
    }
    const r = await dashboard(dir, { quiet: true, full: true });
    const full = JSON.parse(readFileSync(join(r.outDir, 'data.json'), 'utf-8'));
    // Pas de sidecar _truncated en mode --full
    if (full.matrice?.gaps?.codeSansSpec) {
      assert.equal(full.matrice.gaps.codeSansSpec_truncated, undefined);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// (#250) dashboard --check : valide sans écrire
test('dashboard --check : renvoie ok=true + pages sans écrire de fichier', async () => {
  const dir = tmp();
  try {
    await init(dir, { quiet: true });
    const r = await dashboard(dir, { check: true });
    assert.equal(r.ok, true);
    assert.ok(r.pages.length >= 12, `pages.length=${r.pages.length}`);
    assert.deepEqual(r.errors, []);
    // En mode check, AUCUN fichier dashboard/ ne doit être créé
    assert.equal(existsSync(join(dir, 'dashboard')), false,
      'dashboard/ ne doit pas exister en mode --check');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// #160 — data.json doit exposer les nouvelles propriétés ajoutées
// par les implémentations récentes (qa, pm, adrs, legalPacks, supplementaire,
// signaux). Test régression pour détecter une suppression accidentelle.
test('dashboard — data.json expose qa/pm/adrs/legalPacks/supplementaire/signaux', async () => {
  const dir = tmp();
  try {
    await init(dir, { quiet: true });
    const r = await dashboard(dir, { quiet: true });
    const data = JSON.parse(readFileSync(join(r.outDir, 'data.json'), 'utf-8'));

    // QA (#135)
    assert.ok(data.qa, 'data.json.qa absent');
    assert.ok(Array.isArray(data.qa.queueReadySansTests));
    assert.ok(Array.isArray(data.qa.coverage));
    assert.ok(data.qa.audit);
    assert.ok(data.qa.ears);
    assert.ok(Array.isArray(data.qa.testsRecents));

    // PM (#137)
    assert.ok(data.pm, 'data.json.pm absent');
    assert.ok(Array.isArray(data.pm.zombies));
    assert.ok(Array.isArray(data.pm.draftsAnciens));
    assert.ok(Array.isArray(data.pm.specsNonDemontrees));
    assert.ok(data.pm.seuils);

    // ADRs (#138)
    assert.ok(data.adrs, 'data.json.adrs absent');
    assert.ok(Array.isArray(data.adrs.entrees));

    // Legal packs (#139)
    assert.ok(Array.isArray(data.legalPacks), 'data.json.legalPacks absent');

    // Supplementaire (#134)
    assert.ok(data.supplementaire, 'data.json.supplementaire absent');
    assert.ok(data.supplementaire.dpia);
    assert.ok(data.supplementaire.aiAct);
    assert.ok(data.supplementaire.sbom);
    assert.ok(data.supplementaire.sovereignty);
    assert.ok(data.supplementaire.hookStats);

    // Signaux (#133)
    assert.ok(data.signaux, 'data.json.signaux absent');
    assert.ok('git' in data.signaux);
    assert.ok('hooks' in data.signaux);

    // Maturité enrichie (#133)
    assert.ok('scoreBrut' in data.maturite, 'maturite.scoreBrut absent');
    assert.ok('plafond' in data.maturite);
    assert.equal(data.maturite.total, 5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// #144 — Test du contenu visuel : chaque page expose son H1 attendu, et la
// page governance liste les 5 IDs Tier 1 + KPI 5/5 sur l'index. Régression
// directe pour fix #132.
test('dashboard — contenu visuel : H1 par page + 5 Tier 1 dans governance', async () => {
  const dir = tmp();
  try {
    await init(dir, { quiet: true });
    const r = await dashboard(dir, { quiet: true });

    // Apostrophes encodées en `&#39;` par le helper escape(), on relâche
    // donc le motif autour pour rester robuste à ce détail.
    const titresAttendus = {
      'index.html': /<h1>Vue d[^<]*ensemble<\/h1>/,
      'intents.html': /<h1>Intent Statements<\/h1>/,
      'specs.html': /<h1>SPECs<\/h1>/,
      'traceability.html': /<h1>Traçabilité<\/h1>/,
      'graph.html': /<h1>(Graphe|Knowledge|connaissances)[^<]*<\/h1>/,
      'metrics.html': /<h1>Métriques<\/h1>/,
      'qa.html': /<h1>Quality Assurance<\/h1>/,
      'adrs.html': /<h1>(Architecture Decision Records|ADRs)<\/h1>/,
      'legal.html': /<h1>Legal[^<]*<\/h1>/,
      'governance.html': /<h1>Gouvernance[^<]*<\/h1>/,
      'drifts.html': /<h1>(Drifts|Facts)[^<]*<\/h1>/,
      'changelog.html': /<h1>Changelog[^<]*<\/h1>/,
    };
    for (const [f, re] of Object.entries(titresAttendus)) {
      const html = readFileSync(join(r.outDir, f), 'utf-8');
      assert.match(html, re, `H1 attendu absent dans ${f}`);
    }

    // governance.html contient les 5 IDs Tier 1
    const gov = readFileSync(join(r.outDir, 'governance.html'), 'utf-8');
    for (const id of ['AIAD-AI-ACT', 'AIAD-RGPD', 'AIAD-RGAA', 'AIAD-RGESN', 'AIAD-CRA']) {
      assert.match(gov, new RegExp(id), `${id} absent de governance.html`);
    }
    // (#140) Meta aiad-generated-at dans toutes les pages — consommée par
    // le polling live côté JS.
    assert.match(gov, /<meta name="aiad-generated-at" content="\d{4}-\d{2}-\d{2}T/);

    // index.html affiche KPI Gouvernance 5/5 et n'a pas de cadran fantôme "—"
    const index = readFileSync(join(r.outDir, 'index.html'), 'utf-8');
    assert.match(index, /5\/5/, 'KPI Gouvernance 5/5 absent');

    // qa.html / pm section / adrs / legal — sections visibles
    const qa = readFileSync(join(r.outDir, 'qa.html'), 'utf-8');
    assert.match(qa, /Queue QA/);
    assert.match(qa, /Coverage par SPEC/);

    const legal = readFileSync(join(r.outDir, 'legal.html'), 'utf-8');
    assert.match(legal, /AI Act|Annexe IV/);
    assert.match(legal, /DPIA/);
    assert.match(legal, /Packs juridictionnels/);

    // index expose la section PM "À valider cette semaine"
    assert.match(index, /À valider cette semaine/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('dashboard — quiet=true ne pollue pas stdout', async () => {
  const dir = tmp();
  try {
    await init(dir, { quiet: true });
    const orig = process.stdout.write.bind(process.stdout);
    let buf = '';
    process.stdout.write = (chunk) => { buf += chunk; return true; };
    try {
      await dashboard(dir, { quiet: true });
    } finally {
      process.stdout.write = orig;
    }
    assert.equal(buf, '', `stdout pollué en quiet : ${buf.slice(0, 200)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// (#322) Verbose log Public URL [origine] symétrique à Source base
test('#322 dashboard verbose log — Public URL [CLI] visible quand --public-url passé', async () => {
  const dir = tmp();
  try {
    await init(dir, { quiet: true });
    const orig = process.stdout.write.bind(process.stdout);
    let buf = '';
    process.stdout.write = (chunk) => { buf += chunk; return true; };
    try {
      await dashboard(dir, { publicUrl: 'https://o.github.io/r' });
    } finally {
      process.stdout.write = orig;
    }
    assert.match(buf, /Public URL.*https:\/\/o\.github\.io\/r.*\[CLI\]/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('#322 dashboard verbose log — Public URL [env AIAD_PUBLIC_URL] quand env utilisé', async () => {
  const dir = tmp();
  const saved = process.env.AIAD_PUBLIC_URL;
  try {
    await init(dir, { quiet: true });
    process.env.AIAD_PUBLIC_URL = 'https://envpages.example.com/repo';
    const orig = process.stdout.write.bind(process.stdout);
    let buf = '';
    process.stdout.write = (chunk) => { buf += chunk; return true; };
    try {
      await dashboard(dir);
    } finally {
      process.stdout.write = orig;
    }
    assert.match(buf, /Public URL.*envpages\.example\.com.*\[env AIAD_PUBLIC_URL\]/);
  } finally {
    if (saved == null) delete process.env.AIAD_PUBLIC_URL;
    else process.env.AIAD_PUBLIC_URL = saved;
    rmSync(dir, { recursive: true, force: true });
  }
});

// (#334) Governance agent IDs hyperliés vers fichier .aiad/gouvernance/AIAD-X.md
test('#334 dashboard — governance.html agent IDs hyperliés quand fichier présent', async () => {
  const dir = tmp();
  try {
    await init(dir, { quiet: true });
    await dashboard(dir, { quiet: true });
    const gov = readFileSync(join(dir, 'dashboard', 'governance.html'), 'utf-8');
    // Au moins 1 agent Tier 1 hyperlié vers son .md
    assert.match(gov, /<a[^>]+href="\.\.\/\.aiad\/gouvernance\/AIAD-[A-Z-]+\.md"[^>]*>AIAD-[A-Z-]+<\/a>/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// (#337) Validation du format --source-base
test('#337 dashboard — sourceBase sans http(s)// → warning stderr', async () => {
  const dir = tmp();
  try {
    await init(dir, { quiet: true });
    const origErr = process.stderr.write.bind(process.stderr);
    let buf = '';
    process.stderr.write = (chunk) => { buf += chunk; return true; };
    try {
      await dashboard(dir, { quiet: true, sourceBase: 'github.com/o/r/blob/main' });
    } finally {
      process.stderr.write = origErr;
    }
    assert.match(buf, /ne ressemble pas à une URL absolue/);
    assert.match(buf, /github\.com\/o\/r\/blob\/main/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('#337 dashboard — sourceBase https://... → pas de warning', async () => {
  const dir = tmp();
  try {
    await init(dir, { quiet: true });
    const origErr = process.stderr.write.bind(process.stderr);
    let buf = '';
    process.stderr.write = (chunk) => { buf += chunk; return true; };
    try {
      await dashboard(dir, { quiet: true, sourceBase: 'https://github.com/o/r/blob/main' });
    } finally {
      process.stderr.write = origErr;
    }
    assert.ok(!buf.includes('ne ressemble pas'), `pas de warning attendu, reçu : ${buf.slice(0, 200)}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('#337 dashboard — sourceBase vide → pas de warning', async () => {
  const dir = tmp();
  try {
    await init(dir, { quiet: true });
    const origErr = process.stderr.write.bind(process.stderr);
    let buf = '';
    process.stderr.write = (chunk) => { buf += chunk; return true; };
    try {
      await dashboard(dir, { quiet: true });
    } finally {
      process.stderr.write = origErr;
    }
    assert.ok(!buf.includes('ne ressemble pas'), 'sourceBase vide ne doit pas warner');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// (#321) Verbose log de l'origine du sourceBase résolu
test('#321 dashboard verbose log — Source base [CLI] visible quand --source-base passé', async () => {
  const dir = tmp();
  try {
    await init(dir, { quiet: true });
    const orig = process.stdout.write.bind(process.stdout);
    let buf = '';
    process.stdout.write = (chunk) => { buf += chunk; return true; };
    try {
      await dashboard(dir, { sourceBase: 'https://github.com/o/r/blob/main' });
    } finally {
      process.stdout.write = orig;
    }
    assert.match(buf, /Source base.*https:\/\/github\.com\/o\/r\/blob\/main.*\[CLI\]/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('#321 dashboard verbose log — Source base [env AIAD_SOURCE_BASE] quand env utilisé', async () => {
  const dir = tmp();
  const saved = process.env.AIAD_SOURCE_BASE;
  try {
    await init(dir, { quiet: true });
    process.env.AIAD_SOURCE_BASE = 'https://env.example.com/blob/main';
    const orig = process.stdout.write.bind(process.stdout);
    let buf = '';
    process.stdout.write = (chunk) => { buf += chunk; return true; };
    try {
      await dashboard(dir);
    } finally {
      process.stdout.write = orig;
    }
    assert.match(buf, /Source base.*env\.example\.com.*\[env AIAD_SOURCE_BASE\]/);
  } finally {
    if (saved == null) delete process.env.AIAD_SOURCE_BASE;
    else process.env.AIAD_SOURCE_BASE = saved;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#321 dashboard verbose log — ligne Source base absente quand non configuré', async () => {
  const dir = tmp();
  const saved = process.env.AIAD_SOURCE_BASE;
  try {
    delete process.env.AIAD_SOURCE_BASE;
    await init(dir, { quiet: true });
    const orig = process.stdout.write.bind(process.stdout);
    let buf = '';
    process.stdout.write = (chunk) => { buf += chunk; return true; };
    try {
      await dashboard(dir);
    } finally {
      process.stdout.write = orig;
    }
    assert.ok(!buf.includes('Source base'), `attendu pas de ligne Source base, reçu : ${buf.slice(0, 200)}`);
  } finally {
    if (saved != null) process.env.AIAD_SOURCE_BASE = saved;
    rmSync(dir, { recursive: true, force: true });
  }
});

// (#320) Expose resolvedSourceBase dans data.json top-level
test('#320 dashboard — data.json expose sourceBase résolu (CLI)', async () => {
  const dir = tmp();
  try {
    await init(dir, { quiet: true });
    await dashboard(dir, { quiet: true, sourceBase: 'https://github.com/o/r/blob/main' });
    const data = JSON.parse(readFileSync(join(dir, 'dashboard', 'data.json'), 'utf-8'));
    assert.equal(data.sourceBase, 'https://github.com/o/r/blob/main');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('#320 dashboard — data.json expose sourceBase depuis env AIAD_SOURCE_BASE', async () => {
  const dir = tmp();
  const saved = process.env.AIAD_SOURCE_BASE;
  try {
    await init(dir, { quiet: true });
    process.env.AIAD_SOURCE_BASE = 'https://env.example.com/blob/main';
    await dashboard(dir, { quiet: true });
    const data = JSON.parse(readFileSync(join(dir, 'dashboard', 'data.json'), 'utf-8'));
    assert.equal(data.sourceBase, 'https://env.example.com/blob/main');
  } finally {
    if (saved == null) delete process.env.AIAD_SOURCE_BASE;
    else process.env.AIAD_SOURCE_BASE = saved;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#320 dashboard — data.json sourceBase = "" quand non configuré', async () => {
  const dir = tmp();
  const saved = process.env.AIAD_SOURCE_BASE;
  try {
    delete process.env.AIAD_SOURCE_BASE;
    await init(dir, { quiet: true });
    await dashboard(dir, { quiet: true });
    const data = JSON.parse(readFileSync(join(dir, 'dashboard', 'data.json'), 'utf-8'));
    assert.equal(data.sourceBase, '');
  } finally {
    if (saved != null) process.env.AIAD_SOURCE_BASE = saved;
    rmSync(dir, { recursive: true, force: true });
  }
});

// (#316) AIAD_SOURCE_BASE env var fallback
test('#316 dashboard — option sourceBase a priorité sur AIAD_SOURCE_BASE', async () => {
  const dir = tmp();
  const saved = process.env.AIAD_SOURCE_BASE;
  try {
    await init(dir, { quiet: true });
    process.env.AIAD_SOURCE_BASE = 'https://env.example.com/repo/blob/main';
    writeFileSync(join(dir, '.aiad', 'ARCHITECTURE.md'),
      '# Archi\n\n## ADRs in-line\n\n- **ADR-001** : choix Postgres\n', 'utf-8');
    await dashboard(dir, { quiet: true, sourceBase: 'https://cli.example.com/repo/blob/main' });
    const html = readFileSync(join(dir, 'dashboard', 'adrs.html'), 'utf-8');
    assert.match(html, /href="https:\/\/cli\.example\.com\/repo\/blob\/main\/\.aiad\/ARCHITECTURE\.md/);
    assert.ok(!html.includes('env.example.com'), 'env ne doit pas écraser --source-base CLI');
  } finally {
    if (saved == null) delete process.env.AIAD_SOURCE_BASE;
    else process.env.AIAD_SOURCE_BASE = saved;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#316 dashboard — AIAD_SOURCE_BASE utilisé quand --source-base absent', async () => {
  const dir = tmp();
  const saved = process.env.AIAD_SOURCE_BASE;
  try {
    await init(dir, { quiet: true });
    writeFileSync(join(dir, '.aiad', 'ARCHITECTURE.md'),
      '# Archi\n\n## ADRs in-line\n\n- **ADR-001** : choix Postgres\n', 'utf-8');
    process.env.AIAD_SOURCE_BASE = 'https://env.example.com/repo/blob/main';
    await dashboard(dir, { quiet: true });
    const html = readFileSync(join(dir, 'dashboard', 'adrs.html'), 'utf-8');
    assert.match(html, /href="https:\/\/env\.example\.com\/repo\/blob\/main\/\.aiad\/ARCHITECTURE\.md/);
  } finally {
    if (saved == null) delete process.env.AIAD_SOURCE_BASE;
    else process.env.AIAD_SOURCE_BASE = saved;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('assets — CSS et APP_JS exportés sont des chaînes non-vides', () => {
  assert.equal(typeof CSS, 'string');
  assert.equal(typeof APP_JS, 'string');
  assert.ok(CSS.length > 1000, 'CSS trop court');
  assert.ok(APP_JS.length > 100, 'APP_JS trop court');
  // Sanity : les blocs sont valides syntaxiquement
  assert.ok(CSS.includes(':root'));
  assert.ok(APP_JS.includes('DOMContentLoaded'));
  // (#177) Click-to-copy handler câblé sur data-copy
  assert.ok(APP_JS.includes('data-copy'), 'handler click-to-copy absent');
  assert.ok(APP_JS.includes('navigator.clipboard'), 'API clipboard non utilisée');
  assert.ok(APP_JS.includes('bindCopyOnClick'), 'fonction bindCopyOnClick absente');
  assert.ok(CSS.includes('.copied'), 'CSS .copied absent');
  // (#182) Auto-tag des IDs Intent/SPEC/ADR/FACT
  assert.ok(APP_JS.includes('autoTagIds'), 'fonction autoTagIds absente');
  assert.ok(APP_JS.includes('INTENT|SPEC|ADR|FACT'), 'pattern d\'IDs absent');
  assert.ok(CSS.includes('id-copyable'), 'CSS .id-copyable absent');
  // (#140) Mode live polling
  assert.ok(APP_JS.includes('startLivePolling'), 'fonction startLivePolling absente');
  assert.ok(APP_JS.includes("params.get('live')"), 'opt-out ?live=0 absent');
  assert.ok(APP_JS.includes("fetch('data.json'"), 'fetch data.json absent');
  assert.ok(APP_JS.includes('aiad-live-toast'), 'toast non-cumulatif (id) absent');
});
