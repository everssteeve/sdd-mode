// Tests `lib/pii-scan.js` — détection PII pre-commit (item #109).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  DETECTEURS, verifierIban, verifierNir, verifierLuhn,
  scannerContenu, scannerFichier, scannerStages, listerFichiersStages,
  resoudreMode, piiScan, CONSTANTS,
  // alias EN
  verifyIban, verifyNir, verifyLuhn,
  scanContent, scanFile, scanStaged, listStagedFiles,
  resolveMode, scan,
} from '../lib/pii-scan.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'aiad-pii-')); }
function silent(fn) {
  return (...args) => {
    const ol = console.log; const oe = console.error;
    console.log = () => {}; console.error = () => {};
    try { return fn(...args); } finally { console.log = ol; console.error = oe; }
  };
}

function initGit(d) {
  spawnSync('git', ['init', '-q'], { cwd: d });
  spawnSync('git', ['config', 'user.email', 't@t.t'], { cwd: d });
  spawnSync('git', ['config', 'user.name', 't'], { cwd: d });
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: d });
}

// ─── verifierIban ──────────────────────────────────────────────────────────

test('verifierIban — IBAN FR valide', () => {
  // FR76 3000 6000 0112 3456 7890 189 (exemple BNP standard)
  assert.equal(verifierIban('FR7630006000011234567890189'), true);
});

test('verifierIban — IBAN DE valide', () => {
  // DE89 3704 0044 0532 0130 00
  assert.equal(verifierIban('DE89370400440532013000'), true);
});

test('verifierIban — checksum invalide', () => {
  assert.equal(verifierIban('FR7630006000011234567890188'), false);
});

test('verifierIban — format malformé', () => {
  assert.equal(verifierIban('NOT-AN-IBAN'), false);
  assert.equal(verifierIban('FR76'), false);
});

// ─── verifierNir ──────────────────────────────────────────────────────────

test('verifierNir — NIR FR valide', () => {
  // 1 85 12 75 123 456 22 (exemple synthétique valide)
  // Validation : on calcule la clé attendue
  const corps = '1851275123456';
  const cle = (97 - (parseInt(corps, 10) % 97)).toString().padStart(2, '0');
  assert.equal(verifierNir(corps + cle), true);
});

test('verifierNir — clé incorrecte', () => {
  assert.equal(verifierNir('185127512345699'), false);
});

test('verifierNir — format invalide', () => {
  assert.equal(verifierNir('abc'), false);
  assert.equal(verifierNir('1851275'), false);
});

// ─── verifierLuhn ─────────────────────────────────────────────────────────

test('verifierLuhn — carte Visa test valide (4242 4242 4242 4242)', () => {
  assert.equal(verifierLuhn('4242424242424242'), true);
});

test('verifierLuhn — invalide', () => {
  assert.equal(verifierLuhn('4242424242424243'), false);
});

test('verifierLuhn — longueur hors bornes', () => {
  assert.equal(verifierLuhn('123'), false);
  assert.equal(verifierLuhn('12345678901234567890'), false);
});

// ─── scannerContenu ───────────────────────────────────────────────────────

test('scannerContenu — texte sans PII → []', () => {
  assert.deepEqual(scannerContenu('Voici un texte normal sans secret.'), []);
  assert.deepEqual(scannerContenu(''), []);
  assert.deepEqual(scannerContenu(null), []);
});

test('scannerContenu — détecte IBAN valide', () => {
  const r = scannerContenu('Mon IBAN est FR7630006000011234567890189 pour le test.');
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, 'iban');
  assert.equal(r[0].severity, 'critique');
});

test('scannerContenu — ignore IBAN invalide (checksum)', () => {
  const r = scannerContenu('Mon IBAN est FR7630006000011234567890188.');
  assert.equal(r.filter((f) => f.kind === 'iban').length, 0);
});

test('scannerContenu — détecte email', () => {
  const r = scannerContenu('Contact : alice@example.com');
  const emails = r.filter((f) => f.kind === 'email');
  assert.equal(emails.length, 1);
  assert.equal(emails[0].match, 'alice@example.com');
});

test('scannerContenu — détecte token Stripe live', () => {
  // Token de test construit à l'exécution : évite un littéral sk_live_ scannable
  // en source (sinon faux positif GitHub push protection sur cette fixture).
  const r = scannerContenu('Secret: sk_live_' + 'a'.repeat(26));
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, 'token_stripe_live');
  assert.equal(r[0].severity, 'critique');
});

test('scannerContenu — détecte ghp_ token GitHub', () => {
  const r = scannerContenu('Token: ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(r.filter((f) => f.kind === 'token_github').length, 1);
});

test('scannerContenu — détecte AWS Access Key', () => {
  const r = scannerContenu('AWS key: AKIAIOSFODNN7EXAMPLE');
  assert.equal(r.filter((f) => f.kind === 'token_aws_access').length, 1);
});

test('scannerContenu — détecte téléphone FR', () => {
  const r1 = scannerContenu('Tel : +33 6 12 34 56 78');
  const r2 = scannerContenu('Tel : 06 12 34 56 78');
  assert.ok(r1.some((f) => f.kind === 'phone_fr'));
  assert.ok(r2.some((f) => f.kind === 'phone_fr'));
});

test('scannerContenu — détecte carte bancaire (Luhn valide)', () => {
  const r = scannerContenu('CB : 4242 4242 4242 4242');
  assert.ok(r.some((f) => f.kind === 'card' && f.severity === 'critique'));
});

test('scannerContenu — ignore carte au Luhn invalide', () => {
  const r = scannerContenu('CB : 4242 4242 4242 4243');
  assert.ok(!r.some((f) => f.kind === 'card'));
});

test('scannerContenu — localise la ligne et la colonne', () => {
  const text = 'ligne 1\nligne 2 avec alice@example.com\nligne 3';
  const r = scannerContenu(text);
  const email = r.find((f) => f.kind === 'email');
  assert.equal(email.ligne, 2);
  assert.ok(email.colonne >= 1);
});

test('scannerContenu — combo plusieurs PII', () => {
  const r = scannerContenu('CB 4242424242424242 et tel +33 6 12 34 56 78 et email a@b.fr');
  const kinds = new Set(r.map((f) => f.kind));
  assert.ok(kinds.has('card'));
  assert.ok(kinds.has('email'));
  assert.ok(kinds.has('phone_fr'));
});

// ─── scannerFichier ───────────────────────────────────────────────────────

test('scannerFichier — fichier absent → []', () => {
  assert.deepEqual(scannerFichier('/non/existant.md'), []);
});

test('scannerFichier — lit et scanne', () => {
  const d = tmp();
  try {
    const path = join(d, 'spec.md');
    writeFileSync(path, 'Contact alice@example.com pour les détails.');
    const r = scannerFichier(path);
    assert.equal(r.length, 1);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── listerFichiersStages / scannerStages ────────────────────────────────

test('listerFichiersStages — repo sans git → []', () => {
  const d = tmp();
  try {
    assert.deepEqual(listerFichiersStages(d), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('listerFichiersStages — restreint à .aiad/intents et .aiad/specs', () => {
  const d = tmp();
  try {
    initGit(d);
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    mkdirSync(join(d, 'src'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'), 'x');
    writeFileSync(join(d, 'src', 'app.ts'), 'x');
    writeFileSync(join(d, 'README.md'), 'x');
    spawnSync('git', ['add', '-A'], { cwd: d });
    const r = listerFichiersStages(d);
    assert.deepEqual(r, ['.aiad/specs/SPEC-001-1-x.md']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('scannerStages — détecte PII dans Intent stagé', () => {
  const d = tmp();
  try {
    initGit(d);
    mkdirSync(join(d, '.aiad', 'intents'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'intents', 'INT-001.md'),
      'Contact alice@example.com\nIBAN FR7630006000011234567890189');
    spawnSync('git', ['add', '-A'], { cwd: d });
    const r = scannerStages(d);
    assert.equal(r.files, 1);
    assert.equal(r.findings, 2);
    assert.ok(r.byFile['.aiad/intents/INT-001.md']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('scannerStages — fichier sans PII → 0 finding', () => {
  const d = tmp();
  try {
    initGit(d);
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'),
      '# Spec propre\n\nAucun secret ici.');
    spawnSync('git', ['add', '-A'], { cwd: d });
    const r = scannerStages(d);
    assert.equal(r.files, 1);
    assert.equal(r.findings, 0);
    assert.deepEqual(Object.keys(r.byFile), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ─── resoudreMode ─────────────────────────────────────────────────────────

test('resoudreMode — défaut block', () => {
  const d = tmp();
  try {
    assert.equal(resoudreMode(d), 'block');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('resoudreMode — env AIAD_PII_MODE override config', () => {
  const d = tmp();
  process.env.AIAD_PII_MODE = 'warn';
  try {
    mkdirSync(join(d, '.aiad'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'config.yml'), 'pii_scan: block');
    assert.equal(resoudreMode(d), 'warn');
  } finally {
    delete process.env.AIAD_PII_MODE;
    rmSync(d, { recursive: true, force: true });
  }
});

test('resoudreMode — lit config.yml pii_scan:', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, '.aiad'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'config.yml'), 'pii_scan: off\n');
    assert.equal(resoudreMode(d), 'off');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('resoudreMode — env invalide → ignoré, fallback', () => {
  const d = tmp();
  process.env.AIAD_PII_MODE = 'invalid';
  try {
    assert.equal(resoudreMode(d), 'block');
  } finally {
    delete process.env.AIAD_PII_MODE;
    rmSync(d, { recursive: true, force: true });
  }
});

// ─── piiScan (CLI) ────────────────────────────────────────────────────────

test('piiScan --json sans cible → 0 findings', () => {
  const d = tmp();
  try {
    let captured = '';
    const orig = process.stdout.write;
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try { piiScan(d, { json: true }); }
    finally { process.stdout.write = orig; }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.findings, 0);
    assert.equal(parsed.mode, 'block');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('piiScan path → scanne un fichier ciblé', silent(() => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'spec.md'), 'Token sk_live_' + 'a'.repeat(26));
    const r = piiScan(d, { path: 'spec.md', mode: 'warn' });
    assert.equal(r.findings, 1);
    assert.equal(r.mode, 'warn');
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

test('piiScan --staged → utilise git diff --cached', silent(() => {
  const d = tmp();
  try {
    initGit(d);
    mkdirSync(join(d, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(d, '.aiad', 'specs', 'SPEC-001-1-x.md'),
      'IBAN FR7630006000011234567890189');
    spawnSync('git', ['add', '-A'], { cwd: d });
    const r = piiScan(d, { staged: true, mode: 'warn' });
    assert.equal(r.findings, 1);
  } finally { rmSync(d, { recursive: true, force: true }); }
}));

// ─── alias EN ──────────────────────────────────────────────────────────────

test('alias EN — exports canoniques', () => {
  assert.equal(verifyIban, verifierIban);
  assert.equal(verifyNir, verifierNir);
  assert.equal(verifyLuhn, verifierLuhn);
  assert.equal(scanContent, scannerContenu);
  assert.equal(scanFile, scannerFichier);
  assert.equal(scanStaged, scannerStages);
  assert.equal(listStagedFiles, listerFichiersStages);
  assert.equal(resolveMode, resoudreMode);
  assert.equal(scan, piiScan);
});

test('CONSTANTS — modes valides', () => {
  assert.deepEqual(CONSTANTS.MODES_VALIDES, ['block', 'warn', 'off']);
});

test('DETECTEURS — au moins 10 détecteurs définis', () => {
  assert.ok(DETECTEURS.length >= 10);
  for (const d of DETECTEURS) {
    assert.ok(d.id);
    assert.ok(d.label);
    assert.ok(['critique', 'eleve', 'moyen'].includes(d.severity));
    assert.ok(d.regex instanceof RegExp);
  }
});
