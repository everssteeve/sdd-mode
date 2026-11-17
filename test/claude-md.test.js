// Tests `lib/claude-md.js` — bloc AIAD délimité dans CLAUDE.md.
//
// @intent INTENT-039
// @spec SPEC-039-1-installation-fiable
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOC_DEBUT, BLOC_FIN, envelopperSectionSdd, retirerSectionSdd } from '../lib/claude-md.js';

const GABARIT = '# SDD Mode — Configuration Agent\n\nRègles SDD.\n\n7. Human Authorship — La paternité de l\'intention ne se délègue pas';

test('envelopperSectionSdd — pose les balises une seule fois', () => {
  const une = envelopperSectionSdd(GABARIT);
  assert.ok(une.startsWith(BLOC_DEBUT + '\n'));
  assert.ok(une.trimEnd().endsWith(BLOC_FIN));
  assert.equal(envelopperSectionSdd(une), une, 'idempotent');
});

test('retirerSectionSdd — bloc balisé : seul le bloc part, le texte de l\'équipe reste avant et après', () => {
  const contenu = `# Notes équipe\n\nAvant.\n\n${envelopperSectionSdd(GABARIT)}\n## Après\n\nTexte après.\n`;
  const r = retirerSectionSdd(contenu, GABARIT);
  assert.equal(r.retire, true);
  assert.equal(r.contenu, '# Notes équipe\n\nAvant.\n\n## Après\n\nTexte après.\n');
});

test('retirerSectionSdd — section 1.x identique au gabarit, sans balises : retirée exactement', () => {
  const contenu = `# Notes équipe\n\nAvant.\n\n${GABARIT}\n\n## Après\n\nTexte après.\n`;
  const r = retirerSectionSdd(contenu, GABARIT);
  assert.equal(r.retire, true);
  assert.equal(r.contenu, '# Notes équipe\n\nAvant.\n\n## Après\n\nTexte après.\n');
});

test('retirerSectionSdd — section modifiée mais dernière ligne du gabarit retrouvée : coupe du titre à cette ligne', () => {
  const modifiee = GABARIT.replace('Règles SDD.', 'Règles SDD adaptées par l\'équipe.');
  const r = retirerSectionSdd(`Avant.\n\n${modifiee}\n\nAprès.\n`, GABARIT);
  assert.equal(r.retire, true);
  assert.equal(r.contenu, 'Avant.\n\nAprès.\n');
});

test('retirerSectionSdd — section introuvable ou méconnaissable : rien n\'est retiré', () => {
  const sansSection = '# Notes\n\n## SDD Mode chez nous\n\nNotre texte.\n';
  assert.deepEqual(retirerSectionSdd(sansSection, GABARIT), { contenu: sansSection, retire: false });
  const meconnaissable = '# SDD Mode\n\nEntièrement réécrit.\n';
  assert.deepEqual(retirerSectionSdd(meconnaissable, GABARIT), { contenu: meconnaissable, retire: false });
});

test('retirerSectionSdd — fichier ne contenant que le bloc : contenu vide', () => {
  assert.deepEqual(retirerSectionSdd(envelopperSectionSdd(GABARIT), GABARIT), { contenu: '', retire: true });
});
