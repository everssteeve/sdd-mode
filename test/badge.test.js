// Tests pour `aiad-sdd badge` (#230)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import {
  lireSante, genererSvg, couleurBadge, genererBadge,
  calculerContenuBadge, genererTousLesBadges, TYPES_VALIDES,
  readHealth, renderSvg, generateBadge, badgeColor,
  computeBadgeContent, generateAllBadges,
} from '../lib/badge.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, '..', 'bin', 'aiad-sdd.js');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-badge-')); }

test('couleurBadge — niveau prioritaire sur score', () => {
  assert.equal(couleurBadge('excellent', 50), '#4c1');
  assert.equal(couleurBadge('sain', 30), '#97ca00');
  assert.equal(couleurBadge('attention', 90), '#dfb317');
  assert.equal(couleurBadge('critique', 99), '#e05d44');
});

test('couleurBadge — fallback sur score si niveau absent', () => {
  assert.equal(couleurBadge(null, 90), '#4c1');
  assert.equal(couleurBadge(null, 75), '#97ca00');
  assert.equal(couleurBadge(null, 55), '#dfb317');
  assert.equal(couleurBadge(null, 20), '#e05d44');
});

test('couleurBadge — niveau et score inconnus → gris', () => {
  assert.equal(couleurBadge(null, null), '#9f9f9f');
  assert.equal(couleurBadge('inexistant', undefined), '#9f9f9f');
});

test('lireSante — sans data.json → null', () => {
  const dir = tmp();
  try {
    assert.equal(lireSante(dir), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireSante — JSON valide → {score, niveau}', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      santeGlobale: { score: 82, niveau: 'sain' },
    }));
    const r = lireSante(dir);
    assert.deepEqual(r, { score: 82, niveau: 'sain' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireSante — JSON cassé → null', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), '{invalid');
    assert.equal(lireSante(dir), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lireSante — santeGlobale.score absent → null', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({ projet: { nom: 'x' } }));
    assert.equal(lireSante(dir), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('genererSvg — santé connue produit SVG valide', () => {
  const svg = genererSvg({ score: 75, niveau: 'sain' });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /AIAD SDD/);
  assert.match(svg, /75\/100 sain/);
  assert.match(svg, /#97ca00/); // couleur sain
  assert.match(svg, /<\/svg>$/);
});

test('genererSvg — sans donnees → message "non calculé" gris', () => {
  const svg = genererSvg(null);
  assert.match(svg, /non calculé/);
  assert.match(svg, /#9f9f9f/);
});

test('genererSvg — label custom respecté', () => {
  const svg = genererSvg({ score: 90, niveau: 'excellent' }, { label: 'Health' });
  assert.match(svg, /Health/);
  assert.match(svg, /90\/100 excellent/);
  assert.match(svg, /#4c1/);
});

test('genererSvg — échappe XML (anti-injection)', () => {
  const svg = genererSvg({ score: 50, niveau: '<script>' });
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
});

test('genererBadge — dryRun n\'écrit pas', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      santeGlobale: { score: 75, niveau: 'sain' },
    }));
    const r = genererBadge(dir, { dryRun: true });
    assert.match(r.svg, /75\/100 sain/);
    assert.equal(r.donnees.score, 75);
    assert.equal(existsSync(join(dir, 'dashboard', 'badge.svg')), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('genererBadge — écrit dashboard/badge.svg par défaut', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      santeGlobale: { score: 85, niveau: 'excellent' },
    }));
    const r = genererBadge(dir);
    assert.equal(r.path, join(dir, 'dashboard', 'badge.svg'));
    const contenu = readFileSync(r.path, 'utf-8');
    assert.match(contenu, /85\/100 excellent/);
    assert.match(contenu, /#4c1/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('genererBadge — --out custom écrit ailleurs', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      santeGlobale: { score: 60, niveau: 'attention' },
    }));
    const r = genererBadge(dir, { out: 'docs/badge.svg' });
    assert.equal(r.path, join(dir, 'docs', 'badge.svg'));
    assert.ok(existsSync(r.path));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('genererBadge — sans dashboard → SVG "non calculé"', () => {
  const dir = tmp();
  try {
    const r = genererBadge(dir, { dryRun: true });
    assert.equal(r.donnees, null);
    assert.match(r.svg, /non calculé/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Alias EN canoniques', () => {
  assert.equal(readHealth, lireSante);
  assert.equal(renderSvg, genererSvg);
  assert.equal(generateBadge, genererBadge);
  assert.equal(badgeColor, couleurBadge);
  assert.equal(computeBadgeContent, calculerContenuBadge);
  assert.equal(generateAllBadges, genererTousLesBadges);
});

// ─── #231 badge --type ──────────────────────────────────────────────────────

test('TYPES_VALIDES exporte les 3 types', () => {
  assert.deepEqual(TYPES_VALIDES, ['sante', 'maturite', 'violations']);
});

test('calculerContenuBadge — sante extrait santeGlobale', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      santeGlobale: { score: 75, niveau: 'sain' },
    }));
    const c = calculerContenuBadge(dir, 'sante');
    assert.equal(c.label, 'AIAD SDD');
    assert.equal(c.message, '75/100 sain');
    assert.equal(c.couleur, '#97ca00');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerContenuBadge — maturite 5/5 → excellent vert', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      maturite: { score: 5, total: 5, label: 'Complet' },
    }));
    const c = calculerContenuBadge(dir, 'maturite');
    assert.equal(c.label, 'AIAD Maturité');
    assert.equal(c.message, '5/5 Complet');
    assert.equal(c.couleur, '#4c1');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerContenuBadge — maturite 4/5 → sain', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      maturite: { score: 4, total: 5, label: 'Avancé' },
    }));
    assert.equal(calculerContenuBadge(dir, 'maturite').couleur, '#97ca00');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerContenuBadge — maturite 3/5 → attention', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      maturite: { score: 3, total: 5, label: 'Intermédiaire' },
    }));
    assert.equal(calculerContenuBadge(dir, 'maturite').couleur, '#dfb317');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerContenuBadge — maturite 1/5 → critique', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      maturite: { score: 1, total: 5, label: 'Émergent' },
    }));
    assert.equal(calculerContenuBadge(dir, 'maturite').couleur, '#e05d44');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerContenuBadge — violations 0 → excellent "aucune dérive"', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      violations: { total: 0 },
    }));
    const c = calculerContenuBadge(dir, 'violations');
    assert.equal(c.label, 'AIAD Violations');
    assert.equal(c.message, 'aucune dérive');
    assert.equal(c.couleur, '#4c1');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerContenuBadge — violations 3 → attention', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      violations: { total: 3 },
    }));
    const c = calculerContenuBadge(dir, 'violations');
    assert.equal(c.message, '3 Tier 1');
    assert.equal(c.couleur, '#dfb317');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerContenuBadge — violations 5 → critique', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      violations: { total: 5 },
    }));
    assert.equal(calculerContenuBadge(dir, 'violations').couleur, '#e05d44');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calculerContenuBadge — sans data → null', () => {
  const dir = tmp();
  try {
    assert.equal(calculerContenuBadge(dir, 'sante'), null);
    assert.equal(calculerContenuBadge(dir, 'maturite'), null);
    assert.equal(calculerContenuBadge(dir, 'violations'), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('genererBadge --type=maturite écrit dashboard/badge-maturite.svg', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      maturite: { score: 5, total: 5, label: 'Complet' },
    }));
    const r = genererBadge(dir, { type: 'maturite' });
    assert.equal(r.path, join(dir, 'dashboard', 'badge-maturite.svg'));
    assert.match(r.svg, /AIAD Maturité/);
    assert.match(r.svg, /5\/5 Complet/);
    assert.match(r.svg, /#4c1/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('genererBadge --type inconnu → throw', () => {
  const dir = tmp();
  try {
    assert.throws(() => genererBadge(dir, { type: 'inexistant' }), /inconnu/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('genererTousLesBadges produit 3 SVG distincts', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      santeGlobale: { score: 75, niveau: 'sain' },
      maturite: { score: 5, total: 5, label: 'Complet' },
      violations: { total: 0 },
    }));
    const rs = genererTousLesBadges(dir);
    assert.equal(rs.length, 3);
    assert.deepEqual(rs.map((r) => r.type), ['sante', 'maturite', 'violations']);
    assert.ok(existsSync(join(dir, 'dashboard', 'badge.svg')));
    assert.ok(existsSync(join(dir, 'dashboard', 'badge-maturite.svg')));
    assert.ok(existsSync(join(dir, 'dashboard', 'badge-violations.svg')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI badge --all écrit les 3 SVG', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      santeGlobale: { score: 80, niveau: 'sain' },
      maturite: { score: 4, total: 5, label: 'Avancé' },
      violations: { total: 2 },
    }));
    const r = spawnSync('node', [BIN, 'badge', '--all'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /sante/);
    assert.match(r.stdout, /maturite/);
    assert.match(r.stdout, /violations/);
    assert.ok(existsSync(join(dir, 'dashboard', 'badge.svg')));
    assert.ok(existsSync(join(dir, 'dashboard', 'badge-maturite.svg')));
    assert.ok(existsSync(join(dir, 'dashboard', 'badge-violations.svg')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI badge --all --json renvoie tableau de 3', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      santeGlobale: { score: 92, niveau: 'excellent' },
      maturite: { score: 5, total: 5, label: 'Complet' },
      violations: { total: 0 },
    }));
    const r = spawnSync('node', [BIN, 'badge', '--all', '--json'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    const arr = JSON.parse(r.stdout);
    assert.equal(arr.length, 3);
    assert.equal(arr[0].type, 'sante');
    assert.equal(arr[1].type, 'maturite');
    assert.equal(arr[2].type, 'violations');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI badge --type=violations seulement', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      violations: { total: 0 },
    }));
    const r = spawnSync('node', [BIN, 'badge', '--type=violations'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /aucune dérive/);
    assert.ok(existsSync(join(dir, 'dashboard', 'badge-violations.svg')));
    assert.equal(existsSync(join(dir, 'dashboard', 'badge.svg')), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI badge --type=inexistant → exit 1', () => {
  const dir = tmp();
  try {
    const r = spawnSync('node', [BIN, 'badge', '--type=inexistant'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /inconnu/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// (#242) Badge path suit --out du dashboard
test('genererBadge — dataDir="public" → badges écrits dans public/', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'public'));
    writeFileSync(join(dir, 'public', 'data.json'), JSON.stringify({
      santeGlobale: { score: 75, niveau: 'sain' },
    }));
    const r = genererBadge(dir, { dataDir: 'public' });
    assert.equal(r.path, join(dir, 'public', 'badge.svg'));
    assert.ok(existsSync(r.path));
    assert.equal(existsSync(join(dir, 'dashboard', 'badge.svg')), false,
      'badge ne doit PAS atterrir dans dashboard/ si dataDir=public');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('genererTousLesBadges — dataDir=public écrit les 3 dans public/', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'public'));
    writeFileSync(join(dir, 'public', 'data.json'), JSON.stringify({
      santeGlobale: { score: 90 },
      maturite: { score: 5, total: 5 },
      violations: { total: 0 },
    }));
    const rs = genererTousLesBadges(dir, { dataDir: 'public' });
    for (const r of rs) {
      assert.ok(r.path.includes('public/'), `badge ${r.type} hors public/ : ${r.path}`);
      assert.ok(existsSync(r.path), `${r.type} non écrit`);
    }
    assert.equal(existsSync(join(dir, 'dashboard')), false,
      'dossier dashboard/ ne doit pas exister');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI badge --all --out → exit 1 (incompatible)', () => {
  const dir = tmp();
  try {
    const r = spawnSync('node', [BIN, 'badge', '--all', '--out', 'x.svg'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /incompatible/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI badge --dry-run --label imprime SVG', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      santeGlobale: { score: 70, niveau: 'sain' },
    }));
    const r = spawnSync('node', [BIN, 'badge', '--dry-run', '--label', 'Health'], {
      cwd: dir, encoding: 'utf8',
    });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /<svg /);
    assert.match(r.stdout, /Health/);
    assert.match(r.stdout, /70\/100 sain/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI badge --json sans dashboard', () => {
  const dir = tmp();
  try {
    const r = spawnSync('node', [BIN, 'badge', '--json'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    const out = JSON.parse(r.stdout);
    assert.equal(out.score, null);
    assert.equal(out.niveau, null);
    assert.ok(out.bytes > 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI badge écrit dashboard/badge.svg par défaut', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      santeGlobale: { score: 92, niveau: 'excellent' },
    }));
    const r = spawnSync('node', [BIN, 'badge'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /badge\.svg/);
    assert.ok(existsSync(join(dir, 'dashboard', 'badge.svg')));
    const svg = readFileSync(join(dir, 'dashboard', 'badge.svg'), 'utf-8');
    assert.match(svg, /92\/100 excellent/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// (#284) shields.io endpoint format
import { genererShieldsEndpoint, generateShieldsEndpoint } from '../lib/badge.js';

test('genererShieldsEndpoint — sante : JSON conforme spec shields.io', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      santeGlobale: { score: 75, niveau: 'sain' },
    }));
    const r = genererShieldsEndpoint(dir, { type: 'sante' });
    assert.equal(r.schemaVersion, 1);
    assert.equal(r.label, 'AIAD SDD');
    assert.equal(r.message, '75/100 sain');
    // Couleur hex SANS le `#` (spec shields)
    assert.equal(r.color, '97ca00');
    assert.equal(r.cacheSeconds, 300);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('genererShieldsEndpoint — sans dashboard → fallback gris', () => {
  const dir = tmp();
  try {
    const r = genererShieldsEndpoint(dir, { type: 'sante' });
    assert.equal(r.message, 'non calculé');
    assert.equal(r.color, '9f9f9f');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('genererShieldsEndpoint — type inconnu → throw', () => {
  const dir = tmp();
  try {
    assert.throws(() => genererShieldsEndpoint(dir, { type: 'xyz' }), /inconnu/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI badge --shields-endpoint → JSON stdout', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      santeGlobale: { score: 90, niveau: 'excellent' },
    }));
    const r = spawnSync('node', [BIN, 'badge', '--shields-endpoint'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    const json = JSON.parse(r.stdout);
    assert.equal(json.schemaVersion, 1);
    assert.equal(json.message, '90/100 excellent');
    assert.equal(json.color, '4c1');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI badge --shields-endpoint --out → écrit fichier', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      santeGlobale: { score: 80 },
    }));
    const r = spawnSync('node', [BIN, 'badge', '--shields-endpoint', '--out', 'badge-endpoint.json'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Shields endpoint écrit/);
    const out = JSON.parse(readFileSync(join(dir, 'badge-endpoint.json'), 'utf-8'));
    assert.equal(out.schemaVersion, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Alias EN generateShieldsEndpoint', () => {
  assert.equal(generateShieldsEndpoint, genererShieldsEndpoint);
});

test('CLI badge --shields-endpoint --all → tableau de 3 endpoints', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      santeGlobale: { score: 75, niveau: 'sain' },
      maturite: { score: 5, total: 5, label: 'Complet' },
      violations: { total: 0 },
    }));
    const r = spawnSync('node', [BIN, 'badge', '--shields-endpoint', '--all'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    const arr = JSON.parse(r.stdout);
    assert.equal(arr.length, 3);
    assert.deepEqual(arr.map((e) => e.type), ['sante', 'maturite', 'violations']);
    // Couleurs cohérentes : sante=sain→97ca00, maturite=excellent→4c1, violations=0→4c1
    assert.equal(arr[0].color, '97ca00');
    assert.equal(arr[1].color, '4c1');
    assert.equal(arr[2].color, '4c1');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI badge --shields-endpoint --all --out → tableau écrit dans fichier', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, 'dashboard'));
    writeFileSync(join(dir, 'dashboard', 'data.json'), JSON.stringify({
      santeGlobale: { score: 60 },
      maturite: { score: 3, total: 5, label: 'Intermédiaire' },
      violations: { total: 5 },
    }));
    const r = spawnSync('node', [BIN, 'badge', '--shields-endpoint', '--all', '--out', 'endpoints.json'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Shields endpoints \(×3\)/);
    const arr = JSON.parse(readFileSync(join(dir, 'endpoints.json'), 'utf-8'));
    assert.equal(arr.length, 3);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
