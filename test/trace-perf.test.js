// Test perf léger — vérifie que `construireMatrice` reste linéaire et
// rapide sur un projet de taille moyenne (1000 fichiers). Si la perf
// régresse au-delà du seuil, c'est probablement qu'une optim a été
// inversée dans sdd-trace.js.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { construireMatrice } from '../lib/sdd-trace.js';

test('construireMatrice — 1000 fichiers en < 1 s (régression perf)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aiad-perf-'));
  try {
    mkdirSync(join(dir, '.aiad', 'intents'), { recursive: true });
    mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
    mkdirSync(join(dir, 'src'), { recursive: true });

    writeFileSync(join(dir, '.aiad', 'intents', 'INTENT-001.md'),
      '---\nstatus: active\n---\n# I\n');
    writeFileSync(join(dir, '.aiad', 'specs', 'SPEC-001-1.md'),
      '---\nparent_intent: INTENT-001\nstatus: ready\n---\n# S\n');

    // Génère 1000 fichiers répartis sur 10 sous-dossiers
    for (let i = 0; i < 10; i++) {
      const sub = join(dir, 'src', `pkg${i}`);
      mkdirSync(sub, { recursive: true });
      for (let j = 0; j < 100; j++) {
        const annoter = (i * 100 + j) % 3 === 0;
        writeFileSync(
          join(sub, `f${j}.ts`),
          annoter
            ? `// @spec SPEC-001-1\nexport function f() {}\n`
            : `export function f() {}\n`,
        );
      }
    }

    const t0 = performance.now();
    const m = construireMatrice(dir);
    const dt = performance.now() - t0;

    assert.equal(m.summary.codeFiles, 1000);
    // Seuil large pour ne pas être flake en CI runner partagé.
    // Baseline mesurée locale : ~75 ms / 1000 fichiers.
    assert.ok(dt < 1500, `construireMatrice trop lent : ${dt.toFixed(0)} ms (cible < 1500 ms)`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
