// Tests `lib/ci-templates.js` — Templates CI/CD Jenkins + Drone (item #114).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  FORGES, listerForges, lireTemplate, afficherListe, installerTemplate, extraireCommandes,
  extractCommands,
  // alias EN
  listForges, readTemplate, showList, installTemplate,
} from '../lib/ci-templates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FORGES_DIR = join(__dirname, '..', 'templates', 'forges');

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-ci-')); }
function silent(fn) {
  return (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

// ─── FORGES catalogue ─────────────────────────────────────────────────────

test('FORGES — couvre 6 forges majeures (github, gitlab, jenkins, drone, bitbucket, azure)', () => {
  for (const id of ['github', 'gitlab', 'jenkins', 'drone', 'bitbucket', 'azure']) {
    assert.ok(FORGES[id], `${id} manquant`);
    assert.ok(FORGES[id].source);
    assert.ok(FORGES[id].cible);
    assert.ok(FORGES[id].label);
  }
});

test('FORGES — sources existent dans templates/forges/', () => {
  for (const id of Object.keys(FORGES)) {
    const path = join(FORGES_DIR, FORGES[id].source);
    assert.ok(existsSync(path), `template source ${FORGES[id].source} manquant`);
  }
});

test('listerForges — renvoie tableau avec id + meta', () => {
  const r = listerForges();
  assert.ok(r.length >= 3);
  for (const f of r) {
    assert.ok(f.id);
    assert.ok(f.label);
    assert.ok(f.source);
  }
});

// ─── lireTemplate ─────────────────────────────────────────────────────────

test('lireTemplate — forge inconnue → throw', () => {
  assert.throws(() => lireTemplate('unknown'), /Forge inconnue/);
});

test('lireTemplate — jenkins contient stages clés', () => {
  const c = lireTemplate('jenkins');
  assert.match(c, /pipeline\s*\{/);
  assert.match(c, /AIAD : matrice de traçabilité/);
  assert.match(c, /aiad-sdd trace --fail-on-gap/);
  assert.match(c, /aiad-sdd sovereignty --check/);
  assert.match(c, /aiad-sdd sla check/);
  assert.match(c, /aiad-sdd audit verify/);
});

test('lireTemplate — drone contient steps avec depends_on', () => {
  const c = lireTemplate('drone');
  assert.match(c, /kind: pipeline/);
  assert.match(c, /aiad-sdd trace --fail-on-gap/);
  assert.match(c, /aiad-sdd sovereignty --check/);
  assert.match(c, /aiad-sdd sla check/);
  assert.match(c, /aiad-sdd audit verify/);
});

test('lireTemplate — bitbucket contient definitions+steps', () => {
  const c = lireTemplate('bitbucket');
  assert.match(c, /definitions/);
  assert.match(c, /aiad-sdd trace/);
});

// (#235) GitLab CI
test('lireTemplate — gitlab contient 5 jobs aiad: + SARIF report', () => {
  const c = lireTemplate('gitlab');
  assert.match(c, /aiad:trace:/);
  assert.match(c, /aiad:emit-rules-check:/);
  assert.match(c, /aiad:docs-check:/);
  assert.match(c, /aiad:update-check:/);
  assert.match(c, /aiad:dashboard:/);
  // SARIF (Security Dashboard)
  assert.match(c, /sast: \.aiad\/metrics\/traceability\/trace\.sarif/);
  // Path-aware rules pour économiser CI minutes
  assert.match(c, /CI_PIPELINE_SOURCE == 'merge_request_event'/);
});

// (#236) Azure Pipelines
test('lireTemplate — azure contient 2 stages PR + main avec NodeTool', () => {
  const c = lireTemplate('azure');
  assert.match(c, /AiadChecks/);
  assert.match(c, /AiadQualityGate/);
  assert.match(c, /NodeTool@0/);
  assert.match(c, /vmImage: 'ubuntu-latest'/);
  assert.match(c, /aiad-sdd trace --fail-on-gap/);
  assert.match(c, /aiad-sdd emit-rules --check/);
  assert.match(c, /aiad-sdd docs --check/);
  assert.match(c, /aiad-sdd update --check/);
  assert.match(c, /aiad-sdd brief --strict=70/);
  assert.match(c, /PublishPipelineArtifact@1/);
});

test('lireTemplate — azure utilise matrix strategy pour parallélisme PR', () => {
  const c = lireTemplate('azure');
  assert.match(c, /strategy:\s*\n\s*matrix:/);
  // condition explicite PR pour stage AiadChecks
  assert.match(c, /eq\(variables\['Build\.Reason'\], 'PullRequest'\)/);
  // condition main pour quality gate
  assert.match(c, /eq\(variables\['Build\.SourceBranch'\], 'refs\/heads\/main'\)/);
});

test('installerTemplate — azure → écrit azure-pipelines.yml', silent(() => {
  const d = tmp();
  try {
    const r = installerTemplate(d, 'azure');
    assert.equal(r.action, 'created');
    const cible = join(d, 'azure-pipelines.yml');
    assert.ok(existsSync(cible));
    const contenu = readFileSync(cible, 'utf-8');
    assert.match(contenu, /AiadChecks/);
    assert.match(contenu, /brief --strict=70/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerTemplate — gitlab → écrit .gitlab-ci.aiad.yml (pattern include)', silent(() => {
  const d = tmp();
  try {
    const r = installerTemplate(d, 'gitlab');
    assert.equal(r.action, 'created');
    assert.ok(existsSync(join(d, '.gitlab-ci.aiad.yml')));
    const contenu = readFileSync(join(d, '.gitlab-ci.aiad.yml'), 'utf-8');
    assert.match(contenu, /aiad:trace/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

// (#233) GitHub Actions
test('lireTemplate — github contient jobs PR + main avec brief --strict', () => {
  const c = lireTemplate('github');
  assert.match(c, /name: AIAD SDD Quality Gate/);
  assert.match(c, /on:\n\s*pull_request/);
  assert.match(c, /aiad-sdd trace --fail-on-gap/);
  assert.match(c, /aiad-sdd emit-rules --check/);
  assert.match(c, /aiad-sdd docs --check/);
  assert.match(c, /aiad-sdd update --check/);
  assert.match(c, /aiad-sdd dashboard/);
  assert.match(c, /aiad-sdd brief --strict=70/);
  assert.match(c, /actions\/upload-artifact@v4/);
  assert.match(c, /badge\*\.svg/);
});

test('lireTemplate — github respecte permissions minimales (least privilege)', () => {
  const c = lireTemplate('github');
  assert.match(c, /permissions:\n\s*contents: read/);
  // Le job qui commit doit explicitement upgrade en write
  assert.match(c, /contents: write/);
});

// (#264) Help text mentionne les 6 forges
test('aiad-sdd --help — ci-template line liste les 6 forges en ordre alphabétique', () => {
  const root = join(__dirname, '..');
  const r = spawnSync('node', [join(root, 'bin', 'aiad-sdd.js'), '--help'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `--help should exit 0, got ${r.status}`);
  const lineCi = r.stdout.split('\n').find((l) => l.includes('ci-template'));
  assert.ok(lineCi, 'ci-template absent du help');
  for (const forge of ['github', 'gitlab', 'jenkins', 'drone', 'bitbucket', 'azure']) {
    assert.ok(lineCi.includes(forge), `forge "${forge}" absent du help line: ${lineCi}`);
  }
});

// (#255) FORGES descriptions reflètent #251 (5 checks au lieu de 4)
test('FORGES descriptions — github/azure/bitbucket annoncent dashboard --check', () => {
  assert.match(FORGES.github.description, /5-checks/);
  assert.match(FORGES.github.description, /dashboard --check/);
  assert.match(FORGES.gitlab.description, /6 jobs/);
  assert.match(FORGES.gitlab.description, /dashboard-check/);
  assert.match(FORGES.azure.description, /5-checks/);
  assert.match(FORGES.bitbucket.description, /dashboard --check/);
});

// (#251) dashboard --check inclus dans matrix PR
test('lireTemplate — github matrix PR inclut dashboard --check', () => {
  const c = lireTemplate('github');
  // L'élément dashboard est dans la matrix `check:`
  assert.match(c, /check:\s*\n(\s*-\s*[a-z-]+\n){4,5}\s*-\s*dashboard/);
  // Le case bash route bien dashboard vers aiad-sdd dashboard --check
  assert.match(c, /dashboard\)\s+npx -y aiad-sdd dashboard --check/);
});

test('lireTemplate — gitlab inclut aiad:dashboard-check sur MR', () => {
  const c = lireTemplate('gitlab');
  assert.match(c, /aiad:dashboard-check:/);
  assert.match(c, /aiad-sdd dashboard --check/);
});

test('lireTemplate — azure matrix PR inclut dashboard --check', () => {
  const c = lireTemplate('azure');
  assert.match(c, /dashboard:\s*\n\s+check: 'dashboard'\s*\n\s+cmd: 'aiad-sdd dashboard --check'/);
});

test('lireTemplate — bitbucket inclut aiad-dashboard-check step PR', () => {
  const c = lireTemplate('bitbucket');
  assert.match(c, /aiad-dashboard-check/);
  assert.match(c, /aiad-sdd dashboard --check/);
});

// (#290) Commit-back inclut shields-endpoints.json
test('lireTemplate — github commit-back step inclut shields-endpoints.json', () => {
  const c = lireTemplate('github');
  assert.match(c, /git add dashboard\/badge\*\.svg dashboard\/shields-endpoints\.json/);
  assert.match(c, /refresh README badges \+ shields endpoints/);
});

// (#291) Parité Azure : commit-back inclut shields-endpoints.json
test('lireTemplate — azure commit-back inclut shields-endpoints.json (parité #290)', () => {
  const c = lireTemplate('azure');
  assert.match(c, /git add dashboard\/badge\*\.svg dashboard\/shields-endpoints\.json/);
  assert.match(c, /refresh README badges \+ shields endpoints/);
});

// (#245) GitHub Pages deployment
test('lireTemplate — github contient job aiad-deploy-pages', () => {
  const c = lireTemplate('github');
  assert.match(c, /aiad-deploy-pages:/);
  assert.match(c, /needs: aiad-quality-gate/);
  assert.match(c, /pages: write/);
  assert.match(c, /id-token: write/);
  assert.match(c, /actions\/upload-pages-artifact@v3/);
  assert.match(c, /actions\/deploy-pages@v4/);
  assert.match(c, /environment:\n\s*name: github-pages/);
});

test('lireTemplate — github calcule AIAD_PUBLIC_URL automatique pour Pages', () => {
  const c = lireTemplate('github');
  assert.match(c, /github\.io/);
  assert.match(c, /AIAD_PUBLIC_URL:/);
});

// (#317) AIAD_SOURCE_BASE doit être auto-câblé pour le job Pages deploy
test('lireTemplate — github câble AIAD_SOURCE_BASE pour liens source dashboard', () => {
  const c = lireTemplate('github');
  assert.match(c, /AIAD_SOURCE_BASE:/);
  // Format : https://github.com/{{ repo }}/blob/{{ sha }}
  assert.match(c, /https:\/\/github\.com\/\$\{\{ github\.repository \}\}\/blob\/\$\{\{ github\.sha \}\}/);
});

// (#234) extraireCommandes — résumé réel des commandes du template

test('extraireCommandes — extrait cmds avec flags clés', () => {
  const c = `
    aiad-sdd trace --fail-on-gap
    aiad-sdd emit-rules --check
    aiad-sdd brief --strict=70
    aiad-sdd audit verify
  `;
  const r = extraireCommandes(c);
  assert.deepEqual(r, [
    'trace --fail-on-gap',
    'emit-rules --check',
    'brief --strict=70',
    'audit verify',
  ]);
});

test('extraireCommandes — dédupe (sans répétition même cmd)', () => {
  const c = `
    aiad-sdd trace --fail-on-gap
    aiad-sdd trace --fail-on-gap
    aiad-sdd docs --check
  `;
  const r = extraireCommandes(c);
  assert.deepEqual(r, ['trace --fail-on-gap', 'docs --check']);
});

test('extraireCommandes — ignore flags non clés', () => {
  const c = 'aiad-sdd dashboard --quiet --port=5000';
  const r = extraireCommandes(c);
  assert.deepEqual(r, ['dashboard']);
});

test('extraireCommandes — cmd inconnue dans template vide → []', () => {
  assert.deepEqual(extraireCommandes(''), []);
  assert.deepEqual(extraireCommandes('no aiad here'), []);
});

test('extraireCommandes — github template surface bien les commandes réelles', () => {
  const c = lireTemplate('github');
  const r = extraireCommandes(c);
  // Le template github contient trace/emit-rules/docs/update/dashboard/brief
  assert.ok(r.includes('trace --fail-on-gap'), `trace manquant: ${r}`);
  assert.ok(r.includes('emit-rules --check'), `emit-rules manquant: ${r}`);
  assert.ok(r.includes('brief --strict=70'), `brief manquant: ${r}`);
});

test('extraireCommandes — alias EN', () => {
  assert.equal(extractCommands, extraireCommandes);
});

test('installerTemplate — github → écrit .github/workflows/aiad.yml', silent(() => {
  const d = tmp();
  try {
    const r = installerTemplate(d, 'github');
    assert.equal(r.action, 'created');
    const cible = join(d, '.github', 'workflows', 'aiad.yml');
    assert.ok(existsSync(cible), 'aiad.yml manquant');
    const contenu = readFileSync(cible, 'utf-8');
    assert.match(contenu, /AIAD SDD Quality Gate/);
    assert.match(contenu, /brief --strict=70/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

// ─── installerTemplate ────────────────────────────────────────────────────

test('installerTemplate — forge inconnue → throw', () => {
  const d = tmp();
  try {
    assert.throws(() => installerTemplate(d, 'unknown'), /Forge inconnue/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('installerTemplate — jenkins → écrit Jenkinsfile à la racine', silent(() => {
  const d = tmp();
  try {
    const r = installerTemplate(d, 'jenkins');
    assert.equal(r.action, 'created');
    assert.ok(existsSync(join(d, 'Jenkinsfile')));
    assert.match(readFileSync(join(d, 'Jenkinsfile'), 'utf-8'), /pipeline/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerTemplate — drone → écrit .drone.yml', silent(() => {
  const d = tmp();
  try {
    installerTemplate(d, 'drone');
    assert.ok(existsSync(join(d, '.drone.yml')));
    assert.match(readFileSync(join(d, '.drone.yml'), 'utf-8'), /kind: pipeline/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerTemplate — fichier existant sans --force → skipped', silent(() => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'Jenkinsfile'), 'EXISTING');
    const r = installerTemplate(d, 'jenkins');
    assert.equal(r.action, 'skipped');
    assert.equal(readFileSync(join(d, 'Jenkinsfile'), 'utf-8'), 'EXISTING');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerTemplate --force → overwrites', silent(() => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'Jenkinsfile'), 'EXISTING');
    const r = installerTemplate(d, 'jenkins', { force: true });
    assert.equal(r.action, 'overwritten');
    assert.match(readFileSync(join(d, 'Jenkinsfile'), 'utf-8'), /pipeline/);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerTemplate --out custom → cible alternative', silent(() => {
  const d = tmp();
  try {
    installerTemplate(d, 'drone', { out: 'ci/drone-custom.yml' });
    assert.ok(existsSync(join(d, 'ci', 'drone-custom.yml')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerTemplate --dry-run → pas d\'écriture', silent(() => {
  const d = tmp();
  try {
    const r = installerTemplate(d, 'drone', { dryRun: true });
    assert.equal(r.action, 'created'); // intention
    assert.ok(!existsSync(join(d, '.drone.yml')));
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('installerTemplate --json → sortie JSON', () => {
  const d = tmp();
  try {
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { installerTemplate(d, 'jenkins', { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.forge, 'jenkins');
    assert.equal(parsed.cible, 'Jenkinsfile');
    assert.equal(parsed.action, 'created');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── afficherListe ────────────────────────────────────────────────────────

test('afficherListe --json → JSON exploitable', () => {
  let captured = '';
  const orig = process.stdout.write;
  process.stdout.write = (chunk) => { captured += chunk; return true; };
  try { afficherListe({ json: true }); }
  finally { process.stdout.write = orig; }
  const parsed = JSON.parse(captured);
  assert.ok(parsed.forges.length >= 3);
  assert.ok(parsed.forges.find((f) => f.id === 'jenkins'));
  // (#298) _meta cohérent avec écosystème
  assert.equal(parsed._meta.schema, 'aiad-sdd-ci-template');
  assert.equal(parsed._meta.action, 'list');
});

test('afficherListe — sortie humaine smoke', silent(() => {
  const r = afficherListe();
  assert.ok(r.length >= 3);
}));

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(listForges, listerForges);
  assert.equal(readTemplate, lireTemplate);
  assert.equal(showList, afficherListe);
  assert.equal(installTemplate, installerTemplate);
});
