// Tests `lib/trace-generated.js` — dossiers générés exclus de la traçabilité.
//
// @intent INTENT-039
// @spec SPEC-039-3-diagnostics-vrais
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MARQUEUR_GENERE, fabriquerFiltreGenere } from '../lib/trace-generated.js';
import { scanCode } from '../lib/sdd-trace.js';

function projet() {
  const d = mkdtempSync(join(tmpdir(), 'aiad-gen-'));
  mkdirSync(join(d, 'dashboard', 'assets'), { recursive: true });
  mkdirSync(join(d, 'src', 'sous'), { recursive: true });
  writeFileSync(join(d, 'dashboard', MARQUEUR_GENERE), 'généré\n');
  writeFileSync(join(d, 'dashboard', 'assets', 'app.js'), '// @spec SPEC-016-2-du-paquet\n');
  writeFileSync(join(d, 'src', 'a.js'), '// @spec SPEC-001-1-a\n');
  writeFileSync(join(d, 'src', 'sous', 'b.js'), '// @spec SPEC-001-1-a\n');
  return d;
}

test('fabriquerFiltreGenere — un dossier marqué et ses sous-dossiers sont générés, les autres non', () => {
  const d = projet();
  try {
    const estGenere = fabriquerFiltreGenere(d);
    assert.equal(estGenere('dashboard/index.html'), true);
    assert.equal(estGenere('dashboard/assets/app.js'), true);
    assert.equal(estGenere('src/a.js'), false);
    assert.equal(estGenere('src/sous/b.js'), false);
    assert.equal(estGenere('fichier-racine.js'), false);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('scanCode — hors dépôt git comme dans un dépôt, les fichiers d\'un dossier généré ne sont pas analysés', () => {
  const d = projet();
  try {
    const chemins = scanCode(d, { useCache: false }).map((f) => f.path).sort();
    assert.deepEqual(chemins, ['src/a.js', 'src/sous/b.js']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
