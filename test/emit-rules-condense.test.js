// @intent INTENT-039
// @spec SPEC-039-4-guides-gouvernance
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(RACINE, 'bin', 'aiad-sdd.js');

test('CA-002 — règle condensée : une section n\'est plus coupée à la première majuscule Z', () => {
  const base = mkdtempSync(join(tmpdir(), 'aiad-cond-'));
  try {
    const projet = join(base, 'p');
    mkdirSync(projet);
    const env = { ...process.env, HOME: join(base, 'home'), AIAD_OFFLINE: '1', NO_COLOR: '1' };
    const lancer = (...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: projet, env, encoding: 'utf-8' });
    spawnSync('git', ['init', '-q'], { cwd: projet });
    assert.equal(lancer('init').status, 0);
    const guide = join(projet, '.aiad', 'gouvernance', 'AIAD-RGPD.md');
    writeFileSync(guide, [
      '# AGENT-GUIDE — RGPD', '',
      '## MISSION', '',
      'Audit de la Zone euro : chaque traitement est contrôlé jusqu\'au bout de la phrase.',
      'Deuxième ligne de mission, après la majuscule.', '',
      '## RÈGLES ABSOLUES — TOUJOURS', '',
      '- **TOUJOURS** vérifier la base légale (Zéro exception) avant tout traitement.', '',
      '## AUTRE SECTION', '', 'Hors condensé.', '',
    ].join('\n'));
    assert.equal(lancer('emit-rules', '--runtime', 'cursor').status, 0);
    const mdc = readFileSync(join(projet, '.cursor', 'rules', 'aiad-rgpd.mdc'), 'utf-8');
    assert.match(mdc, /Audit de la Zone euro : chaque traitement est contrôlé jusqu'au bout de la phrase\./);
    assert.match(mdc, /Deuxième ligne de mission, après la majuscule\./);
    assert.match(mdc, /\(Zéro exception\) avant tout traitement\./);
    assert.doesNotMatch(mdc, /Hors condensé/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('CA-001 — guides livrés : les erreurs réglementaires relevées par l\'audit ne reviennent pas', () => {
  const lire = (nom) => readFileSync(join(RACINE, 'templates', '.aiad', 'gouvernance', nom), 'utf-8');
  const rgaa = lire('AIAD-RGAA.md');
  assert.doesNotMatch(rgaa.split('## Évolutions du document')[0], /20 septembre 2024|2024-1270|2022-1598|Jusqu'à \*\*300 000 €\*\*/);
  assert.match(rgaa, /arrêté du 20 septembre 2019/i);
  assert.match(rgaa, /47-1/);
  const rgesn = lire('AIAD-RGESN.md');
  assert.doesNotMatch(rgesn.split('## Évolutions du document')[0], /79 critères|2024-1243/);
  assert.match(rgesn, /78 critères/);
  const aiact = lire('AIAD-AI-ACT.md');
  assert.doesNotMatch(aiact, /72 ?h pour incidents graves|Délai de notification : 72 h/);
  assert.match(aiact, /2024\/2853/);
  assert.match(aiact, /Aucun artefact AIAD ne remplit cette obligation/);
  const rgpd = lire('AIAD-RGPD.md');
  assert.doesNotMatch(rgpd.split('## Évolutions')[0], /> 300 sanctions|lignes directrices contraignantes/);
  assert.match(rgpd, /87 sanctions/);
});
