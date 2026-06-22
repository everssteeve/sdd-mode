/**
 * @spec SPEC-016-4-rgesn-budgets
 * @intent INTENT-016
 * @governance AIAD-RGESN
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifierBudgets, AVERT_ABSENT } from '../scripts/check-page-budgets.js';

function creerRacine(suffix) {
  const dir = join(tmpdir(), `check-page-budgets-${suffix}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function creerBudgets(racine, rows) {
  const aiad = join(racine, '.aiad');
  mkdirSync(aiad, { recursive: true });
  const lignes = rows.map(([page, fichier, budget]) => `| ${page} | ${fichier} | ${budget} |`).join('\n');
  writeFileSync(
    join(aiad, 'perf-budgets.md'),
    `# Budgets RGESN\n\n| Page | Fichier | Budget HTML (KB) |\n|------|---------|------------------|\n${lignes}\n`,
  );
}

function creerFichier(racine, rel, sizeKo) {
  const fp = join(racine, rel);
  mkdirSync(join(racine, rel.split('/').slice(0, -1).join('/')), { recursive: true });
  writeFileSync(fp, 'x'.repeat(Math.round(sizeKo * 1024)));
}

// CA-001 — exit 1 sur dépassement
describe('exceeds-budget-exits-1', () => {
  let racine;
  before(() => {
    racine = creerRacine('exceed');
    creerBudgets(racine, [['Overview', 'dashboard/index.html', '10']]);
    creerFichier(racine, 'dashboard/index.html', 15);
  });
  after(() => rmSync(racine, { recursive: true }));

  it('should return exitCode 1', () => {
    const { exitCode } = verifierBudgets(racine);
    assert.equal(exitCode, 1);
  });
});

// CA-001b — affichage dépassement
describe('exceeds-budget-display', () => {
  let racine;
  before(() => {
    racine = creerRacine('display');
    creerBudgets(racine, [['Overview', 'dashboard/index.html', '10']]);
    creerFichier(racine, 'dashboard/index.html', 15);
  });
  after(() => rmSync(racine, { recursive: true }));

  it('should report depasse=true with sizes', () => {
    const { lignes } = verifierBudgets(racine);
    const l = lignes.find((x) => x.label === 'dashboard/index.html');
    assert.ok(l, 'ligne trouvée');
    assert.equal(l.depasse, true);
    assert.ok(l.tailleKo > 10, 'taille réelle présente');
    assert.equal(l.budgetKo, 10);
  });
});

// CA-002 — exit 0 si fichier budgets absent
describe('missing-file-exits-0', () => {
  let racine;
  before(() => { racine = creerRacine('absent'); mkdirSync(racine, { recursive: true }); });
  after(() => rmSync(racine, { recursive: true }));

  it('should return exitCode 0', () => {
    const { exitCode } = verifierBudgets(racine);
    assert.equal(exitCode, 0);
  });
});

// CA-002b — avertissement si fichier budgets absent
describe('missing-file-warning', () => {
  let racine;
  before(() => { racine = creerRacine('warn'); mkdirSync(racine, { recursive: true }); });
  after(() => rmSync(racine, { recursive: true }));

  it('should return the expected warning', () => {
    const { avertissement } = verifierBudgets(racine);
    assert.equal(avertissement, AVERT_ABSENT);
  });
});

// CA-003 — exit 1 si page déclarée absente
describe('missing-page-exits-1', () => {
  let racine;
  before(() => {
    racine = creerRacine('missingpage');
    creerBudgets(racine, [['Missing', 'dashboard/nonexistent.html', '10']]);
  });
  after(() => rmSync(racine, { recursive: true }));

  it('should return exitCode 1', () => {
    const { exitCode } = verifierBudgets(racine);
    assert.equal(exitCode, 1);
  });
});

// CA-003b — affichage du chemin manquant
describe('missing-page-display', () => {
  let racine;
  before(() => {
    racine = creerRacine('missingdisp');
    creerBudgets(racine, [['Missing', 'dashboard/nonexistent.html', '10']]);
  });
  after(() => rmSync(racine, { recursive: true }));

  it('should mark the entry as manquant', () => {
    const { lignes } = verifierBudgets(racine);
    const l = lignes.find((x) => x.label === 'dashboard/nonexistent.html');
    assert.ok(l, 'ligne manquante présente dans le rapport');
    assert.equal(l.manquant, true);
  });
});

// CA-005 — mesure assets partagés
describe('shared-assets-measure', () => {
  let racine;
  before(() => {
    racine = creerRacine('assets');
    creerBudgets(racine, [['Assets', 'dashboard/assets/', '50']]);
    mkdirSync(join(racine, 'dashboard/assets'), { recursive: true });
    writeFileSync(join(racine, 'dashboard/assets/app.js'), 'x'.repeat(20 * 1024));
    writeFileSync(join(racine, 'dashboard/assets/style.css'), 'x'.repeat(10 * 1024));
  });
  after(() => rmSync(racine, { recursive: true }));

  it('should measure directory total and stay within budget', () => {
    const { exitCode, lignes } = verifierBudgets(racine);
    const l = lignes.find((x) => x.label === 'dashboard/assets/');
    assert.ok(l, 'ligne assets trouvée');
    assert.ok(l.tailleKo >= 29, 'taille ≥ 29 KB');
    assert.equal(exitCode, 0);
  });
});

// CA-005b — dépassement budget assets partagés
describe('shared-assets-budget', () => {
  let racine;
  before(() => {
    racine = creerRacine('assets-over');
    creerBudgets(racine, [['Assets', 'dashboard/assets/', '10']]);
    mkdirSync(join(racine, 'dashboard/assets'), { recursive: true });
    writeFileSync(join(racine, 'dashboard/assets/app.js'), 'x'.repeat(20 * 1024));
  });
  after(() => rmSync(racine, { recursive: true }));

  it('should return exitCode 1 when assets exceed budget', () => {
    const { exitCode } = verifierBudgets(racine);
    assert.equal(exitCode, 1);
  });
});

// CA-006 — mesure intent-pages
describe('intent-pages-measure', () => {
  let racine;
  before(() => {
    racine = creerRacine('intent');
    creerBudgets(racine, [['Intent-pages', 'dashboard/intent-INTENT-*.html', '20']]);
    mkdirSync(join(racine, 'dashboard'), { recursive: true });
    writeFileSync(join(racine, 'dashboard/intent-INTENT-001.html'), 'x'.repeat(5 * 1024));
    writeFileSync(join(racine, 'dashboard/intent-INTENT-002.html'), 'x'.repeat(8 * 1024));
  });
  after(() => rmSync(racine, { recursive: true }));

  it('should find glob files and report max size within budget', () => {
    const { exitCode, lignes } = verifierBudgets(racine);
    const l = lignes.find((x) => x.label === 'dashboard/intent-INTENT-*.html');
    assert.ok(l, 'ligne glob trouvée');
    assert.ok(l.tailleKo >= 7, 'max ≥ 7 KB');
    assert.equal(exitCode, 0);
  });
});

// CA-006b — dépassement budget intent-page
describe('intent-pages-max-budget', () => {
  let racine;
  before(() => {
    racine = creerRacine('intent-over');
    creerBudgets(racine, [['Intent-pages', 'dashboard/intent-INTENT-*.html', '5']]);
    mkdirSync(join(racine, 'dashboard'), { recursive: true });
    writeFileSync(join(racine, 'dashboard/intent-INTENT-001.html'), 'x'.repeat(3 * 1024));
    writeFileSync(join(racine, 'dashboard/intent-INTENT-002.html'), 'x'.repeat(10 * 1024));
  });
  after(() => rmSync(racine, { recursive: true }));

  it('should return exitCode 1 when any intent-page exceeds budget', () => {
    const { exitCode } = verifierBudgets(racine);
    assert.equal(exitCode, 1);
  });
});
