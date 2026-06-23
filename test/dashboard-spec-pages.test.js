// @spec SPEC-017-4-pages-detail-spec
// @verified-by test/dashboard-spec-pages.test.js

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  slugForSpec,
  rendreLienSpec,
  construirePageSpec,
  genererPagesSpecs,
  blocSpecPagesIndex,
} from '../lib/dashboard/spec-page.js';

function tmpDir(suffix = '') {
  const dir = join(tmpdir(), `aiad-spec-pages-test-${Date.now()}-${suffix}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function specMock(overrides = {}) {
  return {
    id: 'SPEC-017-4',
    slug: '017-4-pages-detail-spec',
    titre: 'Pages détail SPEC',
    statut: 'in-progress',
    format: 'ears',
    sqs: '5',
    parentIntent: 'INTENT-017',
    auteur: 'Steeve',
    date: '2026-06-22',
    file: '.aiad/specs/SPEC-017-4-pages-detail-spec.md',
    contexte: 'Contexte de test pour la page détail.',
    criteresAcceptation: [
      { id: 'CA-001', titre: 'Une page par SPEC', pattern: 'Ubiquitous', texte: 'The function SHALL write exactly one HTML file per SPEC.' },
      { id: 'CA-002', titre: 'Sections obligatoires', pattern: 'Ubiquitous', texte: 'The function SHALL include all required sections.' },
    ],
    interface_: '// spec-page.js\nexport function slugForSpec(spec) {}',
    dependances: ['lib/dashboard/intent-page.js', 'lib/dashboard/ui/badges.js'],
    dood: [
      { checked: false, texte: 'spec-page.js créé' },
      { checked: true, texte: 'tests écrits' },
    ],
    ...overrides,
  };
}

function donneesMock(overrides = {}) {
  return {
    projet: { nom: 'test', genere: '2026-06-22T08:00:00.000Z', version: '1.0' },
    intents: [
      { id: 'INTENT-017', titre: 'Vivre le projet', file: '.aiad/intents/INTENT-017-vivre.md' },
    ],
    specs: overrides.specs ?? [specMock()],
    ...overrides,
  };
}

const mockLayout = ({ titre, body }) =>
  `<!DOCTYPE html><html><head><title>${titre}</title></head><body><h1>${titre}</h1>${body}</body></html>`;

// CA-001 — Une page par SPEC
test('CA-001 — genererPagesSpecs writes exactly one file per SPEC with non-empty id', () => {
  const dir = tmpDir('ca001');
  const donnees = donneesMock({
    specs: [
      specMock({ id: 'SPEC-001', slug: '001-foo', titre: 'Foo' }),
      specMock({ id: 'SPEC-002', slug: '002-bar', titre: 'Bar' }),
      specMock({ id: 'SPEC-003', slug: '003-baz', titre: 'Baz' }),
    ],
  });
  const fichiers = genererPagesSpecs(donnees, { outDir: dir, layout: mockLayout });
  assert.equal(fichiers.length, 3, 'doit écrire 3 fichiers');
  assert.ok(existsSync(join(dir, 'spec-001-foo.html')), 'spec-001-foo.html doit exister');
  assert.ok(existsSync(join(dir, 'spec-002-bar.html')), 'spec-002-bar.html doit exister');
  assert.ok(existsSync(join(dir, 'spec-003-baz.html')), 'spec-003-baz.html doit exister');
  rmSync(dir, { recursive: true });
});

// CA-002 — Sections obligatoires
test('CA-002 — construirePageSpec includes Contexte, CAs, Interface, Dépendances, DoOD, sidebar statut+SQS', () => {
  const html = construirePageSpec(specMock(), donneesMock());
  assert.ok(html.includes('aria-label="Contexte"'), 'section Contexte requise');
  assert.ok(html.includes('aria-label="Critères d\'acceptation"'), 'section CAs requise');
  assert.ok(html.includes('aria-label="Interface / API"'), 'section Interface requise');
  assert.ok(html.includes('aria-label="Dépendances"'), 'section Dépendances requise');
  assert.ok(html.includes('aria-label="Definition of Output Done"'), 'section DoOD requise');
  // Sidebar statut et SQS badges
  assert.ok(html.includes('in-progress'), 'badge statut requis');
  assert.ok(html.includes('SQS'), 'badge SQS requis');
});

// CA-003 — Badge EARS sur les CAs
test('CA-003 — format EARS renders each CA with its pattern label', () => {
  const spec = specMock({ format: 'ears' });
  const html = construirePageSpec(spec, donneesMock());
  assert.ok(html.includes('Ubiquitous'), 'badge pattern Ubiquitous requis');
  assert.ok(html.includes('ca-pattern'), 'classe ca-pattern requise');
});

// CA-004a — SPEC sans ID skippée
test('CA-004a — genererPagesSpecs skips SPEC with no id and continues', () => {
  const dir = tmpDir('ca004a');
  const specs = [
    { id: '', slug: '', titre: 'Sans ID', statut: 'draft', file: '.aiad/specs/sans-id.md' },
    specMock({ id: 'SPEC-OK', slug: 'ok-slug', titre: 'Avec ID' }),
  ];
  const fichiers = genererPagesSpecs(donneesMock({ specs }), { outDir: dir, layout: mockLayout });
  assert.equal(fichiers.length, 1, 'seul 1 fichier doit être écrit (SPEC sans id skippée)');
  assert.ok(existsSync(join(dir, 'spec-ok-slug.html')), 'la SPEC avec id doit être générée');
  rmSync(dir, { recursive: true });
});

// CA-004b — Warning émis pour SPEC sans ID
test('CA-004b — genererPagesSpecs emits console.warn with file path for SPEC without id', () => {
  const dir = tmpDir('ca004b');
  const warns = [];
  const orig = console.warn;
  console.warn = (...args) => warns.push(args.join(' '));
  try {
    genererPagesSpecs(
      donneesMock({ specs: [{ id: '', slug: '', titre: 'Sans ID', statut: 'draft', file: '.aiad/specs/no-id.md' }] }),
      { outDir: dir, layout: mockLayout },
    );
    assert.ok(warns.length > 0, 'console.warn doit être appelé');
    assert.ok(warns[0].includes('.aiad/specs/no-id.md'), 'le chemin doit figurer dans le warning');
  } finally {
    console.warn = orig;
    rmSync(dir, { recursive: true });
  }
});

// CA-005 — Index sur specs.html
test('CA-005 — blocSpecPagesIndex returns grid with one link per SPEC using id as text', () => {
  const donnees = donneesMock({
    specs: [
      specMock({ id: 'SPEC-A', slug: 'a-slug', titre: 'Alpha' }),
      specMock({ id: 'SPEC-B', slug: 'b-slug', titre: 'Beta' }),
    ],
  });
  const html = blocSpecPagesIndex(donnees);
  assert.ok(html.includes('SPEC-A'), 'SPEC-A id doit figurer dans le grid');
  assert.ok(html.includes('SPEC-B'), 'SPEC-B id doit figurer dans le grid');
  assert.ok(html.includes('href="spec-a-slug.html"'), 'href spec-a-slug.html requis');
  assert.ok(html.includes('href="spec-b-slug.html"'), 'href spec-b-slug.html requis');
  assert.ok(html.includes('sp-list-links'), 'classe sp-list-links requise pour la grille');
});

// CA-006 — Lien retour
test('CA-006 — construirePageSpec includes <a href="specs.html"> labeled retour', () => {
  const html = construirePageSpec(specMock(), donneesMock());
  assert.ok(html.includes('href="specs.html"'), '<a href="specs.html"> requis');
  assert.ok(html.includes('← Retour à la liste des SPECs'), 'libellé retour requis');
});

// CA-007 — Critères vides
test('CA-007 — empty criteresAcceptation displays fallback message', () => {
  const spec = specMock({ criteresAcceptation: [] });
  const html = construirePageSpec(spec, donneesMock());
  assert.ok(
    html.includes('Aucun critère d\'acceptation défini.'),
    'message fallback requis pour CAs vides',
  );
});

// CA-008a — Sections accessibles (aria-label)
test('CA-008a — every <section> in construirePageSpec body has aria-label', () => {
  const html = construirePageSpec(specMock(), donneesMock());
  const sections = html.match(/<section/g) || [];
  const sectionsWithAriaLabel = html.match(/<section[^>]*aria-label=/g) || [];
  assert.equal(
    sections.length,
    sectionsWithAriaLabel.length,
    `toutes les sections (${sections.length}) doivent avoir aria-label`,
  );
});

// CA-008b — Titre de page avec h1
test('CA-008b — page contains <h1> with SPEC id and title', () => {
  const spec = specMock({ id: 'SPEC-017-4', titre: 'Pages détail SPEC' });
  const html = construirePageSpec(spec, donneesMock());
  assert.ok(html.includes('<h1>'), 'h1 requis dans le body');
  assert.ok(html.includes('SPEC-017-4'), 'id SPEC requis dans h1 zone');
  assert.ok(html.includes('Pages détail SPEC'), 'titre SPEC requis dans h1 zone');
});
