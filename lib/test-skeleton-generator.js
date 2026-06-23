// @intent INTENT-019
// @spec SPEC-019-1-skeleton-generator
// @verified-by test/suggest-tests.test.js
// @governance AIAD-RGESN

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';

const FORMAT_EARS_RE = /\*\*Format\*\*\s*:\s*EARS|^Format\s*:\s*EARS/m;
const CA_HDR_RE = /^###\s+(CA-\d+[a-z]?)\s*[—\-–]\s*(.+)$/;
const SPEC_SHORT_ID_RE = /^(SPEC-\d+-\d+)/;

function resolverFichierSpec(arg, racine) {
  if (arg.endsWith('.md')) {
    const p = resolve(racine, arg);
    if (existsSync(p)) return p;
    throw Object.assign(new Error(`spec file not found: ${arg}`), { code: 'NOT_FOUND' });
  }
  const direct = resolve(racine, arg + '.md');
  if (existsSync(direct)) return direct;
  const specsDir = join(racine, '.aiad', 'specs');
  if (existsSync(specsDir)) {
    const match = readdirSync(specsDir).find(f => f.startsWith(arg) && f.endsWith('.md'));
    if (match) return join(specsDir, match);
  }
  throw Object.assign(new Error(`spec file not found: ${arg}`), { code: 'NOT_FOUND' });
}

function extraireCA(texte) {
  const cas = [];
  for (const ligne of texte.split(/\r?\n/)) {
    const m = ligne.match(CA_HDR_RE);
    if (m) cas.push({ id: m[1], titre: m[2].trim() });
  }
  return cas;
}

function echapper(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function genererContenu(specSlug, shortId, cas) {
  const lines = [
    `// @spec ${specSlug}`,
    `// @verified-by test/${shortId}.test.js`,
    `import { test, todo } from 'node:test';`,
    '',
    ...cas.map(ca => `test('${ca.id} — ${echapper(ca.titre)}', () => { todo() });`),
    '',
  ];
  return lines.join('\n');
}

export function genererSquelettesTests(specArg, options = {}) {
  const { force = false, dryRun = false, racine = process.cwd() } = options;

  const specPath = resolverFichierSpec(specArg, racine);
  const specSlug = basename(specPath, '.md');
  const shortIdMatch = specSlug.match(SPEC_SHORT_ID_RE);
  const shortId = shortIdMatch ? shortIdMatch[1] : specSlug;

  const texte = readFileSync(specPath, 'utf-8');

  if (!FORMAT_EARS_RE.test(texte)) {
    throw Object.assign(
      new Error('not an EARS spec — run /sdd spec --ears first'),
      { code: 'NOT_EARS' }
    );
  }

  const cas = extraireCA(texte);
  if (cas.length === 0) {
    throw Object.assign(
      new Error('no acceptance criteria found'),
      { code: 'NO_CA' }
    );
  }

  const outputPath = resolve(racine, 'test', `${shortId}.test.js`);

  if (!dryRun && existsSync(outputPath) && !force) {
    throw Object.assign(
      new Error('already exists — use --force to overwrite'),
      { code: 'EXISTS' }
    );
  }

  const content = genererContenu(specSlug, shortId, cas);

  if (!dryRun) {
    writeFileSync(outputPath, content, 'utf-8');
  }

  return { outputPath, content, skipped: false };
}
