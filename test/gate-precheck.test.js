// Tests `lib/gate-precheck.js` + CLI `aiad-sdd gate-precheck` — pré-contrôle
// déterministe de l'Execution Gate (périmètre d'exécution, seuil d'arrêt).
//
// @intent INTENT-033
// @spec SPEC-033-3-gate-precheck

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LIGNES,
  MOTS_CLES,
  calculerPrecheck,
  resoudreSpec,
  emitGatePrecheck,
  estVide,
  normaliserValeur,
  // alias EN
  computeGatePrecheck,
} from '../lib/gate-precheck.js';
import { validerSchema } from '../lib/verdict.js';
import { chargerCasCanary } from '../lib/canary.js';
import { CATALOGUE } from '../lib/cli-schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RACINE = join(__dirname, '..');
const BIN = join(RACINE, 'bin', 'aiad-sdd.js');
const SCHEMA = JSON.parse(readFileSync(join(RACINE, '.aiad', 'schema', 'verdicts', 'gate-precheck.schema.json'), 'utf-8'));

// Valeurs complètes et conformes (PASS), surchargées par cas.
const CONFORME = {
  Isolation: 'conteneur',
  'Sorties réseau autorisées': 'aucune',
  'Credentials présents': 'aucun',
  'Ressources partagées en écriture': 'aucune',
  'Actions irréversibles possibles': 'aucune',
  "Seuil d'arrêt": '',
};

// Fabrique une SPEC avec la section 9 au format SPEC-033-2 §2.
function spec({ lignes = CONFORME, omettre = [], corps = null, titre = "## 9. Périmètre d'exécution de l'agent (conditionnel)" } = {}) {
  const L = ['---', 'id: SPEC-900-1', 'status: draft', '---', '', '# SPEC-900-1 — Fixture', '', '## 7. Definition of Output Done (DoOD)', '', '- [ ] Code', ''];
  L.push(titre, '', '<!-- Requis si l\'agent dispose de credentials ou d\'un accès en écriture à une ressource partagée. Sinon : « Non applicable ». -->', '');
  if (corps !== null) {
    L.push(corps);
  } else {
    L.push('| Élément | Déclaration |', '|---------|-------------|');
    for (const [k, v] of Object.entries(lignes)) if (!omettre.includes(k)) L.push(`| ${k} | ${v} |`);
  }
  L.push('', '## Historique des modifications', '', '| Date | Changement | Raison |', '|------|------------|--------|');
  return L.join('\n');
}

function tmp() {
  return mkdtempSync(join(tmpdir(), 'gate-precheck-'));
}

function cli(args, cwd = RACINE) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf-8' });
}

// ─── Utilitaires ────────────────────────────────────────────────────────────

test('estVide — vide ou placeholder entre crochets', () => {
  assert.ok(estVide(''));
  assert.ok(estVide('   '));
  assert.ok(estVide('[condition d\'arrêt immédiat]'));
  assert.ok(!estVide('arrêt si > 10 lignes supprimées'));
});

test('normaliserValeur — casse, espaces et point final ignorés', () => {
  assert.equal(normaliserValeur(' Non  Applicable. '), 'nonapplicable');
  assert.equal(normaliserValeur('AUCUNE.'), 'aucune');
});

// ─── CA-001 — non-régression sur les SPEC archivées ─────────────────────────

test('CA-001 — exit 0 pour chaque SPEC de .aiad/specs/archive/', () => {
  const dir = join(RACINE, '.aiad', 'specs', 'archive');
  const fichiers = readdirSync(dir).filter((f) => f.endsWith('.md'));
  assert.ok(fichiers.length >= 67, `au moins les 67 SPEC archivées du 2026-09-25 (trouvé ${fichiers.length})`);
  for (const f of fichiers) {
    const r = emitGatePrecheck(RACINE, join('.aiad', 'specs', 'archive', f), { schema: SCHEMA });
    assert.equal(r.code, 0, `${f} → ${r.verdict}`);
  }
});

test('CA-001 — CLI exit 0 sur une SPEC archivée résolue par identifiant', () => {
  const r = cli(['gate-precheck', 'SPEC-003-1']);
  assert.equal(r.status, 0, r.stderr);
});

// ─── CA-002 — mots-clés sans section ────────────────────────────────────────

test('CA-002 — mots-clés sans section : exit 0, un avertissement par mot-clé', () => {
  const md = '# SPEC\n\nL\'agent lit un TOKEN et un Password, puis un token encore.\nPaiement et suppression  définitive.\n';
  const r = calculerPrecheck(md);
  assert.equal(r.verdict, 'PASS');
  assert.equal(r.section, 'absente');
  assert.equal(r.avertissements.length, 4);
  for (const t of ['token', 'password', 'paiement', 'suppression définitive']) {
    assert.ok(r.avertissements.some((a) => a.includes(`« ${t} »`)), t);
  }
});

test('CA-002 — mots entiers seulement (tokens ≠ token, irréversibles ≠ irréversible)', () => {
  const r = calculerPrecheck('# SPEC\n\nLes tokens sont comptés ; actions irréversibles ; secrets ; passwords.\n');
  assert.deepEqual(r.avertissements, []);
  assert.equal(computeGatePrecheck('# x\n\nCredential.').avertissements.length, 1);
});

test('CA-002 — chaque mot-clé listé est détecté', () => {
  for (const t of MOTS_CLES) {
    const r = calculerPrecheck(`# SPEC\n\nTexte avec ${t.toUpperCase()} au milieu.\n`);
    assert.ok(r.avertissements.some((a) => a.includes(`« ${t} »`)), t);
  }
});

test('CA-002 — CLI : exit 0 et avertissements en JSON', () => {
  const dir = tmp();
  try {
    writeFileSync(join(dir, 'x.md'), '# SPEC\n\nUne clé API est utilisée.\n');
    const r = cli(['gate-precheck', 'x.md', '--json'], dir);
    assert.equal(r.status, 0);
    const out = JSON.parse(r.stdout.trim());
    assert.equal(out.avertissements.length, 1);
    assert.equal(out.section, 'absente');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ─── CA-003 — action irréversible sans seuil d'arrêt ────────────────────────

test('CA-003 — action irréversible déclarée + seuil vide → FAIL (exit 1)', () => {
  const r = calculerPrecheck(spec({ lignes: { ...CONFORME, 'Actions irréversibles possibles': 'DROP TABLE clients', "Seuil d'arrêt": '' } }));
  assert.equal(r.verdict, 'FAIL');
  assert.equal(r.manques.length, 1);
  assert.match(r.manques[0], /Seuil d'arrêt/);
});

test('CA-003 — seuil resté au placeholder [..] → FAIL', () => {
  const r = calculerPrecheck(spec({ lignes: { ...CONFORME, 'Actions irréversibles possibles': 'purge S3', "Seuil d'arrêt": '[condition d\'arrêt immédiat]' } }));
  assert.equal(r.verdict, 'FAIL');
});

test('CA-003 — seuil renseigné → PASS ; « Aucune. » ou placeholder d\'action → PASS', () => {
  assert.equal(calculerPrecheck(spec({ lignes: { ...CONFORME, 'Actions irréversibles possibles': 'purge S3', "Seuil d'arrêt": 'arrêt si > 1 bucket' } })).verdict, 'PASS');
  assert.equal(calculerPrecheck(spec({ lignes: { ...CONFORME, 'Actions irréversibles possibles': ' Aucune. ' } })).verdict, 'PASS');
  assert.equal(calculerPrecheck(spec({ lignes: { ...CONFORME, 'Actions irréversibles possibles': '[liste + classe de réversibilité — ou « aucune »]' } })).verdict, 'PASS');
});

// ─── CA-004 — credentials / ressource partagée sans isolation ───────────────

test('CA-004 — credentials déclarés + isolation vide → FAIL', () => {
  const r = calculerPrecheck(spec({ lignes: { ...CONFORME, 'Credentials présents': 'jeton GitHub, repo, 1 h', Isolation: '' } }));
  assert.equal(r.verdict, 'FAIL');
  assert.match(r.manques[0], /Isolation/);
});

test('CA-004 — ressource partagée + sorties réseau au placeholder → FAIL', () => {
  const r = calculerPrecheck(spec({ lignes: { ...CONFORME, 'Ressources partagées en écriture': 'base de recette', 'Sorties réseau autorisées': '[aucune / liste de domaines]' } }));
  assert.equal(r.verdict, 'FAIL');
  assert.match(r.manques[0], /Sorties réseau autorisées/);
});

test('CA-004 — « AUCUN » / « aucune » ne déclarent rien ; isolation et réseau renseignés → PASS', () => {
  assert.equal(calculerPrecheck(spec({ lignes: { ...CONFORME, 'Credentials présents': 'AUCUN.', Isolation: '', 'Sorties réseau autorisées': '' } })).verdict, 'PASS');
  assert.equal(calculerPrecheck(spec({ lignes: { ...CONFORME, 'Credentials présents': 'jeton', 'Sorties réseau autorisées': 'aucune' } })).verdict, 'PASS');
});

// ─── CA-005 — section non applicable ────────────────────────────────────────

test('CA-005 — section « Non applicable » → PASS (exit 0)', () => {
  for (const corps of ['Non applicable', 'non applicable.', '  NON   APPLICABLE  ']) {
    const r = calculerPrecheck(spec({ corps }));
    assert.equal(r.verdict, 'PASS', corps);
    assert.equal(r.section, 'non-applicable');
  }
});

// ─── CA-006 / CA-006b — tableau incomplet ───────────────────────────────────

test('CA-006 — une ligne absente → JNSP (exit 2) avec la ligne listée', () => {
  const r = calculerPrecheck(spec({ omettre: ['Isolation'] }));
  assert.equal(r.verdict, 'JNSP');
  assert.deepEqual(r.lignesAbsentes, ['Isolation']);
});

test('CA-006 — section présente mais tableau illisible → JNSP', () => {
  const r = calculerPrecheck(spec({ corps: 'L\'agent a accès à la prod, on verra.' }));
  assert.equal(r.verdict, 'JNSP');
  assert.equal(r.lignesAbsentes.length, Object.keys(LIGNES).length);
});

test('CA-006b — tableau incomplet prioritaire sur un manque (irréversible sans seuil)', () => {
  const r = calculerPrecheck(spec({
    lignes: { ...CONFORME, 'Actions irréversibles possibles': 'purge', "Seuil d'arrêt": '' },
    omettre: ['Sorties réseau autorisées'],
  }));
  assert.equal(r.verdict, 'JNSP');
  assert.deepEqual(r.manques, []);
  assert.deepEqual(r.lignesAbsentes, ['Sorties réseau autorisées']);
});

test('titre reconnu par libellé : numéro et casse ignorés', () => {
  const r = calculerPrecheck(spec({ titre: "### PÉRIMÈTRE D'EXÉCUTION DE L'AGENT", lignes: { ...CONFORME, 'Actions irréversibles possibles': 'purge' } }));
  assert.equal(r.verdict, 'FAIL');
});

test('titre dans un bloc de code clôturé : pas une section', () => {
  const md = "# SPEC\n\n```markdown\n## 9. Périmètre d'exécution de l'agent\n\n| Isolation | |\n```\n";
  assert.equal(calculerPrecheck(md).section, 'absente');
});

// ─── CA-007 — SPEC introuvable ──────────────────────────────────────────────

test('CA-007 — identifiant sans fichier → JNSP (exit 2), CLI incluse', () => {
  const dir = tmp();
  try {
    const r = emitGatePrecheck(dir, 'SPEC-404-1', { schema: SCHEMA });
    assert.equal(r.code, 2);
    assert.equal(r.enveloppe.section, null);
    assert.equal(cli(['gate-precheck', 'SPEC-404-1'], dir).status, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('résolution : .aiad/specs/ puis archive/, préfixe exact (SPEC-1-1 ≠ SPEC-1-10)', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, '.aiad', 'specs', 'archive'), { recursive: true });
    writeFileSync(join(dir, '.aiad', 'specs', 'archive', 'SPEC-001-10-autre.md'), '# a');
    writeFileSync(join(dir, '.aiad', 'specs', 'archive', 'SPEC-001-1-archivee.md'), '# b');
    assert.match(resoudreSpec(dir, 'SPEC-001-1').path, /SPEC-001-1-archivee\.md$/);
    writeFileSync(join(dir, '.aiad', 'specs', 'SPEC-001-1-active.md'), '# c');
    assert.match(resoudreSpec(dir, 'SPEC-001-1').path, /SPEC-001-1-active\.md$/);
    assert.equal(resoudreSpec(dir, 'SPEC-001-2'), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ─── CA-008 — sortie JSON validée par schéma ────────────────────────────────

test('CA-008 — --json valide contre gate-precheck.schema.json (PASS, FAIL, JNSP)', () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, '.aiad', 'specs'), { recursive: true });
    writeFileSync(join(dir, '.aiad', 'specs', 'SPEC-900-1-ok.md'), spec());
    writeFileSync(join(dir, '.aiad', 'specs', 'SPEC-900-2-ko.md'), spec({ lignes: { ...CONFORME, 'Actions irréversibles possibles': 'purge' } }));
    writeFileSync(join(dir, '.aiad', 'specs', 'SPEC-900-3-partiel.md'), spec({ omettre: ["Seuil d'arrêt"] }));
    const attendus = { 'SPEC-900-1': [0, 'PASS'], 'SPEC-900-2': [1, 'FAIL'], 'SPEC-900-3': [2, 'JNSP'], 'SPEC-404': [2, 'JNSP'] };
    for (const [id, [code, verdict]] of Object.entries(attendus)) {
      const r = cli(['gate-precheck', id, '--json'], dir);
      assert.equal(r.status, code, `${id} : ${r.stderr}`);
      const out = JSON.parse(r.stdout.trim());
      assert.equal(out.verdict, verdict);
      assert.equal(out.exitCode, code);
      const v = validerSchema(out, SCHEMA);
      assert.ok(v.valide, `${id} : ${v.erreurs.join(' ; ')}`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CA-008 — catalogue cli-schema aligné sur gate-precheck.schema.json', () => {
  const c = CATALOGUE['gate-precheck'];
  assert.ok(c && c.summary);
  assert.deepEqual(c.schema.required, SCHEMA.required);
  assert.deepEqual(Object.keys(c.schema.properties), Object.keys(SCHEMA.properties));
});

// ─── CA-009 / 009b / 009c — intégration à /sdd gate ─────────────────────────

test('CA-009 — /sdd gate lance gate-precheck avant le scoring SQS (fast path + guidé), FAIL ferme, JNSP → INCONNUE', () => {
  for (const f of [join(RACINE, 'templates', '.claude', 'sdd', 'gate.md'), join(RACINE, '.claude', 'sdd', 'gate.md')]) {
    const md = readFileSync(f, 'utf-8');
    const fast = md.slice(md.indexOf('## 🚀 Fast path'), md.indexOf('## 📖 Mode guidé'));
    const guide = md.slice(md.indexOf('## 📖 Mode guidé'));
    for (const bloc of [fast, guide]) {
      const i = bloc.indexOf('npx aiad-sdd gate-precheck <SPEC-id>');
      assert.ok(i >= 0, f);
      assert.ok(i < bloc.indexOf('sqs-scoring'), `précheck avant SQS : ${f}`);
      assert.match(bloc, /FAIL[^\n]*Gate est \*\*FERMÉE\*\*/);
      assert.match(bloc, /JNSP[^\n]*Gate est \*\*INCONNUE\*\*/);
    }
  }
});

// ─── CA-010 — cas canary déterministe ───────────────────────────────────────

test('CA-010 — un cas canary déterministe attend FAIL de gate-precheck sur la fixture', () => {
  const cas = chargerCasCanary(RACINE).filter((c) => c.kind === 'deterministic' && /^gate-precheck\b/.test(c.command || ''));
  assert.equal(cas.length, 1);
  assert.equal(String(cas[0].expected).toUpperCase(), 'FAIL');
  const args = cas[0].command.split(/\s+/);
  const r = cli(args);
  assert.equal(r.status, 1, r.stderr);
  assert.equal(JSON.parse(r.stdout.trim()).verdict, 'FAIL');
});
