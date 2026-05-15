// Tests `lib/storybook.js` — storybook HTML des commandes slash.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  lireCommandesSlash,
  collecterCommandes,
  extraireSections,
  rendreCard,
  genererHtml,
  genererStorybook,
  // alias EN
  listSlashCommands,
  collectCommands,
  extractSections,
  renderCard,
  buildHtml,
  generateStorybook,
} from '../lib/storybook.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RACINE = join(__dirname, '..');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-sb-')); }

function silentLog(fn) {
  return async (...args) => {
    const orig = console.log;
    console.log = () => {};
    try { return await fn(...args); }
    finally { console.log = orig; }
  };
}

// ─── lireCommandesSlash ─────────────────────────────────────────────────────

test('lireCommandesSlash — lit *.md avec frontmatter + body', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'init.md'), '---\ndescription: Initialiser le projet\n---\n# Body');
    writeFileSync(join(d, 'spec.md'), '---\ndescription: Rédiger une SPEC\n---\n# Body');
    writeFileSync(join(d, 'README.md'), '---\n---\nignored');
    const cmds = lireCommandesSlash(d, 'sdd');
    assert.equal(cmds.length, 2);
    const init = cmds.find((c) => c.id === 'init');
    assert.equal(init.namespace, 'sdd');
    assert.equal(init.frontmatter.description, 'Initialiser le projet');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('lireCommandesSlash — dossier absent → []', () => {
  assert.deepEqual(lireCommandesSlash('/dev/null/inexistant'), []);
});

test('lireCommandesSlash — tri alphabétique', () => {
  const d = tmp();
  try {
    for (const id of ['z-spec', 'a-init', 'm-gate']) {
      writeFileSync(join(d, `${id}.md`), '---\n---\nbody');
    }
    const cmds = lireCommandesSlash(d, 'sdd');
    assert.deepEqual(cmds.map((c) => c.id), ['a-init', 'm-gate', 'z-spec']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── collecterCommandes (templates internes) ────────────────────────────────

test('collecterCommandes — collecte les ≥ 30 commandes des templates internes', () => {
  const cmds = collecterCommandes();
  assert.ok(cmds.length >= 30, `attendu ≥ 30 commandes, vu ${cmds.length}`);
  const ns = new Set(cmds.map((c) => c.namespace));
  assert.ok(ns.has('sdd'));
  assert.ok(ns.has('aiad'));
});

test('collecterCommandes — namespaces correctement étiquetés', () => {
  const cmds = collecterCommandes();
  const sdd = cmds.filter((c) => c.namespace === 'sdd');
  const aiad = cmds.filter((c) => c.namespace === 'aiad');
  assert.ok(sdd.length >= 14, `attendu ≥ 14 commandes /sdd, vu ${sdd.length}`);
  assert.ok(aiad.length >= 15, `attendu ≥ 15 commandes /aiad, vu ${aiad.length}`);
});

// ─── extraireSections ──────────────────────────────────────────────────────

test('extraireSections — extrait Fast path / Mode guidé / Règles', () => {
  const body = `# Title

## 🚀 Fast path (expert)

Input : foo
Output : bar

## 📖 Mode guidé (pas à pas)

Étape 1 : foo
Étape 2 : bar

## Règles

- Ne jamais X
- Toujours Y

## Anti-patterns

X
`;
  const r = extraireSections(body);
  assert.match(r.fastPath, /Input : foo/);
  assert.match(r.modeGuide, /Étape 1/);
  assert.match(r.regles, /Ne jamais X/);
});

test('extraireSections — sections manquantes → strings vides', () => {
  const r = extraireSections('# Just title\n\nbody');
  assert.equal(r.fastPath, '');
  assert.equal(r.modeGuide, '');
  assert.equal(r.regles, '');
});

// ─── rendreCard ─────────────────────────────────────────────────────────────

test('rendreCard — produit un HTML avec namespace + slash + description', () => {
  const cmd = {
    id: 'init',
    namespace: 'sdd',
    path: '/path/to/templates/.claude/sdd/init.md',
    frontmatter: { description: 'Initialiser le projet' },
    body: '## 🚀 Fast path\n\nInput : foo',
  };
  const html = rendreCard(cmd);
  assert.match(html, /data-namespace="sdd"/);
  assert.match(html, /data-id="init"/);
  assert.match(html, /\/sdd init/);
  assert.match(html, /Initialiser le projet/);
  assert.match(html, /Fast path/);
});

test('rendreCard — escape HTML correctement', () => {
  const cmd = {
    id: 'test',
    namespace: 'sdd',
    path: 'x',
    frontmatter: { description: '<script>alert(1)</script>' },
    body: '',
  };
  const html = rendreCard(cmd);
  // Vérifie que le script n'apparaît pas non échappé
  assert.ok(!html.includes('<script>alert'));
  assert.match(html, /&lt;script&gt;/);
});

// ─── genererHtml ────────────────────────────────────────────────────────────

test('genererHtml — page complète avec toolbar + filtres + grid', () => {
  const cmds = [
    { id: 'init', namespace: 'sdd', path: '/x', frontmatter: { description: 'Init' }, body: '' },
    { id: 'spec', namespace: 'sdd', path: '/x', frontmatter: { description: 'Spec' }, body: '' },
  ];
  const html = genererHtml(cmds);
  assert.match(html, /<!DOCTYPE html>/);
  assert.match(html, /Storybook des commandes slash/);
  assert.match(html, /id="search"/);
  assert.match(html, /data-ns="sdd"/);
  assert.match(html, /data-ns="aiad"/);
  // Compteur
  assert.match(html, /\(2\)/); // sdd: 2 commandes
});

test('genererHtml — embarque CSS + JS inline (autonome)', () => {
  const html = genererHtml([]);
  assert.match(html, /<style>/);
  assert.match(html, /<script>/);
  // Aucun CDN externe
  assert.ok(!/https?:\/\//.test(html.replace(/aiad\.ovh/g, '')));
});

// ─── alias EN ───────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(listSlashCommands, lireCommandesSlash);
  assert.equal(collectCommands, collecterCommandes);
  assert.equal(extractSections, extraireSections);
  assert.equal(renderCard, rendreCard);
  assert.equal(buildHtml, genererHtml);
  assert.equal(generateStorybook, genererStorybook);
});

// ─── Pipeline genererStorybook ──────────────────────────────────────────────

test('genererStorybook — produit dashboard/storybook.html par défaut', silentLog(async () => {
  const d = tmp();
  try {
    const r = await genererStorybook(d);
    assert.ok(r.path);
    assert.match(r.path, /storybook\.html$/);
    assert.ok(existsSync(r.path));
    assert.ok(r.count >= 30);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('genererStorybook --out custom', silentLog(async () => {
  const d = tmp();
  try {
    const r = await genererStorybook(d, { out: 'docs/cmds.html' });
    assert.equal(r.path, join(d, 'docs/cmds.html'));
    assert.ok(existsSync(r.path));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('genererStorybook --dry-run → aucun fichier écrit', silentLog(async () => {
  const d = tmp();
  try {
    const r = await genererStorybook(d, { dryRun: true });
    assert.ok(!existsSync(r.path));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('genererStorybook --json → JSON exploitable sur stdout', async () => {
  const d = tmp();
  try {
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try {
      await genererStorybook(d, { json: true });
    } finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.ok(parsed.total >= 30);
    assert.ok(parsed.byNamespace.sdd >= 14);
    assert.ok(parsed.byNamespace.aiad >= 15);
    assert.ok(Array.isArray(parsed.commands));
  } finally { rmSync(d, { recursive: true, force: true }); }
});
