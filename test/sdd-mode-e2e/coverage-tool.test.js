// Tests `scripts/sdd-mode-coverage.js` — l'outil de couverture lui-même,
// pour rester rejouable et évolutif (garantit que le parseur PRD et le
// matcher restent corrects quand le PRD ou test/ évoluent).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  parsePrdElements, extractTokens, testsMatchingToken, evaluateElement, EXEMPT_SECTIONS, buildReport,
} from '../../scripts/sdd-mode-coverage.js';

test('parsePrdElements — extrait les lignes de tableau (hors en-tête/séparateur)', () => {
  const md = [
    '## 4. Fonctionnalités',
    '',
    '| Étape | Commande(s) |',
    '|---|---|',
    '| Cadrage | `/sdd init` |',
    '| Intention | `/sdd intent` |',
  ].join('\n');
  const els = parsePrdElements(md);
  assert.equal(els.length, 2);
  assert.equal(els[0].section, 4);
  assert.equal(els[0].kind, 'table-row');
  assert.match(els[0].text, /Cadrage/);
  assert.match(els[1].text, /sdd intent/);
});

test('parsePrdElements — extrait les puces de premier niveau', () => {
  const md = ['## 2. Principes', '', '1. **Human Authorship** — la paternité ne se délègue pas.', '- Un autre principe.'].join('\n');
  const els = parsePrdElements(md);
  assert.equal(els.length, 2);
  assert.equal(els[0].kind, 'principle');
  assert.equal(els[1].kind, 'bullet');
});

test('extractTokens — capture les ancres `code`, ignore les flags', () => {
  assert.deepEqual(extractTokens('`/sdd research`, CLI `research`, `discovery-check`'), ['sdd', 'research', 'discovery-check']);
  assert.deepEqual(extractTokens('rien à ancrer ici'), []);
});

test('testsMatchingToken — matche par nom de fichier ou par contenu', () => {
  const corpus = [{ file: 'veto.test.js', name: 'veto', content: 'exerce calculerVeto (lib/veto)' }];
  assert.deepEqual(testsMatchingToken('veto', corpus), ['test/veto.test.js']);
  assert.deepEqual(testsMatchingToken('inexistant', corpus), []);
});

test('evaluateElement — sections stratégiques exemptées par défaut', () => {
  for (const section of EXEMPT_SECTIONS) {
    const el = { id: 'X', section, sectionTitle: 't', sub: '', kind: 'bullet', text: 'Vision produit' };
    assert.equal(evaluateElement(el, [], {}).status, 'exempt');
  }
});

test('evaluateElement — gap honnête quand aucun test ne matche', () => {
  const el = { id: 'X', section: 4, sectionTitle: 't', sub: '', kind: 'bullet', text: '`commande-totalement-inconnue-xyz`' };
  const r = evaluateElement(el, [], {});
  assert.equal(r.status, 'gap');
});

test('evaluateElement — un override explicite prime sur l\'auto-matching', () => {
  const el = { id: 'X', section: 4, sectionTitle: 't', sub: '', kind: 'bullet', text: 'prose sans ancre' };
  const r = evaluateElement(el, [], { X: { status: 'covered', tests: ['test/y.test.js'], reason: 'curation manuelle' } });
  assert.equal(r.status, 'covered');
  assert.deepEqual(r.tests, ['test/y.test.js']);
});

// Rejoue l'outil sur le PRD et la codebase réels du dépôt — c'est le contrat
// « rejouable à la demande » du système : ce test échoue dès qu'un nouvel
// élément de PRD ou un nouveau fichier lib/ arrive sans couverture ni override.
test('buildReport — le dépôt réel est intégralement couvert (PRD + codebase)', () => {
  const report = buildReport();
  const prdGaps = report.prd.elements.filter((e) => e.status === 'gap');
  const codeOrphans = report.codebase.files.filter((f) => f.status === 'orphan' || f.status === 'orphan-confirmed');
  assert.deepEqual(prdGaps.map((e) => e.id), [], 'PRD non couvert — ajouter un test ou un override honnête dans test/sdd-mode-e2e/coverage-overrides.json');
  assert.deepEqual(codeOrphans.map((f) => f.file), [], 'lib/ non couvert — ajouter un test ou un override honnête');
  assert.equal(report.pass, true);
});
