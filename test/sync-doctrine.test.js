// Tests `scripts/sync-doctrine.js` — synchronisation doctrine depuis le Drive publié.
//
// @spec SPEC-034-1a-sync-doctrine-drive
//
// Fixtures en dossiers temporaires uniquement (jamais le vrai Drive, jamais le
// dépôt). Couvre CA-001, CA-004 à CA-008 sur fixture (dont règle 1 étendue et sous-cas 1b) ; CA-002/003/006 sur la
// vraie synchronisation sont vérifiés à l'exécution (cf. SPEC).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  BASE_URL,
  CORRESPONDANCES,
  LOCK_PATH,
  classerChemin,
  reecrireChemins,
  lireVersionDoctrine,
  empreinte,
  construireLock,
  listerLegitimationLocale,
  syncDoctrine,
  main,
  SyncDoctrineError,
} from '../scripts/sync-doctrine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', 'scripts', 'sync-doctrine.js');

const muet = () => {};

function tmp(prefixe) { return mkdtempSync(join(tmpdir(), `aiad-syncdoc-${prefixe}-`)); }

function ecrire(racine, rel, contenu) {
  const p = join(racine, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, contenu, 'utf-8');
}

/** Source `published/md/` minimale et complète (10 fichiers). */
function fixtureSource(options = {}) {
  const { titre = '# Guide AIAD — Framework v1.9' } = options;
  const src = tmp('src');
  for (const c of CORRESPONDANCES) ecrire(src, c.source, `# ${c.source}\n\nContenu de ${c.source}.\n`);
  ecrire(src, '20_conception/gouvernance/AIAD-AI-ACT.md',
    '# Agent AI-ACT\n\nRèglement (UE) 2026/1744.\n'
    + 'Contexte : `../framework/legitimation/conformite-cas-2026.md`.\n'
    + 'Voir [le dossier](../framework/legitimation/conformite-cas-2026.md#calendrier).\n'
    + 'Preuves : `../framework/legitimation/responsabilite-evidence.md`.\n'
    + '| 2026-09-25 | v1.9 | récits déplacés vers `framework/legitimation/conformite-cas-2026.md` |\n');
  ecrire(src, '20_conception/framework/frameworkAIAD.md',
    `${titre}\n\nVoir \`../gouvernance/AIAD-AI-ACT.md\`.\n`
    + 'Argumentaire : `../../30_distribution/decideurs/argumentaires/governance-gap-2026.md`.\n'
    + 'Code inline intact : `npx aiad-sdd init`.\n');
  ecrire(src, '20_conception/framework/legitimation/execution-gate-evidence.md',
    '# Preuves\n\n- [Argumentaire — Dette](../../../30_distribution/decideurs/argumentaires/dette-maintenance-agentique.md)\n'
    + '- [Argumentaire — Governance Gap 2026](../../../30_distribution/decideurs/argumentaires/governance-gap-2026.md)\n'
    + '- Agents : `../../gouvernance/AIAD-RGPD.md`\n');
  return src;
}

/** Dépôt cible minimal : CRA existant + un fichier hors périmètre. */
function fixtureDepot() {
  const depot = tmp('depot');
  ecrire(depot, 'templates/.aiad/gouvernance/AIAD-CRA.md', '# CRA — reste dans le package\n');
  ecrire(depot, '.aiad/gouvernance/AIAD-CRA.md', '# CRA — reste dans le package\n');
  ecrire(depot, 'docs/legitimation/dette-maintenance-agentique.md', '# Dette — absent du Drive\n');
  ecrire(depot, 'templates/.aiad/gouvernance/AIAD-AI-ACT.md', '# Ancien — Omnibus PAS encore adopté\n');
  return depot;
}

/** Empreintes de tous les fichiers d'un dossier (clé = chemin relatif). */
function instantane(racine) {
  const res = {};
  const marche = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) marche(p);
      else res[p.slice(racine.length + 1)] = empreinte(readFileSync(p, 'utf-8'));
    }
  };
  marche(racine);
  return res;
}

const CIBLES = CORRESPONDANCES.flatMap((c) => c.cibles);

// ─── Fonctions pures ─────────────────────────────────────────────────────────

test('CORRESPONDANCES — 10 sources, 14 cibles', () => {
  assert.equal(CORRESPONDANCES.length, 10);
  assert.equal(CIBLES.length, 14);
  assert.equal(new Set(CIBLES).size, 14);
});

test('classerChemin — règle 1 : dossier de légitimation synchronisé → URL docs/legitimation/', () => {
  const c = classerChemin('../framework/legitimation/conformite-cas-2026.md');
  assert.equal(c.regle, 1);
  assert.equal(c.url, 'https://github.com/everssteeve/sdd-mode/blob/main/docs/legitimation/conformite-cas-2026.md');
});

test('classerChemin — règle 2 : agent de gouvernance → URL templates/.aiad/gouvernance/', () => {
  const c = classerChemin('../../gouvernance/AIAD-RGPD.md');
  assert.equal(c.regle, 2);
  assert.equal(c.url, `${BASE_URL}templates/.aiad/gouvernance/AIAD-RGPD.md`);
});

test('classerChemin — règle 3 : autre cible (argumentaire, intention.md, légitimation non synchronisée)', () => {
  assert.equal(classerChemin('../framework/intention.md').regle, 3);
  assert.equal(classerChemin('../../30_distribution/decideurs/argumentaires/governance-gap-2026.md').regle, 3);
  assert.equal(classerChemin('../legitimation/dette-maintenance-agentique.md').regle, 3);
});

test('reecrireChemins — règle 1 sur lien Markdown (ancre conservée) et accents graves', () => {
  const r = reecrireChemins('A `../framework/legitimation/conformite-cas-2026.md` B [x](../legitimation/verification-evidence.md#s1)');
  assert.equal(r.contenu,
    `A \`${BASE_URL}docs/legitimation/conformite-cas-2026.md\` B [x](${BASE_URL}docs/legitimation/verification-evidence.md#s1)`);
  assert.deepEqual(r.reecritures.map((x) => x.regle), [1, 1]);
});

test('reecrireChemins — règle 2 sur lien Markdown et accents graves', () => {
  const r = reecrireChemins('[agent](../gouvernance/AIAD-RGAA.md) et `../../gouvernance/AIAD-RGESN.md`');
  assert.equal(r.contenu,
    `[agent](${BASE_URL}templates/.aiad/gouvernance/AIAD-RGAA.md) et \`${BASE_URL}templates/.aiad/gouvernance/AIAD-RGESN.md\``);
});

test('reecrireChemins — règle 3 : lien → texte ; accents graves → nom + mention', () => {
  const r = reecrireChemins('- [Argumentaire — Gap](../../x/governance-gap-2026.md)\nportée par `../framework/intention.md` et la Constitution.');
  assert.equal(r.contenu,
    '- Argumentaire — Gap\nportée par `intention.md` (document publié avec le framework AIAD) et la Constitution.');
  assert.deepEqual(r.reecritures.map((x) => [x.forme, x.regle]), [['lien', 3], ['code', 3]]);
});

test('reecrireChemins — laisse intacts URL, noms nus, ./voisin, fichiers projet et code inline', () => {
  const src = 'Voir [site](https://aiad.ovh), `GLOSSAIRE-AIAD.md`, `intention.md`, `governance-gap-2026.md`, '
    + '[voisin](./verification-evidence.md), `CLAUDE.md`, `AGENTS.md`, `.aiad/facts/FACT-NNN.md`, '
    + '`legitimation/dette-maintenance-agentique.md`, `npx aiad-sdd init`, [loc](./a.md), '
    + `\`${BASE_URL}docs/legitimation/conformite-cas-2026.md\`.`;
  const r = reecrireChemins(src);
  assert.equal(r.contenu, src);
  assert.equal(r.reecritures.length, 0);
});

test('règle 1 étendue — légitimation synchronisée sans ../, avec ou sans dossiers de tête', () => {
  const r = reecrireChemins(
    'Récits déplacés vers `framework/legitimation/conformite-cas-2026.md` ; '
    + 'preuves dans `legitimation/verification-evidence.md#limites` et [ici](legitimation/responsabilite-evidence.md).');
  assert.equal(r.contenu,
    `Récits déplacés vers \`${BASE_URL}docs/legitimation/conformite-cas-2026.md\` ; `
    + `preuves dans \`${BASE_URL}docs/legitimation/verification-evidence.md#limites\` et [ici](${BASE_URL}docs/legitimation/responsabilite-evidence.md).`);
  assert.deepEqual(r.reecritures.map((x) => x.regle), [1, 1, 1]);
  assert.equal(classerChemin('framework/legitimation/conformite-cas-2026.md').regle, 1);
  assert.equal(classerChemin('GLOSSAIRE-AIAD.md').regle, null);
  assert.equal(classerChemin('gouvernance/AIAD-RGPD.md').regle, null); // règle 2 : ../ requis
});

test('sous-cas 1b — chemin ../ dont le nom existe dans docs/legitimation/ du dépôt → URL', () => {
  const locale = ['dette-maintenance-agentique.md'];
  const src = '- [Argumentaire — Dette](../../../30_distribution/decideurs/argumentaires/dette-maintenance-agentique.md#x)\n'
    + 'Voir `../../30_distribution/decideurs/argumentaires/dette-maintenance-agentique.md`.\n'
    + '- [Gap](../../x/governance-gap-2026.md)';
  const r = reecrireChemins(src, { legitimationLocale: locale });
  const url = `${BASE_URL}docs/legitimation/dette-maintenance-agentique.md`;
  assert.equal(r.contenu, `- [Argumentaire — Dette](${url}#x)\nVoir \`${url}\`.\n- Gap`);
  assert.deepEqual(r.reecritures.map((x) => x.regle), ['1b', 3, '1b']); // liens d'abord, puis accents graves
  // Sans la liste (ou nom absent) → règle 3 inchangée
  assert.equal(classerChemin('../a/dette-maintenance-agentique.md').regle, 3);
  // Un nom nu présent localement n'est PAS réécrit (../ requis)
  assert.equal(classerChemin('dette-maintenance-agentique.md', { legitimationLocale: locale }).regle, null);
});

test('listerLegitimationLocale — lit docs/legitimation/ du dépôt cible, trié, + 4 dossiers synchronisés', () => {
  const depot = fixtureDepot();
  try {
    ecrire(depot, 'docs/legitimation/notes.txt', 'ignoré');
    assert.deepEqual(listerLegitimationLocale(depot), [
      'conformite-cas-2026.md', 'dette-maintenance-agentique.md', 'execution-gate-evidence.md',
      'responsabilite-evidence.md', 'verification-evidence.md',
    ]);
    assert.equal(listerLegitimationLocale(join(depot, 'absent')).length, 4);
  } finally {
    rmSync(depot, { recursive: true, force: true });
  }
});

test('lireVersionDoctrine — extrait v<X.Y> du H1', () => {
  assert.equal(lireVersionDoctrine('# Guide AIAD — Framework v1.9\n\ntexte'), 'v1.9');
  assert.equal(lireVersionDoctrine('\n# Guide AIAD — Framework v2.10\n'), 'v2.10');
});

test('lireVersionDoctrine — motif absent ou pas de H1 → SyncDoctrineError', () => {
  assert.throws(() => lireVersionDoctrine('# Guide AIAD\n\nFramework v1.9 dans le corps'), SyncDoctrineError);
  assert.throws(() => lireVersionDoctrine('Pas de titre'), SyncDoctrineError);
});

test('empreinte / construireLock — SHA-256 hex et forme du lock', () => {
  assert.equal(empreinte('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const lock = construireLock('v1.9', { 'a.md': 'abc' }, new Date('2026-09-26T00:00:00Z'));
  assert.deepEqual(lock, {
    doctrineVersion: 'v1.9',
    syncedAt: '2026-09-26T00:00:00.000Z',
    files: { 'a.md': empreinte('abc') },
  });
});

// ─── Pipeline sur fixture ────────────────────────────────────────────────────

test('CA-001 / CA-004 / CA-005 / CA-005b / CA-006 — synchronisation complète sur fixture', async () => {
  const src = fixtureSource();
  const depot = fixtureDepot();
  try {
    const craAvant = [
      readFileSync(join(depot, 'templates/.aiad/gouvernance/AIAD-CRA.md'), 'utf-8'),
      readFileSync(join(depot, '.aiad/gouvernance/AIAD-CRA.md'), 'utf-8'),
    ];
    const detteAvant = readFileSync(join(depot, 'docs/legitimation/dette-maintenance-agentique.md'), 'utf-8');
    let emitAppele = null;
    const res = await syncDoctrine({
      source: src, racine: depot, log: muet,
      emit: (r) => { emitAppele = r; },
      maintenant: new Date('2026-09-26T10:00:00Z'),
    });

    // CA-001 : cibles = source aux chemins réécrits près
    for (const c of CORRESPONDANCES) {
      const attendu = reecrireChemins(readFileSync(join(src, c.source), 'utf-8'), { legitimationLocale: listerLegitimationLocale(depot) }).contenu;
      for (const cible of c.cibles) assert.equal(readFileSync(join(depot, cible), 'utf-8'), attendu, cible);
    }
    assert.equal(res.ecrits.length, 14);

    // CA-004 : CRA inchangé ; dette-maintenance conservée
    assert.equal(readFileSync(join(depot, 'templates/.aiad/gouvernance/AIAD-CRA.md'), 'utf-8'), craAvant[0]);
    assert.equal(readFileSync(join(depot, '.aiad/gouvernance/AIAD-CRA.md'), 'utf-8'), craAvant[1]);
    assert.equal(readFileSync(join(depot, 'docs/legitimation/dette-maintenance-agentique.md'), 'utf-8'), detteAvant);

    // CA-005 : aucun ../ (lien ou accents graves) dans les 14 cibles
    for (const cible of CIBLES) {
      const t = readFileSync(join(depot, cible), 'utf-8');
      assert.doesNotMatch(t, /\]\(\.\.\//, cible);
      assert.doesNotMatch(t, /`\.\.\//, cible);
    }

    // CA-005b : les trois règles dans les fichiers produits
    const aiAct = readFileSync(join(depot, 'templates/.aiad/gouvernance/AIAD-AI-ACT.md'), 'utf-8');
    const urlCas = 'https://github.com/everssteeve/sdd-mode/blob/main/docs/legitimation/conformite-cas-2026.md';
    const refs = aiAct.match(/\S*conformite-cas-2026\S*/g);
    assert.equal(refs.length, 3); // backticks ../, lien ../, ligne d'historique sans ../
    for (const ref of refs) assert.ok(ref.includes(urlCas), ref);
    assert.doesNotMatch(aiAct, /PAS encore adopté/);
    const fw = readFileSync(join(depot, 'templates/frameworkAIAD.md'), 'utf-8');
    assert.ok(fw.includes(`\`${BASE_URL}templates/.aiad/gouvernance/AIAD-AI-ACT.md\``));
    assert.ok(fw.includes('`governance-gap-2026.md` (document publié avec le framework AIAD)'));
    const egev = readFileSync(join(depot, 'docs/legitimation/execution-gate-evidence.md'), 'utf-8');
    assert.ok(egev.includes('- Argumentaire — Governance Gap 2026\n'));
    assert.ok(egev.includes(`\`${BASE_URL}templates/.aiad/gouvernance/AIAD-RGPD.md\``));
    assert.ok(egev.includes(`- [Argumentaire — Dette](${BASE_URL}docs/legitimation/dette-maintenance-agentique.md)`));
    assert.deepEqual(res.reecritures, { 1: 8, '1b': 1, 2: 2, 3: 2 }); // AI-ACT : 4 règle 1 × 2 cibles ; etc.

    // CA-006 : lock
    const lock = JSON.parse(readFileSync(join(depot, LOCK_PATH), 'utf-8'));
    assert.equal(lock.doctrineVersion, 'v1.9');
    assert.equal(lock.syncedAt, '2026-09-26T10:00:00.000Z');
    assert.deepEqual(Object.keys(lock.files).sort(), [...CIBLES].sort());
    for (const cible of CIBLES) {
      assert.equal(lock.files[cible], empreinte(readFileSync(join(depot, cible), 'utf-8')), cible);
    }

    // Régénération des règles émises appelée sur la racine cible
    assert.equal(emitAppele, depot);
  } finally {
    rmSync(src, { recursive: true, force: true });
    rmSync(depot, { recursive: true, force: true });
  }
});

test('idempotence — second passage : 14 cibles à jour', async () => {
  const src = fixtureSource();
  const depot = fixtureDepot();
  try {
    await syncDoctrine({ source: src, racine: depot, log: muet, emit: false });
    const res = await syncDoctrine({ source: src, racine: depot, log: muet, emit: false });
    assert.equal(res.ecrits.length, 0);
    assert.equal(res.inchanges.length, 14);
  } finally {
    rmSync(src, { recursive: true, force: true });
    rmSync(depot, { recursive: true, force: true });
  }
});

test('CA-007 — --dry-run : aucun fichier modifié, liste des écritures et réécritures', async () => {
  const src = fixtureSource();
  const depot = fixtureDepot();
  try {
    const avant = instantane(depot);
    const lignes = [];
    let emitAppele = false;
    const res = await syncDoctrine({
      source: src, racine: depot, dryRun: true,
      log: (m) => lignes.push(m), emit: () => { emitAppele = true; },
    });
    assert.deepEqual(instantane(depot), avant);
    assert.equal(existsSync(join(depot, LOCK_PATH)), false);
    assert.equal(emitAppele, false);
    assert.equal(res.lock, null);
    assert.equal(res.ecrits.length, 14);
    const sortie = lignes.join('\n');
    assert.match(sortie, /templates\/frameworkAIAD\.md \(serait écrit\)/);
    assert.match(sortie, /\[règle 1\] `\.\.\/framework\/legitimation\/conformite-cas-2026\.md`/);
  } finally {
    rmSync(src, { recursive: true, force: true });
    rmSync(depot, { recursive: true, force: true });
  }
});

// ─── Cas limites (CA-008) : exit 2, aucun fichier modifié ───────────────────

async function verifierEchec(argv, { depot = fixtureDepot() } = {}) {
  const avant = instantane(depot);
  const errOrig = console.error;
  console.error = () => {};
  let code;
  try {
    code = await main(argv, { racine: depot, env: {}, emit: () => { throw new Error('emit ne doit pas être appelé'); } });
  } finally {
    console.error = errOrig;
  }
  assert.equal(code, 2);
  assert.deepEqual(instantane(depot), avant);
  rmSync(depot, { recursive: true, force: true });
}

test('CA-008 / cas 1 — --source absent → exit 2, rien d\'écrit', async () => {
  await verifierEchec([]);
});

test('CA-008 / cas 1 — --source inexistant → exit 2, rien d\'écrit', async () => {
  await verifierEchec(['--source', join(tmpdir(), 'aiad-syncdoc-inexistant-xyz')]);
});

test('CA-008 / cas 2 — un fichier source manquant → exit 2, aucune écriture partielle', async () => {
  const src = fixtureSource();
  try {
    rmSync(join(src, '20_conception/framework/legitimation/verification-evidence.md'));
    await verifierEchec(['--source', src]);
  } finally {
    rmSync(src, { recursive: true, force: true });
  }
});

test('CA-008 / cas 3 — titre sans « Framework v<X.Y> » → exit 2, rien d\'écrit', async () => {
  const src = fixtureSource({ titre: '# Guide AIAD — Framework' });
  try {
    await verifierEchec(['--source', src]);
  } finally {
    rmSync(src, { recursive: true, force: true });
  }
});

test('AIAD_DOCTRINE_SOURCE — utilisé à défaut de --source', async () => {
  const src = fixtureSource();
  const depot = fixtureDepot();
  const logOrig = console.log;
  console.log = () => {};
  try {
    const code = await main(['--dry-run'], { racine: depot, env: { AIAD_DOCTRINE_SOURCE: src }, emit: false });
    assert.equal(code, 0);
  } finally {
    console.log = logOrig;
    rmSync(src, { recursive: true, force: true });
    rmSync(depot, { recursive: true, force: true });
  }
});

test('CLI — processus réel : --source inexistant → exit 2 (sans écriture)', () => {
  const env = { ...process.env };
  delete env.AIAD_DOCTRINE_SOURCE;
  const r = spawnSync(process.execPath, [SCRIPT, '--source', join(tmpdir(), 'aiad-syncdoc-inexistant-xyz')], { encoding: 'utf-8', env });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Aucun fichier écrit/);
});
