// Tests compatibilité Bun runtime — vérifications statiques.
// Le smoke test réel sous Bun se fait dans le workflow CI bun-smoke.yml.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RACINE = join(__dirname, '..');

// API node:* supportées par Bun 1.2+ (vérifié dans la documentation Bun
// https://bun.sh/docs/runtime/nodejs-apis). Si une API non listée ici est
// introduite, le test échoue et force à valider la compat Bun.
const BUN_COMPAT_NODE_MODULES = new Set([
  'node:assert',
  'node:async_hooks',
  'node:buffer',
  'node:child_process',
  'node:crypto',
  'node:dns',
  'node:events',
  'node:fs',
  'node:fs/promises',
  'node:http',
  'node:https',
  'node:module',
  'node:net',
  'node:os',
  'node:path',
  'node:perf_hooks',
  'node:process',
  'node:punycode',
  'node:querystring',
  'node:readline',
  'node:readline/promises',
  'node:stream',
  'node:string_decoder',
  'node:test',
  'node:timers',
  'node:tls',
  'node:tty',
  'node:url',
  'node:util',
  'node:vm',
  'node:worker_threads',
  'node:zlib',
]);

function listerJs(dir) {
  if (!statSync(dir).isDirectory()) return [];
  const out = [];
  for (const nom of readdirSync(dir)) {
    const path = join(dir, nom);
    const st = statSync(path);
    if (st.isDirectory()) out.push(...listerJs(path));
    else if (nom.endsWith('.js')) out.push(path);
  }
  return out;
}

function extraireImportsNode(contenu) {
  const out = new Set();
  const re = /from\s+['"](node:[a-z_/]+)['"]/g;
  let m;
  while ((m = re.exec(contenu)) !== null) out.add(m[1]);
  return out;
}

// ─── Méta-tests sur le repo réel ────────────────────────────────────────────

test('package.json#engines déclare Bun ≥ 1.2', () => {
  const pkg = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf-8'));
  assert.ok(pkg.engines.bun, 'engines.bun absent');
  assert.match(pkg.engines.bun, /^>=1\.2/, `engines.bun mal formé : ${pkg.engines.bun}`);
});

test('lib/ + bin/ — aucun import node:* incompatible avec Bun 1.2+', () => {
  const incompatibles = new Map();
  for (const dir of [join(RACINE, 'lib'), join(RACINE, 'bin')]) {
    for (const f of listerJs(dir)) {
      const c = readFileSync(f, 'utf-8');
      const imports = extraireImportsNode(c);
      for (const imp of imports) {
        if (!BUN_COMPAT_NODE_MODULES.has(imp)) {
          const arr = incompatibles.get(imp) || [];
          arr.push(f.replace(RACINE + '/', ''));
          incompatibles.set(imp, arr);
        }
      }
    }
  }
  if (incompatibles.size > 0) {
    const details = [...incompatibles.entries()]
      .map(([imp, files]) => `${imp} → ${files.join(', ')}`)
      .join('\n  ');
    assert.fail(`Imports node:* non listés Bun-compatibles :\n  ${details}\nAjoute-les à BUN_COMPAT_NODE_MODULES après vérification ou propose une alternative.`);
  }
});

test('lib/ + bin/ — aucun usage de Bun-only API détecté (préserve compat Node)', () => {
  // Bun-specific globals : Bun.serve, Bun.file, Bun.write, etc.
  const usages = [];
  for (const dir of [join(RACINE, 'lib'), join(RACINE, 'bin')]) {
    for (const f of listerJs(dir)) {
      const c = readFileSync(f, 'utf-8');
      // Cherche `Bun.X` au début de mot (pas dans les strings/commentaires —
      // heuristique simple).
      const lignes = c.split('\n');
      for (let i = 0; i < lignes.length; i++) {
        const ligne = lignes[i];
        if (/\bBun\.[a-zA-Z]/.test(ligne) && !ligne.trim().startsWith('//')) {
          usages.push(`${f.replace(RACINE + '/', '')}:${i + 1}  ${ligne.trim().slice(0, 80)}`);
        }
      }
    }
  }
  assert.equal(usages.length, 0, `Usage Bun-only détecté :\n  ${usages.join('\n  ')}`);
});

test('Bin entry — pas de shebang Node-only restreignant Bun', () => {
  const bin = readFileSync(join(RACINE, 'bin', 'aiad-sdd.js'), 'utf-8');
  // Le shebang #!/usr/bin/env node est OK : Bun lit aussi `node` shebang
  // quand on fait `bun script.js`, et `npx aiad-sdd` continue d'utiliser
  // Node. Mais on évite #!node ou un shebang qui force un interpréteur.
  const premiereLigne = bin.split('\n')[0];
  // Soit pas de shebang, soit `#!/usr/bin/env node` (forme portable).
  if (premiereLigne.startsWith('#!')) {
    assert.match(premiereLigne, /^#!\/usr\/bin\/env\s+node\s*$/);
  }
});

test('Workflow .github/workflows/bun-smoke.yml présent', () => {
  const path = join(RACINE, '.github', 'workflows', 'bun-smoke.yml');
  const c = readFileSync(path, 'utf-8');
  assert.match(c, /oven-sh\/setup-bun/);
  assert.match(c, /bun bin\/aiad-sdd\.js --version/);
  // Couvre au moins 4 commandes runtime : version, help, init, doctor
  for (const cmd of ['--version', '--help', 'init', 'doctor', 'trace', 'sbom']) {
    assert.match(c, new RegExp(cmd.replace(/[-]/g, '[-]')), `commande ${cmd} non couverte`);
  }
});

test('extraireImportsNode — fonction utilitaire correcte', () => {
  const sample = `import { x } from 'node:fs';
import y from 'node:path';
import { z } from 'node:fs/promises';
import { local } from './local.js';
`;
  const out = extraireImportsNode(sample);
  assert.equal(out.size, 3);
  assert.ok(out.has('node:fs'));
  assert.ok(out.has('node:path'));
  assert.ok(out.has('node:fs/promises'));
});
