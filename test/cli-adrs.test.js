// Tests #163 — CLI `aiad-sdd adrs` (texte + --json).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, '..', 'bin', 'aiad-sdd.js');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-cli-adrs-')); }
function setupArchi(d, contenu) {
  mkdirSync(join(d, '.aiad'), { recursive: true });
  writeFileSync(join(d, '.aiad', 'ARCHITECTURE.md'), contenu, 'utf-8');
}

function run(cwd, ...args) {
  return spawnSync('node', [BIN, 'adrs', ...args], { cwd, encoding: 'utf-8', env: { ...process.env, NO_COLOR: '1' } });
}

test('cli adrs — fichier ARCHITECTURE absent → exit 0 + message amical', () => {
  const d = tmp();
  try {
    const r = run(d);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Aucun ADR détecté/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('cli adrs — texte : liste les ADRs avec ID, titre, section, ligne', () => {
  const d = tmp();
  try {
    setupArchi(d, `# Architecture\n\n## Choix techniques\n\n- **ADR-001** : pas de NoSQL\n- **ADR-002** : rate limiting par IP hachée\n`);
    const r = run(d);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /2 ADR\(s\) détecté/);
    assert.match(r.stdout, /ADR-001/);
    assert.match(r.stdout, /pas de NoSQL/);
    assert.match(r.stdout, /Choix techniques/);
    assert.match(r.stdout, /L5|L6/); // ligne dans le fichier source
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('cli adrs --json → JSON valide consommable par script tiers', () => {
  const d = tmp();
  try {
    setupArchi(d, `## Sécurité\n\n- **ADR-007** : JWT 1h + refresh 24h\n`);
    const r = run(d, '--json');
    assert.equal(r.status, 0);
    const data = JSON.parse(r.stdout);
    assert.equal(data.total, 1);
    assert.equal(data.entrees[0].id, 'ADR-007');
    assert.match(data.entrees[0].titre, /JWT/);
    assert.equal(data.entrees[0].section, 'Sécurité');
    assert.match(data.fichier, /ARCHITECTURE\.md/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('cli adrs --json sans ADR → {fichier:null, total:0, entrees:[]}', () => {
  const d = tmp();
  try {
    const r = run(d, '--json');
    assert.equal(r.status, 0);
    const data = JSON.parse(r.stdout);
    assert.equal(data.total, 0);
    assert.deepEqual(data.entrees, []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
