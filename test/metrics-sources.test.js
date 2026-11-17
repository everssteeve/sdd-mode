// Tests des sources instrumentées des métriques AIAD (SPEC-038-2).
//
// @spec SPEC-038-2-instrumentation-metriques

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { lireCouverture, lireHistoriqueDette, lireActiviteGit, analyserJournalGit, lireHistoriqueGates, lirePerimetre, SOURCES_COUVERTURE } from '../lib/dashboard/metrics-sources.js';

function projet(fichiers = {}) {
  const d = mkdtempSync(join(tmpdir(), 'aiad-sources-'));
  for (const [rel, contenu] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(d, rel)), { recursive: true });
    writeFileSync(join(d, rel), typeof contenu === 'string' ? contenu : JSON.stringify(contenu));
  }
  return d;
}
const RS = '\u001e'; const US = '\u001f'; const GS = '\u001d';

describe('sources instrumentées des métriques', () => {
  test('CA-001 — couverture : rapport de l\'outil de test, par ordre de priorité', () => {
    assert.equal(SOURCES_COUVERTURE[0], '.aiad/metrics/tests/coverage-summary.json');
    const a = projet({ 'coverage/coverage-summary.json': { total: { lines: { pct: 71.4 } } } });
    const b = projet({ 'coverage/coverage-summary.json': { total: { lines: { pct: 71.4 } } }, '.aiad/metrics/tests/coverage-summary.json': { total: { lines: { pct: 88 } } } });
    const c = projet({ '.aiad/metrics/coverage/badge.json': { message: '93%' } });
    const vide = projet({ 'coverage/coverage-summary.json': '{oops', '.aiad/metrics/coverage/badge.json': { message: 'unknown' } });
    try {
      assert.deepEqual(lireCouverture(a), { pct: 71.4, source: 'coverage/coverage-summary.json' });
      assert.deepEqual(lireCouverture(b), { pct: 88, source: '.aiad/metrics/tests/coverage-summary.json' });
      assert.deepEqual(lireCouverture(c), { pct: 93, source: '.aiad/metrics/coverage/badge.json' });
      assert.equal(lireCouverture(vide), null, 'illisible ou non numérique : non mesuré');
    } finally { for (const d of [a, b, c, vide]) rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-002 — dette : instantanés du dashboard, en ordre chronologique', () => {
    const d = projet({
      '.aiad/metrics/tech-debt/2026-11-15.json': { jnsp: 2, specsGrosses: 1, specsWarning: 9 },
      '.aiad/metrics/tech-debt/2026-10-01.json': { jnsp: 5, specsGrosses: 0 },
      '.aiad/metrics/tech-debt/notes.json': { jnsp: 99 },
      '.aiad/metrics/tech-debt/2026-10-02.json': '{oops',
    });
    const vide = projet();
    try {
      assert.deepEqual(lireHistoriqueDette(d), [{ date: '2026-10-01', total: 5 }, { date: '2026-11-15', total: 3 }]);
      assert.deepEqual(lireHistoriqueDette(vide), []);
    } finally { rmSync(d, { recursive: true, force: true }); rmSync(vide, { recursive: true, force: true }); }
  });

  test('CA-003 — journal git : commits et lignes co-signés par un agent ; aucune identité en sortie', () => {
    const journal = [
      `${RS}Ada <ada@exemple.fr>${US}Claude <noreply@anthropic.com>${GS}\n\n10\t2\tsrc/a.js\n5\t0\tsrc/b.js\n`,
      `${RS}Ada <ada@exemple.fr>${US}${GS}\n\n4\t1\tsrc/c.js\n-\t-\timage.png\n`,
      `${RS}dependabot[bot] <bot@exemple.fr>${US}${GS}\n\n1\t1\tpackage.json\n`,
    ].join('');
    const r = analyserJournalGit(journal);
    assert.deepEqual(r, { commits: 3, commitsAgent: 2, lignes: 20, lignesAgent: 16 });
    assert.deepEqual(Object.keys(r), ['commits', 'commitsAgent', 'lignes', 'lignesAgent']);
    assert.deepEqual(analyserJournalGit(''), { commits: 0, commitsAgent: 0, lignes: 0, lignesAgent: 0 });
  });

  test('CA-004 — activité git : null sans dépôt', () => {
    const d = projet();
    try { assert.equal(lireActiviteGit(d), null); } finally { rmSync(d, { recursive: true, force: true }); }
  });

  test('CA-018 — Gate : premier passage lu dans l\'historique des SPECs', () => {
    const histo = (lignes) => `# SPEC\n\n## Historique des modifications\n\n| Date | Changement | Raison |\n|------|------------|--------|\n${lignes.join('\n')}\n`;
    const d = projet({
      '.aiad/specs/SPEC-001-1-a.md': histo(['| 2026-11-01 | Execution Gate OUVERTE — SQS 5/5. | x |']),
      '.aiad/specs/SPEC-001-2-b.md': histo(['| 2026-11-03 | Execution Gate OUVERTE — SQS 4/5. | x |', '| 2026-11-01 | Gate (1er passage) : CA-002 découpé. | x |']),
      '.aiad/specs/archive/SPEC-000-1-z.md': histo(['| 2026-10-01 | Gate FERMÉE — SQS 2/5. | x |']),
      '.aiad/specs/SPEC-001-3-c.md': histo(['| 2026-11-02 | Création. | x |']),
      '.aiad/specs/spec-template.md': histo(['| 2026-11-02 | Execution Gate OUVERTE | x |']),
    });
    const vide = projet();
    try {
      assert.deepEqual(lireHistoriqueGates(d), { specs: 3, premierPassage: 1, passages: 4 });
      assert.equal(lireHistoriqueGates(vide), null);
    } finally { rmSync(d, { recursive: true, force: true }); rmSync(vide, { recursive: true, force: true }); }
  });

  test('CA-019 — périmètre : seules les exclusions avec raison et auteur sont retenues', () => {
    const d = projet({ '.aiad/metrics/scope.json': { non_applicables: { retention: { raison: 'r', auteur: 'Ada', date: '2026-11-15' }, mttd: { raison: 'sans auteur' }, mttr: 'x' } } });
    const casse = projet({ '.aiad/metrics/scope.json': '{oops' });
    try {
      assert.deepEqual(lirePerimetre(d), { retention: { raison: 'r', auteur: 'Ada', date: '2026-11-15' } });
      assert.deepEqual(lirePerimetre(casse), {});
    } finally { rmSync(d, { recursive: true, force: true }); rmSync(casse, { recursive: true, force: true }); }
  });
});
