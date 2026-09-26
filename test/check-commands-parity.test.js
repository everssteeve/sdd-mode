/**
 * @spec SPEC-033-1-resync-commandes-livrees
 * @intent INTENT-033
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { verifierParite } from '../scripts/check-commands-parity.js';

const RACINE_DEPOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const racines = [];

function creerRacine(fichiers) {
  const dir = join(tmpdir(), `commands-parity-${process.pid}-${racines.length}-${Date.now()}`);
  racines.push(dir);
  for (const [rel, contenu] of Object.entries(fichiers)) {
    const fp = join(dir, rel);
    mkdirSync(dirname(fp), { recursive: true });
    writeFileSync(fp, contenu);
  }
  return dir;
}

afterEach(() => {
  while (racines.length) rmSync(racines.pop(), { recursive: true, force: true });
});

describe('check-commands-parity (SPEC-033-1)', () => {
  it('CA-001 — le dépôt est à parité (.claude/ = templates/.claude/)', () => {
    const r = verifierParite(RACINE_DEPOT);
    assert.deepEqual(r.divergents, []);
    assert.equal(r.exitCode, 0);
  });

  it('arbres identiques → exit 0', () => {
    const racine = creerRacine({
      '.claude/sdd/gate.md': 'x\n',
      'templates/.claude/sdd/gate.md': 'x\n',
      '.claude/skills/a/SKILL.md': 'y\n',
      'templates/.claude/skills/a/SKILL.md': 'y\n',
    });
    assert.equal(verifierParite(racine).exitCode, 0);
  });

  it('CA-005 — un seul exemplaire modifié → exit 1 et fichier listé', () => {
    const racine = creerRacine({
      '.claude/sdd/gate.md': 'modifié\n',
      'templates/.claude/sdd/gate.md': 'x\n',
    });
    const r = verifierParite(racine);
    assert.equal(r.exitCode, 1);
    assert.deepEqual(r.divergents, [{ fichier: 'sdd/gate.md', motif: 'contenu différent' }]);
  });

  it('fichier présent d\'un seul côté → exit 1', () => {
    const racine = creerRacine({
      'templates/.claude/aiad/demo.md': 'x\n',
      '.claude/aiad/nouveau.md': 'z\n',
      'templates/.claude/aiad/nouveau.md': 'z\n',
    });
    const r = verifierParite(racine);
    assert.equal(r.exitCode, 1);
    assert.deepEqual(r.divergents, [{ fichier: 'aiad/demo.md', motif: 'absent de .claude/' }]);
  });

  it('fichier exclu → ignoré', () => {
    const racine = creerRacine({ '.claude/sdd/interne.md': 'x\n' });
    assert.equal(verifierParite(racine, { exclusions: ['sdd/interne.md'] }).exitCode, 0);
  });

  it('dossiers hors périmètre (agents, rules) → ignorés', () => {
    const racine = creerRacine({ '.claude/agents/AIAD-X.md': 'x\n', '.claude/rules/r.md': 'y\n' });
    assert.equal(verifierParite(racine).exitCode, 0);
  });
});
